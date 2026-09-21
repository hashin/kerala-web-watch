import sharp from 'sharp';

/** ADR-017: a screenshot is only replaced when its aHash moves by more than this many bits from
 * the one already on file -- shared by `runner.ts` (gates a single `cli run`'s own write) and
 * `merge.ts` (gates whether a shard's fresh screenshot replaces `data/`'s stored one) so the two
 * call sites can't drift to different thresholds. */
export const PHASH_REPLACE_THRESHOLD = 10;

/** IMPLEMENTATION.md §A.8: 8x8 grayscale, mean-threshold average hash as a 64-bit hex string. Two
 * screenshots of the same page taken minutes apart hash identically even with a few different
 * pixels (a live clock, an ad); only a real visual change should move it by more than a few bits. */
export async function averageHash(png: Buffer): Promise<string> {
  const raw = await sharp(png).resize(8, 8, { fit: 'fill' }).grayscale().raw().toBuffer();
  const mean = raw.reduce((sum, v) => sum + v, 0) / raw.length;
  let bits = '';
  for (const pixel of raw) bits += pixel >= mean ? '1' : '0';
  let hex = '';
  for (let i = 0; i < bits.length; i += 4) hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
  return hex;
}

/** Hamming distance between two same-length hex aHash strings, compared nibble by nibble. */
export function hammingDistance(a: string, b: string): number {
  if (a.length !== b.length) return Number.POSITIVE_INFINITY;
  let distance = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    distance += diff.toString(2).split('1').length - 1;
  }
  return distance;
}

/** ADR-017: screenshots are stored as WebP q60. */
export async function toWebp(png: Buffer): Promise<Buffer> {
  return sharp(png).webp({ quality: 60 }).toBuffer();
}

export interface StoredScreenshot {
  desktop: string;
  mobile: string;
  phash: string;
}

export interface ScreenshotDecision {
  screenshot: StoredScreenshot | null;
  /** True when `screenshot` is the fresh one and its files still need copying into place --
   * false either because there was nothing fresh to consider or because it was close enough to
   * the one already on file that the old files (and record) were kept as-is. */
  replaced: boolean;
}

/**
 * WP3.6 merge step 2: "copy only if no existing file or aHash Hamming distance > threshold" --
 * the CI-shard version of ADR-017's gate. `runner.ts`'s own `buildScreenshot` already applies
 * this gate too, but a shard's `cli run` only ever sees the scratch `out/` it just created (never
 * `data/`'s real prior screenshot -- see docs/HANDOFF.md), so its gate is always a no-op in CI:
 * `merge.ts` is where the comparison against what's actually on `data/` has to happen. */
export function pickScreenshot(existing: StoredScreenshot | null, fresh: StoredScreenshot | null): ScreenshotDecision {
  if (!fresh) return { screenshot: existing, replaced: false };
  if (existing && hammingDistance(existing.phash, fresh.phash) <= PHASH_REPLACE_THRESHOLD) {
    return { screenshot: existing, replaced: false };
  }
  return { screenshot: fresh, replaced: true };
}
