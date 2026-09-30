import { describe, expect, it } from 'vitest';
import { listRange } from '../src/lib/format';

describe('listRange', () => {
  it('names the slice a paginated page shows, one-based', () => {
    expect(listRange({ start: 100, end: 131, total: 132, lastPage: 2 })).toBe('Sites 101–132 of 132');
    expect(listRange({ start: 0, end: 99, total: 132, lastPage: 2 })).toBe('Sites 1–100 of 132');
  });
  it('says All N when everything fits on one page', () => {
    expect(listRange({ start: 0, end: 41, total: 42, lastPage: 1 })).toBe('All 42 sites');
  });
  it('groups thousands in the All-N form too', () => {
    expect(listRange({ start: 0, end: 1499, total: 1500, lastPage: 1 })).toBe('All 1,500 sites');
  });
  it('uses the given noun for an empty group', () => {
    expect(listRange({ start: 0, end: -1, total: 0, lastPage: 1 }, 'colleges')).toBe('No colleges');
  });
  it('says there are none for an empty group, so the empty state is never "All 0 sites"', () => {
    expect(listRange({ start: 0, end: -1, total: 0, lastPage: 1 })).toBe('No sites');
  });
  it('groups thousands the Indian way and takes another noun', () => {
    expect(listRange({ start: 0, end: 99, total: 1200, lastPage: 12 }, 'colleges')).toBe('Colleges 1–100 of 1,200');
    expect(listRange({ start: 0, end: 99, total: 150000, lastPage: 2 })).toBe('Sites 1–100 of 1,50,000');
  });
});
