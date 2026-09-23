import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// SITE_BASE/SITE_URL are set by build-deploy.yml; the fallbacks match local dev against the
// custom domain (site/public/CNAME) so `npm run build` without env vars still produces correct URLs.
export default defineConfig({
  output: 'static',
  site: process.env.SITE_URL ?? 'https://govwebsite.hashin.me',
  base: process.env.SITE_BASE ?? '/',
  integrations: [sitemap()],
  // WP4.5: routing only -- `/` stays English (defaultLocale, unprefixed), `/ml/<page>` is
  // Malayalam. Only a handful of pages have a `/ml/` counterpart so far (WP5.3 covers the rest);
  // Astro's i18n routing doesn't require every page to exist in every locale.
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'ml'],
  },
});
