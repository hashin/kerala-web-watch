import { CHECKS } from '../../../audit/dist/checks/registry.js';
import type { CheckId } from '../../../audit/dist/checks/types.js';
import type { SiteView, Status } from './data';

export const STATUS_ORDER: Status[] = ['down', 'hijacked', 'broken', 'poor', 'unverifiable', 'unaudited', 'needs-work', 'healthy'];

/** How many of a group's sites are in each status -- the department/district/kind/platform
 * rollup's headline counts (DESIGN §7.2). */
export function countByStatus(sites: SiteView[]): Record<Status, number> {
  const counts = Object.fromEntries(STATUS_ORDER.map((s) => [s, 0])) as Record<Status, number>;
  for (const site of sites) counts[site.status]++;
  return counts;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid];
}

/** Median overall score among the sites that have one at all -- `null` (not 0) when none do, so
 * a department of all-unaudited/all-down sites reads as "nothing to summarize" rather than "0". */
export function medianScore(sites: SiteView[]): number | null {
  return median(sites.map((s) => s.result?.score?.overall).filter((s): s is number => s != null));
}

export interface FailedCheckCount {
  id: CheckId;
  count: number;
}

/** How many sites in the group have each check currently failing/warning, most common first --
 * feeds a department rollup's "3 most common issues" and `platformWideIssues` below. Ties break
 * alphabetically by title so the result is deterministic, not insertion-order-dependent. */
export function failedCheckCounts(sites: SiteView[]): FailedCheckCount[] {
  const counts = new Map<CheckId, number>();
  for (const site of sites) {
    for (const issue of site.result?.issues ?? []) {
      counts.set(issue.id, (counts.get(issue.id) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([id, count]) => ({ id, count }))
    .sort((a, b) => b.count - a.count || CHECKS[a.id].title.en.localeCompare(CHECKS[b.id].title.en));
}

const BROKEN_STATUSES: Status[] = ['down', 'hijacked', 'broken'];

/** 0-100, the leaderboard's primary sort key (DESIGN §7.2: "ranked by % broken then median"). */
export function percentBroken(sites: SiteView[]): number {
  if (sites.length === 0) return 0;
  const broken = sites.filter((s) => BROKEN_STATUSES.includes(s.status)).length;
  return Math.round((broken / sites.length) * 100);
}

/** ADR-008: a platform-wide finding is reported once at `/platforms/<p>/` instead of once per
 * member site. "Widely" means failing on at least `threshold` of the sites that have actually
 * been deep-audited -- a site with no deep audit yet has no checks to fail, so it doesn't belong
 * in the denominator (an all-unaudited platform would otherwise show 100% of zero checks). */
export function platformWideIssues(sites: SiteView[], threshold = 0.8): FailedCheckCount[] {
  const audited = sites.filter((s) => s.result?.deep != null);
  if (audited.length === 0) return [];
  return failedCheckCounts(audited).filter((f) => f.count / audited.length >= threshold);
}

/**
 * Median score change over the last `days` days across a group's sites, from each site's score
 * closest to (but not after) `days` ago to its latest score -- `null` when no site in the group
 * has both a past and a current score to compare. Positive means the group improved. `history` is
 * newest-first (audit/src/history.ts), so the first entry at or before the cutoff, scanning from
 * the newest end, is the one closest to the cutoff date without overshooting into the future.
 */
export function scoreDelta(sites: SiteView[], days = 30, now: Date = new Date()): number | null {
  const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const deltas: number[] = [];
  for (const site of sites) {
    const history = site.result?.history ?? [];
    const latest = history.find((h) => h.score != null);
    const past = history.find((h) => h.score != null && new Date(h.d) <= cutoff);
    if (latest?.score != null && past?.score != null) deltas.push(latest.score - past.score);
  }
  return median(deltas);
}
