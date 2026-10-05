import { describe, expect, it } from 'vitest';
import { orderByStaleness, runUntilDeadline } from '../src/light-batch.js';

describe('orderByStaleness', () => {
  const at: Record<string, string | null> = {
    fresh: '2026-10-05T13:20:00.000Z',
    old: '2026-10-02T12:00:00.000Z',
    never: null,
    middle: '2026-10-04T08:00:00.000Z',
  };

  it('puts never-checked sites first, then oldest check first', () => {
    expect(orderByStaleness(['fresh', 'old', 'never', 'middle'], (id) => at[id])).toEqual(['never', 'old', 'middle', 'fresh']);
  });

  it('keeps registry order between sites checked at the same moment', () => {
    const same = '2026-10-05T13:20:00.000Z';
    expect(orderByStaleness(['c', 'a', 'b'], () => same)).toEqual(['c', 'a', 'b']);
    expect(orderByStaleness(['c', 'a', 'b'], () => null)).toEqual(['c', 'a', 'b']);
  });

  it('does not mutate its input', () => {
    const input = ['fresh', 'old'];
    orderByStaleness(input, (id) => at[id]);
    expect(input).toEqual(['fresh', 'old']);
  });
});

describe('runUntilDeadline', () => {
  it('runs every item when no deadline is given', async () => {
    const seen: number[] = [];
    const out = await runUntilDeadline([1, 2, 3], async (n) => void seen.push(n), { concurrency: 2 });
    expect(seen.sort()).toEqual([1, 2, 3]);
    expect(out.skipped).toEqual([]);
    expect(out.completed.sort()).toEqual([1, 2, 3]);
  });

  it('stops starting new items once the deadline passes, skipping exactly the unstarted ones', async () => {
    // A fake clock that each worker advances by 10 "minutes"; deadline at 25 => items 1-3 start
    // (t=0, 10, 20), item 4 sees t=30 and is skipped along with 5.
    let t = 0;
    const started: number[] = [];
    const out = await runUntilDeadline(
      [1, 2, 3, 4, 5],
      async (n) => {
        started.push(n);
        t += 10;
      },
      { concurrency: 1, deadlineAt: 25, now: () => t },
    );
    expect(started).toEqual([1, 2, 3]);
    expect(out.completed).toEqual([1, 2, 3]);
    expect(out.skipped).toEqual([4, 5]);
  });

  it('awaits items already in flight when the deadline passes instead of abandoning them', async () => {
    let t = 0;
    let finishedSlow = false;
    const out = await runUntilDeadline(
      ['slow', 'next'],
      async (id) => {
        if (id === 'slow') {
          t = 100; // the deadline passes while this item is still running
          await new Promise((resolve) => setTimeout(resolve, 5));
          finishedSlow = true;
        }
      },
      { concurrency: 1, deadlineAt: 50, now: () => t },
    );
    expect(finishedSlow).toBe(true);
    expect(out.completed).toEqual(['slow']);
    expect(out.skipped).toEqual(['next']);
  });

  it('skips everything when the deadline is already past at the start', async () => {
    const out = await runUntilDeadline(['a', 'b'], async () => {}, { concurrency: 4, deadlineAt: 0, now: () => 1 });
    expect(out.completed).toEqual([]);
    expect(out.skipped).toEqual(['a', 'b']);
  });
});
