// Weekly snapshots: the dashboard's week-over-week deltas and 8-week trend.
// Source: data/weekly/<ISO-week>.json on the `data` branch, written by `cli weekly` (audit/src/weekly.ts).
// Every reader degrades to "no history yet" (null / empty) so the site still builds on a fresh clone.
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { isoWeek } from '../../../audit/dist/weekly.js';
import { statusFromScore } from '../../../audit/dist/score.js';
import type { WeekSnapshot } from '../../../audit/dist/weekly.js';
import type { SiteView, Status } from './data';
import { countByStatus } from './rollups';
import { STATUS_COLOR } from './bands';
import type { Delta } from './types';

export type { WeekSnapshot, Delta };
export { isoWeek };

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
export const previousSnapshot = (): WeekSnapshot | null => getSnapshots().at(-2) ?? null;
export const snapshotByWeek = (w: string) => getSnapshots().find((s) => s.week === w) ?? null;

export const BROKEN: Status[] = ['down', 'hijacked', 'broken'];
export const brokenCount = (c: Record<Status, number>) => BROKEN.reduce((n, s) => n + c[s], 0);

/** Last `n` weeks of "broken sites", oldest first, ending with the live count for this week. */
export function brokenTrend(sites: SiteView[], n = 8): { week: string; broken: number; now: boolean }[] {
  const past = getSnapshots().slice(-(n - 1)).map((s) => ({ week: s.week.slice(-3), broken: brokenCount(s.counts), now: false }));
  return [...past, { week: 'Now', broken: brokenCount(countByStatus(sites)), now: true }];
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
