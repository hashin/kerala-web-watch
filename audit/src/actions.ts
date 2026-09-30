import { CHECKS } from './checks/registry.js';
import type { CheckId, CheckMeta, CheckOutcome, Severity } from './checks/types.js';
import type { Issue } from './score.js';
import { explainLightStatus, type ResultStatus } from './status.js';
import type { Result } from './store.js';
import type { Registry, Site } from './types.js';

/** ADR-028: 1 is the most urgent. */
export type Grade = 1 | 2 | 3 | 4 | 5;
export type Bucket = Grade | 'unverifiable' | 'unaudited' | 'clear';
export const BUCKET_ORDER: Bucket[] = [1, 2, 3, 4, 5, 'unverifiable', 'unaudited', 'clear'];

/** What the methodology page prints and `gradeFor` applies: one source, so they can't drift. */
export const GRADE_RULES: { grade: Grade; rule: 'hijacked-or-compromise' | 'down-or-broken' | 'severity-C-H' | 'severity-M' | 'severity-L' }[] = [
  { grade: 1, rule: 'hijacked-or-compromise' },
  { grade: 2, rule: 'down-or-broken' },
  { grade: 3, rule: 'severity-C-H' },
  { grade: 4, rule: 'severity-M' },
  { grade: 5, rule: 'severity-L' },
];

const SEVERITY_RANK: Record<Severity, number> = { C: 0, H: 1, M: 2, L: 3, I: 4 };

function gradeFromSeverity(sev: Severity): Grade | null {
  if (sev === 'C' || sev === 'H') return 3;
  if (sev === 'M') return 4;
  if (sev === 'L') return 5;
  return null;
}

/** The action grade of one check outcome, derived from the check's own metadata; `null` means it
 * is not an action (passing, not applicable, informational, or a geo-block we cannot judge). */
export function gradeFor(id: CheckId, outcome: CheckOutcome, meta: Record<CheckId, CheckMeta> = CHECKS): Grade | null {
  if (outcome === 'pass' || outcome === 'na') return null;
  const check = meta[id];
  const base = gradeFromSeverity(check.severity);
  if (outcome === 'warn') return base === null ? null : (Math.min(5, base + 1) as Grade);

  if (check.statusSetting === 'hijacked' || check.compromise) return 1;
  if (check.statusSetting === 'down' || check.statusSetting === 'broken') return 2;
  if (check.statusSetting === 'unverifiable') return null;
  return base;
}

export interface Action {
  check: CheckId;
  grade: Grade;
  sev: Severity;
  /** `light` when the status came from the 6-hourly light check alone, with no deep audit behind it. */
  basis: 'deep' | 'light';
  observed: string;
  ev?: string;
}

export interface SiteActions {
  id: string;
  bucket: Bucket;
  status: ResultStatus;
  deep_at: string | null;
  light_at: string | null;
  actions: Action[];
}

export interface ActionReport {
  generated: string;
  totals: Record<Bucket, number>;
  by_department: Record<string, Record<Bucket, number>>;
  sites: SiteActions[];
}

function emptyCounts(): Record<Bucket, number> {
  return { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, unverifiable: 0, unaudited: 0, clear: 0 };
}

function deepActions(result: Result, meta: Record<CheckId, CheckMeta>): Action[] {
  const deep = result.deep;
  if (!deep) return [];
  const outcomes = new Map(deep.checks.map((c) => [c.id, c.r]));
  const out: Action[] = [];
  for (const issue of result.issues as Issue[]) {
    const grade = gradeFor(issue.id, outcomes.get(issue.id) ?? 'fail', meta);
    if (grade === null) continue;
    if (grade === 1 && !issue.ev) throw new Error(`grade-1 action without evidence: ${result.id}/${issue.id}`);
    out.push({ check: issue.id, grade, sev: issue.sev, basis: 'deep', observed: deep.at, ...(issue.ev ? { ev: issue.ev } : {}) });
  }
  return out;
}

/** A `down`/`broken` status that only the light check produced has no issue behind it; without
 * this the report would say "nothing to fix" about a site citizens cannot open. */
function lightAction(result: Result, existing: Action[], meta: Record<CheckId, CheckMeta>): Action | null {
  if (result.status !== 'down' && result.status !== 'broken') return null;
  if (existing.some((a) => meta[a.check].statusSetting === result.status)) return null;
  const light = result.light;
  if (!light) return null;
  const check = explainLightStatus(light);
  if (!check) return null;
  const tls = check === 'sec.cert_valid' && light.tls?.expires ? `; certificate expiry ${light.tls.expires}` : '';
  return { check, grade: 2, sev: meta[check].severity, basis: 'light', observed: light.at, ev: `Light check ${light.at}: ${light.status_class}${tls}` };
}

function compareActions(a: Action, b: Action): number {
  return a.grade - b.grade || SEVERITY_RANK[a.sev] - SEVERITY_RANK[b.sev] || a.check.localeCompare(b.check);
}

function bucketOf(result: Result | null, actions: Action[]): Bucket {
  if (actions.length > 0) return actions[0].grade;
  if (result === null || result.deep === null) return 'unaudited';
  return result.status === 'unverifiable' ? 'unverifiable' : 'clear';
}

function siteActions(site: Site, result: Result | null, meta: Record<CheckId, CheckMeta>): SiteActions {
  const actions = result ? deepActions(result, meta) : [];
  const light = result ? lightAction(result, actions, meta) : null;
  if (light) actions.push(light);
  actions.sort(compareActions);
  const bucket = result?.status === 'unverifiable' && actions.length === 0 ? 'unverifiable' : bucketOf(result, actions);
  return {
    id: site.id,
    bucket,
    status: result?.status ?? 'unaudited',
    deep_at: result?.deep?.at ?? null,
    light_at: result?.light?.at ?? null,
    actions,
  };
}

/**
 * The action report for every registry site (ADR-028). Pure and deterministic: the same inputs and
 * `now` give byte-identical JSON, so `merge` can rewrite it freely.
 */
export function computeActionReport(registry: Registry, results: Result[], opts: { now: Date }, meta: Record<CheckId, CheckMeta> = CHECKS): ActionReport {
  const byId = new Map(results.map((r) => [r.id, r]));
  const rows = registry.sites.map((site) => ({ site, row: siteActions(site, byId.get(site.id) ?? null, meta) }));

  rows.sort(
    (a, b) =>
      BUCKET_ORDER.indexOf(a.row.bucket) - BUCKET_ORDER.indexOf(b.row.bucket) ||
      a.site.priority - b.site.priority ||
      a.site.name.localeCompare(b.site.name, 'en') ||
      a.site.id.localeCompare(b.site.id),
  );

  const totals = emptyCounts();
  const by_department: Record<string, Record<Bucket, number>> = {};
  for (const department of registry.departments) by_department[department.id] = emptyCounts();
  for (const { site, row } of rows) {
    totals[row.bucket]++;
    (by_department[site.department] ??= emptyCounts())[row.bucket]++;
  }
  return { generated: opts.now.toISOString(), totals, by_department, sites: rows.map((r) => r.row) };
}
