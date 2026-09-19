# Kerala Web Watch · വെബ് കാവൽ

**https://govwebsite.hashin.me** — a public, open-data audit of every Government of Kerala website.

Which government websites in Kerala are broken, insecure, inaccessible or abandoned — and what exactly is wrong with
each one, explained for citizens and for the webmasters who can fix it. Browse by ministry → department, or by
district → town on a map. Every site has its own page. Everything runs on GitHub Actions and is served as a static
site; there is no server and no cost.

- Light check of every site every 6 hours; rolling deep audit (Lighthouse, axe, link crawl, content and GIGW 3.0
  checks, screenshots) that covers the whole registry and then keeps every site fresh weekly.
- Passive and polite by design: we only do what a browser does when a citizen visits. See `docs/DESIGN.md` §5.1.

## Status

Pre-alpha: design complete, implementation starting. Progress: `docs/STATE.md`.

## Documents

| File | What |
|---|---|
| `CLAUDE.md` | Rules for agent sessions working here (read first) |
| `docs/DESIGN.md` | Full design: scope, registry model, check catalogue, scoring, automation, site |
| `docs/IMPLEMENTATION.md` | 34 work packages with verify steps |
| `docs/DECISIONS.md` | Architecture decision log |
| `docs/STATE.md` | Where things stand; next action |

## Contributing

Add a missing website, correct a wrong department/district, or contest a finding — see `CONTRIBUTING.md`.
Registry entries need a `source` and must resolve; see `docs/DESIGN.md` §3.

## Licence

Code: MIT (`LICENSE`). Data (`registry/`, the `data` branch, Release archives): CC-BY-4.0 (`LICENSE-DATA`).
