import { findLastUpdatedDate } from '../text/dates.js';
import { extractInteractiveText, gigwPattern } from '../text/patterns.js';
import { visibleText } from './text.js';
import type { Check, CheckId, CheckResult } from './types.js';

/** Most GIGW elements are navigational (a Contact Us link, a Sitemap link) so DESIGN §5.3 scopes
 * matching to link/button/heading/title/aria-label text (`extractInteractiveText`) to avoid an
 * article that merely mentions "feedback" in passing counting as a real Feedback page. */
function navigationPatternCheck(id: CheckId, patternKey: string): Check {
  const pattern = gigwPattern(patternKey);
  return {
    id,
    run: (ctx): CheckResult => {
      if (ctx.html === undefined) return { id, r: 'na' };
      const haystack = extractInteractiveText(ctx.html);
      return pattern.en.test(haystack) || pattern.ml.test(haystack) ? { id, r: 'pass' } : { id, r: 'fail' };
    },
  };
}

/** Ownership statements are footer prose ("Content owned and maintained by..."), not a link or
 * heading, so this searches the page's full visible text instead of the narrower interactive-text
 * extraction `navigationPatternCheck` uses. */
function prosePatternCheck(id: CheckId, patternKey: string): Check {
  const pattern = gigwPattern(patternKey);
  return {
    id,
    run: (ctx): CheckResult => {
      const text = ctx.text ?? (ctx.html !== undefined ? visibleText(ctx.html) : undefined);
      if (text === undefined) return { id, r: 'na' };
      return pattern.en.test(text) || pattern.ml.test(text) ? { id, r: 'pass' } : { id, r: 'fail' };
    },
  };
}

const EMBLEM_PATTERNS = [/state emblem/i, /national emblem/i, /government (of )?(kerala )?(logo|emblem)/i, /kerala.*(emblem|logo)/i, /\bemblem\b/i, /ashoka/i];
const IMG_TAG = /<img\b[^>]*>/gi;

export const GIGW_CHECKS: Check[] = [
  navigationPatternCheck('gigw.contact', 'contact'),
  navigationPatternCheck('gigw.feedback', 'feedback'),
  navigationPatternCheck('gigw.sitemap', 'sitemap'),
  navigationPatternCheck('gigw.privacy', 'privacy'),
  navigationPatternCheck('gigw.terms', 'terms'),
  navigationPatternCheck('gigw.copyright_policy', 'copyright_policy'),
  navigationPatternCheck('gigw.hyperlink_policy', 'hyperlink_policy'),
  navigationPatternCheck('gigw.disclaimer', 'disclaimer'),
  navigationPatternCheck('gigw.accessibility_statement', 'accessibility_statement'),
  navigationPatternCheck('gigw.screen_reader', 'screen_reader'),
  navigationPatternCheck('gigw.help', 'help'),
  navigationPatternCheck('gigw.rti', 'rti'),
  prosePatternCheck('gigw.ownership', 'ownership'),
  {
    id: 'gigw.search',
    run: (ctx): CheckResult => {
      if (ctx.html === undefined) return { id: 'gigw.search', r: 'na' };
      const pattern = gigwPattern('search');
      const hasSearchInput = /<input[^>]+type=["']search["']/i.test(ctx.html);
      const haystack = extractInteractiveText(ctx.html);
      const hasSearchText = pattern.en.test(haystack) || pattern.ml.test(haystack);
      return hasSearchInput || hasSearchText ? { id: 'gigw.search', r: 'pass' } : { id: 'gigw.search', r: 'fail' };
    },
  },
  {
    id: 'gigw.last_updated',
    run: (ctx): CheckResult => {
      const text = ctx.text ?? (ctx.html !== undefined ? visibleText(ctx.html) : undefined);
      if (text === undefined) return { id: 'gigw.last_updated', r: 'na' };
      return findLastUpdatedDate(text) ? { id: 'gigw.last_updated', r: 'pass' } : { id: 'gigw.last_updated', r: 'fail' };
    },
  },
  {
    id: 'gigw.emblem',
    run: (ctx): CheckResult => {
      if (ctx.html === undefined) return { id: 'gigw.emblem', r: 'na' };
      const imgTags = ctx.html.match(IMG_TAG) ?? [];
      const found = imgTags.some((tag) => EMBLEM_PATTERNS.some((p) => p.test(tag)));
      // A heuristic on alt/filename text alone is prone to false negatives (a real emblem image
      // with no descriptive alt text would never match), so absence is reported as a soft `warn`
      // rather than a hard `fail` -- fitting for an Info-severity, informational check.
      return found ? { id: 'gigw.emblem', r: 'pass' } : { id: 'gigw.emblem', r: 'warn' };
    },
  },
];
