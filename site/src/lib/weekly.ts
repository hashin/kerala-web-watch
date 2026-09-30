// Weekly snapshots: the dashboard's week-over-week deltas and 8-week trend.
// Source: data/weekly/<ISO-week>.json on the `data` branch, written by `cli weekly` (audit/src/weekly.ts).
// Every reader degrades to "no history yet" (null / empty) so the site still builds on a fresh clone.
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { isoWeek, istWeek } from '../../../audit/dist/weekly.js';
import { statusFromScore } from '../../../audit/dist/score.js';
import type { WeekSnapshot } from '../../../audit/dist/weekly.js';
import type { SiteView, Status } from './data';
import { countByStatus } from './rollups';
import { STATUS_COLOR } from './bands';
import type { Delta } from './types';

export type { WeekSnapshot, Delta };
export { isoWeek, istWeek };

const DIR = resolve(process.cwd(), '..', 'data', 'weekly');

let cache: WeekSnapshot[] | undefined;
/** Oldest → newest. */
export function getSnapshots(): WeekSnapshot[] {
  if (!cache) {
    cache = existsSync(DIR)
      ? readdirSync(DIR).filter((f) => /^\d{4}-W\d{2}\.json$/.test(f)).sort()
          .map((f) => JSON.parse(readFileSync(resolve(DIR, f), 'utf8')) as WeekSnapshot)
      : [];
  }
  return cache;
}
export const latestSnapshot = (): WeekSnapshot | null => getSnapshots().at(-1) ?? null;
export const snapshotByWeek = (w: string) => getSnapshots().find((s) => s.week === w) ?? null;

/** The week the site is being built in (IST, like the snapshots). */
export const currentWeek = () => istWeek(new Date());

/** Snapshots of weeks strictly before `week`, oldest first. The live numbers on a page belong to the
 * current week, so "last week" is never a snapshot of this same week (which exists from Sunday night). */
export const snapshotsBefore = (snaps: WeekSnapshot[], week: string): WeekSnapshot[] => snaps.filter((s) => s.week < week);

/** What every weekly delta compares against: the newest snapshot from an earlier week, or null. */
export const comparisonSnapshot = (week = currentWeek().week): WeekSnapshot | null => snapshotsBefore(getSnapshots(), week).at(-1) ?? null;

export const BROKEN: Status[] = ['down', 'hijacked', 'broken'];
export const brokenCount = (c: Record<Status, number>) => BROKEN.reduce((n, s) => n + c[s], 0);

export interface TrendPoint { week: string; broken: number; now: boolean }

/** Last `n` weeks of "broken sites", oldest first, ending with the live count for the current week. */
export function trendPoints(snaps: WeekSnapshot[], week: string, liveBroken: number, n = 8): TrendPoint[] {
  const past = snapshotsBefore(snaps, week).slice(-(n - 1)).map((s) => ({ week: s.week.slice(-3), broken: brokenCount(s.counts), now: false }));
  return [...past, { week: 'Now', broken: liveBroken, now: true }];
}
export const brokenTrend = (sites: SiteView[], n = 8): TrendPoint[] => trendPoints(getSnapshots(), currentWeek().week, brokenCount(countByStatus(sites)), n);

/** Values for a KPI tile's sparkline: earlier weeks then the live value. Empty until two earlier weeks
 * exist, because a two-bar "trend" is a comparison, not a trend (the delta already says that). */
export function countSeries(snaps: WeekSnapshot[], week: string, pick: (counts: Record<Status, number>) => number, live: number, n = 8): number[] {
  const past = snapshotsBefore(snaps, week).slice(-(n - 1));
  return past.length < 2 ? [] : [...past.map((s) => pick(s.counts)), live];
}

/** ▲/▼ text plus whether it is good or bad news. `upIsBad`: true for broken/poor counts, false for healthy/coverage.
 * Null when there is no earlier week to compare with, so callers render nothing rather than a fake zero. */
export function delta(cur: number, prev: number | null | undefined, upIsBad: boolean, unit = ''): Delta | null {
  if (prev == null) return null;
  const d = cur - prev;
  if (d === 0) return { text: 'no change', tone: 'flat' };
  const up = d > 0;
  return { text: `${up ? '▲' : '▼'} ${Math.abs(d).toLocaleString('en-IN')}${unit}`, tone: up === upIsBad ? 'bad' : 'good' };
}

export interface HistoryPoint { d: string; up: boolean; score: number | null }

/**
 * One colour per ISO week, oldest first, for the 12-week strip. A week takes its latest history entry:
 * a failed check is Crimson whatever the score, a missing score is grey, otherwise the score's band.
 * `history` is newest-first, as stored in each result.
 */
export function weekStrip(history: HistoryPoint[] = [], weeks = 12, now = new Date()): string[] {
  const out: string[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const { from, to } = isoWeek(new Date(now.getTime() - i * 7 * 864e5));
    const entry = history.find((e) => e.d >= from && e.d <= to);
    out.push(!entry || (entry.up && entry.score == null) ? 'var(--grey-soft)' : !entry.up ? STATUS_COLOR.down : STATUS_COLOR[statusFromScore(entry.score ?? 0)]);
  }
  return out;
}
