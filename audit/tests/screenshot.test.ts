import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { averageHash, hammingDistance, PHASH_REPLACE_THRESHOLD, pickScreenshot, toWebp } from '../src/screenshot.js';

// A 16-nibble (64-bit) aHash string exactly `distance` bits away from all-zero, spreading the set
// bits low-nibble-first -- lets the boundary tests below pin down an exact Hamming distance
// instead of relying on real screenshot bytes to happen to land there.
function hashAtDistance(distance: number): string {
  if (distance < 0 || distance > 64) throw new Error('a 16-nibble hash only has 64 bits');
  let hex = '';
  for (let nibble = 0; nibble < 16; nibble++) {
    const bitsSet = Math.min(4, Math.max(0, distance - nibble * 4));
    hex += ((1 << bitsSet) - 1).toString(16);
  }
  return hex;
}

function solidPng(hex: { r: number; g: number; b: number }): Promise<Buffer> {
  return sharp({ create: { width: 40, height: 40, channels: 3, background: hex } })
    .png()
    .toBuffer();
}

function checkerPng(): Promise<Buffer> {
  const half = 20;
  const svg = Buffer.from(
    `<svg width="40" height="40"><rect width="${half}" height="${half}" fill="black"/><rect x="${half}" y="${half}" width="${half}" height="${half}" fill="black"/><rect x="${half}" width="${half}" height="${half}" fill="white"/><rect y="${half}" width="${half}" height="${half}" fill="white"/></svg>`,
  );
  return sharp(svg).png().toBuffer();
}

describe('averageHash', () => {
  it('produces the same hash for the same image', async () => {
    const png = await solidPng({ r: 10, g: 20, b: 30 });
    expect(await averageHash(png)).toBe(await averageHash(png));
  });
  it('produces different hashes for very different images', async () => {
    const white = await solidPng({ r: 255, g: 255, b: 255 });
    const checker = await checkerPng();
    expect(await averageHash(white)).not.toBe(await averageHash(checker));
  });
  it('hashes a solid-colour image to all-1 bits (every pixel equals the mean)', async () => {
    // A concrete expected value, not a re-derivation of averageHash's own logic: every 8x8 sample
    // of a solid-colour image equals the mean exactly, so the >= comparison sets every bit -- a
    // flipped threshold (`>` instead of `>=`) would silently zero every bit instead, undetected by
    // the equality/inequality checks above.
    const png = await solidPng({ r: 10, g: 20, b: 30 });
    expect(await averageHash(png)).toBe('ffffffffffffffff');
  });
});

describe('hammingDistance', () => {
  it('is zero for identical hashes', () => {
    expect(hammingDistance('abcd', 'abcd')).toBe(0);
  });
  it('counts differing bits between two hex strings', () => {
    expect(hammingDistance('0000', '0001')).toBe(1); // 0 vs 1 = 0001, one bit differs
    expect(hammingDistance('0000', 'ffff')).toBe(16); // every bit in every nibble differs
  });
  it('is infinite for hashes of mismatched length rather than comparing a truncated prefix', () => {
    // Both directions: a shorter than b, and a longer than b (an asymmetric guard like `a.length
    // < b.length` would silently miss the second case).
    expect(hammingDistance('0000', '00000')).toBe(Number.POSITIVE_INFINITY);
    expect(hammingDistance('00000', '0000')).toBe(Number.POSITIVE_INFINITY);
  });
});

describe('toWebp', () => {
  it('produces a valid webp buffer decodable back to the original dimensions', async () => {
    const png = await solidPng({ r: 1, g: 2, b: 3 });
    const webp = await toWebp(png);
    const meta = await sharp(webp).metadata();
    expect(meta.format).toBe('webp');
    expect(meta.width).toBe(40);
    expect(meta.height).toBe(40);
  });
});

describe('pickScreenshot (ADR-017 / WP3.6 merge step 2)', () => {
  const existing = { desktop: 'old.webp', mobile: 'old-m.webp', phash: hashAtDistance(0) };

  it('keeps the existing screenshot and does not flag a replacement when there is nothing fresh to consider', () => {
    expect(pickScreenshot(existing, null)).toEqual({ screenshot: existing, replaced: false });
  });

  it('uses the fresh screenshot when there is no existing one to compare against', () => {
    const fresh = { desktop: 'new.webp', mobile: 'new-m.webp', phash: hashAtDistance(0) };
    expect(pickScreenshot(null, fresh)).toEqual({ screenshot: fresh, replaced: true });
  });

  it(`keeps the existing screenshot at exactly the threshold distance (${PHASH_REPLACE_THRESHOLD})`, () => {
    const fresh = { desktop: 'new.webp', mobile: 'new-m.webp', phash: hashAtDistance(PHASH_REPLACE_THRESHOLD) };
    expect(pickScreenshot(existing, fresh)).toEqual({ screenshot: existing, replaced: false });
  });

  it(`replaces the screenshot one bit past the threshold distance (${PHASH_REPLACE_THRESHOLD + 1})`, () => {
    const fresh = { desktop: 'new.webp', mobile: 'new-m.webp', phash: hashAtDistance(PHASH_REPLACE_THRESHOLD + 1) };
    expect(pickScreenshot(existing, fresh)).toEqual({ screenshot: fresh, replaced: true });
  });
});
