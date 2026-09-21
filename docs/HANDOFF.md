# Session handoff — 2026-09-21, end of WP3.4

_This is a one-time, detailed supplement to `docs/STATE.md`'s normal terse handoff log, written because
a lot of interpretive ground was covered across WP3.1–3.4 in a single session and the next WP (3.5) is
the one that has to make good on almost every forward-looking decision made along the way. Read this
**in addition to**, not instead of, the normal session-start order in `CLAUDE.md` (CLAUDE.md →
`docs/STATE.md` → `docs/DECISIONS.md` → the current WP in `docs/IMPLEMENTATION.md` → the `docs/DESIGN.md`
sections that WP lists). This file is not itself part of that read order and won't be kept up to date —
treat it as a snapshot, not a living document. Delete it once WP3.5 is done and its content is stale._

## Where things stand

Phase 3 (deep audits) is under way. WP3.1 through WP3.4 are done, tested, mutation-verified, committed,
and pushed to `main`. WP3.5 (the Playwright runner) is next and is the largest remaining WP in the
phase — nearly everything built so far is scaffolding waiting for it.

Commits, newest first: `9fc22bb` (docs, WP3.4) · `f72501c` (feat, WP3.4) · `7616c12` (docs, WP3.3) ·
`2035977` (feat, WP3.3) · `fbc58f3` (docs, WP3.2) · `8288a64` (feat, WP3.2) · `aae586d` (docs, WP3.1) ·
`809d32b` (feat, WP3.1). `docs/STATE.md`'s Handoff log has a full-length entry for each of these — this
document exists to pull the cross-cutting threads together in one place rather than duplicate them.

The check framework now has **62 of 84** check ids actually implemented (the rest report `na` via
`runChecks`'s fallback): 11 `avail.*`, 10 `id.*`, 14 `sec.*`, 11 `content.*`, 16 `gigw.*`. The
unimplemented 22 are: all 11 `a11y.*`, all 7 `perf.*`, and `content.broken_links`/`broken_pdfs`/
`broken_images`/`console_errors` — every one of them needs a real browser (axe-core, Lighthouse, a
crawl, or captured console output), which is exactly what WP3.5 builds.

## The one thing WP3.5 must get right: `CheckContext`'s optional fields

`audit/src/checks/types.ts`'s `CheckContext` has grown a field at a time across WP3.1–3.4, each with a
comment saying who populates it and who reads it. This is the actual interface contract WP3.5's runner
has to satisfy. Reading the comments in the file is a start, but here's the consolidated picture,
because several of these interact in non-obvious ways:

| Field | Type | Populated by | Read by |
|---|---|---|---|
| `site`, `light` | required | already exist (Phase 2) | everything |
| `html` | `string?` | fetch the homepage | most `avail.*`, most `content.*`, most `gigw.*`, `id.canonical`/`charset_doctype`/`tech` |
| `text` | `string?` | Playwright's rendered visible text | preferred over `html`→`visibleText()` fallback everywhere it's optional (see `checks/text.ts`) |
| `headers` | `Record<string,string>?` | the full raw response header dict | all `sec.*` header checks (hsts/csp/xfo/xcto/referrer/server_banner) — **deliberately separate from `light.headers`'s booleans**, see below |
| `status`, `finalUrl` | `number?`/`string?` | the deep-audit's own fetch | `avail.geo_blocked` (status), mixed content's https-gate uses `light.final_url` instead — pick one convention when wiring both up, don't leave two sources of truth |
| `cssTexts` | `string[]?` | inline `<style>` + linked stylesheet contents | `content.legacy_font` |
| `scriptUrls` | `string[]?` | every `<script src>` on the page | `id.third_party` |
| `consoleErrors` | `string[]?` | Playwright's console listener | not read by anything yet — will back `content.console_errors` |
| `malayalamRatio` | `number?` | `text/malayalam.ts`'s `malayalamRatio(text)` — the runner can just call this itself rather than reinventing it | `content.malayalam` (falls back to computing it live from `text`/`html` if this is absent) |
| `history` | `HistoryEntry[]?` | the site's own stored `Result.history` (already on disk, not a new fetch) | `avail.flapping` |
| `soft404Status` | `number?` | fetch one random nonexistent path | `id.soft_404` |
| `robotsTxt` | `{status,body}?` | fetch `/robots.txt` | `id.robots` |
| `sitemapXmlStatus` | `number?` | fetch `/sitemap.xml` | `id.sitemap_xml` |
| `domainExpiryDays` | `number\|null?` | `net/rdap.ts`'s `domainExpiryDays()`, cached per run | `id.domain_expiry` (skipped by its own `appliesTo` on `.gov.in`/`.nic.in`/`.ac.in`/`.edu.in` domains) |
| `wwwConsistent` | `boolean?` | probe both the `www.` and bare-host variants, check one redirects to the other | `id.www_consistency` |
| `requests` | `{url}[]?` | Playwright's network request log | `sec.mixed_content` (in addition to — not instead of — a static `ctx.html` scan) |
| `vulnerableLibraries` | `{library,version,cve}[]?` | `net/retire.ts`'s `scanForVulnerableLibraries()` against the scripts the page loaded | `sec.vuln_js` |
| `safeBrowsingFlagged` | `boolean?` | `net/safebrowsing.ts`'s `isFlaggedBySafeBrowsing()` — `undefined`/`null` when no `SAFE_BROWSING_KEY`, never coerce that to `false` | `sec.safe_browsing` |

Two things worth internalizing before touching this:

1. **`headers` is not `light.headers`.** Phase 2's `light.ts` already computes a `LightHeaders` object
   (`{hsts, csp, xfo, xcto, referrer, server}` — booleans/one string) as part of the *light* check, for
   the uptime/history pipeline. WP3.3's `sec.*` checks deliberately read a *different*, richer
   `ctx.headers: Record<string,string>` instead, per `IMPLEMENTATION.md` WP3.3's own steps text. When
   WP3.5 wires the runner, populate `ctx.headers` from the deep audit's own fetch response headers
   (lowercased keys, per `getHeader()`'s case-insensitive lookup in `security.ts`) — don't try to reuse
   or convert `light.headers` for this, they're intentionally separate.
2. **`na` is the correct, tested default for every field above until the runner exists.** Every check
   that reads an optional field already returns `na` when it's `undefined` (confirmed by fixture tests
   for each one). This means WP3.5 can be built and landed field-by-field/check-by-check rather than
   all at once — wiring up `robotsTxt` alone will immediately turn `id.robots` from `na` to a real
   pass/fail across every audited site without touching anything else. If it's easier to sequence,
   there is no requirement to populate all fourteen optional fields in one PR.

## Key interpretive decisions made this session (none needed a Proposed ADR — see reasoning)

- **`avail.dns`/`avail.connect`/`avail.status` map to `statusSetting: 'down'`** even though Phase 2 already
  has its own, *different* `down` concept (`status.ts`'s two-consecutive-failed-light-checks rule). These
  are a deep audit's own single observation, credible on its own since a full audit run is far more
  deliberate than a 6-hourly ping. Documented in `types.ts`'s `StatusSetting` comment and `score.ts`'s
  `STATUS_PRIORITY` comment.
- **`sec.https` maps to `statusSetting: 'broken'`.** ADR-005 lists specific "broken" triggers but its own
  text says "status is set by ★ checks (DESIGN §5.3)" — i.e. it delegates to §5.3's ★ marks rather than
  being an exhaustive list. No new ADR needed; the mapping is documented as a `registry.ts` comment.
- **`avail.flapping`'s window is 7 days, not "28 checks."** DESIGN's own text says "down in ≥3 of the
  last 28 light checks (7 days)" — but WP2.2 already made `history` store one entry per calendar day
  (`history.ts`'s `appendHistory`), not one per light-check run (~4/day). 28 checks and 7 days are
  DESIGN's own stated equivalents; given daily-granularity storage, 7 days is the only one that's
  actually instrumentable. This is a technical translation of an already-settled design, not a new
  product decision.
- **`gigw.ownership`'s pattern needed widening** beyond DESIGN's literal `content (owned|maintained|
  provided) by` regex (single verb, directly before "by") to also match chained real-world phrasing like
  "Content Owned, Maintained and Updated by ..." — a bounded-gap regex now, in `text/patterns.ts`. Small
  implementation choice, not a product-level deviation from what counts as "ownership is stated."
- **`content.copyright_year`'s year-extraction is DESIGN's literal regex, unmodified** — "first `20\d\d`
  within 60 characters of a ©/(c)/copyright marker" — even though this means a footer showing a range
  like "© 2019–2026" would report the *older* year. This is what the spec in `dates.ts`'s own steps text
  literally asks for; improving it would be scope creep beyond a settled spec, not a bug fix.
- **`content.favicon` fails outright on a missing `<link rel=icon>`**, while **`gigw.emblem` warns
  (never fails) when its image-heuristic finds nothing.** Different treatment is deliberate: a missing
  favicon `<link>` is a reliable, deterministic signal; an emblem is detected by an `alt`/filename
  heuristic that's inherently prone to false negatives (a real emblem image with no descriptive alt text
  would never match), so absence there is reported as uncertain rather than as a confirmed problem —
  fitting for an Info-severity, informational check.
- **`net/rdap.ts` and `net/safebrowsing.ts` both take a configurable `baseUrl`/`endpoint` option**
  specifically so tests can point them at a local fixture server instead of the real network — this
  is now the established pattern for any future check needing an external network call. `net/retire.ts`
  follows the same idea via `--jsrepo <local-path>`.
- **`retire` is a real, pinned dependency now** (`audit/package.json`, `^5.7.0`), not an ad hoc `npx`
  fetch. `retire.test.ts` runs the actual CLI end-to-end against a hand-crafted local
  `tests/fixtures/retire/jsrepo.json` (NOT the real retire.js central repository, which would require a
  live network fetch during tests) and a *synthetic* `jquery-1.8.3.min.js` fixture containing only a
  version-banner comment — never real third-party source, since this project doesn't download external
  files without asking first. It reports the real public CVE-2012-6708, satisfying WP3.3's Verify text
  without ever touching the network.

## Testing patterns now established (WP3.5 should keep following these)

- **Pure check functions, tested by constructing a `CheckContext` directly** — `site()`/`light()`/`ctx()`
  builder functions at the top of each `tests/<category>.test.ts` file, matching the `Site`/`LightResult`
  shapes exactly (copy these builders rather than re-deriving them; they're duplicated across
  `availability.test.ts`/`identity.test.ts`/`security.test.ts`/`content.test.ts`/`gigw.test.ts` on
  purpose — small, self-contained fixtures beat a shared test-only abstraction here).
- **HTML fixtures live in `tests/fixtures/pages/*.html`**, loaded via `readFileSync` + a local `page()`
  helper. Keep using real, minimal, purpose-built HTML files for anything that needs to look like a
  real page; use inline HTML strings in the test body for narrow, single-assertion cases (both styles
  are used throughout WP3.2–3.4, deliberately — don't feel obligated to always create a fixture file).
- **Every WP so far ended with a `verifier` subagent mutation-testing pass** on the new check-logic
  files specifically (not the whole diff) before committing. It has caught a real, non-obvious gap
  every single time — usually a boundary that was only "passing by coincidence" because no fixture
  actually sat near it, or a wiring/pattern-swap that broad multi-element fixtures couldn't catch. Budget
  for this: expect to add several more tests after the first mutation-testing pass, and manually
  re-verify each fix actually catches its corresponding reintroduced mutation before moving on (the
  established ritual: break it, run the specific test file, confirm red; fix the test; run again,
  confirm green; revert the source mutation; confirm `git diff --stat` on that file is empty).
- **Two `tsc --noEmit` passes** before calling anything done: `-p tsconfig.json` (source) and
  `-p tsconfig.test.json` (source + tests). Both must be silent.
- **A manual `runChecks()`/`scoreSite()` smoke test** via `node -e "import(...)..."` against `dist/`
  after `npm run build`, using a synthetic healthy site and (separately) each WP's own "should trigger
  nothing" fixture (`ok-minimal.html` for WP3.2/3.3, though note it does *not* satisfy WP3.4's new
  `content.*`/`gigw.*` checks — it was never built to; that's expected and correctly reflected in
  `content.test.ts`/`gigw.test.ts`'s own fixture choices).

## Practical notes for whoever (or whichever session) picks up WP3.5

- **Read `docs/IMPLEMENTATION.md` WP3.5 in full before writing code** — it's the largest WP in the
  roadmap and covers Playwright setup, axe-core wiring, Lighthouse invocation, the crawl/link-checking
  logic, screenshot capture, and a **fixture-server smoke test** requirement (per CLAUDE.md's
  never-run-live-audits-at-scale-from-a-dev-machine rule, this WP's own live-verification step almost
  certainly needs to run against a local fixture server, not real government sites, same as WP2.1's
  `light.ts` tests did with `node:http`'s `createServer`).
- **Playwright itself is not yet a dependency.** Adding it (and its browser binary download) is
  presumably an explicit part of this WP — a large native-binary "download," so treat that step with
  the same "explicit permission for downloads" caution the project's safety rules already apply
  elsewhere in this session (asking before vendoring/downloading anything from the internet), even
  though `npx playwright install` is a completely standard, expected step for this kind of project.
- **Don't try to populate every `CheckContext` field in one shot.** As noted above, each field is
  independently gated by its consuming check's own `undefined` → `na` branch, all already tested. Land
  the runner incrementally if that's easier to review — e.g. `html`/`text`/`headers` first (unlocks the
  bulk of `content.*`/`gigw.*`/`sec.*`), then the crawl-dependent fields, then axe/Lighthouse.
- **`a11y.lang`'s logic already exists** (`text/malayalam.ts`'s `langMismatches(ratio, lang)`, tested in
  `malayalam.test.ts`) but is not wired into `CHECK_LIST` yet — WP3.5 just needs to add an `a11y.lang`
  `Check` object that calls it with a real `malayalamRatio` and the page's actual `<html lang>` value.
- **Run the `explainer` subagent before marking Phase 3 (not just this WP) done** — per CLAUDE.md, that
  happens at phase boundaries, not every WP, so it hasn't been run since WP2.5. It'll be due once WP3.7
  (the last WP in Phase 3) lands.
- **Push cadence**: push `main` at WP boundaries, not mid-WP, not batched across several. This was
  followed exactly through WP3.1–3.4 (a `feat` commit + a separate `docs: record ... completion` commit
  + push, per WP) — keep doing that for WP3.5 too, even though it's larger; consider whether it can be
  split into more than one WP-boundary-style checkpoint if it runs long (CLAUDE.md's context-budget
  rule: "if a WP is half done and context is getting long, commit what works, update STATE.md, write
  the handoff note, and stop" — a clean partial WP3.5 landing is entirely consistent with the project's
  own conventions if it comes to that).

## Where to actually start

1. `cd /Users/hashin/Documents/GitHub/kerala-web-watch`
2. Read `CLAUDE.md`, then `docs/STATE.md`'s **Now** section and the WP3.4 handoff entry (top of the
   Handoff log) — this file is a supplement to that, not a replacement.
3. `grep -n "^### WP3.5" docs/IMPLEMENTATION.md` then read that section in full, plus its own
   Read-first list from `docs/DESIGN.md`.
4. Come back to the table above when deciding what each new `CheckContext` field should actually
   contain and which existing check it needs to satisfy.
