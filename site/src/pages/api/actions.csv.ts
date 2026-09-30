import type { APIRoute } from 'astro';
import { getSites } from '../../lib/data';
import { actionsCsv, getActionReport } from '../../lib/actions';

/** `api/actions.csv` (ADR-028): one row per action. */
export const GET: APIRoute = () =>
  new Response(actionsCsv(getActionReport(), getSites()), { headers: { 'Content-Type': 'text/csv; charset=utf-8' } });
