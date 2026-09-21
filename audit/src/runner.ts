import { detectTech } from './checks/identity.js';
import { runChecks } from './checks/index.js';
import type { CheckContext } from './checks/types.js';
import { capture, type CaptureResult } from './capture.js';
import { crawl } from './crawl.js';
import { domainExpiryDays } from './net/rdap.js';
import { scanForVulnerableLibraries } from './net/retire.js';
import { isFlaggedBySafeBrowsing } from './net/safebrowsing.js';
import { lightCheck, type LightResult } from './light.js';
import { runLighthouse, type LighthouseResult } from './lighthouse.js';
import { checkWwwConsistency, fetchRobotsTxt, fetchSitemapXmlStatus, fetchSoft404Status, registrableDomainOf } from './probes.js';
import { averageHash, hammingDistance, PHASH_REPLACE_THRESHOLD, toWebp } from './screenshot.js';
import { scoreSite } from './score.js';
import { mergeErrorResult, mergeRunResult, type DeepResult, type Result } from './store.js';
import type { Site } from './types.js';

const JQUERY_VERSION = /jquery[.-]?(\d+\.\d+\.\d+)/i;
const DEFAULT_UA = 'KeralaWebWatch/1.0 (+https://govwebsite.hashin.me/about; civic audit)';

export interface RunOptions {
  vantage?: string;
  userAgent?: string;
  runId?: string;
  noLighthouse?: boolean;
  noCrawl?: boolean;
  now?: () => Date;
  timeoutMs?: number;
  safeBrowsingApiKey?: string;
  rdapBaseUrl?: string;
  safeBrowsingEndpoint?: string;
  retireJsrepo?: string;
  /** `self-test`'s fixture registry entries use well-known `*.localhost` hostnames (e.g.
   * `http://good.localhost/`) with no port, since the fixture server's actual port is only known
   * once it's listening. `--fixture-base http://localhost:<port>` reattaches that real port
   * (keeping the site's own subdomain label) instead of needing the registry to guess it. */
  fixtureBase?: string;
}

/** `http://good.localhost/some/path` + `http://localhost:4173` -> `http://good.localhost:4173/some/path`. */
export function withFixtureBase(url: string, fixtureBase: string): string {
  const target = new URL(url);
  const base = new URL(fixtureBase);
  const label = target.hostname.split('.')[0];
  target.protocol = base.protocol;
  target.hostname = `${label}.${base.hostname}`;
  target.port = base.port;
  return target.toString();
}

export interface RunOutput {
  result: Result;
  screenshots: { desktop: Buffer; mobile: Buffer } | null;
}

/**
 * The whole per-site deep-audit pipeline (IMPLEMENTATION.md WP3.5 step 5): light -> capture ->
 * lighthouse -> crawl -> the handful of plain-HTTP probes -> `CheckContext` -> `runChecks` ->
 * `scoreSite` -> a `Result`. Never throws: an uncaught error anywhere in the pipeline is caught
 * here and folded into a `deep.error` record with the site's previous status left untouched (step
 * 5's own "on any uncaught error write a record with deep.error and status unchanged"), since one
 * site failing must never abort a whole batch.
 */
export async function runDeepAudit(site: Site, existing: Result | null, opts: RunOptions = {}): Promise<RunOutput> {
  const now = opts.now ?? (() => new Date());
  const vantage = opts.vantage ?? 'gh-us';
  const runId = opts.runId ?? String(Date.now());
  const userAgent = opts.userAgent ?? DEFAULT_UA;
  const targetUrl = opts.fixtureBase ? withFixtureBase(site.url, opts.fixtureBase) : site.url;

  const light = await lightCheck(targetUrl, { userAgent });

  try {
    const deepUrl = light.final_url ?? targetUrl;
    const origin = new URL(deepUrl).origin;

    const capturePromise = capture(deepUrl, { timeoutMs: opts.timeoutMs, userAgent });
    const lighthousePromise = opts.noLighthouse ? Promise.resolve(undefined) : runLighthouse(deepUrl);
    // capture() can outlast a Lighthouse run that fails fast (e.g. a closed target), so
    // lighthousePromise may reject before the `Promise.all` below ever attaches a handler to it --
    // Node treats that as an unhandled rejection and kills the whole process. This no-op `.catch`
    // marks the promise handled immediately; the real rejection still reaches `Promise.all` below.
    lighthousePromise.catch(() => {});
    const robotsPromise = fetchRobotsTxt(origin, { userAgent });
    const sitemapPromise = fetchSitemapXmlStatus(origin, { userAgent });
    const soft404Promise = fetchSoft404Status(origin, { userAgent });
    const wwwPromise = checkWwwConsistency(new URL(deepUrl).hostname, { userAgent });
    const domain = registrableDomainOf(deepUrl);
    const domainExpiryPromise = domain ? domainExpiryDays(domain, { baseUrl: opts.rdapBaseUrl }) : Promise.resolve(null);
    const safeBrowsingPromise = isFlaggedBySafeBrowsing(deepUrl, { apiKey: opts.safeBrowsingApiKey, endpoint: opts.safeBrowsingEndpoint });

    const captured = await capturePromise;
    const crawlResult = opts.noCrawl ? undefined : await crawl(deepUrl, captured.links, { userAgent });
    const vulnerableLibraries = await scanForVulnerableLibraries(captured.scripts, { jsrepo: opts.retireJsrepo });

    const [lighthouseResult, robotsTxt, sitemapXmlStatus, soft404Status, wwwConsistent, domainExpiry, safeBrowsingFlagged] = await Promise.all([
      lighthousePromise,
      robotsPromise,
      sitemapPromise,
      soft404Promise,
      wwwPromise,
      domainExpiryPromise,
      safeBrowsingPromise,
    ]);

    const ctx = buildContext({
      site,
      light,
      captured,
      lighthouse: lighthouseResult,
      crawlResult,
      history: existing?.history,
      robotsTxt,
      sitemapXmlStatus,
      soft404Status,
      wwwConsistent,
      domainExpiry,
      safeBrowsingFlagged,
      vulnerableLibraries: [...vulnerableLibraries.values()].flat(),
    });

    const checks = runChecks(ctx);
    const scoreOutcome = scoreSite(checks);
    const screenshot = await buildScreenshot(existing, captured, now);
    const deep: DeepResult = {
      at: now().toISOString(),
      run: runId,
      vantage,
      lighthouse: lighthouseResult ? { performance: lighthouseResult.performance, accessibility: lighthouseResult.accessibility, best_practices: lighthouseResult.bestPractices, seo: lighthouseResult.seo } : null,
      axe: { critical: captured.axe.critical, serious: captured.axe.serious, moderate: captured.axe.moderate, minor: captured.axe.minor },
      crawl: { pages: crawlResult?.pagesChecked ?? 0, pdfs: crawlResult?.pdfsChecked ?? 0, broken: (crawlResult?.brokenLinks.length ?? 0) + (crawlResult?.brokenPdfs.length ?? 0) },
      tech: buildTech(captured, light),
      checks,
      screenshot: screenshot.record,
      outlinks: crawlResult?.outlinks ?? [],
    };

    const result = mergeRunResult(existing, site, light, deep, scoreOutcome, { vantage, today: today(now()) });
    return { result, screenshots: screenshot.buffers };
  } catch (err) {
    const result = mergeErrorResult(existing, site, light, err, { vantage, today: today(now()), runId, now: now() });
    return { result, screenshots: null };
  }
}

function today(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function buildTech(captured: CaptureResult, light: LightResult): DeepResult['tech'] {
  const detected = detectTech(captured.html);
  const jqueryMatch = [captured.html, ...captured.scriptUrls].join('\n').match(JQUERY_VERSION);
  return {
    cms: detected ? `${detected.name} ${detected.version}` : null,
    server: light.headers.server,
    jquery: jqueryMatch ? jqueryMatch[1] : null,
  };
}

interface ScreenshotOutcome {
  record: DeepResult['screenshot'];
  buffers: { desktop: Buffer; mobile: Buffer } | null;
}

/** ADR-017: only replace the stored screenshot when the desktop view's aHash moved by more than
 * `PHASH_REPLACE_THRESHOLD` bits from last time -- otherwise keep the previous record (and don't
 * hand the caller fresh buffers to write) so a cosmetic non-change doesn't touch the data branch. */
async function buildScreenshot(existing: Result | null, captured: CaptureResult, now: () => Date): Promise<ScreenshotOutcome> {
  const phash = await averageHash(captured.desktopScreenshot);
  const previous = existing?.deep?.screenshot;
  if (previous && hammingDistance(previous.phash, phash) <= PHASH_REPLACE_THRESHOLD) {
    return { record: previous, buffers: null };
  }
  const [desktop, mobile] = await Promise.all([toWebp(captured.desktopScreenshot), toWebp(captured.mobileScreenshot)]);
  return {
    record: { desktop: `${today(now())}.webp`, mobile: `${today(now())}-m.webp`, phash },
    buffers: { desktop, mobile },
  };
}

function buildContext(input: {
  site: Site;
  light: LightResult;
  captured: CaptureResult;
  lighthouse: LighthouseResult | null | undefined;
  crawlResult: Awaited<ReturnType<typeof crawl>> | undefined;
  history: CheckContext['history'];
  robotsTxt: CheckContext['robotsTxt'];
  sitemapXmlStatus: number | undefined;
  soft404Status: number | undefined;
  wwwConsistent: boolean | undefined;
  domainExpiry: number | null;
  safeBrowsingFlagged: boolean | null;
  vulnerableLibraries: { library: string; version: string | null; cve: string[] }[];
}): CheckContext {
  return {
    site: input.site,
    light: input.light,
    html: input.captured.html,
    text: input.captured.text,
    headers: input.captured.headers,
    status: input.captured.status ?? undefined,
    finalUrl: input.captured.finalUrl,
    cssTexts: input.captured.cssTexts,
    scriptUrls: input.captured.scriptUrls,
    consoleErrors: input.captured.consoleErrors,
    history: input.history,
    robotsTxt: input.robotsTxt,
    sitemapXmlStatus: input.sitemapXmlStatus,
    domainExpiryDays: input.domainExpiry,
    wwwConsistent: input.wwwConsistent,
    soft404Status: input.soft404Status,
    requests: input.captured.requests,
    axe: input.captured.axe,
    lighthouse: input.lighthouse,
    crawl: input.crawlResult,
    vulnerableLibraries: input.vulnerableLibraries,
    safeBrowsingFlagged: input.safeBrowsingFlagged ?? undefined,
  };
}
