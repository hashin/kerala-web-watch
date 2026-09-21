/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
// The reference above types the `page.evaluate()` closures below, which run in the browser, not
// Node -- scoped to this file alone so the rest of the package's Node-only code doesn't gain DOM
// globals in its ambient type surface.
import { createRequire } from 'node:module';
import { chromium, type Page } from 'playwright';
import type { AxeResults } from 'axe-core';
import type { CheckContext } from './checks/types.js';
import type { CrawlLink } from './crawl.js';

// @axe-core/playwright's own published `exports["."].types` resolves to a CommonJS-shaped .d.ts
// that TypeScript's NodeNext resolution can't reconcile with the package's dual ESM/CJS build
// ("This expression is not constructable"), even though the class works fine at runtime -- loaded
// via `require` and typed by hand instead, the same workaround crawl.ts uses for robots-parser.
const require = createRequire(import.meta.url);
interface AxeBuilderLike {
  withTags(tags: string[]): this;
  analyze(): Promise<AxeResults>;
}
const AxeBuilder: new (opts: { page: Page }) => AxeBuilderLike = require('@axe-core/playwright').default;

const DEFAULT_UA = 'KeralaWebWatch/1.0 (+https://govwebsite.hashin.me/about; civic audit)';
const DESKTOP_VIEWPORT = { width: 1280, height: 800 };
const MOBILE_VIEWPORT = { width: 390, height: 844 };
const MAX_STYLESHEETS = 20;
const MAX_FONT_SAMPLE = 20;
const MAX_SCRIPTS_SCANNED = 20;

export interface CapturedRequest {
  url: string;
  type: string;
  status?: number;
  bytes?: number;
}

export interface CaptureResult {
  finalUrl: string;
  status: number | null;
  /** The homepage document's own response headers, lowercased -- what `sec.hsts`/`csp`/`xfo`/
   * `xcto`/`referrer`/`server_banner` read as `ctx.headers` (deliberately separate from
   * `light.headers`'s booleans, per WP3.3). */
  headers: Record<string, string>;
  html: string;
  text: string;
  links: CrawlLink[];
  cssTexts: string[];
  scriptUrls: string[];
  /** Contents of up to `MAX_SCRIPTS_SCANNED` of `scriptUrls`, read from the browser's own cache
   * (no re-fetch) -- what `sec.vuln_js`'s retire.js scan needs, since it fingerprints library
   * source, not URLs. */
  scripts: { url: string; content: string }[];
  consoleErrors: string[];
  requests: CapturedRequest[];
  axe: NonNullable<CheckContext['axe']>;
  desktopScreenshot: Buffer;
  mobileScreenshot: Buffer;
}

export interface CaptureOptions {
  timeoutMs?: number;
  userAgent?: string;
  axeTags?: string[];
}

const DEFAULT_AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'];

/**
 * One Chromium context per site (WP3.5 step 1): navigates, then reads off everything the deep
 * audit's checks need from a single page load -- HTML, rendered text, links, CSS, script URLs,
 * console/page errors, subresource requests, an axe-core pass, and both viewport screenshots.
 * Never throws on a page-level problem (axe failing, a console error) -- only a genuine navigation
 * failure (`page.goto` itself rejecting) propagates, since the caller (`runner.ts`) already has its
 * own per-site error handling for that.
 */
export async function capture(url: string, opts: CaptureOptions = {}): Promise<CaptureResult> {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const context = await browser.newContext({
      locale: 'ml-IN',
      userAgent: opts.userAgent ?? DEFAULT_UA,
      viewport: DESKTOP_VIEWPORT,
    });
    const page = await context.newPage();

    const requests: CapturedRequest[] = [];
    const requestType = new Map<string, string>();
    page.on('request', (req) => requestType.set(req.url(), req.resourceType()));
    page.on('response', (res) => {
      const contentLength = res.headers()['content-length'];
      requests.push({
        url: res.url(),
        type: requestType.get(res.url()) ?? 'other',
        status: res.status(),
        bytes: contentLength ? Number(contentLength) : undefined,
      });
    });

    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(err.message));

    const timeoutMs = opts.timeoutMs ?? 30_000;
    let response;
    try {
      response = await page.goto(url, { waitUntil: 'networkidle', timeout: timeoutMs });
    } catch {
      response = await page.goto(url, { waitUntil: 'load', timeout: timeoutMs });
    }

    const html = await page.content();
    const text = await page.evaluate(() => document.body?.innerText ?? '');
    const links = await extractLinks(page);
    const cssTexts = await extractCssTexts(page, requests);
    const scriptUrls = extractScriptUrls(html, page.url());
    const scripts = await extractScripts(page, scriptUrls);

    const axeResults = await new AxeBuilder({ page }).withTags(opts.axeTags ?? DEFAULT_AXE_TAGS).analyze();
    const axe = summarizeAxe(axeResults.violations);

    const desktopScreenshot = await page.screenshot({ type: 'png' });
    await page.setViewportSize(MOBILE_VIEWPORT);
    const mobileScreenshot = await page.screenshot({ type: 'png' });

    const finalUrl = page.url();
    const status = response?.status() ?? null;
    const headers = response ? await response.allHeaders() : {};

    await context.close();

    return {
      finalUrl,
      status,
      headers,
      html,
      text,
      links,
      cssTexts,
      scriptUrls,
      scripts,
      consoleErrors,
      requests,
      axe,
      desktopScreenshot,
      mobileScreenshot,
    };
  } finally {
    await browser.close();
  }
}

async function extractLinks(page: Page): Promise<CrawlLink[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll('a[href]')].map((a) => ({
      href: (a as HTMLAnchorElement).getAttribute('href') ?? '',
      text: (a.textContent ?? '').trim(),
    })),
  );
}

/** Inline `<style>` bodies plus the text of up to `MAX_STYLESHEETS` same-origin linked stylesheets
 * -- reusing the response bodies already captured in the request log instead of re-fetching them
 * (IMPLEMENTATION.md step 1: "do not re-fetch"). Also folds in the computed `font-family` of
 * `<body>` and its `MAX_FONT_SAMPLE` largest text nodes as synthetic CSS-like declarations, so
 * `content.legacy_font`'s existing haystack search picks up a legacy font applied only via a
 * computed/inherited style, not just a literal `font-family:` string in the source. */
async function extractCssTexts(page: Page, requests: CapturedRequest[]): Promise<string[]> {
  const inline = await page.evaluate(() => [...document.querySelectorAll('style')].map((s) => s.textContent ?? ''));
  const stylesheetUrls = requests.filter((r) => r.type === 'stylesheet').slice(0, MAX_STYLESHEETS);
  const stylesheetTexts: string[] = [];
  for (const req of stylesheetUrls) {
    try {
      const text = await page.evaluate((u) => fetch(u).then((r) => r.text()), req.url);
      stylesheetTexts.push(text);
    } catch {
      // A stylesheet that can no longer be fetched (already-closed context, transient network
      // blip) just contributes nothing -- content.legacy_font's other sources still apply.
    }
  }
  const fonts = await page.evaluate((maxSample: number) => {
    const body = document.body;
    if (!body) return [];
    const bodyFont = `body { font-family: ${getComputedStyle(body).fontFamily}; }`;
    const textNodes = [...document.querySelectorAll('body *')]
      .filter((el) => (el.textContent ?? '').trim().length > 0)
      .sort((a, b) => (b.textContent?.length ?? 0) - (a.textContent?.length ?? 0))
      .slice(0, maxSample)
      .map((el) => `* { font-family: ${getComputedStyle(el).fontFamily}; }`);
    return [bodyFont, ...textNodes];
  }, MAX_FONT_SAMPLE);
  return [...inline, ...stylesheetTexts, ...fonts];
}

const SCRIPT_SRC = /<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi;

/** Up to `MAX_SCRIPTS_SCANNED` script bodies, read via the page's own `fetch` (browser cache, no
 * new network round trip) -- `net/retire.ts`'s vulnerability scan needs the actual source. */
async function extractScripts(page: Page, scriptUrls: string[]): Promise<{ url: string; content: string }[]> {
  const scripts: { url: string; content: string }[] = [];
  for (const url of scriptUrls.slice(0, MAX_SCRIPTS_SCANNED)) {
    try {
      const content = await page.evaluate((u) => fetch(u).then((r) => r.text()), url);
      scripts.push({ url, content });
    } catch {
      // A script that can no longer be fetched contributes nothing to the vuln scan; it isn't a
      // reason to fail the whole capture.
    }
  }
  return scripts;
}

export function extractScriptUrls(html: string, baseUrl: string): string[] {
  const urls: string[] = [];
  for (const match of html.matchAll(SCRIPT_SRC)) {
    try {
      urls.push(new URL(match[1], baseUrl).toString());
    } catch {
      // an unparseable src attribute (e.g. a raw template placeholder) isn't a real script URL
    }
  }
  return urls;
}

export interface AxeViolation {
  id: string;
  impact?: string | null;
  nodes: unknown[];
}

export function summarizeAxe(violations: AxeViolation[]): NonNullable<CheckContext['axe']> {
  const summary = { critical: 0, serious: 0, moderate: 0, minor: 0, byRule: {} as Record<string, number> };
  for (const violation of violations) {
    const count = violation.nodes.length;
    summary.byRule[violation.id] = (summary.byRule[violation.id] ?? 0) + count;
    if (violation.impact === 'critical') summary.critical += count;
    else if (violation.impact === 'serious') summary.serious += count;
    else if (violation.impact === 'moderate') summary.moderate += count;
    else if (violation.impact === 'minor') summary.minor += count;
  }
  return summary;
}
