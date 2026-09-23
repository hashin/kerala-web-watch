import type { APIRoute } from 'astro';
import { getSites, type SiteView } from '../../../lib/data';
import { siteApiRecord } from '../../../lib/api';

/** `api/sites/<id>.json` (WP4.3): one file per site, full evidence included -- this is what the
 * site page's "Download JSON" action (SiteActions.astro) links to. */
export function getStaticPaths() {
  return getSites().map((site) => ({ params: { id: site.id }, props: { site } }));
}

export const GET: APIRoute<{ site: SiteView }> = ({ props }) => {
  return new Response(JSON.stringify(siteApiRecord(props.site), null, 2), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
