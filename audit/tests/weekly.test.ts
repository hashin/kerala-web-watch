import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { computeSummary } from '../src/summary.js';
import type { Result } from '../src/store.js';
import type { Registry, Site } from '../src/types.js';
import { buildWeekSnapshot, isoWeek, istWeek, readPreviousWeek, writeWeekSnapshot, type WeekSnapshot } from '../src/weekly.js';

function site(id: string, overrides: Partial<Site> = {}): Site {
  return {
    id, name: id, url: `https://${id}.kerala.gov.in`, aliases: [], tier: 'directorate', kind: 'directorate',
    department: 'gad', org_parent: null, scope: 'state', district: 'kollam', place: 'kollam', lsg_type: null,
    platform: null, priority: 2, tags: [], source: 'test', added: '2026-01-01', lifecycle: 'active', notes: '',
    ...overrides,
  } as Site;
}
function registryOf(sites: Site[]): Registry {
  return {
    sites, departments: [], districts: [], places: [], kinds: [], ministers: [], ignore: [],
    byId: new Map(sites.map((s) => [s.id, s])), byDepartment: new Map(), byDistrict: new Map(), byMinistry: new Map(),
  };
}
function result(id: string, status: Result['status']): Result {
  return { id, url: `https://${id}.kerala.gov.in`, light: null, deep: null, score: null, status, issues: [], history: [], deep_bump: false } as Result;
}
const NOW = new Date('2026-09-27T17:00:00Z'); // Sunday 22:30 IST, week 39

function snapshotOf(registry: Registry, results: Result[], previous: WeekSnapshot | null, now = NOW) {
  return buildWeekSnapshot(registry, computeSummary(registry, results, { now, vantages: ['gh-us'] }), previous, now);
}

describe('isoWeek', () => {
  it.each([
    ['2026-09-27', '2026-W39', '2026-09-21', '2026-09-27'], // Sunday closes the week
    ['2026-09-28', '2026-W40', '2026-09-28', '2026-10-04'], // Monday opens the next
    ['2021-01-03', '2020-W53', '2020-12-28', '2021-01-03'], // 53-week year
    ['2024-12-30', '2025-W01', '2024-12-30', '2025-01-05'], // week belongs to the year of its Thursday
  ])('puts %s in %s', (date, week, from, to) => {
    expect(isoWeek(new Date(`${date}T12:00:00Z`))).toEqual({ week, from, to });
  });
});

describe('istWeek', () => {
  it('still counts Sunday 22:30 IST as week 39', () => {
    expect(istWeek(new Date('2026-09-27T17:00:00Z')).week).toBe('2026-W39');
  });
  it('counts 00:30 Monday IST (19:00 Sunday UTC) as already week 40', () => {
    expect(istWeek(new Date('2026-09-27T19:00:00Z')).week).toBe('2026-W40');
  });
});

describe('buildWeekSnapshot', () => {
  const reg = registryOf([site('a'), site('b'), site('c'), site('d', { district: 'kottayam' })]);

  it('counts every status, including hyphenated needs-work, and the broken ids', () => {
    const snap = snapshotOf(reg, [result('a', 'down'), result('b', 'broken'), result('c', 'needs-work')], null);
    expect(snap.counts).toEqual({ down: 1, hijacked: 0, broken: 1, poor: 0, unverifiable: 0, unaudited: 1, 'needs-work': 1, healthy: 0 });
    expect(snap.broken_ids).toEqual(['a', 'b']);
    expect(snap.districts.kollam).toEqual({ sites: 3, broken: 2, median: null });
  });

  it('has no broke/fixed lists on the very first snapshot', () => {
    const snap = snapshotOf(reg, [result('a', 'down')], null);
    expect([snap.broke, snap.fixed]).toEqual([[], []]);
  });

  it('reports sites that broke and sites that were fixed against the previous snapshot', () => {
    const last = snapshotOf(reg, [result('a', 'down'), result('b', 'healthy')], null, new Date('2026-09-20T17:00:00Z'));
    const snap = snapshotOf(reg, [result('a', 'healthy'), result('b', 'down'), result('c', 'down')], last);
    expect(snap.broke).toEqual(['b', 'c']);
    expect(snap.fixed).toEqual(['a']);
  });

  it('does not report a site as broke when it was only registered after the previous snapshot', () => {
    const last = snapshotOf(reg, [], null, new Date('2026-09-20T17:00:00Z'));
    const withNew = registryOf([...reg.sites, site('new', { added: '2026-09-25' })]);
    const snap = snapshotOf(withNew, [result('new', 'down'), result('a', 'down')], { ...last, to: '2026-09-20' });
    expect(snap.broke).toEqual(['a']);
  });

  it('does not report a site removed from the registry as fixed', () => {
    const last = snapshotOf(reg, [result('a', 'down'), result('b', 'down')], null, new Date('2026-09-20T17:00:00Z'));
    const shrunk = registryOf(reg.sites.filter((s) => s.id !== 'b'));
    expect(snapshotOf(shrunk, [result('a', 'down')], last).fixed).toEqual([]);
  });
});

describe('snapshot files', () => {
  const dirs: string[] = [];
  afterEach(() => dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })));
  const tmp = () => { const d = mkdtempSync(join(tmpdir(), 'weekly-')); dirs.push(d); return d; };
  const stub = (week: string): WeekSnapshot => ({ week, from: '', to: '', counts: {} as WeekSnapshot['counts'], deep_audited: 0, districts: {}, ministries: {}, departments: {}, broken_ids: [], broke: [], fixed: [] });

  it('writes to weekly/<week>.json', () => {
    const dir = tmp();
    const path = writeWeekSnapshot(dir, stub('2026-W39'));
    expect(path).toBe(join(dir, 'weekly', '2026-W39.json'));
    expect(JSON.parse(readFileSync(path, 'utf8')).week).toBe('2026-W39');
  });

  it('returns null when no weekly directory exists yet', () => {
    expect(readPreviousWeek(tmp(), '2026-W39')).toBeNull();
  });

  it('reads the newest snapshot strictly before the given week, ignoring itself and later weeks', () => {
    const dir = tmp();
    for (const w of ['2026-W37', '2026-W38', '2026-W39', '2026-W40']) writeWeekSnapshot(dir, stub(w));
    expect(readPreviousWeek(dir, '2026-W39')?.week).toBe('2026-W38');
    expect(readPreviousWeek(dir, '2026-W37')).toBeNull();
  });
});
