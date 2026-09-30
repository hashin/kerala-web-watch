import { describe, expect, it } from 'vitest';
import { collegeManagementText, collegeSection, collegesBySection } from '../src/lib/colleges';
import en from '../src/i18n/en.json';
import ml from '../src/i18n/ml.json';
import type { SiteView } from '../src/lib/data';

const college = (id: string, management: 'government' | 'aided' | null | undefined): SiteView =>
  ({ id, name: id, tier: 'college', management }) as unknown as SiteView;

describe('collegeSection', () => {
  it('is null for a site that is not a college', () => {
    expect(collegeSection({ tier: 'agency', management: null })).toBeNull();
  });

  it('treats a college with no management as unconfirmed, never as government', () => {
    expect(collegeSection({ tier: 'college', management: null })).toBe('unconfirmed');
    expect(collegeSection({ tier: 'college', management: undefined })).toBe('unconfirmed');
  });
});

describe('collegesBySection', () => {
  it('puts each college in exactly one section, sorted by name, and ignores non-colleges', () => {
    const sites = [college('b', 'aided'), college('a', 'aided'), college('c', 'government'), college('d', null), { id: 'x', tier: 'agency' } as unknown as SiteView];
    const out = collegesBySection(sites);
    expect(out.aided.map((s) => s.id)).toEqual(['a', 'b']);
    expect(out.government.map((s) => s.id)).toEqual(['c']);
    expect(out.unconfirmed.map((s) => s.id)).toEqual(['d']);
  });
});

describe('collegeManagementText', () => {
  it('returns nothing for a non-college', () => {
    expect(collegeManagementText({ tier: 'psu', management: null }, 'en')).toBeNull();
  });

  it('always pairs the aided label with its meaning and a link to the aided section', () => {
    const text = collegeManagementText({ tier: 'college', management: 'aided' }, 'en')!;
    expect(text.label).toBe('Government-aided college');
    expect(text.meaning).toContain('pays its teachers');
    expect(text.href).toBe('/colleges/aided/');
  });

  it('gives the Malayalam label and meaning on the ml locale', () => {
    const text = collegeManagementText({ tier: 'college', management: 'government' }, 'ml')!;
    expect(text.label).toBe('സർക്കാർ കോളേജ്');
    expect(text.meaning.length).toBeGreaterThan(0);
  });

  it('sends an unconfirmed college to the hub and says why in its meaning', () => {
    const text = collegeManagementText({ tier: 'college', management: null }, 'en')!;
    expect(text.href).toBe('/colleges/');
    expect(text.meaning).toContain('not guessed');
  });
});

describe('college i18n', () => {
  const keys = Object.keys(en).filter((k) => k.startsWith('college.'));

  it('has all nine keys', () => {
    expect(keys).toHaveLength(9);
  });

  it('translates every college key: the Malayalam differs from the English', () => {
    for (const k of keys) expect((ml as Record<string, string>)[k]).not.toBe((en as Record<string, string>)[k]);
  });
});
