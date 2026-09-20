import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { load as parseYaml } from 'js-yaml';
import { normalizeUrl } from './url.js';
import type {
  Department,
  District,
  IgnoreEntry,
  Minister,
  Place,
  Registry,
  Site,
} from './types.js';

function readYaml<T>(path: string): T {
  return parseYaml(readFileSync(path, 'utf8')) as T;
}

function readSites(registryDir: string): Site[] {
  const sitesDir = join(registryDir, 'sites');
  const files = readdirSync(sitesDir).filter((f) => f.endsWith('.yaml'));
  const sites: Site[] = [];
  for (const file of files) {
    const entries = readYaml<Site[]>(join(sitesDir, file)) ?? [];
    sites.push(...entries);
  }
  return sites;
}

/**
 * Loads every registry file into typed objects and the derived lookup maps the site and audit
 * scheduler need. Does not validate — call `validateRegistry` first if the input isn't trusted.
 */
export function loadRegistry(registryDir: string): Registry {
  const sites = readSites(registryDir).map((site) => ({
    ...site,
    url: normalizeUrl(site.url),
    aliases: (site.aliases ?? []).map(normalizeUrl),
  }));
  const departments = readYaml<Department[]>(join(registryDir, 'departments.yaml')) ?? [];
  const districts = readYaml<District[]>(join(registryDir, 'districts.yaml')) ?? [];
  const places = readYaml<Place[]>(join(registryDir, 'places.yaml')) ?? [];
  const kinds = readYaml<string[]>(join(registryDir, 'kinds.yaml')) ?? [];
  const ministers = readYaml<Minister[]>(join(registryDir, 'ministers.yaml')) ?? [];
  const ignore = readYaml<IgnoreEntry[]>(join(registryDir, 'ignore.yaml')) ?? [];

  const byId = new Map<string, Site>();
  const byDepartment = new Map<string, Site[]>();
  const byDistrict = new Map<string, Site[]>();
  for (const site of sites) {
    byId.set(site.id, site);
    pushInto(byDepartment, site.department, site);
    if (site.district) pushInto(byDistrict, site.district, site);
  }

  const byMinistry = new Map<string, Site[]>();
  for (const minister of ministers) {
    const ministrySites = minister.departments.flatMap((dept) => byDepartment.get(dept) ?? []);
    byMinistry.set(minister.id, ministrySites);
  }

  return { sites, departments, districts, places, kinds, ministers, ignore, byId, byDepartment, byDistrict, byMinistry };
}

function pushInto<K>(map: Map<K, Site[]>, key: K, site: Site): void {
  const existing = map.get(key);
  if (existing) {
    existing.push(site);
  } else {
    map.set(key, [site]);
  }
}
