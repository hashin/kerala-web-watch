import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { writeJsonAtomic } from './store.js';
import { isBrokenClass, type ResultStatus } from './status.js';
import type { GroupStat, Summary } from './summary.js';
import type { Registry } from './types.js';

/** One ISO week's picture of the whole registry -- the dashboard's week-over-week deltas and trend
 * lines read only these files (`data/weekly/<week>.json`), never `results/`. */
export interface WeekSnapshot {
  week: string;
  from: string;
  to: string;
  counts: Record<ResultStatus, number>;
  deep_audited: number;
  districts: Record<string, GroupStat>;
  ministries: Record<string, GroupStat>;
  departments: Record<string, GroupStat>;
  /** Every site that was down/hijacked/broken when the snapshot was taken -- what next week diffs against. */
  broken_ids: string[];
  /** Broken now but not in the previous snapshot's `broken_ids`, excluding sites registered after it. */
  broke: string[];
  /** In the previous snapshot's `broken_ids`, still registered, and no longer broken. */
  fixed: string[];
}

const DAY_MS = 86_400_000;
const IST_OFFSET_MS = 5.5 * 3_600_000;

const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** ISO-8601 week (Monday-Sunday) containing the UTC calendar day of `date`. */
export function isoWeek(date: Date): { week: string; from: string; to: string } {
  const day = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const monday = day - ((new Date(day).getUTCDay() || 7) - 1) * DAY_MS;
  const thursday = new Date(monday + 3 * DAY_MS);
  const year = thursday.getUTCFullYear();
  const week = Math.floor((thursday.getTime() - Date.UTC(year, 0, 1)) / DAY_MS / 7) + 1;
  return { week: `${year}-W${String(week).padStart(2, '0')}`, from: isoDay(monday), to: isoDay(monday + 6 * DAY_MS) };
}

/** The week a moment belongs to in India, where the audience lives: 00:30 on a Monday IST is still
 * Sunday in UTC, and must already count as the new week. */
export const istWeek = (now: Date) => isoWeek(new Date(now.getTime() + IST_OFFSET_MS));

const STATUSES: ResultStatus[] = ['down', 'hijacked', 'broken', 'poor', 'unverifiable', 'unaudited', 'needs-work', 'healthy'];

function countsFromSummary(totals: Summary['totals']): Record<ResultStatus, number> {
  const counts = {} as Record<ResultStatus, number>;
  for (const status of STATUSES) counts[status] = totals[(status === 'needs-work' ? 'needs_work' : status) as keyof Summary['totals']];
  return counts;
}

export function buildWeekSnapshot(registry: Registry, summary: Summary, previous: WeekSnapshot | null, now: Date): WeekSnapshot {
  const brokenIds = summary.sites.filter((s) => isBrokenClass(s.status)).map((s) => s.id).sort();
  const wasBroken = new Set(previous?.broken_ids ?? []);
  const nowBroken = new Set(brokenIds);
  const registeredBeforePrevious = (id: string) => (registry.byId.get(id)?.added ?? '') <= (previous?.to ?? '');

  return {
    ...istWeek(now),
    counts: countsFromSummary(summary.totals),
    deep_audited: summary.totals.deep_audited,
    districts: summary.by_district,
    ministries: summary.by_ministry,
    departments: summary.by_department,
    broken_ids: brokenIds,
    broke: previous ? brokenIds.filter((id) => !wasBroken.has(id) && registeredBeforePrevious(id)) : [],
    fixed: previous ? [...wasBroken].filter((id) => registry.byId.has(id) && !nowBroken.has(id)).sort() : [],
  };
}

const WEEK_FILE = /^\d{4}-W\d{2}\.json$/;

/** The newest snapshot strictly before `week`, so a same-week re-run diffs against last week, not itself. */
export function readPreviousWeek(dataDir: string, week: string): WeekSnapshot | null {
  const dir = join(dataDir, 'weekly');
  if (!existsSync(dir)) return null;
  const earlier = readdirSync(dir).filter((f) => WEEK_FILE.test(f) && f.slice(0, -5) < week).sort();
  const newest = earlier.at(-1);
  return newest ? (JSON.parse(readFileSync(join(dir, newest), 'utf8')) as WeekSnapshot) : null;
}

export function writeWeekSnapshot(dataDir: string, snapshot: WeekSnapshot): string {
  const path = join(dataDir, 'weekly', `${snapshot.week}.json`);
  writeJsonAtomic(path, snapshot);
  return path;
}
