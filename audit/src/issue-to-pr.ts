import { dump as dumpYaml, load as loadYaml } from 'js-yaml';
import type { LightResult } from './light.js';
import { normalizeUrl } from './url.js';
import type { Registry, Site } from './types.js';

/** The exact question labels from .github/ISSUE_TEMPLATE/add-website.yml -- GitHub renders each
 * form field as its own "### <label>" heading followed by the answer, so parsing the issue body
 * back out means matching these headings verbatim. Keep this in sync with that file. */
const FIELD_LABELS = {
  name: 'Organisation name',
  url: 'Website URL',
  kind: 'What kind of organisation is this?',
  district: 'District (if this is a local or district-level office)',
  source: 'Where did you find this URL?',
  notes: 'Anything else we should know?',
} as const;

export interface ParsedIssueForm {
  name: string;
  url: string;
  kind: string;
  district?: string;
  source: string;
  notes?: string;
}

/** Splits a rendered GitHub issue-form body into {heading: answer} pairs. An optional field the
 * submitter left blank renders as the literal text "_No response_", treated here as empty. */
function formSections(body: string): Map<string, string> {
  const sections = new Map<string, string>();
  const headingPattern = /^### (.+?)\r?\n+([\s\S]*?)(?=\r?\n### |$)/gm;
  for (const match of body.matchAll(headingPattern)) {
    const value = match[2].trim();
    sections.set(match[1].trim(), value === '_No response_' ? '' : value);
  }
  return sections;
}

/** `name`, `url` and `source` are the form's required fields (CLAUDE.md's "never invent URLs"
 * rule needs `source` -- where the submitter found this URL); a body missing any of them didn't
 * come from a filled-in form and is treated as malformed rather than guessed at. */
export function parseIssueForm(body: string): ParsedIssueForm | null {
  const sections = formSections(body);
  const name = sections.get(FIELD_LABELS.name) ?? '';
  const url = sections.get(FIELD_LABELS.url) ?? '';
  const source = sections.get(FIELD_LABELS.source) ?? '';
  if (!name || !url || !source) return null;
  return {
    name,
    url,
    kind: sections.get(FIELD_LABELS.kind) ?? '',
    district: sections.get(FIELD_LABELS.district) || undefined,
    source,
    notes: sections.get(FIELD_LABELS.notes) || undefined,
  };
}

/** `normalizeUrl` throws on a string that isn't a URL at all -- a citizen can type anything into
 * a plain text field, so this turns that into "not a valid URL" rather than a crash. */
export function normalizeFormUrl(rawUrl: string): string | null {
  try {
    return normalizeUrl(rawUrl);
  } catch {
    return null;
  }
}

/** Same "already known" question `discover.ts`'s `registeredHosts` answers, but this also needs
 * *which* site matched, to link the submitter to the page that already covers their URL. */
export function alreadyRegisteredSite(normalizedUrl: string, registry: Registry): Site | null {
  const host = new URL(normalizedUrl).hostname.toLowerCase();
  for (const site of registry.sites) {
    for (const url of [site.url, ...site.aliases]) {
      try {
        if (new URL(url).hostname.toLowerCase() === host) return site;
      } catch {
        continue;
      }
    }
  }
  return null;
}

export interface IssueMeta {
  issue: number;
  issueUrl: string;
  reportedBy: string;
  now?: () => Date;
}

export interface IssueCandidate {
  url: string;
  name: string;
  source: string;
  source_page: string;
  hints: { kind?: string; district?: string };
  fetched_at: string;
  issue: number;
  issue_url: string;
  reported_by: string;
  notes?: string;
  reachable: boolean;
  checked_status: number | null;
}

function withoutUndefined<T extends object>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;
}

/**
 * Combines the submitter's answers with what the light check actually found. A reachable site's
 * `url` is the light check's own final URL (redirect target, normalised) so the candidate matches
 * where the site really lives; an unreachable one keeps the submitted URL, since there's no better
 * answer -- ADR-007/DESIGN §6.7's charitable principle applies here too: not answering isn't
 * treated as "this URL is wrong," just recorded so a human can look again.
 */
export function buildIssueCandidate(
  form: ParsedIssueForm,
  normalizedUrl: string,
  light: Pick<LightResult, 'status' | 'final_url'>,
  meta: IssueMeta,
): IssueCandidate {
  const now = meta.now ?? (() => new Date());
  const reachable = light.status !== null;
  return withoutUndefined({
    url: reachable && light.final_url ? normalizeUrl(light.final_url) : normalizedUrl,
    name: form.name,
    source: `issue #${meta.issue}`,
    source_page: form.source,
    hints: withoutUndefined({ kind: form.kind || undefined, district: form.district }),
    fetched_at: now().toISOString(),
    issue: meta.issue,
    issue_url: meta.issueUrl,
    reported_by: meta.reportedBy,
    notes: form.notes,
    reachable,
    checked_status: light.status,
  });
}

const CANDIDATES_HEADER =
  '# Candidates submitted through the "Add a government website" issue form (WP5.2), one entry per\n' +
  '# issue, appended by issue-to-pr.yml as each issue is opened. A human merges what is real into\n' +
  '# registry/sites/*.yaml (with department/district/kind hints filled in) and moves the rest to\n' +
  '# ignore.yaml with a reason -- this file itself is never read by the audit suite.\n';

/** Appends `candidate` to whatever's already in the file, replacing any earlier entry for the
 * same URL (e.g. a second issue about a site someone already reported) rather than duplicating
 * it -- an empty or missing file parses as no existing candidates. */
export function upsertIssueCandidate(existingYaml: string, candidate: IssueCandidate): IssueCandidate[] {
  const existing = existingYaml.trim() ? ((loadYaml(existingYaml) as IssueCandidate[] | null) ?? []) : [];
  const withoutDuplicate = existing.filter((c) => normalizeUrl(c.url) !== candidate.url);
  return [...withoutDuplicate, candidate];
}

export function renderIssueCandidatesYaml(candidates: IssueCandidate[]): string {
  return CANDIDATES_HEADER + dumpYaml(candidates, { sortKeys: false, lineWidth: -1 });
}

export function toIssuePrBody(candidate: IssueCandidate): string {
  const checked = candidate.reachable
    ? `reachable (HTTP ${candidate.checked_status})`
    : `did not answer${candidate.checked_status ? ` (HTTP ${candidate.checked_status})` : ''}`;
  const rows = [
    `| Name | ${candidate.name} |`,
    `| URL | ${candidate.url} |`,
    `| Kind (submitter's guess) | ${candidate.hints.kind ?? '—'} |`,
    `| District | ${candidate.hints.district ?? '—'} |`,
    `| Where they found it | ${candidate.source_page} |`,
    `| Light check | ${checked} |`,
  ];
  if (candidate.notes) rows.push(`| Notes | ${candidate.notes} |`);
  return [
    `Candidate submitted via #${candidate.issue} by @${candidate.reported_by}.`,
    '',
    '| | |',
    '|---|---|',
    ...rows,
    '',
    'Merge what is real into `registry/sites/*.yaml` (fill in `department`/`district`/`kind`), or move it to `registry/ignore.yaml` with a reason.',
  ].join('\n');
}

export function toIssueComment(candidate: IssueCandidate): string {
  if (candidate.reachable) {
    return `Thanks! Checked ${candidate.url} and it answered (HTTP ${candidate.checked_status}). Opened a PR adding it to \`registry/candidates/issues.yaml\` -- it still needs a human to fold it into the real registry, so this may take a little while.`;
  }
  return `Thanks! Checked ${candidate.url} but it didn't answer${candidate.checked_status ? ` (HTTP ${candidate.checked_status})` : ''}. Opened a PR adding it to \`registry/candidates/issues.yaml\` anyway, flagged as unreachable, so a human can take a second look before deciding what to do.`;
}

export function toAlreadyTrackedComment(site: Site): string {
  return `Looks like this is already tracked, as [\`${site.id}\`](https://govwebsite.hashin.me/sites/${site.id}/) -- no new PR opened. If that's wrong (a different organisation sharing the same domain, say), let us know here and we'll take another look.`;
}

export function toInvalidUrlComment(rawUrl: string): string {
  return `Thanks for the report, but "${rawUrl}" doesn't look like a valid URL -- please open a new issue with a working link.`;
}

export function toMalformedComment(): string {
  return "Couldn't read this as a filled-in \"Add a government website\" form (organisation name, URL and source are all required) -- please use the issue form rather than editing the body by hand, and open a new issue.";
}
