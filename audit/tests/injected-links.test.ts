import { describe, expect, it } from 'vitest';
import { CHECKS } from '../src/checks/registry.js';
import { SECURITY_CHECKS } from '../src/checks/security.js';
import type { CheckContext, CheckResult } from '../src/checks/types.js';
import { scoreSite } from '../src/score.js';
import type { Site } from '../src/types.js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const check = SECURITY_CHECKS.find((c) => c.id === 'sec.injected_links')!;

const site = { id: 'lsg-bp-parappa', url: 'https://parappa.lsgkerala.gov.in/' } as Site;
const run = (links: { href: string; text: string }[] | undefined, officialDomains: string[] = []): CheckResult =>
  check.run({ site, light: {} as CheckContext['light'], finalUrl: 'https://parappa.lsgkerala.gov.in/', links, officialDomains: new Set(officialDomains) });

describe('sec.injected_links: registry entry', () => {
  it('is a critical security compromise check that does not set status', () => {
    const meta = CHECKS['sec.injected_links'];
    expect(meta.category).toBe('security');
    expect(meta.severity).toBe('C');
    expect(meta.compromise).toBe(true);
    expect(meta.statusSetting).toBeUndefined();
    for (const field of [meta.title, meta.citizen, meta.fix]) {
      expect(field.en.length).toBeGreaterThan(0);
      expect(field.ml.length).toBeGreaterThan(0);
    }
    expect(meta.citizen.en).toBe(
      'The home page contains links to outside websites that look like gambling, spam or fake-government pages. This often means someone has tampered with the site. Do not click them, and do not enter personal details on any page they lead to.',
    );
  });
});

describe('sec.injected_links: detection', () => {
  it('fails on the real Parappa link, names its rules, and never publishes the tracking token', () => {
    const r = run([{ href: 'http://ww547.keralagov.in?tkn=abc123', text: '' }]);
    expect(r.r).toBe('fail');
    expect(r.ev).toContain('ww547.keralagov.in');
    expect(r.ev).toContain('parking-subdomain');
    expect(r.ev).toContain('gov-lookalike');
    expect(r.ev).not.toContain('abc123');
  });

  it.each([
    ['spam host', 'https://slotgacor88.xyz/', '', 'spam-host'],
    ['spam link text', 'https://example.com/p', 'Situs Slot Gacor Maxwin', 'spam-text'],
    ['Malayalam gambling text', 'https://example.org/', 'ഓൺലൈൻ ചൂതാട്ടം', 'spam-text'],
    ['fake-government host', 'https://kerala-govt.com/', '', 'gov-lookalike'],
  ])('fails on %s and names the rule', (_name, href, text, rule) => {
    const r = run([{ href, text }]);
    expect(r.r).toBe('fail');
    expect(r.ev).toContain(rule);
  });

  it('passes a homepage full of legitimate outbound links, including the known false-positive traps', () => {
    const links = [
      ['https://kerala.gov.in/', 'മുഖ്യമന്ത്രി'],
      ['https://keralapolice.gov.in/cyber', 'Beware of online betting apps'],
      ['https://hckerala.gov.in/', 'Judiciary'],
      ['https://indiankanoon.org/', 'Judiciary'],
      ['https://www.mygov.in/', 'MyGov'],
      ['https://www.cowin.gov.in/', 'Book a slot'],
      ['https://statelottery.kerala.gov.in/', 'Kerala Lottery results'],
      ['https://youtube.com/watch?v=x', ''],
      ['https://facebook.com/x', ''],
      ['https://kudumbashree.org/', 'കുടുംബശ്രീ'],
    ].map(([href, text]) => ({ href, text }));
    expect(run(links, ['kudumbashree.org']).r).toBe('pass');
  });

  it('is not applicable when links were never captured, and passes on an empty link list', () => {
    expect(run(undefined).r).toBe('na');
    expect(run([]).r).toBe('pass');
  });

  it('never lists more than 3 links, caps evidence at 500 chars, and leaves no query text', () => {
    const links = Array.from({ length: 6 }, (_, i) => ({ href: `http://ww${i + 1}.keralagov.in/${'p'.repeat(200)}?tkn=secret${i}`, text: 'x'.repeat(100) }));
    const r = run(links);
    expect(r.r).toBe('fail');
    expect(r.ev!.length).toBeLessThanOrEqual(500);
    expect(r.ev!.split('ww').length - 1).toBeLessThanOrEqual(3 + 1);
    expect(r.ev).not.toContain('secret');
    expect(r.ev).toContain('+3 more');
  });

  it('makes no network request: the module imports nothing from net/', () => {
    const src = readFileSync(join(import.meta.dirname, '../src/checks/injected-links.ts'), 'utf8');
    expect(src).not.toMatch(/from '\.\.\/net\//);
    expect(src).not.toMatch(/\bfetch\(/);
  });
});

describe('sec.injected_links: what it must leave alone', () => {
  it('never treats lottery, a bare slot or bare betting as spam (Kerala State Lotteries is a department)', () => {
    const links = [
      ['https://example.org/a', 'Kerala State Lotteries'],
      ['https://example.org/b', 'ലോട്ടറി ഫലം'],
      ['https://example.org/c', 'Book a slot'],
      ['https://example.org/d', 'betting awareness'],
    ].map(([href, text]) => ({ href, text }));
    expect(run(links).r).toBe('pass');
  });

  it('skips *.gov.in and *.nic.in hosts even when the name looks like a lookalike', () => {
    expect(run([{ href: 'https://kerala-govt.gov.in/', text: '' }, { href: 'https://kerala-govt.nic.in/', text: '' }]).r).toBe('pass');
  });

  it('skips a domain in officialDomains and the allowlist even when a rule would match', () => {
    expect(run([{ href: 'https://kerala-govt.org/', text: '' }], ['kerala-govt.org']).r).toBe('pass');
    expect(run([{ href: 'https://www.mygov.in/', text: 'casino' }]).r).toBe('pass');
  });

  it('skips the site\'s own domain and non-http schemes', () => {
    expect(run([{ href: 'https://ww9.lsgkerala.gov.in/', text: 'casino' }]).r).toBe('pass');
    expect(run([{ href: 'mailto:casino@example.org', text: 'casino' }, { href: 'javascript:void(0)', text: 'togel' }]).r).toBe('pass');
  });

  it('says "+1 more" with exactly four matches, and truncates path and text at 80 and 40 characters', () => {
    const four = Array.from({ length: 4 }, (_, i) => ({ href: `http://ww${i + 1}.keralagov.in/`, text: '' }));
    expect(run(four).ev).toContain('; +1 more');
    const long = run([{ href: `http://ww1.keralagov.in/${'p'.repeat(200)}`, text: 't'.repeat(100) }]);
    expect(long.ev).toContain(`/${'p'.repeat(79)} "`);
    expect(long.ev).toContain(`"${'t'.repeat(40)}"`);
  });
});

describe('sec.injected_links: effect on the score', () => {
  it('costs exactly 40 security points and never sets hijacked/broken/down status', () => {
    const results: CheckResult[] = Object.keys(CHECKS).map((id) => ({ id, r: id === 'sec.injected_links' ? 'fail' : 'pass' })) as CheckResult[];
    const outcome = scoreSite(results);
    expect(outcome.score?.security).toBe(60);
    expect(['healthy', 'needs-work', 'poor']).toContain(outcome.status);
  });
});
