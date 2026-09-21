import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { load as parseYaml } from 'js-yaml';

interface UrlFields {
  url: string;
  aliases: string[];
}

type RawSite = { id: string; url: string; aliases?: string[] };

/**
 * An id is "changed" if it's new since `ref`, or its url/aliases differ -- the only fields
 * `--resolve` (WP2.5) cares about, since a live check is about whether the URL actually works,
 * not whether e.g. a `notes` or `tags` edit happened. Comparing the full entry would re-check
 * sites on every unrelated edit; comparing nothing but the id would miss a URL correction, which
 * is exactly the case `--resolve` exists to catch.
 */
export function computeChangedIds(before: Map<string, UrlFields>, after: Map<string, UrlFields>): Set<string> {
  const changed = new Set<string>();
  for (const [id, fields] of after) {
    const prior = before.get(id);
    if (!prior || prior.url !== fields.url || prior.aliases.join(',') !== fields.aliases.join(',')) {
      changed.add(id);
    }
  }
  return changed;
}

function toUrlFields(entries: RawSite[]): Map<string, UrlFields> {
  const fields = new Map<string, UrlFields>();
  for (const entry of entries) fields.set(entry.id, { url: entry.url, aliases: entry.aliases ?? [] });
  return fields;
}

/** Reads every `registry/sites/*.yaml` file as it existed at `ref` (a brand new file simply has
 * no entries at that ref, same as if it were empty -- every id in it is then "new"). Shells out
 * to `git show` rather than requiring a full checkout of `ref`, since CI only has the PR's tree. */
function loadUrlFieldsAtRef(registryDir: string, ref: string): Map<string, UrlFields> {
  const sitesDir = join(registryDir, 'sites');
  const entries: RawSite[] = [];
  for (const file of readdirSync(sitesDir).filter((f) => f.endsWith('.yaml'))) {
    let raw: string;
    try {
      raw = execFileSync('git', ['show', `${ref}:${registryDir}/sites/${file}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    } catch {
      continue; // file doesn't exist at ref -- every entry in today's version of it is new
    }
    entries.push(...((parseYaml(raw) as RawSite[]) ?? []));
  }
  return toUrlFields(entries);
}

function loadUrlFieldsFromWorkingTree(registryDir: string): Map<string, UrlFields> {
  const sitesDir = join(registryDir, 'sites');
  const entries: RawSite[] = [];
  for (const file of readdirSync(sitesDir).filter((f) => f.endsWith('.yaml'))) {
    const raw = readFileSync(join(sitesDir, file), 'utf8');
    entries.push(...((parseYaml(raw) as RawSite[]) ?? []));
  }
  return toUrlFields(entries);
}

/** Site ids added or URL-changed in the working tree relative to `ref` (typically `origin/main`). */
export function changedSiteIds(registryDir: string, ref: string): Set<string> {
  const before = loadUrlFieldsAtRef(registryDir, ref);
  const after = loadUrlFieldsFromWorkingTree(registryDir);
  return computeChangedIds(before, after);
}
