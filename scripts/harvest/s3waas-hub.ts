import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { load as parseYaml } from 'js-yaml';
import { parseHTML } from 'linkedom';
import { loadRegistry } from '../../audit/dist/registry.js';
import { dedupeKey, emit, writeCandidates, type Candidate } from './lib.js';

// kerala.s3waas.gov.in (found by the human, 2026-09-21) is NIC's S3WaaS hub page for Kerala: a
// single landing page linking the 14 district portals already harvested in WP1.5, plus a
// handful of other links in its header/footer. Only those "plus a handful" links can possibly be
// new -- the district portals themselves will all resolve to dedupeKeys already in the registry.
const SOURCE_PAGE = 'https://kerala.s3waas.gov.in/';
const USER_AGENT = 'KeralaWebWatch/1.0 (+https://govwebsite.hashin.me/about; civic audit harvest, one-time and human-supervised)';
const REGISTRY_DIR = join(process.cwd(), 'registry');
const CANDIDATES_DIR = join(REGISTRY_DIR, 'candidates');

interface IgnoreEntry {
  pattern: string;
}

function loadIgnorePatterns(): string[] {
  const raw = parseYaml(readFileSync(join(REGISTRY_DIR, 'ignore.yaml'), 'utf8')) as IgnoreEntry[];
  return raw.map((e) => e.pattern);
}

function loadCandidateKeys(): Set<string> {
  const keys = new Set<string>();
  for (const file of readdirSync(CANDIDATES_DIR)) {
    if (!file.endsWith('.yaml') || file === 'no-website.yaml') continue;
    const entries = (parseYaml(readFileSync(join(CANDIDATES_DIR, file), 'utf8')) as Candidate[]) ?? [];
    for (const c of entries) keys.add(dedupeKey(c.url));
  }
  return keys;
}

function registryKeys(): Set<string> {
  const registry = loadRegistry(REGISTRY_DIR);
  const keys = new Set<string>();
  for (const site of registry.sites) {
    keys.add(dedupeKey(site.url));
    for (const alias of site.aliases) keys.add(dedupeKey(alias));
  }
  return keys;
}

async function main(): Promise<void> {
  const res = await fetch(SOURCE_PAGE, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`${SOURCE_PAGE} -> HTTP ${res.status}`);
  const html = await res.text();
  const { document } = parseHTML(html);

  const hrefs = Array.from(document.querySelectorAll('a[href^="http"]'))
    .map((a) => a.getAttribute('href')?.trim())
    .filter((href): href is string => !!href);

  const ignorePatterns = loadIgnorePatterns();
  const known = new Set([...registryKeys(), ...loadCandidateKeys()]);

  const fresh: Candidate[] = [];
  const alreadyKnown: string[] = [];
  const unrecognizedCentral: string[] = [];

  for (const href of Array.from(new Set(hrefs))) {
    const key = dedupeKey(href);
    if (known.has(key)) {
      alreadyKnown.push(href);
      continue;
    }
    const host = new URL(href).hostname;
    const matchesIgnore = ignorePatterns.some((p) => host === p || host.endsWith(`.${p}`));
    if (matchesIgnore) {
      alreadyKnown.push(href);
      continue;
    }
    // Heuristic only: a Kerala-specific hostname is treated as a fresh candidate; anything else
    // (generic central portals like data.gov.in, meity.gov.in) is left for a human to file in
    // ignore.yaml with a real reason, not auto-classified here.
    if (!/kerala|^kl\.|\.kl\./i.test(host)) {
      unrecognizedCentral.push(href);
      continue;
    }
    fresh.push(emit({ url: href, name: host, source: 's3waas-hub', source_page: SOURCE_PAGE }));
  }

  console.error(`${alreadyKnown.length} links already registered or ignored`);
  console.error(`${unrecognizedCentral.length} links look like generic/central sites, left for manual ignore.yaml triage:`);
  for (const u of unrecognizedCentral) console.error(`  ${u}`);
  console.error(`${fresh.length} new candidates`);

  const path = writeCandidates('s3waas-hub', fresh);
  console.log(`Wrote ${fresh.length} candidates to ${path}`);
}

main();
