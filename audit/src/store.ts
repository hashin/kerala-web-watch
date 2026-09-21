import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { LightResult } from './light.js';
import { appendHistory, type HistoryEntry } from './history.js';
import { deriveStatus, isBrokenClass, type ResultStatus } from './status.js';

export interface StoredLight extends LightResult {
  vantage: string;
  suspect: boolean;
}

/** One JSON file per site (`data/results/<id>.json`), shape per DESIGN §5.5. `deep`/`score`/
 * `issues` stay null/empty until Phase 3 runs a deep audit -- the shape is settled now so that
 * WP doesn't need a migration. */
export interface Result {
  id: string;
  url: string;
  light: StoredLight | null;
  deep: null;
  score: null;
  status: ResultStatus;
  issues: [];
  history: HistoryEntry[];
}

function resultPath(dataDir: string, id: string): string {
  return join(dataDir, 'results', `${id}.json`);
}

export function readResult(dataDir: string, id: string): Result | null {
  const path = resultPath(dataDir, id);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf8')) as Result;
}

/** Write-to-temp-then-rename so a crash or a concurrent reader never sees a half-written file --
 * `rename` is atomic on the same filesystem, which a sibling temp file in the same directory
 * guarantees even across the different volume layouts CI and a laptop might use. */
export function writeJsonAtomic(path: string, data: unknown): void {
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const tmpPath = `${path}.${process.pid}.tmp`;
  writeFileSync(tmpPath, JSON.stringify(data, null, 2) + '\n');
  renameSync(tmpPath, path);
}

export function writeResult(dataDir: string, result: Result): void {
  writeJsonAtomic(resultPath(dataDir, result.id), result);
}

/**
 * Folds one fresh light check into a site's stored result: derives the new status (§5.4),
 * appends today's history entry, and creates the record from scratch (status `unaudited`) if
 * this site has never been checked before.
 */
export function mergeLightResult(
  existing: Result | null,
  site: { id: string; url: string },
  light: LightResult,
  opts: { vantage: string; today: string },
): Result {
  const previousStatus = existing?.status ?? 'unaudited';
  const previousLight = existing?.light ?? null;
  const hasDeepAudit = existing?.deep != null;

  const { status, lightSuspect } = deriveStatus({ previousStatus, previousLight, newLight: light, hasDeepAudit });
  const historyEntry: HistoryEntry = { d: opts.today, up: !isBrokenClass(status), score: existing?.score ?? null };

  return {
    id: site.id,
    url: site.url,
    light: { ...light, vantage: opts.vantage, suspect: lightSuspect },
    deep: existing?.deep ?? null,
    score: existing?.score ?? null,
    status,
    issues: existing?.issues ?? [],
    history: appendHistory(existing?.history ?? [], historyEntry),
  };
}
