import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mergeLightResult, readResult, writeJsonAtomic, writeResult } from '../src/store.js';
import type { LightResult } from '../src/light.js';

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

  it('mergeLightResult carries forward score/deep/issues from an existing record', () => {
    const deepAudited = mergeLightResult(null, { id: 'x', url: 'https://x.kerala.gov.in' }, light(), { vantage: 'gh-us', today: '2026-09-20' });
    // Phase 3 hasn't shipped a real deep-audit shape yet (score/deep/issues are typed as
    // always-null/empty for now -- see store.ts), so a cast is the only way to simulate "this
    // site already has a deep audit on file" ahead of that work.
    const existing = { ...deepAudited, deep: { checkedAt: '2026-09-20' }, score: 72, issues: [{ id: 'sec.no-hsts' }] } as unknown as typeof deepAudited;

    const updated = mergeLightResult(existing, { id: 'x', url: 'https://x.kerala.gov.in' }, light(), { vantage: 'gh-us', today: '2026-09-21' });

    expect(updated.deep).toEqual({ checkedAt: '2026-09-20' });
    expect(updated.score).toBe(72);
    expect(updated.issues).toEqual([{ id: 'sec.no-hsts' }]);
    expect(updated.history).toHaveLength(2);
    expect(updated.history[0].d).toBe('2026-09-21');
  });

  it('keeps a deep-audit-derived status when a fresh light check comes back healthy', () => {
    const base = mergeLightResult(null, { id: 'x', url: 'https://x.kerala.gov.in' }, light(), { vantage: 'gh-us', today: '2026-09-19' });
    const deepAudited = { ...base, deep: { checkedAt: '2026-09-19' }, status: 'needs-work' } as unknown as typeof base;

    const updated = mergeLightResult(deepAudited, { id: 'x', url: 'https://x.kerala.gov.in' }, light(), { vantage: 'gh-us', today: '2026-09-21' });

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
});
