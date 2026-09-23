import { CHECKS } from './checks/registry.js';
import type { CheckId, CheckMeta, CheckResult, ScoredCategory, Severity, StatusSetting } from './checks/types.js';

export interface ScoreBreakdown {
  overall: number;
  security: number;
  accessibility: number;
  content: number;
  gigw: number;
  performance: number;
  identity: number;
}

export interface Issue {
  id: CheckId;
  sev: Severity;
  ev?: string;
}

/** The statuses a completed deep audit can produce. `down` and `unaudited` are deliberately
 * excluded -- see checks/registry.ts's top comment on why `down` stays Phase 2's own two-strike
 * light-check state, and `unaudited` can't apply once an audit has actually run. */
export type DeepAuditStatus = StatusSetting | 'healthy' | 'needs-work' | 'poor';

export interface ScoreOutcome {
  /** `null` exactly when a ★ check failed and set `status` directly -- DESIGN §5.4: "availability
   * is a gate, not a component." */
  score: ScoreBreakdown | null;
  status: DeepAuditStatus;
  issues: Issue[];
}

/** Exported alongside `WEIGHTS` so the methodology page (WP4.4, ADR-006) states the actual
 * current values instead of a hand-copied number that could drift out of sync. */
export const FAIL_DEDUCTION: Record<Severity, number> = { C: 40, H: 20, M: 10, L: 4, I: 0 };
export const WEIGHTS: Record<ScoredCategory, number> = {
  security: 25,
  accessibility: 25,
  content: 15,
  gigw: 15,
  performance: 10,
  identity: 10,
};
/** The two boundaries `statusFromScore` applies, exported so the methodology page can state them
 * (ADR-006's "healthy ≥ 80, needs-work 50-79, poor < 50") without a second hand-copied number. */
export const HEALTHY_THRESHOLD = 80;
export const NEEDS_WORK_THRESHOLD = 50;
const SEVERITY_ORDER: Severity[] = ['C', 'H', 'M', 'L', 'I'];
const CATEGORY_ORDER: (ScoredCategory | 'availability')[] = [
  'availability',
  'security',
  'accessibility',
  'content',
  'gigw',
  'performance',
  'identity',
];

/** When more than one ★ check fails at once (rare, but possible -- e.g. a geo-blocked site that
 * also has an expired certificate), this decides which status wins. Most specific/severe finding
 * first: `unverifiable` means we simply have no evidence either way from here, so it always takes
 * priority over a "broken" verdict we can't fully trust from a blocked vantage point; `hijacked`
 * (the site now belongs to someone else) is more urgent than a merely `broken` one still under the
 * organisation's own control; `down` (couldn't even connect/resolve/get a 2xx) is last because
 * it's the most generic failure and the least specific about what's actually wrong. */
const STATUS_PRIORITY: DeepAuditStatus[] = ['unverifiable', 'hijacked', 'broken', 'down'];

function deduction(outcome: CheckResult['r'], severity: Severity): number {
  if (outcome === 'fail') return FAIL_DEDUCTION[severity];
  if (outcome === 'warn') return FAIL_DEDUCTION[severity] / 2;
  return 0;
}

function findStatusOverride(checks: CheckResult[], meta: Record<CheckId, CheckMeta>): DeepAuditStatus | null {
  const failedStatusSettings = new Set(
    checks
      .filter((c) => c.r === 'fail')
      .map((c) => meta[c.id]?.statusSetting)
      .filter((s): s is StatusSetting => s !== undefined),
  );
  for (const status of STATUS_PRIORITY) {
    if (failedStatusSettings.has(status as StatusSetting)) return status;
  }
  return null;
}

function buildIssues(checks: CheckResult[], meta: Record<CheckId, CheckMeta>): Issue[] {
  const issues = checks
    .filter((c) => c.r === 'fail' || c.r === 'warn')
    .map((c): Issue => ({ id: c.id, sev: meta[c.id].severity, ev: c.ev }));
  return issues.sort((a, b) => {
    const bySeverity = SEVERITY_ORDER.indexOf(a.sev) - SEVERITY_ORDER.indexOf(b.sev);
    if (bySeverity !== 0) return bySeverity;
    return CATEGORY_ORDER.indexOf(meta[a.id].category) - CATEGORY_ORDER.indexOf(meta[b.id].category);
  });
}

function computeCategoryScores(checks: CheckResult[], meta: Record<CheckId, CheckMeta>): Record<ScoredCategory, number> {
  const deductions: Record<ScoredCategory, number> = { security: 0, accessibility: 0, content: 0, gigw: 0, performance: 0, identity: 0 };
  for (const check of checks) {
    const category = meta[check.id].category;
    if (category === 'availability') continue; // a gate, not a scored component -- see types.ts
    deductions[category] += deduction(check.r, meta[check.id].severity);
  }
  const scores = {} as Record<ScoredCategory, number>;
  for (const category of Object.keys(WEIGHTS) as ScoredCategory[]) {
    scores[category] = Math.max(0, 100 - deductions[category]);
  }
  return scores;
}

/** Exported for direct testing of the exact 79/80 and 49/50 boundaries (DESIGN §5.4) -- easier to
 * assert on this in isolation than to construct a check combination landing on a precise overall
 * score through six weighted categories' worth of deductions. */
export function statusFromScore(overall: number): 'healthy' | 'needs-work' | 'poor' {
  if (overall >= HEALTHY_THRESHOLD) return 'healthy';
  if (overall >= NEEDS_WORK_THRESHOLD) return 'needs-work';
  return 'poor';
}

/**
 * DESIGN §5.4, exactly: if any ★ check failed, its declared status wins outright and there is no
 * score at all (availability is a gate, not a component). Otherwise every category is
 * 100 minus its checks' deductions (fail = full severity deduction, warn = half, `na` = none),
 * floored at 0, combined into a weighted overall (ADR-006), and the overall decides
 * healthy/needs-work/poor. `issues` always lists every failed/warned check, severity first, so a
 * site's own page can explain *why* even when `score` is null.
 */
export function scoreSite(checks: CheckResult[], meta: Record<CheckId, CheckMeta> = CHECKS): ScoreOutcome {
  const issues = buildIssues(checks, meta);
  const override = findStatusOverride(checks, meta);
  if (override) return { score: null, status: override, issues };

  const categoryScores = computeCategoryScores(checks, meta);
  const overall = Math.round(
    (Object.keys(WEIGHTS) as ScoredCategory[]).reduce((sum, category) => sum + categoryScores[category] * WEIGHTS[category], 0) / 100,
  );

  return {
    score: { overall, ...categoryScores },
    status: statusFromScore(overall),
    issues,
  };
}
