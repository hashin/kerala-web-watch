import { createServer, type Server } from 'node:http';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';

export interface FixtureSiteConfig {
  /** Filename of the homepage's HTML, relative to the `pagesDir` passed to `startFixtureServer`. */
  homepage: string;
  status?: number;
  headers?: Record<string, string>;
  /** Artificial response delay in ms, for `avail.ttfb`/timeout-flavoured fixtures. */
  delayMs?: number;
}

export type FixtureManifest = Record<string, FixtureSiteConfig>;

export interface FixtureServerHandle {
  server: Server;
  /** `http://localhost:<port>` -- combine with a fixture site's own `<label>.localhost` hostname
   * via `runner.ts`'s `withFixtureBase` to get a reachable URL. */
  baseUrl: string;
  close(): Promise<void>;
}

const ROBOTS_BODY = 'User-agent: *\nAllow: /\n';
const SITEMAP_BODY = '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>';

/**
 * A single local HTTP server standing in for every fixture site at once, routed by the `<label>`
 * in `<label>.localhost` (subdomains of `.localhost` resolve to loopback on every platform this
 * project runs on -- no `/etc/hosts` edits, no real DNS). Every path other than `/`, `/robots.txt`
 * and `/sitemap.xml` answers a plain 200 so a fixture page's own internal nav links (GIGW's Contact
 * Us, Sitemap, etc.) never register as broken links during `crawl.ts`'s pass -- fixtures that want
 * to test a broken link do so by asserting on `content.broken_links` against a real government
 * site's audit, not against this harness.
 */
export async function startFixtureServer(manifest: FixtureManifest, pagesDir: string): Promise<FixtureServerHandle> {
  const pageCache = new Map<string, string>();
  const readPage = (filename: string): string => {
    const cached = pageCache.get(filename);
    if (cached !== undefined) return cached;
    const content = readFileSync(join(pagesDir, filename), 'utf8');
    pageCache.set(filename, content);
    return content;
  };

  const server = createServer((req, res) => {
    const hostHeader = req.headers.host ?? '';
    const label = hostHeader.split('.')[0];
    const config = manifest[label];
    if (!config) {
      res.writeHead(404);
      res.end('unknown fixture site');
      return;
    }

    const pathname = (() => {
      try {
        return new URL(req.url ?? '/', `http://${hostHeader}`).pathname;
      } catch {
        return req.url ?? '/';
      }
    })();

    const respond = (): void => {
      if (pathname === '/robots.txt') {
        res.writeHead(200, { 'content-type': 'text/plain' });
        res.end(ROBOTS_BODY);
      } else if (pathname === '/sitemap.xml') {
        res.writeHead(200, { 'content-type': 'application/xml' });
        res.end(SITEMAP_BODY);
      } else if (pathname === '/') {
        res.writeHead(config.status ?? 200, { 'content-type': 'text/html; charset=utf-8', ...config.headers });
        res.end(readPage(config.homepage));
      } else {
        res.writeHead(200, { 'content-type': 'text/plain' });
        res.end('OK');
      }
    };
    if (config.delayMs) setTimeout(respond, config.delayMs);
    else respond();
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as AddressInfo).port;
  return {
    server,
    baseUrl: `http://localhost:${port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
