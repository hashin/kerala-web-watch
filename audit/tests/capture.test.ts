import { describe, expect, it } from 'vitest';
import { extractScriptUrls, summarizeAxe, type AxeViolation } from '../src/capture.js';

describe('summarizeAxe', () => {
  it('counts nodes per impact level', () => {
    const violations: AxeViolation[] = [
      { id: 'image-alt', impact: 'critical', nodes: [1, 2] },
      { id: 'color-contrast', impact: 'serious', nodes: [1] },
      { id: 'label', impact: 'moderate', nodes: [1] },
      { id: 'bypass', impact: 'minor', nodes: [1] },
    ];
    expect(summarizeAxe(violations)).toEqual({
      critical: 2,
      serious: 1,
      moderate: 1,
      minor: 1,
      byRule: { 'image-alt': 2, 'color-contrast': 1, label: 1, bypass: 1 },
    });
  });
  it('sums node counts across multiple violations of the same rule', () => {
    const violations: AxeViolation[] = [
      { id: 'image-alt', impact: 'critical', nodes: [1] },
      { id: 'image-alt', impact: 'critical', nodes: [1, 2] },
    ];
    expect(summarizeAxe(violations).byRule['image-alt']).toBe(3);
    expect(summarizeAxe(violations).critical).toBe(3);
  });
  it('is all zero for no violations', () => {
    expect(summarizeAxe([])).toEqual({ critical: 0, serious: 0, moderate: 0, minor: 0, byRule: {} });
  });
  it('ignores a violation with no recognised impact level (still counted per-rule)', () => {
    const violations: AxeViolation[] = [{ id: 'some-rule', impact: null, nodes: [1] }];
    const result = summarizeAxe(violations);
    expect(result).toEqual({ critical: 0, serious: 0, moderate: 0, minor: 0, byRule: { 'some-rule': 1 } });
  });
});

describe('extractScriptUrls', () => {
  it('resolves relative script src attributes against the base URL', () => {
    const html = '<html><head><script src="/js/app.js"></script></head></html>';
    expect(extractScriptUrls(html, 'https://test.kerala.gov.in/')).toEqual(['https://test.kerala.gov.in/js/app.js']);
  });
  it('keeps absolute script URLs unchanged', () => {
    const html = '<script src="https://cdn.example.com/jquery.js"></script>';
    expect(extractScriptUrls(html, 'https://test.kerala.gov.in/')).toEqual(['https://cdn.example.com/jquery.js']);
  });
  it('returns an empty array when there are no scripts', () => {
    expect(extractScriptUrls('<html></html>', 'https://test.kerala.gov.in/')).toEqual([]);
  });
  it('finds multiple scripts', () => {
    const html = '<script src="/a.js"></script><script src="/b.js"></script>';
    expect(extractScriptUrls(html, 'https://test.kerala.gov.in/')).toEqual(['https://test.kerala.gov.in/a.js', 'https://test.kerala.gov.in/b.js']);
  });
});
