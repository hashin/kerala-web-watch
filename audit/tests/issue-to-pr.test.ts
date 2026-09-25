import { load as loadYaml } from 'js-yaml';
import { describe, expect, it } from 'vitest';
import {
  alreadyRegisteredSite,
  buildIssueCandidate,
  normalizeFormUrl,
  parseIssueForm,
  renderIssueCandidatesYaml,
  toAlreadyTrackedComment,
  toInvalidUrlComment,
  toIssueComment,
  toIssuePrBody,
  toMalformedComment,
  upsertIssueCandidate,
  type IssueCandidate,
} from '../src/issue-to-pr.js';
import type { LightResult } from '../src/light.js';
import type { Registry, Site } from '../src/types.js';

function site(overrides: Partial<Site>): Site {
  return {
    id: 'x',
    name: 'X Directorate',
    url: 'https://x.kerala.gov.in',
    aliases: [],
    tier: 'directorate',
    kind: 'directorate',
    department: 'gad',
    org_parent: null,
    scope: 'state',
    district: null,
    place: null,
    lsg_type: null,
    platform: null,
    priority: 2,
    tags: [],
    source: 'test',
    added: '2026-09-21',
    lifecycle: 'active',
    notes: '',
    ...overrides,
  };
}

function registryOf(sites: Site[]): Registry {
  return {
    sites,
    departments: [],
    districts: [],
    places: [],
    kinds: [],
    ministers: [],
    ignore: [],
    byId: new Map(sites.map((s) => [s.id, s])),
    byDepartment: new Map(),
    byDistrict: new Map(),
    byMinistry: new Map(),
  };
}

function light(overrides: Partial<LightResult> = {}): Pick<LightResult, 'status' | 'final_url'> {
  return { status: 200, final_url: 'https://kollamcorporation.gov.in/', ...overrides };
}

const FORM_BODY = `### Organisation name

Kollam Municipal Corporation

### Website URL

https://kollamcorporation.gov.in

### What kind of organisation is this?

Local self-government (panchayat / municipality / corporation)

### District (if this is a local or district-level office)

Kollam

### Where did you find this URL?

https://lsgkerala.gov.in/en/directory

### Anything else we should know?

_No response_
`;

describe('parseIssueForm', () => {
  it('parses a fully filled-in form, treating "_No response_" as absent', () => {
    expect(parseIssueForm(FORM_BODY)).toEqual({
      name: 'Kollam Municipal Corporation',
      url: 'https://kollamcorporation.gov.in',
      kind: 'Local self-government (panchayat / municipality / corporation)',
      district: 'Kollam',
      source: 'https://lsgkerala.gov.in/en/directory',
      notes: undefined,
    });
  });

  it('carries real notes text through when the submitter wrote something', () => {
    const body = FORM_BODY.replace('_No response_', 'Please prioritise this one.');
    expect(parseIssueForm(body)?.notes).toBe('Please prioritise this one.');
  });

  it('returns null when the required name field is missing', () => {
    const body = FORM_BODY.replace('### Organisation name\n\nKollam Municipal Corporation\n\n', '');
    expect(parseIssueForm(body)).toBeNull();
  });

  it('returns null when the required url field is missing', () => {
    const body = FORM_BODY.replace('### Website URL\n\nhttps://kollamcorporation.gov.in\n\n', '');
    expect(parseIssueForm(body)).toBeNull();
  });

  it('returns null when the required source field is missing', () => {
    const body = FORM_BODY.replace('### Where did you find this URL?\n\nhttps://lsgkerala.gov.in/en/directory\n\n', '');
    expect(parseIssueForm(body)).toBeNull();
  });

  it('returns null for a body with no form headings at all', () => {
    expect(parseIssueForm('just some free text, not a form submission')).toBeNull();
  });
});

describe('normalizeFormUrl', () => {
  it('normalises a valid URL', () => {
    expect(normalizeFormUrl('https://Kollamcorporation.gov.in/')).toBe('https://kollamcorporation.gov.in');
  });

  it('returns null for text that is not a URL', () => {
    expect(normalizeFormUrl('not a url')).toBeNull();
  });
});

describe('alreadyRegisteredSite', () => {
  it('matches by the site\'s own url', () => {
    const registry = registryOf([site({ id: 'kseb', url: 'https://kseb.kerala.gov.in' })]);
    expect(alreadyRegisteredSite('https://kseb.kerala.gov.in', registry)?.id).toBe('kseb');
  });

  it('matches by a declared alias', () => {
    const registry = registryOf([site({ id: 'kseb', url: 'https://kseb.kerala.gov.in', aliases: ['https://kseb.in'] })]);
    expect(alreadyRegisteredSite('https://kseb.in', registry)?.id).toBe('kseb');
  });

  it('returns null when the host is not registered', () => {
    const registry = registryOf([site({ id: 'kseb', url: 'https://kseb.kerala.gov.in' })]);
    expect(alreadyRegisteredSite('https://newboard.kerala.gov.in', registry)).toBeNull();
  });
});

const FORM = {
  name: 'Kollam Municipal Corporation',
  url: 'https://kollamcorporation.gov.in',
  kind: 'Local self-government',
  district: 'Kollam',
  source: 'https://lsgkerala.gov.in/en/directory',
  notes: undefined,
};
const META = { issue: 42, issueUrl: 'https://github.com/hashin/kerala-web-watch/issues/42', reportedBy: 'a-citizen', now: () => new Date('2026-09-25T00:00:00.000Z') };

describe('buildIssueCandidate', () => {
  it('uses the light check\'s final (normalised) URL when reachable', () => {
    const candidate = buildIssueCandidate(FORM, 'https://kollamcorporation.gov.in', light({ status: 200, final_url: 'https://www.kollamcorporation.gov.in/' }), META);
    expect(candidate.url).toBe('https://www.kollamcorporation.gov.in');
    expect(candidate.reachable).toBe(true);
    expect(candidate.checked_status).toBe(200);
  });

  it('keeps the submitted URL and records unreachable when the light check found nothing', () => {
    const candidate = buildIssueCandidate(FORM, 'https://kollamcorporation.gov.in', { status: null, final_url: null }, META);
    expect(candidate.url).toBe('https://kollamcorporation.gov.in');
    expect(candidate.reachable).toBe(false);
    expect(candidate.checked_status).toBeNull();
  });

  it('carries the issue provenance and submitter hints', () => {
    const candidate = buildIssueCandidate(FORM, 'https://kollamcorporation.gov.in', light(), META);
    expect(candidate.issue).toBe(42);
    expect(candidate.issue_url).toBe(META.issueUrl);
    expect(candidate.reported_by).toBe('a-citizen');
    expect(candidate.source).toBe('issue #42');
    expect(candidate.source_page).toBe(FORM.source);
    expect(candidate.hints).toEqual({ kind: 'Local self-government', district: 'Kollam' });
  });

  it('omits a hint key entirely rather than storing it as undefined', () => {
    const candidate = buildIssueCandidate({ ...FORM, kind: '', district: undefined }, 'https://kollamcorporation.gov.in', light(), META);
    // toEqual({}) would also pass for {kind: undefined} -- toStrictEqual is the one that
    // actually distinguishes a present-but-undefined key from an absent one.
    expect(candidate.hints).toStrictEqual({});
    expect(Object.keys(candidate.hints)).toEqual([]);
  });
});

function candidate(overrides: Partial<IssueCandidate> = {}): IssueCandidate {
  return {
    url: 'https://kollamcorporation.gov.in',
    name: 'Kollam Municipal Corporation',
    source: 'issue #42',
    source_page: 'https://lsgkerala.gov.in/en/directory',
    hints: { kind: 'Local self-government', district: 'Kollam' },
    fetched_at: '2026-09-25T00:00:00.000Z',
    issue: 42,
    issue_url: 'https://github.com/hashin/kerala-web-watch/issues/42',
    reported_by: 'a-citizen',
    reachable: true,
    checked_status: 200,
    ...overrides,
  };
}

describe('upsertIssueCandidate', () => {
  it('appends to an empty (missing) file', () => {
    expect(upsertIssueCandidate('', candidate())).toEqual([candidate()]);
  });

  it('appends a new candidate after existing ones', () => {
    const first = candidate({ url: 'https://a.kerala.gov.in', issue: 1 });
    const existingYaml = renderIssueCandidatesYaml([first]);
    const second = candidate({ url: 'https://b.kerala.gov.in', issue: 2 });
    expect(upsertIssueCandidate(existingYaml, second)).toEqual([first, second]);
  });

  it('replaces an earlier entry for the same URL instead of duplicating it', () => {
    const original = candidate({ issue: 1, reachable: false, checked_status: null });
    const existingYaml = renderIssueCandidatesYaml([original]);
    const resubmitted = candidate({ issue: 99, reachable: true, checked_status: 200 });
    const result = upsertIssueCandidate(existingYaml, resubmitted);
    expect(result).toHaveLength(1);
    expect(result[0].issue).toBe(99);
  });
});

describe('renderIssueCandidatesYaml', () => {
  it('round-trips a candidate through YAML unchanged', () => {
    const c = candidate();
    const parsed = loadYaml(renderIssueCandidatesYaml([c]));
    expect(parsed).toEqual([c]);
  });
});

describe('issue comment text', () => {
  it('states the check succeeded and the HTTP status for a reachable candidate', () => {
    const text = toIssueComment(candidate({ reachable: true, checked_status: 200 }));
    expect(text).toContain('answered (HTTP 200)');
  });

  it('states the site did not answer for an unreachable candidate', () => {
    const text = toIssueComment(candidate({ reachable: false, checked_status: null }));
    expect(text).toContain("didn't answer");
    expect(text).toContain('unreachable');
  });

  it('links the already-tracked site by id', () => {
    const text = toAlreadyTrackedComment(site({ id: 'kollam-municipal-corp' }));
    expect(text).toContain('kollam-municipal-corp');
    expect(text).toContain('https://govwebsite.hashin.me/sites/kollam-municipal-corp/');
  });

  it('quotes the bad input back for an invalid URL', () => {
    expect(toInvalidUrlComment('not a url')).toContain('"not a url"');
  });

  it('explains a malformed submission without guessing at what was meant', () => {
    expect(toMalformedComment()).toContain('organisation name, URL and source');
  });
});

describe('toIssuePrBody', () => {
  it('includes the issue number, reporter, and a submitter-vs-checked summary', () => {
    const body = toIssuePrBody(candidate({ issue: 42, reported_by: 'a-citizen', reachable: true, checked_status: 200 }));
    expect(body).toContain('#42');
    expect(body).toContain('@a-citizen');
    expect(body).toContain('reachable (HTTP 200)');
  });

  it('includes notes only when the submitter left any', () => {
    expect(toIssuePrBody(candidate())).not.toContain('| Notes |');
    expect(toIssuePrBody(candidate({ notes: 'Please prioritise this one.' }))).toContain('Please prioritise this one.');
  });
});
