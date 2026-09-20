import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dump as dumpYaml, load as parseYaml } from 'js-yaml';
import { loadRegistry } from '../../audit/dist/registry.js';
import { dedupeKey, type Candidate, type CandidateHints } from './lib.js';

const CANDIDATES_DIR = join(process.cwd(), 'registry', 'candidates');
const REGISTRY_DIR = join(process.cwd(), 'registry');
const DRAFTS_DIR = join(process.cwd(), 'registry', 'drafts');

export interface FiledCandidate extends Candidate {
  file: string;
}

export interface CategorizedCandidates {
  alreadyInRegistry: FiledCandidate[];
  duplicateAcrossSources: FiledCandidate[];
  fresh: FiledCandidate[];
}

// no-website.yaml (WP1.6) records organisations with no discoverable URL at all -- {name, source,
// reason}, not a Candidate -- so it's excluded from the url-keyed dedupe/categorize pipeline here.
const NON_CANDIDATE_FILES = new Set(['no-website.yaml']);

function readAllCandidates(): FiledCandidate[] {
  const files = readdirSync(CANDIDATES_DIR).filter((f) => f.endsWith('.yaml') && !NON_CANDIDATE_FILES.has(f));
  return files.flatMap((file) => {
    const entries = (parseYaml(readFileSync(join(CANDIDATES_DIR, file), 'utf8')) as Candidate[]) ?? [];
    return entries.map((candidate) => ({ ...candidate, file }));
  });
}

function registryDedupeKeys(registryDir: string): Set<string> {
  const registry = loadRegistry(registryDir);
  const keys = new Set<string>();
  for (const site of registry.sites) {
    keys.add(dedupeKey(site.url));
    for (const alias of site.aliases) keys.add(dedupeKey(alias));
  }
  return keys;
}

function groupByDedupeKey(candidates: FiledCandidate[]): Map<string, FiledCandidate[]> {
  const groups = new Map<string, FiledCandidate[]>();
  for (const candidate of candidates) {
    const key = dedupeKey(candidate.url);
    const group = groups.get(key);
    if (group) group.push(candidate);
    else groups.set(key, [candidate]);
  }
  return groups;
}

/**
 * Sorts candidates into the three buckets the report shows: already registered (dedupeKey
 * matches an existing site's url or alias), duplicated across two or more harvest sources but
 * not yet registered, or genuinely new. Pulled out of main() so it's testable without touching
 * the filesystem.
 */
export function categorize(candidates: FiledCandidate[], registryKeys: Set<string>): CategorizedCandidates {
  const groups = groupByDedupeKey(candidates);
  const result: CategorizedCandidates = { alreadyInRegistry: [], duplicateAcrossSources: [], fresh: [] };

  for (const group of groups.values()) {
    const key = dedupeKey(group[0].url);
    if (registryKeys.has(key)) {
      result.alreadyInRegistry.push(...group);
    } else if (group.length > 1) {
      result.duplicateAcrossSources.push(...group);
    } else {
      result.fresh.push(group[0]);
    }
  }

  return result;
}

// WP1.7 step 1: propose a tier per fresh candidate so drafts can be curated tier-by-tier
// ("state+directorates; agencies+statutory; PSUs; universities; districts", per the WP text).
// Only the tiers WP1.7 actually curates -- college is Phase 5 (DESIGN §2), lsg is fully done by
// WP1.4 already.
export type DraftTier = 'state' | 'directorate' | 'agency' | 'statutory' | 'university' | 'psu' | 'district';

const KIND_TO_TIER: Partial<Record<string, DraftTier>> = {
  university: 'university',
  psu: 'psu',
  board: 'statutory',
  commission: 'statutory',
  council: 'statutory',
  authority: 'statutory',
  mission: 'agency',
  agency: 'agency',
  society: 'agency',
  district_admin: 'district',
};

// Out of this WP's scope entirely -- not even worth a draft. Phase 5 (colleges), judiciary (no
// scope decision made yet -- see STATE.md open questions), sub-district police posts (the single
// state-level keralapolice.gov.in is handled by the KIND_TO_TIER/department path instead), and
// LSGI names that slipped through WP1.4's own exhaustive dedupe under a slightly different URL.
const SKIP_PATTERNS: RegExp[] = [
  /college/i, /school/i, /kendriya vidyalaya/i, /navodaya/i, /polytechnic/i,
  /district court/i, /dcourts\.gov\.in/i, /high\s*court/i,
  /\.keralapolice\.gov\.in/i,
  /grama panchayat|block panchayat|district panchayat|municipal corporation|^corporation of/i,
];

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/\([^)]*\)/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

export interface DraftEntry {
  id: string;
  name: string;
  url: string;
  department: string | null;
  district: string | null;
  place: string | null;
  kind: string | null;
  source: string;
  notes: string;
}

/**
 * Proposes a tier for a fresh candidate from its hints.kind (set by curated.ts for WP1.6's
 * PSU/statutory/university/mission pass) or, failing that, name patterns for the plain
 * "X Department, Kerala" and bare district-portal shapes WP1.2/1.3/1.5 left uncurated. Returns
 * null for candidates this WP doesn't draft at all (see SKIP_PATTERNS). A human still assigns
 * department/district/place/priority during curation -- this is a starting proposal, not a
 * final answer.
 */
export function classifyDraftTier(candidate: { name: string; url: string; hints: CandidateHints }): DraftTier | null {
  if (/^https?:\/\/(www\.)?keralapolice\.gov\.in\/?$/i.test(candidate.url)) return 'directorate';
  if (SKIP_PATTERNS.some((re) => re.test(candidate.name) || re.test(candidate.url))) {
    return null;
  }
  const kindTier = candidate.hints.kind ? KIND_TO_TIER[candidate.hints.kind] : undefined;
  if (kindTier) return kindTier;
  if (/department, kerala$/i.test(candidate.name)) return 'directorate';
  return null; // genuinely unclassified -- left for a future harvest/curation pass, not guessed
}

/**
 * Not-yet-registered candidates worth drafting: every "fresh" one, plus one representative per
 * "duplicate across sources" group -- two independent harvests agreeing on the same URL is a
 * *stronger* signal than a singleton, not noise to discard. Prefers the copy carrying
 * hints.kind (WP1.6's curated.ts pass) since it classifies more precisely than a bare crawl hit.
 */
export function pickDraftCandidates(categorized: CategorizedCandidates): FiledCandidate[] {
  const groups = new Map<string, FiledCandidate[]>();
  for (const candidate of categorized.duplicateAcrossSources) {
    const key = dedupeKey(candidate.url);
    const group = groups.get(key);
    if (group) group.push(candidate);
    else groups.set(key, [candidate]);
  }
  const representatives = [...groups.values()].map((group) => group.find((c) => c.hints.kind) ?? group[0]);
  return [...categorized.fresh, ...representatives];
}

function writeDrafts(candidates: FiledCandidate[]): void {
  const byTier = new Map<DraftTier, DraftEntry[]>();
  const usedIds = new Set<string>();
  let skipped = 0;

  for (const candidate of candidates) {
    const tier = classifyDraftTier(candidate);
    if (!tier) {
      skipped++;
      continue;
    }
    let id = slugify(candidate.name);
    if (usedIds.has(id)) id = `${id}-${usedIds.size}`;
    usedIds.add(id);

    const list = byTier.get(tier) ?? [];
    list.push({
      id,
      name: candidate.name,
      url: candidate.url,
      department: candidate.hints.department ?? null,
      district: candidate.hints.district ?? null,
      place: null,
      kind: candidate.hints.kind ?? null,
      source: candidate.source,
      notes: '',
    });
    byTier.set(tier, list);
  }

  if (!existsSync(DRAFTS_DIR)) mkdirSync(DRAFTS_DIR, { recursive: true });
  for (const [tier, list] of byTier) {
    const path = join(DRAFTS_DIR, `${tier}.yaml`);
    writeFileSync(path, dumpYaml(list, { sortKeys: false, lineWidth: -1 }));
    console.log(`Wrote ${list.length} drafts to ${path}`);
  }
  console.log(`Skipped ${skipped} fresh candidates outside WP1.7's scope (colleges, courts, unclassified) -- left in registry/candidates/, not drafted.`);
}

function main(): void {
  const registryKeys = registryDedupeKeys(REGISTRY_DIR);
  const candidates = readAllCandidates();
  const { alreadyInRegistry, duplicateAcrossSources, fresh } = categorize(candidates, registryKeys);

  console.log(`Candidates found: ${candidates.length}`);
  console.log(`  already in registry: ${alreadyInRegistry.length}`);
  console.log(`  duplicate across sources: ${duplicateAcrossSources.length}`);
  console.log(`  new: ${fresh.length}`);

  if (process.argv.includes('--write-drafts')) {
    writeDrafts(pickDraftCandidates({ alreadyInRegistry, duplicateAcrossSources, fresh }));
    return;
  }

  if (fresh.length > 0) {
    console.log('\nNew candidates:');
    for (const candidate of fresh) {
      console.log(`  - ${candidate.name} <${candidate.url}> (${candidate.source})`);
    }
  }
}

const isMainModule = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMainModule) main();
