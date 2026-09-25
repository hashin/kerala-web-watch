import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { lookup as dnsLookup } from 'node:dns/promises';
import { dump as dumpYaml } from 'js-yaml';
import { parseHTML } from 'linkedom';
import { emit, writeCandidates, type Candidate } from './lib.js';

// WP5.4: government colleges tier. Three Directorate-of-Higher-Education sources were checked by
// hand 2026-09-25:
//   - Directorate of Technical Education (dtekerala.gov.in): engineering colleges + polytechnics,
//     each with a real, distinct .ac.in (or similar) website in a clean HTML table, but no district
//     column -- district is inferred from the town/district named in the college's own title.
//   - Directorate of Collegiate Education (collegiateedu.kerala.gov.in): arts & science colleges,
//     with an explicit District column; most rows' name-link is "/" (the directorate's own
//     homepage, not a real per-college site) -- only rows with a real, distinct subpage are kept.
//   - Directorate of Medical Education (dme.kerala.gov.in): its Educational Institutions, dental
//     college and nursing college pages list only phone/email for principals, no per-college
//     website for any of the 13 medical/6 dental/14 nursing colleges it names. Nothing to harvest
//     from this source -- medical/dental/nursing colleges are not in this pass (see STATE.md).
//
// ADR-027 (accepted 2026-09-25, extending ADR-018's LSGI-only exception to colleges): this writes
// directly to `registry/sites/colleges.yaml`, like WP1.4's lsgkerala.ts, rather than through
// `lib.ts`'s candidates-only `writeCandidates`. It *also* keeps writing the full raw harvest to
// `registry/candidates/colleges.yaml` -- unlike LSGI's harvest, this source is messy enough (dead
// links, an unresolved government-vs-aided split, see Open question 16) that the full, unfiltered
// find is worth keeping visible alongside the curated subset that actually gets promoted.
//
// Only URLs that resolve are promoted to `sites/`: a dead link can't pass `validate --resolve`
// (CLAUDE.md's "never invent URLs" cousin -- also never register a link nobody could reach). This
// script live-checks every candidate itself rather than trusting a one-time snapshot, since a
// stale hardcoded "known dead" list would drift the moment a college's site comes back up.
//
// collegiateedu.kerala.gov.in's TLS certificate is expired (confirmed via `curl -k` and a browser
// fetch, 2026-09-25) -- exactly what this project's own sec.https/cert checks exist to flag once a
// site is registered. A harvest reading its own public HTML, and resolve-checking its subpages,
// tolerates that; `curl -k` is used only for this one host, only in this one-off script, never in
// the audit path itself.

const USER_AGENT =
  'KeralaWebWatch/1.0 (+https://govwebsite.hashin.me/about; civic audit harvest, one-time and human-supervised)';
const FETCH_TIMEOUT_MS = 20_000;
const REQUEST_GAP_MS = 300;
const REGISTRY_DIR = join(process.cwd(), 'registry');

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchText(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

function fetchTextInsecure(url: string): string {
  return execFileSync('curl', ['-sk', '--max-time', '20', '-A', USER_AGENT, url], { encoding: 'utf8' });
}

// DTE's own table has two distinct copy-paste typos on its Website column, confirmed by hand
// 2026-09-25: some rows write "http//host" (missing colon) and others write "http://http://host"
// (the whole scheme pasted twice). Both are unambiguous, mechanical repairs of a scheme that's
// already there twice or missing one character -- not a guess at a *different* URL. Anything that
// still doesn't parse as an absolute URL afterwards is dropped by the caller, never guessed at
// (e.g. "http://www,carmelpoly.in", a comma-for-dot typo -- fixing that would mean inventing which
// domain the source actually meant).
function fixScheme(url: string): string {
  let fixed = url;
  for (let i = 0; i < 3; i++) {
    const doubled = fixed.match(/^(https?):\/\/(https?):\/\/(.*)$/);
    if (doubled) {
      fixed = `${doubled[2]}://${doubled[3]}`;
      continue;
    }
    const missingColon = fixed.match(/^(https?)\/\/(.*)$/);
    if (missingColon) {
      fixed = `${missingColon[1]}://${missingColon[2]}`;
      continue;
    }
    break;
  }
  return fixed;
}

// A handful of DTE rows put an email address straight into the Website column with an "http://"
// prefix (confirmed by hand 2026-09-25: "http://gptcatl@gmail.com", "http://info@gptcpalakkad.ac.in").
// `new URL()` happily parses these as a URL with userinfo before the host -- syntactically valid,
// but a public government college site is never legitimately linked with embedded credentials, so a
// non-empty username is a reliable, mechanical sign this href is a mis-entered email, not a website.
// Dropping it isn't guessing a replacement URL; it's declining to claim a mail address is a website.
function isAbsoluteHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && parsed.username === '';
  } catch {
    return false;
  }
}

// registry/districts.yaml ids plus the historic English names Kerala institutions still use in
// their own titles (a college founded decades ago keeps its founding-era name). Used only to
// *infer* a likely district from a college's own title when the source table gives no district
// column (DTE) -- never to override a district the source states explicitly (Collegiate Education).
const DISTRICT_ALIASES: Record<string, string> = {
  thiruvananthapuram: 'thiruvananthapuram',
  trivandrum: 'thiruvananthapuram',
  kollam: 'kollam',
  quilon: 'kollam',
  pathanamthitta: 'pathanamthitta',
  alappuzha: 'alappuzha',
  alleppey: 'alappuzha',
  kottayam: 'kottayam',
  idukki: 'idukki',
  ernakulam: 'ernakulam',
  kochi: 'ernakulam',
  cochin: 'ernakulam',
  thrissur: 'thrissur',
  trichur: 'thrissur',
  palakkad: 'palakkad',
  palghat: 'palakkad',
  malappuram: 'malappuram',
  kozhikode: 'kozhikode',
  calicut: 'kozhikode',
  wayanad: 'wayanad',
  kannur: 'kannur',
  cannanore: 'kannur',
  kasaragod: 'kasaragod',
  kasargod: 'kasaragod',
};

function inferDistrict(name: string): string | null {
  const lower = name.toLowerCase();
  for (const [alias, id] of Object.entries(DISTRICT_ALIASES)) {
    if (new RegExp(`\\b${alias}\\b`).test(lower)) return id;
  }
  return null;
}

interface RawRow {
  name: string;
  url: string;
  district: string | null;
}

// DTE's institutiondetail pages (engineering, polytechnic): a plain
// <table class="table table-bordered"><tbody><tr><td>#</td><td>Name</td><td>Year</td><td><a>Website</a></td>
// No district column, so it's inferred from the college's own title.
export function parseDteTable(html: string): RawRow[] {
  const { document } = parseHTML(html);
  const rows: RawRow[] = [];
  for (const tr of Array.from(document.querySelectorAll('table.table-bordered tbody tr'))) {
    const cells = Array.from(tr.querySelectorAll('td'));
    if (cells.length < 4) continue;
    const name = cells[1].textContent?.trim().replace(/\s+/g, ' ');
    const href = cells[3].querySelector('a')?.getAttribute('href')?.trim();
    if (!name || !href) continue;
    const url = fixScheme(href);
    if (!isAbsoluteHttpUrl(url)) continue;
    rows.push({ name, url, district: inferDistrict(name) });
  }
  return rows;
}

// Collegiate Education's Arts & Science Colleges page: a loosely-closed <table class="table ...">
// (its own <tr> tags are never actually closed), columns Sl No / College Name (with the site link) /
// Email / Phone / District / College Type. Most rows' name-link is a bare "/" pointing back at the
// directorate's own homepage -- not a real per-college site, so skipped -- and a minority link to a
// real subpage the directorate hosts for that college.
export function parseCollegiateTable(html: string): RawRow[] {
  const { document } = parseHTML(html);
  const rows: RawRow[] = [];
  for (const tr of Array.from(document.querySelectorAll('table.table tr'))) {
    const cells = Array.from(tr.querySelectorAll('td'));
    if (cells.length < 5) continue;
    const link = cells[1].querySelector('a');
    const href = link?.getAttribute('href')?.trim();
    const name = link?.textContent?.trim().replace(/\s+/g, ' ');
    if (!name || !href || href === '/' || href === '') continue;
    const resolved = href.startsWith('http') ? href : new URL(href, 'https://collegiateedu.kerala.gov.in').toString();
    const districtName = cells[4].textContent?.trim().toLowerCase();
    rows.push({ name, url: resolved, district: districtName ? (DISTRICT_ALIASES[districtName] ?? null) : null });
  }
  return rows;
}

interface Source {
  id: string;
  url: string;
  department: string; // registry/departments.yaml id
  kind: string;
  insecure?: boolean;
  parse: (html: string) => RawRow[];
}

const SOURCES: Source[] = [
  {
    id: 'dte-engineering',
    url: 'https://dtekerala.gov.in/institutiondetail/1/',
    department: 'hedu',
    kind: 'engineering_college',
    parse: parseDteTable,
  },
  {
    id: 'dte-polytechnic',
    url: 'https://dtekerala.gov.in/institutiondetail/2/',
    department: 'hedu',
    kind: 'polytechnic',
    parse: parseDteTable,
  },
  {
    id: 'collegiate-arts-science',
    url: 'https://collegiateedu.kerala.gov.in/?page_id=223',
    department: 'hedu',
    kind: 'arts_science_college',
    insecure: true,
    parse: parseCollegiateTable,
  },
];

interface Harvested {
  row: RawRow;
  source: Source;
}

async function harvest(): Promise<Harvested[]> {
  const all: Harvested[] = [];
  for (const source of SOURCES) {
    console.error(`Fetching ${source.url}...`);
    let html: string;
    try {
      html = source.insecure ? fetchTextInsecure(source.url) : await fetchText(source.url);
    } catch (err) {
      console.error(`  failed: ${(err as Error).message} -- skipping this source`);
      continue;
    }
    const rows = source.parse(html);
    console.error(`  parsed ${rows.length} rows with a real website`);
    for (const row of rows) all.push({ row, source });
    await sleep(REQUEST_GAP_MS);
  }
  return all;
}

type ResolveResult = 'ok' | 'dead' | 'unknown';

// Resolve-checks a candidate URL before it's allowed into sites/, mirroring the two-tier judgment
// audit/src/resolve.ts itself uses for a real PR's `validate --resolve`: a DNS lookup failure is
// `dead` (resolve.ts's `dnsFailure` is `severity: 'error'` -- nothing else matters if the hostname
// doesn't exist at all), but an HTTP-level failure -- non-2xx, timeout, connection refused once DNS
// *did* resolve -- is only `unknown` there (`resolve-status` is `severity: 'warn'`, CLAUDE.md's
// charitable principle: a `down` status needs two consecutive failed *light* checks, not one resolve
// attempt from one machine). This matters in practice, not just in theory: this sandbox's own
// outbound network was unreliable for several real, well-known colleges (TKM College of Engineering,
// NSS College of Engineering) during this exact run -- confirmed reachable by `cli validate
// --resolve` itself afterwards -- so treating "couldn't reach it just now" as "doesn't exist" would
// wrongly drop real government institutions. `unknown` candidates are kept and left for the normal
// light-check pipeline to judge once merged, same as any other new entry; a real DNS failure (e.g.
// tpcagr.ac.in, confirmed via `cli validate --resolve` after this script's own HTTP-only check
// missed it) is excluded here too, matching what a real PR's validate gate would flag as `error`.
// collegiateedu.kerala.gov.in needs the same insecure fetch as harvesting it did (expired cert);
// every other candidate is a distinct host, so checking several concurrently doesn't touch
// CLAUDE.md's per-host politeness limit.
async function resolveCheck(url: string): Promise<ResolveResult> {
  const hostname = new URL(url).hostname;
  try {
    await dnsLookup(hostname);
  } catch {
    return 'dead';
  }
  try {
    if (hostname.endsWith('collegiateedu.kerala.gov.in')) {
      const code = execFileSync(
        'curl',
        ['-sk', '-o', '/dev/null', '-w', '%{http_code}', '--max-time', '15', '-A', USER_AGENT, url],
        { encoding: 'utf8' },
      );
      const status = Number(code);
      if (status === 0) return 'unknown';
      return status < 400 ? 'ok' : 'dead';
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    try {
      const res = await fetch(url, { redirect: 'follow', signal: controller.signal, headers: { 'User-Agent': USER_AGENT } });
      return res.status < 400 ? 'ok' : 'dead';
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return 'unknown';
  }
}

async function filterConfirmedDead(items: Harvested[]): Promise<Harvested[]> {
  const kept: Harvested[] = [];
  const CONCURRENCY = 6;
  let i = 0;
  async function worker(): Promise<void> {
    while (i < items.length) {
      const item = items[i++];
      const result = await resolveCheck(item.row.url);
      if (result === 'dead') console.error(`  confirmed dead (DNS or HTTP error), excluded from sites/: ${item.row.name} (${item.row.url})`);
      else {
        if (result === 'unknown') console.error(`  couldn't resolve just now, kept as unverified: ${item.row.name} (${item.row.url})`);
        kept.push(item);
      }
      // collegiateedu's own subpages share one host and go through curl sequentially in effect
      // (execFileSync blocks its own worker), but still deserve the same request gap as any other
      // repeat hit on the same host.
      if (new URL(item.row.url).hostname.endsWith('collegiateedu.kerala.gov.in')) await sleep(REQUEST_GAP_MS);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return kept;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/\([^)]*\)/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

interface SiteEntry {
  id: string;
  name: string;
  url: string;
  aliases: string[];
  tier: 'college';
  kind: string;
  department: string;
  org_parent: null;
  scope: 'local';
  district: string | null;
  place: null;
  platform: null;
  priority: 1;
  tags: string[];
  source: string;
  added: string;
  lifecycle: 'active';
  notes: string;
}

const DTE_AIDED_NOTE =
  "DTE's own directory does not distinguish government from government-aided institutions (Open question 16) -- may not be purely government.";

function toSiteEntry(item: Harvested, usedIds: Set<string>): SiteEntry {
  const base = slugify(item.row.name) || 'college';
  let id = base;
  let n = 2;
  while (usedIds.has(id)) id = `${base}-${n++}`;
  usedIds.add(id);
  return {
    id,
    name: item.row.name,
    url: item.row.url,
    aliases: [],
    tier: 'college',
    kind: item.source.kind,
    department: item.source.department,
    org_parent: null,
    scope: 'local',
    district: item.row.district,
    place: null,
    platform: null,
    priority: 1,
    tags: [],
    source: item.source.url,
    added: new Date().toISOString().slice(0, 10),
    lifecycle: 'active',
    notes: item.source.id.startsWith('dte-') ? DTE_AIDED_NOTE : '',
  };
}

async function run(): Promise<void> {
  const harvested = await harvest();

  const allCandidates: Candidate[] = harvested.map((h) =>
    emit({
      url: h.row.url,
      name: h.row.name,
      source: h.source.url,
      source_page: h.source.url,
      hints: { department: h.source.department, kind: h.source.kind, district: h.row.district ?? undefined },
    }),
  );
  const candidatesPath = writeCandidates('colleges', allCandidates);
  console.error(`wrote ${allCandidates.length} candidates (full raw harvest) to ${candidatesPath}`);

  console.error('Resolve-checking before promoting to sites/ (only confirmed-dead links are dropped)...');
  const notConfirmedDead = await filterConfirmedDead(harvested);
  console.error(`  ${notConfirmedDead.length} of ${harvested.length} kept (excludes only confirmed HTTP-error dead links)`);

  const usedIds = new Set<string>();
  const entries = notConfirmedDead
    .map((item) => toSiteEntry(item, usedIds))
    .sort((a, b) => a.id.localeCompare(b.id));

  const sitesPath = join(REGISTRY_DIR, 'sites', 'colleges.yaml');
  writeFileSync(sitesPath, dumpYaml(entries, { sortKeys: false, lineWidth: -1 }));
  console.error(`wrote ${entries.length} entries to ${sitesPath}`);

  const byDistrict = entries.filter((e) => e.district !== null).length;
  console.error(`district inferred/given for ${byDistrict} of ${entries.length}`);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  run();
}
