// Guards the accessibility promise behind the two themes: every text/fill pair the dashboard uses
// clears WCAG AA (4.5:1 for text, 3:1 for the focus ring), in light and in dark.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(resolve(__dirname, '../src/styles/dashboard.css'), 'utf8');

function tokens(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of block.matchAll(/(--[a-z-]+):\s*(#[0-9A-Fa-f]{6})\b/g)) out[m[1]] = m[2];
  return out;
}
const lightBlock = css.slice(css.indexOf(':root {'), css.indexOf('@media (prefers-color-scheme: dark)'));
const darkBlock = css.slice(css.indexOf('@media (prefers-color-scheme: dark)'), css.indexOf('html { font-family'));
const LIGHT = tokens(lightBlock);
const DARK = { ...LIGHT, ...tokens(darkBlock) };

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const TEXT_ON_GROUND: [string, string][] = [
  ['--ink', '--sand'], ['--ink', '--surface'], ['--ink', '--tint'],
  ['--color-muted', '--sand'], ['--color-muted', '--surface'], ['--color-muted', '--tint'],
  ['--link', '--sand'], ['--link', '--surface'],
  ['--teal-ink', '--surface'], ['--teal-ink', '--sand'],
  ['--amber-ink', '--surface'], ['--amber-ink', '--sand'],
  ['--crimson-ink', '--surface'], ['--crimson-ink', '--sand'],
];
const TEXT_ON_FILL: [string, string][] = [
  ['--on-fill', '--teal'], ['--on-fill', '--sky'], ['--on-fill', '--amber'], ['--on-fill', '--coral'], ['--on-fill', '--grey'],
  ['--on-crimson', '--crimson'], ['--on-ink', '--ink'], ['--tip-fg', '--tip-bg'],
];

describe('contrast helper', () => {
  it('rates black on white 21:1 and identical colours 1:1', () => {
    expect(contrast('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrast('#14A38B', '#14A38B')).toBeCloseTo(1, 5);
  });
});

describe.each([['light', LIGHT], ['dark', DARK]] as const)('%s theme', (_name, theme) => {
  it.each([...TEXT_ON_GROUND, ...TEXT_ON_FILL])('%s on %s reaches 4.5:1', (fg, bg) => {
    expect(contrast(theme[fg], theme[bg])).toBeGreaterThanOrEqual(4.5);
  });
  it.each([['--focus', '--sand'], ['--focus', '--surface']])('focus colour %s against %s reaches 3:1', (fg, bg) => {
    expect(contrast(theme[fg], theme[bg])).toBeGreaterThanOrEqual(3);
  });
});

it('the dark theme really is a separate palette, not a copy of the light one', () => {
  expect(DARK['--sand']).not.toBe(LIGHT['--sand']);
  expect(DARK['--ink']).not.toBe(LIGHT['--ink']);
});
