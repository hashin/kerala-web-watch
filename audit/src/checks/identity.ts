import type { Check, CheckResult } from './types.js';

const GOV_SUFFIXES = ['gov.in', 'nic.in', 'ac.in', 'edu.in', 'res.in'];

function isGovDomain(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  return GOV_SUFFIXES.some((suffix) => lower === suffix || lower.endsWith(`.${suffix}`));
}

const TECH_SIGNATURES: { name: string; pattern: RegExp; oldMajor: (version: string) => boolean }[] = [
  { name: 'WordPress', pattern: /<meta[^>]+name=["']generator["'][^>]+content=["']WordPress ([\d.]+)/i, oldMajor: (v) => Number(v.split('.')[0]) < 6 },
  { name: 'Drupal', pattern: /<meta[^>]+name=["']generator["'][^>]+content=["']Drupal ([\d.]+)/i, oldMajor: (v) => Number(v.split('.')[0]) < 9 },
  { name: 'Joomla', pattern: /<meta[^>]+name=["']generator["'][^>]+content=["']Joomla! - ([\d.]+)/i, oldMajor: (v) => Number(v.split('.')[0]) < 4 },
];

const THIRD_PARTY_HOSTS = [
  'google-analytics.com',
  'googletagmanager.com',
  'doubleclick.net',
  'facebook.net',
  'connect.facebook.net',
  'hotjar.com',
  'cloudflareinsights.com',
];

function blocksEverything(robotsTxt: string): boolean {
  let inWildcardBlock = false;
  let disallowsRoot = false;
  for (const rawLine of robotsTxt.split(/\r?\n/)) {
    const line = rawLine.trim().toLowerCase();
    if (line.startsWith('user-agent:')) {
      inWildcardBlock = line.slice('user-agent:'.length).trim() === '*';
    } else if (inWildcardBlock && line.startsWith('allow:') && line.slice('allow:'.length).trim().length > 0) {
      return false; // an explicit allow under the wildcard block means it isn't blocking everything
    } else if (inWildcardBlock && line.startsWith('disallow:') && line.slice('disallow:'.length).trim() === '/') {
      disallowsRoot = true;
    }
  }
  return disallowsRoot;
}

export const IDENTITY_CHECKS: Check[] = [
  {
    id: 'id.gov_domain',
    run: (ctx): CheckResult => {
      const hostname = new URL(ctx.site.url).hostname;
      return isGovDomain(hostname) ? { id: 'id.gov_domain', r: 'pass' } : { id: 'id.gov_domain', r: 'fail', ev: hostname };
    },
  },
  {
    id: 'id.domain_expiry',
    appliesTo: (site) => !isGovDomain(new URL(site.url).hostname),
    run: (ctx): CheckResult => {
      const days = ctx.domainExpiryDays;
      if (days === undefined || days === null) return { id: 'id.domain_expiry', r: 'na' };
      return days < 60 ? { id: 'id.domain_expiry', r: 'fail', ev: `${days} days left` } : { id: 'id.domain_expiry', r: 'pass' };
    },
  },
  {
    id: 'id.www_consistency',
    run: (ctx): CheckResult => {
      if (ctx.wwwConsistent === undefined) return { id: 'id.www_consistency', r: 'na' };
      return ctx.wwwConsistent ? { id: 'id.www_consistency', r: 'pass' } : { id: 'id.www_consistency', r: 'fail' };
    },
  },
  {
    id: 'id.robots',
    run: (ctx): CheckResult => {
      const robots = ctx.robotsTxt;
      if (robots === undefined) return { id: 'id.robots', r: 'na' };
      if (robots.status < 200 || robots.status >= 300) return { id: 'id.robots', r: 'fail', ev: `robots.txt returned ${robots.status}` };
      return blocksEverything(robots.body) ? { id: 'id.robots', r: 'fail', ev: 'Disallow: / for User-agent: *' } : { id: 'id.robots', r: 'pass' };
    },
  },
  {
    id: 'id.sitemap_xml',
    run: (ctx): CheckResult => {
      const status = ctx.sitemapXmlStatus;
      if (status === undefined) return { id: 'id.sitemap_xml', r: 'na' };
      return status >= 200 && status < 300 ? { id: 'id.sitemap_xml', r: 'pass' } : { id: 'id.sitemap_xml', r: 'fail', ev: `sitemap.xml returned ${status}` };
    },
  },
  {
    id: 'id.soft_404',
    run: (ctx): CheckResult => {
      const status = ctx.soft404Status;
      if (status === undefined) return { id: 'id.soft_404', r: 'na' };
      return status >= 200 && status < 300
        ? { id: 'id.soft_404', r: 'fail', ev: `a nonexistent path returned ${status}` }
        : { id: 'id.soft_404', r: 'pass' };
    },
  },
  {
    id: 'id.canonical',
    run: (ctx): CheckResult => {
      if (ctx.html === undefined) return { id: 'id.canonical', r: 'na' };
      return /<link[^>]+rel=["']canonical["']/i.test(ctx.html) ? { id: 'id.canonical', r: 'pass' } : { id: 'id.canonical', r: 'fail' };
    },
  },
  {
    id: 'id.charset_doctype',
    run: (ctx): CheckResult => {
      if (ctx.html === undefined) return { id: 'id.charset_doctype', r: 'na' };
      const hasUtf8 = /<meta[^>]+charset=["']?utf-8["']?/i.test(ctx.html) || /charset=utf-8/i.test(ctx.headers?.['content-type'] ?? '');
      const hasHtml5Doctype = /^\s*<!doctype html>/i.test(ctx.html);
      if (hasUtf8 && hasHtml5Doctype) return { id: 'id.charset_doctype', r: 'pass' };
      const missing = [!hasUtf8 && 'UTF-8 charset', !hasHtml5Doctype && 'HTML5 doctype'].filter((v): v is string => v !== false).join(', ');
      return { id: 'id.charset_doctype', r: 'fail', ev: `missing ${missing}` };
    },
  },
  {
    id: 'id.tech',
    run: (ctx): CheckResult => {
      if (ctx.html === undefined) return { id: 'id.tech', r: 'na' };
      for (const sig of TECH_SIGNATURES) {
        const match = ctx.html.match(sig.pattern);
        if (!match) continue;
        return sig.oldMajor(match[1])
          ? { id: 'id.tech', r: 'warn', ev: `${sig.name} ${match[1]} (unsupported major version)` }
          : { id: 'id.tech', r: 'pass', ev: `${sig.name} ${match[1]}` };
      }
      return { id: 'id.tech', r: 'pass' };
    },
  },
  {
    id: 'id.third_party',
    run: (ctx): CheckResult => {
      if (ctx.scriptUrls === undefined) return { id: 'id.third_party', r: 'na' };
      const found = ctx.scriptUrls.filter((url) => THIRD_PARTY_HOSTS.some((host) => url.includes(host)));
      return found.length > 0 ? { id: 'id.third_party', r: 'warn', ev: found.join(', ') } : { id: 'id.third_party', r: 'pass' };
    },
  },
];
