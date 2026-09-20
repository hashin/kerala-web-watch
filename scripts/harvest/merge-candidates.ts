import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { load as parseYaml } from 'js-yaml';
import { loadRegistry } from '../../audit/dist/registry.js';
import { dedupeKey, type Candidate } from './lib.js';

const CANDIDATES_DIR = join(process.cwd(), 'registry', 'candidates');
const REGISTRY_DIR = join(process.cwd(), 'registry');

export interface FiledCandidate extends Candidate {
  file: string;
}

export interface CategorizedCandidates {
  alreadyInRegistry: FiledCandidate[];
  duplicateAcrossSources: FiledCandidate[];
  fresh: FiledCandidate[];
}

function readAllCandidates(): FiledCandidate[] {
  const files = readdirSync(CANDIDATES_DIR).filter((f) => f.endsWith('.yaml'));
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

function main(): void {
  const registryKeys = registryDedupeKeys(REGISTRY_DIR);
  const candidates = readAllCandidates();
  const { alreadyInRegistry, duplicateAcrossSources, fresh } = categorize(candidates, registryKeys);

  console.log(`Candidates found: ${candidates.length}`);
  console.log(`  already in registry: ${alreadyInRegistry.length}`);
  console.log(`  duplicate across sources: ${duplicateAcrossSources.length}`);
  console.log(`  new: ${fresh.length}`);

  if (fresh.length > 0) {
    console.log('\nNew candidates:');
    for (const candidate of fresh) {
      console.log(`  - ${candidate.name} <${candidate.url}> (${candidate.source})`);
    }
  }
}

const isMainModule = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMainModule) main();
