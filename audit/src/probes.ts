import { getDomain } from 'tldts';
import { httpGet } from './net/http.js';
import type { CheckContext } from './checks/types.js';

/**
 * The handful of `CheckContext` fields the runner can fill with a single plain HTTP request each --
 * `robots.txt`, `sitemap.xml`, a random non-existent path (`id.soft_404`), and the www/bare-host
 * pair (`id.www_consistency`). None of these need a browser, so they're kept separate from
 * `capture.ts`'s one Playwright session per site.
 */
export async function fetchRobotsTxt(origin: string, opts: { timeoutMs?: number; userAgent?: string } = {}): Promise<CheckContext['robotsTxt']> {
  const result = await httpGet(`${origin}/robots.txt`, opts);
  if (result.errorKind || result.status === null || result.body === null) return undefined;
  return { status: result.status, body: result.body };
}

export async function fetchSitemapXmlStatus(origin: string, opts: { timeoutMs?: number; userAgent?: string } = {}): Promise<number | undefined> {
  const result = await httpGet(`${origin}/sitemap.xml`, opts);
  if (result.errorKind || result.status === null) return undefined;
  return result.status;
}

export async function fetchSoft404Status(origin: string, opts: { timeoutMs?: number; userAgent?: string } = {}): Promise<number | undefined> {
  const random = Math.random().toString(36).slice(2, 10);
  const result = await httpGet(`${origin}/kww-${random}`, opts);
  if (result.errorKind || result.status === null) return undefined;
  return result.status;
}

/**
 * DESIGN §5.3 `id.www_consistency`: both the `www` and bare-host variants of the domain resolve,
 * and one redirects to the other. We probe both variants directly (not via the site's own
 * `finalUrl`, which only ever reflects whichever variant the registry entry happens to use) and
 * call it consistent when both come back with a successful response that lands on the exact same
 * final hostname -- whether because one explicitly redirected to the other, or because the server
 * simply answers identically for both without a redirect at all (a citizen reaches the same page
 * either way, which is what actually matters to them, even though DESIGN's own phrasing highlights
 * the redirect case as the common real-world pattern).
 */
export async function checkWwwConsistency(hostname: string, opts: { timeoutMs?: number; userAgent?: string } = {}): Promise<boolean | undefined> {
  const bare = hostname.startsWith('www.') ? hostname.slice(4) : hostname;
  const www = hostname.startsWith('www.') ? hostname : `www.${hostname}`;
  const [bareResult, wwwResult] = await Promise.all([httpGet(`https://${bare}/`, opts), httpGet(`https://${www}/`, opts)]);
  if (bareResult.errorKind || wwwResult.errorKind || bareResult.status === null || wwwResult.status === null) return undefined;
  const bareOk = bareResult.status >= 200 && bareResult.status < 400;
  const wwwOk = wwwResult.status >= 200 && wwwResult.status < 400;
  if (!bareOk || !wwwOk) return false;
  const bareFinalHost = bareResult.finalUrl ? new URL(bareResult.finalUrl).hostname : null;
  const wwwFinalHost = wwwResult.finalUrl ? new URL(wwwResult.finalUrl).hostname : null;
  return bareFinalHost !== null && bareFinalHost === wwwFinalHost;
}

export function registrableDomainOf(hostOrUrl: string): string | null {
  try {
    const hostname = hostOrUrl.includes('://') ? new URL(hostOrUrl).hostname : hostOrUrl;
    return getDomain(hostname);
  } catch {
    return null;
  }
}
