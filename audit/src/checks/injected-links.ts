import { getDomain } from 'tldts';
import type { CheckContext, CheckResult } from './types.js';

/** Domains that look like a lookalike to the rules below but are genuine. A false positive is
 * fixed by adding its domain here in a PR (ADR-028). */
export const LOOKALIKE_ALLOWLIST: readonly string[] = ['mygov.in'];

/** Substrings that never occur inside ordinary words, so a plain `includes` on the host is safe. */
const SPAM_HOST_TERMS = [
  'casino', 'gacor', 'togel', 'sbobet', '1xbet', 'bet365', 'viagra', 'cialis', 'bokep', 'maxwin', 'slot88', 'slotgacor', 'judionline', 'pokerqq',
];

// Deliberately absent: "lottery"/"ലോട്ടറി" (Kerala State Lotteries is a government department), a
// bare "slot" ("Book a slot") and a bare "betting" (police awareness pages warn about betting apps).
const SPAM_TEXT_WORDS = [
  'casino', 'gacor', 'togel', 'judi', 'judi online', 'slot gacor', 'slot online', 'situs slot', 'maxwin', 'sbobet', 'poker online',
  'sports betting', 'satta', 'matka', 'viagra', 'cialis', 'escort', 'porn', 'bokep',
];
const SPAM_TEXT_WORD_RE = new RegExp(`\\b(?:${SPAM_TEXT_WORDS.join('|')})\\b`, 'i');
// `\b` does not work on Malayalam script in JS regexes, so these match as plain substrings.
const SPAM_TEXT_MALAYALAM = ['ചൂതാട്ടം', 'കാസിനോ', 'ബെറ്റിംഗ്', 'സട്ട'];

const PARKING_SUBDOMAIN = /^ww\d+$/;
const GOV_LOOKALIKE = /(kerala-?govt?|govt?-?kerala)/;

const MAX_LISTED = 3;
const MAX_EVIDENCE = 500;
const MAX_TEXT = 40;
const MAX_PATH = 80;

function matchedRules(host: string, text: string): string[] {
  const rules: string[] = [];
  if (PARKING_SUBDOMAIN.test(host.split('.')[0])) rules.push('parking-subdomain');
  if (GOV_LOOKALIKE.test(host)) rules.push('gov-lookalike');
  if (SPAM_HOST_TERMS.some((term) => host.includes(term))) rules.push('spam-host');
  const lowered = text.toLowerCase();
  if (SPAM_TEXT_WORD_RE.test(lowered) || SPAM_TEXT_MALAYALAM.some((term) => text.includes(term))) rules.push('spam-text');
  return rules;
}

function isOfficialOrOwn(domain: string | null, host: string, ctx: CheckContext): boolean {
  if (domain === null) return false;
  if (LOOKALIKE_ALLOWLIST.includes(domain)) return true;
  if (ctx.officialDomains?.has(domain)) return true;
  return host === 'gov.in' || host === 'nic.in' || host.endsWith('.gov.in') || host.endsWith('.nic.in');
}

/** `scheme://host/path` plus a bare `?…` if there was a query: the query can carry tracking or
 * session tokens (`tkn=`) that must not reach our public pages or data. */
function redact(url: URL): string {
  const path = url.pathname === '/' ? '' : url.pathname.slice(0, MAX_PATH);
  return `${url.protocol}//${url.host}${path}${url.search ? '?…' : ''}`;
}

export function injectedLinksCheck(ctx: CheckContext): CheckResult {
  if (ctx.links === undefined) return { id: 'sec.injected_links', r: 'na' };

  const ownDomain = getDomain(new URL(ctx.finalUrl ?? ctx.site.url).hostname);
  const matches: string[] = [];
  for (const link of ctx.links) {
    let url: URL;
    try {
      url = new URL(link.href);
    } catch {
      continue;
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') continue;
    const host = url.hostname.toLowerCase();
    const domain = getDomain(host);
    if (domain === ownDomain || isOfficialOrOwn(domain, host, ctx)) continue;
    const rules = matchedRules(host, link.text);
    if (rules.length === 0) continue;
    matches.push(`${redact(url)} "${link.text.slice(0, MAX_TEXT)}" [${rules.join('+')}]`);
  }

  if (matches.length === 0) return { id: 'sec.injected_links', r: 'pass' };
  const extra = matches.length > MAX_LISTED ? `; +${matches.length - MAX_LISTED} more` : '';
  const ev = matches.slice(0, MAX_LISTED).join('; ').slice(0, MAX_EVIDENCE - extra.length) + extra;
  return { id: 'sec.injected_links', r: 'fail', ev };
}
