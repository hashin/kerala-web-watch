import { afterEach, describe, expect, it, vi } from 'vitest';
import { CATEGORY_COLOR, BANDS, STATUS_COLOR, STATUS_PILL_FG, STATUS_WORD, bandCounts, bandShareTip, brokenShareColor, medianColor, statusWord } from '../src/lib/bands';
import type { Status } from '../src/lib/data';
import { tips } from '../src/lib/tips';

const ALL: Status[] = ['healthy', 'needs-work', 'poor', 'down', 'hijacked', 'broken', 'unaudited', 'unverifiable'];
const zero = () => Object.fromEntries(ALL.map((s) => [s, 0])) as Record<Status, number>;

describe('bandCounts', () => {
  it('folds down, hijacked and broken into one band and unaudited with unverifiable into another', () => {
    const counts = { ...zero(), healthy: 1, 'needs-work': 2, poor: 3, down: 4, hijacked: 5, broken: 6, unaudited: 7, unverifiable: 8 };
    expect(Object.fromEntries(bandCounts(counts).map((b) => [b.key, b.n]))).toEqual({ healthy: 1, 'needs-work': 2, poor: 3, broken: 15, unaudited: 15 });
  });
  it('places every status in exactly one band', () => {
    const placed = BANDS.flatMap((b) => b.statuses).sort();
    expect(placed).toEqual([...ALL].sort());
  });
});

describe('status tables', () => {
  it('give every status a colour and a plain word', () => {
    for (const s of ALL) {
      expect(STATUS_COLOR[s]).toMatch(/^var\(--/);
      expect(STATUS_WORD[s].length).toBeGreaterThan(2);
    }
  });
  it('keeps the do-not-visit warning in the hijacked word (ADR-026: the badge is the whole warning)', () => {
    expect(STATUS_WORD.hijacked).toBe('Possibly hijacked — do not visit');
  });
  it('uses the crimson-aware text colour, and only on down, hijacked and broken pills', () => {
    expect(STATUS_PILL_FG).toEqual({ down: 'var(--on-crimson)', hijacked: 'var(--on-crimson)', broken: 'var(--on-crimson)' });
  });
  it('gives each status its palette colour', () => {
    expect(STATUS_COLOR).toEqual({
      healthy: 'var(--teal)', 'needs-work': 'var(--amber)', poor: 'var(--coral)',
      down: 'var(--crimson)', hijacked: 'var(--crimson)', broken: 'var(--crimson)',
      unaudited: 'var(--grey)', unverifiable: 'var(--grey)',
    });
  });
  it('agrees with the band table on colour for every single-status band', () => {
    for (const band of BANDS.filter((b) => b.statuses.length === 1)) expect(STATUS_COLOR[band.statuses[0]]).toBe(band.color);
  });
});

describe('medianColor', () => {
  it.each([[null, 'grey'], [65, 'teal'], [64.9, 'amber'], [55, 'amber'], [54.9, 'coral'], [0, 'coral']])('%s is %s', (m, c) => {
    expect(medianColor(m)).toBe(`var(--${c})`);
  });
});

describe('brokenShareColor', () => {
  it.each([[0, 'teal'], [9, 'teal'], [10, 'amber'], [19, 'amber'], [20, 'coral'], [24, 'coral'], [25, 'crimson'], [100, 'crimson']])('%s%% is %s', (p, c) => {
    expect(brokenShareColor(p)).toBe(`var(--${c})`);
  });
});

describe('CATEGORY_COLOR', () => {
  it('gives each check category the colour the design assigns it', () => {
    expect(CATEGORY_COLOR).toEqual({
      availability: 'var(--sky)', security: 'var(--plum)', accessibility: 'var(--indigo)', content: 'var(--amber)',
      gigw: 'var(--coral)', performance: 'var(--teal)', identity: 'var(--sky)',
    });
  });
  it('has a hover explanation for every category it colours', () => {
    expect(Object.keys(tips().CATEGORY_TIP).sort()).toEqual(Object.keys(CATEGORY_COLOR).sort());
  });
});

describe('bandCounts labels and tips (concrete values)', () => {
  const rows = (locale?: 'en' | 'ml') => Object.fromEntries(bandCounts(zero(), locale).map((b) => [b.key, b]));
  it('gives English labels and the broken-band tip by default', () => {
    const r = rows();
    expect(Object.values(r).map((b) => b.label)).toEqual(['Healthy', 'Needs work', 'Poor', 'Down / broken', 'Not audited']);
    expect(r.broken.tip).toBe('Down, hijacked or broken: unreachable, or failing basic checks. Lower is better.');
    expect(r.poor.tip).toBe(tips().STATUS_TIP.poor);
    expect(r.poor.tip).not.toBe(r.healthy.tip);
    expect(r.unaudited.tip).toBe(tips().STATUS_TIP.unaudited);
  });
  it('gives Malayalam labels in the ml locale', () => {
    expect(Object.values(rows('ml')).map((b) => b.label)).toEqual(['ആരോഗ്യകരം', 'പണി ആവശ്യമാണ്', 'മോശം', 'തകരാറിലാണ്', 'ഇതുവരെ ഓഡിറ്റ് ചെയ്തിട്ടില്ല']);
  });
});

describe('BANDS static tips', () => {
  it('carries the English broken-band tip, distinct from the plain down status tip', () => {
    const broken = BANDS.find((b) => b.key === 'broken')!;
    expect(broken.tip).toBe('Down, hijacked or broken: unreachable, or failing basic checks. Lower is better.');
  });
});

describe('bandShareTip', () => {
  it('formats "tip — n sites (pct%)" with a rounded percentage and grouped thousands', () => {
    expect(bandShareTip('Broken.', 1234, 2000)).toBe('Broken. — 1,234 sites (62%).');
    expect(bandShareTip('T', 1, 3)).toBe('T — 1 sites (33%).');
    expect(bandShareTip('T', 2, 3)).toBe('T — 2 sites (67%).');
  });
});

describe('statusWord', () => {
  it('returns the locale word', () => {
    expect(statusWord('down')).toBe('Down');
    expect(statusWord('down', 'en')).toBe('Down');
    expect(statusWord('down', 'ml')).toBe('പ്രവർത്തനരഹിതം');
  });
  it('derives STATUS_WORD from the English status words, one per status', () => {
    expect(STATUS_WORD.down).toBe('Down');
    expect(STATUS_WORD.broken).toBe('Broken');
    expect(STATUS_WORD.unaudited).toBe('Not yet audited');
    expect(STATUS_WORD.unverifiable).toBe('Unverifiable');
  });
});

// ml tooltip copy is still English, so locale threading is only observable with a marker dictionary.
describe('locale is threaded through bands helpers', () => {
  afterEach(() => { vi.doUnmock('../src/i18n'); vi.resetModules(); });
  it('passes the requested locale to every lookup', async () => {
    vi.resetModules();
    vi.doMock('../src/i18n', () => ({
      t: (l: string, k: string) => `${l}|${k}`,
      tf: (l: string, k: string, v: object) => `${l}|${k}|${JSON.stringify(v)}`,
    }));
    const bands = await import('../src/lib/bands');
    const r = Object.fromEntries(bands.bandCounts(zero(), 'ml').map((b) => [b.key, b]));
    expect(r.healthy.label).toBe('ml|band.healthy');
    expect(r.healthy.tip).toBe('ml|tip.status.healthy');
    expect(r['needs-work'].tip).toBe('ml|tip.status.needs-work');
    expect(r.poor.tip).toBe('ml|tip.status.poor');
    expect(r.broken.tip).toBe('ml|tip.band.broken');
    expect(r.unaudited.tip).toBe('ml|tip.status.unaudited');
    expect(bands.bandShareTip('x', 1234, 2000, 'ml')).toBe('ml|tip.bandShare|{"tip":"x","n":"1,234","pct":62}');
    expect(bands.statusWord('down', 'ml')).toBe('ml|status.down');
  });
});
