// Every hover explanation on the dashboard, in one place. Components take a key (or literal text)
// and render it as data-tip="…"; the Layout script shows it. Keep copy plain-language: written for
// a citizen first, a webmaster second (ADR-013 tone).
import type { Status } from './data';

export const STATUS_TIP: Record<Status, string> = {
  healthy: 'Healthy: scored 80 or more in the latest deep audit.',
  'needs-work': 'Needs work: scored 50–79. The site works but has fixable problems.',
  poor: 'Poor: scored below 50. Serious accessibility, security or upkeep gaps.',
  down: 'Down: two failed checks in a row. The site did not answer.',
  hijacked: 'Possibly hijacked: the address now shows an unrelated or parked page. Do not enter personal details.',
  broken: 'Broken: the site answers but shows nothing a citizen can use (blank page, default server page, blocked certificate).',
  unverifiable: 'Unverifiable: we cannot reach it from our monitoring location. It may work fine for you.',
  unaudited: 'Not yet audited: only the 6-hourly up/down check has run. The deep audit has not reached it yet.',
};

export const TIP = {
  brokenHeadline: 'Sites that are down, hijacked or broken right now, out of all registered sites.',
  kpiHealthy: 'Healthy: passes almost every check. The goal is to grow this. Small chart: last 8 weeks.',
  kpiNeedsWork: 'Needs work: deep-audited, works, but has fixable issues. Small chart: last 8 weeks.',
  kpiPoor: 'Poor: deep-audited with serious accessibility, security or upkeep problems. Small chart: last 8 weeks.',
  kpiBroken: 'Down or broken: unreachable, hijacked, or failing basic checks. Lower is better. Small chart: last 8 weeks.',
  kpiUnaudited: 'Not yet audited: only the light check has run. This should fall as the deep audit progresses.',
  delta: 'Change since last week. ▲ rose, ▼ fell. A rising Poor or Broken count is bad; a falling Not-audited count is progress.',
  week: 'The reporting week (Monday–Sunday). Every number on the page describes this period.',
  compare: 'Show every change compared with the previous week.',
  healthBar: 'Every registered site split by health band. Widths are shares of the total.',
  trend: 'Broken sites per week. Each column is one week; the dark one is the current week.',
  coverage: 'How much of the registry has had the full deep audit (Lighthouse, accessibility, links, content, GIGW 3.0).',
  broke: 'Sites that were working last week but are broken now, with the cause.',
  fixed: 'Sites that were broken last week and are working again.',
  median: "The middle site's health score (0–100). Less affected by outliers than an average.",
  broken_share: 'Bar length: share of the group’s sites that are down, hijacked or broken.',
  score: 'Overall health score, 0–100. Higher is better. Blank if the site has not been deep-audited.',
  strip: 'One block per week: teal healthy, amber needs work, coral poor, grey no data.',
  ministryTile: 'Bar shows the mix of the ministry’s sites by health band; the arrow is the weekly change in broken sites.',
  rankRow: 'Bar: share of sites broken. Score: median health (0–100). Δ: change since last week. Click for the page.',
  leaderboard: 'Groups ranked by the share of their sites that are broken; ties are broken by median score.',
  improved: 'Groups whose median score rose the most over the last 30 days.',
  districtMap: 'Districts of Kerala. Click one to open its page.',
  districtRanking: 'All 14 districts, most broken sites first.',
  ministryGrid: 'Cabinet portfolios ordered by the share of their sites that are broken.',
  siteScore: 'Overall score 0–100: the weighted average of the six checks below. Blank if the site has not been deep-audited.',
  siteScoreChange: 'Change in overall score compared with about a week ago.',
  sixChecks: 'The six things every site is graded on. Higher is better.',
  screenshot: 'What the site looked like when we last visited it.',
  uptime: 'One block per day of the last 90. We check every 6 hours: teal is up, crimson is down.',
  openIssues: 'Problems found in the latest audit, each with what it means for citizens and how to fix it.',
  techFacts: 'Technical details of the site: server, certificate, platform. Useful for whoever maintains it.',
  siteActions: 'Report a mistake in our data, ask for a fresh audit, or download this page as data.',
  actionsBlock: 'What to fix first, in priority order.',
  toc: 'Contents of this page. Click to jump to a section.',
  filterName: "Type part of a site's name to narrow the list.",
} as const;

export const CHECK_TIP: Record<string, string> = {
  up: 'Up: did the site respond to every 6-hourly check?',
  secure: 'Secure: valid HTTPS certificate and security headers.',
  accessible: 'Accessible: can people with disabilities use it (axe checks)?',
  fast: 'Fast: page speed and weight (Lighthouse).',
  maintained: 'Maintained: is content recent and are links working?',
  gigw: 'GIGW 3.0: compliance with the Government of India website guidelines.',
};
