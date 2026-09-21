import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mergeAll } from '../src/merge.js';
import { mergeLightResult, mergeRunResult, readResult, writeResult, type DeepResult, type Result } from '../src/store.js';
import type { Registry, Site } from '../src/types.js';
import type { LightResult } from '../src/light.js';
import type { ScoreOutcome } from '../src/score.js';

function site(overrides: Partial<Site> = {}): Site {
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
  return { sites, departments: [], districts: [], places: [], kinds: [], ministers: [], ignore: [], byId, byDepartment: new Map(), byDistrict: new Map(), byMinistry: new Map() };
}

function light(overrides: Partial<LightResult> = {}): LightResult {
  return {
    at: '2026-09-21T05:00:00.000Z',
    status_class: 'ok',
    dns: true,
    status: 200,
    final_url: 'https://x.kerala.gov.in',
    redirects: [],
    ttfb_ms: 100,
    title: 'X',
    byte_size: 1000,
    tls: { valid: true, protocol: 'TLSv1.3', expires: null, days_left: null, issuer: null },
    headers: { hsts: true, csp: false, xfo: true, xcto: true, referrer: false, server: null },
    content_hash: 'abc',
    http_redirects_to_https: true,
    geo_block_suspect: false,
    domain: 'kerala.gov.in',
    final_domain: 'kerala.gov.in',
    ...overrides,
  };
}

function deepResult(overrides: Partial<DeepResult> = {}): DeepResult {
  return {
    at: '2026-09-21T03:00:00.000Z',
    run: '1',
    vantage: 'gh-us',
    lighthouse: null,
    axe: { critical: 0, serious: 0, moderate: 0, minor: 0 },
    crawl: { pages: 0, pdfs: 0, broken: 0 },
    tech: { cms: null, server: null, jquery: null },
    checks: [],
    screenshot: null,
    outlinks: [],
    ...overrides,
  };
}

function scoreOutcome(overrides: Partial<ScoreOutcome> = {}): ScoreOutcome {
  return { score: { overall: 72, security: 60, accessibility: 80, content: 70, gigw: 70, performance: 75, identity: 90 }, status: 'needs-work', issues: [{ id: 'sec.hsts', sev: 'M' }], ...overrides };
}

function writeFreshRun(inDir: string, id: string, result: Result): void {
  const resultsDir = join(inDir, 'results');
  if (!existsSync(resultsDir)) mkdirSync(resultsDir, { recursive: true });
  writeFileSync(join(resultsDir, `${id}.json`), JSON.stringify(result));
}

describe('mergeAll (WP3.6 merge)', () => {
  let inDir: string;
  let dataDir: string;

  beforeEach(() => {
    inDir = mkdtempSync(join(tmpdir(), 'kww-merge-in-'));
    dataDir = mkdtempSync(join(tmpdir(), 'kww-merge-data-'));
  });

  afterEach(() => {
    rmSync(inDir, { recursive: true, force: true });
    rmSync(dataDir, { recursive: true, force: true });
  });

  it('folds a fresh run into data/, keeping the existing light check', () => {
    const registry = registryOf([site({ id: 'x' })]);
    writeResult(dataDir, mergeLightResult(null, { id: 'x', url: 'https://x.kerala.gov.in' }, light({ ttfb_ms: 42 }), { vantage: 'gh-us', today: '2026-09-20' }));
    writeFreshRun(inDir, 'x', mergeRunResult(null, { id: 'x', url: 'https://x.kerala.gov.in' }, light({ ttfb_ms: 999 }), deepResult(), scoreOutcome(), { vantage: 'gh-us', today: '2026-09-21' }));

    const report = mergeAll(inDir, dataDir, registry, { now: new Date('2026-09-21T06:00:00Z') });

    expect(report.sites).toEqual([{ id: 'x', status: 'needs-work', score: 72, screenshotCopied: false }]);
    const stored = readResult(dataDir, 'x')!;
    expect(stored.light?.ttfb_ms).toBe(42); // data/'s own light check, not the shard's stale one
    expect(stored.status).toBe('needs-work');
  });

  it('copies screenshot files into data/screenshots when the aHash moved past the threshold', () => {
    const registry = registryOf([site({ id: 'x' })]);
    const screenshotsInDir = join(inDir, 'screenshots');
    mkdirSync(screenshotsInDir, { recursive: true });
    writeFileSync(join(screenshotsInDir, '2026-09-21.webp'), 'desktop-bytes');
    writeFileSync(join(screenshotsInDir, '2026-09-21-m.webp'), 'mobile-bytes');

    writeFreshRun(
      inDir,
      'x',
      mergeRunResult(null, { id: 'x', url: 'https://x.kerala.gov.in' }, light(), deepResult({ screenshot: { desktop: '2026-09-21.webp', mobile: '2026-09-21-m.webp', phash: 'ffffffffffffffff' } }), scoreOutcome(), {
        vantage: 'gh-us',
        today: '2026-09-21',
      }),
    );

    const report = mergeAll(inDir, dataDir, registry, { now: new Date('2026-09-21T06:00:00Z') });

    expect(report.sites[0].screenshotCopied).toBe(true);
    expect(readFileSync(join(dataDir, 'screenshots', '2026-09-21.webp'), 'utf8')).toBe('desktop-bytes');
    expect(readFileSync(join(dataDir, 'screenshots', '2026-09-21-m.webp'), 'utf8')).toBe('mobile-bytes');
  });

  it('recomputes outlinks.json from every site’s current deep.outlinks', () => {
    const registry = registryOf([site({ id: 'x' })]);
    writeFreshRun(
      inDir,
      'x',
      mergeRunResult(null, { id: 'x', url: 'https://x.kerala.gov.in' }, light(), deepResult({ outlinks: [{ host: 'discovered.kerala.gov.in', count: 2, texts: ['Link'] }] }), scoreOutcome(), {
        vantage: 'gh-us',
        today: '2026-09-21',
      }),
    );

    mergeAll(inDir, dataDir, registry, { now: new Date('2026-09-21T06:00:00Z') });

    const outlinks = JSON.parse(readFileSync(join(dataDir, 'outlinks.json'), 'utf8'));
    expect(outlinks['discovered.kerala.gov.in']).toEqual({ count: 2, from: ['x'], texts: ['Link'] });
  });

  it('writes a summary.json reflecting the merged results', () => {
    const registry = registryOf([site({ id: 'x' })]);
    writeFreshRun(inDir, 'x', mergeRunResult(null, { id: 'x', url: 'https://x.kerala.gov.in' }, light(), deepResult(), scoreOutcome(), { vantage: 'gh-us', today: '2026-09-21' }));

    mergeAll(inDir, dataDir, registry, { now: new Date('2026-09-21T06:00:00Z') });

    const summary = JSON.parse(readFileSync(join(dataDir, 'summary.json'), 'utf8'));
    expect(summary.totals.needs_work).toBe(1);
    expect(summary.totals.deep_audited).toBe(1);
  });

  it('appends one batches.json entry per invocation, counting up within the same day', () => {
    const registry = registryOf([site({ id: 'x' })]);
    writeFreshRun(inDir, 'x', mergeRunResult(null, { id: 'x', url: 'https://x.kerala.gov.in' }, light(), deepResult(), scoreOutcome(), { vantage: 'gh-us', today: '2026-09-21' }));

    const first = mergeAll(inDir, dataDir, registry, { now: new Date('2026-09-21T06:00:00Z') });
    const second = mergeAll(inDir, dataDir, registry, { now: new Date('2026-09-21T18:00:00Z') });

    expect(first.batchId).toBe('20260921-1');
    expect(second.batchId).toBe('20260921-2');
  });

  it('is idempotent for the merged result content: merging the same out/ twice leaves data/results unchanged', () => {
    const registry = registryOf([site({ id: 'x' })]);
    writeResult(dataDir, mergeLightResult(null, { id: 'x', url: 'https://x.kerala.gov.in' }, light(), { vantage: 'gh-us', today: '2026-09-20' }));
    writeFreshRun(inDir, 'x', mergeRunResult(null, { id: 'x', url: 'https://x.kerala.gov.in' }, light(), deepResult(), scoreOutcome(), { vantage: 'gh-us', today: '2026-09-21' }));

    mergeAll(inDir, dataDir, registry, { now: new Date('2026-09-21T06:00:00Z') });
    const afterFirst = readResult(dataDir, 'x');
    mergeAll(inDir, dataDir, registry, { now: new Date('2026-09-21T18:00:00Z') });
    const afterSecond = readResult(dataDir, 'x');

    expect(afterSecond).toEqual(afterFirst);
  });
});
