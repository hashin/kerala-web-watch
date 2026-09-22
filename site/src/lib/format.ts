const RTF = new Intl.RelativeTimeFormat('en-IN', { numeric: 'auto' });

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

/** "2 days ago" / "in 3 hours" -- used for the site page's "Audited ... Checked ..." header
 * (DESIGN §7.3 part 1). `now` is a parameter, not a fresh `Date` read inside, so a test can pin
 * it; the site itself never passes one and gets build time, which is fine since the whole page
 * rebuilds every time new audit data lands. */
export function timeAgo(iso: string, now: Date = new Date()): string {
  const diffMs = new Date(iso).getTime() - now.getTime();
  const abs = Math.abs(diffMs);
  if (abs < MINUTE) return RTF.format(Math.round(diffMs / 1000), 'second');
  if (abs < HOUR) return RTF.format(Math.round(diffMs / MINUTE), 'minute');
  if (abs < DAY) return RTF.format(Math.round(diffMs / HOUR), 'hour');
  if (abs < MONTH) return RTF.format(Math.round(diffMs / DAY), 'day');
  if (abs < YEAR) return RTF.format(Math.round(diffMs / MONTH), 'month');
  return RTF.format(Math.round(diffMs / YEAR), 'year');
}
