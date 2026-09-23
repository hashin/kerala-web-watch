import { describe, expect, it } from 'vitest';
import { allTransitions, computeSummary } from '../src/summary.js';
import type { Result } from '../src/store.js';
import type { Registry, Site } from '../src/types.js';

function site(overrides: Partial<Site>): Site {
  return {
    id: 'x',
    name: 'X',
    url: 'https://x.kerala.gov.in',
    aliases: [],
    tier: 'directorate',
    kind: 'directorate',
    department: 'gad',
    org_parent: null,
    scope: 'state',
    district: 'thiruvananthapuram',
    place: 'thiruvananthapuram',
    lsg_type: null,
    platform: null,
    priority: 2,
    tags: [],
    source: 'test',
    added: '2026-09-21',
    lifecycle: 'active',
    notes: '',
    ...overrides,
  };
}

function registryOf(sites: Site[]): Registry {
  const byId = new Map(sites.map((s) => [s.id, s]));
  const byDepartment = new Map<string, Site[]>();
  const byDistrict = new Map<string, Site[]>();
  for (const s of sites) {
    if (!byDepartment.has(s.department)) byDepartment.set(s.department, []);
    byDepartment.get(s.department)!.push(s);
    if (s.district) {
      if (!byDistrict.has(s.district)) byDistrict.set(s.district, []);
      byDistrict.get(s.district)!.push(s);
    }
  }
  return {
    sites,
    departments: [],
    districts: [],
    places: [],
    kinds: [],
    ministers: [],
    ignore: [],
    byId,
    byDepartment,
    byDistrict,
    byMinistry: new Map(),
  };
}

function result(overrides: Partial<Result>): Result {
  return {
    id: 'x',
    url: 'https://x.kerala.gov.in',
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

describe('computeSummary', () => {
  it('counts every registry site into totals, including ones with no result yet', () => {
    const registry = registryOf([site({ id: 'a' }), site({ id: 'b' })]);
    const results = [result({ id: 'a', status: 'down' })];
    const summary = computeSummary(registry, results, { now: new Date('2026-09-21T00:00:00Z'), vantages: ['gh-us'] });
    expect(summary.totals.sites).toBe(2);
    expect(summary.totals.down).toBe(1);
    expect(summary.totals.unaudited).toBe(1);
  });

  it('groups by district with a broken count and a null median (no scores exist yet)', () => {
    const registry = registryOf([
      site({ id: 'a', district: 'kollam' }),
      site({ id: 'b', district: 'kollam' }),
      site({ id: 'c', district: 'kottayam' }),
    ]);
    const results = [result({ id: 'a', status: 'down' })];
    const summary = computeSummary(registry, results, { now: new Date('2026-09-21T00:00:00Z'), vantages: ['gh-us'] });
    expect(summary.by_district.kollam).toEqual({ sites: 2, broken: 1, median: null });
    expect(summary.by_district.kottayam).toEqual({ sites: 1, broken: 0, median: null });
  });

  it('computes a real median once scored results exist', () => {
    const registry = registryOf([site({ id: 'a', district: 'kollam' }), site({ id: 'b', district: 'kollam' }), site({ id: 'c', district: 'kollam' })]);
    const scoreOf = (overall: number) => ({ overall, security: overall, accessibility: overall, content: overall, gigw: overall, performance: overall, identity: overall });
    const results = [result({ id: 'a', status: 'healthy', score: scoreOf(80) }), result({ id: 'b', status: 'needs-work', score: scoreOf(60) }), result({ id: 'c', status: 'poor', score: scoreOf(40) })];
    const summary = computeSummary(registry, results, { now: new Date('2026-09-21T00:00:00Z'), vantages: ['gh-us'] });
    expect(summary.by_district.kollam.median).toBe(60);
  });

  it('carries the deep audit timestamp through to the site summary', () => {
    const registry = registryOf([site({ id: 'a' })]);
    const results = [result({ id: 'a', deep: { at: '2026-09-20T12:00:00Z', run: '1', vantage: 'gh-us', lighthouse: null, axe: { critical: 0, serious: 0, moderate: 0, minor: 0 }, crawl: { pages: 0, pdfs: 0, broken: 0 }, tech: { cms: null, server: null, jquery: null }, checks: [], screenshot: null, outlinks: [] } })];
    const summary = computeSummary(registry, results, { now: new Date('2026-09-21T00:00:00Z'), vantages: ['gh-us'] });
    expect(summary.sites.find((s) => s.id === 'a')?.deep_at).toBe('2026-09-20T12:00:00Z');
  });

  it('computes a coverage ETA from the remaining sites and the ADR-004 batch cap', () => {
    const registry = registryOf(Array.from({ length: 700 }, (_, i) => site({ id: `s${i}` })));
    const summary = computeSummary(registry, [], { now: new Date('2026-09-21T00:00:00Z'), vantages: ['gh-us'] });
    // batch = min(300, ceil(700/7)) = 100; remaining = 700; days = ceil(700/100) = 7
    expect(summary.coverage.eta).toBe('2026-09-28');
  });

  it('caps the daily batch at 300 once the uncapped share would exceed it', () => {
    const registry = registryOf(Array.from({ length: 2800 }, (_, i) => site({ id: `s${i}` })));
    const summary = computeSummary(registry, [], { now: new Date('2026-09-21T00:00:00Z'), vantages: ['gh-us'] });
    // uncapped batch = ceil(2800/7) = 400, but ADR-004 caps it at 300; days = ceil(2800/300) = 10
    expect(summary.coverage.eta).toBe('2026-10-01');
  });

  it('excludes sites with no district from by_district rather than grouping them under a null key', () => {
    const registry = registryOf([site({ id: 'a', district: 'kollam' }), site({ id: 'b', district: null })]);
    const summary = computeSummary(registry, [], { now: new Date('2026-09-21T00:00:00Z'), vantages: ['gh-us'] });
    expect(Object.keys(summary.by_district)).toEqual(['kollam']);
    expect(summary.by_district.kollam.sites).toBe(1);
  });

  it('reports no ETA once every site has a deep audit', () => {
    const registry = registryOf([site({ id: 'a' })]);
    const results = [result({ id: 'a', deep: {} as never })];
    const summary = computeSummary(registry, results, { now: new Date('2026-09-21T00:00:00Z'), vantages: ['gh-us'] });
    expect(summary.coverage.eta).toBeNull();
    expect(summary.coverage.deep_audited).toBe(1);
  });

  it('lists a site that just went down within the last 7 days under recent_broken', () => {
    const registry = registryOf([site({ id: 'a' })]);
    const results = [
      result({
        id: 'a',
        status: 'down',
        history: [
          { d: '2026-09-21', up: false, score: null },
          { d: '2026-09-20', up: false, score: null },
          { d: '2026-09-19', up: true, score: null },
        ],
      }),
    ];
    const summary = computeSummary(registry, results, { now: new Date('2026-09-21T00:00:00Z'), vantages: ['gh-us'] });
    expect(summary.recent_broken).toEqual([{ id: 'a', since: '2026-09-20' }]);
    expect(summary.recent_fixed).toEqual([]);
  });

  it('does not list a site with only one day of history as recently fixed or recently broken', () => {
    // A site's very first-ever light check has exactly one history entry. That entry trivially
    // "matches itself" with nothing before it to compare against -- it must not be reported as a
    // transition just because there's no older, differing day on record yet.
    const registry = registryOf([site({ id: 'a' }), site({ id: 'b' })]);
    const results = [
      result({ id: 'a', status: 'unaudited', history: [{ d: '2026-09-21', up: true, score: null }] }),
      result({ id: 'b', status: 'down', history: [{ d: '2026-09-21', up: false, score: null }] }),
    ];
    const summary = computeSummary(registry, results, { now: new Date('2026-09-21T00:00:00Z'), vantages: ['gh-us'] });
    expect(summary.recent_fixed).toEqual([]);
    expect(summary.recent_broken).toEqual([]);
  });

  it('does not list a long-standing down site as recently broken', () => {
    const registry = registryOf([site({ id: 'a' })]);
    const history = Array.from({ length: 30 }, (_, i) => ({ d: dayOffset(i), up: false, score: null }));
    const results = [result({ id: 'a', status: 'down', history })];
    const summary = computeSummary(registry, results, { now: new Date('2026-09-21T00:00:00Z'), vantages: ['gh-us'] });
    expect(summary.recent_broken).toEqual([]);
  });
});

describe('allTransitions', () => {
  it('reports a transition far outside the 7-day recent window, unlike recentTransitions', () => {
    const history = Array.from({ length: 30 }, (_, i) => ({ d: dayOffset(i), up: i < 20, score: null }));
    const results = [result({ id: 'a', status: 'down', history })];
    expect(allTransitions(results, false)).toEqual([{ id: 'a', since: dayOffset(19) }]);
  });

  it('sorts transitions newest first across multiple sites', () => {
    const results = [
      result({
        id: 'older',
        history: [
          { d: '2026-08-01', up: false, score: null },
          { d: '2026-07-31', up: true, score: null },
        ],
      }),
      result({
        id: 'newer',
        history: [
          { d: '2026-09-15', up: false, score: null },
          { d: '2026-09-14', up: true, score: null },
        ],
      }),
    ];
    expect(allTransitions(results, false)).toEqual([
      { id: 'newer', since: '2026-09-15' },
      { id: 'older', since: '2026-08-01' },
    ]);
  });

  it('omits a site whose history never actually changed value', () => {
    const results = [result({ id: 'a', history: [{ d: '2026-09-21', up: true, score: null }] })];
    expect(allTransitions(results, true)).toEqual([]);
    expect(allTransitions(results, false)).toEqual([]);
  });
});

function dayOffset(n: number): string {
  const date = new Date(Date.UTC(2026, 8, 21));
  date.setUTCDate(date.getUTCDate() - n);
  return date.toISOString().slice(0, 10);
}
