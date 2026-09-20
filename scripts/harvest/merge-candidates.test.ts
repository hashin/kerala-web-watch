import assert from 'node:assert/strict';
import { test } from 'node:test';
import { categorize, type FiledCandidate } from './merge-candidates.js';
import { dedupeKey } from './lib.js';

function candidate(overrides: Partial<FiledCandidate> & { url: string }): FiledCandidate {
  return {
    name: 'Test Candidate',
    source: 'test',
    source_page: 'https://example.gov.in/list',
    hints: {},
    fetched_at: '2026-09-20T00:00:00.000Z',
    file: 'test.yaml',
    ...overrides,
  };
}

test('a candidate matching a registry site or alias counts as already-in-registry', () => {
  const registryKeys = new Set([dedupeKey('https://kerala.gov.in')]);
  const result = categorize([candidate({ url: 'http://KERALA.gov.in/' })], registryKeys);

  assert.equal(result.alreadyInRegistry.length, 1);
  assert.equal(result.duplicateAcrossSources.length, 0);
  assert.equal(result.fresh.length, 0);
});

test('two candidates sharing a dedupeKey but absent from the registry are duplicates, not new', () => {
  const registryKeys = new Set<string>();
  const result = categorize(
    [
      candidate({ url: 'https://example.gov.in', file: 'source-a.yaml' }),
      candidate({ url: 'http://example.gov.in/', file: 'source-b.yaml' }),
    ],
    registryKeys,
  );

  assert.equal(result.alreadyInRegistry.length, 0);
  assert.equal(result.duplicateAcrossSources.length, 2);
  assert.equal(result.fresh.length, 0);
});

test('a candidate with a unique dedupeKey, not in the registry, is new', () => {
  const registryKeys = new Set([dedupeKey('https://kerala.gov.in')]);
  const result = categorize([candidate({ url: 'https://unseen.gov.in' })], registryKeys);

  assert.equal(result.alreadyInRegistry.length, 0);
  assert.equal(result.duplicateAcrossSources.length, 0);
  assert.equal(result.fresh.length, 1);
  assert.equal(result.fresh[0].url, 'https://unseen.gov.in');
});

test('an empty candidate list categorizes to nothing', () => {
  const result = categorize([], new Set());
  assert.deepEqual(result, { alreadyInRegistry: [], duplicateAcrossSources: [], fresh: [] });
});
