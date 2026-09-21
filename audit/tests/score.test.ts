import { describe, expect, it } from 'vitest';
import { scoreSite, statusFromScore } from '../src/score.js';
import type { CheckId, CheckMeta, CheckResult } from '../src/checks/types.js';

// A small, self-contained metadata set (not the real ~90-entry CHECKS) so these tests assert
// against hand-computed expected values, not against whatever registry.ts happens to contain.
const META: Record<CheckId, CheckMeta> = {
  'sec.hsts': meta('security', 'M'),
  'a11y.alt': meta('accessibility', 'M'),
  'content.title': meta('content', 'M'),
  'gigw.rti': meta('gigw', 'H'),
  'perf.lcp': meta('performance', 'M'),
  'id.robots': meta('identity', 'L'),
  'avail.dns': meta('availability', 'C', 'down'),
  'avail.parked': meta('availability', 'C', 'hijacked'),
  'sec.cert_valid': meta('security', 'C', 'broken'),
  'avail.geo_blocked': meta('availability', 'I', 'unverifiable'),
  'avail.ttfb': meta('availability', 'M'), // one of the two known non-★ availability checks (no statusSetting)
} as Record<CheckId, CheckMeta>;

function meta(category: CheckMeta['category'], severity: CheckMeta['severity'], statusSetting?: CheckMeta['statusSetting']): CheckMeta {
  return { category, severity, statusSetting, title: { en: 't', ml: '' }, citizen: { en: 'c', ml: '' }, fix: { en: 'f', ml: '' }, ref: '' };
}

function allPass(): CheckResult[] {
  return (Object.keys(META) as CheckId[]).map((id) => ({ id, r: 'pass' }));
}

function withResult(id: CheckId, r: CheckResult['r'], ev?: string): CheckResult[] {
  return allPass().map((c) => (c.id === id ? { id, r, ev } : c));
}

describe('scoreSite', () => {
  it('scores 100/healthy when every check passes', () => {
    const outcome = scoreSite(allPass(), META);
    expect(outcome.score).toEqual({ overall: 100, security: 100, accessibility: 100, content: 100, gigw: 100, performance: 100, identity: 100 });
    expect(outcome.status).toBe('healthy');
    expect(outcome.issues).toEqual([]);
  });

  it('deducts a medium-severity fail (-10) from just its own category', () => {
    const outcome = scoreSite(withResult('sec.hsts', 'fail'), META);
    expect(outcome.score?.security).toBe(90);
    expect(outcome.score?.accessibility).toBe(100);
  });

  it('deducts half as much for a warn as for a fail, at the same severity', () => {
    const failing = scoreSite(withResult('sec.hsts', 'fail'), META);
    const warning = scoreSite(withResult('sec.hsts', 'warn'), META);
    expect(warning.score?.security).toBe(95);
    expect(failing.score?.security).toBe(90);
  });

  it('a ★ check failing sets status directly and nulls the score, regardless of everything else', () => {
    const outcome = scoreSite(withResult('sec.cert_valid', 'fail'), META);
    expect(outcome.score).toBeNull();
    expect(outcome.status).toBe('broken');
  });

  it('an "na" result never deducts anything', () => {
    const outcome = scoreSite(withResult('sec.hsts', 'na'), META);
    expect(outcome.score?.security).toBe(100);
  });

  it('floors a category at 0 rather than going negative', () => {
    // Three C fails (-40 each) in the same category would go to -20 uncapped.
    const metaThreeUnstarredCriticals: Record<CheckId, CheckMeta> = {
      ...META,
      'sec.hsts': meta('security', 'C'),
      'sec.cert_valid': meta('security', 'C'),
      'sec.mixed_content': meta('security', 'C'),
    } as Record<CheckId, CheckMeta>;
    const checks = allPass()
      .concat({ id: 'sec.mixed_content', r: 'pass' })
      .map((c) => (['sec.hsts', 'sec.cert_valid', 'sec.mixed_content'].includes(c.id) ? { ...c, r: 'fail' as const } : c));
    expect(scoreSite(checks, metaThreeUnstarredCriticals).score?.security).toBe(0);
  });

  it('computes a weighted overall from the six category scores per ADR-006', () => {
    // security=90 (weight 25), rest 100: (90*25 + 100*75)/100 = 97.5 -> rounds to 98.
    const outcome = scoreSite(withResult('sec.hsts', 'fail'), META);
    expect(outcome.score?.overall).toBe(98);
  });

  it('reports poor below 50, driven by three of the six weighted categories flooring to 0', () => {
    // Three C-severity (-40 each) fails per category floors it at 0; gigw/performance/identity
    // have no checks defined here at all, so they default to a perfect 100 -- still not enough to
    // keep the weighted overall at or above 50 once half the weight (security 25 + accessibility
    // 25 + content 15 = 65%) is wiped out.
    const metaThreeCategoriesWipedOut: Record<CheckId, CheckMeta> = {
      'sec.hsts': meta('security', 'C'),
      'sec.mixed_content': meta('security', 'C'),
      'sec.tls_version': meta('security', 'C'),
      'a11y.alt': meta('accessibility', 'C'),
      'a11y.contrast': meta('accessibility', 'C'),
      'a11y.headings': meta('accessibility', 'C'),
      'content.title': meta('content', 'C'),
      'content.legacy_font': meta('content', 'C'),
      'content.stale_news': meta('content', 'C'),
    } as Record<CheckId, CheckMeta>;
    const allFail = (Object.keys(metaThreeCategoriesWipedOut) as CheckId[]).map((id): CheckResult => ({ id, r: 'fail' }));
    const outcome = scoreSite(allFail, metaThreeCategoriesWipedOut);
    expect(outcome.score).toEqual({ overall: 35, security: 0, accessibility: 0, content: 0, gigw: 100, performance: 100, identity: 100 });
    expect(outcome.status).toBe('poor');
  });

  it('picks unverifiable over a simultaneous broken/hijacked/down failure', () => {
    const checks = allPass().map((c) =>
      ['avail.geo_blocked', 'avail.parked', 'sec.cert_valid', 'avail.dns'].includes(c.id) ? { ...c, r: 'fail' as const } : c,
    );
    expect(scoreSite(checks, META).status).toBe('unverifiable');
  });

  it('picks hijacked over a simultaneous broken/down failure (with no geo-block present)', () => {
    const checks = allPass().map((c) => (['avail.parked', 'sec.cert_valid', 'avail.dns'].includes(c.id) ? { ...c, r: 'fail' as const } : c));
    expect(scoreSite(checks, META).status).toBe('hijacked');
  });

  it('lists every failed/warned check in issues, sorted by severity then category, regardless of status override', () => {
    const checks = allPass().map((c) => {
      if (c.id === 'gigw.rti') return { ...c, r: 'fail' as const }; // H
      if (c.id === 'id.robots') return { ...c, r: 'fail' as const }; // L
      if (c.id === 'avail.parked') return { ...c, r: 'fail' as const }; // C, ★ hijacked
      return c;
    });
    const outcome = scoreSite(checks, META);
    expect(outcome.status).toBe('hijacked');
    expect(outcome.issues.map((i) => i.id)).toEqual(['avail.parked', 'gigw.rti', 'id.robots']);
  });

  it('breaks a severity tie between issues by CATEGORY_ORDER, not check-list order', () => {
    // sec.hsts and content.title are both severity M in META -- security comes before content in
    // CATEGORY_ORDER, so it must lead even though content.title fails first in the checks array.
    const checks = allPass().map((c) => (['content.title', 'sec.hsts'].includes(c.id) ? { ...c, r: 'fail' as const } : c));
    const outcome = scoreSite(checks, META);
    expect(outcome.issues.map((i) => i.id)).toEqual(['sec.hsts', 'content.title']);
  });

  it('excludes the availability category from every scored category, even when it has a non-★ fail', () => {
    // avail.ttfb has no statusSetting, so it never triggers findStatusOverride -- it must still be
    // skipped by computeCategoryScores rather than falling into some other category's deductions.
    const outcome = scoreSite(withResult('avail.ttfb', 'fail'), META);
    expect(outcome.score).toEqual({ overall: 100, security: 100, accessibility: 100, content: 100, gigw: 100, performance: 100, identity: 100 });
  });
});

describe('statusFromScore', () => {
  it('is healthy at exactly 80 and needs-work at exactly 79', () => {
    expect(statusFromScore(80)).toBe('healthy');
    expect(statusFromScore(79)).toBe('needs-work');
  });

  it('is needs-work at exactly 50 and poor at exactly 49', () => {
    expect(statusFromScore(50)).toBe('needs-work');
    expect(statusFromScore(49)).toBe('poor');
  });
});
