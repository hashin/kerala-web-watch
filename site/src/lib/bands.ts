// Five display bands used by every chart. Status → band → colour is defined here and nowhere else.
import type { Status } from './data';
import { t, tf, type Locale } from '../i18n';
import { tips } from './tips';

export interface Band { key: string; label: string; color: string; ink: string; statuses: Status[]; tip: string }

export const BANDS: Band[] = [
  { key: 'healthy', label: 'Healthy', color: 'var(--teal)', ink: 'var(--teal-ink)', statuses: ['healthy'], tip: tips().STATUS_TIP.healthy },
  { key: 'needs-work', label: 'Needs work', color: 'var(--amber)', ink: 'var(--amber-ink)', statuses: ['needs-work'], tip: tips().STATUS_TIP['needs-work'] },
  { key: 'poor', label: 'Poor', color: 'var(--coral)', ink: 'var(--crimson-ink)', statuses: ['poor'], tip: tips().STATUS_TIP.poor },
  { key: 'broken', label: 'Down / broken', color: 'var(--crimson)', ink: 'var(--crimson-ink)', statuses: ['down', 'hijacked', 'broken'], tip: t('en', 'tip.band.broken') },
  { key: 'unaudited', label: 'Not audited', color: 'var(--grey-soft)', ink: 'var(--color-muted)', statuses: ['unaudited', 'unverifiable'], tip: tips().STATUS_TIP.unaudited },
];

export const STATUS_COLOR: Record<Status, string> = {
  healthy: 'var(--teal)', 'needs-work': 'var(--amber)', poor: 'var(--coral)',
  down: 'var(--crimson)', hijacked: 'var(--crimson)', broken: 'var(--crimson)',
  unaudited: 'var(--grey)', unverifiable: 'var(--grey)',
};
export const STATUS_WORD = Object.fromEntries(
  (Object.keys(STATUS_COLOR) as Status[]).map((s) => [s, t('en', `status.${s}`)]),
) as Record<Status, string>;

/** The status word ("Down", "Healthy"…) in a page language. */
export function statusWord(status: Status, locale: Locale = 'en'): string {
  return t(locale, `status.${status}`);
}

export function bandCounts(counts: Record<Status, number>, locale: Locale = 'en') {
  const { STATUS_TIP } = tips(locale);
  const bandTip: Record<string, string> = {
    healthy: STATUS_TIP.healthy, 'needs-work': STATUS_TIP['needs-work'], poor: STATUS_TIP.poor,
    broken: t(locale, 'tip.band.broken'), unaudited: STATUS_TIP.unaudited,
  };
  return BANDS.map((b) => ({
    ...b,
    label: t(locale, `band.${b.key}` as Parameters<typeof t>[1]),
    tip: bandTip[b.key],
    n: b.statuses.reduce((s, k) => s + (counts[k] ?? 0), 0),
  }));
}

/** Tooltip for one segment of a stacked bar: the band's explanation plus its share. */
export function bandShareTip(tip: string, n: number, total: number, locale: Locale = 'en'): string {
  return tf(locale, 'tip.bandShare', { tip, n: n.toLocaleString('en-IN'), pct: Math.round((n / total) * 100) });
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

/** One colour per check category, used by the six-checks bars and the dot on each issue. Availability
 * is the Up colour (Sky); identity has no colour of its own in the design, so it shares it. */
export const CATEGORY_COLOR = {
  availability: 'var(--sky)',
  security: 'var(--plum)',
  accessibility: 'var(--indigo)',
  content: 'var(--amber)',
  gigw: 'var(--coral)',
  performance: 'var(--teal)',
  identity: 'var(--sky)',
} as const;
export type CategoryKey = keyof typeof CATEGORY_COLOR;
