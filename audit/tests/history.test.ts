import { describe, expect, it } from 'vitest';
import { appendHistory, type HistoryEntry } from '../src/history.js';

describe('appendHistory', () => {
  it('adds the first entry', () => {
    const result = appendHistory([], { d: '2026-09-21', up: true, score: 80 });
    expect(result).toEqual([{ d: '2026-09-21', up: true, score: 80 }]);
  });

  it('replaces an existing entry for the same day rather than duplicating it', () => {
    const history: HistoryEntry[] = [{ d: '2026-09-21', up: false, score: null }];
    const result = appendHistory(history, { d: '2026-09-21', up: true, score: 90 });
    expect(result).toEqual([{ d: '2026-09-21', up: true, score: 90 }]);
  });

  it('keeps history sorted newest first', () => {
    const history: HistoryEntry[] = [
      { d: '2026-09-19', up: true, score: 70 },
      { d: '2026-09-20', up: true, score: 75 },
    ];
    const result = appendHistory(history, { d: '2026-09-21', up: true, score: 80 });
    expect(result.map((h) => h.d)).toEqual(['2026-09-21', '2026-09-20', '2026-09-19']);
  });

  it('caps history at 90 days, dropping the oldest', () => {
    const history: HistoryEntry[] = Array.from({ length: 90 }, (_, i) => ({ d: dayOffset(i), up: true, score: null }));

    const result = appendHistory(history, { d: dayOffset(90), up: true, score: null });
    expect(result).toHaveLength(90);
    expect(result[0].d).toBe(dayOffset(90));
    expect(result.find((h) => h.d === dayOffset(0))).toBeUndefined();
  });
});

function dayOffset(n: number): string {
  const date = new Date(Date.UTC(2026, 0, 1));
  date.setUTCDate(date.getUTCDate() + n);
  return date.toISOString().slice(0, 10);
}
