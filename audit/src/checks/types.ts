import type { HistoryEntry } from '../history.js';
import type { Site } from '../types.js';

export type Severity = 'C' | 'H' | 'M' | 'L' | 'I';

/** The six categories score.ts weights (ADR-006). `availability` is a seventh, unweighted
 * bucket for metadata/methodology purposes only -- DESIGN §5.4 calls availability "a gate, not a
 * component": its checks either pass silently or set status directly via `statusSetting`, and
 * never move a category score (see score.ts's `WEIGHTS`, which has no `availability` key). */
export type Category = 'availability' | 'security' | 'accessibility' | 'content' | 'gigw' | 'performance' | 'identity';
export type ScoredCategory = Exclude<Category, 'availability'>;

/** The status a ★ check sets directly when it fails, per DESIGN §5.4's status table. `unaudited`
 * doesn't appear here: it only ever means "no deep audit has run yet", which scoreSite (always
 * called *after* one just ran) can't produce. `down` here is a *deep-audit's own* observation
 * (avail.dns/connect/status failing during a full run) -- a separate thing from Phase 2's
 * two-strike light-check `down` (status.ts), which exists precisely because a lightweight 6-hourly
 * ping is flaky enough to need two consecutive failures before it's believed. A full deep-audit
 * run is deliberate enough that a single failure is credible on its own. */
export type StatusSetting = 'down' | 'hijacked' | 'broken' | 'unverifiable';

/** Every check id in DESIGN §5.3's catalogue (~90 checks across avail./sec./a11y./perf./content./
 * gigw./id.), written out by hand from that table so a typo anywhere (a check function, a registry
 * entry, a test) is a compile error rather than a silently-ignored string. */
export type CheckId =
  | 'avail.dns'
  | 'avail.connect'
  | 'avail.status'
  | 'avail.redirect_offsite'
  | 'avail.parked'
  | 'avail.default_page'
  | 'avail.blank'
  | 'avail.under_construction'
  | 'avail.ttfb'
  | 'avail.geo_blocked'
  | 'avail.flapping'
  | 'sec.https'
  | 'sec.http_redirect'
  | 'sec.cert_valid'
  | 'sec.cert_expiry'
  | 'sec.tls_version'
  | 'sec.hsts'
  | 'sec.mixed_content'
  | 'sec.csp'
  | 'sec.xfo'
  | 'sec.xcto'
  | 'sec.referrer'
  | 'sec.server_banner'
  | 'sec.vuln_js'
  | 'sec.safe_browsing'
  | 'a11y.axe_critical'
  | 'a11y.axe_serious'
  | 'a11y.axe_moderate_minor'
  | 'a11y.lang'
  | 'a11y.alt'
  | 'a11y.contrast'
  | 'a11y.headings'
  | 'a11y.labels'
  | 'a11y.skip_link'
  | 'a11y.keyboard'
  | 'a11y.lighthouse'
  | 'perf.lighthouse'
  | 'perf.lcp'
  | 'perf.cls'
  | 'perf.weight'
  | 'perf.viewport'
  | 'perf.tap_targets'
  | 'perf.images'
  | 'content.copyright_year'
  | 'content.last_updated'
  | 'content.stale_news'
  | 'content.placeholder'
  | 'content.legacy_font'
  | 'content.obsolete_tech'
  | 'content.best_viewed'
  | 'content.broken_links'
  | 'content.broken_pdfs'
  | 'content.broken_images'
  | 'content.malayalam'
  | 'content.title'
  | 'content.meta_desc'
  | 'content.favicon'
  | 'content.console_errors'
  | 'gigw.contact'
  | 'gigw.feedback'
  | 'gigw.sitemap'
  | 'gigw.privacy'
  | 'gigw.terms'
  | 'gigw.copyright_policy'
  | 'gigw.hyperlink_policy'
  | 'gigw.disclaimer'
  | 'gigw.accessibility_statement'
  | 'gigw.screen_reader'
  | 'gigw.help'
  | 'gigw.rti'
  | 'gigw.search'
  | 'gigw.ownership'
  | 'gigw.last_updated'
  | 'gigw.emblem'
  | 'id.gov_domain'
  | 'id.domain_expiry'
  | 'id.www_consistency'
  | 'id.robots'
  | 'id.sitemap_xml'
  | 'id.soft_404'
  | 'id.canonical'
  | 'id.charset_doctype'
  | 'id.tech'
  | 'id.third_party';

/** A check's fixed facts: how severe it is, what category it scores into, which status it forces
 * on failure (if any), and the English (site copy is bilingual from WP5.3 on, so `ml` fields exist
 * now as empty strings rather than being added later) explanation shown on the site and the
 * methodology page. This is the *only* place that copy is written (ADR-013) -- `site/` imports it,
 * never repeats it. */
export interface CheckMeta {
  category: Category;
  severity: Severity;
  /** Present only on a ★ check (DESIGN §5.3). */
  statusSetting?: StatusSetting;
  /** Some checks don't make sense for every kind of site (e.g. `id.domain_expiry` for a site on a
   * shared platform domain it doesn't own) -- omitted means "applies to everyone". */
  appliesTo?: (site: Site) => boolean;
  title: { en: string; ml: string };
  citizen: { en: string; ml: string };
  fix: { en: string; ml: string };
  /** A citable standard/section, e.g. `GIGW 3.0 §...`, `WCAG 2.1 SC ...`, `OWASP Secure Headers`.
   * Empty string when not sure enough to cite one -- never guessed. */
  ref: string;
}

export type CheckOutcome = 'pass' | 'warn' | 'fail' | 'na';

export interface CheckResult {
  id: CheckId;
  r: CheckOutcome;
  /** Short evidence string for the site page ("font-family: ML-TTKarthika (style.css:41)"). */
  ev?: string;
}

/**
 * What a check function sees. Only `site` and `light` exist by WP3.1 -- everything else is
 * optional because the WP that actually populates it (the Playwright runner, RDAP, the crawler)
 * hasn't been built yet; a check that needs one of those fields simply can't run before then and
 * its `appliesTo`/own logic should treat a missing field as "skip, don't crash".
 */
export interface CheckContext {
  site: Site;
  light: import('../light.js').LightResult;
  html?: string;
  text?: string;
  headers?: Record<string, string>;
  status?: number;
  finalUrl?: string;
  cssTexts?: string[];
  scriptUrls?: string[];
  consoleErrors?: string[];
  malayalamRatio?: number;
  /** One entry per day, newest first (history.ts) -- only avail.flapping reads this. Populated by
   * the runner from the site's own stored `Result.history` before checks run; a check can't fetch
   * its own history since that lives in the data store, not on the network. */
  history?: HistoryEntry[];
  /** HTTP status from a single fetch of a random non-existent path, e.g. `/kww-check-<random>` --
   * populated by the runner (WP3.5) since a pure check can't make its own request. */
  soft404Status?: number;
  /** robots.txt as fetched by the runner. Absent means it was never fetched (unknown), which must
   * stay distinct from "fetched and empty" -- id.robots reports `na`, not `fail`, when absent. */
  robotsTxt?: { status: number; body: string };
  /** HTTP status from fetching /sitemap.xml, populated by the runner. */
  sitemapXmlStatus?: number;
  /** Days until the site's registrable domain expires, from net/rdap.ts, looked up and cached once
   * per audit run by the runner. `null` means RDAP had no expiry event or the lookup failed -- not
   * "expiring soon" and not "no domain". */
  domainExpiryDays?: number | null;
  /** Whether the `www` and bare-host variants of this site's domain both resolve and one redirects
   * to the other -- a second probe alongside the main fetch that only the runner can make. */
  wwwConsistent?: boolean;
  /** Every subresource request the page made while loading (WP3.5's Playwright runner), used
   * alongside a static `ctx.html` scan for `sec.mixed_content` -- an http:// entry here is a
   * stronger signal than the static scan since it reflects what the browser actually fetched. */
  requests?: { url: string }[];
  /** Vulnerable JS libraries retire.js (net/retire.ts) found among the scripts the page loaded,
   * populated once per audit run by the runner (a pure check can't shell out to a CLI itself). */
  vulnerableLibraries?: { library: string; version: string | null; cve: string[] }[];
  /** Result of a Google Safe Browsing lookup (net/safebrowsing.ts) -- `undefined` means it was
   * never checked (no `SAFE_BROWSING_KEY` configured, or a transient lookup failure), which must
   * stay distinct from `false` ("checked, and clean"). */
  safeBrowsingFlagged?: boolean;
}

export type Check = {
  id: CheckId;
  appliesTo?: (site: Site) => boolean;
  run: (ctx: CheckContext) => CheckResult;
};
