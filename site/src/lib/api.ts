import { allTransitions } from '../../../audit/dist/summary.js';
import type { Result, SiteView, Status } from './data';

/** Absolute origin for links inside downloadable files (a feed reader or a CSV opened outside the
 * browser has no page URL to resolve a relative link against) -- same fallback astro.config.mjs
 * uses, since build-deploy.yml sets `SITE_URL` the same way for both. */
export const SITE_URL = process.env.SITE_URL ?? 'https://govwebsite.hashin.me';

const CSV_COLUMNS = ['id', 'name', 'url', 'district', 'department', 'kind', 'platform', 'status', 'score'] as const;

function csvField(value: string | number | null): string {
  if (value === null) return '';
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** `api/sites.csv` (WP4.3): registry identity + current status + score, one row per site, for
 * spreadsheet tools nobody wants to write a JSON parser for. */
export function sitesToCsv(sites: SiteView[]): string {
  const rows = sites.map((s) =>
    [s.id, s.name, s.url, s.district ?? '', s.department, s.kind, s.platform ?? '', s.status, s.result?.score?.overall ?? '']
      .map(csvField)
      .join(','),
  );
  return [CSV_COLUMNS.join(','), ...rows, ''].join('\n');
}

export interface SiteApiRecord {
  id: string;
  name: string;
  name_ml: string | null;
  url: string;
  district: string | null;
  department: string;
  kind: string;
  platform: string | null;
  status: Status;
  score: Result['score'];
  issues: Result['issues'];
  light: Result['light'];
  deep: Result['deep'];
  history: Result['history'];
}

/** `api/sites/<id>.json` (WP4.3) -- the site page's own "Download JSON" action (SiteActions.astro).
 * A single-site download is cheap, so unlike `allSitesRecords` below it keeps every check's
 * evidence string. */
export function siteApiRecord(site: SiteView): SiteApiRecord {
  const result = site.result;
  return {
    id: site.id,
    name: site.name,
    name_ml: site.name_ml ?? null,
    url: site.url,
    district: site.district,
    department: site.department,
    kind: site.kind,
    platform: site.platform,
    status: site.status,
    score: result?.score ?? null,
    issues: result?.issues ?? [],
    light: result?.light ?? null,
    deep: result?.deep ?? null,
    history: result?.history ?? [],
  };
}

export interface SiteAllRecord extends Omit<SiteApiRecord, 'issues' | 'deep'> {
  issues: { id: string; sev: string }[];
  deep: (Omit<NonNullable<Result['deep']>, 'checks'> & { checks: { id: string; r: string }[] }) | null;
}

/** `api/all.json` (WP4.3): every site's record, minus every check's `ev` evidence string -- at
 * 1,500+ sites the per-check evidence (mostly meaningful only next to that one site's own page) is
 * the single biggest thing standing between this file and "small enough to gzip and just fetch",
 * so the bulk export drops it. A citizen or journalist who wants one site's full evidence uses
 * `api/sites/<id>.json` instead. */
export function allSitesRecords(sites: SiteView[]): SiteAllRecord[] {
  return sites.map((site) => {
    const record = siteApiRecord(site);
    return {
      ...record,
      issues: record.issues.map((i) => ({ id: i.id, sev: i.sev })),
      deep: record.deep && { ...record.deep, checks: record.deep.checks.map((c) => ({ id: c.id, r: c.r })) },
    };
  });
}

function xmlEscape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

export interface FeedTransition {
  id: string;
  name: string;
  since: string;
}

const FEED_ENTRY_CAP = 100;

/** The data `feeds/broken.xml`/`feeds/fixed.xml` render: every site's last recorded transition to
 * `toUp`, newest first, capped at 100 and joined with each site's name for the entry title. */
export function siteTransitions(sites: SiteView[], toUp: boolean): FeedTransition[] {
  const results = sites.map((s) => s.result).filter((r): r is Result => r !== null);
  const namesById = new Map(sites.map((s) => [s.id, s.name]));
  return allTransitions(results, toUp)
    .slice(0, FEED_ENTRY_CAP)
    .map((t) => ({ id: t.id, name: namesById.get(t.id) ?? t.id, since: t.since }));
}

/** `feeds/broken.xml`/`feeds/fixed.xml` (WP4.3): an Atom feed of the last 100 status transitions
 * (`summary.ts`'s `allTransitions`), so a journalist or a webmaster can watch for their own
 * department without polling the site. One entry per site per transition day -- if a site flips
 * back and forth its later transition simply supersedes the earlier entry's currency, same as any
 * feed reader treats a re-published item. */
export function buildTransitionFeed(opts: { title: string; description: string; feedPath: string; transitions: FeedTransition[]; updated: string }): string {
  const feedUrl = `${SITE_URL}${opts.feedPath}`;
  const entries = opts.transitions
    .map((t) => {
      const href = `${SITE_URL}/sites/${t.id}/`;
      return `  <entry>
    <title>${xmlEscape(t.name)}</title>
    <id>${xmlEscape(href)}#${xmlEscape(t.since)}</id>
    <link href="${xmlEscape(href)}" />
    <updated>${xmlEscape(t.since)}T00:00:00Z</updated>
  </entry>`;
    })
    .join('\n');
  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${xmlEscape(opts.title)}</title>
  <subtitle>${xmlEscape(opts.description)}</subtitle>
  <id>${xmlEscape(feedUrl)}</id>
  <link href="${xmlEscape(feedUrl)}" rel="self" />
  <updated>${xmlEscape(opts.updated)}</updated>
${entries}
</feed>
`;
}
