# Gold Ticker Live — Active Task Plan

> This file is the persistent task tracker for AI agents and human contributors. Agents: read this
> before starting any task. Update it after completing work. Last updated: 2026-06-01

---

## 🔴 In Progress

### UI/UX audit remediation (2026-06-01 program)

> Master doc:
> [`docs/plans/2026-06-01_ui-ux-audit-remediation-program.md`](docs/plans/2026-06-01_ui-ux-audit-remediation-program.md)
> · Prompts:
> [`docs/plans/2026-06-01_ui-ux-audit-session-prompts.md`](docs/plans/2026-06-01_ui-ux-audit-session-prompts.md)
> · Registry:
> [`docs/audits/UI_UX_AUDIT_SESSION_REGISTRY.md`](docs/audits/UI_UX_AUDIT_SESSION_REGISTRY.md)

- [x] **Session 0** — planning docs + phase prompts (branch `cursor/ui-ux-audit-session-program-8c0a`)
- [ ] **Session 1** — first paint: skeletons, cache-first prices, parallel fetch, error states
      (`cursor/ui-ux-phase1-first-paint-8c0a`) — **ship first**
- [ ] **Session 2** — learn / invest / shops / 404 (`cursor/ui-ux-phase2-empty-pages-8c0a`)
- [x] **Session 3** — naming, sources, karats, nav on all templates, country canonicals
      (`cursor/ui-ux-phase3-consistency-86ca`)
- [ ] **Session 4** — nav slim, homepage + tracker declutter
- [ ] **Session 5** — CSS partials, lazy media, a11y CI (skip if SPA migration)

---

## 🟡 Up Next

- [ ] Replace hardcoded hex colors in CSS with design tokens (565 instances across styles/) —
      priority: medium — context: improves maintainability and dark mode consistency
- [ ] Add visibilitychange cleanup to insights.js sparkline/charts if added — priority: low —
      context: prevent stale chart renders
- [ ] Migrate `window.confirm()` in developer.js to a custom modal — priority: low — context: 2
      confirm dialogs for destructive key actions

---

## ✅ Recently Completed

- [x] BUILD 8: Insights Market Analysis Feed — rebuilt the insights guide grid into a filterable,
      searchable CSS-masonry feed (category strip with counts, debounced search, read-time,
      bilingual cards, dynamic live "price context" card at position 3) backed by pure
      `src/pages/insights/insights-data.js` + renderer `src/pages/insights/insights-feed.js` and 10
      tests (`tests/insights-data.test.js`) — completed: 2026-05-31 — PR: (draft)
- [x] BUILD 6: Compare Countries — standalone interactive `compare.html` (sortable table, karat
      tabs, country chips, side-by-side detail with per-karat bar chart, cheapest-to-buy callout,
      hash deep links) backed by pure `src/pages/compare/compare-core.js` + 13 tests — completed:
      2026-05-31 — PR: (draft)
- [x] BUILD 2: Country Pages Market Intelligence Panel — per-country
      VAT/making-charge/retail-estimate panel + "Should I Buy Today?" indicator on every country
      page (`src/config/market-intel.js`, `countries/country-page.js`, `styles/country-page.css`,
      `tests/market-intel.test.js`) — completed: 2026-05-31 — PR: (draft)
- [x] BUILD 10: Price Alert System — full feature build (alert engine, manager drawer, trigger
      dialog, sound, import/export, WhatsApp share, 18 tests) — completed: 2026-05-30 — PR: (draft)
- [x] Visual excellence session 7b (full-surface interaction rollout) — completed: 2026-05-30 — PR:
      (pending)
- [x] Audit session 8 — memory leak fixes, alert() removal, lint cleanup, SEO h1 — completed:
      2026-05-30 — PR: (draft open)
- [x] Visual excellence session 7 (global interactions + homepage polish) — completed: 2026-05-30 —
      PR: #376
- [x] Launch push session 6 (content standardization, learn/insights) — completed: 2026-05-30 — PR:
      #375

- [x] Deep clean session 3: broken links, invest safe-dom, learn/insights split, cache.getPreference
      — completed: 2026-05-29 — PR: (pending)
- [x] Autonomous cleanup: gold-prices ref sweep, city stub rebuild, invest.js extraction, dead-code
      trim — completed: 2026-05-29 — PR: #371
- [x] Country URL consolidation (~345 pages removed, gold-rate hubs) — completed: 2026-05-29 — PR:
      #370

<!-- Last 10 completed items — older ones get archived -->
<!-- Format: - [x] Task description — completed: YYYY-MM-DD — PR: #NNN -->

---

## 🚫 Blocked / On Hold

<!-- Tasks waiting on external input or decisions -->

---

## 📌 Permanent Context for Agents

- Production site: https://goldtickerlive.com/
- Repo: vctb12/GoldTickerLive
- X account: @GoldTickerLive (hourly posting — treat as production-critical)
- AED peg: 1 USD = 3.6725 AED (fixed — never change)
- Troy ounce: 31.1034768 grams (immutable)
- Primary data source: goldpricez.com API
- Test command: npm test (delete playwright-report/ first)
- Validate command: npm run validate
- PR workflow only — no direct commits to main
- Dry-run any X posting change before merging

## 📋 Audit Notes (2026-05-30)

### ✅ Clean

- No `console.log` debug statements in src/
- No `var` declarations — all code uses `const`/`let`
- All `.then()` chains have `.catch()` error handlers
- All pages have meta description, OG tags, skip links, lang attrs
- `font-display: swap` and `tabular-nums` properly applied
- home.js, tracker-pro.js, invest.js all properly clean up intervals

### ⚠️ Fixed This Session

- **Memory leaks**: insights.js and calculator.js setInterval calls now paused on visibilitychange /
  pagehide
- **alert() calls**: Replaced 4 browser alert() calls with showCopyToast() in developer.js,
  export.js, shops/actions.js
- **Lint warning**: Removed unused `copyWithToast` import in calculator.js
- **SEO**: Added static `<h1>` to learn.html (was previously JS-only rendered)

### ⚠️ Pre-existing (Not Fixed)

- 44 content pages missing webpage-schema (pre-existing test failures)
- 3 pre-existing test failures (provider-failover, cache-revalidation, audit-content-pages)
- 565 hardcoded hex colors in CSS (large effort — tracked in backlog)
- `window.confirm()` used in developer.js for destructive actions (acceptable UX)

## 🏆 Big Build Catalog Status

- [x] BUILD 1: Ticker Strip — done (existing `src/components/ticker.js` + `MarketSummaryTicker.js`)
- [x] BUILD 2: Country Pages — **done** (Market Intelligence Panel + buy indicator)
- [x] BUILD 3: Price Chart — done (existing `src/components/chart.js` with 24H–ALL ranges)
- [x] BUILD 4: Calculator Tabs — done (5 tabs: value, scrap, zakat, buying power, converter)
- [x] BUILD 5: PWA — done (sw.js, manifest.json, offline.html, install prompt)
- [x] BUILD 6: Compare Tool — **done** (standalone `compare.html` + `compare-core.js`)
- [ ] BUILD 7: Shops Directory — partial (list + filter, needs map, card redesign)
- [x] BUILD 8: Insights Feed — **done this session** (category filter + masonry + search + live
      context card)
- [ ] BUILD 9: Homepage Overhaul — partial (recent polish sessions improved it significantly)
- [x] BUILD 10: Alert System — **done** (engine + drawer + dialog + sound + tests)

## Notes for Next Agent

- BUILD 8 Insights Feed: `src/config/insights-articles.js` defines 15 bilingual articles across 6
  categories. `src/pages/insights.js` renders them as a masonry grid with category filtering,
  client-side search (200ms debounce), and a contextual price callout inserted at position 3. The
  callout updates on each 90s price tick via `refreshContextCallout()`.
- Feed cards use `data-reveal` for scroll-triggered entrance animations (shared IntersectionObserver
  from `src/lib/reveal.js`). The reveal module is lazy-loaded to avoid import-order issues.
- To add new articles: add entries to the `INSIGHTS_ARTICLES` array in
  `src/config/insights-articles.js`. Category must match a key in `INSIGHT_CATEGORIES`.
- BUILD 7 Map View: Leaflet loads lazily from CDN on first "Map" button click; pins use shop
  `lat`/`lng` from `data/shops.js`. Supabase-sourced shops may not have coordinates — map only shows
  shops where both lat/lng are present. `initShopsMap()` returns false if CDN fails → list view
  continues to work.
- BUILD 7 Compare: Max 3 shops. State is in-memory only (not persisted). Compare module is
  initialized in `init()` of `src/pages/shops.js`; the sticky bar renders in `#shops-compare-bar`
  (fixed bottom). CSS at `styles/components/shops-map.css`.
- Next recommended build: BUILD 8 (Insights Feed — category filter, masonry grid, client-side
  search) or BUILD 9 (Homepage Overhaul — hero redesign, sparkline strip, country grid).
- BUILD 8 Insights Feed: content model lives in `src/config/insights-data.js`
  (`INSIGHT_CATEGORIES` + `INSIGHTS`, each linking to an existing `content/guides/` page). Pure
  filter/search/read-time/price-context logic is in `src/lib/insights-feed-core.js` (18 tests in
  `tests/insights-feed-core.test.js`). Rendering is `src/components/insights-feed.js`
  (`mountInsightsFeed`), mounted from `src/pages/insights.js` into `#insights-feed-mount`. The live
  "Related to current gold price" card only renders when a ~7-day-ago daily snapshot exists in
  localStorage (honest week-over-week); it is fed via `feed.setPriceContext()` on each refresh. CSS
  additions are at the bottom of `styles/pages/insights.css`.
- BUILD 2 Market Intelligence Panel is injected by `countries/country-page.js` via
  `ensureMarketIntelMount()` (no per-page HTML edits) and styled in `styles/country-page.css`.
  Reference data lives in `src/config/market-intel.js` keyed by ISO code with a generic fallback.
- The "Should I Buy Today?" indicator reads the shared `gtl_history` daily snapshots; country pages
  now call `cache.saveHistorySnapshot(STATE)` so the 7-day average builds over repeat visits.
- Alert engine is wired into tracker-pro.js `applyRealtimeSnapshot` — fires on every 90s price tick
- Alert manager drawer CSS is at `styles/components/alert-manager.css` — imported only in
  tracker.html
- New localStorage key `gtl_alerts_v2` — migrates from legacy `gold_price_alerts` automatically
- BUILD 6 Compare tool: standalone page `compare.html` + orchestrator `src/pages/compare.js` + pure
  logic `src/pages/compare/compare-core.js` (DOM-free, unit-tested). Cross-country comparison keys
  off an all-in **retail estimate** = gold value × (1 + median making charge) × (1 + VAT), because
  the spot-linked gold value per gram is globally identical in USD. `fxRateFor` returns the
  hardcoded AED peg for AED and never the live rates object. Hash deep-link format:
  `#compare=ae,sa,kw,qa&k=22` (codes + active karat). Footer/breadcrumb/sitemap/translations wired.
- Next recommended build: BUILD 7 (Shops Directory — add map view, card redesign, advanced filters,
  detail modal) or BUILD 9 (Homepage Overhaul — asymmetric hero, sparkline strip, market context).
