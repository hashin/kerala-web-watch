import { CHECKS } from './registry.js';
import type { Check, CheckContext, CheckId, CheckResult } from './types.js';

/** Real check functions land here starting WP3.2 (`avail.*`/`id.*`), then WP3.3 (`sec.*`), WP3.4
 * (`content.*`/`gigw.*`), and axe/Lighthouse-backed ones (`a11y.*`/`perf.*`) once WP3.5's
 * Playwright runner exists to populate the context fields they need. */
export const CHECK_LIST: Check[] = [];

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
