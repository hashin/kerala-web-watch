import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { setDefaultResultOrder } from 'node:dns';
import { dump as dumpYaml, load as parseYaml } from 'js-yaml';
import { parseHTML } from 'linkedom';
import { feature as topoFeature } from 'topojson-client';
import { geoCentroid } from 'd3-geo';
import type { Topology, GeometryCollection } from 'topojson-specification';
import type { Feature, Polygon, MultiPolygon } from 'geojson';
import { normalizeUrl } from '../../audit/dist/url.js';

// Some upstream hosts' IPv6 routes hang from this machine until connect-timeout; IPv4 works
// every time (confirmed by hand during WP1.4). Without this, fetches intermittently fail with
// ECONNTIMEOUT/ENOTFOUND-looking errors that have nothing to do with the endpoint itself.
setDefaultResultOrder('ipv4first');

// WP1.4: the one ADR-018 exception. This source (district -> type -> name/code/website) is
// structured enough to write directly to registry/sites/lsg-*.yaml, skipping the
// registry/candidates/ review step every other harvest goes through.
const BASE = 'https://lsgkerala.gov.in';
const LISTING_PAGE = `${BASE}/en/website/web`;
const USER_AGENT = 'KeralaWebWatch/1.0 (+https://govwebsite.hashin.me/about; civic audit harvest, one-time and human-supervised)';
const REQUEST_GAP_MS = 300;
const FETCH_TIMEOUT_MS = 20_000; // CLAUDE.md "Polite" non-negotiable: 20s timeouts on every fetch.
const BOUNDARY_TIMEOUT_MS = 60_000; // opendatakerala.org's topojson files run several MB each.
const TODAY = new Date().toISOString().slice(0, 10);
const REGISTRY_DIR = join(process.cwd(), 'registry');

// Dropdown order on the source's own district filter, confirmed against several localbody
// codes (e.g. corporations C010100.."tvm" .. C080100 "thrissur" all matched their own district).
const DISTRICTS_BY_ORDINAL: Array<{ id: string; abbrev: string }> = [
  { id: 'thiruvananthapuram', abbrev: 'tvm' },
  { id: 'kollam', abbrev: 'klm' },
  { id: 'pathanamthitta', abbrev: 'pta' },
  { id: 'alappuzha', abbrev: 'alp' },
  { id: 'kottayam', abbrev: 'ktm' },
  { id: 'idukki', abbrev: 'idk' },
  { id: 'ernakulam', abbrev: 'ekm' },
  { id: 'thrissur', abbrev: 'tsr' },
  { id: 'palakkad', abbrev: 'pkd' },
  { id: 'malappuram', abbrev: 'mlp' },
  { id: 'kozhikode', abbrev: 'kkd' },
  { id: 'wayanad', abbrev: 'wyd' },
  { id: 'kannur', abbrev: 'knr' },
  { id: 'kasaragod', abbrev: 'ksd' },
];

type LsgType = 'corporation' | 'municipality' | 'district_panchayat' | 'block_panchayat' | 'grama_panchayat';

interface TypeInfo {
  lsgType: LsgType;
  abbrev: string;
  suffixPattern: RegExp;
  priority: 1 | 2;
  file: string;
}

// The localbody code's leading letter (confirmed by filtering the source by LBtype: corporations
// all start "C", district panchayats "D", etc).
const TYPE_INFO: Record<string, TypeInfo> = {
  C: { lsgType: 'corporation', abbrev: 'corp', suffixPattern: /\s+Corporation$/i, priority: 2, file: 'lsg-corporations.yaml' },
  M: { lsgType: 'municipality', abbrev: 'mun', suffixPattern: /\s+Municipality$/i, priority: 2, file: 'lsg-municipalities.yaml' },
  D: { lsgType: 'district_panchayat', abbrev: 'dp', suffixPattern: /\s+District Panchayat$/i, priority: 2, file: 'lsg-district-panchayats.yaml' },
  B: { lsgType: 'block_panchayat', abbrev: 'bp', suffixPattern: /\s+Block Panchayat$/i, priority: 1, file: 'lsg-block-panchayats.yaml' },
  G: { lsgType: 'grama_panchayat', abbrev: 'gp', suffixPattern: /\s+Grama Panchayat$/i, priority: 1, file: 'lsg-grama-panchayats.yaml' },
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// AbortSignal.timeout()'s internal timer can fire after a fetch already settled, throwing an
// uncaught exception outside any try/catch around the call (a known Node/undici quirk) -- a
// manually-cleared AbortController avoids that dangling timer entirely.
async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

interface RawRow {
  name: string;
  code: string;
  url: string;
}

async function fetchPage(pageIndex: number): Promise<RawRow[]> {
  const url = pageIndex === 0 ? LISTING_PAGE : `${LISTING_PAGE}?page=,,,${pageIndex}`;
  const res = await fetchWithTimeout(url, { headers: { 'User-Agent': USER_AGENT } }, FETCH_TIMEOUT_MS);
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  const { document } = parseHTML(await res.text());
  const rows = Array.from(document.querySelectorAll('tbody tr'));
  return rows
    .map((row) => {
      const cells = Array.from(row.querySelectorAll('td'));
      if (cells.length < 4) return null;
      const name = cells[1].textContent?.trim() ?? '';
      const code = cells[2].textContent?.trim() ?? '';
      const url = cells[3].querySelector('a')?.getAttribute('href')?.trim() ?? '';
      return name && code && url ? { name, code, url } : null;
    })
    .filter((row): row is RawRow => row !== null);
}

async function fetchPageWithRetry(pageIndex: number): Promise<RawRow[]> {
  try {
    return await fetchPage(pageIndex);
  } catch (err) {
    console.error(`  page ${pageIndex} failed (${(err as Error).message}), retrying once...`);
    return await fetchPage(pageIndex);
  }
}

async function fetchAllRows(): Promise<RawRow[]> {
  const rows: RawRow[] = [];
  const seenCodes = new Set<string>();
  for (let page = 0; ; page++) {
    const pageRows = await fetchPageWithRetry(page);
    // Past the last real page, the site doesn't return empty -- it clamps and re-serves the
    // final page forever (confirmed by hand: pages 60, 65, 100 are byte-identical to page 59).
    // A page whose codes are all already seen is that clamp, not new data.
    if (pageRows.length === 0 || pageRows.every((row) => seenCodes.has(row.code))) break;
    for (const row of pageRows) seenCodes.add(row.code);
    rows.push(...pageRows);
    console.error(`  page ${page}: ${pageRows.length} rows (${rows.length} total)`);
    await sleep(REQUEST_GAP_MS);
  }
  return rows;
}

interface DecodedCode {
  type: TypeInfo;
  districtOrdinal: number;
}

function decodeCode(code: string): DecodedCode | null {
  const match = code.match(/^([A-Z])(\d{2})\d{4}$/);
  if (!match) return null;
  const type = TYPE_INFO[match[1]];
  const districtOrdinal = Number(match[2]);
  if (!type || districtOrdinal < 1 || districtOrdinal > 14) return null;
  return { type, districtOrdinal };
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

interface Coordinate {
  lat: number;
  lon: number;
}

interface TopoFeatureProperties {
  LSG_code?: string;
  Lsgd_Type?: string;
}

// ADR-023: opendatakerala.org's LSG2025 election portal publishes boundary polygons keyed by the
// same `LSG_code` lsgkerala.gov.in uses for its own Localbody Code, so matching is exact -- no
// name/slug guessing, unlike the Wikidata lookup this replaced. Each file also carries every
// Municipality/Corporation as a basemap overlay (for the map UI), so callers must filter by
// Lsgd_Type to avoid double-counting; a plain object union across the three files still gives a
// coordinate for all five LSGI types, including block/district panchayats, where Wikidata had
// essentially no data.
const BOUNDARY_FILES: Array<{ url: string; keepTypes: string[] }> = [
  { url: 'https://opendatakerala.org/LSG2025/data/topojson/Kerala/grama-panchayats.json', keepTypes: ['Grama Panchayat'] },
  { url: 'https://opendatakerala.org/LSG2025/data/topojson/Kerala/block-panchayats.json', keepTypes: ['Block Panchayat'] },
  { url: 'https://opendatakerala.org/LSG2025/data/topojson/Kerala/districts.json', keepTypes: ['District Panchayat', 'Municipality', 'Corporation'] },
];

type LsgFeature = Feature<Polygon | MultiPolygon, TopoFeatureProperties>;

async function fetchBoundaryCoordinates(): Promise<Map<string, Coordinate>> {
  const coordsByCode = new Map<string, Coordinate>();
  for (const { url, keepTypes } of BOUNDARY_FILES) {
    let topology: Topology<{ [name: string]: GeometryCollection<TopoFeatureProperties> }>;
    try {
      const res = await fetchWithTimeout(url, { headers: { 'User-Agent': USER_AGENT } }, BOUNDARY_TIMEOUT_MS);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      topology = await res.json();
    } catch (err) {
      console.error(`  boundary fetch failed for ${url}: ${(err as Error).message} -- affected places will have no coordinates`);
      continue;
    }
    const objectName = Object.keys(topology.objects)[0];
    const collection = topoFeature(topology, topology.objects[objectName]) as unknown as { features: LsgFeature[] };
    let kept = 0;
    for (const f of collection.features) {
      const code = f.properties?.LSG_code;
      if (!code || !keepTypes.includes(f.properties?.Lsgd_Type ?? '')) continue;
      const [lon, lat] = geoCentroid(f);
      coordsByCode.set(code, { lat, lon });
      kept++;
    }
    console.error(`  ${url.split('/').pop()}: ${kept} centroids (${keepTypes.join('/')})`);
    await sleep(REQUEST_GAP_MS);
  }
  return coordsByCode;
}

interface SiteEntry {
  id: string;
  name: string;
  url: string;
  tier: 'lsg';
  kind: LsgType;
  department: 'lsgd';
  org_parent: null;
  scope: 'local';
  district: string;
  place: string;
  lsg_type: LsgType;
  platform: 'lsgkerala' | null;
  priority: 1 | 2;
  tags: [];
  source: string;
  added: string;
  lifecycle: 'active';
  notes: string;
}

interface PlaceEntry {
  id: string;
  name: string;
  district: string;
  lat: number | null;
  lon: number | null;
}

async function run(): Promise<void> {
  console.error('Fetching lsgkerala.gov.in localbody listing (60 pages)...');
  const rows = await fetchAllRows();
  console.error(`Fetched ${rows.length} rows`);

  console.error('Fetching LSGI boundary polygons from opendatakerala.org for coordinates...');
  const coordsByCode = await fetchBoundaryCoordinates();
  console.error(`  ${coordsByCode.size} localbody codes have a boundary-derived coordinate`);

  const sitesByFile = new Map<string, SiteEntry[]>();
  const places: PlaceEntry[] = [];
  const usedSiteIds = new Set<string>();
  const usedPlaceIds = new Set<string>();
  let malformedCode = 0;
  let malformedUrl = 0;

  for (const row of rows) {
    const decoded = decodeCode(row.code);
    if (!decoded) {
      malformedCode++;
      console.error(`  skipped (unrecognised code "${row.code}"): ${row.name}`);
      continue;
    }
    const { type, districtOrdinal } = decoded;
    const district = DISTRICTS_BY_ORDINAL[districtOrdinal - 1];
    const baseName = row.name.replace(type.suffixPattern, '').trim();
    const slug = slugify(baseName);

    // e.g. Thiruvananthapuram Corporation's own listing has "...lsgkerala.gov.in  /" -- a stray
    // double space before the trailing slash, same class of source typo cleaned up in WP1.2.
    const cleanedUrl = row.url.replace(/\s+/g, '');
    let url: string;
    try {
      url = normalizeUrl(cleanedUrl.startsWith('http') ? cleanedUrl : `http://${cleanedUrl}`);
    } catch {
      malformedUrl++;
      console.error(`  skipped (bad url "${row.url}"): ${row.name}`);
      continue;
    }

    let siteId = `lsg-${type.abbrev}-${slug}`;
    if (usedSiteIds.has(siteId)) siteId = `lsg-${type.abbrev}-${slug}-${district.abbrev}`;
    if (usedSiteIds.has(siteId)) siteId = `${siteId}-${usedSiteIds.size}`;
    usedSiteIds.add(siteId);

    let placeId = `${type.abbrev}-${slug}`;
    if (usedPlaceIds.has(placeId)) placeId = `${type.abbrev}-${slug}-${district.abbrev}`;
    if (usedPlaceIds.has(placeId)) placeId = `${placeId}-${usedPlaceIds.size}`;
    usedPlaceIds.add(placeId);

    const host = new URL(url).hostname;
    const platform = host.endsWith('.lsgkerala.gov.in') ? 'lsgkerala' : null;
    const coord = coordsByCode.get(row.code);

    const site: SiteEntry = {
      id: siteId,
      name: row.name,
      url,
      tier: 'lsg',
      kind: type.lsgType,
      department: 'lsgd',
      org_parent: null,
      scope: 'local',
      district: district.id,
      place: placeId,
      lsg_type: type.lsgType,
      platform,
      priority: type.priority,
      tags: [],
      source: LISTING_PAGE,
      added: TODAY,
      lifecycle: 'active',
      notes: '',
    };
    const list = sitesByFile.get(type.file) ?? [];
    list.push(site);
    sitesByFile.set(type.file, list);

    places.push({
      id: placeId,
      name: baseName,
      district: district.id,
      lat: coord?.lat ?? null,
      lon: coord?.lon ?? null,
    });
  }

  // ADR-022: lsgkerala.gov.in names panchayat subdomains after the panchayat, not its code, so
  // two same-named panchayats in different districts can be listed with the identical URL. Both
  // organisations are real; mark the collision on both sides instead of silently picking one.
  const allSites = [...sitesByFile.values()].flat();
  const byUrl = new Map<string, SiteEntry[]>();
  for (const site of allSites) byUrl.set(site.url, [...(byUrl.get(site.url) ?? []), site]);
  for (const group of byUrl.values()) {
    if (group.length < 2) continue;
    for (const site of group) {
      const others = group.filter((s) => s.id !== site.id).map((s) => s.id);
      site.notes = [site.notes, `shares-url-with:${others.join(',')} (ADR-022, source lists the same URL for both)`].filter(Boolean).join(' ');
      console.error(`  shared URL: ${site.id} <-> ${others.join(', ')} (${site.url})`);
    }
  }

  for (const [file, list] of sitesByFile) {
    const path = join(REGISTRY_DIR, 'sites', file);
    writeFileSync(path, dumpYaml(list, { sortKeys: false, lineWidth: -1 }));
    console.error(`Wrote ${list.length} entries to ${path}`);
  }

  const placesPath = join(REGISTRY_DIR, 'places.yaml');
  const existingPlaces = (parseYaml(readFileSync(placesPath, 'utf8')) as PlaceEntry[]) ?? [];
  const allPlaces = [...existingPlaces, ...places];
  writeFileSync(
    placesPath,
    '# The 14 district HQs plus every place named in DESIGN.md Appendix A, plus one place per LSGI (WP1.4).\n' +
      '# LSGI lat/lon are polygon centroids from opendatakerala.org boundary data, matched by localbody\n' +
      '# code (ADR-023); null where a code has no boundary match (see ADR-021 for the schema-level allowance).\n' +
      dumpYaml(allPlaces, { sortKeys: false, lineWidth: -1 }),
  );
  console.error(`places.yaml: ${existingPlaces.length} + ${places.length} = ${allPlaces.length}`);

  console.error(`Malformed codes skipped: ${malformedCode}; malformed urls skipped: ${malformedUrl}`);
  const withCoords = places.filter((p) => p.lat !== null).length;
  console.error(`Places with coordinates: ${withCoords} of ${places.length}`);
}

run();
