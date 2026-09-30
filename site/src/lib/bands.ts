// Five display bands used by every chart. Status → band → colour is defined here and nowhere else.
import type { Status } from './data';
import { STATUS_TIP } from './tips';

export interface Band { key: string; label: string; color: string; ink: string; statuses: Status[]; tip: string }

export const BANDS: Band[] = [
  { key: 'healthy', label: 'Healthy', color: 'var(--teal)', ink: 'var(--teal-ink)', statuses: ['healthy'], tip: STATUS_TIP.healthy },
  { key: 'needs-work', label: 'Needs work', color: 'var(--amber)', ink: 'var(--amber-ink)', statuses: ['needs-work'], tip: STATUS_TIP['needs-work'] },
  { key: 'poor', label: 'Poor', color: 'var(--coral)', ink: 'var(--crimson-ink)', statuses: ['poor'], tip: STATUS_TIP.poor },
  { key: 'broken', label: 'Down / broken', color: 'var(--crimson)', ink: 'var(--crimson-ink)', statuses: ['down', 'hijacked', 'broken'], tip: 'Down, hijacked or broken: unreachable, or failing basic checks. Lower is better.' },
  { key: 'unaudited', label: 'Not audited', color: 'var(--grey-soft)', ink: 'var(--color-muted)', statuses: ['unaudited', 'unverifiable'], tip: STATUS_TIP.unaudited },
];

export const STATUS_COLOR: Record<Status, string> = {
  healthy: 'var(--teal)', 'needs-work': 'var(--amber)', poor: 'var(--coral)',
  down: 'var(--crimson)', hijacked: 'var(--crimson)', broken: 'var(--crimson)',
  unaudited: 'var(--grey)', unverifiable: 'var(--grey)',
};
export const STATUS_WORD: Record<Status, string> = {
  healthy: 'Healthy', 'needs-work': 'Needs work', poor: 'Poor', down: 'Down', hijacked: 'Possibly hijacked',
  broken: 'Broken', unaudited: 'Not yet audited', unverifiable: 'Unverifiable',
};

export function bandCounts(counts: Record<Status, number>) {
  return BANDS.map((b) => ({ ...b, n: b.statuses.reduce((s, k) => s + (counts[k] ?? 0), 0) }));
}

/** Text colour on a status pill. Only the crimson family takes the light/dark-aware token; every other fill is light enough for dark text. */
export const STATUS_PILL_FG: Partial<Record<Status, string>> = {
  down: 'var(--on-crimson)', hijacked: 'var(--on-crimson)', broken: 'var(--on-crimson)',
};

/** Colour for a group's median score (0-100). Same cut-offs as the district map. */
export const medianColor = (median: number | null): string =>
  median == null ? 'var(--grey)' : median >= 65 ? 'var(--teal)' : median >= 55 ? 'var(--amber)' : 'var(--coral)';

/** Colour for a group's share of broken sites (%). Always shown beside the number, never alone. */
export const brokenShareColor = (pct: number): string =>
  pct < 10 ? 'var(--teal)' : pct < 20 ? 'var(--amber)' : pct < 25 ? 'var(--coral)' : 'var(--crimson)';
