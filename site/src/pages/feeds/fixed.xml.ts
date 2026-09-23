import type { APIRoute } from 'astro';
import { getSites } from '../../lib/data';
import { buildTransitionFeed, siteTransitions } from '../../lib/api';

/** `feeds/fixed.xml` (WP4.3): the last 100 sites that most recently came back up, newest first. */
export const GET: APIRoute = () => {
  const xml = buildTransitionFeed({
    title: 'Kerala Web Watch — sites that started working again',
    description: 'Government websites that most recently came back up after being down, broken or hijacked.',
    feedPath: '/feeds/fixed.xml',
    updated: new Date().toISOString(),
    transitions: siteTransitions(getSites(), true),
  });
  return new Response(xml, { headers: { 'Content-Type': 'application/atom+xml; charset=utf-8' } });
};
