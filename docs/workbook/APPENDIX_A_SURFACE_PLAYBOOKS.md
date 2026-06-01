# Appendix A — Flagship Surface Playbooks

> Parent: [`docs/GOLD_TICKER_LIVE_MASTER_WORKBOOK.md`](../GOLD_TICKER_LIVE_MASTER_WORKBOOK.md)  
> Use with: `@.github/prompts/endless-ui-visual-sweep.prompt.md` or WB-401–404

Each playbook: **job-to-be-done**, **must-ship UX**, **files**, **tests**, **360px RTL checklist**.

---

## A.1 Homepage (`index.html` + `home.js`)

### Job

Answer in &lt;3 seconds: *What is gold per gram in AED right now, and is the market open?*

### Must-ship UX

| Element | Requirement |
| ------- | ----------- |
| Hero price | Single dominant spot-linked value; `tabular-nums`; countUp optional |
| Freshness | Source + timestamp + state pill (never hidden for cleaner layout) |
| Karat strip | Scannable 24K→18K; links to tracker/calculator with hash |
| GCC grid | Every chip → **canonical** country URL (`/countries/{cc}/gold-price/` or agreed canonical) |
| Failure | `data-status-banner` or equivalent on prolonged fetch failure + retry |
| Static | Meaningful `<title>`, `<h1>`, meta; not JS-only hero |

### File map

| Layer | Path |
| ----- | ---- |
| HTML | `index.html` |
| JS | `src/pages/home.js` |
| CSS | `styles/pages/home.css`, tokens in `styles/partials/tokens.css` |
| Data | `src/lib/api.js` (`fetchGoldAndFX`), `src/lib/cache.js` |
| Chrome | `src/components/nav.js`, `footer.js`, `ticker.js`, `spotBar.js` |

### Tests to keep green

`tests/home-hero-loading.test.js`, `tests/home-translations.test.js`, `tests/first-paint-skeleton.test.js`, `tests/freshness-coverage.test.js`, `tests/e2e/homepage.spec.js`

### 360px RTL checklist

- [ ] No horizontal scroll on hero + karat row
- [ ] Language toggle preserves path/query
- [ ] Arabic: chevrons mirrored; numbers still LTR where appropriate
- [ ] Touch targets ≥44px on primary CTAs
- [ ] Skeleton → value transition (no flash of `Loading…`)

### Known debt (WB targets)

| Debt | Session |
| ---- | ------- |
| BUILD 9 hero not final terminal | WB-302 |
| Section count still high post Session 4 | WB-402 |
| Deep link hash to tracker | WB-102 |

---

## A.2 Live Tracker (`tracker.html` + `tracker-pro.js`)

### Job

*Professional workspace* for live spot, karats, chart, alerts, export — without feeling like 7 apps in one bag.

### Must-ship UX

| Element | Requirement |
| ------- | ----------- |
| Grouping | Live / Analyze / Settings visual groups (post #392) |
| Chart | Range pills readable; stale chart labeled |
| Karat table | Row hover; selected state; not empty rows while loading |
| Alerts | Path to create alert (local + server when auth) |
| Copy/export | Bilingual feedback via `copy-toast.js` |
| Reference copy | Spot vs retail link to methodology/guide |

### File map

| Layer | Path |
| ----- | ---- |
| HTML | `tracker.html` (~1600 lines — change in sections) |
| Orchestrator | `src/pages/tracker-pro.js` |
| Modules | `src/tracker/*.js` (hero, chart-loader, modes, …) |
| CSS | `styles/pages/tracker-pro.css` |
| Alerts | `src/lib/alert-engine.js`, `styles/components/alert-manager.css` |

### Tests

`tests/tracker-*.test.js` (modes, hero, chart, alerts, export, dom, freshness), `tests/e2e/tracker-flow.spec.js`

### Mobile checklist

- [ ] Mode pills wrap without overflow
- [ ] Sticky controls respect safe-area
- [ ] Chart usable at 360px (pan/zoom or simplified range)
- [ ] Bottom nav highlights Tracker when active

### Known debt

| Debt | Session |
| ---- | ------- |
| Server alert UX minimal | WB-103 |
| History mixed sources | WB-802 |
| Cognitive density | WB-403 |

---

## A.3 Calculator (`calculator.html` + `calculator.js`)

### Job

Reference estimates by weight/karat — always **estimate**, never shop price.

### Must-ship UX

| Element | Requirement |
| ------- | ----------- |
| Tabs | Value / scrap / zakat / buying power / converter — each labeled |
| Trust | Shop vs reference panel where applicable |
| VAT / making | Disclosed in copy |
| Share | URL/hash sharing if implemented — test `calculator-url-sharing` |
| Intervals | Paused on `visibilitychange` |

### Files

`calculator.html`, `src/pages/calculator.js`, `styles/pages/calculator.css`

### Tests

`tests/calculator-conversions.test.js`, `tests/calculator-url-sharing.test.js`, `tests/pricing-formula.spec.test.js`

### WB link

WB-102: CTA to shops; WB-404: tab crossfade + focus rings

---

## A.4 Shops (`shops.html` + `shops.js`)

### Job

Honest directory: reference context, filters, no fake listings.

### Must-ship UX

| Element | Requirement |
| ------- | ----------- |
| Empty state | Honest copy when zero results |
| Counters | Match loaded set (not 0/0/0 while data exists) |
| Map | Lazy Leaflet; graceful CDN fail → list only |
| Compare | Max 3 shops; bar at bottom |
| Labels | Directory ≠ live shop quote |

### Files

`shops.html`, `src/pages/shops.js`, `src/pages/shops/*`, `data/shops.js`, `styles/pages/shops.css`, `styles/components/shops-map.css`

### Tests

`tests/shops-compare.test.js`, `tests/verify-shops.test.js`, `tests/shops-business-api.test.js`, `tests/e2e/shops-search.spec.js`

### WB link

WB-301 (BUILD 7), WB-702 (claim UI), G-15 vendor gap

---

## A.5 Compare (`compare.html`)

### Job

Cross-country **retail estimate** ranking with methodology visible.

### Must-ship UX

Hash deep links `#compare=ae,sa,kw&k=22`; karat tabs; cheapest callout uses retail formula documented in tests.

### Files

`compare.html`, `src/pages/compare.js`, `src/pages/compare/compare-core.js`

### Tests

`tests/compare-core.test.js` (13+ tests)

---

## A.6 Learn + Insights (content + feeds)

### Learn

Static body without JS (Session 2). `learn.html`, `src/pages/learn.js`, learn-hub renderer if mounted.

### Insights

BUILD 8 feed: `src/config/insights-articles.js` or `insights-data.js`, `src/pages/insights.js`, `insights-feed-core.js`.

### Tests

`tests/learn-static-fallback.test.js`, `tests/insights-feed-core.test.js`, `tests/insights-data.test.js`

### Strategy debt

Knowledge hub merge — WB-205 (plan only first PR)

---

## A.7 Country / city template

### Job

Local reference gram prices + market intel — not empty SEO shells.

### Must-ship UX

| Element | Requirement |
| ------- | ----------- |
| Canonical | One URL per country; 301 duplicates |
| Market intel | `src/config/market-intel.js` + `country-page.js` mount |
| Freshness | Same vocabulary as home |
| FAQ | Unique-ish H1/FAQ per country where possible |

### Files

`countries/**/index.html` (generated), `countries/country-page.js`, `styles/country-page.css`, generators under `scripts/node/` / `build/`

### Tests

`tests/country-canonical.test.js`, `tests/country-pages-seo.test.js`, `tests/market-intel.test.js`, `tests/country-consolidation.test.js`

### SEO program

WB-201, WB-202 — see [Appendix G](./APPENDIX_G_COUNTRY_AND_SEO_STRATEGY.md)

---

## A.8 Methodology + legal

### Methodology

Trust anchor — live formula display, FAQ schema, links from every estimate surface.

`methodology.html`, `src/pages/methodology.js` (if any), `styles/pages/methodology.css`

### Legal

`privacy.html`, `terms.html` — hreflang, canonical, no regressions.

---

## A.9 Auth surfaces

| Page | Backend | Gap |
| ---- | ------- | --- |
| `account.html` | Supabase auth | — |
| `dashboard.html` | `/api/v1/me/*` | Polish UX WB-104 |
| `developer.html` | API keys | — |
| `pricing.html` | Stripe | Live keys owner action G-04 |

**Note:** `GET /api/v1/me/export` and `DELETE /api/v1/me` exist in `server/routes/public-accounts.js` — verify dashboard wires them; if not, WB-101 is UI-only.

---

## A.10 Admin + operator

`admin/*`, `server/routes/admin/*`, ops endpoints. Mobile spot-check WB-806. Never commit secrets.

---

## Surface polish rotation (endless)

Week-style rotation for `endless-ui-visual-sweep` (one page per run):

1. tracker → 2. index → 3. calculator → 4. shops → 5. methodology → 6. compare → 7. country template (pick one CC) → 8. learn → 9. insights → repeat

Log page + date in `PLAN.md` to avoid duplicate polish.
