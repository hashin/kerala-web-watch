import { describe, expect, it } from 'vitest';
import { PERF_CHECKS } from '../src/checks/perf.js';
import type { CheckContext, CheckId } from '../src/checks/types.js';
import type { LightResult } from '../src/light.js';
import type { Site } from '../src/types.js';

const byId = new Map(PERF_CHECKS.map((check) => [check.id, check]));
function run(id: CheckId, ctx: CheckContext) {
  return byId.get(id)!.run(ctx);
}

function site(overrides: Partial<Site> = {}): Site {
  return {
    id: 'test-site',
    name: 'Test Site',
    url: 'https://test.kerala.gov.in/',
    aliases: [],
    tier: 'directorate',
    kind: 'directorate',
    department: 'test',
    org_parent: null,
    scope: 'state',
    district: null,
    place: null,
    lsg_type: null,
    platform: null,
    priority: 2,
    tags: [],
    source: 'test',
    added: '2026-01-01',
    lifecycle: 'active',
    notes: '',
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
    headers: { hsts: true, csp: false, xfo: true, xcto: true, referrer: false, server: null },
    content_hash: 'abc',
    http_redirects_to_https: true,
    geo_block_suspect: false,
    domain: 'kerala.gov.in',
    final_domain: 'kerala.gov.in',
    ...overrides,
  };
}

function ctx(overrides: Partial<CheckContext> = {}): CheckContext {
  return { site: site(), light: light(), ...overrides };
}

const NO_LIGHTHOUSE = { performance: 90, accessibility: 90, bestPractices: 90, seo: 90, lcpMs: null, cls: null, totalByteWeightBytes: null, tapTargetsOk: null, imagesOptimized: null };

describe('perf.lighthouse', () => {
  it('is n/a when Lighthouse never ran', () => {
    expect(run('perf.lighthouse', ctx()).r).toBe('na');
  });
  it('is n/a when Lighthouse ran but failed', () => {
    expect(run('perf.lighthouse', ctx({ lighthouse: null })).r).toBe('na');
  });
  it('passes with the performance score as evidence', () => {
    const result = run('perf.lighthouse', ctx({ lighthouse: { ...NO_LIGHTHOUSE, performance: 41 } }));
    expect(result.r).toBe('pass');
    expect(result.ev).toBe('41/100');
  });
});

describe('perf.lcp', () => {
  it('is n/a without an lcp measurement', () => {
    expect(run('perf.lcp', ctx()).r).toBe('na');
    expect(run('perf.lcp', ctx({ lighthouse: NO_LIGHTHOUSE })).r).toBe('na');
  });
  it('fails when LCP is over 4 seconds', () => {
    expect(run('perf.lcp', ctx({ lighthouse: { ...NO_LIGHTHOUSE, lcpMs: 5000 } })).r).toBe('fail');
  });
  it('passes when LCP is at or under 4 seconds', () => {
    expect(run('perf.lcp', ctx({ lighthouse: { ...NO_LIGHTHOUSE, lcpMs: 2000 } })).r).toBe('pass');
  });
  it('passes at exactly the 4 second threshold (the fail cutoff is exclusive)', () => {
    expect(run('perf.lcp', ctx({ lighthouse: { ...NO_LIGHTHOUSE, lcpMs: 4000 } })).r).toBe('pass');
  });
});

describe('perf.cls', () => {
  it('is n/a without a cls measurement', () => {
    expect(run('perf.cls', ctx()).r).toBe('na');
  });
  it('fails above the 0.25 threshold', () => {
    expect(run('perf.cls', ctx({ lighthouse: { ...NO_LIGHTHOUSE, cls: 0.4 } })).r).toBe('fail');
  });
  it('passes at or under the 0.25 threshold', () => {
    expect(run('perf.cls', ctx({ lighthouse: { ...NO_LIGHTHOUSE, cls: 0.1 } })).r).toBe('pass');
  });
  it('passes at exactly the 0.25 threshold (the fail cutoff is exclusive)', () => {
    expect(run('perf.cls', ctx({ lighthouse: { ...NO_LIGHTHOUSE, cls: 0.25 } })).r).toBe('pass');
  });
});

describe('perf.weight', () => {
  it('is n/a with no request log and no Lighthouse byte weight', () => {
    expect(run('perf.weight', ctx()).r).toBe('na');
  });
  it('prefers the summed request log over Lighthouse\'s own total-byte-weight', () => {
    const requests = [{ url: 'https://x/a.png', bytes: 1_000_000 }, { url: 'https://x/b.png', bytes: 500_000 }];
    const result = run('perf.weight', ctx({ requests, lighthouse: { ...NO_LIGHTHOUSE, totalByteWeightBytes: 9_000_000 } }));
    expect(result.r).toBe('pass'); // 1.5MB from requests, not the 9MB Lighthouse figure
  });
  it('falls back to Lighthouse when no request carries a byte size', () => {
    const result = run('perf.weight', ctx({ requests: [{ url: 'https://x/a.png' }], lighthouse: { ...NO_LIGHTHOUSE, totalByteWeightBytes: 9_000_000 } }));
    expect(result.r).toBe('fail');
  });
  it('warns between 3MB and 8MB', () => {
    expect(run('perf.weight', ctx({ requests: [{ url: 'https://x/a', bytes: 4 * 1024 * 1024 }] })).r).toBe('warn');
  });
  it('fails over 8MB', () => {
    expect(run('perf.weight', ctx({ requests: [{ url: 'https://x/a', bytes: 9 * 1024 * 1024 }] })).r).toBe('fail');
  });
  it('passes under 3MB', () => {
    expect(run('perf.weight', ctx({ requests: [{ url: 'https://x/a', bytes: 1 * 1024 * 1024 }] })).r).toBe('pass');
  });
  it('passes at exactly 3MB and exactly 8MB (both cutoffs are exclusive)', () => {
    expect(run('perf.weight', ctx({ requests: [{ url: 'https://x/a', bytes: 3 * 1024 * 1024 }] })).r).toBe('pass');
    expect(run('perf.weight', ctx({ requests: [{ url: 'https://x/a', bytes: 8 * 1024 * 1024 }] })).r).toBe('warn');
  });
});

describe('perf.viewport', () => {
  it('is n/a without page content', () => {
    expect(run('perf.viewport', ctx()).r).toBe('na');
  });
  it('fails when the viewport meta tag is missing', () => {
    expect(run('perf.viewport', ctx({ html: '<html><head></head></html>' })).r).toBe('fail');
  });
  it('passes when the viewport meta tag is present', () => {
    const html = '<html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head></html>';
    expect(run('perf.viewport', ctx({ html })).r).toBe('pass');
  });
});

describe('perf.tap_targets', () => {
  it('is n/a without a Lighthouse tap-targets result', () => {
    expect(run('perf.tap_targets', ctx()).r).toBe('na');
  });
  it('fails when Lighthouse reports tap targets are not ok', () => {
    expect(run('perf.tap_targets', ctx({ lighthouse: { ...NO_LIGHTHOUSE, tapTargetsOk: false } })).r).toBe('fail');
  });
  it('passes when Lighthouse reports tap targets are ok', () => {
    expect(run('perf.tap_targets', ctx({ lighthouse: { ...NO_LIGHTHOUSE, tapTargetsOk: true } })).r).toBe('pass');
  });
});

describe('perf.images', () => {
  it('is n/a without a Lighthouse images result', () => {
    expect(run('perf.images', ctx()).r).toBe('na');
  });
  it('fails when Lighthouse reports unoptimized images', () => {
    expect(run('perf.images', ctx({ lighthouse: { ...NO_LIGHTHOUSE, imagesOptimized: false } })).r).toBe('fail');
  });
  it('passes when Lighthouse reports images are optimized', () => {
    expect(run('perf.images', ctx({ lighthouse: { ...NO_LIGHTHOUSE, imagesOptimized: true } })).r).toBe('pass');
  });
});
