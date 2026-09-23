import { describe, expect, it } from 'vitest';
import { allSitesRecords, buildTransitionFeed, siteApiRecord, sitesToCsv } from '../src/lib/api';
import type { Result, SiteView } from '../src/lib/data';

let nextId = 0;

function result(overrides: Partial<Result> = {}): Result {
  nextId++;
  return {
    id: `site-${nextId}`,
    url: `https://site-${nextId}.kerala.gov.in`,
    light: null,
    deep: null,
    score: null,
    status: 'unaudited',
    issues: [],
    history: [],
    deep_bump: false,
    ...overrides,
  };
}

function site(overrides: Partial<SiteView> = {}): SiteView {
  const r = overrides.result !== undefined ? overrides.result : result({ status: overrides.status ?? 'unaudited' });
  return {
    id: r?.id ?? `site-${++nextId}`,
    name: 'Test Site',
    url: r?.url ?? 'https://test.kerala.gov.in',
    aliases: [],
    tier: 'agency',
    kind: 'agency',
    department: 'gad',
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
    status: r?.status ?? 'unaudited',
    result: r,
    ...overrides,
  };
}

const scoreOf = (overall: number) => ({ overall, security: overall, accessibility: overall, content: overall, gigw: overall, performance: overall, identity: overall });

describe('sitesToCsv', () => {
  it('writes a header row followed by one row per site with the registry, status and score fields', () => {
    const s = site({ id: 'a', name: 'Alpha', url: 'https://test.kerala.gov.in', district: 'kollam', department: 'gad', kind: 'directorate', platform: null, status: 'healthy', result: result({ id: 'a', status: 'healthy', score: scoreOf(85) }) });
    const csv = sitesToCsv([s]);
    const [header, row] = csv.trim().split('\n');
    expect(header).toBe('id,name,url,district,department,kind,platform,status,score');
    expect(row).toBe('a,Alpha,https://test.kerala.gov.in,kollam,gad,directorate,,healthy,85');
  });

  it('quotes a field containing a comma and escapes embedded quotes', () => {
    const s = site({ id: 'a', name: 'Panchayat, "Alpha"' });
    const csv = sitesToCsv([s]);
    const row = csv.trim().split('\n')[1];
    expect(row).toContain('"Panchayat, ""Alpha"""');
  });

  it('leaves score blank for a site with no result score yet', () => {
    const s = site({ id: 'a', status: 'unaudited', result: result({ id: 'a', status: 'unaudited', score: null }) });
    const csv = sitesToCsv([s]);
    const row = csv.trim().split('\n')[1];
    expect(row.endsWith(',unaudited,')).toBe(true);
  });
});

describe('siteApiRecord', () => {
  it('keeps each issue\'s evidence string for a single-site download', () => {
    const s = site({ id: 'a', result: result({ id: 'a', status: 'poor', issues: [{ id: 'sec.hsts', sev: 'M', ev: 'no Strict-Transport-Security header' }] }) });
    const record = siteApiRecord(s);
    expect(record.issues).toEqual([{ id: 'sec.hsts', sev: 'M', ev: 'no Strict-Transport-Security header' }]);
  });
});

describe('allSitesRecords', () => {
  it('strips the evidence string from every issue and check while keeping their id and outcome', () => {
    const s = site({
      id: 'a',
      result: result({
        id: 'a',
        status: 'poor',
        issues: [{ id: 'sec.hsts', sev: 'M', ev: 'no Strict-Transport-Security header' }],
        deep: {
          at: '2026-09-20T00:00:00Z',
          run: 'r1',
          vantage: 'gh-us',
          lighthouse: null,
          axe: { critical: 0, serious: 0, moderate: 0, minor: 0 },
          crawl: { pages: 1, pdfs: 0, broken: 0 },
          tech: { cms: null, server: null, jquery: null },
          checks: [{ id: 'sec.hsts', r: 'fail', ev: 'no Strict-Transport-Security header' }],
          screenshot: null,
          outlinks: [],
        },
      }),
    });
    const [record] = allSitesRecords([s]);
    expect(record.issues).toEqual([{ id: 'sec.hsts', sev: 'M' }]);
    expect(record.deep?.checks).toEqual([{ id: 'sec.hsts', r: 'fail' }]);
    expect((record.issues[0] as Record<string, unknown>).ev).toBeUndefined();
  });

  it('leaves deep null for a site that has never been deep-audited', () => {
    const s = site({ id: 'a', result: result({ id: 'a', status: 'unaudited', deep: null }) });
    const [record] = allSitesRecords([s]);
    expect(record.deep).toBeNull();
  });
});

describe('buildTransitionFeed', () => {
  it('produces one Atom entry per transition, linking to the site page', () => {
    const xml = buildTransitionFeed({
      title: 'Kerala Web Watch — sites that went down',
      description: 'The most recent sites to go down.',
      feedPath: '/feeds/broken.xml',
      updated: '2026-09-21T00:00:00Z',
      transitions: [{ id: 'a', name: 'Alpha', since: '2026-09-20' }],
    });
    expect(xml).toContain('<?xml version="1.0" encoding="utf-8"?>');
    expect(xml).toContain('<title>Alpha</title>');
    expect(xml).toContain('<link href="https://govwebsite.hashin.me/sites/a/" />');
    expect(xml).toContain('<updated>2026-09-20T00:00:00Z</updated>');
    expect((xml.match(/<entry>/g) ?? []).length).toBe(1);
  });

  it('escapes a site name containing XML-significant characters', () => {
    const xml = buildTransitionFeed({
      title: 'Feed',
      description: 'Desc',
      feedPath: '/feeds/broken.xml',
      updated: '2026-09-21T00:00:00Z',
      transitions: [{ id: 'a', name: 'R&D <Cell>', since: '2026-09-20' }],
    });
    expect(xml).toContain('<title>R&amp;D &lt;Cell&gt;</title>');
  });

  it('produces a feed with no entries when there are no transitions', () => {
    const xml = buildTransitionFeed({ title: 'Feed', description: 'Desc', feedPath: '/feeds/fixed.xml', updated: '2026-09-21T00:00:00Z', transitions: [] });
    expect(xml).not.toContain('<entry>');
    expect(xml).toContain('</feed>');
  });
});
