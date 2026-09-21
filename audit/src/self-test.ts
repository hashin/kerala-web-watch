import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { load as loadYaml } from 'js-yaml';
import type { CheckId } from './checks/types.js';
import { startFixtureServer, type FixtureManifest } from './fixture-server.js';
import { runDeepAudit } from './runner.js';
import type { Site } from './types.js';

const FIXTURES_DIR = join(import.meta.dirname, '..', 'tests', 'fixtures', 'sites');

/** One entry per fixture site (WP3.5 step 6): the check ids its own page is built to trigger, and
 * -- for `fixture-good`, the one fixture meant to be clean -- the ids every *other* fixture's own
 * defect triggers, which must NOT fire here. `sec.https`/`sec.cert_valid` deliberately aren't
 * asserted anywhere: this harness serves every fixture over plain HTTP (no TLS setup for a handful
 * of local test pages), so those two fail identically for every fixture including `fixture-good` --
 * a known, harmless artifact of the test harness, not something a real audit run ever sees (a real
 * site is always reached over its own actual HTTPS). `content.stale_news`/`content.last_updated`/
 * `gigw.last_updated`/`gigw.emblem`/`gigw.ownership` and every `a11y.*`/`perf.*` id are left
 * unasserted for the same reason this list stays short: they depend on real axe-core/Lighthouse
 * judgement calls or wall-clock-relative dates, which is exactly the kind of assertion that goes
 * stale or flakes as those tools evolve -- the regex/pattern-driven `avail.*`/`content.*`/`gigw.*`
 * checks below are what this harness can pin down deterministically.
 */
interface SelfTestExpectation {
  id: string;
  mustFail: CheckId[];
  mustNotFail: CheckId[];
}

const GOOD_MUST_NOT_FAIL: CheckId[] = [
  'avail.parked',
  'avail.default_page',
  'avail.blank',
  'avail.under_construction',
  'content.legacy_font',
  'content.placeholder',
  'content.obsolete_tech',
  'content.best_viewed',
  'content.malayalam',
  'content.title',
  'content.meta_desc',
  'content.favicon',
  'content.broken_links',
  'content.broken_pdfs',
  'gigw.contact',
  'gigw.feedback',
  'gigw.sitemap',
  'gigw.privacy',
  'gigw.terms',
  'gigw.copyright_policy',
  'gigw.hyperlink_policy',
  'gigw.disclaimer',
  'gigw.accessibility_statement',
  'gigw.screen_reader',
  'gigw.help',
  'gigw.rti',
  'gigw.search',
  'gigw.ownership',
];

const EXPECTATIONS: SelfTestExpectation[] = [
  { id: 'fixture-good', mustFail: [], mustNotFail: GOOD_MUST_NOT_FAIL },
  { id: 'fixture-parked', mustFail: ['avail.parked'], mustNotFail: [] },
  { id: 'fixture-default-apache', mustFail: ['avail.default_page'], mustNotFail: [] },
  { id: 'fixture-blank', mustFail: ['avail.blank'], mustNotFail: [] },
  { id: 'fixture-legacy-font', mustFail: ['content.legacy_font'], mustNotFail: [] },
  { id: 'fixture-no-gigw', mustFail: ['gigw.contact', 'gigw.sitemap', 'gigw.privacy', 'gigw.rti'], mustNotFail: [] },
  { id: 'fixture-mixed-content', mustFail: [], mustNotFail: [] },
  { id: 'fixture-slow-5xx', mustFail: ['avail.status'], mustNotFail: [] },
];

function loadFixtureSites(): Site[] {
  return loadYaml(readFileSync(join(FIXTURES_DIR, 'registry.yaml'), 'utf8')) as Site[];
}

function loadManifest(): FixtureManifest {
  return JSON.parse(readFileSync(join(FIXTURES_DIR, 'manifest.json'), 'utf8')) as FixtureManifest;
}

/**
 * WP3.5's own smoke test: starts the fixture server, runs a real deep audit (Playwright, axe,
 * optionally Lighthouse, a real crawl) against each fixture site, and checks that each check id a
 * fixture's page is built to trigger actually fired (and, for the one clean fixture, that none of
 * the others' defects leaked into it). Prints one line per site and returns whether every
 * expectation held -- `cli.ts`'s `self-test` command turns that into the process exit code.
 */
export async function runSelfTest(opts: { noLighthouse?: boolean } = {}): Promise<boolean> {
  const manifest = loadManifest();
  const sites = loadFixtureSites();
  const fixtureServer = await startFixtureServer(manifest, join(FIXTURES_DIR, 'pages'));
  let allPassed = true;

  try {
    for (const expectation of EXPECTATIONS) {
      const site = sites.find((s) => s.id === expectation.id);
      if (!site) {
        console.error(`self-test: no registry entry for ${expectation.id}`);
        allPassed = false;
        continue;
      }
      const { result } = await runDeepAudit(site, null, {
        fixtureBase: fixtureServer.baseUrl,
        noLighthouse: opts.noLighthouse ?? true,
        vantage: 'self-test',
      });
      const failedIds = new Set(result.deep?.checks.filter((c) => c.r === 'fail').map((c) => c.id) ?? []);
      const missing = expectation.mustFail.filter((id) => !failedIds.has(id));
      const unexpected = expectation.mustNotFail.filter((id) => failedIds.has(id));
      const ok = missing.length === 0 && unexpected.length === 0 && !result.deep?.error;

      if (ok) {
        console.log(`ok   ${expectation.id}`);
      } else {
        allPassed = false;
        console.error(`FAIL ${expectation.id}`);
        if (result.deep?.error) console.error(`  runner error: ${result.deep.error}`);
        if (missing.length > 0) console.error(`  expected to fail but did not: ${missing.join(', ')}`);
        if (unexpected.length > 0) console.error(`  expected to pass but failed: ${unexpected.join(', ')}`);
      }
    }
  } finally {
    await fixtureServer.close();
  }

  return allPassed;
}
