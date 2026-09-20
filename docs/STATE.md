# Project state

_This file is the anchor for every session and every context compaction. Keep it short and current.
Update it at the end of every session, even a partial one. Newest handoff at the top of the Handoff log._

## Now

- **Phase:** 0 — Skeleton
- **Current WP:** WP0.2 (done) → next is WP0.3
- **Next action:** WP0.3 — `.github/workflows/validate.yml`: build `audit/`, run `validate --registry registry --json` on PRs touching `registry/**`, post the markdown table as a PR comment (create-or-update, tagged `<!-- registry-validate -->`). `test.yml` already exists from WP0.1; confirm it also runs `audit/`'s new `npm test`/`npm run build`.
- **Pushes allowed:** yes — to `main` and `data` of github.com/hashin/kerala-web-watch (confirmed 2026-09-19)
- **Registry size:** 10 sites · **Deep-audited:** 0 · **Site live:** no

## Work packages

| WP | Title | Status | Commit | Notes |
|---|---|---|---|---|
| 0.1 | Repository bootstrap | done | init | includes `.claude/` convention, CNAME, test.yml skeleton |
| 0.2 | Registry schema + reference files + loader + `validate` | done | 2453922 | 21 tests; verifier ran mutation-testing, found 5 undertested rules, all fixed and re-verified |
| 0.3 | CI: test.yml, validate.yml (offline) | partial | init | `test.yml` exists with hashFiles guards; `validate.yml` still to do |
| 0.4 | Astro skeleton + build-deploy.yml + first Pages deploy | todo | | |
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
2. Contact email for the User-Agent string and About page.
3. Should `registry/ministers.yaml` carry minister names or only portfolio labels? (default: portfolios only, ADR-014)
4. ~~Pushes~~ — allowed (confirmed 2026-09-19).
5. Provide `SAFE_BROWSING_KEY` secret? (optional; `sec.safe_browsing` is skipped without it)
6. India self-hosted runner for WP4.7? (optional)

## Handoff log

_(newest first; 3–6 lines each: what works, what doesn't, what to do first next time)_

- **2026-09-20 · WP0.2** — Registry schema (`registry/schema.json`, ajv 2020-12 `$defs` per entity), the 6 reference files (45 departments with Malayalam names, 14 districts, 22 places, 17 kinds, 21 ministerial portfolios covering all 45 departments, empty `ignore.yaml`), and the first 10 `sites/state.yaml` entries from DESIGN Appendix A are in. `audit/` package: `loadRegistry()` (URL-normalising loader with `byId`/`byDepartment`/`byDistrict`/`byMinistry` maps) and `validateRegistry()` (schema + 8 cross-reference rules: unique id, unique url incl. aliases, department/district/place/org_parent/merged-into refs resolve, place.district agreement, lsg_type iff tier=lsg, kind in kinds.yaml) plus `cli.js validate --registry <dir> [--json]`. `verifier` mutation-tested the suite and found 5 gaps (lsg_type's "missing" direction untested, unique-url never tested against aliases, org_parent/merged-into/kind rules had no fixtures at all, and dead port-stripping code in `normalizeUrl` — WHATWG's URL parser already strips default ports); all fixed, with each new/fixed rule re-mutation-tested by hand afterward to confirm it now goes red. 21 tests, 14 fixtures. `npm test`, `npm run build`, `npm run lint` all green; `validate --registry ../registry` exits 0 on the real registry, exits 2 with a correct table when an id is broken on purpose. Deviations: none — WP0.2 as specified, no ADR needed. Next: WP0.3 (CI workflows) — `test.yml` from WP0.1 needs its `hashFiles('audit/package.json')`-guarded steps confirmed to actually run now that `audit/` exists; `validate.yml` is net-new.
- **2026-09-19 · init** — Repo created at github.com/hashin/kerala-web-watch with the full design, `.claude/` convention, WP0.1 files and a guarded `test.yml`. `data` branch bootstrapped. Pages already set to source=GitHub Actions with custom domain govwebsite.hashin.me; Actions workflow permissions already read/write. Human to-dos: (1) add DNS record `govwebsite.hashin.me CNAME hashin.github.io` at the hashin.me registrar; (2) once it resolves, tick *Enforce HTTPS* in Settings → Pages; (3) answer open question 2 (contact email). Start WP0.2.
- **2026-09-19 · design** — Design (docs/DESIGN.md), agent rules (CLAUDE.md), ADRs 001–018 and this ledger written. No code exists. Start with WP0.1 once the human answers open questions 1, 2 and 4.
