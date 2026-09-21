# Implementation guide

Written for the implementing agent (Claude Sonnet 5, effort **high**). You are thorough by default; this
document's job is to bound each session so thoroughness goes into the work package in front of you, not into
re-deriving the design. `docs/DESIGN.md` says *what and why*. This file says *in what order, in what pieces,
and how you prove each piece is done*.

## 0. How to use this file

- Do **not** read this file end to end. Find your WP: `grep -n "^### WP" docs/IMPLEMENTATION.md`, then
  `sed -n 'START,ENDp'`. Also read §1 (protocol) once per session — it is short.
- Every WP has the same shape: **Goal · Read first · Produces · Steps · Verify · Done when · Commit**.
  "Verify" is mechanical: commands and the output you must see. "Done when" is the acceptance criterion the
  next session will trust without re-checking.
- WPs are ordered by dependency. Do them in order unless STATE.md says otherwise.
- Sizing: each WP is designed to fit in one session with room to spare. If you are at roughly half your
  context and the WP is not finished, follow the session-end protocol in CLAUDE.md and stop.

## 1. Operating protocol

### 1.1 Session start (every time, including after a compaction)
1. Read `CLAUDE.md`, `docs/STATE.md` (all of it — it is short), skim ADR titles in `docs/DECISIONS.md`.
2. `git status --short && git log --oneline -5` — confirm the tree matches STATE.md. If it does not, STATE.md
   is stale: reconcile it from `git log` before doing anything else, and note the discrepancy in the handoff.
3. Load only your WP section and the DESIGN.md sections it names.
4. Write a 3-line plan for the WP in your reply (not a file), then execute.

### 1.2 During the session
- Work in small verified increments: write → run → fix. Commit at natural checkpoints inside a WP
  (`wip(audit): …` is acceptable mid-WP; squash is not required).
- Keep tool output small (CLAUDE.md context rules). If a command floods, re-run with `| head`.
- When you are unsure how something in the design should behave, look for the answer in this order:
  the WP text → the cited DESIGN.md section → DECISIONS.md → then decide yourself if it is an implementation
  detail, or write a Proposed ADR if it is a product decision (CLAUDE.md decision protocol).
- Do not touch files outside the WP's **Produces** list except to fix something the WP's Verify step
  exposes. Note any such fix in the handoff.

### 1.3 Session end
Exactly as CLAUDE.md says: test → commit → STATE.md (row, Next action, deviations, open questions) → handoff
entry → push only if allowed. Your handoff entry must let a fresh session with zero memory continue in under
five minutes. Name files and commands, not feelings.

### 1.4 Compaction survival
Your context may be summarised at any time. The only things that reliably survive are files. Therefore:
- STATE.md **Next action** is always literally the next command or edit, e.g.
  `Next action: WP3.4 — implement content.legacy_font in audit/src/checks/content.ts; fixture tests/fixtures/legacy-font.html exists and currently fails.`
- Before any long-running or multi-step operation (a harvest, a first live workflow run), write what you are
  about to do to STATE.md first.
- After a compaction, assume you remember *nothing* about file contents. Re-read the lines you need.

### 1.5 Decisions and intent
- Product intent is in CLAUDE.md ("Why this exists") and DESIGN.md §0–1. When choosing between two valid
  implementations, choose the one that better serves the Kollam citizen on a phone and the webmaster who has
  to fix the site.
- DECISIONS.md is append-only. Read the ADRs your WP cites before starting; they pre-empt the most tempting
  "improvements" (daily deep audits of everything, data on main, a fancier scoring model, active scanning).

## 2. Human checklist (things the agent must ask for, not do)

| When | Action |
|---|---|
| Before WP0.1 | ~~Create the repo~~ (done 2026-09-19: github.com/hashin/kerala-web-watch, public); answer STATE.md open question 2 |
| WP0.1 | Settings → Actions → General → Workflow permissions → **Read and write** |
| WP0.4 | Settings → Pages → Source: **GitHub Actions**; Custom domain `govwebsite.hashin.me`; tick **Enforce HTTPS** once the certificate is issued. DNS: `CNAME govwebsite → hashin.github.io` at the registrar for hashin.me |
| WP2.3 / WP3.7 | Trigger the first `workflow_dispatch` runs (or allow the agent to via `gh workflow run`) and watch them |
| WP3.7 | (optional) add secret `SAFE_BROWSING_KEY` |
| WP4.7 | (optional) register a self-hosted runner in India with label `india` |
| Ongoing | Review and merge weekly discovery PRs; answer correction issues |

## 3. Global conventions

### 3.1 Stack and versions
Node 22 (`.nvmrc`), TypeScript 5 strict ESM (`"type": "module"`, `moduleResolution: NodeNext`), vitest,
prettier defaults, `yaml` (npm) for YAML, `ajv` for schema, `undici` for HTTP, `playwright` (chromium only),
`@axe-core/playwright`, `lighthouse`, `retire` (CLI, invoked on collected script URLs), `sharp` (WebP + hash),
`robots-parser`, `tldts` (registrable domain), `p-limit`. Astro 5, `astro-pagefind` or the Pagefind CLI post-build.
Two independent packages (`audit/package.json`, `site/package.json`); no workspaces, no monorepo tooling.

### 3.2 CLI contract (`audit/src/cli.ts`, built to `audit/dist/cli.js`)
```
plan      --registry <dir> --data <dir> [--refresh-days 7] [--max-batch 300] [--max-shards 6]
          [--site-ids a,b] [--batch-size n] [--dry-run]
          → prints a table to stderr; writes `matrix=<json>` and `batch_id=<YYYYMMDD-n>` to $GITHUB_OUTPUT
            (to stdout when $GITHUB_OUTPUT is unset)
light     --registry <dir> --data <dir> (--all | --ids a,b) [--limit n] [--concurrency 25] [--vantage gh-us]
          → updates data/results/<id>.json (light, history) and data/summary.json in place
run       --registry <dir> --ids a,b --out <dir> [--vantage gh-us] [--no-lighthouse] [--no-crawl] [--fixture-base <url>]
          → out/results/<id>.json  out/screenshots/<id>.webp, <id>-m.webp  out/outlinks/<id>.json
merge     --in <dir> --registry <dir> --data <dir>
          → merges out/ into data/ (results, screenshots with phash gate, outlinks.json), rewrites summary.json
validate  --registry <dir> [--resolve] [--changed-only <git-ref>] [--json]
          → exit 2 on any validation failure; prints a markdown table (used as PR comment)
discover  --registry <dir> --data <dir> --out registry/candidates/discovered.yaml
self-test --fixture-base <url>            → runs `run` against the fixture server, asserts expected statuses
```
Exit codes: 0 ok · 1 unexpected error · 2 validation/assertion failure. All commands accept `--help`.
Never make network requests in `plan`, `merge`, `validate` (without `--resolve`) or in unit tests.

### 3.3 Result and summary shapes
Result record: DESIGN §5.5, verbatim. `summary.json`:
```json
{ "generated": "<iso>", "vantages": ["gh-us"],
  "totals": {"sites":0,"deep_audited":0,"down":0,"hijacked":0,"broken":0,"unverifiable":0,"unaudited":0,"poor":0,"needs_work":0,"healthy":0},
  "coverage": {"deep_audited":0,"total":0,"eta":"<date|null>"},
  "by_district": {"<id>": {"sites":0,"broken":0,"median":null}},
  "by_department": {}, "by_ministry": {}, "by_kind": {}, "by_platform": {},
  "top_issues": [{"id":"sec.hsts","count":0}],
  "recent_broken": [{"id":"","since":"<date>"}], "recent_fixed": [{"id":"","since":"<date>"}],
  "sites": [{"id":"","status":"","score":null,"light_at":null,"deep_at":null,"district":"","department":"","kind":""}] }
```
`sites[]` is the homepage's only data source; keep it under ~300 KB for 2,000 sites (short keys, no evidence).

### 3.4 Testing strategy
- **Unit (vitest):** every check function against HTML/header fixtures in `audit/tests/fixtures/`. A fixture is
  a small hand-written HTML file plus, where needed, a `.headers.json`. Name fixtures after the failure they
  demonstrate (`parked-godaddy.html`, `legacy-font-karthika.html`, `lang-en-but-malayalam.html`).
- **Fixture server:** `audit/tests/fixture-server.ts` serves `tests/fixtures/sites/<name>/` on `localhost:4173`
  with configurable headers/status per site (a JSON manifest). `self-test` runs the *real* deep audit against it.
  This is how the runner is tested without touching a live site.
- **Never** run tests against live government sites. One request to a well-known public host (e.g. `example.com`)
  is allowed in a single TLS-parsing test, tagged `@live` and skipped in CI (`vitest --exclude '**/*.live.test.ts'`).
- **Workflows:** first runs are always `workflow_dispatch` with a tiny scope (`--limit 50` / `site_ids` of 3),
  observed, then widened. Cron is enabled last.

### 3.5 Commit messages
Conventional: `feat(audit): …`, `feat(site): …`, `feat(registry): …`, `fix: …`, `chore: …`, `ci: …`, `docs: …`,
`data: …` (bot only). One WP ≈ 1–4 commits. Reference the WP in the body: `WP3.4`.

### 3.6 Code shape for checks
```ts
export interface CheckContext {
  site: Site; light: LightResult;
  html?: string; text?: string; doc?: Document /* linkedom */;
  headers: Record<string,string>; status: number; finalUrl: string;
  cssTexts: string[]; scriptUrls: string[]; links: Link[]; requests: RequestLog[];
  axe?: AxeSummary; lighthouse?: LhSummary; crawl?: CrawlSummary; rdap?: RdapInfo;
  consoleErrors: string[]; malayalamRatio: number;
}
export type CheckResult = { id: CheckId; r: 'pass'|'warn'|'fail'|'na'; ev?: string };
export type Check = { id: CheckId; appliesTo?: (site: Site) => boolean; run: (ctx: CheckContext) => CheckResult };
```
Checks are pure. Anything that fetches lives in `light.ts`, `runner.ts` or `crawl.ts`, and populates the context.

---

# Phase 0 — Skeleton

### WP0.1 — Repository bootstrap
**Goal:** a public repo with the agreed layout, docs, licences, tooling config and an empty `data` branch.
**Read first:** CLAUDE.md; DESIGN §8.
**Produces:** `README.md` `CONTRIBUTING.md` `CODE_OF_CONDUCT.md` `LICENSE` (MIT) `LICENSE-DATA` (CC-BY-4.0)
`.gitignore` `.editorconfig` `.nvmrc` `.github/CODEOWNERS` `scripts/bootstrap-data-branch.sh`; directories
`registry/ audit/ site/ scripts/harvest/ docs/ .github/workflows/ .github/ISSUE_TEMPLATE/` (with `.gitkeep`).
`docs/` already holds DESIGN.md, IMPLEMENTATION.md, DECISIONS.md, STATE.md; `CLAUDE.md` at root.
**Steps:**
1. If the human has not created the repo, stop and ask (checklist §2). If `gh` is authenticated and the human
   said so, `gh repo create <name> --public --source . --push` is acceptable.
2. `README.md`: one paragraph of intent (copy from CLAUDE.md), status badge placeholders, link to docs, licence lines.
3. `.gitignore`: `node_modules/ dist/ .astro/ out/ data/ *.log .DS_Store audit/tests/.tmp/`. Note `data/` is
   ignored on main because it is a checkout of the other branch.
4. `scripts/bootstrap-data-branch.sh` (idempotent):
   ```bash
   set -euo pipefail
   git fetch origin data 2>/dev/null && { echo "data branch exists"; exit 0; }
   tmp=$(mktemp -d); pushd "$tmp"
   git init -q -b data; mkdir -p results screenshots
   echo '{"generated":null,"totals":{},"coverage":{"deep_audited":0,"total":0,"eta":null},"sites":[]}' > summary.json
   echo '{}' > outlinks.json; touch results/.gitkeep screenshots/.gitkeep
   git add -A; git -c user.name=bot -c user.email=bot@localhost commit -qm "data: init"
   git push "$(git -C "$OLDPWD" remote get-url origin)" data; popd; rm -rf "$tmp"
   ```
5. Run it (only if pushes are allowed; else leave for the human and say so in STATE.md).
**Verify:** `tree -L 2 -a -I .git | head -40` shows the layout; `git ls-remote --heads origin | grep data` (if pushed).
**Done when:** layout exists, docs are in place, `data` branch exists or is explicitly deferred in STATE.md.
**Commit:** `chore: bootstrap repository skeleton (WP0.1)`

### WP0.2 — Registry schema, reference files, loader, `validate`
**Goal:** the registry format is enforced by code from day one.
**Read first:** DESIGN §3.1, §3.3, §4, Appendix C; ADR-012, ADR-014.
**Produces:** `registry/schema.json` · `registry/departments.yaml` (45 entries, Appendix C) · `registry/districts.yaml`
(14, with `name_ml`, `hq_place`) · `registry/places.yaml` (start with the 14 HQs + every place named in DESIGN Appendix A)
· `registry/kinds.yaml` · `registry/ministers.yaml` (portfolios only; `departments: []` lists to be filled by the human)
· `registry/ignore.yaml` (empty list) · `registry/sites/state.yaml` with the first 10 entries of DESIGN Appendix A
(`verify: true` field removed — verification is `validate --resolve` in WP2.5) · `audit/package.json` `tsconfig.json`
`vitest.config.ts` · `audit/src/registry.ts` (load + normalise + types) · `audit/src/cli.ts` with `validate` only ·
`audit/tests/registry.test.ts`.
**Steps:**
1. Schema: encode every field of DESIGN §3.1 with enums for `tier`, `scope`, `lsg_type`, `platform`, `lifecycle`;
   `kind` validated against `kinds.yaml` in code (not schema). `id` pattern `^[a-z0-9][a-z0-9-]{1,48}$`.
2. `registry.ts`: `loadRegistry(dir): Registry` — reads all `sites/*.yaml`, `departments`, `districts`, `places`,
   `ministers`, `kinds`; returns typed objects plus derived maps (`byId`, `byDepartment`, `byDistrict`, `byMinistry`).
   URL normalisation: lowercase host, strip trailing slash, strip default ports, keep scheme.
3. `validate` (offline): schema per file; unique `id`; unique normalised `url` across sites+aliases; every
   `department`/`district`/`place`/`org_parent`/`merged-into` reference resolves; `place.district` matches `site.district`;
   `lsg_type` present iff `tier: lsg`; `platform` from the enum. Output a markdown table of failures; exit 2 if any.
4. Tests: valid registry loads; each rule above has a failing fixture under `audit/tests/fixtures/registry/`.
**Verify:** `cd audit && npm test --reporter=dot` green; `node dist/cli.js validate --registry ../registry` exits 0;
break an id on purpose → exits 2 with a table → revert.
**Done when:** the above passes and `registry/sites/state.yaml` has 10 valid entries.
**Commit:** `feat(registry): schema, reference files, loader and offline validate (WP0.2)`

### WP0.3 — CI: tests and registry validation
**Goal:** every PR is tested; registry PRs are validated.
**Read first:** DESIGN §6.1 rows `validate.yml`, `test.yml`.
**Produces:** `.github/workflows/test.yml`, `.github/workflows/validate.yml`.
**Steps:** `test.yml` on push/PR touching `audit/**` or `site/**`: setup-node 22 with npm cache, `npm ci`, `npm test`,
`npm run build` in `audit/`; `site/` steps guarded by `if: hashFiles('site/package.json') != ''` until WP0.4.
`validate.yml` on PR touching `registry/**`: build audit, run `validate --registry registry --json`, post the markdown
table as a PR comment via `actions/github-script` (create-or-update a single comment tagged `<!-- registry-validate -->`).
`--resolve` is added in WP2.5.
**Verify:** open a PR that breaks a registry id; the comment appears and the check fails; fix; green.
**Done when:** both workflows are green on main.
**Commit:** `ci: test and registry validation workflows (WP0.3)`

### WP0.4 — Astro skeleton and first deploy
**Goal:** a live, empty-but-real site on GitHub Pages, built from registry + (empty) data, deploying on push.
**Read first:** DESIGN §7.1, §7.2 (rows `/`, `/sites/<id>/`, `/methodology/`, `/about/`), ADR-002, ADR-011.
**Produces:** `site/` (Astro 5, `output: 'static'`, `base` from env `SITE_BASE`, `site` from `SITE_URL`),
`site/src/lib/data.ts` (loads `../registry` via the audit package's `registry.ts` compiled output or a copied
minimal loader, and `../data/summary.json` + `../data/results/*.json` if present; returns typed `SiteView`
objects with `status: 'unaudited'` default), layouts + pages `index.astro` `sites/[id].astro` `methodology.astro`
`about.astro`, a `HealthBadge` component, self-hosted fonts (Manjari for Malayalam, system stack for Latin),
`.github/workflows/build-deploy.yml`.
**Steps:**
1. `build-deploy.yml`: `on: push: branches: [main, data]` + `workflow_dispatch`; job `build`: checkout main; checkout
   `data` into `data/` (`ref: data, path: data`); setup-node; `npm ci` in `audit` then `site`; `npm run build` in
   `audit` (site imports its loader); `npm run build` in `site` with `SITE_BASE=/` and `SITE_URL=https://govwebsite.hashin.me` (custom domain; `site/public/CNAME` already exists and must be kept);
   `actions/upload-pages-artifact` (path `site/dist`); job `deploy`: `actions/deploy-pages` with `pages: write, id-token: write`.
   `concurrency: {group: pages, cancel-in-progress: true}`.
2. Home page for now: count of registry sites, a list, coverage bar reading `summary.coverage`.
3. `about.astro` must already contain: ownership line, contact, accessibility statement stub, "Last updated" (build time),
   sitemap link (`@astrojs/sitemap`), privacy line ("no cookies, no analytics"). We must pass our own GIGW checks later.
4. `<html lang="en">`, viewport meta, skip link, semantic landmarks, visible focus styles.
5. Ask the human to enable Pages (Source: GitHub Actions). Push; watch the run.
**Verify:** `cd site && npm run build | tail -5` succeeds locally with an empty `../data`; the Pages URL serves the
home page and `/sites/keralapsc/`; `curl -sI <pages-url> | grep -i content-type`.
**Done when:** the site is live and rebuilds on push to `main` and `data`.
**Commit:** `feat(site): Astro skeleton and Pages deploy (WP0.4)`

---

# Phase 1 — The list

Harvests are I/O-heavy and page structures are unknown until you look. Each harvest WP is one session.
Use `WebFetch` (or Playwright via a tiny script) to fetch source pages; parse with `linkedom`/`cheerio`. Write
candidates, never final entries (ADR-018). Record in STATE.md exactly which source URLs were fetched and how many
candidates each produced, so a later session does not re-fetch.

### WP1.1 — Harvest framework
**Goal:** one way to write candidates with provenance; one way to merge and dedupe them.
**Read first:** DESIGN §3.2, §3.3; ADR-012, ADR-018.
**Produces:** `scripts/harvest/lib.ts` (`emit(candidate)`, URL normalisation reused from `audit/src/registry.ts`,
`writeCandidates(source, list)` → `registry/candidates/<source>.yaml`), `scripts/harvest/README.md`,
`registry/candidates/.gitkeep`, `scripts/harvest/merge-candidates.ts` (prints a dedupe report — already in registry /
duplicate across sources / new — without writing to `sites/`). Candidate tooling stays in `scripts/` and runs with
`npx tsx scripts/harvest/<name>.ts`; it is not part of the audit CLI.
Candidate shape: `{url, name, name_ml?, source, source_page, hints: {district?, department?, kind?, lsg_type?}, fetched_at}`.
**Verify:** run `merge-candidates.ts` on an empty candidates dir → "0 new"; unit test for normalisation: the registry
`url` keeps its scheme (`http://` and `https://` are different registry values), but dedupe compares lowercased
host + path only, so `http://WWW.Foo.GOV.IN/` and `https://www.foo.gov.in` are the same candidate.
**Commit:** `feat(harvest): candidate framework (WP1.1)`

### WP1.2 — Harvest kerala.gov.in
**Goal:** candidates from the state portal's department/organisation/website directories.
**Steps:** Fetch the portal home; locate directory pages (departments, "Government websites", organisations,
missions). Extract `{name, url}` per link that leaves the portal or points to a `*.kerala.gov.in` host. Attach
`hints.department` where the directory groups by department. Write `registry/candidates/kerala-gov-in.yaml`.
If the portal blocks or times out from your location, record the fact in STATE.md and move to WP1.3.
**Verify:** `grep -c "^- url:" registry/candidates/kerala-gov-in.yaml` is plausibly 100–400; spot-check 10 entries by eye.
**Commit:** `feat(harvest): kerala.gov.in candidates (WP1.2)`

### WP1.3 — Harvest goidirectory (Kerala)
**Goal:** NIC's state-wise directory as a second, independent source.
**Steps:** Fetch the Kerala state section(s) of goidirectory.gov.in (state government, districts, PSUs, universities
categories as the site organises them). Same extraction. Write `registry/candidates/goidirectory.yaml`. Run
`merge-candidates.ts` and note overlap with WP1.2 in STATE.md (expect 40–70 %).
**Commit:** `feat(harvest): goidirectory candidates (WP1.3)`

### WP1.4 — Harvest lsgkerala.gov.in → `registry/sites/lsg-*.yaml`
**Goal:** all 1,200 LSGIs as *final* registry entries (this source is structured; ADR-018 exception).
**Read first:** DESIGN §2 (T5 row), §3.1; ADR-008.
**Steps:**
1. Find the LSGI directory (district → type → list with website links). Extract name (en, ml if shown), type,
   district, website URL. Map type → `lsg_type`; district name → `districts.yaml` id (write a small alias map for
   spellings: Kasargod/Kasaragod, Trivandrum/Thiruvananthapuram, Calicut/Kozhikode, Cochin/Kochi, Alleppey/Alappuzha,
   Trichur/Thrissur, Quilon/Kollam, Cannanore/Kannur, Palghat/Palakkad).
2. `id` = `lsg-<type-abbrev>-<slug>` (`gp`, `bp`, `dp`, `mun`, `corp`), slug from the English name; disambiguate
   duplicates with the district (`lsg-gp-kadakkal-klm`).
3. `place` = a new entry in `places.yaml` per LSGI with the LSGI's own name (generate, keep district), `scope: local`,
   `tier: lsg`, `kind: <lsg_type>`, `department: lsgd`, `platform: lsgkerala` when the host is `*.lsgkerala.gov.in`
   else `null`, `priority: 2` for corporations/municipalities/district panchayats, `1` otherwise, `source` = the
   directory page URL.
4. Write five files. Do **not** open them afterwards; check with `grep -c`/`node -e`.
5. `validate` must pass. Expected counts: 6 / 87 / 14 / 152 / 941. If counts differ, record actual counts and the
   reason (merged bodies, missing links) in STATE.md; do not pad.
**Verify:** counts as above (±5 with explanation); `validate` exit 0; `wc -l registry/places.yaml` grew by ~1,200.
**Commit:** `feat(registry): all Kerala LSGIs from lsgkerala.gov.in (WP1.4)`

### WP1.5 — Harvest the 14 district portals
**Goal:** district-level office websites.
**Steps:** For each `<district>.nic.in` (S3WaaS), fetch "Departments"/"Public Utilities"/"Important links"-type pages;
extract external links; `hints.district` set; write `registry/candidates/district-<id>.yaml` (14 files).
Skip links to central bodies obviously (banks, railways, post) by adding them to `registry/ignore.yaml` with
`reason: central` — this list is reused by discovery later.
**Verify:** 14 candidate files; `ignore.yaml` has entries; `merge-candidates.ts` report in STATE.md.
**Commit:** `feat(harvest): district portal candidates (WP1.5)`

### WP1.6 — PSUs, statutory bodies, universities, missions (curated)
**Goal:** the categories directories cover badly.
**Steps:** Start from DESIGN §2 rows T1 missions, T2 statutory, T2 universities, T3 PSUs and Appendix A. For PSUs,
locate the Bureau of Public Enterprises (Kerala) list (PDF or page) and extract names; find each URL via the
organisation's own name on the state portal or goidirectory candidates — **not** by guessing hostnames. Where no
URL can be established, record the organisation in `registry/candidates/no-website.yaml` (name, source) — "has no
website" is itself a finding we will show later. Write `registry/candidates/curated.yaml` with `hints.kind` and
`hints.department` filled.
**Verify:** ≥ 15 universities, ≥ 40 statutory/mission bodies, ≥ 80 PSUs across candidates + no-website.
**Commit:** `feat(harvest): curated PSU, statutory, university candidates (WP1.6)`

### WP1.7 — Curation pass into `registry/sites/*.yaml`
**Goal:** the registry is complete enough to go live: every candidate is either a site, ignored, or parked with a reason.
**Read first:** DESIGN §3.1, §3.3, §4; ADR-012.
**Steps:**
1. `merge-candidates.ts --write-drafts` produces `registry/drafts/<tier>.yaml` with `id` proposals (slug of name),
   `department`/`district`/`place`/`kind` from hints, `source` from candidate. Never writes into `sites/`.
2. Curate tier by tier in **separate sessions if needed** (state+directorates; agencies+statutory; PSUs; universities;
   districts). For each draft: confirm/assign `department` (Appendix C ids), `district`+`place` (HQ; state bodies →
   thiruvananthapuram unless known otherwise), `kind`, `priority`. Move to `sites/<tier>.yaml`. Anything central →
   `ignore.yaml`. Anything doubtful → leave in drafts with `notes:`.
3. Each session: `validate` exit 0; update STATE.md registry size.
4. Final: `--resolve` is not available until WP2.5; that is fine. The first light check (WP2.3) will expose dead
   entries; they stay in the registry as `down` findings unless they were never real (then remove with a note).
**Verify:** `validate` exit 0; registry ≥ 1,500 entries; `drafts/` contains only items with `notes:`.
**Done when:** STATE.md shows counts per tier and the drafts backlog.
**Commit:** `feat(registry): curated state, agency, statutory, PSU, university and district entries (WP1.7)`

---

# Phase 2 — Light checks live

### WP2.1 — `light.ts`
**Goal:** the light check (DESIGN §5.2 column 1) as a pure-ish function with tests.
**Read first:** DESIGN §5.1, §5.2, §5.3 `avail.*` + `sec.https/http_redirect/cert_*/tls_version/hsts/xfo/xcto/referrer/server_banner`, §6.7; ADR-007, ADR-016.
**Produces:** `audit/src/light.ts`, `audit/src/net/{dns,tls,http}.ts`, `audit/tests/light.test.ts`, `audit/tests/tls.live.test.ts`.
**Steps:**
1. `lightCheck(site, opts): Promise<LightResult>` — sequence: DNS (`dns.promises.lookup`, both families) → TLS
   handshake to host:443 capturing cert (`tls.connect` with `rejectUnauthorized:false`, then evaluate validity
   separately: `authorized`, `authorizationError`, `validTo`, SNI hostname match, protocol) → GET `url` with `undici`
   (manual redirects up to 5, 20 s per hop, UA from config, `accept-language: ml,en`) → if `url` is https also GET
   the http variant (HEAD, 10 s) to test redirect → normalise headers → compute `content_hash` = sha256 of the body
   with whitespace collapsed and `<script>…</script>`/CSRF-looking tokens/timestamps stripped (best effort; document
   the stripping rules in a comment). Retries: 3 attempts, backoff 2 s / 5 s, only for network errors and 5xx.
2. Classify: `dns_fail | connect_fail | timeout | http_<code> | ok`; `geo_block_suspect` when 403 body matches a
   list of NIC/Cloudflare block signatures (start the list with what you can verify from fixtures; it grows later).
3. Extract `<title>`, byte size, TTFB, final URL, redirect chain, registrable domain (`tldts`) of first and final URL.
4. Tests: HTTP paths via a local `node:http` server (200, 301 chain, 404, 500, timeout, http→https redirect);
   header normalisation; content-hash stability (same page with different `<script>` → same hash). TLS validity
   logic against hand-built cert-like objects; one `@live` test against `example.com` skipped in CI.
**Verify:** `npm test` green; `node dist/cli.js light --help` prints usage (CLI wiring may be a stub until WP2.2).
**Commit:** `feat(audit): light check (WP2.1)`

### WP2.2 — `cli light`, data writer, history, summary
**Goal:** running `light --all` against the `data/` checkout updates every result file and the summary.
**Read first:** DESIGN §5.4 (status rules for down/unverifiable), §5.5, §6.4; ADR-003, ADR-005, ADR-016; §3.3 of this file.
**Produces:** `audit/src/store.ts` (read/write `data/results/<id>.json`, `summary.json`, atomic writes),
`audit/src/history.ts` (append today's entry; 90-day cap; one entry per UTC day, latest wins),
`audit/src/status.ts` (derive status from light + deep: two-strike `down`, `unverifiable`, keeps deep-derived
statuses when light is ok), `audit/src/summary.ts`, `cli light`.
**Steps:**
1. `light --all` iterates the registry with `p-limit(concurrency)`; per site: run light check → merge into the result
   file (create if missing with `status: 'unaudited'`) → mark `deep_bump: true` if the content hash / title / status
   code / final host / cert fingerprint changed since the last light result (ADR-016) → append history.
2. Two-strike rule: `down` only if the previous light result was also a failure; otherwise `status` unchanged and
   `light.suspect = true`.
3. `summary.ts` recomputes everything in §3.3 from all result files + registry (median of scores per group ignores
   nulls; `recent_broken` = status changed to a broken class within 7 days, from history; `eta` = today + ceil(remaining/batch)).
4. `--limit n` for smoke runs. Log one line per site to stderr: `id status code ms`.
**Verify:** with a scratch `data/` dir: `light --ids keralapsc,kerala-gov --data /tmp/d` (2 live requests — allowed)
creates two result files and a summary; run twice → history has one entry for today; simulate a failure with a
fake id pointing to `https://nonexistent.invalid` twice → status `down` only on the second run. Unit tests for
`history.ts`, `status.ts`, `summary.ts` with synthetic results.
**Commit:** `feat(audit): light command, result store, history and summary (WP2.2)`

### WP2.3 — `uptime.yml` live
**Goal:** all sites light-checked every 6 h, results committed to `data`, site rebuilt.
**Read first:** DESIGN §6.1, §6.3 (merge job's commit step — reuse verbatim), §6.5.
**Produces:** `.github/workflows/uptime.yml`.
**Steps:** cron `0 */6 * * *` + `workflow_dispatch` with `limit` input; `concurrency: {group: data-branch}`; checkout
main + data; build audit; `light --all --limit ${{ inputs.limit || '' }}`; commit/push loop from DESIGN §6.3.
First run: `workflow_dispatch` with `limit=50`; inspect the run log and the `data` branch (`git fetch origin data &&
git show origin/data --stat | head`). Then `limit=` (all). Then leave cron on.
**Verify:** `summary.json` on `data` shows `totals.sites` = registry size; Pages rebuilt (build-deploy triggered by push to `data`).
**Done when:** two consecutive scheduled runs succeeded. Record run durations in STATE.md.
**Commit:** `ci: uptime workflow (WP2.3)`

### WP2.4 — Site v1 (light data only)
**Goal:** a citizen can already see which sites are down, by district and by department.
**Read first:** DESIGN §7.2 rows `/`, `/districts/…`, `/status/…`, `/departments/<slug>/`, `/sites/<id>/`; §7.4; ADR-011; ADR-025.
**Produces:** `site/src/components/KeralaMap.astro` + `site/src/data/kerala-districts.svg.json`, `StatTile`, `SiteTable`
(server-rendered; sort via tiny inline script or none), `Pagination` component, `CoverageBar`, pages `districts/index.astro`,
`districts/[district].astro`, `departments/[department].astro`, `status/[status].astro`, upgraded `index.astro`
and `sites/[id].astro` (light section: status, final URL, TLS expiry, headers, 90-day availability strip).
**Steps:**
1. Map: obtain Kerala district boundaries from DataMeet's open district shapefiles (ODbL — attribute on About).
   `mapshaper -i … -filter 'ST_NM=="Kerala"' -simplify 5% -o format=svg` then convert to `{id: pathD}` JSON keyed
   by `districts.yaml` ids. If you cannot fetch the source, write STATE.md and use a placeholder 14-cell grid
   with district names; the map is not a blocker.
2. Colour by `% broken` per district with an accessible sequential ramp; always show the number in a label.
3. Every list row: status icon + word + name + URL host + department + district. Never colour alone.
4. Keep pages under ~150 KB HTML; grama-panchayat lists on district pages inside `<details>` groups.
5. Paginate per ADR-025: any `SiteTable` whose rows would exceed 100 (home's own listing, a district or
   department page with a long roll) is generated with Astro's `paginate()` at 100 rows/page — build-time pages,
   no client JS — with `Pagination` rendering prev/next and "page N of M"; a page under the cap stays unpaginated.
**Verify:** `npm run build` under 3 min; open the deployed home and one district; `sites[]` from summary drives the
home; `npx lighthouse http://localhost:4321/ --only-categories=performance --form-factor=mobile --throttling-method=simulate
--quiet --chrome-flags=--headless` scores ≥ 90 on the built home page.
**Commit:** `feat(site): home, map, districts, departments, status lists (WP2.4)`

### WP2.5 — `validate --resolve` and the PR comment
**Goal:** no unverified URL enters the registry.
**Produces:** `--resolve` in `validate` (light check on entries changed vs `--changed-only origin/main`, rate-limited,
20 s timeout; fail if DNS fails or final registrable domain differs from the entry's without an alias; warn on non-200);
`validate.yml` runs it and posts the table.
**Verify:** PR adding a bogus host fails with a clear row; PR adding a real site passes with its title in the table.
**Commit:** `ci: live URL resolution for registry PRs (WP2.5)`

---

# Phase 3 — Deep audit

The deep audit is the largest body of code. It is split so that checks (pure, fixture-tested) are written before
the runner (I/O), and the runner is proven against the local fixture server before any workflow touches a live site.

### WP3.1 — Check framework, `registry.ts`, `score.ts`
**Goal:** every check id in DESIGN §5.3 exists with metadata and English explanations; scoring is implemented and tested; no check logic yet.
**Read first:** DESIGN §5.3 (all tables), §5.4, §5.6; ADR-005, ADR-006, ADR-013, ADR-015; §3.6 of this file.
**Produces:** `audit/src/checks/types.ts` (§3.6), `audit/src/checks/registry.ts` (≈ 90 entries: `id, category, severity,
statusSetting?, appliesTo?, title.en, citizen.en, fix.en, ref`; `ml` fields present but empty strings),
`audit/src/checks/index.ts` (array of `Check`s, initially empty; `runChecks(ctx)` applies `appliesTo` and returns `na`
for the rest), `audit/src/score.ts`, `audit/tests/score.test.ts`, `audit/tests/registry-metadata.test.ts`.
**Steps:**
1. Write the metadata entries directly from the DESIGN tables. Citizen text: 1–3 plain sentences, second person,
   no jargon without a gloss ("HSTS — a setting that stops the browser ever using an insecure connection"). Fix text:
   addressed to the webmaster, concrete. `ref`: `GIGW 3.0 §…`, `WCAG 2.1 SC …`, `OWASP Secure Headers` — cite only
   what you are sure of; otherwise `ref: ''`.
2. `score.ts`: `scoreSite(checks: CheckResult[], meta): {score, status, issues}` exactly per §5.4: ★ failures set
   status and null the score; otherwise per-category 100 − Σ deductions (warn = half deduction), floored, weighted.
   `issues` = failed/warned checks sorted C→I then by category order.
3. Metadata test: every id in `registry.ts` is unique, has non-empty `title.en`, `citizen.en`, `fix.en`, a valid
   category/severity; every ★ check names a `statusSetting`.
4. Score tests: all pass → 100/healthy; one C in security → security 60; a ★ fail → status set, score null;
   `na` never deducts; boundaries 79/80, 49/50.
**Verify:** `npm test` green; `node -e "import('./dist/checks/registry.js').then(m=>console.log(Object.keys(m.CHECKS).length))"` prints ≈ 90.
**Commit:** `feat(audit): check framework, metadata registry, scoring (WP3.1)`

### WP3.2 — Availability + identity checks
**Goal:** `avail.*` and `id.*` implemented and fixture-tested.
**Read first:** DESIGN §5.3 `avail.*`, `id.*`; Appendix (this file §A.1–A.3 pattern lists).
**Produces:** `audit/src/checks/availability.ts`, `audit/src/checks/identity.ts`, `audit/src/net/rdap.ts`,
fixtures: `parked-godaddy.html`, `parked-sedo.html`, `default-apache.html`, `default-iis.html`, `default-nginx.html`,
`dir-listing.html`, `blank.html`, `under-construction-en.html`, `under-construction-ml.html`, `ok-minimal.html`.
**Steps:** implement each id with the §A patterns; `avail.redirect_offsite` uses `tldts` registrable domains and the
site's `aliases`; `avail.flapping` reads `history`; `id.gov_domain` allow-list `gov.in nic.in kerala.gov.in ac.in edu.in`
(+ `res.in` for research bodies) — everything else `fail` with the TLD in evidence; `id.domain_expiry` via RDAP
(`https://rdap.org/domain/<domain>`, cached per run, skipped for gov/nic/ac/edu); `id.soft_404` needs a fetch of a
random path — do it in the runner and put the status in ctx (`ctx.soft404Status`), the check stays pure.
**Verify:** each fixture triggers exactly its check; `ok-minimal.html` triggers none; `npm test` green.
**Commit:** `feat(audit): availability and identity checks (WP3.2)`

### WP3.3 — Security checks
**Goal:** `sec.*` implemented; retire.js integrated; fixture-tested.
**Read first:** DESIGN §5.3 `sec.*`; ADR-007 (no active probing — headers and page contents only).
**Produces:** `audit/src/checks/security.ts`, `audit/src/net/retire.ts` (runs `npx retire --js --jspath <tmp>` on
downloaded script files the page itself loaded; parse JSON; cache by URL hash), `audit/src/net/safebrowsing.ts`
(optional; skips cleanly without `SAFE_BROWSING_KEY`), fixtures with `.headers.json`: `headers-none.json`,
`headers-good.json`, `mixed-content.html`, `old-jquery.html` (+ a vendored `jquery-1.8.3.min.js` fixture).
**Steps:** `sec.https/http_redirect/cert_*/tls_version` read `ctx.light`; header checks read `ctx.headers`
(case-insensitive); `sec.mixed_content` from `ctx.requests` (https page, http subresource) *and* static scan of
`src=/href=` for `http://` on stylesheet/script/img; `sec.server_banner` fails only when a version number is present.
**Verify:** fixtures; `npm test` green; retire integration test runs against the vendored jquery and reports ≥ 1 CVE.
**Commit:** `feat(audit): security checks and retire.js integration (WP3.3)`

### WP3.4 — Content + GIGW checks (bilingual)
**Goal:** `content.*` and `gigw.*` implemented with English **and** Malayalam patterns; fixture-tested.
**Read first:** DESIGN §5.3 `content.*`, `gigw.*`, Appendix B; §A.4–A.6 of this file.
**Produces:** `audit/src/checks/content.ts`, `audit/src/checks/gigw.ts`, `audit/src/text/{patterns.ts,malayalam.ts,dates.ts}`,
fixtures: `legacy-font-karthika.html` (CSS `font-family: "ML-TTKarthika"`), `legacy-font-facetag.html`,
`lang-en-but-malayalam.html`, `gigw-all-en.html`, `gigw-all-ml.html`, `gigw-none.html`, `copyright-2019.html`,
`last-updated-old.html`, `marquee-flash.html`, `best-viewed-ie.html`, `lorem.html`, `stale-news.html`.
**Steps:**
1. `patterns.ts`: one table `{key, en: RegExp, ml: RegExp}` for every GIGW element (§A.5) and for status phrases.
   Matching runs over link text, button text, headings and `title`/`aria-label` attributes, case-insensitive,
   Unicode-aware. `gigw.*` pass if any pattern for that key matches on the homepage **or** in the footer/nav of any
   crawled page (ctx.crawl.linkTexts).
2. `malayalam.ts`: `malayalamRatio(text)` = Malayalam letters / all letters (`\p{Script=Malayalam}` vs `\p{L}`);
   `a11y.lang` (implemented here, exported to a11y in WP3.5) fails when ratio > 0.3 and `lang` does not start with `ml`,
   or ratio < 0.05 and `lang` starts with `ml`.
3. `dates.ts`: find dates in `dd-mm-yyyy`, `dd/mm/yyyy`, `yyyy-mm-dd`, `d Month yyyy`, Malayalam month names;
   "Last updated/അവസാനം പുതുക്കിയത്" proximity search; copyright year regex `©|\(c\)|copyright.*?(20\d\d)`.
4. `content.legacy_font`: scan `ctx.cssTexts` and inline styles and `<font face>` for the §A.4 list; evidence =
   font name + where.
5. `content.malayalam`: `appliesTo` = citizen-facing kinds (portal, department, directorate, district_admin, lsg kinds,
   service); pass if a language toggle pattern or Malayalam ratio > 0.05 anywhere on crawled pages.
**Verify:** each fixture triggers its check; `gigw-all-ml.html` passes every `gigw.*`; `npm test` green.
**Commit:** `feat(audit): content and GIGW checks, bilingual patterns (WP3.4)`

### WP3.5 — Playwright runner: capture, axe, Lighthouse, crawl, screenshots; fixture-server smoke test
**Goal:** `run --ids …` produces complete result records; proven against the fixture server.
**Read first:** DESIGN §5.1, §5.2 column 2, §5.3 `a11y.*`, `perf.*`, §5.5; ADR-007, ADR-015, ADR-017; §A.7–A.8 of this file.
**Produces:** `audit/src/runner.ts`, `audit/src/capture.ts` (Playwright session → ctx), `audit/src/crawl.ts`,
`audit/src/lighthouse.ts`, `audit/src/screenshot.ts` (sharp → WebP, aHash), `audit/src/checks/{a11y,perf}.ts`,
`audit/tests/fixture-server.ts` + `tests/fixtures/sites/<name>/…` + `manifest.json`, `cli run`, `cli self-test`.
**Steps:**
1. `capture.ts`: one Chromium context per site (fresh, `locale: 'ml-IN'`, UA from config, viewport 1280×800);
   `page.goto(finalUrl, {waitUntil: 'networkidle', timeout: 30000})` with a fallback to `load`; collect requests
   (url, type, status, bytes, protocol), console errors, page errors; `html = await page.content()`; `text =
   innerText(body)`; `lang`; all `<a>` (href, text, rel); CSS texts = inline `<style>` + fetched same-origin
   stylesheets (≤ 20, from the request log — do not re-fetch); script URLs; computed `font-family` of `body` and of
   the 20 largest text nodes; run axe (`@axe-core/playwright`, tags `wcag2a wcag2aa wcag21aa best-practice`) →
   summary by impact + top 10 rule ids; desktop screenshot; switch viewport to 390×844 (`isMobile: true`) → mobile
   screenshot; fetch one random 404 path (`/kww-<random>`) for `id.soft_404`; close context.
2. `lighthouse.ts`: programmatic `lighthouse(url, {port})` against a Chrome launched with `chrome-launcher` using
   Playwright's chromium executable (`chromium.executablePath()`), `--headless=new`, mobile preset, categories
   performance/accessibility/best-practices/seo, one pass, 90 s cap; on failure record `lighthouse: null` and the
   error, never throw. `--no-lighthouse` skips.
3. `crawl.ts`: from homepage links, take same-registrable-domain links, dedupe, cap 30 pages; robots.txt fetched once
   per host (`robots-parser`), respected for everything except the homepage; 1 req/s per host (token bucket);
   `GET` with 20 s timeout; record status per link; collect link texts for GIGW; sample ≤ 20 `.pdf` links with `HEAD`
   then `GET` fallback; collect outbound registrable domains → `out/outlinks/<id>.json`. `--no-crawl` skips.
4. `screenshot.ts`: PNG buffer → `sharp().webp({quality: 60})`; aHash = resize 8×8 grayscale → mean threshold → 64-bit hex.
5. `runner.ts`: light → capture → lighthouse → crawl → build `CheckContext` → `runChecks` → `scoreSite` → assemble
   the §5.5 record (`deep`, `score`, `status`, `issues`) → write. Per-site hard cap 4 min; on any uncaught error write
   a record with `deep.error` and status unchanged. Sites run **sequentially** within a shard (Lighthouse needs the CPU).
6. Fixture server: `manifest.json` maps `site-name → {status, headers, redirect?, files}`; sites at least:
   `good` (passes everything we can pass locally), `parked`, `default-apache`, `blank`, `legacy-font`, `no-gigw`,
   `mixed-content` (served over http, fine for the test), `slow-5xx`. `self-test` runs `run --fixture-base
   http://localhost:4173 --no-lighthouse` over them and asserts expected `status` and a few expected issue ids.
   Fixture sites are registry-shaped entries in `tests/fixtures/sites/registry.yaml` with hosts `*.localhost`.
7. `test.yml`: add `npx playwright install --with-deps chromium` and `npm run self-test` (with the fixture server
   started in the background).
**Verify:** `npm run self-test` green locally and in CI; `run --ids keralapsc --out /tmp/o` (one live site, allowed)
produces a record with lighthouse numbers, ≥ 1 screenshot, crawl ≤ 30 pages, ≤ 90 s.
**Commit:** `feat(audit): deep audit runner with axe, Lighthouse, crawl, screenshots; fixture self-test (WP3.5)`

### WP3.6 — `plan` scheduler and `merge`
**Goal:** the rolling scheduler and the shard merger, unit-tested with synthetic data.
**Read first:** DESIGN §6.2 (algorithm — implement exactly), §6.4, §6.6 (outlinks only); ADR-004, ADR-016, ADR-017.
**Produces:** `audit/src/scheduler.ts`, `audit/src/merge.ts`, `cli plan`, `cli merge`, tests.
**Steps:**
1. `plan`: implement §6.2 ordering with `deep_bump` from ADR-016 as the "forced" tier; `--site-ids` bypasses
   selection; `--dry-run` prints the batch table only; output matrix JSON `{"include":[{"index":0,"ids":"…"}]}` with
   round-robin sharding; `batch_id = YYYYMMDD-<n>` where n counts batches that day (from `data/batches.json`).
2. `merge`: for each `out/results/*.json`: replace `deep`, `score`, `status`, `issues`; keep `light` and `history`
   from `data/`; add today's history score; clear `deep_bump`. Screenshots: copy only if no existing file or aHash
   Hamming distance > 10 (store hash in the record). Append outlinks into `data/outlinks.json` `{host: {count, from:[ids≤5], texts:[≤3]}}`.
   Recompute `summary.json`. Idempotent: merging the same `out/` twice changes nothing.
3. Tests: 20 synthetic sites with mixed `deep.at`/bump/priority → expected order; batch size formula incl. caps;
   sharding balance; merge idempotence; phash gate.
**Verify:** `npm test` green; `plan --dry-run` on the real registry + a scratch `data/` prints a sensible table.
**Commit:** `feat(audit): rolling scheduler and shard merge (WP3.6)`

### WP3.7 — `audit.yml` live
**Goal:** the deep audit runs in Actions on a schedule and results reach the site.
**Read first:** DESIGN §6.3 (copy the YAML; adjust paths only), §6.5, §6.8.
**Produces:** `.github/workflows/audit.yml`.
**Steps:**
1. Commit the workflow. Run `workflow_dispatch` with `site_ids=kerala-gov,keralapsc,d-ernakulam`. Inspect: plan
   output, shard log, merge commit on `data`, Pages rebuild, the three site pages showing deep results.
2. Run with `batch_size=50`. Note per-site timing from logs; if a shard exceeds 60 min at 50 sites, lower `--max-batch`
   in the workflow to keep shards ≤ 90 min and record the decision in STATE.md (this is tuning, not an ADR).
3. Enable cron (already in the file; confirm the first scheduled run succeeds the next day).
4. Write the observed numbers into STATE.md: seconds/site, shard duration, batch size, ETA to full coverage.
**Verify:** `data` branch `summary.json.coverage.deep_audited` increases daily; home page coverage bar moves.
**Done when:** two consecutive scheduled runs succeeded and merged.
**Commit:** `ci: rolling deep audit workflow (WP3.7)`

---

# Phase 4 — Full site

### WP4.1 — Full site page
**Read first:** DESIGN §7.3 (all nine parts), §7.4; ADR-013.
**Produces:** `site/src/pages/sites/[id].astro` rewritten; components `ScoreRing`, `CategoryBars`, `IssueCard`
(title / citizen / fix / evidence / ref, `<details>` for fix+ref), `Sparkline`, `AvailabilityStrip`, `Screenshot`
(with mobile toggle, `loading="lazy"`, explicit dimensions), `TechFacts`, `SiteActions` (prefilled GitHub issue
URLs for correction and re-audit: `…/issues/new?template=correction.yml&title=[<id>]…`), `RelatedSites`.
**Steps:** import check metadata from the audit package build (`audit/dist/checks/registry.js`) — never copy text.
`hijacked` pages render the URL as plain text with a warning, not as a link. Passed checks in a collapsed list.
JSON link to `/api/sites/<id>.json` (generated in WP4.3; link may 404 until then — acceptable for one WP).
**Verify:** build; check a healthy, a poor, a down and a hijacked (fixture or real) site page render correctly;
Lighthouse a11y on our own site page ≥ 95 locally (`npx lighthouse http://localhost:4321/sites/keralapsc/ --only-categories=accessibility --quiet --chrome-flags=--headless`).
**Commit:** `feat(site): full site page with explained issues (WP4.1)`

### WP4.2 — Ministry, department, kind, platform, leaderboard pages
**Read first:** DESIGN §4, §7.2 rows ministries/departments/kinds/platforms/leaderboard; ADR-008, ADR-014, ADR-025.
**Produces:** `ministries/index.astro`, `ministries/[ministry].astro`, upgraded `departments/[department].astro`
(rollup: status counts, median, top-3 failed checks, table), `kinds/[kind].astro`, `platforms/[platform].astro`
(platform-wide issues = checks failing on ≥ 80 % of member sites; member pages show "Inherited from platform" note —
implement the note in `sites/[id].astro` here), `leaderboard.astro` (departments and districts ranked by % broken then
median; "most improved" from history deltas over 30 days), `site/src/lib/rollups.ts` with tests (vitest in `site/`).
Reuse WP2.4's `Pagination`/`paginate()` convention on any of these tables that exceed 100 rows (a large department
or the `lsgkerala` platform's full member list).
**Verify:** build; a department with zero sites renders an empty state, not an error; rollup tests green; a page
whose table exceeds 100 rows actually paginates (check `platforms/lsgkerala`, its largest member list).
**Commit:** `feat(site): ministry, department, kind, platform and leaderboard views (WP4.2)`

### WP4.3 — Status pages, feeds, static API, data page
**Read first:** DESIGN §7.2 rows status/feeds/api/data; ADR-025.
**Produces:** `status/[status].astro` upgraded (down, hijacked, broken, poor, unverifiable, unaudited; paginated at
100 rows/page per ADR-025 once a status has that many sites), `feeds/broken.xml`
and `feeds/fixed.xml` (Atom, last 100 transitions from history), `api/summary.json` (copy), `api/sites/[id].json`,
`api/sites.csv` (registry + status + score), `api/all.json` (all records minus evidence, gzip-friendly), `data.astro`
(downloads, schema description, licence, link to monthly Release archives).
**Verify:** `curl -s <pages>/api/sites.csv | head -3`; feed validates with a quick XML parse; sizes noted in STATE.md.
**Commit:** `feat(site): status pages, feeds and static API (WP4.3)`

### WP4.4 — Methodology page generated from `registry.ts`
**Read first:** DESIGN §5.1, §5.3, §5.4, §6.7, §6.8; ADR-006, ADR-007, ADR-013, ADR-015.
**Produces:** `methodology.astro` rendering: principles (§5.1 verbatim, lightly edited), the two tiers, every check
grouped by category with severity/status-setting/reference from metadata, scoring weights and thresholds, status
definitions, vantage/geo-block handling, how to contest, limitations. Also `robots.txt`, `sitemap` (already), and a
`/humans.txt`.
**Verify:** every id in `CHECKS` appears on the page (test in `site/`); reading time ≈ 10 min, not 40.
**Commit:** `feat(site): methodology generated from check metadata (WP4.4)`

### WP4.5 — Pagefind, i18n scaffold, self-audit
**Read first:** DESIGN §7.1, §7.4; ADR-011.
**Produces:** Pagefind index step in `site` build (`postbuild: pagefind --site dist`), search UI on home and header;
Astro i18n config (`defaultLocale: 'en', locales: ['en','ml']`, `/ml/` prefixed), `src/i18n/en.json` complete and
`ml.json` with the same keys (values may be English for now — the WP5.3 job is translation, not wiring); `t()` helper;
the site itself added to `registry/sites/state.yaml` (`id: kerala-web-watch`, `kind: portal`, `department: gad`,
`tags: [self]`, `notes: "dogfood entry — not a government site"`; the site page shows that note) so it is audited; run the deep
audit against the locally built site (`run --ids kerala-web-watch --fixture-base http://localhost:4321`) and fix
until score ≥ 80 with no ★ failures.
**Verify:** search returns a panchayat by Malayalam name; `/ml/` routes build; self-audit record ≥ 80.
**Commit:** `feat(site): search, i18n scaffold, self-audit passes (WP4.5)`

### WP4.6 — `squash-data.yml`, `report.yml`, issue forms
**Read first:** DESIGN §6.1 rows squash-data/report/issue-to-pr, §6.4.
**Produces:** `.github/workflows/squash-data.yml` (monthly: checkout `data`, `zip -r dataset-YYYY-MM.zip results
summary.json outlinks.json`, `gh release create dataset-YYYY-MM …`, then orphan-rewrite and `git push --force origin data`;
`concurrency: data-branch`), `.github/workflows/report.yml` (1st of month: `cli report` → `site/src/content/reports/YYYY-MM.md`
committed to `main` with totals, deltas vs last month, top issues, best/worst; page `reports/[month].astro`),
`.github/ISSUE_TEMPLATE/add-website.yml`, `correction.yml`, `reaudit-request.yml` (issue forms with required fields).
**Verify:** run squash by `workflow_dispatch` once and confirm the Release asset and that `git log origin/data --oneline | wc -l` is 1 afterwards; run report once.
**Commit:** `ci: monthly data squash, monthly report, issue forms (WP4.6)`

### WP4.7 — India vantage runner (optional; only if the human registered one)
**Read first:** DESIGN §6.7.
**Produces:** in `uptime.yml`, a second job `light-india` (`runs-on: [self-hosted, india]`, `if:` a repo variable
`HAS_INDIA_RUNNER == 'true'`) that runs `light --ids <unverifiable ids from summary> --vantage in-1`; `status.ts` prefers
the India result when the US result is `geo_block_suspect`. Record both under `light.vantages`.
**Verify:** an `unverifiable` site becomes `healthy`/`down` after the India job.
**Commit:** `feat(audit): India vantage light checks (WP4.7)`

---

# Phase 5 — Self-maintenance and reach

### WP5.1 — `discover.yml`
**Read first:** DESIGN §6.6; ADR-009, ADR-018.
**Produces:** `cli discover` (filters `data/outlinks.json` per §6.6, light-checks candidates at ≤ 1 req/s, writes
`registry/candidates/discovered.yaml` with title, seen-from, hints), `.github/workflows/discover.yml` (weekly;
`peter-evans/create-pull-request` with a table in the body; label `discovery`; skips when zero candidates).
**Verify:** a manual run opens a PR (or logs "0 candidates"); merging a candidate into `sites/` and re-running does not re-propose it.
**Commit:** `feat(audit): weekly discovery of unregistered government sites (WP5.1)`

### WP5.2 — `issue-to-pr.yml`
**Produces:** on issue opened with label `add-website`: parse the form body (`github-script`), light-check the URL, open a
PR appending to `registry/candidates/issues.yaml` with the issue linked; comment on the issue with the result.
**Commit:** `ci: turn add-website issues into candidate PRs (WP5.2)`

### WP5.3 — Malayalam explanations and UI
**Produces:** `ml` strings for `title`/`citizen`/`fix` of every check in `registry.ts`; `ml.json` translated; `/ml/`
navigation; language toggle. Translate for a citizen, not a lawyer; keep technical terms in Latin script in
parentheses where no common Malayalam term exists. Ask the human to review a sample of 20 before translating all.
**Verify:** a `/ml/sites/<id>/` page reads naturally; metadata test now requires non-empty `ml` for C/H checks.
**Commit:** `feat: Malayalam explanations and UI (WP5.3)`

### WP5.4 — Government colleges tier
**Produces:** `registry/sites/colleges.yaml` from Collegiate/Technical/Medical Education directories via the harvest
framework; `tier: college`, `priority: 1`, `department` by directorate. Batch cap may need raising (`--max-batch 350`);
note in STATE.md.
**Commit:** `feat(registry): government colleges (WP5.4)`

---

# 5. Definition of done (project)

- Phases 0–4 complete; every WP row in STATE.md `done` with a commit.
- Registry ≥ 1,500 entries, `validate` green, drafts backlog documented.
- `summary.coverage.deep_audited == total` at least once (first sweep finished) and steady-state refresh running.
- Site live on Pages; home, ministry, district, site, status, methodology, data pages all render from real data.
- The site's own registry entry scores ≥ 80 with no ★ failures.
- `uptime.yml`, `audit.yml`, `build-deploy.yml`, `squash-data.yml`, `discover.yml` each have ≥ 2 successful scheduled runs.
- DECISIONS.md has no ADR left in `Proposed` without a STATE.md open question pointing at it.

---

# A. Reference material for checks

### A.1 Parked / for-sale signatures (`avail.parked`)
Text (case-insensitive): `domain is for sale`, `buy this domain`, `this domain may be for sale`, `parked free`,
`courtesy of godaddy`, `sedoparking`, `hugedomains`, `afternic`, `dan.com`, `domain has expired`, `renew your domain`,
`namecheap parking`, `bodis`, `parkingcrew`, `this webpage is parked`. Also: final registrable domain in
`{sedoparking.com, hugedomains.com, afternic.com, dan.com, godaddy.com}`.

### A.2 Default server pages (`avail.default_page`)
`Apache2 Ubuntu Default Page`, `Apache HTTP Server Test Page`, `It works!` (as the whole body), `IIS Windows Server`,
`Welcome to nginx!`, `Index of /` in `<title>`, `Plesk`, `cPanel` default, `Test Page for the Apache`, `Welcome to
OpenResty`, `LiteSpeed` default.

### A.3 Under construction (`avail.under_construction`)
en: `under construction`, `coming soon`, `site is being updated`, `will be back shortly`, `maintenance mode`;
ml: `നിർമ്മാണത്തിലാണ്`, `ഉടൻ വരുന്നു`, `അറ്റകുറ്റപ്പണി`. Fail only when the page's visible text is < 400 characters
after removing the matched phrase; otherwise `warn`.

### A.4 Legacy (non-Unicode) Malayalam font families (`content.legacy_font`)
Prefixes: `ML-TT`, `ML-`, `MLW-`, `MLB-`, `MLU-` (note: `ML-TTKarthika`, `ML-TTRevathi`, `ML-TTAmbili`, `ML-TTIndulekha`
are the common ones); families: `Matweb`, `Manorama`, `Mathrubhumi`, `Deepika`, `Keralalite`, `Thoolika` (legacy
variants), `Karthika` (legacy ASCII; distinguish from Windows Unicode `Kartika`), `Revathi`, `Ambili`, `Indulekha`.
Unicode families that must **not** match: `Kartika`, `AnjaliOldLipi`, `Rachana`, `Meera`, `Manjari`, `Noto Sans
Malayalam`, `Chilanka`, `Gayathri`, `Dyuthi`, `Suruma`, `Uroob`, `Keraleeyam`.

### A.5 GIGW element patterns (`gigw.*`) — extend as you meet real footers
| key | en | ml |
|---|---|---|
| contact | `contact( us)?` | `ബന്ധപ്പെടുക|ബന്ധപ്പെടാൻ|വിലാസം` |
| feedback | `feedback` | `അഭിപ്രായം|പ്രതികരണം` |
| sitemap | `site ?map` | `സൈറ്റ് ?മാപ്പ്|സൈറ്റ്മാപ്പ്` |
| privacy | `privacy( policy)?` | `സ്വകാര്യത(ാ)? ?നയം` |
| terms | `terms (and|&|of) (conditions|use)` | `നിബന്ധനകൾ|ഉപാധികൾ` |
| copyright_policy | `copyright( policy)?` | `പകർപ്പവകാശം` |
| hyperlink_policy | `hyperlink(ing)? policy` | `ഹൈപ്പർലിങ്ക്` |
| disclaimer | `disclaimer` | `നിരാകരണം|ഉത്തരവാദിത്ത നിരാകരണം` |
| accessibility_statement | `accessibility( statement)?` | `പ്രവേശനക്ഷമത|പ്രാപ്യത` |
| screen_reader | `screen ?reader( access)?` | `സ്ക്രീൻ റീഡർ` |
| help | `\bhelp\b` | `സഹായം` |
| rti | `\bRTI\b|right to information` | `വിവരാവകാശം` |
| search | `input[type=search]` or `search` label/button | `തിരയുക|തിരയൽ|അന്വേഷിക്കുക` |
| ownership | `content (owned|maintained|provided) by|designed,? developed (and|&) hosted by|site owned by` | `ഉള്ളടക്കം .* (ഉടമസ്ഥത|പരിപാലിക്കുന്നത്)` |
| last_updated | `last (updated|modified|reviewed)` | `അവസാനം (പുതുക്കിയത്|പരിഷ്കരിച്ചത്)` |

### A.6 Obsolete technology (`content.obsolete_tech`) and "best viewed" (`content.best_viewed`)
`<marquee`, `<blink`, `<applet`, `<frameset`, `application/x-shockwave-flash`, `.swf`, `<bgsound`, `vbscript:`,
`ActiveXObject` (as a hard dependency, not a feature test); `best viewed (in|with) (internet explorer|ie\b|netscape)`,
`best viewed (at|in) \d{3,4} ?x ?\d{3,4}`, `requires flash`.

### A.7 Lighthouse with Playwright's Chromium
```ts
import { chromium } from 'playwright';
import * as chromeLauncher from 'chrome-launcher';
import lighthouse from 'lighthouse';
const chrome = await chromeLauncher.launch({ chromePath: chromium.executablePath(), chromeFlags: ['--headless=new','--no-sandbox'] });
const r = await lighthouse(url, { port: chrome.port, output: 'json', logLevel: 'silent',
  onlyCategories: ['performance','accessibility','best-practices','seo'], formFactor: 'mobile',
  screenEmulation: { mobile: true, width: 390, height: 844, deviceScaleFactor: 3 } });
await chrome.kill();
```
Keep only category scores and the handful of audits the checks need (`largest-contentful-paint`, `cumulative-layout-shift`,
`total-byte-weight`, `viewport`, `tap-targets`, `font-size`, `uses-optimized-images`). Discard the rest — do not store the full LHR.

### A.8 Average hash for screenshots
`sharp(png).resize(8, 8, {fit:'fill'}).grayscale().raw().toBuffer()` → mean → 64 bits (1 if pixel ≥ mean) → hex.
Hamming distance > 10 ⇒ replace the stored WebP. Store `phash` in the record.

### A.9 Geo-block signatures (`avail.geo_blocked`) — start small, grow from evidence
HTTP 403 with body containing `Access Denied` **and** (`NIC` | `National Informatics Centre` | `your country`);
Cloudflare `error code: 1020`; TCP timeout to a host whose DNS resolves to a known NIC range **and** which the
India vantage (WP4.7) reports reachable. Until an India vantage exists, only the first two fire; the third is future work.
Record every fired signature in evidence so the list can be reviewed.
