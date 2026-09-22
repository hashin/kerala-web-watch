import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Registry, Site } from '../src/types.js';
import type { Result } from '../src/store.js';

/**
 * Regression test for a second instance of the WP3.7 crash-bug class: a real Actions run
 * (35631713466, after `runner.ts`'s `lighthousePromise` fix had already landed) still crashed a
 * shard on `d-alappuzha` -- this time via a `TargetCloseError` thrown deep inside
 * `lighthouse/core/gather/driver/target-manager.js`'s own internal CDP session-close handling, a
 * promise neither our code nor Lighthouse's own gather loop ever awaits directly. That kind of
 * stray rejection can't be patched at its source (it's vendored library internals), so `cli.ts`'s
 * `runRun` now installs its own last-resort `process.on('unhandledRejection', ...)` net for the
 * duration of the batch loop: log loudly, keep auditing the rest of the batch.
 *
 * `runDeepAudit` is mocked as a plain function (not `vi.fn()`) for the actual promise it creates
 * and abandons -- `vi.fn()`'s own internal result tracking only touches the promise the mock
 * *returns*, not an unrelated stray promise created and left unawaited inside its body, so `vi.fn()`
 * wouldn't mask this one -- but staying consistent with `runner-lighthouse-rejection.test.ts`'s
 * finding keeps the intent obvious without relying on that distinction being remembered correctly.
 */

vi.mock('../src/registry.js', () => ({
  loadRegistry: (): Registry =>
    ({
      sites: [siteFixture('stray-rejector'), siteFixture('good-site')],
      byId: new Map([
        ['stray-rejector', siteFixture('stray-rejector')],
        ['good-site', siteFixture('good-site')],
      ]),
      departments: [],
      districts: [],
      places: [],
      kinds: [],
      ministers: [],
      ignore: [],
      byDepartment: new Map(),
      byDistrict: new Map(),
      byMinistry: new Map(),
    }) as Registry,
}));

vi.mock('../src/store.js', () => ({
  readResult: () => null,
  writeResult: () => {},
}));

vi.mock('../src/runner.js', () => ({
  runDeepAudit: (site: Site) => {
    if (site.id === 'stray-rejector') {
      // Simulates the real crash: a vendored dependency's own internals reject a promise that
      // nothing -- not this mock, not the real runDeepAudit -- ever awaits or attaches a handler
      // to. Left exactly like this (created and abandoned), it is a genuinely unhandled rejection.
      Promise.reject(new Error('TargetCloseError: Protocol error (Target.setAutoAttach): Target closed'));
      // Node only reports an unhandled rejection once a macrotask boundary passes, so the next
      // site's own audit needs a real (if tiny) delay -- an instantly-resolved mock would let the
      // whole batch loop finish, detaching cli.ts's handler, before Node ever gets to report it.
      return new Promise((resolve) => setTimeout(() => resolve({ result: resultFixture(site.id), screenshots: null }), 20));
    }
    return new Promise((resolve) => setTimeout(() => resolve({ result: resultFixture(site.id), screenshots: null }), 20));
  },
}));

function siteFixture(id: string): Site {
  return {
    id,
    name: id,
    url: `https://${id}.kerala.gov.in`,
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
  };
}

function resultFixture(id: string): Result {
  return {
    id,
    url: `https://${id}.kerala.gov.in`,
    light: null as unknown as Result['light'],
    deep: null,
    score: null,
    status: 'healthy',
    issues: [],
    history: [],
    deep_bump: false,
  };
}

describe('cli run and a stray unhandled rejection from a vendored dependency', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('logs the stray rejection and keeps auditing the rest of the batch instead of crashing', async () => {
    const { runRun } = await import('../src/cli.js');

    // Deliberately no listener of our own here: Node's default ("throw") mode crashes the whole
    // process on an unhandled rejection unless something is registered, so the only thing standing
    // between "crash" and "no crash" is cli.ts's own handler. Adding a second, outer listener
    // would suppress the crash by itself regardless of whether cli.ts's fix works, defeating the
    // point of this test -- if cli.ts's handler weren't installed, this whole test worker would
    // die on the stray rejection instead of reaching any assertion below.
    const exitCode = await runRun(['--ids', 'stray-rejector,good-site', '--out', '/tmp/kww-cli-run-stray-rejection-test']);

    expect(exitCode).toBe(0);
    const loggedLines: string[] = consoleErrorSpy.mock.calls.map((call: unknown[]) => String(call[0]));
    // Both sites were audited -- the batch did not stop at the first one.
    expect(loggedLines.some((line) => line.startsWith('stray-rejector'))).toBe(true);
    expect(loggedLines.some((line) => line.startsWith('good-site'))).toBe(true);
    // cli.ts's own handler logged the stray rejection loudly rather than swallowing it.
    expect(loggedLines.some((line) => line.includes('unhandled rejection while auditing stray-rejector') && line.includes('Target closed'))).toBe(
      true,
    );
  });
});
