import { describe, expect, it } from 'vitest';
import { computeChangedIds } from '../src/changed.js';

function fields(url: string, aliases: string[] = []) {
  return { url, aliases };
}

describe('computeChangedIds', () => {
  it('treats an id absent from the "before" snapshot as changed (a brand new entry)', () => {
    const before = new Map();
    const after = new Map([['kseb', fields('https://kseb.kerala.gov.in')]]);
    expect(computeChangedIds(before, after)).toEqual(new Set(['kseb']));
  });

  it('treats an unchanged url and aliases as not changed', () => {
    const before = new Map([['kseb', fields('https://kseb.kerala.gov.in', ['https://www.kseb.in'])]]);
    const after = new Map([['kseb', fields('https://kseb.kerala.gov.in', ['https://www.kseb.in'])]]);
    expect(computeChangedIds(before, after)).toEqual(new Set());
  });

  it('treats a url edit as changed', () => {
    const before = new Map([['kseb', fields('https://kseb.gov.in')]]);
    const after = new Map([['kseb', fields('https://kseb.kerala.gov.in')]]);
    expect(computeChangedIds(before, after)).toEqual(new Set(['kseb']));
  });

  it('treats an added alias as changed', () => {
    const before = new Map([['ikm', fields('https://ikm.gov.in')]]);
    const after = new Map([['ikm', fields('https://ikm.gov.in', ['https://www.infokerala.org'])]]);
    expect(computeChangedIds(before, after)).toEqual(new Set(['ikm']));
  });

  it('does not flag an id that was removed (only "after" is scanned for what to check now)', () => {
    const before = new Map([['gone', fields('https://gone.kerala.gov.in')]]);
    const after = new Map();
    expect(computeChangedIds(before, after)).toEqual(new Set());
  });

  it('leaves an untouched entry alone even when other entries in the same file changed', () => {
    const before = new Map([
      ['a', fields('https://a.kerala.gov.in')],
      ['b', fields('https://b.kerala.gov.in')],
    ]);
    const after = new Map([
      ['a', fields('https://a.kerala.gov.in')],
      ['b', fields('https://b-new.kerala.gov.in')],
    ]);
    expect(computeChangedIds(before, after)).toEqual(new Set(['b']));
  });
});
