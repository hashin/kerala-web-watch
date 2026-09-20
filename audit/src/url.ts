/**
 * Normalises a URL for duplicate detection: lowercase host, strip a trailing "/" root path,
 * keep the scheme (http vs https is a real difference we check for). Default ports (":80" on
 * http, ":443" on https) need no separate handling — the WHATWG URL parser already drops them.
 */
export function normalizeUrl(rawUrl: string): string {
  const parsed = new URL(rawUrl);
  parsed.hostname = parsed.hostname.toLowerCase();
  const path = parsed.pathname === '/' ? '' : parsed.pathname;
  return `${parsed.protocol}//${parsed.host}${path}${parsed.search}`;
}
