import { resolve } from 'node:path';
import { loadRegistry } from '../../../audit/dist/registry.js';
import { readResult } from '../../../audit/dist/store.js';
import { computeSummary } from '../../../audit/dist/summary.js';
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
