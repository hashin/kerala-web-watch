# Handoff Summary

## What Was Asked
Continue Kerala Web Watch (docs/IMPLEMENTATION.md) after WP4.3 finished (verified, tests fixed,
pushed as of commit `691587f` on branch `main-cixmvy`). `docs/STATE.md`'s Next action pointed at
**WP4.4 — Methodology page generated from `registry.ts`**. This session picked up WP4.4 and was
still in the read-first / research phase (CLAUDE.md's mandatory read order) when interrupted to
write this handoff. **No code has been written or committed for WP4.4 yet** — `git status` is
clean, nothing to stash or lose.

## WP4.4's own text (docs/IMPLEMENTATION.md, `grep -n "^### WP4.4"`)
- **Read first:** DESIGN §5.1, §5.3, §5.4, §6.7, §6.8; ADR-006, ADR-007, ADR-013, ADR-015. (All
  read this session — see notes below.)
- **Produces:** `methodology.astro` rendering: principles (§5.1 verbatim, lightly edited), the two
  tiers, every check grouped by category with severity/status-setting/reference from metadata,
  scoring weights and thresholds, status definitions, vantage/geo-block handling, how to contest,
  limitations. Also `robots.txt`, `sitemap` (already), and a `/humans.txt`.
- **Verify:** every id in `CHECKS` appears on the page (test in `site/`); reading time ≈ 10 min,
  not 40.
- **Commit:** `feat(site): methodology generated from check metadata (WP4.4)`

## What was learned this session (read, not yet acted on)

**ADRs read:** ADR-006 (weights 25/25/15/15/10/10, deductions C-40/H-20/M-10/L-4/I-0, thresholds
healthy≥80/needs-work 50-79/poor<50), ADR-007 (passive/polite/charitable auditing boundaries),
ADR-013 (check explanations live ONLY in `audit/src/checks/registry.ts`; site never repeats the
copy), ADR-015 (Lighthouse is indicative only, never sets status).

**DESIGN.md sections read:** §5.1 Principles (5 numbered items — passive/polite/reproducible/
explainable/charitable), §5.2 Two tiers table (light vs deep), §5.3 Check catalogue (~90 checks
across 7 categories, ★ = status-setting), §5.4 Scoring and status (gate vs weighted score,
ADR-026's "never show a bare status word" rule also applies here), §5.6 (registry.ts shape),
§6.7 Vantage/geo-blocking, §6.8 False-positive guards, §7.2 Pages table (`/methodology/` row: "Every
check, weight, threshold; limitations; ethics; how to contest"), §7.3/§7.4 (site page anatomy,
plain-language/ADR-026 design principle — same rule applies to this page).

**Code inspected, key facts for implementation:**
- `audit/src/checks/registry.ts` exports `CHECKS: Record<CheckId, CheckMeta>` — confirmed 84 ids
  live currently (not ~90; catalogue is aspirational/approximate) across 7 categories:
  availability 11, security 14, accessibility 11, performance 7, content 15, gigw 16, identity 10.
  `CheckMeta` shape (`audit/src/checks/types.ts:116-130`): `category`, `severity`, `statusSetting?`,
  `appliesTo?`, `title:{en,ml}`, `citizen:{en,ml}`, `fix:{en,ml}`, `ref: string`. `ml` fields are
  still empty strings everywhere (WP5.3's job), so the methodology page is English-only for now,
  consistent with every other page.
- `audit/src/score.ts` has `WEIGHTS` (line 34) and `FAIL_DEDUCTION` (line 33) as **module-private
  consts, NOT exported**. `statusFromScore` (healthy/needs-work/poor boundary) IS already exported
  (line ~104, has its own doc comment noting it's exported specifically for boundary testing).
  **Decision needed / leaning toward:** export `WEIGHTS` and `FAIL_DEDUCTION` too (trivial, additive,
  can't break anything) so the methodology page's weights/thresholds table is genuinely *generated*
  from the scoring source rather than a hand-typed duplicate of ADR-006's numbers — keeps faith with
  ADR-013's "single source, never duplicate" spirit even though ADR-013 itself is about check copy,
  not score weights specifically. Also considered: derive the 80/50 score boundaries programmatically
  by scanning `statusFromScore(0..100)` for its transition points instead of hardcoding `80`/`50` as
  magic numbers in the Astro page — cheap and removes one more hand-copied number.
  Similarly, which check ids set `down`/`hijacked`/`broken` can be *derived* by grouping `CHECKS`
  entries by their `statusSetting` field at build time, rather than hand-copying DESIGN.md's prose
  list of ids into the page (that list could drift from the real metadata).
- `site/src/lib/data.ts` already imports and **re-exports `CHECKS`** (`export { CHECKS };`) plus
  `statusFromScore` is available via `audit/dist/score.js`. Existing components
  (`IssueCard.astro`, `GroupRollup.astro`) import `CHECKS` directly from
  `'../../../audit/dist/checks/registry.js'` — methodology.astro should follow the same import
  path convention (or import from `site/src/lib/data.ts` if that ends up cleaner — either is
  consistent with existing code, no strong precedent forcing one over the other since both patterns
  already exist in the codebase).
- **Loose thread spotted, not yet resolved:** `site/src/components/SiteActions.astro` (built in an
  earlier WP, before this session) already links "Suggest a correction" / "Request re-audit" to
  `https://github.com/hashin/kerala-web-watch/issues/new?template=correction.yml` and
  `?template=reaudit-request.yml` — **but `.github/ISSUE_TEMPLATE/` is currently empty**
  (`ls .github/ISSUE_TEMPLATE/` returns nothing). Those issue-form templates are WP4.6's own
  deliverable (`squash-data.yml`, `report.yml`, issue forms), not yet built. This means those two
  links on every site page currently 404 into GitHub's generic "create issue" flow instead of a
  prefilled form. This predates WP4.4 and isn't this WP's bug to fix, but WP4.4's own "how to
  contest" section will likely want to link to/describe the same mechanism, so **whoever picks this
  back up should decide**: (a) leave a note in `docs/STATE.md`'s open questions for WP4.6 to close
  the loop, (b) just describe "open a GitHub issue" in prose on the methodology page without
  depending on the templates existing, or (c) treat it as this session's own bookkeeping catch
  (like the WP4.1 handoff's "data-migration follow-up" precedent) and just flag it, not fix it here
  — WP4.6 is genuinely a different, not-yet-started WP. Leaning toward (a)+(b): note it, don't fix
  it, don't block WP4.4 on it.
- `site/public/` currently has only `CNAME` and `fonts/` — confirmed `robots.txt` and `humans.txt`
  do not exist yet (both are this WP's own deliverable, per its own text). Sitemap is already
  handled by the `@astrojs/sitemap` integration wired in `astro.config.mjs` (confirmed during
  WP4.3's build — `[@astrojs/sitemap] sitemap-index.xml created`), so nothing new needed there
  beyond what WP4.4's text already says ("sitemap (already)").

## Not yet done (this is the actual next-steps list)

1. Decide and make the `export` changes in `audit/src/score.ts` (`WEIGHTS`, `FAIL_DEDUCTION`) —
   small, additive, run `cd audit && npm test` after to confirm nothing broke (it's purely additive
   so it shouldn't).
2. Build `site/src/pages/methodology.astro`:
   - Principles section (§5.1's 5 points, lightly edited to plain language — this is the one section
     that's genuinely hand-written prose, not generated, per the WP's own text "verbatim, lightly
     edited").
   - Two-tiers section (§5.2 table — light vs deep: cadence, cost, tools, output).
   - Check catalogue: iterate `CHECKS`, group by `category` (order: availability, security,
     accessibility, content, gigw, performance, identity — matches `CATEGORY_ORDER` in
     `audit/src/score.ts` if that's exported too, or just hardcode this specific ordering since it's
     the same order DESIGN.md itself uses), render id/title/severity/status-setting (★ marker)/ref
     per check. This satisfies the WP's Verify line ("every id in CHECKS appears on the page").
   - Scoring section: render the weights table and deduction table from the (now exported)
     `WEIGHTS`/`FAIL_DEDUCTION` constants, and the healthy/needs-work/poor boundaries (derived or
     hardcoded per the decision above).
   - Status definitions: down/hijacked/broken/unverifiable/unaudited/healthy/needs-work/poor — one
     paragraph each, mirroring DESIGN §5.4's table but in plain language (ADR-026 applies here too:
     don't just restate the status word).
   - Vantage/geo-blocking (§6.7) and false-positive guards (§6.8) — hand-written prose sections,
     short.
   - "How to contest" — see the SiteActions.astro loose thread above; write this without assuming
     WP4.6's templates exist.
   - Limitations — short, honest list (Lighthouse indicative only/ADR-015, passive-only/ADR-007,
     geo-blocked sites, shared-platform findings reported once per ADR-008, etc).
   - Keep prose tight throughout — the Verify line's "~10 min not 40" reading-time budget is a real
     constraint; the check catalogue will be the bulk of the page's length by necessity (84 checks),
     so keep everything else terse and consider a collapsible/`<details>` treatment per category
     (there's already a `<details>` pattern in `IssueCard.astro` to follow).
3. Add `site/public/robots.txt` (allow everything, point at the sitemap index) and
   `site/public/humans.txt` (short, per the WP text — no spec given beyond "a humans.txt", so keep
   it simple: site name, tech stack, thanks/credits, contact).
4. Write the test in `site/tests/` that asserts every id in `CHECKS` appears on the built/rendered
   methodology page (the WP's own Verify criterion) — check how other `site/tests/*.test.ts` files
   test Astro page output (if none do yet, this may need a different approach than the existing
   pure-function unit tests in `site/tests/api.test.ts`/`rollups.test.ts` — worth checking whether
   `site/` has any precedent for testing rendered `.astro` output, or whether this test should
   instead assert against the *data* the page will render, e.g. a small extracted pure function
   that groups `CHECKS` by category, tested the same way `rollups.ts`/`api.ts` are).
5. Follow CLAUDE.md's session end protocol once the WP is actually done: `cd audit && npm test`,
   `cd site && npm run build`, `npm run lint`, run the `verifier` subagent (this WP adds a test),
   commit (`feat(site): methodology generated from check metadata (WP4.4)`), update
   `docs/STATE.md` (WP4.4 row, Next action → WP4.5, handoff entry, and the SiteActions.astro/WP4.6
   note if going with option (a) above), push to `main-cixmvy`.
6. Opportunistically, not blocking: WP3.7's cron gate was at 1 of 2 needed consecutive scheduled
   `audit.yml` successes as of the WP4.3 handoff (2026-09-23) — check
   `mcp__github__actions_list` → `list_workflow_runs` filtered to `event=schedule` again next
   session; don't force with `workflow_dispatch`.

## Current git state
`git status --short` is clean on `main-cixmvy`. Latest pushed commit: `691587f` ("docs: mark WP4.3
done, record verification notes, point next action at WP4.4"). Nothing from this session is
uncommitted because nothing was written yet — this file (`HANDOFF.md`, repo root) is itself
untracked scratch and is not part of the git-tracked convention (`docs/STATE.md` is); it exists
purely so the next session (or this one resumed) doesn't have to redo the research above.
