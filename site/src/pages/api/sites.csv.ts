import type { APIRoute } from 'astro';
import { getSites } from '../../lib/data';
import { sitesToCsv } from '../../lib/api';

/** `api/sites.csv` (WP4.3): registry + status + score, one row per site -- for spreadsheet tools. */
export const GET: APIRoute = () => {
  return new Response(sitesToCsv(getSites()), {
    headers: { 'Content-Type': 'text/csv; charset=utf-8' },
  });
};
