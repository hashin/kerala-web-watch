/**
 * One-off (ADR-029): adds `management` / `management_source` to every record in
 * registry/sites/colleges.yaml and clears the old "Open question 16" caveat note.
 * The 12 engineering colleges are classified from the KEAM 2026 prospectus, the Commissioner for
 * Entrance Examinations' own listing; every other record starts unclassified (null).
 * Idempotent. Run from the repo root: npx tsx scripts/migrate/2026-09-30-college-management.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { dump as dumpYaml, load as loadYaml } from 'js-yaml';

const KEAM_SOURCE = 'https://cee.kerala.gov.in/keam2026/pdf/Prospectus.pdf#page=105';
const OLD_CAVEAT =
  "DTE's own directory does not distinguish government from government-aided institutions (Open question 16) -- may not be purely government.";

const ENGINEERING: Record<string, 'government' | 'aided'> = {
  'college-of-engineering-trivandrum': 'government',
  'government-engineering-college-idukki': 'government',
  'government-engineering-college-kozhikode': 'government',
  'government-engineering-college-thrissur': 'government',
  'govt-college-of-engineering-kannur': 'government',
  'govt-engineering-college-barton-hill': 'government',
  'govt-engineering-college-palakkad': 'government',
  'govt-engineering-college-wayanad': 'government',
  'rajiv-gandhi-institute-of-technology-kottayam': 'government',
  'mar-athanasius-college-of-engineering-kothamanga': 'aided',
  'nss-college-of-engineering-palakkad': 'aided',
  'tkm-college-of-engineering': 'aided',
};

type Row = Record<string, unknown> & { id: string; notes: string };

const path = join(process.cwd(), 'registry', 'sites', 'colleges.yaml');
const rows = loadYaml(readFileSync(path, 'utf8')) as Row[];

const missing = Object.keys(ENGINEERING).filter((id) => !rows.some((r) => r.id === id));
if (missing.length > 0) {
  console.error(`refusing to run: engineering ids not in colleges.yaml: ${missing.join(', ')}`);
  process.exit(1);
}

const migrated = rows.map((row) => {
  const management = ENGINEERING[row.id] ?? (row.management as string | null | undefined) ?? null;
  const management_source = ENGINEERING[row.id] ? KEAM_SOURCE : ((row.management_source as string | null | undefined) ?? null);
  const notes = row.notes === OLD_CAVEAT ? '' : row.notes;
  if (notes !== '' && row.notes !== OLD_CAVEAT) console.error(`kept note on ${row.id}: ${notes}`);
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (key === 'management' || key === 'management_source') continue;
    out[key] = key === 'notes' ? notes : value;
    if (key === 'platform') {
      out.management = management;
      out.management_source = management_source;
    }
  }
  return out;
});

writeFileSync(path, dumpYaml(migrated, { sortKeys: false, lineWidth: -1 }));
console.error(`migrated ${migrated.length} records`);
