import { describe, expect, it } from 'vitest';
import { IDENTITY_CHECKS } from '../src/checks/identity.js';
import type { CheckContext, CheckId } from '../src/checks/types.js';
import type { LightResult } from '../src/light.js';
import type { Site } from '../src/types.js';

const byId = new Map(IDENTITY_CHECKS.map((check) => [check.id, check]));
function run(id: CheckId, ctx: CheckContext) {
  return byId.get(id)!.run(ctx);
}
function appliesTo(id: CheckId, s: Site): boolean {
  const check = byId.get(id)!;
  return check.appliesTo ? check.appliesTo(s) : true;
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

describe('id.gov_domain', () => {
  it.each(['https://dept.kerala.gov.in/', 'https://portal.nic.in/', 'https://university.ac.in/', 'https://college.edu.in/', 'https://iisc.res.in/'])(
    'passes for %s',
    (url) => {
      expect(run('id.gov_domain', ctx({ site: site({ url }) })).r).toBe('pass');
    },
  );
  it('fails for a .com domain', () => {
    const result = run('id.gov_domain', ctx({ site: site({ url: 'https://mydept.com/' }) }));
    expect(result.r).toBe('fail');
    expect(result.ev).toBe('mydept.com');
  });
  it('does not false-positive on a domain that merely ends with the letters of a gov suffix', () => {
    // "notnic.in" ends with the substring "nic.in" but not with the boundary ".nic.in" -- a real
    // NIC domain always has a dot right before "nic.in", so this must not pass as one.
    expect(run('id.gov_domain', ctx({ site: site({ url: 'https://notnic.in/' }) })).r).toBe('fail');
  });
});

describe('id.domain_expiry', () => {
  it('does not apply to a .gov.in site', () => {
    expect(appliesTo('id.domain_expiry', site({ url: 'https://dept.kerala.gov.in/' }))).toBe(false);
  });
  it('applies to a .com site', () => {
    expect(appliesTo('id.domain_expiry', site({ url: 'https://mydept.com/' }))).toBe(true);
  });
  it('is n/a when no RDAP lookup was made', () => {
    expect(run('id.domain_expiry', ctx()).r).toBe('na');
  });
  it('is n/a when RDAP had no answer', () => {
    expect(run('id.domain_expiry', ctx({ domainExpiryDays: null })).r).toBe('na');
  });
  it('fails when fewer than 60 days remain', () => {
    expect(run('id.domain_expiry', ctx({ domainExpiryDays: 10 })).r).toBe('fail');
  });
  it('passes when 60 or more days remain', () => {
    expect(run('id.domain_expiry', ctx({ domainExpiryDays: 60 })).r).toBe('pass');
  });
});

describe('id.www_consistency', () => {
  it('is n/a when the runner never probed both variants', () => {
    expect(run('id.www_consistency', ctx()).r).toBe('na');
  });
  it('passes when consistent', () => {
    expect(run('id.www_consistency', ctx({ wwwConsistent: true })).r).toBe('pass');
  });
  it('fails when inconsistent', () => {
    expect(run('id.www_consistency', ctx({ wwwConsistent: false })).r).toBe('fail');
  });
});

describe('id.robots', () => {
  it('is n/a when robots.txt was never fetched', () => {
    expect(run('id.robots', ctx()).r).toBe('na');
  });
  it('fails when robots.txt does not serve', () => {
    expect(run('id.robots', ctx({ robotsTxt: { status: 404, body: '' } })).r).toBe('fail');
  });
  it('fails when robots.txt disallows everything for all crawlers', () => {
    const body = 'User-agent: *\nDisallow: /\n';
    expect(run('id.robots', ctx({ robotsTxt: { status: 200, body } })).r).toBe('fail');
  });
  it('passes when robots.txt disallows only specific paths', () => {
    const body = 'User-agent: *\nDisallow: /admin/\n';
    expect(run('id.robots', ctx({ robotsTxt: { status: 200, body } })).r).toBe('pass');
  });
  it('passes when a wildcard disallow-all is paired with an explicit allow', () => {
    const body = 'User-agent: *\nDisallow: /\nAllow: /index.html\n';
    expect(run('id.robots', ctx({ robotsTxt: { status: 200, body } })).r).toBe('pass');
  });
});

describe('id.sitemap_xml', () => {
  it('is n/a when never fetched', () => {
    expect(run('id.sitemap_xml', ctx()).r).toBe('na');
  });
  it('passes on 2xx', () => {
    expect(run('id.sitemap_xml', ctx({ sitemapXmlStatus: 200 })).r).toBe('pass');
  });
  it('fails on 404', () => {
    expect(run('id.sitemap_xml', ctx({ sitemapXmlStatus: 404 })).r).toBe('fail');
  });
});

describe('id.soft_404', () => {
  it('is n/a when never probed', () => {
    expect(run('id.soft_404', ctx()).r).toBe('na');
  });
  it('fails when a nonexistent path returns 200', () => {
    expect(run('id.soft_404', ctx({ soft404Status: 200 })).r).toBe('fail');
  });
  it('passes when a nonexistent path returns 404', () => {
    expect(run('id.soft_404', ctx({ soft404Status: 404 })).r).toBe('pass');
  });
});

describe('id.canonical', () => {
  it('is n/a without page content', () => {
    expect(run('id.canonical', ctx()).r).toBe('na');
  });
  it('passes when a canonical link is present', () => {
    expect(run('id.canonical', ctx({ html: '<html><head><link rel="canonical" href="https://x/"></head></html>' })).r).toBe('pass');
  });
  it('fails when absent', () => {
    expect(run('id.canonical', ctx({ html: '<html><head></head></html>' })).r).toBe('fail');
  });
});

describe('id.charset_doctype', () => {
  it('is n/a without page content', () => {
    expect(run('id.charset_doctype', ctx()).r).toBe('na');
  });
  it('passes with an HTML5 doctype and a UTF-8 meta charset', () => {
    const html = '<!DOCTYPE html><html><head><meta charset="utf-8"></head></html>';
    expect(run('id.charset_doctype', ctx({ html })).r).toBe('pass');
  });
  it('fails when the doctype is missing', () => {
    const html = '<html><head><meta charset="utf-8"></head></html>';
    expect(run('id.charset_doctype', ctx({ html })).r).toBe('fail');
  });
  it('fails when the charset is missing from both the html and the response headers', () => {
    const html = '<!DOCTYPE html><html><head></head></html>';
    expect(run('id.charset_doctype', ctx({ html })).r).toBe('fail');
  });
  it('passes when the charset comes from the Content-Type header instead of a meta tag', () => {
    const html = '<!DOCTYPE html><html><head></head></html>';
    expect(run('id.charset_doctype', ctx({ html, headers: { 'content-type': 'text/html; charset=utf-8' } })).r).toBe('pass');
  });
});

describe('id.tech', () => {
  it('is n/a without page content', () => {
    expect(run('id.tech', ctx()).r).toBe('na');
  });
  it('warns on an old WordPress major version', () => {
    const html = '<html><head><meta name="generator" content="WordPress 4.9"></head></html>';
    expect(run('id.tech', ctx({ html })).r).toBe('warn');
  });
  it('passes on a current WordPress major version', () => {
    const html = '<html><head><meta name="generator" content="WordPress 6.5"></head></html>';
    expect(run('id.tech', ctx({ html })).r).toBe('pass');
  });
  it('passes (informationally) when nothing is detected', () => {
    expect(run('id.tech', ctx({ html: '<html><head></head></html>' })).r).toBe('pass');
  });
});

describe('id.third_party', () => {
  it('is n/a when scripts were never enumerated', () => {
    expect(run('id.third_party', ctx()).r).toBe('na');
  });
  it('warns when a known tracker script is loaded', () => {
    expect(run('id.third_party', ctx({ scriptUrls: ['https://www.google-analytics.com/analytics.js'] })).r).toBe('warn');
  });
  it('passes when no third-party scripts are loaded', () => {
    expect(run('id.third_party', ctx({ scriptUrls: ['/static/app.js'] })).r).toBe('pass');
  });
});
