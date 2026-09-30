// Every hover explanation on the dashboard. The copy lives in i18n/{en,ml}.json under `tip.*`; this
// file is the typed accessor so components keep writing `TIP.median`. Keep copy plain-language:
// written for a citizen first, a webmaster second (ADR-013 tone).
import { t, type Locale, type TranslationKey } from '../i18n';
import type { Status } from './data';

const STATUSES: Status[] = ['healthy', 'needs-work', 'poor', 'down', 'hijacked', 'broken', 'unverifiable', 'unaudited'];
const CATEGORIES = ['security', 'accessibility', 'content', 'gigw', 'performance', 'identity', 'availability'] as const;
const CHECKS = ['up', 'secure', 'accessible', 'fast', 'maintained', 'gigw'] as const;
const TIP_NAMES = [
  'brokenHeadline', 'kpiHealthy', 'kpiNeedsWork', 'kpiPoor', 'kpiBroken', 'kpiUnaudited', 'delta', 'week', 'compare',
  'healthBar', 'trend', 'coverage', 'broke', 'fixed', 'median', 'broken_share', 'score', 'strip', 'ministryTile',
  'rankRow', 'leaderboard', 'improved', 'districtMap', 'districtRanking', 'ministryGrid', 'siteScore', 'siteScoreChange',
  'sixChecks', 'screenshot', 'uptime', 'openIssues', 'techFacts', 'siteActions', 'actionsBlock', 'reportArchive',
  'reportBody', 'toc', 'filterName', 'groupTracked', 'groupBroken', 'groupDeepAudited', 'urgent', 'actionGradeTile', 'actionTable',
] as const;

export type TipName = (typeof TIP_NAMES)[number];

function collect<K extends string>(locale: Locale, prefix: string, names: readonly K[]): Record<K, string> {
  return Object.fromEntries(names.map((n) => [n, t(locale, `${prefix}${n}` as TranslationKey)])) as Record<K, string>;
}

export interface TipSet {
  TIP: Record<TipName, string>;
  STATUS_TIP: Record<Status, string>;
  CATEGORY_TIP: Record<string, string>;
  CHECK_TIP: Record<string, string>;
}

const cache = new Map<Locale, TipSet>();

/** All tooltip strings for one page language. Cached: the site reads them thousands of times per build. */
export function tips(locale: Locale = 'en'): TipSet {
  let set = cache.get(locale);
  if (!set) {
    set = {
      TIP: collect(locale, 'tip.', TIP_NAMES),
      STATUS_TIP: collect(locale, 'tip.status.', STATUSES),
      CATEGORY_TIP: collect(locale, 'tip.category.', CATEGORIES),
      CHECK_TIP: collect(locale, 'tip.check.', CHECKS),
    };
    cache.set(locale, set);
  }
  return set;
}
