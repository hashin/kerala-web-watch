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

## ADR-021 · `place.lat`/`place.lon` are optional · Accepted · 2026-09-20
WP1.4 (harvesting all 1,200 LSGIs) asks for a `places.yaml` entry per local body, but lsgkerala.gov.in's own directory
gives name/code/website only — no coordinates — and there is no authoritative source for 1,200 individual panchayat
centroids to hand. Fabricating coordinates would be exactly the kind of invented data `CLAUDE.md` forbids for URLs;
the same principle applies here. Wikidata (queried live by `scripts/harvest/lsgkerala.ts` via SPARQL, matched by name
+ district) supplies real coordinates for most grama panchayats, municipalities and corporations, but has essentially
no coverage for block or district panchayats. Rather than block the whole harvest on this gap, `registry/schema.json`'s
`Place.lat`/`Place.lon` become optional (`null` allowed); a site's own registry entry, id and district are unaffected
and fully populated regardless of whether its place has coordinates yet.
**Consequence:** the map (Phase 4) must handle a place with no coordinates (omit it, or show it unplaced) rather than
assume every place plots. A future WP can backfill the remaining gaps from a proper geocoding pass or corrected
Wikidata data.

## ADR-022 · A documented `notes` marker, not a guess, resolves genuine shared-URL collisions · Accepted · 2026-09-20
WP1.4's harvest found 5 pairs of distinct grama panchayats (different codes, different districts -- e.g. Alakode in
Idukki and Alakode in Kannur) whose lsgkerala.gov.in listing gives the *identical* website URL. The platform names
panchayat subdomains after the panchayat's name, not its code, so two same-named panchayats in different districts
genuinely collide; the templated homepage (generic Malayalam "Home | Grama Panchayat" title) gives no way to tell
which organisation the live site actually belongs to, and picking one would be inventing a fact `CLAUDE.md` forbids.
Both organisations are real and belong in the registry (ADR-008/ADR-012), so neither entry is dropped. Each of the
10 affected entries' `notes` records `shares-url-with:<other-id>` naming its pair; `crossReferenceFailures` in
`audit/src/validate.ts` treats a `unique-url` collision as resolved, not failed, only when both sides carry that
exact mutual marker -- an ordinary accidental duplicate registration (no marker) still fails loud.
**Consequence:** this is a live citizen-facing bug on lsgkerala.gov.in itself (one district's official panchayat URL
may show another district's panchayat), not a bug in our data. Phase 2/3 audit checks should flag org-identity
mismatches like this on their own merits; this ADR only covers how the registry records the ambiguity.

## ADR-023 · LSGI place coordinates come from opendatakerala.org boundary polygons, not Wikidata · Accepted · 2026-09-20
ADR-021 accepted null coordinates for block/district panchayats because Wikidata had essentially no P625 claims for
those two LSGI types. Directed to opendatakerala.org (the same source ADR-021 already pointed at for LSGI data),
`scripts/harvest/lsgkerala.ts` found its 2025 election portal publishes topojson boundary polygons for all five
LSGI types, each feature carrying an `LSG_code` in the exact same format as lsgkerala.gov.in's own Localbody Code.
Matching by code (via `topojson-client` to decode + `d3-geo`'s `geoCentroid` for a proper spherical centroid) is
exact, unlike the Wikidata lookup's name/slug matching, which also mismatched on real naming differences (Kochi
Corporation vs. Wikidata's "Cochin Municipal Corporation") until manually patched. This replaces the Wikidata
SPARQL lookup entirely: all 1200 LSGI places (up from 1019/1200) now get a real, source-derived coordinate, closing
the block/district panchayat gap ADR-021 flagged.
**Consequence:** ADR-021's schema-level allowance (`Place.lat`/`Place.lon` nullable) stays in place as a safety net
for any future code that fails to match a boundary, but is no longer expected to be hit for LSGI places. `topojson-client`,
`d3-geo` and their `@types` packages are new root devDependencies, used only by this harvest script.

## ADR-024 · District portal harvest targets homepages, not "Departments" pages · Accepted · 2026-09-20
WP1.5's own text assumed the 14 `<district>.nic.in` (S3WaaS) portals link out to external department/office
websites from their "Departments"/"Public Utilities"/"Department Directory" pages, the same shape as WP1.2's
kerala.gov.in harvest. Checked by hand across five districts (Trivandrum, Ernakulam, Pathanamthitta, Kozhikode,
Thrissur) and every page type those sections offer: they are consistently informational only -- office name,
phone, a personal staff member's name and email -- with zero outbound `<a href>` links, and scraping the personal
names would cross into privacy territory this project doesn't need for a website registry regardless. The one
place genuine external links do appear is each district's own homepage (notices, quick-links widgets), which
varies district to district and does surface real Kerala state/district sites (e.g. `dtpcalappuzha.com`,
`keralamvd.gov.in`) alongside a large, near-identical block of central-government/platform links (India.gov.in,
Digital India, PMNRF, NIC, MeitY, S3WaaS, social media, app-store, YouTube-embed noise). `scripts/harvest/district-portals.ts`
harvests the homepage instead, with a hand-verified `IGNORE_HOSTS` map (every entry actually observed, not
guessed) routing that central/platform noise to `registry/ignore.yaml` rather than the candidates files.
**Consequence:** WP1.5's per-district candidate counts are driven by whatever each homepage happens to link to
(2 for Wayanad's differently-templated site, up to 26 for Pathanamthitta) rather than a uniform "Departments"
crawl; this is recorded honestly rather than padded. The 14 collectorate portal URLs themselves are always
included as one certain candidate per district (`hints.kind: district_admin`), since DESIGN §2's T4 row counts
them as sites in their own right regardless of what else a given homepage links to.

## ADR-025 · Long listing pages paginate at build time; a Lighthouse performance budget applies to every listing page · Accepted · 2026-09-21
At 1,500+ sites, an unpaginated table on `/`, `/districts/<d>/`, `/departments/<d>/`, `/status/<s>/` or `/kinds/<k>/`
would blow past WP2.4's own ~150 KB HTML guidance and hurt the mobile-first citizen this project is for (DESIGN §7.4).
Client-side fetch/infinite-scroll was rejected: it needs client JS and a data endpoint, against ADR-002's
zero-JS-by-default static build. Instead, any listing whose full table exceeds 100 rows is split with Astro's
built-in `paginate()` into build-time pages (e.g. `/departments/<slug>/2/`), 100 rows each, with prev/next links
and a page-count label; a listing that's already small (one district's grama panchayats) stays one page.
**Consequence:** WP2.4, WP4.2 and WP4.3 each get an explicit pagination step for their listing pages. Every WP that
ships a listing page adds a Lighthouse performance run (mobile, simulated 4G — DESIGN §5's `perf.lighthouse` method)
against the built page to its Verify step, target ≥ 90, rather than deferring all performance checking to WP4.5's
self-audit.
