import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_LOCALE, LOCALES, t, tf } from '../src/i18n';
import { tips } from '../src/lib/tips';
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

describe('dashboard copy in the dictionaries', () => {
  it('has no empty value in either locale', () => {
    const empty = [...Object.entries(en), ...Object.entries(ml)].filter(([, v]) => v.trim() === '');
    expect(empty).toEqual([]);
  });

  it('lists every English-placeholder Malayalam key in docs/ML-REVIEW.md', () => {
    const review = readFileSync(join(__dirname, '../../docs/ML-REVIEW.md'), 'utf8');
    const BRAND_NAME = 'home.heading';
    const unlisted = Object.keys(en).filter(
      (k) => k !== BRAND_NAME && en[k as keyof typeof en] === ml[k as keyof typeof ml] && !review.includes(`\`${k}\``),
    );
    expect(unlisted).toEqual([]);
  });

  it('keeps the English tooltip and label copy the dashboard shipped with', () => {
    expect(t('en', 'tip.kpiHealthy')).toBe('Healthy: passes almost every check. The goal is to grow this. Small chart: last 8 weeks.');
    expect(t('en', 'tip.status.down')).toBe('Down: two failed checks in a row. The site did not answer.');
    expect(t('en', 'tip.category.security')).toBe('Security: valid HTTPS certificate, security headers, no known-vulnerable code. Higher is better.');
    expect(t('en', 'nav.leaderboard')).toBe('Leaderboard');
    expect(t('en', 'band.broken')).toBe('Down / broken');
  });

  it('reuses the reviewed Malayalam status word for the down status and band', () => {
    expect(t('ml', 'status.down')).toBe('പ്രവർത്തനരഹിതം');
    expect(t('ml', 'band.healthy')).toBe('ആരോഗ്യകരം');
  });
});

describe('tf', () => {
  it('fills named placeholders and leaves unknown ones untouched', () => {
    expect(tf('en', 'home.brokeTitle', { n: 7 })).toBe('Broke this week · 7');
    expect(tf('en', 'home.lede', { total: '1,500' })).toBe('{broken} of 1,500 Kerala government websites are broken right now.');
  });
});

describe('tf locale', () => {
  it('uses the requested locale dictionary', () => {
    expect(tf('ml', 'band.broken', {})).toBe('തകരാറിലാണ്');
    expect(tf('ml', 'home.brokeTitle', { n: 7 })).toBe(ml['home.brokeTitle'].replace('{n}', '7'));
  });
  it('keeps an unknown placeholder while filling the known one', () => {
    expect(tf('en', 'home.lede', { total: 9 })).toBe('{broken} of 9 Kerala government websites are broken right now.');
    expect(tf('en', 'home.lede', {})).toBe('{broken} of {total} Kerala government websites are broken right now.');
  });
});

describe('tips locale and cache', () => {
  afterEach(() => { vi.doUnmock('../src/i18n'); vi.resetModules(); });
  it('reads each accessor group from its own tip.* prefix, per locale, without cache cross-talk', async () => {
    vi.resetModules();
    vi.doMock('../src/i18n', () => ({ t: (l: string, k: string) => `${l}|${k}` }));
    const { tips: fresh } = await import('../src/lib/tips');
    const ml1 = fresh('ml');
    const en1 = fresh('en');
    expect(ml1.TIP.median).toBe('ml|tip.median');
    expect(en1.TIP.median).toBe('en|tip.median');
    expect(ml1.STATUS_TIP.down).toBe('ml|tip.status.down');
    expect(ml1.CATEGORY_TIP.security).toBe('ml|tip.category.security');
    expect(ml1.CHECK_TIP.up).toBe('ml|tip.check.up');
    expect(fresh('ml')).toBe(ml1);
    expect(fresh()).toBe(en1);
  });
});

describe('tips', () => {
  it('returns the same strings as the dictionary, per locale, under each accessor', () => {
    expect(tips('en').TIP.median).toBe("The middle site's health score (0–100). Less affected by outliers than an average.");
    expect(tips('en').STATUS_TIP.unverifiable).toBe('Unverifiable: we cannot reach it from our monitoring location. It may work fine for you.');
    expect(tips('ml').CATEGORY_TIP.gigw).toBe(ml['tip.category.gigw']);
    expect(Object.keys(tips().STATUS_TIP).sort()).toEqual(
      ['broken', 'down', 'healthy', 'hijacked', 'needs-work', 'poor', 'unaudited', 'unverifiable'],
    );
  });
});
