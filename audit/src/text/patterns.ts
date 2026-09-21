import { visibleText } from '../checks/text.js';

export interface BilingualPattern {
  key: string;
  en: RegExp;
  ml: RegExp;
}

/** IMPLEMENTATION.md §A.5, one entry per GIGW element that has a text signature (`gigw.emblem` is
 * image-based, not text, and is handled separately in gigw.ts). `gigw.last_updated` isn't here
 * either -- it reuses `dates.ts`'s date-proximity search instead of a keyword match, since "is a
 * date shown" is a stronger signal than "does the word 'updated' appear anywhere". */
export const GIGW_PATTERNS: BilingualPattern[] = [
  { key: 'contact', en: /contact( us)?/i, ml: /ബന്ധപ്പെടുക|ബന്ധപ്പെടാൻ|വിലാസം/ },
  { key: 'feedback', en: /feedback/i, ml: /അഭിപ്രായം|പ്രതികരണം/ },
  { key: 'sitemap', en: /site ?map/i, ml: /സൈറ്റ് ?മാപ്പ്|സൈറ്റ്മാപ്പ്/ },
  { key: 'privacy', en: /privacy( policy)?/i, ml: /സ്വകാര്യത(ാ)? ?നയം/ },
  { key: 'terms', en: /terms (and|&|of) (conditions|use)/i, ml: /നിബന്ധനകൾ|ഉപാധികൾ/ },
  { key: 'copyright_policy', en: /copyright( policy)?/i, ml: /പകർപ്പവകാശം/ },
  { key: 'hyperlink_policy', en: /hyperlink(ing)? policy/i, ml: /ഹൈപ്പർലിങ്ക്/ },
  { key: 'disclaimer', en: /disclaimer/i, ml: /നിരാകരണം|ഉത്തരവാദിത്ത നിരാകരണം/ },
  { key: 'accessibility_statement', en: /accessibility( statement)?/i, ml: /പ്രവേശനക്ഷമത|പ്രാപ്യത/ },
  { key: 'screen_reader', en: /screen ?reader( access)?/i, ml: /സ്ക്രീൻ റീഡർ/ },
  { key: 'help', en: /\bhelp\b/i, ml: /സഹായം/ },
  { key: 'rti', en: /\bRTI\b|right to information/i, ml: /വിവരാവകാശം/ },
  { key: 'search', en: /search/i, ml: /തിരയുക|തിരയൽ|അന്വേഷിക്കുക/ },
  {
    // DESIGN's own A.5 pattern ("content (owned|maintained|provided) by") assumes a single verb
    // directly before "by", but real footers very commonly chain several ("Content Owned,
    // Maintained and Updated by ...") -- widened with a bounded gap so that still counts, without
    // turning into an unbounded, anything-goes match.
    key: 'ownership',
    en: /content\b[\s\S]{0,50}\b(owned|maintained|provided)\b[\s\S]{0,30}\bby\b|designed,? developed (and|&) hosted by|site owned by/i,
    ml: /ഉള്ളടക്കം .* (ഉടമസ്ഥത|പരിപാലിക്കുന്നത്)/,
  },
];

export function gigwPattern(key: string): BilingualPattern {
  const pattern = GIGW_PATTERNS.find((p) => p.key === key);
  if (!pattern) throw new Error(`no GIGW pattern registered for "${key}"`);
  return pattern;
}

const LINK_OR_BUTTON = /<(a|button)\b[^>]*>([\s\S]*?)<\/\1>/gi;
const HEADING = /<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/gi;
const TITLE_ATTR = /\btitle\s*=\s*["']([^"']*)["']/gi;
const ARIA_LABEL_ATTR = /\baria-label\s*=\s*["']([^"']*)["']/gi;

/**
 * DESIGN §5.3 step 1: GIGW element matching runs over link text, button text, headings and
 * title/aria-label attributes -- not the whole page -- so an article that happens to mention the
 * word "contact" in passing doesn't count as a real Contact Us link. Ownership and ttl statements
 * are the deliberate exception (see `gigw.ts`): those are footer prose, not navigation, so they're
 * matched against the page's full visible text instead of this narrower extraction.
 */
export function extractInteractiveText(html: string): string {
  const parts: string[] = [];
  for (const match of html.matchAll(LINK_OR_BUTTON)) parts.push(visibleText(match[2]));
  for (const match of html.matchAll(HEADING)) parts.push(visibleText(match[1]));
  for (const match of html.matchAll(TITLE_ATTR)) parts.push(match[1]);
  for (const match of html.matchAll(ARIA_LABEL_ATTR)) parts.push(match[1]);
  return parts.join('\n');
}
