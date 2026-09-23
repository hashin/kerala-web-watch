import { describe, expect, it } from 'vitest';
import { DEFAULT_LOCALE, LOCALES, t } from '../src/i18n';
import en from '../src/i18n/en.json';
import ml from '../src/i18n/ml.json';

describe('t', () => {
  it('returns the English value for a known key in the English locale', () => {
    expect(t('en', 'nav.home')).toBe(en['nav.home']);
  });

  it('returns the Malayalam dictionary value for a known key in the Malayalam locale', () => {
    expect(t('ml', 'nav.home')).toBe(ml['nav.home']);
  });
});

describe('locale dictionaries', () => {
  it('gives ml.json exactly the same keys as en.json, so no locale silently falls back mid-page', () => {
    expect(Object.keys(ml).sort()).toEqual(Object.keys(en).sort());
  });

  it('lists en as the default locale and includes both locales', () => {
    expect(DEFAULT_LOCALE).toBe('en');
    expect(LOCALES).toEqual(['en', 'ml']);
  });
});
