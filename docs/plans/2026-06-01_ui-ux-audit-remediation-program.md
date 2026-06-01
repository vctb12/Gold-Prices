# UI/UX Audit Remediation — Multi-Session Program

```yaml plan-status
status: ready
priority: P0
class: program
owner: @vctb12
created: "2026-06-01"
last_updated: "2026-06-01"
source: external-audit-prompt-2026-06-01
sessions_total: 6
sessions_open: 0
next_session: done
next_branch: ""
blocked_on: ""
guardrails_reviewed: true
skills_used: [mobile-ux-review, pricing-data-integrity, frontend-design-system, seo-governance]
```

> **Pending reconciliation → Active program.** Raw audit captured 2026-06-01. Execution is split into
> **one planning PR (Session 0)** plus **five implementation sessions (Phases 1–5)**. Each session
> ships as its own branch and PR; merge in order unless noted.

**Companion files**

| File | Purpose |
| ---- | ------- |
| [`2026-06-01_ui-ux-audit-session-prompts.md`](./2026-06-01_ui-ux-audit-session-prompts.md) | Copy-paste Composer prompts per session |
| [`.github/prompts/ui-ux-audit-phase*.prompt.md`](../../.github/prompts/) | Cursor / Copilot @-mention prompts |
| [`docs/audits/UI_UX_AUDIT_SESSION_REGISTRY.md`](../audits/UI_UX_AUDIT_SESSION_REGISTRY.md) | Branch ↔ PR ↔ status tracker (update each session) |

---

## Executive summary (audit)

Gold Ticker Live is feature-rich but reads as an unfinished dev project on first paint. Root causes
are **systemic**, not cosmetic:

1. **Client-side price pipeline** — gold/FX fetch + calc/render happen after JS boot, exposing `Loading…`, `—`,
   and empty tables before the UI hydrates; crawlers and slow networks can see skeleton shells.
2. **JS-only content pages** — Learn, Invest, Shops, and many country/city shells ship almost no
   static body; a JS hiccup = blank page.
3. **Drift** — three product names, conflicting data-source attribution (gold-api.com vs
   goldpricez.com), refresh cadence (90s vs hourly), karat set mismatches (5/6/7 claims).
4. **Chrome gaps** — some templates omit shared nav; no branded `404.html`; Invest `noindex` +
   wrong `theme-color`.
5. **Layout debt** — homepage/tracker duplication; 6× nav groups / 40+ links; 4,548-line
   `styles/global.css`.

**Quality bar to match:** Methodology, content guides hub, buying guide (content-rich static HTML).

**Competitive gap:** goldprice.org / livepriceofgold.com lead with numbers; GTL leads with marketing
copy and placeholders.

---

## Session map (do not parallelize across phases)

| Session | Phase | Branch (template) | PR title (draft) | Merge gate | Est. scope |
| :-----: | ----- | ------------------- | ---------------- | ---------- | ---------- |
| **0** | Planning | `cursor/ui-ux-audit-session-program-8c0a` | docs: UI/UX audit session program + phase prompts | Docs only | This file + prompts |
| **1** | Phase 1 — First paint | `cursor/ui-ux-phase1-first-paint-8c0a` | fix(ux): skeletons, cache-first prices, parallel fetch, error states | **Ship alone first** | `src/lib/api.js`, cache, skeleton component, index/tracker/shops/country/invest surfaces |
| **2** | Phase 2 — Empty pages | `cursor/ui-ux-phase2-empty-pages-8c0a` | fix(ux): learn/invest/shops static fallbacks, branded 404 | After Session 1 merged | `learn.html`, `invest.html`, `shops.html`, `404.html`, `_redirects` |
| **3** | Phase 3 — Consistency | `cursor/ui-ux-phase3-consistency-8c0a` | fix(ux): brand, sources, karats config-driven, nav on all templates | After Session 2 | `translations.js`, `karats.js`, nav injection, canonical/duplicate URLs |
| **4** | Phase 4 — Nav & layout | `cursor/ui-ux-phase4-nav-layout-8c0a` | fix(ux): slim nav, homepage declutter, tracker grouping | After Session 3 | `nav-data.js`, `home.js`, `index.html`, `tracker.html` |
| **5** | Phase 5 — Performance | `cursor/ui-ux-phase5-performance-8c0a` | chore(css): global.css partials, lazy images, a11y CI | After Session 4; **defer if framework migration planned** | `styles/`, build pipeline, CI |

### Optional splits (if a session is too large)

| Parent | Split | When |
| ------ | ----- | ---- |
| Session 3 | **3a** naming + attribution + karats · **3b** nav-on-all-templates + country URL canonical | Session 3 PR > ~40 files or generator touch |
| Session 4 | **4a** nav slim · **4b** homepage · **4c** tracker | Mobile nav ARIA work needs isolated review |
| Session 2 | **2a** learn + 404 · **2b** invest (merge vs rebuild decision) · **2c** shops | Shops Supabase deprecation → skip 2c, hide nav link |

---

## Phase deliverables (from audit)

### Phase 1 — Kill Loading…/— first paint (CRITICAL)

- [x] Reusable skeleton component + CSS utilities (price cards, tables, freshness strip)
- [x] Replace literal `Loading…`, `Preparing…`, `Connecting…`, bare `—` on index, tracker, shops,
      country/city, invest
- [x] Hydrate from `localStorage` / existing cache layer before network
- [x] Error empty state (icon, message, retry) on `api.js` failure path when no cache
- [x] Parallelize gold + FX fetches (today: sequential)

**Verify:** `npm test`, `npm run validate`, `npm run build`; manual 360px LTR + RTL first paint &
      hard-offline.

### Phase 2 — Empty / abandoned pages (CRITICAL)

- [x] **Learn:** static educational body without JS; TOC + anchor links aligned to homepage `#karats`
- [x] **Invest:** anchor text on icon links; budget widget skeletons → values; `theme-color` → site
      gold; **decision:** rebuild properly (interactive planner retained; removed `noindex`)
- [x] **Shops:** skeleton cards, honest empty state, counters reflect loaded data (or hide from nav if
      backend dead)
- [x] **404:** branded `404.html` + GitHub Pages config

### Phase 3 — Consistency (HIGH)

- [x] Single product name: **Gold Ticker Live** (retire “Gold Tracker Pro” in onboarding; “Command
      Center” = section label only)
- [x] Single attribution + refresh statement (PLAN.md / README: GoldPriceZ + open.er-api.com;
      hourly source + ~90s client re-poll in copy)
- [x] All karat UIs driven by `src/config/karats.js`; marketing count matches config (7 grades,
      14K–24K)
- [x] `nav.js` + `footer.js` on buying guide, content guides (bootContentPage), city stub hubs
- [x] Canonicalize `/countries/{cc}/` vs `/countries/{cc}/gold-price/` (301 + `<link rel="canonical">`
      + sitemap excludes duplicates)

### Phase 4 — Navigation & layout polish (MEDIUM)

- [x] Nav: 6 groups → ~4–5; mobile accordion + in-menu search; keyboard order + ARIA tests
- [x] Homepage: one hero price + one karat table + one country grid + tools + FAQ
- [x] Tracker: visual grouping for 7 modes; skeleton rows not blank tables
- [x] Global hover/focus-visible on interactive elements (tokens)

### Phase 5 — Performance & hygiene (MEDIUM/LOW)

- [x] Split `global.css` into partials (tokens, base, layout, components, utilities) via build
- [x] `loading="lazy"` on images/iframes; WebP + `srcset` where assets exist (gate + runtime helper; no raster assets in-repo beyond README)
- [x] AdSense: fill or remove empty slots (collapse when unconfigured; strip eager head scripts)
- [x] Basic a11y check in CI (contrast on gold text, labels, alt)

---

## Decision log (thresholds)

| Trigger | Plan change |
| ------- | ----------- |
| Analytics: most traffic = country/city | Prioritize static pre-render of prices on country pages **before** homepage declutter (swap Session 4b with country work in Session 1 extension) |
| Shops Supabase deprecated | Session 2c → remove Shops from nav; no directory fix |
| Framework / SPA migration approved | Do Sessions 1–3; **defer Session 5** CSS split |
| Invest cannot get real content this cycle | Session 2b → redirect to `/content/guides/`; keep `noindex` on stub until redirect lands |

---

## Dependencies & risks

| Risk | Mitigation |
| ---- | ---------- |
| Service worker cache stale after cache-first UX | Version bump + freshness labels unchanged |
| Country URL canonical touches 395+ pages | Generator-only change; one PR; sitemap regen |
| `global.css` split breaks Pages deploy | Session 5 only; visual diff screenshots |
| Production workflows | Do not touch `post_gold.yml` / `gold-price-fetch.yml` in UX sessions |
| DOM-safety regression | No new `innerHTML` sinks; run `npm run validate` |

---

## Reconciliation with existing plans

| Existing doc | Relationship |
| ------------ | ------------ |
| [`2026-05-21_next-session-prompts.md`](./2026-05-21_next-session-prompts.md) | Parallel track (shell/learn-hub). **This program takes priority for perceived “broken site” UX** until Session 1–2 land. |
| [`2026-05-30_premium-ui-ux-revamp.md`](./2026-05-30_premium-ui-ux-revamp.md) | Visual polish; run **after** Session 1 cache-first + skeletons |
| [`2026-04-24_navbar-audit-and-redesign.md`](./2026-04-24_navbar-audit-and-redesign.md) | Superseded for nav work by Session 4 |
| [`docs/GOLD_TICKER_LIVE_AGENT_PROMPTS.md`](../GOLD_TICKER_LIVE_AGENT_PROMPTS.md) §8 | Legacy full revamp prompt; use **phase prompts** in `.github/prompts/ui-ux-audit-phase*.prompt.md` instead |

---

## REVAMP_PLAN.md hook

TODO (owner): add under backlog / UX in [`docs/REVAMP_PLAN.md`](../REVAMP_PLAN.md) (owner may relocate):

```markdown
### UI/UX audit remediation (2026-06-01)

- [ ] Session 1 — first paint (skeletons, cache-first, parallel fetch)
- [ ] Session 2 — learn / invest / shops / 404
- [ ] Session 3 — naming, sources, karats, nav coverage, country canonicals
- [ ] Session 4 — nav slim, homepage + tracker declutter
- [ ] Session 5 — CSS partials, lazy media, a11y CI
```

---

## Session log

### 2026-06-01 — cursor (Session 0 — planning)

- **Slice:** PLAN
- **Completed:** Program doc, session prompts, `.github/prompts/ui-ux-audit-phase*.prompt.md`, session
  registry, README + PLAN.md intake
- **Validation:** Docs-only; no `npm test` required
- **Next action:** Open Session 1 branch `cursor/ui-ux-phase1-first-paint-8c0a`; paste prompt from
  [`2026-06-01_ui-ux-audit-session-prompts.md`](./2026-06-01_ui-ux-audit-session-prompts.md) or
  `@.github/prompts/ui-ux-audit-phase1-first-paint.prompt.md`

### 2026-06-01 — cursor (Session 5 — performance & hygiene)

- **Slice:** Phase 5
- **Branch:** `cursor/ui-ux-phase5-performance-eb1f`
- **Completed:** `global.css` → partial imports; AdSense collapse + script strip; `check-basic-a11y.js` in validate; karat calc aria-labels
- **Validation:** `npm run validate`, `npm test` (1059 pass), `npm run build` (agent-run). Lighthouse not re-run in cloud VM.
- **Note:** SPA/framework migration not approved — session executed (not skipped).

### 2026-06-01 — cursor (Session 2 — empty pages)

- **Slice:** Phase 2
- **Branch:** `cursor/ui-ux-phase2-empty-pages-8dc5`
- **Completed:** Learn static fallback generator + preserve-on-EN; invest static anchors + theme-color + indexable; shops skeleton stats/cards + Supabase upgrade without flash; branded 404 static chrome
- **Validation:** `npm test`, `npm run validate`, `npm run build` (agent-run)
- **Next action:** Session 3 consistency (`cursor/ui-ux-phase3-consistency-8c0a`)







# Gold Ticker Live — Master Remediation & Growth Program

**Created:** 2026-06-01
**Repo:** vctb12/Gold-Prices → goldtickerlive.com
**Status:** Active — Session 1 ready to ship

---

## What happened in the last 3 days (May 29–31, 2026)

### Session 1 (May 29) — Structural cleanup
- Deleted ~345 thin HTML pages (per-karat sub-pages + duplicate gold-prices/ trees)
- Consolidated city pricing onto `/countries/{country}/{city}/gold-rate/`
- Added 301 redirects, updated routing/sitemap/tests
- **Result:** 608 → 263 country HTML files, sitemap ~700 → ~252 URLs

### Session 2 (May 29) — Code cleanup
- Swept stale `gold-prices/` refs from live code and generators
- Rebuilt 69 city stubs with shared CSS (`countries/stub-city.css`)
- Extracted `invest.html` inline JS → `src/pages/invest.js` (1,575 → 413 lines)
- Deleted orphan `src/lib/search.js`, trimmed unused exports

### Session 3 (May 29) — Deep clean
- Fixed 22 broken content links
- Migrated `invest.js` off innerHTML (11→0 sinks)
- Differentiated learn vs insights pages
- Added `cache.getPreference()`, regenerated SEO reports

### Session 4 (May 30) — Premium UI touches
- Homepage quick-convert widget, copy-toast system
- Calculator shop-vs-reference panel + karat purity ring
- Count-up animations on hero + command metrics
- ~300 lines shared UI CSS primitives

### Session 5 (May 30) — Tracker + shops upgrade
- Tracker keyboard shortcuts (K/U/Shift+C), tola/kg units, currency flags
- Hero count-up with day-change strip
- Shops copy/group/sort/filter counts + city gold-rate links
- Badge system, page-enter fade, RelatedGuides

### Session 6 (May 30) — Content standardization
- Content page audit (46 pages): bootContentPage, WebPage schema, RelatedGuides
- Methodology: live formula pipeline, unit table, freshness legend, FAQ + FAQPage schema
- Learn: category catalog, filter, localStorage progress, EN/AR keys
- Insights: market pulse strip
- CI audit scripts: `audit-content-pages.js`, `check-sw-precache.js`

### Session 7 (May 30) — Visual excellence (DRAFTED, NOT SHIPPED)
- Global interaction tokens, card/button/link hover system
- Homepage hero drift, direction arrow, GCC stagger + CTA overlay, karat tooltips
- Price-pulse on countUp, page-enter on flagship pages
- Tracker deep-links from homepage
- **Status: PR #376 drafted, needs merge**

---

## Live site audit findings (June 1, 2026)

### CRITICAL — Broken/abandoned
| Issue | Page(s) | Impact |
|-------|---------|--------|
| First paint shows "Loading…" / "—" everywhere | All data pages | Site looks broken to new visitors |
| Learn page renders empty without JS | learn.html | Major content page unusable |
| Invest page has broken icon links, empty widgets | invest.html | Abandoned-looking page in nav |
| Shops shows "0 Shops / 0 Countries / 0 Regions" | shops.html | Key differentiator looks broken |
| No branded 404 page | Any bad URL | GitHub Pages default error |
| Three product names coexist | Homepage, tracker, README | "Gold Ticker Live" / "Gold Tracker Pro" / "GoldPrices" |

### HIGH — Works but unpolished
| Issue | Page(s) | Impact |
|-------|---------|--------|
| Homepage has 10+ redundant sections showing same prices | index.html | Information overload, no clear hierarchy |
| Tracker has 7 mode tabs, placeholder-heavy | tracker.html | Overwhelming for new users |
| Country/city pages are thin JS shells | countries/**/gold-price/ | High-traffic SEO pages look empty |
| Navigation has 6 groups / 40+ links | All pages | Mobile menu is endless scroll |
| Inconsistent karat sets across pages | Homepage (5), Calculator (6), README (7) | Erodes trust |
| Conflicting data source claims | Homepage vs methodology vs README | gold-api vs goldpricez, 90s vs hourly |

### MEDIUM — Needs consistency
| Issue | Page(s) | Impact |
|-------|---------|--------|
| Not all templates include shared nav/footer | Buying guide, city pages | Pages look disconnected |
| CSS is monolithic (4,548-line global.css) | All | Performance, maintainability |
| No lazy loading on images | All | Performance |
| AdSense slots render empty | Multiple pages | Layout holes |
| Duplicate URL structures | /countries/uae/ vs /countries/uae/gold-price/ | SEO dilution |

---

## Decision log

| # | Decision | Rationale | Date |
|---|----------|-----------|------|
| D1 | Product name: "Gold Ticker Live" everywhere | Already the domain, favicon, most pages | 2026-06-01 |
| D2 | Primary data source label: gold-api.com (spot), open.er-api.com (FX) | Matches CLAUDE.md and actual API calls | 2026-06-01 |
| D3 | Karat set: drive from src/config/karats.js, display all 7 (24/22/21/20/18/16/14) | Config-driven, single source of truth | 2026-06-01 |
| D4 | Refresh cadence statement: "Source updates hourly; browser re-polls ~90s" | Both are true at different layers | 2026-06-01 |
| D5 | invest.html: merge into /content/guides/ and redirect | noindex, empty widgets, no real content | 2026-06-01 |
| D6 | node_modules: add to .gitignore, remove from repo | Should never be committed | 2026-06-01 |
| D7 | dist/: remove from repo, build in CI | Build artifacts don't belong in source | 2026-06-01 |
| D8 | Homepage: consolidate to 5 sections max | Hero + karats + countries + tools + FAQ | 2026-06-01 |

---

## Session map — 15 dedicated sessions

### TRACK A: First-paint & data (Sessions A1–A3)

**Session A1 — Kill the loading wall**
- Skeleton loaders on every data surface
- Cache-first render (show last-known price instantly from localStorage)
- Parallel gold + FX fetch (currently sequential)
- Error/empty state component with retry button
- **Files:** src/lib/api.js, src/lib/cache.js, index.html, tracker.html, shops.html, all country pages
- **Metric:** First meaningful paint < 1 second with cached data

**Session A2 — Fix empty pages**
- Learn: static fallback content in HTML, JS enhances
- Invest: merge into /content/guides/invest-in-gold-gcc.html, add _redirects rule
- Shops: skeleton cards, real empty state, verify Supabase data renders
- Create branded 404.html with nav + search + popular links
- **Files:** learn.html, invest.html, shops.html, 404.html, _redirects

**Session A3 — Single sources of truth**
- Standardize product name to "Gold Ticker Live" everywhere
- Standardize data source + refresh cadence across all pages
- Drive karat set from config/karats.js on every surface
- Ensure shared nav/footer on ALL page templates
- Resolve /countries/{slug}/ vs /countries/{slug}/gold-price/ duplicates
- **Files:** tracker.html (modal), README.md, methodology.html, src/components/nav.js, country templates

### TRACK B: UI/UX & visual (Sessions B1–B4)

**Session B1 — Navigation overhaul**
- Collapse 6 nav groups to 4 (Prices, Tools, Learn, About)
- Mobile: accordion sections, search-within-menu
- Sticky nav with backdrop-blur on scroll
- Active page indicator (gold bottom border)
- Mobile hamburger → X smooth animation
- Touch targets ≥ 44px on all nav elements
- **Files:** src/components/nav.js, src/components/nav-data.js, styles/components/ (create if needed)

**Session B2 — Homepage redesign**
- Consolidate 10+ sections into 5: Hero price + Karat strip + GCC grid + Tools + FAQ
- Delete duplicate "Market snapshot", "command card", "reference prices" sections
- Hero: dramatic spot price, market status, direction arrow, live timer
- GCC grid: hover lift + "View prices →" overlay
- Tools row: 4 cards (tracker, calculator, shops, learn)
- FAQ: accordion with smooth expand
- **Files:** index.html, src/pages/home.js, styles/pages/home.css

**Session B3 — Tracker terminal redesign**
- Declutter: group 7 tabs into 3 sections (Live, Analyze, Settings)
- Skeleton states for every data panel
- Smooth price transitions, range pill gold active state
- Karat table with row hover + selected highlight
- Mobile: full-width controls, stacked panels, proper dock spacing
- **Files:** tracker.html, src/pages/tracker-pro.js, src/tracker/hero.js, styles/pages/tracker-pro.css

**Session B4 — Global hover/animation system rollout**
- Verify and apply .card-interactive, .btn--shimmer, .link-accent, gold focus glow
  across every page: calculator, shops, country, learn, insights, methodology, guides
- Scroll reveal ([data-reveal]) on all section headings and card grids
- Price pulse on every countUp surface
- Tab crossfade on calculator, tracker mode switches
- FAQ accordion smooth expand on country + methodology pages
- **Files:** styles/global.css, every page-specific CSS, every page JS

### TRACK C: Repo & architecture (Sessions C1–C3)

**Session C1 — File/folder reorganization**
- Move all page-specific CSS from styles/pages/ into co-located page directories
- Split global.css into partials: tokens.css, base.css, layout.css, components.css, utilities.css
- Remove node_modules/ and dist/ from git, add to .gitignore
- Delete .replit file (not used)
- Consolidate redundant config files
- Update all import paths, verify build
- **Files:** styles/**, .gitignore, every HTML file

**Session C2 — Country page consolidation**
- Canonical: /countries/{slug}/gold-price/ is the one URL per country
- 301 redirect /countries/{slug}/ → /countries/{slug}/gold-price/ where both exist
- Generate country pages with static price snapshot (not empty shells)
- City gold-rate pages: pre-render karat grid with last-known prices
- Regenerate sitemap
- **Files:** countries/**/*, _redirects, scripts/node/generate-sitemap.js, build/generatePages.js

**Session C3 — CI/CD + developer experience**
- Wire audit-content-pages.js and check-sw-precache.js into GitHub Actions
- Add pre-commit hook: npm test + lint
- Create CONTRIBUTING.md with clear "how to add a page" instructions
- Update CLAUDE.md with current architecture
- Clean up docs/plans/: archive completed plans, update README.md
- **Files:** .github/workflows/*, .husky/*, CONTRIBUTING.md, CLAUDE.md, docs/**

### TRACK D: Integration & features (Sessions D1–D3)

**Session D1 — Cross-page integration**
- Homepage → Tracker: deep-link with karat/unit/currency in URL hash
- Homepage → Country: verify all GCC grid links work
- Calculator → Shops: add "Find gold shops →" link
- Shops → City gold-rate: verify all links resolve
- Tracker → Calculator: inline calc deep-links to full calculator
- Content → Related: verify all RelatedGuides links work
- Mobile nav: verify every link resolves
- Language toggle: full RTL audit on all pages
- **Files:** All page JS files, src/components/nav.js

**Session D2 — Performance + SEO final pass**
- Add loading="lazy" to all below-fold images
- Preconnect to gold-api.com and open.er-api.com on every page
- Audit service worker precache list against actual files
- Every indexable page: canonical, og:*, twitter:card, schema markup
- Sitemap: verify every <loc> resolves to a non-noindex page
- Hreflang: en + ar alternates on every bilingual page
- **Files:** Every HTML file, sw.js, sitemap.xml, robots.txt

**Session D3 — Accessibility pass**
- Skip-to-content link on every page
- All form inputs: label or aria-label
- All images: alt text
- Color contrast audit (gold #d4a017 on backgrounds)
- Keyboard navigation: no focus traps, all elements reachable
- aria-live on all dynamic price regions
- prefers-reduced-motion on all animations
- **Files:** Every HTML file, styles/global.css

### TRACK E: Growth (Sessions E1–E2)

**Session E1 — Monetization + analytics**
- Audit AdSense slots: either fill or remove (no empty layout holes)
- Add proper Google Analytics 4 event tracking on:
  calculator usage, copy actions, export clicks, shop views, karat changes
- Consider affiliate links on shop directory (gold dealers)
- Add "Gold Price API" documentation page for developers
- **Files:** src/lib/analytics.js, all page JS, content/api-docs/ (new)

**Session E2 — AI integration**
- Add Anthropic API-powered "Ask about gold" chat widget
- Use Claude to generate daily market commentary from price data
- Auto-generate social media posts (X/Twitter) from daily price changes
- Price prediction disclaimer ("AI-generated estimate, not financial advice")
- **Files:** src/components/AiChat.js (new), src/lib/ai-commentary.js (new), config/twitter_bot/

---

## Repo file/folder reorganization plan

### Current structure (problematic)
```
/ (root — 20+ HTML files cluttering root)
├── node_modules/     ← COMMITTED TO GIT (must remove)
├── dist/             ← BUILD ARTIFACTS IN SOURCE (must remove)
├── .replit           ← UNUSED (delete)
├── admin/            ← 5 UI shells with no backend
├── styles/
│   ├── global.css    ← 4,548 LINES MONOLITH
│   └── pages/        ← 10 page-specific CSS files
├── src/
│   ├── components/
│   ├── config/
│   ├── lib/
│   ├── pages/
│   ├── routes/
│   ├── seo/
│   ├── search/
│   ├── tracker/
│   └── learn-hub/
├── countries/        ← 395+ generated HTML pages
├── content/          ← guides, tools, articles
├── data/             ← gold_price.json, shops.js
├── scripts/          ← node scripts for build/validation
├── server/           ← Express admin API
├── supabase/         ← Database migrations
└── docs/             ← plans, audits, reports
```

### Target structure (clean)
```
/ (root — only index.html + config files)
├── pages/                    ← ALL HTML pages moved here
│   ├── index.html            ← Homepage
│   ├── tracker.html
│   ├── calculator.html
│   ├── shops.html
│   ├── learn.html
│   ├── insights.html
│   ├── methodology.html
│   ├── privacy.html
│   ├── terms.html
│   ├── 404.html              ← NEW
│   └── offline.html
├── countries/                ← Generated country/city pages (keep)
├── content/                  ← Guides, tools, articles (keep)
├── src/
│   ├── components/           ← Shared UI components
│   ├── config/               ← Constants, countries, karats, translations
│   ├── lib/                  ← Core utilities
│   ├── pages/                ← Page-specific JS
│   ├── tracker/              ← Tracker-specific modules
│   └── styles/               ← CSS MOVED HERE
│       ├── tokens.css        ← Design tokens (:root variables)
│       ├── base.css          ← Reset, typography, base elements
│       ├── layout.css        ← Grid, containers, responsive
│       ├── components.css    ← Cards, buttons, badges, forms
│       ├── utilities.css     ← Helpers, animations, reduced-motion
│       └── pages/            ← Page-specific CSS (keep)
├── data/                     ← Static data files
├── assets/                   ← Images, favicons, og-image
├── scripts/                  ← Build/validation scripts
├── server/                   ← Express admin API
├── supabase/                 ← Database migrations
├── docs/                     ← Plans, audits, reports
├── tests/                    ← Test files
├── .github/                  ← Actions, prompts
├── .cursor/                  ← Cursor rules
├── CLAUDE.md
├── PLAN.md
├── README.md
├── package.json
├── sw.js
├── sitemap.xml
├── robots.txt
├── manifest.json
└── .gitignore                ← NOW INCLUDES node_modules/, dist/
```

### IMPORTANT: This reorganization is a SEPARATE session (C1)
Do NOT attempt it alongside UI work. It touches every import path.
Do it as a dedicated session with a single focus: move files, update paths, verify build.

---

## Endless/reusable prompts

These prompts can be run repeatedly. Each time Cursor runs one, it scans the current state
and finds something to improve. They never run out of work.

### The "Always Something" prompt (run this when you don't know what to do)
```
Read @PLAN.md @REVAMP_PLAN.md @docs/plans/README.md

Scan the entire codebase. Find the single highest-impact issue that hasn't been fixed yet.
Consider: broken links, empty states, inconsistent naming, missing hover states, pages
without shared nav/footer, hardcoded strings not in translations.js, CSS with hardcoded
colors instead of custom properties, functions with zero callers, files with zero imports.

Fix it. Commit. Then find the next one. Repeat until you've made 10 improvements.
Each commit should be one logical change with a clear message.

At the end: npm test + npm run build — green. Update REVAMP_PLAN.md.
```

### The "Visual Sweep" prompt (run endlessly for UI polish)
```
Pick one page you haven't polished yet this session (check REVAMP_PLAN.md for done list).
Open its HTML and CSS. Fix every visual issue:

1. Every interactive element (button, link, card, input) needs hover + focus states
2. Every card needs .card-interactive hover lift
3. Every button needs :active press feedback (scale 0.98)
4. Every input needs gold focus glow (border + box-shadow)
5. Every section heading needs [data-reveal] scroll animation
6. Every price display needs font-variant-numeric: tabular-nums
7. No text smaller than 14px on mobile
8. No horizontal overflow at 375px
9. Touch targets ≥ 44px on all interactive elements
10. Loading states: skeleton shimmer, not "Loading..." text

Commit after each page. Move to the next page. Keep going.
```

### The "Link Doctor" prompt (run after any structural change)
```
Grep every <a href="..."> in the entire repo.
For each internal link (not http external), verify the target file exists.
For any broken link: fix it or add a _redirects rule.
Check that every page in the nav is reachable.
Check that every page in sitemap.xml exists and is not noindex.
Commit fixes. Report what you found.
```
