import { describe, expect, test } from 'vitest';
import { checkTls } from '../src/net/tls.js';

/**
 * The one real-network test in the suite (CLAUDE.md forbids auditing live government sites from
 * a dev machine, but example.com is IANA's own always-on test domain, not a site we audit).
 * Skipped in CI (GitHub Actions sets `CI=true`) since a runner network hiccup shouldn't fail a PR
 * check for code that isn't the network's fault.
 */
describe.skipIf(Boolean(process.env.CI))('checkTls against example.com (@live)', () => {
  test('reports a valid, hostname-matching certificate', async () => {
    const result = await checkTls('example.com');
    expect(result.attempted).toBe(true);
    expect(result.connected).toBe(true);
    expect(result.authorized).toBe(true);
    expect(result.hostnameMatch).toBe(true);
    expect(result.protocol).toMatch(/^TLSv1\.[23]$/);
    expect(result.daysLeft).toBeGreaterThan(0);
  });
});
