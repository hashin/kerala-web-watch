# Session handoff — 2026-09-21, mid-WP3.7 (step 2's batch_size=50 run confirmed lost to a crash bug)

_This is a one-time, detailed supplement to `docs/STATE.md`'s normal terse handoff log, written
because this session found a genuine, real bug -- confirmed twice, independently, in the same run
-- and is stopping before fixing it. Read this **in addition to**, not instead of, the normal
session-start order in `CLAUDE.md` (CLAUDE.md → `docs/STATE.md` → `docs/DECISIONS.md` → the
current WP in `docs/IMPLEMENTATION.md` → the `docs/DESIGN.md` sections that WP lists). This file is
not itself part of that read order and won't be kept up to date -- treat it as a snapshot, not a
living document. Delete it once WP3.7 is done and its content is stale (same instruction the
previous WP3.6→3.7 handoff carried, which is why it's gone now)._

## Where things stand

Phase 3 is mid-WP3.7. **Step 1 is done, verified, and pushed** (commit `ae87b71` for the workflow
itself, plus follow-up docs commits `f855156`/`6704378`): `.github/workflows/audit.yml` exists,
committed, and its 3-site `workflow_dispatch` smoke test (`site_ids=kerala-gov,keralapsc,
d-ernakulam`, run `35625147792`) ran plan → audit → merge → Pages rebuild cleanly end-to-end,
confirmed against the real `data` branch and the live site (`/sites/kerala-gov/` now shows a real
`needs-work` score of 61, `/sites/d-ernakulam/` shows 63, `/sites/keralapsc/` shows `down` — see
below for why that last one is actually wrong).

**Step 2 -- the `batch_size=50` run (`35626792354`) -- is complete and confirms the crash bug is
real and repeatable, and cost the whole batch.** `plan` succeeded (2 shards, ~25 sites each). Both
`audit` shards crashed with the *identical* error signature (`Protocol error (Page.navigate):
Target closed`, from `lighthouse/core/lib/lh-error.js:160`) -- shard 0 after 4 sites, shard 1 after
17. Because neither shard reached its `upload-artifact` step, **`merge`'s own log says it plainly:
`Found 0 artifact(s)` / `merge: batch_id=20260921-2 sites=0`** -- of the 21 sites that were actually
successfully audited (14 scored, 5 gracefully error-recorded, across both shards) before the
crashes, **none were saved**. This whole run -- ~25 minutes of two parallel Actions runners, real
polite traffic against ~46 live government sites -- produced zero merged results. This is not a
fluke: the same crash, same error, in two independent shards auditing completely different sites,
confirms the bug below is real and will keep happening on any future batch run until fixed.

## The one thing this session found that actually matters: a crash bug that loses whole shards

Shard 0's log (`gh api repos/hashin/kerala-web-watch/actions/jobs/106423125352/logs`) shows:

1. `aepds` audited fine (poor, 49).
2. `arogyakeralam` audited fine (needs-work, 51).
3. `civilsupplieskerala` failed gracefully -- `page.goto: Timeout 30000ms exceeded`, caught by
   `runner.ts`'s `try/catch`, recorded as `mergeErrorResult` exactly as WP3.5 designed. Fine.
4. `collegiateedu` also failed gracefully -- `net::ERR_CERT_DATE_INVALID` (a real expired cert on
   that site, itself a legitimate future `broken` finding once this bug is fixed), also caught
   fine. Fine.
5. Then, while auditing the **5th** site (`d-alappuzha`, going by the `--ids` list order -- its own
   result line never got a chance to print), the whole Node process crashed:
   ```
   file:.../audit/node_modules/lighthouse/core/lib/lh-error.js:160
   Error: Protocol error (Page.navigate): Protocol error (Page.navigate): Target closed
   Node.js v22.23.2
   ##[error]Process completed with exit code 1.
   ```
   This did **not** go through `runner.ts`'s `try/catch` in `runDeepAudit` -- it's an **unhandled
   promise rejection** that crashed the whole Node process, not a rejection any `await` caught.

**Confirmed a second time, independently, in shard 1's log**
(`gh api repos/hashin/kerala-web-watch/actions/jobs/106423125517/logs`): 15 sites audited
successfully (akshaya, cial, cmo, cusat, d-idukki, d-kasaragod, d-kottayam, d-malappuram,
d-pathanamthitta, d-thrissur, dhs, edistrict, egrantz, etenders) plus 3 more caught gracefully
(dslr -- timeout, fisherieskerala -- `ERR_CERT_COMMON_NAME_INVALID`, igr -- timeout), then the
**exact same** `Protocol error (Page.navigate): Target closed` from `lh-error.js:160` while
auditing the 19th site. Two shards, two completely different sets of real government sites, same
crash signature -- this rules out "one flaky site" and confirms it's Lighthouse's own async
behaviour (see root cause below) that's at fault, triggerable by ordinary real-world conditions
(a slow site, a `Target closed` race) that a batch of dozens of real sites will hit reliably.

**Root cause (read `audit/src/runner.ts` lines ~72-90 to confirm before fixing):**
`lighthousePromise = opts.noLighthouse ? Promise.resolve(undefined) : runLighthouse(deepUrl)` is
created and left un-awaited while `capture()` and other promises run concurrently; it's only
actually `await`ed later, inside `Promise.all([lighthousePromise, ...])`. If Lighthouse rejects
*before* that `Promise.all` line is reached (plausible here -- `capture()` for a slow site can
easily outlast a Lighthouse run that fails fast on a closed target), Node sees a promise reject
with **no handler attached yet** and treats it as an unhandled rejection -- which crashes the
process by default in Node 22, completely bypassing the `try { ... } catch (err) { ... }` around
it, because the crash happens on the event loop's unhandled-rejection path, not inside that
`await`'s own call stack.

**The likely fix** (verify against the real code, don't blind-copy this): eagerly mark the promise
"handled" at the point it's created, without changing what the later `await` actually receives:
```ts
const lighthousePromise = opts.noLighthouse ? Promise.resolve(undefined) : runLighthouse(deepUrl);
lighthousePromise.catch(() => {}); // keeps Node from treating an early rejection as unhandled;
                                     // the real rejection still reaches the `await Promise.all(...)` below
```
This is a standard Node idiom (a promise's rejection is "handled" as soon as *any* `.catch`/`.then`
is attached anywhere, even a throwaway one) but needs a real regression test before it's trusted --
this bug is a fixture-suite gap: WP3.5's `self-test.ts`/fixture sites never exercised "Lighthouse
rejects while capture() is still pending," so nothing caught this before it hit production. A
fixture site that makes `capture()` slow (e.g. a deliberately slow response, `slow-5xx` already
exists) combined with something that makes Lighthouse fail fast might reproduce it; if not
reproducible in fixtures, at minimum unit-test that `runDeepAudit` doesn't propagate an unhandled
rejection when `runLighthouse` is mocked to reject early via `vi.fn().mockRejectedValue(...)`
without the promise being awaited immediately by the caller.

**A second, independent gap this exposed -- and confirmed the full cost of:** `audit.yml`'s `audit`
job's `actions/upload-artifact@v4` step has no `if: always()` (matching DESIGN §6.3's own snippet,
which also lacks it) -- so when `cli.js run` crashes, the step after it is skipped by GitHub
Actions' default `if: success()`, and **every result that shard had already written to `out/`
before the crash is never uploaded.** `merge`'s own log proves this exactly: `Found 0 artifact(s)`
/ `merge: batch_id=20260921-2 sites=0` -- both shards' artifacts were missing, so all 21 sites that
*did* audit successfully (2 + 15 scored, 2 + 3 gracefully error-recorded) were thrown away, not
just the ~46 sites after each crash point. `merge`'s own `if: always()` meant it still ran (so it
correctly did nothing rather than erroring), which is why this failed safe -- no data corruption,
`data/` branch untouched by this run at all -- but real Actions compute and real, valid audit
results were wasted completely. **Fix this too**, and arguably fix it *first* since it's simpler
and independently valuable regardless of the crash bug's exact fix: add `if: always()` (or at
least `if: success() || failure()`) to the `upload-artifact` step so a shard that dies partway
through still uploads whatever it completed -- this alone would have saved all 21 sites' real
results from this run.

**Do not re-run `batch_size=50` again blind.** If the crash bug isn't fixed first, a retry is
likely to hit the same failure mode on a different site (any site with a flaky/slow Lighthouse
run is a candidate) and waste more compute for the same lost-shard outcome. Fix `runner.ts` (and
ideally add the regression test), rebuild, commit, *then* retry step 2.

## What step 2 was *for*, still worth extracting once it's fixed

Per-site timing across both shards before they crashed (gaps between consecutive `console.error`
timestamps): shard 0 averaged ~70s/site over 4 sites (57s, 81s, ...); shard 1 averaged ~53s/site
over 18 sites (a tighter, more representative sample -- 15 clean audits plus 3 graceful errors,
from `16:39:46` to `17:01:59`, ≈1,333s / 18 ≈ 74s/site including the two Lighthouse-heavy timeout
cases). All consistent with the 3-site smoke test's ~55-67 s/site. At ~70s/site, a full 40-site
shard would take ~47 minutes -- comfortably under WP3.7 step 2's 90-minute budget, so `--max-batch`
(currently 300, ADR-004) likely does *not* need lowering, but this is only an estimate from
partial, crash-truncated runs. Confirm with a real, *complete* `batch_size=50` run once the crash
bug is fixed before deciding either way -- this is tuning, recorded in STATE.md, not an ADR.

## Other findings from step 1, already in `docs/STATE.md`'s Open questions (9 and 10) -- not repeated in full here

- **Open question 9**: `keralapsc.gov.in` came back `down` instead of `unverifiable` in the step-1
  smoke test. Confirmed genuinely reachable (a manual fetch from this session's own network got a
  normal 200 OK). The CI-side 403 is a bare, content-free Apache default page that
  `avail.geo_blocked`'s signature list can't safely match without risking false positives elsewhere
  -- no safe code fix without either a registry-level override (its own ADR) or DESIGN §6.7's
  proposed India runner. Don't guess a regex for this; see STATE.md's full writeup.
- **Open question 10**: the live site briefly lagged fresh `data` content after step 1's deploy,
  even through a clean solo rebuild -- confirmed via a background poll that it was ordinary GitHub
  Pages propagation delay (a few minutes), not a real bug. No action needed; noted only so a future
  session doesn't panic over the same lag.

## Also landed this session, unrelated to WP3.7 but touching the same site pages

The human asked for two standing things at the start of this session: (1) monitor context and
self-checkpoint via this file above 350k tokens -- not yet needed, this handoff is from a direct
request, not that trigger; (2) make "broken" categorization clearer for citizens, applied
project-wide. That became **ADR-026** (`docs/DECISIONS.md`), with `docs/DESIGN.md` §5.4/§7.4 and
`CLAUDE.md`'s Non-negotiables updated to carry the rule forward, plus real code:
`audit/src/status.ts`'s new `explainLightStatus()` and `site/src/lib/data.ts`'s new
`explainStatus()`/`STATUS_DESCRIPTIONS`, wired into `site/src/pages/sites/[id].astro` and
`site/src/pages/status/[status]/[...page].astro`, and a stale methodology-page paragraph fixed
along the way. Fully committed, pushed, and verified live on production (commits `4a3053d`,
`7e59ebf`, `6590c9d`). This work is done and stable -- nothing to pick up here.

## Where to actually start

1. `cd /Users/hashin/Documents/GitHub/kerala-web-watch`
2. Read `CLAUDE.md`, then `docs/STATE.md`'s **Now** section and the two Handoff entries at the top
   (WP3.7 step 1, and this session's ADR-026/findings entries) for fuller context than this file
   repeats.
3. `gh run view 35626792354` if you want to see the confirmed-failed run for yourself (both shards
   crashed with the identical error, `merge` logged `sites=0`) -- already fully diagnosed above,
   no further investigation of *that specific run* is needed, only the fix.
4. Read `audit/src/runner.ts`'s `runDeepAudit` (~line 63-135) to confirm the unhandled-rejection
   diagnosis above against the actual current code, fix it, add a regression test, run
   `cd audit && npm test`.
5. Add `if: always()` to `.github/workflows/audit.yml`'s `upload-artifact` step in the `audit` job.
6. Commit (`fix(audit): don't let an unhandled Lighthouse rejection crash the whole shard`),
   push, then retry WP3.7 step 2 (`gh workflow run "Deep audit (rolling)" -f batch_size=50`) and
   this time let it run to completion before reading timing and deciding on `--max-batch`.
7. Only after step 2 succeeds cleanly: step 3 (cron is already in the committed file; needs two
   consecutive scheduled runs over real calendar days to close WP3.7 -- same kind of multi-day gate
   as WP2.3's open question 8).
