import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { computeContentHash, extractTitle, isGeoBlockSuspect, lightCheck, tlsToLight } from '../src/light.js';
import { httpHead } from '../src/net/http.js';
import type { TlsInfo } from '../src/net/tls.js';
import { checkServerIdentity } from 'node:tls';

const BASE_TLS_INFO: TlsInfo = {
  attempted: true,
  connected: true,
  authorized: true,
  authorizationError: null,
  hostnameMatch: true,
  protocol: 'TLSv1.3',
  validTo: 'Dec 31 23:59:59 2027 GMT',
  daysLeft: 400,
  issuer: 'Test CA',
  error: null,
};

describe('lightCheck against a local HTTP server', () => {
  let server: Server;
  let baseUrl: string;
  let attempts: Record<string, number>;

  beforeAll(async () => {
    attempts = {};
    server = createServer((req, res) => {
      const path = req.url ?? '/';
      attempts[path] = (attempts[path] ?? 0) + 1;

      if (path === '/ok') {
        res.writeHead(200, { 'content-type': 'text/html' });
        res.end('<html><head><title>Fine, thanks</title></head><body>hello</body></html>');
      } else if (path === '/a') {
        res.writeHead(301, { location: '/b' });
        res.end();
      } else if (path === '/b') {
        res.writeHead(302, { location: '/ok' });
        res.end();
      } else if (path === '/notfound') {
        res.writeHead(404, { 'content-type': 'text/html' });
        res.end('<html><head><title>Not found</title></head><body>gone</body></html>');
      } else if (path === '/always500') {
        res.writeHead(500);
        res.end('server error');
      } else if (path === '/flaky') {
        if (attempts[path] < 3) {
          res.writeHead(500);
          res.end('try again');
        } else {
          res.writeHead(200, { 'content-type': 'text/html' });
          res.end('<html><head><title>Recovered</title></head><body>ok now</body></html>');
        }
      } else if (path === '/loop') {
        // redirects to itself forever -- exercises the maxRedirects cap, not a real site shape
        res.writeHead(302, { location: '/loop' });
        res.end();
      } else if (path === '/never-responds') {
        // deliberately never calls res.end() -- exercises the timeout path
      } else if (path === '/https-redirect') {
        res.writeHead(301, { location: 'https://example.org/' });
        res.end();
      } else if (path === '/geo-blocked') {
        res.writeHead(403, { 'content-type': 'text/html' });
        res.end('<html><body>Sorry, you have been blocked from accessing this site.</body></html>');
      } else {
        res.writeHead(404);
        res.end();
      }
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

  it('classifies a 200 response as ok and extracts title, size and content hash', async () => {
    const result = await lightCheck(`${baseUrl}/ok`, { retries: 1 });
    expect(result.status_class).toBe('ok');
    expect(result.status).toBe(200);
    expect(result.dns).toBe(true);
    expect(result.title).toBe('Fine, thanks');
    expect(result.byte_size).toBeGreaterThan(0);
    expect(result.content_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(result.final_url).toBe(`${baseUrl}/ok`);
  });

  it('follows a redirect chain and records every hop', async () => {
    const result = await lightCheck(`${baseUrl}/a`, { retries: 1 });
    expect(result.status_class).toBe('ok');
    expect(result.final_url).toBe(`${baseUrl}/ok`);
    expect(result.redirects).toEqual([`${baseUrl}/a -> ${baseUrl}/b`, `${baseUrl}/b -> ${baseUrl}/ok`]);
  });

  it('stops following a redirect loop at maxRedirects instead of hanging forever', async () => {
    const result = await lightCheck(`${baseUrl}/loop`, { retries: 1, maxRedirects: 2 });
    expect(result.redirects).toHaveLength(2);
    expect(result.redirects).toEqual([`${baseUrl}/loop -> ${baseUrl}/loop`, `${baseUrl}/loop -> ${baseUrl}/loop`]);
    expect(result.status_class).toBe('http_302');
  });

  it('classifies a 404 as http_404, not an error', async () => {
    const result = await lightCheck(`${baseUrl}/notfound`, { retries: 1 });
    expect(result.status_class).toBe('http_404');
    expect(result.status).toBe(404);
    expect(result.title).toBe('Not found');
  });

  it('retries a 5xx up to the configured limit and gives up as http_500', async () => {
    const result = await lightCheck(`${baseUrl}/always500`, { retries: 3, retryDelaysMs: [1, 1] });
    expect(result.status_class).toBe('http_500');
    expect(attempts['/always500']).toBe(3);
  });

  it('recovers from transient 5xx responses within the retry budget', async () => {
    const result = await lightCheck(`${baseUrl}/flaky`, { retries: 3, retryDelaysMs: [1, 1] });
    expect(result.status_class).toBe('ok');
    expect(result.title).toBe('Recovered');
    expect(attempts['/flaky']).toBe(3);
  });

  it('classifies an unresponsive server as timeout, not connect_fail', async () => {
    const result = await lightCheck(`${baseUrl}/never-responds`, { retries: 1, timeoutMs: 100 });
    expect(result.status_class).toBe('timeout');
    expect(result.dns).toBe(true);
  });

  it('classifies a refused connection as connect_fail', async () => {
    const closedPortServer = createServer();
    await new Promise<void>((resolve) => closedPortServer.listen(0, '127.0.0.1', resolve));
    const { port } = closedPortServer.address() as AddressInfo;
    await new Promise<void>((resolve) => closedPortServer.close(() => resolve()));

    const result = await lightCheck(`http://127.0.0.1:${port}/`, { retries: 1 });
    expect(result.status_class).toBe('connect_fail');
  });

  it('flags a 403 matching a known block-page signature as geo_block_suspect', async () => {
    const result = await lightCheck(`${baseUrl}/geo-blocked`, { retries: 1 });
    expect(result.status_class).toBe('http_403');
    expect(result.geo_block_suspect).toBe(true);
  });

  it('reports a hostname that cannot resolve as dns_fail without attempting HTTP', async () => {
    const result = await lightCheck('http://this-host-does-not-exist.invalid/', { retries: 1 });
    expect(result.status_class).toBe('dns_fail');
    expect(result.dns).toBe(false);
    expect(result.status).toBeNull();
  });
});

describe('httpHead http-to-https redirect probe', () => {
  it('reports a redirect to an https location', async () => {
    const server = createServer((req, res) => {
      res.writeHead(301, { location: 'https://example.org/' });
      res.end();
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as AddressInfo;

    const result = await httpHead(`http://127.0.0.1:${port}/`);
    expect(result.status).toBe(301);
    expect(result.location).toBe('https://example.org/');

    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
});

describe('normalizeHeaders (via lightCheck)', () => {
  it('detects each security header independently', async () => {
    const server = createServer((req, res) => {
      res.writeHead(200, {
        'content-type': 'text/html',
        'strict-transport-security': 'max-age=31536000',
        'x-frame-options': 'DENY',
        'x-content-type-options': 'nosniff',
        'referrer-policy': 'no-referrer',
        server: 'Apache',
      });
      res.end('<html><body>headers</body></html>');
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as AddressInfo;

    const result = await lightCheck(`http://127.0.0.1:${port}/`, { retries: 1 });
    expect(result.headers).toEqual({ hsts: true, csp: false, xfo: true, xcto: true, referrer: true, server: 'Apache' });

    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
});

describe('computeContentHash', () => {
  it('is stable across different <script> contents on an otherwise identical page', () => {
    const a = '<html><body><p>hello</p><script>var x = 1;</script></body></html>';
    const b = '<html><body><p>hello</p><script>var x = 2; console.log("different");</script></body></html>';
    expect(computeContentHash(a)).toBe(computeContentHash(b));
  });

  it('changes when the visible content actually changes', () => {
    const a = '<html><body><p>hello</p></body></html>';
    const b = '<html><body><p>goodbye</p></body></html>';
    expect(computeContentHash(a)).not.toBe(computeContentHash(b));
  });

  it('ignores a hidden CSRF token field that changes every request', () => {
    const a = '<form><input type="hidden" name="csrf_token" value="abc123"><p>content</p></form>';
    const b = '<form><input type="hidden" name="csrf_token" value="zzz999"><p>content</p></form>';
    expect(computeContentHash(a)).toBe(computeContentHash(b));
  });
});

describe('extractTitle', () => {
  it('decodes HTML entities and collapses whitespace', () => {
    expect(extractTitle('<title>Kerala &amp; the\n  Government</title>')).toBe('Kerala & the Government');
  });

  it('returns null when there is no title tag', () => {
    expect(extractTitle('<html><body>no title here</body></html>')).toBeNull();
  });
});

describe('isGeoBlockSuspect', () => {
  it('only fires on a 403 with a matching signature', () => {
    expect(isGeoBlockSuspect(403, 'Sorry, you have been blocked from viewing this page')).toBe(true);
    expect(isGeoBlockSuspect(404, 'Sorry, you have been blocked from viewing this page')).toBe(false);
    expect(isGeoBlockSuspect(403, 'Just a normal 403 page')).toBe(false);
  });
});

describe('TLS validity logic against hand-built handshake data', () => {
  it('checkServerIdentity accepts a cert whose SAN matches the hostname', () => {
    // Exercises the exact primitive checkTls relies on, without a real socket: a self-signed
    // dev cert with the right subjectaltname should be considered a hostname match.
    const cert = { subject: { CN: 'example.com' }, subjectaltname: 'DNS:example.com' };
    expect(checkServerIdentity('example.com', cert as never)).toBeUndefined();
  });

  it('checkServerIdentity rejects a cert issued for a different host', () => {
    const cert = { subject: { CN: 'other.example' }, subjectaltname: 'DNS:other.example' };
    expect(checkServerIdentity('example.com', cert as never)).toBeInstanceOf(Error);
  });

  it('tlsToLight reports valid for an authorized cert with a matching hostname', () => {
    expect(tlsToLight(BASE_TLS_INFO)?.valid).toBe(true);
  });

  it('tlsToLight reports invalid when the chain is unauthorized (expired, untrusted, etc)', () => {
    const tls: TlsInfo = { ...BASE_TLS_INFO, authorized: false, authorizationError: 'certificate has expired' };
    expect(tlsToLight(tls)?.valid).toBe(false);
  });

  it('tlsToLight reports invalid when the hostname does not match the cert, even if authorized', () => {
    const tls: TlsInfo = { ...BASE_TLS_INFO, hostnameMatch: false };
    expect(tlsToLight(tls)?.valid).toBe(false);
  });

  it('tlsToLight treats an unknown hostname match (no cert data) as not disqualifying', () => {
    const tls: TlsInfo = { ...BASE_TLS_INFO, hostnameMatch: null };
    expect(tlsToLight(tls)?.valid).toBe(true);
  });

  it('tlsToLight returns null when the handshake never connected', () => {
    const tls: TlsInfo = { ...BASE_TLS_INFO, connected: false, error: 'timeout' };
    expect(tlsToLight(tls)).toBeNull();
  });

  it('tlsToLight passes through protocol, expiry and issuer unchanged', () => {
    const light = tlsToLight(BASE_TLS_INFO);
    expect(light).toEqual({
      valid: true,
      protocol: 'TLSv1.3',
      expires: 'Dec 31 23:59:59 2027 GMT',
      days_left: 400,
      issuer: 'Test CA',
    });
  });
});
