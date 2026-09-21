import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { dnsFailure, domainFailure, resolveSite, resolveSites, statusWarning, type ResolveSite } from '../src/resolve.js';
import type { LightResult } from '../src/light.js';

function light(overrides: Partial<LightResult> = {}): LightResult {
  return {
    at: '2026-09-21T00:00:00.000Z',
    status_class: 'ok',
    dns: true,
    status: 200,
    final_url: 'https://kseb.kerala.gov.in/',
    redirects: [],
    ttfb_ms: 100,
    title: 'KSEB',
    byte_size: 1000,
    tls: null,
    headers: { hsts: true, csp: false, xfo: true, xcto: true, referrer: false, server: null },
    content_hash: 'abc',
    http_redirects_to_https: true,
    geo_block_suspect: false,
    domain: 'kerala.gov.in',
    final_domain: 'kerala.gov.in',
    ...overrides,
  };
}

function site(overrides: Partial<ResolveSite> = {}): ResolveSite {
  return { id: 'kseb', url: 'https://kseb.kerala.gov.in/', aliases: [], ...overrides };
}

describe('dnsFailure', () => {
  it('fails when DNS did not resolve', () => {
    expect(dnsFailure(site(), light({ dns: false }))?.rule).toBe('resolve-dns');
  });

  it('passes when DNS resolved', () => {
    expect(dnsFailure(site(), light({ dns: true }))).toBeNull();
  });
});

describe('domainFailure', () => {
  it('passes when the final domain matches the entry\'s own domain', () => {
    expect(domainFailure(site(), light({ domain: 'kerala.gov.in', final_domain: 'kerala.gov.in' }))).toBeNull();
  });

  it('passes when the final domain matches a declared alias', () => {
    const s = site({ url: 'https://ikm.gov.in', aliases: ['https://www.infokerala.org'] });
    expect(domainFailure(s, light({ domain: 'ikm.gov.in', final_domain: 'infokerala.org' }))).toBeNull();
  });

  it('fails when the final domain matches neither the entry nor any alias', () => {
    const failure = domainFailure(site(), light({ domain: 'kerala.gov.in', final_domain: 'some-squatter.example' }));
    expect(failure?.rule).toBe('resolve-domain');
    expect(failure?.severity).toBe('error');
  });

  it('passes when there is no final domain to compare (e.g. DNS or connect failure)', () => {
    expect(domainFailure(site(), light({ final_domain: null }))).toBeNull();
  });
});

describe('statusWarning', () => {
  it('is silent on a 2xx status', () => {
    expect(statusWarning(site(), light({ status: 200 }))).toBeNull();
  });

  it('warns, at "warn" severity, on a non-2xx status', () => {
    const warning = statusWarning(site(), light({ status: 403 }));
    expect(warning?.severity).toBe('warn');
    expect(warning?.message).toContain('403');
  });

  it('warns when there is no HTTP status at all (e.g. a timeout)', () => {
    const warning = statusWarning(site(), light({ status: null, status_class: 'timeout' }));
    expect(warning?.severity).toBe('warn');
    expect(warning?.message).toContain('timeout');
  });
});

describe('resolveSite/resolveSites against a local HTTP server', () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    server = createServer((req, res) => {
      if (req.url === '/ok') {
        res.writeHead(200, { 'content-type': 'text/html' });
        res.end('<html><body>fine</body></html>');
      } else {
        res.writeHead(404);
        res.end();
      }
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

  it('reports no failures for a real, resolving, 2xx site', async () => {
    const failures = await resolveSite(site({ url: `${baseUrl}/ok` }));
    expect(failures).toEqual([]);
  });

  it('reports a DNS failure for a host that does not resolve', async () => {
    const failures = await resolveSite(site({ id: 'nowhere', url: 'https://this-host-does-not-exist.invalid/' }));
    expect(failures).toHaveLength(1);
    expect(failures[0].rule).toBe('resolve-dns');
  });

  it('warns (does not fail) on a 404', async () => {
    const failures = await resolveSite(site({ url: `${baseUrl}/missing` }));
    expect(failures).toHaveLength(1);
    expect(failures[0].severity).toBe('warn');
  });

  it('waits between requests so a batch of sites is checked no faster than 1/second', async () => {
    const waits: number[] = [];
    await resolveSites(
      [site({ id: 'a', url: `${baseUrl}/ok` }), site({ id: 'b', url: `${baseUrl}/ok` })],
      { sleep: async (ms) => { waits.push(ms); } },
    );
    expect(waits).toEqual([1000]); // one delay before the second of two sites, none before the first
  });
});
