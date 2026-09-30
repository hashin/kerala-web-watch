# Government and government-aided colleges as separate but linked sections

**Date**: 2026-09-30
**Status**: planned

## Goal

Resolves STATE.md Open question 16. The human decided (Handoff 2026-09-30, "later" entry) that the registry and the site
cover **both** government colleges and government-aided colleges, as **separate but linked** sections.

Why this matters: of the 49 WP5.4 records in `registry/sites/colleges.yaml`, some are run by private trusts or community
organisations (TKM, NSS, Mar Athanasius), not by the Government of Kerala. Right now every one of the 49 shows the
same note on its public page: "DTE's own directory does not distinguish government from government-aided institutions
(Open question 16) -- may not be purely government." That note is internal project jargon a citizen can't use, and it
leaves out the one thing they need to know: who runs this college, and so who is responsible for its website.

After this change:

- every college record says whether it is `government` or `aided`, and links to the official document that says so
  (it can also be left unset, which means "not confirmed yet", but never guessed);
- the site has `/colleges/` with two linked sections, `/colleges/government/` and `/colleges/aided/`;
- every college's own page names its section and explains the term in one plain sentence (ADR-026's spirit: a label is
  never shown without what it means);
- the data API exposes the field;
- the methodology page and DESIGN.md explain the split and where each classification comes from.

## Research findings (light, passive, about 14 requests total, done 2026-09-30)

All of these were fetched once, with the project User-Agent and at least 1 s between requests. The raw files were kept
only in the session scratchpad.

| Source | What it says | Usable for the split? |
|---|---|---|
| `https://dtekerala.gov.in/institutiondetail/1/` and `/2/` (the WP5.4 sources) | Their nav titles are literally "സർക്കാർ, എയ്ഡഡ് എഞ്ചിനീയറിംഗ് കോളേജുകൾ" / "…പോളിടെക്നിക് കോളേജുകൾ" ("Government, aided …"). Table columns: SL No / Name / Established / Website. There is no type column. | **No.** This confirms the lists are mixed. |
| **KEAM 2026 Prospectus** (Commissioner for Entrance Examinations, a Government of Kerala body): `https://cee.kerala.gov.in/keam2026/pdf/Prospectus.pdf`, Annexure II (1)(a), §I "Engineering colleges under the Director of Technical Education (DTE)", **PDF page 105** | Has explicit sub-headings. **Government** lists 9: IDK Idukki, KKE Kozhikode, KNR Kannur, KTE RIT Pampady, PKD Palakkad, TCR Thrissur, TRV Barton Hill, TVE CET, WYD Wayanad. **Aided** lists 2: MAC Kothamangalam, NSS Palakkad. **Aided Autonomous** lists 1: TKM Kollam. That is 9 + 3, which matches STATE.md's 9 + 3. | **Yes, for all 12 engineering records.** This is authoritative and needs no guessing. |
| `https://polyadmission.org/diploma/files/annexure01-listofpolytechnics.pdf` (DTE/SITTTR diploma admission 2026, Annexure I) | Titled "LIST OF GOVT & GOVT. AIDED POLYTECHNIC COLLEGES…". The two types are not marked separately. Its self-financing section repeats some aided colleges (Carmel, SN Kottiyam), but only "selected" aided ones, so that is not a complete signal. | **No.** |
| Diploma prospectus 2026 §2.4.2 and Annexure V | Defines "management seats in aided polytechnics = 15 % of intake" but lists no colleges by type. | **No.** It is useful only as a citation for the plain-language meaning of "aided". |
| `https://collegiateedu.kerala.gov.in/?page_id=179` ("സർക്കാർ കോളേജുകൾ", Directorate of Collegiate Education) | A **government-only** table of 75 colleges (66 Arts & Science, 4 Training, 4 Music, 1 Physical Education), with district. **It has no website column.** | **Yes, as a government source for a future arts-and-science harvest.** It can't supply URLs, and CLAUDE.md forbids inventing them. |
| Collegiate Education home page links `…/uploads/2019/10/Government.xlsx`, `Aided.xlsx`, `Unaided.xlsx` on `61.0.248.125` | `Government.xlsx` returns **404**, and the others are from the same dead 2019 upload. | **No.** No current official aided arts-and-science list was found. |

For **polytechnics (37 records) there is no single authoritative split.** See Open question 2.

Side finding for future harvests (not needed for the 49): KEAM Annexure II(1)(a) also lists "Government cost-sharing"
engineering colleges run by IHRD, LBS, CAPE, KSRTC and CCE. These are self-financing institutions owned by state bodies.
When they are harvested, their management value needs a decision (Open question 3).

## Acceptance criteria

The work comes in two phases. **Phase A** depends on no human answer. **Phase B** needs Open question 2 answered first.

### Phase A

1. `registry/schema.json`'s `Site` accepts two new optional properties:
   - `management`: `"government" | "aided" | null`
   - `management_source`: a string matching `^https?://`, or `null`

   A site with `management: private` (any value outside the enum) fails `validate` with a `schema` failure.
2. `validate` reports an **error** with rule `management-tier` for any site whose `tier` is not `college` but whose
   `management` is non-null.
3. `validate` reports an **error** with rule `management-source` for any site whose `management` is non-null while its
   `management_source` is missing or null.
4. `validate` reports a **warning** (severity `warn`, not `error`) with rule `management-missing` for any `tier: college`
   site whose `management` is missing or null. `node audit/dist/cli.js validate` exits 0 when these warnings are the only
   failures.
5. In the real `registry/sites/colleges.yaml`, the 12 `engineering_college` records have exactly these values, each with
   `management_source: https://cee.kerala.gov.in/keam2026/pdf/Prospectus.pdf#page=105`:
   - `government` (9): `college-of-engineering-trivandrum`, `government-engineering-college-idukki`,
     `government-engineering-college-kozhikode`, `government-engineering-college-thrissur`,
     `govt-college-of-engineering-kannur`, `govt-engineering-college-barton-hill`, `govt-engineering-college-palakkad`,
     `govt-engineering-college-wayanad`, `rajiv-gandhi-institute-of-technology-kottayam`.
   - `aided` (3): `mar-athanasius-college-of-engineering-kothamanga`, `nss-college-of-engineering-palakkad`,
     `tkm-college-of-engineering`.
6. The migrated `registry/sites/colleges.yaml` meets all of these:
   - all 49 records carry both `management` and `management_source` keys;
   - no record's `notes` contains "Open question 16" or "may not be purely government";
   - every id, url and `added` date is unchanged from commit `84448922`;
   - no file other than `colleges.yaml` under `registry/sites/` contains a `management` key.

   `validate` on the real registry then reports 0 errors and exactly as many `management-missing` warnings as there are
   records with null `management` (37 at the end of Phase A: all polytechnics).
7. `scripts/harvest/colleges.ts`, when it rebuilds `colleges.yaml`:
   - copies `management` and `management_source` forward from the existing record with the same `id`;
   - writes `management: null, management_source: null` for an id not seen before;
   - never writes the old `DTE_AIDED_NOTE` text (the constant is deleted).
8. `/colleges/` (built `site/dist/colleges/index.html`) meets all of these:
   - it links to `/colleges/government/` and `/colleges/aided/`;
   - it shows each section's site count;
   - it gives each section a one-sentence, plain-language meaning, from the same i18n strings the per-site line uses;
   - it lists "not yet confirmed" colleges in a third block only when there are any, and that block says why.
9. `/colleges/government/` lists every college with `management: government` and no other site. `/colleges/aided/` does
   the same for `aided`. Each of the two pages links to the other and back to `/colleges/`. With Phase A data, the
   government page lists exactly 9 sites and the aided page exactly 3, and `tkm-college-of-engineering` appears only on
   the aided page.
10. A college's page states which section it belongs to, what that means, and links to that section. This holds on both
    `/sites/<id>/` and `/ml/sites/<id>/`:
    - an aided example reads "Government-aided college" plus its meaning sentence plus a link to `/colleges/aided/`;
    - an unset example reads the "not yet confirmed" text;
    - the `/ml/` page shows the Malayalam strings;
    - a non-college page (e.g. `/sites/keralapsc/`) shows none of this.
11. Every new i18n key exists in both `en.json` and `ml.json` (the existing parity test covers this). Each new `ml.json`
    value is different from its `en.json` value, which proves it was actually translated.
12. `/kinds/engineering_college/` and `/kinds/polytechnic/` each link to `/colleges/government/` and `/colleges/aided/`.
    The home page's Browse list links to `/colleges/`.
13. Data API: `/api/sites.csv`'s header gains a `management` column (after `platform`), blank for non-college sites. Each
    `/api/sites/<id>.json` record and each `/api/all.json` record includes `management` (null for non-college sites).
    The `/data/` page's CSV column description lists `management`.
14. Documentation:
    - `/methodology/` has a section headed "Government and government-aided colleges" that:
      - explains both terms in plain language;
      - names the classification source for each kind of college, with links;
      - states that an unconfirmed college is never guessed;
      - states how aided colleges count toward the headline number (per the answer to Open question 1).
    - `docs/DESIGN.md` §2 (scope table row), §3.1 (the YAML example and field comments) and §7.2 (pages table) mention
      `management` and `/colleges/`.
    - ADR-028 (text below) is appended to `docs/DECISIONS.md`.
    - STATE.md Open question 16 is marked resolved and points to ADR-028.
15. Plain-language rule: the site's one function that produces a college's management text never returns a label
    without its meaning sentence. No page renders `management` by any other route: the words "aided" and "government"
    as section labels come only from that function or from the i18n keys it uses.
16. Nothing else changes: scheduler, status and scoring code do not read `management`. `cd audit && npm test`,
    `cd site && npm test`, `cd site && npm run build` and `npm test` at the repo root (for `scripts/harvest/`) all pass.

### Phase B (only after Open question 2 is answered)

17. All 37 `polytechnic` records have a non-null `management` and a non-null `management_source`. `validate` reports 0
    `management-missing` warnings. `/colleges/` no longer shows a "not yet confirmed" block.

## Approach

### 1. Registry model (audit package + schema)

- Use a **field, not a new tier.** `tier` drives the scheduler's `priority` and the tier-per-file layout. Management is
  a separate question from what the organisation is, so it doesn't belong in `tier`. This mirrors the existing
  `lsg_type`-only-when-`tier: lsg` pattern, and makes the validate rules structurally identical to the existing
  `lsg-type` ones (`audit/src/validate.ts` around lines 197–202).
- Changes to `registry/schema.json` `$defs.Site.properties`:
  ```json
  "management": { "type": ["string", "null"], "enum": ["government", "aided", null], "default": null },
  "management_source": { "type": ["string", "null"], "pattern": "^https?://", "default": null }
  ```
  Do **not** add either field to `required`. The ~1,500 non-college records stay untouched and must not grow two null
  keys each.
- `audit/src/types.ts`: add `export type Management = 'government' | 'aided';` and on `Site` add
  `management?: Management | null; management_source?: string | null;` with a one-line comment citing ADR-028.
- `audit/src/validate.ts`, next to the `lsg-type` block: add three rules (`management-tier`, `management-source`,
  `management-missing`). The first two use the existing `fail()` (severity `error`). `management-missing` needs a
  warn-severity push. There is no existing `warn()` helper inside this loop, so add one beside `fail`, the same shape
  with `severity: 'warn'`. Update the function's JSDoc list of rules.
- `audit/src/registry.ts` `loadRegistry` needs no change. It spreads the whole record, so the field passes through to
  `site/`.

### 2. Migration of the 49 records (one-off, by script, kept for provenance)

- Write `scripts/migrate/2026-09-30-college-management.ts`. It is a small, idempotent script that:
  1. reads `registry/sites/colleges.yaml`;
  2. applies a hard-coded `Record<id, { management, management_source }>` for the 12 engineering ids in AC 5;
  3. sets `management: null, management_source: null` on every other record;
  4. sets `notes: ''` on every record whose notes equal the old caveat. Only an exact match is touched; any other note
     is preserved and printed to stderr for a human to look at.
  5. writes the file back with the same `dumpYaml(…, { sortKeys: false, lineWidth: -1 })` options `colleges.ts` uses.
     This keeps the diff to the added keys and cleared notes.

  Field order: insert `management` and `management_source` directly after `platform`. The script must refuse to run
  (exit 1) if any of the 12 ids is missing, so a future id drift can't pass silently.
- Why drop the caveat rather than reword it: the unset state now shows in the UI as its own plain-language label (AC 10),
  so keeping a note too would say the same thing twice.
- Run the script once, run `validate`, and commit the script and the YAML together.

### 3. Harvest script keeps classifications (`scripts/harvest/colleges.ts`)

- Delete `DTE_AIDED_NOTE`, and have `toSiteEntry` write `notes: ''`.
- Add an exported pure function:
  ```ts
  carryForwardManagement(entry, existingById: Map<string, Pick<SiteEntry,'management'|'management_source'>>)
  ```
  It returns the entry with the existing values, or with `null`/`null` if the id is new.
- In `run()`, read the current `sites/colleges.yaml` (if present) into that map before writing, and apply the function to
  every entry. Add the two fields to the `SiteEntry` interface, after `platform`.
- Out of scope, but worth recording: the same re-run also resets `added` to today. That is a pre-existing hazard (see
  Open question 4). Don't widen this change to fix it unless the human says so.

### 4. Site

- **`site/src/lib/colleges.ts`** (new, pure, unit-tested). This is the only place that knows the mapping:
  - `type CollegeSection = 'government' | 'aided' | 'unconfirmed'`
  - `collegeSection(site): CollegeSection | null` returns null when `site.tier !== 'college'`, and `'unconfirmed'` when
    `management` is null or missing.
  - `collegesBySection(sites): Record<CollegeSection, SiteView[]>` returns each list sorted by `name` with
    `localeCompare`.
  - `collegeManagementText(site, locale): { section, label, meaning, href } | null` returns label and meaning via `t()`.
    `href` is `/colleges/<section>/`, or `/colleges/` for unconfirmed. This function is AC 15's single route.
- **Pages** (English, hard-coded headings like the existing `/kinds/` pages, but the label and meaning come from i18n
  through the function above):
  - `site/src/pages/colleges/index.astro`: the hub. Intro sentence, then two cards/sections, each with:
    - its label;
    - its meaning;
    - the count;
    - a link to the section;
    - a `GroupRollup` for that section.

    Below them, the unconfirmed block, rendered only if that list is non-empty: the unconfirmed label and meaning, and a
    `SiteTable` of those sites.
  - `site/src/pages/colleges/[management]/[...page].astro`: `getStaticPaths` over `['government', 'aided']` and
    `paginate(..., { pageSize: 100 })`. ADR-025 applies, because government will pass 100 once the 75 DCE colleges
    arrive. Each page has:
    1. the `<h1>` label;
    2. the meaning paragraph;
    3. a "See also" line linking to the other section, with its count;
    4. `← All colleges` linking to `/colleges/`;
    5. a `GroupRollup`;
    6. a `SiteTable`;
    7. `Pagination`.

    Both sections must be generated even when empty. If aided had 0 sites, the page still renders with "0 tracked
    sites", so links never 404.
- **`site/src/components/CollegeManagement.astro`** (new), with props `site` and `locale`. It renders nothing for a
  non-college site. Otherwise it renders `<p class="college-management"><strong>{label}</strong> — {meaning}
  <a href={href}>{seeAll}</a></p>`. Include it in `site/src/pages/sites/[id].astro` and `site/src/pages/ml/sites/[id].astro`,
  directly after the `status-reason` paragraph inside `.site-header`.
- **`site/src/pages/kinds/[kind]/[...page].astro`**: when any site of this kind has `tier === 'college'`, render one line
  under the count: "This list mixes government and government-aided colleges — see [government colleges] ·
  [government-aided colleges]."
- **`site/src/pages/index.astro`** Browse list: add `<li><a href="/colleges/">Colleges — government and government-aided</a></li>`.
- **`site/src/lib/api.ts`**: add `'management'` to `CSV_COLUMNS` after `'platform'`, with value `s.management ?? ''`. Add
  `management: site.management ?? null` to the per-site API record type and builder. **`site/src/pages/data.astro`**:
  update the CSV column sentence.
- **`site/src/pages/methodology.astro`**: new `<h2>Government and government-aided colleges</h2>` section after "Status
  definitions". Suggested copy (builder may tighten, but keep the facts and the links):
  > Kerala has two kinds of public college. A **government college** is run directly by the Government of Kerala. A
  > **government-aided college** is run by a private trust, society or community organisation, but the Government pays
  > its teachers' salaries and fills most of its seats through the state's own admission process. We audit both, and
  > list them separately ([government](/colleges/government/) · [government-aided](/colleges/aided/)) so it is clear who
  > is responsible for each website. We only mark a college as one or the other when an official document says so:
  > for engineering colleges, the KEAM prospectus published by the Commissioner for Entrance Examinations; for
  > polytechnics, [per Open question 2]. Until then a college is shown as "not yet confirmed" — we never guess.
  > [Sentence per Open question 1, e.g.: "Government-aided colleges count toward the headline number of Kerala
  > government websites, because they are publicly funded and publicly regulated."]
- **i18n keys**: add to both `en.json` and `ml.json`. The Malayalam uses the directorates' own terms ("സർക്കാർ",
  "എയ്ഡഡ്"). The builder should have a native reader confirm it, as WP5.3 did.

  | key | en | ml (proposed) |
  |---|---|---|
  | `college.government.label` | Government college | സർക്കാർ കോളേജ് |
  | `college.government.meaning` | Run directly by the Government of Kerala. | കേരള സർക്കാർ നേരിട്ട് നടത്തുന്ന കോളേജ്. |
  | `college.government.seeAll` | See all government colleges | എല്ലാ സർക്കാർ കോളേജുകളും കാണുക |
  | `college.aided.label` | Government-aided college | സർക്കാർ എയ്ഡഡ് കോളേജ് |
  | `college.aided.meaning` | Run by a private trust, society or community organisation; the Government of Kerala pays its teachers' salaries and fills most of its seats. | ഒരു സ്വകാര്യ ട്രസ്റ്റോ സൊസൈറ്റിയോ സമുദായ സംഘടനയോ നടത്തുന്ന കോളേജ്; അധ്യാപകരുടെ ശമ്പളം നൽകുന്നതും മിക്ക സീറ്റുകളിലേക്കും പ്രവേശനം നടത്തുന്നതും കേരള സർക്കാരാണ്. |
  | `college.aided.seeAll` | See all government-aided colleges | എല്ലാ സർക്കാർ എയ്ഡഡ് കോളേജുകളും കാണുക |
  | `college.unconfirmed.label` | College — not yet confirmed whether government or government-aided | കോളേജ് — സർക്കാരോ എയ്ഡഡോ എന്ന് ഇതുവരെ സ്ഥിരീകരിച്ചിട്ടില്ല |
  | `college.unconfirmed.meaning` | The official list we found it on names government and government-aided colleges together without saying which is which, so we have not guessed. | ഞങ്ങൾ കണ്ടെത്തിയ ഔദ്യോഗിക പട്ടികയിൽ സർക്കാർ, എയ്ഡഡ് കോളേജുകൾ വേർതിരിക്കാതെ ഒരുമിച്ചാണ് നൽകിയിരിക്കുന്നത്; അതിനാൽ ഞങ്ങൾ ഊഹിച്ചിട്ടില്ല. |
  | `college.unconfirmed.seeAll` | See all colleges | എല്ലാ കോളേജുകളും കാണുക |

### 5. What does not change

- `audit/src/scheduler.ts`, `status.ts`, `score.ts` and `summary.ts` stay as they are. Headline totals keep counting every
  registry site, aided included, unless Open question 1 is answered the other way. If it is, that becomes a separate
  plan, because it touches `summary.json`'s shape.
- `.github/ISSUE_TEMPLATE/add-website.yml` is unchanged. Citizen submissions go to candidates, and a curator who registers
  a college either sets `management` with a source or leaves it null, which `validate` then warns about.

## Proposed ADR (builder appends to `docs/DECISIONS.md` verbatim; status flips to Accepted once the human answers Open question 1)

```
## ADR-028 · Government-aided colleges are in scope, marked by a sourced `management` field and shown as a separate, linked section · Proposed · 2026-09-30
**Problem:** DESIGN §2 scoped "government colleges", but DTE's own lists mix government and government-aided institutions
(Open question 16), and aided colleges are run by private managements with state funding. The human decided (2026-09-30)
to cover both, as separate but linked sections. Remaining choices: how to model it, what counts as evidence, how to count it.
**Options:** (a) new tier `aided_college`; (b) a `management: government | aided` field on `tier: college`; (c) exclude aided.
**Decision:** (b). `tier` stays about what the organisation is (it drives priority); `management` says who runs it.
`management` is set only with a `management_source` URL to an official document that states it (validate errors
otherwise); `null` means "not yet confirmed" and is shown to citizens as exactly that — never guessed from a name
(validate warns). Only `tier: college` may carry it. The site shows `/colleges/government/` and `/colleges/aided/`, linked
to each other, and every label is paired with a one-sentence meaning (ADR-026's rule applied to categories).
**Counting (pending human):** aided colleges count toward the headline "Kerala government websites" total and department
rollups (publicly funded and regulated; <1 % of the registry), disclosed on /methodology/.
**Consequence:** DTE engineering classified via the KEAM prospectus (Annexure II(1)(a)); polytechnics and Collegiate
Education arts & science need their own official source before they are marked. `colleges.ts` carries the field forward.
```

(That is 12 lines of body, within the ADR format's limit.)

## Files touched

**Created**
- `scripts/migrate/2026-09-30-college-management.ts`: one-off migration, kept for provenance
- `site/src/lib/colleges.ts`
- `site/src/components/CollegeManagement.astro`
- `site/src/pages/colleges/index.astro`
- `site/src/pages/colleges/[management]/[...page].astro`
- `site/tests/colleges.test.ts`
- `audit/tests/fixtures/registry/management-on-non-college/`, `management-without-source/`, `management-missing/`,
  `management-bad-enum/`: each a copy of `valid/` plus one `sites/colleges.yaml` (and `engineering_college` added to the
  copied `kinds.yaml`)

**Edited**
- `registry/schema.json`, `registry/sites/colleges.yaml` (by the migration script only)
- `audit/src/types.ts`, `audit/src/validate.ts`, `audit/tests/registry.test.ts`
- `audit/tests/fixtures/registry/valid/sites/` (add one `colleges.yaml` with a government college and its source, plus
  the kind in `valid/kinds.yaml`), so the valid-fixture test covers the happy path
- `scripts/harvest/colleges.ts`, `scripts/harvest/colleges.test.ts`
- `site/src/i18n/en.json`, `site/src/i18n/ml.json`
- `site/src/pages/sites/[id].astro`, `site/src/pages/ml/sites/[id].astro`, `site/src/pages/kinds/[kind]/[...page].astro`,
  `site/src/pages/index.astro`, `site/src/pages/methodology.astro`, `site/src/pages/data.astro`
- `site/src/lib/api.ts`, `site/tests/api.test.ts`
- `docs/DESIGN.md` (§2, §3.1, §7.2), `docs/DECISIONS.md` (ADR-028), `docs/STATE.md` (Q16 resolved, registry note,
  handoff)

**Deleted**: none. (The `DTE_AIDED_NOTE` constant is removed from inside `colleges.ts`.)

## Test plan

| AC | Test | Why this test proves it |
|---|---|---|
| 1 | `audit/tests/registry.test.ts`: `rejects a management value outside government/aided` (fixture `management-bad-enum`, `management: private`), expecting one failure with rule `schema` on that id | Fails if the enum is widened or the property is typed as a free string |
| 1 | the existing `reports no failures for the valid fixture`, with `valid/` now containing a college with `management: government` and a source | Fails if the schema doesn't know the new properties (`additionalProperties: false` would reject them) |
| 2 | `rejects management set on a site whose tier is not college` (fixture `management-on-non-college`: `tier: statutory, management: aided, management_source: https://…`), expecting exactly `[{ rule: 'management-tier', id }]` | Fails if the tier guard is missing or inverted |
| 3 | `rejects management set without a management_source` (fixture `management-without-source`), expecting `[{ rule: 'management-source', severity: 'error' }]` | Fails if evidence stops being required, which is the "never guessed" rule |
| 4 | `warns, not errors, when a college has no management` (fixture `management-missing`), expecting exactly one failure `{ rule: 'management-missing', severity: 'warn' }` | Fails if it's an error (it would block CI on 37 real records) or silent |
| 4 | the same fixture through the CLI path: a test calling the exported validate command runner (or `hardFailures` logic at `cli.ts:94`) asserts exit code 0 | Proves warnings alone don't fail `validate`. If the runner isn't exported, builder adds a thin export rather than spawning a process |
| 5, 6 | `audit/tests/registry-colleges.test.ts` (new, reads the **real** `registry/`, following the precedent of `registry-metadata.test.ts` reading real `CHECKS`): (a) the 9 government and 3 aided ids from AC 5 each have that `management` and the KEAM `#page=105` source; (b) every `tier: college` record has both keys present (`'management' in site`); (c) no college `notes` matches `/Open question 16\|may not be purely government/`; (d) no non-college site has a non-null `management`; (e) `validateRegistry(realDir)` has 0 errors, and its `management-missing` warning count equals the number of colleges with null management | Hard-coded expected ids, not recomputed from the data. Fails if a record is misclassified, a key is missing, or the old jargon survives |
| 6 | Verify step (not vitest): `git diff 84448922 -- registry/sites/colleges.yaml \| grep '^[-+]  \(id\|url\|added\):'` prints nothing | Proves ids, urls and added dates are unchanged (ADR-012) |
| 7 | `scripts/harvest/colleges.test.ts`: `carryForwardManagement keeps an existing record's management and source by id`; `carryForwardManagement sets both to null for an id not in the existing file`; `toSiteEntry never writes the old DTE caveat note` (asserts `notes === ''` for a `dte-` source) | Fails if a re-harvest would wipe the human-sourced classifications, or bring back the jargon |
| 8, 9, 15 | `site/tests/colleges.test.ts`: `collegeSection returns null for a non-college site`; `collegeSection treats missing and null management as unconfirmed`; `collegesBySection puts each college in exactly one section and excludes non-colleges` (fixture of 5 hand-built sites, expected ids written out literally); `collegesBySection sorts each section by name`; `collegeManagementText always returns a non-empty meaning alongside the label, in both locales, for all three sections`; `collegeManagementText links aided to /colleges/aided/ and unconfirmed to /colleges/` | Page content derives from these functions. The meaning test is AC 15's guard: it fails if a label ever ships without its meaning |
| 8, 9, 10, 12 | Verify step after `cd site && npm run build` (the existing pattern: site pages have no DOM tests). `grep -c` on built HTML: `dist/colleges/index.html` contains `href="/colleges/government/"` and `href="/colleges/aided/"`; `dist/colleges/aided/index.html` contains `tkm-college-of-engineering` and `href="/colleges/government/"`; `dist/colleges/government/index.html` does **not** contain `tkm-college-of-engineering`; `dist/sites/tkm-college-of-engineering/index.html` contains `Government-aided college`; `dist/ml/sites/tkm-college-of-engineering/index.html` contains `എയ്ഡഡ്`; `dist/sites/keralapsc/index.html` does not contain `college-management`; `dist/kinds/polytechnic/index.html` links to both sections; `dist/index.html` links to `/colleges/` | End-to-end wiring check for each page AC. `verifier` should break the include in `[id].astro` and confirm the grep fails |
| 11 | the existing `site/tests/i18n.test.ts` parity test, plus a new case: `translates every college.* key (ml value differs from en)` | Fails if a key is missing in one locale, or ml is an English copy-paste |
| 13 | `site/tests/api.test.ts`: extend `writes a header row…` to expect `management` after `platform`; new `writes the management value for a college and leaves it blank for a non-college`; `siteApiRecord includes management, null for a non-college site` | Fails if the column is missing, misplaced or mis-valued |
| 14 | Verify step: `grep -n "Government and government-aided colleges" site/dist/methodology/index.html`; `grep -n "management" docs/DESIGN.md` shows §3.1 and §2 hits; `grep -n "ADR-028" docs/DECISIONS.md docs/STATE.md` | Documentation is not unit-testable. This is a presence check, and a human reviews the wording |
| 16 | `cd audit && npm test`, `cd site && npm test && npm run build`, `npm test` (root). Plus `grep -rn "management" audit/src/{scheduler,status,score,summary}.ts` prints nothing | Regression, and proves the field didn't leak into status or score logic |
| 17 | Phase B: extend `registry-colleges.test.ts` with `every polytechnic has a sourced management value` and `validate reports no management-missing warnings`; built `dist/colleges/index.html` doesn't contain the unconfirmed label | Hard-coded expectation of zero unconfirmed |

No acceptance criterion is without a test. ACs 8–10, 12 and 14 rely partly on build-output greps rather than vitest,
which is the same as every existing site page in this repo. Flagging it so `verifier` knows to mutation-test those greps
by hand.

## Open questions

1. **Headline counting.** Should government-aided college sites count toward "X of Y Kerala government websites are
   broken" and the Higher Education department rollup?
   - *Recommendation: yes.* They are publicly funded, regulated by DTE/DCE, and admit mostly through state quotas, and
     they are under 1 % of the registry. Disclose this on /methodology/.
   - The alternative (exclude them from the headline and department rollups) changes `summary.json`'s shape and the home
     page, and should be its own plan.

   Phase A proceeds with the recommendation. Only the methodology sentence depends on the answer.
2. **Polytechnic source (blocks Phase B).** No single official document found labels the 37 polytechnics.
   - Options:
     - (a) Treat an official institution name containing "Government"/"Govt" in DTE's own list as sufficient evidence for
       `government` (29 of 37, with `management_source` = the DTE list URL). Look up the remaining 8 individually on each
       college's own "About" page or its AICTE approval record: `central-polytechnic-college`, `gpc-manjeri`,
       `maharaja-s-technological-institute-thrissur`, `n-s-s-polytechnic-college-pandalam`,
       `seethi-sahib-memorial-polytechnic-college-tirur`, `sree-narayana-polytechnic-college-kottiyam`,
       `swami-nithyananda-polytechnic-kanhangad`, `womens-polytechnic-college-ernakulam`. That is a handful of passive,
       polite, human-supervised fetches.
     - (b) Require one list-level official document (a DTE Government Order or annual report) and leave all 37
       unconfirmed until one is found.
     - (c) The human supplies the 6 aided names from their own knowledge or contacts.
   - *Recommendation: (a).* In Kerala an aided institution does not carry "Government" in its official name, so the name
     in the government's own list is the government's own statement. The 8 others each get a per-record URL.
   - Note that STATE.md Q16 previously said "not a pattern to guess at". Option (a) needs the human's explicit sign-off
     for exactly that reason.
3. **IHRD/LBS/CAPE "government cost-sharing" colleges** (future harvests only, none among the 49): are these `government`
   (owned by state-government bodies), or do they need a third value? *Recommendation:* `government`. They are run by
   state-owned societies with no private management. This can wait until such a college is harvested.
4. **`colleges.ts` re-run resets `added` dates** (a pre-existing hazard found while planning). Should the carry-forward
   in step 3 also preserve `added`, and more generally every human-edited field? *Recommendation:* yes, carry forward
   `added` in the same change. It is one extra line and the same test shape. The builder does it only if the human agrees,
   since this plan's scope is `management`.
5. **Collegiate Education arts & science (not in this plan).** The 75-college government table has no URLs, and no
   current aided list exists (the 2019 `Aided.xlsx` is 404). Registering those colleges needs each college's website
   sourced from somewhere real, which is a separate harvest plan. Confirm it is wanted before anyone starts.

## Checklist

**Phase A**

- [ ] Append ADR-028 (Proposed) to `docs/DECISIONS.md`. Add a line to STATE.md Open question 16 pointing to this plan
- [ ] `registry/schema.json`: add `management` and `management_source` (not required)
- [ ] `audit/src/types.ts`: `Management` type and the optional fields
- [ ] `audit/src/validate.ts`: `warn` helper; `management-tier`, `management-source` and `management-missing` rules; JSDoc
- [ ] Registry fixtures (4 new, `valid/` extended) and the 5 tests in `registry.test.ts` (AC 1–4)
- [ ] `scripts/migrate/2026-09-30-college-management.ts`; run it; `validate` shows 0 errors and 37 warnings
- [ ] `audit/tests/registry-colleges.test.ts` (AC 5, 6)
- [ ] `scripts/harvest/colleges.ts`: delete `DTE_AIDED_NOTE`, add `carryForwardManagement`, wire it into `run()`, add tests (AC 7)
- [ ] `site/src/lib/colleges.ts`, plus `site/tests/colleges.test.ts` (AC 8, 9, 15)
- [ ] i18n keys in `en.json` and `ml.json`, plus the translation test (AC 11)
- [ ] `CollegeManagement.astro`, included in `sites/[id].astro` and `ml/sites/[id].astro` (AC 10)
- [ ] `/colleges/` hub and `/colleges/[management]/` pages (AC 8, 9)
- [ ] Kinds-page cross-link line and home Browse link (AC 12)
- [ ] `api.ts` CSV and JSON `management`, `data.astro` sentence, api tests (AC 13)
- [ ] Methodology section, DESIGN.md §2, §3.1 and §7.2 (AC 14)
- [ ] Run all suites and the site build. Run the build-output grep checks from the test plan (AC 16)
- [ ] Run `verifier` with this plan's ACs. Record its verdict below and in the STATE.md handoff
- [ ] Commit (`feat(registry): government vs aided colleges …`), update STATE.md (Q16 → partially resolved, Phase B
      waiting on this plan's Open question 2), push at the boundary

**Phase B (after Open question 2)**

- [ ] Classify the 37 polytechnics per the chosen option, each with a `management_source`
- [ ] Phase B tests (AC 17). Re-run `validate`, confirming 0 `management-missing`
- [ ] Mark ADR-028 Accepted (with the Open question 1 answer folded in). Mark Q16 resolved

## Verification

(Filled in by `verifier` after implementation.)
