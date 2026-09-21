import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mergeErrorResult, mergeLightResult, mergeRunResult, readResult, writeJsonAtomic, writeResult, type DeepResult } from '../src/store.js';
import type { LightResult } from '../src/light.js';
import type { ScoreOutcome } from '../src/score.js';

function deepResult(overrides: Partial<DeepResult> = {}): DeepResult {
  return {
    at: '2026-09-20T00:00:00.000Z',
    run: '1',
    vantage: 'gh-us',
    lighthouse: null,
    axe: { critical: 0, serious: 0, moderate: 0, minor: 0 },
    crawl: { pages: 0, pdfs: 0, broken: 0 },
    tech: { cms: null, server: null, jquery: null },
    checks: [],
    screenshot: null,
    ...overrides,
  };
}

function scoreOutcome(overrides: Partial<ScoreOutcome> = {}): ScoreOutcome {
  return {
    score: { overall: 72, security: 60, accessibility: 80, content: 70, gigw: 70, performance: 75, identity: 90 },
    status: 'needs-work',
    issues: [{ id: 'sec.hsts', sev: 'M' }],
    ...overrides,
  };
}

function light(overrides: Partial<LightResult> = {}): LightResult {
  return {
    at: '2026-09-21T00:00:00.000Z',
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

describe('store', () => {
  let dataDir: string;

  beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), 'kww-store-test-'));
  });

  afterEach(() => {
    rmSync(dataDir, { recursive: true, force: true });
  });

  it('mergeLightResult creates a fresh unaudited record for a site never seen before', () => {
    const result = mergeLightResult(null, { id: 'x', url: 'https://x.kerala.gov.in' }, light(), { vantage: 'gh-us', today: '2026-09-21' });
    expect(result.status).toBe('unaudited');
    expect(result.light?.vantage).toBe('gh-us');
    expect(result.light?.suspect).toBe(false);
    expect(result.history).toEqual([{ d: '2026-09-21', up: true, score: null }]);
  });

  it('mergeLightResult carries forward score/deep/issues from an existing deep-audited record', () => {
    const audited = mergeRunResult(null, { id: 'x', url: 'https://x.kerala.gov.in' }, light(), deepResult(), scoreOutcome(), {
      vantage: 'gh-us',
      today: '2026-09-20',
    });

    const updated = mergeLightResult(audited, { id: 'x', url: 'https://x.kerala.gov.in' }, light(), { vantage: 'gh-us', today: '2026-09-21' });

    expect(updated.deep).toEqual(deepResult());
    expect(updated.score?.overall).toBe(72);
    expect(updated.issues).toEqual([{ id: 'sec.hsts', sev: 'M' }]);
    expect(updated.history).toHaveLength(2);
    expect(updated.history[0].d).toBe('2026-09-21');
  });

  it('keeps a deep-audit-derived status when a fresh light check comes back healthy', () => {
    const audited = mergeRunResult(null, { id: 'x', url: 'https://x.kerala.gov.in' }, light(), deepResult(), scoreOutcome({ status: 'needs-work' }), {
      vantage: 'gh-us',
      today: '2026-09-19',
    });

    const updated = mergeLightResult(audited, { id: 'x', url: 'https://x.kerala.gov.in' }, light(), { vantage: 'gh-us', today: '2026-09-21' });

    expect(updated.status).toBe('needs-work');
  });

  it('writeResult then readResult round-trips exactly, including through the atomic rename', () => {
    const result = mergeLightResult(null, { id: 'x', url: 'https://x.kerala.gov.in' }, light(), { vantage: 'gh-us', today: '2026-09-21' });
    writeResult(dataDir, result);
    expect(readResult(dataDir, 'x')).toEqual(result);
  });

  it('readResult returns null for a site with no stored result yet', () => {
    expect(readResult(dataDir, 'nope')).toBeNull();
  });

  it('writeJsonAtomic never leaves a temp file behind', () => {
    const path = join(dataDir, 'summary.json');
    writeJsonAtomic(path, { hello: 'world' });
    expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual({ hello: 'world' });
    expect(readdirSync(dataDir)).toEqual(['summary.json']);
  });

  describe('mergeRunResult', () => {
    it('creates a fresh record from a completed deep audit with no prior history', () => {
      const result = mergeRunResult(null, { id: 'x', url: 'https://x.kerala.gov.in' }, light(), deepResult(), scoreOutcome(), {
        vantage: 'gh-us',
        today: '2026-09-21',
      });
      expect(result.status).toBe('needs-work');
      expect(result.score?.overall).toBe(72);
      expect(result.deep).toEqual(deepResult());
      expect(result.light?.suspect).toBe(false);
      expect(result.history).toEqual([{ d: '2026-09-21', up: true, score: 72 }]);
    });

    it('marks history down when the deep audit itself reports a broken-class status', () => {
      const result = mergeRunResult(null, { id: 'x', url: 'https://x.kerala.gov.in' }, light(), deepResult(), scoreOutcome({ status: 'down', score: null }), {
        vantage: 'gh-us',
        today: '2026-09-21',
      });
      expect(result.history).toEqual([{ d: '2026-09-21', up: false, score: null }]);
    });

    it('appends to, rather than replaces, an existing history', () => {
      const first = mergeRunResult(null, { id: 'x', url: 'https://x.kerala.gov.in' }, light(), deepResult(), scoreOutcome(), {
        vantage: 'gh-us',
        today: '2026-09-20',
      });
      const second = mergeRunResult(first, { id: 'x', url: 'https://x.kerala.gov.in' }, light(), deepResult(), scoreOutcome({ score: { ...scoreOutcome().score!, overall: 90 } }), {
        vantage: 'gh-us',
        today: '2026-09-21',
      });
      expect(second.history).toEqual([
        { d: '2026-09-21', up: true, score: 90 },
        { d: '2026-09-20', up: true, score: 72 },
      ]);
    });
  });

  describe('mergeErrorResult', () => {
    const opts = { vantage: 'gh-us', today: '2026-09-21', runId: '7', now: new Date('2026-09-21T00:00:00.000Z') };

    it('records the error message and marks the record unaudited when there is no prior result', () => {
      const result = mergeErrorResult(null, { id: 'x', url: 'https://x.kerala.gov.in' }, light(), new Error('navigation timeout'), opts);
      expect(result.status).toBe('unaudited');
      expect(result.deep?.error).toBe('navigation timeout');
      expect(result.score).toBeNull();
      expect(result.issues).toEqual([]);
      expect(result.history).toEqual([{ d: '2026-09-21', up: true, score: null }]);
    });

    it('leaves a healthy previous status untouched by a failed deep audit', () => {
      const previous = mergeRunResult(null, { id: 'x', url: 'https://x.kerala.gov.in' }, light(), deepResult(), scoreOutcome({ status: 'healthy' }), {
        vantage: 'gh-us',
        today: '2026-09-20',
      });
      const result = mergeErrorResult(previous, { id: 'x', url: 'https://x.kerala.gov.in' }, light(), new Error('boom'), opts);
      expect(result.status).toBe('healthy'); // a half-finished audit is not evidence the site got worse
      expect(result.score?.overall).toBe(72); // the previous score is carried forward, not cleared
      expect(result.issues).toEqual([{ id: 'sec.hsts', sev: 'M' }]);
      expect(result.deep?.error).toBe('boom');
      expect(result.history).toEqual([
        { d: '2026-09-21', up: true, score: 72 }, // 'up' reflects the carried-forward status, not the error
        { d: '2026-09-20', up: true, score: 72 },
      ]);
    });

    it('marks history down when the carried-forward status was already broken-class', () => {
      const previous = mergeRunResult(null, { id: 'x', url: 'https://x.kerala.gov.in' }, light(), deepResult(), scoreOutcome({ status: 'down', score: null }), {
        vantage: 'gh-us',
        today: '2026-09-20',
      });
      const result = mergeErrorResult(previous, { id: 'x', url: 'https://x.kerala.gov.in' }, light(), new Error('boom'), opts);
      expect(result.status).toBe('down');
      expect(result.history[0]).toEqual({ d: '2026-09-21', up: false, score: null });
    });

    it('carries forward the previous screenshot rather than clearing it', () => {
      const previous = mergeRunResult(
        null,
        { id: 'x', url: 'https://x.kerala.gov.in' },
        light(),
        deepResult({ screenshot: { desktop: 'd.webp', mobile: 'm.webp', phash: 'abcd' } }),
        scoreOutcome(),
        { vantage: 'gh-us', today: '2026-09-20' },
      );
      const result = mergeErrorResult(previous, { id: 'x', url: 'https://x.kerala.gov.in' }, light(), new Error('boom'), opts);
      expect(result.deep?.screenshot).toEqual({ desktop: 'd.webp', mobile: 'm.webp', phash: 'abcd' });
    });

    it('stringifies a non-Error throw rather than losing it', () => {
      const result = mergeErrorResult(null, { id: 'x', url: 'https://x.kerala.gov.in' }, light(), 'plain string rejection', opts);
      expect(result.deep?.error).toBe('plain string rejection');
    });
  });
});
