import type { Check, CheckResult } from './types.js';

const VIEWPORT_META = /<meta[^>]+name\s*=\s*["']viewport["']/i;
const WEIGHT_WARN_BYTES = 3 * 1024 * 1024;
const WEIGHT_FAIL_BYTES = 8 * 1024 * 1024;

/** Total transferred bytes, preferring the runner's own request log (summed `content-length`s,
 * when the server sent them) over Lighthouse's `total-byte-weight` audit -- both measure the same
 * thing, but the request log is already collected for `sec.mixed_content`/`content.broken_images`
 * regardless of whether `--no-lighthouse` was passed, so it's the more available source. */
function pageWeightBytes(ctx: { requests?: { bytes?: number }[]; lighthouse?: { totalByteWeightBytes: number | null } | null }): number | null {
  if (ctx.requests !== undefined) {
    const known = ctx.requests.filter((r): r is { bytes: number } => r.bytes !== undefined);
    if (known.length > 0) return known.reduce((sum, r) => sum + r.bytes, 0);
  }
  return ctx.lighthouse?.totalByteWeightBytes ?? null;
}

export const PERF_CHECKS: Check[] = [
  {
    id: 'perf.lighthouse',
    run: (ctx): CheckResult => {
      if (!ctx.lighthouse) return { id: 'perf.lighthouse', r: 'na' };
      return { id: 'perf.lighthouse', r: 'pass', ev: `${ctx.lighthouse.performance}/100` };
    },
  },
  {
    id: 'perf.lcp',
    run: (ctx): CheckResult => {
      const lcp = ctx.lighthouse?.lcpMs;
      if (lcp === undefined || lcp === null) return { id: 'perf.lcp', r: 'na' };
      return lcp > 4000 ? { id: 'perf.lcp', r: 'fail', ev: `${lcp}ms` } : { id: 'perf.lcp', r: 'pass' };
    },
  },
  {
    id: 'perf.cls',
    run: (ctx): CheckResult => {
      const cls = ctx.lighthouse?.cls;
      if (cls === undefined || cls === null) return { id: 'perf.cls', r: 'na' };
      return cls > 0.25 ? { id: 'perf.cls', r: 'fail', ev: cls.toFixed(2) } : { id: 'perf.cls', r: 'pass' };
    },
  },
  {
    id: 'perf.weight',
    run: (ctx): CheckResult => {
      const bytes = pageWeightBytes(ctx);
      if (bytes === null) return { id: 'perf.weight', r: 'na' };
      const mb = (bytes / (1024 * 1024)).toFixed(1);
      if (bytes > WEIGHT_FAIL_BYTES) return { id: 'perf.weight', r: 'fail', ev: `${mb}MB` };
      if (bytes > WEIGHT_WARN_BYTES) return { id: 'perf.weight', r: 'warn', ev: `${mb}MB` };
      return { id: 'perf.weight', r: 'pass' };
    },
  },
  {
    id: 'perf.viewport',
    run: (ctx): CheckResult => {
      if (ctx.html === undefined) return { id: 'perf.viewport', r: 'na' };
      return VIEWPORT_META.test(ctx.html) ? { id: 'perf.viewport', r: 'pass' } : { id: 'perf.viewport', r: 'fail' };
    },
  },
  {
    id: 'perf.tap_targets',
    run: (ctx): CheckResult => {
      const ok = ctx.lighthouse?.tapTargetsOk;
      if (ok === undefined || ok === null) return { id: 'perf.tap_targets', r: 'na' };
      return ok ? { id: 'perf.tap_targets', r: 'pass' } : { id: 'perf.tap_targets', r: 'fail' };
    },
  },
  {
    id: 'perf.images',
    run: (ctx): CheckResult => {
      const ok = ctx.lighthouse?.imagesOptimized;
      if (ok === undefined || ok === null) return { id: 'perf.images', r: 'na' };
      return ok ? { id: 'perf.images', r: 'pass' } : { id: 'perf.images', r: 'fail' };
    },
  },
];
