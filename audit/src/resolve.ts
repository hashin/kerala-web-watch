import { getDomain } from 'tldts';
import { lightCheck, type LightResult } from './light.js';
import type { ValidationFailure } from './validate.js';

export interface ResolveSite {
  id: string;
  url: string;
  aliases: string[];
  /** Display-only, for the PR comment's resolved-sites table -- the domain/status checks below
   * never look at it. */
  name?: string;
}

export interface ResolveOutcome {
  id: string;
  name?: string;
  url: string;
  ok: boolean;
  failures: ValidationFailure[];
}

export interface ResolveOptions {
  timeoutMs?: number;
  /** Delay before each request after the first -- CLAUDE.md's <=1 request/second politeness
   * limit, applied globally rather than per-host since a --resolve run is a handful of PR-sized
   * entries, not a scan; a global delay is a stricter (always safe) superset of per-host. */
  delayMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

function registrableDomain(url: string): string | null {
  try {
    return getDomain(new URL(url).hostname);
  } catch {
    return null;
  }
}

/** A DNS failure is fatal to the entry -- nothing else the light check found means anything if
 * the hostname doesn't resolve at all, so this alone decides whether to even check the rest. */
export function dnsFailure(site: ResolveSite, result: Pick<LightResult, 'dns'>): ValidationFailure | null {
  if (result.dns) return null;
  return { file: 'resolve', id: site.id, rule: 'resolve-dns', severity: 'error', message: `DNS lookup failed for ${site.url}` };
}

/** Fails when the page it actually landed on belongs to a different organisation than the entry
 * claims -- an undeclared redirect or a squatted domain, per WP1.7's real findings of exactly
 * that. A declared alias is a known, already-vetted exception, not a failure. */
export function domainFailure(site: ResolveSite, result: Pick<LightResult, 'domain' | 'final_domain'>): ValidationFailure | null {
  if (!result.final_domain) return null;
  const knownDomains = new Set(
    [site.url, ...site.aliases].map(registrableDomain).filter((d): d is string => d !== null),
  );
  if (knownDomains.has(result.final_domain)) return null;
  return {
    file: 'resolve',
    id: site.id,
    rule: 'resolve-domain',
    severity: 'error',
    message: `${site.url} resolves to ${result.final_domain}, not ${result.domain ?? 'its own domain'} or a declared alias -- add an alias if this is a legitimate mirror, or fix the url if it's a squat/redirect`,
  };
}

/** Only a warning, never fails the PR: sites bounce for all sorts of benign reasons (maintenance
 * page, a redirect chain ending in a login wall) that deserve a human's eyes, not an automatic
 * rejection -- DNS and domain problems above are the load-bearing checks. */
export function statusWarning(site: ResolveSite, result: Pick<LightResult, 'status' | 'status_class'>): ValidationFailure | null {
  if (result.status !== null && result.status >= 200 && result.status < 300) return null;
  const seen = result.status !== null ? `HTTP ${result.status}` : result.status_class;
  return { file: 'resolve', id: site.id, rule: 'resolve-status', severity: 'warn', message: `${site.url} returned ${seen}` };
}

export async function resolveSite(site: ResolveSite, opts: ResolveOptions = {}): Promise<ValidationFailure[]> {
  const result = await lightCheck(site.url, { timeoutMs: opts.timeoutMs ?? 20_000 });
  const dns = dnsFailure(site, result);
  if (dns) return [dns];
  return [domainFailure(site, result), statusWarning(site, result)].filter((f): f is ValidationFailure => f !== null);
}

/**
 * Resolves each site in turn (never in parallel -- politeness, not just a nod to the 1/s limit,
 * since a --resolve batch is usually many different departments' entries, not repeated hits on
 * one host) and reports every one of them, not just the failures, so a PR adding a genuinely
 * fine site sees a positive confirmation rather than silence.
 */
export async function resolveSites(sites: ResolveSite[], opts: ResolveOptions = {}): Promise<ResolveOutcome[]> {
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const delayMs = opts.delayMs ?? 1000;
  const out: ResolveOutcome[] = [];
  for (const [index, site] of sites.entries()) {
    if (index > 0) await sleep(delayMs);
    const failures = await resolveSite(site, opts);
    out.push({ id: site.id, name: site.name, url: site.url, ok: !failures.some((f) => f.severity === 'error'), failures });
  }
  return out;
}

export function toResolvedTable(outcomes: ResolveOutcome[]): string {
  if (outcomes.length === 0) return '';
  const header = '| | Id | Name | URL |\n|---|---|---|---|';
  const rows = outcomes.map((o) => `| ${o.ok ? '✅' : '❌'} | ${o.id} | ${o.name ?? ''} | ${o.url} |`);
  return ['### Resolved', header, ...rows].join('\n');
}
