import { describe, expect, it } from 'vitest';
import { delta, isoWeek, weekStrip } from '../src/lib/weekly';

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
  it('appends the unit', () => {
    expect(delta(3, 1, false, ' pts').text).toBe('▲ 2 pts');
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
