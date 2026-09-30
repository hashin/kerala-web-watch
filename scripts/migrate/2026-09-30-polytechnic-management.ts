/**
 * One-off (ADR-029, Phase B): classifies polytechnics in registry/sites/colleges.yaml.
 * Human sign-off (2026-09-30): an official name containing "Govt"/"Government" in DTE's own
 * list counts as evidence of `government` (management_source = that DTE page); other colleges are
 * classified only when the college's own website says so. Anything else stays null -- never guessed.
 * Run from the repo root: npx tsx scripts/migrate/2026-09-30-polytechnic-management.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { dump as dumpYaml, load as loadYaml } from 'js-yaml';

/** Read on each college's own homepage on 2026-09-30. */
const FROM_OWN_SITE: Record<string, 'government' | 'aided'> = {
  'gpc-manjeri': 'government', // "Welcome to GOVT. POLYTECHNIC COLLEGE Manjeri"
  'maharaja-s-technological-institute-thrissur': 'government', // "A Government Polytechnic College affiliated to State Board Of Technical Education"
  'seethi-sahib-memorial-polytechnic-college-tirur': 'aided', // "is a Government - Aided Polytechnic College established in 1962"
  'sree-narayana-polytechnic-college-kottiyam': 'aided', // "premier government aided polytechnic college in Kollam"
};

type Row = Record<string, unknown> & { id: string; name: string; kind: string; url: string; source: string; management?: string | null };

const path = join(process.cwd(), 'registry', 'sites', 'colleges.yaml');
const rows = loadYaml(readFileSync(path, 'utf8')) as Row[];

let byName = 0;
let byOwnSite = 0;
for (const row of rows) {
  if (row.kind !== 'polytechnic' || row.management) continue;
  if (/\bgovt\b|\bgovernment\b/i.test(row.name)) {
    row.management = 'government';
    row.management_source = row.source;
    byName++;
  } else if (FROM_OWN_SITE[row.id]) {
    row.management = FROM_OWN_SITE[row.id];
    row.management_source = row.url;
    byOwnSite++;
  }
}

writeFileSync(path, dumpYaml(rows, { sortKeys: false, lineWidth: -1 }));
console.error(`classified ${byName} by DTE name, ${byOwnSite} from the college's own site`);
