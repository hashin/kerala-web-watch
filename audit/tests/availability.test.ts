import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AVAILABILITY_CHECKS } from '../src/checks/availability.js';
import type { CheckContext, CheckId } from '../src/checks/types.js';
import type { LightResult } from '../src/light.js';
import type { Site } from '../src/types.js';

const FIXTURES = join(import.meta.dirname, 'fixtures', 'pages');
const page = (name: string): string => readFileSync(join(FIXTURES, name), 'utf8');

const byId = new Map(AVAILABILITY_CHECKS.map((check) => [check.id, check]));
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

describe('avail.dns', () => {
  it('fails when the light check never resolved DNS', () => {
    expect(run('avail.dns', ctx({ light: light({ dns: false, status_class: 'dns_fail' }) })).r).toBe('fail');
  });
  it('passes when DNS resolved', () => {
    expect(run('avail.dns', ctx()).r).toBe('pass');
  });
});

describe('avail.connect', () => {
  it('is n/a when DNS itself already failed', () => {
    expect(run('avail.connect', ctx({ light: light({ dns: false, status_class: 'dns_fail' }) })).r).toBe('na');
  });
  it('fails on a connect failure', () => {
    expect(run('avail.connect', ctx({ light: light({ status_class: 'connect_fail' }) })).r).toBe('fail');
  });
  it('fails on a timeout', () => {
    expect(run('avail.connect', ctx({ light: light({ status_class: 'timeout' }) })).r).toBe('fail');
  });
  it('passes when the connection succeeded', () => {
    expect(run('avail.connect', ctx()).r).toBe('pass');
  });
});

describe('avail.status', () => {
  it('is n/a when the connection never completed', () => {
    expect(run('avail.status', ctx({ light: light({ status_class: 'connect_fail' }) })).r).toBe('na');
  });
  it('fails on a non-2xx final response', () => {
    expect(run('avail.status', ctx({ light: light({ status_class: 'http_500', status: 500 }) })).r).toBe('fail');
  });
  it('passes on a 2xx final response', () => {
    expect(run('avail.status', ctx()).r).toBe('pass');
  });
});

describe('avail.redirect_offsite', () => {
  it('is n/a when there was no successful response to check', () => {
    expect(run('avail.redirect_offsite', ctx({ light: light({ final_domain: null }) })).r).toBe('na');
  });
  it('passes when the final domain matches the audited domain', () => {
    expect(run('avail.redirect_offsite', ctx({ light: light({ domain: 'kerala.gov.in', final_domain: 'kerala.gov.in' }) })).r).toBe('pass');
  });
  it('passes when the final domain matches only a registered alias, not the originally audited domain', () => {
    // domain and final_domain deliberately differ here -- if the alias weren't consulted at all,
    // this would fall through to "unrelated" and wrongly fail.
    const withAlias = ctx({
      site: site({ aliases: ['https://old-department-name.example.org/'] }),
      light: light({ domain: 'example.com', final_domain: 'example.org' }),
    });
    expect(run('avail.redirect_offsite', withAlias).r).toBe('pass');
  });
  it('fails when the final domain is unrelated to the site or its aliases', () => {
    const hijacked = ctx({ light: light({ domain: 'kerala.gov.in', final_domain: 'totally-unrelated.com' }) });
    const result = run('avail.redirect_offsite', hijacked);
    expect(result.r).toBe('fail');
    expect(result.ev).toContain('totally-unrelated.com');
  });
});

describe('avail.parked', () => {
  it('is n/a without page content', () => {
    expect(run('avail.parked', ctx()).r).toBe('na');
  });
  it('fires on a GoDaddy parking page', () => {
    expect(run('avail.parked', ctx({ html: page('parked-godaddy.html') })).r).toBe('fail');
  });
  it('fires on a Sedo parking page', () => {
    expect(run('avail.parked', ctx({ html: page('parked-sedo.html') })).r).toBe('fail');
  });
  it('fires when the final domain itself is a known parking registrar, even without matching text', () => {
    const result = run('avail.parked', ctx({ html: '<html><body>hello</body></html>', light: light({ final_domain: 'hugedomains.com' }) }));
    expect(result.r).toBe('fail');
  });
  it.each([
    'domain is for sale',
    'buy this domain',
    'this domain may be for sale',
    'parked free',
    'hugedomains',
    'afternic',
    'dan.com',
    'bodis',
    'parkingcrew',
    'this webpage is parked',
  ])('fires on the phrase "%s" on its own, with nothing else in the two fixtures to mask it', (phrase) => {
    expect(run('avail.parked', ctx({ html: `<html><body>${phrase}</body></html>` })).r).toBe('fail');
  });
  it('passes on an ordinary page', () => {
    expect(run('avail.parked', ctx({ html: page('ok-minimal.html') })).r).toBe('pass');
  });
});

describe('avail.default_page', () => {
  it('is n/a without page content', () => {
    expect(run('avail.default_page', ctx()).r).toBe('na');
  });
  it('fires on the Apache default page', () => {
    expect(run('avail.default_page', ctx({ html: page('default-apache.html') })).r).toBe('fail');
  });
  it('fires on the IIS default page', () => {
    expect(run('avail.default_page', ctx({ html: page('default-iis.html') })).r).toBe('fail');
  });
  it('fires on the nginx default page', () => {
    expect(run('avail.default_page', ctx({ html: page('default-nginx.html') })).r).toBe('fail');
  });
  it('fires on a bare directory listing', () => {
    expect(run('avail.default_page', ctx({ html: page('dir-listing.html') })).r).toBe('fail');
  });
  it('fires on a bare "It works!" body, distinct from the Apache page\'s own named signature', () => {
    expect(run('avail.default_page', ctx({ html: '<html><body>It works!</body></html>' })).r).toBe('fail');
  });
  it('passes on an ordinary page', () => {
    expect(run('avail.default_page', ctx({ html: page('ok-minimal.html') })).r).toBe('pass');
  });
});

describe('avail.blank', () => {
  it('is n/a without page content or rendered text', () => {
    expect(run('avail.blank', ctx()).r).toBe('na');
  });
  it('fires when the rendered page has almost no visible text', () => {
    expect(run('avail.blank', ctx({ html: page('blank.html') })).r).toBe('fail');
  });
  it('passes on an ordinary page', () => {
    expect(run('avail.blank', ctx({ html: page('ok-minimal.html') })).r).toBe('pass');
  });
  it('prefers ctx.text over deriving text from html when both are present', () => {
    expect(run('avail.blank', ctx({ html: page('ok-minimal.html'), text: 'short' })).r).toBe('fail');
  });
  it('fails at exactly 79 visible characters, one under the 80-character threshold', () => {
    expect(run('avail.blank', ctx({ text: 'a'.repeat(79) })).r).toBe('fail');
  });
  it('passes at exactly 80 visible characters, the threshold itself', () => {
    expect(run('avail.blank', ctx({ text: 'a'.repeat(80) })).r).toBe('pass');
  });
});

describe('avail.under_construction', () => {
  it('is n/a without page content', () => {
    expect(run('avail.under_construction', ctx()).r).toBe('na');
  });
  it('fails on a short English under-construction page', () => {
    expect(run('avail.under_construction', ctx({ html: page('under-construction-en.html') })).r).toBe('fail');
  });
  it('fails on a short Malayalam under-construction page', () => {
    expect(run('avail.under_construction', ctx({ html: page('under-construction-ml.html') })).r).toBe('fail');
  });
  it('warns rather than fails when the phrase appears alongside a substantial amount of other content', () => {
    const longPage = `<html><body><p>under construction</p><p>${'a'.repeat(450)}</p></body></html>`;
    expect(run('avail.under_construction', ctx({ html: longPage })).r).toBe('warn');
  });
  it('passes on an ordinary page with no such phrase', () => {
    expect(run('avail.under_construction', ctx({ html: page('ok-minimal.html') })).r).toBe('pass');
  });
});

describe('avail.ttfb', () => {
  it('is n/a when there is no ttfb reading', () => {
    expect(run('avail.ttfb', ctx({ light: light({ ttfb_ms: null }) })).r).toBe('na');
  });
  it('passes under 3s', () => {
    expect(run('avail.ttfb', ctx({ light: light({ ttfb_ms: 1000 }) })).r).toBe('pass');
  });
  it('warns over 3s', () => {
    expect(run('avail.ttfb', ctx({ light: light({ ttfb_ms: 4000 }) })).r).toBe('warn');
  });
  it('fails over 8s', () => {
    expect(run('avail.ttfb', ctx({ light: light({ ttfb_ms: 9000 }) })).r).toBe('fail');
  });
});

describe('avail.geo_blocked', () => {
  it('passes when nothing suggests a geo-block', () => {
    expect(run('avail.geo_blocked', ctx({ html: page('ok-minimal.html') })).r).toBe('pass');
  });
  it('fires on an NIC-style 403 Access Denied page', () => {
    const html = '<html><body>Access Denied. This resource is restricted by NIC to your country.</body></html>';
    expect(run('avail.geo_blocked', ctx({ status: 403, html })).r).toBe('fail');
  });
  it('fires on a Cloudflare error 1020 page', () => {
    const html = '<html><body>You do not have access. Error code: 1020</body></html>';
    expect(run('avail.geo_blocked', ctx({ html })).r).toBe('fail');
  });
  it('falls back to the light check\'s own geo-block signal when no page content is available', () => {
    expect(run('avail.geo_blocked', ctx({ light: light({ geo_block_suspect: true }) })).r).toBe('fail');
  });
});

describe('avail.flapping', () => {
  it('is n/a without history', () => {
    expect(run('avail.flapping', ctx()).r).toBe('na');
  });
  it('passes when down on fewer than 3 of the last 7 days', () => {
    const history = [
      { d: '2026-09-21', up: false },
      { d: '2026-09-20', up: false },
      { d: '2026-09-19', up: true },
    ].map((h) => ({ ...h, score: null }));
    expect(run('avail.flapping', ctx({ history })).r).toBe('pass');
  });
  it('fails when down on 3 or more of the last 7 days', () => {
    const history = [
      { d: '2026-09-21', up: false },
      { d: '2026-09-20', up: false },
      { d: '2026-09-19', up: false },
      { d: '2026-09-18', up: true },
    ].map((h) => ({ ...h, score: null }));
    expect(run('avail.flapping', ctx({ history })).r).toBe('fail');
  });
  it('only looks at the most recent 7 days, not the full history', () => {
    const oldDowns = Array.from({ length: 20 }, (_, i) => ({ d: `2026-08-${i + 1}`, up: false, score: null }));
    const recentUps = Array.from({ length: 7 }, (_, i) => ({ d: `2026-09-${i + 1}`, up: true, score: null }));
    expect(run('avail.flapping', ctx({ history: [...recentUps, ...oldDowns] })).r).toBe('pass');
  });
});
