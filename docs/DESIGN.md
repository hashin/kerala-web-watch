# Kerala Web Watch — Design & Build Plan

**Name:** Kerala Web Watch (വെബ് കാവൽ) · **URL:** https://govwebsite.hashin.me · **Repo:** github.com/hashin/kerala-web-watch
**Companion documents:** `CLAUDE.md` (session rules, always loaded) · `docs/IMPLEMENTATION.md` (work packages for the implementing agent) · `docs/DECISIONS.md` (ADR log) · `docs/STATE.md` (progress ledger).
**Status:** design v1, 19 Sep 2026. Nothing built yet.

---

## 0. Summary

A public, open‑data, zero‑cost civic website hosted on GitHub Pages that continuously audits every Government of Kerala website — state departments, directorates, missions, PSUs, boards, commissions, universities, the 14 district administrations and all 1,200 local self‑government institutions — and tells a citizen, in plain English and Malayalam, which ones are broken and why.

Every site gets a grade on six things: **is it up, is it secure, can everyone use it, is it fast, is it maintained, does it meet the Government of India's own website guidelines (GIGW 3.0)**. Every site gets its own page with a screenshot, a list of concrete problems, what each problem means for a citizen, and how the department can fix it.

Citizens browse two ways: **by ministry → department → organisation**, or **by district → city/town** on a map of Kerala.

Everything runs on GitHub Actions with no server:

- a **light check** of *every* site every 6 hours (up/down, HTTPS, certificate, redirects);
- a **rolling deep audit** (Lighthouse, axe accessibility, link crawl, content and compliance checks, screenshots) that works through the whole registry in priority order, then keeps every site fresh on a 7‑day cycle, forever;
- a **discovery job** that finds government sites we missed and proposes them as pull requests.

Cost: ₹0. Public repos get free Actions minutes and free Pages hosting.

---

## 1. Goals and non‑goals

**Goals**

1. A complete, versioned, machine‑readable registry of Kerala government websites (the list itself is a public good — nothing like it exists in one place).
2. An honest, reproducible, automated audit of each one, re‑run continuously.
3. A site a non‑technical citizen or a journalist can use in 30 seconds: "is my panchayat's website broken?", "which ministry has the worst websites?".
4. Enough detail on each site's page that a departmental webmaster can fix the issues from it.
5. Everything open: MIT code, CC‑BY‑4.0 data, static JSON endpoints for reuse.

**Non‑goals**

- No penetration testing, vulnerability scanning, path probing, form submission or login attempts. We only do what a browser does when a citizen visits the homepage and follows a few links. (See §5.1.)
- No central government sites located in Kerala (Cochin Port, NIT Calicut, IIM‑K, Railways…). They can be tagged `central` later and hidden by default.
- No uptime‑SLA claims. We report what we observed from where we observed it.
- No collection of any citizen data. The site has no accounts, no analytics by default, no third‑party scripts.

---

## 2. Scope: what counts as a "Kerala government website"

| Tier | What | Est. count |
|---|---|---|
| T1 State core | kerala.gov.in, CMO, Raj Bhavan, Niyamasabha, e‑District, Secretariat departments (45) | ~60 |
| T1 Directorates & field departments | Health Services, Medical Education, General Education, Collegiate Education, Technical Education, Agriculture, Animal Husbandry, Fisheries, Forest, PWD, Irrigation, Revenue, Registration, Motor Vehicles, Taxes, Treasuries, Civil Supplies, Excise, Labour, Police, Fire & Rescue, Prisons, Vigilance, Tourism, Industries, Panchayat, Urban Affairs, Social Justice, Women & Child, SC/ST, Minority, Sports, Culture, Archives, Museums, Archaeology, Survey, Mining & Geology, Ground Water, Ports, Hydrography, Employment, Printing, Stationery, Lotteries… | ~120 |
| T1 Missions, societies, agencies | IT Mission, Kudumbashree, Haritha Keralam, LIFE, Ardram, KSUM, K‑DISC, KFON, C‑DIT, Akshaya, KIIFB, KSDMA, KSCSTE, KSITM, KELSA, State Planning Board, Kerala Knowledge Economy Mission, Arogya Keralam (NHM), Samagra Shiksha, KITE, SCERT, Pareeksha Bhavan, Literacy Mission… | ~60 |
| T2 Statutory bodies | KPSC, State Election Commission, State Information Commission, Lokayukta, Human Rights Commission, Women's Commission, SC/ST Commission, Youth Commission, Minorities Commission, Child Rights Commission, Pollution Control Board, Biodiversity Board, Housing Board, Wakf Board, Coastal Zone Management Authority, Devaswom Boards (Travancore, Cochin, Malabar, Guruvayur), Bar Council… | ~50 |
| T2 Universities | Kerala, Calicut, MG, Kannur, CUSAT, APJ AKTU, KUHS, KAU, KVASU, KUFOS, SSUS, Malayalam University, Digital University, NUALS, Sreenarayanaguru Open University | 15 |
| T2 Government colleges (optional, phase 5) | Arts & science, engineering, polytechnics, medical, nursing, law, teacher training | ~200 |
| T3 State PSUs | KSEB, KWA, KSRTC, KSFE, KSIDC, KINFRA, KELTRON, KMML, Malabar Cements, Travancore Titanium, KTDC, Supplyco, Kerala Feeds, KSFDC, Kerala Books & Publications, KSCDC, KSBC (Beverages), Kerala Minerals, KSHB, KSWDC, KSBCDC, Kerala Bank (co‑op)… (~130 listed by Bureau of Public Enterprises) | ~130 |
| T4 District administration | 14 collectorate sites, plus district‑level office sites where separate (police districts, DMOs, RTOs) | ~40 |
| T5 LSGIs | 6 corporations, 87 municipalities, 14 district panchayats, 152 block panchayats, 941 grama panchayats | 1,200 |
| Total | | **~1,700 – 1,900** |

A decision for Phase 1: most grama‑panchayat "sites" are templated sub‑sites on lsgkerala.gov.in. We audit them as first‑class entries anyway (that is what a citizen searches for), but tag them `platform: lsgkerala` so platform‑wide problems are reported once at the platform level and not 941 times.

---

## 3. The registry (the list)

The registry is the human‑curated heart of the project. It lives in the repo, is validated on every PR, and is what every audit and every page is generated from.

### 3.1 Data model

`registry/sites/*.yaml` — one file per tier, each a list of:

```yaml
- id: keralapsc                      # stable slug, never changes
  name: Kerala Public Service Commission
  name_ml: കേരള പബ്ലിക് സർവീസ് കമ്മീഷൻ
  url: https://www.keralapsc.gov.in
  aliases: [http://keralapsc.gov.in]  # other URLs that should redirect here
  tier: statutory                    # state | directorate | agency | statutory | university | college | psu | district | lsg
  kind: commission                   # free-ish vocabulary, validated against registry/kinds.yaml
  department: pard                   # id from registry/departments.yaml (the Secretariat dept it answers to)
  org_parent: null                   # id of parent site, e.g. a directorate under a department
  scope: state                       # state | district | local
  district: thiruvananthapuram       # id from registry/districts.yaml (HQ district; null for state portals is allowed but discouraged)
  place: thiruvananthapuram          # id from registry/places.yaml (city/town), used by the map
  lsg_type: null                     # corporation | municipality | district_panchayat | block_panchayat | grama_panchayat
  platform: null                     # lsgkerala | s3waas | nic-cms | null — templated hosting platforms
  priority: 3                        # 3 = state core, 2 = district/ULB/statutory, 1 = GP/college; drives first-sweep order
  tags: [citizen-services, recruitment]
  source: https://kerala.gov.in/...  # where we found it (provenance)
  added: 2026-09-19
  lifecycle: active                  # active | retired | merged-into:<id>
  notes: ""
```

Supporting files:

- `registry/departments.yaml` — the 45 Secretariat departments (Appendix C) with `id`, `name`, `name_ml`, `website` id.
- `registry/ministers.yaml` — **portfolio → departments**. Kept separate because it changes with every cabinet; the site→department link is stable.
  ```yaml
  - id: cm
    name: Chief Minister
    holder: ""            # name; leave blank or fill — data, not editorial
    departments: [gad, home, vigilance, eit, ...]
  ```
- `registry/districts.yaml` — 14 districts: id, name, name_ml, HQ place, SVG path id for the map.
- `registry/places.yaml` — cities/towns: id, name, name_ml, district, lat/lon.
- `registry/kinds.yaml` — controlled vocabulary for `kind`.
- `registry/schema.json` — JSON Schema for all of the above, enforced in CI.

### 3.2 Where the list comes from (Phase 1 harvest)

| Source | Yields | Method |
|---|---|---|
| kerala.gov.in — Departments / "Government websites" directory | State depts, directorates, many agencies | scrape once, curate |
| goidirectory.gov.in — state‑wise directory of government websites (NIC) | Broad list incl. PSUs/boards | scrape once, curate |
| lsgkerala.gov.in — LSGI directory (all 1,200 local bodies with links) | Every corporation/municipality/panchayat site | scrape; also gives district + lsg_type for free |
| District portals (`<district>.nic.in`, S3WaaS) — "Departments" and "Public Utilities" pages | District‑level offices | scrape 14 pages |
| Bureau of Public Enterprises (Kerala) annual review — list of PSUs | ~130 PSUs with URLs where they exist | manual/PDF extract |
| Higher Education dept + university sites — affiliated govt colleges | Colleges (phase 5) | scrape |
| Snowball crawl (§6.6) | Anything linked from a known site to a `*.kerala.gov.in`, `*.gov.in`, `*.nic.in`, `*.ac.in` or "Kerala"‑named host we don't have | automated, weekly, proposed as PRs |
| Citizens — "Add a website" issue form | Long tail | GitHub issue form → PR |

Every harvested URL goes through the **registry validation** (§6 `validate.yml`) before merge: it must resolve, the page title/text must look governmental, and it must not duplicate an existing entry (after URL normalisation). Nothing enters the registry unverified.

### 3.3 Registry rules

- `id` is permanent. Renames are `lifecycle: merged-into`.
- One entry per **organisation**, not per URL. Mirror URLs go in `aliases` and are checked to redirect to `url`.
- URL is the one the organisation itself advertises (with or without `www` — we record which and check that the other redirects).
- A site on a non‑government TLD (`keralatourism.org`, `kseb.in`, `niyamasabha.org`, `ksfe.com`) stays in the registry with its real URL. The audit flags it (§5.3 `id.gov_domain`) — that's a finding, not an exclusion.

---

## 4. Taxonomy for browsing

Two independent trees, both derived from registry fields:

**Administrative tree** (for "go through ministries"):
`Minister (portfolio)` → `Secretariat department` → `Organisation (directorate / agency / PSU / board)` → `Website`.
Kerala's cabinet is ~21 ministers; departments are 45; organisations are ~500. `ministers.yaml` is the only volatile link.

**Geographic tree** (for the map):
`District (14)` → `Place (city/town)` → `Websites located/headquartered there`, grouped as *District administration · Local bodies (corporation / municipalities / block panchayats / grama panchayats) · Institutions (universities, colleges, hospitals, PSUs)*.
State‑level sites default to `place: thiruvananthapuram` but appear on the district page under a separate "State institutions headquartered here" heading so Thiruvananthapuram's own local‑body list isn't swamped.

Cross‑cuts: **kind** (all commissions, all universities…), **status** (all down, all insecure…), **platform** (everything on lsgkerala.gov.in).

---

## 5. The audit suite

### 5.1 Principles

1. **Passive only.** Fetch the homepage and up to 30 same‑site links, exactly like a browser would. No path guessing (`/wp-admin`, `/.git`), no port scans, no form posts, no auth. Security findings come from response headers and page contents alone.
2. **Polite.** One request per second per host, 20 s timeouts, ≤ 30 pages + ≤ 20 PDFs per site per audit, respects `robots.txt` for anything beyond the homepage, identifies itself: `KeralaWebWatch/1.0 (+https://<site>/about; civic website audit; contact <email>)`.
3. **Reproducible.** Every check is a pure function of (fetched bytes, headers, rendered DOM) → `pass | warn | fail | n/a` with evidence. Same input, same result. Every check has unit tests against HTML fixtures.
4. **Explainable.** Every check id has a bilingual title, a "why this matters to you" paragraph, a "how to fix" paragraph, a severity and a reference (GIGW 3.0 clause, WCAG success criterion, or OWASP header guidance). The site never shows a raw check id.
5. **Charitable.** Two consecutive failed light checks before we call a site *down*. Three attempts with back‑off inside each check. Geo‑blocking is reported as *unverifiable*, not *down* (§6.7).

### 5.2 Two tiers of checks

| | Light check | Deep audit |
|---|---|---|
| Runs | every 6 h, **all** sites | daily, rolling batch (~250–300 sites) |
| Cost | ~1–2 s/site, one job, ~10 min total | ~60–90 s/site, 6 parallel shards, ~45–70 min |
| Tools | Node `undici` + `tls` + `dns` | Playwright (Chromium), axe‑core, Lighthouse, link crawler, RDAP |
| Produces | up/down, status code, redirect chain, TTFB, TLS cert & expiry, security headers, homepage content hash, title | everything in §5.3, screenshots, score, issue list |

The light check's **content hash** matters: if a homepage changes materially (hash, title, status code, certificate or final URL changes), the site is bumped to the front of the next deep‑audit batch. The system reacts to change instead of waiting for its turn.

### 5.3 Check catalogue

Severity: **C** critical · **H** high · **M** medium · **L** low · **I** info. "Status‑setting" checks (★) can override the score and set the site's status directly.

**Availability** (`avail.*`) — *is it there at all?*

| id | Check | Sev |
|---|---|---|
| avail.dns ★ | Hostname resolves | C |
| avail.connect ★ | TCP/TLS connection succeeds within 20 s | C |
| avail.status ★ | Final response is 2xx (3xx chain ≤ 5 hops) | C |
| avail.redirect_offsite ★ | Final host is a different registrable domain that is not a known alias / gov domain | C |
| avail.parked ★ | Page matches domain‑parking / "for sale" / registrar templates | C |
| avail.default_page ★ | Default Apache/nginx/IIS/Plesk/cPanel page, or bare directory listing | C |
| avail.blank ★ | Rendered visible text < 80 characters | C |
| avail.under_construction ★ | "Under construction / coming soon / maintenance" and nothing else | H |
| avail.ttfb | Time to first byte > 3 s (warn) / > 8 s (fail) | M |
| avail.geo_blocked ★ | 403/timeout signature consistent with NIC geo‑fencing (§6.7) | I → status *unverifiable* |
| avail.flapping | Down in ≥ 3 of the last 28 light checks (7 days) | H |

**Security** (`sec.*`) — *can a citizen trust the connection?*

| id | Check | Sev |
|---|---|---|
| sec.https ★ | Served over HTTPS at all | C |
| sec.http_redirect | http:// redirects to https:// | H |
| sec.cert_valid ★ | Certificate chain validates, hostname matches, not expired (browsers block the page otherwise) | C |
| sec.cert_expiry | Expires within 30 days (warn) / 7 days (fail) | M/H |
| sec.tls_version | Negotiates TLS ≥ 1.2 | H |
| sec.hsts | `Strict-Transport-Security` present | M |
| sec.mixed_content | HTTPS page loads http:// scripts/styles/images | H |
| sec.csp | `Content-Security-Policy` present (info‑level; rare on gov sites) | L |
| sec.xfo | `X-Frame-Options` / `frame-ancestors` (clickjacking) | M |
| sec.xcto | `X-Content-Type-Options: nosniff` | L |
| sec.referrer | `Referrer-Policy` present | L |
| sec.server_banner | `Server`/`X-Powered-By` disclose exact versions | L |
| sec.vuln_js | Loaded JS libraries with known CVEs (retire.js on the script URLs the page itself loads) | H |
| sec.safe_browsing | Google Safe Browsing lists the URL (optional API key) | C ★ |

**Accessibility** (`a11y.*`) — *can everyone use it?* (WCAG 2.1 AA, which GIGW 3.0 mandates)

| id | Check | Sev |
|---|---|---|
| a11y.axe_critical | axe‑core violations, impact = critical | H |
| a11y.axe_serious | axe‑core violations, impact = serious | M |
| a11y.axe_moderate_minor | moderate + minor (counted, low weight) | L |
| a11y.lang | `<html lang>` present **and matches the script actually used** (Malayalam page with `lang="en"` fails — screen readers mispronounce everything) | H |
| a11y.alt | Images missing alt text (count, %) | M |
| a11y.contrast | Colour‑contrast failures (from axe) | M |
| a11y.headings | No `<h1>`, or heading levels skipped | L |
| a11y.labels | Form controls without labels | M |
| a11y.skip_link | Skip‑to‑content link present | L |
| a11y.keyboard | Focusable elements with `tabindex="-1"`/`outline:none` on all (heuristic) | L |
| a11y.lighthouse | Lighthouse accessibility score (informational, 0–100) | I |

**Performance & mobile** (`perf.*`)

| id | Check | Sev |
|---|---|---|
| perf.lighthouse | Lighthouse performance score (mobile, simulated 4G) | I |
| perf.lcp | Largest Contentful Paint > 4 s | M |
| perf.cls | Cumulative Layout Shift > 0.25 | L |
| perf.weight | Homepage total transfer > 3 MB (warn) / > 8 MB (fail) | M |
| perf.viewport | `<meta name="viewport">` missing — page is not mobile‑friendly | H |
| perf.tap_targets | Tap targets too small / text too small on mobile (Lighthouse audits) | M |
| perf.images | Uncompressed / oversized images | L |

**Content & maintenance** (`content.*`) — *is anyone looking after it?*

| id | Check | Sev |
|---|---|---|
| content.copyright_year | Footer copyright year ≥ 2 years old | M |
| content.last_updated | "Last updated" date missing (GIGW‑mandatory) or > 12 months old | M/H |
| content.stale_news | Newest dated item in news/announcements/tenders block > 12 months old | M |
| content.placeholder | "Lorem ipsum", "sample text", "Home page description", unfilled template strings | H |
| content.legacy_font | CSS/`<font face>` references non‑Unicode Malayalam fonts (ML‑TTKarthika, ML‑TTRevathi, ML‑TTAmbili, ISM/Matweb families…) — text unreadable without a proprietary font | H |
| content.obsolete_tech | `<marquee>`, `<blink>`, Flash `.swf`/`x-shockwave-flash`, Java applets, `<frameset>`, VBScript | M |
| content.best_viewed | "Best viewed in Internet Explorer / at 1024×768" strings | L |
| content.broken_links | Internal links returning 4xx/5xx/timeout (crawl ≤ 30) — count and % | M/H |
| content.broken_pdfs | Linked PDFs (≤ 20 sampled) that 404 | M |
| content.broken_images | `<img>` requests that failed | L |
| content.malayalam | No Malayalam version/toggle detected on an English‑only citizen‑facing site (kind‑dependent) | M |
| content.title | `<title>` missing, generic ("Home", "Untitled", "Welcome"), or the CMS default | M |
| content.meta_desc | `<meta name="description">` missing | L |
| content.favicon | No favicon | L |
| content.console_errors | Uncaught JS errors on load | L |

**GIGW 3.0 compliance** (`gigw.*`) — *does it have what the Government of India says every government site must have?* Detected by matching link/heading text on the homepage in English **and Malayalam** (e.g. Contact Us / ബന്ധപ്പെടുക, Sitemap / സൈറ്റ്മാപ്പ്, Privacy Policy / സ്വകാര്യതാ നയം, RTI / വിവരാവകാശം, Accessibility / പ്രവേശനക്ഷമത, Feedback / അഭിപ്രായം, Disclaimer / നിരാകരണം).

| id | Element | Sev |
|---|---|---|
| gigw.contact | Contact Us | H |
| gigw.feedback | Feedback | L |
| gigw.sitemap | Sitemap page | M |
| gigw.privacy | Privacy Policy | M |
| gigw.terms | Terms & Conditions / Terms of Use | L |
| gigw.copyright_policy | Copyright Policy | L |
| gigw.hyperlink_policy | Hyperlinking Policy | L |
| gigw.disclaimer | Disclaimer | L |
| gigw.accessibility_statement | Accessibility Statement | M |
| gigw.screen_reader | Screen Reader Access page | L |
| gigw.help | Help | L |
| gigw.rti | RTI information / PIO details (mandatory for public authorities under RTI Act s.4) | H |
| gigw.search | Site search facility | L |
| gigw.ownership | Ownership / "Content owned by … Designed, developed & hosted by …" statement | M |
| gigw.last_updated | Last updated date shown | M |
| gigw.emblem | State/National emblem present (heuristic: image alt/filename) | I |

**Identity & hygiene** (`id.*`)

| id | Check | Sev |
|---|---|---|
| id.gov_domain | Domain is `.gov.in` / `.nic.in` / `.kerala.gov.in` / `.ac.in` / `.edu.in`. Anything else (`.com/.org/.in/.net`) is flagged: citizens cannot tell it from a phishing site, and such domains lapse and get hijacked | H |
| id.domain_expiry | RDAP expiry for `.in/.com/.org/.net` domains < 60 days (skipped for `.gov.in`) | H |
| id.www_consistency | `www` and bare host both resolve and one redirects to the other | L |
| id.robots | `robots.txt` served (and doesn't block everything) | L |
| id.sitemap_xml | `sitemap.xml` served | L |
| id.soft_404 | A random non‑existent path returns 200 instead of 404 | L |
| id.canonical | `<link rel="canonical">` present | I |
| id.charset_doctype | Declared UTF‑8 and HTML5 doctype | L |
| id.tech | Detected CMS/server (informational: "Drupal 7", "WordPress 4.9", "ASP.NET 2.0") — old unsupported majors → warn | M |
| id.third_party | Third‑party trackers/CDNs loaded (Google Analytics, Facebook pixel, etc.) — listed, informational | I |

Roughly 90 checks. Not all apply to all kinds (a grama panchayat page on a shared platform doesn't get `id.domain_expiry`; `n/a` results don't count against the score).

### 5.4 Scoring and status

**Availability is a gate, not a component.** If a status‑setting (★) check fails, the site's status is set directly and the score is not shown:

| Status | Set when | Colour/label on site |
|---|---|---|
| `down` | light check failed twice in a row (dns / connect / status) | 🔴 Down |
| `hijacked` | parked / offsite redirect / Safe Browsing hit | ⛔ Possibly hijacked — do not visit |
| `broken` | reachable but blank / default page / under construction / **invalid certificate** (browsers block it — a citizen cannot get in) | 🔴 Broken |
| `unverifiable` | geo‑blocked from our vantage point and no India runner result | ⚪ Unverifiable |
| `unaudited` | never deep‑audited yet | ⚪ Not yet audited |

Otherwise **score 0–100** = weighted sum of six category scores (each 0–100, deductions per failed check scaled by severity: C −40, H −20, M −10, L −4, I 0, floored at 0):

| Category | Weight |
|---|---|
| Security | 25 |
| Accessibility | 25 |
| Content & maintenance | 15 |
| GIGW compliance | 15 |
| Performance & mobile | 10 |
| Identity & hygiene | 10 |

| Score | Status |
|---|---|
| ≥ 80 | 🟢 Healthy |
| 50–79 | 🟡 Needs work |
| < 50 | 🟠 Poor |

Headline number on the homepage — **"broken"** = `down + hijacked + broken`. "Poor" sites are not "broken"; the distinction keeps us credible.

Rollups for a department/district/ministry: % broken, median score, and the top 3 most common failed checks across its sites ("14 of 22 sites under Health have no HTTPS").

### 5.5 Result record (one JSON per site, `data/results/<id>.json`)

```json
{
  "id": "keralapsc",
  "url": "https://www.keralapsc.gov.in",
  "light": {
    "at": "2026-09-19T03:10:22Z", "vantage": "gh-us",
    "dns": true, "status": 200, "final_url": "https://www.keralapsc.gov.in/",
    "redirects": ["http://keralapsc.gov.in -> https://www.keralapsc.gov.in/"],
    "ttfb_ms": 812, "title": "Kerala Public Service Commission",
    "tls": {"valid": true, "protocol": "TLSv1.3", "expires": "2027-01-02", "days_left": 105, "issuer": "..."},
    "headers": {"hsts": false, "csp": false, "xfo": true, "xcto": true, "referrer": false, "server": "Apache"},
    "content_hash": "b1946ac9..."
  },
  "deep": {
    "at": "2026-09-18T22:41:03Z", "run": "17654321", "vantage": "gh-us",
    "lighthouse": {"performance": 41, "accessibility": 67, "best_practices": 75, "seo": 80},
    "axe": {"critical": 3, "serious": 12, "moderate": 5, "minor": 2},
    "crawl": {"pages": 25, "pdfs": 12, "broken": 4},
    "tech": {"cms": "Drupal 7", "server": "Apache/2.4.6", "jquery": "1.12.4"},
    "checks": [
      {"id": "sec.hsts", "r": "fail"},
      {"id": "content.legacy_font", "r": "fail", "ev": "font-family: ML-TTKarthika (style.css:41)"},
      {"id": "gigw.rti", "r": "pass"}
    ],
    "screenshot": {"desktop": "keralapsc.webp", "mobile": "keralapsc-m.webp", "phash": "..."}
  },
  "score": {"overall": 54, "security": 40, "accessibility": 55, "content": 60, "gigw": 30, "performance": 41, "identity": 90},
  "status": "needs-work",
  "issues": [
    {"id": "content.legacy_font", "sev": "H", "ev": "..."},
    {"id": "sec.hsts", "sev": "M"}
  ],
  "history": [
    {"d": "2026-09-19", "up": true, "score": 54},
    {"d": "2026-09-18", "up": true, "score": 54}
  ]
}
```

`history` keeps 90 daily entries (up/down from light checks, score from the latest deep audit that day). `summary.json` holds all rollups the homepage needs so it never has to read 1,900 files client‑side.

### 5.6 The check registry (explanations)

`audit/src/checks/registry.ts` — the single source for everything the public site says about a check:

```ts
'sec.cert_valid': {
  category: 'security', severity: 'C', statusSetting: 'broken',
  title:   { en: 'HTTPS certificate is invalid or expired',
             ml: 'HTTPS സർട്ടിഫിക്കറ്റ് അസാധുവാണ് അല്ലെങ്കിൽ കാലഹരണപ്പെട്ടു' },
  citizen: { en: 'Browsers show a full-page "Your connection is not private" warning. Most people cannot get past it, so the site is effectively unreachable.',
             ml: '…' },
  fix:     { en: 'Renew the TLS certificate (NIC issues them free for .gov.in; Let\'s Encrypt for others) and turn on auto-renewal.' },
  ref:     'GIGW 3.0 — Security; WCAG n/a',
}
```

Every issue on a site page renders `title → citizen → fix → ref`, collapsible. Malayalam strings can start as empty and be filled by contributors; the UI falls back to English.

### 5.7 Tests for the test suite

`audit/tests/` — Vitest, fixtures under `audit/tests/fixtures/*.html`: a parked page, an IIS default page, a page using ML‑TTKarthika, a Malayalam page with `lang="en"`, a page with all GIGW links in Malayalam only, a blank page, a marquee page, a 1998‑style frameset. Each check must pass/fail the right fixtures. Runs on every PR. The audit suite is itself audited.

---

## 6. Automation on GitHub Actions

### 6.1 Workflows

| Workflow | Trigger | Does | Runtime |
|---|---|---|---|
| `uptime.yml` | cron every 6 h | light check of every site → update `light`, `history`, `summary.json` → commit to `data` | ~10 min |
| `audit.yml` | cron daily 03:00 IST + manual (`site_ids`) | plan batch → 6 parallel shards → merge → commit to `data` | 45–70 min |
| `build-deploy.yml` | push to `main` (site/, registry/) or `data` | Astro build + Pagefind index → GitHub Pages at govwebsite.hashin.me | ~4 min |
| `validate.yml` | PR touching `registry/` | schema, uniqueness, URL normalisation, live‑resolve every new URL, comment results on the PR | ~2 min |
| `test.yml` | PR / push touching `audit/` or `site/` | unit tests, typecheck, lint | ~2 min |
| `discover.yml` | weekly | analyse outbound links collected during deep audits → PR with `registry/candidates.yaml` | ~3 min |
| `squash-data.yml` | monthly | zip the `data` branch to a Release (`dataset-YYYY-MM.zip`), then rewrite `data` as a single‑commit orphan branch to bound repo growth | ~2 min |
| `report.yml` | monthly (1st) | generate "State of Kerala Government Websites — <month>" page + Atom feed entry | ~2 min |
| `issue-to-pr.yml` | issue opened with `add-website` form | parse form → open PR against the registry | seconds |

### 6.2 The rolling scheduler (how it "keeps going till everything is covered")

`audit plan` picks each day's batch:

```
N          = number of active sites
refreshDays= 7                         # every site re-audited at least weekly in steady state
batch      = clamp(ceil(N / refreshDays), 50, MAX_BATCH=300)

candidates = active sites, ordered by:
  1. forced  (workflow_dispatch site_ids, or bumped by a light-check change)  
  2. never deep-audited                            ← the initial sweep
  3. status just changed (came back up, went down) 
  4. oldest deep.at first
  5. tie-break: priority desc (state core → district/ULB → GP), then id

pick first `batch`, split round-robin into K shards (K = min(6, ceil(batch / 40)))
emit GitHub matrix JSON: {"include":[{"index":0,"ids":"a,b,c…"},…]}
```

Behaviour over time:

- **Sweep phase** (first ~7 days): every day audits ~270 never‑audited sites, most important first. Homepage shows *"1,240 / 1,850 deep‑audited (67%) — full coverage by 26 Sep"*.
- **Steady state**: batch = N/7, so each site is refreshed every 7 days; change‑triggered bumps happen within 24 h; anything `down` is watched 4×/day by the light check and deep‑audited the day it comes back.
- **Growth**: adding 300 sites to the registry just makes the next 1–2 batches bigger (capped at 300). Nothing else changes.
- **Manual**: `workflow_dispatch` with `site_ids=kseb,kwa` re‑audits those now — this is how a department that fixed something gets its page updated the same day.

### 6.3 `audit.yml`

```yaml
name: Deep audit (rolling)

on:
  schedule:
    - cron: '30 21 * * *'          # 03:00 IST
  workflow_dispatch:
    inputs:
      site_ids:   { description: 'Comma-separated site ids to audit now', required: false, default: '' }
      batch_size: { description: 'Override batch size', required: false, default: '' }

permissions:
  contents: write

concurrency:
  group: audit
  cancel-in-progress: false

jobs:
  plan:
    runs-on: ubuntu-latest
    outputs:
      matrix:   ${{ steps.plan.outputs.matrix }}
      batch_id: ${{ steps.plan.outputs.batch_id }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/checkout@v4
        with: { ref: data, path: data }
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm, cache-dependency-path: audit/package-lock.json }
      - run: npm ci --prefix audit
      - id: plan
        run: >
          node audit/dist/cli.js plan
          --registry registry --data data
          --refresh-days 7 --max-batch 300 --max-shards 6
          --site-ids "${{ inputs.site_ids }}" --batch-size "${{ inputs.batch_size }}"

  audit:
    needs: plan
    runs-on: ubuntu-latest
    timeout-minutes: 180
    strategy:
      fail-fast: false
      matrix: ${{ fromJSON(needs.plan.outputs.matrix) }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm, cache-dependency-path: audit/package-lock.json }
      - run: npm ci --prefix audit
      - run: npx --prefix audit playwright install --with-deps chromium
      - run: node audit/dist/cli.js run --ids "${{ matrix.ids }}" --out out/
        env:
          VANTAGE: gh-us
          SAFE_BROWSING_KEY: ${{ secrets.SAFE_BROWSING_KEY }}   # optional
      - uses: actions/upload-artifact@v4
        with: { name: shard-${{ matrix.index }}, path: out/, retention-days: 3 }

  merge:
    needs: audit
    if: always()                     # merge whatever shards finished
    runs-on: ubuntu-latest
    concurrency:
      group: data-branch             # shared with uptime.yml so pushes never race
      cancel-in-progress: false
    steps:
      - uses: actions/checkout@v4
      - uses: actions/checkout@v4
        with: { ref: data, path: data }
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm, cache-dependency-path: audit/package-lock.json }
      - run: npm ci --prefix audit
      - uses: actions/download-artifact@v4
        with: { pattern: shard-*, path: out/, merge-multiple: true }
      - run: node audit/dist/cli.js merge --in out/ --registry registry --data data
      - name: Commit results
        working-directory: data
        run: |
          git config user.name  "kerala-web-watch[bot]"
          git config user.email "kerala-web-watch[bot]@users.noreply.github.com"
          git add -A
          git commit -m "audit: $(date -u +%F) batch ${{ needs.plan.outputs.batch_id }}" || exit 0
          for i in 1 2 3 4 5; do
            git push && break
            git pull --rebase && sleep $((i * 5))
          done
```

`build-deploy.yml` is triggered by the push to `data`. `uptime.yml` is the same shape with a single job and `cli.js light --all`.

### 6.4 Data storage

- **`main`** — code and the registry. Human history matters here.
- **`data`** (orphan branch) — `results/*.json`, `summary.json`, `outlinks.json`, `screenshots/*.webp`. Rewritten by bots ~5×/day. Git history here is noise, so `squash-data.yml` collapses it monthly after archiving a zip to a GitHub Release. Trend data lives *inside* each record (`history[90]`) and in the monthly archives, not in git history.
- **Screenshots** — 1280×800 and 390×844, WebP q60 (~40–70 KB each). Only rewritten if the perceptual hash changed, so a site that hasn't changed in a year costs one file, once. 1,900 × 2 × 60 KB ≈ 230 MB worst case; fine for Pages (1 GB limit).
- **Releases** — `dataset-YYYY-MM.zip`: the open‑data archive journalists and researchers can cite.

### 6.5 Limits and budget

| Constraint | Value (public repo, free) | Our use |
|---|---|---|
| Actions minutes | unlimited on GitHub‑hosted runners | ~2.5 h/day |
| Job timeout | 6 h | shards ≤ 3 h, typically < 1 h |
| Concurrent jobs | 20 | max 7 |
| Matrix size | 256 | 6 |
| Artifact retention | set to 3 days | ~50 MB/day |
| Pages size / bandwidth | 1 GB / 100 GB‑month soft | ~400 MB / low |

### 6.6 Discovery (the list maintains itself)

During every deep audit the crawler already sees every outbound link on the homepage and crawled pages. `merge` appends unknown hosts to `data/outlinks.json` with (from‑site, anchor text, count). `discover.yml` weekly:

1. filter hosts matching `\.kerala\.gov\.in$ | \.gov\.in$ | \.nic\.in$ | \.ac\.in$` or anchor/host containing `kerala`/`കേരള`;
2. drop anything in the registry (after normalisation) or in `registry/ignore.yaml` (central govt, NIC infra, CDNs);
3. light‑check each, fetch title;
4. write `registry/candidates.yaml` and open a PR "Discovery: 23 candidate sites" with a table (host, title, seen from, guess at department/district).

A human merges what's real, moves the rest to `ignore.yaml`. Over time the registry converges on complete.

### 6.7 Vantage point: the geo‑blocking problem

Some NIC‑hosted sites block or throttle non‑Indian IPs. GitHub‑hosted runners are in the US/EU. If we call those *down*, we are wrong and will be dismissed.

- Detection: a 403 with NIC's block page, or a TCP timeout when the host resolves and the same host is reachable from India — we learn the signature from the first sweep.
- Result: status `unverifiable`, listed separately, never counted as broken.
- Fix (phase 4): a **self‑hosted runner in India** — a ₹400/month VPS in Mumbai/Chennai, or any always‑on machine — labelled `india`. `uptime.yml` runs a second light‑check job on it (`VANTAGE=in-1`) for sites marked `unverifiable`, and its result wins. Both vantages are recorded in the JSON. Even without it, the system works; it just reports some sites as unverifiable.

### 6.8 False‑positive guards

- Down requires 2 consecutive light‑check failures (≈ 6–12 h) and 3 in‑run retries with back‑off.
- Certificate checks use Node's bundled Mozilla root store, kept current by the Node version.
- Lighthouse scores are labelled "indicative" and never set status.
- Every status‑setting check writes evidence (status code, matched text, final URL) shown on the site page, so anyone can verify.
- Departments can request re‑audit via an issue; `workflow_dispatch` re‑runs within the hour.

---

## 7. The public website

### 7.1 Stack

- **Astro** (static output, content from `data/` + `registry/` at build time; ~2,000 pages build in ~2 min). Islands only where needed (sortable tables, map hover).
- **Pagefind** for static full‑text search (works on GitHub Pages, indexes English and Malayalam).
- **Inline SVG map** of the 14 districts (paths from DataMeet's open India district shapes, simplified with mapshaper; attribution on the About page).
- **i18n**: `/` English, `/ml/` Malayalam (Astro i18n routing). Fonts self‑hosted (Manjari / Noto Sans Malayalam) — no Google Fonts, no third‑party requests, no analytics by default. The site must pass its own audit and is listed in the registry as a dogfood entry.
- Tiny inline‑SVG sparklines; no chart library.

### 7.2 Pages

| URL | Purpose |
|---|---|
| `/` | Headline ("**137** of 1,850 Kerala government websites are broken right now"), Kerala map coloured by district health, stat tiles (Down · Hijacked · No HTTPS · Inaccessible · Not updated in a year · Non‑gov domain), browse tabs (Ministry / District / Kind / Status), "Broke this week" and "Fixed this week", coverage bar, search |
| `/ministries/` · `/ministries/<slug>/` | Portfolio cards with health %, then departments → sites |
| `/departments/<slug>/` | Department rollup: score distribution, 3 most common issues, table of its organisations' sites |
| `/districts/` · `/districts/<slug>/` | Map, then District administration · Corporation/Municipalities · Block panchayats · Grama panchayats (collapsible, 60–120 rows) · Institutions · State bodies headquartered here |
| `/districts/<d>/<place>/` | City/town view (optional; generated when a place has ≥ 3 sites) |
| `/sites/<id>/` | **The site page** — see 7.3 |
| `/status/<down|hijacked|broken|poor|unverifiable>/` | Lists with department & district columns |
| `/kinds/<kind>/` | All universities, all commissions, … |
| `/platforms/lsgkerala/` | Platform‑level findings reported once |
| `/leaderboard/` | Best and worst departments and districts; most improved this month |
| `/methodology/` | Every check, weight, threshold; limitations; ethics; how to contest |
| `/reports/<yyyy-mm>/` | Monthly state‑of‑the‑web report |
| `/data/` | Downloads + static API docs |
| `/about/` | Who, why, contact, contribute, licence, accessibility statement, last updated |
| `/api/summary.json`, `/api/sites/<id>.json`, `/api/sites.csv`, `/api/all.json` | Static JSON "API" |
| `/feeds/broken.xml`, `/feeds/fixed.xml` | Atom feeds |

### 7.3 Site page anatomy (`/sites/<id>/`)

1. Header: name (en/ml), URL (with warning styling if `hijacked`), status badge, score ring, "Audited 2 days ago · Checked 3 hours ago".
2. Breadcrumbs: Ministry › Department › Organisation; District › Place.
3. Screenshot (desktop; mobile on toggle). Missing screenshot shows the reason (down/geo‑blocked).
4. Six category bars.
5. **Issues**, grouped Critical → High → Medium → Low, each: title · what it means for you · how to fix it · evidence · reference. Passed checks collapsed below ("42 checks passed").
6. 90‑day availability strip + score sparkline.
7. Technical facts: final URL, server, CMS, TLS expiry, domain TLD class, platform.
8. Actions: *Suggest a correction* (prefilled GitHub issue), *Request re‑audit*, *Download JSON*, *Share*.
9. "Other sites under <department>" and "Other sites in <district>" with their statuses.

### 7.4 Design principles

Mobile‑first (most citizens will open this on a phone). Bilingual. WCAG AA on our own pages. Status never conveyed by colour alone (icon + word). Calm tone: findings are stated, not mocked — the audience includes the webmasters we want to fix things. Dark mode. No cookie banner because no cookies.

---

## 8. Repository layout

```
kerala-web-watch/
├── .github/
│   ├── workflows/            uptime.yml audit.yml build-deploy.yml validate.yml test.yml
│   │                         discover.yml squash-data.yml report.yml issue-to-pr.yml
│   └── ISSUE_TEMPLATE/       add-website.yml  correction.yml  reaudit-request.yml
├── registry/                 # human-curated — THE LIST
│   ├── schema.json  departments.yaml  ministers.yaml  districts.yaml  places.yaml  kinds.yaml  ignore.yaml
│   └── sites/                state.yaml directorates.yaml agencies.yaml statutory.yaml universities.yaml
│                             psus.yaml districts.yaml lsg-corporations.yaml lsg-municipalities.yaml
│                             lsg-district-panchayats.yaml lsg-block-panchayats.yaml lsg-grama-panchayats.yaml
├── audit/                    # the test suite (TypeScript, Node 22)
│   ├── src/cli.ts            plan | run | light | merge | discover | report
│   ├── src/scheduler.ts      batch selection (§6.2)
│   ├── src/light.ts          dns/tls/http light check
│   ├── src/runner.ts         per-site deep audit orchestration (Playwright session, Lighthouse, crawl)
│   ├── src/checks/           availability.ts security.ts a11y.ts perf.ts content.ts gigw.ts identity.ts
│   ├── src/checks/registry.ts   check metadata + bilingual explanations (§5.6)
│   ├── src/score.ts          scoring + status (§5.4)
│   ├── src/merge.ts          shard outputs → data/, history, summary, outlinks
│   └── tests/                vitest + html fixtures
├── site/                     # Astro
│   ├── src/pages/            index, ministries/, departments/, districts/, sites/[id], status/, kinds/, methodology, data, about, api/
│   ├── src/components/       KeralaMap ScoreRing HealthBadge IssueCard Sparkline SiteTable CoverageBar
│   ├── src/i18n/             en.json ml.json
│   └── src/data/             kerala-districts.svg.json
├── scripts/harvest/          one-off scrapers used in Phase 1 (kept for provenance)
├── docs/DESIGN.md            this document
├── README.md  CONTRIBUTING.md  CODE_OF_CONDUCT.md  LICENSE (MIT)  LICENSE-DATA (CC-BY-4.0)
└── (branch: data)            results/  screenshots/  summary.json  outlinks.json
```

---

## 9. Roadmap

| Phase | Deliverable | Effort |
|---|---|---|
| **0 — Skeleton** | Repo, layout, schema, Astro skeleton deployed to Pages with 10 hand‑entered sites; `validate.yml`, `test.yml` | 1 day |
| **1 — The list** | Harvest scripts for kerala.gov.in, goidirectory, lsgkerala.gov.in, 14 district portals, PSU list; curation into the registry with departments/districts/places; ~1,700+ verified entries | 3–5 days (mostly curation) |
| **2 — Light checks live** | `light.ts`, `uptime.yml`, `data` branch, homepage with map + up/down + status lists. *Already useful to citizens at this point.* | 2 days |
| **3 — Deep audit** | Playwright/axe/Lighthouse runner, all check families, scoring, registry of explanations (English), scheduler, `audit.yml` shards + merge, screenshots | 5–7 days |
| **4 — Full site** | Site pages, ministry/department/district/place pages, leaderboard, methodology, static API, feeds, Pagefind, monthly squash, India runner (optional) | 4–5 days |
| **5 — Self‑maintenance & reach** | Discovery PRs, issue forms → PRs, monthly report, Malayalam UI + explanations, government colleges tier, outreach to IT Mission / departments | ongoing |

Phases 1 and 2 can overlap: the light check runs on whatever is in the registry the moment it merges.

---

## 10. Risks

| Risk | Mitigation |
|---|---|
| Wrongly calling a site "down" (geo‑block, transient) | §6.7 vantage handling, 2‑strike rule, evidence shown, re‑audit on request |
| Being seen as "attacking" government infrastructure | Passive‑only design, 1 req/s, honest UA with contact, robots.txt respected, public methodology page. Nothing we do differs from a person clicking around |
| Repo bloat from daily data commits | Orphan `data` branch + monthly squash + phash‑gated screenshots |
| Lighthouse variance on shared runners | Labelled indicative; never affects status; thresholds generous |
| Registry accuracy (wrong department, wrong district) | Provenance field, PR review, correction issue form, dogfood |
| Malayalam‑only sites failing English text‑pattern checks | All GIGW/content patterns are bilingual from day one; Malayalam script detection |
| lsgkerala.gov.in platform issues counted 941× | `platform` tag → reported once at `/platforms/lsgkerala/`, per‑site pages inherit with a note |
| Cabinet changes break "ministries" view | `ministers.yaml` is a small, separate, easily edited file |
| Maintainer burnout | Everything automated except registry review; discovery PRs batch weekly; issue forms structured |

---

## 11. Decisions taken (change any of these)

| Decision | Default | Why |
|---|---|---|
| Language of tooling | TypeScript / Node 22 | Playwright, axe, Lighthouse, retire.js are all Node; one runtime |
| Static site generator | Astro + Pagefind | Data‑driven pages, fast builds, zero client JS by default, i18n built in |
| Results storage | orphan `data` branch, squashed monthly, archived to Releases | Bounded growth; open‑data archives for free |
| Deep‑audit cadence | daily, batch = N/7 (cap 300), 6 shards | Weekly refresh of everything; ~1 h of Actions per day |
| Light‑check cadence | every 6 h | Down within 12 h worst case; 4 data points/day for the availability strip |
| "Broken" definition | down ∪ hijacked ∪ (blank/default/under‑construction/invalid‑cert) | Defensible headline number |
| Score weights | Sec 25 / A11y 25 / Content 15 / GIGW 15 / Perf 10 / Identity 10 | Citizen impact first; performance last because runner‑dependent |
| LSGIs in scope | yes, all 1,200, with platform tagging | That's what most citizens will look up |
| Government colleges | phase 5 | Long tail; do the core first |
| Central govt bodies | out of scope (tagged, hidden) | Different owner, different accountability |
| Licence | MIT code, CC‑BY‑4.0 data | Maximum reuse; attribution required |
| Analytics | none by default | We flag third‑party trackers on their sites; we can't run them on ours |
| India vantage runner | optional, phase 4 | Works without it; better with it |

**Open questions for you**

1. ~~Name and domain~~ — decided: Kerala Web Watch at govwebsite.hashin.me (ADR-019).
2. Should `ministers.yaml` carry minister names, or only portfolio labels? (Names are accurate but political; portfolios are neutral.)
3. Contact identity on the User‑Agent and About page — a project email, or yours?
4. Do you want the India self‑hosted runner from the start (needs a small VPS you control)?

---

## Appendix A — Seed registry (starter, all `verify: true`)

Every URL below is from memory and must be confirmed by the Phase 1 light check before it is trusted; several government sites have moved to `*.kerala.gov.in` in recent years. Listed to demonstrate the schema and to give Phase 1 a head start.

```yaml
# registry/sites/state.yaml
- {id: kerala-gov,        name: Government of Kerala Portal,       url: https://kerala.gov.in,               tier: state, kind: portal,      department: gad,     scope: state, district: thiruvananthapuram, place: thiruvananthapuram, priority: 3}
- {id: cmo,               name: Chief Minister's Office,            url: https://keralacm.gov.in,             tier: state, kind: office,      department: gad,     scope: state, district: thiruvananthapuram, place: thiruvananthapuram, priority: 3}
- {id: rajbhavan,         name: Raj Bhavan Kerala,                  url: https://rajbhavan.kerala.gov.in,     tier: state, kind: office,      department: gad,     scope: state, district: thiruvananthapuram, place: thiruvananthapuram, priority: 3}
- {id: niyamasabha,       name: Kerala Legislative Assembly,        url: https://niyamasabha.org,             tier: state, kind: legislature, department: parl,    scope: state, district: thiruvananthapuram, place: thiruvananthapuram, priority: 3}
- {id: edistrict,         name: e-District Kerala,                  url: https://edistrict.kerala.gov.in,     tier: state, kind: service,     department: eit,     scope: state, district: thiruvananthapuram, place: thiruvananthapuram, priority: 3}
- {id: finance,           name: Finance Department,                 url: https://finance.kerala.gov.in,       tier: state, kind: department,  department: fin,     scope: state, district: thiruvananthapuram, place: thiruvananthapuram, priority: 3}
- {id: treasury,          name: Treasuries Department,              url: https://treasury.kerala.gov.in,      tier: directorate, kind: directorate, department: fin, scope: state, district: thiruvananthapuram, place: thiruvananthapuram, priority: 3}
- {id: keralataxes,       name: State GST Department,               url: https://keralataxes.gov.in,          tier: directorate, kind: directorate, department: taxes, scope: state, district: thiruvananthapuram, place: thiruvananthapuram, priority: 3}
- {id: igr,               name: Registration Department,            url: https://igr.kerala.gov.in,           tier: directorate, kind: directorate, department: regn, scope: state, district: thiruvananthapuram, place: thiruvananthapuram, priority: 3}
- {id: keralamvd,         name: Motor Vehicles Department,          url: https://keralamvd.gov.in,            tier: directorate, kind: directorate, department: transport, scope: state, district: thiruvananthapuram, place: thiruvananthapuram, priority: 3}
- {id: keralapolice,      name: Kerala Police,                      url: https://keralapolice.gov.in,         tier: directorate, kind: police,      department: home, scope: state, district: thiruvananthapuram, place: thiruvananthapuram, priority: 3}
- {id: dhs,               name: Directorate of Health Services,     url: https://dhs.kerala.gov.in,           tier: directorate, kind: directorate, department: health, scope: state, district: thiruvananthapuram, place: thiruvananthapuram, priority: 3}
- {id: dme,               name: Directorate of Medical Education,   url: https://dme.kerala.gov.in,           tier: directorate, kind: directorate, department: health, scope: state, district: thiruvananthapuram, place: thiruvananthapuram, priority: 3}
- {id: arogyakeralam,     name: National Health Mission Kerala,     url: https://arogyakeralam.gov.in,        tier: agency, kind: mission,          department: health, scope: state, district: thiruvananthapuram, place: thiruvananthapuram, priority: 3}
- {id: education,         name: General Education Department,       url: https://education.kerala.gov.in,     tier: directorate, kind: directorate, department: gedu, scope: state, district: thiruvananthapuram, place: thiruvananthapuram, priority: 3}
- {id: dhse,              name: Directorate of Higher Secondary Education, url: https://dhsekerala.gov.in,   tier: directorate, kind: directorate, department: gedu, scope: state, district: thiruvananthapuram, place: thiruvananthapuram, priority: 3}
- {id: collegiateedu,     name: Directorate of Collegiate Education, url: https://collegiateedu.kerala.gov.in, tier: directorate, kind: directorate, department: hedu, scope: state, district: thiruvananthapuram, place: thiruvananthapuram, priority: 3}
- {id: dte,               name: Directorate of Technical Education, url: https://dtekerala.gov.in,            tier: directorate, kind: directorate, department: hedu, scope: state, district: thiruvananthapuram, place: thiruvananthapuram, priority: 3}
- {id: keralaagriculture, name: Agriculture Department,             url: https://keralaagriculture.gov.in,    tier: directorate, kind: directorate, department: agri, scope: state, district: thiruvananthapuram, place: thiruvananthapuram, priority: 3}
- {id: ahd,               name: Animal Husbandry Department,        url: https://ahd.kerala.gov.in,           tier: directorate, kind: directorate, department: ahd, scope: state, district: thiruvananthapuram, place: thiruvananthapuram, priority: 3}
- {id: fisheries,         name: Fisheries Department,               url: https://fisheries.kerala.gov.in,     tier: directorate, kind: directorate, department: fish, scope: state, district: thiruvananthapuram, place: thiruvananthapuram, priority: 3}
- {id: forest,            name: Forest & Wildlife Department,       url: https://forest.kerala.gov.in,        tier: directorate, kind: directorate, department: forest, scope: state, district: thiruvananthapuram, place: thiruvananthapuram, priority: 3}
- {id: pwd,               name: Public Works Department,            url: https://pwd.kerala.gov.in,           tier: directorate, kind: directorate, department: pwd, scope: state, district: thiruvananthapuram, place: thiruvananthapuram, priority: 3}
- {id: irrigation,        name: Irrigation Department,              url: https://irrigation.kerala.gov.in,    tier: directorate, kind: directorate, department: wrd, scope: state, district: thiruvananthapuram, place: thiruvananthapuram, priority: 3}
- {id: revenue,           name: Revenue Department,                 url: https://revenue.kerala.gov.in,       tier: directorate, kind: directorate, department: revenue, scope: state, district: thiruvananthapuram, place: thiruvananthapuram, priority: 3}
- {id: civilsupplies,     name: Civil Supplies Department,          url: https://civilsupplieskerala.gov.in,  tier: directorate, kind: directorate, department: fcs, scope: state, district: thiruvananthapuram, place: thiruvananthapuram, priority: 3}
- {id: prd,               name: Information & Public Relations,     url: https://prd.kerala.gov.in,           tier: directorate, kind: directorate, department: prd, scope: state, district: thiruvananthapuram, place: thiruvananthapuram, priority: 3}
- {id: lsgd,              name: Local Self Government Department,   url: https://lsgkerala.gov.in,            tier: state, kind: department,        department: lsgd, scope: state, district: thiruvananthapuram, place: thiruvananthapuram, priority: 3}
- {id: itmission,         name: Kerala State IT Mission,            url: https://itmission.kerala.gov.in,     tier: agency, kind: mission,          department: eit, scope: state, district: thiruvananthapuram, place: thiruvananthapuram, priority: 3}
- {id: ksum,              name: Kerala Startup Mission,             url: https://startupmission.kerala.gov.in, tier: agency, kind: mission,         department: eit, scope: state, district: thiruvananthapuram, place: thiruvananthapuram, priority: 3}
- {id: akshaya,           name: Akshaya,                            url: https://akshaya.kerala.gov.in,       tier: agency, kind: mission,          department: eit, scope: state, district: thiruvananthapuram, place: thiruvananthapuram, priority: 3}
- {id: kudumbashree,      name: Kudumbashree,                       url: https://kudumbashree.org,            tier: agency, kind: mission,          department: lsgd, scope: state, district: thiruvananthapuram, place: thiruvananthapuram, priority: 3}
- {id: kiifb,             name: KIIFB,                              url: https://kiifb.org,                   tier: agency, kind: board,            department: fin, scope: state, district: thiruvananthapuram, place: thiruvananthapuram, priority: 3}
- {id: spb,               name: Kerala State Planning Board,        url: https://spb.kerala.gov.in,           tier: statutory, kind: board,         department: plan, scope: state, district: thiruvananthapuram, place: thiruvananthapuram, priority: 3}
- {id: sdma,              name: Kerala State Disaster Management Authority, url: https://sdma.kerala.gov.in,  tier: statutory, kind: authority,     department: revenue, scope: state, district: thiruvananthapuram, place: thiruvananthapuram, priority: 3}
- {id: kscste,            name: KSCSTE,                             url: https://kscste.kerala.gov.in,        tier: statutory, kind: council,       department: st, scope: state, district: thiruvananthapuram, place: thiruvananthapuram, priority: 3}
- {id: keralapcb,         name: Kerala State Pollution Control Board, url: https://keralapcb.nic.in,          tier: statutory, kind: board,         department: env, scope: state, district: thiruvananthapuram, place: thiruvananthapuram, priority: 2}
- {id: keralapsc,         name: Kerala Public Service Commission,   url: https://www.keralapsc.gov.in,        tier: statutory, kind: commission,    department: pard, scope: state, district: thiruvananthapuram, place: thiruvananthapuram, priority: 3}
- {id: norkaroots,        name: NORKA Roots,                        url: https://norkaroots.org,              tier: agency, kind: agency,           department: norka, scope: state, district: thiruvananthapuram, place: thiruvananthapuram, priority: 2}
- {id: keralatourism,     name: Kerala Tourism,                     url: https://www.keralatourism.org,       tier: directorate, kind: directorate, department: tourism, scope: state, district: thiruvananthapuram, place: thiruvananthapuram, priority: 3}
- {id: kseb,              name: Kerala State Electricity Board,     url: https://www.kseb.in,                 tier: psu, kind: psu,                 department: power, scope: state, district: thiruvananthapuram, place: thiruvananthapuram, priority: 3}
- {id: kwa,               name: Kerala Water Authority,             url: https://kwa.kerala.gov.in,           tier: psu, kind: authority,           department: wrd, scope: state, district: thiruvananthapuram, place: thiruvananthapuram, priority: 3}
- {id: ksrtc,             name: KSRTC,                              url: https://www.keralartc.com,           tier: psu, kind: psu,                 department: transport, scope: state, district: thiruvananthapuram, place: thiruvananthapuram, priority: 3}
- {id: ksfe,              name: KSFE,                               url: https://www.ksfe.com,                tier: psu, kind: psu,                 department: fin, scope: state, district: thrissur, place: thrissur, priority: 2}
- {id: ksidc,             name: KSIDC,                              url: https://ksidc.org,                   tier: psu, kind: psu,                 department: ind, scope: state, district: thiruvananthapuram, place: thiruvananthapuram, priority: 2}
- {id: kinfra,            name: KINFRA,                             url: https://kinfra.org,                  tier: psu, kind: psu,                 department: ind, scope: state, district: thiruvananthapuram, place: thiruvananthapuram, priority: 2}
- {id: keltron,           name: KELTRON,                            url: https://keltron.org,                 tier: psu, kind: psu,                 department: ind, scope: state, district: thiruvananthapuram, place: thiruvananthapuram, priority: 2}
- {id: cdit,              name: C-DIT,                              url: https://cdit.org,                    tier: agency, kind: society,          department: eit, scope: state, district: thiruvananthapuram, place: thiruvananthapuram, priority: 2}
- {id: ktdc,              name: KTDC,                               url: https://www.ktdc.com,                tier: psu, kind: psu,                 department: tourism, scope: state, district: thiruvananthapuram, place: thiruvananthapuram, priority: 2}
- {id: supplyco,          name: Supplyco,                           url: https://supplycokerala.com,          tier: psu, kind: psu,                 department: fcs, scope: state, district: ernakulam, place: kochi, priority: 2}
- {id: kmml,              name: Kerala Minerals & Metals Ltd,       url: https://www.kmml.com,                tier: psu, kind: psu,                 department: ind, scope: state, district: kollam, place: chavara, priority: 1}
- {id: malabarcements,    name: Malabar Cements,                    url: https://malabarcements.co.in,        tier: psu, kind: psu,                 department: ind, scope: state, district: palakkad, place: walayar, priority: 1}
- {id: keralafeeds,       name: Kerala Feeds,                       url: https://keralafeeds.com,             tier: psu, kind: psu,                 department: ahd, scope: state, district: thrissur, place: kallettumkara, priority: 1}

# registry/sites/universities.yaml
- {id: keralauniversity,  name: University of Kerala,               url: https://www.keralauniversity.ac.in,  tier: university, kind: university, department: hedu, scope: state, district: thiruvananthapuram, place: thiruvananthapuram, priority: 3}
- {id: uoc,               name: University of Calicut,              url: https://www.uoc.ac.in,               tier: university, kind: university, department: hedu, scope: state, district: malappuram, place: thenhipalam, priority: 3}
- {id: mgu,               name: Mahatma Gandhi University,          url: https://www.mgu.ac.in,               tier: university, kind: university, department: hedu, scope: state, district: kottayam, place: kottayam, priority: 3}
- {id: kannuruniversity,  name: Kannur University,                  url: https://www.kannuruniversity.ac.in,  tier: university, kind: university, department: hedu, scope: state, district: kannur, place: kannur, priority: 3}
- {id: cusat,             name: CUSAT,                              url: https://www.cusat.ac.in,             tier: university, kind: university, department: hedu, scope: state, district: ernakulam, place: kochi, priority: 3}
- {id: ktu,               name: APJ Abdul Kalam Technological University, url: https://ktu.edu.in,           tier: university, kind: university, department: hedu, scope: state, district: thiruvananthapuram, place: thiruvananthapuram, priority: 3}
- {id: kuhs,              name: Kerala University of Health Sciences, url: https://kuhs.ac.in,                tier: university, kind: university, department: health, scope: state, district: thrissur, place: thrissur, priority: 3}
- {id: kau,               name: Kerala Agricultural University,     url: https://kau.in,                      tier: university, kind: university, department: agri, scope: state, district: thrissur, place: vellanikkara, priority: 3}
- {id: kvasu,             name: Kerala Veterinary & Animal Sciences University, url: https://kvasu.ac.in,    tier: university, kind: university, department: ahd, scope: state, district: wayanad, place: pookode, priority: 2}
- {id: kufos,             name: Kerala University of Fisheries & Ocean Studies, url: https://kufos.ac.in,    tier: university, kind: university, department: fish, scope: state, district: ernakulam, place: kochi, priority: 2}
- {id: ssus,              name: Sree Sankaracharya University of Sanskrit, url: https://ssus.ac.in,          tier: university, kind: university, department: hedu, scope: state, district: ernakulam, place: kalady, priority: 2}
- {id: malayalamuniversity, name: Thunchath Ezhuthachan Malayalam University, url: https://malayalamuniversity.edu.in, tier: university, kind: university, department: hedu, scope: state, district: malappuram, place: tirur, priority: 2}
- {id: duk,               name: Digital University Kerala,          url: https://duk.ac.in,                   tier: university, kind: university, department: eit, scope: state, district: thiruvananthapuram, place: thiruvananthapuram, priority: 2}
- {id: nuals,             name: NUALS,                              url: https://nuals.ac.in,                 tier: university, kind: university, department: law, scope: state, district: ernakulam, place: kochi, priority: 2}
- {id: sgou,              name: Sreenarayanaguru Open University,   url: https://sgou.ac.in,                  tier: university, kind: university, department: hedu, scope: state, district: kollam, place: kollam, priority: 2}

# registry/sites/districts.yaml   (14 collectorate portals; S3WaaS on nic.in)
- {id: d-thiruvananthapuram, name: District Administration Thiruvananthapuram, url: https://thiruvananthapuram.nic.in, tier: district, kind: district_admin, department: revenue, scope: district, district: thiruvananthapuram, place: thiruvananthapuram, platform: s3waas, priority: 3}
- {id: d-kollam,          name: District Administration Kollam,          url: https://kollam.nic.in,          tier: district, kind: district_admin, department: revenue, scope: district, district: kollam,          place: kollam,          platform: s3waas, priority: 3}
- {id: d-pathanamthitta, name: District Administration Pathanamthitta,  url: https://pathanamthitta.nic.in,  tier: district, kind: district_admin, department: revenue, scope: district, district: pathanamthitta, place: pathanamthitta, platform: s3waas, priority: 3}
- {id: d-alappuzha,       name: District Administration Alappuzha,       url: https://alappuzha.nic.in,       tier: district, kind: district_admin, department: revenue, scope: district, district: alappuzha,       place: alappuzha,       platform: s3waas, priority: 3}
- {id: d-kottayam,        name: District Administration Kottayam,        url: https://kottayam.nic.in,        tier: district, kind: district_admin, department: revenue, scope: district, district: kottayam,        place: kottayam,        platform: s3waas, priority: 3}
- {id: d-idukki,          name: District Administration Idukki,          url: https://idukki.nic.in,          tier: district, kind: district_admin, department: revenue, scope: district, district: idukki,          place: painavu,         platform: s3waas, priority: 3}
- {id: d-ernakulam,       name: District Administration Ernakulam,       url: https://ernakulam.nic.in,       tier: district, kind: district_admin, department: revenue, scope: district, district: ernakulam,       place: kochi,           platform: s3waas, priority: 3}
- {id: d-thrissur,        name: District Administration Thrissur,        url: https://thrissur.nic.in,        tier: district, kind: district_admin, department: revenue, scope: district, district: thrissur,        place: thrissur,        platform: s3waas, priority: 3}
- {id: d-palakkad,        name: District Administration Palakkad,        url: https://palakkad.nic.in,        tier: district, kind: district_admin, department: revenue, scope: district, district: palakkad,        place: palakkad,        platform: s3waas, priority: 3}
- {id: d-malappuram,      name: District Administration Malappuram,      url: https://malappuram.nic.in,      tier: district, kind: district_admin, department: revenue, scope: district, district: malappuram,      place: malappuram,      platform: s3waas, priority: 3}
- {id: d-kozhikode,       name: District Administration Kozhikode,       url: https://kozhikode.nic.in,       tier: district, kind: district_admin, department: revenue, scope: district, district: kozhikode,       place: kozhikode,       platform: s3waas, priority: 3}
- {id: d-wayanad,         name: District Administration Wayanad,         url: https://wayanad.nic.in,         tier: district, kind: district_admin, department: revenue, scope: district, district: wayanad,         place: kalpetta,        platform: s3waas, priority: 3}
- {id: d-kannur,          name: District Administration Kannur,          url: https://kannur.nic.in,          tier: district, kind: district_admin, department: revenue, scope: district, district: kannur,          place: kannur,          platform: s3waas, priority: 3}
- {id: d-kasaragod,       name: District Administration Kasaragod,       url: https://kasargod.nic.in,        tier: district, kind: district_admin, department: revenue, scope: district, district: kasaragod,       place: kasaragod,       platform: s3waas, priority: 3}
```

LSGI entries (1,200) are generated by the Phase 1 harvest script from lsgkerala.gov.in, not typed by hand.

## Appendix B — GIGW 3.0 mandatory elements → checks

| GIGW 3.0 requirement | Check(s) |
|---|---|
| Ownership & identity clearly stated | gigw.ownership, gigw.emblem |
| Contact, Feedback, Help | gigw.contact, gigw.feedback, gigw.help |
| Sitemap, Search | gigw.sitemap, gigw.search, id.sitemap_xml |
| Website policies: Privacy, Terms, Copyright, Hyperlinking, Disclaimer | gigw.privacy, gigw.terms, gigw.copyright_policy, gigw.hyperlink_policy, gigw.disclaimer |
| Accessibility statement, screen‑reader access, WCAG 2.x AA | gigw.accessibility_statement, gigw.screen_reader, a11y.* |
| Last updated / content review | gigw.last_updated, content.last_updated, content.stale_news |
| Bilingual / regional language | content.malayalam, a11y.lang |
| Security (HTTPS, hosting) | sec.* |
| Mobile responsiveness | perf.viewport, perf.tap_targets |
| RTI Act s.4 proactive disclosure | gigw.rti |

## Appendix C — Secretariat departments (`registry/departments.yaml` ids)

agri · ahd · ayush · bcdd · coop · csin · culture · devaswom · eit · env · fin · fish · fcs · forest · gad · gedu · health · hedu · home · housing · ind · prd · labour · law · lsgd · minority · norka · parl · pard · plan · power · pwd · regn · revenue · scst · st · sjd · sports · stores · taxes · tourism · transport · vigilance · wrd · wcd

(Agriculture Development & Farmers' Welfare; Animal Husbandry & Dairy Development; AYUSH; Backward Classes Development; Co‑operation; Coastal Shipping & Inland Navigation; Cultural Affairs; Devaswom; Electronics & IT; Environment; Finance; Fisheries & Ports; Food, Civil Supplies & Consumer Affairs; Forest & Wildlife; General Administration; General Education; Health & Family Welfare; Higher Education; Home; Housing; Industries & Commerce; Information & Public Relations; Labour & Skills; Law; Local Self Government; Minority Welfare; Non‑Resident Keralites' Affairs; Parliamentary Affairs; Personnel & Administrative Reforms; Planning & Economic Affairs; Power; Public Works; Registration; Revenue & Disaster Management; SC/ST Development; Science & Technology; Social Justice; Sports & Youth Affairs; Stores Purchase; Taxes; Tourism; Transport; Vigilance; Water Resources; Women & Child Development.) Verify against the current kerala.gov.in departments list in Phase 1.
