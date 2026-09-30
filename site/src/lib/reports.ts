// Headline tiles for a monthly report, built only from the report's own frontmatter (`snapshot` and
// the month-over-month `deltas` that `cli report` computed), so a past report never changes.
import { delta } from './weekly';
import type { Delta } from './types';

export interface ReportNumbers {
  sites: number;
  deep_audited: number;
  down: number;
  hijacked: number;
  broken: number;
  healthy: number;
  median_score: number | null;
}
/** Current minus previous month; null for the very first report. */
export type ReportChange = Partial<Record<keyof ReportNumbers, number | null>> | null;

export interface ReportKpi { label: string; value: string; color: string; tip: string; delta: Delta | null }

/** The month before, recovered from this month's value and its change. Null when there is no change to compare. */
const before = (now: number | null, change: number | null | undefined) => (now == null || change == null ? null : now - change);

export function reportKpis(snapshot: ReportNumbers, change: ReportChange): ReportKpi[] {
  const brokenNow = snapshot.down + snapshot.hijacked + snapshot.broken;
  const brokenChange = change ? (change.down ?? 0) + (change.hijacked ?? 0) + (change.broken ?? 0) : null;
  return [
    { label: 'Sites tracked', value: snapshot.sites.toLocaleString('en-IN'), color: 'var(--sky)', tip: 'Registered government websites this month.', delta: delta(snapshot.sites, before(snapshot.sites, change?.sites), false) },
    { label: 'Deep-audited', value: snapshot.deep_audited.toLocaleString('en-IN'), color: 'var(--indigo)', tip: 'Sites that have had the full audit. Should rise every month.', delta: delta(snapshot.deep_audited, before(snapshot.deep_audited, change?.deep_audited), false) },
    { label: 'Down or broken', value: brokenNow.toLocaleString('en-IN'), color: 'var(--crimson)', tip: 'Sites that were down, hijacked or broken when the report was made. Lower is better.', delta: delta(brokenNow, brokenChange == null ? null : brokenNow - brokenChange, true) },
    { label: 'Healthy', value: snapshot.healthy.toLocaleString('en-IN'), color: 'var(--teal)', tip: 'Deep-audited sites scoring 80 or more. The goal is to grow this.', delta: delta(snapshot.healthy, before(snapshot.healthy, change?.healthy), false) },
    { label: 'Median score', value: snapshot.median_score == null ? '—' : String(snapshot.median_score), color: 'var(--amber)', tip: "The middle deep-audited site's score out of 100.", delta: snapshot.median_score == null ? null : delta(snapshot.median_score, before(snapshot.median_score, change?.median_score), false) },
  ];
}
