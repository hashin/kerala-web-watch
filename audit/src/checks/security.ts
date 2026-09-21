import type { Check, CheckResult } from './types.js';

const SUBRESOURCE_HTTP = /\b(?:src|href)\s*=\s*["']http:\/\/[^"']+["']/gi;
const VERSION_NUMBER = /\d+\.\d+/;

function hadResponse(statusClass: string): boolean {
  return statusClass !== 'dns_fail' && statusClass !== 'connect_fail' && statusClass !== 'timeout';
}

function getHeader(headers: Record<string, string>, name: string): string | undefined {
  const lower = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === lower) return value;
  }
  return undefined;
}

function tlsVersionAtLeast12(protocol: string | null): boolean | null {
  if (!protocol) return null;
  const match = protocol.match(/TLSv(\d+)(?:\.(\d+))?/i);
  if (!match) return false; // an unrecognised/older protocol string (e.g. SSLv3) is not >= 1.2
  const major = Number(match[1]);
  const minor = match[2] ? Number(match[2]) : 0;
  if (major !== 1) return major > 1;
  return minor >= 2;
}

export const SECURITY_CHECKS: Check[] = [
  {
    id: 'sec.https',
    run: (ctx): CheckResult => {
      if (!hadResponse(ctx.light.status_class)) return { id: 'sec.https', r: 'na' }; // avail.* already covers unreachable
      const finalUrl = ctx.light.final_url ?? ctx.site.url;
      return finalUrl.startsWith('https://') ? { id: 'sec.https', r: 'pass' } : { id: 'sec.https', r: 'fail', ev: finalUrl };
    },
  },
  {
    id: 'sec.http_redirect',
    run: (ctx): CheckResult => {
      const redirects = ctx.light.http_redirects_to_https;
      if (redirects === null) return { id: 'sec.http_redirect', r: 'na' }; // not an https site, or never probed
      return redirects ? { id: 'sec.http_redirect', r: 'pass' } : { id: 'sec.http_redirect', r: 'fail' };
    },
  },
  {
    id: 'sec.cert_valid',
    run: (ctx): CheckResult => {
      const tls = ctx.light.tls;
      if (tls === null) return { id: 'sec.cert_valid', r: 'na' }; // no TLS handshake to validate at all -- see sec.https
      return tls.valid ? { id: 'sec.cert_valid', r: 'pass' } : { id: 'sec.cert_valid', r: 'fail', ev: 'certificate chain invalid, expired, or hostname mismatch' };
    },
  },
  {
    id: 'sec.cert_expiry',
    run: (ctx): CheckResult => {
      const tls = ctx.light.tls;
      if (tls === null || tls.days_left === null) return { id: 'sec.cert_expiry', r: 'na' };
      if (tls.days_left < 7) return { id: 'sec.cert_expiry', r: 'fail', ev: `${tls.days_left} days left` };
      if (tls.days_left < 30) return { id: 'sec.cert_expiry', r: 'warn', ev: `${tls.days_left} days left` };
      return { id: 'sec.cert_expiry', r: 'pass' };
    },
  },
  {
    id: 'sec.tls_version',
    run: (ctx): CheckResult => {
      const tls = ctx.light.tls;
      if (tls === null) return { id: 'sec.tls_version', r: 'na' };
      const ok = tlsVersionAtLeast12(tls.protocol);
      if (ok === null) return { id: 'sec.tls_version', r: 'na' };
      return ok ? { id: 'sec.tls_version', r: 'pass' } : { id: 'sec.tls_version', r: 'fail', ev: tls.protocol ?? 'unknown protocol' };
    },
  },
  {
    id: 'sec.hsts',
    run: (ctx): CheckResult => {
      if (ctx.headers === undefined) return { id: 'sec.hsts', r: 'na' };
      return getHeader(ctx.headers, 'strict-transport-security') !== undefined
        ? { id: 'sec.hsts', r: 'pass' }
        : { id: 'sec.hsts', r: 'fail' };
    },
  },
  {
    id: 'sec.mixed_content',
    run: (ctx): CheckResult => {
      if (!hadResponse(ctx.light.status_class)) return { id: 'sec.mixed_content', r: 'na' };
      const isHttps = (ctx.light.final_url ?? ctx.site.url).startsWith('https://');
      if (!isHttps) return { id: 'sec.mixed_content', r: 'na' }; // only meaningful on a page served over https
      if (ctx.requests === undefined && ctx.html === undefined) return { id: 'sec.mixed_content', r: 'na' };
      const requestHit = ctx.requests?.find((r) => r.url.startsWith('http://'));
      if (requestHit) return { id: 'sec.mixed_content', r: 'fail', ev: requestHit.url };
      const staticHit = ctx.html !== undefined ? ctx.html.match(SUBRESOURCE_HTTP)?.[0] : undefined;
      return staticHit ? { id: 'sec.mixed_content', r: 'fail', ev: staticHit } : { id: 'sec.mixed_content', r: 'pass' };
    },
  },
  {
    id: 'sec.csp',
    run: (ctx): CheckResult => {
      if (ctx.headers === undefined) return { id: 'sec.csp', r: 'na' };
      const csp = getHeader(ctx.headers, 'content-security-policy');
      return csp && csp.length > 0 ? { id: 'sec.csp', r: 'pass' } : { id: 'sec.csp', r: 'fail' };
    },
  },
  {
    id: 'sec.xfo',
    run: (ctx): CheckResult => {
      if (ctx.headers === undefined) return { id: 'sec.xfo', r: 'na' };
      const xfo = getHeader(ctx.headers, 'x-frame-options');
      const csp = getHeader(ctx.headers, 'content-security-policy') ?? '';
      return xfo !== undefined || csp.includes('frame-ancestors') ? { id: 'sec.xfo', r: 'pass' } : { id: 'sec.xfo', r: 'fail' };
    },
  },
  {
    id: 'sec.xcto',
    run: (ctx): CheckResult => {
      if (ctx.headers === undefined) return { id: 'sec.xcto', r: 'na' };
      const value = getHeader(ctx.headers, 'x-content-type-options') ?? '';
      return value.toLowerCase().includes('nosniff') ? { id: 'sec.xcto', r: 'pass' } : { id: 'sec.xcto', r: 'fail' };
    },
  },
  {
    id: 'sec.referrer',
    run: (ctx): CheckResult => {
      if (ctx.headers === undefined) return { id: 'sec.referrer', r: 'na' };
      return getHeader(ctx.headers, 'referrer-policy') !== undefined ? { id: 'sec.referrer', r: 'pass' } : { id: 'sec.referrer', r: 'fail' };
    },
  },
  {
    id: 'sec.server_banner',
    run: (ctx): CheckResult => {
      if (ctx.headers === undefined) return { id: 'sec.server_banner', r: 'na' };
      const server = getHeader(ctx.headers, 'server') ?? '';
      const poweredBy = getHeader(ctx.headers, 'x-powered-by') ?? '';
      const disclosed = [server, poweredBy].find((value) => VERSION_NUMBER.test(value));
      return disclosed ? { id: 'sec.server_banner', r: 'fail', ev: disclosed } : { id: 'sec.server_banner', r: 'pass' };
    },
  },
  {
    id: 'sec.vuln_js',
    run: (ctx): CheckResult => {
      if (ctx.vulnerableLibraries === undefined) return { id: 'sec.vuln_js', r: 'na' };
      return ctx.vulnerableLibraries.length > 0
        ? { id: 'sec.vuln_js', r: 'fail', ev: ctx.vulnerableLibraries.map((v) => `${v.library} ${v.version ?? ''}`.trim()).join(', ') }
        : { id: 'sec.vuln_js', r: 'pass' };
    },
  },
  {
    id: 'sec.safe_browsing',
    run: (ctx): CheckResult => {
      if (ctx.safeBrowsingFlagged === undefined) return { id: 'sec.safe_browsing', r: 'na' };
      return ctx.safeBrowsingFlagged ? { id: 'sec.safe_browsing', r: 'fail' } : { id: 'sec.safe_browsing', r: 'pass' };
    },
  },
];
