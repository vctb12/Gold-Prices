## 1. Executive Summary

Gold Ticker Live is currently a bilingual (EN/AR) gold-reference website centered on spot-linked
gold tracking for UAE/GCC users, with calculators, country/city pages, market/shop directory pages,
and content hubs. It is not a full SPA; it is a static multi-page frontend with dynamic browser-side
data fetching and an optional Node/Express backend/admin layer.

Current positioning from repo evidence:

- Core proposition: live gold reference tracking + spot-linked estimate framing (`index.html`,
  `tracker.html`, `src/config/translations.js`).
- Trust framing exists in product copy (spot/reference, not retail final price)
  (`src/config/translations.js`, `methodology.html`, `src/pages/calculator.js`).
- Canonical live-price payload is `data/gold_price.json`, refreshed by workflow automation
  (`.github/workflows/gold-price-fetch.yml`, `scripts/python/fetch_gold_price.py`).

Maturity assessment:

- Site is **closer to a semi-dynamic tracker product** than a full transactional web app.
- Strongest: data-fetch automation and workflow operations, broad page coverage, bilingual shell,
  and strong test/CI scaffolding.
- Weakest: partially wired monetization/backend integrations (Stripe/newsletter/subscription), mixed
  implementation maturity across modules, and dependency on workflow-driven JSON refreshes.

Strongest parts:

- Data and automation stack (`.github/workflows/gold-price-fetch.yml`,
  `.github/workflows/post_gold.yml`, `scripts/python/fetch_gold_price.py`,
  `scripts/python/post_gold_price.py`).
- Frontend breadth and translation infrastructure (`src/config/translations.js`, `countries/`,
  `content/`, `src/components/nav.js`).
- Quality gates (`package.json`, `.github/workflows/ci.yml`, `tests/*.test.js`,
  `tests/e2e/*.spec.js`, `scripts/node/check-unsafe-dom.js`).

Weakest parts:

- Pricing/subscription UX is not fully live-wired (`pricing.html`, `server/routes/stripe.js`,
  `server/lib/subscriptions.js`).
- Some backend features are scaffolded but partially implemented or dependency-driven
  (`server/routes/newsletter.js`, `server/routes/stripe.js`).
- Documentation has some legacy or drifted references (`docs/ARCHITECTURE.md`,
  `docs/AUTOMATIONS.md`).

---

## 2. Current Tech Stack

| Area                     | Current Implementation                                                                                                                  | Evidence/File                                                                     |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Frontend framework       | No React/Vue/etc.; vanilla HTML + ES modules                                                                                            | `index.html`, `tracker.html`, `src/pages/*.js`, `package.json`                    |
| JavaScript architecture  | Entry modules under `src/pages`, shared modules under `src/lib`, `src/components`, `src/config`; tracker split modules in `src/tracker` | `src/pages/home.js`, `src/pages/tracker-pro.js`, `src/tracker/*`                  |
| CSS architecture         | Global token system + page-specific stylesheets                                                                                         | `styles/global.css`, `styles/pages/*.css`                                         |
| Client data storage      | localStorage caches/preferences/alerts/history + SW cache                                                                               | `src/lib/cache.js`, `src/config/constants.js`, `sw.js`                            |
| Repo/static data storage | JSON data files in `data/` committed by workflows                                                                                       | `data/gold_price.json`, `data/last_gold_price.json`, `data/last_tweet_state.json` |
| Backend runtime          | Optional Express backend with API routes + static serving                                                                               | `server.js`, `server/routes/*`, runtime deps in `package.json`                    |
| Auth/admin               | JWT + bcrypt + admin APIs + admin frontend + Supabase auth assets                                                                       | `server/lib/auth.js`, `server/routes/admin/index.js`, `admin/*`                   |
| Build tools              | Vite plus pre-build node scripts (baseline, shops normalization, schema injection, sitemap generation)                                  | `package.json` `build`, `build/generateSitemap.js`, `scripts/node/*`              |
| Testing tools            | node:test, Playwright, ESLint, Stylelint, Prettier, custom validation scripts                                                           | `package.json`, `tests/*.test.js`, `tests/e2e/*.spec.js`                          |
| Deployment model         | GitHub Pages deploy on `main` + custom domain                                                                                           | `.github/workflows/deploy.yml`, `CNAME`                                           |
| PWA/offline              | Manifest, service worker, offline and 404 pages                                                                                         | `manifest.json`, `sw.js`, `offline.html`, `404.html`                              |
| GitHub Actions           | CI/deploy/security/perf/automation/newsletter/sync workflows                                                                            | `.github/workflows/*.yml`, `.github/workflows/README.md`                          |
| Package scripts          | Extensive script catalog (lint/test/build/validate/seo/link/a11y/perf)                                                                  | `package.json`                                                                    |
| Static vs dynamic status | Static site architecture with dynamic frontend fetch + workflow-updated JSON + optional Express APIs                                    | `AGENTS.md`, `server.js`, `src/lib/api.js`, `data/gold_price.json`                |

---

## 3. Current Website Pages and Features

| Page/Route                     | Current Purpose                               | Main Features                                                                                | Weaknesses / Missing Features                                                     | Relevant Files                                                                            |
| ------------------------------ | --------------------------------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `/` (homepage)                 | Product landing and trust framing             | Live snapshot, market status, karat strips, country discovery, EN/AR switch, SEO/meta/schema | Long page depth; SW registration handled in home entry script path                | `index.html`, `src/pages/home.js`, `styles/pages/home.css`                                |
| `/tracker.html`                | Main live tracker workspace                   | Multi-mode tracker, chart/history, alerts/planner/export overlays, EN/AR freshness labels    | High interaction complexity for first-time/mobile users                           | `tracker.html`, `src/pages/tracker-pro.js`, `src/tracker/*`                               |
| `/calculator.html`             | Calculator/tool suite                         | Value/scrap/zakat/buying-power/unit converter, trust notes, EN/AR content                    | No clear server-backed persistence/share flow                                     | `calculator.html`, `src/pages/calculator.js`                                              |
| `/learn.html`                  | Educational guide hub                         | Structured article sections, metadata/schema, bilingual shell                                | Mostly static depth; no interactive curriculum                                    | `learn.html`, `styles/pages/learn.css`                                                    |
| `/insights.html`               | Insights/content page                         | Insights hub metadata and internal navigation                                                | Content depth consistency varies by article                                       | `insights.html`, `content/news/*`                                                         |
| `/methodology.html`            | Data transparency page                        | Formula/source framing, trust copy, metadata/schema                                          | Some sections remain technical for non-expert users                               | `methodology.html`, `styles/pages/methodology.css`                                        |
| `/shops.html`                  | Directory and market discovery                | Filters/search, cards, modal details, near-me helper, Supabase live fetch fallback           | Mix of market clusters and direct shops; many entries have limited contact detail | `shops.html`, `src/pages/shops.js`, `src/lib/supabase-data.js`, `data/shops-data.json`    |
| `/countries/*`                 | Country/city/market SEO network               | Country/city/market/karat pages with localized metadata and links                            | Risk of template repetition/thin long-tail pages                                  | `countries/`, `styles/country-page.css`, `styles/city-page.css`, `styles/market-page.css` |
| `/content/*`                   | Guides/tools/news/submit-shop pages           | Rich content hub and multistep submit-shop form                                              | Quality/maturity varies by page                                                   | `content/*`, `content/submit-shop/index.html`, `src/pages/submit-shop.js`                 |
| `/pricing.html`                | Pricing plan surface                          | Tier table, CTA controls                                                                     | Checkout currently placeholder alert; Stripe not complete                         | `pricing.html`, `server/routes/stripe.js`                                                 |
| `/privacy.html`, `/terms.html` | Legal pages                                   | Canonical/hreflang/meta legal pages                                                          | Static legal text lifecycle not strongly automated in repo                        | `privacy.html`, `terms.html`                                                              |
| `/admin/`                      | Admin dashboard surface                       | Admin sections for shops/content/social/pricing/analytics/auth                               | Readiness depends on env, auth, and deployment posture                            | `admin/*`, `server/routes/admin/index.js`, `server/lib/auth.js`                           |
| Utility routes                 | Offline/error and extra product support pages | Offline fallback page, not-found flow, invest page                                           | Consistency maintenance burden across growing route count                         | `offline.html`, `404.html`, `invest.html`                                                 |

---

## 4. Current Frontend State

### 4.1 What is already good

- Shared shell/component architecture is strong (nav/footer/ticker/spot bar/breadcrumbs)
  (`src/components/nav.js`, `src/components/footer.js`, `src/components/ticker.js`,
  `src/components/spotBar.js`, `src/components/breadcrumbs.js`).
- EN/AR translation and RTL support are broad (`src/config/translations.js`, multiple `[dir='rtl']`
  blocks in `styles/global.css`).
- Core pages include explicit live/cached/stale/offline UI states (`src/pages/home.js`,
  `src/pages/tracker-pro.js`, `src/lib/live-status.js`).
- Accessibility markers are used heavily in dynamic regions (`index.html`, `tracker.html`,
  `calculator.html`, `shops.html` use `aria-live`/`role=status`).
- Design token system exists and is heavily used (`styles/global.css`).
- DOM safety controls are institutionalized (`src/lib/safe-dom.js`,
  `scripts/node/check-unsafe-dom.js`).

### 4.2 What is weak or inconsistent

- Mixed rendering styles: some modules use safe DOM builders, while others still rely on `innerHTML`
  templating (controlled but higher maintenance risk) (`src/pages/shops.js`,
  `src/components/nav.js`, `src/components/footer.js`, `admin/*`).
- Tracker and shops are feature-rich but cognitively dense on smaller screens (`tracker.html`,
  `src/pages/tracker-pro.js`, `shops.html`, `src/pages/shops.js`).
- Service worker registration is explicitly done in `home.js`; direct-entry behavior on other pages
  depends on prior SW registration or browser state (`src/pages/home.js:1119-1124`, `sw.js`).
- Placeholder monetization surfaces can create expectation mismatch (`pricing.html` inline
  TODO/alert behavior).

### 4.3 What should be upgraded later

- Continue replacing public/admin `innerHTML` sinks with safer DOM-construction utilities where
  practical.
- Add progressive onboarding/simplification for tracker complexity.
- Standardize loading/empty/error component patterns across all page families.
- Strengthen direct-entry SW/PWA behavior consistency beyond home-entry registration path.

---

## 5. Current Backend / Data Layer State

| Data/Backend Area              | Current State                                                          | Evidence/File                                                                                                 | Gap                                                 |
| ------------------------------ | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Backend existence              | Real Express backend present                                           | `server.js`, `server/routes/*`                                                                                | Public site can run statically without it           |
| API routes                     | Admin, stripe, newsletter, submissions, health routes mounted          | `server.js` route mounts, `server/routes/*`                                                                   | Route completeness varies by feature                |
| Public static serving          | Serves `dist` and dev `src` (non-prod)                                 | `server.js`                                                                                                   | Requires backend hosting if used in production      |
| Live price source for frontend | Reads `/data/gold_price.json`, FX from external API                    | `src/config/constants.js`, `src/lib/api.js`                                                                   | FX still client-direct to external endpoint         |
| Refresh process                | GitHub Action fetch pipeline updates gold JSON                         | `.github/workflows/gold-price-fetch.yml`, `scripts/python/fetch_gold_price.py`                                | Workflow uptime/secrets required                    |
| Provider fallback              | Ordered provider waterfall with stale/fallback policy + provider state | `scripts/python/fetch_gold_price.py`, `scripts/python/gold_providers/registry.py`, `data/provider_state.json` | Tuning/monitoring complexity                        |
| Freshness/staleness            | JSON freshness fields + frontend freshness UX                          | `data/gold_price.json`, `src/lib/live-status.js`, `src/pages/home.js`                                         | Must keep wording consistent across all pages       |
| Cache/fallback                 | localStorage fallback layers for gold/FX/day-open/history              | `src/lib/cache.js`, `src/config/constants.js`                                                                 | Device-local only                                   |
| Historical data                | Embedded monthly baseline + merged local snapshots                     | `src/lib/historical-data.js`, `src/components/chart.js`                                                       | No complete server history API exposed              |
| Accounts                       | Admin auth/users exist; public account system incomplete               | `server/lib/auth.js`, `admin/login/`, `pricing.html`                                                          | Public auth entitlements not fully implemented      |
| Alerts                         | Client-side tracker alerts exist                                       | `src/config/constants.js` (`gold_price_alerts`), `src/tracker/state.js`, `tracker.html`                       | No clear server-backed alert lifecycle              |
| Database presence              | Supabase config/schema exists; shops can fetch from Supabase REST      | `src/config/supabase.js`, `supabase/schema.sql`, `src/lib/supabase-data.js`                                   | Not all product features are fully DB-backed        |
| Admin panel                    | Large admin UI + APIs present                                          | `admin/*`, `server/routes/admin/index.js`                                                                     | Production hardening and ops posture still critical |
| Data validation                | Submission validation/rate limiting + auth env guards                  | `server/routes/submissions.js`, `server/lib/auth.js`                                                          | Validation depth not uniform across all features    |

---

## 6. Current Gold Price Provider / API Setup

Provider/API setup in current repo:

- Supported provider adapters: `metal_sentinel`, `finnhub_oanda`, `fmp_gcusd`, `goldapi_io`,
  `twelvedata_xauusd`, `goldpricez`, `gold_api_com` (`scripts/python/gold_providers/registry.py`).
- Workflow fetch order currently set to `gold_api_com,twelvedata_xauusd,fmp_gcusd`
  (`.github/workflows/gold-price-fetch.yml`).
- Fetch script supports `GOLD_PROVIDER_ORDER` override and writes canonical output files
  (`scripts/python/fetch_gold_price.py`).
- API keys/env names in use include `GOLD_API_COM_KEY`, `TWELVEDATA_API_KEY`, `FMP_API_KEY` in fetch
  workflow (`.github/workflows/gold-price-fetch.yml`) plus broader env catalog in `.env.example`.
- Output JSON fields include freshness and fallback metadata (`timestamp_utc`, `fetched_at_utc`,
  `freshness_seconds`, `max_freshness_seconds`, `is_fresh`, `is_fallback`) (`data/gold_price.json`).
- Stale and failure policy controls exist (`ALLOW_STALE_PRICE`, soft-fail logic, fallback path)
  (`scripts/python/fetch_gold_price.py`, `.env.example`).
- Provider state/circuit bookkeeping exists (`data/provider_state.json`,
  `scripts/python/fetch_gold_price.py`).
- Tests cover providers and post pipeline modules (`tests/test_gold_providers.py`,
  `tests/test_provider_bakeoff.py`, `tests/test_post_gold_price.py`).

Data nature from repo evidence:

- Site is snapshot-driven and workflow-fed, not exchange-stream tick-by-tick browser streaming.

### 6.1 Data Trust Labels Currently Used

Current trust signals exist and are explicit in core surfaces:

- live/cached/stale/unavailable freshness vocabulary (`src/lib/live-status.js`, `src/pages/home.js`,
  `src/components/ticker.js`, `src/components/spotBar.js`).
- spot/reference and retail-disclaimer language in translation and calculator/method pages
  (`src/config/translations.js`, `src/pages/calculator.js`, `methodology.html`).
- market open/closed context and closed-market posting logic (`src/lib/live-status.js`,
  `src/pages/home.js`, `scripts/python/post_gold_price.py`).

Gap: consistency should still be audited periodically across large country/content route inventory.

---

## 7. Current X/Twitter Automation State

| Automation Area           | Current Behavior                                                                                                               | Evidence/File                                                                                      | Risk / Improvement                                                             |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Workflow + cadence        | Hourly scheduled during market windows + manual dispatch                                                                       | `.github/workflows/post_gold.yml`                                                                  | External platform/API dependency risk                                          |
| Manual controls           | Inputs for `post_intent`, `dry_run`, `force_post`, `source`, `refresh_price_first`, `trigger_nonce`, closed-market repost flag | `.github/workflows/post_gold.yml`                                                                  | Operator misuse can cause noisy/manual recovery                                |
| Secrets mapping           | Uses `CONSUMER_KEY/SECRET` and access tokens mapped to `TWITTER_*` env vars                                                    | `.github/workflows/post_gold.yml`                                                                  | Secret rotation and access policy must be maintained                           |
| Source data               | Reads canonical `data/gold_price.json`; optional manual pre-refresh                                                            | `.github/workflows/post_gold.yml`, `scripts/python/post_gold_price.py`                             | If upstream refresh fails, post may run with stale/no data depending on policy |
| Duplicate/cooldown guards | Uses `tweet_guard` + state files + hash/cooldown checks                                                                        | `scripts/python/tweet_guard.py`, `data/last_tweet_state.json`, `scripts/python/post_gold_price.py` | State corruption or commit failure can require manual correction               |
| Must-post mode            | `POST_INTENT=must_post` bypasses soft guard reasons                                                                            | `.github/workflows/post_gold.yml`, `scripts/python/post_gold_price.py`                             | Over-posting risk if policy used without monitoring                            |
| Dry-run + force-post      | Supported env flags                                                                                                            | workflow + script files above                                                                      | Need clear operator runbook discipline                                         |
| Closed-market logic       | Explicit `market_closed_reference` handling and controls                                                                       | `scripts/python/post_gold_price.py`                                                                | Complex branch logic can be hard to reason quickly                             |
| Tweet templates           | Multi-tier templates including compact and micro variants                                                                      | `scripts/python/post_gold_price.py` (`_render_tweet`, `format_micro_tweet`)                        | Keep financial trust wording consistent in all variants                        |
| Runtime reporting         | Structured runtime result JSON and summary parsing                                                                             | `.github/workflows/post_gold.yml`, `scripts/python/post_gold_price.py`                             | Best-effort parsing can miss diagnostics unless logs reviewed                  |
| Production readiness      | Operationally advanced and tested                                                                                              | `tests/test_post_gold_price.py`, workflow + script                                                 | Still vulnerable to X API/policy changes                                       |

---

## 8. Current SEO State

| SEO Area               | Current State                                                                 | Evidence/File                                                                                                    | Gap                                                              |
| ---------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Titles/descriptions    | Implemented on major pages                                                    | `index.html`, `tracker.html`, `calculator.html`, `shops.html`, `learn.html`, `insights.html`, `methodology.html` | Must keep unique/quality at long-tail scale                      |
| OG/Twitter metadata    | Present on major pages                                                        | same files above                                                                                                 | Large route network can drift                                    |
| Canonicals             | Broadly implemented                                                           | root pages + many country/content pages                                                                          | Needs regular parity checks                                      |
| hreflang               | `x-default`/`en`/`ar` across major pages                                      | root pages and `content/submit-shop/index.html`, country pages                                                   | Arabic alternate often uses `?lang=ar` pattern                   |
| Structured data        | JSON-LD implemented on major pages                                            | root pages listed above                                                                                          | Consistency/type completeness across all pages should be audited |
| robots directives      | Public crawling allowed; admin/api/internal blocked; sitemap pointer included | `robots.txt`                                                                                                     | Must stay aligned with actual deployed artifacts                 |
| Sitemap strategy       | Build script generates sitemap with alternate links                           | `build/generateSitemap.js`, `package.json` build                                                                 | `sitemap.xml` not present in root at audit snapshot              |
| RSS/feed reference     | Homepage references feed URL                                                  | `index.html` feed link                                                                                           | `feed.xml` not present in root at audit snapshot                 |
| Country SEO network    | Large route tree exists                                                       | `countries/`                                                                                                     | Thin/duplicate template risk on long-tail pages                  |
| Internal linking       | Shared nav/footer + content hubs and chips                                    | `src/components/nav-data.js`, `src/components/footer.js`, `content/index.html`                                   | Link depth quality varies across route families                  |
| Arabic SEO             | Arabic hreflang and translations are present                                  | page tags + `src/config/translations.js`                                                                         | Arabic content depth consistency varies by page                  |
| SEO validation tooling | Dedicated scripts/tests for meta/sitemap/inventory/sitewide                   | `scripts/node/check-seo-meta.js`, `scripts/node/inventory-seo.js`, `tests/seo-*.test.js`                         | Continuous enforcement required                                  |

---

## 9. Current Analytics, Tracking, Ads, and Monetization State

| Area                              | Present?              | Current Implementation                                                      | Evidence/File                                                                                                                                  | Missing Opportunity                                        |
| --------------------------------- | --------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Google Analytics (GA4)            | Yes                   | Externalized analytics loader with GA ID `G-K3GNY9M8TE`                     | `assets/analytics.js`                                                                                                                          | Expand conversion/event granularity on key funnels         |
| Google Tag Manager script loading | Yes (gtag loader URL) | Loads `googletagmanager.com/gtag/js` for GA                                 | `assets/analytics.js`                                                                                                                          | Add explicit data-layer schema governance                  |
| Search Console references         | Yes                   | Google verification meta tag on homepage                                    | `index.html`                                                                                                                                   | Add template-wide verification consistency checks          |
| Bing/Microsoft references         | Yes                   | `msvalidate.01` meta on key pages                                           | `index.html`, `tracker.html`, `calculator.html`                                                                                                | Keep parity across top entry pages                         |
| Microsoft Clarity                 | Yes                   | Clarity loader/tag id in analytics script                                   | `assets/analytics.js`                                                                                                                          | Add clearer privacy governance and QA docs                 |
| Hotjar                            | No evidence found     | No matching script/config in inspected repo files                           | repo search evidence                                                                                                                           | Add session-recording strategy only if needed              |
| AdSense                           | Yes                   | AdSense script loaded on many public pages                                  | `index.html`, `tracker.html`, `calculator.html`, `shops.html`                                                                                  | Improve slot strategy/perf measurement                     |
| Ad placeholders/config            | Partial               | `AD_CONFIG` exists but slot IDs are empty by default                        | `src/config/constants.js`, `src/components/adSlot.js`                                                                                          | Wire controlled slot management                            |
| Affiliate links                   | No clear evidence     | No explicit affiliate implementation found                                  | inspected pages + repo search                                                                                                                  | Add transparent affiliate strategy if desired              |
| Lead forms                        | Partial               | Submit-shop lead form + backend endpoint exists                             | `content/submit-shop/index.html`, `src/pages/submit-shop.js`, `server/routes/submissions.js`                                                   | Add unified lead lifecycle analytics                       |
| Newsletter                        | Partial               | Workflows and routes exist; frontend footer form depends on endpoint config | `.github/workflows/daily-newsletter.yml`, `.github/workflows/weekly-newsletter.yml`, `server/routes/newsletter.js`, `src/components/footer.js` | Consolidate end-to-end subscription path                   |
| Email capture                     | Partial               | Footer Formspree action present, endpoint empty by default                  | `src/config/constants.js` (`FORMSPREE_ENDPOINT`), `src/components/footer.js`                                                                   | Enable robust opt-in flow with explicit validation/consent |
| Monetization page                 | Yes (partial)         | Pricing page exists with tier table and CTA handlers                        | `pricing.html`                                                                                                                                 | Stripe checkout still placeholder in current UX            |
| Shop lead-generation logic        | Partial               | Directory and submit-shop flow, shortlist/actions/near-me                   | `shops.html`, `src/pages/shops.js`, `content/submit-shop/index.html`                                                                           | Add full attribution and conversion funnel                 |
| Conversion tracking               | Partial               | Event catalog and `track()` helper exist                                    | `src/lib/analytics.js`                                                                                                                         | No explicit repo-level funnel dashboard config             |
| Event tracking                    | Yes                   | Standardized events map with GA + Supabase best-effort tracking             | `src/lib/analytics.js`                                                                                                                         | Add event schema governance/tests                          |

---

## 10. Current Forms, User Input, and Lead Capture

Current form/input inventory from inspected files:

- Calculator input forms and tool controls (`calculator.html`, `src/pages/calculator.js`).
- Tracker filters/tabs/alerts/planner/export interactions (`tracker.html`,
  `src/pages/tracker-pro.js`, `src/tracker/*`).
- Shops filters/search/modal + near-me controls (`shops.html`, `src/pages/shops.js`).
- Submit-shop multistep form with required fields and status messaging
  (`content/submit-shop/index.html`, `src/pages/submit-shop.js`).
- Footer newsletter form (action endpoint configurable) (`src/components/footer.js`,
  `src/config/constants.js`).

Validation and submission behavior:

- Submit-shop has client-side validation and step gating (`src/pages/submit-shop.js`).
- Submit-shop API enforces validation, rate limits, and honeypot spam trap
  (`server/routes/submissions.js`).
- Submit-shop success/error status messages are rendered in-page (`src/pages/submit-shop.js`,
  `content/submit-shop/index.html`).
- Newsletter route endpoints exist (`/api/newsletter/*`) but completeness depends on runtime
  dependencies/config (`server/routes/newsletter.js`).

Persistence status:

- Public submit-shop writes to pending queue/repository flow, not direct publish
  (`server/routes/submissions.js`, pending-shops repository usage).
- Alerts and many preferences remain localStorage-based on frontend (`src/config/constants.js`,
  `src/lib/cache.js`, `src/tracker/state.js`).

Gaps:

- No unified form orchestration layer across all form surfaces.
- Monetization/account-related submissions remain partial in current implementation.

---

## 11. Current Shops / Directory State

Shops section current state:

- Uses fallback/static datasets (`data/shops-data.json`, `data/shops.js`) and then attempts Supabase
  live upgrade (`src/pages/shops.js`, `src/lib/supabase-data.js`).
- Supabase live query pulls `verified=true` rows from REST (`src/lib/supabase-data.js`).
- Data model includes listing-type and completeness-oriented fields (`market`, `specialties`,
  `verified`, `detailsAvailability`) (`data/shops-data.json`, `data/shops.js`,
  `src/lib/supabase-data.js`).
- UI includes filters, search, cards, modal details, shortlist, and near-me geolocation flow
  (`shops.html`, `src/pages/shops.js`).

Evidence that data includes clusters/areas, not only fully verified direct stores:

- Shop copy/labels explicitly reference “market cluster”, “market-area listing”, and informational
  listing status (`src/pages/shops.js` translation/content strings and rendering logic).
- Many static entries have blank phone/email/website fields (`data/shops-data.json`).

Coverage and relevance:

- UAE/GCC and additional regions are represented in datasets and country pages
  (`data/shops-data.json`, `countries/*`, `src/config/countries.js`).

Current weaknesses:

- Verification detail transparency is limited for end users.
- Data completeness is inconsistent across listings.
- Mixed listing types can confuse users without stronger faceting.

### 11.1 Best Future Upgrade Opportunities for Shops

- Add explicit verification metadata (method/date/source) per listing.
- Split “market clusters” and “individual verified stores” into separate primary filters.
- Add moderation workflow visibility from submission to publication.
- Add richer geo UX (distance sorting, map overlays, confidence labels).
- Add event-level analytics for map/call/website/submit conversions.

---

## 12. Current Calculator and Tools State

Current tool set:

- Gold value calculator
- Scrap calculator
- Zakat calculator
- Buying power calculator
- Unit converter

Evidence: `src/pages/calculator.js` and `calculator.html`.

Formula/source characteristics:

- Uses spot-linked calculations with karat purity and conversion constants
  (`src/lib/price-calculator.js`, `src/config/karats.js`, `src/config/constants.js`).
- Includes GCC/UAE-aware language and currency contexts (`calculator.html`,
  `src/config/countries.js`).
- Uses trust wording for spot vs retail/making charge/tax differences (`src/pages/calculator.js`,
  `methodology.html`).

Support coverage:

- Unit support includes gram, ounce, and tola patterns in calculator/home logic
  (`src/pages/calculator.js`, `src/pages/home.js`).

Current limitations:

- No clear full backend persistence/share of calculator sessions.
- No complete premium gating implementation for advanced calculator features.
- Bid/ask/spread/making/VAT are mostly trust-copy concepts, not fully modeled advanced execution
  tools.

### 12.1 Best Future Calculator/Tool Opportunities

- Add optional retail layer parameters (making charge, VAT, premium presets).
- Add shareable calculation snapshots and exports.
- Add portfolio accumulation/rebalancing calculators.
- Add compare-country/currency cost calculator using same trust labels.
- Add server-backed historical granularity for higher-fidelity scenario tools.

---

## 13. Current Mobile UX State

| Issue                                                            | Severity: High/Medium/Low | Page/File                                                                   | Suggested Future Direction                                   |
| ---------------------------------------------------------------- | ------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Tracker control density is high for small screens                | Medium                    | `tracker.html`, `src/pages/tracker-pro.js`, `styles/pages/tracker-pro.css`  | Add simplified default mode + progressive reveal             |
| Homepage scroll depth is long                                    | Medium                    | `index.html`, `styles/pages/home.css`                                       | Prioritize top intents and collapse lower-priority sections  |
| Shops filter/search interactions are dense on mobile             | Medium                    | `shops.html`, `src/pages/shops.js`, `styles/pages/shops.css`                | Add mobile filter summary chips and clearer reset/apply flow |
| Multi-tool calculator form flow can feel crowded                 | Medium                    | `calculator.html`, `src/pages/calculator.js`, `styles/pages/calculator.css` | Add stronger step cues and compact sticky summary patterns   |
| Long-tail page consistency across large route inventory can vary | Low/Medium                | `countries/*`, `content/*`, related CSS                                     | Run periodic automated viewport QA across generated pages    |
| SW behavior consistency on direct-entry pages not explicit       | Low/Medium                | `src/pages/home.js`, `sw.js`                                                | Standardize SW registration/update strategy across entries   |
| RTL edge-case mobile parity risk remains                         | Low                       | `styles/global.css` RTL sections, translations                              | Add focused RTL regression test cases for complex widgets    |

---

## 14. Current Performance State

What is currently strong:

- Build pipeline with pre-build validation/generation scripts (`package.json`, `scripts/node/*`,
  `build/generateSitemap.js`).
- Service worker strategy explicitly treats gold JSON as network-only for freshness-sensitive routes
  (`sw.js`).
- Perf and audit workflows exist (`.github/workflows/lighthouse.yml`,
  `.github/workflows/perf-check.yml`).
- Major pages use preloads/resource hints (`index.html`, `tracker.html`).

What can hurt users:

- Large global CSS surface and many page-specific styles can increase render cost.
- Third-party scripts (AdSense, analytics, Clarity) are loaded on core pages.
- Tracker/shops have high DOM and interaction complexity.
- Large route inventory increases risk of uneven optimization.

Performance-related evidence:

- `styles/global.css`, `styles/pages/*.css`
- `assets/analytics.js`
- `sw.js`
- `package.json` (`perf:ci`, `image-audit`, Playwright perf usage)

---

## 15. Current Accessibility State

Current strengths:

- Heavy use of `aria-live`/status regions on live-data pages (`index.html`, `tracker.html`,
  `calculator.html`, `shops.html`).
- EN/AR language + direction handling and broad RTL CSS support (`src/config/translations.js`,
  `styles/global.css`).
- Reduced-motion support exists in global style layer (`styles/global.css` media queries).
- Form accessibility patterns in submit-shop flow (labels, inline errors, status region)
  (`content/submit-shop/index.html`, `src/pages/submit-shop.js`).

Risks/weak points:

- Mixed legacy templating (`innerHTML` in some modules/admin) can make long-term a11y consistency
  harder.
- Complex tracker/admin interaction surfaces need ongoing keyboard/screen reader QA.
- Large page volume increases heading/landmark consistency risk.

Evidence:

- `tracker.html` (`aria-live`, `role=status`)
- `index.html` live status elements
- `content/submit-shop/index.html` + `src/pages/submit-shop.js`
- `styles/global.css` (`[dir='rtl']`, `prefers-reduced-motion`)

---

## 16. Current Testing and CI State

| Test/Workflow       | Purpose                                                 | Trigger                      | Evidence/File                                                                      | Gap                                                   |
| ------------------- | ------------------------------------------------------- | ---------------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------- | --- | --------------- |
| `npm test`          | Node test suites across core modules                    | local + CI                   | `package.json`, `tests/*.test.js`                                                  | Not every UX path is integration-covered              |
| Playwright E2E      | Browser smoke/flow tests                                | local + CI e2e job           | `package.json`, `tests/e2e/*.spec.js`, `.github/workflows/ci.yml`                  | Long-tail pages cannot all be deeply tested each run  |
| Lint/style/format   | Code quality checks                                     | local + CI                   | `package.json` (`lint`, `quality`), `.github/workflows/ci.yml`                     | Quality checks do not prove runtime behavior          |
| `npm run validate`  | Build safety checks (DOM/SEO/SW/inventory/placeholders) | local + CI                   | `package.json`, `scripts/node/*`, `.github/workflows/ci.yml`                       | Depends on strict script maintenance                  |
| Build step          | Production bundle generation                            | local + CI + deploy          | `package.json` `build`, `.github/workflows/ci.yml`, `.github/workflows/deploy.yml` | Generated artifact parity can drift if scripts change |
| CI merge gate       | Required gate with validate/quality/tests/build + E2E   | PR/push/main schedule/manual | `.github/workflows/ci.yml`                                                         | External dependencies can still cause flakiness       |
| CodeQL workflow     | Security static analysis                                | workflow trigger config      | `.github/workflows/codeql.yml`                                                     | Findings require triage/action                        |
| Lighthouse workflow | Manual performance scan                                 | workflow_dispatch            | `.github/workflows/lighthouse.yml`                                                 | Non-blocking/manual by default                        |
| Nightly link checks | Link integrity monitoring                               | scheduled                    | `.github/workflows/ci.yml` link-check job, `scripts/node/check-links.js`           | Some jobs use non-blocking `                          |     | true` semantics |
| Python lint checks  | Python script quality checks                            | CI                           | `.github/workflows/ci.yml` (`ruff`)                                                | Does not guarantee external API/runtime success       |

Likely coverage gaps:

- End-to-end Stripe billing lifecycle.
- Fully integrated newsletter subscriber lifecycle.
- Systematic long-tail page semantic/UX checks at scale.

---

## 17. Current Deployment / Domain / Hosting State

Deployment/domain facts from repository files:

- Custom domain is configured as `goldtickerlive.com` (`CNAME`).
- Deploy workflow publishes from `main` to GitHub Pages (`.github/workflows/deploy.yml`).
- Deploy pipeline builds static output and deploys Pages artifact (`.github/workflows/deploy.yml`,
  `package.json`).
- `robots.txt` references `https://goldtickerlive.com/sitemap.xml` (`robots.txt`).
- Secrets/env assumptions include provider keys, Twitter/X tokens, Supabase credentials, and admin
  auth secrets (`.env.example`, workflow env blocks, `server/lib/auth.js`).

Important caveats:

- `server.js` is a real backend runtime path, but default deployment workflow is static
  Pages-oriented.
- `sitemap.xml` and `feed.xml` references exist in code, but those files were not present in root
  listing at audit time; generation appears build/deploy driven (`build/generateSitemap.js`,
  `index.html` feed link).

Potential old reference risk:

- Legacy naming remains in some docs/internal comments (section 18 table).

---

## 18. Current Brand/Rebrand State

| Old/Inconsistent Reference                                   | File                                                                                                         | Context                                                  | Suggested Future Fix                                   |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------- | ------------------------------------------------------ |
| Legacy “Gold-Prices” wording in docs                         | `README.md`, `docs/ARCHITECTURE.md`, `docs/DESIGN_TOKENS.md`, `docs/ACCESSIBILITY.md`, `docs/PERFORMANCE.md` | Mixed old brand terms in documentation                   | Run controlled docs brand consistency pass             |
| Legacy seeded admin email domain                             | `server/lib/auth.js` (`admin@goldprices.com`)                                                                | Internal default account metadata still old domain       | Update to `goldtickerlive`-aligned seed value          |
| Legacy naming references in code comments/constants/routes   | `src/config/constants.js`, `src/routes/routeRegistry.js`, `src/utils/routeBuilder.js`                        | Internal historical references can cause drift/confusion | Normalize non-sensitive internal naming over time      |
| Historic legacy references in reports/audits                 | `docs/REPO_AUDIT.md`, `docs/REBRAND_VERIFICATION_REPORT.md`, `reports/*.md`                                  | Historical artifacts include old terms intentionally     | Keep as history but annotate as legacy context         |
| Possible residual old URL/name mentions in long-tail content | `content/guides/*`, some generated/legacy pages                                                              | Long-tail text maintenance can leave stale branding      | Run targeted grep + fix pass for user-facing leftovers |

Overall rebrand status: primary public pages are largely Gold Ticker Live branded, but residual
legacy references remain in docs/internal/history surfaces.

---

## 19. Integration Opportunities

### 19.1 Backend/API Integrations

| Opportunity                            | Current Gap                                         | Suggested Integration                                         | Difficulty | Business Value |
| -------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------- | ---------- | -------------- |
| Price API proxy with freshness headers | Frontend relies on static JSON + direct FX API      | Add backend `/api/prices` proxy/cache with freshness metadata | Medium     | High           |
| Provider health endpoint               | Provider state mostly workflow/internal file-driven | Expose read-only provider health/status route                 | Medium     | High           |
| Historical snapshot API                | History currently mixed baseline/local cache        | Persist snapshots server-side and expose query API            | Medium     | High           |
| Structured runtime logs API            | Operational details spread across logs/files        | Add structured log storage and admin retrieval                | Medium     | Medium         |

### 19.2 Database Integrations

| Opportunity                             | Current Gap                                           | Suggested Integration                                    | Difficulty | Business Value |
| --------------------------------------- | ----------------------------------------------------- | -------------------------------------------------------- | ---------- | -------------- |
| `price_snapshots` table                 | No clear long-range canonical DB history for frontend | Add durable snapshot ingestion and retention             | Medium     | High           |
| Alerts tables                           | Alerts are mostly localStorage                        | Add server-backed alerts/preferences and delivery status | Medium     | High           |
| Shops moderation lifecycle tables       | Mixed fallback/live model with pending submissions    | Normalize submit-review-publish lifecycle in DB          | Medium     | High           |
| Newsletter subscriber governance tables | Routes/workflows exist but maturity mixed             | Consolidate opt-in/out/preferences/audit tables          | Medium     | Medium         |

### 19.3 Authentication / User Accounts

| Opportunity                   | Current Gap                                           | Suggested Integration                      | Difficulty | Business Value |
| ----------------------------- | ----------------------------------------------------- | ------------------------------------------ | ---------- | -------------- |
| Public user auth              | Admin auth exists but public account layer is partial | Implement user auth for saved alerts/tools | Medium     | High           |
| Saved calculations/watchlists | No durable public-user save path                      | Add per-user saved calculators/favorites   | Medium     | Medium         |
| Preference sync               | Preferences mostly localStorage-based                 | Add cloud-synced preferences per account   | Medium     | Medium         |

### 19.4 Notifications

| Opportunity                   | Current Gap                                     | Suggested Integration                                   | Difficulty | Business Value |
| ----------------------------- | ----------------------------------------------- | ------------------------------------------------------- | ---------- | -------------- |
| Email price alerts            | No robust server-side user alert engine         | Add threshold-triggered email alerts with confirmations | Medium     | High           |
| WhatsApp/Telegram user alerts | Social posting exists, user alerts not complete | Add opt-in channel notifications per user               | High       | High           |
| Browser push notifications    | No documented push infra for users              | Add Web Push subscriptions and campaigns                | High       | Medium         |
| X automation control center   | Posting logic lives in workflow/scripts         | Build admin-facing run/guard dashboard                  | Medium     | Medium         |

### 19.5 Analytics / Growth

| Opportunity                          | Current Gap                                    | Suggested Integration                            | Difficulty | Business Value |
| ------------------------------------ | ---------------------------------------------- | ------------------------------------------------ | ---------- | -------------- |
| Funnel dashboarding                  | Events exist but funnel reporting not explicit | Build GA/warehouse funnels for key journeys      | Medium     | High           |
| SEO landing performance segmentation | Large route network with varying quality       | Track performance by template/locale/page family | Medium     | High           |
| Event schema governance              | Event map exists but governance can tighten    | Versioned event schema + QA checks in CI         | Low        | Medium         |

### 19.6 Monetization

| Opportunity                  | Current Gap                                       | Suggested Integration                           | Difficulty | Business Value |
| ---------------------------- | ------------------------------------------------- | ----------------------------------------------- | ---------- | -------------- |
| Stripe checkout completion   | Pricing UX currently placeholder for checkout     | Complete checkout + webhook + entitlement flow  | High       | High           |
| Sponsored listings framework | Shops directory exists without full sponsor model | Add explicit sponsored slots + disclosure flags | Medium     | High           |
| Premium alerts/products      | Subscription logic mostly scaffolded              | Tie feature limits to active plans              | Medium     | High           |
| API access monetization      | Pricing mentions API tiers                        | Build API key issuance, quota, billing linkage  | High       | High           |

### 19.7 Admin / CMS

| Opportunity                   | Current Gap                                    | Suggested Integration                           | Difficulty | Business Value |
| ----------------------------- | ---------------------------------------------- | ----------------------------------------------- | ---------- | -------------- |
| Unified content CMS           | Content spans many static files                | Add admin-managed content publish pipeline      | High       | High           |
| SEO metadata manager          | Metadata scattered across templates/files      | Central metadata registry + generation workflow | Medium     | High           |
| Provider operations panel     | Provider/fallback state mostly workflow-driven | Admin panel for provider status/order controls  | Medium     | High           |
| Extended immutable audit logs | Existing audit logic can be broadened          | Add richer immutable logs for critical edits    | Medium     | Medium         |

### 19.8 AI / Automation

| Opportunity                      | Current Gap                                   | Suggested Integration                          | Difficulty | Business Value |
| -------------------------------- | --------------------------------------------- | ---------------------------------------------- | ---------- | -------------- |
| Daily bilingual market summaries | Insights generation not fully automated       | AI-assisted summaries with editorial review    | Medium     | High           |
| SEO content brief automation     | Large content footprint needs upkeep          | Generate priority briefs by page cluster       | Medium     | Medium         |
| Provider anomaly detection       | Fallback exists, anomaly UX limited           | Add anomaly scoring + operator alerts          | Medium     | High           |
| Social copy QA automation        | X pipeline is robust but copy QA manual-heavy | Add trust-wording/duplication/length QA checks | Medium     | Medium         |

---

## 20. Recommended Next Roadmap

### Phase 1 — Stabilize Current Site

| Task                                           | Reason                                | Files Likely Affected                                                             | Risk       | Verification                  |
| ---------------------------------------------- | ------------------------------------- | --------------------------------------------------------------------------------- | ---------- | ----------------------------- |
| Resolve top legacy naming/documentation drift  | Improve trust and contributor clarity | docs + selected UI copy files                                                     | Low        | grep + lint + SEO tests       |
| Normalize trust labels on top traffic pages    | Reduce spot-vs-retail ambiguity       | `index.html`, `tracker.html`, `calculator.html`, `methodology.html`, translations | Medium     | copy QA + regression tests    |
| Mobile UX cleanup for tracker/shops/calculator | Improve usability and retention       | page CSS + page scripts                                                           | Medium     | Playwright mobile + manual QA |
| Clarify partial monetization UX states         | Avoid user confusion                  | `pricing.html`, footer/newsletter messaging                                       | Low/Medium | smoke tests + lint            |

### Phase 2 — Data Reliability and API Layer

| Task                                         | Reason                                     | Files Likely Affected               | Risk   | Verification                         |
| -------------------------------------------- | ------------------------------------------ | ----------------------------------- | ------ | ------------------------------------ |
| Add provider health endpoint                 | Operational transparency and faster triage | `server/routes/*`, provider scripts | Medium | API tests + workflow dry runs        |
| Add persistent snapshot store/API            | Better historical reliability and analysis | scripts + db + backend              | Medium | integration tests + data validation  |
| Strengthen stale/fallback operational alerts | Faster detection of data degradation       | workflows + scripts                 | Medium | simulated failures + workflow checks |

### Phase 3 — User-Facing Growth Features

| Task                                      | Reason                            | Files Likely Affected                               | Risk   | Verification                         |
| ----------------------------------------- | --------------------------------- | --------------------------------------------------- | ------ | ------------------------------------ |
| Launch server-backed alerts               | Increase engagement and utility   | tracker UI + backend/db                             | High   | end-to-end tests + alert simulations |
| Expand calculator realism options         | Improve practical value for users | `src/pages/calculator.js`, methodology/translations | Medium | formula tests + UX tests             |
| Improve country/content quality standards | Protect SEO quality at scale      | `countries/*`, `content/*`, SEO scripts             | Medium | SEO/unit checks + link audits        |

### Phase 4 — Admin, Database, and Monetization

| Task                                      | Reason                                      | Files Likely Affected                                                               | Risk   | Verification                |
| ----------------------------------------- | ------------------------------------------- | ----------------------------------------------------------------------------------- | ------ | --------------------------- |
| Complete Stripe + entitlement enforcement | Turn pricing into a functional revenue path | `pricing.html`, `server/routes/stripe.js`, `server/lib/subscriptions.js`, DB schema | High   | integration + webhook tests |
| Formalize shops lead pipeline             | Increase directory business value           | shops/admin/submissions/db files                                                    | Medium | moderation flow tests       |
| Build analytics funnel reporting          | Data-driven product growth decisions        | analytics libs + reports/docs                                                       | Medium | event QA + dashboard checks |

### Phase 5 — Advanced Automation

| Task                                | Reason                                 | Files Likely Affected             | Risk        | Verification                         |
| ----------------------------------- | -------------------------------------- | --------------------------------- | ----------- | ------------------------------------ |
| AI-assisted market summary workflow | Scale insights with editorial controls | scripts + content/admin workflow  | Medium/High | editorial QA + policy checks         |
| Notification engine expansion       | Retention and monetization growth      | backend/jobs/db + UI prefs        | High        | staged rollout + delivery metrics    |
| Automation observability dashboard  | Reduce ops blind spots                 | workflows/scripts/admin/reporting | Medium      | synthetic monitoring + runbook tests |

---

## 21. Top 30 Specific Action Items

| Rank | Action                                                       | Category      | Why It Matters                                          | Likely Files                                                             | Difficulty | Business Value |
| ---- | ------------------------------------------------------------ | ------------- | ------------------------------------------------------- | ------------------------------------------------------------------------ | ---------- | -------------- |
| 1    | Complete Stripe checkout + webhook + entitlements            | monetization  | Converts pricing surface into real revenue path         | `pricing.html`, `server/routes/stripe.js`, `server/lib/subscriptions.js` | High       | High           |
| 2    | Build server-backed alerts                                   | backend       | Moves critical user feature beyond local device state   | `src/tracker/*`, backend/db                                              | High       | High           |
| 3    | Add provider health/status API                               | data          | Improves data trust and operator response speed         | provider scripts + backend routes                                        | Medium     | High           |
| 4    | Persist historical snapshots in DB                           | data          | Enables better charts and analytics                     | scripts/db/api                                                           | Medium     | High           |
| 5    | Unify trust copy on core price pages                         | frontend      | Prevents retail/spot confusion                          | core pages + translations                                                | Low        | High           |
| 6    | Standardize shops verification UX                            | frontend      | Clarifies listing quality and trust                     | `src/pages/shops.js`, shops data/schema                                  | Medium     | High           |
| 7    | Implement conversion funnel analytics                        | analytics     | Enables growth optimization decisions                   | `src/lib/analytics.js`, reports                                          | Medium     | High           |
| 8    | Simplify tracker first-run UX                                | frontend      | Reduces complexity drop-off                             | `tracker.html`, `src/pages/tracker-pro.js`                               | Medium     | High           |
| 9    | Consolidate newsletter lifecycle                             | backend       | Converts partial newsletter pieces into reliable system | newsletter routes/workflows/footer                                       | Medium     | Medium         |
| 10   | Normalize SW registration strategy                           | performance   | Improves offline/update consistency                     | page entry scripts + `sw.js`                                             | Medium     | Medium         |
| 11   | Add SEO anti-thin CI checks for long-tail pages              | SEO           | Protects ranking quality at scale                       | SEO scripts/tests + page templates                                       | Medium     | High           |
| 12   | Track directory conversion events                            | analytics     | Measures shops business impact                          | shops page + analytics module                                            | Medium     | High           |
| 13   | Add sponsored listing system with disclosure                 | monetization  | Monetizes shops safely                                  | shops/admin/db                                                           | Medium     | High           |
| 14   | Build API key/usage plan system                              | backend       | Supports API monetization tier                          | backend/db/admin                                                         | High       | High           |
| 15   | Add calculator snapshot sharing                              | frontend      | Increases utility and shareability                      | `src/pages/calculator.js`                                                | Medium     | Medium         |
| 16   | Add Arabic content quality review pipeline                   | SEO           | Improves Arabic trust and rankings                      | `content/*`, translations, QA scripts                                    | Medium     | High           |
| 17   | Continue public `innerHTML` reduction                        | accessibility | Improves safety and long-term consistency               | `src/pages/shops.js`, shared components                                  | Medium     | Medium         |
| 18   | Expand admin security hardening audit                        | backend       | Reduces auth/config risk                                | `server.js`, `server/lib/auth.js`, admin assets                          | Medium     | High           |
| 19   | Add listing completeness score                               | data          | Improves shops data quality signals                     | shops datasets/admin UI                                                  | Medium     | Medium         |
| 20   | Validate sitemap/feed artifact presence in CI                | SEO           | Prevents crawl-source regressions                       | build scripts/tests                                                      | Low        | Medium         |
| 21   | Add stale/fallback UI contract tests                         | data          | Protects trust labels from regressions                  | tracker/home tests                                                       | Medium     | High           |
| 22   | Improve near-me fallback UX                                  | frontend      | Better mobile utility in shops flow                     | `src/pages/shops.js`, shops UI                                           | Low/Medium | Medium         |
| 23   | Complete docs brand consistency pass                         | docs          | Reduces contributor confusion and drift                 | docs + README                                                            | Low        | Medium         |
| 24   | Add public account preference sync                           | backend       | Better multi-device experience                          | auth/profile APIs + frontend                                             | Medium     | Medium         |
| 25   | Add provider divergence alert workflow                       | automation    | Early warning on bad pricing inputs                     | python scripts + workflows                                               | Medium     | High           |
| 26   | Add admin moderation dashboard enhancements                  | admin         | Improves lead processing velocity                       | `admin/shops/*`, server routes/repos                                     | Medium     | High           |
| 27   | Add compliance copy checklist in CI/docs                     | frontend      | Reduces misleading financial wording risk               | docs + content checks                                                    | Low        | High           |
| 28   | Expand API integration tests (stripe/newsletter/submissions) | backend       | Raises confidence for partial backend features          | tests + server routes                                                    | Medium     | High           |
| 29   | Add X automation health dashboard/report                     | automation    | Reduces posting incident triage time                    | workflows/scripts/reports                                                | Medium     | Medium         |
| 30   | Create compact calculator bridge inside shops page           | frontend      | Improves cross-page conversion                          | `shops.html`, `src/pages/shops.js`                                       | Medium     | Medium         |

---

## 22. Risks and Warnings

- Pricing/math constants and purity logic are trust-critical and should not be casually changed
  (`src/config/constants.js`, `src/config/karats.js`, `src/lib/price-calculator.js`).
- Stale/fallback labeling regressions can mislead users if freshness context is weakened
  (`data/gold_price.json`, `src/lib/live-status.js`, core pages).
- SEO duplication/thin content risk is inherent in large template-generated networks (`countries/*`,
  `content/*`).
- Arabic/RTL regressions can ship easily due to broad bilingual surface.
- Service worker/cache behavior can accidentally surface stale UX if modified incorrectly (`sw.js`,
  cache logic).
- Heavy operational dependence on scheduled workflows means failures directly affect data
  freshness/social automation.
- Provider and social secrets are operationally sensitive; poor secret hygiene can break production
  pipelines.
- X/Twitter duplicate/policy behavior can still fail despite guard logic
  (`scripts/python/tweet_guard.py`, `scripts/python/post_gold_price.py`).
- Misleading financial wording risk remains if “spot reference” disclaimers are diluted.
- Static architecture limits real-time/account-native behavior without backend expansion.
- Admin/auth configuration errors can create high-impact security exposure (`server/lib/auth.js`,
  admin APIs).
- Incomplete monetization/payment integrations can create user trust risk if surfaced as fully live.

---

## 23. Questions for the Owner

### backend

1. Should the Express backend become a primary production runtime or remain optional behind static
   Pages delivery?
2. Which API capability is highest priority first: health/status, historical data, alerts, or shops
   moderation?

### data providers

3. Is the current provider order in `gold-price-fetch.yml` final, or still in staged bakeoff mode?
4. What hard freshness SLA should block or downgrade user-visible outputs?

### alerts

5. Should alerts stay local-storage-only short term, or move immediately to account-backed
   multi-device alerts?
6. Which channels should launch first for alerts: email, push, WhatsApp, Telegram?

### database

7. Is Supabase intended as canonical storage for alerts/subscriptions/history, or only for
   shops/admin needs?
8. Do you want immutable audit logging for all high-impact admin/data changes?

### monetization

9. Should pricing page remain visible before Stripe/entitlements are fully implemented?
10. Which monetization track should be first: subscriptions, sponsored listings, API plans, or ad
    optimization?

### shops

11. Should market clusters and individual shops be split into separate default browse modes?
12. What explicit verification standard should drive `verified` UI badges?

### analytics

13. Which top 3 conversion events matter most for weekly reporting?
14. Do you want analytics to stay in GA/Clarity only, or add warehouse/BI export soon?

### SEO

15. Is Arabic depth improvement higher priority than adding additional country/city pages?
16. Should SEO quality checks become stricter merge blockers for long-tail content templates?

### admin panel

17. Which admin modules are must-have for near-term operations (shops moderation, provider status,
    content edits, pricing controls)?
18. Are current admin roles sufficient, or is finer-grained RBAC required?

### deployment

19. Will deployment remain GitHub Pages-centric, or do you plan dedicated backend hosting soon?
20. Should generated `sitemap.xml`/`feed.xml` be committed in repo or only generated during
    build/deploy?

### budget

21. What budget is available for provider APIs, notification delivery, and backend hosting in next 6
    months?
22. Are paid observability/email/analytics tools acceptable in near term?

### compliance/trust wording

23. Do you want formal compliance review for all financial wording before scaling monetization?
24. Should every price surface include a mandatory “spot-based reference, not retail quote” badge?

---

## 24. Files Inspected

| File/Directory                                                                                                                    | Why It Matters                                             |
| --------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `package.json`                                                                                                                    | Script/dependency/build/test source of truth               |
| `index.html`                                                                                                                      | Homepage UX, trust copy, SEO, analytics tags               |
| `tracker.html`                                                                                                                    | Core tracker structure, accessibility, metadata            |
| `calculator.html`                                                                                                                 | Calculator surfaces and metadata                           |
| `shops.html`                                                                                                                      | Directory UI and lead flow hooks                           |
| `learn.html`                                                                                                                      | Educational content/metadata structure                     |
| `insights.html`                                                                                                                   | Insights surface and metadata                              |
| `methodology.html`                                                                                                                | Data transparency/trust explanation                        |
| `invest.html`                                                                                                                     | Additional product route/content                           |
| `pricing.html`                                                                                                                    | Monetization UX maturity                                   |
| `privacy.html`, `terms.html`                                                                                                      | Legal page baseline                                        |
| `offline.html`, `404.html`                                                                                                        | Utility/error/offline behavior                             |
| `robots.txt`                                                                                                                      | Crawl/index directives                                     |
| `manifest.json`                                                                                                                   | PWA metadata/shortcuts                                     |
| `sw.js`                                                                                                                           | Service worker strategy and cache policy                   |
| `CNAME`                                                                                                                           | Custom domain configuration                                |
| `data/gold_price.json`                                                                                                            | Canonical live-price payload schema                        |
| `data/last_gold_price.json`                                                                                                       | Last price state artifact                                  |
| `data/last_tweet_state.json`                                                                                                      | Posting guard state artifact                               |
| `data/provider_state.json`                                                                                                        | Provider circuit breaker/state                             |
| `data/shops-data.json`, `data/shops.js`                                                                                           | Directory static/fallback data structures                  |
| `src/config/constants.js`                                                                                                         | Constants, cache keys, ads/newsletter config placeholders  |
| `src/config/karats.js`                                                                                                            | Karat purity definitions                                   |
| `src/config/countries.js`                                                                                                         | Country/city/currency coverage                             |
| `src/config/translations.js`                                                                                                      | EN/AR translation and trust-label inventory                |
| `src/config/supabase.js`                                                                                                          | Supabase wiring in frontend                                |
| `src/lib/api.js`                                                                                                                  | Frontend fetch/retry/error behavior                        |
| `src/lib/cache.js`                                                                                                                | Frontend cache/fallback behavior                           |
| `src/lib/price-calculator.js`                                                                                                     | Core price calculation routines                            |
| `src/lib/formatter.js`                                                                                                            | Price/currency formatting behavior                         |
| `src/lib/live-status.js`                                                                                                          | Freshness/market-state logic                               |
| `src/lib/safe-dom.js`                                                                                                             | DOM safety utility policy                                  |
| `src/lib/supabase-data.js`                                                                                                        | Shops live fetch behavior                                  |
| `src/lib/analytics.js`                                                                                                            | Event catalog + tracking dispatch                          |
| `src/pages/home.js`                                                                                                               | Homepage orchestration + SW registration                   |
| `src/pages/tracker-pro.js`                                                                                                        | Tracker runtime logic                                      |
| `src/pages/calculator.js`                                                                                                         | Calculator runtime logic                                   |
| `src/pages/shops.js`                                                                                                              | Directory runtime logic, near-me, supabase upgrade         |
| `src/pages/submit-shop.js`                                                                                                        | Submit-shop form logic/validation/submission               |
| `src/tracker/*`                                                                                                                   | Tracker modular state/render/events architecture           |
| `src/components/nav.js`, `footer.js`, `ticker.js`, `spotBar.js`, `breadcrumbs.js`                                                 | Shared shell and trust UX surfaces                         |
| `styles/global.css`                                                                                                               | Tokens, responsive primitives, RTL, reduced motion         |
| `styles/pages/*.css`                                                                                                              | Page-specific visual behavior                              |
| `countries/`                                                                                                                      | Country/city/market SEO page network                       |
| `content/`                                                                                                                        | Guides/news/tools/submit-shop content network              |
| `admin/`                                                                                                                          | Admin frontend implementation surfaces                     |
| `server.js`                                                                                                                       | Backend middleware/routing/static delivery                 |
| `server/routes/admin/index.js`                                                                                                    | Admin API behavior and protections                         |
| `server/routes/submissions.js`                                                                                                    | Public lead submission API behavior                        |
| `server/routes/newsletter.js`                                                                                                     | Newsletter route maturity                                  |
| `server/routes/stripe.js`                                                                                                         | Stripe route maturity and TODO status                      |
| `server/lib/auth.js`                                                                                                              | Auth env requirements and token model                      |
| `server/lib/subscriptions.js`                                                                                                     | Subscription feature scaffolding                           |
| `.github/workflows/ci.yml`                                                                                                        | Required CI merge gate details                             |
| `.github/workflows/deploy.yml`                                                                                                    | Deployment setup details                                   |
| `.github/workflows/gold-price-fetch.yml`                                                                                          | Gold data refresh workflow                                 |
| `.github/workflows/post_gold.yml`                                                                                                 | X/Twitter automation workflow                              |
| `.github/workflows/spike_alert.yml`                                                                                               | Spike-alert automation                                     |
| `.github/workflows/lighthouse.yml`                                                                                                | Performance audit workflow                                 |
| `.github/workflows/daily-newsletter.yml`, `weekly-newsletter.yml`                                                                 | Newsletter automation workflows                            |
| `.github/workflows/sync-db-to-git.yml`                                                                                            | DB-to-git sync automation                                  |
| `.github/workflows/README.md`                                                                                                     | Workflow tiering and purpose map                           |
| `scripts/python/fetch_gold_price.py`                                                                                              | Provider orchestration and fallback/staleness logic        |
| `scripts/python/post_gold_price.py`                                                                                               | X posting logic, guards, templates                         |
| `scripts/python/tweet_guard.py`                                                                                                   | Duplicate/cooldown state guard                             |
| `scripts/python/gold_providers/registry.py`                                                                                       | Supported provider list                                    |
| `scripts/node/check-unsafe-dom.js`                                                                                                | Unsafe DOM sink regression control                         |
| `build/generateSitemap.js`                                                                                                        | Sitemap generation logic                                   |
| `tests/*.test.js`                                                                                                                 | Unit/integration test coverage                             |
| `tests/e2e/*.spec.js`                                                                                                             | Browser/E2E coverage surfaces                              |
| `supabase/schema.sql`                                                                                                             | DB schema and policy intent                                |
| `docs/REVAMP_PLAN.md`, `docs/ARCHITECTURE.md`, `docs/AUTOMATIONS.md`, `docs/REPO_AUDIT.md`, `docs/REBRAND_VERIFICATION_REPORT.md` | Existing planning/audit context and potential drift points |

---
