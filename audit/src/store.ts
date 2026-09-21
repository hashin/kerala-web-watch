import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { CheckResult } from './checks/types.js';
import type { LightResult } from './light.js';
import { appendHistory, type HistoryEntry } from './history.js';
import type { Issue, ScoreBreakdown, ScoreOutcome } from './score.js';
import { deriveStatus, isBrokenClass, type ResultStatus } from './status.js';

export interface StoredLight extends LightResult {
  vantage: string;
  suspect: boolean;
}

export interface DeepTech {
  cms: string | null;
  server: string | null;
  jquery: string | null;
}

export interface DeepScreenshot {
  desktop: string;
  mobile: string;
  phash: string;
}

/** DESIGN §5.5's `deep` object, produced once per Phase-3 audit run (WP3.5's `runner.ts`).
 * `checks` keeps every check id's outcome (not just fail/warn) so a site's own page can show a
 * full pass/fail/na table, not just the `issues` summary. `error` is set, with `status` left
 * whatever it was before, when the run itself threw uncaught (WP3.5 step 5) -- distinct from a
 * completed run that legitimately found the site `down`/`broken`. */
export interface DeepResult {
  at: string;
  run: string;
  vantage: string;
  lighthouse: { performance: number; accessibility: number; best_practices: number; seo: number } | null;
  axe: { critical: number; serious: number; moderate: number; minor: number };
  crawl: { pages: number; pdfs: number; broken: number };
  tech: DeepTech;
  checks: CheckResult[];
  screenshot: DeepScreenshot | null;
  error?: string;
}

/** One JSON file per site (`data/results/<id>.json`), shape per DESIGN §5.5. */
export interface Result {
  id: string;
  url: string;
  light: StoredLight | null;
  deep: DeepResult | null;
  score: ScoreBreakdown | null;
  status: ResultStatus;
  issues: Issue[];
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
  const historyEntry: HistoryEntry = { d: opts.today, up: !isBrokenClass(status), score: existing?.score?.overall ?? null };

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

/**
 * Folds a completed deep audit into a site's stored result: `runner.ts` always does its own fresh
 * light probe as the first step of a deep audit (not a reuse of whatever light check happened to
 * run last), so this replaces `light` outright (never `suspect` -- a deliberate full audit run is
 * as trustworthy as a light check gets) and, unlike `mergeLightResult`, lets `scoreOutcome.status`
 * -- not the two-strike light-check rule -- decide the new status directly: a deep audit is
 * authoritative evidence, and DESIGN §5.4's `unverifiable`/`broken`/`down`/healthy-needs-work-poor
 * ladder all come from `scoreSite`, not from `status.ts`'s light-only rules.
 */
export function mergeRunResult(
  existing: Result | null,
  site: { id: string; url: string },
  light: LightResult,
  deep: DeepResult,
  scoreOutcome: ScoreOutcome,
  opts: { vantage: string; today: string },
): Result {
  const historyEntry: HistoryEntry = { d: opts.today, up: !isBrokenClass(scoreOutcome.status), score: scoreOutcome.score?.overall ?? null };
  return {
    id: site.id,
    url: site.url,
    light: { ...light, vantage: opts.vantage, suspect: false },
    deep,
    score: scoreOutcome.score,
    status: scoreOutcome.status,
    issues: scoreOutcome.issues,
    history: appendHistory(existing?.history ?? [], historyEntry),
  };
}

/**
 * WP3.5 step 5: when a deep audit throws uncaught anywhere in its pipeline, the site's *status*
 * stays exactly what it was before (a half-finished audit is not evidence the site got worse) --
 * only `deep.error` and the fresh light probe (already completed by the time anything else could
 * throw) get recorded, and any previous score/issues/screenshot are carried forward untouched.
 */
export function mergeErrorResult(
  existing: Result | null,
  site: { id: string; url: string },
  light: LightResult,
  err: unknown,
  opts: { vantage: string; today: string; runId: string; now: Date },
): Result {
  const deep: DeepResult = {
    at: opts.now.toISOString(),
    run: opts.runId,
    vantage: opts.vantage,
    lighthouse: null,
    axe: { critical: 0, serious: 0, moderate: 0, minor: 0 },
    crawl: { pages: 0, pdfs: 0, broken: 0 },
    tech: { cms: null, server: null, jquery: null },
    checks: [],
    screenshot: existing?.deep?.screenshot ?? null,
    error: err instanceof Error ? err.message : String(err),
  };
  const status = existing?.status ?? 'unaudited';
  const historyEntry: HistoryEntry = { d: opts.today, up: !isBrokenClass(status), score: existing?.score?.overall ?? null };
  return {
    id: site.id,
    url: site.url,
    light: { ...light, vantage: opts.vantage, suspect: false },
    deep,
    score: existing?.score ?? null,
    status,
    issues: existing?.issues ?? [],
    history: appendHistory(existing?.history ?? [], historyEntry),
  };
}
