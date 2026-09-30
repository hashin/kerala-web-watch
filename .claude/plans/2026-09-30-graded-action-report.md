# Graded action report for every site, with a check for injected/spam links

**Date**: 2026-09-30
**Status**: planned (blocked on the human accepting ADR-028, see Open questions)
**ADR**: ADR-028 (Proposed) in `docs/DECISIONS.md`. Its full text is also reproduced at the end of this plan.
**Origin**: `docs/STATE.md` Open question 18 plus the human's answer of 2026-09-30.

## Goal

Two problems, one feature.

1. **We miss signs of tampering.** `lsg-bp-parappa`'s homepage links to `http://ww547.keralagov.in?tkn=…`. The
   `ww<digits>.` subdomain is the pattern parking and redirect networks use, and `keralagov.in` imitates
   `kerala.gov.in`. Nothing in the audit flags this. We only saw it because discovery happened to list the host.
   Injected spam links (gambling, "slot gacor", pharma) are the most common sign that an Indian government CMS
   has been compromised. A citizen who clicks one leaves the government site for a hostile one without knowing it.
2. **Nobody can tell what to fix first.** A site page lists 30 issues grouped by severity. A department with 60
   sites, or a journalist looking at 1,567 sites, has no ranked, current list of "act on these first". The human
   asked for an **always-current action report with graded actions for every website**, aimed at
   webmasters/departments and journalists. Signs of possible compromise go at the top grade, "high priority for the
   entire website".

The fix has three parts:
- a passive new check (`sec.injected_links`) that reads the homepage's own outbound links;
- a mechanical grading of every finding (grade 1 = act now, visitors may be at risk … grade 5 = minor), computed
  by one pure function in `audit/`;
- report pages (global, per department, per site) plus CSV/JSON exports, in English and Malayalam. Every
  graded row states the concrete reason in plain language (ADR-026) using the check's existing `citizen` string
  (ADR-013).

It stays charitable:
- the new check never sets `hijacked` and never changes the ADR-005 headline;
- the new check never fetches the suspicious link;
- every flag carries redacted evidence;
- every grade-1 row can be contested.

## Acceptance criteria

Terms: "report" means the `ActionReport` object that `computeActionReport()` returns. "Grade" means `1|2|3|4|5`.
"Bucket" means the site-level grade or one of `clear` / `unaudited` / `unverifiable`.

**A. The new check `sec.injected_links`**

1. `CHECKS['sec.injected_links']` exists with `category: 'security'`, `severity: 'C'`, `compromise: true`, no
   `statusSetting`. Its `title`, `citizen` and `fix` are non-empty in both `en` and `ml`. Its `citizen.en` is
   exactly the text given in Approach §2.5.
2. Given the homepage link `http://ww547.keralagov.in?tkn=abc123` with empty link text, on site
   `lsg-bp-parappa` (`https://…lsgkerala.gov.in/…`), the check returns `r: 'fail'` and:
   - `ev` contains `ww547.keralagov.in`;
   - `ev` contains the rule names `parking-subdomain` and `gov-lookalike`;
   - `ev` does **not** contain `abc123`.
3. Each of these fails on its own rule, and `ev` names that rule:
   - (a) host `slotgacor88.xyz` → `spam-host`;
   - (b) link text `Situs Slot Gacor Maxwin` to `https://example.com/p` → `spam-text`;
   - (c) link text `ഓൺലൈൻ ചൂതാട്ടം` to `https://example.org/` → `spam-text`;
   - (d) host `kerala-govt.com` → `gov-lookalike`.
4. It returns `r: 'pass'` for a homepage whose outbound links are exactly:
   - `https://kerala.gov.in/` "മുഖ്യമന്ത്രി";
   - `https://keralapolice.gov.in/cyber` "Beware of online betting apps";
   - `https://hckerala.gov.in/` "Judiciary";
   - `https://indiankanoon.org/` "Judiciary";
   - `https://www.mygov.in/` "MyGov";
   - `https://www.cowin.gov.in/` "Book a slot";
   - `https://statelottery.kerala.gov.in/` "Kerala Lottery results";
   - `https://youtube.com/watch?v=x` "";
   - `https://facebook.com/x` "";
   - `https://kudumbashree.org/` "കുടുംബശ്രീ" (kudumbashree.org is a registry domain in the test's `officialDomains`).
5. It returns `r: 'na'` when `ctx.links` is undefined. It returns `r: 'pass'` when `ctx.links` is `[]`.
6. Whenever the check returns `fail`, `ev` is a non-empty string of at most 500 characters. At most 3 links are
   listed. No `?` in `ev` is followed by anything except `…`.
7. The check makes no network requests. Its `run` is synchronous and `security.ts` imports nothing from `net/`.
   `crawl()` over a link list containing `http://ww547.keralagov.in/?tkn=abc` makes zero requests to
   `keralagov.in`. (Crawl already skips off-host links. This pins it down.)
8. `scoreSite()` on a check list where only `sec.injected_links` fails (everything else passes or is `na`) returns:
   - `score.security === 60`;
   - a numeric `score.overall`;
   - a `status` in `healthy|needs-work|poor`, never `hijacked`/`broken`/`down`.

**B. Grading (`audit/src/actions.ts`)**

9. `gradeFor(checkId, outcome)` returns exactly:
   - `fail` outcomes:

     | check | grade |
     |---|---|
     | `avail.parked` | 1 |
     | `avail.redirect_offsite` | 1 |
     | `sec.safe_browsing` | 1 |
     | `sec.injected_links` | 1 |
     | `avail.dns` | 2 |
     | `avail.under_construction` | 2 |
     | `sec.https` | 2 |
     | `sec.cert_valid` | 2 |
     | `sec.vuln_js` | 3 |
     | `avail.flapping` | 3 |
     | `sec.hsts` | 4 |
     | `content.malayalam` | 4 |
     | `sec.csp` | 5 |
     | `gigw.help` | 5 |
     | `perf.lighthouse` | `null` |
     | `id.third_party` | `null` |
     | `avail.geo_blocked` | `null` |

   - `warn` outcomes:

     | check | grade |
     |---|---|
     | `sec.vuln_js` | 4 |
     | `avail.parked` | 4 |
     | `sec.hsts` | 5 |
     | `sec.csp` | 5 |

   - `pass` and `na` give `null`.
10. Over all of `CHECKS` with outcome `fail`, the number of check ids per grade is exactly:
    - grade 1: 4
    - grade 2: 8
    - grade 3: 17
    - grade 4: 22
    - grade 5: 28
    - `null`: 6

    That is 85 checks in total.
11. `report.sites.length` equals `registry.sites.length`, and every registry id appears exactly once. This holds
    even for sites with no result file. Those sites get bucket `unaudited` with `actions: []`.
12. Site buckets:
    - A deep-audited site with no graded actions gets `clear`.
    - A site with status `unverifiable` and no graded actions gets `unverifiable`.
    - A site with no deep audit, a passing light check and no light-derived action gets `unaudited`.
    - Otherwise the bucket is the minimum grade among the site's actions.
13. Status from light checks only:
    - A site with `status: 'down'` whose `issues[]` has no `down`-setting check gets exactly one synthetic action.
      It has `check` = `explainLightStatus(light)` (e.g. `avail.dns`), `grade: 2`, `basis: 'light'`,
      `observed` = `light.at`, and an `ev` that contains the light `status_class`.
    - Same for `broken` via an invalid certificate → `sec.cert_valid`.
    - A site whose `issues[]` already contains the status-setting check gets no duplicate synthetic action.
14. Action objects:
    - Every action from a deep-audit issue has `basis: 'deep'` and `observed` = `deep.at`.
    - Every action copies the issue's `ev` unchanged when present.
    - Every action with `grade === 1` has a non-empty `ev`. The function throws if a grade-1 input issue lacks
      one, because the check contract in AC6 guarantees it.
15. Ordering:
    - `report.sites` is sorted by bucket: `1,2,3,4,5,unverifiable,unaudited,clear`.
    - Within a bucket: registry `priority` ascending, then `name` (`localeCompare`, `en`).
    - Actions within a site are sorted by grade ascending, then severity `C>H>M>L`, then check id.
16. Totals and rollups:
    - `report.totals` has one count per bucket, and they sum to `registry.sites.length`.
    - `report.by_department[d]` bucket counts sum to that department's site count, for every department in
      `registry.departments`, including departments with zero sites (all-zero counts).
17. Writing and determinism:
    - `mergeAll()` writes `data/actions.json`.
    - The `light` CLI path writes `data/actions.json`.
    - Running `mergeAll()` twice on the same `out/` with the same `now` produces byte-identical `actions.json`.

**C. Site**

18. The built `/actions/` page:
    - shows the count of sites in buckets 1 and 2 and the total site count;
    - has one table row per site in buckets 1 and 2 (the `data-grade` attribute on each row is 1 or 2);
    - in every row, the site's most urgent action shows both the check's `title.en` and its `citizen.en` string.
      No row renders a grade label without a reason.
19. `/actions/grade/<g>/` exists for g = 1–5 and paginates at 100 sites per page (ADR-025). Its row count equals
    `report.totals[g]` summed across its pages.
20. `/departments/<id>/actions/` exists for every department, including a zero-site one (empty-state text, no 404).
    It lists that department's sites in report order with each site's actions, paginated at 100 sites.
21. Per-site pages:
    - `/sites/<id>/` has a "What to fix first" section, placed before the issue cards, listing the site's actions
      in report order. Each item has the grade label, check title, `citizen` text, and a link to the matching
      issue card anchor. For a light-only synthetic action, the link goes to the status reason instead.
    - When the bucket is 1 and a `compromise` check is among the actions, a banner at the top of the page shows
      that check's `citizen` text.
    - `/ml/sites/<id>/` shows the same section using `ml` strings, falling back to `en` for empty values.
22. `/ml/actions/` exists. It uses only i18n keys for UI copy. Every new key exists in both `en.json` and
    `ml.json`, and the 5 grade labels in `ml.json` differ from their `en.json` values.
23. Exports:
    - `/api/actions.json` equals the report plus `name`, `url`, `department`, `district` per site and
      `title_en`/`citizen_en` per action.
    - `/api/actions.csv` has exactly this header:
      `site_id,site_name,url,department,district,site_grade,action_grade,check_id,check_title,severity,basis,observed,evidence`
      and one row per action.
    - `/api/sites.csv` gains a trailing `action_grade` column (the bucket).
24. Sortable tables (`/actions/`, `/actions/grade/*`, `/departments/*/actions/`):
    - Without JS, rows are in AC15 order.
    - With JS, each column header is a `<button>` that sorts the rows on that page and sets `aria-sort`.
    - The sort script is a first-party module bundled by Astro. The built pages load no script, font or style
      from any origin other than our own.
25. The home page shows a tile "N sites need urgent action" linking to `/actions/`. N equals
    `totals[1] + totals[2]`. The ADR-005 headline number is unchanged by this work: the same data gives the
    same number before and after.
26. `/methodology/` has an "Action grades" section. It is generated from the exported `GRADE_RULES`, not
    hand-copied, and lists `sec.injected_links` among the checks (automatic from `CHECKS`).

**D. Integration**

27. `cli self-test` passes. The new fixture `fixture-injected` must fail `sec.injected_links`, and `fixture-good`
    must not fail it.
28. After deploy, a live `node audit/dist/cli.js run --ids lsg-bp-parappa` (the ≤ 3-site limit CLAUDE.md allows)
    gives one of two results:
    - `sec.injected_links` fails with `ev` naming `ww547.keralagov.in`; or
    - the link is no longer on the page. In that case the handoff records "link gone as of <date>" and the check is
      still proven by AC2/AC27.

## Approach

### 1. Types (`audit/src/checks/types.ts`)

- Add `'sec.injected_links'` to `CheckId`, after `'sec.safe_browsing'`.
- Add to `CheckMeta` an optional `compromise?: true`, with a doc comment: a sign that the site's own content
  may have been tampered with. Such a check is action grade 1 (ADR-028) but does not set status.
- Add to `CheckContext`:
  - `links?: { href: string; text: string }[]`: the homepage's links as captured, with `href` absolute
    (resolved against `finalUrl`/`site.url`). `undefined` means capture didn't run.
  - `officialDomains?: ReadonlySet<string>`: the registrable domains (tldts `getDomain`) of every registry site
    `url` and `aliases`, built once per run.

### 2. The check (`audit/src/checks/injected-links.ts`, new; registered in `SECURITY_CHECKS` in `security.ts`)

Pure, synchronous. Don't import anything from `net/`.

2.1 **Which links it looks at.** For each link in `ctx.links`:
- Parse the `href`. Skip non-http(s) and unparseable ones.
- Take `host` (lowercase) and `domain = getDomain(host)`.
- Skip the link when:
  - `domain` equals the site's own domain;
  - `domain ∈ officialDomains`;
  - `domain` ends with `.gov.in` or `.nic.in`, or equals `gov.in`/`nic.in`;
  - `domain ∈ LOOKALIKE_ALLOWLIST`. This is an exported constant, initially `['mygov.in']`. Its comment says
    that false positives get fixed here by a PR (ADR-028).

2.2 **Rules.** Evaluate every rule on each remaining link and collect the names of the rules that match:
- `parking-subdomain`: the first label of `host` matches `/^ww\d+$/` (`ww1.`, `ww25.`, `ww547.`). This
  does not match `www` or `www2`.
- `gov-lookalike`: `host` matches `/(kerala-?govt?|govt?-?kerala)/`. The skip rules already guarantee the
  domain is not a real `.gov.in` one.
- `spam-host`: `host` contains any of `SPAM_HOST_TERMS`, as a plain substring. This list must only hold terms
  that don't occur inside ordinary words:

  ```
  casino gacor togel sbobet 1xbet bet365 viagra cialis bokep maxwin slot88 slotgacor judionline pokerqq
  ```

- `spam-text`: the link text (trimmed, lowercased) matches `SPAM_TEXT_TERMS`.
  - English/Indonesian terms match on word boundaries (`\b…\b`):

    ```
    casino, gacor, togel, judi, judi online, slot gacor, slot online, situs slot, maxwin, sbobet, poker online,
    sports betting, satta, matka, viagra, cialis, escort, porn, bokep
    ```

  - Malayalam terms match as substrings, because `\b` does not work on Malayalam in JS regex:

    ```
    ചൂതാട്ടം, കാസിനോ, ബെറ്റിംഗ്, സട്ട
    ```

  - Leave out `lottery`/`ലോട്ടറി` on purpose: Kerala State Lotteries is a government department. Leave out a
    bare `slot` ("Book a slot") and a bare `betting` (police awareness text). Put this reasoning in a comment
    next to the lists.

2.3 **Outcome.**
- `ctx.links === undefined` → `na`.
- Otherwise, no matched link → `pass`.
- Otherwise → `fail`.

2.4 **Evidence.** Up to 3 matched links, in page order, joined with `; `. Each one is formatted as:

```
<redacted href> "<text truncated to 40 chars>" [rule1+rule2]
```

- Redacted href: `scheme://host/path`, plus `?…` if the original had a query. Drop the fragment. Truncate the
  path to 80 characters.
- If more than 3 links match, append `; +N more`.
- Cap the total at 500 characters.

Redacting the query keeps tracking tokens (the `tkn=` value) off our public pages and out of our data.

2.5 **Registry entry** (`checks/registry.ts`, after `sec.safe_browsing`), English text exactly:

```
title.en:   'Links to suspicious outside websites'
citizen.en: 'The home page contains links to outside websites that look like gambling, spam or fake-government pages. This often means someone has tampered with the site. Do not click them, and do not enter personal details on any page they lead to.'
fix.en:     'Check the listed links in your CMS and page templates; remove any your office did not add. If you did not add them, treat the site as compromised: change all admin passwords, update the CMS and plugins, and check recently modified files. CERT-In (incident@cert-in.org.in) can help.'
ref:        'OWASP A03:2021 Injection'
```

- `ml` strings: the builder drafts them in the same style as WP5.3's translations. The human reviews them
  (Open question 4). Empty `ml` is not acceptable here (AC1).
- `compromise: true`, `severity: 'C'`, `category: 'security'`.

### 3. Runner wiring (`audit/src/runner.ts`, `audit/src/cli.ts`)

- `RunOptions` gains `officialDomains?: ReadonlySet<string>`.
- `buildContext` sets:
  - `links` from `captured.links`, with hrefs resolved against the final URL. Unparseable hrefs are dropped;
  - `officialDomains` from opts.
- `cli run` (and `self-test`) builds the set once from the loaded registry with a new exported helper
  `officialDomainsOf(registry)`, in `audit/src/actions.ts` or `registry.ts`, whichever is more natural. It
  covers each site `url` plus `aliases`, reduced with `getDomain`, with nulls dropped.
- No change to `crawl.ts` behaviour (AC7 only adds a test).

### 4. Grading and the report (`audit/src/actions.ts`, new)

Exports:

```ts
export type Grade = 1 | 2 | 3 | 4 | 5;
export type Bucket = Grade | 'unverifiable' | 'unaudited' | 'clear';
export const BUCKET_ORDER: Bucket[] = [1, 2, 3, 4, 5, 'unverifiable', 'unaudited', 'clear'];
/** Data the methodology page renders; the same data gradeFor() applies. */
export const GRADE_RULES: { grade: Grade; rule: 'hijacked-or-compromise' | 'down-or-broken' | 'severity-C-H' | 'severity-M' | 'severity-L' }[];
export function gradeFor(id: CheckId, r: CheckOutcome, meta = CHECKS): Grade | null;
export interface Action { check: CheckId; grade: Grade; sev: Severity; basis: 'deep' | 'light'; observed: string; ev?: string }
export interface SiteActions { id: string; bucket: Bucket; status: ResultStatus; deep_at: string | null; light_at: string | null; actions: Action[] }
export interface ActionReport {
  generated: string;
  totals: Record<Bucket, number>;             // JSON keys "1".."5","unverifiable","unaudited","clear"
  by_department: Record<string, Record<Bucket, number>>;
  sites: SiteActions[];
}
export function computeActionReport(registry: Registry, results: Result[], opts: { now: Date }): ActionReport;
```

`gradeFor` rules:
- `pass`/`na` → `null`.
- For `fail`:
  - `statusSetting === 'hijacked'` or `compromise` → 1;
  - `statusSetting` `down`/`broken` → 2;
  - `statusSetting === 'unverifiable'` → `null`;
  - otherwise by severity: C/H → 3, M → 4, L → 5, I → `null`.
- For `warn`: work out the severity-only grade (C/H → 3, M → 4, L → 5, I → `null`), then add 1 and cap at 5.
  This ignores `statusSetting` and `compromise`. A warn is never grades 1–2.

Where the report's inputs come from:
- Deep actions come from `result.issues[]`. Each issue carries `id`, `sev` and `ev`, but not `r`. Recover the
  outcome from `result.deep.checks` (find the entry with the same id). Fall back to `'fail'` if it isn't there,
  because `issues` only ever contains fail/warn.
- Light synthetic action: when `status ∈ {down, broken}` and no deep action has a `statusSetting` equal to
  `status`, call `explainLightStatus(result.light)`. If that returns a CheckId, add an action with:
  - `grade: 2`;
  - `basis: 'light'`;
  - `observed: light.at`;
  - `ev: \`Light check ${light.at}: ${light.status_class}\``. When `sec.cert_valid` is the reason, include the
    TLS expiry, if the light result has one.

Other rules:
- Grade-1 invariant: throw `Error('grade-1 action without evidence: <id>/<check>')` if an issue that grades 1
  has no `ev`. Every grade-1 check already sets `ev` on fail. The builder confirms this for `avail.parked`,
  `avail.redirect_offsite` and `sec.safe_browsing`, and adds an `ev` in any check that doesn't. If one doesn't,
  it is a pre-existing bug, fixed in the same change.
- Ordering follows AC15. `generated = opts.now.toISOString()`. Do not use `new Date()` inside.

Writers:
- `mergeAll` (after the summary): `writeJsonAtomic(join(dataDir, 'actions.json'), computeActionReport(registry, allResults, { now: opts.now }))`.
- `cli light` (next to its `summary.json` write, around `cli.ts:170`): the same.
- Also update the `cli.ts:353` path that recomputes summary/outlinks from one result, if it writes summary.
- Do not add a new CLI subcommand.

### 5. Site

Add `site/src/lib/actions.ts`:
- `getActionReport()`: memoised. It calls `computeActionReport(getRegistry(), results, { now: new Date() })` over
  the same results `getSites()` loaded. It does not read `data/actions.json`, following the same rule as
  `getSummary()`: never be one stale file away from a wrong number.
- Pure view helpers, which is what the unit tests target:
  - `actionRows(report, sites, locale)` → rows `{ site, bucket, top: { title, citizen }, actions: [{grade, title, citizen, fix, ev, anchor}] }`,
    with `title`/`citizen`/`fix` from `CHECKS[id][field][locale] || CHECKS[id][field].en`;
  - `actionsCsv(report, sites)`;
  - `actionsApi(report, sites)`;
  - `compareRows(key, dir)`, the comparator the sort script reuses.

Components:
- `GradeBadge.astro`: number, icon and label. Never colour alone (DESIGN §7.4).
- `ActionTable.astro`: a `<table data-sortable>`. Each row has `data-grade`. Columns: Site, Department,
  District, Grade, "Most urgent problem" (title + citizen text), Actions (count), Checked (observed date).
- `ActionList.astro`: the per-site "What to fix first" list.
- `src/scripts/sortable-table.ts`: a first-party progressive enhancement, under about 60 lines. It turns `<th>`
  text into `<button>`s, sorts `tbody` rows by `data-sort-*` attributes, and sets `aria-sort`.
  Pages include it with `<script>` in the `.astro` file, so Astro bundles it same-origin.

Pages (ADR-025: paginate at 100):
- `pages/actions/index.astro`:
  - Headline: "N of M Kerala government websites need urgent action". Plain-language subtext comes from i18n.
  - Grade tiles 1–5 plus the three buckets, each with a count and a link.
  - An `ActionTable` of every bucket 1 and bucket 2 site. This is unpaginated. The expected size is under 100
    today (about 34 down/broken plus any injected). If it ever exceeds 300 rows, paginate. Leave that as a code
    comment, not a build now.
  - Short "How grades work" text with a link to `/methodology/#action-grades`.
  - Links to the CSV/JSON exports.
- `pages/actions/grade/[grade]/[...page].astro`: grades 1–5.
- `pages/departments/[department]/actions/[...page].astro`: a list of sites. Each site row expands with
  `<details>` to its full action list (title, citizen, fix, evidence).
- `pages/ml/actions/index.astro`: the same as the global page, with `locale='ml'`.
- `pages/api/actions.json.ts`, `pages/api/actions.csv.ts`.

Edits to existing pages:
- `pages/sites/[id].astro` and `pages/ml/sites/[id].astro`:
  - the compromise banner (AC21) at the top;
  - `ActionList` placed before the existing issue cards;
  - issue cards get `id="issue-<checkId>"` anchors, if they don't already have them.
- `pages/index.astro`: add the tile (AC25). Leave the headline untouched.
- `layouts/Layout.astro`: add a nav link "Action report".
- `pages/departments/[department]/[...page].astro`: add a link to its action page.
- `pages/methodology.astro`: add an "Action grades" section (`id="action-grades"`) rendered from `GRADE_RULES`,
  plus i18n labels.
- `pages/data.astro`: document the new exports.
- `lib/api.ts`: add the `action_grade` column to `sitesToCsv`. Add `actions` + `bucket` to `siteApiRecord`.

i18n: new keys, in `en.json` and `ml.json`:
- `actions.title`
- `actions.headline` (with `{n}`/`{total}`)
- `actions.intro`
- `actions.grade.1.label` … `actions.grade.5.label`
- `actions.grade.N.meaning` (one line each)
- `actions.bucket.unverifiable|unaudited|clear`
- `actions.col.*`
- `actions.whatToFixFirst`
- `actions.compromiseBanner.heading`
- `actions.contest`
- `actions.download`

English labels:
1. "Act now: visitors may be at risk"
2. "Act now: citizens cannot use the site"
3. "Fix soon"
4. "Plan a fix"
5. "Minor"

The `meaning` lines are category descriptions (ADR-026 allows these in `site/`). Per-finding reasons always
come from `CHECKS[...].citizen`.

### 6. Docs

- `docs/DESIGN.md`:
  - add §5.4.1 "Action grades" (the table from §4 above, citing ADR-028);
  - add the new rows to the §7.2 pages table;
  - add `sec.injected_links` to the §5.3 catalogue.
- `docs/STATE.md`: mark Q18 "→ plan 2026-09-30-graded-action-report, ADR-028". Update the handoff at the end.

## Files touched

**Created**
- `audit/src/actions.ts`
- `audit/src/checks/injected-links.ts`
- `audit/tests/actions.test.ts`
- `audit/tests/injected-links.test.ts`
- `audit/tests/fixtures/sites/pages/fixture-injected/…`, plus its entry in `audit/tests/fixtures/sites/registry.yaml`
  and `manifest.json` (follow the existing fixture layout)
- `site/src/lib/actions.ts`
- `site/src/components/GradeBadge.astro`
- `site/src/components/ActionTable.astro`
- `site/src/components/ActionList.astro`
- `site/src/scripts/sortable-table.ts`
- `site/src/pages/actions/index.astro`
- `site/src/pages/actions/grade/[grade]/[...page].astro`
- `site/src/pages/departments/[department]/actions/[...page].astro`
- `site/src/pages/ml/actions/index.astro`
- `site/src/pages/api/actions.json.ts`
- `site/src/pages/api/actions.csv.ts`
- `site/tests/actions.test.ts`

**Edited**
- `audit/src/checks/types.ts`
- `audit/src/checks/registry.ts`
- `audit/src/checks/security.ts`
- `audit/src/runner.ts`
- `audit/src/cli.ts`
- `audit/src/merge.ts`
- `audit/src/self-test.ts`
- `audit/tests/score.test.ts`
- `audit/tests/crawl.test.ts`
- `audit/tests/merge.test.ts`
- any count-asserting test that breaks because `CHECKS` grows from 84 to 85. Update the number and say so in
  the commit message.
- `site/src/lib/api.ts`
- `site/src/pages/sites/[id].astro`
- `site/src/pages/ml/sites/[id].astro`
- `site/src/pages/index.astro`
- `site/src/pages/methodology.astro`
- `site/src/pages/data.astro`
- `site/src/pages/departments/[department]/[...page].astro`
- `site/src/layouts/Layout.astro`
- `site/src/i18n/en.json`
- `site/src/i18n/ml.json`
- `site/tests/api.test.ts`
- `docs/DESIGN.md`
- `docs/STATE.md`
- `docs/DECISIONS.md` (ADR-028 status Proposed → Accepted once the human agrees; already drafted)

**Deleted**: none.

## Test plan

All audit tests use hand-built `CheckContext`/`Result` fixtures and a stub registry. None hits the network.
Expected values are literals, not recomputed through `gradeFor`.

| AC | Test (file › name) | Why it proves it |
|---|---|---|
| 1 | `injected-links.test.ts › registry entry is a C security compromise check with no status and bilingual copy` | Asserts each field literally, including exact `citizen.en` and non-empty `ml` strings. |
| 2 | `› flags the lsg-bp-parappa ww547.keralagov.in link and redacts its token` | Uses the real observed URL. Asserts `fail`, `ev` includes the host and both rule names, and `ev` excludes `abc123`. |
| 3 | `› flags a spam host`, `› flags spam link text (English/Indonesian)`, `› flags spam link text (Malayalam)`, `› flags a kerala-govt lookalike host` | One rule per test. Each asserts the rule name appears in `ev`, so removing a rule turns exactly one test red. |
| 4 | `› passes an ordinary panchayat homepage` (the 10 links in AC4) | Covers each known false-positive trap: judiciary/judi, "Book a slot", betting-awareness, lottery, mygov.in, a registry domain. |
| 5 | `› is na without captured links` / `› passes with zero links` | Pins the absent-vs-empty distinction the codebase uses elsewhere (`robotsTxt`). |
| 6 | `› evidence is bounded, lists at most 3 links, and never leaks a query string` (20 matching links with queries) | Asserts length ≤ 500, `+17 more`, and a regex `/\?(?!…)/` has no match. |
| 7 | `crawl.test.ts › never requests an off-host suspicious link` (injected fetch stub records URLs) + `injected-links.test.ts › run is synchronous` (return value is not a Promise) | The fetch log contains no `keralagov.in`, so the passive rule is enforced by a test. |
| 8 | `score.test.ts › an injected-links failure costs 40 security points but never sets status` | Literal `security === 60`, and status not in the broken class. Catches anyone adding `statusSetting`. |
| 9 | `actions.test.ts › gradeFor maps representative checks to literal grades` (table-driven, the 21 rows in AC9) | Literal expected grades per check, including warn demotion and nulls. |
| 10 | `actions.test.ts › grade distribution over the full catalogue is 4/8/17/22/28/6` | Counts are hand-computed from today's registry. Any accidental re-grading or new check shows up as a diff a human must acknowledge. |
| 11 | `› every registry site appears exactly once, including sites with no result` (registry of 5, results for 2) | `length === 5`, unique ids, and missing ones are `unaudited`. |
| 12 | `› buckets: clear, unverifiable, unaudited, and min-grade` (4 sites) | One literal bucket per constructed case. |
| 13 | `› light-only down gets one avail.dns action from the light result`, `› light-only cert failure gets sec.cert_valid`, `› no synthetic action when issues already explain the status` | Literal check id, grade 2, basis `light`, `observed` equals the fixture's `light.at`. |
| 14 | `› deep actions carry deep.at and the issue evidence verbatim`, `› throws on a grade-1 issue without evidence` | Evidence passthrough and the charitable invariant. |
| 15 | `› sites sort by bucket, priority, name; actions sort by grade, severity, id` | Fixtures inserted in shuffled order. Asserts the literal id sequence. |
| 16 | `› totals and per-department counts sum to site counts, including an empty department` | Literal numbers from a 6-site fixture registry with one empty department. |
| 17 | `merge.test.ts › merge writes actions.json and is byte-identical when run twice` + `cli light writes actions.json` (extend the existing light CLI test, if one exists; otherwise a test on the extracted write helper) | Reads the file twice and compares strings. |
| 18 | `site/tests/actions.test.ts › actionRows gives every urgent row a title and a citizen reason`. Build check (verifier): `grep -c 'data-grade="[12]"' site/dist/actions/index.html` equals `totals[1]+totals[2]` from `/api/actions.json` | Unit test proves the ADR-026 pairing. The build grep proves the page renders all of them. |
| 19 | Build check: page count and row totals under `site/dist/actions/grade/<g>/` versus `/api/actions.json` totals | Pagination stays consistent with the report. |
| 20 | Build check: `site/dist/departments/minority/actions/index.html` exists and contains the empty-state string. `lsgd` has at least 13 pages | Zero-site and large-department cases. |
| 21 | `site/tests/actions.test.ts › ml rows use ml strings and fall back to en when empty` + build check: `/sites/<an audited id>/index.html` has the `what-to-fix-first` section before the first `issue-` anchor | Locale fallback, plus placement. |
| 22 | `site/tests/i18n.test.ts › every actions.* key exists in both locales and grade labels are translated` | Literal key list. `ml !== en` for `actions.grade.[1-5].label`. |
| 23 | `site/tests/actions.test.ts › actionsCsv has the exact header and one row per action, with CSV escaping of evidence containing quotes/commas`; `api.test.ts › sites.csv has action_grade column` | Literal header string. Evidence with `"` and `,` round-trips. |
| 24 | `site/tests/actions.test.ts › compareRows sorts by grade then name, and reverses`. Build check: `grep -E '<(script|link)[^>]+(src|href)="https?://' site/dist/actions/index.html` has no match | Comparator correctness, plus the no-third-party rule (ADR-011). |
| 25 | Build check: the homepage tile number equals `totals[1]+totals[2]`. The ADR-005 headline number is identical to the pre-change build on the same `data/` checkout (verifier builds both) | Proves the new count doesn't move the headline. |
| 26 | `site/tests/methodology.test.ts › action-grade rows come from GRADE_RULES` (mutate an imported copy → rendered rows change) | Proves the page is generated, not hand-copied. |
| 27 | `cd audit && npm run build && node dist/cli.js self-test` with the new `fixture-injected` expectation | Integration over the real capture → context → check path, via the local fixture server. |
| 28 | Manual, once, after merge: `node audit/dist/cli.js run --ids lsg-bp-parappa` then inspect `sec.injected_links` in the output | The real case the human raised. Allowed by CLAUDE.md (≤ 3 ids). The result is recorded in the STATE handoff either way. |

Gaps flagged now:
- AC24's with-JS behaviour (clicking headers) has no automated browser test. There is no browser test harness
  in `site/`. Only the comparator is unit-tested. A human or verifier clicks through once on `npm run preview`.
- AC28 depends on the live page's current state.

## Open questions (human, before `builder` starts)

1. **Accept ADR-028?** The key choice is that `sec.injected_links` makes a site grade 1 but does **not** set
   status `hijacked`.
   - Recommendation: accept as written.
   - The alternative is to set `hijacked` ("do not visit"). That would put a council site with one injected link
     into the headline "broken" count on the strength of a heuristic, which cuts against the charitable rule.
2. **Grade labels.** The plan uses numbered grades 1–5 with the words in §5.
   - Are these the words you want journalists to quote? One option is "Urgent / High / Medium / Low".
   - Another is to merge grades 1 and 2 into one public "Urgent" level and keep them separate only in data.
3. **Spam term lists** (§2.2): do they need Kerala-specific exclusions beyond lottery and "Book a slot"? The
   lists are deliberately short to start.
4. **Malayalam copy** for the new check and the grade labels: the builder drafts it and you (or a named
   reviewer) approve, as in WP5.3.
5. **Deferred, confirm it's fine to leave out:**
   - hidden-link detection (spam injected with `display:none`), which needs a capture change to record link
     visibility;
   - "first seen" dates per action, which need per-issue history and more data-branch storage;
   - an Atom feed of new grade-1 findings.

   Each is a candidate for a follow-up plan.
6. **Platform-wide hits.** If a spam link is in the shared `lsgkerala` template, about 1,200 LSG sites flag at
   once. The plan reports each site honestly and does not collapse them. Should `/platforms/lsgkerala/` also get
   a one-line "N sites show this link" note? Not in scope unless you say so.

## Checklist

- [ ] Human accepts ADR-028 (and answers Q2–Q4). Flip the ADR status to Accepted with the date.
- [ ] `checks/types.ts`: `sec.injected_links` CheckId, `CheckMeta.compromise`, `CheckContext.links` + `officialDomains`
- [ ] `checks/registry.ts` entry (en exact per §2.5, ml drafted)
- [ ] `checks/injected-links.ts` + registered in `security.ts`
- [ ] `injected-links.test.ts` (AC1–7) written first, red, then green
- [ ] `crawl.test.ts` off-host no-fetch test (AC7); `score.test.ts` (AC8)
- [ ] runner/cli: `links` + `officialDomains` into the context; `officialDomainsOf(registry)`
- [ ] `fixture-injected` fixture site + self-test expectation (AC27); `fixture-good` mustNotFail includes `sec.injected_links`
- [ ] Confirm every grade-1 check sets `ev` on fail; fix any that don't
- [ ] `actions.ts` (`gradeFor`, `GRADE_RULES`, `computeActionReport`) + `actions.test.ts` (AC9–16)
- [ ] `merge.ts` + `cli light` write `data/actions.json`; tests (AC17)
- [ ] Fix any catalogue-count tests (84 → 85), noted in the commit message
- [ ] `cd audit && npm test --reporter=dot && npm run lint && npm run build && node dist/cli.js self-test`
- [ ] `site/src/lib/actions.ts` + `site/tests/actions.test.ts` (AC18/21/23/24 unit parts)
- [ ] i18n keys en + ml + `i18n.test.ts` (AC22)
- [ ] Components: GradeBadge, ActionTable, ActionList, `scripts/sortable-table.ts`
- [ ] Pages: `/actions/`, `/actions/grade/[grade]/`, `/departments/[d]/actions/`, `/ml/actions/`, `/api/actions.{json,csv}`
- [ ] Site page + ml site page: banner + "What to fix first" + issue anchors
- [ ] Home tile, nav link, department-page link, methodology section, data page docs, `sites.csv` column
- [ ] `cd site && npm test && npm run lint && npm run build` against a real `data/` checkout; run the AC18–25 build greps
- [ ] ADR-026 read-through of every new string: does each row state a specific reason?
- [ ] DESIGN.md §5.3/§5.4.1/§7.2 updates; STATE.md Q18 + WP-less work row + handoff
- [ ] Run `verifier` with AC1–27. Run `explainer` on `actions.ts`, `injected-links.ts`, `site/src/lib/actions.ts`
- [ ] After merge + deploy: AC28 live run on `lsg-bp-parappa`; record the result in the handoff

## Verification

(Filled in by `verifier` after implementation.)

---

## Appendix: ADR-028 as drafted (also appended to `docs/DECISIONS.md`, status Proposed)

> **ADR-028 · A graded action report for every site; signs of tampering are the top grade but never set status · Proposed · 2026-09-30**
> **Problem:** Open question 18. `lsg-bp-parappa`'s homepage links to `ww547.keralagov.in?tkn=…`: a parking-network-style
> subdomain on a domain that imitates `kerala.gov.in`. No check catches this, and nothing tells a webmaster, department or
> journalist what to fix first across ~1,560 sites. The human decided (2026-09-30): signs of compromise are "high priority
> for the entire website", and there must be an always-current, graded action report covering every site.
> **Decision:** (1) Five action grades, derived mechanically from `checks/registry.ts` and never assigned by hand per check:
> grade 1 = a failed `hijacked`-status check or a check marked `compromise: true`; 2 = a failed `down`/`broken`-status check
> (including a light-check-only `down`/`broken`); 3 = any other C or H; 4 = M; 5 = L. Severity-I checks and `avail.geo_blocked`
> are not actions. A `warn` counts as its severity's grade plus one (max 5) and can never be grade 1 or 2. A site's grade is
> its most urgent action. (2) A new check, `sec.injected_links` (security, C, `compromise: true`, no `statusSetting`), looks
> at the homepage's own outbound links. It flags three things: parking-style `ww<digits>.` subdomains, hosts that imitate
> Kerala government names, and gambling/adult/pharma words in the host or link text (English and Malayalam). Links to
> registry domains and to `*.gov.in`/`*.nic.in` never match. The check never fetches the links it flags. It always stores
> evidence and redacts query strings from it. (3) It does **not** set `hijacked`. A link-text heuristic is not strong enough
> to tell a citizen "do not visit" a working council website, or to move the ADR-005 headline. (4) One pure function
> (`audit/src/actions.ts`) computes the report. `merge` and `light` write it to `data/actions.json`, and the site build
> recomputes it from the same results.
> **Rejected:** making `sec.injected_links` status-setting (too strong for a heuristic; changes the headline); per-check
> hand-assigned grades (would drift from severity); detection from `data/outlinks.json` alone (it keeps only registrable
> domains, so `ww547.keralagov.in` is recorded as `keralagov.in` with no URL: not enough evidence to accuse a site).
> **Consequence:** an affected site loses 40 security points (normal C deduction). The methodology page documents the grades
> from the same code. A false positive gets fixed by a PR to the check's allowlist, and every grade-1 row links to "Suggest a
> correction".
