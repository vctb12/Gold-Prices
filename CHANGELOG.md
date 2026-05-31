# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### BUILD 8 — Insights Feed: Market Analysis Hub — 2026-05-31

**New feature:**

- feat(insights): replace static 3-card grid with a dynamic, JS-rendered masonry layout powered by
  `src/config/insights-articles.js` — 15 bilingual articles across 6 categories (Price Analysis,
  Market News, Buying Guides, Zakat & Islamic Finance, Investment, Education).
- feat(insights): add horizontally scrollable category filter chip strip with article counts per
  category. Active category highlighted with gold accent. Clicking filters the grid instantly.
- feat(insights): add client-side search with 200ms debounce, filtering by title + excerpt text.
  No-results state with helpful suggestions. Escape key clears search. Result count shown when
  filter is active.
- feat(insights): add dynamic "Related to current gold price" contextual callout card inserted at
  position 3 in the grid. Compares current spot price to 7-day baseline average. Updates every 90
  seconds with the price refresh cycle.
- feat(insights): add estimated read time on every card calculated from article word count (200
  wpm).
- feat(insights): add scroll-triggered entrance animations (`data-reveal`) to all cards and the
  featured article card, with `prefers-reduced-motion` fallback.
- feat(insights): full bilingual EN/AR support for search, categories, result count, no-results
  message, read time labels, and contextual callout text.

**Quality:**

- test: 9 new tests in `tests/insights-feed.test.js` — config completeness, category coverage,
  unique IDs, bilingual labels, read-time calculation.
- a11y: search input has associated label, category chips use `role="tablist"` with `aria-selected`,
  results meta uses `aria-live="polite"`, search input has `aria-describedby` hint.
- RTL: search icon position, category strip, card header/footer all mirror correctly.
- mobile: masonry grid collapses 3→2→1 columns; category strip scrolls horizontally with snap.
- CSS: uses design tokens for all colors, spacing, radii, shadows; no hardcoded values.
### BUILD 7 — Gold Shop Directory: Map View & Compare Feature — 2026-05-31

**New features:**

- feat(shops/map): add interactive Leaflet.js map view to shops directory with Map/List toggle.
  Shops with lat/lng coordinates appear as clickable pins; popup shows name, market, city, and a
  "View details →" button that opens the shop modal. Map fits bounds to show all visible pins.
  Graceful fallback to list-only view if Leaflet CDN fails to load.
- feat(shops/compare): add shop comparison feature — select up to 3 shops via a "Compare" toggle
  button on each card. A sticky bottom bar shows selected shops as removable chips with a "Compare
  selected" button that opens a full-screen comparison modal with a side-by-side table (location,
  market, category, specialties, details, phone, website).
- feat(shops/data): add lat/lng coordinates to all 27 shop entries in `data/shops.js` for map pin
  placement.

**Architecture:**

- `src/components/shops-map.js` — Leaflet map component (CDN loader, marker layer, popup bindings,
  fit-bounds, invalidateSize for container visibility)
- `src/components/shops-compare.js` — compare module (initCompare, toggleCompare, clearCompare,
  renderCompareBar, openCompareModal, max-3 limit)
- `styles/components/shops-map.css` — map container, view toggle, compare bar, compare modal,
  compare table (design tokens, RTL, dark mode, responsive, reduced-motion)
- `tests/shops-compare.test.js` — 9 unit tests covering add/remove/max/clear/callback

**Quality:**

- i18n: bilingual EN/AR strings for map, list, compare features
- 0 new lint errors; all existing tests pass (3 pre-existing failures unchanged)
- Build passes; map view loads Leaflet lazily on first click (no impact on initial load)
### BUILD 8 — Insights: market-analysis feed (filter · search · masonry · live context) — 2026-05-31

**New feature:**

- feat(insights): rebuild the Insights cards section into an interactive market-analysis feed — a
  horizontally scrollable category filter strip with live counts, a debounced (200 ms) client-side
  search, a masonry-style CSS-columns grid (3 → 2 → 1), per-card read-time estimates and publish
  dates, and a branded no-results state.
- feat(insights): add a live "Related to current gold price" context card pinned to grid position 3
  — it compares the current spot price with a ~7-day-ago cached daily snapshot and only renders when
  honest week-over-week data exists. It updates on the existing 90-second refresh cycle and makes no
  extra fetches.
- feat(insights): add `src/config/insights-data.js` — a bilingual (EN/AR) content model of 12
  insights, each linking to an existing `content/guides/` page (no dead links), plus the category
  taxonomy.
- feat(insights): add `src/lib/insights-feed-core.js` — a pure, DOM-free logic module
  (`filterInsights`, `categoryCounts`, `estimateReadMinutes`, `sortByDateDesc`, `getFeatured`,
  `buildPriceContext`, `aed22kPerGram`) with 18 unit tests in `tests/insights-feed-core.test.js`.
- feat(insights): render via `src/components/insights-feed.js` (`mountInsightsFeed`) using the
  safe-DOM `el()` helper (no innerHTML); full RTL support via CSS logical properties, dark mode
  through design tokens, and a `prefers-reduced-motion` fallback for the entrance animation.

### BUILD 6 — Compare Countries: interactive cross-country tool — 2026-05-31

**New feature:**

- feat(compare): add a standalone `compare.html` page — an interactive, sortable, filterable tool
  for comparing live gold reference prices across the GCC and Arab world. Sticky karat tabs
  (24K/22K/21K/18K), removable country chips (max 6), an "Add country" selector, a sortable table
  (local/g, USD/g, VAT, making charges, all-in retail estimate, % vs UAE), a dynamic "currently most
  affordable" callout, and a side-by-side detail view (with a per-karat difference bar chart) when
  exactly two countries are selected.
- feat(compare): add `src/pages/compare/compare-core.js` — a pure, DOM-free logic module
  (`buildComparisonRows`, `annotatePctVsUae`, `sortRows`, `computeCheapest`, `fxRateFor`, hash
  parse/serialize). `fxRateFor` returns the hardcoded AED peg (3.6725) for AED and never the live
  rates object. The cross-country comparison keys off an all-in retail estimate (gold value × (1 +
  median making charge) × (1 + VAT)) since the spot-linked gold value per gram is globally identical
  in USD — surfaced explicitly in the UI as reference only, not financial advice.
- feat(compare): URL-hash deep links (`#compare=ae,sa,kw,qa&k=22`) for shareable, back-button-safe
  selections, wired to the shared shell, spot bar, and the existing 90-second refresh cycle.
- feat(nav): add "Compare countries" links to the comparison footer mega-menu (EN + AR), a `compare`
  breadcrumb label/route, `nav.compare` translations, and `compare.html` to the generated sitemap.

**Quality:**

- i18n: all new strings provided in EN and AR; the page is fully RTL-mirrored via CSS logical
  properties and adapts to dark mode through design tokens (`styles/pages/compare.css`).
- test(compare): add `tests/compare-core.test.js` (13 tests) covering karat purity, the AED-peg FX
  path, row building, % vs UAE annotation, sorting, cheapest computation, and hash parse/serialize.

### BUILD 2 — Country Pages: Market Intelligence Panel — 2026-05-31

**New feature:**

- feat(countries): add a Market Intelligence Panel to every country gold-price page, rendered after
  the hero by `countries/country-page.js`. Shows the live local 22K/gram price, 24h change, the
  country VAT/sales-tax rate, typical making-charge range, a live retail estimate (spot + median
  making charge + tax), popular karats, and a one-line market note.
- feat(countries): add a "Should I Buy Today?" indicator comparing the current price to the rolling
  7-day average from local daily snapshots — 🟢 below average / 🔴 above average / ⚪ within normal
  range — explicitly labelled "reference only, not financial advice".
- feat(config): add `src/config/market-intel.js` with hardcoded per-country reference data (VAT,
  making charges, karat preferences, bilingual market notes) for all 28 countries plus a safe
  generic fallback via `getMarketIntel(code)`.
- feat(countries): country pages now persist daily price snapshots (`cache.saveHistorySnapshot`) so
  the buy indicator builds local history over repeat visits.

**Quality:**

- i18n: all new panel strings provided in EN and AR; panel is fully RTL-mirrored via CSS logical
  properties and adapts to dark mode through design tokens.
- style(countries): new Market Intelligence styles appended to `styles/country-page.css` using only
  design tokens, with 44px CTA tap target and a `prefers-reduced-motion` fallback.
- test(config): add `tests/market-intel.test.js` (4 tests) covering record completeness, numeric
  bounds, and the default fallback.

### Phase 0 stabilization hotfixes — 2026-05-18

- chore(scripts): add script aliases required by the Phase 0 baseline sweep (`lint:css`,
  `check:unsafe-dom`, `test:e2e`).
- chore(e2e): make `test:e2e` install Playwright browsers/deps before execution to avoid missing
  executable failures after `npm ci`.
- test(e2e): align brittle assertions with current site behavior on calculator methodology link,
  country JSON-LD count, homepage country search empty-state, and mobile drawer resize breakpoint.

### Multi-area polish — 2026-04-30 session (Round 16)

**Bug fixes:**

- fix(index.html): correct broken X/Twitter social link (`https://x.com/Gold Ticker Live` had a
  literal space in the URL making it invalid — fixed to `https://x.com/GoldTickerLive`).

**Accessibility:**

- a11y(tracker): add `aria-pressed` to all chart range pills (`24H`–`ALL`) and keep them in sync via
  `events.js` click handler; also sync on init from persisted state via `populateSelects()` so
  screen readers always know which range is active.
- a11y(tracker): add `role="group"` to range-pills container and improve `aria-label` to "Chart time
  range".
- a11y(home): add `aria-live="polite"` to karat-strip freshness update span so screen readers
  announce "Updated X min ago" changes.
- a11y(home): add unique `id` attrs to region tab buttons (`gcc-tab-gcc` etc.) for correct ARIA
  tab/tabpanel wiring; improve tablist `aria-label` to "Filter gold prices by region".
- a11y(home): add `title` attributes to karat-strip unit toggle buttons with descriptive text.
- a11y(home): improve unit toggle group `aria-label` to "Select price unit".
- a11y(methodology): fix karat conversion table body rows — first column changed from `<td>` to
  `<th scope="row">` matching the pattern already used in `learn.html`.

**Calculator UX (mobile):**

- feat(calculator): add `inputmode="decimal"` to all gold weight and budget amount inputs — triggers
  the numeric/decimal keyboard on iOS and Android instead of the full text keyboard.
- feat(calculator): add `autocomplete="off"` to all weight and price inputs to prevent browser
  autofill on gold weight fields.
- feat(calculator): add `aria-label` + `inputmode="numeric"` to scrap payout percentage input.

**Shops:**

- feat(shops): add `autocomplete="off"` and explicit `aria-label` to shops search input.

**SEO / structured data:**

- feat(seo): update `Organization` JSON-LD `sameAs` array in `index.html` to include
  `https://x.com/GoldTickerLive` alongside the existing Twitter URL.
- feat(seo): update `inject-schema.js` `getOrganizationSchema()` to emit the same dual sameAs array
  so any future inject-schema run keeps both URLs.

**Tests:**

- test(seo-sitewide): add regression test for X social link — asserts no `x.com` URL in `index.html`
  contains a space and that it starts with `https://x.com/`.

**CSS / nav fixes (items from navbar-audit plan Phase 2):**

- fix(css): consolidate duplicate `.nav-dropdown-item` CSS block — the older flex-based rule at line
  ~5943 has been removed; sub-element styles (`.nav-dropdown-item-icon`, `.nav-dropdown-item-body`,
  `.nav-dropdown-item--primary .nav-dropdown-item-label`,
  `[data-theme='dark'] .nav-dropdown-item--primary`) are now merged into the enriched grid-layout
  block, removing property leaks and conflicting `display` declarations (S1, S2).
- fix(css): add dark-mode override for `.nav-icon-btn:hover` and `:focus-visible` — the default
  `rgba(0,0,0,0.04)` tint is invisible against a dark nav surface; replaced with
  `rgb(255 255 255 / 0.08)` (S5).
- fix(css): `body.has-spot-bar .site-nav[data-nav-hidden='true']` now uses
  `translateY(calc(-100% - var(--spot-bar-height, 36px)))` so the nav slides fully above the
  spot-bar on scroll-down instead of leaving a gap (S7).

**SEO / structured data:**

- feat(seo): add `og:locale` + `og:locale:alternate` meta tags to 17 content pages that were missing
  them (faq, news, premium-watch, changelog, compare-countries, dubai-gold-rate-guide,
  gcc-gold-price-comparison, gold-making-charges-guide, gold-price-history, guides, order-gold,
  spot-vs-retail-gold-price, submit-shop, todays-best-rates, tools, 22k-guide, 24k-guide).
- feat(seo): add `og:image:alt` to content/gold-price-history and content/order-gold pages.
- feat(seo): add `FAQPage` JSON-LD structured data to `content/faq/index.html` covering the four
  most common questions (shop price, freshness, AED peg, karat differences).
- feat(seo): add `Article` JSON-LD structured data block to `methodology.html`.

**Trust / copy improvements:**

- feat(trust): `shops.html` disclaimer now explicitly says "Always confirm prices, hours, and
  details directly with the seller before visiting or purchasing."
- feat(trust): `calculator.html` hero disclaimer simplified — plain English, links to the
  spot-vs-retail content guide for users who want to understand the gap.

**Internal linking:**

- feat(links): `methodology.html` related-tools row now includes Shops and Spot vs Retail links.
- feat(links): `learn.html` related-tools row now includes 22K guide, 24K guide, Spot vs Retail,
  Making Charges, and Full FAQ links.
- feat(links): `index.html` FAQ "more questions" link now points to `content/faq/` instead of
  `learn.html`.

**Navigation (404 page):**

- feat(nav): `404.html` now includes "Countries" and "Learn" quick navigation links alongside the
  existing Home / Live Prices / UAE Prices / Calculator / Shops / Methodology links.

- feat(security): externalize inline analytics to `assets/analytics.js` (gtag loader + Clarity
  IIFE + DNT/opt-out gate). A new CJS codemod `scripts/node/externalize-analytics.js` walks every
  `.html` file in the repo and swaps the three legacy inline blocks for a single
  `<script src="…/assets/analytics.js" defer></script>`, computing the correct relative depth per
  file. Idempotent; `--check` mode.
- feat(security): drop `'unsafe-inline'` from `scriptSrc` in `server.js` CSP now that all inline
  analytics is externalized.
- chore(ci): `npm run validate` now runs `externalize-analytics --check` so a regression adding new
  inline analytics fails CI.

### Track C — Product polish

- feat(tracker): `renderSeasonal()` in `src/tracker/render.js` populates the previously-dead
  `#tp-seasonal-results` with typical-high month, typical-low month, and seasonal spread (%),
  derived from monthly averages over `state.history`.
- feat(shops): bilingual "Featured: editorially selected markets…" footnote under the featured grid
  (`#shops-featured-note`) plus "Directory last reviewed {date}" label inside the filter bar
  (`#shops-directory-reviewed`). Both wired through `applyLang()` in `src/pages/shops.js`.
- feat(design): new site-wide trust utilities in `styles/global.css` — `.trust-banner` (+
  `--success` variant), `.freshness-label` (+ `--live` / `--cached` / `--stale` / `--delayed` /
  `--estimated` / `--baseline`), `.methodology-link`, `.disclaimer` (+ `--inline`), backed by new
  `--color-warning*` tokens (amber for stale/cached/delayed data, not red) with explicit dark-mode
  overrides.

### Tests

- test(sitemap): new `tests/sitemap.test.js` (6 assertions) — runs the sitemap generator, asserts
  every `<loc>` uses the canonical apex origin (no www, no http), that core static pages and every
  on-disk country page are covered, that `<loc>` values are unique, and that `offline.html` is not
  in the sitemap.
- docs: new `docs/SEO_SITEMAP_GUIDE.md` documents how to add URLs and how the sitemap is verified.

### Track A — Stabilize (production revamp foundations)

- chore(repo): remove tracked build artifacts (`dist/`, `playwright-report/`, `test-results/`) from
  git; add to `.gitignore`.
- chore(config): deduplicate tool configs — `.prettierrc` and `.eslintrc.json` removed;
  `.prettierrc.json` and `eslint.config.mjs` (flat) are now the single sources of truth.
- fix(ci): rewrite `ci.yml` — the previous file contained two concatenated YAML documents and was
  silently producing zero jobs (every run marked failure). New workflow pins Node 20, runs
  `validate → quality → test → build`, and uploads `dist/` artifacts. Test-only secrets
  (`JWT_SECRET`, `ADMIN_PASSWORD`, `ADMIN_ACCESS_PIN`) provided via workflow env.
- fix(ci): `perf-check.yml` no longer uses the deprecated `microsoft/playwright-github-action@v1`;
  replaced with `npx playwright install --with-deps`. Node pinned to 20.
- test: fix `tests/verify-shops.test.js` (was written against Jest globals; converted to
  `node:test` + `node:assert` — matches the rest of the suite). All 221 tests now pass.
- test(e2e): broaden Playwright smoke coverage to home, shops, tracker, calculator, countries index,
  a country page, and the 404 page. Checks HTTP status and layout presence, not brittle substrings.
- chore(husky): fix invalid shebang in `.husky/pre-commit` (`. "/usr/bin/env bash"` → proper
  `#!/usr/bin/env sh`); remove `npm test` from the hook (kept in CI) so commits stay fast. Update
  `prepare` script to husky v9 form (`husky` — `husky install` is deprecated).
- chore(style): `stylelint value-keyword-case` now ignores standard font-family keywords (`Arial`,
  `Roboto`, `Cairo`, …) so autofix does not silently lowercase them.
- fix(build): `scripts/node/extract-baseline.js` no longer hard-fails when
  `src/lib/historical-data.js` imports the baseline JSON directly (it now does — the JSON file is
  the source of truth). The script stays as a safety net for regressions.
- chore(lint): `eslint.config.mjs` bumped to `ecmaVersion: 'latest'`; `src/lib/historical-data.js`
  added to ignore list because espree does not yet parse import attributes
  (`assert { type: 'json' }`).
- docs: add transient `REVAMP_STATUS.md` tracking the 30-phase revamp plan (Tracks A–E). File is
  deleted at Phase 30 (launch); contents roll into this changelog.

### Pre-Track-A

- feat(tracker): lazy-load GoldChart; forward live/history updates; add image-audit tool and a
  lightweight CI workflow (#129) — defers heavy chart library to improve initial load.
