import { computeActionReport, BUCKET_ORDER, type Action, type ActionReport, type Bucket, type Grade, type SiteActions } from '../../../audit/dist/actions.js';
import { CHECKS, getSites, type SiteView } from './data';
import { getRegistryForActions } from './data';
import type { Locale } from '../i18n';

export type { Action, ActionReport, Bucket, Grade, SiteActions };
export { BUCKET_ORDER };

let cachedReport: ActionReport | undefined;

/** Recomputed at build time from the same results `getSites()` loaded -- never read from a
 * checked-in `actions.json`, so the pages are never one stale file behind (same rule as `getSummary`). */
export function getActionReport(): ActionReport {
  if (!cachedReport) {
    const results = getSites().map((s) => s.result).filter((r): r is NonNullable<SiteView['result']> => r !== null);
    cachedReport = computeActionReport(getRegistryForActions(), results, { now: new Date() });
  }
  return cachedReport;
}

const pick = (field: { en: string; ml: string }, locale: Locale): string => field[locale] || field.en;

export interface ActionView {
  grade: Grade;
  check: string;
  title: string;
  citizen: string;
  fix: string;
  ev?: string;
  basis: 'deep' | 'light';
  observed: string;
  /** Where on the site page the matching issue card lives; a light-only action has none. */
  anchor: string | null;
}

export interface ActionRow {
  site: SiteView;
  bucket: Bucket;
  actions: ActionView[];
  top: ActionView | null;
  checked: string | null;
}

export function actionView(action: Action, locale: Locale): ActionView {
  const meta = CHECKS[action.check];
  return {
    grade: action.grade,
    check: action.check,
    title: pick(meta.title, locale),
    citizen: pick(meta.citizen, locale),
    fix: pick(meta.fix, locale),
    ev: action.ev,
    basis: action.basis,
    observed: action.observed,
    anchor: action.basis === 'deep' ? `issue-${action.check}` : null,
  };
}

export function actionRows(report: ActionReport, sites: SiteView[], locale: Locale): ActionRow[] {
  const byId = new Map(sites.map((s) => [s.id, s]));
  return report.sites.flatMap((entry) => {
    const site = byId.get(entry.id);
    if (!site) return [];
    const actions = entry.actions.map((a) => actionView(a, locale));
    return [{ site, bucket: entry.bucket, actions, top: actions[0] ?? null, checked: entry.deep_at ?? entry.light_at }];
  });
}

export function rowsInBuckets(rows: ActionRow[], buckets: Bucket[]): ActionRow[] {
  return rows.filter((r) => buckets.includes(r.bucket));
}

function csvField(value: string | number | null): string {
  const text = value === null ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export const ACTIONS_CSV_HEADER = 'site_id,site_name,url,department,district,site_grade,action_grade,check_id,check_title,severity,basis,observed,evidence';

/** `api/actions.csv`: one row per action, for journalists and departmental trackers. */
export function actionsCsv(report: ActionReport, sites: SiteView[]): string {
  const byId = new Map(sites.map((s) => [s.id, s]));
  const rows: string[] = [];
  for (const entry of report.sites) {
    const site = byId.get(entry.id);
    if (!site) continue;
    for (const a of entry.actions) {
      rows.push(
        [site.id, site.name, site.url, site.department, site.district ?? '', entry.bucket, a.grade, a.check, CHECKS[a.check].title.en, a.sev, a.basis, a.observed, a.ev ?? '']
          .map(csvField)
          .join(','),
      );
    }
  }
  return [ACTIONS_CSV_HEADER, ...rows, ''].join('\n');
}

/** `api/actions.json`: the report plus each site's name/url/department/district and each action's English title/citizen text. */
export function actionsApi(report: ActionReport, sites: SiteView[]) {
  const byId = new Map(sites.map((s) => [s.id, s]));
  return {
    ...report,
    sites: report.sites.map((entry) => {
      const site = byId.get(entry.id);
      return {
        ...entry,
        name: site?.name ?? null,
        url: site?.url ?? null,
        department: site?.department ?? null,
        district: site?.district ?? null,
        actions: entry.actions.map((a) => ({ ...a, title_en: CHECKS[a.check].title.en, citizen_en: CHECKS[a.check].citizen.en })),
      };
    }),
  };
}

/** The grade a site shows in `sites.csv`: its bucket, as a string. */
export function siteBucket(report: ActionReport, id: string): string {
  return String(report.sites.find((s) => s.id === id)?.bucket ?? '');
}
