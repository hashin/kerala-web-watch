import { describe, expect, it } from 'vitest';
import { computeBatchSize, computeShardCount, deriveScheduleState, orderSites, planBatch, shardRoundRobin, type SchedulableSite, type ScheduleState } from '../src/scheduler.js';
import type { Result } from '../src/store.js';

function site(id: string, overrides: Partial<SchedulableSite> = {}): SchedulableSite {
  return { id, priority: 2, deepBump: false, deepAt: null, statusJustChanged: false, ...overrides };
}

describe('scheduler', () => {
  describe('deriveScheduleState', () => {
    it('reads a site with no stored result as never-audited', () => {
      expect(deriveScheduleState(null)).toEqual({ deepBump: false, deepAt: null, statusJustChanged: false });
    });

    it('reads deep_bump and deep.at straight off the record', () => {
      const result = { deep_bump: true, deep: { at: '2026-09-10T00:00:00Z' }, history: [] } as unknown as Result;
      expect(deriveScheduleState(result)).toEqual({ deepBump: true, deepAt: '2026-09-10T00:00:00Z', statusJustChanged: false });
    });

    it('flags a status change when the two most recent history entries disagree', () => {
      const result = { deep_bump: false, deep: null, history: [{ d: '2026-09-21', up: true, score: null }, { d: '2026-09-20', up: false, score: null }] } as unknown as Result;
      expect(deriveScheduleState(result).statusJustChanged).toBe(true);
    });

    it('does not flag a status change when the two most recent entries agree', () => {
      const result = { deep_bump: false, deep: null, history: [{ d: '2026-09-21', up: false, score: null }, { d: '2026-09-20', up: false, score: null }] } as unknown as Result;
      expect(deriveScheduleState(result).statusJustChanged).toBe(false);
    });

    it('does not flag a status change with fewer than two history entries', () => {
      const result = { deep_bump: false, deep: null, history: [{ d: '2026-09-21', up: false, score: null }] } as unknown as Result;
      expect(deriveScheduleState(result).statusJustChanged).toBe(false);
    });
  });

  describe('orderSites (DESIGN §6.2)', () => {
    it('puts a deep_bump site ahead of everything else', () => {
      const ordered = orderSites([site('never', {}), site('bumped', { deepBump: true, deepAt: '2020-01-01' }), site('changed', { deepAt: '2020-01-01', statusJustChanged: true })]);
      expect(ordered[0].id).toBe('bumped');
      expect(ordered[0].tier).toBe(1);
    });

    it('puts a never-audited site ahead of a status-changed or stale one', () => {
      const ordered = orderSites([site('stale', { deepAt: '2020-01-01' }), site('changed', { deepAt: '2020-01-01', statusJustChanged: true }), site('new')]);
      expect(ordered[0].id).toBe('new');
      expect(ordered[0].tier).toBe(2);
    });

    it('puts a status-just-changed site ahead of an ordinary stale re-audit', () => {
      const ordered = orderSites([site('stale', { deepAt: '2020-01-01' }), site('changed', { deepAt: '2020-01-01', statusJustChanged: true })]);
      expect(ordered[0].id).toBe('changed');
      expect(ordered[0].tier).toBe(3);
    });

    it('orders tier-4 sites by oldest deep.at first', () => {
      const ordered = orderSites([site('newer', { deepAt: '2026-09-10' }), site('older', { deepAt: '2026-01-01' })]);
      expect(ordered.map((s) => s.id)).toEqual(['older', 'newer']);
    });

    it('breaks ties within a tier by priority descending, then id', () => {
      const ordered = orderSites([
        site('b-low', { priority: 1, deepAt: '2026-01-01' }),
        site('a-high', { priority: 3, deepAt: '2026-01-01' }),
        site('c-high', { priority: 3, deepAt: '2026-01-01' }),
      ]);
      expect(ordered.map((s) => s.id)).toEqual(['a-high', 'c-high', 'b-low']);
    });
  });

  describe('computeBatchSize (ADR-004)', () => {
    it('floors at the minimum for a small registry', () => {
      expect(computeBatchSize(10, { refreshDays: 7, minBatch: 50, maxBatch: 300 })).toBe(50);
    });

    it('computes ceil(N / refreshDays) in the steady middle', () => {
      expect(computeBatchSize(1400, { refreshDays: 7, minBatch: 50, maxBatch: 300 })).toBe(200);
    });

    it('caps at the maximum for a large registry', () => {
      expect(computeBatchSize(10_000, { refreshDays: 7, minBatch: 50, maxBatch: 300 })).toBe(300);
    });
  });

  describe('computeShardCount', () => {
    it('never returns fewer than 1 shard, even for an empty batch', () => {
      expect(computeShardCount(0, { maxShards: 6, shardSize: 40 })).toBe(1);
    });

    it('caps at maxShards for a large batch', () => {
      expect(computeShardCount(300, { maxShards: 6, shardSize: 40 })).toBe(6);
    });

    it('uses ceil(batchSize / shardSize) below the cap', () => {
      expect(computeShardCount(90, { maxShards: 6, shardSize: 40 })).toBe(3);
    });
  });

  describe('shardRoundRobin', () => {
    it('distributes ids round-robin, balanced to within one of each other', () => {
      const shards = shardRoundRobin(['a', 'b', 'c', 'd', 'e'], 2);
      expect(shards).toEqual([
        ['a', 'c', 'e'],
        ['b', 'd'],
      ]);
    });
  });

  describe('planBatch', () => {
    const baseOptions = { refreshDays: 7, minBatch: 50, maxBatch: 300, maxShards: 6, shardSize: 40 };

    it('orders and selects 20 synthetic sites with mixed signals into the expected priority order', () => {
      const activeSites = [
        { id: 'core-a', priority: 3 as const },
        { id: 'core-b', priority: 3 as const },
        { id: 'bumped', priority: 1 as const },
        { id: 'never-1', priority: 2 as const },
        { id: 'never-2', priority: 1 as const },
        { id: 'changed', priority: 2 as const },
        ...Array.from({ length: 14 }, (_, i) => ({ id: `stale-${i}`, priority: 2 as const })),
      ];
      const scheduleState = new Map<string, ScheduleState>([
        ['core-a', { deepBump: false, deepAt: '2026-08-01', statusJustChanged: false }],
        ['core-b', { deepBump: false, deepAt: '2026-08-15', statusJustChanged: false }],
        ['bumped', { deepBump: true, deepAt: '2026-09-01', statusJustChanged: false }],
        ['never-1', { deepBump: false, deepAt: null, statusJustChanged: false }],
        ['never-2', { deepBump: false, deepAt: null, statusJustChanged: false }],
        ['changed', { deepBump: false, deepAt: '2026-08-20', statusJustChanged: true }],
        ...Array.from({ length: 14 }, (_, i) => [`stale-${i}`, { deepBump: false, deepAt: `2026-08-${10 + i}`, statusJustChanged: false }] as const),
      ]);

      const output = planBatch({ activeSites, scheduleState, forcedSiteIds: [], refreshDays: 7, minBatch: 50, maxBatch: 300, maxShards: 6, shardSize: 40 });

      expect(output.ordered).not.toBeNull();
      const orderedIds = output.ordered!.map((s) => s.id);
      expect(orderedIds[0]).toBe('bumped');
      expect(new Set(orderedIds.slice(1, 3))).toEqual(new Set(['never-1', 'never-2']));
      expect(orderedIds[3]).toBe('changed');
      // batch size floors at 50 for a 20-site registry, so every site is selected
      expect(output.selected).toHaveLength(20);
      expect(output.batchSize).toBe(20);
    });

    it('caps the batch at maxBatch and shards it, never dropping or duplicating an id', () => {
      const activeSites = Array.from({ length: 2100 }, (_, i) => ({ id: `site-${i}`, priority: 2 as const }));
      const scheduleState = new Map<string, ScheduleState>(activeSites.map((s) => [s.id, { deepBump: false, deepAt: null, statusJustChanged: false }]));

      const output = planBatch({ activeSites, scheduleState, forcedSiteIds: [], ...baseOptions });

      expect(output.batchSize).toBe(300); // clamp(ceil(2100/7), 50, 300) = 300
      expect(output.shards).toHaveLength(6); // ceil(300/40) capped at 6
      const allShardIds = output.shards.flat();
      expect(allShardIds).toHaveLength(300);
      expect(new Set(allShardIds).size).toBe(300);
    });

    it('respects a --batch-size override', () => {
      const activeSites = Array.from({ length: 500 }, (_, i) => ({ id: `site-${i}`, priority: 2 as const }));
      const scheduleState = new Map<string, ScheduleState>(activeSites.map((s) => [s.id, { deepBump: false, deepAt: null, statusJustChanged: false }]));

      const output = planBatch({ activeSites, scheduleState, forcedSiteIds: [], batchSizeOverride: 10, ...baseOptions });

      expect(output.batchSize).toBe(10);
    });

    it('--site-ids bypasses tiering entirely and uses exactly the given ids, uncapped', () => {
      const activeSites = Array.from({ length: 10 }, (_, i) => ({ id: `site-${i}`, priority: 2 as const }));
      const scheduleState = new Map<string, ScheduleState>();

      const output = planBatch({ activeSites, scheduleState, forcedSiteIds: ['kseb', 'kwa'], ...baseOptions });

      expect(output.ordered).toBeNull();
      expect(output.selected.map((s) => s.id)).toEqual(['kseb', 'kwa']);
      expect(output.selected.every((s) => s.tier === 1)).toBe(true);
    });
  });
});
