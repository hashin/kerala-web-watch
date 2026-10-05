import pLimit from 'p-limit';

/**
 * Scheduling for `cli light --all`, kept separate from the CLI so it can be tested without a network.
 *
 * Why this exists: a full sweep normally takes ~25 min, but when a zone's nameservers flake (seen on
 * lsgkerala.gov.in, 1,200 sites, Oct 2026) every lookup fails slowly and the sweep can need hours.
 * uptime.yml's job timeout then killed the run before it committed anything, so one bad DNS morning
 * threw away every site's result, not just the slow ones. A deadline lets the run stop starting new
 * sites, still write what it has, and commit; stalest-first ordering makes the next run pick up the
 * sites this one skipped instead of starving the end of the registry.
 */

/** Never-checked sites first, then oldest `lastCheckedAt` first; ties keep registry order. */
export function orderByStaleness<T>(items: T[], lastCheckedAt: (item: T) => string | null): T[] {
  const keyed = items.map((item, index) => ({ item, index, at: lastCheckedAt(item) }));
  keyed.sort((a, b) => {
    if (a.at === b.at) return a.index - b.index;
    if (a.at === null) return -1;
    if (b.at === null) return 1;
    return a.at < b.at ? -1 : 1;
  });
  return keyed.map((k) => k.item);
}

export interface DeadlineRunResult<T> {
  completed: T[];
  skipped: T[];
}

/**
 * Runs `worker` over `items` with bounded concurrency. Once `now()` reaches `deadlineAt`, items not
 * yet started are skipped; items already in flight are always awaited, never abandoned, so a
 * started site's result is either fully written or not written at all. No `deadlineAt` = run all.
 */
export async function runUntilDeadline<T>(
  items: T[],
  worker: (item: T) => Promise<void>,
  opts: { concurrency: number; deadlineAt?: number; now?: () => number },
): Promise<DeadlineRunResult<T>> {
  const now = opts.now ?? Date.now;
  const limit = pLimit(opts.concurrency);
  const completed: T[] = [];
  const skipped: T[] = [];
  await Promise.all(
    items.map((item) =>
      limit(async () => {
        if (opts.deadlineAt !== undefined && now() >= opts.deadlineAt) {
          skipped.push(item);
          return;
        }
        await worker(item);
        completed.push(item);
      }),
    ),
  );
  return { completed, skipped };
}
