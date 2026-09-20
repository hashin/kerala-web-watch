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

function main(): number {
  const [command, ...rest] = process.argv.slice(2);
  switch (command) {
    case 'validate':
      return runValidate(rest);
    default:
      console.error(`Unknown command: ${command ?? '(none)'}\nUsage: cli.js validate --registry <dir> [--json]`);
      return 1;
  }
}

process.exit(main());
