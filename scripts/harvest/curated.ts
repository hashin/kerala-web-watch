import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { dump as dumpYaml, load as parseYaml } from 'js-yaml';
import { emit, writeCandidates, type Candidate, type CandidateHints } from './lib.js';

// WP1.6: PSUs, statutory bodies, universities, missions -- curated, not crawled. Two source
// categories feed this file:
//   1. Entries already sitting in registry/candidates/*.yaml from WP1.2/1.3/1.5's crawls,
//      picked out here by name pattern + a hand-built exclude list (colleges, central-government
//      institutions in Kerala per ADR-009, already-registered LSGI corporations, sub-pages of an
//      org already captured under its main domain).
//   2. Organisations named by DESIGN.md Appendix A (15 universities) or by Wikipedia's "Public
//      sector undertakings in Kerala" + bptkerala.in's own PSU list (the Bureau of Public
//      Enterprises' successor body, per its own "Restructuring and renaming of RIAB as BPT" PDF)
//      that never surfaced in any crawl. Each one's URL was individually confirmed live and
//      belonging to the named org via a DuckDuckGo lookup, 2026-09-20 -- never guessed from the
//      org's initials or name.
const REGISTRY_DIR = join(process.cwd(), 'registry');
const CANDIDATES_DIR = join(REGISTRY_DIR, 'candidates');

interface RawCandidate {
  name: string;
  url: string;
  hints?: CandidateHints;
}

// This script's own output files, excluded from its input scan -- otherwise a rerun would treat
// its own previous curated.yaml as a fresh source to re-curate, and no-website.yaml has no `url`
// field at all (a Candidate-shaped read of it crashes).
const OWN_OUTPUT_FILES = new Set(['curated.yaml', 'no-website.yaml']);

function loadAllCandidates(): RawCandidate[] {
  const files = readdirSync(CANDIDATES_DIR).filter((f) => f.endsWith('.yaml') && !OWN_OUTPUT_FILES.has(f));
  const all: RawCandidate[] = [];
  for (const file of files) {
    const list = (parseYaml(readFileSync(join(CANDIDATES_DIR, file), 'utf8')) as RawCandidate[]) ?? [];
    all.push(...list);
  }
  return all;
}

const EXCLUDE: RegExp[] = [
  /college/i, /school/i, /kendriya vidyalaya/i, /navodaya/i, /polytechnic/i,
  /district court/i, /dcourts\.gov\.in/i,
  /keralapolice\.gov\.in/i, / police,/i, /^kochi city police/i,
  /^district administration/i,
  /^\w+ department, kerala$/i, // plain "X Department, Kerala" -- state directorate, already other WPs' territory
  /nic\.in\/?$/i, // bare district portal entries, already WP1.5
  /^(kasargod|kollam|kozhikode|kottayam|kannur|idukki|wayanad|thiruvananthapuram|thrissur|palakkad|pathanamthitta|malappuram|ernakulam|alappuzha)$/i,
  // Municipal corporations are WP1.4's LSGI tier, not PSU/statutory.
  /municipal corporation|corporation of (thiruvananthapuram|kochi|thrissur|kollam|kozhikode|kannur)/i,
  // Central-government institutions physically located in Kerala (ADR-009: out of scope regardless of location).
  /election commission of india|^cantonment board|^ICAR-|^national institute|^indian institute of (management|information technology|technology|space)|^national centre|meteorological centre|liquid propulsion|central tuber crops|all india institute of hygiene|coconut development board|hindustan organic chemicals|fertilizers and chemicals travancore/i,
  // University sub-services, not the institution's own primary site.
  /computer centre, university|online admission portal|results\.cusat/i,
  // Government engineering colleges / vocational degree institutes -- Phase 5 scope (DESIGN §2), not this WP's.
  /rajiv gandhi institute of technology|institute of hotel management and catering technology|^food craft institute/i,
  // Sub-pages of an org already captured under its main domain.
  /^https?:\/\/thulasi\.psc\.kerala\.gov\.in|^https?:\/\/donation\.cmdrf\.kerala\.gov\.in/i,
  // Same org as "State Election Commission (SEC), Kerala" (www.sec.kerala.gov.in) -- a bare-host
  // variant that URL normalisation's www-insensitivity doesn't fold.
  /^http:\/\/sec\.kerala\.gov\.in\/?$/i,
];

type Kind = 'university' | 'psu' | 'statutory-or-mission';

function classify(name: string): Kind | null {
  if (/university/i.test(name)) return 'university';
  if (/(ltd\.?|limited|corporation|corp\.?)\b/i.test(name)) return 'psu';
  if (/(board|commission|council|authority|federation|academy|mission|society|institute|centre|center|agency|fund)/i.test(name)) return 'statutory-or-mission';
  return null;
}

// A finer-grained registry/kinds.yaml value for the "statutory-or-mission" bucket, checked in the
// same priority order a human would read the name.
function statutoryKind(name: string): string {
  if (/mission/i.test(name)) return 'mission';
  if (/board/i.test(name)) return 'board';
  if (/commission/i.test(name)) return 'commission';
  if (/council/i.test(name)) return 'council';
  if (/authority/i.test(name)) return 'authority';
  return 'agency';
}

// DESIGN.md Appendix A names 15 universities from memory; 8 surfaced via harvested candidates.
// These 7 didn't appear in any crawl but are verified live (curl, 2026-09-20).
const MISSING_UNIVERSITIES: RawCandidate[] = [
  { name: 'APJ Abdul Kalam Technological University', url: 'https://ktu.edu.in' },
  { name: 'Kerala University of Health Sciences', url: 'https://kuhs.ac.in' },
  { name: 'Kerala Veterinary and Animal Sciences University', url: 'https://kvasu.ac.in' },
  { name: 'Kerala University of Fisheries and Ocean Studies', url: 'https://kufos.ac.in' },
  { name: 'Sree Sankaracharya University of Sanskrit', url: 'https://ssus.ac.in' },
  { name: 'Thunchath Ezhuthachan Malayalam University', url: 'https://malayalamuniversity.edu.in' },
  { name: 'Digital University Kerala', url: 'https://duk.ac.in' },
  { name: 'Sreenarayanaguru Open University', url: 'https://sgou.ac.in' },
];

// Named by Wikipedia's "Public sector undertakings in Kerala" or bptkerala.in's PSU list; none
// surfaced in any crawl. Every URL individually confirmed (DuckDuckGo lookup, then checked the
// result actually describes the named organisation), 2026-09-20.
const FOUND_BY_SEARCH: Array<RawCandidate & { kind: Kind }> = [
  { name: 'Technopark, Thiruvananthapuram', url: 'https://www.technopark.org', kind: 'psu' },
  { name: 'Kerala State Financial Enterprises Ltd. (KSFE)', url: 'https://www.ksfe.com', kind: 'psu' },
  { name: 'InfoPark, Kochi', url: 'https://infopark.in', kind: 'psu' },
  { name: 'The Pharmaceutical Corporation (IM) Kerala Ltd. (Oushadhi)', url: 'https://www.oushadhi.org', kind: 'psu' },
  { name: 'Kerala State Co-operative Federation for Fisheries Development Ltd. (Matsyafed)', url: 'https://www.matsyafed.in', kind: 'psu' },
  { name: 'Kerala State Handloom Weavers Co-operative Society Ltd (Hantex)', url: 'https://hantex.kerala.gov.in', kind: 'psu' },
  { name: 'Kerala State Handloom Development Corporation Ltd (Hanveev)', url: 'https://www.hanveevs.com', kind: 'psu' },
  { name: 'LBS Institute of Technology for Women', url: 'https://lbscentre.kerala.gov.in/lbsitw', kind: 'statutory-or-mission' },
  { name: 'The Kerala State Cashew Workers Apex Industrial Co-operative Society (Capex)', url: 'https://cashewcapex.com', kind: 'psu' },
  { name: 'Kerala State Khadi and Village Industries Board', url: 'https://khadi.kerala.gov.in', kind: 'statutory-or-mission' },
  { name: 'Kerala Bank (Kerala State Co-operative Bank Ltd)', url: 'https://kerala.bank.in', kind: 'psu' },
  { name: 'Kerala State Backward Classes Development Corporation Ltd (KSBCDC)', url: 'https://ksbcdc.com', kind: 'psu' },
  { name: 'Kerala Land Development Corporation Ltd (KLDC)', url: 'https://kldc.org', kind: 'psu' },
  { name: 'Kerala State Warehousing Corporation (KSWC)', url: 'https://kerwacor.com', kind: 'psu' },
  { name: 'The Kerala Agro Industries Corporation Ltd (KAICO)', url: 'https://kaicltd.com', kind: 'psu' },
  { name: 'Steel Industrials Kerala Ltd / SAIL-SCL Kerala Ltd', url: 'https://steelcomplexkerala.com', kind: 'psu' },
  { name: 'Kerala State Co-operative Coir Marketing Federation Ltd (Coirfed)', url: 'https://coirfed.com', kind: 'psu' },
  { name: 'Kerala State Development Corporation for Scheduled Castes and Scheduled Tribes Ltd (KSDC)', url: 'https://www.ksdcscst.kerala.gov.in', kind: 'psu' },
  { name: 'Bekal Resorts Development Corporation Ltd (BRDC)', url: 'https://www.bekaltourism.com', kind: 'psu' },
  { name: 'Travancore-Cochin Chemicals Ltd (TCC)', url: 'https://www.tcckerala.com', kind: 'psu' },
  { name: 'Travancore Sugars & Chemicals Ltd (TSCL)', url: 'https://travancoresugars.com', kind: 'psu' },
  { name: 'Kerala State Drugs and Pharmaceuticals Ltd (KSDP)', url: 'https://ksdp.co.in', kind: 'psu' },
  { name: 'Meat Products of India Ltd (MPI)', url: 'https://meatproductsindia.in', kind: 'psu' },
  { name: 'Kerala Cashew Board Ltd', url: 'https://keralacashewboard.com', kind: 'psu' },
  { name: 'Kerala State Film Development Corporation Ltd (KSFDC)', url: 'https://www.ksfdc.in', kind: 'psu' },
];

// Named by Wikipedia/BPT, actively searched for, and confirmed to have no discoverable official
// website -- only third-party corporate-registry listings (ZaubaCorp etc). This absence is itself
// the finding (see docs/IMPLEMENTATION.md WP1.6).
const NO_WEBSITE: Array<{ name: string; source: string; reason: string }> = [
  {
    name: 'Rehabilitation Plantations Ltd (Punalur, Kollam)',
    source: 'https://en.wikipedia.org/wiki/Public_sector_undertakings_in_Kerala',
    reason: 'Searched by hand (DuckDuckGo, 2026-09-20): only third-party corporate-registry listings (ZaubaCorp) found, no official site.',
  },
];

function run(): void {
  const all = loadAllCandidates();
  const seenUrl = new Set<string>();
  const kept: Array<{ name: string; url: string; source: string; sourcePage: string; hints: CandidateHints; kind: string }> = [];

  for (const c of all) {
    if (EXCLUDE.some((re) => re.test(c.name) || re.test(c.url))) continue;
    const kind = classify(c.name);
    if (!kind) continue;
    const key = c.url.replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase();
    if (seenUrl.has(key)) continue;
    seenUrl.add(key);
    // A `district` hint on the original candidate meant "found on this district's homepage"
    // (WP1.5) -- not "this organisation belongs to that district". Every org in this WP's scope
    // is state-level by definition (a district-specific one, e.g. a DTPC, says so in its own
    // name), so carrying that hint forward would mislead WP1.7's curation into a wrong scope.
    const { district: _sourceDistrict, ...inheritedHints } = c.hints ?? {};
    kept.push({
      name: c.name,
      url: c.url,
      source: 'registry/candidates (WP1.2/1.3/1.5 crawls)',
      sourcePage: c.url,
      hints: inheritedHints,
      kind: kind === 'university' ? 'university' : kind === 'psu' ? 'psu' : statutoryKind(c.name),
    });
  }

  for (const u of MISSING_UNIVERSITIES) {
    kept.push({
      name: u.name,
      url: u.url,
      source: 'DESIGN.md Appendix A',
      sourcePage: 'DESIGN.md Appendix A (verified live by hand, 2026-09-20)',
      hints: {},
      kind: 'university',
    });
  }

  for (const f of FOUND_BY_SEARCH) {
    kept.push({
      name: f.name,
      url: f.url,
      source: 'https://en.wikipedia.org/wiki/Public_sector_undertakings_in_Kerala',
      sourcePage: 'Wikipedia + bptkerala.in PSU lists, URL individually confirmed by search, 2026-09-20',
      hints: {},
      kind: f.kind === 'university' ? 'university' : f.kind === 'psu' ? 'psu' : statutoryKind(f.name),
    });
  }

  const candidates: Candidate[] = kept.map((k) =>
    emit({
      url: k.url,
      name: k.name,
      source: k.source,
      source_page: k.sourcePage,
      hints: { ...k.hints, kind: k.kind },
    }),
  );

  const path = writeCandidates('curated', candidates);
  const counts: Record<string, number> = {};
  for (const c of candidates) counts[c.hints.kind ?? 'unknown'] = (counts[c.hints.kind ?? 'unknown'] ?? 0) + 1;
  console.error(`Wrote ${candidates.length} candidates to ${path}`);
  console.error('By kind:', counts);

  const noWebsitePath = join(CANDIDATES_DIR, 'no-website.yaml');
  writeFileSync(
    noWebsitePath,
    '# Real organisations (named by DESIGN.md/Wikipedia/BPT) actively searched for and confirmed to\n' +
      "# have no discoverable official website. \"Has no website\" is itself a finding (WP1.6) --\n" +
      '# not a gap to guess a URL for.\n' +
      dumpYaml(NO_WEBSITE, { sortKeys: false, lineWidth: -1 }),
  );
  console.error(`Wrote ${NO_WEBSITE.length} entries to ${noWebsitePath}`);
}

run();
