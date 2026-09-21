import { describe, expect, it } from 'vitest';
import { summarize, type Lhr } from '../src/lighthouse.js';

function lhr(overrides: Partial<Lhr> = {}): Lhr {
  return {
    categories: { performance: { score: 0.41 }, accessibility: { score: 0.67 }, 'best-practices': { score: 0.75 }, seo: { score: 0.8 } },
    audits: {},
    ...overrides,
  };
}

describe('summarize', () => {
  it('converts each category 0-1 score to a rounded 0-100 score', () => {
    const result = summarize(lhr());
    expect(result).toMatchObject({ performance: 41, accessibility: 67, bestPractices: 75, seo: 80 });
  });
  it('rounds a fractional category score rather than truncating it', () => {
    // 0.876 * 100 = 87.6, which floor/truncation would misreport as 87 -- catches that distinct
    // from the other fixture scores here, which all happen to multiply out to whole numbers.
    const result = summarize(lhr({ categories: { performance: { score: 0.876 } } }));
    expect(result.performance).toBe(88);
  });
  it('treats a null category score as 0', () => {
    const result = summarize(lhr({ categories: { performance: { score: null } } }));
    expect(result.performance).toBe(0);
  });
  it('reads lcp/cls/total-byte-weight from their numericValue', () => {
    const result = summarize(
      lhr({
        audits: {
          'largest-contentful-paint': { score: 0.5, numericValue: 2500 },
          'cumulative-layout-shift': { score: 0.9, numericValue: 0.05 },
          'total-byte-weight': { score: 0.6, numericValue: 4_000_000 },
        },
      }),
    );
    expect(result.lcpMs).toBe(2500);
    expect(result.cls).toBe(0.05);
    expect(result.totalByteWeightBytes).toBe(4_000_000);
  });
  it('is null for audits that never ran', () => {
    const result = summarize(lhr());
    expect(result.lcpMs).toBeNull();
    expect(result.cls).toBeNull();
    expect(result.tapTargetsOk).toBeNull();
    expect(result.imagesOptimized).toBeNull();
  });
  it('treats a target-size/image-delivery-insight score at or above 0.9 as ok', () => {
    const result = summarize(lhr({ audits: { 'target-size': { score: 0.9 }, 'image-delivery-insight': { score: 1 } } }));
    expect(result.tapTargetsOk).toBe(true);
    expect(result.imagesOptimized).toBe(true);
  });
  it('treats a target-size/image-delivery-insight score below 0.9 as not ok', () => {
    const result = summarize(lhr({ audits: { 'target-size': { score: 0.5 }, 'image-delivery-insight': { score: 0 } } }));
    expect(result.tapTargetsOk).toBe(false);
    expect(result.imagesOptimized).toBe(false);
  });
});
