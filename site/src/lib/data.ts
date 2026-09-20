import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadRegistry } from '../../../audit/dist/registry.js';
import type { Site } from '../../../audit/dist/types.js';

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

export type Status =
  | 'unaudited'
  | 'unverifiable'
  | 'down'
  | 'hijacked'
  | 'broken'
  | 'healthy'
  | 'needs-work'
  | 'poor';

export interface SiteView extends Site {
  status: Status;
  score?: number;
}

export interface Summary {
  generated: string | null;
  totals: Record<string, number>;
  coverage: { deep_audited: number; total: number; eta: string | null };
}

interface ResultRecord {
  status?: Status;
  score?: { overall?: number };
}

function readResult(id: string): ResultRecord | undefined {
  const path = `${DATA_DIR}/results/${id}.json`;
  if (!existsSync(path)) return undefined;
  return JSON.parse(readFileSync(path, 'utf8'));
}

let cachedSites: SiteView[] | undefined;

export function getSites(): SiteView[] {
  if (!cachedSites) {
    const registry = loadRegistry(REGISTRY_DIR);
    cachedSites = registry.sites.map((site) => {
      const result = readResult(site.id);
      return { ...site, status: result?.status ?? 'unaudited', score: result?.score?.overall };
    });
  }
  return cachedSites;
}

export function getSite(id: string): SiteView | undefined {
  return getSites().find((site) => site.id === id);
}

export function getSummary(): Summary {
  const path = `${DATA_DIR}/summary.json`;
  if (existsSync(path)) {
    return JSON.parse(readFileSync(path, 'utf8'));
  }
  return { generated: null, totals: {}, coverage: { deep_audited: 0, total: getSites().length, eta: null } };
}
