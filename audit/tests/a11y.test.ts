import { describe, expect, it } from 'vitest';
import { A11Y_CHECKS } from '../src/checks/a11y.js';
import type { CheckContext, CheckId } from '../src/checks/types.js';
import type { LightResult } from '../src/light.js';
import type { Site } from '../src/types.js';

const byId = new Map(A11Y_CHECKS.map((check) => [check.id, check]));
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

const NO_VIOLATIONS = { critical: 0, serious: 0, moderate: 0, minor: 0, byRule: {} };

describe('a11y.axe_critical', () => {
  it('is n/a without an axe run', () => {
    expect(run('a11y.axe_critical', ctx()).r).toBe('na');
  });
  it('passes when there are zero critical violations', () => {
    expect(run('a11y.axe_critical', ctx({ axe: NO_VIOLATIONS })).r).toBe('pass');
  });
  it('fails when axe found critical violations', () => {
    expect(run('a11y.axe_critical', ctx({ axe: { ...NO_VIOLATIONS, critical: 2 } })).r).toBe('fail');
  });
});

describe('a11y.axe_serious', () => {
  it('is n/a without an axe run', () => {
    expect(run('a11y.axe_serious', ctx()).r).toBe('na');
  });
  it('fails when axe found serious violations, independent of critical count', () => {
    expect(run('a11y.axe_serious', ctx({ axe: { ...NO_VIOLATIONS, critical: 5, serious: 1 } })).r).toBe('fail');
  });
  it('passes when serious is zero even if other impacts are not', () => {
    expect(run('a11y.axe_serious', ctx({ axe: { ...NO_VIOLATIONS, critical: 5 } })).r).toBe('pass');
  });
});

describe('a11y.axe_moderate_minor', () => {
  it('is n/a without an axe run', () => {
    expect(run('a11y.axe_moderate_minor', ctx()).r).toBe('na');
  });
  it('fails when there is at least one moderate or minor violation', () => {
    expect(run('a11y.axe_moderate_minor', ctx({ axe: { ...NO_VIOLATIONS, minor: 1 } })).r).toBe('fail');
  });
  it('passes when moderate and minor are both zero', () => {
    expect(run('a11y.axe_moderate_minor', ctx({ axe: { ...NO_VIOLATIONS, critical: 3, serious: 3 } })).r).toBe('pass');
  });
});

describe('a11y.lang', () => {
  it('is n/a without both html and a measurable ratio', () => {
    expect(run('a11y.lang', ctx()).r).toBe('na');
  });
  it('fails when a mostly-Malayalam page declares lang="en"', () => {
    const html = '<html lang="en"><body>content</body></html>';
    expect(run('a11y.lang', ctx({ html, malayalamRatio: 0.9 })).r).toBe('fail');
  });
  it('fails when an English-only page declares lang="ml"', () => {
    const html = '<html lang="ml"><body>content</body></html>';
    expect(run('a11y.lang', ctx({ html, malayalamRatio: 0.01 })).r).toBe('fail');
  });
  it('passes when lang="ml" matches a mostly-Malayalam page', () => {
    const html = '<html lang="ml"><body>content</body></html>';
    expect(run('a11y.lang', ctx({ html, malayalamRatio: 0.9 })).r).toBe('pass');
  });
  it('passes when lang="en" matches an English-only page', () => {
    const html = '<html lang="en"><body>content</body></html>';
    expect(run('a11y.lang', ctx({ html, malayalamRatio: 0.01 })).r).toBe('pass');
  });
});

describe('a11y.alt', () => {
  it('is n/a without an axe run', () => {
    expect(run('a11y.alt', ctx()).r).toBe('na');
  });
  it('fails when the image-alt rule has violating nodes', () => {
    expect(run('a11y.alt', ctx({ axe: { ...NO_VIOLATIONS, byRule: { 'image-alt': 3 } } })).r).toBe('fail');
  });
  it('passes when the image-alt rule has no violating nodes', () => {
    expect(run('a11y.alt', ctx({ axe: { ...NO_VIOLATIONS, byRule: { 'color-contrast': 3 } } })).r).toBe('pass');
  });
});

describe('a11y.contrast', () => {
  it('fails only on the color-contrast rule, not an unrelated one', () => {
    expect(run('a11y.contrast', ctx({ axe: { ...NO_VIOLATIONS, byRule: { 'color-contrast': 1 } } })).r).toBe('fail');
    expect(run('a11y.contrast', ctx({ axe: { ...NO_VIOLATIONS, byRule: { 'image-alt': 1 } } })).r).toBe('pass');
  });
});

describe('a11y.headings', () => {
  it('is n/a without an axe run', () => {
    expect(run('a11y.headings', ctx()).r).toBe('na');
  });
  it('fails when there is no <h1>', () => {
    expect(run('a11y.headings', ctx({ axe: { ...NO_VIOLATIONS, byRule: { 'page-has-heading-one': 1 } } })).r).toBe('fail');
  });
  it('fails when heading levels are skipped', () => {
    expect(run('a11y.headings', ctx({ axe: { ...NO_VIOLATIONS, byRule: { 'heading-order': 1 } } })).r).toBe('fail');
  });
  it('passes when neither heading rule has violations', () => {
    expect(run('a11y.headings', ctx({ axe: { ...NO_VIOLATIONS, byRule: { label: 1 } } })).r).toBe('pass');
  });
});

describe('a11y.labels', () => {
  it('fails only on the label rule', () => {
    expect(run('a11y.labels', ctx({ axe: { ...NO_VIOLATIONS, byRule: { label: 2 } } })).r).toBe('fail');
    expect(run('a11y.labels', ctx({ axe: { ...NO_VIOLATIONS, byRule: { bypass: 2 } } })).r).toBe('pass');
  });
});

describe('a11y.skip_link', () => {
  it('is n/a without an axe run', () => {
    expect(run('a11y.skip_link', ctx()).r).toBe('na');
  });
  it('fails when the bypass rule has a violation (no way to skip repeated content)', () => {
    expect(run('a11y.skip_link', ctx({ axe: { ...NO_VIOLATIONS, byRule: { bypass: 1 } } })).r).toBe('fail');
  });
  it('passes when the bypass rule has no violation', () => {
    expect(run('a11y.skip_link', ctx({ axe: NO_VIOLATIONS })).r).toBe('pass');
  });
});

describe('a11y.keyboard', () => {
  it('is n/a without html or css', () => {
    expect(run('a11y.keyboard', ctx()).r).toBe('na');
  });
  it('passes when only tabindex="-1" is present, without outline:none anywhere', () => {
    expect(run('a11y.keyboard', ctx({ html: '<a tabindex="-1">x</a>' })).r).toBe('pass');
  });
  it('passes when only outline:none is present, without a negative tabindex', () => {
    expect(run('a11y.keyboard', ctx({ cssTexts: ['a:focus { outline: none; }'] })).r).toBe('pass');
  });
  it('warns when both a negative tabindex and outline:none appear together', () => {
    const html = '<a tabindex="-1">x</a>';
    expect(run('a11y.keyboard', ctx({ html, cssTexts: ['a { outline: none; }'] })).r).toBe('warn');
  });
});

describe('a11y.lighthouse', () => {
  it('is n/a when Lighthouse never ran', () => {
    expect(run('a11y.lighthouse', ctx()).r).toBe('na');
  });
  it('is n/a when Lighthouse ran but failed', () => {
    expect(run('a11y.lighthouse', ctx({ lighthouse: null })).r).toBe('na');
  });
  it('passes with the score as evidence when Lighthouse succeeded', () => {
    const lighthouse = { performance: 41, accessibility: 67, bestPractices: 75, seo: 80, lcpMs: null, cls: null, totalByteWeightBytes: null, tapTargetsOk: null, imagesOptimized: null };
    const result = run('a11y.lighthouse', ctx({ lighthouse }));
    expect(result.r).toBe('pass');
    expect(result.ev).toBe('67/100');
  });
});
