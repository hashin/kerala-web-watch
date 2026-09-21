import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GIGW_CHECKS } from '../src/checks/gigw.js';
import type { CheckContext, CheckId } from '../src/checks/types.js';
import type { LightResult } from '../src/light.js';
import type { Site } from '../src/types.js';

const FIXTURES = join(import.meta.dirname, 'fixtures', 'pages');
const page = (name: string): string => readFileSync(join(FIXTURES, name), 'utf8');

const byId = new Map(GIGW_CHECKS.map((check) => [check.id, check]));
function run(id: CheckId, ctx: CheckContext) {
  return byId.get(id)!.run(ctx);
}

const ALL_GIGW_IDS = GIGW_CHECKS.map((c) => c.id);

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

describe('gigw.* against gigw-all-en.html', () => {
  const html = page('gigw-all-en.html');
  it.each(ALL_GIGW_IDS)('%s passes', (id) => {
    expect(run(id, ctx({ html })).r).not.toBe('fail');
  });
});

describe('gigw.* against gigw-all-ml.html', () => {
  const html = page('gigw-all-ml.html');
  it.each(ALL_GIGW_IDS)('%s passes', (id) => {
    expect(run(id, ctx({ html })).r).not.toBe('fail');
  });
});

describe('gigw.* against gigw-none.html', () => {
  const html = page('gigw-none.html');
  // gigw.emblem is a soft, informational (severity I) heuristic that reports `warn` rather than
  // `fail` when nothing is detected -- see gigw.ts's own comment -- so it's excluded here.
  const hardFailIds = ALL_GIGW_IDS.filter((id) => id !== 'gigw.emblem');
  it.each(hardFailIds)('%s fails', (id) => {
    expect(run(id, ctx({ html })).r).toBe('fail');
  });
  it('gigw.emblem warns rather than fails when no emblem is detected', () => {
    expect(run('gigw.emblem', ctx({ html })).r).toBe('warn');
  });
});

describe('gigw.* is n/a without any page content', () => {
  it.each(ALL_GIGW_IDS)('%s is n/a', (id) => {
    expect(run(id, ctx()).r).toBe('na');
  });
});

describe('navigation-scoped matching avoids false positives from ordinary prose', () => {
  it('gigw.contact does not fire on an article that merely mentions the word "contact" in passing', () => {
    const html = '<html><body><p>Please contact your local police station in an emergency.</p></body></html>';
    expect(run('gigw.contact', ctx({ html })).r).toBe('fail');
  });
  it('gigw.contact does fire when "Contact Us" is an actual link', () => {
    const html = '<html><body><a href="/contact">Contact Us</a></body></html>';
    expect(run('gigw.contact', ctx({ html })).r).toBe('pass');
  });
  it('gigw.help matches a title attribute, not just link text', () => {
    const html = '<html><body><a href="/faq" title="Help and FAQ"></a></body></html>';
    expect(run('gigw.help', ctx({ html })).r).toBe('pass');
  });
});

describe('each navigation-based gigw check is wired to its own pattern, not a sibling\'s', () => {
  // A page with exactly one GIGW element present. The `gigw-all-*` fixtures can't catch a swapped
  // wire-up (e.g. gigw.sitemap accidentally checking the 'privacy' pattern) because every pattern
  // is present at once there; this isolates one marker per case and checks every other navigation
  // check still fails against it.
  const singleMarkerHtml: Partial<Record<CheckId, string>> = {
    'gigw.contact': '<html><body><a href="/x">Contact Us</a></body></html>',
    'gigw.feedback': '<html><body><a href="/x">Feedback</a></body></html>',
    'gigw.sitemap': '<html><body><a href="/x">Sitemap</a></body></html>',
    'gigw.privacy': '<html><body><a href="/x">Privacy Policy</a></body></html>',
    'gigw.terms': '<html><body><a href="/x">Terms and Conditions</a></body></html>',
    'gigw.copyright_policy': '<html><body><a href="/x">Copyright Policy</a></body></html>',
    'gigw.hyperlink_policy': '<html><body><a href="/x">Hyperlinking Policy</a></body></html>',
    'gigw.disclaimer': '<html><body><a href="/x">Disclaimer</a></body></html>',
    'gigw.accessibility_statement': '<html><body><a href="/x">Accessibility Statement</a></body></html>',
    'gigw.screen_reader': '<html><body><a href="/x">Screen Reader Access</a></body></html>',
    'gigw.help': '<html><body><a href="/x">Help</a></body></html>',
    'gigw.rti': '<html><body><a href="/x">RTI</a></body></html>',
  };
  const navigationIds = Object.keys(singleMarkerHtml) as CheckId[];

  it.each(navigationIds)('%s passes on its own marker alone, while every sibling navigation check still fails', (ownId) => {
    const html = singleMarkerHtml[ownId]!;
    expect(run(ownId, ctx({ html })).r).toBe('pass');
    for (const otherId of navigationIds) {
      if (otherId === ownId) continue;
      expect(run(otherId, ctx({ html })).r).toBe('fail');
    }
  });
});

describe('gigw.search', () => {
  it('passes via a bare <input type="search"> even without matching link text', () => {
    const html = '<html><body><input type="search" name="q"></body></html>';
    expect(run('gigw.search', ctx({ html })).r).toBe('pass');
  });
});

describe('gigw.ownership matches footer prose, not just navigation', () => {
  it('passes on an ownership statement that is plain footer text, not a link', () => {
    const html = '<html><body><footer>Content owned and maintained by the Department.</footer></body></html>';
    expect(run('gigw.ownership', ctx({ html })).r).toBe('pass');
  });
});

describe('gigw.last_updated', () => {
  it('fails when no last-updated date is shown at all', () => {
    expect(run('gigw.last_updated', ctx({ html: page('gigw-none.html') })).r).toBe('fail');
  });
  it('passes when a last-updated date is shown, regardless of how old it is', () => {
    // Unlike content.last_updated, gigw.last_updated only asks "is a date shown at all" -- an old
    // one still counts, since freshness is content.last_updated's job, not this one's.
    expect(run('gigw.last_updated', ctx({ html: page('last-updated-old.html') })).r).toBe('pass');
  });
});
