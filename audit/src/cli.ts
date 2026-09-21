#!/usr/bin/env node
import { join } from 'node:path';
import pLimit from 'p-limit';
import { toMarkdownTable, validateRegistry } from './validate.js';
import { loadRegistry } from './registry.js';
import { lightCheck } from './light.js';
import { mergeLightResult, readResult, writeJsonAtomic, writeResult, type Result } from './store.js';
import { computeSummary } from './summary.js';

function parseFlags(argv: string[]): { registry: string; json: boolean } {
  const registryIndex = argv.indexOf('--registry');
  return {
    registry: registryIndex === -1 ? 'registry' : argv[registryIndex + 1],
    json: argv.includes('--json'),
  };
}

function runValidate(argv: string[]): number {
  const { registry, json } = parseFlags(argv);
  const failures = validateRegistry(registry);
  console.log(json ? JSON.stringify(failures, null, 2) : toMarkdownTable(failures));
  return failures.length === 0 ? 0 : 2;
}

const LIGHT_USAGE = 'Usage: cli.js light (--ids <id,id,...> | --all) --data <dir> [--registry <dir>] [--limit n] [--concurrency n] [--vantage name]';

function flagValue(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  return index === -1 ? undefined : argv[index + 1];
}

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

async function main(): Promise<number> {
  const [command, ...rest] = process.argv.slice(2);
  switch (command) {
    case 'validate':
      return runValidate(rest);
    case 'light':
      return runLight(rest);
    default:
      console.error(`Unknown command: ${command ?? '(none)'}\nUsage: cli.js validate --registry <dir> [--json] | cli.js light --help`);
      return 1;
  }
}

process.exit(await main());
