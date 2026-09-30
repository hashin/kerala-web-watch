import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { computeActionReport, gradeFor } from '../src/actions.js';
import { CHECKS } from '../src/checks/registry.js';
import type { CheckId } from '../src/checks/types.js';
import type { LightResult } from '../src/light.js';
import type { Result, StoredLight } from '../src/store.js';
import type { Department, Registry, Site } from '../src/types.js';

function site(id: string, overrides: Partial<Site> = {}): Site {
  return {
    id, name: id, url: `https://${id}.kerala.gov.in`, aliases: [], tier: 'directorate', kind: 'directorate', department: 'gad', org_parent: null,
    scope: 'state', district: null, place: null, lsg_type: null, platform: null, priority: 2, tags: [], source: 't', added: '2026-01-01',
    lifecycle: 'active', notes: '', ...overrides,
  };
}

function registryOf(sites: Site[], departments: string[] = ['gad', 'empty']): Registry {
  return {
    sites, departments: departments.map((id) => ({ id }) as Department), districts: [], places: [], kinds: [], ministers: [], ignore: [],
    byId: new Map(sites.map((s) => [s.id, s])), byDepartment: new Map(), byDistrict: new Map(), byMinistry: new Map(),
  };
}

const light = (overrides: Partial<LightResult> = {}): StoredLight =>
  ({ at: '2026-09-30T00:00:00.000Z', status_class: 'ok', geo_block_suspect: false, tls: null, vantage: 'gh-us', suspect: false, ...overrides }) as StoredLight;

function result(id: string, overrides: Partial<Result> = {}): Result {
  return { id, url: `https://${id}.kerala.gov.in`, light: null, deep: null, score: null, status: 'unaudited', issues: [], history: [], deep_bump: false, ...overrides } as Result;
}

const deep = (checks: { id: CheckId; r: 'fail' | 'warn' | 'pass' }[]) =>
  ({ at: '2026-09-29T00:00:00.000Z', run: '1', vantage: 'gh-us', checks, outlinks: [] }) as unknown as Result['deep'];

const NOW = new Date('2026-09-30T12:00:00Z');

describe('gradeFor', () => {
  it.each([
    ['avail.parked', 1], ['avail.redirect_offsite', 1], ['sec.safe_browsing', 1], ['sec.injected_links', 1],
    ['avail.dns', 2], ['avail.under_construction', 2], ['sec.https', 2], ['sec.cert_valid', 2],
    ['sec.vuln_js', 3], ['avail.flapping', 3], ['sec.hsts', 4], ['content.malayalam', 4], ['sec.csp', 5], ['gigw.help', 5],
    ['perf.lighthouse', null], ['id.third_party', null], ['avail.geo_blocked', null],
  ] as [CheckId, number | null][])('grades a failed %s as %s', (id, grade) => {
    expect(gradeFor(id, 'fail')).toBe(grade);
  });

  it.each([['sec.vuln_js', 4], ['avail.parked', 4], ['sec.hsts', 5], ['sec.csp', 5]] as [CheckId, number][])(
    'grades a warn on %s one grade lower than its severity, never 1 or 2',
    (id, grade) => expect(gradeFor(id, 'warn')).toBe(grade),
  );

  it('grades passing and not-applicable outcomes as nothing', () => {
    expect(gradeFor('sec.injected_links', 'pass')).toBeNull();
    expect(gradeFor('sec.injected_links', 'na')).toBeNull();
  });

  it('spreads all 85 checks over grades 4/8/17/22/28 and 6 non-actions when failed', () => {
    const counts: Record<string, number> = {};
    for (const id of Object.keys(CHECKS) as CheckId[]) {
      const g = String(gradeFor(id, 'fail'));
      counts[g] = (counts[g] ?? 0) + 1;
    }
    expect(counts).toEqual({ '1': 4, '2': 8, '3': 17, '4': 22, '5': 28, null: 6 });
  });
});

describe('gradeFor edge cases', () => {
  it('grades a failed check whose status setting is unverifiable as nothing', () => {
    expect(gradeFor('avail.geo_blocked', 'fail')).toBeNull();
  });
});

describe('computeActionReport ordering and light evidence', () => {
  it('orders a site\'s actions by grade, then severity C before H, then check id', () => {
    const r = result('s', {
      status: 'needs-work',
      deep: deep([{ id: 'sec.https', r: 'fail' }, { id: 'sec.vuln_js', r: 'fail' }, { id: 'sec.hsts', r: 'fail' }, { id: 'content.malayalam', r: 'fail' }]),
      issues: [
        { id: 'sec.vuln_js', sev: 'H' }, { id: 'sec.https', sev: 'C' }, { id: 'sec.hsts', sev: 'M' }, { id: 'content.malayalam', sev: 'M' },
      ],
    });
    const out = computeActionReport(registryOf([site('s')]), [r], { now: NOW }).sites[0].actions.map((a) => a.check);
    expect(out).toEqual(['sec.https', 'sec.vuln_js', 'content.malayalam', 'sec.hsts']);
  });

  it('breaks a tie inside a bucket by site priority before name', () => {
    const reg = registryOf([site('a', { name: 'A', priority: 3 }), site('b', { name: 'B', priority: 1 })]);
    const out = computeActionReport(reg, [], { now: NOW }).sites.map((s) => s.id);
    expect(out).toEqual(['b', 'a']);
  });

  it('treats an issue missing from deep.checks as a fail, not a warn', () => {
    const r = result('s', { status: 'needs-work', deep: deep([]), issues: [{ id: 'sec.vuln_js', sev: 'H' }] });
    expect(computeActionReport(registryOf([site('s')]), [r], { now: NOW }).sites[0].actions[0].grade).toBe(3);
  });

  it('gives a light-only broken site a grade-2 action with the certificate expiry in its evidence', () => {
    const r = result('s', { status: 'broken', light: light({ tls: { valid: false, expires: '2026-01-01' } as LightResult['tls'] }) });
    const [a] = computeActionReport(registryOf([site('s')]), [r], { now: NOW }).sites[0].actions;
    expect(a.check).toBe('sec.cert_valid');
    expect(a.grade).toBe(2);
    expect(a.ev).toBe('Light check 2026-09-30T00:00:00.000Z: ok; certificate expiry 2026-01-01');
  });
});

describe('computeActionReport', () => {
  const reg = registryOf([
    site('compromised', { name: 'B compromised' }),
    site('downlight', { name: 'A down' }),
    site('duplicate', { name: 'C dup' }),
    site('tidy', { name: 'D tidy' }),
    site('geo', { name: 'E geo' }),
    site('never', { name: 'F never' }),
    site('lightonly', { name: 'G light only' }),
  ]);
  const results = [
    result('compromised', {
      status: 'needs-work',
      deep: deep([{ id: 'sec.injected_links', r: 'fail' }, { id: 'sec.hsts', r: 'fail' }]),
      issues: [{ id: 'sec.hsts', sev: 'M' }, { id: 'sec.injected_links', sev: 'C', ev: 'http://ww547.keralagov.in [parking-subdomain]' }],
    }),
    result('downlight', { status: 'down', light: light({ status_class: 'dns_fail' }) }),
    result('duplicate', {
      status: 'down', light: light({ status_class: 'dns_fail' }),
      deep: deep([{ id: 'avail.dns', r: 'fail' }]), issues: [{ id: 'avail.dns', sev: 'C', ev: 'no such host' }],
    }),
    result('tidy', { status: 'healthy', deep: deep([{ id: 'sec.hsts', r: 'pass' }]) }),
    result('geo', { status: 'unverifiable', light: light({ geo_block_suspect: true }) }),
    result('lightonly', { status: 'unaudited', light: light() }),
  ];
  const report = computeActionReport(reg, results, { now: NOW });
  const row = (id: string) => report.sites.find((s) => s.id === id)!;

  it('lists every registry site exactly once, including one with no result file', () => {
    expect(report.sites.map((s) => s.id).sort()).toEqual(['compromised', 'downlight', 'duplicate', 'geo', 'lightonly', 'never', 'tidy']);
    expect(row('never').bucket).toBe('unaudited');
    expect(row('never').actions).toEqual([]);
  });

  it('buckets a compromise site as grade 1 with its actions ordered most urgent first', () => {
    expect(row('compromised').bucket).toBe(1);
    expect(row('compromised').actions.map((a) => [a.check, a.grade, a.basis])).toEqual([['sec.injected_links', 1, 'deep'], ['sec.hsts', 4, 'deep']]);
    expect(row('compromised').actions[0].ev).toBe('http://ww547.keralagov.in [parking-subdomain]');
  });

  it('gives a down site with no deep audit one synthetic grade-2 light action carrying its status class', () => {
    expect(row('downlight').actions).toEqual([
      { check: 'avail.dns', grade: 2, sev: 'C', basis: 'light', observed: '2026-09-30T00:00:00.000Z', ev: 'Light check 2026-09-30T00:00:00.000Z: dns_fail' },
    ]);
  });

  it('does not add a synthetic action when the deep audit already carries the status-setting check', () => {
    expect(row('duplicate').actions).toHaveLength(1);
    expect(row('duplicate').actions[0].basis).toBe('deep');
  });

  it('separates clear, unverifiable and unaudited sites', () => {
    expect(row('tidy').bucket).toBe('clear');
    expect(row('geo').bucket).toBe('unverifiable');
    expect(row('lightonly').bucket).toBe('unaudited');
  });

  it('sorts by bucket, then by site name within a bucket', () => {
    expect(report.sites.map((s) => s.id)).toEqual(['compromised', 'downlight', 'duplicate', 'geo', 'never', 'lightonly', 'tidy']);
  });

  it('counts totals and per-department rollups, including a department with no sites', () => {
    expect(report.totals).toEqual({ 1: 1, 2: 2, 3: 0, 4: 0, 5: 0, unverifiable: 1, unaudited: 2, clear: 1 });
    expect(report.by_department.empty).toEqual({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, unverifiable: 0, unaudited: 0, clear: 0 });
    expect(Object.values(report.by_department.gad).reduce((a, b) => a + b, 0)).toBe(7);
  });

  it('refuses a grade-1 issue that has no evidence', () => {
    const bad = [result('compromised', { deep: deep([{ id: 'sec.injected_links', r: 'fail' }]), issues: [{ id: 'sec.injected_links', sev: 'C' }] })];
    expect(() => computeActionReport(registryOf([site('compromised')]), bad, { now: NOW })).toThrow('grade-1 action without evidence');
  });

  it('is deterministic: the same inputs and now give byte-identical JSON', () => {
    expect(JSON.stringify(computeActionReport(reg, results, { now: NOW }))).toBe(JSON.stringify(report));
    expect(report.generated).toBe('2026-09-30T12:00:00.000Z');
  });
});
