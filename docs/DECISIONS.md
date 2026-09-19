# Decision log (ADRs)

Format: `ADR-NNN · Title · Status (Accepted | Proposed | Superseded by ADR-MMM) · Date`.
Never delete an ADR; supersede it. New ADRs go at the bottom. Keep each under 12 lines.
An implementing agent that needs to deviate from DESIGN.md writes a **Proposed** ADR here and stops (see CLAUDE.md).

---

## ADR-001 · Tooling is TypeScript on Node 22 · Accepted · 2026-09-19
Playwright, axe-core, Lighthouse and retire.js are all Node. One runtime, one package manager, one CI cache.
**Consequence:** no Python in the audit path. Harvest scripts may be TS or shell.

## ADR-002 · Static site is Astro + Pagefind · Accepted · 2026-09-19
Astro builds ~2,000 data-driven pages in minutes with zero client JS by default and has built-in i18n routing.
Pagefind gives full-text search on a static host, including Malayalam.
**Consequence:** no client-side data fetching; everything is rendered at build from `registry/` + `data/`.

## ADR-003 · Results live on an orphan `data` branch, squashed monthly · Accepted · 2026-09-19
Bots write ~5×/day. Keeping that on `main` bloats history and pollutes review. Trend data lives *inside* each
result (`history[90]`) and in monthly Release archives (`dataset-YYYY-MM.zip`), so git history of `data` is disposable.
**Consequence:** every workflow that needs results checks out `data` into `data/`. `squash-data.yml` rewrites the branch monthly.

## ADR-004 · Cadence: light check every 6 h for all sites; deep audit daily with batch = N/7 (cap 300, 6 shards) · Accepted · 2026-09-19
Gives `down` detection within 12 h, a weekly deep refresh of every site, and ≈ 1–2.5 h of Actions per day.
**Consequence:** the scheduler in DESIGN §6.2 is the only place cadence logic lives.

## ADR-005 · "Broken" = down ∪ hijacked ∪ broken(blank / default page / under construction / invalid certificate) · Accepted · 2026-09-19
This is the headline number. "Poor" (score < 50) is not "broken". Invalid certificate counts as broken because
browsers block the page for ordinary citizens.
**Consequence:** status is set by ★ checks (DESIGN §5.3); score is only computed for reachable, non-broken sites.

## ADR-006 · Score weights: Security 25 / Accessibility 25 / Content 15 / GIGW 15 / Performance 10 / Identity 10 · Accepted · 2026-09-19
Citizen impact first. Performance last because it is runner-dependent. Deductions C −40, H −20, M −10, L −4, I 0 per category, floored at 0.
**Consequence:** thresholds healthy ≥ 80, needs-work 50–79, poor < 50. Changing any weight needs a new ADR and a methodology-page note.

## ADR-007 · Passive, polite, charitable auditing only · Accepted · 2026-09-19
We do exactly what a browser does when a citizen visits: homepage + ≤ 30 same-site links + ≤ 20 PDFs, 1 req/s/host,
robots.txt honoured beyond the homepage, identified User-Agent. No path guessing, scanning, form posts or auth.
`down` requires two consecutive failed light checks. Geo-blocking ⇒ `unverifiable`.
**Consequence:** this is a legal and reputational boundary. Any check that would cross it is rejected in review.

## ADR-008 · All 1,200 LSGIs are in scope, with a `platform` tag · Accepted · 2026-09-19
Citizens look up their own panchayat. Most LSGI sites are templated on lsgkerala.gov.in, so platform-wide
findings are reported once at `/platforms/lsgkerala/` and inherited by member pages with a note, not repeated 941×.

## ADR-009 · Central government bodies in Kerala are out of scope · Accepted · 2026-09-19
Different owner, different accountability chain. They go in `registry/ignore.yaml` (reason: `central`).

## ADR-010 · Licences: MIT for code, CC-BY-4.0 for data · Accepted · 2026-09-19

## ADR-011 · No analytics, no third-party requests, self-hosted fonts on our own pages · Accepted · 2026-09-19
We flag third-party trackers on government sites; we cannot run them ourselves. The site is a registry entry and must score ≥ 80 in its own audit.

## ADR-012 · The registry is the single source of truth; one entry per organisation; `id` is permanent · Accepted · 2026-09-19
Mirror URLs go in `aliases`. Renames use `lifecycle: merged-into:<id>`. Every entry carries `source` (provenance)
and must pass `validate --resolve` before merge.

## ADR-013 · Check explanations live in `audit/src/checks/registry.ts` only · Accepted · 2026-09-19
Title, citizen explanation, fix, severity, reference — English required, Malayalam optional with English fallback.
The site's issue cards and the methodology page are generated from it. No duplicated copy in `site/`.

## ADR-014 · `ministers.yaml` (portfolio → departments) is separate from `departments.yaml` · Accepted · 2026-09-19
Sites link to departments (stable). Portfolios change with every cabinet and are edited in one small file.
Whether it carries minister names is a human decision (open question in STATE.md); default is portfolios only.

## ADR-015 · Lighthouse is indicative only · Accepted · 2026-09-19
Shared-runner variance is too high to set status or fail a check hard. Lighthouse scores feed `perf.*`/`a11y.lighthouse`
as informational values and generous thresholds (LCP > 4 s, weight > 3 MB).

## ADR-016 · Light checks compute a homepage content hash; material change bumps the site to the next deep batch · Accepted · 2026-09-19
Makes the system reactive (a fixed site is re-audited within 24 h) without deep-auditing everything daily.

## ADR-017 · Screenshots are WebP q60 at 1280×800 and 390×844, rewritten only when the perceptual hash changes · Accepted · 2026-09-19
Bounds `data` branch size (≤ ~230 MB worst case) and Pages bandwidth.

## ADR-018 · Registry harvests write to `registry/candidates/<source>.yaml`, never directly to `registry/sites/` · Accepted · 2026-09-19
Curation (department, district, place, kind, dedupe) is a deliberate step with review. Only LSGIs, whose source is
fully structured, are generated straight into `registry/sites/lsg-*.yaml`.

## ADR-019 · Hosted at https://govwebsite.hashin.me on GitHub Pages; repo github.com/hashin/kerala-web-watch (public) · Accepted · 2026-09-19
Custom domain via `site/public/CNAME`; Astro builds with `SITE_BASE=/`. Public repo is required for free Actions minutes
and Pages. DNS (`CNAME govwebsite → hashin.github.io`) and "Enforce HTTPS" are human steps in the Pages settings.
**Consequence:** absolute URLs in feeds, the static API, the User-Agent and issue links all use this origin.

## ADR-020 · Project convention: WPs are the plans, `docs/DECISIONS.md` is the ADR log, `verifier` runs after every WP with tests · Accepted · 2026-09-19
The generic architect/builder/verifier/explainer convention (`.claude/agents/`) is adopted with two adjustments: the main
session is the builder for WP work (the WPs already carry acceptance criteria), and `architect` is reserved for non-WP work.
`.claude/settings.json` disables auto-memory so nothing lives outside git.
