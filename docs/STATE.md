# Project state

_This file is the anchor for every session and every context compaction. Keep it short and current.
Update it at the end of every session, even a partial one. Newest handoff at the top of the Handoff log._

## Now

- **Phase:** 0 — Skeleton (complete)
- **Current WP:** WP0.4 (done) → next is WP1.1
- **Next action:** WP1.1 — Harvest framework (`scripts/harvest/`). Read DESIGN §3.2, §6.6 and ADR-018 first.
- **Pushes allowed:** yes — to `main` and `data` of github.com/hashin/kerala-web-watch (confirmed 2026-09-19)
- **Registry size:** 10 sites · **Deep-audited:** 0 · **Site live:** yes — https://govwebsite.hashin.me

## Work packages

| WP | Title | Status | Commit | Notes |
|---|---|---|---|---|
| 0.1 | Repository bootstrap | done | init | includes `.claude/` convention, CNAME, test.yml skeleton |
| 0.2 | Registry schema + reference files + loader + `validate` | done | 2453922 | 21 tests; verifier ran mutation-testing, found 5 undertested rules, all fixed and re-verified |
| 0.3 | CI: test.yml, validate.yml (offline) | done | 8ce8ef6 | verified end-to-end on a real throwaway PR (#1, closed unmerged): broke an id → check failed + comment posted → fixed → check passed + same comment updated in place |
| 0.4 | Astro skeleton + build-deploy.yml + first Pages deploy | done | 40c9d45 | live at govwebsite.hashin.me; 3 follow-up fixes after the first deploy (see handoff) |
| 1.1 | Harvest framework (`scripts/harvest/`) | todo | | |
| 1.2 | Harvest kerala.gov.in directory | todo | | |
| 1.3 | Harvest goidirectory (Kerala) | todo | | |
| 1.4 | Harvest lsgkerala.gov.in → lsg-*.yaml (1,200) | todo | | |
| 1.5 | Harvest 14 district portals | todo | | |
| 1.6 | PSUs, statutory bodies, universities (curated) | todo | | |
| 1.7 | Curation pass → registry/sites/*.yaml; live-resolve; stats | todo | | |
| 2.1 | `light.ts` + tests | todo | | |
| 2.2 | `cli light`, data-branch writer, history, summary.json | todo | | |
| 2.3 | uptime.yml live | todo | | |
| 2.4 | Site v1: home + map + status lists + district pages + light-only site page | todo | | |
| 2.5 | validate.yml `--resolve` + PR comment | todo | | |
| 3.1 | Check framework, `registry.ts` (all ids, EN), `score.ts` | todo | | |
| 3.2 | Availability + identity checks + fixtures | todo | | |
| 3.3 | Security checks + retire.js + fixtures | todo | | |
| 3.4 | Content + GIGW checks (bilingual) + fixtures | todo | | |
| 3.5 | Playwright runner: capture, axe, Lighthouse, crawl, screenshots; fixture-server smoke test | todo | | |
| 3.6 | `plan` scheduler + `merge` (outlinks, phash gating) + tests | todo | | |
| 3.7 | audit.yml live (3 → 50 → cron) | todo | | |
| 4.1 | Full site page | todo | | |
| 4.2 | Ministry / department / kind / platform / leaderboard pages | todo | | |
| 4.3 | Status pages, feeds, static API, data page | todo | | |
| 4.4 | Methodology page generated from registry.ts | todo | | |
| 4.5 | Pagefind, i18n scaffold, self-audit ≥ 80 | todo | | |
| 4.6 | squash-data.yml, report.yml, issue forms | todo | | |
| 4.7 | India vantage runner (optional) | todo | | |
| 5.1 | discover.yml → candidates PR | todo | | |
| 5.2 | issue-to-pr.yml | todo | | |
| 5.3 | Malayalam explanations + UI | todo | | |
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

## Handoff log

_(newest first; 3–6 lines each: what works, what doesn't, what to do first next time)_

- **2026-09-20 · WP0.4** — `site/` (Astro 7, static output) is live at https://govwebsite.hashin.me: `/`, `/sites/<id>/` (all 10 seed sites), `/methodology/`, `/about/`. `site/src/lib/data.ts` loads the registry via `audit`'s compiled loader (`audit/dist/registry.js` — `audit/tsconfig.json` now emits declarations so `site` gets typed imports) and reads `data/summary.json`/`data/results/*.json` when present, defaulting every site to `unaudited`. Self-hosted Manjari (Malayalam) woff2s fetched from Google Fonts' open-source repo, with `OFL.txt` alongside them — confirmed via network tab that only same-origin requests fire. `.github/workflows/build-deploy.yml` checks out `main` + `data`, builds `audit` then `site`, deploys via `actions/deploy-pages`. Three bugs found and fixed only by actually watching CI and the live site, not by local checks alone: (1) `site`'s `lint`/`test`/`build` scripts needed `cd ../audit && npm ci && npm run build` in their pre-hooks, not just `npm run build` — `test.yml`'s `audit` and `site` jobs run on separate isolated runners, so `site`'s checkout never has `audit`'s dependencies installed unless it does so itself; my first fix (build only, no `ci`) still failed in CI because I'd tested locally with `audit/node_modules` already present from earlier work. (2) The live homepage read `data/summary.json` (a real file — WP0.1's bootstrap stub, since no summary-writing job exists until WP2.2) and trusted its placeholder `coverage.total: 0` verbatim, showing "0 of 0 sites deep-audited" instead of "0 of 10"; fixed by always taking `total` from the live registry instead of the file. Neither of these showed up in a plain local build, since local builds take the "`data/` absent" branch that production doesn't. **Lesson for future WPs touching CI or the live site: verify against the actual deployed/CI environment, not just a local build with different starting conditions.** Fetching the font files needed the user's explicit go-ahead first (a download from an external source); they approved Manjari Regular+Bold by name/source/size before I fetched them. `/sites/keralapsc/` 404s live — expected, that id isn't in the 10-site WP0.2 seed (it's further down DESIGN Appendix A, not yet harvested). **Phase 0 is now complete.** Next: WP1.1, the harvest framework — first Phase 1 session, read DESIGN §3.2/§6.6 and ADR-018 (candidates never go straight into `registry/sites/`).
- **2026-09-20 · WP0.3** — `.github/workflows/validate.yml` added: builds `audit/`, runs offline `validate --registry registry --json` on PRs touching `registry/**`, posts/updates a single markdown-table PR comment (`<!-- registry-validate -->`) via `actions/github-script`, fails the check on any failure. `test.yml` needed no change — its WP0.1 guards now pick up `audit/`'s real `package.json`. Verified live with a throwaway PR (#1, github.com/hashin/kerala-web-watch/pull/1, closed unmerged, branch deleted): duplicated `kerala-gov`'s id → check failed in ~15s with the exact failure table as a comment → fixed it → check passed and the *same* comment updated to "Registry is valid" rather than a new one. One oddity worth knowing: a middle commit's `synchronize` push didn't spawn its own run (GitHub coalesced it with the next push) — the fail→comment and fix→pass→comment-update transitions were still both directly observed, just across three commits instead of two; not a defect in the workflow, no action needed. The one historical red `Test` run on `main` (from the WP0.1 bootstrap commit, before `audit/` existed) is expected and left alone — the latest real `Test` run on `main` is green. Next: WP0.4 (Astro skeleton + `build-deploy.yml` + first Pages deploy) — read DESIGN §7 first.
- **2026-09-20 · WP0.2** — Registry schema (`registry/schema.json`, ajv 2020-12 `$defs` per entity), the 6 reference files (45 departments with Malayalam names, 14 districts, 22 places, 17 kinds, 21 ministerial portfolios covering all 45 departments, empty `ignore.yaml`), and the first 10 `sites/state.yaml` entries from DESIGN Appendix A are in. `audit/` package: `loadRegistry()` (URL-normalising loader with `byId`/`byDepartment`/`byDistrict`/`byMinistry` maps) and `validateRegistry()` (schema + 8 cross-reference rules: unique id, unique url incl. aliases, department/district/place/org_parent/merged-into refs resolve, place.district agreement, lsg_type iff tier=lsg, kind in kinds.yaml) plus `cli.js validate --registry <dir> [--json]`. `verifier` mutation-tested the suite and found 5 gaps (lsg_type's "missing" direction untested, unique-url never tested against aliases, org_parent/merged-into/kind rules had no fixtures at all, and dead port-stripping code in `normalizeUrl` — WHATWG's URL parser already strips default ports); all fixed, with each new/fixed rule re-mutation-tested by hand afterward to confirm it now goes red. 21 tests, 14 fixtures. `npm test`, `npm run build`, `npm run lint` all green; `validate --registry ../registry` exits 0 on the real registry, exits 2 with a correct table when an id is broken on purpose. Deviations: none — WP0.2 as specified, no ADR needed. Next: WP0.3 (CI workflows) — `test.yml` from WP0.1 needs its `hashFiles('audit/package.json')`-guarded steps confirmed to actually run now that `audit/` exists; `validate.yml` is net-new.
- **2026-09-19 · init** — Repo created at github.com/hashin/kerala-web-watch with the full design, `.claude/` convention, WP0.1 files and a guarded `test.yml`. `data` branch bootstrapped. Pages already set to source=GitHub Actions with custom domain govwebsite.hashin.me; Actions workflow permissions already read/write. Human to-dos: (1) add DNS record `govwebsite.hashin.me CNAME hashin.github.io` at the hashin.me registrar; (2) once it resolves, tick *Enforce HTTPS* in Settings → Pages; (3) answer open question 2 (contact email). Start WP0.2.
- **2026-09-19 · design** — Design (docs/DESIGN.md), agent rules (CLAUDE.md), ADRs 001–018 and this ledger written. No code exists. Start with WP0.1 once the human answers open questions 1, 2 and 4.
