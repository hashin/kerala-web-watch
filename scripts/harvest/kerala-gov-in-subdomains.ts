import { readFileSync } from 'node:fs';
import { emit, writeCandidates, type Candidate } from './lib.js';

// A one-off subdomain-enumeration + port-scan CSV of *.kerala.gov.in, supplied by the human
// (2026-09-21), not fetched by this script. Columns: Subdomain, IP, ASN, ASN Name, Country, Top
// Ports, CPEs. Not a directory of organisations like the other harvest sources -- most of the
// ~4,900 rows are the same handful of organisations' subsidiary/dev/infra hosts, so this script
// only screens out hosts that plainly cannot be a citizen-facing organisation website (unresolved
// at scan time, or an infra/service hostname). Everything else becomes a raw candidate; WP1.7-style
// curation, not this script, decides which are real, distinct organisations.
const INFRA_PREFIXES = [
  'mail', 'smtp', 'imap', 'pop', 'pop3', 'mx', 'ns', 'ns1', 'ns2', 'ns3', 'ns4',
  'webmail', 'autodiscover', 'cpanel', 'whm', 'ftp', 'sftp', 'vpn', 'ldap',
  'ptr', 'mta-sts', 'autoconfig', 'cdn', 'static', '_dmarc', '_domainkey',
];

interface Row {
  Subdomain: string;
  IP: string;
  'ASN Name': string;
  'Top Ports': string;
}

/** Minimal RFC-4180 line splitter (handles double-quoted fields, no embedded newlines within a
 * field) -- avoids pulling in a CSV dependency for one row shape used by one harvest script. */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      fields.push(field);
      field = '';
    } else {
      field += c;
    }
  }
  fields.push(field);
  return fields;
}

function parseCsv(text: string): Row[] {
  const lines = text.split('\n').filter((l) => l.trim().length > 0);
  const header = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(header.map((key, i) => [key, values[i] ?? ''])) as unknown as Row;
  });
}

function isInfraHost(subdomain: string): boolean {
  const firstLabel = subdomain.split('.')[0].toLowerCase();
  return INFRA_PREFIXES.includes(firstLabel);
}

function toUrl(row: Row): string {
  const ports = row['Top Ports'];
  const scheme = ports.includes('443') ? 'https' : 'http';
  return `${scheme}://${row.Subdomain}`;
}

function main(): void {
  const csvPath = process.argv[2];
  if (!csvPath) {
    console.error('usage: npx tsx scripts/harvest/kerala-gov-in-subdomains.ts <path-to-csv>');
    process.exit(1);
  }

  const rows = parseCsv(readFileSync(csvPath, 'utf8'));

  let unresolved = 0;
  let infra = 0;
  const candidates: Candidate[] = [];

  for (const row of rows) {
    if (row.IP === 'none' || row.IP === '') {
      unresolved += 1;
      continue;
    }
    if (isInfraHost(row.Subdomain)) {
      infra += 1;
      continue;
    }
    candidates.push(
      emit({
        url: toUrl(row),
        name: row.Subdomain,
        source: 'kerala-gov-in-subdomains',
        source_page: `local CSV supplied by the human (subdomain enumeration + port scan of kerala.gov.in, 2026-09-21); IP ${row.IP}, ASN "${row['ASN Name']}"`,
      }),
    );
  }

  console.error(`${rows.length} rows total, ${unresolved} unresolved (skipped), ${infra} infra-pattern hosts (skipped)`);
  console.error(`${candidates.length} candidates emitted`);
  const path = writeCandidates('kerala-gov-in-subdomains', candidates);
  console.log(`Wrote ${candidates.length} candidates to ${path}`);
}

main();
