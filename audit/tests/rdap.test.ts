import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { domainExpiryDays, resetRdapCache } from '../src/net/rdap.js';

describe('domainExpiryDays against a local RDAP fixture server', () => {
  let server: Server;
  let requestCount: Record<string, number>;
  const now = () => new Date('2026-09-21T00:00:00.000Z');

  beforeAll(async () => {
    requestCount = {};
    server = createServer((req, res) => {
      const url = req.url ?? '';
      requestCount[url] = (requestCount[url] ?? 0) + 1;
      if (url === '/domain/expiring-soon.com') {
        res.writeHead(200, { 'content-type': 'application/rdap+json' });
        res.end(JSON.stringify({ events: [{ eventAction: 'registration', eventDate: '2020-01-01T00:00:00Z' }, { eventAction: 'expiration', eventDate: '2026-10-01T00:00:00Z' }] }));
      } else if (url === '/domain/no-events.com') {
        res.writeHead(200, { 'content-type': 'application/rdap+json' });
        res.end(JSON.stringify({ events: [] }));
      } else if (url === '/domain/not-found.com') {
        res.writeHead(404);
        res.end('not found');
      } else if (url === '/domain/bad-json.com') {
        res.writeHead(200, { 'content-type': 'application/rdap+json' });
        res.end('this is not json');
      } else {
        res.writeHead(404);
        res.end();
      }
    });
    await new Promise<void>((resolve) => server.listen(0, resolve));
  });

  afterAll(() => server.close());
  beforeEach(() => {
    resetRdapCache();
    requestCount = {};
  });

  function baseUrl(): string {
    return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  }

  it('computes whole days remaining from the expiration event, relative to `now`', async () => {
    const days = await domainExpiryDays('expiring-soon.com', { now, baseUrl: baseUrl() });
    expect(days).toBe(10); // 2026-09-21 -> 2026-10-01
  });

  it('returns null when RDAP has no expiration event', async () => {
    expect(await domainExpiryDays('no-events.com', { now, baseUrl: baseUrl() })).toBeNull();
  });

  it('returns null on a non-200 response', async () => {
    expect(await domainExpiryDays('not-found.com', { now, baseUrl: baseUrl() })).toBeNull();
  });

  it('returns null on an unparseable body rather than throwing', async () => {
    expect(await domainExpiryDays('bad-json.com', { now, baseUrl: baseUrl() })).toBeNull();
  });

  it('caches a lookup per domain: a second call makes no new request', async () => {
    const url = '/domain/expiring-soon.com';
    await domainExpiryDays('expiring-soon.com', { now, baseUrl: baseUrl() });
    await domainExpiryDays('expiring-soon.com', { now, baseUrl: baseUrl() });
    expect(requestCount[url]).toBe(1);
  });

  it('resetRdapCache clears the cache so a domain can be looked up again', async () => {
    const url = '/domain/expiring-soon.com';
    await domainExpiryDays('expiring-soon.com', { now, baseUrl: baseUrl() });
    resetRdapCache();
    await domainExpiryDays('expiring-soon.com', { now, baseUrl: baseUrl() });
    expect(requestCount[url]).toBe(2);
  });
});
