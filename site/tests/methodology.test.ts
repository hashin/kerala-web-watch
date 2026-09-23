import { describe, expect, it } from 'vitest';
import { checksByCategory } from '../src/lib/methodology';
import type { CheckId, CheckMeta } from '../../audit/src/checks/types';

function meta(overrides: Partial<CheckMeta> = {}): CheckMeta {
  return {
    category: 'security',
    severity: 'M',
    title: { en: 'Test check', ml: '' },
    citizen: { en: 'Explanation.', ml: '' },
    fix: { en: 'Fix it.', ml: '' },
    ref: '',
    ...overrides,
  };
}

describe('checksByCategory', () => {
  it('places every check id in exactly one category group', () => {
    const checks: Record<string, CheckMeta> = {
      'avail.dns': meta({ category: 'availability' }),
      'sec.https': meta({ category: 'security' }),
      'a11y.alt': meta({ category: 'accessibility' }),
      'gigw.rti': meta({ category: 'gigw' }),
    };
    const groups = checksByCategory(checks as Record<CheckId, CheckMeta>);
    const allIds = groups.flatMap((g) => g.checks.map((c) => c.id));
    expect(allIds.sort()).toEqual(Object.keys(checks).sort());
  });

  it('groups checks under their own category, not an unrelated one', () => {
    const checks: Record<string, CheckMeta> = {
      'sec.https': meta({ category: 'security' }),
      'sec.hsts': meta({ category: 'security' }),
      'a11y.alt': meta({ category: 'accessibility' }),
    };
    const groups = checksByCategory(checks as Record<CheckId, CheckMeta>);
    const security = groups.find((g) => g.category === 'security')!;
    const accessibility = groups.find((g) => g.category === 'accessibility')!;
    expect(security.checks.map((c) => c.id)).toEqual(['sec.hsts', 'sec.https']);
    expect(accessibility.checks.map((c) => c.id)).toEqual(['a11y.alt']);
  });

  it('keeps every one of the seven categories distinct, not just security/accessibility', () => {
    // Regression test for a specific gap a mutation-testing pass found: the test above only
    // exercises two of the seven categories, so a category mix-up affecting any of the other
    // five (e.g. a content check filed under gigw) would pass every other assertion in this file
    // -- the id still appears exactly once across all groups, just under the wrong heading.
    const checks: Record<string, CheckMeta> = {
      'avail.dns': meta({ category: 'availability' }),
      'sec.https': meta({ category: 'security' }),
      'a11y.alt': meta({ category: 'accessibility' }),
      'content.title': meta({ category: 'content' }),
      'gigw.rti': meta({ category: 'gigw' }),
      'perf.lcp': meta({ category: 'performance' }),
      'id.robots': meta({ category: 'identity' }),
    };
    const groups = checksByCategory(checks as Record<CheckId, CheckMeta>);
    for (const [id, category] of Object.entries({
      'avail.dns': 'availability',
      'sec.https': 'security',
      'a11y.alt': 'accessibility',
      'content.title': 'content',
      'gigw.rti': 'gigw',
      'perf.lcp': 'performance',
      'id.robots': 'identity',
    })) {
      const own = groups.find((g) => g.category === category)!;
      const others = groups.filter((g) => g.category !== category);
      expect(own.checks.map((c) => c.id)).toContain(id);
      for (const other of others) expect(other.checks.map((c) => c.id)).not.toContain(id);
    }
  });

  it('lists all seven categories even when a category has no checks', () => {
    const checks: Record<string, CheckMeta> = { 'sec.https': meta({ category: 'security' }) };
    const groups = checksByCategory(checks as Record<CheckId, CheckMeta>);
    expect(groups.map((g) => g.category)).toEqual([
      'availability',
      'security',
      'accessibility',
      'content',
      'gigw',
      'performance',
      'identity',
    ]);
    expect(groups.find((g) => g.category === 'accessibility')!.checks).toEqual([]);
  });

  it('includes every id from the real check registry with no defaults argument', () => {
    const groups = checksByCategory();
    const allIds = groups.flatMap((g) => g.checks.map((c) => c.id));
    expect(new Set(allIds).size).toBe(allIds.length);
    expect(allIds.length).toBeGreaterThan(80);
  });
});
