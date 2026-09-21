import { extractTitle } from '../light.js';
import { daysBetween, findCopyrightYear, findLastUpdatedDate, findNewestNewsDate } from '../text/dates.js';
import { malayalamRatio } from '../text/malayalam.js';
import { visibleText } from './text.js';
import type { Check, CheckResult } from './types.js';

const PLACEHOLDER_PATTERNS = [
  /lorem ipsum/i,
  /sample text/i,
  /home page description/i,
  /\[insert .*?\]/i,
  /your (content|text) here/i,
  /placeholder text/i,
  /todo:? (add|insert|replace)/i,
];

const OBSOLETE_TECH_PATTERNS = [
  /<marquee/i,
  /<blink/i,
  /<applet/i,
  /<frameset/i,
  /application\/x-shockwave-flash/i,
  /\.swf\b/i,
  /<bgsound/i,
  /vbscript:/i,
  /ActiveXObject/,
];

const BEST_VIEWED_PATTERNS = [/best viewed (in|with) (internet explorer|ie\b|netscape)/i, /best viewed (at|in) \d{3,4} ?x ?\d{3,4}/i, /requires flash/i];

// IMPLEMENTATION.md §A.4. "Karthika" (legacy, ASCII-only) and "Kartika" (the real Unicode font
// Windows ships) are deliberately different spellings -- matching the exact legacy name is enough
// to avoid confusing the two, no extra disambiguation logic needed.
const LEGACY_FONT_PREFIXES = ['ML-TT', 'ML-', 'MLW-', 'MLB-', 'MLU-'];
const LEGACY_FONT_FAMILIES = ['Matweb', 'Manorama', 'Mathrubhumi', 'Deepika', 'Keralalite', 'Thoolika', 'Karthika', 'Revathi', 'Ambili', 'Indulekha'];

function findLegacyFont(haystack: string): string | null {
  for (const prefix of LEGACY_FONT_PREFIXES) {
    const match = haystack.match(new RegExp(`${prefix}[A-Za-z]*`, 'i'));
    if (match) return match[0];
  }
  for (const family of LEGACY_FONT_FAMILIES) {
    if (new RegExp(`\\b${family}\\b`, 'i').test(haystack)) return family;
  }
  return null;
}

const GENERIC_TITLES = new Set(['home', 'untitled', 'welcome', 'index', 'document', 'new document', 'home page']);

const LANGUAGE_TOGGLE_PATTERNS = [/മലയാളം/, /language.*?(toggle|switch|select)/i, /\blang=ml\b/i, /\/ml\//i];

// DESIGN §5.3 `content.malayalam`: only sites that citizens actually read for information need a
// Malayalam version -- a shared-platform LSG page and a state department portal both apply, but
// this list intentionally excludes purely administrative/internal kinds not in scope for WP1's
// registry yet.
const CITIZEN_FACING_KINDS = new Set([
  'portal',
  'department',
  'directorate',
  'district_admin',
  'service',
  'grama_panchayat',
  'block_panchayat',
  'district_panchayat',
  'corporation',
  'municipality',
]);

function textOf(ctx: { text?: string; html?: string }): string | undefined {
  if (ctx.text !== undefined) return ctx.text;
  return ctx.html !== undefined ? visibleText(ctx.html) : undefined;
}

export const CONTENT_CHECKS: Check[] = [
  {
    id: 'content.copyright_year',
    run: (ctx): CheckResult => {
      const text = textOf(ctx);
      if (text === undefined) return { id: 'content.copyright_year', r: 'na' };
      const year = findCopyrightYear(text);
      if (year === null) return { id: 'content.copyright_year', r: 'na' };
      const nowYear = new Date(ctx.light.at).getUTCFullYear();
      return nowYear - year >= 2
        ? { id: 'content.copyright_year', r: 'fail', ev: `copyright year ${year}` }
        : { id: 'content.copyright_year', r: 'pass' };
    },
  },
  {
    id: 'content.last_updated',
    run: (ctx): CheckResult => {
      const text = textOf(ctx);
      if (text === undefined) return { id: 'content.last_updated', r: 'na' };
      const date = findLastUpdatedDate(text);
      if (!date) return { id: 'content.last_updated', r: 'fail', ev: 'no "last updated" date found' };
      const stale = daysBetween(date, new Date(ctx.light.at)) > 365;
      return stale
        ? { id: 'content.last_updated', r: 'fail', ev: `last updated ${date.toISOString().slice(0, 10)}` }
        : { id: 'content.last_updated', r: 'pass' };
    },
  },
  {
    id: 'content.stale_news',
    run: (ctx): CheckResult => {
      const text = textOf(ctx);
      if (text === undefined) return { id: 'content.stale_news', r: 'na' };
      const newest = findNewestNewsDate(text);
      if (!newest) return { id: 'content.stale_news', r: 'na' }; // no news/announcements/tenders section detected at all
      const stale = daysBetween(newest, new Date(ctx.light.at)) > 365;
      return stale
        ? { id: 'content.stale_news', r: 'fail', ev: `newest dated item: ${newest.toISOString().slice(0, 10)}` }
        : { id: 'content.stale_news', r: 'pass' };
    },
  },
  {
    id: 'content.placeholder',
    run: (ctx): CheckResult => {
      const text = textOf(ctx);
      if (text === undefined) return { id: 'content.placeholder', r: 'na' };
      const match = PLACEHOLDER_PATTERNS.find((p) => p.test(text));
      return match ? { id: 'content.placeholder', r: 'fail', ev: match.source } : { id: 'content.placeholder', r: 'pass' };
    },
  },
  {
    id: 'content.legacy_font',
    run: (ctx): CheckResult => {
      if (ctx.html === undefined && ctx.cssTexts === undefined) return { id: 'content.legacy_font', r: 'na' };
      const haystack = [ctx.html ?? '', ...(ctx.cssTexts ?? [])].join('\n');
      const found = findLegacyFont(haystack);
      return found ? { id: 'content.legacy_font', r: 'fail', ev: found } : { id: 'content.legacy_font', r: 'pass' };
    },
  },
  {
    id: 'content.obsolete_tech',
    run: (ctx): CheckResult => {
      if (ctx.html === undefined) return { id: 'content.obsolete_tech', r: 'na' };
      const match = OBSOLETE_TECH_PATTERNS.find((p) => p.test(ctx.html!));
      return match ? { id: 'content.obsolete_tech', r: 'fail', ev: match.source } : { id: 'content.obsolete_tech', r: 'pass' };
    },
  },
  {
    id: 'content.best_viewed',
    run: (ctx): CheckResult => {
      const text = textOf(ctx);
      if (text === undefined) return { id: 'content.best_viewed', r: 'na' };
      const match = BEST_VIEWED_PATTERNS.find((p) => p.test(text));
      return match ? { id: 'content.best_viewed', r: 'fail', ev: match.source } : { id: 'content.best_viewed', r: 'pass' };
    },
  },
  {
    id: 'content.malayalam',
    appliesTo: (site) => CITIZEN_FACING_KINDS.has(site.kind),
    run: (ctx): CheckResult => {
      const hasToggle = ctx.html !== undefined && LANGUAGE_TOGGLE_PATTERNS.some((p) => p.test(ctx.html!));
      if (hasToggle) return { id: 'content.malayalam', r: 'pass' };
      const text = textOf(ctx);
      const ratio = ctx.malayalamRatio ?? (text !== undefined ? malayalamRatio(text) : undefined);
      if (ratio === undefined) return { id: 'content.malayalam', r: 'na' };
      return ratio > 0.05
        ? { id: 'content.malayalam', r: 'pass' }
        : { id: 'content.malayalam', r: 'fail', ev: `Malayalam ratio ${ratio.toFixed(2)}, no language toggle found` };
    },
  },
  {
    id: 'content.title',
    run: (ctx): CheckResult => {
      if (ctx.html === undefined) return { id: 'content.title', r: 'na' };
      const title = extractTitle(ctx.html);
      if (!title) return { id: 'content.title', r: 'fail', ev: 'missing <title>' };
      return GENERIC_TITLES.has(title.toLowerCase())
        ? { id: 'content.title', r: 'fail', ev: `generic title "${title}"` }
        : { id: 'content.title', r: 'pass' };
    },
  },
  {
    id: 'content.meta_desc',
    run: (ctx): CheckResult => {
      if (ctx.html === undefined) return { id: 'content.meta_desc', r: 'na' };
      const match =
        ctx.html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i) ??
        ctx.html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i);
      const content = match ? match[1].trim() : '';
      return content.length > 0 ? { id: 'content.meta_desc', r: 'pass' } : { id: 'content.meta_desc', r: 'fail' };
    },
  },
  {
    id: 'content.favicon',
    run: (ctx): CheckResult => {
      if (ctx.html === undefined) return { id: 'content.favicon', r: 'na' };
      const hasIcon = /<link[^>]+rel=["'](?:shortcut icon|icon|apple-touch-icon)["']/i.test(ctx.html);
      return hasIcon ? { id: 'content.favicon', r: 'pass' } : { id: 'content.favicon', r: 'fail' };
    },
  },
];
