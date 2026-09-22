// Astro's `public/` directory is passed straight through to `dist/` at build time, but
// `data/screenshots/*.webp` (the orphan `data` branch, checked out as a sibling of `site/` --
// see CLAUDE.md's layout) lives outside `public/` and outside git on a fresh clone. This copies
// it into `public/screenshots/` before every build so `Screenshot.astro`'s `/screenshots/<file>`
// URLs resolve; a missing `data/` checkout (local dev, a fresh clone) is a no-op, matching
// `lib/data.ts`'s own "degrade gracefully" rule for anything under `data/`.
import { cpSync, existsSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const source = resolve(import.meta.dirname, '..', '..', 'data', 'screenshots');
const dest = resolve(import.meta.dirname, '..', 'public', 'screenshots');

rmSync(dest, { recursive: true, force: true });
if (existsSync(source)) {
  cpSync(source, dest, { recursive: true });
}
