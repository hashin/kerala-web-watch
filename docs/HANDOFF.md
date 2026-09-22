# Session handoff — 2026-09-22, WP3.7 steps 1–2 done, step 3's cron gate is all that's left

_A one-time supplement to `docs/STATE.md`'s normal terse handoff log, written because this session
fixed two real, confirmed-in-production crash bugs and the full diagnosis is worth more detail than
STATE.md's format comfortably holds. Read this **in addition to**, not instead of, the normal
session-start order in `CLAUDE.md` (CLAUDE.md → `docs/STATE.md` → `docs/DECISIONS.md` → the current
WP in `docs/IMPLEMENTATION.md` → the `docs/DESIGN.md` sections that WP lists). This file is not
itself part of that read order and won't be kept up to date — treat it as a snapshot. Delete it once
WP3.7 is fully closed (step 3 below) and this content is stale, same instruction every previous
handoff in this slot has carried.

## Where things stand

WP3.7 (`docs/IMPLEMENTATION.md`) is **steps 1 and 2 done; step 3 is the only thing left.**

- **Step 1** (3-site smoke test) was done and verified in a previous session.
- **Step 2** (`batch_size=50`) took three attempts across two sessions, and this session did the
  real work: found and fixed two independent, real crash bugs, then ran it clean end-to-end.
  - Attempt 1 (previous session, run `35626792354`): crashed both shards on an unhandled
    `lighthousePromise` rejection in `runner.ts`, losing all 21 sites that had already audited
    successfully, because `audit.yml`'s `upload-artifact` step had no `if: always()`.
  - Attempt 2 (this session, run `35631713466`, after fixing the above): the `runner.ts` fix
    worked exactly as intended — shard 0's crash still uploaded its 4 completed sites' results
    instead of losing everything — but **both shards crashed again**, this time via two more
    unhandled-rejection signatures from deep inside Lighthouse/puppeteer-core's own internals (a
    CDP session's pending callback rejecting when a browser target closes mid-navigation), neither
    of which is the same promise the first fix patched. Fixed with a general safety net instead of
    chasing individual internal promises (see below).
  - Attempt 3 (this session, run `35681566429`): **clean.** Both shards completed all 50 sites
    (including `d-alappuzha`, the exact site that crashed both prior attempts — this time it just
    failed gracefully with a plain `page.goto` timeout, recorded normally), merge logged
    `sites=50`, Pages rebuilt. Per-site timing ~64–70 s/site, comfortably under the 90-min/shard
    budget even at a full 50 sites — no reason to touch `--max-batch` (300, ADR-004).
- **Step 3** is not done and cannot be forced in one session: `audit.yml`'s cron
  (`30 21 * * *`, 03:00 IST) needs **two consecutive *scheduled*-triggered runs to succeed**. A
  `schedule` run fired overnight 2026-09-21→22 (`35671067666`) and **failed** — it ran before this
  session's fixes landed, so it doesn't count toward the gate. The counter starts fresh from the
  next scheduled firing after this session's fixes were pushed (`24d5f02`, ~2026-09-22T03:00Z).

## The two crash bugs, in full (read `docs/STATE.md`'s Handoff log for the same detail, this just consolidates it)

### Bug 1: `runner.ts`'s own `lighthousePromise`, fixed in `97be5e0`

`runDeepAudit` (`audit/src/runner.ts`) created `lighthousePromise` but didn't `await` it until much
later, inside a `Promise.all([lighthousePromise, ...])` several lines down (other awaits —
`capture()`, `crawl()`, `scanForVulnerableLibraries()` — happen first). If Lighthouse rejected
*before* that `Promise.all` line ran (plausible when `capture()` is slow and Lighthouse fails
fast), Node saw an unhandled rejection and killed the whole process — bypassing `runDeepAudit`'s own
`try/catch` entirely, since the crash happens on the event loop's unhandled-rejection path, not
inside anything actually awaited.

**Fix:** a no-op `lighthousePromise.catch(() => {})` immediately after creating it — marks the
promise "handled" at creation time (Node/V8 consider a promise "handled" as soon as *any*
`.then`/`.catch` is attached, even a throwaway one) without changing what the later
`await Promise.all(...)` actually receives.

Also added `if: always()` to `.github/workflows/audit.yml`'s `upload-artifact` step (mirrored into
`docs/DESIGN.md` §6.3's own reference snippet, which had the same gap) so a shard that still
crashes for any other reason no longer discards whatever results it had already written.

New test: `audit/tests/runner-lighthouse-rejection.test.ts`. Worth reading its own comments — the
mocks are deliberately plain functions, not `vi.fn()`, because `vi.fn()`'s own internal
call-result tracking (`@vitest/spy`/tinyspy) attaches a `.then`/`.catch` to any promise it wraps,
which silently masks exactly this bug regardless of whether the real fix is present. Confirmed this
by hand before landing on the final version.

### Bug 2: stray rejections from Lighthouse/puppeteer-core's own internals, fixed in `24d5f02`

After bug 1's fix was pushed, retrying `batch_size=50` (`35631713466`) still crashed both shards:

- Shard 0 hit `TargetCloseError: Protocol error (Target.setAutoAttach): Target closed`, thrown from
  `lighthouse/core/gather/driver/target-manager.js`'s own CDP session-close handling
  (`puppeteer-core`'s `CallbackRegistry.clear()` rejecting a pending callback when a browser
  target/session closes mid-navigation) — a promise created and abandoned entirely inside
  puppeteer-core's internals, never awaited by our own code or by Lighthouse's own gather loop.
- Shard 1 got much further (13 sites) before hitting the **original** `Page.navigate: Target
  closed` signature again — from a *different* internal Lighthouse promise than the one bug 1
  patched.

Both crashed on `d-alappuzha` in shard 0's case; the pattern across three separate crash instances
now (one from the previous session, two from this one) all sharing that same site strongly suggests
`d-alappuzha`'s real site (`alappuzha.nic.in`) behaves badly enough at the network/TLS level to
stress-test Playwright/Lighthouse's own error paths more than a normal site does — worth knowing if
it ever crashes again, though it audited cleanly (a plain timeout, no crash) in attempt 3.

**The real lesson:** patching individual internal promises inside a vendored dependency one crash
at a time doesn't scale — there could be more of these. **Fix:** a general, last-resort safety net
in `audit/src/cli.ts`'s `runRun` (the `run` subcommand's implementation, what `audit.yml`'s `audit`
job actually invokes): install `process.on('unhandledRejection', logStrayRejection)` for the
duration of the batch loop. `logStrayRejection` logs the current site id (tracked via a
`currentSiteId` variable updated each loop iteration) and the rejection's message/stack to
`console.error`, prefixed `unhandled rejection while auditing <site> -- logged, continuing batch:
...`. It does **not** re-throw or exit — it relies on Node's own "a listener is registered so don't
crash" default behavior to let the batch loop keep going. Removed in a `finally` after the loop.

This required two supporting changes to `cli.ts`:
- `runRun` is now `export`ed (was private) so it can be unit-tested directly.
- The file's previously-unconditional top-level `process.exit(await main())` is now guarded:
  `if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) { process.exit(await
  main()); }` — the standard Node ESM "am I the entry module" idiom, so importing `cli.ts` (e.g.
  from a test) no longer itself triggers a real CLI run and `process.exit`. Confirmed this doesn't
  change real behavior: every actual invocation (`audit.yml`, `uptime.yml`, `validate.yml`,
  `package.json`'s `self-test` script) runs it as `node dist/cli.js <command>`, which still trips
  the guard exactly as before; also smoke-tested `node dist/cli.js validate ...` directly.

New test: `audit/tests/cli-run-stray-rejection.test.ts`. Two non-obvious things worth knowing if you
touch this test:
1. It deliberately installs **no listener of its own** around the `runRun` call. Node's default
   ("throw") mode crashes the process on an unhandled rejection unless *at least one* listener is
   registered anywhere — so a second, outer test listener would trivially prevent the crash
   regardless of whether `cli.ts`'s own fix works, defeating the point of the test. (An earlier
   draft of this test made exactly that mistake and passed even with the fix reverted; caught it by
   deliberately breaking the fix and seeing the test still pass, which is the whole reason to always
   do that break/restore check before trusting a new regression test.)
2. The mocked `runDeepAudit`'s two sites both resolve after a short real `setTimeout` (not
   instantly) — needed because Node only reports an unhandled rejection once a macrotask boundary
   passes, and an instantly-resolving mock let the whole batch loop finish (detaching `cli.ts`'s
   listener in its `finally`) before Node ever got around to reporting the stray rejection.

**Verification note:** the `verifier` subagent stalled twice in a row (600s with no progress, a
tooling issue, not a finding) while reviewing this second fix. It was instead verified by hand: full
build, full suite (988/988), lint, and two independent break/restore cycles of the
`process.on('unhandledRejection', ...)` line, each time confirming the test fails clearly without
the fix (both a normal assertion mismatch and vitest's own "Unhandled Errors" report) and passes
with it restored.

## Where to actually start

1. `cd /Users/hashin/Documents/GitHub/kerala-web-watch`
2. Read `CLAUDE.md`, then `docs/STATE.md`'s **Now** section and its top two Handoff entries (the
   step-2-done entry and the two crash-fix entries below it) for the same information this file
   gives, in STATE.md's own terser form.
3. Check step 3's gate: `gh run list --workflow=audit.yml --limit 10` and look for two consecutive
   `schedule`-triggered rows both showing `success`. If they're not there yet, there is genuinely
   nothing to do but wait for the next scheduled firing(s) — don't force it with more
   `workflow_dispatch` runs, the gate specifically requires the cron trigger.
4. Once two consecutive scheduled runs have succeeded: mark WP3.7 fully done in `docs/STATE.md`'s
   WP table, delete this file (its content will be fully stale), and move to WP4.1 (full site page)
   per `docs/IMPLEMENTATION.md` — the natural next work package, since WP3's deep-audit pipeline
   will be fully live and WP2.4's site page is still light-check-only.
5. If a *third* distinct unhandled-rejection signature ever turns up in a future run: don't chase it
   site-by-site the way this session did for the first two. The `cli.ts` safety net (bug 2's fix)
   should already catch anything of this general shape — a further crash would mean something
   categorically different (OOM, a genuine hang past `timeout-minutes: 180`, disk space on the
   runner) worth checking `gh run view --job=<id>` for first, not another unhandled-rejection hunt.
