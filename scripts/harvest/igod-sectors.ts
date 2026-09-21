import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { load as parseYaml } from 'js-yaml';
import { parseHTML } from 'linkedom';
import { emit, writeCandidates, type Candidate } from './lib.js';

// igod.gov.in also exposes fixed per-sector organisation listings (found by the human,
// 2026-09-21) distinct from the state-wide advanced_search already harvested as
// registry/candidates/goidirectory.yaml (WP1.3). Kept as a separate source so merge-candidates
// can report the actual overlap rather than assuming it.
const BASE = 'https://igod.gov.in';
const USER_AGENT = 'KeralaWebWatch/1.0 (+https://govwebsite.hashin.me/about; civic audit harvest, one-time and human-supervised)';
const REQUEST_GAP_MS = 300;

const SECTORS: Array<{ code: string; label: string }> = [
  { code: 'E003', label: 'Departments' },
  { code: 'E004', label: 'Directorates / Commissionerates' },
  { code: 'E005', label: 'Attached / Subordinated Offices' },
];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchText(url: string, xhr: boolean): Promise<string> {
  const res = await fetch(url, {
    headers: xhr ? { 'User-Agent': USER_AGENT, 'X-Requested-With': 'XMLHttpRequest' } : { 'User-Agent': USER_AGENT },
  });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.text();
}

interface ResultEntry {
  name: string;
  url: string | null;
}

function parseRows(html: string): ResultEntry[] {
  const { document } = parseHTML(`<div id="root">${html}</div>`);
  const rows = Array.from(document.querySelectorAll('.search-result-row'));
  return rows
    .map((row) => {
      const link = row.querySelector('a.search-title');
      const name = link?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
      return { name, url: link?.getAttribute('href')?.trim() ?? null };
    })
    .filter((entry) => entry.name);
}

/** Reads the fixed pagination constants igod embeds as inline <script> globals on the first
 * page (count/total_pages/per_page/items_on_first_page) -- there is no JSON API, so this is the
 * only way to know how many "_more" batches to request. */
function readPaginationInfo(html: string): { count: number; itemsOnFirstPage: number; perPage: number } {
  const num = (name: string) => {
    const match = html.match(new RegExp(`var ${name}\\s*=\\s*'(\\d+)'`));
    return match ? Number(match[1]) : 0;
  };
  return { count: num('count'), itemsOnFirstPage: num('items_on_first_page'), perPage: num('per_page') };
}

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

async function harvestSector(sector: { code: string; label: string }): Promise<ResultEntry[]> {
  const sourcePage = `${BASE}/sg/KL/${sector.code}/organizations`;
  const firstPageHtml = await fetchText(sourcePage, false);
  const entries = parseRows(firstPageHtml);
  const { count, itemsOnFirstPage, perPage } = readPaginationInfo(firstPageHtml);

  let start = itemsOnFirstPage;
  await sleep(REQUEST_GAP_MS);
  while (start < count) {
    const limit = Math.min(perPage, count - start);
    const moreUrl = `${BASE}/sg/KL/${sector.code}/organizations_more/${start}/${limit}`;
    entries.push(...parseRows(await fetchText(moreUrl, true)));
    start += limit;
    await sleep(REQUEST_GAP_MS);
  }
  return entries;
}

async function main(): Promise<void> {
  const matchDepartment = buildDepartmentMatcher(join(process.cwd(), 'registry'));
  const candidates: Candidate[] = [];
  let skippedNoUrl = 0;

  for (const sector of SECTORS) {
    const sourcePage = `${BASE}/sg/KL/${sector.code}/organizations`;
    const entries = await harvestSector(sector);
    console.error(`${sector.code} (${sector.label}): ${entries.length} rows fetched`);

    for (const entry of entries) {
      if (!entry.url) {
        skippedNoUrl += 1;
        continue;
      }
      const department = matchDepartment(entry.name);
      candidates.push(
        emit({
          url: entry.url,
          name: entry.name,
          source: 'igod-sectors',
          source_page: sourcePage,
          hints: department ? { department } : {},
        }),
      );
    }
  }

  console.error(`Total: ${candidates.length} candidates, ${skippedNoUrl} listed with no url`);
  const path = writeCandidates('igod-sectors', candidates);
  console.log(`Wrote ${candidates.length} candidates to ${path}`);
}

main();
