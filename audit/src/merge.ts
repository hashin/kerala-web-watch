import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { appendBatch, nextBatchId, readBatches, writeBatches } from './batches.js';
import { computeOutlinks } from './outlinks.js';
import { computeSummary } from './summary.js';
import { mergeDeepAuditIntoData, readResult, writeJsonAtomic, writeResult, type Result } from './store.js';
import type { Registry } from './types.js';

export interface MergeSiteReport {
  id: string;
  status: string;
  score: number | null;
  screenshotCopied: boolean;
}

export interface MergeReport {
  batchId: string;
  sites: MergeSiteReport[];
}

function readFreshRuns(inDir: string): Result[] {
  const resultsDir = join(inDir, 'results');
  if (!existsSync(resultsDir)) return [];
  return readdirSync(resultsDir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(join(resultsDir, f), 'utf8')) as Result);
}

function copyScreenshotFiles(inDir: string, dataDir: string, screenshot: { desktop: string; mobile: string }): void {
  const destDir = join(dataDir, 'screenshots');
  if (!existsSync(destDir)) mkdirSync(destDir, { recursive: true });
  for (const file of [screenshot.desktop, screenshot.mobile]) {
    copyFileSync(join(inDir, 'screenshots', file), join(destDir, file));
  }
}

/**
 * WP3.6 merge step 2, end to end: fold every shard's `out/results/<id>.json` into `data/`'s own
 * record (`mergeDeepAuditIntoData`, store.ts), copy across only the screenshots that actually
 * changed, then recompute `outlinks.json` and `summary.json` from the *current* contents of
 * `data/results/*.json` -- the same "recompute, don't accumulate" pattern `cli light` already
 * uses for `summary.json` (see `outlinks.ts`'s own comment on why that's what makes this
 * idempotent). `data/batches.json` is the one piece of state that's deliberately NOT idempotent:
 * it's a log of "an audit.yml run happened", so a genuine second invocation is expected to record
 * a second entry -- see `batches.ts`'s comment on how `plan` and `merge` independently land on the
 * same id for one workflow run without passing it between them.
 */
export function mergeAll(inDir: string, dataDir: string, registry: Registry, opts: { now: Date }): MergeReport {
  const freshRuns = readFreshRuns(inDir);
  const today = opts.now.toISOString().slice(0, 10);

  const siteReports: MergeSiteReport[] = [];
  for (const freshRun of freshRuns) {
    const existingData = readResult(dataDir, freshRun.id);
    const { result, copyScreenshot } = mergeDeepAuditIntoData(existingData, freshRun, { today });
    writeResult(dataDir, result);

    if (copyScreenshot && result.deep?.screenshot) {
      copyScreenshotFiles(inDir, dataDir, result.deep.screenshot);
    }

    siteReports.push({ id: result.id, status: result.status, score: result.score?.overall ?? null, screenshotCopied: copyScreenshot });
  }

  const allResults = registry.sites.map((s) => readResult(dataDir, s.id)).filter((r): r is Result => r !== null);

  const outlinks = computeOutlinks(allResults.map((r) => ({ id: r.id, outlinks: r.deep?.outlinks ?? [] })));
  writeJsonAtomic(join(dataDir, 'outlinks.json'), outlinks);

  const vantages = [...new Set(allResults.map((r) => r.light?.vantage).filter((v): v is string => v != null))];
  const summary = computeSummary(registry, allResults, { now: opts.now, vantages });
  writeJsonAtomic(join(dataDir, 'summary.json'), summary);

  const batches = readBatches(dataDir);
  const batchId = nextBatchId(batches, opts.now);
  writeBatches(dataDir, appendBatch(batches, { id: batchId, at: opts.now.toISOString() }));

  return { batchId, sites: siteReports };
}
