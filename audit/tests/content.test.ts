import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CONTENT_CHECKS } from '../src/checks/content.js';
import type { CheckContext, CheckId } from '../src/checks/types.js';
import type { LightResult } from '../src/light.js';
import type { Site } from '../src/types.js';

const FIXTURES = join(import.meta.dirname, 'fixtures', 'pages');
const page = (name: string): string => readFileSync(join(FIXTURES, name), 'utf8');

const byId = new Map(CONTENT_CHECKS.map((check) => [check.id, check]));
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

describe('content.copyright_year', () => {
  it('is n/a without any page content', () => {
    expect(run('content.copyright_year', ctx()).r).toBe('na');
  });
  it('is n/a when no copyright marker is found at all', () => {
    expect(run('content.copyright_year', ctx({ html: page('gigw-none.html') })).r).toBe('na');
  });
  it('fails when the copyright year is 2 or more years old', () => {
    expect(run('content.copyright_year', ctx({ html: page('copyright-2019.html') })).r).toBe('fail');
  });
  it('passes when the copyright year is current', () => {
    const html = '<html><body><footer>© 2026 Department</footer></body></html>';
    expect(run('content.copyright_year', ctx({ html })).r).toBe('pass');
  });
});

describe('content.last_updated', () => {
  it('is n/a without any page content', () => {
    expect(run('content.last_updated', ctx()).r).toBe('na');
  });
  it('fails when no "last updated" date is found', () => {
    expect(run('content.last_updated', ctx({ html: page('gigw-none.html') })).r).toBe('fail');
  });
  it('fails when the last-updated date is more than 12 months old', () => {
    expect(run('content.last_updated', ctx({ html: page('last-updated-old.html') })).r).toBe('fail');
  });
  it('passes when the last-updated date is recent', () => {
    const html = '<html><body><footer>Last updated: 15-09-2026</footer></body></html>';
    expect(run('content.last_updated', ctx({ html })).r).toBe('pass');
  });
});

describe('content.stale_news', () => {
  it('is n/a without any page content', () => {
    expect(run('content.stale_news', ctx()).r).toBe('na');
  });
  it('is n/a when there is no news/announcements/tenders section at all', () => {
    expect(run('content.stale_news', ctx({ html: page('gigw-none.html') })).r).toBe('na');
  });
  it('fails when the newest dated news item is more than 12 months old', () => {
    expect(run('content.stale_news', ctx({ html: page('stale-news.html') })).r).toBe('fail');
  });
  it('passes when the newest dated news item is recent', () => {
    const html = '<html><body><h2>News</h2><p>20-09-2026: Fresh update.</p></body></html>';
    expect(run('content.stale_news', ctx({ html })).r).toBe('pass');
  });
});

describe('content.placeholder', () => {
  it('is n/a without any page content', () => {
    expect(run('content.placeholder', ctx()).r).toBe('na');
  });
  it('fires on a lorem-ipsum placeholder page', () => {
    expect(run('content.placeholder', ctx({ html: page('lorem.html') })).r).toBe('fail');
  });
  it('passes on an ordinary page', () => {
    expect(run('content.placeholder', ctx({ html: page('ok-minimal.html') })).r).toBe('pass');
  });
});

describe('content.legacy_font', () => {
  it('is n/a without page content or CSS', () => {
    expect(run('content.legacy_font', ctx()).r).toBe('na');
  });
  it('fires on a CSS font-family referencing ML-TTKarthika', () => {
    expect(run('content.legacy_font', ctx({ html: page('legacy-font-karthika.html') })).r).toBe('fail');
  });
  it('fires on a <font face="Revathi"> tag', () => {
    expect(run('content.legacy_font', ctx({ html: page('legacy-font-facetag.html') })).r).toBe('fail');
  });
  it('does not confuse the real Unicode "Kartika" font with the legacy "Karthika" one', () => {
    const html = '<html><head><style>body { font-family: Kartika, sans-serif; }</style></head></html>';
    expect(run('content.legacy_font', ctx({ html })).r).toBe('pass');
  });
  it('passes on an ordinary page', () => {
    expect(run('content.legacy_font', ctx({ html: page('ok-minimal.html') })).r).toBe('pass');
  });
});

describe('content.obsolete_tech', () => {
  it('is n/a without page content', () => {
    expect(run('content.obsolete_tech', ctx()).r).toBe('na');
  });
  it('fires on a <marquee>/Flash page', () => {
    expect(run('content.obsolete_tech', ctx({ html: page('marquee-flash.html') })).r).toBe('fail');
  });
  it('passes on an ordinary page', () => {
    expect(run('content.obsolete_tech', ctx({ html: page('ok-minimal.html') })).r).toBe('pass');
  });
});

describe('content.best_viewed', () => {
  it('is n/a without page content', () => {
    expect(run('content.best_viewed', ctx()).r).toBe('na');
  });
  it('fires on a "best viewed in Internet Explorer" page', () => {
    expect(run('content.best_viewed', ctx({ html: page('best-viewed-ie.html') })).r).toBe('fail');
  });
  it('passes on an ordinary page', () => {
    expect(run('content.best_viewed', ctx({ html: page('ok-minimal.html') })).r).toBe('pass');
  });
});

describe('content.malayalam', () => {
  it('applies to a citizen-facing kind like department', () => {
    expect(appliesTo('content.malayalam', site({ kind: 'department' }))).toBe(true);
  });
  it('applies to a grama panchayat', () => {
    expect(appliesTo('content.malayalam', site({ kind: 'grama_panchayat' }))).toBe(true);
  });
  it('does not apply to a non-citizen-facing kind like board', () => {
    expect(appliesTo('content.malayalam', site({ kind: 'board' }))).toBe(false);
  });
  it('passes via the toggle short-circuit even when the surrounding page is English-only (ratio alone would fail)', () => {
    // The anchor text itself is English ("Malayalam") and the rest of the page is English too, so
    // only the /ml/ href toggle pattern -- not the ratio -- can be what makes this pass.
    const html = '<html><body><a href="/ml/">Malayalam</a><p>This site is otherwise entirely in English.</p></body></html>';
    expect(run('content.malayalam', ctx({ html })).r).toBe('pass');
  });
  it('passes when the Malayalam ratio is above the threshold', () => {
    expect(run('content.malayalam', ctx({ html: page('lang-en-but-malayalam.html') })).r).toBe('pass');
  });
  it('fails when English-only with no toggle and a low Malayalam ratio', () => {
    expect(run('content.malayalam', ctx({ html: page('ok-minimal.html') })).r).toBe('fail');
  });
  it('fails at a ratio just under the 0.05 threshold', () => {
    expect(run('content.malayalam', ctx({ malayalamRatio: 0.04 })).r).toBe('fail');
  });
  it('passes at a ratio just over the 0.05 threshold', () => {
    expect(run('content.malayalam', ctx({ malayalamRatio: 0.06 })).r).toBe('pass');
  });
  it('is n/a when there is nothing at all to measure', () => {
    expect(run('content.malayalam', ctx()).r).toBe('na');
  });
});

describe('content.title', () => {
  it('is n/a without page content', () => {
    expect(run('content.title', ctx()).r).toBe('na');
  });
  it('fails when the title is missing', () => {
    expect(run('content.title', ctx({ html: '<html><head></head></html>' })).r).toBe('fail');
  });
  it('fails on a generic title like "Home"', () => {
    expect(run('content.title', ctx({ html: '<html><head><title>Home</title></head></html>' })).r).toBe('fail');
  });
  it('passes on a real, descriptive title', () => {
    expect(run('content.title', ctx({ html: page('ok-minimal.html') })).r).toBe('pass');
  });
});

describe('content.meta_desc', () => {
  it('is n/a without page content', () => {
    expect(run('content.meta_desc', ctx()).r).toBe('na');
  });
  it('fails when missing', () => {
    expect(run('content.meta_desc', ctx({ html: '<html><head></head></html>' })).r).toBe('fail');
  });
  it('passes when present and non-empty', () => {
    const html = '<html><head><meta name="description" content="The official department site."></head></html>';
    expect(run('content.meta_desc', ctx({ html })).r).toBe('pass');
  });
});

describe('content.favicon', () => {
  it('is n/a without page content', () => {
    expect(run('content.favicon', ctx()).r).toBe('na');
  });
  it('fails when no icon link is present', () => {
    expect(run('content.favicon', ctx({ html: page('gigw-none.html') })).r).toBe('fail');
  });
  it('passes when an icon link is present', () => {
    const html = '<html><head><link rel="icon" href="/favicon.ico"></head></html>';
    expect(run('content.favicon', ctx({ html })).r).toBe('pass');
  });
});
