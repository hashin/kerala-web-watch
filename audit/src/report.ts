import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';
import type { Registry } from './types.js';
import type { Summary } from './summary.js';
import { median } from './summary.js';
import { CHECKS } from './checks/registry.js';
import type { CheckId } from './checks/types.js';

/** The numbers a month-over-month delta needs -- `Summary['totals']` plus the one score-derived
 * figure it doesn't carry. This is also exactly what a report's own frontmatter stores, so next
 * month's report can diff against *this* month without re-deriving anything from `data/`. */
export type ReportSnapshot = Summary['totals'] & { median_score: number | null };

export type ReportDeltas = { [K in keyof ReportSnapshot]: number | null };

export interface ReportSite {
  id: string;
  name: string;
  department: string;
  score: number;
}

export interface ReportData {
  month: string;
  generated: string;
  totals: Summary['totals'];
  coverage: Summary['coverage'];
  median_score: number | null;
  deltas: ReportDeltas | null;
  top_issues: { id: string; count: number; title: string }[];
  best: ReportSite[];
  worst: ReportSite[];
}

const BEST_WORST_COUNT = 5;

function toReportSite(registry: Registry, siteSummary: { id: string; department: string; score: number | null }): ReportSite {
  const site = registry.byId.get(siteSummary.id);
  return { id: siteSummary.id, name: site?.name ?? siteSummary.id, department: siteSummary.department, score: siteSummary.score! };
}

export function snapshotOf(summary: Summary): ReportSnapshot {
  const scores = summary.sites.map((s) => s.score).filter((s): s is number => s !== null);
  return { ...summary.totals, median_score: median(scores) };
}

/** `null` for any field either side doesn't have a comparable number for -- most commonly both
 * are `median_score: null` early in the project, before enough sites are deep-audited to have one. */
export function computeDeltas(current: ReportSnapshot, previous: ReportSnapshot): ReportDeltas {
  const out = {} as ReportDeltas;
  for (const key of Object.keys(current) as (keyof ReportSnapshot)[]) {
    const a = current[key];
    const b = previous[key];
    out[key] = a === null || b === null ? null : a - b;
  }
  return out;
}

/**
 * The full picture a report page needs, from a freshly-computed `Summary` plus (if one exists)
 * the previous month's snapshot. `best`/`worst` only ever include deep-audited sites (a `score`)
 * -- ranking sites that have never been checked would be meaningless -- and break ties by id so
 * the list is stable across otherwise-identical runs.
 */
export function buildReportData(registry: Registry, summary: Summary, previous: ReportSnapshot | null, month: string, now: Date): ReportData {
  const current = snapshotOf(summary);
  const scored = summary.sites.filter((s): s is typeof s & { score: number } => s.score !== null);
  const byScoreDesc = [...scored].sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  const byScoreAsc = [...scored].sort((a, b) => a.score - b.score || a.id.localeCompare(b.id));

  return {
    month,
    generated: now.toISOString(),
    totals: summary.totals,
    coverage: summary.coverage,
    median_score: current.median_score,
    deltas: previous ? computeDeltas(current, previous) : null,
    top_issues: summary.top_issues.map((issue) => ({ ...issue, title: CHECKS[issue.id as CheckId]?.title.en ?? issue.id })),
    best: byScoreDesc.slice(0, BEST_WORST_COUNT).map((s) => toReportSite(registry, s)),
    worst: byScoreAsc.slice(0, BEST_WORST_COUNT).map((s) => toReportSite(registry, s)),
  };
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function monthTitle(month: string): string {
  const [year, monthNum] = month.split('-').map(Number);
  return `${MONTH_NAMES[monthNum - 1]} ${year}`;
}

function deltaLine(label: string, delta: number | null): string {
  if (delta === null) return '';
  if (delta === 0) return `${label} unchanged`;
  return `${label} ${delta > 0 ? 'up' : 'down'} ${Math.abs(delta)}`;
}

function issuesTable(issues: ReportData['top_issues']): string {
  if (issues.length === 0) return '_No issues recorded yet._';
  const rows = issues.map((i) => `| ${i.title} | ${i.count.toLocaleString()} |`);
  return ['| Issue | Sites affected |', '|---|---|', ...rows].join('\n');
}

function sitesTable(sites: ReportSite[]): string {
  if (sites.length === 0) return '_Not enough deep-audited sites yet._';
  const rows = sites.map((s) => `| [${s.name}](/sites/${s.id}/) | ${s.department} | ${s.score} |`);
  return ['| Site | Department | Score |', '|---|---|---|', ...rows].join('\n');
}

/**
 * Renders `cli report`'s output file: YAML frontmatter carrying every number a future month's
 * report needs to diff against (`snapshot`), plus a plain-language markdown body. The frontmatter
 * is the only part `readPreviousSnapshot` below ever reads back -- the body is for citizens and
 * journalists, never re-parsed by this codebase.
 */
export function renderReportMarkdown(data: ReportData): string {
  const snapshot: ReportSnapshot = { ...data.totals, median_score: data.median_score };
  const frontmatter = yaml.dump({
    title: `State of Kerala Government Websites — ${monthTitle(data.month)}`,
    month: data.month,
    generated: data.generated,
    snapshot,
    deltas: data.deltas,
  });

  const deltaLines = data.deltas
    ? [
        deltaLine('Sites tracked', data.deltas.sites),
        deltaLine('Deep-audited', data.deltas.deep_audited),
        deltaLine('Down', data.deltas.down),
        deltaLine('Broken', data.deltas.broken),
        deltaLine('Healthy', data.deltas.healthy),
      ].filter(Boolean)
    : [];

  const brokenTotal = (data.totals.down + data.totals.hijacked + data.totals.broken).toLocaleString();
  const intro = [
    `We track ${data.totals.sites.toLocaleString()} Kerala government websites. ${data.totals.deep_audited.toLocaleString()} have had a full deep audit so far (checked for security, accessibility, content and GIGW compliance, not just whether the site answers). ${brokenTotal} are currently down, hijacked or broken; ${data.totals.unverifiable.toLocaleString()} could not be checked from our monitoring location.`,
    data.median_score !== null ? `The median score among deep-audited sites this month is **${data.median_score}/100**.` : null,
    deltaLines.length > 0 ? `**Compared to last month:** ${deltaLines.join(', ')}.` : null,
  ]
    .filter((line): line is string => line !== null)
    .join('\n\n');

  const body = `
${intro}

## Most common problems

${issuesTable(data.top_issues)}

## Best-scoring sites this month

${sitesTable(data.best)}

## Worst-scoring sites this month

${sitesTable(data.worst)}
`.trim();

  return `---\n${frontmatter}---\n\n${body}\n`;
}

/**
 * The previous month's `snapshot` block, read back from whichever `<reportsDir>/YYYY-MM.md` file
 * sorts immediately before `month` -- filenames are zero-padded `YYYY-MM`, so string order is
 * chronological order. Returns `null` on a report's first-ever run (no prior file) rather than
 * throwing, since a report with no deltas is still a valid report (WP4.6's own first run).
 */
export function readPreviousSnapshot(reportsDir: string, month: string): ReportSnapshot | null {
  if (!existsSync(reportsDir)) return null;
  const previousMonth = readdirSync(reportsDir)
    .filter((name) => name.endsWith('.md') && name < `${month}.md`)
    .sort()
    .at(-1);
  if (!previousMonth) return null;

  return parseSnapshot(readFileSync(join(reportsDir, previousMonth), 'utf-8'));
}

/** Pure string-in, value-out half of `readPreviousSnapshot` -- split out so a test can exercise
 * the frontmatter parsing without touching the filesystem. */
export function parseSnapshot(markdown: string): ReportSnapshot | null {
  const match = markdown.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) return null;
  const parsed = yaml.load(match[1]) as { snapshot?: ReportSnapshot } | undefined;
  return parsed?.snapshot ?? null;
}
