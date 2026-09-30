# Malayalam copy awaiting translation and review

The dashboard redesign (WP-D8) moved every tooltip and UI string into `site/src/i18n/{en,ml}.json`. Keys that already had reviewed Malayalam kept it. Every key below has **English text as its `ml` value** (the placeholder convention in `site/src/i18n/index.ts`), so `/ml/` pages show English for these until a Malayalam speaker translates and reviews them (see WP5.3). Status words, band labels and navigation reuse the Malayalam already in the site.

`site/tests/i18n.test.ts` fails if a key has identical English and Malayalam text and is not listed here (or `home.heading`, the brand name, which stays in English), so this file cannot drift.

| Key | English text (needs translation and human review) |
|---|---|
| `tip.brokenHeadline` | Sites that are down, hijacked or broken right now, out of all registered sites. |
| `tip.kpiHealthy` | Healthy: passes almost every check. The goal is to grow this. Small chart: last 8 weeks. |
| `tip.kpiNeedsWork` | Needs work: deep-audited, works, but has fixable issues. Small chart: last 8 weeks. |
| `tip.kpiPoor` | Poor: deep-audited with serious accessibility, security or upkeep problems. Small chart: last 8 weeks. |
| `tip.kpiBroken` | Down or broken: unreachable, hijacked, or failing basic checks. Lower is better. Small chart: last 8 weeks. |
| `tip.kpiUnaudited` | Not yet audited: only the light check has run. This should fall as the deep audit progresses. |
| `tip.delta` | Change since last week. ▲ rose, ▼ fell. A rising Poor or Broken count is bad; a falling Not-audited count is progress. |
| `tip.week` | The reporting week (Monday–Sunday). Every number on the page describes this period. |
| `tip.compare` | Show every change compared with the previous week. |
| `tip.healthBar` | Every registered site split by health band. Widths are shares of the total. |
| `tip.trend` | Broken sites per week. Each column is one week; the dark one is the current week. |
| `tip.coverage` | How much of the registry has had the full deep audit (Lighthouse, accessibility, links, content, GIGW 3.0). |
| `tip.broke` | Sites that were working last week but are broken now, with the cause. |
| `tip.fixed` | Sites that were broken last week and are working again. |
| `tip.median` | The middle site's health score (0–100). Less affected by outliers than an average. |
| `tip.broken_share` | Bar length: share of the group’s sites that are down, hijacked or broken. |
| `tip.score` | Overall health score, 0–100. Higher is better. Blank if the site has not been deep-audited. |
| `tip.strip` | One block per week: teal healthy, amber needs work, coral poor, grey no data. |
| `tip.ministryTile` | Bar shows the mix of the ministry’s sites by health band; the arrow is the weekly change in broken sites. |
| `tip.rankRow` | Bar: share of sites broken. Score: median health (0–100). Δ: change since last week. Click for the page. |
| `tip.leaderboard` | Groups ranked by the share of their sites that are broken; ties are broken by median score. |
| `tip.improved` | Groups whose median score rose the most over the last 30 days. |
| `tip.districtMap` | Districts of Kerala. Click one to open its page. |
| `tip.districtRanking` | All 14 districts, most broken sites first. |
| `tip.ministryGrid` | Cabinet portfolios ordered by the share of their sites that are broken. |
| `tip.siteScore` | Overall score 0–100: the weighted average of the six checks below. Blank if the site has not been deep-audited. |
| `tip.siteScoreChange` | Change in overall score compared with about a week ago. |
| `tip.sixChecks` | The six things every site is graded on. Higher is better. |
| `tip.screenshot` | What the site looked like when we last visited it. |
| `tip.uptime` | One block per day of the last 90. We check every 6 hours: blue is up, crimson is down. |
| `tip.openIssues` | Problems found in the latest audit, each with what it means for citizens and how to fix it. |
| `tip.techFacts` | Technical details of the site: server, certificate, platform. Useful for whoever maintains it. |
| `tip.siteActions` | Report a mistake in our data, ask for a fresh audit, or download this page as data. |
| `tip.actionsBlock` | What to fix first, in priority order. |
| `tip.reportArchive` | Every monthly report so far. Open one to read it. |
| `tip.reportBody` | The full report: the numbers in words, the most common problems, and the best and worst sites this month. |
| `tip.toc` | Contents of this page. Click to jump to a section. |
| `tip.filterName` | Type part of a site's name to narrow the list. |
| `tip.status.healthy` | Healthy: scored 80 or more in the latest deep audit. |
| `tip.status.needs-work` | Needs work: scored 50–79. The site works but has fixable problems. |
| `tip.status.poor` | Poor: scored below 50. Serious accessibility, security or upkeep gaps. |
| `tip.status.down` | Down: two failed checks in a row. The site did not answer. |
| `tip.status.hijacked` | Possibly hijacked: the address now shows an unrelated or parked page. Do not enter personal details. |
| `tip.status.broken` | Broken: the site answers but shows nothing a citizen can use (blank page, default server page, blocked certificate). |
| `tip.status.unverifiable` | Unverifiable: we cannot reach it from our monitoring location. It may work fine for you. |
| `tip.status.unaudited` | Not yet audited: only the 6-hourly up/down check has run. The deep audit has not reached it yet. |
| `tip.category.security` | Security: valid HTTPS certificate, security headers, no known-vulnerable code. Higher is better. |
| `tip.category.accessibility` | Accessibility: can people with disabilities use the site (automated axe checks)? |
| `tip.category.content` | Content and maintenance: is the content recent and are links working? |
| `tip.category.gigw` | GIGW 3.0: compliance with the Government of India website guidelines. |
| `tip.category.performance` | Performance: page speed and weight on a phone (Lighthouse). |
| `tip.category.identity` | Identity and hygiene: is it clearly an official site, on a government domain? |
| `tip.category.availability` | Availability: does the site answer when a citizen visits? |
| `tip.check.up` | Up: did the site respond to every 6-hourly check? |
| `tip.check.secure` | Secure: valid HTTPS certificate and security headers. |
| `tip.check.accessible` | Accessible: can people with disabilities use it (axe checks)? |
| `tip.check.fast` | Fast: page speed and weight (Lighthouse). |
| `tip.check.maintained` | Maintained: is content recent and are links working? |
| `tip.check.gigw` | GIGW 3.0: compliance with the Government of India website guidelines. |
| `tip.groupTracked` | Number of registered sites in this group. |
| `tip.groupBroken` | Sites in this group that are down, hijacked or broken right now. |
| `tip.groupDeepAudited` | Sites in this group that have had the full audit. |
| `tip.urgent` | Sites with a finding graded urgent or high. Each one has a step-by-step fix on the Actions page. |
| `tip.band.broken` | Down, hijacked or broken: unreachable, or failing basic checks. Lower is better. |
| `tip.bandShare` | {tip} — {n} sites ({pct}%). |
| `nav.snapshot` | Snapshot |
| `nav.districts` | Districts |
| `nav.ministries` | Ministries |
| `nav.leaderboard` | Leaderboard |
| `nav.reports` | Reports |
| `nav.methodology` | Methodology |
| `ui.vsLastWeek` | vs last week |
| `ui.category` | Category |
| `ui.week` | Week {n} · {from} – {to} |
| `ui.now` | now |
| `ui.nowCap` | Now |
| `ui.district` | District |
| `ui.rankPosition` | Rank position. 1 is best. |
| `ui.sites` | Sites |
| `ui.sitesInGroup` | Number of sites in the group. |
| `ui.pctBroken` | % broken |
| `ui.median` | Median |
| `ui.deltaWeek` | Δ wk |
| `ui.rankingSuffix` | {label} ranking |
| `home.snapshotTitle` | This week's snapshot |
| `home.lede` | {broken} of {total} Kerala government websites are broken right now. |
| `home.deltaMore` | {n} more than last week |
| `home.deltaFewer` | {n} fewer than last week |
| `home.summaryLine` | {broke} broke this week · {fixed} fixed · {audited} deep-audited so far. |
| `home.unauditedBefore` | Sites not yet reached by the deep audit show as |
| `home.howWeCheck` | How we check |
| `home.urgentLabel` | Urgent action |
| `home.urgentNote` | sites to fix first |
| `home.unverifiableNote` | includes {n} we cannot reach from our location |
| `home.healthTitle` | Health of all {total} sites |
| `home.trendAria` | Broken sites per week: {list} |
| `home.trendBarTip` | {when}: {n} sites broken |
| `home.noHistory` | Week-by-week history starts after the first weekly snapshot (Sunday night). |
| `home.coverageTitle` | Audit coverage |
| `home.deepAuditedAria` | {pct}% deep-audited |
| `home.coverageOf` | {n} of {total} deep-audited |
| `home.fullCoverageBy` | full coverage by {eta} |
| `home.brokeTitle` | Broke this week · {n} |
| `home.since` | Since {date}. |
| `home.noneBroke` | No site has newly broken this week. |
| `home.seeAllBroken` | See all broken sites → |
| `home.fixedTitle` | Fixed this week · {n} |
| `home.backUpSince` | back up since {date} |
| `home.noneFixed` | No site has come back up this week. |
| `home.districtsTitle` | Districts with the most broken sites |
| `home.allDistricts` | All districts → |
| `home.browseTitle` | Browse |
| `home.browseMinistry` | By ministry |
| `home.browseDistrict` | By district |
| `home.browseLeaderboard` | Leaderboard |
| `home.browseColleges` | Colleges |
| `home.browsePanchayats` | All grama panchayats |
| `home.browseUniversities` | All universities |
| `home.browsePlatform` | The lsgkerala platform |
| `home.browseDown` | Down sites |
| `ui.skipToMain` | Skip to main content |
| `nav.primaryLabel` | Primary |
