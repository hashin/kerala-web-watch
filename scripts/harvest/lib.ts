import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { dump as dumpYaml } from 'js-yaml';
import { normalizeUrl } from '../../audit/dist/url.js';

export interface CandidateHints {
  district?: string;
  department?: string;
  kind?: string;
  lsg_type?: string;
}

export interface CandidateInput {
  url: string;
  name: string;
  name_ml?: string;
  source: string;
  source_page: string;
  hints?: CandidateHints;
  fetched_at?: string;
}

export interface Candidate {
  url: string;
  name: string;
  name_ml?: string;
  source: string;
  source_page: string;
  hints: CandidateHints;
  fetched_at: string;
}

const CANDIDATES_DIR = join(process.cwd(), 'registry', 'candidates');

/**
 * Normalises a raw find into the stored candidate shape. The registry keeps a URL's scheme as a
 * real difference (validate.ts's unique-url rule) — this only fixes host case and a trailing "/"
 * root path, it does not fold http/https together. Use dedupeKey for that comparison instead.
 */
export function emit(input: CandidateInput): Candidate {
  return {
    ...input,
    url: normalizeUrl(input.url),
    hints: input.hints ?? {},
    fetched_at: input.fetched_at ?? new Date().toISOString(),
  };
}

/** Loosens a normalised URL for matching purposes only: scheme and case shouldn't split one
 * real-world site into two candidates during harvest/dedupe, even though the stored registry
 * value keeps the scheme as significant. */
export function dedupeKey(url: string): string {
  return normalizeUrl(url).replace(/^https?:\/\//, '');
}

/** Writes one source's candidates to registry/candidates/<source>.yaml (never registry/sites/ —
 * ADR-018: harvests propose, a human curates). */
export function writeCandidates(source: string, list: Candidate[]): string {
  if (!existsSync(CANDIDATES_DIR)) mkdirSync(CANDIDATES_DIR, { recursive: true });
  const path = join(CANDIDATES_DIR, `${source}.yaml`);
  writeFileSync(path, dumpYaml(list, { sortKeys: false, lineWidth: -1 }));
  return path;
}
