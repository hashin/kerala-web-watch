import type { Registry, Site } from './types.js';
import type { Result } from './store.js';
import { isBrokenClass, type ResultStatus } from './status.js';

export interface GroupStat {
  sites: number;
  broken: number;
  median: number | null;
}

export interface SiteSummary {
  id: string;
  status: ResultStatus;
  score: number | null;
  light_at: string | null;
  deep_at: string | null;
  district: string | null;
  department: string;
  kind: string;
}

export interface Summary {
  generated: string;
  vantages: string[];
  totals: {
    sites: number;
    deep_audited: number;
    down: number;
    hijacked: number;
    broken: number;
    unverifiable: number;
    unaudited: number;
    poor: number;
    needs_work: number;
    healthy: number;
  };
  coverage: { deep_audited: number; total: number; eta: string | null };
  by_district: Record<string, GroupStat>;
  by_department: Record<string, GroupStat>;
  by_ministry: Record<string, GroupStat>;
  by_kind: Record<string, GroupStat>;
  by_platform: Record<string, GroupStat>;
  top_issues: { id: string; count: number }[];
  recent_broken: { id: string; since: string }[];
  recent_fixed: { id: string; since: string }[];
  sites: SiteSummary[];
}

const DEEP_AUDIT_BATCH_CAP = 300;
const RECENT_WINDOW_DAYS = 7;

/**
 * Recomputes the whole homepage rollup (IMPLEMENTATION §3.3) from the registry plus every stored
 * result -- nothing incremental, so a missing or corrupt result file only affects that one site,
 * never the summary's internal consistency. Score-derived fields (`median`, `poor`/`needs_work`/
 * `healthy` totals, `top_issues`) come out null/zero/empty until Phase 3's deep audit populates
 * `score`/`issues` -- the shape is right today, the numbers fill in later.
 */
export function computeSummary(registry: Registry, results: Result[], opts: { now: Date; vantages: string[] }): Summary {
  const resultsById = new Map(results.map((r) => [r.id, r]));
  const statusOf = (id: string): ResultStatus => resultsById.get(id)?.status ?? 'unaudited';

  const totals = { sites: registry.sites.length, deep_audited: 0, down: 0, hijacked: 0, broken: 0, unverifiable: 0, unaudited: 0, poor: 0, needs_work: 0, healthy: 0 };
  for (const site of registry.sites) {
    const status = statusOf(site.id);
    if (resultsById.get(site.id)?.deep != null) totals.deep_audited++;
    bumpTotal(totals, status);
  }

  return {
    generated: opts.now.toISOString(),
    vantages: opts.vantages,
    totals,
    coverage: computeCoverage(totals.sites, totals.deep_audited, opts.now),
    by_district: groupBy(registry.sites, (s) => s.district, resultsById),
    by_department: groupBy(registry.sites, (s) => s.department, resultsById),
    by_ministry: groupByMinistry(registry, resultsById),
    by_kind: groupBy(registry.sites, (s) => s.kind, resultsById),
    by_platform: groupBy(registry.sites, (s) => s.platform, resultsById),
    top_issues: topIssues(results),
    recent_broken: recentTransitions(results, opts.now, false),
    recent_fixed: recentTransitions(results, opts.now, true),
    sites: registry.sites.map((site) => siteSummary(site, resultsById.get(site.id) ?? null)),
  };
}

function bumpTotal(totals: Summary['totals'], status: ResultStatus): void {
  const key = status === 'needs-work' ? 'needs_work' : status;
  totals[key as keyof Summary['totals']]++;
}

function computeCoverage(total: number, deepAudited: number, now: Date): Summary['coverage'] {
  const remaining = total - deepAudited;
  if (total === 0 || remaining <= 0) return { deep_audited: deepAudited, total, eta: null };
  const batch = Math.min(DEEP_AUDIT_BATCH_CAP, Math.ceil(total / 7));
  const days = Math.ceil(remaining / batch);
  const eta = new Date(now);
  eta.setUTCDate(eta.getUTCDate() + days);
  return { deep_audited: deepAudited, total, eta: eta.toISOString().slice(0, 10) };
}

function groupBy(sites: Site[], key: (site: Site) => string | null, resultsById: Map<string, Result>): Record<string, GroupStat> {
  const byKey = new Map<string, Site[]>();
  for (const site of sites) {
    const value = key(site);
    if (value === null) continue;
    const group = byKey.get(value);
    if (group) group.push(site);
    else byKey.set(value, [site]);
  }
  const out: Record<string, GroupStat> = {};
  for (const [value, groupSites] of byKey) out[value] = groupStat(groupSites, resultsById);
  return out;
}

function groupByMinistry(registry: Registry, resultsById: Map<string, Result>): Record<string, GroupStat> {
  const out: Record<string, GroupStat> = {};
  for (const [ministryId, sites] of registry.byMinistry) out[ministryId] = groupStat(sites, resultsById);
  return out;
}

function groupStat(sites: Site[], resultsById: Map<string, Result>): GroupStat {
  let broken = 0;
  const scores: number[] = [];
  for (const site of sites) {
    const result = resultsById.get(site.id);
    if (isBrokenClass(result?.status ?? 'unaudited')) broken++;
    if (result?.score) scores.push(result.score.overall);
  }
  return { sites: sites.length, broken, median: median(scores) };
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function topIssues(results: Result[]): { id: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const result of results) {
    for (const issue of result.issues as { id: string }[]) {
      counts.set(issue.id, (counts.get(issue.id) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([id, count]) => ({ id, count }));
}

/** Finds the day a site's `history.up` most recently changed to `toUp`, or `null` if there's no
 * such transition recorded -- history is newest-first, so the transition day is the oldest entry
 * still carrying the current value. A run of matching entries that reaches all the way to the end
 * of history is *not* a transition: it just means every day we've ever recorded already had this
 * value (most visibly, a site's very first-ever check -- one history entry, trivially "unchanged"
 * -- must not be reported as "just came up today"). */
function transitionDay(history: Result['history'], toUp: boolean): string | null {
  if (history.length === 0 || history[0].up !== toUp) return null;
  let i = 0;
  while (i < history.length && history[i].up === toUp) i++;
  if (i === history.length) return null;
  return history[i - 1].d;
}

function recentTransitions(results: Result[], now: Date, toUp: boolean): { id: string; since: string }[] {
  const out: { id: string; since: string }[] = [];
  for (const result of results) {
    const changedAt = transitionDay(result.history, toUp);
    if (changedAt && daysBetween(changedAt, now) <= RECENT_WINDOW_DAYS) out.push({ id: result.id, since: changedAt });
  }
  return out;
}

/** Every recorded transition to `toUp`, not just the last `RECENT_WINDOW_DAYS` -- unlike
 * `recentTransitions` (the homepage's "this week" rollup), the `/feeds/broken.xml` and
 * `/feeds/fixed.xml` Atom feeds (DESIGN §7.2, WP4.3) want a scrollback a feed reader can catch up
 * on, not just this week's. Newest first. */
export function allTransitions(results: Result[], toUp: boolean): { id: string; since: string }[] {
  const out: { id: string; since: string }[] = [];
  for (const result of results) {
    const changedAt = transitionDay(result.history, toUp);
    if (changedAt) out.push({ id: result.id, since: changedAt });
  }
  return out.sort((a, b) => b.since.localeCompare(a.since));
}

function daysBetween(isoDate: string, now: Date): number {
  const then = new Date(`${isoDate}T00:00:00Z`).getTime();
  return Math.round((now.getTime() - then) / 86_400_000);
}

function siteSummary(site: Site, result: Result | null): SiteSummary {
  return {
    id: site.id,
    status: result?.status ?? 'unaudited',
    score: result?.score?.overall ?? null,
    light_at: result?.light?.at ?? null,
    deep_at: result?.deep?.at ?? null,
    district: site.district,
    department: site.department,
    kind: site.kind,
  };
}
