import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dedupeKey, emit } from './lib.js';

test('emit keeps the URL scheme — http and https are different registry values', () => {
  const httpCandidate = emit({
    url: 'http://example.gov.in',
    name: 'Example',
    source: 'test',
    source_page: 'https://example.gov.in/list',
  });
  const httpsCandidate = emit({
    url: 'https://example.gov.in',
    name: 'Example',
    source: 'test',
    source_page: 'https://example.gov.in/list',
  });

  assert.equal(httpCandidate.url, 'http://example.gov.in');
  assert.equal(httpsCandidate.url, 'https://example.gov.in');
});

test('emit defaults hints to {} and fills fetched_at when not given', () => {
  const candidate = emit({
    url: 'https://example.gov.in',
    name: 'Example',
    source: 'test',
    source_page: 'https://example.gov.in/list',
  });

  assert.deepEqual(candidate.hints, {});
  assert.match(candidate.fetched_at, /^\d{4}-\d{2}-\d{2}T/);
});

test('dedupeKey folds scheme and host case together so equivalent urls collide', () => {
  assert.equal(dedupeKey('http://WWW.Foo.GOV.IN/'), dedupeKey('https://www.foo.gov.in'));
});

test('dedupeKey still distinguishes different paths', () => {
  assert.notEqual(dedupeKey('https://foo.gov.in/a'), dedupeKey('https://foo.gov.in/b'));
});
