import type { APIRoute } from 'astro';
import { getSites } from '../../lib/data';
import { buildTransitionFeed, siteTransitions } from '../../lib/api';

/** `feeds/broken.xml` (WP4.3): the last 100 sites that went down/broken/hijacked, newest first. */
export const GET: APIRoute = () => {
  const xml = buildTransitionFeed({
    title: 'Kerala Web Watch — sites that stopped working',
    description: 'Government websites that most recently went down, broken, hijacked or unverifiable.',
    feedPath: '/feeds/broken.xml',
    updated: new Date().toISOString(),
    transitions: siteTransitions(getSites(), false),
  });
  return new Response(xml, { headers: { 'Content-Type': 'application/atom+xml; charset=utf-8' } });
};
