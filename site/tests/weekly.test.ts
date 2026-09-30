import { describe, expect, it } from 'vitest';
import { countSeries, delta, isoWeek, snapshotsBefore, trendPoints, weekStrip, type WeekSnapshot } from '../src/lib/weekly';

describe('delta', () => {
  it('renders nothing when there is no previous week', () => {
    expect(delta(10, null, true)).toBeNull();
    expect(delta(10, undefined, true)).toBeNull();
  });
  it('says no change, flat, when equal', () => {
    expect(delta(5, 5, true)).toEqual({ text: 'no change', tone: 'flat' });
  });
  it('treats a rise in a bad count as bad news', () => {
    expect(delta(12, 10, true)).toEqual({ text: '▲ 2', tone: 'bad' });
  });
  it('treats a fall in a bad count as good news', () => {
    expect(delta(7, 10, true)).toEqual({ text: '▼ 3', tone: 'good' });
  });
  it('treats a rise in a good count as good news', () => {
    expect(delta(1200, 100, false)).toEqual({ text: '▲ 1,100', tone: 'good' });
  });
  it('still compares against a previous week of zero', () => {
    expect(delta(3, 0, true)).toEqual({ text: '▲ 3', tone: 'bad' });
  });
  it('groups thousands the Indian way', () => {
    expect(delta(150000, 0, false)?.text).toBe('▲ 1,50,000');
  });
  it('appends the unit', () => {
    expect(delta(3, 1, false, ' pts')?.text).toBe('▲ 2 pts');
  });
});

describe('weekStrip', () => {
  const NOW = new Date('2026-09-27T12:00:00Z'); // ISO week 39
  const TEAL = 'var(--teal)', AMBER = 'var(--amber)', CORAL = 'var(--coral)', CRIMSON = 'var(--crimson)', GREY = 'var(--grey-soft)';

  it('is all grey with no history, one block per week', () => {
    expect(weekStrip([], 4, NOW)).toEqual([GREY, GREY, GREY, GREY]);
  });
  it('colours each week by its score band, oldest first', () => {
    const h = [
      { d: '2026-09-25', up: true, score: 85 }, // W39
      { d: '2026-09-18', up: true, score: 60 }, // W38
      { d: '2026-09-11', up: true, score: 30 }, // W37
    ];
    expect(weekStrip(h, 4, NOW)).toEqual([GREY, CORAL, AMBER, TEAL]);
  });
  it('uses the band boundaries 80 and 50 inclusively', () => {
    const h = [{ d: '2026-09-25', up: true, score: 80 }, { d: '2026-09-18', up: true, score: 50 }, { d: '2026-09-11', up: true, score: 49 }];
    expect(weekStrip(h, 3, NOW)).toEqual([CORAL, AMBER, TEAL]);
  });
  it('colours a week Crimson when the site was down, even with a good earlier score', () => {
    expect(weekStrip([{ d: '2026-09-25', up: false, score: 90 }], 1, NOW)).toEqual([CRIMSON]);
  });
  it('colours a down week Crimson even with no score, the usual case for a failed site', () => {
    expect(weekStrip([{ d: '2026-09-25', up: false, score: null }], 1, NOW)).toEqual([CRIMSON]);
  });
  it('puts a Sunday entry in that same week', () => {
    expect(weekStrip([{ d: '2026-09-27', up: true, score: 90 }], 1, NOW)).toEqual([TEAL]);
  });
  it('steps back exactly seven days per week', () => {
    const monday = new Date('2026-09-21T12:00:00Z');
    const h = [{ d: '2026-09-21', up: true, score: 60 }, { d: '2026-09-14', up: true, score: 90 }];
    expect(weekStrip(h, 2, monday)).toEqual([TEAL, AMBER]);
  });
  it('scores 79 as needs work, one point under healthy', () => {
    expect(weekStrip([{ d: '2026-09-25', up: true, score: 79 }], 1, NOW)).toEqual([AMBER]);
  });
  it('keeps an up-but-never-scored week grey', () => {
    expect(weekStrip([{ d: '2026-09-25', up: true, score: null }], 1, NOW)).toEqual([GREY]);
  });
  it('takes the latest entry of a week (history is newest-first)', () => {
    const h = [{ d: '2026-09-26', up: true, score: 90 }, { d: '2026-09-22', up: false, score: null }];
    expect(weekStrip(h, 1, NOW)).toEqual([TEAL]);
  });
  it('places Monday and Sunday entries in the same week', () => {
    const h = [{ d: '2026-09-21', up: true, score: 90 }];
    expect(weekStrip(h, 1, new Date('2026-09-27T23:00:00Z'))).toEqual([TEAL]);
  });
});

describe('isoWeek re-export', () => {
  it('is the audit implementation (week 39 of 2026 ends on Sunday the 27th)', () => {
    expect(isoWeek(new Date('2026-09-27T12:00:00Z'))).toEqual({ week: '2026-W39', from: '2026-09-21', to: '2026-09-27' });
  });
});

describe('snapshot comparison', () => {
  const snap = (week: string, broken: number, healthy = 0) =>
    ({ week, counts: { down: broken, hijacked: 0, broken: 0, poor: 0, unverifiable: 0, unaudited: 0, 'needs-work': 0, healthy } }) as unknown as WeekSnapshot;
  const snaps = [snap('2026-W36', 10, 1), snap('2026-W37', 20, 2), snap('2026-W38', 30, 3), snap('2026-W39', 40, 4)];

  it('never treats a snapshot of the current week as last week', () => {
    expect(snapshotsBefore(snaps, '2026-W39').map((s) => s.week)).toEqual(['2026-W36', '2026-W37', '2026-W38']);
  });

  it('ends the broken-sites trend with the live count and drops the current week snapshot', () => {
    expect(trendPoints(snaps, '2026-W39', 55, 8)).toEqual([
      { week: 'W36', broken: 10, now: false }, { week: 'W37', broken: 20, now: false },
      { week: 'W38', broken: 30, now: false }, { week: 'Now', broken: 55, now: true },
    ]);
  });
  it('keeps only the newest n-1 earlier weeks', () => {
    expect(trendPoints(snaps, '2026-W39', 55, 3).map((p) => p.week)).toEqual(['W37', 'W38', 'Now']);
  });
  it('is just the live point when there is no history', () => {
    expect(trendPoints([], '2026-W39', 7)).toEqual([{ week: 'Now', broken: 7, now: true }]);
  });

  it('builds a KPI sparkline from earlier weeks plus the live value', () => {
    expect(countSeries(snaps, '2026-W39', (c) => c.healthy, 9)).toEqual([1, 2, 3, 9]);
  });
  it('shows a sparkline from exactly two earlier weeks', () => {
    expect(countSeries(snaps.slice(0, 2), '2026-W39', (c) => c.healthy, 9)).toEqual([1, 2, 9]);
  });
  it('keeps only the newest n-1 earlier weeks in a sparkline', () => {
    expect(countSeries(snaps, '2026-W39', (c) => c.healthy, 9, 3)).toEqual([2, 3, 9]);
  });
  it('gives no sparkline until two earlier weeks exist', () => {
    expect(countSeries(snaps.slice(0, 1), '2026-W39', (c) => c.healthy, 9)).toEqual([]);
    expect(countSeries([], '2026-W39', (c) => c.healthy, 9)).toEqual([]);
  });
});
