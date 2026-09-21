import { afterEach, describe, expect, it } from 'vitest';
import { startFixtureServer, type FixtureServerHandle } from '../src/fixture-server.js';
import { httpGet } from '../src/net/http.js';

const PAGES_DIR = new URL('./fixtures/sites/pages', import.meta.url).pathname;

let handle: FixtureServerHandle | undefined;
afterEach(async () => {
  await handle?.close();
  handle = undefined;
});

describe('startFixtureServer', () => {
  it('routes a request by the <label>.localhost Host header to the matching fixture site', async () => {
    handle = await startFixtureServer({ good: { homepage: 'good.html' }, parked: { homepage: 'parked.html' } }, PAGES_DIR);
    const good = await httpGet(handle.baseUrl.replace('localhost', 'good.localhost'));
    const parked = await httpGet(handle.baseUrl.replace('localhost', 'parked.localhost'));
    expect(good.body).toContain('Department of Testing');
    expect(parked.body).toContain('This domain is for sale');
  });

  it('answers 404 for a host with no matching fixture', async () => {
    handle = await startFixtureServer({ good: { homepage: 'good.html' } }, PAGES_DIR);
    const result = await httpGet(handle.baseUrl.replace('localhost', 'nope.localhost'));
    expect(result.status).toBe(404);
  });

  it('applies a manifest-configured status code to the homepage only', async () => {
    handle = await startFixtureServer({ down: { homepage: 'slow-5xx.html', status: 503 } }, PAGES_DIR);
    const homepage = await httpGet(handle.baseUrl.replace('localhost', 'down.localhost'));
    const otherPath = await httpGet(`${handle.baseUrl.replace('localhost', 'down.localhost')}/contact`);
    expect(homepage.status).toBe(503);
    expect(otherPath.status).toBe(200); // any other path still answers plainly, per crawl-friendliness
  });

  it('applies manifest-configured response headers to the homepage', async () => {
    handle = await startFixtureServer({ hijacked: { homepage: 'good.html', headers: { 'x-fixture-header': 'casino-redirect' } } }, PAGES_DIR);
    const homepage = await httpGet(handle.baseUrl.replace('localhost', 'hijacked.localhost'));
    expect(homepage.headers['x-fixture-header']).toBe('casino-redirect');
  });

  it('serves a permissive robots.txt and an empty sitemap.xml for every fixture site', async () => {
    handle = await startFixtureServer({ good: { homepage: 'good.html' } }, PAGES_DIR);
    const base = handle.baseUrl.replace('localhost', 'good.localhost');
    const robots = await httpGet(`${base}/robots.txt`);
    const sitemap = await httpGet(`${base}/sitemap.xml`);
    expect(robots.status).toBe(200);
    expect(robots.body).toContain('Allow: /');
    expect(sitemap.status).toBe(200);
    expect(sitemap.body).toContain('<urlset');
  });

  it('answers any other path with a plain 200 so crawled nav links never look broken', async () => {
    handle = await startFixtureServer({ good: { homepage: 'good.html' } }, PAGES_DIR);
    const result = await httpGet(`${handle.baseUrl.replace('localhost', 'good.localhost')}/some/nav/link`);
    expect(result.status).toBe(200);
  });

  it('delays the response by delayMs before answering', async () => {
    handle = await startFixtureServer({ slow: { homepage: 'good.html', delayMs: 120 } }, PAGES_DIR);
    const start = Date.now();
    await httpGet(handle.baseUrl.replace('localhost', 'slow.localhost'));
    expect(Date.now() - start).toBeGreaterThanOrEqual(100);
  });
});
