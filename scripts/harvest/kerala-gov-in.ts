import { parseHTML } from 'linkedom';
import { emit, writeCandidates, type Candidate } from './lib.js';

const BASE = 'https://kerala.gov.in';
// The Secretariat Departments directory (any one department's page carries the same sidebar
// list of all 45). Found by hand during WP1.2: kerala.gov.in's homepage nav -> Government ->
// "Secretariat Departments" (JS-driven mega-menu, no crawlable link on the homepage itself).
const DEPARTMENTS_PAGE = `${BASE}/appdepartmentdetail/NTI1MzI1LjI0`;
const USER_AGENT = 'KeralaWebWatch/1.0 (+https://govwebsite.hashin.me/about; civic audit harvest, one-time and human-supervised)';
const REQUEST_GAP_MS = 300;

// Hand-verified during WP1.2 against docs/DESIGN.md Appendix C: kerala.gov.in's own department
// names (Malayalam, as the site renders them) mapped to registry/departments.yaml ids. Wording
// differs from our own name_ml translations (e.g. their "ഊര്‍ജ്ജവകുപ്പ്" for what we call
// "power"), so this can't be done by string-matching name_ml — it's a one-time manual mapping.
// A department not listed here (there is exactly one: Sainik Welfare, which has no equivalent
// in Appendix C's 45) is left without a department hint rather than guessed.
const DEPARTMENT_HINTS: Record<string, string> = {
  'ആഭ്യന്തര വകുപ്പ്': 'home',
  'ആയുഷ് വകുപ്പ്': 'ayush',
  'ആരോഗ്യ- കുടുംബക്ഷേമ വകുപ്പ്': 'health',
  'ആസൂത്രണ സാമ്പത്തിക കാര്യ വകുപ്പ്': 'plan',
  'ഇലക്‌ട്രോണിക്‌സ് & വിവരസാങ്കേതിക വിദ്യ വകുപ്പ്': 'eit',
  'ഉദ്യോഗസ്‌ഥ- ഭരണ പരിഷ്‌കാര വകുപ്പ്': 'pard',
  'ഉന്നത വിദ്യാഭ്യാസ വകുപ്പ്': 'hedu',
  'ഉപഭോക്ത്യകാര്യ വകുപ്പ്': 'fcs',
  'ഊര്‍ജ്ജവകുപ്പ്': 'power',
  'കായിക-യുവജനകാര്യ വകുപ്പ്': 'sports',
  'കാര്‍ഷിക വികസന കര്‍ഷകക്ഷേമ വകുപ്പ്': 'agri',
  'കോസ്റ്റല്‍ ഷിപ്പിംഗ് & ഇന്‍ലാന്റ് നാവിഗേഷന്‍ വകുപ്പ്': 'csin',
  'ക്ഷീര വികസനവകുപ്പ്': 'ahd',
  'ഗതാഗതവകുപ്പ്': 'transport',
  'ജല-വിഭവ വകുപ്പ്': 'wrd',
  'തദ്ദേശ സ്വയംഭരണ വകുപ്പ്': 'lsgd',
  'തൊഴില്‍ -നൈപുണ്യ വകുപ്പ്': 'labour',
  'ധനകാര്യ വകുപ്പ്': 'fin',
  'നികുതി വകുപ്പ്': 'taxes',
  'നിയമ വകുപ്പ്': 'law',
  'ന്യൂനപക്ഷ ക്ഷേമ വകുപ്പ്': 'minority',
  'പട്ടികജാതി പട്ടികവര്‍ഗ്ഗ വികസന വകുപ്പ്': 'scst',
  'പരിസ്ഥിതി  വകുപ്പ്': 'env',
  'പാര്‍ലമെന്ററികാര്യ വകുപ്പ്': 'parl',
  'പിന്നാക്ക സമുദായ വികസന വകുപ്പ്': 'bcdd',
  'പൊതുഭരണ വകുപ്പ്': 'gad',
  'പൊതുമരാമത്ത് വകുപ്പ്': 'pwd',
  'പൊതുവിദ്യാഭ്യാസ വകുപ്പ്': 'gedu',
  'പ്രവാസികാര്യ വകുപ്പ്': 'norka',
  'ഭക്ഷ്യ പൊതുവിതരണ വകുപ്പ്': 'fcs',
  'ഭവനനിര്‍മ്മാണ വകുപ്പ്': 'housing',
  'മത്സ്യബന്ധന വകുപ്പ്': 'fish',
  'മൃഗസംരക്ഷണ വകുപ്പ്': 'ahd',
  'റവന്യൂ വകുപ്പ്': 'revenue',
  'വനം-വന്യജീവി സംരക്ഷണ വകുപ്പ്': 'forest',
  'വനിത-ശിശുവികസന വകുപ്പ്': 'wcd',
  'വിജിലൻസ് വകുപ്പ്': 'vigilance',
  'വിനോദസഞ്ചാര വകുപ്പ്': 'tourism',
  'വിവര പൊതുജനസമ്പർക്ക വകുപ്പ്': 'prd',
  'വ്യവസായ-വാണിജ്യ വകുപ്പ്': 'ind',
  'ശാസ്ത്ര-സാങ്കേതിക വകുപ്പ്': 'st',
  'സഹകരണ വകുപ്പ്': 'coop',
  'സാമൂഹ്യനീതി വകുപ്പ്': 'sjd',
  'സാംസ്‌ക്കാരികകാര്യ വകുപ്പ്': 'culture',
  'സ്റ്റോർസ് പര്‍ച്ചേസ് വകുപ്പ്': 'stores',
};

interface DeptLink {
  name: string;
  href: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.text();
}

async function listDepartments(): Promise<DeptLink[]> {
  const html = await fetchText(DEPARTMENTS_PAGE);
  const { document } = parseHTML(html);
  const links = Array.from(document.querySelectorAll('a[href*="/departmentdetail/"]'));
  return links
    .map((a) => ({ name: a.textContent?.trim() ?? '', href: a.getAttribute('href') ?? '' }))
    .filter((d) => d.name && d.href);
}

function findRelatedLinkId(deptPageHtml: string): string | null {
  const match = deptPageHtml.match(/id="(\d+)"[^>]*data-type="related_link"/);
  return match ? match[1] : null;
}

/** Fixes the data-entry errors seen on the live site: a doubled scheme
 * ("http://https://example.gov.in") and a stray space after the scheme
 * ("http:// example.gov.in", from copy-pasting a rendered link). Entries that are still not a
 * valid URL after this are dropped, not guessed at further. */
function cleanUrl(url: string): string {
  return url
    .replace(/^https?:\/\/(?=https?:\/\/)/i, '')
    .replace(/^(https?:\/\/)\s+/i, '$1');
}

interface RelatedEntry {
  label: string;
  url: string;
}

function parseRelatedLinks(contentHtml: string): RelatedEntry[] {
  const { document } = parseHTML(`<table>${contentHtml}</table>`);
  const entries: RelatedEntry[] = [];
  for (const row of Array.from(document.querySelectorAll('tr'))) {
    const cells = Array.from(row.querySelectorAll('td'));
    if (cells.length < 2) continue;
    const label = cells[0].textContent?.replace(/\s+/g, ' ').trim() ?? '';
    const href = cells[1].querySelector('a[href]')?.getAttribute('href')?.trim();
    if (!label || !href) continue;
    const url = cleanUrl(href);
    if (/^https?:\/\/.+/.test(url)) entries.push({ label, url });
  }
  return entries;
}

async function harvestDepartment(dept: DeptLink): Promise<Candidate[]> {
  const deptHtml = await fetchText(dept.href);
  const relatedLinkId = findRelatedLinkId(deptHtml);
  if (!relatedLinkId) {
    console.error(`  ${dept.name}: no related-links tab found, skipping`);
    return [];
  }
  await sleep(REQUEST_GAP_MS);
  const apiJson = (await (await fetch(`${BASE}/appdepartmentcontent/${relatedLinkId}/related_link`)).json()) as {
    content?: string;
  };
  const entries = parseRelatedLinks(apiJson.content ?? '');
  console.error(`  ${dept.name}: ${entries.length} related links`);
  const department = DEPARTMENT_HINTS[dept.name];
  const candidates: Candidate[] = [];
  for (const entry of entries) {
    try {
      candidates.push(
        emit({
          url: entry.url,
          name: entry.label,
          source: 'kerala-gov-in',
          source_page: dept.href,
          hints: department ? { department } : {},
        }),
      );
    } catch (error) {
      // One malformed URL (a typo on the government's own page) shouldn't cost the whole
      // department's otherwise-good entries.
      console.error(`    skipped "${entry.label}" <${entry.url}>: ${String(error)}`);
    }
  }
  return candidates;
}

async function main(): Promise<void> {
  const departments = await listDepartments();
  console.error(`Found ${departments.length} departments on ${DEPARTMENTS_PAGE}`);

  const candidates: Candidate[] = [];
  for (const dept of departments) {
    try {
      candidates.push(...(await harvestDepartment(dept)));
    } catch (error) {
      console.error(`  ${dept.name}: ERROR ${String(error)}`);
    }
    await sleep(REQUEST_GAP_MS);
  }

  const path = writeCandidates('kerala-gov-in', candidates);
  console.log(`Wrote ${candidates.length} candidates to ${path}`);
}

main();
