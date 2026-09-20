import { readFileSync, writeFileSync } from 'node:fs';
import { setDefaultResultOrder } from 'node:dns';
import { dump as dumpYaml, load as parseYaml } from 'js-yaml';
import { parseHTML } from 'linkedom';
import { emit, writeCandidates, type Candidate } from './lib.js';

setDefaultResultOrder('ipv4first');

// WP1.5: the 14 district ".nic.in" (S3WaaS) portals. Confirmed by hand (WP1.5 session) that their
// "Departments"/Public Utilities/"Department Directory" pages -- what the WP text expected to
// harvest -- are consistently informational only (office name, phone, personal-staff email) with
// zero outbound links, across every district and page type sampled (Trivandrum, Ernakulam,
// Pathanamthitta, Kozhikode, Thrissur). The one place real external links do appear is the
// homepage's own notices/quick-links widgets, which vary district to district. Ids/hosts verified
// live (dig + curl), not guessed; the historical English names below are what nic.in actually uses,
// same alias set as WP1.4's district-name variants (Trivandrum, Cochin, Calicut, etc).
const DISTRICTS: Array<{ id: string; host: string }> = [
  { id: 'thiruvananthapuram', host: 'trivandrum.nic.in' },
  { id: 'kollam', host: 'kollam.nic.in' },
  { id: 'pathanamthitta', host: 'pathanamthitta.nic.in' },
  { id: 'alappuzha', host: 'alappuzha.nic.in' },
  { id: 'kottayam', host: 'kottayam.nic.in' },
  { id: 'idukki', host: 'idukki.nic.in' },
  { id: 'ernakulam', host: 'ernakulam.nic.in' },
  { id: 'thrissur', host: 'thrissur.nic.in' },
  { id: 'palakkad', host: 'palakkad.nic.in' },
  { id: 'malappuram', host: 'malappuram.nic.in' },
  { id: 'kozhikode', host: 'kozhikode.nic.in' },
  { id: 'wayanad', host: 'wayanad.gov.in' }, // wayanad.nic.in redirects here permanently
  { id: 'kannur', host: 'kannur.nic.in' },
  { id: 'kasaragod', host: 'kasargod.nic.in' },
];

// Every one of these appeared, verbatim, in the homepage "Important Sites"/quick-links widgets of
// the districts sampled by hand -- not a guess at what central bodies might exist. Central-government
// portals and pure platform/social/app-store infrastructure both fit registry/ignore.yaml's own
// description ("central bodies... generic CDNs, etc").
const IGNORE_HOSTS: Record<string, string> = {
  'india.gov.in': 'central',
  'www.india.gov.in': 'central',
  'pmindia.gov.in': 'central',
  'www.pmindia.gov.in': 'central',
  'digitalindia.gov.in': 'central',
  'www.digitalindia.gov.in': 'central',
  'pmnrf.gov.in': 'central',
  'www.pmnrf.gov.in': 'central',
  'data.gov.in': 'central',
  'mygov.in': 'central',
  'www.mygov.in': 'central',
  'cbpssubscriber.mygov.in': 'central',
  'incredibleindia.org': 'central',
  'www.incredibleindia.org': 'central',
  'makeinindia.com': 'central',
  'www.makeinindia.com': 'central',
  'nic.in': 'central',
  'www.nic.in': 'central',
  'meity.gov.in': 'central',
  'darpg.gov.in': 'central',
  'digitalindiaawards.gov.in': 'central',
  'rtionline.gov.in': 'central',
  'rti.gov.in': 'central',
  'passportindia.gov.in': 'central',
  'eci.gov.in': 'central',
  'censusindia.gov.in': 'central',
  'amritmahotsav.nic.in': 'central',
  'childlineindia.org.in': 'central',
  's3waas.gov.in': 'not-a-site — S3WaaS platform infrastructure, not a government organisation',
  'cdn.s3waas.gov.in': 'not-a-site — S3WaaS asset CDN, not a government organisation',
  'www.facebook.com': 'not-a-site — social media',
  'facebook.com': 'not-a-site — social media',
  'x.com': 'not-a-site — social media',
  'twitter.com': 'not-a-site — social media',
  'play.google.com': 'not-a-site — app store listing',
  'apps.apple.com': 'not-a-site — app store listing',
  'www.youtube.com': 'not-a-site — video embed, not an organisation site',
  'youtube.com': 'not-a-site — video embed, not an organisation site',
  'youtu.be': 'not-a-site — video embed, not an organisation site',
};

const USER_AGENT = 'KeralaWebWatch/1.0 (+https://govwebsite.hashin.me/about; civic audit harvest, one-time and human-supervised)';
const REQUEST_GAP_MS = 300;
const FETCH_TIMEOUT_MS = 20_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

interface IgnoreEntry {
  pattern: string;
  reason: string;
}

async function run(): Promise<void> {
  const ignorePath = 'registry/ignore.yaml';
  const existingIgnore = (parseYaml(readFileSync(ignorePath, 'utf8')) as IgnoreEntry[]) ?? [];
  const ignoreByPattern = new Map(existingIgnore.map((e) => [e.pattern, e]));

  for (const { id, host } of DISTRICTS) {
    const homepage = `https://${host}/en/`;
    console.error(`Fetching ${homepage}...`);
    const candidates: Candidate[] = [];

    // The portal itself is the T4 "collectorate site" -- certain, structured, one per district.
    candidates.push(
      emit({
        url: homepage,
        name: `${id[0].toUpperCase()}${id.slice(1)} District Collectorate`,
        source: homepage,
        source_page: homepage,
        hints: { district: id, kind: 'district_admin' },
      }),
    );

    try {
      const res = await fetchWithTimeout(homepage);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { document } = parseHTML(await res.text());
      const seenUrls = new Set<string>();
      for (const a of Array.from(document.querySelectorAll('a[href]'))) {
        const href = a.getAttribute('href')?.trim();
        if (!href || !href.startsWith('http')) continue;
        let linkHost: string;
        try {
          linkHost = new URL(href).hostname;
        } catch {
          continue;
        }
        if (linkHost === host || seenUrls.has(href)) continue;
        seenUrls.add(href);

        const ignoreReason = IGNORE_HOSTS[linkHost];
        if (ignoreReason) {
          if (!ignoreByPattern.has(linkHost)) ignoreByPattern.set(linkHost, { pattern: linkHost, reason: ignoreReason });
          continue;
        }

        const text = a.textContent?.trim();
        candidates.push(
          emit({
            url: href,
            name: text && text.length > 0 ? text : linkHost,
            source: homepage,
            source_page: homepage,
            hints: { district: id },
          }),
        );
      }
    } catch (err) {
      console.error(`  failed: ${(err as Error).message} -- writing the collectorate candidate alone`);
    }

    const path = writeCandidates(`district-${id}`, candidates);
    console.error(`  wrote ${candidates.length} candidates to ${path}`);
    await sleep(REQUEST_GAP_MS);
  }

  const finalIgnore = [...ignoreByPattern.values()].sort((a, b) => a.pattern.localeCompare(b.pattern));
  const header =
    '# Hosts/URL patterns seen during discovery (DESIGN.md §6.6) that are not a Kerala government\n' +
    "# organisation's own website (central bodies, banks, railways, post, generic CDNs, etc).\n" +
    '# A human moves candidates here with a reason instead of deleting the discovery record.\n';
  writeFileSync(ignorePath, header + dumpYaml(finalIgnore, { sortKeys: false, lineWidth: -1 }));
  console.error(`ignore.yaml: ${existingIgnore.length} -> ${finalIgnore.length} entries`);
}

run();
