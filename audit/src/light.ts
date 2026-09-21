import { createHash } from 'node:crypto';
import { getDomain } from 'tldts';
import { resolveDns } from './net/dns.js';
import { checkTls, type TlsInfo } from './net/tls.js';
import { httpGet, httpHead, type HttpGetResult } from './net/http.js';

export type LightStatusClass = 'dns_fail' | 'connect_fail' | 'timeout' | 'ok' | `http_${number}`;

export interface LightTls {
  valid: boolean;
  protocol: string | null;
  expires: string | null;
  days_left: number | null;
  issuer: string | null;
}

export interface LightHeaders {
  hsts: boolean;
  csp: boolean;
  xfo: boolean;
  xcto: boolean;
  referrer: boolean;
  server: string | null;
}

/** Mirrors the `light` object in DESIGN.md §5.5 field-for-field (snake_case, matching the
 * committed JSON) plus the extra signals WP2.1 asks for that the design doc's example omits:
 * `status_class`, `geo_block_suspect`, `byte_size`, `domain`/`final_domain`. `vantage` is not
 * here -- the runner (WP2.2) knows which vantage it's running from, this module doesn't. */
export interface LightResult {
  at: string;
  status_class: LightStatusClass;
  dns: boolean;
  status: number | null;
  final_url: string | null;
  redirects: string[];
  ttfb_ms: number | null;
  title: string | null;
  byte_size: number | null;
  tls: LightTls | null;
  headers: LightHeaders;
  content_hash: string | null;
  http_redirects_to_https: boolean | null;
  geo_block_suspect: boolean;
  domain: string | null;
  final_domain: string | null;
}

export interface LightCheckOptions {
  timeoutMs?: number;
  headTimeoutMs?: number;
  tlsTimeoutMs?: number;
  maxRedirects?: number;
  retries?: number;
  retryDelaysMs?: number[];
  userAgent?: string;
  now?: () => Date;
  sleep?: (ms: number) => Promise<void>;
}

const EMPTY_HEADERS: LightHeaders = { hsts: false, csp: false, xfo: false, xcto: false, referrer: false, server: null };

/**
 * DNS -> TLS probe -> GET (with retries) -> HTTP->HTTPS redirect probe, per DESIGN §5.1/§5.2.
 * DNS failure short-circuits everything else since nothing downstream can succeed without it;
 * every other step still runs even if a later one fails, so partial evidence (e.g. TLS info on
 * a site whose GET times out) is never thrown away.
 */
export async function lightCheck(url: string, opts: LightCheckOptions = {}): Promise<LightResult> {
  const now = opts.now ?? (() => new Date());
  const hostname = new URL(url).hostname;
  const domain = registrableDomain(url);

  const dns = await resolveDns(hostname);
  if (!dns.ok) {
    return {
      at: now().toISOString(),
      status_class: 'dns_fail',
      dns: false,
      status: null,
      final_url: null,
      redirects: [],
      ttfb_ms: null,
      title: null,
      byte_size: null,
      tls: null,
      headers: EMPTY_HEADERS,
      content_hash: null,
      http_redirects_to_https: null,
      geo_block_suspect: false,
      domain,
      final_domain: null,
    };
  }

  const tlsInfo = await checkTls(hostname, { timeoutMs: opts.tlsTimeoutMs });
  const getResult = await withRetries(
    () => httpGet(url, { timeoutMs: opts.timeoutMs, maxRedirects: opts.maxRedirects, userAgent: opts.userAgent }),
    { retries: opts.retries ?? 3, delaysMs: opts.retryDelaysMs ?? [2000, 5000], sleep: opts.sleep ?? defaultSleep },
  );
  const httpRedirectsToHttps = await probeHttpRedirect(url, opts);

  if (getResult.errorKind) {
    return {
      at: now().toISOString(),
      status_class: getResult.errorKind === 'timeout' ? 'timeout' : 'connect_fail',
      dns: true,
      status: null,
      final_url: null,
      redirects: getResult.redirects.map(formatHop),
      ttfb_ms: null,
      title: null,
      byte_size: null,
      tls: tlsToLight(tlsInfo),
      headers: EMPTY_HEADERS,
      content_hash: null,
      http_redirects_to_https: httpRedirectsToHttps,
      geo_block_suspect: false,
      domain,
      final_domain: null,
    };
  }

  const body = getResult.body ?? '';
  const status = getResult.status;
  if (status === null) {
    throw new Error('httpGet reported no error but returned no status -- invariant violated');
  }
  return {
    at: now().toISOString(),
    status_class: status >= 200 && status < 300 ? 'ok' : `http_${status}`,
    dns: true,
    status,
    final_url: getResult.finalUrl,
    redirects: getResult.redirects.map(formatHop),
    ttfb_ms: getResult.ttfbMs,
    title: extractTitle(body),
    byte_size: Buffer.byteLength(body, 'utf8'),
    tls: tlsToLight(tlsInfo),
    headers: normalizeHeaders(getResult.headers),
    content_hash: computeContentHash(body),
    http_redirects_to_https: httpRedirectsToHttps,
    geo_block_suspect: isGeoBlockSuspect(status, body),
    domain,
    final_domain: getResult.finalUrl ? registrableDomain(getResult.finalUrl) : null,
  };
}

async function probeHttpRedirect(url: string, opts: LightCheckOptions): Promise<boolean | null> {
  if (new URL(url).protocol !== 'https:') return null;
  const httpVariant = url.replace(/^https:/, 'http:');
  const head = await httpHead(httpVariant, { timeoutMs: opts.headTimeoutMs, userAgent: opts.userAgent });
  if (head.errorKind || head.status === null || !head.location) return false;
  if (head.status < 300 || head.status >= 400) return false;
  try {
    return new URL(head.location, httpVariant).protocol === 'https:';
  } catch {
    return false;
  }
}

async function withRetries(
  fn: () => Promise<HttpGetResult>,
  opts: { retries: number; delaysMs: number[]; sleep: (ms: number) => Promise<void> },
): Promise<HttpGetResult> {
  let attempt = 0;
  let result = await fn();
  while (isRetryable(result) && attempt < opts.retries - 1) {
    await opts.sleep(opts.delaysMs[Math.min(attempt, opts.delaysMs.length - 1)]);
    attempt++;
    result = await fn();
  }
  return result;
}

function isRetryable(result: HttpGetResult): boolean {
  if (result.errorKind) return true;
  return result.status !== null && result.status >= 500;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatHop(hop: { from: string; to: string }): string {
  return `${hop.from} -> ${hop.to}`;
}

export function tlsToLight(tls: TlsInfo): LightTls | null {
  if (!tls.attempted || !tls.connected) return null;
  return {
    valid: tls.authorized && tls.hostnameMatch !== false,
    protocol: tls.protocol,
    expires: tls.validTo,
    days_left: tls.daysLeft,
    issuer: tls.issuer,
  };
}

function normalizeHeaders(headers: Record<string, string>): LightHeaders {
  const csp = headers['content-security-policy'] ?? '';
  return {
    hsts: 'strict-transport-security' in headers,
    csp: csp.length > 0,
    xfo: 'x-frame-options' in headers || csp.includes('frame-ancestors'),
    xcto: (headers['x-content-type-options'] ?? '').toLowerCase().includes('nosniff'),
    referrer: 'referrer-policy' in headers,
    server: headers['server'] ?? null,
  };
}

function registrableDomain(url: string): string | null {
  try {
    return getDomain(new URL(url).hostname);
  } catch {
    return null;
  }
}

const SCRIPT_TAG = /<script\b[^>]*>[\s\S]*?<\/script>/gi;
const HIDDEN_INPUT = /<input\b[^>]*\btype\s*=\s*["']hidden["'][^>]*>/gi;
const TOKEN_ATTR = /\b(csrf|xsrf|_token|nonce|viewstate|authenticity_token)[a-z0-9_-]*\s*=\s*["'][^"']*["']/gi;
const TIMESTAMP = /\b\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})?\b|\b\d{10,13}\b/g;

/**
 * Best-effort normalisation before hashing so a page that only differs by a per-request CSRF
 * token, a live clock/hit-counter, or `<script>` content (often just an analytics snippet with a
 * cache-busting query string) doesn't register as "content changed" for ADR-016's deep-audit
 * bump. Strips, in order: script bodies, hidden form inputs, common token-looking attributes,
 * ISO-8601-ish timestamps and bare 10-13 digit epoch numbers, then collapses whitespace.
 */
export function computeContentHash(html: string): string {
  const stripped = html
    .replace(SCRIPT_TAG, '')
    .replace(HIDDEN_INPUT, '')
    .replace(TOKEN_ATTR, '')
    .replace(TIMESTAMP, '')
    .replace(/\s+/g, ' ')
    .trim();
  return createHash('sha256').update(stripped).digest('hex');
}

export function extractTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!match) return null;
  const decoded = decodeEntities(match[1]).replace(/\s+/g, ' ').trim();
  return decoded.length > 0 ? decoded : null;
}

function decodeEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

/** Starter list of block-page signatures seen from NIC-hosted / Cloudflare-fronted sites when
 * fetched from a non-Indian IP (DESIGN §6.7). Only checked on a 403 -- extend as real captures
 * come in from the first live sweep (WP2.3), don't guess more patterns ahead of evidence. */
const GEO_BLOCK_SIGNATURES = [/attention required[\s\S]{0,40}cloudflare/i, /sorry, you have been blocked/i, /your request has been blocked/i];

export function isGeoBlockSuspect(status: number | null, body: string | null): boolean {
  if (status !== 403 || !body) return false;
  return GEO_BLOCK_SIGNATURES.some((re) => re.test(body));
}
