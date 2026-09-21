import { getDomain } from 'tldts';
import type { Check, CheckResult } from './types.js';
import { visibleText } from './text.js';

const PARKED_PATTERNS = [
  /domain is for sale/i,
  /buy this domain/i,
  /this domain may be for sale/i,
  /parked free/i,
  /courtesy of godaddy/i,
  /sedoparking/i,
  /hugedomains/i,
  /afternic/i,
  /dan\.com/i,
  /domain has expired/i,
  /renew your domain/i,
  /namecheap parking/i,
  /\bbodis\b/i,
  /parkingcrew/i,
  /this webpage is parked/i,
];
const PARKED_REGISTRAR_DOMAINS = new Set(['sedoparking.com', 'hugedomains.com', 'afternic.com', 'dan.com', 'godaddy.com']);

const DEFAULT_PAGE_PATTERNS = [
  /Apache2 Ubuntu Default Page/i,
  /Apache HTTP Server Test Page/i,
  /IIS Windows Server/i,
  /Welcome to nginx!/i,
  /\bPlesk\b/i,
  /\bcPanel\b/i,
  /Test Page for the Apache/i,
  /Welcome to OpenResty/i,
  /LiteSpeed Web Server/i,
];

const UNDER_CONSTRUCTION_PATTERNS = [
  /under construction/i,
  /coming soon/i,
  /site is being updated/i,
  /will be back shortly/i,
  /maintenance mode/i,
  /നിർമ്മാണത്തിലാണ്/,
  /ഉടൻ വരുന്നു/,
  /അറ്റകുറ്റപ്പണി/,
];

const FLAPPING_WINDOW_DAYS = 7;
const FLAPPING_THRESHOLD = 3;

function registrableDomainOf(hostOrUrl: string): string | null {
  try {
    const hostname = hostOrUrl.includes('://') ? new URL(hostOrUrl).hostname : hostOrUrl;
    return getDomain(hostname);
  } catch {
    return null;
  }
}

function findDefaultPageSignature(html: string): string | null {
  for (const pattern of DEFAULT_PAGE_PATTERNS) {
    if (pattern.test(html)) return pattern.source;
  }
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (title && /index of \//i.test(title[1])) return 'Index of / in <title>';
  if (/^it works!?$/i.test(visibleText(html))) return 'It works! (whole visible body)';
  return null;
}

export const AVAILABILITY_CHECKS: Check[] = [
  {
    id: 'avail.dns',
    run: (ctx): CheckResult =>
      ctx.light.dns ? { id: 'avail.dns', r: 'pass' } : { id: 'avail.dns', r: 'fail', ev: `${ctx.light.domain ?? ctx.site.url} did not resolve` },
  },
  {
    id: 'avail.connect',
    run: (ctx): CheckResult => {
      if (!ctx.light.dns) return { id: 'avail.connect', r: 'na' }; // avail.dns already covers this
      const failed = ctx.light.status_class === 'connect_fail' || ctx.light.status_class === 'timeout';
      return failed ? { id: 'avail.connect', r: 'fail', ev: ctx.light.status_class } : { id: 'avail.connect', r: 'pass' };
    },
  },
  {
    id: 'avail.status',
    run: (ctx): CheckResult => {
      const cls = ctx.light.status_class;
      if (cls === 'dns_fail' || cls === 'connect_fail' || cls === 'timeout') return { id: 'avail.status', r: 'na' }; // covered above
      if (cls === 'ok') return { id: 'avail.status', r: 'pass' };
      return { id: 'avail.status', r: 'fail', ev: `final response was ${ctx.light.status}` };
    },
  },
  {
    id: 'avail.redirect_offsite',
    run: (ctx): CheckResult => {
      const finalDomain = ctx.light.final_domain;
      if (!finalDomain) return { id: 'avail.redirect_offsite', r: 'na' }; // no successful response to check
      const known = new Set(
        [ctx.light.domain, ...ctx.site.aliases.map(registrableDomainOf)].filter((d): d is string => d !== null),
      );
      return known.has(finalDomain)
        ? { id: 'avail.redirect_offsite', r: 'pass' }
        : { id: 'avail.redirect_offsite', r: 'fail', ev: `now resolves to ${finalDomain}` };
    },
  },
  {
    id: 'avail.parked',
    run: (ctx): CheckResult => {
      if (ctx.html === undefined) return { id: 'avail.parked', r: 'na' };
      const matched = PARKED_PATTERNS.find((pattern) => pattern.test(ctx.html!));
      const registrarDomain = ctx.light.final_domain !== null && PARKED_REGISTRAR_DOMAINS.has(ctx.light.final_domain);
      if (matched) return { id: 'avail.parked', r: 'fail', ev: matched.source };
      if (registrarDomain) return { id: 'avail.parked', r: 'fail', ev: `final domain is ${ctx.light.final_domain}` };
      return { id: 'avail.parked', r: 'pass' };
    },
  },
  {
    id: 'avail.default_page',
    run: (ctx): CheckResult => {
      if (ctx.html === undefined) return { id: 'avail.default_page', r: 'na' };
      const signature = findDefaultPageSignature(ctx.html);
      return signature ? { id: 'avail.default_page', r: 'fail', ev: signature } : { id: 'avail.default_page', r: 'pass' };
    },
  },
  {
    id: 'avail.blank',
    run: (ctx): CheckResult => {
      const text = ctx.text ?? (ctx.html !== undefined ? visibleText(ctx.html) : undefined);
      if (text === undefined) return { id: 'avail.blank', r: 'na' };
      return text.length < 80 ? { id: 'avail.blank', r: 'fail', ev: `${text.length} visible characters` } : { id: 'avail.blank', r: 'pass' };
    },
  },
  {
    id: 'avail.under_construction',
    run: (ctx): CheckResult => {
      const text = ctx.text ?? (ctx.html !== undefined ? visibleText(ctx.html) : undefined);
      if (text === undefined) return { id: 'avail.under_construction', r: 'na' };
      const match = UNDER_CONSTRUCTION_PATTERNS.find((pattern) => pattern.test(text));
      if (!match) return { id: 'avail.under_construction', r: 'pass' };
      const remaining = text.replace(match, '').trim();
      return remaining.length < 400
        ? { id: 'avail.under_construction', r: 'fail', ev: `"${match.source}" with only ${remaining.length} other characters` }
        : { id: 'avail.under_construction', r: 'warn', ev: `"${match.source}" alongside ${remaining.length} other characters` };
    },
  },
  {
    id: 'avail.ttfb',
    run: (ctx): CheckResult => {
      const ms = ctx.light.ttfb_ms;
      if (ms === null) return { id: 'avail.ttfb', r: 'na' };
      if (ms > 8000) return { id: 'avail.ttfb', r: 'fail', ev: `${ms}ms` };
      if (ms > 3000) return { id: 'avail.ttfb', r: 'warn', ev: `${ms}ms` };
      return { id: 'avail.ttfb', r: 'pass' };
    },
  },
  {
    id: 'avail.geo_blocked',
    // DESIGN §6.7 / A.9: an HTTP 403 with an "Access Denied" + NIC-style body, or a Cloudflare
    // error-1020 page. `ctx.light.geo_block_suspect` (light.ts) already flags a slightly broader
    // Cloudflare "blocked" signature at light-check time, so it's included here as a fallback
    // signal even when the deep audit's own richer `ctx.html` isn't available.
    run: (ctx): CheckResult => {
      const status = ctx.status ?? ctx.light.status;
      const html = ctx.html;
      const nicSignature = html !== undefined && status === 403 && /access denied/i.test(html) && /(NIC|National Informatics Centre|your country)/i.test(html);
      const cloudflare1020 = html !== undefined && /error code:\s*1020/i.test(html);
      if (nicSignature || cloudflare1020 || ctx.light.geo_block_suspect) {
        return { id: 'avail.geo_blocked', r: 'fail', ev: 'geo-block signature matched (DESIGN §6.7)' };
      }
      return { id: 'avail.geo_blocked', r: 'pass' };
    },
  },
  {
    id: 'avail.flapping',
    run: (ctx): CheckResult => {
      const history = ctx.history;
      if (history === undefined) return { id: 'avail.flapping', r: 'na' };
      // DESIGN §5.3 phrases this as "down in >=3 of the last 28 light checks (7 days)". Light
      // checks run ~4x/day but history.ts (WP2.2) collapses each day to a single entry, so the
      // daily-granularity equivalent of that window is the 7 days DESIGN's own parenthetical
      // already names.
      const recent = history.slice(0, FLAPPING_WINDOW_DAYS);
      const downDays = recent.filter((entry) => !entry.up).length;
      return downDays >= FLAPPING_THRESHOLD
        ? { id: 'avail.flapping', r: 'fail', ev: `down ${downDays} of the last ${recent.length} days` }
        : { id: 'avail.flapping', r: 'pass' };
    },
  },
];
