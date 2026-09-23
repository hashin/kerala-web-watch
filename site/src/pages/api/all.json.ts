import type { APIRoute } from 'astro';
import { getSites } from '../../lib/data';
import { allSitesRecords } from '../../lib/api';

/** `api/all.json` (WP4.3): every site's record, evidence stripped -- see `allSitesRecords`'s own
 * comment in `lib/api.ts` for why. Not pretty-printed: this file is meant to be gzipped and
 * fetched, not read by eye (a single site's own evidence-carrying JSON is at `api/sites/<id>.json`
 * for that). */
export const GET: APIRoute = () => {
  return new Response(JSON.stringify(allSitesRecords(getSites())), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
