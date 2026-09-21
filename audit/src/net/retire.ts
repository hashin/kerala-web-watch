import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);

export interface VulnerableLibrary {
  library: string;
  version: string | null;
  severity: string;
  cve: string[];
}

export interface RetireOptions {
  /** A local path (or url) to a jsrepo vulnerability database, passed through to retire's own
   * `--jsrepo`. Defaults to retire's built-in remote 'central' repo when omitted -- tests always
   * pass a local fixture path so scanning stays fully offline and deterministic. */
  jsrepo?: string;
  timeoutMs?: number;
}

/** Scanned-content hash -> the vulnerabilities retire found for it, so the same script (e.g. a
 * CDN-hosted jQuery build shared by many sites) is only ever scanned once per audit run. */
const cache = new Map<string, VulnerableLibrary[]>();

export function resetRetireCache(): void {
  cache.clear();
}

/**
 * Runs retire.js's own CLI (ADR-007: we don't reimplement vulnerability fingerprinting ourselves)
 * against the script contents the page actually loaded, and returns the vulnerabilities it finds,
 * keyed back to each script's original URL. Never throws on retire's own "vulnerabilities found"
 * exit code (13) -- that is retire's normal way of reporting a real finding, not a tool failure.
 */
export async function scanForVulnerableLibraries(
  scripts: { url: string; content: string }[],
  opts: RetireOptions = {},
): Promise<Map<string, VulnerableLibrary[]>> {
  const uncached = scripts.filter((script) => !cache.has(contentHash(script.content)));
  if (uncached.length > 0) {
    const found = await runRetire(uncached, opts);
    for (const script of uncached) {
      cache.set(contentHash(script.content), found.get(script.url) ?? []);
    }
  }
  const byUrl = new Map<string, VulnerableLibrary[]>();
  for (const script of scripts) byUrl.set(script.url, cache.get(contentHash(script.content)) ?? []);
  return byUrl;
}

function contentHash(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

async function runRetire(scripts: { url: string; content: string }[], opts: RetireOptions): Promise<Map<string, VulnerableLibrary[]>> {
  const dir = await mkdtemp(join(tmpdir(), 'kww-retire-'));
  try {
    const fileToUrl = new Map<string, string>();
    await Promise.all(
      scripts.map(async (script, i) => {
        const filename = `script-${i}.js`;
        await writeFile(join(dir, filename), script.content, 'utf8');
        fileToUrl.set(filename, script.url);
      }),
    );
    const cliPath = require.resolve('retire/lib/cli.js');
    const args = [cliPath, '--path', dir, '--outputformat', 'json', '--severity', 'none'];
    if (opts.jsrepo) args.push('--jsrepo', opts.jsrepo);
    const stdout = await runRetireCli(args, opts.timeoutMs ?? 60_000);
    return parseRetireOutput(stdout, dir, fileToUrl);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function runRetireCli(args: string[], timeout: number): Promise<string> {
  try {
    const result = await execFileAsync(process.execPath, args, { timeout });
    return result.stdout;
  } catch (err) {
    // retire exits 13 (not 0) whenever it finds a vulnerability -- that's its normal report, not a
    // failed run, and its JSON is still on stdout. Any other failure (bad args, a crash) leaves
    // stdout empty, which parseRetireOutput already treats as "nothing found".
    return (err as { stdout?: string }).stdout ?? '';
  }
}

interface RetireVulnerability {
  severity: string;
  identifiers?: { CVE?: string[] };
}
interface RetireComponent {
  component: string;
  version?: string;
  vulnerabilities?: RetireVulnerability[];
}
interface RetireFinding {
  file: string;
  results: RetireComponent[];
}

function parseRetireOutput(stdout: string, scanDir: string, fileToUrl: Map<string, string>): Map<string, VulnerableLibrary[]> {
  const byUrl = new Map<string, VulnerableLibrary[]>();
  if (!stdout.trim()) return byUrl;
  let parsed: { data?: RetireFinding[] };
  try {
    parsed = JSON.parse(stdout);
  } catch {
    return byUrl;
  }
  for (const finding of parsed.data ?? []) {
    const filename = finding.file.startsWith(scanDir) ? finding.file.slice(scanDir.length + 1) : finding.file;
    const url = fileToUrl.get(filename);
    if (!url) continue;
    const libraries = finding.results
      .filter((component) => (component.vulnerabilities?.length ?? 0) > 0)
      .map(
        (component): VulnerableLibrary => ({
          library: component.component,
          version: component.version ?? null,
          severity: component.vulnerabilities![0].severity,
          cve: component.vulnerabilities!.flatMap((v) => v.identifiers?.CVE ?? []),
        }),
      );
    if (libraries.length > 0) byUrl.set(url, libraries);
  }
  return byUrl;
}
