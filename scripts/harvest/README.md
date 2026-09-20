# Harvest scripts

One-off tools that turn a government directory page into `registry/candidates/<source>.yaml`
entries. They never write to `registry/sites/` (ADR-018) — a human curates candidates into real
entries as a separate step (WP1.7), except LSGIs, whose source is fully structured enough to
generate straight into `registry/sites/lsg-*.yaml` (WP1.4).

Each harvest is its own session (see `CLAUDE.md`) and fetches real government pages, so:

- Read the harvest's own WP in `docs/IMPLEMENTATION.md` before writing code.
- Fetch pages politely and a handful at a time — this is a one-time, human-supervised crawl, not
  the recurring audit (§ CLAUDE.md non-negotiables still apply: identify yourself, don't hammer
  a host).
- Record in `docs/STATE.md` exactly which source URLs were fetched and how many candidates each
  produced, so a later session doesn't redo the work.

## `lib.ts`

- `emit(input)` — normalises a raw `{url, name, ...}` find into the stored `Candidate` shape.
  Keeps the URL's scheme (`http://` vs `https://` are different registry values, same as
  `registry/schema.json`); only fixes host case and a trailing `/` root path.
- `dedupeKey(url)` — a looser key for *matching only* (lower-cases the host, drops the scheme).
  Two links to the same real site that differ only by `http`/`https` or host case should collide
  during harvest even though the eventual registry entry keeps its own scheme.
- `writeCandidates(source, list)` — writes `registry/candidates/<source>.yaml`. `source` is a
  short slug for where the links came from (`kerala-gov-in`, `goidirectory`, ...).

## Writing a new harvest script

```ts
import { emit, writeCandidates } from './lib.js';

const candidates = [
  emit({
    url: 'https://example.kerala.gov.in',
    name: 'Example Directorate',
    source: 'kerala-gov-in',
    source_page: 'https://kerala.gov.in/departments',
    hints: { department: 'example' },
  }),
];

writeCandidates('kerala-gov-in', candidates);
```

Run it with `npx tsx scripts/harvest/<name>.ts` from the repo root (needs `audit/dist/` built —
`cd audit && npm run build` — since `lib.ts` reuses its URL normalisation).

## Merging

`npx tsx scripts/harvest/merge-candidates.ts` reads every `registry/candidates/*.yaml`, compares
each against the live registry and against every other candidate by `dedupeKey`, and prints how
many are already in the registry, duplicated across sources, or new. It never writes anything —
merging candidates into `registry/sites/` is WP1.7's manual curation pass.
