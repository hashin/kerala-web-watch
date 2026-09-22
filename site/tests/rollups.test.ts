import { describe, expect, it } from 'vitest';
import {
  countByStatus,
  failedCheckCounts,
  medianScore,
  percentBroken,
  platformWideIssues,
  scoreDelta,
} from '../src/lib/rollups';
import type { Result, SiteView, Status } from '../src/lib/data';
import type { HistoryEntry } from '../../audit/dist/history.js';
import type { CheckId } from '../../audit/dist/checks/types.js';

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

function scored(overall: number, status: Status = 'healthy'): SiteView {
  return site({ status, result: result({ status, score: { overall, security: overall, accessibility: overall, content: overall, gigw: overall, performance: overall, identity: overall } }) });
}

describe('countByStatus', () => {
  it('tallies each site once, under its own status', () => {
    const sites = [scored(90, 'healthy'), scored(90, 'healthy'), site({ status: 'down', result: result({ status: 'down' }) })];
    const counts = countByStatus(sites);
    expect(counts.healthy).toBe(2);
    expect(counts.down).toBe(1);
    expect(counts.broken).toBe(0);
  });

  it('returns zero for every status on an empty group, not a missing key', () => {
    const counts = countByStatus([]);
    expect(counts.healthy).toBe(0);
    expect(counts.unaudited).toBe(0);
  });
});

describe('medianScore', () => {
  it('is null for a group with no scored sites', () => {
    expect(medianScore([site(), site()])).toBeNull();
  });

  it('picks the middle value for an odd-sized group', () => {
    expect(medianScore([scored(40), scored(80), scored(60)])).toBe(60);
  });

  it('averages the two middle values for an even-sized group', () => {
    expect(medianScore([scored(40), scored(60)])).toBe(50);
  });

  it('ignores unscored sites mixed in with scored ones', () => {
    expect(medianScore([scored(50), site()])).toBe(50);
  });
});

describe('failedCheckCounts', () => {
  it('counts how many sites share each failing check, most common first', () => {
    const sites = [
      site({ result: result({ issues: [{ id: 'sec.hsts', sev: 'M' }, { id: 'gigw.sitemap', sev: 'M' }] }) }),
      site({ result: result({ issues: [{ id: 'sec.hsts', sev: 'M' }] }) }),
    ];
    const counts = failedCheckCounts(sites);
    expect(counts[0]).toEqual({ id: 'sec.hsts', count: 2 });
    expect(counts[1]).toEqual({ id: 'gigw.sitemap', count: 1 });
  });

  it('returns nothing for a group with no recorded issues', () => {
    expect(failedCheckCounts([site(), site()])).toEqual([]);
  });
});

describe('percentBroken', () => {
  it('is 0 for an empty group rather than dividing by zero', () => {
    expect(percentBroken([])).toBe(0);
  });

  it('counts down/hijacked/broken as broken, not poor or unaudited', () => {
    const sites = [
      site({ status: 'down', result: result({ status: 'down' }) }),
      site({ status: 'poor', result: result({ status: 'poor' }) }),
      site({ status: 'unaudited' }),
      site({ status: 'unaudited' }),
    ];
    expect(percentBroken(sites)).toBe(25);
  });
});

describe('platformWideIssues', () => {
  function auditedSite(issueIds: CheckId[]): SiteView {
    return site({
      result: result({
        deep: { at: '2026-09-22T00:00:00.000Z', run: 'r', vantage: 'gh-us', lighthouse: null, axe: { critical: 0, serious: 0, moderate: 0, minor: 0 }, crawl: { pages: 0, pdfs: 0, broken: 0 }, tech: { cms: null, server: null, jquery: null }, checks: [], screenshot: null, outlinks: [] },
        issues: issueIds.map((id) => ({ id, sev: 'M' as const })),
      }),
    });
  }

  it('is empty when nothing has been deep-audited yet', () => {
    expect(platformWideIssues([site(), site()])).toEqual([]);
  });

  it('includes a check that fails on at least the threshold fraction of audited sites', () => {
    const sites = [auditedSite(['gigw.sitemap']), auditedSite(['gigw.sitemap']), auditedSite([])];
    // 2 of 3 audited sites fail it = 67%, below the default 80% threshold.
    expect(platformWideIssues(sites)).toEqual([]);
    expect(platformWideIssues(sites, 0.6)).toEqual([{ id: 'gigw.sitemap', count: 2 }]);
  });

  it('excludes unaudited sites from the denominator', () => {
    const sites = [auditedSite(['gigw.sitemap']), site(), site(), site()];
    // 1 of 1 *audited* site fails it -- unaudited sites shouldn't dilute this to 25%.
    expect(platformWideIssues(sites)).toEqual([{ id: 'gigw.sitemap', count: 1 }]);
  });
});

describe('scoreDelta', () => {
  const now = new Date('2026-09-22T00:00:00.000Z');

  function historyOf(entries: HistoryEntry[]): SiteView {
    return site({ result: result({ history: entries }) });
  }

  it('is null when no site has both a past and a current score', () => {
    expect(scoreDelta([site(), site()], 30, now)).toBeNull();
  });

  it('is positive when the group improved over the window', () => {
    const improved = historyOf([
      { d: '2026-09-22', up: true, score: 80 },
      { d: '2026-08-23', up: true, score: 50 },
    ]);
    expect(scoreDelta([improved], 30, now)).toBe(30);
  });

  it('is negative when the group got worse', () => {
    const worsened = historyOf([
      { d: '2026-09-22', up: true, score: 50 },
      { d: '2026-08-23', up: true, score: 80 },
    ]);
    expect(scoreDelta([worsened], 30, now)).toBe(-30);
  });

  it('uses the entry closest to (not after) the cutoff when there is no exact match', () => {
    // cutoff = now - 30d = 2026-08-23. 08-20 is the newest entry still at/before it; 08-10 is
    // older still and should be ignored in favour of the closer one.
    const site1 = historyOf([
      { d: '2026-09-22', up: true, score: 70 },
      { d: '2026-08-20', up: true, score: 40 },
      { d: '2026-08-10', up: true, score: 10 },
    ]);
    expect(scoreDelta([site1], 30, now)).toBe(30);
  });
});
