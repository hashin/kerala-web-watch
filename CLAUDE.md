# Kerala Web Watch — agent instructions

You are implementing **Kerala Web Watch**: a static, open‑data civic site on GitHub Pages that
continuously audits every Government of Kerala website and shows citizens, in plain language,
which ones are broken and why. There is no server. GitHub Actions does all the work.

## Why this exists (do not lose this)

- A citizen in Kollam should be able to open the site on a phone and learn in 30 seconds whether
  their panchayat's website works, and if not, what exactly is wrong.
- A journalist should be able to say "X of Y Kerala government websites are broken" and cite us.
- A departmental webmaster should be able to fix the issues from our page alone.
- Findings are stated, never mocked. Departments are the audience too.

## Read order at the start of EVERY session (≈ 6k tokens, do not skip)

1. This file.
2. `docs/STATE.md` — what is done, what is in progress, the **Next action** line.
3. `docs/DECISIONS.md` — skim the titles; read any ADR the current work package cites.
4. The ONE work package you are on, from `docs/IMPLEMENTATION.md`
   (`grep -n "^### WP" docs/IMPLEMENTATION.md` then `sed -n 'A,Bp'` — do not read the whole file).
5. Only the `docs/DESIGN.md` sections that work package lists under **Read first**.

Then act. Do not re‑plan, re‑design or re‑survey what these files already settle.

## Layout

```
registry/      the curated list of sites (YAML) + schema + departments/districts/places  (humans + PRs)
audit/         TypeScript audit suite + CLI: plan | light | run | merge | validate | discover  (Node 22)
site/          Astro static site, reads ../registry and ../data at build time
scripts/       harvest + bootstrap scripts (one-off, kept for provenance)
docs/          DESIGN.md IMPLEMENTATION.md DECISIONS.md STATE.md
.github/       workflows + issue forms
data/          NOT on main. Orphan branch `data`: results/*.json summary.json outlinks.json screenshots/*.webp
```

## Commands

```
cd audit && npm test                      # vitest, fixtures under audit/tests/fixtures
cd audit && npm run build                 # tsc → audit/dist
node audit/dist/cli.js <cmd> --help       # plan | light | run | merge | validate | discover | self-test
cd site  && npm run build                 # astro build → site/dist (needs ../data checkout; empty is fine)
cd site  && npm run dev
```

## Non‑negotiables (these are product decisions, not suggestions — see docs/DECISIONS.md)

- **Passive only.** Fetch public pages like a browser. No path probing, no port scans, no form posts,
  no login attempts, no vulnerability scanners. Security findings come from headers + page contents.
- **Polite.** ≤ 1 request/second per host, 20 s timeouts, ≤ 30 pages + ≤ 20 PDFs per site per audit,
  honour robots.txt beyond the homepage, User‑Agent `KeralaWebWatch/1.0 (+https://govwebsite.hashin.me/about; civic audit; contact <email>)`.
- **Charitable.** `down` needs two consecutive failed light checks. Geo‑blocked ⇒ `unverifiable`, never `down`.
  Every status‑setting finding stores evidence. Lighthouse never sets status.
- **Never run the audit against live government sites from a dev machine at scale.** Use fixtures and the
  local fixture server. Live runs happen in Actions, or locally with `--ids` of ≤ 3 sites.
- **Never invent URLs.** A registry entry needs a `source` (where it was found) and must pass `validate --resolve`.
- **The registry is the source of truth.** One entry per organisation. `id` never changes.
- **Bilingual from day one.** Text‑pattern checks match English and Malayalam. UI strings go through i18n keys.
- **Plain language, always (ADR-026).** This site's audience is a citizen who has never heard of DNS or a TLS
  certificate. A status badge or check title is never shown alone — pair `down`/`broken`/`hijacked`/`unverifiable`
  with the specific, concrete reason (the check's existing `citizen` string, never invented fresh in `site/` —
  ADR-013 is still the one source). Before calling any citizen-facing text change done, ask: does this state a
  specific reason, or does it just restate a status word back at the reader? See DESIGN §5.4/§7.4.
- **No third‑party requests on our own pages.** Self‑hosted fonts, no analytics, no CDNs. We must pass our own audit.
- **Results live on the `data` branch, never on `main`.**

## Context budget rules

- One work package per session. If a WP is half done and the context is getting long, commit what
  works, update `docs/STATE.md`, write the handoff note, and stop. A clean stop beats a sloppy finish.
- Never `cat` a file over 200 lines. Use `wc -l`, `head -50`, `sed -n 'a,bp'`, `grep -n`.
- Never read wholesale: `registry/sites/lsg-*.yaml`, anything under `data/`, `node_modules`, lock files,
  screenshots, Lighthouse JSON. Query them with a one‑line node/grep instead of reading them.
- Pipe command output through `| head -40` / `| tail -20`. Run tests with `--reporter=dot`. Prefer
  `git diff --stat` and `git status --short` to full diffs.
- Write scripts to reason about data; do not reason about data by reading it into context.
- Do not spawn subagents for implementation. Harvests run as separate sessions, not parallel agents.
  The only routine subagent is `verifier` at the end of a WP (see Subagents below).
- After a context compaction: re‑read this file and `docs/STATE.md` before doing anything. Do not trust
  your memory of file contents; re‑read the specific lines you need.

## Subagents (`.claude/agents/`)

The main session does the work package itself — it *is* the builder, and the WPs in `docs/IMPLEMENTATION.md` are
the plans, so `architect` is not needed for WP work. Use the agents like this:

- **`verifier`** (Sonnet) — run it at the end of every WP that adds or changes tests, with the WP's Verify and
  Done-when text as the criteria. It breaks the behaviour on purpose and confirms the tests catch it. A green suite
  is not proof; this is. Note its verdict in the STATE.md handoff.
- **`explainer`** (Haiku) — run it on the changed files before marking a *phase* done. If a small model cannot say
  what a file does, fix the file or its comments.
- **`architect`** (Opus) — only for work that is not a WP (a production bug, a post-Phase-5 feature). It writes a
  plan to `.claude/plans/`; see `.claude/rules/decisions-and-plans.md`.
- **`builder`** — exists for the generic convention; in this repo the main session fills that role.

## Build & test

| Target | Directory | Install | Test | Lint | Run |
|---|---|---|---|---|---|
| audit (TypeScript, Node 22) | `audit/` | `npm ci` | `npm test` | `npm run lint` | `node dist/cli.js <cmd>` |
| site (Astro 7, Node 22) | `site/` | `npm ci` | `npm test` | `npm run lint` | `npm run dev` |
| scripts (harvest tooling, Node 22) | repo root | `npm install` | `npm test` | — | `npx tsx scripts/harvest/<name>.ts` |

The first two packages are created in Phase 0 (WP0.2, WP0.4); the root tooling in Phase 1 (WP1.1). Until each
exists, its commands do not exist and CI skips it. `scripts/` isn't in CI (its harvests are one-off, human-supervised
sessions, not something a PR check should re-run); run its `npm test` locally when touching `scripts/harvest/`.
Hosting: GitHub Pages at **https://govwebsite.hashin.me** (custom domain; `site/public/CNAME`; `SITE_BASE=/`).

## Decision protocol

- `docs/DESIGN.md` + `docs/DECISIONS.md` are settled. If a WP cannot be done as designed, do not silently
  deviate: add a **Proposed** ADR to `docs/DECISIONS.md` with the problem, options and your recommendation,
  record it under **Open questions for the human** in `docs/STATE.md`, do the parts of the WP that do not
  depend on it, and stop.
- Small implementation choices (library, file name, function shape) are yours; make them and move on.
- Anything that changes what a citizen sees, what we count as "broken", how often we hit a site, or what
  data we store needs an ADR.

## Session end protocol (always, even on a partial WP)

1. `cd audit && npm test` and, if `site/` changed, `cd site && npm run build`. Fix or note failures.
2. Commit with a conventional message (`feat(audit): …`, `feat(site): …`, `chore: …`, `data: …`, `docs: …`).
3. Update `docs/STATE.md`: WP table row (status + commit sha), **Next action**, deviations, open questions.
4. Append a 3–6 line **Handoff** entry in `docs/STATE.md` (what works, what does not, what to do first next time).
5. Push `main` (and `data` once it's in use) if the human has said pushes are fine (see STATE.md).
   Time it against the **work-package schedule**, not the clock: push at a WP boundary — a WP just
   finished cleanly, or a natural pause point within a long one — so progress reaches production
   often enough for the human to actually review it and fold in feedback before more work stacks
   on top unreviewed. Don't batch several WPs' worth of unpushed commits, and don't push mid-WP in
   a broken or half-verified state just to hit a cadence.

## Things only the human can do (ask, do not attempt)

Enable Pages (Source: GitHub Actions) and set the custom domain + Enforce HTTPS · point DNS `govwebsite.hashin.me` CNAME → `hashin.github.io` · set Actions workflow permissions to
read/write · add secrets (`SAFE_BROWSING_KEY`) · register a self‑hosted `india` runner · merge discovery PRs ·
choose the public name/domain and the contact email · decide whether `ministers.yaml` carries names.

## Conventions

TypeScript strict, ESM, Node 22, vitest, prettier defaults, 2‑space YAML. Small pure functions; every check
is `(ctx) => CheckResult` and has fixtures. English strings in `audit/src/checks/registry.ts` are the single
source for the site's issue explanations and the methodology page — never duplicate them in `site/`.
