import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { buildScreenshot } from '../src/runner.js';
import type { CaptureResult } from '../src/capture.js';
import type { Result } from '../src/store.js';

function solidPng(hex: { r: number; g: number; b: number }): Promise<Buffer> {
  return sharp({ create: { width: 40, height: 40, channels: 3, background: hex } })
    .png()
    .toBuffer();
}

function capture(png: Buffer): CaptureResult {
  return {
    finalUrl: 'https://test.kerala.gov.in/',
    status: 200,
    headers: {},
    html: '<html></html>',
    text: '',
    links: [],
    cssTexts: [],
    scriptUrls: [],
    scripts: [],
    consoleErrors: [],
    requests: [],
    axe: { critical: 0, serious: 0, moderate: 0, minor: 0, byRule: {} },
    desktopScreenshot: png,
    mobileScreenshot: png,
  };
}

describe('buildScreenshot', () => {
  it('names the screenshot after the site id, not the capture date', async () => {
    const png = await solidPng({ r: 10, g: 20, b: 30 });
    const outcome = await buildScreenshot('keralapsc', null, capture(png));
    expect(outcome.record?.desktop).toBe('keralapsc.webp');
    expect(outcome.record?.mobile).toBe('keralapsc-m.webp');
  });

  // The bug this guards: a date-only filename (`2026-09-22.webp`) is identical for every site
  // captured that day, so two sites audited in the same batch would silently overwrite each
  // other's screenshot file and both `Result.json`s would end up pointing at whichever capture
  // wrote last (found live in WP4.1's site-page dogfooding, see runner.ts's own comment).
  it('gives two different sites two different filenames even when captured at the same moment', async () => {
    const pngA = await solidPng({ r: 10, g: 20, b: 30 });
    const pngB = await solidPng({ r: 200, g: 100, b: 50 });
    const [a, b] = await Promise.all([
      buildScreenshot('site-a', null, capture(pngA)),
      buildScreenshot('site-b', null, capture(pngB)),
    ]);
    expect(a.record?.desktop).not.toBe(b.record?.desktop);
    expect(a.record?.mobile).not.toBe(b.record?.mobile);
  });

  it('keeps the previous record, untouched, when the phash has not moved', async () => {
    const png = await solidPng({ r: 10, g: 20, b: 30 });
    const first = await buildScreenshot('keralapsc', null, capture(png));
    const existing: Result = {
      id: 'keralapsc',
      url: 'https://keralapsc.gov.in/',
      light: null,
      deep: {
        at: '2026-09-21T00:00:00.000Z',
        run: 'run-1',
        vantage: 'gh-us',
        lighthouse: null,
        axe: { critical: 0, serious: 0, moderate: 0, minor: 0 },
        crawl: { pages: 0, pdfs: 0, broken: 0 },
        tech: { cms: null, server: null, jquery: null },
        checks: [],
        screenshot: first.record,
        outlinks: [],
      },
      score: null,
      status: 'unaudited',
      issues: [],
      history: [],
      deep_bump: false,
    };
    const second = await buildScreenshot('keralapsc', existing, capture(png));
    expect(second.record).toEqual(first.record);
    expect(second.buffers).toBeNull();
  });
});
