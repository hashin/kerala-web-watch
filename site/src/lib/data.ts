import { resolve } from 'node:path';
import { loadRegistry } from '../../../audit/dist/registry.js';
import { readResult } from '../../../audit/dist/store.js';
import { computeSummary } from '../../../audit/dist/summary.js';
import { explainLightStatus } from '../../../audit/dist/status.js';
import { CHECKS } from '../../../audit/dist/checks/registry.js';
import type { Site, District, Department, Registry } from '../../../audit/dist/types.js';
import type { Result } from '../../../audit/dist/store.js';
import type { ResultStatus } from '../../../audit/dist/status.js';
import type { Summary, GroupStat } from '../../../audit/dist/summary.js';

export type { Result, GroupStat, Summary };
export type Status = ResultStatus;

// Resolved from process.cwd(), not import.meta.url: Vite relocates this module into
// dist/.prerender/chunks/ at build time, which would change a URL-relative path's meaning.
// process.cwd() is stable because every documented command (CLAUDE.md's Build & test table)
// runs from inside site/, one level below the repo root that registry/ and data/ live in.
//
// `data/` is a checkout of the orphan `data` branch (never on main, see CLAUDE.md layout) and is
// absent on a fresh clone or a local build — every read below must degrade gracefully to the
// "nothing audited yet" state rather than fail the build.
const REGISTRY_DIR = resolve(process.cwd(), '..', 'registry');
const DATA_DIR = resolve(process.cwd(), '..', 'data');

export interface SiteView extends Site {
  status: Status;
  result: Result | null;
}

// The build renders ~1,500+ pages, most of which need the registry or the summary at least once --
// each is loaded/computed exactly once per build and shared, not reloaded per page.
let cachedRegistry: Registry | undefined;

function getRegistry(): Registry {
  if (!cachedRegistry) cachedRegistry = loadRegistry(REGISTRY_DIR);
  return cachedRegistry;
}

let cachedSites: SiteView[] | undefined;

export function getSites(): SiteView[] {
  if (!cachedSites) {
    cachedSites = getRegistry().sites.map((site) => {
      const result = readResult(DATA_DIR, site.id);
      return { ...site, status: result?.status ?? 'unaudited', result };
    });
  }
  return cachedSites;
}

export function getSite(id: string): SiteView | undefined {
  return getSites().find((site) => site.id === id);
}

let cachedSummary: Summary | undefined;

/** Recomputed at build time from whatever `data/results/*.json` exists, rather than trusting a
 * checked-in `summary.json` verbatim -- the registry (ADR-012) and each result file are the
 * source of truth; `data/summary.json` is uptime.yml's own cache for the moment nothing else
 * reads it, but the site should never be one stale file away from a wrong headline number. */
export function getSummary(): Summary {
  if (!cachedSummary) {
    const results = getSites()
      .map((s) => s.result)
      .filter((r): r is Result => r !== null);
    cachedSummary = computeSummary(getRegistry(), results, { now: new Date(), vantages: ['gh-us'] });
  }
  return cachedSummary;
}

export function getDistricts(): District[] {
  return getRegistry().districts;
}

export function getDistrict(id: string): District | undefined {
  return getDistricts().find((d) => d.id === id);
}

export function getDepartments(): Department[] {
  return getRegistry().departments;
}

export function getDepartment(id: string): Department | undefined {
  return getDepartments().find((d) => d.id === id);
}

export const STATUSES: Status[] = ['down', 'hijacked', 'broken', 'poor', 'unverifiable', 'unaudited', 'needs-work', 'healthy'];

/**
 * ADR-026: what each status *category* means, in plain language, for a citizen who has just
 * landed on `/status/<status>/` or the methodology page and hasn't clicked into any one site yet.
 * This is ordinary UI copy, not a check explanation (ADR-013 governs those, via `explainStatus`
 * below) — but it must not contradict or duplicate a check's own `citizen` text, and both places
 * that show it (`/status/<status>/` and `/methodology/`) read from here so the two can't drift
 * apart the way the methodology page's own "Phase 3 hasn't been built yet" text drifted stale
 * while Phase 3 was actually being built (found and fixed in this same session, per ADR-026).
 */
export const STATUS_DESCRIPTIONS: Record<Status, string> = {
  down: 'Two failed checks in a row — the site did not answer, whether that was a DNS failure, a refused connection, or an HTTP error.',
  hijacked: 'The address no longer serves the real site — it now shows a parked/for-sale page, redirects to an unrelated domain, or was flagged by a malware check. Do not enter any personal details there.',
  broken: "The site responds, but shows nothing a citizen can use: a blank page, the web server's own default page, an \"under construction\" notice, or a security certificate a browser blocks.",
  unverifiable: 'We could not check this site from our monitoring location — for example, it may only allow visitors from Indian internet connections. It may be working fine for you.',
  healthy: 'Scored 80 or above out of 100 in the most recent deep audit.',
  'needs-work': 'Scored 50–79 out of 100 in the most recent deep audit — usable, with real problems worth fixing.',
  poor: 'Scored below 50 out of 100 in the most recent deep audit.',
  unaudited: 'No deep audit has run for this site yet — only the lightweight up/down check.',
};

export interface StatusReason {
  title: string;
  citizen: string;
}

/**
 * ADR-026: the specific, plain-language reason behind a `down`/`broken`/`hijacked`/`unverifiable`
 * status, never a fresh description invented here -- always the existing `citizen` text (ADR-013)
 * of the one check that actually set the status. A deep audit's own `issues[]` is authoritative
 * when present; before one exists, `explainLightStatus` mirrors the light-check-only status engine
 * (`status.ts`'s `deriveStatus`) exactly, so this can never name a reason other than the one that
 * really decided the badge. Returns `null` for `healthy`/`needs-work`/`poor`/`unaudited`, and for
 * `hijacked`, whose badge word ("Possibly hijacked — do not visit") is already the full warning.
 */
export function explainStatus(site: SiteView): StatusReason | null {
  if (site.status !== 'down' && site.status !== 'broken' && site.status !== 'unverifiable') return null;

  const fromIssues = site.result?.issues.find((issue) => CHECKS[issue.id].statusSetting === site.status);
  const id = fromIssues?.id ?? (site.result?.light ? explainLightStatus(site.result.light) : null);
  if (!id) return null;

  const meta = CHECKS[id];
  return { title: meta.title.en, citizen: meta.citizen.en };
}
