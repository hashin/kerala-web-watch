import { createRequire } from 'node:module';
import { getDomain } from 'tldts';
import { httpGet, httpHead } from './net/http.js';

// robots-parser ships a malformed .d.ts (its `export default` sits outside the `declare module`
// block, so TS never actually types the import) -- loaded via `require` and typed by hand instead,
// the same workaround net/retire.ts uses for its own CommonJS dependency.
const require = createRequire(import.meta.url);
interface Robots {
  isAllowed(url: string, ua?: string): boolean | undefined;
}
const robotsParser: (url: string, contents: string) => Robots = require('robots-parser');

export interface CrawlLink {
  href: string;
  text: string;
}

export interface CrawlLinkStatus {
  url: string;
  status: number | 'timeout';
}

/** One outbound (off-host) domain the crawl saw a link to, for WP3.6's `discover.yml` feed --
 * `count` is the number of distinct link URLs to that host on the pages this crawl visited,
 * `texts` up to 3 distinct anchor texts (a human skimming a discovery PR reads these, not the
 * count) sampled in link order. */
export interface CrawlOutlink {
  host: string;
  count: number;
  texts: string[];
}

export interface CrawlResult {
  pagesChecked: number;
  brokenLinks: CrawlLinkStatus[];
  pdfsChecked: number;
  brokenPdfs: CrawlLinkStatus[];
  outboundDomains: string[];
  outlinks: CrawlOutlink[];
}

const MAX_OUTLINK_TEXTS = 3;

export interface CrawlOptions {
  /** CLAUDE.md's politeness cap: ≤ 30 pages + ≤ 20 PDFs per site per audit. */
  maxPages?: number;
  maxPdfs?: number;
  timeoutMs?: number;
  userAgent?: string;
  /** ≥ 1 req/s per host (CLAUDE.md). Injectable so tests don't have to actually wait. */
  minIntervalMs?: number;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  /** Skips the real network `robots.txt` fetch -- tests pass the body directly. */
  robotsTxt?: string;
}

const DEFAULT_MAX_PAGES = 30;
const DEFAULT_MAX_PDFS = 20;
const PDF_LINK = /\.pdf(?:[?#]|$)/i;

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isPdf(url: string): boolean {
  return PDF_LINK.test(new URL(url).pathname);
}

/**
 * A same-host, 1-req/s-paced fetch queue. Almost every crawl target shares the site's own host,
 * so a single "wait until `minIntervalMs` has passed since the last request" gate (not a full
 * per-host token bucket) is enough here -- crawl.ts never fans out across hosts.
 */
class PoliteFetcher {
  private lastRequestAt = -Infinity;
  constructor(
    private readonly minIntervalMs: number,
    private readonly sleep: (ms: number) => Promise<void>,
    private readonly now: () => number,
  ) {}

  async wait(): Promise<void> {
    const elapsed = this.now() - this.lastRequestAt;
    if (elapsed < this.minIntervalMs) await this.sleep(this.minIntervalMs - elapsed);
    this.lastRequestAt = this.now();
  }
}

async function statusOf(url: string, fetcher: PoliteFetcher, timeoutMs: number, userAgent?: string): Promise<number | 'timeout'> {
  await fetcher.wait();
  const result = await httpGet(url, { timeoutMs, userAgent, maxBodyBytes: 1 });
  if (result.errorKind === 'timeout') return 'timeout';
  if (result.errorKind || result.status === null) return 0; // unreachable, distinct from a real status but still "broken"
  return result.status;
}

/** PDFs get a HEAD first (cheaper -- we don't need the body) and only fall back to a GET when the
 * server doesn't answer HEAD usefully (405, or no status at all). */
async function pdfStatusOf(url: string, fetcher: PoliteFetcher, timeoutMs: number, userAgent?: string): Promise<number | 'timeout'> {
  await fetcher.wait();
  const head = await httpHead(url, { timeoutMs, userAgent });
  if (head.errorKind === 'timeout') return 'timeout';
  if (!head.errorKind && head.status !== null && head.status !== 405) return head.status;
  await fetcher.wait();
  const get = await httpGet(url, { timeoutMs, userAgent, maxBodyBytes: 1 });
  if (get.errorKind === 'timeout') return 'timeout';
  if (get.errorKind || get.status === null) return 0;
  return get.status;
}

function isBroken(status: number | 'timeout'): boolean {
  return status === 'timeout' || status === 0 || status >= 400;
}

/**
 * Homepage-driven crawl (DESIGN §5.1/CLAUDE.md politeness rules, IMPLEMENTATION.md WP3.5 step 3):
 * from the homepage's own links, follows same-registrable-domain, non-PDF pages up to `maxPages`
 * and samples up to `maxPdfs` linked PDFs, recording which return 4xx/5xx/time out. `robots.txt`
 * is respected for every one of these (the homepage itself is exempt, but it was already fetched
 * by `capture.ts` before this runs, not fetched again here).
 */
export async function crawl(homepageUrl: string, links: CrawlLink[], opts: CrawlOptions = {}): Promise<CrawlResult> {
  const maxPages = opts.maxPages ?? DEFAULT_MAX_PAGES;
  const maxPdfs = opts.maxPdfs ?? DEFAULT_MAX_PDFS;
  const timeoutMs = opts.timeoutMs ?? 20_000;
  const homeDomain = getDomain(new URL(homepageUrl).hostname);
  const origin = new URL(homepageUrl).origin;

  const robotsTxt = opts.robotsTxt ?? (await fetchRobotsTxtBody(origin, timeoutMs, opts.userAgent));
  const robots = robotsTxt !== null ? robotsParser(`${origin}/robots.txt`, robotsTxt) : null;

  const resolved = new Set<string>();
  const outboundDomains = new Set<string>();
  const outlinksByHost = new Map<string, { count: number; texts: string[] }>();
  const samePages: string[] = [];
  const samePdfs: string[] = [];

  for (const link of links) {
    let absolute: string;
    try {
      absolute = new URL(link.href, homepageUrl).toString();
    } catch {
      continue;
    }
    if (!absolute.startsWith('http://') && !absolute.startsWith('https://')) continue;
    if (resolved.has(absolute)) continue;
    resolved.add(absolute);

    const linkDomain = getDomain(new URL(absolute).hostname);
    if (linkDomain !== homeDomain) {
      if (linkDomain) {
        outboundDomains.add(linkDomain);
        const entry = outlinksByHost.get(linkDomain) ?? { count: 0, texts: [] };
        entry.count++;
        const text = link.text.trim();
        if (text && entry.texts.length < MAX_OUTLINK_TEXTS && !entry.texts.includes(text)) entry.texts.push(text);
        outlinksByHost.set(linkDomain, entry);
      }
      continue;
    }
    if (robots && robots.isAllowed(absolute, opts.userAgent) === false) continue;
    if (isPdf(absolute)) {
      if (samePdfs.length < maxPdfs) samePdfs.push(absolute);
    } else if (samePages.length < maxPages) {
      samePages.push(absolute);
    }
  }

  const fetcher = new PoliteFetcher(opts.minIntervalMs ?? 1000, opts.sleep ?? defaultSleep, opts.now ?? Date.now);
  const brokenLinks: CrawlLinkStatus[] = [];
  for (const url of samePages) {
    const status = await statusOf(url, fetcher, timeoutMs, opts.userAgent);
    if (isBroken(status)) brokenLinks.push({ url, status });
  }
  const brokenPdfs: CrawlLinkStatus[] = [];
  for (const url of samePdfs) {
    const status = await pdfStatusOf(url, fetcher, timeoutMs, opts.userAgent);
    if (isBroken(status)) brokenPdfs.push({ url, status });
  }

  return {
    pagesChecked: samePages.length,
    brokenLinks,
    pdfsChecked: samePdfs.length,
    brokenPdfs,
    outboundDomains: [...outboundDomains],
    outlinks: [...outlinksByHost.entries()].map(([host, { count, texts }]) => ({ host, count, texts })),
  };
}

async function fetchRobotsTxtBody(origin: string, timeoutMs: number, userAgent?: string): Promise<string | null> {
  const result = await httpGet(`${origin}/robots.txt`, { timeoutMs, userAgent });
  if (result.errorKind || result.status !== 200 || result.body === null) return null;
  return result.body;
}
