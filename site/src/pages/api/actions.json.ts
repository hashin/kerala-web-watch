import type { APIRoute } from 'astro';
import { getSites } from '../../lib/data';
import { actionsApi, getActionReport } from '../../lib/actions';

/** `api/actions.json` (ADR-028): the graded action report for every site. */
export const GET: APIRoute = () =>
  new Response(JSON.stringify(actionsApi(getActionReport(), getSites())), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
