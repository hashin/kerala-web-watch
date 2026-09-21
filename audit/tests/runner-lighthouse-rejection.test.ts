import { describe, expect, it, vi } from 'vitest';
import { runDeepAudit } from '../src/runner.js';
import type { Site } from '../src/types.js';

/**
 * Regression test for the WP3.7 step-2 crash: a real `batch_size=50` audit run
 * (`35626792354`) lost 21 already-audited sites because Lighthouse rejected before
 * `runDeepAudit`'s `Promise.all` ever attached a handler to it, which Node treats as an
 * unhandled rejection and kills the whole process -- bypassing `runDeepAudit`'s own
 * try/catch entirely, since the crash happens on the event loop's unhandled-rejection path,
 * not inside any `await`'s call stack. `capture()` outlasting a Lighthouse run that fails
 * fast (e.g. a closed target) is exactly the race two independent Actions shards hit.
 *
 * The mocks below are deliberately plain functions, not `vi.fn()`. `vi.fn()`'s own call
 * tracking attaches a `.then`/`.catch` to whatever promise it wraps (to record the settled
 * result for `mock.results`), which would itself mark the promise "handled" and silently
 * defeat this exact test regardless of whether `runner.ts` has the fix.
 */

vi.mock('../src/light.js', () => ({
  lightCheck: async () => ({
    at: '2026-09-21T00:00:00.000Z',
    status_class: 'ok',
    dns: true,
    status: 200,
    final_url: 'https://good.example.test/',
    redirects: [],
    ttfb_ms: 100,
    title: 'Test Site',
    byte_size: 1000,
    tls: null,
    headers: { hsts: true, csp: false, xfo: true, xcto: true, referrer: false, server: null },
    content_hash: 'abc',
    http_redirects_to_https: true,
    geo_block_suspect: false,
    domain: 'example.test',
    final_domain: 'example.test',
  }),
}));

vi.mock('../src/capture.js', () => ({
  // Slower than the mocked Lighthouse rejection below, reproducing the real race: capture()
  // is still pending when Lighthouse's promise settles.
  capture: () =>
    new Promise((resolve) => {
      setTimeout(
        () =>
          resolve({
            finalUrl: 'https://good.example.test/',
            status: 200,
            headers: {},
            html: '<html></html>',
            text: '',
            links: [],
            cssTexts: [],
            scriptUrls: [],
            scripts: [],
            consoleErrors: [],
            requests: [],
            axe: { critical: 0, serious: 0, moderate: 0, minor: 0, byRule: {} },
            desktopScreenshot: Buffer.alloc(0),
            mobileScreenshot: Buffer.alloc(0),
          }),
        20,
      );
    }),
}));

vi.mock('../src/lighthouse.js', () => ({
  // Rejects synchronously, before capture()'s setTimeout above has a chance to resolve --
  // this is the exact ordering that crashed both shards in run 35626792354.
  runLighthouse: () => Promise.reject(new Error('Protocol error (Page.navigate): Target closed')),
}));

vi.mock('../src/probes.js', () => ({
  fetchRobotsTxt: async () => undefined,
  fetchSitemapXmlStatus: async () => undefined,
  fetchSoft404Status: async () => undefined,
  checkWwwConsistency: async () => undefined,
  // null skips the (real, network-hitting) domainExpiryDays lookup entirely.
  registrableDomainOf: () => null,
}));

function site(overrides: Partial<Site> = {}): Site {
  return {
    id: 'x',
    name: 'X',
    url: 'https://good.example.test/',
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

describe('runDeepAudit and an early Lighthouse rejection', () => {
  it('does not let an unhandled rejection escape the process when Lighthouse rejects before capture() resolves', async () => {
    const unhandled: unknown[] = [];
    const onUnhandledRejection = (reason: unknown) => unhandled.push(reason);
    process.on('unhandledRejection', onUnhandledRejection);

    try {
      const { result } = await runDeepAudit(site(), null, { noCrawl: true });
      // Node reports an unhandled rejection asynchronously, on a later tick than the one that
      // settles it (observable as a `PromiseRejectionHandledWarning` when a `.catch` arrives
      // just in time) -- give it a chance to fire before asserting nothing did.
      await new Promise((resolve) => setTimeout(resolve, 50));
      // No unhandled rejection reached the process -- this is what would have crashed the
      // Node process (and the whole Actions shard) before the fix.
      expect(unhandled).toEqual([]);
      // The site's own audit still fails gracefully into a per-site error record, exactly as
      // WP3.5 designed ("one site failing must never abort a whole batch") -- it does not
      // silently produce a clean result either.
      expect(result.deep?.error).toContain('Target closed');
    } finally {
      process.off('unhandledRejection', onUnhandledRejection);
    }
  });
});
