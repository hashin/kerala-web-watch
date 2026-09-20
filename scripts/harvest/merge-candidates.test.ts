import assert from 'node:assert/strict';
import { test } from 'node:test';
import { categorize, classifyDraftTier, pickDraftCandidates, type FiledCandidate } from './merge-candidates.js';
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

test('classifyDraftTier maps a curated kind hint to its site tier', () => {
  assert.equal(classifyDraftTier({ name: 'X', url: 'https://x.gov.in', hints: { kind: 'psu' } }), 'psu');
  assert.equal(classifyDraftTier({ name: 'X', url: 'https://x.gov.in', hints: { kind: 'university' } }), 'university');
  assert.equal(classifyDraftTier({ name: 'X', url: 'https://x.gov.in', hints: { kind: 'board' } }), 'statutory');
  assert.equal(classifyDraftTier({ name: 'X', url: 'https://x.gov.in', hints: { kind: 'mission' } }), 'agency');
  assert.equal(classifyDraftTier({ name: 'X', url: 'https://x.gov.in', hints: { kind: 'district_admin' } }), 'district');
});

test('classifyDraftTier recognises a plain "X Department, Kerala" name as directorate', () => {
  assert.equal(classifyDraftTier({ name: 'Fisheries Department, Kerala', url: 'https://fisheries.kerala.gov.in', hints: {} }), 'directorate');
});

test('classifyDraftTier skips colleges, courts and sub-district police even with a kind hint', () => {
  assert.equal(classifyDraftTier({ name: 'Government College, Kattapana', url: 'https://gckattappana.ac.in', hints: {} }), null);
  assert.equal(classifyDraftTier({ name: 'District Court Kollam', url: 'https://kollam.dcourts.gov.in', hints: {} }), null);
  assert.equal(classifyDraftTier({ name: 'Kannur City Police', url: 'https://kannur.keralapolice.gov.in', hints: { kind: 'agency' } }), null);
});

test('classifyDraftTier keeps the single state-level Kerala Police site despite the police-domain skip pattern', () => {
  assert.equal(classifyDraftTier({ name: 'Kerala Police', url: 'https://keralapolice.gov.in', hints: {} }), 'directorate');
});

test('classifyDraftTier returns null, not a guess, for a name with no recognisable pattern', () => {
  assert.equal(classifyDraftTier({ name: 'Some Random Portal', url: 'https://random.gov.in', hints: {} }), null);
});

test('pickDraftCandidates keeps every fresh candidate plus one representative per duplicate group', () => {
  const fresh = [candidate({ url: 'https://unseen.gov.in' })];
  const duplicateAcrossSources = [
    candidate({ url: 'https://dup.gov.in', file: 'a.yaml', hints: {} }),
    candidate({ url: 'https://dup.gov.in', file: 'b.yaml', hints: { kind: 'psu' } }),
  ];
  const picked = pickDraftCandidates({ alreadyInRegistry: [], duplicateAcrossSources, fresh });

  assert.equal(picked.length, 2);
  assert.ok(picked.some((c) => c.url === 'https://unseen.gov.in'));
  const dup = picked.find((c) => c.url === 'https://dup.gov.in');
  assert.equal(dup?.hints.kind, 'psu', 'prefers the copy carrying a hints.kind over a bare crawl hit');
});
