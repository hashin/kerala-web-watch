import { execFileSync } from 'node:child_process';
import { parseHTML } from 'linkedom';
import { emit, writeCandidates, type Candidate } from './lib.js';

// WP5.4: government colleges tier. Three Directorate-of-Higher-Education sources were checked by
// hand 2026-09-25:
//   - Directorate of Technical Education (dtekerala.gov.in): engineering colleges + polytechnics,
//     each with a real, distinct .ac.in (or similar) website in a clean HTML table.
//   - Directorate of Collegiate Education (collegiateedu.kerala.gov.in): arts & science colleges;
//     most rows link back to "/" (the directorate's own homepage, not a real per-college site) --
//     only rows with a real, distinct subpage are harvested here, per "never invent URLs".
//   - Directorate of Medical Education (dme.kerala.gov.in): its Educational Institutions, dental
//     college and nursing college pages list only phone/email for principals, no per-college
//     website for any of the 13 medical/6 dental/14 nursing colleges it names. Nothing to harvest
//     from this source -- medical/dental/nursing colleges are not in this pass (see STATE.md).
//
// This WP text names `registry/sites/colleges.yaml` as the direct output, the way WP1.4 generates
// LSGIs straight into `registry/sites/lsg-*.yaml` (ADR-018's one named exception to "harvests
// propose, a human curates"). Unlike LSGI, though, `lib.ts`'s shared `writeCandidates` -- what
// "via the harvest framework" means everywhere else in this codebase -- writes candidates only, by
// design. Rather than silently pick a side of that conflict, this harvest writes to
// `registry/candidates/colleges.yaml` (this file's ADR-018-compliant default) and leaves promoting
// it into `registry/sites/colleges.yaml` for a proposed ADR-027 the human needs to weigh in on
// (see docs/DECISIONS.md, docs/STATE.md open questions).
//
// collegiateedu.kerala.gov.in's TLS certificate is expired (confirmed via `curl -k` and a browser
// fetch, 2026-09-25) -- exactly what this project's own sec.https/cert checks exist to flag once
// the site is registered. A harvest reading its own public HTML tolerates that; `curl -k` is used
// only for this one host, only in this one-off script, never in the audit path itself.

const USER_AGENT =
  'KeralaWebWatch/1.0 (+https://govwebsite.hashin.me/about; civic audit harvest, one-time and human-supervised)';
const FETCH_TIMEOUT_MS = 20_000;
const REQUEST_GAP_MS = 300;

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

function isAbsoluteHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

interface RawRow {
  name: string;
  url: string;
}

// DTE's institutiondetail pages (engineering, polytechnic): a plain
// <table class="table table-bordered"><tbody><tr><td>#</td><td>Name</td><td>Year</td><td><a>Website</a></td>
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
    rows.push({ name, url });
  }
  return rows;
}

// Collegiate Education's Arts & Science Colleges page: a loosely-closed <table class="table ...">
// (its own <tr> tags are never actually closed) where most rows' name-link is a bare "/" pointing
// back at the directorate's own homepage -- not a real per-college site, so skipped -- and a
// minority link to a real subpage the directorate hosts for that college.
export function parseCollegiateTable(html: string): RawRow[] {
  const { document } = parseHTML(html);
  const rows: RawRow[] = [];
  for (const tr of Array.from(document.querySelectorAll('table.table tr'))) {
    const cells = Array.from(tr.querySelectorAll('td'));
    if (cells.length < 2) continue;
    const link = cells[1].querySelector('a');
    const href = link?.getAttribute('href')?.trim();
    const name = link?.textContent?.trim().replace(/\s+/g, ' ');
    if (!name || !href || href === '/' || href === '') continue;
    const resolved = href.startsWith('http') ? href : new URL(href, 'https://collegiateedu.kerala.gov.in').toString();
    rows.push({ name, url: resolved });
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

async function run(): Promise<void> {
  const all: Candidate[] = [];
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
    for (const row of rows) {
      all.push(
        emit({
          url: row.url,
          name: row.name,
          source: source.url,
          source_page: source.url,
          hints: { department: source.department, kind: source.kind },
        }),
      );
    }
    await sleep(REQUEST_GAP_MS);
  }

  const path = writeCandidates('colleges', all);
  console.error(`wrote ${all.length} candidates total to ${path}`);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  run();
}
