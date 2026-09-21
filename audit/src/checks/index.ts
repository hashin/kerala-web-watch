import { A11Y_CHECKS } from './a11y.js';
import { AVAILABILITY_CHECKS } from './availability.js';
import { CONTENT_CHECKS } from './content.js';
import { GIGW_CHECKS } from './gigw.js';
import { IDENTITY_CHECKS } from './identity.js';
import { PERF_CHECKS } from './perf.js';
import { CHECKS } from './registry.js';
import { SECURITY_CHECKS } from './security.js';
import type { Check, CheckContext, CheckId, CheckResult } from './types.js';

/** Every check id in `registry.ts`'s catalogue is implemented as of WP3.5: `avail.*`/`id.*`
 * (WP3.2), `sec.*` (WP3.3), `content.*`/`gigw.*` (WP3.4), and `a11y.*`/`perf.*` plus the
 * crawl-dependent `content.broken_*`/`content.console_errors` (WP3.5) -- the latter group's checks
 * still fall back to `na` on their own whenever the runner didn't populate the `CheckContext`
 * fields they need (e.g. `--no-lighthouse`/`--no-crawl`, or a context built by an earlier WP's
 * tests that never sets them). */
export const CHECK_LIST: Check[] = [
  ...AVAILABILITY_CHECKS,
  ...IDENTITY_CHECKS,
  ...SECURITY_CHECKS,
  ...CONTENT_CHECKS,
  ...GIGW_CHECKS,
  ...A11Y_CHECKS,
  ...PERF_CHECKS,
];

/**
 * Runs every check in `CHECK_LIST` against `ctx`, applying its `appliesTo` gate (defaulting to
 * "always applies" when omitted). Any id in `registry.ts`'s full catalogue that has no
 * implementation yet in `CHECK_LIST` -- which, in WP3.1, is all of them -- comes back `na`, so
 * `scoreSite` and the site always see a complete, well-typed result for every check id even
 * before its logic exists.
 */
export function runChecks(ctx: CheckContext): CheckResult[] {
  const byId = new Map(CHECK_LIST.map((check) => [check.id, check]));
  return (Object.keys(CHECKS) as CheckId[]).map((id) => {
    const check = byId.get(id);
    if (!check) return { id, r: 'na' };
    if (check.appliesTo && !check.appliesTo(ctx.site)) return { id, r: 'na' };
    return check.run(ctx);
  });
}
