import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { writeJsonAtomic } from './store.js';

export interface BatchRecord {
  id: string;
  at: string;
}

/** ~2 months of daily runs -- enough for a human skimming recent audit.yml activity, small enough
 * that the file never becomes something worth reading wholesale. */
const MAX_BATCH_HISTORY = 60;

function batchesPath(dataDir: string): string {
  return join(dataDir, 'batches.json');
}

export function readBatches(dataDir: string): BatchRecord[] {
  const path = batchesPath(dataDir);
  if (!existsSync(path)) return [];
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as { batches?: BatchRecord[] };
  return parsed.batches ?? [];
}

export function writeBatches(dataDir: string, batches: BatchRecord[]): void {
  writeJsonAtomic(batchesPath(dataDir), { batches });
}

/**
 * IMPLEMENTATION.md WP3.6 step 1: `batch_id = YYYYMMDD-<n>` where `n` counts batches already
 * recorded for that UTC day. `cli plan` and `cli merge` each call this independently against the
 * same `data/batches.json` (only `merge` actually appends -- `plan`'s own job in audit.yml never
 * pushes to `data`) rather than passing the id between them, since nothing else writes `data`
 * between the two steps of one workflow run (see docs/HANDOFF.md's WP3.5 note on the `data-branch`
 * concurrency group) -- so both calls land on the same id without needing a shared flag.
 */
export function nextBatchId(existing: BatchRecord[], today: Date): string {
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  const countToday = existing.filter((b) => b.id.startsWith(`${dateStr}-`)).length;
  return `${dateStr}-${countToday + 1}`;
}

export function appendBatch(existing: BatchRecord[], record: BatchRecord): BatchRecord[] {
  return [...existing, record].slice(-MAX_BATCH_HISTORY);
}
