import sharp from 'sharp';

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
