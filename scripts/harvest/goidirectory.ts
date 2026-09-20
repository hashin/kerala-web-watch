import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { load as parseYaml } from 'js-yaml';
import { parseHTML } from 'linkedom';
import { emit, writeCandidates, type Candidate } from './lib.js';

// goidirectory.gov.in (DESIGN.md §3.2's name for this source) no longer resolves; it's been
// rebranded "Integrated Government Online Directory" at igod.gov.in -- same NIC service (same
// stated purpose: "a single point source to know all about Indian Government Websites"), found
// by search during WP1.3. Recorded here, not silently: docs/STATE.md's WP1.3 handoff.
const BASE = 'https://igod.gov.in';
const STATE_ID = 'KL';
const PAGE_SIZE = 5; // fixed by the site's own frontend; other sizes fall back to the homepage
const USER_AGENT = 'KeralaWebWatch/1.0 (+https://govwebsite.hashin.me/about; civic audit harvest, one-time and human-supervised)';
const REQUEST_GAP_MS = 300;
const SOURCE_PAGE = `${BASE}/advanced_search?state_id=${STATE_ID}`;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchBatch(offset: number): Promise<string> {
  const url = `${BASE}/advanced_search_more/${offset}/${PAGE_SIZE}?keyword_web=&url=&cat_id_search=&sector_id=&org_type_id_search=&state_id=${STATE_ID}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, 'X-Requested-With': 'XMLHttpRequest' },
  });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.text();
}

interface ResultEntry {
  name: string;
  url: string | null;
}

function parseBatch(html: string): ResultEntry[] {
  const { document } = parseHTML(`<div id="root">${html}</div>`);
  const rows = Array.from(document.querySelectorAll('.search-result-row'));
  return rows.map((row) => {
    const link = row.querySelector('a.search-title');
    const name = (link ?? row.querySelector('.search-title'))?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    return { name, url: link?.getAttribute('href')?.trim() ?? null };
  }).filter((entry) => entry.name);
}

/** Best-effort department match: igod's names are English, so unlike kerala-gov-in's Malayalam
 * names, a normalised comparison against our own departments.yaml `name` is reliable enough to
 * automate (curation still reviews every candidate before it becomes a registry entry). */
function buildDepartmentMatcher(registryDir: string): (orgName: string) => string | undefined {
  const departments = parseYaml(readFileSync(join(registryDir, 'departments.yaml'), 'utf8')) as Array<{
    id: string;
    name: string;
  }>;
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/\bdepartment\b|\bkerala\b|&|\band\b/g, ' ')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  const byNormalizedName = new Map(departments.map((d) => [normalize(d.name), d.id]));
  return (orgName: string) => byNormalizedName.get(normalize(orgName));
}

async function main(): Promise<void> {
  const matchDepartment = buildDepartmentMatcher(join(process.cwd(), 'registry'));
  const candidates: Candidate[] = [];
  let skippedNoUrl = 0;
  let offset = 0;

  for (;;) {
    const entries = parseBatch(await fetchBatch(offset));
    if (entries.length === 0) break;

    for (const entry of entries) {
      if (!entry.url) {
        skippedNoUrl += 1;
        continue;
      }
      try {
        const department = matchDepartment(entry.name);
        candidates.push(
          emit({
            url: entry.url,
            name: entry.name,
            source: 'goidirectory',
            source_page: SOURCE_PAGE,
            hints: department ? { department } : {},
          }),
        );
      } catch (error) {
        console.error(`  skipped "${entry.name}" <${entry.url}>: ${String(error)}`);
      }
    }

    offset += PAGE_SIZE;
    await sleep(REQUEST_GAP_MS);
  }

  console.error(`Fetched ${offset / PAGE_SIZE} batches, ${candidates.length} candidates, ${skippedNoUrl} listed with no url`);
  const path = writeCandidates('goidirectory', candidates);
  console.log(`Wrote ${candidates.length} candidates to ${path}`);
}

main();
