# Project state

_This file is the anchor for every session and every context compaction. Keep it short and current.
Update it at the end of every session, even a partial one. Newest handoff at the top of the Handoff log._

## Now

- **Phase:** 0 — Skeleton
- **Current WP:** WP0.1 (done at init) → next is WP0.2
- **Next action:** WP0.2 — create `registry/schema.json`, `departments.yaml` (45 ids from DESIGN Appendix C), `districts.yaml`, `places.yaml`, `kinds.yaml`, `ministers.yaml`, `ignore.yaml`, the first 10 `registry/sites/state.yaml` entries, and `audit/` with the loader + `validate`.
- **Pushes allowed:** yes — to `main` and `data` of github.com/hashin/kerala-web-watch (confirmed 2026-09-19)
- **Registry size:** 0 sites · **Deep-audited:** 0 · **Site live:** no

## Work packages

| WP | Title | Status | Commit | Notes |
|---|---|---|---|---|
| 0.1 | Repository bootstrap | done | init | includes `.claude/` convention, CNAME, test.yml skeleton |
| 0.2 | Registry schema + reference files + loader + `validate` | todo | | |
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

- **2026-09-19 · init** — Repo created at github.com/hashin/kerala-web-watch with the full design, `.claude/` convention, WP0.1 files and a guarded `test.yml`. `data` branch bootstrapped. Pages already set to source=GitHub Actions with custom domain govwebsite.hashin.me; Actions workflow permissions already read/write. Human to-dos: (1) add DNS record `govwebsite.hashin.me CNAME hashin.github.io` at the hashin.me registrar; (2) once it resolves, tick *Enforce HTTPS* in Settings → Pages; (3) answer open question 2 (contact email). Start WP0.2.
- **2026-09-19 · design** — Design (docs/DESIGN.md), agent rules (CLAUDE.md), ADRs 001–018 and this ledger written. No code exists. Start with WP0.1 once the human answers open questions 1, 2 and 4.
