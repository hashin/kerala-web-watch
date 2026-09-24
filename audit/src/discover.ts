import { dump as dumpYaml } from 'js-yaml';
import { lightCheck } from './light.js';
import { normalizeUrl } from './url.js';
import type { OutlinksData } from './outlinks.js';
import type { IgnoreEntry, Registry } from './types.js';

const GOV_HOST_PATTERN = /\.(kerala\.gov\.in|gov\.in|nic\.in|ac\.in)$/i;
const KERALA_TEXT_PATTERN = /kerala|കേരള/i;

/** DESIGN §6.6 step 1: a host is worth a human's look if it's plausibly a Kerala government site
 * -- either the hostname itself says so, or the anchor text a crawled page used to link to it
 * does (a `.co.in` or generic domain reached via a link whose text is literally "Kerala..."). */
export function looksLikeKeralaGovHost(host: string, texts: string[]): boolean {
  if (GOV_HOST_PATTERN.test(host)) return true;
  if (KERALA_TEXT_PATTERN.test(host)) return true;
  return texts.some((text) => KERALA_TEXT_PATTERN.test(text));
}

export function filterCandidateHosts(outlinks: OutlinksData): string[] {
  return Object.keys(outlinks)
    .filter((host) => looksLikeKeralaGovHost(host, outlinks[host].texts))
    .sort();
}

function hostnameOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** Every hostname already in the registry, from each site's `url` and its `aliases` -- so a
 * platform-hosted site's alias domain doesn't get proposed as a "new" candidate. */
export function registeredHosts(registry: Registry): Set<string> {
  const hosts = new Set<string>();
  for (const site of registry.sites) {
    for (const url of [site.url, ...site.aliases]) {
      const host = hostnameOf(url);
      if (host) hosts.add(host);
    }
  }
  return hosts;
}

/** `registry/ignore.yaml`'s `pattern` covers the host itself and any of its subdomains (matches
 * `district-portals.ts`'s own exact-hostname convention, extended to subdomains since several
 * existing entries, e.g. `aai.aero`, are clearly meant to catch the whole organisation). */
export function isIgnoredHost(host: string, ignore: IgnoreEntry[]): boolean {
  return ignore.some((entry) => {
    const pattern = entry.pattern.toLowerCase();
    return host === pattern || host.endsWith(`.${pattern}`);
  });
}

/** DESIGN §6.6 step 2: known hosts (already registered, or a human already decided this isn't a
 * Kerala government org's own site) are dropped before anything gets light-checked -- this is
 * also what makes discovery converge: merging a candidate into `sites/` removes its host from
 * `registeredHosts`'s complement next run, so it's never proposed again. */
export function newCandidateHosts(outlinks: OutlinksData, registry: Registry, ignore: IgnoreEntry[]): string[] {
  const known = registeredHosts(registry);
  return filterCandidateHosts(outlinks).filter((host) => !known.has(host) && !isIgnoredHost(host, ignore));
}

export interface DiscoveredCandidate {
  url: string;
  name: string;
  source: 'discover';
  source_page: string;
  hints: Record<string, never>;
  fetched_at: string;
  /** Site ids whose deep-audit crawl linked to this host (outlinks.json's own `from`, already
   * capped at 5) -- the PR table's "seen from" column, and real provenance for CLAUDE.md's
   * "never invent URLs" rule: every candidate here was an actual outbound link, not a guess. */
  seen_from: string[];
  link_count: number;
}

export interface DiscoverOptions {
  delayMs?: number;
  sleep?: (ms: number) => Promise<void>;
  now?: () => Date;
  /** `https` in production; a test overrides this to `http` so `hosts` can be a local test
   * server's `127.0.0.1:<port>` address without needing real TLS. */
  scheme?: 'http' | 'https';
}

/**
 * DESIGN §6.6 steps 3-4: light-checks each surviving host, sequentially, at least a second apart
 * -- the same politeness limit every other live check in this project honours, applied here too
 * since discovery is still a real request to a real site, not exempt just because it's a script.
 * Only hosts that actually answered (`light.status !== null` -- got some HTTP response, even a
 * 4xx/5xx) become candidates; a DNS-dead or connection-refused host isn't a government website
 * worth a human's curation time.
 */
export async function discoverCandidates(hosts: string[], outlinks: OutlinksData, registry: Registry, opts: DiscoverOptions = {}): Promise<DiscoveredCandidate[]> {
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const delayMs = opts.delayMs ?? 1000;
  const now = opts.now ?? (() => new Date());
  const scheme = opts.scheme ?? 'https';
  const out: DiscoveredCandidate[] = [];

  for (const [index, host] of hosts.entries()) {
    if (index > 0) await sleep(delayMs);
    const entry = outlinks[host];
    const homepage = `${scheme}://${host}/`;
    const light = await lightCheck(homepage);
    if (light.status === null) continue;

    const primaryFromId = entry.from[0];
    const sourcePage = primaryFromId ? (registry.byId.get(primaryFromId)?.url ?? homepage) : homepage;

    out.push({
      url: normalizeUrl(light.final_url ?? homepage),
      name: light.title?.trim() || host,
      source: 'discover',
      source_page: sourcePage,
      hints: {},
      fetched_at: now().toISOString(),
      seen_from: entry.from,
      link_count: entry.count,
    });
  }
  return out;
}

const CANDIDATES_HEADER =
  '# Weekly discovery (DESIGN.md §6.6): government-looking hosts seen as outbound links during deep\n' +
  '# audits, not yet in the registry or registry/ignore.yaml. A human merges what is real into\n' +
  '# registry/sites/*.yaml (with department/district/kind hints filled in) and moves the rest to\n' +
  '# ignore.yaml with a reason -- this file itself is never read by the audit suite.\n';

export function renderCandidatesYaml(candidates: DiscoveredCandidate[]): string {
  return CANDIDATES_HEADER + dumpYaml(candidates, { sortKeys: false, lineWidth: -1 });
}

export function toDiscoveryTable(candidates: DiscoveredCandidate[]): string {
  if (candidates.length === 0) return '_No new candidates this week._';
  const header = '| Host | Title | Seen from | Links |\n|---|---|---|---|';
  const rows = candidates.map((c) => `| ${new URL(c.url).hostname} | ${c.name} | ${c.seen_from.join(', ') || '—'} | ${c.link_count} |`);
  return [header, ...rows].join('\n');
}
