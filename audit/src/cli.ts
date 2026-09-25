#!/usr/bin/env node
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
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
import { deriveScheduleState, planBatch, toPlanTable } from './scheduler.js';
import { nextBatchId, readBatches } from './batches.js';
import { mergeAll } from './merge.js';
import { buildReportData, readPreviousSnapshot, renderReportMarkdown } from './report.js';
import { discoverCandidates, newCandidateHosts, renderCandidatesYaml, toDiscoveryTable } from './discover.js';
import type { OutlinksData } from './outlinks.js';
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
} from './issue-to-pr.js';

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
export async function runRun(argv: string[]): Promise<number> {
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

  // Lighthouse/puppeteer-core's own internals (e.g. a CDP session's pending callbacks getting
  // rejected by a "Target closed" mid-navigation) can reject a promise that neither they nor
  // `runDeepAudit` ever awaits directly -- an unhandled rejection Node treats as fatal by default,
  // crashing this whole batch over one site's flaky browser session (confirmed in production: run
  // 35631713466 crashed a shard on the same site, `d-alappuzha`, via a `TargetCloseError` from deep
  // inside `lighthouse/core/gather/driver/target-manager.js`, distinct from the `lighthousePromise`
  // race `runner.ts` already guards against). `runDeepAudit`'s own try/catch can't reach this --
  // it's not thrown inside anything it awaits -- so this is a last-resort net at the batch level:
  // log it loudly (never swallow a finding silently) and keep auditing the rest of the batch.
  let currentSiteId: string | null = null;
  const logStrayRejection = (reason: unknown): void => {
    const detail = reason instanceof Error ? (reason.stack ?? reason.message) : String(reason);
    console.error(`unhandled rejection while auditing ${currentSiteId ?? '(unknown site)'} -- logged, continuing batch: ${detail}`);
  };
  process.on('unhandledRejection', logStrayRejection);

  try {
    for (const site of sites) {
      currentSiteId = site.id;
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
  } finally {
    process.off('unhandledRejection', logStrayRejection);
  }

  return 0;
}

/** Appends a step output for GitHub Actions to pick up (`$GITHUB_OUTPUT`, the current mechanism --
 * the old `::set-output` command is deprecated). A no-op outside Actions, where the env var isn't
 * set, so `plan` behaves the same in a local dev run and just skips this. The `<<delimiter>>`
 * heredoc form (rather than a plain `name=value` line) is what GitHub's own docs recommend for a
 * value that might contain newlines, which the matrix JSON here does not, but the batch table
 * output easily could if this helper is ever reused for it. */
function writeGithubOutput(name: string, value: string): void {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (!outputPath) return;
  const delimiter = `ghadelimiter_${Math.random().toString(36).slice(2)}`;
  appendFileSync(outputPath, `${name}<<${delimiter}\n${value}\n${delimiter}\n`);
}

const PLAN_USAGE =
  'Usage: cli.js plan --registry <dir> --data <dir> [--refresh-days n] [--max-batch n] [--max-shards n] [--site-ids <id,id,...>] [--batch-size n] [--dry-run]';

/**
 * DESIGN §6.2's rolling scheduler (WP3.6): tiers every active site, picks the day's batch (or, with
 * `--site-ids`, bypasses tiering entirely for a manual re-audit), and shards it for audit.yml's
 * matrix job. `--dry-run` only prints the batch as a table. Otherwise the matrix JSON and batch id
 * go to `$GITHUB_OUTPUT` for the workflow's later steps -- this command's own job never touches
 * `data` beyond reading it, so it never pushes (see `batches.ts` on how `merge` still lands on the
 * same batch id without this command passing it along).
 */
async function runPlan(argv: string[]): Promise<number> {
  if (argv.includes('--help')) {
    console.log(PLAN_USAGE);
    return 0;
  }

  const registryDir = flagValue(argv, '--registry') ?? 'registry';
  const dataDir = flagValue(argv, '--data');
  if (!dataDir) {
    console.error(`Missing --data <dir>\n${PLAN_USAGE}`);
    return 1;
  }

  const refreshDays = Number(flagValue(argv, '--refresh-days') ?? '7');
  const maxBatch = Number(flagValue(argv, '--max-batch') ?? '300');
  const maxShards = Number(flagValue(argv, '--max-shards') ?? '6');
  const siteIdsFlag = flagValue(argv, '--site-ids');
  const batchSizeFlag = flagValue(argv, '--batch-size');
  const dryRun = argv.includes('--dry-run');

  const forcedSiteIds = siteIdsFlag
    ? siteIdsFlag
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean)
    : [];
  const batchSizeOverride = batchSizeFlag ? Number(batchSizeFlag) : undefined;

  const registry = loadRegistry(registryDir);
  const activeSites = registry.sites.filter((s) => s.lifecycle === 'active');
  const scheduleState = new Map(activeSites.map((s) => [s.id, deriveScheduleState(readResult(dataDir, s.id))]));

  const output = planBatch({
    activeSites: activeSites.map((s) => ({ id: s.id, priority: s.priority })),
    scheduleState,
    forcedSiteIds,
    batchSizeOverride,
    refreshDays,
    minBatch: 50,
    maxBatch,
    maxShards,
    shardSize: 40,
  });

  const batchId = nextBatchId(readBatches(dataDir), new Date());

  if (dryRun) {
    console.log(toPlanTable(output));
    console.log(`\nbatch_id: ${batchId}`);
    return 0;
  }

  const matrix = { include: output.shards.map((ids, index) => ({ index, ids: ids.join(',') })) };
  writeGithubOutput('batch_id', batchId);
  writeGithubOutput('matrix', JSON.stringify(matrix));
  console.error(`plan: batch_id=${batchId} size=${output.selected.length} shards=${output.shards.length}`);
  return 0;
}

const MERGE_USAGE = 'Usage: cli.js merge --in <dir> --data <dir> [--registry <dir>]';

/**
 * WP3.6's other half: folds a batch of shards' `out/results/*.json` into `data/` (`merge.ts`),
 * then recomputes `outlinks.json` and `summary.json` from the result. Never touches the live
 * internet itself -- everything it reads was already fetched by `cli run`'s shards -- so it has no
 * CLAUDE.md live-audit gate to check, unlike `run`/`validate --resolve`.
 */
async function runMerge(argv: string[]): Promise<number> {
  if (argv.includes('--help')) {
    console.log(MERGE_USAGE);
    return 0;
  }

  const inDir = flagValue(argv, '--in');
  const dataDir = flagValue(argv, '--data');
  const registryDir = flagValue(argv, '--registry') ?? 'registry';

  if (!inDir || !dataDir) {
    console.error(`Missing --in <dir> or --data <dir>\n${MERGE_USAGE}`);
    return 1;
  }

  const registry = loadRegistry(registryDir);
  const report = mergeAll(inDir, dataDir, registry, { now: new Date() });

  for (const site of report.sites) {
    console.error(`${site.id} ${site.status} score=${site.score ?? '-'}${site.screenshotCopied ? ' screenshot=copied' : ''}`);
  }
  console.error(`merge: batch_id=${report.batchId} sites=${report.sites.length}`);

  return 0;
}

const REPORT_USAGE = 'Usage: cli.js report --registry <dir> --data <dir> --out <dir> [--month YYYY-MM]';

/**
 * WP4.6's monthly "State of Kerala Government Websites" page: recomputes the summary the same way
 * `light`/site's own `getSummary` do (never trusts a stale `summary.json` verbatim), reads last
 * month's snapshot back out of whatever `<out>/YYYY-MM.md` sorts immediately before this month
 * (`report.ts`'s `readPreviousSnapshot`), and writes this month's file -- a content-collection
 * entry `report.yml` commits straight to `main`. Never touches the live internet.
 */
async function runReport(argv: string[]): Promise<number> {
  if (argv.includes('--help')) {
    console.log(REPORT_USAGE);
    return 0;
  }

  const registryDir = flagValue(argv, '--registry') ?? 'registry';
  const dataDir = flagValue(argv, '--data');
  const outDir = flagValue(argv, '--out');
  const month = flagValue(argv, '--month') || new Date().toISOString().slice(0, 7);

  if (!dataDir || !outDir) {
    console.error(`Missing --data <dir> or --out <dir>\n${REPORT_USAGE}`);
    return 1;
  }

  const registry = loadRegistry(registryDir);
  const results = registry.sites.map((s) => readResult(dataDir, s.id)).filter((r): r is Result => r !== null);
  const summary = computeSummary(registry, results, { now: new Date(), vantages: ['gh-us'] });
  const previous = readPreviousSnapshot(outDir, month);
  const data = buildReportData(registry, summary, previous, month, new Date());
  const markdown = renderReportMarkdown(data);

  await mkdir(outDir, { recursive: true });
  await writeFile(join(outDir, `${month}.md`), markdown);
  console.error(`report: month=${month} sites=${summary.totals.sites} deep_audited=${summary.totals.deep_audited} healthy=${summary.totals.healthy}`);

  return 0;
}

const DISCOVER_USAGE = 'Usage: cli.js discover --registry <dir> --data <dir> [--out <path>]';

/**
 * WP5.1/DESIGN §6.6: filters `data/outlinks.json` down to hosts that look like a Kerala
 * government site and aren't already registered or ignored, light-checks the survivors
 * (bounded concurrency across distinct hosts -- see `discoverCandidates`'s own comment for why
 * that still honours CLAUDE.md's <=1 req/s-per-host limit), and writes whatever answered
 * to `registry/candidates/discovered.yaml` -- recomputed wholesale each run (like
 * `summary.json`/`outlinks.json`), never accumulated, so merging a candidate into `sites/` (or
 * moving it to `ignore.yaml`) makes it stop being proposed on its own, with no separate cleanup
 * step. Refuses an unbounded run outside GitHub Actions for the same CLAUDE.md reason `run`/
 * `validate --resolve` do -- this is still real traffic to real government sites.
 */
async function runDiscover(argv: string[]): Promise<number> {
  if (argv.includes('--help')) {
    console.log(DISCOVER_USAGE);
    return 0;
  }

  const registryDir = flagValue(argv, '--registry') ?? 'registry';
  const dataDir = flagValue(argv, '--data');
  const outPath = flagValue(argv, '--out') ?? 'registry/candidates/discovered.yaml';

  if (!dataDir) {
    console.error(`Missing --data <dir>\n${DISCOVER_USAGE}`);
    return 1;
  }

  const registry = loadRegistry(registryDir);
  const outlinksPath = join(dataDir, 'outlinks.json');
  const outlinks: OutlinksData = existsSync(outlinksPath) ? JSON.parse(readFileSync(outlinksPath, 'utf-8')) : {};
  const hosts = newCandidateHosts(outlinks, registry, registry.ignore);

  const insideActions = process.env.GITHUB_ACTIONS === 'true';
  if (!insideActions && hosts.length > 3) {
    console.error(
      `Refusing to light-check ${hosts.length} discovered hosts from outside GitHub Actions -- CLAUDE.md caps a local run at <= 3 real sites.\n${DISCOVER_USAGE}`,
    );
    return 1;
  }

  const candidates = await discoverCandidates(hosts, outlinks, registry);
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, renderCandidatesYaml(candidates));

  console.error(`discover: ${Object.keys(outlinks).length} outlink hosts -> ${hosts.length} candidate hosts -> ${candidates.length} reachable, written to ${outPath}`);
  console.error(toDiscoveryTable(candidates));
  writeGithubOutput('count', String(candidates.length));
  writeGithubOutput('table', toDiscoveryTable(candidates));

  return 0;
}

const ISSUE_TO_PR_USAGE =
  'Usage: cli.js issue-to-pr --registry <dir> --body-file <path> --issue <n> --issue-url <url> --reported-by <login> [--out <path>]';

/** issue-to-pr.yml passes the untrusted issue body only as a file (`--body-file`, written by a
 * github-script step from `context.payload.issue.body` -- never interpolated into a shell
 * command) and the handful of GitHub-supplied fields as plain flags. This writes its own two
 * result files (never `$GITHUB_OUTPUT`) for the same reason: `name`/`notes` in the body are a
 * citizen's free text, and a later workflow step must never re-interpolate that text into a
 * `run:` shell command -- reading it back from a file avoids that class of injection entirely. */
async function writeIssueResultFiles(prBody: string, comment: string): Promise<void> {
  await writeFile('issue-pr-body.md', prBody);
  await writeFile('issue-comment.md', comment);
}

/**
 * WP5.2: turns one "Add a government website" issue into a candidate PR. Parses the rendered
 * form body, skips (with an explanatory comment, no PR) a malformed body, an unparseable URL, or
 * a host that's already in the registry -- only a genuinely new, well-formed submission gets
 * light-checked and appended to `registry/candidates/issues.yaml`.
 */
async function runIssueToPr(argv: string[]): Promise<number> {
  if (argv.includes('--help')) {
    console.log(ISSUE_TO_PR_USAGE);
    return 0;
  }

  const registryDir = flagValue(argv, '--registry') ?? 'registry';
  const bodyFile = flagValue(argv, '--body-file');
  const issueRaw = flagValue(argv, '--issue');
  const issueUrl = flagValue(argv, '--issue-url');
  const reportedBy = flagValue(argv, '--reported-by');
  const outPath = flagValue(argv, '--out') ?? 'registry/candidates/issues.yaml';

  if (!bodyFile || !issueRaw || !issueUrl || !reportedBy) {
    console.error(`Missing a required flag\n${ISSUE_TO_PR_USAGE}`);
    return 1;
  }
  const issue = Number(issueRaw);

  const body = readFileSync(bodyFile, 'utf-8');
  const form = parseIssueForm(body);
  if (!form) {
    writeGithubOutput('ok', 'false');
    await writeIssueResultFiles('', toMalformedComment());
    console.error(`issue-to-pr: issue #${issue} body did not parse as a filled-in add-website form`);
    return 0;
  }

  const normalizedUrl = normalizeFormUrl(form.url);
  if (!normalizedUrl) {
    writeGithubOutput('ok', 'false');
    await writeIssueResultFiles('', toInvalidUrlComment(form.url));
    console.error(`issue-to-pr: issue #${issue} submitted an unparseable URL "${form.url}"`);
    return 0;
  }

  const registry = loadRegistry(registryDir);
  const existingSite = alreadyRegisteredSite(normalizedUrl, registry);
  if (existingSite) {
    writeGithubOutput('ok', 'false');
    await writeIssueResultFiles('', toAlreadyTrackedComment(existingSite));
    console.error(`issue-to-pr: issue #${issue}'s ${normalizedUrl} already registered as ${existingSite.id}`);
    return 0;
  }

  const light = await lightCheck(form.url, { timeoutMs: 20_000 });
  const candidate = buildIssueCandidate(form, normalizedUrl, light, { issue, issueUrl, reportedBy });

  const existingYaml = existsSync(outPath) ? readFileSync(outPath, 'utf-8') : '';
  const candidates = upsertIssueCandidate(existingYaml, candidate);
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, renderIssueCandidatesYaml(candidates));

  writeGithubOutput('ok', 'true');
  await writeIssueResultFiles(toIssuePrBody(candidate), toIssueComment(candidate));
  console.error(
    `issue-to-pr: issue #${issue} -> ${candidate.url} (${candidate.reachable ? `HTTP ${candidate.checked_status}` : 'unreachable'}), written to ${outPath}`,
  );
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
    case 'plan':
      return runPlan(rest);
    case 'merge':
      return runMerge(rest);
    case 'report':
      return runReport(rest);
    case 'discover':
      return runDiscover(rest);
    case 'issue-to-pr':
      return runIssueToPr(rest);
    case 'self-test':
      return runSelfTestCommand(rest);
    default:
      console.error(
        `Unknown command: ${command ?? '(none)'}\nUsage: cli.js validate --registry <dir> [--json] | cli.js light --help | cli.js run --help | cli.js plan --help | cli.js merge --help | cli.js report --help | cli.js discover --help | cli.js issue-to-pr --help | cli.js self-test --help`,
      );
      return 1;
  }
}

// Guards the CLI's own `process.exit` so importing this module (e.g. to unit-test `runRun`) never
// triggers a real run -- only executing it directly (`node dist/cli.js ...`) does.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exit(await main());
}
