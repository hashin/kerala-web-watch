import { describe, expect, it } from 'vitest';
import { BANDS, STATUS_COLOR, STATUS_PILL_FG, STATUS_WORD, bandCounts, brokenShareColor, medianColor } from '../src/lib/bands';
import type { Status } from '../src/lib/data';

const ALL: Status[] = ['healthy', 'needs-work', 'poor', 'down', 'hijacked', 'broken', 'unaudited', 'unverifiable'];
const zero = () => Object.fromEntries(ALL.map((s) => [s, 0])) as Record<Status, number>;

describe('bandCounts', () => {
  it('folds down, hijacked and broken into one band and unaudited with unverifiable into another', () => {
    const counts = { ...zero(), healthy: 1, 'needs-work': 2, poor: 3, down: 4, hijacked: 5, broken: 6, unaudited: 7, unverifiable: 8 };
    expect(Object.fromEntries(bandCounts(counts).map((b) => [b.key, b.n]))).toEqual({ healthy: 1, 'needs-work': 2, poor: 3, broken: 15, unaudited: 15 });
  });
  it('places every status in exactly one band', () => {
    const placed = BANDS.flatMap((b) => b.statuses).sort();
    expect(placed).toEqual([...ALL].sort());
  });
});

describe('status tables', () => {
  it('give every status a colour and a plain word', () => {
    for (const s of ALL) {
      expect(STATUS_COLOR[s]).toMatch(/^var\(--/);
      expect(STATUS_WORD[s].length).toBeGreaterThan(2);
    }
  });
  it('keeps the do-not-visit warning in the hijacked word (ADR-026: the badge is the whole warning)', () => {
    expect(STATUS_WORD.hijacked).toBe('Possibly hijacked — do not visit');
  });
  it('uses the crimson-aware text colour only on down, hijacked and broken pills', () => {
    expect(Object.keys(STATUS_PILL_FG).sort()).toEqual(['broken', 'down', 'hijacked']);
  });
});

describe('medianColor', () => {
  it.each([[null, 'grey'], [65, 'teal'], [64.9, 'amber'], [55, 'amber'], [54.9, 'coral'], [0, 'coral']])('%s is %s', (m, c) => {
    expect(medianColor(m)).toBe(`var(--${c})`);
  });
});

describe('brokenShareColor', () => {
  it.each([[0, 'teal'], [9, 'teal'], [10, 'amber'], [19, 'amber'], [20, 'coral'], [24, 'coral'], [25, 'crimson'], [100, 'crimson']])('%s%% is %s', (p, c) => {
    expect(brokenShareColor(p)).toBe(`var(--${c})`);
  });
});
