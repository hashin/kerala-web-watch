import { request } from 'undici';

export interface RedirectHop {
  from: string;
  to: string;
}

export type HttpErrorKind = 'network' | 'timeout';

export interface HttpGetResult {
  errorKind: HttpErrorKind | null;
  status: number | null;
  finalUrl: string | null;
  redirects: RedirectHop[];
  headers: Record<string, string>;
  body: string | null;
  ttfbMs: number | null;
}

export interface HttpGetOptions {
  timeoutMs?: number;
  maxRedirects?: number;
  userAgent?: string;
  maxBodyBytes?: number;
}

const DEFAULT_UA = 'KeralaWebWatch/1.0 (+https://govwebsite.hashin.me/about; civic audit)';
const DEFAULT_MAX_BODY_BYTES = 10 * 1024 * 1024;

/**
 * `undici.request()` never follows redirects on its own (that's an opt-in interceptor), which is
 * exactly what we want: we follow by hand so callers get every hop for `sec.redirect_offsite`/
 * history, capped at `maxRedirects` per DESIGN §5.1. Only the final response's body is read;
 * intermediate redirect bodies are drained and discarded.
 */
export async function httpGet(url: string, opts: HttpGetOptions = {}): Promise<HttpGetResult> {
  const timeoutMs = opts.timeoutMs ?? 20_000;
  const maxRedirects = opts.maxRedirects ?? 5;
  const redirects: RedirectHop[] = [];
  let current = url;

  for (let hop = 0; ; hop++) {
    const started = performance.now();
    let response;
    try {
      response = await request(current, {
        method: 'GET',
        headersTimeout: timeoutMs,
        bodyTimeout: timeoutMs,
        headers: { 'user-agent': opts.userAgent ?? DEFAULT_UA, 'accept-language': 'ml,en' },
      });
    } catch (err) {
      return { errorKind: classifyError(err), status: null, finalUrl: null, redirects, headers: {}, body: null, ttfbMs: null };
    }
    const ttfbMs = Math.round(performance.now() - started);
    const headers = flattenHeaders(response.headers);
    const location = headers.location;

    if (response.statusCode >= 300 && response.statusCode < 400 && location && hop < maxRedirects) {
      await response.body.dump();
      const to = new URL(location, current).toString();
      redirects.push({ from: current, to });
      current = to;
      continue;
    }

    let body: string | null;
    try {
      body = await readCappedBody(response.body, opts.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES);
    } catch (err) {
      return { errorKind: classifyError(err), status: null, finalUrl: null, redirects, headers: {}, body: null, ttfbMs };
    }
    return { errorKind: null, status: response.statusCode, finalUrl: current, redirects, headers, body, ttfbMs };
  }
}

export interface HttpHeadResult {
  status: number | null;
  location: string | null;
  errorKind: HttpErrorKind | null;
}

/** Single HEAD, no redirect following -- used only to check whether the http:// variant of an
 * https:// site redirects to it (`sec.http_redirect`), not to fetch content. */
export async function httpHead(url: string, opts: { timeoutMs?: number; userAgent?: string } = {}): Promise<HttpHeadResult> {
  try {
    const response = await request(url, {
      method: 'HEAD',
      headersTimeout: opts.timeoutMs ?? 10_000,
      bodyTimeout: opts.timeoutMs ?? 10_000,
      headers: { 'user-agent': opts.userAgent ?? DEFAULT_UA },
    });
    await response.body.dump();
    const location = flattenHeaders(response.headers).location ?? null;
    return { status: response.statusCode, location, errorKind: null };
  } catch (err) {
    return { status: null, location: null, errorKind: classifyError(err) };
  }
}

function flattenHeaders(headers: Record<string, string | string[] | undefined>): Record<string, string> {
  const flat: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (value !== undefined) flat[key.toLowerCase()] = Array.isArray(value) ? value.join(', ') : value;
  }
  return flat;
}

async function readCappedBody(body: AsyncIterable<Uint8Array>, maxBytes: number): Promise<string> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of body) {
    total += chunk.length;
    if (total > maxBytes) break;
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}

function classifyError(err: unknown): HttpErrorKind {
  const code = (err as { code?: string })?.code ?? '';
  const name = (err as { name?: string })?.name ?? '';
  if (code.includes('TIMEOUT') || name.includes('Timeout')) return 'timeout';
  return 'network';
}
