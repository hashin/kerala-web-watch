import type { CrawlOutlink } from './crawl.js';

export interface OutlinkEntry {
  count: number;
  from: string[];
  texts: string[];
}

/** `data/outlinks.json` shape, DESIGN §6.6: `{host: {count, from:[ids<=5], texts:[<=3]}}`. */
export type OutlinksData = Record<string, OutlinkEntry>;

const MAX_FROM = 5;
const MAX_TEXTS = 3;

/**
 * Recomputed wholesale from every site's *current* `deep.outlinks` (same "recompute, don't
 * accumulate" pattern `summary.ts` already uses for `summary.json`) rather than folded
 * incrementally into the previous `outlinks.json` -- an incremental fold can't be idempotent,
 * since re-merging the same shard output twice would double-count its contribution, and WP3.6
 * requires merging the same `out/` twice to change nothing. Recomputing from `data/results/*.json`
 * (which a deep audit only touches when that site is actually re-audited) also means a host
 * naturally drops off once no site's most recent crawl links to it any more.
 */
export function computeOutlinks(sites: { id: string; outlinks: CrawlOutlink[] }[]): OutlinksData {
  const sorted = [...sites].sort((a, b) => a.id.localeCompare(b.id));
  const data: OutlinksData = {};
  for (const { id, outlinks } of sorted) {
    for (const { host, count, texts } of outlinks) {
      const entry = data[host] ?? { count: 0, from: [], texts: [] };
      entry.count += count;
      if (!entry.from.includes(id) && entry.from.length < MAX_FROM) entry.from.push(id);
      for (const text of texts) {
        if (entry.texts.length >= MAX_TEXTS) break;
        if (text && !entry.texts.includes(text)) entry.texts.push(text);
      }
      data[host] = entry;
    }
  }
  return data;
}
