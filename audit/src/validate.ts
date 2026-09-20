import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Ajv2020, type ValidateFunction } from 'ajv/dist/2020.js';
import ajvFormatsPkg from 'ajv-formats';
import { load as parseYaml } from 'js-yaml';
import { normalizeUrl } from './url.js';
import type { Department, District, IgnoreEntry, Minister, Place, Site } from './types.js';

export interface ValidationFailure {
  file: string;
  id?: string;
  rule: string;
  message: string;
}

// registry/schema.json is versioned with the audit code, not with any one registry instance
// (fixtures under audit/tests/fixtures/registry/ reuse it), so it's resolved relative to this
// module rather than to the --registry directory being validated.
const SCHEMA_PATH = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..', 'registry', 'schema.json');

// Both ajv and ajv-formats compile their CJS output so `module.exports` is the class/function
// itself (for old-style `require("ajv")` callers), which real Node ESM interop honours correctly
// at runtime but whose .d.ts (written in `export default` form) TS cannot type accurately under
// NodeNext resolution — hence the cast here.
const addFormats = ajvFormatsPkg as unknown as (ajv: Ajv2020) => void;

function buildValidators() {
  const schemaDoc = JSON.parse(readFileSync(SCHEMA_PATH, 'utf8'));
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  ajv.addSchema(schemaDoc);
  const get = (name: string): ValidateFunction => {
    const validator = ajv.getSchema(`${schemaDoc.$id}#/$defs/${name}`);
    if (!validator) throw new Error(`schema.json has no $defs/${name}`);
    return validator;
  };
  return {
    site: get('Site'),
    department: get('Department'),
    district: get('District'),
    place: get('Place'),
    minister: get('Minister'),
    ignoreEntry: get('IgnoreEntry'),
  };
}

function readYaml<T>(path: string): T {
  return parseYaml(readFileSync(path, 'utf8')) as T;
}

function schemaFailures(
  file: string,
  entries: unknown[],
  validate: ValidateFunction,
  idOf: (entry: any) => string | undefined,
): ValidationFailure[] {
  const failures: ValidationFailure[] = [];
  entries.forEach((entry, index) => {
    if (!validate(entry)) {
      for (const error of validate.errors ?? []) {
        failures.push({
          file,
          id: idOf(entry) ?? `#${index}`,
          rule: 'schema',
          message: `${error.instancePath || '(root)'} ${error.message ?? 'is invalid'}`,
        });
      }
    }
  });
  return failures;
}

/**
 * Validates a registry directory against registry/schema.json and the cross-reference rules
 * from WP0.2 (DESIGN §3.3): unique ids/urls, resolvable department/district/place/org_parent/
 * merged-into references, place.district agreement, and lsg_type iff tier is "lsg". Offline only
 * — it does not fetch any of the URLs it validates (`--resolve` is WP2.5).
 */
export function validateRegistry(registryDir: string): ValidationFailure[] {
  const validators = buildValidators();
  const failures: ValidationFailure[] = [];

  const sitesDir = join(registryDir, 'sites');
  const siteFiles = readdirSync(sitesDir).filter((f) => f.endsWith('.yaml'));
  const rawSites: Array<{ file: string; site: Site }> = [];
  for (const file of siteFiles) {
    const entries = readYaml<Site[]>(join(sitesDir, file)) ?? [];
    failures.push(...schemaFailures(`sites/${file}`, entries, validators.site, (e) => e?.id));
    for (const site of entries) rawSites.push({ file: `sites/${file}`, site });
  }

  const departments = readYaml<Department[]>(join(registryDir, 'departments.yaml')) ?? [];
  failures.push(...schemaFailures('departments.yaml', departments, validators.department, (e) => e?.id));

  const districts = readYaml<District[]>(join(registryDir, 'districts.yaml')) ?? [];
  failures.push(...schemaFailures('districts.yaml', districts, validators.district, (e) => e?.id));

  const places = readYaml<Place[]>(join(registryDir, 'places.yaml')) ?? [];
  failures.push(...schemaFailures('places.yaml', places, validators.place, (e) => e?.id));

  const ministers = readYaml<Minister[]>(join(registryDir, 'ministers.yaml')) ?? [];
  failures.push(...schemaFailures('ministers.yaml', ministers, validators.minister, (e) => e?.id));

  const ignore = readYaml<IgnoreEntry[]>(join(registryDir, 'ignore.yaml')) ?? [];
  failures.push(...schemaFailures('ignore.yaml', ignore, validators.ignoreEntry, (e) => e?.pattern));

  const kinds = new Set(readYaml<string[]>(join(registryDir, 'kinds.yaml')) ?? []);

  failures.push(...crossReferenceFailures(rawSites, {
    departmentIds: new Set(departments.map((d) => d.id)),
    districtById: new Map(districts.map((d) => [d.id, d])),
    placeById: new Map(places.map((p) => [p.id, p])),
    kinds,
  }));

  return failures;
}

interface ReferenceSets {
  departmentIds: Set<string>;
  districtById: Map<string, District>;
  placeById: Map<string, Place>;
  kinds: Set<string>;
}

function crossReferenceFailures(
  rawSites: Array<{ file: string; site: Site }>,
  refs: ReferenceSets,
): ValidationFailure[] {
  const failures: ValidationFailure[] = [];
  const siteIds = new Set(rawSites.map((r) => r.site.id));
  const seenIds = new Map<string, string>();
  const seenUrls = new Map<string, { file: string; site: Site }>();

  // ADR-022: two distinct, real organisations can end up sharing one URL at the source (e.g.
  // two same-named panchayats colliding on lsgkerala.gov.in's name-based subdomains). That is a
  // documented fact, not a duplicate-registration bug, when both entries' `notes` mark it.
  const sharesUrlWith = (site: Site, otherId: string) => {
    const match = site.notes.match(/shares-url-with:(\S+)/);
    return match ? match[1].split(',').includes(otherId) : false;
  };

  for (const { file, site } of rawSites) {
    const fail = (rule: string, message: string) => failures.push({ file, id: site.id, rule, message });

    const priorFile = seenIds.get(site.id);
    if (priorFile) fail('unique-id', `id "${site.id}" also used in ${priorFile}`);
    else seenIds.set(site.id, file);

    for (const url of [site.url, ...(site.aliases ?? [])]) {
      let normalized: string;
      try {
        normalized = normalizeUrl(url);
      } catch {
        continue; // malformed URLs are already reported by the schema check
      }
      const prior = seenUrls.get(normalized);
      if (prior && prior.site.id !== site.id) {
        const documented = sharesUrlWith(site, prior.site.id) && sharesUrlWith(prior.site, site.id);
        if (!documented) fail('unique-url', `url "${normalized}" also used by ${prior.file}:${prior.site.id}`);
      } else {
        seenUrls.set(normalized, { file, site });
      }
    }

    if (!refs.departmentIds.has(site.department)) {
      fail('department-ref', `department "${site.department}" is not in departments.yaml`);
    }

    if (site.district && !refs.districtById.has(site.district)) {
      fail('district-ref', `district "${site.district}" is not in districts.yaml`);
    }

    if (site.place) {
      const place = refs.placeById.get(site.place);
      if (!place) {
        fail('place-ref', `place "${site.place}" is not in places.yaml`);
      } else if (site.district && place.district !== site.district) {
        fail('place-district', `place "${site.place}" belongs to district "${place.district}", not "${site.district}"`);
      }
    }

    if (site.org_parent && !siteIds.has(site.org_parent)) {
      fail('org-parent-ref', `org_parent "${site.org_parent}" is not a known site id`);
    }

    const mergedInto = /^merged-into:(.+)$/.exec(site.lifecycle);
    if (mergedInto && !siteIds.has(mergedInto[1])) {
      fail('merged-into-ref', `lifecycle merged-into:${mergedInto[1]} is not a known site id`);
    }

    if (site.tier === 'lsg' && !site.lsg_type) {
      fail('lsg-type', 'tier "lsg" requires lsg_type to be set');
    }
    if (site.tier !== 'lsg' && site.lsg_type) {
      fail('lsg-type', `lsg_type is set but tier is "${site.tier}", not "lsg"`);
    }

    if (!refs.kinds.has(site.kind)) {
      fail('kind-ref', `kind "${site.kind}" is not in kinds.yaml`);
    }
  }

  return failures;
}

export function toMarkdownTable(failures: ValidationFailure[]): string {
  if (failures.length === 0) return 'Registry is valid: no failures.';
  const header = '| File | Id | Rule | Message |\n|---|---|---|---|';
  const rows = failures.map((f) => `| ${f.file} | ${f.id ?? ''} | ${f.rule} | ${f.message} |`);
  return [header, ...rows].join('\n');
}
