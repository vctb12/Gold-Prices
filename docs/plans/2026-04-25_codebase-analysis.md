# Codebase Analysis — 2026-04-25

```yaml plan-status
status: not-started
priority: P2
class: A
owner: @vctb12
last_run_at: ""
last_run_pr: ""
last_run_agent: copilot
slices_remaining_estimate: 0
next_action: ""
blocked_on: ""
guardrails_reviewed: true
skills_used: []
```

> **Status (2026-04-27-round7):** W-1, W-3, W-4, W-7, W-8 resolved in round 7 (this PR).
>
> - W-1 — `page-hydrator.js` all 3 `innerHTML` sinks → `safe-dom` `el()` / `replaceChildren()`;
>   baseline 3→0.
> - W-3 — `getFXFreshness()` + `FX_MARKET` constants added to `live-status.js`; test added.
> - W-4 — `server/lib/fs-atomic.js` atomic write helper created; `auth.js`, `shops.repository.js`,
>   `audit.repository.js`, `audit-log.js`, `shop-manager.js` updated. Tests in
>   `tests/fs-atomic.test.js`.
> - W-7 — `tests/supabase-data.test.js` covers mapRow, network error, 401, empty rows, missing
>   fields.
> - W-8 — `tests/e2e/calculator.spec.js` and `tests/e2e/shops-search.spec.js` added.
> - Track D Phase 12 — `render.js` all 10 remaining `innerHTML` sinks (planner results + SVG chart)
>   fully migrated; baseline 10→0.
>
> **Previously resolved (2026-04-27):** W-2, W-6, W-9, W-10, W-11, W-12, W-14.
>
> **Resolved (2026-04-28 Round 9):** W-5 (freshness-coverage test added).
>
> **Remaining tracked work:** W-13 — queued in `docs/REVAMP_PLAN.md`.

This document captures a four-part read-only analysis of the Gold Ticker Live repository:

1. [Repository overview](#1-repository-overview)
2. [Data flow trace](#2-data-flow-trace)
3. [External dependencies](#3-external-dependencies)
4. [Weak spots and technical debt](#4-weak-spots-and-technical-debt)

No code is changed in this document. Each finding cites a file path or workflow. Proposed actions
are framed as future plan-PR candidates, not silent changes.

---

## 1. Repository overview

### Purpose

**Gold Ticker Live** (`goldtickerlive.com`) is a bilingual (EN / AR) static multi-page website that
publishes reference gold-price data for GCC, Levant, Africa, and global markets. It offers:

- Live gold spot prices (XAU/USD, converted to 24+ local currencies at 7 karat grades)
- A full-featured gold tracker (`tracker.html`) with chart, comparison, archive, alert, and export
  modes
- A price calculator, shops directory, investment guide, guides, FAQs, and a submit-shop flow
- 400+ pre-generated country / city / karat leaf pages hydrated with live data at runtime
- Hourly X (Twitter) posts and email newsletters driven by GitHub Actions automation

The site targets the Gulf Arab consumer market. All user-visible copy ships in English and Arabic
with full RTL layout support.

### Key technologies

| Layer          | Technology                                                                                        |
| -------------- | ------------------------------------------------------------------------------------------------- |
| Frontend       | Vanilla ES6 modules — no framework; Vite 8 for production bundle                                  |
| Styling        | Hand-authored CSS with design tokens (`styles/global.css`); per-page CSS under `styles/pages/`    |
| Backend (opt.) | Node/Express 5 — JWT + bcrypt auth, Helmet, CORS, rate limiting, flat-JSON + Supabase persistence |
| Python auto.   | `scripts/python/` — tweepy, supabase-py, requests; linted with ruff                               |
| Testing        | node:test (23 suites, ~200+ assertions) + Playwright E2E                                          |
| CI/CD          | 13 GitHub Actions workflows; only `ci.yml` gates merges                                           |
| Hosting        | GitHub Pages (`goldtickerlive.com`); optional Replit/Express for admin                            |
| Admin          | Static HTML admin panel backed by Supabase GitHub OAuth                                           |
| Fonts          | Google Fonts — Cairo (all weights: 300/400/600/700/800)                                           |
| Analytics      | Google Analytics 4 (`G-K3GNY9M8TE`) + Microsoft Clarity (`w4e0nhdxt5`)                            |
| Ads            | Google AdSense (`ca-pub-8578581906562588`) — slots configured but publisher IDs not yet active    |

### Folder structure

```
/
├── index.html, tracker.html, calculator.html, shops.html, invest.html, …
│   → ~12 public root pages (entry HTML, each loads a src/pages/*.js module)
│
├── content/
│   ├── guides/       → 7 educational guides
│   ├── tools/        → 3 interactive tools
│   ├── search/       → search UI
│   ├── social/       → X-post generator
│   ├── order-gold/   → ordering info page
│   └── …others       → FAQ, news, newsletter, embed widget, compare, todays-best-rates
│
├── countries/
│   └── {slug}/index.html  → 15 country pages + 50+ city pages + karat-specific leaf pages
│                             (all runtime-hydrated by page-hydrator.js)
│
├── src/
│   ├── components/   → nav.js, footer.js, ticker.js, spotBar.js, chart.js, breadcrumbs.js, adSlot.js
│   ├── config/       → constants.js, countries.js, karats.js, translations.js, supabase.js
│   ├── lib/          → api.js, cache.js, formatter.js, live-status.js, page-hydrator.js,
│   │                   price-calculator.js, safe-dom.js, freshness-pulse.js, reveal.js, …
│   ├── pages/        → home.js, tracker-pro.js, calculator.js, shops.js, insights.js, …
│   ├── tracker/      → state.js, modes.js, ui-shell.js, wire.js, events.js, render.js, …
│   ├── search/       → search module
│   ├── seo/          → SEO helpers
│   ├── social/       → social sharing
│   ├── routes/       → client-side routing helpers
│   └── utils/        → shared utilities
│
├── styles/
│   ├── global.css    → ~17,000 lines; design tokens + primitives + motion + component styles
│   └── pages/        → per-page CSS (16 files)
│
├── server/ + server.js  → Express 5 admin API (JWT, bcrypt, Helmet, CORS, rate limiting)
│   ├── lib/          → auth.js, audit-log.js, site-url.js, circuit-breaker.js, supabase-client.js
│   ├── repositories/ → file + Supabase storage adapters
│   ├── routes/       → admin, newsletter, stripe
│   └── services/     → background services
│
├── scripts/
│   ├── node/         → 33 build/validation/audit/enrichment scripts
│   └── python/       → post_gold_price.py, gold_poster.py, utils/* (price_fetcher, tweet_formatter, …)
│
├── data/
│   ├── gold_price.json      → live gold spot data committed every 15 min by CI
│   ├── last_gold_price.json → X-bot state file (last posted price)
│   └── shops-data.json      → curated shops directory
│
├── admin/            → static admin panel HTML (Supabase GitHub OAuth)
├── tests/            → 23 node:test suites + tests/e2e/ Playwright specs
├── .github/workflows/ → 13 CI/automation workflows
└── docs/             → reference docs, master plan, plans/ intake
```

### Entry points

| Entry point                                   | Loaded by                               | Purpose                                 |
| --------------------------------------------- | --------------------------------------- | --------------------------------------- |
| `index.html` → `src/pages/home.js`            | Browser                                 | Homepage — hero price card + GCC grid   |
| `tracker.html` → `src/pages/tracker-pro.js`   | Browser                                 | Full tracker (5 modes, chart, alerts)   |
| `calculator.html` → `src/pages/calculator.js` | Browser                                 | Price calculator                        |
| `shops.html` → `src/pages/shops.js`           | Browser                                 | Shops directory                         |
| `countries/*/index.html`                      | Browser → `src/lib/page-hydrator.js`    | All country/city/karat leaf pages       |
| `server.js`                                   | Node                                    | Express admin API (optional, non-Pages) |
| `scripts/python/post_gold_price.py`           | GitHub Actions (`post_gold.yml`)        | Hourly X-post bot                       |
| `scripts/fetch_gold_price.py`                 | GitHub Actions (`gold-price-fetch.yml`) | Gold price data refresh                 |

### Build and deploy flow

```
┌─ npm run build ────────────────────────────────────────────────────────────┐
│  1. extract-baseline.js   — snapshot DOM-safety sink counts                │
│  2. normalize-shops.js    — normalize data/shops-data.json                 │
│  3. inject-schema.js      — inject JSON-LD schema into HTML pages          │
│  4. build/generateSitemap.js — generate sitemap.xml                        │
│  5. vite build            — bundle src/ → dist/                            │
└────────────────────────────────────────────────────────────────────────────┘

┌─ deploy.yml (GitHub Actions, triggered on push to main) ───────────────────┐
│  1. npm run validate      — DOM-safety, SEO meta, placeholder, analytics,  │
│                             inventory-seo, inject-schema --check            │
│  2. npm run build         — full production build                           │
│  3. generate-sitemap.js   — regenerate sitemap (not committed to repo)      │
│  4. check-sitemap-coverage.js — enforce coverage gate                       │
│  5. generate-rss.js       — produce feed.xml                                │
│  6. copy statics          — sw.js, assets/, src/, data/, styles/, admin/,  │
│                             countries/, content/ → dist/                    │
│  7. Upload dist/ → GitHub Pages                                             │
└────────────────────────────────────────────────────────────────────────────┘

┌─ gold-price-fetch.yml (every 15 min) ──────────────────────────────────────┐
│  python scripts/fetch_gold_price.py  (source: goldpricez.com)              │
│  → commits data/gold_price.json if changed  [skip ci]                      │
└────────────────────────────────────────────────────────────────────────────┘

┌─ post_gold.yml (hourly, market hours) ─────────────────────────────────────┐
│  python scripts/python/post_gold_price.py                                  │
│  → posts to X / Twitter, commits data/last_gold_price.json                 │
└────────────────────────────────────────────────────────────────────────────┘
```

### Unusual or non-obvious aspects

1. **Gold data served as a committed file, not a live API call from the browser.**
   `data/gold_price.json` is written by a GitHub Actions workflow every 15 min and committed to the
   repo. The browser fetches the same-origin static file, not a third-party API. This eliminates
   CORS issues and API-key exposure in the browser, at the cost of data being up to 15 min stale.

2. **Dual module system.** Root `package.json` is `"type": "commonjs"` (Node scripts);
   `src/package.json` is `"type": "module"` (browser ES modules). The ESLint config enforces that
   `src/**` cannot import from `server/**`.

3. **AED hardcoded peg.** The UAE Dirham exchange rate (`3.6725 AED/USD`) is a compile-time constant
   in `src/config/constants.js`. The FX API response's AED rate is deleted before use, so the
   central bank peg can never be accidentally overridden.

4. **Admin panel is separate from the static site.** `admin/` is static HTML with Supabase GitHub
   OAuth. It talks to the Express server (`server.js`) via `/api/admin` routes. GitHub Pages serves
   the admin HTML, but the API must run on a separate host (Replit or similar).

5. **Services layer coexists with a legacy `lib/api.js`.** `src/lib/api.js` is the primary fetch
   layer for production pages. The `src/` directory also contains a `services/` sub-directory and
   `routes/` — these are newer additions and not yet fully wired into all pages.

---

## 2. Data flow trace

### Gold spot price — browser render path

```
GitHub Actions (gold-price-fetch.yml)
  └─► scripts/fetch_gold_price.py
        └─► GET goldpricez.com (GOLDPRICEZ_API_KEY secret)
              └─► writes data/gold_price.json  ── git commit → main branch
                    │
                    ▼
GitHub Pages serves data/gold_price.json at /data/gold_price.json
                    │
                    ▼
Browser: src/lib/api.fetchGold()
  ├─► fetchWithTimeout(`/data/gold_price.json?t=${Date.now()}`, 8 s)
  │     retryWithBackoff (up to 3 attempts, exponential back-off)
  │     validates: data.gold.ounce_usd > 0
  │     returns: { price, updatedAt: fetched_at_utc, source: 'goldpricez' }
  │
  └─► on failure: cache.getFallbackGoldPrice() [localStorage]
        returns: { price, updatedAt, source: 'cache-fallback' }
        on failure: throws NetworkError
```

### FX rates — browser render path

```
Browser: src/lib/api.fetchFX()
  └─► fetchWithTimeout('https://open.er-api.com/v6/latest/USD', 8 s)
        retryWithBackoff (up to 3 attempts)
        validates: data.rates is object
        deletes data.rates.AED (never from API — enforce peg)
        returns: { rates, time_last_update_utc, time_next_update_utc }
  on failure: cache.getFallbackFXRates() [localStorage]
```

### Price calculation path

```
{ price: spotUsdPerOz } + { rates: { [currency]: fxRate } }
  └─► src/lib/price-calculator.js
        usdPerGram = (spotUsdPerOz / TROY_OZ_GRAMS) * karat.purity
        localPerGram = usdPerGram * fxRate
        (AED: uses CONSTANTS.AED_PEG = 3.6725 instead of fxRate)
  └─► src/lib/formatter.js
        formatPrice(value, currency, decimals) → localised string
```

### Freshness labelling path

```
{ updatedAt: ISO string, hasLiveFailure: bool }
  └─► src/lib/live-status.js getLiveFreshness()
        ageMs = Date.now() - Date.parse(updatedAt)
        if hasLiveFailure: key = 'cached'
        else if ageMs < 10 min: key = 'live'
        else if ageMs < 60 min: key = 'stale'
        else: key = 'unavailable'
        returns: { key, timeText, ageText, isStale }
  └─► rendered into data-freshness attribute on #gold-ticker / #spot-price-bar
        CSS rules style the pill based on data-freshness value
```

### Homepage render sequence (`src/pages/home.js`)

```
DOMContentLoaded
  ├─► injectSpotBar(lang, 0)   — mounts sticky price bar
  ├─► injectNav(lang, 0)       — mounts bilingual nav
  ├─► injectTicker(lang, 0)    — mounts scrolling price ticker
  ├─► injectFooter(lang, 0)    — mounts footer
  ├─► show cached data from localStorage immediately (skeleton → real values)
  └─► Promise.allSettled([fetchGold(), fetchFX()])
        ├─► on gold success: update hero card, GCC grid, ticker, spotBar
        ├─► on gold fail: keep cached values, mark hasLiveFailure = true
        └─► schedule next refresh at CONSTANTS.GOLD_REFRESH_MS (90 s)
```

### Country/city leaf page hydration (`src/lib/page-hydrator.js`)

```
DOMContentLoaded
  ├─► injectSpotBar / injectNav / injectFooter
  ├─► getCountryFromPath()  — parse URL slug → country + city + karat
  ├─► COUNTRIES.find(slug)  — lookup country config
  └─► fetchPrices() → Promise.allSettled([fetchGold(), fetchFX()])
        ├─► calcLocalPrice(spot, karat.purity, fxRate)
        ├─► #karat-cards.innerHTML = renderKaratCards(...)   ← innerHTML (flagged in §4)
        ├─► #freshness-badge.innerHTML = renderFreshnessBadge(updatedAt)
        └─► #price-disclaimer.innerHTML = renderDisclaimer(country, location.href)
```

### Tracker data flow (`src/pages/tracker-pro.js` + `src/tracker/`)

```
tracker.html loads tracker-pro.js
  └─► createInitialState() — reads localStorage (tracker_pro_state_v5)
       applyUrlState()     — parse URL hash (#mode=live&currency=AED&…)
       mountShell(state)   — nav, footer, ticker, spotBar
       wire.js             — sets up setInterval for live price refresh (90 s)
            └─► fetchGold() + fetchFX() → state.live, state.rates
                  → updateTicker(data), updateSpotBar(data)
                  → render.js re-draws the active mode panel
```

### Data mutations / source-of-truth flags

| Data               | Source of truth                    | Mutation risk                                                     |
| ------------------ | ---------------------------------- | ----------------------------------------------------------------- |
| XAU/USD spot price | `data/gold_price.json` (committed) | Only the GHA workflow writes it                                   |
| FX rates           | `open.er-api.com` (live API)       | Cached in localStorage; AED deleted before storage                |
| AED peg            | `src/config/constants.js` (code)   | Cannot be mutated at runtime                                      |
| Country config     | `src/config/countries.js` (code)   | Build-time only                                                   |
| Tracker state      | `localStorage` (5 keys, versioned) | Only `state.js` helpers write; URL hash is read-only              |
| Shops data         | `data/shops-data.json`             | Admin panel writes via Express API; normalize-shops.js normalises |
| X-bot state        | `data/last_gold_price.json`        | Written by `post_gold.yml` workflow                               |

---

## 3. External dependencies

### npm production dependencies

| Package              | Version | Purpose                                      | Actively used | Lighter alternative                   |
| -------------------- | ------- | -------------------------------------------- | ------------- | ------------------------------------- |
| `bcryptjs`           | ^3.0.3  | Password hashing for admin auth              | ✅            | `argon2` (stronger, heavier)          |
| `cors`               | ^2.8.6  | CORS middleware for Express admin API        | ✅            | Built into Express 5 (partial)        |
| `express`            | ^5.2.1  | HTTP framework for admin API                 | ✅            | —                                     |
| `express-rate-limit` | ^8.3.2  | Rate limiting on API routes                  | ✅            | Built-in `express` middleware (basic) |
| `helmet`             | ^8.1.0  | Security headers (CSP, HSTS, etc.)           | ✅            | Manual header setting (more work)     |
| `jsonwebtoken`       | ^9.0.3  | JWT generation + verification for admin auth | ✅            | `jose` (WebCrypto-based)              |
| `morgan`             | ^1.10.1 | HTTP request logging                         | ✅            | Built-in `express` debug              |
| `uuid`               | ^14.0.0 | UUID generation (audit log, session IDs)     | ✅            | `crypto.randomUUID()` (Node built-in) |

### npm dev dependencies

| Package                     | Version | Purpose                          | Actively used |
| --------------------------- | ------- | -------------------------------- | ------------- |
| `@playwright/test`          | ^1.48.2 | E2E browser tests                | ✅            |
| `eslint`                    | ^10.2.1 | JS linting (flat config)         | ✅            |
| `husky`                     | ^9.1.7  | Git hooks (pre-commit lint)      | ✅            |
| `linkinator`                | ^7.6.1  | Link-check crawl                 | ✅            |
| `lint-staged`               | ^16.4.0 | Run linters on staged files only | ✅            |
| `prettier`                  | ^3.8.3  | Code formatter                   | ✅            |
| `stylelint`                 | ^17.8.0 | CSS linting                      | ✅            |
| `stylelint-config-standard` | ^40.0.0 | Standard CSS lint ruleset        | ✅            |
| `terser`                    | ^5.46.1 | JS minifier (used by Vite)       | ✅            |
| `vite`                      | ^8.0.9  | Build tool and dev server        | ✅            |

### Python dependencies (`scripts/python/requirements.txt`)

| Package    | Version  | Purpose                                         | Actively used |
| ---------- | -------- | ----------------------------------------------- | ------------- |
| `requests` | ==2.32.3 | HTTP requests (gold price fetch, health checks) | ✅            |
| `tweepy`   | ==4.14.0 | Twitter/X API v2 client (OAuth 1.0a)            | ✅            |
| `supabase` | ==2.9.1  | Supabase Python client (newsletter, sync)       | ✅            |

### External APIs

| API                             | Used for                                                         | Auth                                                             | Free tier limit   | Browser / Server |
| ------------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------- | ----------------- | ---------------- |
| `goldpricez.com`                | Gold spot price source (XAU/USD, AED)                            | `GOLDPRICEZ_API_KEY`                                             | Unknown           | Server (GHA)     |
| `open.er-api.com/v6/latest/USD` | Live FX exchange rates against USD                               | None (free tier)                                                 | 1 500 req/mo      | Browser          |
| `X / Twitter API v2`            | Hourly gold price posts                                          | OAuth 1.0a (4 secrets)                                           | Rate limits apply | Server (GHA)     |
| `Supabase`                      | Admin auth (GitHub OAuth), newsletter subscribers, site settings | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Free tier         | Both             |
| `Stripe` (routes wired)         | Premium subscription (routes exist, not live)                    | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`                     | —                 | Server           |
| Discord webhook                 | Optional spike/health notifications                              | `DISCORD_WEBHOOK_URL`                                            | —                 | Server (GHA)     |
| Telegram bot API                | Optional notifications                                           | `TELEGRAM_BOT_TOKEN`                                             | —                 | Server (GHA)     |

### CDN / fonts / third-party scripts

| Resource                                                         | Purpose                                | Privacy impact               |
| ---------------------------------------------------------------- | -------------------------------------- | ---------------------------- |
| `https://fonts.googleapis.com` — Cairo font CSS                  | Primary typeface (EN + AR)             | Google logs font fetch IP    |
| `https://fonts.gstatic.com` — Cairo font files                   | Actual font binary delivery            | Google CDN                   |
| `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js` | Google AdSense ad delivery             | Sets cookies, tracks users   |
| `https://www.googletagmanager.com/gtag/js?id=G-K3GNY9M8TE`       | Google Analytics 4 (GA4)               | Tracks page views, events    |
| `https://www.clarity.ms/tag/w4e0nhdxt5`                          | Microsoft Clarity (heatmaps, sessions) | Tracks sessions, mouse moves |

**Analytics opt-out:** `assets/analytics.js` respects `navigator.doNotTrack === '1'` and
`localStorage.getItem('gp_no_analytics') === '1'`. GA4 uses `anonymize_ip: true`.

### GitHub Actions actions used

| Action                                 | Version | Purpose                       |
| -------------------------------------- | ------- | ----------------------------- |
| `actions/checkout`                     | v6      | Repo checkout                 |
| `actions/setup-node`                   | v6      | Node.js setup                 |
| `actions/setup-python`                 | v6      | Python setup                  |
| `actions/upload-pages-artifact`        | v5      | Bundle GitHub Pages artifact  |
| `actions/deploy-pages`                 | v5      | Publish to GitHub Pages       |
| `stefanzweifel/git-auto-commit-action` | v5      | Auto-commit data file updates |

---

## 4. Weak spots and technical debt

Ranked by risk (P0 = immediate trust/correctness risk; P1 = this sprint; P2 = polish).

### P0 — Trust / correctness / security

#### W-1 · `page-hydrator.js` uses bare `innerHTML` (DOM-safety baseline violation)

**Files:** `src/lib/page-hydrator.js:179–181`  
**Risk:** `renderKaratCards`, `renderFreshnessBadge`, and `renderDisclaimer` all write `.innerHTML`
directly. `renderDisclaimer` encodes `location.href` via `URL.pathname` (safe), and
`renderFreshnessBadge` is data-only — but the DOM-safety baseline in
`scripts/node/check-unsafe-dom.js` tracks these as known sinks. Any future addition of
user-controlled data (e.g. a city name from `COUNTRIES` that contains HTML-special characters) would
be silently trusted.  
**Action:** Route through `safe-dom.js` helpers or use `el()` / `node.replaceChildren()` for each
block.

**Resolved (2026-04-27 round 7):** All 3 `innerHTML` sinks in `page-hydrator.js` migrated to `el()`
and `replaceChildren()` from `safe-dom.js`. Baseline updated from 3→0. Verified by
`npm run validate`.

#### W-2 · Gold price data can be up to 15 minutes stale while the UI shows "Live"

**Files:** `.github/workflows/gold-price-fetch.yml` cron `*/15`; `src/lib/live-status.js` stale
threshold `STALE_AFTER_MS = 10 * 60 * 1000`  
**Risk:** The workflow comment says "every 6 minutes" but the actual cron is `*/15` (15 min). The
freshness threshold is 10 min. So in the worst case, data is 15 min old but `getLiveFreshness()`
still returns `'live'` (< 10 min stale) for the first 10 min of a 15-min window. Under normal
conditions this is a minor display issue, but it means users may see "Live" for data that is up to
15 min old.  
**Action:** Align the cron comment with reality. Optionally raise `STALE_AFTER_MS` to 16 min, or
tighten the cron back to `*/6`.

**Resolved (2026-04-27):** Cron comment fixed (`*/15` matches reality). `STALE_AFTER_MS` bumped 10 →
12 min — one full missed cron-tick safety margin without crossing the cron interval. Test extended
in `tests/live-status.test.js`.

#### W-3 · No staleness label for FX rates

**Files:** `src/lib/api.js`, `src/lib/cache.js`, `src/lib/live-status.js`  
**Risk:** `getLiveFreshness()` only assesses gold price age via `updatedAt`. FX rates are fetched
live on each page load and cached in `localStorage`, but there is no visible UI indicator when FX
rates are served from a stale cache (e.g., `open.er-api.com` is unreachable). Charter §6.2 requires
labelling cached/estimated values.  
**Action:** Track `fxUpdatedAt` (from `time_last_update_utc`) and show a stale FX label when rates
are from cache and older than a threshold.

**Resolved (2026-04-27 round 7):** `getFXFreshness()` function and `FX_MARKET` constants added to
`src/lib/live-status.js`. `fetchFX()` in `src/lib/api.js` now passes `fxUpdatedAt` and `source`
through on cache hits. Test added in `tests/live-status.test.js`.

#### W-4 · Flat-JSON persistence has no atomic writes

**Files:** `server/repositories/`, `server/lib/auth.js`  
**Risk:** `fs.readFileSync` / `fs.writeFileSync` on the same JSON file from multiple concurrent
requests has no locking. Under concurrent admin sessions the read-modify-write cycle can produce
torn writes or corrupt JSON. Under the current single-admin model this is low probability, but it is
an un-bounded data corruption path.  
**Action:** Wrap writes in a mutex (e.g. `async-mutex` npm package) or switch to atomic
write-to-temp → rename (POSIX atomic on Linux). Or migrate to Supabase exclusively.

**Resolved (2026-04-27 round 7):** `server/lib/fs-atomic.js` created with `atomicWriteJSON()` —
write-to-temp then `fs.renameSync()` pattern (POSIX atomic). Updated callers: `server/lib/auth.js`,
`server/repositories/shops.repository.js`, `server/repositories/audit.repository.js`,
`server/lib/audit-log.js`, `server/lib/admin/shop-manager.js`. Tests in `tests/fs-atomic.test.js`.

### P1 — Correctness / coverage gaps

#### W-5 · Stale-state coverage is not enforced site-wide

**Files:** `src/lib/live-status.js`, 400+ country pages hydrated by `page-hydrator.js`  
**Risk:** `getLiveFreshness()` exists and is consumed by `ticker.js` and `spotBar.js`. But
`page-hydrator.js` renders its own freshness badge via `renderFreshnessBadge()` (which calls
`formatFreshness()` not `getLiveFreshness()`). There is no site-wide test asserting that every
price-rendering surface passes through the canonical freshness primitive.  
**Action:** A static-analysis pass or a freshness-coverage test that maps every price surface to its
freshness path.

**Resolved (2026-04-28 Round 9):** `tests/freshness-coverage.test.js` added with 6 static-analysis
assertions verifying that `home.js`, `ticker.js`, `spotBar.js`, `page-hydrator.js`, and
`tracker/render.js` all use the `getLiveFreshness` primitive (directly or via parameter).

#### W-6 · `renderKaratCards` uses inline styles, not design tokens

**Files:** `src/lib/page-hydrator.js:92–98`  
**Risk:** All karat card styling is done with hardcoded `style=` attributes (hex colours, rem
values) that bypass `styles/global.css` tokens and will diverge from theme changes. CSS custom
properties set this way also cannot use `var(--foo)` syntax.  
**Action:** Convert to CSS class names driven by `styles/global.css` tokens.

**Resolved (2026-04-27):** Inline styles replaced by `.ph-karat-card` / `.ph-karat-card__label` /
`.ph-karat-card__price` / `.ph-karat-card__unit` classes appended to `styles/global.css`, with a
`[data-theme='dark']` override for parity with the rest of the page.

#### W-7 · `src/lib/supabase-data.js` has no tests

**Files:** `src/lib/supabase-data.js`  
**Risk:** The client-side Supabase integration is not covered by any test suite. Regressions in data
fetching or error handling would not be caught by CI.

**Resolved (2026-04-27 round 7):** `tests/supabase-data.test.js` added with 6 test cases covering:
network error → null, 401 → null, empty array → null, non-array → null, mapRow camelCase conversion,
and safe defaults for missing fields.

#### W-8 · Playwright E2E is thin

**Files:** `tests/e2e/`, `playwright.config.js`  
**Risk:** The E2E suite covers the homepage smoke; country/city leaf pages, calculator, shops, and
tracker are not covered. The suite is blocking in CI (`ci.yml`), so a regression in the uncovered
surfaces would not be caught until production.

**Resolved (2026-04-27 round 7):** `tests/e2e/calculator.spec.js` (6 tests: page load, main
landmark, input labels, links to tracker/methodology, JSON-LD WebApplication schema) and
`tests/e2e/shops-search.spec.js` (5 tests: page load, main landmark, skip link, shop listing area,
disclaimer notice) added.

#### W-9 · `scripts/node/` tooling sprawl — two sitemap generators

**Files:** `build/generateSitemap.js`, `scripts/node/generate-sitemap.js`  
**Risk:** Two separate sitemap-generation scripts exist. `build/generateSitemap.js` is called in
`npm run build`; `scripts/node/generate-sitemap.js` is called in CI after the build. Their parity is
not enforced and could drift.  
**Action:** Consolidate into one canonical script and call it from both contexts.

**Partial resolution (2026-04-27):** Consolidation deferred (too risky for this batch — see
[`reports/sitemap-parity.md`](../../reports/sitemap-parity.md)). A drift-guard test
(`tests/sitemap-parity.test.js`) now enforces both scripts run, both emit ≥ 50 URLs, and the
canonical sitemap retains its required top-level pages.

#### W-10 · `docs/REPO_AUDIT.md` references `lowdb`

**Files:** `docs/REPO_AUDIT.md:31,43`  
**Risk:** The audit mentions `lowdb` as a current dependency, but it was removed in the 2026-04-24
dependency audit (per `docs/DEPENDENCIES.md`). The audit file is therefore factually stale.  
**Action:** Update `docs/REPO_AUDIT.md` to remove the `lowdb` references.

**Resolved (2026-04-27):** `lowdb` references replaced with the actual JSON-file-with-fs.writeFile
storage layer description in `docs/REPO_AUDIT.md`; cross-reference to `docs/DEPENDENCIES.md` added
as the source of truth.

### P2 — Polish / maintainability

#### W-11 · `uuid` can be replaced with Node built-in

**Files:** `package.json`, `server/` usages  
**Risk:** `uuid` is a production dependency, but Node 14.17+ provides `crypto.randomUUID()`
natively. Removing `uuid` reduces the dependency surface.  
**Action:** Replace `uuid` usages with `crypto.randomUUID()` and remove the package.

**Resolved (2026-04-27):** `uuid` removed from `package.json` (depcheck-confirmed unused after the
last server refactor). `docs/DEPENDENCIES.md` updated.

#### W-12 · Analytics IDs and AdSense publisher ID hardcoded in source

**Files:** `assets/analytics.js`, `index.html`  
**Risk:** `G-K3GNY9M8TE` (GA4), `w4e0nhdxt5` (Clarity), and `ca-pub-8578581906562588` (AdSense) are
all visible in source. These are not secrets (they're public in page HTML by design), but they
cannot be changed without a code deploy.  
**Action:** Document in `docs/EDIT_GUIDE.md` that changing these requires a code edit + deploy, not
just a config change.

**Resolved (2026-04-27):** New "Analytics, Ads & Tracking IDs" section in `docs/EDIT_GUIDE.md`
inventories every hardcoded ID with file path, marks all of them as "code edit + deploy", and flags
the corresponding env vars (`GA4_MEASUREMENT_ID`, `ADSENSE_CLIENT_ID`) that are documented but not
yet wired to the source.

#### W-13 · `open.er-api.com` free tier limit

**Files:** `src/lib/api.js:CONSTANTS.API_FX_URL`  
**Risk:** The free plan on `open.er-api.com` allows 1 500 requests/month. The tracker page refreshes
FX every 90 seconds per user session. Under significant traffic this limit could be exceeded,
causing FX fetch failures (the fallback to localStorage cache would engage, but FX data would become
stale without visible indication — see W-3).  
**Action:** Cache the FX response server-side (or via a proxy endpoint) and serve it from
`/data/fx_rates.json` committed on a schedule (same model as gold price). This would also improve
privacy by not making per-browser requests to a third-party domain.

#### W-14 · Service-worker registration not audited across all entry pages

**Files:** `sw.js`, various entry HTML files  
**Risk:** Not all entry pages register the service worker. Pages that don't register it won't get
offline support. There is no test or audit enforcing consistent SW registration.

**Resolved (2026-04-27):** `scripts/node/check-sw-coverage.js` runs in `npm run validate` and fails
if a top-level entry HTML page neither registers the SW nor appears on the documented allow-list.
Current state captured in [`reports/sw-coverage.md`](../../reports/sw-coverage.md): `index.html` and
`invest.html` register; six other entry pages are baseline-allow-listed with TODO §22b notes.

---

## Done criteria for follow-ups

Each weak spot above that warrants a code change should be addressed in a scoped plan PR that:

- Cites the finding number from this document (e.g. `Fixes W-1`)
- Adds or updates tests that would have caught the bug
- Passes `npm run validate`, `npm test`, `npm run build`
- Updates this document's status column if the fix is complete

No code changes are made in this document.
