import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { crawl } from '../src/crawl.js';

describe('crawl against a local fixture server', () => {
  let server: Server;

  beforeAll(async () => {
    server = createServer((req, res) => {
      const url = req.url ?? '';
      if (url === '/robots.txt') {
        res.writeHead(200, { 'content-type': 'text/plain' });
        res.end('User-agent: *\nDisallow: /private/\n');
      } else if (url === '/ok') {
        res.writeHead(200, { 'content-type': 'text/html' });
        res.end('<html>ok</html>');
      } else if (url === '/missing') {
        res.writeHead(404);
        res.end('not found');
      } else if (url === '/bad-request') {
        // Exercises the >= 400 boundary itself, distinct from every other broken-link fixture
        // here which happens to be 404 (>400 too, so an off-by-one at the boundary wouldn't show).
        res.writeHead(400);
        res.end('bad request');
      } else if (url === '/private/secret') {
        res.writeHead(200); // would be broken-looking, but robots.txt disallows it -- must never be requested
        res.end('secret');
      } else if (url === '/notice.pdf') {
        if (req.method === 'HEAD') res.writeHead(200, { 'content-type': 'application/pdf' });
        else res.writeHead(200, { 'content-type': 'application/pdf' });
        res.end();
      } else if (url === '/legacy.pdf') {
        // No HEAD support (405) -- crawl.ts must fall back to GET.
        if (req.method === 'HEAD') {
          res.writeHead(405);
          res.end();
        } else {
          res.writeHead(200, { 'content-type': 'application/pdf' });
          res.end();
        }
      } else if (url === '/missing.pdf') {
        if (req.method === 'HEAD') res.writeHead(404);
        else res.writeHead(404);
        res.end();
      } else if (url === '/slow') {
        // deliberately never responds -- exercises the timeout path, same convention light.test.ts uses
      } else {
        res.writeHead(404);
        res.end();
      }
    });
    await new Promise<void>((resolve) => server.listen(0, resolve));
  });

  afterAll(() => server.close());

  function baseUrl(): string {
    return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  }

  const noWait = { minIntervalMs: 0, sleep: async () => {}, now: () => 0 };

  it('records internal links that 404 as broken, and passing ones as not broken', async () => {
    const links = [
      { href: `${baseUrl()}/ok`, text: 'OK' },
      { href: `${baseUrl()}/missing`, text: 'Missing' },
    ];
    const result = await crawl(`${baseUrl()}/`, links, noWait);
    expect(result.pagesChecked).toBe(2);
    expect(result.brokenLinks).toEqual([{ url: `${baseUrl()}/missing`, status: 404 }]);
  });

  it('records a 400 response as broken (the isBroken threshold is inclusive)', async () => {
    const links = [{ href: `${baseUrl()}/bad-request`, text: 'Bad request' }];
    const result = await crawl(`${baseUrl()}/`, links, noWait);
    expect(result.brokenLinks).toEqual([{ url: `${baseUrl()}/bad-request`, status: 400 }]);
  });

  it('never requests a path robots.txt disallows', async () => {
    const links = [{ href: `${baseUrl()}/private/secret`, text: 'Secret' }];
    const result = await crawl(`${baseUrl()}/`, links, noWait);
    expect(result.pagesChecked).toBe(0);
    expect(result.brokenLinks).toEqual([]);
  });

  it('excludes offsite links from the crawl but records their domain as an outlink', async () => {
    const links = [
      { href: `${baseUrl()}/ok`, text: 'OK' },
      { href: 'https://example.com/elsewhere', text: 'Elsewhere' },
    ];
    const result = await crawl(`${baseUrl()}/`, links, noWait);
    expect(result.pagesChecked).toBe(1); // only the internal link is checked
    expect(result.outboundDomains).toEqual(['example.com']);
  });

  it('samples PDFs separately from pages, using HEAD', async () => {
    const links = [{ href: `${baseUrl()}/notice.pdf`, text: 'Notice' }];
    const result = await crawl(`${baseUrl()}/`, links, noWait);
    expect(result.pdfsChecked).toBe(1);
    expect(result.brokenPdfs).toEqual([]);
    expect(result.pagesChecked).toBe(0); // a PDF is never counted as a crawled page
  });

  it('falls back to GET when a PDF server does not support HEAD (405)', async () => {
    const links = [{ href: `${baseUrl()}/legacy.pdf`, text: 'Legacy notice' }];
    const result = await crawl(`${baseUrl()}/`, links, noWait);
    expect(result.brokenPdfs).toEqual([]); // the GET fallback found it fine
  });

  it('records a 404 PDF as broken', async () => {
    const links = [{ href: `${baseUrl()}/missing.pdf`, text: 'Gone' }];
    const result = await crawl(`${baseUrl()}/`, links, noWait);
    expect(result.brokenPdfs).toEqual([{ url: `${baseUrl()}/missing.pdf`, status: 404 }]);
  });

  it('records a timeout distinctly from an HTTP error status', async () => {
    const links = [{ href: `${baseUrl()}/slow`, text: 'Slow' }];
    const result = await crawl(`${baseUrl()}/`, links, { ...noWait, timeoutMs: 50 });
    expect(result.brokenLinks).toEqual([{ url: `${baseUrl()}/slow`, status: 'timeout' }]);
  });

  it('caps the number of pages checked at maxPages', async () => {
    const links = Array.from({ length: 5 }, (_, i) => ({ href: `${baseUrl()}/ok?${i}`, text: `Link ${i}` }));
    const result = await crawl(`${baseUrl()}/`, links, { ...noWait, maxPages: 2 });
    expect(result.pagesChecked).toBe(2);
  });

  it('dedupes repeated links', async () => {
    const links = [
      { href: `${baseUrl()}/ok`, text: 'OK' },
      { href: `${baseUrl()}/ok`, text: 'OK again' },
    ];
    const result = await crawl(`${baseUrl()}/`, links, noWait);
    expect(result.pagesChecked).toBe(1);
  });
});
