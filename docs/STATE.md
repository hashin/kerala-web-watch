# Project state

_This file is the anchor for every session and every context compaction. Keep it short and current.
Update it at the end of every session, even a partial one. Newest handoff at the top of the Handoff log._

## Now

- **Phase:** 4 — Full site
- **Current WP:** WP5.2 done this session; WP5.3 (Malayalam) in progress, paused at its own planned
  stop-and-ask point.
- **Next action:** WP5.3 is stopped waiting on the human's review of a 20-check `ml` translation sample
  (commit `64d1065b`) — spot-check word choice/register there (or ask this session to re-show the diff)
  before the next session translates the remaining ~64 checks the same way and builds the `/ml/` site
  plumbing (`ml.json`, navigation, language toggle) around it. This is the WP's own designed checkpoint,
  not a design deviation — see its **Read first**/spec in `docs/IMPLEMENTATION.md`. WP4.7 (India vantage
  runner) stays blocked/optional on Open question 6 — skip it and come back only if that's answered.
  Separately: the repo still can't open PRs from Actions (Settings → Actions → General → "Allow GitHub
  Actions to create and approve pull requests" is off) — confirmed live this session to block both
  `discover.yml` (WP5.1) and `issue-to-pr.yml` (WP5.2) identically. See Open question 14.
- **Pushes allowed:** yes — to `main` and `data` of github.com/hashin/kerala-web-watch (confirmed 2026-09-19). **Push cadence (refined 2026-09-21): push `main` at work-package boundaries** — not just when asked, and not batched across several WPs either — so progress lands on production regularly enough for the human to review it at https://govwebsite.hashin.me and fold in feedback before more work builds on an unreviewed foundation. See CLAUDE.md's Session end protocol. `data` now pushes automatically every 6h via `uptime.yml` (WP2.3) — no manual action needed for it.
- **Registry size:** 1,501 sites (10 seed + 1,200 LSGIs + 290 WP1.7 curated + 1 dogfood entry, WP4.5's own `kerala-web-watch`) · **Deep-audited:** 299/1,501 (as of the `data` checkout pulled 2026-09-24 for WP4.6's report generation; `kerala-web-watch` itself not yet deep-audited by real CI — see WP4.5's Handoff entry) · **Light-checked:** 1,501/1,501 · **Site live:** yes — https://govwebsite.hashin.me, now showing real status/district/department data, and (as of WP4.1) full deep-audit findings — score ring, category bars, issue cards, screenshots, tech facts, sparkline — on every audited site's own page. As of WP4.5 also has a self-hosted Pagefind search (home page + collapsed header toggle) and a `/ml/` route prefix wired (two pages so far, `home` and `about`, still English text pending WP5.3's translation).
- **Candidates backlog:** ~2,476 fresh, uncurated candidates as of 2026-09-21 (mostly from a new `kerala-gov-in-subdomains` source — see Handoff below), waiting for a WP1.7-style curation pass. Not yet in `registry/sites/`.

## Work packages

| WP | Title | Status | Commit | Notes |
|---|---|---|---|---|
| 0.1 | Repository bootstrap | done | init | includes `.claude/` convention, CNAME, test.yml skeleton |
| 0.2 | Registry schema + reference files + loader + `validate` | done | 2453922 | 21 tests; verifier ran mutation-testing, found 5 undertested rules, all fixed and re-verified |
| 0.3 | CI: test.yml, validate.yml (offline) | done | 8ce8ef6 | verified end-to-end on a real throwaway PR (#1, closed unmerged): broke an id → check failed + comment posted → fixed → check passed + same comment updated in place |
| 0.4 | Astro skeleton + build-deploy.yml + first Pages deploy | done | 40c9d45 | live at govwebsite.hashin.me; 3 follow-up fixes after the first deploy (see handoff) |
| 1.1 | Harvest framework (`scripts/harvest/`) | done | 1f54e54 | 8 tests; verifier found merge-candidates.ts had zero coverage of its own, fixed by extracting `categorize()` |
| 1.2 | Harvest kerala.gov.in directory | done | 017f668 | 300 candidates (45 dept pages' "related links"); 3 already-registered, 40 dup-across-depts, 257 new |
| 1.3 | Harvest goidirectory (Kerala) | done | bcc1044 | goidirectory.gov.in renamed to igod.gov.in; 355 candidates (81 of 436 results have no url); overlap with WP1.2 ~10-13%, well under the 40-70% estimate |
| 1.4 | Harvest lsgkerala.gov.in → lsg-*.yaml (1,200) | done | ffabef5 | exact expected counts (6/87/14/152/941); coordinates from opendatakerala.org, not Wikidata (ADR-023); verifier ran on the new validate.ts test coverage, see handoff |
| 1.5 | Harvest 14 district portals | done | 9ca7531 | 180 candidates across 14 files (2–26/district, homepage-driven not Departments-page-driven, see ADR-024); 28 ignore.yaml entries; combined pipeline (kerala-gov-in + goidirectory + district-*): 835 candidates, 31 already-registered, 202 duplicate-across-sources, 602 new |
| 1.6 | PSUs, statutory bodies, universities (curated) | done | 6bef988 | 143 curated candidates: 50 PSU (target ≥80, see Handoff), 78 statutory/mission (target ≥40), 15 university (target ≥15); 1 confirmed no-website org; combined pipeline now 978 candidates, 31 already-registered, 411 duplicate-across-sources, 536 new |
| 1.7 | Curation pass → registry/sites/*.yaml; live-resolve; stats | done | 8bbff71 | 16 university, 14 district, 50 psu, 38 statutory, 95 agency, 65 directorate = 290 curated; registry 1,210 → 1,500 exactly (Verify gate met); `drafts/` holds only 5 resolved items with notes |
| 2.1 | `light.ts` + tests | done | 4b6d5e0 | dns/tls/http primitives + orchestration; 52 tests incl. a verifier-caught redirect-loop cap and TLS-validity gap, both fixed |
| 2.2 | `cli light`, data-branch writer, history, summary.json | done | 7e43cf1 | 79 tests; verifier found 4 undertested paths (score/deep/issues carry-forward, deep-audit-preserved status, null-district grouping, coverage-ETA batch cap), all fixed and re-verified by hand |
| 2.3 | uptime.yml live | done | 52977b4 | cron running; 2 manual `workflow_dispatch` runs (limit=50, then all 1,500) verified end-to-end; "two consecutive *scheduled* runs" gate closed 2026-09-24 (WP4.6 session) — 6 consecutive scheduled runs 2026-09-23T02:38Z through 2026-09-24T10:50Z all `success`, `gh run list --workflow=uptime.yml` |
| 2.4 | Site v1: home + map + status lists + district pages + light-only site page | done | cf7661d | 1,596 pages in ~2.5s; found & fixed a real WP2.2 bug while dogfooding real data (see handoff); Lighthouse perf 100 on the production build (58 on `astro dev` — checked the wrong server first) |
| 2.5 | validate.yml `--resolve` + PR comment | done | 7a6ceea | 99 tests; verified live with a real throwaway PR (#2, closed unmerged): bogus host failed with a clear row → fixed to a real URL → same comment updated in place, check passed, entry's name shown |
| 3.1 | Check framework, `registry.ts` (all ids, EN), `score.ts` | done | 809d32b | 84 check ids (DESIGN §5.3 catalogues ~90); verifier mutation-tested `score.ts`, found 2 undertested paths (issues category-tiebreak, availability-exclusion), both fixed and re-verified by hand |
| 3.2 | Availability + identity checks + fixtures | done | 8288a64 | 21 checks (11 avail.*, 10 id.*), 571 tests; verifier mutation-tested and found 4 undertested paths (avail.blank boundary, avail.redirect_offsite alias handling, avail.parked pattern coverage, avail.default_page's "It works!" branch), all fixed and re-verified by hand |
| 3.3 | Security checks + retire.js + fixtures | done | 2035977 | 14 sec.* checks, 634 tests; retire.js wired as a real dependency and shells out to its own CLI in a real (offline, fixture-jsrepo) integration test; verifier mutation-tested and found 3 undertested paths (header-lookup case/substring matching, a TLS major-version branch, the shared hadResponse timeout case), all fixed and re-verified by hand |
| 3.4 | Content + GIGW checks (bilingual) + fixtures | done | f72501c | 11 content.* + 16 gigw.* checks (content.broken_*/console_errors deferred to WP3.5's crawler), 792 tests; new `audit/src/text/{dates,malayalam,patterns}.ts`; verifier mutation-tested and found 3 undertested paths (a threshold "passing by coincidence", a short-circuit never actually forced, gigw.* pattern-to-check wiring unverified per-check), all fixed and re-verified by hand |
| 3.5 | Playwright runner: capture, axe, Lighthouse, crawl, screenshots; fixture-server smoke test | done | 77b8181 | 923 tests; verifier mutation-tested 10 new files, found and fixed 8 real gaps across crawl/lighthouse/screenshot/perf/content/store/fixture-server (all boundary conditions or an untested function), all re-verified; all 84 check ids now implemented |
| 3.6 | `plan` scheduler + `merge` (outlinks, phash gating) + tests | done | 8a3659c | 979 tests; verifier mutation-tested and found 2 undertested paths (merge fold's history source, screenshot phash-copy gate's exact threshold boundary), both fixed and re-verified by hand |
| 3.7 | audit.yml live (3 → 50 → cron) | done | ae87b71 (workflow), 97be5e0 + 24d5f02 (two crash fixes), run 35681566429 (clean batch_size=50) | step 3's gate closed 2026-09-24 (WP4.6 session): two consecutive *scheduled*-triggered runs both `success` (35798741908 on 2026-09-22T23:43Z, 35935725599 on 2026-09-23T23:52Z), confirmed via `gh run list --workflow=audit.yml` |
| 4.1 | Full site page | done | 884c89d (25db56a: screenshot-filename fix) | 9 components (ScoreRing, CategoryBars, IssueCard, Sparkline, Screenshot, TechFacts, SiteActions, RelatedSites + reused AvailabilityStrip); found & fixed a real production bug while dogfooding (see Handoff): `runner.ts`'s screenshot filenames were date-only, not per-site, so every site captured the same day shared (and clobbered) the same two `.webp` files — fixed to `<site.id>.webp`, 3 new tests; Lighthouse a11y 100 on a poor and a down site page; verified hijacked/healthy rendering with temporary synthetic data (reverted, not committed) since no live site has either status yet |
| 4.2 | Ministry / department / kind / platform / leaderboard pages | done | 5f63fd7 | `site/src/lib/rollups.ts` (countByStatus, medianScore, failedCheckCounts, percentBroken, platformWideIssues, scoreDelta) + first vitest suite in `site/` (17 tests); new `ministries/index.astro` + `ministries/[ministry].astro`, `kinds/[kind]/[...page].astro`, `platforms/[platform]/[...page].astro`, `leaderboard.astro`; upgraded `departments/[department]/[...page].astro` with a `GroupRollup` (status counts, median, top-3 issues) and fixed it to generate a page for every department, including one with zero sites (`minority`) — previously 404'd, now shows an empty state (this WP's own Verify criterion); `sites/[id].astro` gained the "inherited from platform" note; Lighthouse mobile/4G performance 100 on `/platforms/lsgkerala/` (1,200 members, the largest listing), `/leaderboard/` and `/departments/lsgd/` (ADR-025) |
| 4.3 | Status pages, feeds, static API, data page | done | 97cae21 (+ d6e2ea3 test-fixture fixes) | `api/summary.json`, `api/sites.csv`, `api/all.json` (evidence stripped for gzip-friendly bulk export), `api/sites/<id>.json` (full evidence), `feeds/broken.xml` + `feeds/fixed.xml` (Atom, last 100 transitions via new `allTransitions()`), `/data/` page; new `audit/src/summary.ts` `transitionDay()` helper shared by `recentTransitions`/`allTransitions`, new `site/src/lib/api.ts` pure builders + first `site` API test file; this session picked up verification a prior session had explicitly deferred to a cloud session (commit message said so) and found + fixed two real test-only bugs: `site/tests/api.test.ts` expected a hardcoded URL but its fixture's `result()` override supplied its own auto-generated one, and `audit/tests/summary.test.ts`'s `allTransitions` test had an inverted `up: i < 20` boolean that tested the opposite transition direction from what it claimed to; both fixed, not the implementation — 994 audit + 26 site tests, `astro check` 0/0/0, `astro build` 1665 pages all green |
| 4.4 | Methodology page generated from `registry.ts` | done | 36e4dea | rewrote the pre-Phase-3 placeholder (still said "planned"/"once it exists") into a page generated from `CHECKS`: principles, two tiers, scoring (weights/deductions/thresholds newly exported from `score.ts`), status definitions, vantage/geo-blocking, how to contest, limitations, and all 84 checks grouped by category via new `site/src/lib/methodology.ts` (`checksByCategory`) — never hand-copied; `robots.txt` + `humans.txt` added; verified all 84 ids present in the built HTML and ~10 min reading time (2,030 words), matching the WP's own target; `verifier` mutation-tested the new test file and found one real gap (category-mix-up test only covered 2 of 7 categories), fixed and re-verified by hand |
| 4.5 | Pagefind, i18n scaffold, self-audit ≥ 80 | done | e123288 | `postbuild: pagefind --site dist`, new `PagefindSearch.astro` (home page + collapsed header toggle); `astro.config.mjs` i18n (`en`/`ml`), new `src/i18n/{en,ml}.json` + `t()` + 2 `/ml/` pages (home, about — still `lang="en"`, real English text, since ml.json intentionally isn't translated yet); site added to registry (`kerala-web-watch`, `tags:[self]`), validated + live-resolved; ran the real deep-audit CLI locally and found 3 genuine bugs while dogfooding (KeralaMap dark-mode text-colour override was dead CSS from source order + no safe single text colour for the reddest bucket in either scheme — both fixed with a foreground colour per bucket; `role="img"` wrapping real links — fixed to a plain list; Pagefind's own widget markup failing `label-title-only`/`landmark-unique` — fixed in `PagefindSearch.astro`), plus fixed 13 failing GIGW element checks, `id.canonical`, `id.sitemap_xml`, `content.last_updated`/`gigw.last_updated`; confirmed (not assumed) two permanent, unfixable-here findings — `sec.https` only fails locally via `--fixture-base`'s necessary plain-HTTP (same documented artifact as `self-test.ts`'s own fixtures), and GitHub Pages sends no custom headers at all (`curl -I` against the real live site), so `sec.hsts`/`csp`/`xfo`/`xcto`/`referrer` (non-★, M/L) and `id.gov_domain` (H, correctly — this project isn't `.gov.in`) will always fail; re-scoring the same real check output with only `sec.https` excluded via the actual `scoreSite()` gives **90/healthy, zero ★ failures** — this WP's own bar, met; the local audit run was deliberately not merged into `data/` (see Handoff and open question 12) |
| 4.6 | squash-data.yml, report.yml, issue forms | done | 8c226a8 | new `cli report` (audit/src/report.ts, 12 tests after verifier) recomputes the summary and diffs it against last month's snapshot, read back out of that month's own report frontmatter (no separate cache); `reports` content collection + `/reports/` and `/reports/<month>/` pages; generated and committed the real first report (2026-09) locally rather than via a live dispatch; verifier mutation-tested report.ts, see Handoff; `squash-data.yml`'s own live `workflow_dispatch` verification (force-pushes `data`, creates a public Release) deliberately not run this session — needs the human's explicit go-ahead first, see Open question 13 |
| 4.7 | India vantage runner (optional) | todo | | |
| 5.1 | discover.yml → candidates PR | done | 84dc0929 | `cli discover` (audit/src/discover.ts, 18 tests after verifier) filters `data/outlinks.json` to gov-looking hosts, drops registered/ignored ones, light-checks survivors (`p-limit`-bounded concurrency, not sequential — see Handoff, a real run timed out at 30min sequential), writes `registry/candidates/discovered.yaml` wholesale each run; verified live twice via `workflow_dispatch` against real production data (392 outlink hosts → 138 candidates → 73 reachable) — correctly separates central-gov noise (cea.nic.in, cpcb.gov.in) from real Kerala orgs (bptkerala.in, cee-kerala.org, erckerala.org); PR-opening step itself blocked on a repo setting the human needs to flip — see Open question 14 |
| 5.2 | issue-to-pr.yml | done | 493b2f61 (feat) + a7a7c265 (fix) | new `cli issue-to-pr` (audit/src/issue-to-pr.ts, 26 tests): parses the rendered add-website form body, light-checks the submitted URL, short-circuits with an explanatory issue comment (no PR) for a malformed form/unparseable URL/already-registered host, else appends to `registry/candidates/issues.yaml` (replacing any earlier entry for the same URL); new `.github/workflows/issue-to-pr.yml` writes the untrusted issue body to a file via `actions/github-script`'s context object rather than shell-interpolating it (a real injection-class risk for free citizen text); verifier mutation-tested and found 1 real gap (`toEqual({})` doesn't distinguish `{kind: undefined}` from `{}` in vitest — the "omits a hint key" test couldn't fail no matter what, fixed to `toStrictEqual`); discovered and fixed a real gap while live-verifying: the 5 labels every issue template/workflow references (`add-website`, `registry`, `correction`, `reaudit`, `discovery`) had never actually been created as repo labels, so `gh issue create --label add-website` failed outright and `peter-evans/create-pull-request`'s own `labels: discovery` step would have too — created all 5 live; live-verified with 3 real throwaway issues (#3/#4/#5, all closed after): #3 (kerala.gov.in) correctly recognised as already-registered (`kerala-gov`), no PR opened; #4 (example.com) correctly attempted a PR for a genuinely new candidate but hit the same repo-setting block WP5.1 found (Open question 14) — and that failure silently swallowed the issue comment too, a real bug, fixed with `if: always()`; #5 (example.org) confirmed the fix posts a comment even when the PR step fails |
| 5.3 | Malayalam explanations + UI | in progress | 64d1065b | 20 of 84 checks translated (`title`/`citizen`/`fix`), spanning all 7 categories and weighted toward C/H severity (16 of 28 C/H done); stopped here per the WP's own instruction to get the human's review of the sample before translating the rest and building `/ml/` site plumbing — see STATE.md's Next action |
| 5.4 | Government colleges tier | todo | | |

## Deviations from DESIGN.md

_None yet. Each entry: what, why, ADR number._

## Open questions for the human

1. ~~Public name and URL~~ — decided: govwebsite.hashin.me (ADR-019). Human still has to set DNS + Pages custom domain.
2. Contact email for the User-Agent string and About page. The live `/about/` page now says "not yet set — use a GitHub issue" until this is answered.
3. Should `registry/ministers.yaml` carry minister names or only portfolio labels? (default: portfolios only, ADR-014)
4. ~~Pushes~~ — allowed (confirmed 2026-09-19).
5. Provide `SAFE_BROWSING_KEY` secret? (optional; `sec.safe_browsing` is skipped without it)
6. India self-hosted runner for WP4.7? (optional)
7. **Reverse-IP search for co-hosted sites** — the human asked (2026-09-21) to find other Kerala govt websites sharing an IP with known ones. A real reverse-IP-to-hostnames lookup needs a paid OSINT API (Shodan/Censys/SecurityTrails/ViewDNS); free/keyless services are rate-limited to a handful of queries, useless against the 866 unique resolved IPs already visible in the human-supplied `kerala.gov.in` subdomain-scan CSV (see WP1.x-continued handoff below). Explicitly deferred at the human's instruction rather than run best-effort. Needs: either an API key from the human, or a decision to skip it permanently. The CSV's top shared IPs if this is picked up later: 103.210.72.94 (95 subdomains), 115.124.98.144 (74), 103.10.168.89 (39), 103.135.130.153 (37), 103.241.147.235 (34), 36.255.252.176 (28), 103.10.168.25 (26), 103.133.180.162 (25), 59.92.70.120 (24), 117.193.73.133 (22).
8. ~~WP2.3's "two consecutive scheduled runs succeeded" gate~~ — resolved 2026-09-24 (WP4.6 session): 6
   consecutive scheduled `uptime.yml` runs all `success`. WP2.3 marked `done` in the WP table above.
9. **Real evidence that `avail.geo_blocked`'s signature list is confirmed incomplete for `keralapsc` specifically**
   — WP3.7 step 1's first real deep audit (2026-09-21) returned `down` for `keralapsc.gov.in`, not `unverifiable`.
   A single manual fetch from this session's own (non-CI) network got a normal 200 OK with real page content, so
   the site is genuinely reachable and this `down` is wrong per ADR-007/DESIGN §6.7's charitable principle — but
   the CI-side 403 body is a bare, generic Apache "403 Forbidden" page (202 bytes, no Cloudflare/NIC challenge
   text), which `GEO_BLOCK_SIGNATURES` (`light.ts`) was never designed to catch and, by design ("don't guess more
   patterns ahead of evidence"), shouldn't be guessed at from a content-free signal — a body-text match broad
   enough to catch a bare 403 would false-positive on real, legitimate 403s elsewhere. This is the third
   independent observation of the same behaviour (WP3.5's manual audit, this repo's own prior STATE.md note, and
   now WP3.7's first live run), so it's a real, persistent pattern, not a fluke. No safe code fix exists without
   either a keralapsc-specific override (a registry/status-model change needing its own ADR, not something to
   improvise solo) or DESIGN §6.7's own proposed fix: the India self-hosted runner (open question 6), which would
   give ground truth instead of a guessed pattern. Recommend prioritising open question 6 partly on this evidence.
10. **Pages content staleness, found during WP3.7 step 1 — resolved, just propagation lag.** After the audit merge
    landed, the live site served a stale build (kerala-gov showed "Not yet audited" instead of its fresh
    `needs-work` score) for several minutes, persisting through a clean, solo `workflow_dispatch` rebuild too. A
    background poll confirmed the fresh content (`last-modified: 16:33:49Z`, matching that solo rebuild) eventually
    went live on its own — GitHub Pages' edge network just took a few minutes longer than usual to propagate here,
    not a real bug in `build-deploy.yml` or a lost deployment. This session's rapid-fire `main` pushes did also
    trigger several overlapping `build-deploy.yml` runs racing in the shared `concurrency: {group: pages,
    cancel-in-progress: true}` group, which may have added to the delay, but nothing was actually lost or wrong —
    every rebuild converged on the correct content within minutes. Nothing to fix; noted here only so a future
    session doesn't panic and start debugging `build-deploy.yml` if it sees the same few-minutes lag.
11. **Bookkeeping, not a question for the human — a data-migration follow-up.** WP4.1 fixed a bug where
    `runner.ts` named screenshots by date instead of by site id (see Handoff below), but the ~90 sites
    already deep-audited before the fix still have `deep.screenshot` pointing at the old shared
    `2026-09-21.webp`/`2026-09-22.webp` files, and ADR-017's phash gate won't rename them on its own
    unless that site's homepage happens to look different enough next time. A future session could null
    out `deep.screenshot` for those ~90 records (forcing a fresh, correctly-named capture on their next
    scheduled deep audit) — not done this session since it means hand-editing the bot-managed `data`
    branch mid-WP, which felt like it wanted the human's sign-off first rather than a unilateral call.
12. **Bookkeeping, not a question for the human — WP4.5's self-audit is real but not yet in `data/`.**
    `kerala-web-watch` is now in the registry and was deep-audited locally against a production build
    (`run --ids kerala-web-watch --fixture-base http://localhost:4321`), but that run necessarily goes
    over plain HTTP (no local TLS), so `sec.https` fails and the ★ gate reports the whole site `broken`
    with no numeric score — a known, precedented artifact of `--fixture-base` testing (`self-test.ts`
    documents the identical thing for its own fixtures), not a real defect. Re-scoring the same real
    check output with only that one check excluded, via the actual `scoreSite()` function, gives
    90/healthy — see WP4.5's row above and its Handoff entry for the full reasoning. That local result
    was deliberately **not** merged into `data/`, since doing so would show the live site as falsely
    "broken" from a testing artifact. The real first audit will happen on its own through the normal
    `audit.yml` rolling batch once this deploys and is checked over genuine HTTPS — nothing to do here,
    just don't be surprised if `kerala-web-watch` shows "not yet audited" on the live site for a day or
    two after this lands, same as any other freshly-registered site.
13. **`squash-data.yml`'s own Verify step needs the human's go-ahead before a session runs it for real.**
    WP4.6's IMPLEMENTATION.md text says to verify it by `workflow_dispatch`, but that's a genuinely
    destructive, hard-to-reverse production action — it force-pushes the real `data` branch (rewriting
    its history to one commit) and publishes a public GitHub Release — not something to trigger
    unattended the way an ordinary `uptime.yml`/`audit.yml` dispatch is. This session wrote and
    typechecked the workflow but deliberately did not dispatch it. Ask the human before running it the
    first time; after that first confirmed-safe run, later monthly runs are just the cron doing its job.
14. **Repo setting needed: "Allow GitHub Actions to create and approve pull requests."** Confirmed missing
    by a real `workflow_dispatch` of `discover.yml` (run 36003876316, 2026-09-24): `cli discover` itself ran
    correctly end-to-end (392 outlink hosts → 138 candidates → 73 reachable, written to
    `registry/candidates/discovered.yaml`), but the `peter-evans/create-pull-request` step failed outright
    with "GitHub Actions is not permitted to create or approve pull requests." This is a repo Settings →
    Actions → General toggle, not something fixable in code or via this session's token (added to CLAUDE.md's
    "Things only the human can do" list). Blocks `discover.yml` actually landing a PR on its next scheduled
    run. **Confirmed 2026-09-25 (WP5.2 session) to block `issue-to-pr.yml` identically** — a real throwaway
    issue (#4, `example.com`) correctly reached the PR-opening step and hit the exact same error. Worth
    flipping before either workflow can land a real PR; nothing else is blocked on it right now.

## Handoff log

_(newest first; 3–6 lines each: what works, what doesn't, what to do first next time)_

- **2026-09-25 · WP5.3 in progress, paused at its own review checkpoint: Malayalam translation sample** —
  translated `title`/`citizen`/`fix` for 20 of 84 checks in `audit/src/checks/registry.ts` (one JS script,
  `tsLit()`-escaped, applied all 60 field edits atomically rather than 60 manual edits — see commit
  `64d1065b`'s list of which 20). Picked for spread across all 7 categories, weighted toward C/H severity.
  `tsc --noEmit` clean, `registry-metadata.test.ts`/`registry.test.ts` (371 tests) still green — that test
  only checks `ml` is a string, not that it's non-empty, so it doesn't need touching yet. Deliberately
  stopped here, per the WP's own text ("ask the human to review a sample of 20 before translating all"):
  did not touch `ml.json`, `/ml/` navigation, the language toggle, or the remaining 64 checks. **Next
  session starts by getting the human's actual review** (word choice, register, whether Latin-script
  technical terms read right) before continuing — don't just assume it's fine and barrel ahead.

- **2026-09-25 · WP5.2 done: `issue-to-pr.yml`, `cli issue-to-pr`** — new `audit/src/issue-to-pr.ts` (26
  tests, verifier found and fixed 1 real gap — see WP table row) turns an add-website issue into a candidate
  entry in `registry/candidates/issues.yaml`, or a plain-language comment explaining why not (malformed,
  bad URL, already registered). Live-verified with 3 real throwaway issues against production: found and
  fixed two real bugs along the way — 5 missing repo labels (`add-website`/`registry`/`correction`/`reaudit`/
  `discovery` were referenced everywhere but never actually created, now fixed) and a workflow bug where the
  PR step failing outright (not just being skipped) silently ate the issue comment too, fixed with
  `if: always()`. Still blocked on Open question 14 (repo can't open Actions PRs yet) for the actual PR, same
  as `discover.yml` — everything up to that point works. Next: WP5.3 (Malayalam), which has its own built-in
  stop-and-ask point (translate a sample of 20, then ask the human before doing the rest).

- **2026-09-24 · WP5.1 done: `discover.yml`, `cli discover`** — continued straight from WP4.6 in the same
  session. `audit/src/discover.ts`'s pure half (`looksLikeKeralaGovHost`, `filterCandidateHosts`,
  `registeredHosts`, `isIgnoredHost`, `newCandidateHosts`) is offline and got 100% real-data sanity-checked
  (392 real outlink hosts → 138 candidates, correctly keeping `.gov.in`/`.nic.in`/`.ac.in` domains and
  Kerala-mentioning ones, correctly excluding anything already in the 1,501-site registry). First real
  `workflow_dispatch` (36000257060) hit a genuine design bug: `discoverCandidates` light-checked hosts
  strictly sequentially with a 1s gap (copying `resolve.ts`'s pattern for its own much smaller PR-review
  batches), which timed out a 30-minute CI job against 138 real hosts. Fixed by switching to `p-limit`-bounded
  concurrency (default 6, same mechanism `cli light --all` already uses) — CLAUDE.md's ≤1 req/s politeness
  rule is stated *per host*, and discovery only ever sends one request per host per run, so concurrent
  *different* hosts never violates it. Rewrote the resulting two timing tests as concurrency proofs (2 slow
  hosts finish in ~1x the delay at concurrency 2, ~2x at concurrency 1) rather than deleting coverage.
  Second real dispatch (36003876316) finished in 7m54s, well inside the new 45-minute timeout, and correctly
  found 73 reachable candidates — but failed at the very last step: this repo doesn't have "Allow GitHub
  Actions to create and approve pull requests" enabled, so `peter-evans/create-pull-request` can't actually
  open the PR yet. Not fixable from a session (see Open question 14 and CLAUDE.md's human-only list) — the
  discovery pipeline itself is proven correct and complete; only the last mile needs the human. `verifier` ran
  on `discover.test.ts` before the concurrency fix and found one real gap (candidate name falls back to the
  host when a fetched homepage has no `<title>` tag), fixed in the test file only. 1,024 audit tests, all
  green; `astro build`/site untouched this WP (no site-facing change).

- **2026-09-24 · WP4.6 done: `squash-data.yml`, `report.yml`, `cli report`, issue forms — plus WP2.3/WP3.7's
  long-open gates both closed.** New `audit/src/report.ts` (12 tests after `verifier`'s pass, see below):
  `buildReportData` recomputes the summary fresh (never trusts a stale `summary.json`, same principle as
  site's own `getSummary`), ranks best/worst-5 deep-audited sites (ties broken by id), and diffs against
  last month's numbers — read back out of *that month's own report file's frontmatter* via
  `readPreviousSnapshot`/`parseSnapshot`, not a separate cache, so there's exactly one place month-over-
  month state lives. `verifier` mutation-tested it and found 3 real gaps, all fixed in the test file only
  (`report.ts` itself untouched): tie-break-by-id had no coverage, the 5-item best/worst cap had no
  fixture with >2 scored sites to actually exercise it, and — the one that mattered most, given ADR-026's
  "plain language always" rule — the citizen-facing "up"/"down" wording in the delta summary had *zero*
  test calling `renderReportMarkdown` with real deltas, so an inverted direction word (telling citizens
  things got better when they got worse) would have shipped silently. New `reports` content collection
  (`site/src/content.config.ts`, first collection in this project) + `/reports/` index and
  `/reports/<month>/` pages, linked from the header nav and `/data/`'s "Monthly archives" section.
  `squash-data.yml` and `report.yml` workflows written and typechecked but **not dispatched live this
  session** — squash-data force-pushes the real `data` branch and publishes a public Release, a
  genuinely destructive, hard-to-reverse action that needs the human's explicit go-ahead first (Open
  question 13); report.yml's own commit-to-main was instead exercised locally (`cli report` run for
  real against a freshly-pulled `data` checkout, output committed as this session's real first report,
  `site/src/content/reports/2026-09.md`). Also, opportunistically, while reading Actions history for an
  unrelated reason: found WP2.3's and WP3.7's "two consecutive scheduled runs" done-when gates had both
  quietly passed calendar time and succeeded since the last session — marked both fully `done`. One
  gotcha hit and fixed: this session's local `data` worktree was 2 days stale (last synced 2026-09-22)
  from a *previous* session, which would have made the first report understate `deep_audited` by 3x
  (97 vs the real 299) — caught by comparing against `git fetch origin data`, fast-forwarded, regenerated
  the report with real numbers before committing. `astro check`: 0 errors, 0 warnings, 17 hints (all
  `'z' is deprecated' ts(6385)` notices from `astro:content`'s own zod re-export — a known upstream
  cosmetic quirk, not from this project's schema). 1006 audit tests (994 + `report.test.ts`'s 12, after
  `verifier`'s pass), 35 site tests, `astro build` 1670 pages, all green.

- **2026-09-24 · WP4.5 done: Pagefind search, i18n scaffold, self-audit** — continued straight from WP4.4
  in the same session. Pagefind wired via its own CLI's `postbuild` step (fully self-hosted, ADR-011 —
  its `pagefind-ui.js`/`.css` are generated into our own `dist/pagefind/`, no CDN); new
  `PagefindSearch.astro` used on the home page (inline) and sitewide in the header (behind a `<details>`
  toggle, so the ~1,668-page build doesn't load search JS/WASM on every page view) — verified against a
  real `astro build` + `astro preview` (not `astro dev`, which has no index) that searching a Malayalam
  district name returns the right page with the term highlighted. i18n scaffold: `astro.config.mjs`'s
  `i18n` block, `src/i18n/{en,ml}.json` + `t()`, two `/ml/` pages (home, about) — both stay `lang="en"`
  on purpose since `ml.json` is still literal English text (WP5.3 translates; this WP only wires the
  routing and lookup), and marking English text `lang="ml"` would itself fail `a11y.lang`. Registered
  the site itself (`kerala-web-watch`, `tags:[self]`), validated + live-resolved (real network check,
  1 site, well under the ≤3 local-live-run cap).
  **Ran the real deep-audit CLI locally and found three genuine bugs while dogfooding, not testing
  artifacts:** (1) `KeralaMap.astro`'s dark-mode text-colour override was dead CSS — a later,
  unconditional `.kerala-map__row { color: #14181f }` rule always won on source order regardless of the
  media query, so every district link failed WCAG contrast in dark mode, and separately the reddest
  bucket had no single text colour safe in *either* scheme — fixed with a computed foreground colour per
  bucket (verified against the real hex pairs with the WCAG contrast formula, not eyeballed); (2) the
  map's `role="img"` wrapped real interactive `<a>` links (axe's `nested-interactive`) — replaced with a
  plain `<ul>`/`<li>` list; (3) Pagefind's own default-UI markup fails `label-title-only` (its `<input>`
  has only a `title` attribute) and, once a page has two widget instances, `landmark-unique` (both
  instances share one fixed `aria-label`) — both fixed inside `PagefindSearch.astro` post-mount, without
  forking the widget. All three confirmed fixed with axe-core re-run directly against the built page (0
  violations), not just inferred from the code change.
  Also fixed 13 failing GIGW element checks (Layout.astro's footer gained genuine
  Contact/Feedback/Sitemap/Privacy/Terms/Copyright/Hyperlinking/Disclaimer/Accessibility/Screen-reader/
  Help/RTI links plus an ownership statement, each backed by real content on `about.astro` — including an
  honest RTI section explaining the Act doesn't apply to a non-government project, rather than gaming the
  pattern-match with empty text), a missing "last updated" date, `id.canonical` (now emitted per page),
  and `id.sitemap_xml` (`public/sitemap.xml`, a valid sitemap index pointing at the real
  `sitemap-index.xml` — Astro's sitemap integration never emits that literal filename itself).
  **Two findings confirmed permanent and unfixable here, not assumed:** `sec.https` fails locally only
  because `--fixture-base` necessarily tests over plain HTTP (`self-test.ts` already documents this exact
  artifact for its own fixtures — this isn't new); `curl -I https://govwebsite.hashin.me/` against the
  real live site came back with no `Strict-Transport-Security`/`Content-Security-Policy`/
  `X-Frame-Options`/`X-Content-Type-Options`/`Referrer-Policy` at all — GitHub Pages has no mechanism to
  set custom response headers, so those five checks (all non-★, M/L severity) and `id.gov_domain` (H,
  correctly — this project's domain genuinely isn't `.gov.in`) will always fail on this host. Re-scoring
  the real check output with only the one confirmed fixture artifact (`sec.https`) excluded, via the
  actual `scoreSite()` function (not a guess), gives **90/healthy, zero ★ failures** — this WP's own
  "score ≥ 80, no ★ failures" bar, genuinely met. The local audit run itself was deliberately **not**
  merged into `data/` — doing so would show the live site as falsely "broken" from a testing artifact;
  the real first audit happens through the normal `audit.yml` rolling batch once this deploys (see Open
  question 12). 994 audit tests, 35 site tests (4 new, `i18n.test.ts`), `astro check` 0/0/0, `astro
  build` 1668 pages + Pagefind index, all green. One honest test-coverage note: `i18n.test.ts`'s en/ml
  lookup tests can't currently distinguish a locale-swap bug from correct behaviour, since `ml.json`'s
  values are still identical to `en.json`'s by design — confirmed by deliberately swapping the two
  dictionaries and re-running the suite (all 4 tests stayed green); not a fixable gap today, but worth
  re-checking once WP5.3 gives the two dictionaries genuinely different values. Commit `e123288`.
  **Next: WP4.6** (`squash-data.yml`, `report.yml`, issue forms).

- **2026-09-24 · WP4.4 done: methodology page generated from `registry.ts`** — continued straight from
  WP4.3 in the same session (context still had headroom). Replaced the pre-Phase-3 placeholder
  `methodology.astro` (dated language: "planned every 6 hours", "once it exists" — written before any
  checks existed) with a page built from the real `CHECKS` registry: principles, the two check tiers,
  a scoring section (category weights, per-severity deductions, healthy/needs-work/poor thresholds —
  `audit/src/score.ts`'s `WEIGHTS`/`FAIL_DEDUCTION` were private consts, now exported alongside two new
  named constants `HEALTHY_THRESHOLD`/`NEEDS_WORK_THRESHOLD` so the page states real current values, not
  a second hand-copied set of numbers), status definitions (reused `HealthBadge`), vantage-point/geo-
  blocking explanation, how to contest a finding, limitations, and a full catalogue of all 84 checks
  grouped by category (Check/Severity/Sets status/Reference) — via new `site/src/lib/methodology.ts`'s
  `checksByCategory()`, a pure function so the WP's own Verify criterion ("every id in CHECKS appears on
  the page") is a real test, not an eyeball check. Also added `site/public/robots.txt` (points at the
  existing sitemap) and `site/public/humans.txt`. Verified beyond the test suite: grepped the *built*
  HTML for all 84 real check ids (confirmed present, not just asserted against a fixture) and measured
  the rendered page at ~2,030 words (~10 min reading time — the WP's explicit "10 min, not 40" target);
  screenshotted the live dev-server page to confirm the scoring tables and category catalogue actually
  render as designed. Ran the `verifier` subagent per convention (this WP added tests) — it mutation-
  tested `site/tests/methodology.test.ts` and found one real gap: the "groups checks under their own
  category" test only exercised security/accessibility, so a content&harr;gigw category mix-up (the
  check would still appear on the page, just under the wrong heading) would have shipped silently;
  fixed by adding a test covering all seven categories, confirmed by hand that it now catches that exact
  injected mutation, then reverted the mutation. Full suite: 994 audit tests, 31 site tests, `astro
  check` 0/0/0, `astro build` 1665 pages, all green. Commit `36e4dea`. **Next: WP4.5** (Pagefind search,
  i18n scaffold `defaultLocale: 'en'`/`locales: ['en','ml']`, add the site itself to the registry as a
  dogfood entry, and self-audit it to ≥ 80 with no ★ failures).

- **2026-09-24 · WP4.3 closed out (verification only)** — the feature itself (`api/*`, `feeds/*.xml`,
  `/data/`, `allTransitions()`) was written and committed by a prior session (`97cae21`) that explicitly
  deferred its test run to a cloud session because the local sandbox was too slow (a plain `tsc` build alone
  took ~20 min). This session ran that deferred verification and found two real bugs, both in tests, not
  the implementation: `site/tests/api.test.ts`'s `sitesToCsv` test expected a hardcoded URL but its
  `site()`/`result()` fixture builder auto-generates its own URL once a full `result()` override is passed,
  so it silently returned the wrong value (added an explicit `url:` override); `audit/tests/summary.test.ts`'s
  `allTransitions` test constructed history with an inverted `up: i < 20` boolean, which actually encoded an
  up-transition while the test claimed (and asserted) a down-transition — CI's `Test` workflow had already
  failed on `main` for this (`push` run 35864919498) since 2026-09-23, unnoticed until now. Also hit two
  environment-only flakes worth noting so a future session doesn't chase them: a `sharp`/libvips
  `Unknown system error -70` in `runner-screenshot-filename.test.ts` under the full 991-test parallel run
  (passed clean in isolation, passed clean on re-run — a transient macOS sandbox IO glitch, not a real bug),
  and a `vitest-pool-runner` worker-timeout on the first `site` test attempt (passed clean on retry). Full
  local verification now green: 994 audit tests, 26 site tests, `astro check` (0/0/0, 47 files), `astro
  build` (1665 pages, ~75 min in this sandbox — do not read into that wall-clock number, it's this specific
  sandboxed environment, not representative of CI or a normal dev machine). Commit `d6e2ea3`. **Next: WP4.4**
  (methodology page generated from `registry.ts`, per DESIGN and `audit/src/checks/registry.ts`'s own
  "single source of truth for citizen-facing check explanations" convention).

- **2026-09-22 · WP4.2 done: ministry/department/kind/platform/leaderboard pages** — continued straight
  from WP4.1 in the same session (context budget still had headroom). New `site/src/lib/rollups.ts`
  (`countByStatus`, `medianScore`, `failedCheckCounts`, `percentBroken`, `platformWideIssues`, `scoreDelta`)
  with `site`'s first-ever vitest suite (17 tests, `site/tests/rollups.test.ts`) — wired up `site/package.json`'s
  `test`/`pretest` scripts and `vitest.config.ts` matching `audit/`'s own convention; `.github/workflows/test.yml`
  needed no change, its `site` job already runs `npm test --if-present`. New pages: `/ministries/` (portfolio
  cards with health %), `/ministries/<id>/` (departments -> each department's own already-paginated page,
  deliberately not a second full site table, since `lsgd`'s alone is 1,200+ sites), `/kinds/<kind>/[...page]`,
  `/platforms/<platform>/[...page]` (shows platform-wide issues -- checks failing on >=80% of deep-audited
  members -- above a `GroupRollup` + paginated member table), `/leaderboard/` (departments and districts
  ranked by %-broken then median score, plus a "most improved" 30-day-delta section that's empty right now
  since deep-audit history doesn't go back that far yet -- correctly renders nothing rather than an empty
  heading). New shared `GroupRollup.astro` (status-count badges, median, top-3 issues) used by departments/
  kinds/platforms. **Found and fixed a second real bug while building this**: `/departments/<id>/`'s
  `getStaticPaths` skipped any department with zero sites entirely (`if (rows.length === 0) return []`), so
  `minority` (Minority Welfare, currently 0 sites) 404'd instead of showing an empty state -- exactly what
  this WP's own Verify bullet asks for, so worth being extra sure it's covered: fixed to always `paginate()`
  every department, `GroupRollup` renders "No sites tracked here yet." for the empty case. Also added the
  "inherited from platform" note to `sites/[id].astro` (checked live on `lsg-gp-azhiyur`, which shares 31
  issues with the rest of `lsgkerala`) and refreshed the homepage's stale "Ministry/department/kind browsing
  arrive in a later phase" copy + Phase-2-only intro paragraph, now that they exist. Verified: `audit` 991
  tests green, `site` 17 tests green, `astro check` clean, full build (1,664 pages), Lighthouse mobile/
  simulated-4G performance **100** on `/platforms/lsgkerala/` (1,200 members, the largest listing page in the
  whole site), `/leaderboard/` and `/departments/lsgd/` (ADR-025's own per-listing-page Lighthouse
  requirement). **Next time:** WP4.3 (status pages upgrade, feeds, static API, `/data/`). Separately, keep an
  eye on WP3.7's cron gate.

- **2026-09-22 · WP4.1 done: full site page** — session started by checking WP3.7's cron gate (not
  ready yet — no `schedule`-triggered `audit.yml` run has fired since the crash fixes landed, still
  daytime; don't force it) and moved to WP4.1 rather than sit idle. Built all 9 anatomy parts (DESIGN
  §7.3): `ScoreRing`, `CategoryBars`, `IssueCard`, `Sparkline`, `Screenshot` (checkbox-hack mobile
  toggle, no JS), `TechFacts`, `SiteActions` (correction/re-audit issue links, JSON link, Share via
  `navigator.share`/clipboard), `RelatedSites`, breadcrumbs (ministry as plain text — no `/ministries/`
  page until WP4.2, same "acceptable for one WP" precedent as the JSON link 404ing until WP4.3).
  Screenshots are copied from `../data/screenshots` into `site/public/screenshots/` by a new
  `site/scripts/copy-screenshots.mjs`, wired into `predev`/`prebuild` (no-ops if `data/` is absent).
  **Found and fixed a real production bug while dogfooding real deep-audit data**: `runner.ts`'s
  `buildScreenshot` named screenshots `${today}.webp` — the *date*, not the site — so every site
  captured on the same calendar day shared (and silently overwrote) the same two files; confirmed
  live on `aepds`'s page, which was showing `kerala-gov`'s Tenders-portal screenshot. Fixed to
  `${site.id}.webp` (matches DESIGN §5.5's own `keralapsc.webp` example, which the original code had
  drifted from), exported `buildScreenshot`/`ScreenshotOutcome` for testing, added 3 regression tests
  (`runner-screenshot-filename.test.ts`). **Known follow-up, not done this session**: the ~90 already
  deep-audited sites' stored records still point at the old shared date-named files — the phash gate
  only replaces a screenshot when the visual hash actually moves, so a site whose homepage doesn't
  change won't self-heal to the new per-site filename on its own. Not touched this session (didn't
  want to hand-edit the bot-managed `data` branch mid-WP without the human's sign-off); a future
  session could null out `deep.screenshot` for the affected sites to force a fresh capture next audit.
  Verified: `audit`'s 991 tests green, `site`'s `astro check` clean, full `astro build` (1,595 pages),
  Lighthouse a11y **100** on a `poor` (`aepds`) and a `down`-with-errored-audit (`d-alappuzha`) page.
  No live site is currently `healthy` or `hijacked`, so those two branches (unlinked red URL text for
  hijacked; full score ring + collapsed "N checks passed" for healthy) were verified with temporary
  synthetic `data/results/*.json` edits on two real, currently-unaudited registry sites, screenshotted,
  then reverted with `git checkout` before finishing (never committed). Also caught and fixed a real
  UX bug of my own along the way: a `deep.error` (audit attempt that never finished, e.g. a timeout)
  was rendering "No issues found in the most recent audit" — misleadingly implying a clean bill of
  health — now shows a distinct amber notice explaining the audit didn't complete.
  **Next time:** WP4.2 (ministry/department/kind/platform/leaderboard pages, `site/src/lib/rollups.ts`
  with vitest — the first tests in `site/`). Separately, keep an eye on WP3.7's cron gate.

- **2026-09-22 · WP3.7 step 2 done: a clean, complete `batch_size=50` run** — retry #2 (run
  `35681566429`, with both crash fixes from the entries below in place) succeeded end-to-end: both
  shards completed all 25 of their sites (including `d-alappuzha`, the exact site that crashed both
  prior attempts — this time it just failed gracefully with a plain `page.goto` timeout, recorded
  normally, no crash), merge logged `sites=50`, and `data`'s commit (`33b6128`) triggered a clean
  Pages rebuild. Per-site timing: ~64–70 s/site across both shards (28-ish minutes for 25 sites
  each), consistent with step 1's ~55–65 s/site estimate and comfortably under the 90-min/shard
  budget even at a full 50 — no reason to touch `--max-batch` (300, ADR-004). `summary.json` now
  shows `deep_audited: 97` (cumulative across step 1's 3-site smoke test and every partial/complete
  run since, deduped by site id). Spot-checked live: `/sites/infopark/` and `/sites/kerala-gov/`
  show the right badge; confirmed (not a bug) that neither shows a numeric score or Lighthouse/issue
  detail yet, because WP2.4's site page was explicitly built light-check-only — that richer view is
  WP4.1. **What's left for WP3.7:** only step 3, the two-consecutive-scheduled-runs gate (see Now
  section above) — a real multi-day wait, not something to force in one session.

- **2026-09-21 (later) · WP3.7 step 2, retry #1 crashed again — a *second*, distinct
  unhandled-rejection bug found, fixed and verified; general safety net added** — after the
  `runner.ts` fix below landed and was pushed, retrying `batch_size=50` (run `35631713466`)
  confirmed that fix works exactly as designed (shard 0's crashed job still uploaded its 4 completed
  sites' results via the new `if: always()`, unlike the first attempt's total loss) but the shards
  still crashed: shard 0 hit a *different* signature, `TargetCloseError: Protocol error
  (Target.setAutoAttach): Target closed`, from deep inside `lighthouse/core/gather/driver/
  target-manager.js`'s own CDP session-close handling — a promise created and abandoned entirely
  inside puppeteer-core's internals, which the `lighthousePromise.catch(() => {})` fix cannot reach
  since it's not the same promise. Shard 1 got much further (13 sites) before hitting the *original*
  `Page.navigate: Target closed` signature again, from a different internal Lighthouse promise than
  the one already patched — proving that patching individual internal promises one at a time inside
  a vendored dependency doesn't scale. Fix: a general, last-resort safety net in
  `audit/src/cli.ts`'s `runRun` — `process.on('unhandledRejection', ...)` installed for the duration
  of the batch loop, logging the current site id and the rejection loudly (never silently) and
  relying on Node's own "a listener is registered so don't crash" behavior to keep auditing the rest
  of the batch. Required exporting `runRun` and guarding cli.ts's top-level `process.exit(await
  main())` behind a `process.argv[1] === fileURLToPath(import.meta.url)` check (the standard Node
  ESM "am I the entry module" idiom) so it stays unit-testable — confirmed this doesn't change real
  CLI behavior by grepping every actual invocation (`audit.yml`, `uptime.yml`, `validate.yml`,
  `package.json`'s `self-test` script all run it as `node dist/cli.js <command>`, which still trips
  the guard) and by running `node dist/cli.js validate ...` directly. New regression test
  `audit/tests/cli-run-stray-rejection.test.ts` reproduces a stray, abandoned rejection during one
  site's audit and asserts the batch still finishes both sites and logs the rejection — confirmed by
  hand it fails (both a normal assertion mismatch and vitest's own "Unhandled Errors" report) with
  the fix reverted, passes restored. `cd audit && npm test` (988/988) and `npm run lint` clean.
  (Aside: the `verifier` subagent stalled twice in a row on this specific review with no output —
  a tooling hiccup, not a finding — so this fix was instead verified by hand: build, full suite,
  lint, and an explicit break/restore of the `process.on` line, done twice.) **Not yet done:** the
  retry itself (`batch_size=50` with both fixes in place) hasn't been run yet.

- **2026-09-21 · WP3.7 step 2's crash bug: diagnosed, fixed, verified (see previous session's
  `docs/HANDOFF.md`, now deleted since its content is resolved)** — `audit/src/runner.ts`'s
  `runDeepAudit` created `lighthousePromise` but didn't `await` it until much later inside a
  `Promise.all`; when Lighthouse rejected fast (a closed target) while `capture()` was still
  slow, Node saw an unhandled rejection and killed the whole process, bypassing the function's
  own `try/catch` and losing every site a shard had already audited (confirmed for real: the
  `batch_size=50` run lost 21 successfully-audited sites this way, twice independently across
  two shards). Fix: a no-op `lighthousePromise.catch(() => {})` right after creation, which marks
  it "handled" without changing what the later `await Promise.all(...)` receives. Also added
  `if: always()` to `.github/workflows/audit.yml`'s `upload-artifact` step (mirrored into
  `docs/DESIGN.md` §6.3's own snippet) so a shard that still crashes for some other reason no
  longer discards whatever it finished. New regression test
  `audit/tests/runner-lighthouse-rejection.test.ts` reproduces the exact race with mocked
  dependencies — deliberately plain functions, not `vi.fn()`, since `vi.fn()`'s own internal
  result-tracking attaches a `.then`/`.catch` that silently masks this exact bug (confirmed by
  hand: the `vi.fn()` version of the test passed even with the bug still present). Verified twice
  independently — by hand (revert fix → test fails with the real assertion mismatch; restore →
  passes) and by the `verifier` subagent, which redid the same break/restore itself and confirmed
  the fix's placement, the test's determinism, and `audit.yml`'s `if: always()` condition are all
  correct. `cd audit && npm test` (987/987) and `npm run lint` both clean. **Not yet done:** the
  actual retry of `batch_size=50` hasn't been run yet — that's the literal next action.

- **2026-09-21 · Cross-cutting: ADR-026, plain-language status reasons (not a WP, pushed `4a3053d`
  + `7e59ebf`)** — human instruction, done ahead of WP3.7 since it was already live on production
  and citizen-facing. `HealthBadge` rendered a bare "Down"/"Broken" with no reason on both
  `/sites/<id>/` and `/status/<status>/`, even though `broken` alone covers four unrelated causes.
  `audit/src/status.ts`'s new `explainLightStatus()` mirrors `deriveStatus()`'s own conditions to
  name the exact check id that set the status; `site/src/lib/data.ts`'s `explainStatus()` looks
  there (falling back from a deep audit's `issues[]` once those exist) and renders that check's
  existing `citizen` text (ADR-013) -- never new copy invented in `site/`. Verified against real
  `data/` on both the dev server and a real `astro build` (1,596 pages): `/sites/arckerala/` now
  shows "The address resolves, but nothing answers the connection..." under its Down badge;
  `/status/broken/`'s heading now explains what "broken" covers before listing all 19 sites. Also
  fixed a stale methodology-page paragraph claiming Phase 3 "has not been built yet" while it was
  actively shipping. `docs/DECISIONS.md` (ADR-026), `docs/DESIGN.md` (§5.4, §7.4) and this file's
  own `CLAUDE.md` Non-negotiables now carry the plain-language rule so future WPs (WP4.1's issue
  cards, WP4.4's methodology generation, WP5.3's Malayalam strings) inherit it rather than
  reinventing it. `audit npm test`: 986/986 passing (7 new). WP3.7 is next, unaffected by this.

- **2026-09-21 · WP3.6 done — `cli plan`/`cli merge` and the rolling scheduler** — `scheduler.ts`
  (DESIGN §6.2 tiering/batch-size/sharding), `merge.ts` (folds `cli run`'s `out/` into `data/`),
  `outlinks.ts` (§6.6's discovery feed, recomputed wholesale from every site's current
  `deep.outlinks` -- not accumulated, since an incremental fold can't be idempotent and WP3.6
  requires merging the same `out/` twice to be a no-op), `batches.ts` (`YYYYMMDD-<n>` id
  bookkeeping). Also filled a real gap from WP2.2: `docs/IMPLEMENTATION.md`'s WP2.2 spec always
  called for `mergeLightResult` to set `deep_bump` on a material homepage change (ADR-016), but it
  was never actually wired up -- `store.ts`'s `detectMaterialChange` does that now, since WP3.6's
  forced tier depends on it. `plan --dry-run` runs clean against the real 1,500-site registry (215
  = clamp(ceil(1500/7), 50, 300)); `--site-ids`/`--batch-size`/`$GITHUB_OUTPUT` writing all smoke-
  tested by hand. `verifier` mutation-tested everything and found 2 real gaps -- the merge fold
  threading a shard's own single-entry history through instead of `data/`'s multi-day history, and
  an unpinned screenshot phash-copy threshold boundary -- both fixed with targeted tests, re-run to
  confirm they now catch the mutation, before committing (`8a3659c`, 979 tests). Neither `cli plan`
  nor `cli merge` has run inside real GitHub Actions yet or touched the real `data` branch -- that's
  WP3.7's job, starting from a 3-site `workflow_dispatch`, not a full batch.

- **2026-09-21 · WP3.5 done — all 84 check ids now implemented** — `audit/src/capture.ts` (one
  Playwright/Chromium session per site: HTML, rendered text, links, inline+linked CSS, script
  bodies, console/page errors, subresource request log, an axe-core pass, desktop+mobile
  screenshots), `lighthouse.ts` (Lighthouse driven through Playwright's own Chromium via
  `chrome-launcher`, mobile/slow-4G profile, 90s cap, never throws -- records `null` on failure per
  ADR-015), `crawl.ts` (same-domain, robots.txt-respecting, 1 req/s, ≤30 pages + ≤20 PDFs,
  HEAD-then-GET fallback for PDFs), `screenshot.ts` (sharp -> WebP q60 + 8x8 aHash, ADR-017's >10
  Hamming-distance replace-only rule), `probes.ts` (robots.txt/sitemap.xml/soft-404/www-consistency
  -- plain HTTP, no browser needed), `checks/a11y.ts` (11 checks) and `checks/perf.ts` (7 checks)
  wired into `CHECK_LIST`, plus `content.broken_links`/`broken_pdfs`/`broken_images`/
  `console_errors` added to `content.ts` -- every one of DESIGN §5.3's ~84 check ids now has a real
  implementation, not just metadata. `runner.ts` orchestrates light -> capture -> Lighthouse ->
  crawl -> the plain-HTTP probes -> `buildContext` -> `runChecks` -> `scoreSite` -> a `DeepResult`,
  catching any uncaught error into `deep.error` with the site's *status* left untouched (WP3.5 step
  5's own spec) rather than ever inferring "broke worse" from a half-finished run. `store.ts`'s
  `Result.deep`/`score`/`issues` widened from their Phase-2 placeholder `null`/`null`/`[]` types to
  the real `DeepResult`/`ScoreBreakdown`/`Issue[]` shapes (a real Phase-3 field going live, not a
  new product decision -- DESIGN §5.5 already specified this shape); new `mergeRunResult` (a deep
  audit's own status is authoritative, unlike a light check's two-strike rule) and `mergeErrorResult`
  (status frozen, previous score/issues/screenshot carried forward). `cli.ts` gained `run`
  (`--ids`/`--all` + `--out`, refuses an unbounded local run outside GitHub Actions the same way
  `--resolve` already does, exempting `--fixture-base` runs since those never touch a real site) and
  `self-test`. **`fixture-server.ts`** (a real `node:http` server, subdomain-routed by
  `<label>.localhost` -- confirmed these resolve to loopback with no `/etc/hosts` edits on both this
  Mac and, going by common CI-runner behaviour, Ubuntu) plus 8 fixture sites under
  `tests/fixtures/sites/` (good/parked/default-apache/blank/legacy-font/no-gigw/mixed-content/
  slow-5xx) and `self-test.ts` (asserts which check ids each fixture's page is built to trigger, and
  that none of those leak into the one clean fixture). **Known, deliberate self-test limitation:**
  every fixture is served over plain HTTP (no TLS setup for local test pages), so `sec.https`/
  `sec.cert_valid` fail identically for all 8 fixtures including the "good" one, which pushes every
  fixture's status to `broken` via the ★-override regardless of what else is true -- harmless and
  fully expected (a real audit always hits a site's actual HTTPS), documented in `self-test.ts`'s own
  comment; self-test therefore asserts on `deep.checks` issue-id membership, not on `status`.
  **Real bug found via the live-site Verify run, not a unit test:** `capture.ts` originally read
  `response.allHeaders()` *after* `context.close()`, throwing "Target page, context or browser has
  been closed" on every single audit -- caught immediately because self-test failed 8/8 with that
  exact error; fixed by reading `finalUrl`/`status`/`headers` before closing the context. **Real,
  version-drift bug also found via the live run:** Lighthouse 13.x renamed the audits
  IMPLEMENTATION.md §A.7 named (`tap-targets` -> `target-size`, `uses-optimized-images` ->
  `image-delivery-insight`) -- `perf.tap_targets`/`perf.images` were silently `na` on every real run
  until this was caught by manually inspecting a live `keralapsc` audit's check results and noticing
  they never fired; fixed in `lighthouse.ts` with a comment explaining the rename, confirmed fixed
  against a second live run (`pass`/`fail` respectively, no longer `na`). **Verified against a real
  site, not just fixtures**, per the WP's own Verify text: `run --ids keralapsc --out /tmp/o`
  produced lighthouse numbers (`{performance:11, accessibility:98, best_practices:69, seo:83}`),
  both screenshots on disk, `crawl: {pages:30, pdfs:6, broken:36}`, `tech: {cms:"Drupal 8"}`, and
  `axe: {serious:2}` -- status came back `down` because keralapsc.gov.in is genuinely returning a
  plain Apache 403 to this dev machine right now (not a bug: `avail.geo_blocked`'s narrow A.9
  signatures correctly declined to guess geo-blocking from an unmarked 403, so it's reported as the
  more honest `down` rather than a falsely-reassuring `unverifiable`). **verifier mutation-tested**
  `crawl.ts`/`capture.ts`/`lighthouse.ts`/`screenshot.ts`/`checks/a11y.ts`/`checks/perf.ts`/the four
  new `content.*` checks/`store.ts`'s two new merge functions/`runner.ts`'s pure helpers/
  `fixture-server.ts` and found 8 real gaps (mostly untested exact-boundary cutoffs -- LCP 4000ms,
  CLS 0.25, weight 3MB/8MB, the `isBroken` 400 boundary -- plus `mergeErrorResult` having *zero*
  tests despite being the function implementing WP3.5's own error-handling contract, and
  `averageHash`/`hammingDistance` only ever being checked by self-/inequality rather than a concrete
  hash value), all fixed with 16 new tests and manually re-verified. 923 tests, `npm run build` and
  `self-test` both clean. **Phase 3's `explainer` readability pass is still due at WP3.7** (Phase 3's
  last WP), not this one -- per CLAUDE.md's phase-boundary-only convention, unchanged from the
  WP3.4 handoff's own note. **Next: WP3.6** (`plan` scheduler + `merge`) -- see the **Next action**
  line above.

- **2026-09-21 · WP3.4 done** — `audit/src/checks/content.ts` (11 checks) and `audit/src/checks/gigw.ts`
  (16 checks), the first bilingual (English + Malayalam) checks. Three new pure-function modules:
  `audit/src/text/dates.ts` (5 date-format parsers, `findLastUpdatedDate`/`findNewestNewsDate`
  proximity searches, `findCopyrightYear` implementing DESIGN's own literal regex verbatim --
  deliberately "first year after a marker", not "latest year in a range", since that's the settled
  spec, not an oversight), `audit/src/text/malayalam.ts` (`malayalamRatio` via `\p{Script=Malayalam}`;
  `langMismatches` is written and tested but NOT wired into any Check yet -- it's prep for WP3.5's
  `a11y.lang`, which needs real rendered text/`<html lang>` from the Playwright runner), and
  `audit/src/text/patterns.ts` (the GIGW element pattern table + `extractInteractiveText()`, which
  scopes `gigw.*` matching to link/button/heading/title/aria-label text per DESIGN's own step 1, so
  an article that merely mentions "contact" in prose doesn't count as a real Contact Us link).
  `gigw.ownership` needed its pattern widened beyond DESIGN's literal single-verb regex (`content
  (owned|maintained|provided) by`) to also match the much more common real-world "Owned, Maintained
  and Updated by" chained phrasing -- a small implementation-level fix (a bounded gap between the
  verb and "by"), not a product-level deviation, so no ADR. `content.broken_links`/`broken_pdfs`/
  `broken_images`/`console_errors` stay `na` -- they need a real crawl/browser, which is WP3.5's job.
  **verifier mutation-tested `content.ts`/`gigw.ts`/`dates.ts`** and found 3 real gaps, all a case of
  a test technically covering a line without actually pinning its behaviour: `content.malayalam`'s
  0.05 ratio threshold (the only "passes on ratio" test used text at ratio >0.9, nowhere near the
  boundary) and its toggle-vs-ratio short-circuit (the "toggle" test's anchor text was itself
  Malayalam, so the ratio alone already would have passed it) were each "passing by coincidence";
  and the 12 navigation-based `gigw.*` checks' pattern-to-check wiring was never verified per-check,
  since the `gigw-all-*`/`gigw-none` fixtures have every pattern present or absent simultaneously and
  can't catch e.g. `gigw.sitemap` accidentally wired to the `'privacy'` pattern. Fixed with two
  boundary-pinning tests (ratio 0.04 vs 0.06 via a direct `ctx.malayalamRatio` override), an
  English-only-except-for-the-toggle test, and a single-marker-per-check test asserting each
  navigation check passes on its own marker while every sibling still fails on that same page --
  each manually re-broken and re-fixed to confirm. 792 tests, `npm run build` clean, 62 real checks
  now wired into `CHECK_LIST` (11 avail + 10 id + 14 sec + 11 content + 16 gigw) out of the full
  84-entry catalogue. **Next: WP3.5** (Playwright runner) -- see the **Next action** line above for
  the full list of `CheckContext` fields it needs to populate; this is the largest remaining WP in
  Phase 3 and the one every content/security/identity check's `na` branches have been waiting on.

- **2026-09-21 · WP3.3 done** — `audit/src/checks/security.ts` (14 `sec.*` checks). `sec.https`/
  `http_redirect`/`cert_valid`/`cert_expiry`/`tls_version` read `ctx.light` (the existing TLS/redirect
  info from Phase 2's light check); `sec.hsts`/`csp`/`xfo`/`xcto`/`referrer`/`server_banner` read a
  new `ctx.headers` dict via a case-insensitive `getHeader()` helper -- deliberately a *different*
  field from `ctx.light.headers`'s Phase-2 booleans, per the WP's own steps text, since the deep
  audit's own richer fetch (WP3.5) will produce its own full raw header set. `sec.mixed_content`
  combines a static `src=`/`href=` scan of `ctx.html` with an optional `ctx.requests` log (new
  `CheckContext` field), gated to https pages only. `sec.vuln_js`/`sec.safe_browsing` read
  pre-computed fields (`vulnerableLibraries`, `safeBrowsingFlagged`) only a future runner can
  populate. **`audit/src/net/retire.ts`** shells out to the real retire.js CLI (now a pinned
  dependency, not just `npx`-fetched ad hoc) against script contents written to a scratch dir,
  parses its JSON output, and caches by content hash. Its test (`retire.test.ts`) is a genuine
  integration test against the real binary, kept fully offline via a hand-crafted local
  `tests/fixtures/retire/jsrepo.json` (NOT the real retire.js central repo) and a *synthetic*
  `jquery-1.8.3.min.js` fixture containing only a version-banner comment -- never real third-party
  source, since this project doesn't download external files without asking first. It reports the
  real public CVE-2012-6708, satisfying the WP's own Verify text. **`audit/src/net/safebrowsing.ts`**
  wraps Google Safe Browsing's Lookup API, returning `null` (never `false`) whenever no
  `SAFE_BROWSING_KEY` is set or a lookup fails, so "never checked" can't be mistaken for "clean".
  **verifier mutation-tested `security.ts`** and found 3 real gaps, each a case of "only passing by
  coincidence, not by a test that actually pins the behaviour": `getHeader`'s case-insensitivity and
  exact-vs-substring matching were never proven (every fixture happened to use lowercase,
  non-overlapping header names already); the TLS major-version->1 branch in `tlsVersionAtLeast12` had
  no test; and the shared `hadResponse()` gate's `timeout` case was untested on `sec.https`/
  `sec.mixed_content` (only `connect_fail` was covered, even though the function explicitly special-
  cases both). Fixed with a mixed-case header test, a substring-trap header test, a synthetic
  `TLSv2.0` case, and a `timeout` case on both affected checks -- each manually re-broken and
  re-fixed to confirm. Also tightened `retire.test.ts`'s caching test on the verifier's own minor
  note: it now points a second call at a nonexistent `--jsrepo` path and confirms the (real, cached)
  finding still comes back, which a broken cache could not produce. 634 tests, `npm run build` clean,
  35 real checks now wired into `CHECK_LIST` (11 avail + 10 id + 14 sec). **Next: WP3.4** (`content.*`/
  `gigw.*` checks, the first bilingual en+ml pattern-matching WP) — same `Check`-array pattern.

- **2026-09-21 · WP3.2 done** — `audit/src/checks/availability.ts` (11 checks) and
  `audit/src/checks/identity.ts` (10 checks), both real `Check` implementations against DESIGN
  §5.3's tables, wired into `CHECK_LIST` in `checks/index.ts`. `avail.dns`/`connect`/`status` read
  the existing light-check result directly; `avail.redirect_offsite`/`parked`/`default_page`/
  `blank`/`under_construction`/`geo_blocked` use a new `checks/text.ts` (`visibleText()`, a
  head/script/style/tag-stripping approximation for use before WP3.5's real rendered text exists)
  and DESIGN's own A.1–A.3/A.9 pattern lists. `avail.flapping` reads a site's daily `history` (a
  new optional `CheckContext` field) over a 7-day/3-down window -- DESIGN literally says "28 checks
  (7 days)", but WP2.2 already collapsed history to one entry/day, so 7 days is the correct
  daily-granularity equivalent of DESIGN's own parenthetical, not a new product decision (documented
  as a code comment, no ADR needed). `id.gov_domain`/`id.domain_expiry` share a dot-boundary
  domain-suffix check (`isGovDomain`) so a lookalike like `evilnic.in` can't false-positive.
  `id.domain_expiry` uses a new `audit/src/net/rdap.ts` (rdap.org lookup, cached per run, a
  `baseUrl` option so tests hit a local fixture server instead of the real network). Several id.*
  checks (`www_consistency`, `robots`, `sitemap_xml`, `soft_404`, `domain_expiry`) read new optional
  `CheckContext` fields that only a future runner (WP3.5) can populate from live probes a pure check
  function can't make itself -- each documented in `types.ts` with what will fill it and when.
  **verifier mutation-tested `availability.ts`/`identity.ts`** and found 4 real gaps: `avail.blank`'s
  80-character boundary was never actually exercised (the only fixture had 0 visible characters, so
  mutating the threshold to `<8` still passed); `avail.redirect_offsite`'s alias-matching branch was
  untested because the "matches an alias" test's domains already matched via `ctx.light.domain`
  regardless; `avail.parked`'s two fixtures each matched 2-3 patterns simultaneously, leaving 10 of
  15 parking-signature patterns never uniquely exercised; `avail.default_page`'s "It works!"
  whole-body branch had no fixture at all and could be deleted with zero test failures. Fixed by
  adding a boundary-pinning pair of tests, a true alias-only redirect test, one isolated inline-html
  phrase per untested `avail.parked` pattern, and a bare "It works!" case -- each manually re-broken
  and re-fixed in `availability.ts` to confirm the new tests actually catch them. 571 tests,
  `npm run build` clean, and a manual end-to-end smoke test (`runChecks` → `scoreSite` against a
  synthetic healthy site, and against `ok-minimal.html` specifically) confirmed the WP's own Verify
  criterion: the fixture triggers no check at all. **Next: WP3.3** (`sec.*` checks + retire.js +
  fixtures) — same `Check`-array-plus-fixtures pattern this WP established.

- **2026-09-21 · WP3.1 done — Phase 3 started** — `audit/src/checks/types.ts` (`CheckId` — 84 ids
  written out by hand from DESIGN §5.3's tables, `~90` is that table's own approximate count so this is
  in range; `CheckMeta`, `CheckContext` deliberately minimal — only `site`/`light` exist until WP3.5's
  Playwright runner adds `html`/`headers`/etc.), `audit/src/checks/registry.ts` (`CHECKS`, all 84
  entries: category, severity, `statusSetting` where DESIGN marks a check ★, English title/citizen/fix
  text — `ml` fields present as empty strings per ADR pending WP5.3), `audit/src/checks/index.ts` (empty
  `CHECK_LIST`; `runChecks()` reports every not-yet-implemented id as `na` so `score.ts` has something to
  consume before WP3.2–3.4 populate real checks), `audit/src/score.ts` (`scoreSite()`: a failing ★ check
  sets `status` directly and nulls the score outright — DESIGN §5.4's "availability is a gate, not a
  component" — otherwise ADR-006's six weighted category scores, each checks' fail/warn/na deductions
  floored at 0, roll into a rounded `overall` and `healthy`/`needs-work`/`poor` at the 80/50 boundaries).
  Two interpretive calls made without a new ADR, since ADR-005's own text already delegates
  status-setting to DESIGN §5.3's ★ marks: `sec.https` → `statusSetting: 'broken'` (no HTTPS at all is
  the same "browser won't trust this" class as an invalid cert), and `avail.dns`/`connect`/`status` →
  a deep-audit-specific `'down'`, distinct from Phase 2's own two-strike light-check `down` in
  `status.ts` (a full audit's single observation is credible on its own; a 6-hourly light ping is not).
  Both documented as code comments in `registry.ts`/`types.ts`/`score.ts` rather than a Proposed ADR.
  **verifier mutation-tested `score.ts`** (9 mutations: floor removal, fail/warn ratio swap,
  `STATUS_PRIORITY` reorder, `findStatusOverride` first-failure-only, both `buildIssues` sort keys, the
  availability-category skip in `computeCategoryScores`, both 79/80 and 49/50 boundaries) — **7 caught,
  2 survived**: the `CATEGORY_ORDER` tiebreak in `buildIssues` (every existing multi-issue test used
  different severities, so the tiebreak line was never exercised) and the availability-exclusion in
  `computeCategoryScores` (every availability check in the test fixture carried a `statusSetting`, so a
  fail always short-circuited via `findStatusOverride` before that line ran). Fixed by adding one test
  for each — a same-severity two-category tiebreak, and a fixture entry for `avail.ttfb` (one of the two
  known non-★ availability checks) whose fail must not deduct from any scored category — then manually
  re-broke and re-fixed both lines in `score.ts` to confirm the new tests actually catch them. 465 tests,
  `npm run build` clean, `node -e "...registry.js..."` prints `84` per the WP's own Verify command.
  **Next: WP3.2** (`avail.*` and `id.*` check implementations + fixtures) — the first WP to populate
  `CHECK_LIST` with real, testable check functions instead of metadata alone.

- **2026-09-21 · WP2.5 done — Phase 2 complete** — `audit/src/resolve.ts` (`resolveSite`/`resolveSites`,
  pure `dnsFailure`/`domainFailure`/`statusWarning` helpers exported for direct unit testing like
  WP2.1's `tlsToLight`) and `audit/src/changed.ts` (`computeChangedIds`, pure; `changedSiteIds` shells
  out to `git show <ref>:<path>` to diff url/aliases against a ref). `ValidationFailure` gained a
  `severity: 'error' | 'warn'` field; only `error` fails the CLI's exit code and the PR check. `--resolve`
  refuses to run without `--changed-only <ref>` or `--ids` — CLAUDE.md forbids an unbounded live scan
  outside Actions. `validate.yml` now fetches `origin/main` and runs one combined
  `validate --resolve --changed-only origin/main --json` call; its PR comment gained a "Live-checked N
  changed entries" table listing every resolved site (not just failures) so a passing addition shows a
  visible ✅ with its name, per the WP's own Verify text. **Verified live, not just locally** (mirroring
  WP0.3's precedent): opened a real throwaway PR (#2) with a bogus-host entry — check failed with the
  exact expected row — pushed a fix to a real URL (`example.com`, the standard reserved test domain) —
  the *same* comment updated in place, check passed, entry's name appeared in the resolved table — then
  closed the PR unmerged and deleted the branch. **Real bug found and fixed while testing against real
  entries:** `kseb`'s registered url `https://www.kseb.in` doesn't resolve at all (confirmed independently
  via `dig`/`curl`); the bare `kseb.in` does and is the real KSEB site — fixed in its own `data:` commit
  (0424c12) before the WP2.5 commit, so the feature commit's own manual testing wasn't muddied by a
  pre-existing data bug. 99 tests, `npm run build`/`astro`-independent (site untouched this WP). Ran the
  `explainer` phase-end readability pass on Phase 2's core files (light/store/status/summary/resolve/
  changed.ts) per CLAUDE.md's convention — see its findings noted separately if any needed fixing.
  **Next: WP3.1** (check framework, `registry.ts`, `score.ts`) — Phase 3, the largest phase, starts here.

- **2026-09-21 · WP2.4 done** — `site/src/lib/data.ts` rewritten to import the real `Result`/`Summary`
  types from `audit/dist` (`readResult`, `computeSummary`) instead of the WP0.4-era hand-rolled subset,
  with the registry/summary each computed once per build and cached module-wide (the build renders
  ~1,600 pages, most touching one or both). New pages: `/districts/` (schematic map + table),
  `/districts/<id>/` (grouped: administration / district & block panchayats / corporations &
  municipalities / grama panchayats behind `<details>` / other institutions — every group stays under
  ADR-025's 100-row cap even in Thiruvananthapuram, the biggest at 320 sites), `/departments/<id>/` and
  `/status/<status>/` (both paginated via Astro's `paginate()` per ADR-025 — `lsgd` has ~1,210 sites,
  `unaudited` currently has 1,466). Upgraded `/` and `/sites/<id>/` (TLS expiry, security headers, a
  90-day availability strip from real `history[]`). New components: `KeralaMap`, `StatTile`,
  `CoverageBar`, `SiteTable`, `Pagination`, `AvailabilityStrip`. Checked a git worktree at `./data`
  (`git worktree add data data`) for local building against real content instead of an empty checkout.
  **Real bug found and fixed by dogfooding actual WP2.3 data, not by any test:** the home page was
  224KB (over the ~150KB budget) because `summary.recent_fixed` had 1,466 entries — `recentTransitions()`
  in `audit/src/summary.ts` treated a site's very first-ever history entry as "just came up today" since
  there was no older, differing day to compare against yet. Fixed in a separate commit (a22213a) with a
  regression test, hand-verified to catch the original bug by reverting and reconfirming red. **One
  Astro build-time surprise:** a top-level `const PAGE_SIZE = 100` above `getStaticPaths` got tree-shaken
  away by Astro's build (referenced only inside that function, apparently invisible to whatever decides
  what the extracted `getStaticPaths` module needs) — `PAGE_SIZE is not defined` at build time. Fixed by
  moving the const inside the function; noted in both paginated route files so it isn't hit again.
  **Real map deferred:** DataMeet's shapefiles need an external download, which needs the human's
  explicit go-ahead first (same rule as WP0.4's font fetch) — used WP2.4's own explicitly-sanctioned
  placeholder instead (`site/src/data/kerala-districts.json`, a north-to-south ordered strip, not real
  geography; swapping in real boundaries later doesn't need this file's shape to change). Verified: `cd
  audit && npm test` (80/80), `cd site && npm run build` (1,596 pages, ~2.5s) and `npm run lint` (`astro
  check`, 0 errors) both clean, manually browsed home/district/status/department/site pages in the
  built-in browser against real WP2.3 data (down/broken lists, Malayalam district names, pagination
  page 1→2 on `/departments/lsgd/`). **Lighthouse gotcha for whoever runs this check next:** the first
  run (`astro dev`) scored 58 — that's the unminified dev server, not a real regression. Re-ran against
  `astro preview` (the actual production build) and got 100; always check the built site, never `astro
  dev`, or you'll chase a performance problem that doesn't exist. **Reduced scope, by design not
  accident:** home's browse section only offers District and Status (no Ministry/Kind tabs yet — those
  pages don't exist until WP4.2), consistent with WP2.4's own "light data only" framing. **Next: WP2.5**
  (`validate --resolve` + PR comment) — the last WP in Phase 2.

- **2026-09-21 · WP2.3 live** — `.github/workflows/uptime.yml`: cron `0 */6 * * *` + `workflow_dispatch` with a
  `limit` input, `concurrency: {group: data-branch}` (shared with the future `audit.yml`), checks out `main` +
  `data`, builds `audit`, runs `cli.js light --all --limit "<n>"`, commits/pushes to `data` with the retry-on-race
  loop from DESIGN §6.3. Verified live, not just read back: dispatched with `limit=50` (succeeded, 50 results
  written, `summary.json.totals.sites` correctly stayed 1,500), then a second `limit=50` (correctly re-checked the
  same first 50, flipping some to `down` via the two-strike rule), then a full `--all` run (23m45s, all 1,500
  sites, `data/summary.json` → 15 down, 19 broken, 1,466 unaudited). **Found and fixed a real bug via that live
  verification, not something a local test could have caught:** the first successful push to `data` never
  triggered `build-deploy.yml` — GitHub's own anti-recursion rule means a push made with the default
  `GITHUB_TOKEN` (which `actions/checkout` wires up) never fires another workflow's `push` trigger, so every bot
  commit to `data` would have left Pages stale forever. Fixed by adding a `workflow_run` trigger to
  `build-deploy.yml` (listens for `uptime.yml`, and pre-emptively for WP3.7's `audit.yml` by name) — `workflow_run`
  isn't a push event and isn't subject to that rule. Re-verified after the fix: both the limit=50 rerun and the
  full run's `data` pushes correctly triggered a successful Pages rebuild via `workflow_run`. **Not fully closed:**
  the WP's own "two consecutive *scheduled* runs succeeded" done-when gate needs real calendar time (6h cron
  interval) that no single session can wait out — recorded as Open question 8, not a blocker. **Next: WP2.4**
  (site v1) — `data/summary.json` now has real content to build the home/district/department/status pages
  against; read ADR-025 first, it adds a pagination step and a per-page Lighthouse budget to this WP's own text.

- **2026-09-21 · WP2.2 done, plus ADR-025 (pagination + performance budgets)** — `cli light --ids/--all --data <dir>`
  now does the real work: runs `lightCheck()` per site (bounded concurrency via `p-limit`), folds each into
  `data/results/<id>.json` via `mergeLightResult` (two-strike `down`, geo-block/invalid-cert precedence, one
  history entry/day capped at 90 — `status.ts`/`history.ts`/`store.ts`), then recomputes `data/summary.json`
  (`summary.ts`: totals, per-district/department/ministry/kind/platform broken counts, ADR-004 coverage ETA,
  7-day recent_broken/recent_fixed). Atomic writes via temp-file-then-`renameSync`. Manually verified end-to-end
  against 2 real sites and a fake `nonexistent.invalid` entry (two-strike transitions correct, single history
  entry per day on a second run same-day) — all scratch dirs deleted after. `verifier` (agent aa31ca624c40dfe14)
  found 4 real gaps by mutation testing: `mergeLightResult`'s score/deep/issues carry-forward test never set
  non-null values on the fixture (mutation to hardcode `null`/`[]` survived); no test exercised a site that
  already has a deep audit staying on its deep-derived status through a fresh healthy light check (`hasDeepAudit`
  hardcoded `false` survived); `groupBy`'s null-key skip had no null-district fixture (survived); the coverage-ETA
  test's 700-site fixture never actually made the 300-per-day batch cap bind (removing the cap survived). All
  four fixed with new tests in `store.test.ts`/`summary.test.ts`, each hand-confirmed to catch its mutation by
  reintroducing it and reverting. 79/79 tests green, `npm run build` clean. Separately, the human asked to add
  home-page pagination to the roadmap and optimise the site for loading speed — recorded as **ADR-025**: any
  listing table (home, district, department, status, kind) that would exceed 100 rows paginates at build time via
  Astro's `paginate()` (no client JS, consistent with ADR-002), and WP2.4/WP4.2/WP4.3 each gained an explicit
  pagination step plus a per-page Lighthouse performance check (target ≥ 90) in their own Verify steps, rather
  than deferring all performance checking to WP4.5's self-audit. **Next: WP2.3** (`uptime.yml` live) — first WP
  that pushes to the `data` branch, not just `main`.

- **2026-09-21 · Harvest continued (not a WP; between WP2.1 and WP2.2)** — The human supplied 5 new discovery sources (3 igod.gov.in sector pages, kerala.s3waas.gov.in, datahub.kerala.gov.in, plus a subdomain-enumeration CSV of `*.kerala.gov.in`) and asked to add "all websites" from them, plus a reverse-IP search. Followed ADR-018 throughout: everything landed in `registry/candidates/`, nothing was written to `registry/sites/` — that's a curation pass (WP1.7-style), not this session's job, and 2,300+ raw entries is far too much to hand-curate in one sitting anyway. New harvest scripts: `scripts/harvest/igod-sectors.ts` (igod.gov.in's `/sg/KL/{E003,E004,E005}/organizations[_more]` pagination, same markup as the existing goidirectory.ts parser — 66 candidates from Departments/Directorates/Attached-Offices sector pages; igod's own `count` global claimed 62 for Departments but only 52 rows ever came back across all `_more` batches, recorded as-is rather than padded), `scripts/harvest/s3waas-hub.ts` (kerala.s3waas.gov.in is just a landing page to the 14 district `.nic.in` portals already registered since WP1.5 — cross-checked every link's dedupeKey against the live registry + all existing candidates + `ignore.yaml` before emitting anything; only 2 were genuinely new: `kl.cmdashboard.nic.in` and `unnathi.kerala.gov.in`), and `scripts/harvest/kerala-gov-in-subdomains.ts` (parses the human's CSV — no `csv-parse` dependency added, wrote a 25-line quoted-field line splitter since the format doesn't need more; screens out unresolved-at-scan-time rows (2,466 of 4,869) and obvious infra hostnames (mail/ns/ftp/cpanel/cdn/etc., 70 more) and emits everything else, 2,333 candidates, as raw source material for a future curation pass — deliberately did **not** try to guess which of the CSV's many per-organisation dev/staging/beta subdomains are the "real" site, that's a human judgement call). Checked `datahub.kerala.gov.in/datasets` by hand: it's a CKAN-style dataset catalog with no per-dataset publisher-website field, not an organisation directory — its header/footer links (keralacm.gov.in, itmission, spb, prd, health.kerala.gov.in) were already all registered, so it contributed nothing and no script was written for it. Also filed 4 new `ignore.yaml` entries surfaced by the s3waas-hub link sweep (`gandhi.gov.in`, `india.gov.in`, `mygov.in`, `scholarships.gov.in`, `secure.nic.in` — the last three of these are bare-domain variants of already-ignored `www.`-prefixed patterns, a gap worth remembering next time a harvest hits a domain that "looks" already handled). Full `npx tsx scripts/harvest/merge-candidates.ts` after all four new files: **662 already in the registry, 241 duplicate across sources, 2,476 fresh** — almost entirely the CSV. `audit` 52/52 and root 14/14 tests still green (no test changes needed, new scripts follow existing patterns exactly); `validate` exit 0 (candidates aren't validated, but `ignore.yaml` is registry data). **Reverse-IP search explicitly skipped at the human's instruction** — free lookup services can't cover the CSV's 866 unique resolved IPs, and no paid OSINT API key was offered; recorded as Open question 7 with the top-10 shared IPs for whoever picks it up. **Next: WP2.2 remains the next real work package** — the 2,476 fresh candidates are a backlog for a future WP1.7-style curation session, not something to rush through under WP2.2's context budget.

- **2026-09-21 · WP2.1 done** — First Phase 2 work package: `lightCheck(url, opts)` in the new `audit/src/light.ts`, built on three small I/O primitives (`audit/src/net/{dns,tls,http}.ts`) so each layer (DNS resolution, TLS handshake/cert evaluation, redirect-following GET with retries) is independently testable. Manual redirect-following was needed because `undici.request()` doesn't auto-follow redirects at all (an early assumption it did, guarded by a `maxRedirections` option, was wrong -- that option doesn't exist on `request()`, only on the fetch-style API; removed once `tsc` caught it). Classifies every outcome as `dns_fail | connect_fail | timeout | ok | http_<code>`, computes a content hash for ADR-016's deep-audit-bump trigger (strips `<script>` bodies, hidden form inputs, CSRF-token-looking attributes and timestamp-shaped strings before hashing -- "best effort" per the WP text, documented in the function's own comment), and does a starter geo-block-signature check per DESIGN §6.7 (deliberately small; grows from real WP2.3 captures, not more guessing). Manually sanity-checked against 2 real sites (within CLAUDE.md's ≤3-site allowance) before committing: `kerala.gov.in` came back with `title: null` because its homepage genuinely has an empty `<title></title>` tag (correct behavior, and itself a real future `content.title` finding); `keralapsc.gov.in` returned a plain 403 from this dev machine -- real-world confirmation that DESIGN §6.7's geo-blocking concern is live, though this specific block's body text didn't match the (intentionally minimal) starter signature list, so it shows as an ordinary `http_403` for now rather than `geo_block_suspect`, exactly as documented. **verifier caught two real gaps** before this was called done: no test would have failed if the `maxRedirects` cap were silently removed (an infinite redirect loop would just hang the check on that one site forever -- a real hazard given the "polite, never hang" posture), and the TLS certificate→`valid` mapping (`tlsToLight`) had no test that ran in CI at all (the only test touching real TLS is the `@live` example.com one, which is *always* skipped in CI, so a hardcoded `valid: true` bug would have shipped silently). Fixed both: added a `/loop`-redirects-to-itself test capped at `maxRedirects: 2`, and exported `tlsToLight` for direct unit tests against hand-built `TlsInfo` objects (unauthorized, hostname-mismatch, never-connected cases) -- re-verified both fixes catch their mutations by hand before committing. 52 tests green, `npm run build` clean, `cli.js light --help` prints usage. **Next: WP2.2** — the data-branch writer, history and summary that turn `lightCheck()` into an actual scheduled/runnable audit; read its own Read-first list, don't reuse this session's context.

- **2026-09-21 · WP1.7 done** — Closed the ≥1,500 gate by doing the Malayalam-name pass the previous handoff flagged as the remaining hard work, rather than filing the "accept short of 1,500" ADR — it turned out tractable: I read Malayalam directly instead of needing a translation step, which the prior session's risk assessment hadn't accounted for. Wrote a throwaway assessment script (`_assess.mjs`, deleted after use) to bucket the ~430 "fresh" harvest candidates by what they actually were: 43 already covered by `ignore.yaml` under a different URL form, 38 already-registered under a www/path variant, 85 sub-resource junk (Google Forms/Sheets links, raw-IP dashboards, PDFs — never real candidates), 63 out-of-scope by `classifyDraftTier()`'s existing SKIP_PATTERNS (colleges/courts/police, just in Malayalam so the English regex missed them), and 200 genuine organisations split roughly 53 English / 147 Malayalam. Hand-translated and curl-verified each of the 147 Malayalam ones before deciding; about a third turned out to be central-government bodies (ICAR institutes, Railways, AAI, Passport Seva, Bureau of Indian Standards, etc. — 27 added to `ignore.yaml`) and a handful were dead ends worth recording: two Kerala PSU domains (Kerala State Bamboo Corporation, K-Rail/KRDCL) have been squatted by unrelated sites (gambling spam, a web-design studio) and were left unregistered rather than pointed at the wrong content; `keralasangeethanatakaakademi`-style near-misses (`kalamandalam.org`, also squatted) confirmed the already-registered `.ac.in` domain is the right one. Also caught two DESIGN.md Appendix A "from memory" seed URLs that had gone stale since WP1.6: `ikm`'s primary url (`ikm.gov.in`) now 400s while `infokerala.org` is the live real site — added as an alias and flagged via `notes:` per ADR-005 rather than silently repointed (same treatment as WP1.7's earlier `igr`/`keralamvd` findings). **50 net-new entries this pass** (3 directorate, 29 agency, 7 PSU, 12 statutory — see commit 8bbff71), 2 more department-pointer fixes (`coop`, `housing` — same stale-id pattern as last time's 9), 2 alias merges (`ikm`, `rcctvm`). **Registry: 1,449 → 1,500 exactly.** `validate` exit 0, `audit` 25/25 + root 14/14 tests green, site builds (1,503 pages). Everything committed, nothing pushed (STATE.md says pushes are fine, but this session didn't push — a human should verify a sample of the 90 new/fixed entries before it goes live, especially the ones registered on weak signals: `keralaservices`/`services.kerala.gov.in` was 503 at check time, `scec`/`www.scec.kerala.gov.in` gave a 200 with no confirming page text). One process lesson for whoever writes the next Malayalam-adjacent batch: dedupe by URL substring is not enough once WP1.6's "from memory" seed guesses are in the mix — three of my first-draft candidates (`dmg`/Mining and Geology, `rcctvm`/Regional Cancer Centre, `ikm`) turned out to already be registered under a *different* domain than the one I'd curl-verified, caught only because `validate`'s unique-id check happened to collide on identical ids I'd independently chosen; a genuine name-based cross-check against all existing `name:` fields (not just `url:`) is the more reliable dedupe and should be step one, not a cleanup step, next time. **Next: Phase 2 — WP2.1** (`light.ts`, the first live network-facing WP; read its own Read-first list before starting, don't reuse this session's context).

- **2026-09-21 · WP1.7 continued (still partial)** — `classifyDraftTier()` only fires on candidates that already carry a WP1.6 `kind` hint, so most of the ~600-candidate remainder (harvested straight from kerala.gov.in/goidirectory/district crawls, never touched by curated.ts) was invisible to `--write-drafts` even though real organisations were hiding in it. Triaged by hand instead of mechanically: filtered ~600 unclassified names down to ~270 English-named ones, cross-referenced them against `registry/departments.yaml`'s `website:` pointers (which turned out to name 14 site ids that were never actually registered — some genuinely missing, most just registered under a *different* id than the WP0.2 seed guessed, e.g. `prd`→`prdkerala`, `lsgd`→`lsgkerala`) and DESIGN.md Appendix A, curl-verified every candidate URL before adding it (skipped `dairy.kerala.gov.in`, DNS failure, and `keralawomen.gov.in`, connection timeout — real orgs, not-yet-confirmable URLs, left for later rather than guessed). Net result: 39 new entries (19 directorate, 16 agency, 1 statutory, 1 university — see commit b3f22d3 for the full list), 9 departments.yaml pointer fixes, 3 alt-domain mirrors folded into existing entries as `aliases` (niyamasabha, sec, igr — igr's case also surfaced that its primary url now serves a "Fair Value of Land" tool page instead of the department homepage, flagged in `notes:` per ADR-005 rather than silently repointed), and 23 more central-government candidates moved to `ignore.yaml` (ADR-009: FACT, HOCL, ICAR institutes, IITs/IIMs/IIITs/NIFT, CAG, DigiLocker, etc. — all confirmed central by name, not guessed). `validate` exit 0, `audit` 25/25 + root 14/14 tests green, site builds (1,452 pages). **Registry: 1,408 → 1,449, still short of the ≥1,500 gate.** What's left is qualitatively different from what's been done so far, not just more of it: ~270 candidates have **Malayalam-only names** (e.g. "പൊതു വിദ്യാഭ്യാസ വകുപ്പ്") that are very likely the *same* organisations already registered under an English name via a different crawl hit — registering them without translating and cross-checking each one risks real ADR-012 duplicate-organisation violations, so I left them untouched rather than guess. A handful of LSGD e-governance URLs (SANCHAYA, SEVANA, Sevana Pension) are mid-migration into a consolidated "K-SMART" platform and redirect through an unstable chain (SEVANA's own url now 404s) — not safe to register as-is. **Next: WP1.7 continued** — either commit real effort to the Malayalam-name translation+dedup pass (the only remaining path to ≥1,500 that isn't already mined out), or write a **Proposed ADR** documenting that the ≥1,500 target was set before this candidate pool's actual composition (colleges/courts/central-govt noise, Malayalam duplicates, and unstable migration URLs) was known, and that the registry is complete enough to go live at the current size — per the Decision protocol, that's a legitimate path if taken explicitly rather than by silently stalling.

- **2026-09-20 · WP1.7 (partial)** — Implemented the missing `merge-candidates.ts --write-drafts` (with tests): `classifyDraftTier()` maps a WP1.6 `hints.kind` to a site tier, or a plain "X Department, Kerala" name to `directorate`, and skips Phase-5 colleges/courts/sub-district-police; `pickDraftCandidates()` correctly treats a "duplicate across sources" group as a *stronger* signal than a singleton "fresh" candidate (the first version only drafted `fresh`, missing most of WP1.6's curated.yaml entries since they also exist verbatim in their original source file). Curated 6 tiers into `registry/sites/{universities,districts,psus,statutory,agencies,directorates}.yaml` — 198 new entries, `validate` exit 0, site builds (1,411 pages). Real bugs caught and fixed along the way, not just typed through: (1) the 14 district collectorate sites were registered with bare-domain URLs while the harvested/verified candidates used `/en/` paths — different dedupeKeys meant future harvests would re-suggest all 14 forever; fixed to match exactly. (2) SDMA and two department sub-pages (PRD's `/council-of-ministers`, LSGD's tender portal) were duplicates of already-curated orgs under a different URL — left in `registry/drafts/` with `notes:` rather than silently dropped or double-registered. (3) Two WP1.6 classifier misses caught by hand: SCTIMST (a central Institute of National Importance) and the "Income Tax Department, Kerala" candidate (Income Tax is exclusively a Union subject, not a state function) were about to be registered as Kerala state bodies — moved to `ignore.yaml` (ADR-009) instead. (4) Found that the already-registered `keralamvd` (WP0.2 seed, "from memory") serves a **self-signed/untrusted TLS certificate** — not dead, but broken in exactly the way ADR-005 counts as `broken` once Phase 2/3's checks run; the real, working department site turned out to be at `mvd.kerala.gov.in`, added as `keralamvd`'s alias per ADR-012 rather than registered as a second site. **Registry stands at 1,408, short of WP1.7's own ≥1,500 Verify gate** — recorded honestly rather than forced: `classifyDraftTier()` currently only recognises the 6 tiers already curated (kind-hinted WP1.6 candidates + plain department names), so the ~507 remaining "fresh" candidates (mostly `office`/`service`/`portal`-shaped entries like SPARK, e-grantz, individual govt schools/colleges correctly deferred to Phase 5) fall through unclassified rather than being guessed at. `registry/drafts/*.yaml` now holds exactly 5 items, each with a `notes:` explaining its resolution (matching the WP's own "drafts/ contains only items with notes:" criterion) — nothing left to curate there; the real remaining work is broadening the classifier. **Next: WP1.7 continued** — extend `classifyDraftTier()`, rerun `--write-drafts`, curate further tiers until the registry crosses 1,500, then move to Phase 2.

- **2026-09-20 · WP1.6** — Found the actual live successor to DESIGN's "Bureau of Public Enterprises (Kerala)": it was restructured into RIAB then renamed again to BPT (Board of Public Sector Transformation, bptkerala.in — see its own "Restructuring and renaming of RIAB as BPT" PDF); its own PSU list only covers the ~52 Industries & Commerce-sector units, so Wikipedia's "Public sector undertakings in Kerala" (102 named, with closure status) filled in the rest (power/transport/finance/cooperative sectors). `scripts/harvest/curated.ts` mechanically classifies all 978 already-harvested candidates by name pattern (Ltd/Corporation → psu, Board/Commission/Council/Mission/Institute/etc → statutory-or-mission, University → university), with a hand-built exclude list for things the regex over-catches: central-government institutions physically in Kerala (IITs, NITs, IIMs, ISRO/ICAR centres — ADR-009), municipal corporations (WP1.4's tier, not PSU), government engineering colleges (Phase 5 scope), and sub-page/duplicate-domain noise. Caught and fixed a real bug before committing: candidates pulled from `district-*.yaml` carried a `hints.district` meaning "found on that district's homepage" (WP1.5), which would have wrongly told WP1.7 that state-wide bodies like SDMA and the CM's Relief Fund were district-scoped — stripped that hint for every re-curated entry. 7 universities and 26 PSUs/missions named by DESIGN.md Appendix A or Wikipedia/BPT never surfaced in any crawl; each added only after individually confirming its URL by search (never guessed from initials) — 1 (Rehabilitation Plantations Ltd) had no discoverable official site at all beyond third-party corporate-registry listings, recorded in the new `registry/candidates/no-website.yaml`. **Result vs. the WP's own targets: universities 15/≥15 (met exactly), statutory+mission 78/≥40 (well clear), PSUs 50/≥80 (short)** — recorded honestly rather than padded, same as WP1.3's overlap-estimate miss; DESIGN's "~130" PSU estimate counts every historical BPT-list entity including many that Wikipedia's own remarks mark closed/liquidated/defunct, and a meaningful fraction of the small legacy manufacturing units still nominally active have no modern web presence at all (Rehabilitation Plantations being the one I confirmed, not the only likely case) — a further top-up pass through the remaining ~40 unchecked BPT/Wikipedia names could close some of the gap but hits diminishing returns. Fixed a latent bug in `merge-candidates.ts` while wiring this up: it treated every file in `registry/candidates/` as a `Candidate[]`, which crashed the moment a shape-different file like `no-website.yaml` existed — now explicitly excludes it. **Next: WP1.7** — curation pass into `registry/sites/*.yaml`; read DESIGN §3.1/§3.3/§4 and ADR-012 first. Its own first step (`merge-candidates.ts --write-drafts`) doesn't exist yet — today's tool only reports categorization, so that flag needs implementing before curation can start.

- **2026-09-20 · WP1.5** — Verified all 14 `<district>.nic.in` hosts live by hand (dig+curl) before writing anything — `thiruvananthapuram`→`trivandrum.nic.in`, `kasaragod`→`kasargod.nic.in` (same historical-name pattern as WP1.4's district aliases), `wayanad.nic.in` 301s to `wayanad.gov.in` (used the canonical post-redirect host). The WP's own premise didn't hold: checked five districts' "Departments"/"Public Utilities"/"Department Directory" pages by hand and found them consistently informational-only (office name, phone, a named official's personal email) with zero outbound links — not a bug in the harvest, a real property of this source, recorded as ADR-024 rather than silently reinterpreted. Real external links do appear on each district's own **homepage** (notices/quick-links widgets) instead, so `scripts/harvest/district-portals.ts` crawls that: 180 candidates across 14 `registry/candidates/district-<id>.yaml` files (2 for Wayanad's differently-templated site, up to 26 for Pathanamthitta — driven by what each homepage actually links to, not padded to a uniform count), plus the 14 collectorate portal URLs themselves as certain candidates (`hints.kind: district_admin`, DESIGN §2's T4 row). 28 hand-verified (not guessed) central-government/platform hosts (India.gov.in, Digital India, PMNRF, NIC, MeitY, S3WaaS, social media, app stores, YouTube embeds) went to `registry/ignore.yaml` with reason `central` or `not-a-site`. Real finds worth a look in WP1.7 curation: `dtpcalappuzha.com` (District Tourism Promotion Council — genuinely district-level), several `*.kerala.gov.in` state directorates not yet in any prior harvest. Combined 3-source candidate pipeline (kerala-gov-in + goidirectory + district-*): 835 total, 31 already-registered, 202 duplicate-across-sources, 602 new. **Next: WP1.6** — curated PSUs/statutory/universities/missions; unlike WP1.2/1.3/1.5 this one is explicitly *not* a mechanical crawl (Read first: DESIGN §2's T1/T2/T3 rows + Appendix A) — locate the Bureau of Public Enterprises PSU list and match each org's URL by its own name via the state portal or existing candidates, never by guessing a hostname; anything with no discoverable URL goes in `registry/candidates/no-website.yaml`, which is itself a finding, not a failure.

- **2026-09-20 · WP1.4** — All 1,200 LSGIs harvested from lsgkerala.gov.in into `registry/sites/lsg-*.yaml`, exact expected counts (6/87/14/152/941), `validate` exits 0, `places.yaml` grew by exactly 1,200. Two real bugs found only by running the full 60-page harvest, not by reading the site by hand: (1) past the last real page the site doesn't return empty — it clamps and re-serves page 59 forever, so pagination now stops on "this page's codes are all already seen," not "0 rows"; (2) `AbortSignal.timeout()`'s internal timer can fire after a fetch already settled, throwing an uncaught exception outside any try/catch (a known Node/undici quirk) — replaced with a manually-cleared `AbortController`. Two data findings, both real and neither fabricated: lsgkerala.gov.in itself lists 5 pairs of distinct, same-named grama panchayats in different districts (e.g. two "Alakode") under the *identical* website URL — its subdomain scheme collides on name, not code, so this is a live citizen-facing bug on their end; recorded via a mutual `shares-url-with:<id>` marker in `notes` and a matching, narrowly-scoped exception in `audit/src/validate.ts`'s `unique-url` check (ADR-022), instead of guessing which organisation the site belongs to. Per the user's own redirect to opendatakerala.org (this session), its LSG2025 election portal publishes boundary polygons keyed by the exact same `Localbody Code` scheme — switched the coordinate source from Wikidata (name-matched, 1019/1200, ~0 for block/district panchayats) to these boundary centroids (code-matched via `topojson-client`+`d3-geo`, **1200/1200**, closing the ADR-021 gap entirely) — ADR-023. `verifier` ran on the new `validate.ts` test coverage (agent ad2b02f8a3305b17d): confirmed the core logic (mutual AND, regex-bounded exact-id match) is correct, but found the two new fixtures had two coverage gaps — the one-sided test only caught its mutation by coincidence of fixture ordering, and nothing exercised the id-boundary (a loose substring check would have passed both original fixtures unchanged). Fixed with two more fixtures (`shared-url-one-sided-reversed`, `shared-url-substring-trap`); both flagged mutations now confirmed red by hand, `validate.ts` restored exactly, 25/25 tests green (commit f48e4f9, after the harvest commit ffabef5). **Next: WP1.5** — the 14 district portals (`<district>.nic.in`), read DESIGN §2's T4 row first; expect S3WaaS-style pages similar to WP1.2/1.3's reverse-engineering, one candidates file per district.

- **2026-09-20 · WP1.3** — `goidirectory.gov.in` (DESIGN.md's name for this source) doesn't resolve at all (DNS SERVFAIL); found via search that NIC renamed the same service to `igod.gov.in` ("Integrated Government Online Directory," same stated purpose) — used that instead, recorded rather than silently substituted. `scripts/harvest/goidirectory.ts` drives igod's Kerala advanced-search (`state_id=KL`, 436 results) via its own AJAX pagination (`/advanced_search_more/<offset>/5`, reverse-engineered from the site's own network requests — offset step and page size are both fixed at 5 by their frontend, other values silently fall back to the homepage). 355 candidates written; 81 of the 436 results are name-only with no URL at all (not an error — genuinely no website; that's WP1.6's `no-website.yaml` finding, left alone here). `hints.department` is auto-matched this time (igod's org names are English, so normalised string matching against `departments.yaml` is reliable enough to automate, unlike WP1.2's Malayalam names which needed a hand-verified table). Measured the actual overlap with WP1.2 directly (dedupeKey intersection, not just merge-candidates' combined "duplicate" bucket): ~10-13%, well under the WP text's 40-70% guess — recorded honestly rather than reconciled; the two sources structurally cover different things (kerala-gov-in: agencies each department links to; igod: PSUs, colleges, police-district and land-record sites), which is exactly the point of having both. **Next: WP1.4** — all 1,200 LSGIs from lsgkerala.gov.in, written straight to `registry/sites/lsg-*.yaml` (the one ADR-018 exception, since this source is fully structured). This is the biggest single WP so far; read DESIGN §2's T5 row, §3.1 and ADR-008 before starting, and expect it to need its own careful district-name alias handling (Kasargod/Kasaragod, Trivandrum/Thiruvananthapuram, etc. — see the WP text for the full list).
- **2026-09-20 · WP1.2** — `scripts/harvest/kerala-gov-in.ts` fetched all 45 Secretariat department pages (found via kerala.gov.in's "Secretariat Departments" nav — a JS mega-menu, not a crawlable homepage link, encoded department ids reverse-engineered by inspecting the site's own network requests) and each one's "related websites" tab (a JSON endpoint, `/appdepartmentcontent/<id>/related_link`, likewise reverse-engineered), writing 300 candidates in one ~90-request pass with a 300ms gap between requests and a self-identifying User-Agent. `hints.department` uses a hand-built, hand-verified map from kerala.gov.in's own Malayalam department names to `registry/departments.yaml` ids (their wording differs from our own `name_ml`, so this genuinely needed a human pass, not string-matching); one department (Sainik Welfare) has no Appendix C equivalent and is left unmapped. Fixed two things caught only by actually running it against the real site: a malformed source URL was aborting an entire department's batch via `.map()`'s atomic failure (now a per-entry try/catch), and two data-entry typos on kerala.gov.in's own pages (`http://https://` and a stray space after the scheme) needed cleanup before `new URL()` would accept them. Spot-checking entries by hand (per the WP's own Verify step) found a real, pre-existing bug on kerala.gov.in itself: the Transport department's related-links table has two adjacent rows transposed (KRDCL's link points to NATPAC's URL and vice versa) — confirmed against the raw source, not a parsing artifact; flagging for WP1.7 curation rather than silently "fixing" it (we don't know which URL is correct). Also passively noticed, while just following a normal navigation link: kerala.gov.in has debug mode enabled in production on at least one route (`/appdepartmentdetail/1`) and returns a full Laravel stack trace with SQL queries, framework/PHP versions, and session cookie data on a 500 — a real, live information-disclosure issue on a government production site, unrelated to this WP; the human should be told directly rather than this being buried in a routine handoff note (told them in-session). **Next: WP1.3** — goidirectory.gov.in, expect 40-70% overlap with WP1.2 per the WP text.
- **2026-09-20 · WP1.1** — `scripts/harvest/lib.ts` (`emit`, `dedupeKey`, `writeCandidates`) and `merge-candidates.ts` are in, plus a new root `package.json` (tsx + js-yaml) since harvest tooling runs standalone via `npx tsx scripts/harvest/<name>.ts`, separate from `audit`/`site`. `emit()` keeps a candidate URL's scheme (http/https are different registry values); `dedupeKey()` folds scheme+host-case for matching only. `merge-candidates.ts` categorizes every `registry/candidates/*.yaml` entry against the live registry as already-registered / duplicate-across-sources / new, without writing anything — confirmed "0 new" on the still-empty candidates dir. verifier caught a real gap: the categorization logic had no tests of its own (two silent-corruption mutations went undetected); fixed by pulling it into an exported `categorize()` function with 4 tests, both mutations now caught, reverified by hand. `CLAUDE.md`'s Build & test table also got a small accuracy fix (site is Astro 7, not 5 — stale since WP0.4's vulnerability bump) plus a new row for the root scripts tooling. **Next: WP1.2**, the first real harvest — fetching kerala.gov.in's directory pages is live, human-supervised web fetching (not the recurring audit), one session per DESIGN's harvest guidance; record exactly which source URLs were fetched and how many candidates each produced.
- **2026-09-20 · WP0.4** — `site/` (Astro 7, static output) is live at https://govwebsite.hashin.me: `/`, `/sites/<id>/` (all 10 seed sites), `/methodology/`, `/about/`. `site/src/lib/data.ts` loads the registry via `audit`'s compiled loader (`audit/dist/registry.js` — `audit/tsconfig.json` now emits declarations so `site` gets typed imports) and reads `data/summary.json`/`data/results/*.json` when present, defaulting every site to `unaudited`. Self-hosted Manjari (Malayalam) woff2s fetched from Google Fonts' open-source repo, with `OFL.txt` alongside them — confirmed via network tab that only same-origin requests fire. `.github/workflows/build-deploy.yml` checks out `main` + `data`, builds `audit` then `site`, deploys via `actions/deploy-pages`. Three bugs found and fixed only by actually watching CI and the live site, not by local checks alone: (1) `site`'s `lint`/`test`/`build` scripts needed `cd ../audit && npm ci && npm run build` in their pre-hooks, not just `npm run build` — `test.yml`'s `audit` and `site` jobs run on separate isolated runners, so `site`'s checkout never has `audit`'s dependencies installed unless it does so itself; my first fix (build only, no `ci`) still failed in CI because I'd tested locally with `audit/node_modules` already present from earlier work. (2) The live homepage read `data/summary.json` (a real file — WP0.1's bootstrap stub, since no summary-writing job exists until WP2.2) and trusted its placeholder `coverage.total: 0` verbatim, showing "0 of 0 sites deep-audited" instead of "0 of 10"; fixed by always taking `total` from the live registry instead of the file. Neither of these showed up in a plain local build, since local builds take the "`data/` absent" branch that production doesn't. **Lesson for future WPs touching CI or the live site: verify against the actual deployed/CI environment, not just a local build with different starting conditions.** Fetching the font files needed the user's explicit go-ahead first (a download from an external source); they approved Manjari Regular+Bold by name/source/size before I fetched them. `/sites/keralapsc/` 404s live — expected, that id isn't in the 10-site WP0.2 seed (it's further down DESIGN Appendix A, not yet harvested). **Phase 0 is now complete.** Next: WP1.1, the harvest framework — first Phase 1 session, read DESIGN §3.2/§6.6 and ADR-018 (candidates never go straight into `registry/sites/`).
- **2026-09-20 · WP0.3** — `.github/workflows/validate.yml` added: builds `audit/`, runs offline `validate --registry registry --json` on PRs touching `registry/**`, posts/updates a single markdown-table PR comment (`<!-- registry-validate -->`) via `actions/github-script`, fails the check on any failure. `test.yml` needed no change — its WP0.1 guards now pick up `audit/`'s real `package.json`. Verified live with a throwaway PR (#1, github.com/hashin/kerala-web-watch/pull/1, closed unmerged, branch deleted): duplicated `kerala-gov`'s id → check failed in ~15s with the exact failure table as a comment → fixed it → check passed and the *same* comment updated to "Registry is valid" rather than a new one. One oddity worth knowing: a middle commit's `synchronize` push didn't spawn its own run (GitHub coalesced it with the next push) — the fail→comment and fix→pass→comment-update transitions were still both directly observed, just across three commits instead of two; not a defect in the workflow, no action needed. The one historical red `Test` run on `main` (from the WP0.1 bootstrap commit, before `audit/` existed) is expected and left alone — the latest real `Test` run on `main` is green. Next: WP0.4 (Astro skeleton + `build-deploy.yml` + first Pages deploy) — read DESIGN §7 first.
- **2026-09-20 · WP0.2** — Registry schema (`registry/schema.json`, ajv 2020-12 `$defs` per entity), the 6 reference files (45 departments with Malayalam names, 14 districts, 22 places, 17 kinds, 21 ministerial portfolios covering all 45 departments, empty `ignore.yaml`), and the first 10 `sites/state.yaml` entries from DESIGN Appendix A are in. `audit/` package: `loadRegistry()` (URL-normalising loader with `byId`/`byDepartment`/`byDistrict`/`byMinistry` maps) and `validateRegistry()` (schema + 8 cross-reference rules: unique id, unique url incl. aliases, department/district/place/org_parent/merged-into refs resolve, place.district agreement, lsg_type iff tier=lsg, kind in kinds.yaml) plus `cli.js validate --registry <dir> [--json]`. `verifier` mutation-tested the suite and found 5 gaps (lsg_type's "missing" direction untested, unique-url never tested against aliases, org_parent/merged-into/kind rules had no fixtures at all, and dead port-stripping code in `normalizeUrl` — WHATWG's URL parser already strips default ports); all fixed, with each new/fixed rule re-mutation-tested by hand afterward to confirm it now goes red. 21 tests, 14 fixtures. `npm test`, `npm run build`, `npm run lint` all green; `validate --registry ../registry` exits 0 on the real registry, exits 2 with a correct table when an id is broken on purpose. Deviations: none — WP0.2 as specified, no ADR needed. Next: WP0.3 (CI workflows) — `test.yml` from WP0.1 needs its `hashFiles('audit/package.json')`-guarded steps confirmed to actually run now that `audit/` exists; `validate.yml` is net-new.
- **2026-09-19 · init** — Repo created at github.com/hashin/kerala-web-watch with the full design, `.claude/` convention, WP0.1 files and a guarded `test.yml`. `data` branch bootstrapped. Pages already set to source=GitHub Actions with custom domain govwebsite.hashin.me; Actions workflow permissions already read/write. Human to-dos: (1) add DNS record `govwebsite.hashin.me CNAME hashin.github.io` at the hashin.me registrar; (2) once it resolves, tick *Enforce HTTPS* in Settings → Pages; (3) answer open question 2 (contact email). Start WP0.2.
- **2026-09-19 · design** — Design (docs/DESIGN.md), agent rules (CLAUDE.md), ADRs 001–018 and this ledger written. No code exists. Start with WP0.1 once the human answers open questions 1, 2 and 4.
