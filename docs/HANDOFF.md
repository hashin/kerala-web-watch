# Session handoff — 2026-09-21, end of WP3.5

_This is a one-time, detailed supplement to `docs/STATE.md`'s normal terse handoff log, written
because WP3.5 was the largest WP in the roadmap (the Playwright-driven deep-audit runner) and the
next WP (3.6) has to build directly on top of a couple of its design choices that aren't obvious
from reading the code alone. Read this **in addition to**, not instead of, the normal session-start
order in `CLAUDE.md` (CLAUDE.md → `docs/STATE.md` → `docs/DECISIONS.md` → the current WP in
`docs/IMPLEMENTATION.md` → the `docs/DESIGN.md` sections that WP lists). This file is not itself
part of that read order and won't be kept up to date — treat it as a snapshot, not a living
document. Delete it once WP3.6 is done and its content is stale._

## Where things stand

Phase 3 (deep audits) is now at WP3.5 done, WP3.6 next. Every one of DESIGN §5.3's ~84 check ids
now has a real implementation (`CHECK_LIST` in `audit/src/checks/index.ts`) — the last gap
(`a11y.*`, `perf.*`, and the crawl-dependent `content.broken_*`/`console_errors`) closed this
session. `cli run --ids <id> --out <dir>` produces a complete DESIGN §5.5-shaped result record
end to end: light check, a real Chromium capture (axe-core, console/request log, screenshots),
Lighthouse, a politeness-capped crawl, every check, a score. `cli self-test` proves this against 8
local fixture sites (`tests/fixtures/sites/`) with no live network access. Both were run for real
this session, not just unit-tested — see the WP3.5 handoff entry in `docs/STATE.md` for the actual
output of a live `keralapsc` audit (lighthouse numbers, screenshots on disk, crawl counts, a real
`down` status because that site is currently returning a plain 403 to this dev machine).

Commit, newest first: `f4836d1` (docs, WP3.5) · `77b8181` (feat, WP3.5). Both pushed to `main`.

## The one thing WP3.6 must get right: `merge`'s semantics differ from `cli run`'s own write path

`cli run --out <dir>` (WP3.5, `audit/src/cli.ts`'s `runRun`) writes straight to `<dir>/results/<id>.json`
via `store.ts`'s **`mergeRunResult`**. That function deliberately **replaces `light` outright** with
the deep audit's own fresh light probe — see its own doc comment: "a deliberate full audit run is
as trustworthy as a light check gets." That's the right behavior for a standalone `cli run` (what
`self-test` does, and what a human running `run --ids <id> --out /tmp/o` locally gets).

**WP3.6's `merge` command is a different code path with different, explicitly-specified semantics**
(IMPLEMENTATION.md WP3.6 step 2, read it again before writing `merge.ts`): it folds a *batch* of
`cli run`'s scratch output (`out/results/*.json`, produced by a shard in `audit.yml`, WP3.7) into
the *existing* `data/results/<id>.json` — and it explicitly says **"keep `light` and `history` from
`data/`"**, replacing only `deep`/`score`/`status`/`issues`, then appending *today's* history entry
with the new score. That's the opposite of what `mergeRunResult` does with `light`. The reason
this matters: `data/`'s `light` is kept fresh by the periodic 6-hourly `uptime.yml` pipeline
(WP2.3) independent of deep audits; a deep-audit batch can take 45–70 minutes across 6 shards
(DESIGN §5.2), and overwriting `data/`'s `light` with whatever a shard's own probe saw at whatever
moment it happened to run would make `data/`'s "current status" field less current, not more.

**Practical upshot:** don't reach for `mergeRunResult` inside `merge.ts` expecting it to already do
what WP3.6 wants — it doesn't, on purpose. WP3.6 will need its own merge function (in `store.ts`,
next to `mergeRunResult`/`mergeErrorResult`, following the same pattern) that takes the *existing*
`data/` record and a *freshly-run* `out/` record and produces a result keeping `light`/`history`
from the former and `deep`/`score`/`issues` from the latter (plus the new history entry). Give it
its own name (`mergeMergedDeepResult`? `foldDeepAuditIntoData`? — WP3.6's own call) rather than
overloading `mergeRunResult`'s name/behavior, since the two are genuinely different operations used
in different places (`cli run` vs `cli merge`) and conflating them would silently break one path
while "fixing" the other.

## Other things worth knowing before starting WP3.6

- **`DeepResult`/`ScoreBreakdown`/`Issue`/`CheckResult[]` are real types now** (`audit/src/store.ts`,
  `audit/src/score.ts`, `audit/src/checks/types.ts`) — `Result.deep`/`score`/`issues` widened this
  session from Phase 2's placeholder `null`/`null`/`[]` literal types to their real DESIGN §5.5
  shapes. `summary.ts`'s `deep_at`/median-per-group were also fixed to actually read them (they'd
  been hardcoded `null` since WP2.4, with a comment saying "once Phase 3 exists" — it does now).
- **Screenshot phash gating (ADR-017) is implemented in `runner.ts`'s `buildScreenshot`**, not yet
  in a `merge`-level check — it currently gates whether `cli run` itself bothers writing fresh
  WebP buffers at all (comparing against whatever `existing.deep.screenshot.phash` it was handed).
  WP3.6's own merge step 2 also mentions "copy only if no existing file or aHash Hamming distance >
  10" — re-read that against what's already in `runner.ts` before duplicating the gate; they may
  need to compose (a shard's own `cli run` doesn't know what's in `data/`, only what it was handed
  as `existing`, so `merge.ts` might still need its own copy-or-skip decision for the *screenshot
  files themselves*, separate from the phash comparison `runner.ts` already does for the *record*).
- **`cli run`'s live-audit safety gate** (`audit/src/cli.ts`, mirrors `--resolve`'s own bound):
  refuses `--all` or `--ids` of more than 3 real sites outside `GITHUB_ACTIONS=true`, exempting any
  `--fixture-base` run. WP3.6/3.7 will run inside Actions so this won't block them, but a human
  testing `plan`/`merge` locally against real registry ids should remember the same ≤3 cap CLAUDE.md
  already documents for `run`.
- **Lighthouse 13.x has renamed some audits** since IMPLEMENTATION.md §A.7 was written —
  confirmed live this session: `tap-targets` → `target-size` (now grouped under the accessibility
  category, not performance — doesn't matter, `lhr.audits` is flat), `uses-optimized-images` →
  `image-delivery-insight`. Already fixed in `audit/src/lighthouse.ts` with a comment. If another
  Lighthouse audit id used anywhere turns out to be stale, the fix pattern is the same: check
  `require('lighthouse/core/config/default-config.js').default.categories` for the current id.
- **The fixture self-test runs entirely over plain HTTP** (`audit/src/fixture-server.ts`, 8 sites
  under `tests/fixtures/sites/`) — no TLS setup for local test pages, so `sec.https`/`sec.cert_valid`
  fail identically for every fixture, pushing every fixture's status to `broken`. This is
  deliberate and documented in `self-test.ts`'s own comment; it has no bearing on real audits
  (always against a site's actual HTTPS). Don't "fix" this by adding a self-signed cert unless a
  real need for it shows up — it was a deliberate scope cut given the added TLS-plumbing cost
  across Playwright/undici would touch already-stable Phase 2 code for a testing-only concern.
- **`*.localhost` subdomains resolve to loopback with zero setup** on both this Mac and (per common
  Ubuntu-runner behaviour) GitHub Actions — confirmed empirically this session via `dns.lookup`.
  `runner.ts`'s `withFixtureBase(url, base)` reattaches the fixture server's real ephemeral port to
  a registry entry's placeholder `http://<label>.localhost/` URL at self-test time.
- **`verifier` mutation-tested every new pure-logic file this session** (`crawl.ts`, `capture.ts`'s
  pure exports, `lighthouse.ts`'s `summarize`, `screenshot.ts`, `checks/a11y.ts`, `checks/perf.ts`,
  the 4 new `content.*` checks, `store.ts`'s `mergeRunResult`/`mergeErrorResult`, `runner.ts`'s
  `withFixtureBase`/`buildTech`, `fixture-server.ts`) and found 8 real gaps, all fixed — see the
  WP3.5 STATE.md entry for the full list. 923 tests total.
- **Phase 3's `explainer` readability pass is still deferred to WP3.7** (the last WP in the phase),
  per CLAUDE.md's phase-boundary-only convention — don't run it for WP3.6 either, same as WP3.4/3.5
  didn't.

## Where to actually start

1. `cd /Users/hashin/Documents/GitHub/kerala-web-watch`
2. Read `CLAUDE.md`, then `docs/STATE.md`'s **Now** section and the WP3.5 handoff entry (top of the
   Handoff log) — this file is a supplement to that, not a replacement.
3. `grep -n "^### WP3.6" docs/IMPLEMENTATION.md` then read that section in full (it's short), plus
   its own Read-first list from `docs/DESIGN.md` (§6.2's algorithm — implement it exactly, DESIGN
   says so directly) and `docs/DECISIONS.md`'s ADR-004/ADR-016/ADR-017.
4. Come back to the **merge's semantics differ from `cli run`'s own write path** section above
   before writing `merge.ts` — it's the one thing in this WP most likely to go subtly wrong if
   skipped.
