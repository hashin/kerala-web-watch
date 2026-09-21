import type { Result } from './store.js';

export type Tier = 1 | 2 | 3 | 4;

const TIER_LABEL: Record<Tier, string> = {
  1: 'forced (bumped or manually requested)',
  2: 'never deep-audited',
  3: 'status just changed',
  4: 'oldest deep audit first',
};

export interface ScheduleState {
  /** ADR-016's forced tier: a light check saw the homepage change materially since the last deep
   * audit. */
  deepBump: boolean;
  /** `null` means this site has never been deep-audited -- DESIGN §6.2 tier 2, the initial sweep. */
  deepAt: string | null;
  /** DESIGN §6.2 tier 3 ("status just changed: came back up, went down"): the site's up/down
   * state flipped between the two most recent history entries. */
  statusJustChanged: boolean;
}

/** Reads the three `ScheduleState` signals off a site's stored `data/results/<id>.json` -- a site
 * with no stored result yet (brand new to the registry) reads as "never audited", which is
 * correct: it belongs in tier 2 regardless of anything else. */
export function deriveScheduleState(result: Result | null): ScheduleState {
  if (!result) return { deepBump: false, deepAt: null, statusJustChanged: false };
  const h = result.history;
  return {
    deepBump: result.deep_bump,
    deepAt: result.deep?.at ?? null,
    statusJustChanged: h.length >= 2 && h[0].up !== h[1].up,
  };
}

export interface SchedulableSite extends ScheduleState {
  id: string;
  priority: 1 | 2 | 3;
}

export interface PlannedSite {
  id: string;
  tier: Tier;
}

function tierOf(site: ScheduleState): Tier {
  if (site.deepBump) return 1;
  if (site.deepAt === null) return 2;
  if (site.statusJustChanged) return 3;
  return 4;
}

/**
 * DESIGN §6.2's ordering, applied to every active, non-forced site: tier first (see `tierOf`),
 * then within tier 4 the oldest `deep.at` first, then priority descending (state core before
 * district/ULB before GP/college), then `id` as the final, fully-deterministic tie-break.
 */
export function orderSites(sites: SchedulableSite[]): PlannedSite[] {
  return [...sites]
    .map((site) => ({ ...site, tier: tierOf(site) }))
    .sort((a, b) => {
      if (a.tier !== b.tier) return a.tier - b.tier;
      if (a.tier === 4) {
        const atA = a.deepAt ?? '';
        const atB = b.deepAt ?? '';
        if (atA !== atB) return atA < atB ? -1 : 1;
      }
      if (a.priority !== b.priority) return b.priority - a.priority;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    })
    .map((site) => ({ id: site.id, tier: site.tier }));
}

/** ADR-004: `clamp(ceil(N / refreshDays), 50, maxBatch)` -- every active site re-audited at least
 * once every `refreshDays` in steady state, floored so a small registry still gets a meaningful
 * batch and capped so Actions minutes stay bounded as the registry grows (DESIGN §6.5). */
export function computeBatchSize(activeCount: number, opts: { refreshDays: number; minBatch: number; maxBatch: number }): number {
  return Math.min(opts.maxBatch, Math.max(opts.minBatch, Math.ceil(activeCount / opts.refreshDays)));
}

/** `K = min(maxShards, ceil(batchSize / shardSize))`, at least 1 so an empty or tiny batch still
 * gets a single (possibly empty) shard rather than a division by zero. */
export function computeShardCount(batchSize: number, opts: { maxShards: number; shardSize: number }): number {
  return Math.max(1, Math.min(opts.maxShards, Math.ceil(batchSize / opts.shardSize)));
}

/** Round-robin, not contiguous chunks, so one slow/large site doesn't concentrate in a single
 * shard just because of where it happened to land in tier order. */
export function shardRoundRobin(ids: string[], shardCount: number): string[][] {
  const shards: string[][] = Array.from({ length: shardCount }, () => []);
  ids.forEach((id, i) => shards[i % shardCount].push(id));
  return shards;
}

export interface PlanInput {
  activeSites: { id: string; priority: 1 | 2 | 3 }[];
  scheduleState: Map<string, ScheduleState>;
  /** `--site-ids`: bypasses tiering/batch-size entirely and uses exactly this list, in the given
   * order -- DESIGN §6.2's "Manual" case (a department that fixed something gets re-audited today). */
  forcedSiteIds: string[];
  /** `--batch-size`: overrides `computeBatchSize`'s result outright. */
  batchSizeOverride?: number;
  refreshDays: number;
  minBatch: number;
  maxBatch: number;
  maxShards: number;
  shardSize: number;
}

export interface PlanOutput {
  /** The full tiered ordering of every active site -- `null` when `forcedSiteIds` bypassed it,
   * since a manual re-audit has nothing to order. Mainly useful for `--dry-run`'s table. */
  ordered: PlannedSite[] | null;
  selected: PlannedSite[];
  batchSize: number;
  shards: string[][];
}

export function planBatch(input: PlanInput): PlanOutput {
  let ordered: PlannedSite[] | null = null;
  let selected: PlannedSite[];

  if (input.forcedSiteIds.length > 0) {
    selected = input.forcedSiteIds.map((id) => ({ id, tier: 1 as const }));
  } else {
    const withState: SchedulableSite[] = input.activeSites.map((site) => ({
      ...site,
      ...(input.scheduleState.get(site.id) ?? { deepBump: false, deepAt: null, statusJustChanged: false }),
    }));
    ordered = orderSites(withState);
    const batchSize = input.batchSizeOverride ?? computeBatchSize(input.activeSites.length, input);
    selected = ordered.slice(0, batchSize);
  }

  const shardCount = computeShardCount(selected.length, input);
  const shards = shardRoundRobin(
    selected.map((s) => s.id),
    shardCount,
  );

  return { ordered, selected, batchSize: selected.length, shards };
}

/** `--dry-run`'s human-readable output: tier counts, then the batch itself capped at 50 rows so a
 * 300-site batch doesn't dump a 300-line table into a terminal. */
export function toPlanTable(output: PlanOutput): string {
  const tierCounts = new Map<Tier, number>();
  for (const site of output.selected) tierCounts.set(site.tier, (tierCounts.get(site.tier) ?? 0) + 1);

  const tierLines = ([1, 2, 3, 4] as Tier[])
    .filter((tier) => tierCounts.has(tier))
    .map((tier) => `  tier ${tier} -- ${TIER_LABEL[tier]}: ${tierCounts.get(tier)}`);

  const ROW_CAP = 50;
  const header = '| # | Tier | Id |\n|---|---|---|';
  const rows = output.selected.slice(0, ROW_CAP).map((site, index) => `| ${index + 1} | ${site.tier} | ${site.id} |`);
  const more = output.selected.length > ROW_CAP ? `\n… and ${output.selected.length - ROW_CAP} more` : '';

  return [`### Batch: ${output.selected.length} sites across ${output.shards.length} shards`, ...tierLines, '', header, ...rows].join('\n') + more;
}
