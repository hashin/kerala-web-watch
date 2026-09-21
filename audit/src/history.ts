export interface HistoryEntry {
  d: string;
  up: boolean;
  score: number | null;
}

const MAX_DAYS = 90;

/**
 * One entry per UTC calendar day: a same-day re-run (light checks happen ~4x/day) replaces
 * today's entry rather than appending a second one, since `history` is a daily uptime/score
 * trend for the site page, not a log of every check. Newest first, capped at 90 days per
 * DESIGN §5.5 -- older entries live in the monthly `data` archive, not here.
 */
export function appendHistory(history: HistoryEntry[], entry: HistoryEntry): HistoryEntry[] {
  const withoutToday = history.filter((h) => h.d !== entry.d);
  const merged = [entry, ...withoutToday].sort((a, b) => b.d.localeCompare(a.d));
  return merged.slice(0, MAX_DAYS);
}
