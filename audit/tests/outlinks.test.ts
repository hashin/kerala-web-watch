import { describe, expect, it } from 'vitest';
import { computeOutlinks } from '../src/outlinks.js';

describe('computeOutlinks (DESIGN §6.6)', () => {
  it('aggregates a single site linking to a single host', () => {
    const data = computeOutlinks([{ id: 'kerala-gov', outlinks: [{ host: 'example.gov.in', count: 3, texts: ['About'] }] }]);
    expect(data).toEqual({ 'example.gov.in': { count: 3, from: ['kerala-gov'], texts: ['About'] } });
  });

  it('sums counts and unions from/texts across multiple sites linking to the same host', () => {
    const data = computeOutlinks([
      { id: 'site-a', outlinks: [{ host: 'shared.gov.in', count: 2, texts: ['Portal'] }] },
      { id: 'site-b', outlinks: [{ host: 'shared.gov.in', count: 5, texts: ['Home'] }] },
    ]);
    expect(data['shared.gov.in']).toEqual({ count: 7, from: ['site-a', 'site-b'], texts: ['Portal', 'Home'] });
  });

  it('caps from at 5 sites, in stable id order', () => {
    const sites = Array.from({ length: 8 }, (_, i) => ({ id: `site-${i}`, outlinks: [{ host: 'popular.gov.in', count: 1, texts: [] }] }));
    const data = computeOutlinks(sites);
    expect(data['popular.gov.in'].from).toEqual(['site-0', 'site-1', 'site-2', 'site-3', 'site-4']);
  });

  it('caps texts at 3 distinct values, deduplicated', () => {
    const data = computeOutlinks([
      { id: 'a', outlinks: [{ host: 'x.gov.in', count: 1, texts: ['One', 'Two'] }] },
      { id: 'b', outlinks: [{ host: 'x.gov.in', count: 1, texts: ['Two', 'Three', 'Four'] }] },
    ]);
    expect(data['x.gov.in'].texts).toEqual(['One', 'Two', 'Three']);
  });

  it('drops a host once no site currently links to it', () => {
    const withLink = computeOutlinks([{ id: 'a', outlinks: [{ host: 'gone.gov.in', count: 1, texts: [] }] }]);
    expect(withLink).toHaveProperty('gone.gov.in');
    const withoutLink = computeOutlinks([{ id: 'a', outlinks: [] }]);
    expect(withoutLink).not.toHaveProperty('gone.gov.in');
  });

  it('is a pure function of the input: computing it twice from identical data gives identical output', () => {
    const sites = [
      { id: 'a', outlinks: [{ host: 'x.gov.in', count: 2, texts: ['Text'] }] },
      { id: 'b', outlinks: [{ host: 'y.gov.in', count: 1, texts: [] }] },
    ];
    expect(computeOutlinks(sites)).toEqual(computeOutlinks(sites));
  });
});
