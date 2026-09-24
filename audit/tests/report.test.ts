import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildReportData, computeDeltas, parseSnapshot, readPreviousSnapshot, renderReportMarkdown, snapshotOf, type ReportSnapshot } from '../src/report.js';
import { computeSummary } from '../src/summary.js';
import type { Result } from '../src/store.js';
import type { Registry, Site } from '../src/types.js';

function site(overrides: Partial<Site>): Site {
  return {
    id: 'x',
    name: 'X Directorate',
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
  return {
    sites,
    departments: [],
    districts: [],
    places: [],
    kinds: [],
    ministers: [],
    ignore: [],
    byId: new Map(sites.map((s) => [s.id, s])),
    byDepartment: new Map(),
    byDistrict: new Map(),
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

function scored(id: string, overall: number): Result {
  return result({
    id,
    status: 'healthy',
    score: { overall, security: overall, accessibility: overall, content: overall, gigw: overall, performance: overall, identity: overall },
  });
}

const snapshot = (over: Partial<ReportSnapshot> = {}): ReportSnapshot => ({
  sites: 100,
  deep_audited: 40,
  down: 2,
  hijacked: 0,
  broken: 3,
  unverifiable: 1,
  unaudited: 60,
  poor: 5,
  needs_work: 15,
  healthy: 20,
  median_score: 75,
  ...over,
});

describe('snapshotOf', () => {
  it('computes the median of only the sites that have a score', () => {
    const registry = registryOf([site({ id: 'a' }), site({ id: 'b' }), site({ id: 'c' })]);
    const results = [scored('a', 60), scored('b', 80)];
    const summary = computeSummary(registry, results, { now: new Date('2026-09-24'), vantages: ['gh-us'] });
    expect(snapshotOf(summary).median_score).toBe(70);
  });
});

describe('computeDeltas', () => {
  it('subtracts previous from current for every numeric field', () => {
    const deltas = computeDeltas(snapshot({ sites: 105, down: 1 }), snapshot({ sites: 100, down: 2 }));
    expect(deltas.sites).toBe(5);
    expect(deltas.down).toBe(-1);
  });

  it('returns null for median_score when either side has never had a deep audit', () => {
    const deltas = computeDeltas(snapshot({ median_score: 80 }), snapshot({ median_score: null }));
    expect(deltas.median_score).toBeNull();
  });
});

describe('buildReportData', () => {
  it('ranks best/worst from deep-audited sites only, excluding sites with no score', () => {
    const registry = registryOf([site({ id: 'a', name: 'A' }), site({ id: 'b', name: 'B' }), site({ id: 'c', name: 'C' })]);
    const results = [scored('a', 90), scored('b', 40)];
    const summary = computeSummary(registry, results, { now: new Date('2026-09-24'), vantages: ['gh-us'] });
    const data = buildReportData(registry, summary, null, '2026-09', new Date('2026-09-24'));

    expect(data.best.map((s) => s.id)).toEqual(['a', 'b']);
    expect(data.worst.map((s) => s.id)).toEqual(['b', 'a']);
    expect(data.best.some((s) => s.id === 'c')).toBe(false);
  });

  it('carries deltas through unchanged when a previous snapshot is given', () => {
    const registry = registryOf([site({ id: 'a' })]);
    const summary = computeSummary(registry, [], { now: new Date('2026-09-24'), vantages: ['gh-us'] });
    const data = buildReportData(registry, summary, snapshot({ sites: 0 }), '2026-09', new Date('2026-09-24'));
    expect(data.deltas?.sites).toBe(1);
  });
});

describe('renderReportMarkdown + parseSnapshot', () => {
  it('round-trips the snapshot through frontmatter unchanged', () => {
    const registry = registryOf([site({ id: 'a' })]);
    const results = [scored('a', 65)];
    const summary = computeSummary(registry, results, { now: new Date('2026-09-24'), vantages: ['gh-us'] });
    const data = buildReportData(registry, summary, null, '2026-09', new Date('2026-09-24T00:00:00Z'));
    const markdown = renderReportMarkdown(data);

    const parsed = parseSnapshot(markdown);
    expect(parsed).toEqual({ ...data.totals, median_score: data.median_score });
  });

  it('returns null for markdown with no frontmatter block', () => {
    expect(parseSnapshot('# Just a heading\n\nNo frontmatter here.')).toBeNull();
  });
});

describe('readPreviousSnapshot', () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  it('reads the chronologically previous month, not just any earlier file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'kww-report-'));
    dirs.push(dir);
    const jan = renderReportMarkdown(
      buildReportData(registryOf([]), computeSummary(registryOf([]), [], { now: new Date('2026-01-01'), vantages: ['gh-us'] }), null, '2026-01', new Date('2026-01-01')),
    );
    writeFileSync(join(dir, '2026-01.md'), jan);
    writeFileSync(join(dir, '2026-02.md'), jan.replace('sites: 0', 'sites: 5'));

    const previous = readPreviousSnapshot(dir, '2026-03');
    expect(previous?.sites).toBe(5);
  });

  it('returns null when the reports directory does not exist yet', () => {
    expect(readPreviousSnapshot('/nonexistent/kww-reports-dir', '2026-01')).toBeNull();
  });
});
