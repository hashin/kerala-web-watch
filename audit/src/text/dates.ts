const MONTH_NAMES_EN = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
];

/** Malayalam month names -> zero-based month index, for parsing "d Month yyyy"-style dates written
 * in Malayalam rather than English. */
const MONTH_NAMES_ML: Record<string, number> = {
  ജനുവരി: 0,
  ഫെബ്രുവരി: 1,
  മാർച്ച്: 2,
  ഏപ്രിൽ: 3,
  മെയ്: 4,
  ജൂൺ: 5,
  ജൂലൈ: 6,
  ഓഗസ്റ്റ്: 7,
  സെപ്റ്റംബർ: 8,
  ഒക്ടോബർ: 9,
  നവംബർ: 10,
  ഡിസംബർ: 11,
};

function toDate(year: number, monthIndex: number, day: number): Date | null {
  const date = new Date(Date.UTC(year, monthIndex, day));
  // Date.UTC silently normalises out-of-range values (e.g. day 32) instead of failing, so a
  // round-trip check against what was asked for is the only way to reject a bogus date.
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== monthIndex || date.getUTCDate() !== day) return null;
  return date;
}

interface DatePattern {
  re: RegExp;
  toDate: (match: RegExpMatchArray) => Date | null;
}

const DATE_PATTERNS: DatePattern[] = [
  { re: /\b(\d{1,2})-(\d{1,2})-(20\d\d)\b/, toDate: (m) => toDate(Number(m[3]), Number(m[2]) - 1, Number(m[1])) },
  { re: /\b(\d{1,2})\/(\d{1,2})\/(20\d\d)\b/, toDate: (m) => toDate(Number(m[3]), Number(m[2]) - 1, Number(m[1])) },
  { re: /\b(20\d\d)-(\d{1,2})-(\d{1,2})\b/, toDate: (m) => toDate(Number(m[1]), Number(m[2]) - 1, Number(m[3])) },
  {
    re: new RegExp(`\\b(\\d{1,2})\\s+(${MONTH_NAMES_EN.join('|')})\\s+(20\\d\\d)\\b`, 'i'),
    toDate: (m) => toDate(Number(m[3]), MONTH_NAMES_EN.indexOf(m[2].toLowerCase()), Number(m[1])),
  },
  {
    re: new RegExp(`\\b(\\d{1,2})\\s+(${Object.keys(MONTH_NAMES_ML).join('|')})\\s+(20\\d\\d)\\b`),
    toDate: (m) => toDate(Number(m[3]), MONTH_NAMES_ML[m[2]], Number(m[1])),
  },
];

/** The first recognisable date in `text`, trying each supported format in turn. Returns `null`
 * when nothing matches rather than guessing. */
export function findFirstDate(text: string): Date | null {
  for (const pattern of DATE_PATTERNS) {
    const match = text.match(pattern.re);
    if (!match) continue;
    const date = pattern.toDate(match);
    if (date) return date;
  }
  return null;
}

/** Every recognisable date anywhere in `text`, in no particular order -- used where the newest of
 * several dated items matters (`content.stale_news`), unlike `findFirstDate`'s single nearest one. */
export function findAllDates(text: string): Date[] {
  const dates: Date[] = [];
  for (const pattern of DATE_PATTERNS) {
    const global = new RegExp(pattern.re.source, pattern.re.flags.includes('g') ? pattern.re.flags : `${pattern.re.flags}g`);
    for (const match of text.matchAll(global)) {
      const date = pattern.toDate(match);
      if (date) dates.push(date);
    }
  }
  return dates;
}

const LAST_UPDATED_MARKERS = [/last (updated|modified|reviewed)/i, /അവസാനം (പുതുക്കിയത്|പരിഷ്കരിച്ചത്)/];
const PROXIMITY_WINDOW_CHARS = 40;

/** Finds a date near a "last updated"/"അവസാനം പുതുക്കിയത്" marker (DESIGN §5.3's own "proximity
 * search" phrasing) -- a bare date elsewhere on the page (e.g. in a news item) isn't a claim about
 * when the page itself was last updated, so this deliberately doesn't fall back to `findFirstDate`
 * over the whole page. */
export function findLastUpdatedDate(text: string): Date | null {
  for (const marker of LAST_UPDATED_MARKERS) {
    const match = marker.exec(text);
    if (!match) continue;
    const window = text.slice(match.index, match.index + match[0].length + PROXIMITY_WINDOW_CHARS);
    const date = findFirstDate(window);
    if (date) return date;
  }
  return null;
}

const NEWS_SECTION_MARKERS = [/\b(news|announcements?|tenders?)\b/i, /വാർത്തകൾ|അറിയിപ്പുകൾ|ടെൻഡറുകൾ/];
const NEWS_SECTION_WINDOW_CHARS = 500;

/** The newest date found near a news/announcements/tenders marker, for `content.stale_news`.
 * Returns `null` when no such section is even detected, which callers must treat as "nothing to
 * check" (`na`), not "stale" -- a site with no news section at all isn't necessarily unmaintained. */
export function findNewestNewsDate(text: string): Date | null {
  for (const marker of NEWS_SECTION_MARKERS) {
    const match = marker.exec(text);
    if (!match) continue;
    const window = text.slice(match.index, match.index + NEWS_SECTION_WINDOW_CHARS);
    const dates = findAllDates(window);
    if (dates.length > 0) return dates.reduce((newest, d) => (d > newest ? d : newest));
  }
  return null;
}

const COPYRIGHT_PATTERN = /(?:©|\(c\)|copyright)[^\n]{0,60}?(20\d\d)/i;

/** DESIGN §5.3's own copyright-year regex, verbatim: the first `20\d\d` within 60 characters after
 * a ©/(c)/"copyright" marker. Deliberately not "the latest year in a range" -- that is exactly
 * what the settled spec asks for, not an oversight. */
export function findCopyrightYear(text: string): number | null {
  const match = text.match(COPYRIGHT_PATTERN);
  return match ? Number(match[1]) : null;
}

export function daysBetween(a: Date, b: Date): number {
  return Math.abs(b.getTime() - a.getTime()) / 86_400_000;
}
