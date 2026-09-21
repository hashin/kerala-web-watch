import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isFlaggedBySafeBrowsing } from '../src/net/safebrowsing.js';

describe('isFlaggedBySafeBrowsing', () => {
  let server: Server;
  let lastBody: string;

  beforeAll(async () => {
    server = createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk) => chunks.push(chunk));
      req.on('end', () => {
        lastBody = Buffer.concat(chunks).toString('utf8');
        const url = new URL(req.url ?? '', 'http://localhost');
        if (url.pathname === '/flagged') {
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ matches: [{ threatType: 'MALWARE' }] }));
        } else if (url.pathname === '/clean') {
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(JSON.stringify({}));
        } else if (url.pathname === '/error') {
          res.writeHead(500);
          res.end('server error');
        } else {
          res.writeHead(404);
          res.end();
        }
      });
    });
    await new Promise<void>((resolve) => server.listen(0, resolve));
  });

  afterAll(() => server.close());

  function endpoint(path: string): string {
    return `http://127.0.0.1:${(server.address() as AddressInfo).port}${path}`;
  }

  it('returns null without an API key and never makes a request', async () => {
    lastBody = '';
    const result = await isFlaggedBySafeBrowsing('https://example.com/', { apiKey: undefined, endpoint: endpoint('/flagged') });
    expect(result).toBeNull();
    expect(lastBody).toBe('');
  });

  it('returns true when the API reports a match', async () => {
    const result = await isFlaggedBySafeBrowsing('https://example.com/', { apiKey: 'test-key', endpoint: endpoint('/flagged') });
    expect(result).toBe(true);
    expect(lastBody).toContain('https://example.com/');
  });

  it('returns false when the API reports no matches', async () => {
    const result = await isFlaggedBySafeBrowsing('https://example.com/', { apiKey: 'test-key', endpoint: endpoint('/clean') });
    expect(result).toBe(false);
  });

  it('returns null (not false) on a non-200 response, since that is "unknown", not "clean"', async () => {
    const result = await isFlaggedBySafeBrowsing('https://example.com/', { apiKey: 'test-key', endpoint: endpoint('/error') });
    expect(result).toBeNull();
  });

  it('falls back to process.env.SAFE_BROWSING_KEY when no apiKey option is given', async () => {
    const original = process.env.SAFE_BROWSING_KEY;
    process.env.SAFE_BROWSING_KEY = 'from-env';
    try {
      const result = await isFlaggedBySafeBrowsing('https://example.com/', { endpoint: endpoint('/clean') });
      expect(result).toBe(false);
    } finally {
      if (original === undefined) delete process.env.SAFE_BROWSING_KEY;
      else process.env.SAFE_BROWSING_KEY = original;
    }
  });
});
