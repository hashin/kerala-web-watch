import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// SITE_BASE/SITE_URL are set by build-deploy.yml; the fallbacks match local dev against the
// custom domain (site/public/CNAME) so `npm run build` without env vars still produces correct URLs.
export default defineConfig({
  output: 'static',
  site: process.env.SITE_URL ?? 'https://govwebsite.hashin.me',
  base: process.env.SITE_BASE ?? '/',
  integrations: [sitemap()],
});
