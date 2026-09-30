import { describe, expect, it } from 'vitest';
import { ACTIONS_CSV_HEADER, actionRows, actionsApi, actionsCsv, actionView, rowsInBuckets, type ActionReport } from '../src/lib/actions';
import en from '../src/i18n/en.json';
import ml from '../src/i18n/ml.json';
import type { SiteView } from '../src/lib/data';

const sites = [
  { id: 'a', name: 'Alpha, "A"', url: 'https://a.example', department: 'gad', district: 'kollam' },
  { id: 'b', name: 'Beta', url: 'https://b.example', department: 'gad', district: null },
] as unknown as SiteView[];

const report: ActionReport = {
  generated: '2026-09-30T00:00:00.000Z',
  totals: { 1: 1, 2: 0, 3: 0, 4: 0, 5: 0, unverifiable: 0, unaudited: 0, clear: 1 },
  by_department: {},
  sites: [
    { id: 'a', bucket: 1, status: 'needs-work', deep_at: '2026-09-29T00:00:00.000Z', light_at: null, actions: [{ check: 'sec.injected_links', grade: 1, sev: 'C', basis: 'deep', observed: '2026-09-29T00:00:00.000Z', ev: 'http://ww547.keralagov.in [parking-subdomain]' }] },
    { id: 'b', bucket: 'clear', status: 'healthy', deep_at: '2026-09-29T00:00:00.000Z', light_at: null, actions: [] },
  ],
};

describe('actionsCsv', () => {
  it('starts with the documented header and writes one row per action, quoting awkward fields', () => {
    const lines = actionsCsv(report, sites).trim().split('\n');
    expect(lines[0]).toBe('site_id,site_name,url,department,district,site_grade,action_grade,check_id,check_title,severity,basis,observed,evidence');
    expect(ACTIONS_CSV_HEADER).toBe(lines[0]);
    expect(lines).toHaveLength(2);
    expect(lines[1]).toBe(
      'a,"Alpha, ""A""",https://a.example,gad,kollam,1,1,sec.injected_links,Links to suspicious outside websites,C,deep,2026-09-29T00:00:00.000Z,http://ww547.keralagov.in [parking-subdomain]',
    );
  });
});

describe('actionsCsv details', () => {
  const multi: ActionReport = {
    ...report,
    sites: [{ id: 'a', bucket: 1, status: 'needs-work', deep_at: null, light_at: null, actions: [{ check: 'sec.vuln_js', grade: 3, sev: 'H', basis: 'deep', observed: 'o', ev: 'line1\nline2' }] }],
  };

  it('writes the site grade before the action grade, quotes a newline, and ends the file with a newline', () => {
    const csv = actionsCsv(multi, sites);
    expect(csv.endsWith('\n')).toBe(true);
    expect(csv).toContain(',1,3,sec.vuln_js,');
    expect(csv).toContain('"line1\nline2"');
  });
});

describe('actionRows details', () => {
  it('prefers the deep-audit time over the light-check time, and exposes the check\'s own fix text', () => {
    const both: ActionReport = { ...report, sites: [{ ...report.sites[0], deep_at: 'D', light_at: 'L' }] };
    const [row] = actionRows(both, sites, 'en');
    expect(row.checked).toBe('D');
    expect(row.top?.fix).toContain('CERT-In');
  });

  it('skips a report entry whose site is not in the site list', () => {
    const extra: ActionReport = { ...report, sites: [...report.sites, { id: 'ghost', bucket: 1, status: 'down', deep_at: null, light_at: null, actions: [] }] };
    expect(actionRows(extra, sites, 'en').map((r) => r.site.id)).toEqual(['a', 'b']);
    expect(actionsCsv(extra, sites)).not.toContain('ghost');
  });
});

describe('actionsApi', () => {
  it('adds each site\'s name and each action\'s English title and citizen text', () => {
    const api = actionsApi(report, sites);
    expect(api.sites[0].name).toBe('Alpha, "A"');
    expect(api.sites[0].actions[0].title_en).toBe('Links to suspicious outside websites');
    expect(api.sites[0].actions[0].citizen_en).toContain('gambling, spam or fake-government pages');
  });
});

describe('actionRows and actionView', () => {
  it('pairs each grade with the check\'s own plain-language reason and links deep actions to their issue card', () => {
    const [row] = actionRows(report, sites, 'en');
    expect(row.top?.title).toBe('Links to suspicious outside websites');
    expect(row.top?.citizen).toContain('This often means someone has tampered with the site');
    expect(row.top?.anchor).toBe('issue-sec.injected_links');
  });

  it('has no issue-card anchor for an action that came only from the light check', () => {
    const view = actionView({ check: 'avail.dns', grade: 2, sev: 'C', basis: 'light', observed: 'x' }, 'en');
    expect(view.anchor).toBeNull();
  });

  it('shows the Malayalam reason on the ml locale', () => {
    const view = actionView(report.sites[0].actions[0], 'ml');
    expect(view.title).toBe('സംശയാസ്പദമായ പുറം വെബ്സൈറ്റുകളിലേക്കുള്ള ലിങ്കുകൾ');
  });

  it('filters rows by bucket', () => {
    const rows = actionRows(report, sites, 'en');
    expect(rowsInBuckets(rows, [1]).map((r) => r.site.id)).toEqual(['a']);
    expect(rowsInBuckets(rows, ['clear']).map((r) => r.site.id)).toEqual(['b']);
  });
});

describe('action i18n', () => {
  const keys = Object.keys(en).filter((k) => k.startsWith('actions.') || k === 'nav.actions');

  it('translates every action key: the Malayalam differs from the English', () => {
    for (const k of keys) expect((ml as Record<string, string>)[k]).not.toBe((en as Record<string, string>)[k]);
  });

  it('gives the five grades their numbered labels', () => {
    for (const g of [1, 2, 3, 4, 5]) expect((en as Record<string, string>)[`actions.grade.${g}.label`]).toMatch(new RegExp(`^Grade ${g} — `));
  });
});
