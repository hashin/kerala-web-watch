import type { APIRoute } from 'astro';
import { getSummary } from '../../lib/data';

/** `api/summary.json` (WP4.3, DESIGN §7.2): the same rollup `/` renders from, as a plain copy --
 * so a journalist can cite the exact headline numbers without scraping the homepage. */
export const GET: APIRoute = () => {
  return new Response(JSON.stringify(getSummary(), null, 2), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
