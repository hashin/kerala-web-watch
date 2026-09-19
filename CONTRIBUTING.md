# Contributing

## Add or correct a website
Open an issue with the *Add a website* form, or send a PR editing `registry/sites/<tier>.yaml`. Every entry needs
`id`, `name`, `url`, `tier`, `kind`, `department`, `district`, `place`, `priority`, `source` (where you found it) and
`added`. CI validates the schema and resolves the URL. One entry per organisation; mirror URLs go in `aliases`.

## Contest a finding
Open a *Correction* issue naming the site id and the check id shown on its page. Evidence for every finding is on the
page; if we are wrong we fix the check, not just the result. A *Re-audit request* re-runs the site within the day.

## Code
`audit/` (TypeScript, vitest, fixtures) and `site/` (Astro). Read `CLAUDE.md` and `docs/IMPLEMENTATION.md`.
Checks are pure functions with fixture tests; nothing in tests touches live government sites.

## Conduct
See `CODE_OF_CONDUCT.md`. Findings are stated, never mocked — departments are part of the audience.
