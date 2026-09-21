import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SECURITY_CHECKS } from '../src/checks/security.js';
import type { CheckContext, CheckId } from '../src/checks/types.js';
import type { LightResult, LightTls } from '../src/light.js';
import type { Site } from '../src/types.js';

const FIXTURES = join(import.meta.dirname, 'fixtures');
const page = (name: string): string => readFileSync(join(FIXTURES, 'pages', name), 'utf8');
const headers = (name: string): Record<string, string> => JSON.parse(readFileSync(join(FIXTURES, 'headers', name), 'utf8'));

const byId = new Map(SECURITY_CHECKS.map((check) => [check.id, check]));
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

function tls(overrides: Partial<LightTls> = {}): LightTls {
  return { valid: true, protocol: 'TLSv1.3', expires: '2027-01-01T00:00:00.000Z', days_left: 100, issuer: 'Test CA', ...overrides };
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
    tls: tls(),
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

describe('sec.https', () => {
  it('is n/a when the site could not be reached at all', () => {
    expect(run('sec.https', ctx({ light: light({ status_class: 'connect_fail' }) })).r).toBe('na');
  });
  it('is n/a on a timeout too, not just a connect failure', () => {
    expect(run('sec.https', ctx({ light: light({ status_class: 'timeout' }) })).r).toBe('na');
  });
  it('passes when the final url is https', () => {
    expect(run('sec.https', ctx()).r).toBe('pass');
  });
  it('fails when the final url is plain http', () => {
    expect(run('sec.https', ctx({ light: light({ final_url: 'http://test.kerala.gov.in/' }) })).r).toBe('fail');
  });
});

describe('sec.http_redirect', () => {
  it('is n/a when the site is not https (or was never probed)', () => {
    expect(run('sec.http_redirect', ctx({ light: light({ http_redirects_to_https: null }) })).r).toBe('na');
  });
  it('passes when http redirects to https', () => {
    expect(run('sec.http_redirect', ctx({ light: light({ http_redirects_to_https: true }) })).r).toBe('pass');
  });
  it('fails when it does not', () => {
    expect(run('sec.http_redirect', ctx({ light: light({ http_redirects_to_https: false }) })).r).toBe('fail');
  });
});

describe('sec.cert_valid', () => {
  it('is n/a without a TLS handshake to validate', () => {
    expect(run('sec.cert_valid', ctx({ light: light({ tls: null }) })).r).toBe('na');
  });
  it('passes for a valid certificate', () => {
    expect(run('sec.cert_valid', ctx()).r).toBe('pass');
  });
  it('fails for an invalid certificate', () => {
    expect(run('sec.cert_valid', ctx({ light: light({ tls: tls({ valid: false }) }) })).r).toBe('fail');
  });
});

describe('sec.cert_expiry', () => {
  it('is n/a without TLS info', () => {
    expect(run('sec.cert_expiry', ctx({ light: light({ tls: null }) })).r).toBe('na');
  });
  it('passes with 30 or more days left', () => {
    expect(run('sec.cert_expiry', ctx({ light: light({ tls: tls({ days_left: 30 }) }) })).r).toBe('pass');
  });
  it('warns under 30 days', () => {
    expect(run('sec.cert_expiry', ctx({ light: light({ tls: tls({ days_left: 29 }) }) })).r).toBe('warn');
  });
  it('fails under 7 days', () => {
    expect(run('sec.cert_expiry', ctx({ light: light({ tls: tls({ days_left: 6 }) }) })).r).toBe('fail');
  });
});

describe('sec.tls_version', () => {
  it('is n/a without TLS info', () => {
    expect(run('sec.tls_version', ctx({ light: light({ tls: null }) })).r).toBe('na');
  });
  it('passes on TLS 1.2', () => {
    expect(run('sec.tls_version', ctx({ light: light({ tls: tls({ protocol: 'TLSv1.2' }) }) })).r).toBe('pass');
  });
  it('passes on TLS 1.3', () => {
    expect(run('sec.tls_version', ctx({ light: light({ tls: tls({ protocol: 'TLSv1.3' }) }) })).r).toBe('pass');
  });
  it('fails on TLS 1.1', () => {
    expect(run('sec.tls_version', ctx({ light: light({ tls: tls({ protocol: 'TLSv1.1' }) }) })).r).toBe('fail');
  });
  it('fails on TLS 1.0', () => {
    expect(run('sec.tls_version', ctx({ light: light({ tls: tls({ protocol: 'TLSv1' }) }) })).r).toBe('fail');
  });
  it('passes on a hypothetical future major version above 1', () => {
    // No such TLS version exists today, but the comparison logic treats "major > 1" as
    // unconditionally fine and that branch deserves its own pin rather than relying on it never
    // being exercised.
    expect(run('sec.tls_version', ctx({ light: light({ tls: tls({ protocol: 'TLSv2.0' }) }) })).r).toBe('pass');
  });
});

describe('header-based security checks against fixture header sets', () => {
  it.each(['sec.hsts', 'sec.csp', 'sec.xfo', 'sec.xcto', 'sec.referrer'] as CheckId[])('%s is n/a when headers were never fetched', (id) => {
    expect(run(id, ctx()).r).toBe('na');
  });
  it.each(['sec.hsts', 'sec.csp', 'sec.xfo', 'sec.xcto', 'sec.referrer'] as CheckId[])('%s passes against headers-good.json', (id) => {
    expect(run(id, ctx({ headers: headers('headers-good.json') })).r).toBe('pass');
  });
  it.each(['sec.hsts', 'sec.csp', 'sec.xfo', 'sec.xcto', 'sec.referrer'] as CheckId[])('%s fails against headers-none.json', (id) => {
    expect(run(id, ctx({ headers: headers('headers-none.json') })).r).toBe('fail');
  });
  it('sec.xfo also passes via a frame-ancestors CSP directive, without X-Frame-Options itself', () => {
    const result = run('sec.xfo', ctx({ headers: { 'content-security-policy': "frame-ancestors 'self'" } }));
    expect(result.r).toBe('pass');
  });
  it('sec.hsts matches a header name regardless of case, as real servers commonly send it', () => {
    expect(run('sec.hsts', ctx({ headers: { 'Strict-Transport-Security': 'max-age=31536000' } })).r).toBe('pass');
  });
  it('sec.xfo does not match a differently-named header that merely contains "x-frame-options" as a substring', () => {
    const result = run('sec.xfo', ctx({ headers: { 'x-frame-options-report-only': 'DENY' } }));
    expect(result.r).toBe('fail');
  });
});

describe('sec.server_banner', () => {
  it('is n/a when headers were never fetched', () => {
    expect(run('sec.server_banner', ctx()).r).toBe('na');
  });
  it('passes against headers-good.json (Server present but no version number)', () => {
    expect(run('sec.server_banner', ctx({ headers: headers('headers-good.json') })).r).toBe('pass');
  });
  it('fails against headers-none.json (both Server and X-Powered-By disclose versions)', () => {
    const result = run('sec.server_banner', ctx({ headers: headers('headers-none.json') }));
    expect(result.r).toBe('fail');
  });
});

describe('sec.mixed_content', () => {
  it('is n/a when unreachable', () => {
    expect(run('sec.mixed_content', ctx({ light: light({ status_class: 'connect_fail' }) })).r).toBe('na');
  });
  it('is n/a on a timeout too, not just a connect failure', () => {
    expect(run('sec.mixed_content', ctx({ light: light({ status_class: 'timeout' }), html: page('mixed-content.html') })).r).toBe('na');
  });
  it('is n/a on a plain http page (mixed content only applies to https pages)', () => {
    expect(run('sec.mixed_content', ctx({ light: light({ final_url: 'http://test.kerala.gov.in/' }), html: page('mixed-content.html') })).r).toBe(
      'na',
    );
  });
  it('is n/a without any request log or page content to scan', () => {
    expect(run('sec.mixed_content', ctx()).r).toBe('na');
  });
  it('fails via a static scan of an http:// script/image src on an https page', () => {
    expect(run('sec.mixed_content', ctx({ html: page('mixed-content.html') })).r).toBe('fail');
  });
  it('fails via the request log even without matching static markup', () => {
    const result = run('sec.mixed_content', ctx({ requests: [{ url: 'http://cdn.example.com/tracker.js' }], html: '<html></html>' }));
    expect(result.r).toBe('fail');
  });
  it('passes on an https page with no insecure subresources', () => {
    expect(run('sec.mixed_content', ctx({ html: page('ok-minimal.html') })).r).toBe('pass');
  });
});

describe('sec.vuln_js', () => {
  it('is n/a when no scan was ever run', () => {
    expect(run('sec.vuln_js', ctx()).r).toBe('na');
  });
  it('fails when a vulnerable library was found', () => {
    const result = run('sec.vuln_js', ctx({ vulnerableLibraries: [{ library: 'jquery', version: '1.8.3', cve: ['CVE-2012-6708'] }] }));
    expect(result.r).toBe('fail');
    expect(result.ev).toContain('jquery');
  });
  it('passes when the scan found nothing', () => {
    expect(run('sec.vuln_js', ctx({ vulnerableLibraries: [] })).r).toBe('pass');
  });
});

describe('sec.safe_browsing', () => {
  it('is n/a when never checked (no API key, or a lookup failure)', () => {
    expect(run('sec.safe_browsing', ctx()).r).toBe('na');
  });
  it('fails when flagged', () => {
    expect(run('sec.safe_browsing', ctx({ safeBrowsingFlagged: true })).r).toBe('fail');
  });
  it('passes when checked and clean', () => {
    expect(run('sec.safe_browsing', ctx({ safeBrowsingFlagged: false })).r).toBe('pass');
  });
});
