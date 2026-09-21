#!/usr/bin/env node
import { toMarkdownTable, validateRegistry } from './validate.js';

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

/** `light.ts` (WP2.1) only exports `lightCheck()` as a function -- the `data/` result writer,
 * history and summary that would make this command actually run a check land in WP2.2. Until
 * then this prints usage unconditionally so `light --help` satisfies WP2.1's Verify step. */
function runLight(): number {
  console.log('Usage: cli.js light --ids <id,id,...> --data <dir> [--limit n]\n\nNot yet wired up -- see WP2.2. audit/src/light.ts exports lightCheck(url, opts) directly in the meantime.');
  return 0;
}

function main(): number {
  const [command, ...rest] = process.argv.slice(2);
  switch (command) {
    case 'validate':
      return runValidate(rest);
    case 'light':
      return runLight();
    default:
      console.error(`Unknown command: ${command ?? '(none)'}\nUsage: cli.js validate --registry <dir> [--json] | cli.js light --help`);
      return 1;
  }
}

process.exit(main());
