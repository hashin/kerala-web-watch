import { describe, expect, it } from 'vitest';
import { langMismatches, malayalamRatio } from '../src/text/malayalam.js';

describe('malayalamRatio', () => {
  it('is 0 for pure English text', () => {
    expect(malayalamRatio('This is an English sentence with no Malayalam at all.')).toBe(0);
  });
  it('is 0 when there are no letters at all (not NaN)', () => {
    expect(malayalamRatio('123 456 !!! ...')).toBe(0);
  });
  it('is close to 1 for pure Malayalam text', () => {
    expect(malayalamRatio('ഇത് ഒരു മലയാളം വാചകമാണ്')).toBeGreaterThan(0.9);
  });
  it('is between 0 and 1 for mixed text, proportional to the mix', () => {
    const ratio = malayalamRatio('Hello ഹലോ');
    expect(ratio).toBeGreaterThan(0);
    expect(ratio).toBeLessThan(1);
  });
});

describe('langMismatches', () => {
  it('flags a mostly-Malayalam page declared as English', () => {
    expect(langMismatches(0.31, 'en')).toBe(true);
  });
  it('does not flag a page with only a small amount of incidental Malayalam declared as English', () => {
    expect(langMismatches(0.29, 'en')).toBe(false);
  });
  it('flags a page declared as Malayalam with almost no Malayalam text', () => {
    expect(langMismatches(0.04, 'ml')).toBe(true);
  });
  it('does not flag a genuinely Malayalam page declared as Malayalam', () => {
    expect(langMismatches(0.05, 'ml')).toBe(false);
  });
  it('does not flag a mostly-Malayalam page correctly declared as Malayalam', () => {
    expect(langMismatches(0.9, 'ml')).toBe(false);
  });
  it('treats a missing lang attribute the same as a non-Malayalam declaration', () => {
    expect(langMismatches(0.5, null)).toBe(true);
  });
});
