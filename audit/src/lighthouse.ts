import * as chromeLauncher from 'chrome-launcher';
import lighthouse from 'lighthouse';
import { chromium } from 'playwright';
import type { CheckContext } from './checks/types.js';

export type LighthouseResult = NonNullable<CheckContext['lighthouse']>;

export interface LighthouseOptions {
  timeoutMs?: number;
}

export interface LhAudit {
  score: number | null;
  numericValue?: number;
}
export interface Lhr {
  categories: {
    performance?: { score: number | null };
    accessibility?: { score: number | null };
    'best-practices'?: { score: number | null };
    seo?: { score: number | null };
  };
  audits: Record<string, LhAudit | undefined>;
}

const DEFAULT_TIMEOUT_MS = 90_000;

/** IMPLEMENTATION.md §A.7: Lighthouse driven by Chrome via Playwright's own Chromium binary (one
 * fewer browser to keep in sync), mobile/slow-4G profile, one pass. Never throws -- a Lighthouse
 * failure (the page crashing it, a navigation error, Chrome not launching) is recorded as `null`
 * per WP3.5 step 2, since Lighthouse is explicitly non-authoritative (ADR-015) and one site's
 * failure must not abort the whole audit run. */
export async function runLighthouse(url: string, opts: LighthouseOptions = {}): Promise<LighthouseResult | null> {
  let chrome: chromeLauncher.LaunchedChrome | undefined;
  try {
    chrome = await chromeLauncher.launch({
      chromePath: chromium.executablePath(),
      chromeFlags: ['--headless=new', '--no-sandbox'],
    });
    const runnerResult = (await Promise.race([
      lighthouse(url, {
        port: chrome.port,
        output: 'json',
        logLevel: 'silent',
        onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
        formFactor: 'mobile',
        screenEmulation: { mobile: true, width: 390, height: 844, deviceScaleFactor: 3 },
      }),
      timeoutPromise(opts.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    ])) as { lhr: Lhr } | null;
    if (!runnerResult) return null;
    return summarize(runnerResult.lhr);
  } catch {
    return null;
  } finally {
    await chrome?.kill();
  }
}

function timeoutPromise(ms: number): Promise<null> {
  return new Promise((resolve) => setTimeout(() => resolve(null), ms));
}

function score100(audit: { score: number | null } | undefined): number {
  return audit?.score !== null && audit?.score !== undefined ? Math.round(audit.score * 100) : 0;
}

/** Keeps only the fields the `a11y.lighthouse`/`perf.*` checks actually read (IMPLEMENTATION.md
 * §A.7: "discard the rest, do not store the full LHR"). An "opportunity" audit's `score` is 1 when
 * there's nothing to improve and drops toward 0 the more savings Lighthouse thinks are available --
 * treated as "ok" at 0.9+ so a borderline page isn't flagged over noise. */
export function summarize(lhr: Lhr): LighthouseResult {
  // Lighthouse renamed these audits after IMPLEMENTATION.md §A.7 was written (confirmed against a
  // real Lighthouse 13.x run): `tap-targets` -> `target-size`, `uses-optimized-images` ->
  // `image-delivery-insight`. Both still carry the same 0-1 `score` this function reads.
  const tapTargets = lhr.audits['target-size'];
  const images = lhr.audits['image-delivery-insight'];
  return {
    performance: score100(lhr.categories.performance),
    accessibility: score100(lhr.categories.accessibility),
    bestPractices: score100(lhr.categories['best-practices']),
    seo: score100(lhr.categories.seo),
    lcpMs: lhr.audits['largest-contentful-paint']?.numericValue ?? null,
    cls: lhr.audits['cumulative-layout-shift']?.numericValue ?? null,
    totalByteWeightBytes: lhr.audits['total-byte-weight']?.numericValue ?? null,
    tapTargetsOk: tapTargets ? tapTargets.score !== null && tapTargets.score >= 0.9 : null,
    imagesOptimized: images ? images.score !== null && images.score >= 0.9 : null,
  };
}
