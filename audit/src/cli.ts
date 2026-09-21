#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import pLimit from 'p-limit';
import { toMarkdownTable, validateRegistry } from './validate.js';
import { loadRegistry } from './registry.js';
import { lightCheck } from './light.js';
import { mergeLightResult, readResult, writeJsonAtomic, writeResult, type Result } from './store.js';
import { computeSummary } from './summary.js';
import { changedSiteIds } from './changed.js';
import { resolveSites, toResolvedTable } from './resolve.js';
import { runDeepAudit } from './runner.js';
import { runSelfTest } from './self-test.js';

function flagValue(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  return index === -1 ? undefined : argv[index + 1];
}

function parseFlags(argv: string[]): { registry: string; json: boolean } {
  return {
    registry: flagValue(argv, '--registry') ?? 'registry',
    json: argv.includes('--json'),
  };
}

const VALIDATE_USAGE =
  'Usage: cli.js validate --registry <dir> [--json] [--resolve (--changed-only <ref> | --ids <id,id,...>)]';

/**
 * Offline schema + cross-reference checks always run. `--resolve` additionally light-checks a
 * *bounded* set of entries against the live internet -- either everything that changed vs.
 * `--changed-only <ref>` (validate.yml's use, on a registry PR) or an explicit `--ids` list.
 * Refusing to run `--resolve` unbounded is deliberate: CLAUDE.md forbids auditing the whole
 * registry from outside GitHub Actions, and `--resolve` is meant for one PR's worth of entries,
 * not a full-registry live scan from a dev machine.
 */
async function runValidate(argv: string[]): Promise<number> {
  if (argv.includes('--help')) {
    console.log(VALIDATE_USAGE);
    return 0;
  }

  const { registry, json } = parseFlags(argv);
  const failures = validateRegistry(registry);
  let resolved: Awaited<ReturnType<typeof resolveSites>> = [];

  if (argv.includes('--resolve')) {
    const changedOnlyRef = flagValue(argv, '--changed-only');
    const idsFlag = flagValue(argv, '--ids');
    if (!changedOnlyRef && !idsFlag) {
      console.error(`--resolve needs --changed-only <ref> or --ids <id,id,...> to bound which entries it live-checks\n${VALIDATE_USAGE}`);
      return 1;
    }

    const registryData = loadRegistry(registry);
    const targetIds = idsFlag ? idsFlag.split(',').map((id) => id.trim()) : [...changedSiteIds(registry, changedOnlyRef!)];
    const targets = targetIds
      .map((id) => registryData.byId.get(id))
      .filter((s): s is NonNullable<typeof s> => s !== undefined)
      .map((s) => ({ id: s.id, url: s.url, aliases: s.aliases, name: s.name }));
    resolved = await resolveSites(targets);
    failures.push(...resolved.flatMap((o) => o.failures));
  }

  if (json) {
    console.log(JSON.stringify(argv.includes('--resolve') ? { failures, resolved } : failures, null, 2));
  } else {
    console.log(toMarkdownTable(failures));
    const resolvedTable = toResolvedTable(resolved);
    if (resolvedTable) console.log(`\n${resolvedTable}`);
  }
  const hardFailures = failures.filter((f) => f.severity === 'error');
  return hardFailures.length === 0 ? 0 : 2;
}

const LIGHT_USAGE = 'Usage: cli.js light (--ids <id,id,...> | --all) --data <dir> [--registry <dir>] [--limit n] [--concurrency n] [--vantage name]';

/**
 * Runs the light check for a set of sites, folds each into its `data/results/<id>.json` (status
 * two-strike rule, history append -- see store.ts), then recomputes `data/summary.json` from
 * every result on disk. One stderr line per site (`id status code ms`) per WP2.2 step 4.
 */
async function runLight(argv: string[]): Promise<number> {
  if (argv.length === 0 || argv.includes('--help')) {
    console.log(LIGHT_USAGE);
    return 0;
  }

  const dataDir = flagValue(argv, '--data');
  const registryDir = flagValue(argv, '--registry') ?? 'registry';
  const idsFlag = flagValue(argv, '--ids');
  const all = argv.includes('--all');
  const limitFlag = flagValue(argv, '--limit');
  const concurrency = Number(flagValue(argv, '--concurrency') ?? '6');
  const vantage = flagValue(argv, '--vantage') ?? process.env.VANTAGE ?? 'gh-us';

  if (!dataDir) {
    console.error(`Missing --data <dir>\n${LIGHT_USAGE}`);
    return 1;
  }
  if (!idsFlag && !all) {
    console.error(`Specify --ids <id,id,...> or --all\n${LIGHT_USAGE}`);
    return 1;
  }

  const registry = loadRegistry(registryDir);
  let sites = all
    ? registry.sites
    : idsFlag!.split(',').map((rawId) => {
        const id = rawId.trim();
        const site = registry.byId.get(id);
        if (!site) throw new Error(`Unknown site id: ${id}`);
        return site;
      });
  if (limitFlag) sites = sites.slice(0, Number(limitFlag));

  const limit = pLimit(concurrency);
  const today = new Date().toISOString().slice(0, 10);
  await Promise.all(
    sites.map((site) =>
      limit(async () => {
        const light = await lightCheck(site.url);
        const result = mergeLightResult(readResult(dataDir, site.id), site, light, { vantage, today });
        writeResult(dataDir, result);
        console.error(`${site.id} ${result.status} ${light.status ?? light.status_class} ${light.ttfb_ms ?? '-'}ms`);
      }),
    ),
  );

  const allResults = registry.sites.map((s) => readResult(dataDir, s.id)).filter((r): r is Result => r !== null);
  const summary = computeSummary(registry, allResults, { now: new Date(), vantages: [vantage] });
  writeJsonAtomic(join(dataDir, 'summary.json'), summary);

  return 0;
}

const RUN_USAGE =
  'Usage: cli.js run (--ids <id,id,...> | --all) --out <dir> [--registry <dir>] [--vantage name] [--no-lighthouse] [--no-crawl] [--fixture-base <url>]';

/**
 * The Phase-3 deep-audit runner (WP3.5): light -> capture -> Lighthouse -> crawl -> checks ->
 * score, one site at a time (`runner.ts`'s own comment explains why: Lighthouse needs the CPU to
 * itself). CLAUDE.md forbids an unbounded live deep-audit run outside GitHub Actions -- mirrors
 * `--resolve`'s own bound in `runValidate` above, except a `--fixture-base` run (self-test's own
 * use, and a developer's local fixture-server run) never touches a real government site at all, so
 * it's exempt.
 */
async function runRun(argv: string[]): Promise<number> {
  if (argv.length === 0 || argv.includes('--help')) {
    console.log(RUN_USAGE);
    return 0;
  }

  const outDir = flagValue(argv, '--out');
  const registryDir = flagValue(argv, '--registry') ?? 'registry';
  const idsFlag = flagValue(argv, '--ids');
  const all = argv.includes('--all');
  const vantage = flagValue(argv, '--vantage') ?? process.env.VANTAGE ?? 'gh-us';
  const noLighthouse = argv.includes('--no-lighthouse');
  const noCrawl = argv.includes('--no-crawl');
  const fixtureBase = flagValue(argv, '--fixture-base');

  if (!outDir) {
    console.error(`Missing --out <dir>\n${RUN_USAGE}`);
    return 1;
  }
  if (!idsFlag && !all) {
    console.error(`Specify --ids <id,id,...> or --all\n${RUN_USAGE}`);
    return 1;
  }

  const ids = idsFlag ? idsFlag.split(',').map((id) => id.trim()) : null;
  const insideActions = process.env.GITHUB_ACTIONS === 'true';
  if (!fixtureBase && !insideActions && (all || (ids && ids.length > 3))) {
    console.error(
      `Refusing to deep-audit ${all ? 'the whole registry' : `${ids!.length} sites`} from outside GitHub Actions -- CLAUDE.md caps a local run at --ids of <= 3 real sites.\n${RUN_USAGE}`,
    );
    return 1;
  }

  const registry = loadRegistry(registryDir);
  const sites = all
    ? registry.sites
    : ids!.map((id) => {
        const site = registry.byId.get(id);
        if (!site) throw new Error(`Unknown site id: ${id}`);
        return site;
      });

  for (const site of sites) {
    const existing = readResult(outDir, site.id);
    const { result, screenshots } = await runDeepAudit(site, existing, { vantage, noLighthouse, noCrawl, fixtureBase: fixtureBase ?? undefined });
    writeResult(outDir, result);
    if (screenshots && result.deep?.screenshot) {
      const screenshotsDir = join(outDir, 'screenshots');
      await mkdir(screenshotsDir, { recursive: true });
      await writeFile(join(screenshotsDir, result.deep.screenshot.desktop), screenshots.desktop);
      await writeFile(join(screenshotsDir, result.deep.screenshot.mobile), screenshots.mobile);
    }
    console.error(`${site.id} ${result.status} score=${result.score?.overall ?? '-'}${result.deep?.error ? ` error=${result.deep.error}` : ''}`);
  }

  return 0;
}

async function runSelfTestCommand(argv: string[]): Promise<number> {
  if (argv.includes('--help')) {
    console.log('Usage: cli.js self-test [--with-lighthouse]');
    return 0;
  }
  const ok = await runSelfTest({ noLighthouse: !argv.includes('--with-lighthouse') });
  return ok ? 0 : 1;
}

async function main(): Promise<number> {
  const [command, ...rest] = process.argv.slice(2);
  switch (command) {
    case 'validate':
      return await runValidate(rest);
    case 'light':
      return runLight(rest);
    case 'run':
      return runRun(rest);
    case 'self-test':
      return runSelfTestCommand(rest);
    default:
      console.error(`Unknown command: ${command ?? '(none)'}\nUsage: cli.js validate --registry <dir> [--json] | cli.js light --help | cli.js run --help | cli.js self-test --help`);
      return 1;
  }
}

process.exit(await main());
