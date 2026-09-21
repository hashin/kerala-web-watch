import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { appendBatch, nextBatchId, readBatches, writeBatches } from '../src/batches.js';

describe('batches (WP3.6 step 1: batch_id = YYYYMMDD-<n>)', () => {
  it('is 1 for the first batch of a day with no prior history', () => {
    expect(nextBatchId([], new Date('2026-09-21T03:00:00Z'))).toBe('20260921-1');
  });

  it('counts up for a second batch the same day', () => {
    const existing = [{ id: '20260921-1', at: '2026-09-21T03:00:00Z' }];
    expect(nextBatchId(existing, new Date('2026-09-21T14:00:00Z'))).toBe('20260921-2');
  });

  it('resets to 1 on a new day regardless of how many batches came before', () => {
    const existing = [
      { id: '20260920-1', at: '2026-09-20T03:00:00Z' },
      { id: '20260920-2', at: '2026-09-20T14:00:00Z' },
    ];
    expect(nextBatchId(existing, new Date('2026-09-21T03:00:00Z'))).toBe('20260921-1');
  });

  it('appendBatch caps history at the last 60 entries', () => {
    const existing = Array.from({ length: 60 }, (_, i) => ({ id: `id-${i}`, at: `2026-01-${String(i).padStart(2, '0')}` }));
    const result = appendBatch(existing, { id: 'newest', at: '2026-09-21T00:00:00Z' });
    expect(result).toHaveLength(60);
    expect(result[result.length - 1].id).toBe('newest');
    expect(result[0].id).toBe('id-1'); // id-0 fell off the front
  });

  describe('readBatches/writeBatches round-trip', () => {
    let dataDir: string;

    beforeEach(() => {
      dataDir = mkdtempSync(join(tmpdir(), 'kww-batches-test-'));
    });

    afterEach(() => {
      rmSync(dataDir, { recursive: true, force: true });
    });

    it('returns an empty list when batches.json does not exist yet', () => {
      expect(readBatches(dataDir)).toEqual([]);
    });

    it('writes then reads back the same records', () => {
      const records = [{ id: '20260921-1', at: '2026-09-21T03:00:00Z' }];
      writeBatches(dataDir, records);
      expect(readBatches(dataDir)).toEqual(records);
    });
  });
});
