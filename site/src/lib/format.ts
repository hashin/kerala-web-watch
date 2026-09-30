import type { Locale } from '../i18n';

const RTF: Record<Locale, Intl.RelativeTimeFormat> = {
  en: new Intl.RelativeTimeFormat('en-IN', { numeric: 'auto' }),
  // Node/browser ICU data covers 'ml' out of the box -- no manual translation needed here, unlike
  // the hand-written check/UI strings elsewhere.
  ml: new Intl.RelativeTimeFormat('ml', { numeric: 'auto' }),
};

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

/** "2 days ago" / "in 3 hours" -- used for the site page's "Audited ... Checked ..." header
 * (DESIGN §7.3 part 1). `now` is a parameter, not a fresh `Date` read inside, so a test can pin
 * it; the site itself never passes one and gets build time, which is fine since the whole page
 * rebuilds every time new audit data lands. */
export function timeAgo(iso: string, now: Date = new Date(), locale: Locale = 'en'): string {
  const rtf = RTF[locale];
  const diffMs = new Date(iso).getTime() - now.getTime();
  const abs = Math.abs(diffMs);
  if (abs < MINUTE) return rtf.format(Math.round(diffMs / 1000), 'second');
  if (abs < HOUR) return rtf.format(Math.round(diffMs / MINUTE), 'minute');
  if (abs < DAY) return rtf.format(Math.round(diffMs / HOUR), 'hour');
  if (abs < MONTH) return rtf.format(Math.round(diffMs / DAY), 'day');
  if (abs < YEAR) return rtf.format(Math.round(diffMs / MONTH), 'month');
  return rtf.format(Math.round(diffMs / YEAR), 'year');
}

/** Heading for the one section of a paginated list: "Sites 101–132 of 132", or "All sites" when it fits on one page.
 * `start`/`end` are Astro's zero-based inclusive indexes into the whole list. */
export function listRange(page: { start: number; end: number; total: number; lastPage: number }, noun = 'sites'): string {
  const n = (x: number) => x.toLocaleString('en-IN');
  if (page.total === 0) return `No ${noun}`;
  if (page.lastPage <= 1) return `All ${n(page.total)} ${noun}`;
  const cap = noun.charAt(0).toUpperCase() + noun.slice(1);
  return `${cap} ${n(page.start + 1)}–${n(page.end + 1)} of ${n(page.total)}`;
}
