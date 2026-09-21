import { describe, expect, it } from 'vitest';
import { buildTech, withFixtureBase } from '../src/runner.js';
import type { CaptureResult } from '../src/capture.js';
import type { LightResult } from '../src/light.js';

function capture(overrides: Partial<CaptureResult> = {}): CaptureResult {
  return {
    finalUrl: 'https://test.kerala.gov.in/',
    status: 200,
    headers: {},
    html: '<html></html>',
    text: '',
    links: [],
    cssTexts: [],
    scriptUrls: [],
    scripts: [],
    consoleErrors: [],
    requests: [],
    axe: { critical: 0, serious: 0, moderate: 0, minor: 0, byRule: {} },
    desktopScreenshot: Buffer.alloc(0),
    mobileScreenshot: Buffer.alloc(0),
    ...overrides,
  };
}

function light(overrides: Partial<LightResult> = {}): LightResult {
  return {
    at: '2026-09-21T00:00:00.000Z',
    status_class: 'ok',
    dns: true,
    status: 200,
    final_url: 'https://test.kerala.gov.in/',
    redirects: [],
    ttfb_ms: 500,
    title: 'Test Site',
    byte_size: 1000,
    tls: null,
    headers: { hsts: true, csp: false, xfo: true, xcto: true, referrer: false, server: 'Apache/2.4.6' },
    content_hash: 'abc',
    http_redirects_to_https: true,
    geo_block_suspect: false,
    domain: 'kerala.gov.in',
    final_domain: 'kerala.gov.in',
    ...overrides,
  };
}

describe('withFixtureBase', () => {
  it('reattaches the fixture server port, keeping the .localhost subdomain label', () => {
    expect(withFixtureBase('http://good.localhost/', 'http://localhost:4173')).toBe('http://good.localhost:4173/');
  });
  it('keeps the path and query string', () => {
    expect(withFixtureBase('http://good.localhost/sub/page?x=1', 'http://localhost:4173')).toBe('http://good.localhost:4173/sub/page?x=1');
  });
});

describe('buildTech', () => {
  it('reads the server banner from the light check', () => {
    expect(buildTech(capture(), light()).server).toBe('Apache/2.4.6');
  });
  it('detects a CMS signature from the captured HTML', () => {
    const html = '<html><head><meta name="generator" content="WordPress 4.9"></head></html>';
    expect(buildTech(capture({ html }), light()).cms).toBe('WordPress 4.9');
  });
  it('is null for cms/jquery when nothing was detected', () => {
    const tech = buildTech(capture(), light());
    expect(tech.cms).toBeNull();
    expect(tech.jquery).toBeNull();
  });
  it('detects a jquery version from a script URL', () => {
    const tech = buildTech(capture({ scriptUrls: ['https://cdn.example.com/jquery-1.12.4.min.js'] }), light());
    expect(tech.jquery).toBe('1.12.4');
  });
});
