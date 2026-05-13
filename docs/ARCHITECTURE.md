# Architecture Overview

## Summary

Gold Ticker Live is a **zero-dependency, static multi-page front-end** gold pricing platform for
GCC/Arab markets, written in vanilla ES6 modules — no bundler framework, no package manager for
browser code.

It is served via **GitHub Pages** (primary) or an optional **Express server** (adds JWT-secured
admin API and server-side data persistence).

### Key Stats

| Metric        | Value                                                                                                                        |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| HTML pages    | 70+ root/guide/tool pages + 400+ generated leaf pages                                                                        |
| Countries     | 15 (UAE, Saudi Arabia, Qatar, Kuwait, Bahrain, Oman, Jordan, Lebanon, Egypt, Morocco, Algeria, Tunisia, Libya, Sudan, India) |
| Cities        | 50+                                                                                                                          |
| Karat grades  | 7 (24K, 22K, 21K, 18K, 14K, 12K, 10K)                                                                                        |
| Languages     | English + Arabic (full RTL support)                                                                                          |
| CSS lines     | ~17,000 across 16 files                                                                                                      |
| JS modules    | 75+                                                                                                                          |
| Test suites   | 10 files, 205 tests                                                                                                          |
| External APIs | goldpricez.com (gold spot), exchangerate-api.com (FX), DataHub (historical)                                                  |

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     BROWSER (Client)                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  HTML Pages (index.html, tracker.html, calculator.html, …) │
│       │                                                     │
│       ▼                                                     │
│  Page Scripts (src/pages/home.js, tracker-pro.js, …)   │
│       │                                                     │
│       ├──► Services Layer                                   │
│       │    ├── src/services/goldPriceService.js (spot price) │
│       │    ├── src/services/fxService.js (FX rates)          │
│       │    ├── src/services/pricingEngine.js (calculations)  │
│       │    └── src/services/apiAdapter.js (fetch wrapper)    │
│       │                                                     │
│       ├──► Core Library                                     │
│       │    ├── src/lib/api.js (legacy fetch)                 │
│       │    ├── src/lib/cache.js (localStorage)               │
│       │    ├── src/lib/price-calculator.js (formulas)        │
│       │    └── src/lib/formatter.js (display)                │
│       │                                                     │
│       ├──► Components                                       │
│       │    ├── src/components/nav.js + nav-data.js           │
│       │    ├── src/components/footer.js                      │
│       │    ├── src/components/chart.js                       │
│       │    ├── src/components/ticker.js                      │
│       │    └── src/components/breadcrumbs.js                 │
│       │                                                     │
│       └──► Config                                           │
│            ├── src/config/constants.js                       │
│            ├── src/config/countries.js                       │
│            ├── src/config/karats.js                          │
│            └── src/config/translations.js                   │
│                                                             │
│  ┌──────────────────────────────────────┐                   │
│  │ External APIs (fetched from browser) │                   │
│  │  • api.goldpricez.com (XAU/USD spot)   │                   │
│  │  • open.er-api.com (FX rates)        │                   │
│  │  • goldprice.org (fallback)          │                   │
│  └──────────────────────────────────────┘                   │
│                                                             │
│  ┌──────────────────────────────────────┐                   │
│  │ Browser Storage                      │                   │
│  │  • localStorage (dual-layer cache)   │                   │
│  │  • Service Worker (sw.js)            │                   │
│  └──────────────────────────────────────┘                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    SERVER (Optional)                         │
├─────────────────────────────────────────────────────────────┤
│  server.js (Express)                                        │
│    ├── Helmet (security headers)                            │
│    ├── CORS                                                 │
│    ├── Morgan (logging)                                     │
│    ├── Static file serving                                  │
│    └── /api/admin routes                                    │
│         ├── server/lib/auth.js (JWT)                        │
│         ├── server/repositories/ (storage abstraction)      │
│         │    ├── file backend (data/*.json)                 │
│         │    └── Supabase backend (optional)                │
│         └── server/lib/admin/shop-manager.js                │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    ADMIN PANEL                               │
├─────────────────────────────────────────────────────────────┤
│  admin/ (static HTML, served as-is)                         │
│    ├── Supabase GitHub OAuth authentication                 │
│    ├── Shop management (CRUD)                               │
│    ├── Site settings                                        │
│    ├── Analytics dashboard                                  │
│    ├── Content management                                   │
│    └── Social posting tools                                 │
└─────────────────────────────────────────────────────────────┘
```

---

## Folder Structure

```
/
├── index.html, calculator.html, shops.html, tracker.html, …
│   → 12 public-facing root pages
│
├── content/guides/          → 7 educational guide pages
├── content/tools/           → 3 interactive tool pages
├── content/search/          → Search interface
├── content/gold-price-history/ → Historical data page
├── content/embed/           → Embeddable gold ticker widget
├── content/social/          → X post generator
├── content/order-gold/      → Gold ordering page
│
├── countries/          → Country listing + country/city/market pages
│   ├── index.html      → Countries overview
│   ├── {country}/index.html → 15 country pages
│   ├── {country}/cities/{city}.html   → City pages
│   └── {country}/markets/{market}.html → Famous market pages
│
├── {country}/          → 15 country directories with generated leaf pages
│   ├── gold-price/index.html           → Country price overview
│   └── {city}/
│       ├── gold-prices/index.html      → City prices
│       ├── gold-shops/index.html       → City shops
│       └── gold-rate/{karat}-karat/index.html → Karat-specific rates
│
├── src/components/      → Reusable UI components (browser ES modules)
│   ├── nav.js, nav-data.js  → Bilingual navigation
│   ├── footer.js       → 5-column footer
│   ├── chart.js        → Price chart (lightweight-charts)
│   ├── ticker.js       → Scrolling price ticker
│   ├── breadcrumbs.js  → Navigation breadcrumbs
│   ├── internalLinks.js → SEO internal linking
│   └── adSlot.js       → AdSense component
│
├── src/config/          → Application configuration
│   ├── constants.js    → API URLs, timeouts, refresh interval, AED peg, troy-oz
│   ├── countries.js    → 24+ countries with codes, names, currencies, cities
│   ├── karats.js       → 7 karat definitions with purity fractions
│   ├── translations.js → All UI strings (EN + AR)
│   ├── supabase.js     → Supabase public config
│   └── index.js        → Config re-exports
│
├── src/lib/             → Core business logic
│   ├── api.js          → Gold price + FX fetch with timeout/retry (browser)
│   ├── cache.js        → Dual-layer localStorage cache (browser)
│   ├── price-calculator.js → Core pricing formulas (browser + Node)
│   ├── formatter.js    → Price/date/label formatting
│   ├── export.js       → CSV/JSON export generators
│   ├── historical-data.js → Session + DataHub historical merge
│   ├── search.js       → Bilingual search
│   ├── page-hydrator.js → Leaf page live data injection
│   ├── supabase-data.js → Supabase data operations (browser)
│   └── errors.js       → Structured error classes
│
├── src/services/        → Service layer
│   ├── apiAdapter.js   → API abstraction with timeout/retry
│   ├── goldPriceService.js → Multi-provider gold spot price fetcher
│   ├── fxService.js    → FX rate fetcher with AED peg override
│   └── pricingEngine.js → All-prices calculator (countries × karats)
│
├── src/utils/           → Shared utilities
│   ├── routeBuilder.js → URL generation (single source of truth)
│   ├── routeValidator.js → Route parameter validation
│   ├── inputValidation.js → Input sanitization and validation
│   └── slugify.js      → URL slug generation
│
├── src/routes/
│   └── routeRegistry.js → URL path → page metadata resolver
│
├── src/tracker/         → Tracker workspace modules
│   ├── state.js        → State management (synced to URL hash)
│   ├── ui-shell.js     → UI orchestration
│   ├── render.js       → Data rendering
│   ├── events.js       → Event handling
│   └── wire.js         → Component wiring
│
├── scripts/            → Build, automation, and page scripts
│   ├── node/           → Node.js automation scripts
│   ├── python/         → Python automation scripts
│   ├── archive/        → Retired scripts (kept for reference; not executed in any workflow)
│   ├── validate-build.js → Pre-build validation
│   ├── audit-pages.js  → Page structure audit
│   ├── check-links.js  → Link checker
│   ├── seo-audit.js    → SEO audit
│   ├── generate-sitemap.js → Sitemap generator (parity tested in `tests/sitemap.test.js`)
│   ├── externalize-analytics.js → Codemod that moves inline gtag/Clarity snippets
│   │                              into `assets/analytics.js` so CSP can drop
│   │                              `'unsafe-inline'`. Runs in `--check` mode via
│   │                              `npm run validate`.
│   └── …               → Notifications, alerts, social posting
│
├── server/             → Server-side code
│   ├── routes/admin/index.js → Admin API routes
│   ├── lib/            → Server libraries (auth, errors, audit-log, admin/)
│   │   ├── auth.js         → JWT auth + user management
│   │   ├── audit-log.js    → Immutable audit logging
│   │   ├── errors.js       → Structured error classes
│   │   ├── supabase-client.js → Supabase client factory
│   │   └── admin/
│   │       └── shop-manager.js → Shop CRUD with confidence scoring
│   ├── repositories/   → Storage-agnostic data access
│   │   ├── shops.repository.js → Shop CRUD (file or Supabase)
│   │   └── audit.repository.js → Audit log access
│   └── services/       → Server services
│
├── src/pages/          → Page entry points (home.js, tracker-pro.js, etc.)
│
├── server.js           → Express server (optional)
├── server/routes/admin/index.js → Admin API routes
│
├── data/               → Server-side JSON persistence
│   ├── shops.js        → Hardcoded shop reference data (browser)
│   ├── shops-data.json → Admin-managed shop records (server)
│   └── audit-logs.json → Audit log (server)
│
├── admin/              → Admin panel (9 pages, Supabase auth)
├── supabase/           → Database schema + RLS policies
├── tests/              → 10 test files, 205 tests
├── build/              → Page generation scripts
├── styles/pages/       → Page-specific CSS files
├── styles/global.css   → Global stylesheet
├── styles/country-page.css → Country page styles
├── styles/admin.css    → Admin panel styles
├── assets/             → Favicons, OG images, screenshots
└── docs/               → Documentation
```

---

## Data Flow

### Public Pages (browser-only)

```
User visits page
  │
  ▼
HTML loads page-specific JS (e.g. src/pages/home.js)
  │
  ├──► Check localStorage cache (src/lib/cache.js)
  │    └── If fresh → use cached data → render immediately
  │
  ├──► Fetch gold spot price (`src/lib/api.js` → provider chain)
  │    ├── Provider 1: api.goldpricez.com (primary)
  │    ├── Provider 2: goldpricez.com (fallback)
  │    └── On failure: use stale cache → show "stale data" badge
  │
  ├──► Fetch FX rates (`src/lib/api.js`)
  │    ├── Source: open.er-api.com
  │    └── AED always uses fixed peg (3.6725) regardless of API
  │
  ├──► Calculate prices (`src/lib/price-calculator.js`)
  │    └── For each country × karat:
  │         usdPerGram = (spotPerOz / TROY_OZ_GRAMS) × purity
  │         localPerGram = usdPerGram × fxRate
  │
  ├──► Format for display (src/lib/formatter.js)
  │
  └──► Render into DOM + update cache
```

### Admin Panel (browser → Supabase)

```
Admin visits /admin/login/
  │
  ├──► Supabase GitHub OAuth (admin/supabase-auth.js)
  │    └── Checks session.user.email === ALLOWED_EMAIL
  │
  └──► Admin dashboard → Supabase REST API
       ├── Shop CRUD (src/lib/supabase-data.js)
       ├── Site settings
       └── Falls back to localStorage if Supabase unavailable
```

### Admin API (Express server — optional)

```
POST /api/admin/auth/login
  │
  ├──► server/lib/auth.js (JWT auth)
  │
  └──► /api/admin/* routes
       ├── server/repositories/shops.repository.js
       │    ├── file backend → data/shops-data.json
       │    └── Supabase backend → supabase/schema.sql tables
       ├── server/lib/admin/shop-manager.js (CRUD + confidence scoring)
       └── server/lib/audit-log.js (immutable action log)
```

---

## Routing / Navigation Logic

### URL Patterns

| Pattern          | Example                                      | Pages |
| ---------------- | -------------------------------------------- | ----- |
| Root pages       | `/`, `/tracker.html`, `/calculator.html`     | 12    |
| Country overview | `/{country}/gold-price/`                     | 15    |
| City prices      | `/{country}/{city}/gold-prices/`             | ~55   |
| City shops       | `/{country}/{city}/gold-shops/`              | ~55   |
| Karat rates      | `/{country}/{city}/gold-rate/{karat}-karat/` | ~220  |
| Legacy country   | `/countries/{country}.html`                  | 15    |
| Legacy city      | `/countries/{country}/cities/{city}.html`    | 5     |
| Legacy market    | `/countries/{country}/markets/{market}.html` | 2     |
| Guides           | `/guides/*.html`                             | 7     |
| Tools            | `/tools/*.html`                              | 3     |
| Admin            | `/admin/*`                                   | 9     |

### Navigation Components

- **Nav bar** (`src/components/nav.js`): 6 dropdown groups (Markets, Tools, Cities, Famous Markets,
  Learn, Insights) + Home, Shops, Invest quick links. Full EN/AR bilingual.
- **Footer** (`src/components/footer.js`): 5-column layout with Markets, Tools, Learn, Legal, Brand.
- **Breadcrumbs** (`src/components/breadcrumbs.js`): Shown on deep pages (city, karat, shops).
- **Internal links** (`src/components/internalLinks.js`): SEO cross-links injected into pages.

### Route Generation

All internal URLs should be generated via `src/utils/routeBuilder.js`:

```js
import { buildRoute } from '../src/utils/routeBuilder.js';

buildRoute({ page: 'tracker' }); // → '/tracker.html'
buildRoute({ country: 'uae' }); // → '/uae/gold-price/'
buildRoute({ country: 'uae', city: 'dubai' }); // → '/uae/dubai/gold-prices/'
buildRoute({ country: 'uae', city: 'dubai', karat: '24' }); // → '/uae/dubai/gold-rate/24-karat/'
```

---

## Component Dependencies

```
Page Scripts ──► Core Library (api, cache, calculator, formatter)
     │                │
     │                └──► Config (constants, countries, karats)
     │
     ├──► Components (nav, footer, chart, ticker, breadcrumbs)
     │         │
     │         └──► Config (nav-data, translations)
     │
     └──► Utils (routeBuilder, routeValidator, inputValidation)
               │
               └──► Config (countries, karats)
```

> **Note:** `server/services/` (goldPriceService.js, fxService.js, pricingEngine.js) are
> **server-side only** — used by the Node/Express admin backend and Python automation scripts.
> Browser pages use `src/lib/api.js` directly.

---

## Resilience & Offline Strategy

- **Dual cache layers**: Primary + fallback localStorage prevents data loss on storage errors
- **Multi-provider fallback**: Gold price tries goldpricez.com → goldprice.org → cache
- **Stale data badges**: When cached data is used, freshness indicators are shown
- **Service worker** (`sw.js`): Cache-first for static assets, network-first for API calls
- **AED fixed peg**: Always 3.6725 regardless of FX API (removes dependency for UAE prices)
- **Skeleton loading**: Placeholder UI shown during data fetching

---

## Design Token System

All visual values are centralized in `styles/global.css` under `:root`. Page-specific CSS files
(`styles/pages/*.css`) **must use tokens** — no raw hex, rgb, or pixel values that duplicate a
token.

### Canonical token categories

| Category     | Token prefix                                                  | Example                                  |
| ------------ | ------------------------------------------------------------- | ---------------------------------------- |
| Surfaces     | `--surface-*`                                                 | `--surface-primary`, `--surface-canvas`  |
| Text tiers   | `--text-*`                                                    | `--text-primary`, `--text-secondary`     |
| Borders      | `--border-*`                                                  | `--border-default`, `--border-accent`    |
| Spacing      | `--space-*`                                                   | `--space-4`, `--space-6`                 |
| Radius       | `--radius-*`                                                  | `--radius-card`, `--radius-pill`         |
| Shadows      | `--shadow-*` / `--elev-*`                                     | `--elev-3`, `--shadow-gold`              |
| Typography   | `--text-*`, `--weight-*`, `--leading-*`                       | `--text-sm`, `--weight-bold`             |
| Gold palette | `--color-gold*`                                               | `--color-gold`, `--color-gold-dark`      |
| Status       | `--color-live`, `--color-stale`, `--color-up`, `--color-down` | etc.                                     |
| Freshness    | `--color-amber`, `--color-danger`                             | warm amber / danger red for age-based UI |

### Semantic alias layer

The `:root` also defines higher-level semantic aliases that wrap the primitive tokens:

```css
--surface-primary   → var(--color-surface)   /* card / panel background */
--text-primary      → var(--color-text)      /* body text */
--text-secondary    → var(--color-text-muted)/* muted / label text */
--text-tertiary     → var(--color-text-faint)/* placeholder / hint text */
--border-default    → var(--color-border)    /* standard divider */
--color-accent      → var(--color-gold-dark) /* gold accent in light mode */
--color-accent-strong → var(--color-gold-bright) /* bright gold for dark mode */
--color-surface-raised → var(--color-surface-2) /* slightly elevated surface */
--color-text-secondary → var(--color-text-muted) /* backward-compat alias */
--color-gold-alpha  = rgb(196 153 62 / 12%)  /* subtle gold tint overlay */
--color-amber       = #f59e0b                /* freshness warning (cached/slightly stale) */
--color-danger      = #dc2626                /* freshness danger (very stale/unavailable) */
```

> **Agent rule:** If you need a color that exists in the semantic alias layer, always use the alias.
> Never add a raw hex value to a page CSS file when an equivalent token exists.

---

## Build & Deployment

### Build Pipeline

```
npm run validate    → scripts/validate-build.js (check HTML, imports, required files)
npm run build       → Vite build → dist/ (minified HTML/CSS/JS, vendor chunks)
```

### Vite Configuration

- **Base path**: `/Gold-Prices/` (GitHub Pages) or `/` (local)
- **Excluded from Vite**: Country leaf-page dirs, admin/, content/ (copied as-is by deploy workflow)
- **Chunks**: `vendor` (lightweight-charts), `utils` (cache, api, calculator, formatter)
- **Minification**: Terser with `drop_debugger`, removes `console.warn`/`console.log`

### CI/CD Workflows

| Workflow               | Trigger       | Purpose                        |
| ---------------------- | ------------- | ------------------------------ |
| `ci.yml`               | PR to main    | Lint, test, validate, build    |
| `deploy.yml`           | Push to main  | Build + deploy to GitHub Pages |
| `hourly_post.yml`      | Cron (hourly) | Python gold price posting to X |
| `gold-price-tweet.yml` | Cron          | Node.js gold price tweet       |
| `market_events.yml`    | Cron          | Market event detection         |
| `spike_alert.yml`      | Cron          | Price spike alerts             |
| `health_check.yml`     | Cron          | Site uptime monitoring         |

---

## Storage Abstraction Layer

### Why it exists

The app currently uses JSON files for persistence.  
The `server/repositories/` layer lets you **swap in Supabase** without rewriting every call site.

### How it works

Set `STORAGE_BACKEND` in `.env`:

| Value      | Behavior                                              |
| ---------- | ----------------------------------------------------- |
| `file`     | (default) JSON files in `data/`                       |
| `supabase` | Supabase tables (requires env vars + package install) |

Both modes share the same async API:

```js
// Example – works with either backend
const shopsRepo = require('./server/repositories/shops.repository');

const all = await shopsRepo.getAll();
const shop = await shopsRepo.getById('shop_123');
const inserted = await shopsRepo.insert({ id: '...', name: '...' });
const updated = await shopsRepo.update('shop_123', { verified: true });
const deleted = await shopsRepo.remove('shop_123');
const stats = await shopsRepo.getStats();
```

### Migration path (file → Supabase)

1. Create a Supabase project and apply `supabase/schema.sql`.
2. Set `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` in `.env`.
3. Install the client: `npm install @supabase/supabase-js`.
4. One-off data migration: read `data/shops-data.json` → insert into Supabase.
5. Set `STORAGE_BACKEND=supabase` in `.env`.
6. The admin API routes use the repository layer, so no further code changes are needed.

See [`docs/SUPABASE_SETUP.md`](SUPABASE_SETUP.md) for the full migration guide.

---

## Admin API Endpoints

All routes live under `/api/admin`.

| Method | Path                  | Min Role | Description                        |
| ------ | --------------------- | -------- | ---------------------------------- |
| POST   | `/auth/login`         | —        | JWT login                          |
| GET    | `/auth/verify`        | any      | Verify token                       |
| GET    | `/shops`              | any      | List shops (filterable, paginated) |
| GET    | `/shops/:id`          | any      | Get single shop                    |
| POST   | `/shops`              | editor   | Create shop                        |
| PUT    | `/shops/:id`          | editor   | Update shop                        |
| DELETE | `/shops/:id`          | admin    | Delete shop                        |
| POST   | `/shops/batch-import` | admin    | Batch import shops                 |
| GET    | `/audit-logs`         | any      | List audit log (filterable)        |
| GET    | `/audit-logs/export`  | admin    | Export audit log as CSV            |
| GET    | `/users`              | admin    | List admin users                   |
| POST   | `/users`              | admin    | Create admin user                  |
| PUT    | `/users/:id`          | admin    | Update admin user                  |
| DELETE | `/users/:id`          | admin    | Delete admin user                  |
| GET    | `/stats`              | any      | Dashboard stats (shops + users)    |

---

## Authentication

- JWT-based (`server/lib/auth.js`), token expiry 24 h.
- Role hierarchy: `viewer < editor < admin`.
- Rate limiting on `/auth/login`: 10 failed attempts per IP → 15-minute lock.
- Users stored in `data/users.json` (file mode) or `public.user_profiles` (Supabase mode).
- Set `JWT_SECRET` and `ADMIN_PASSWORD` in `.env` before deploying.

---

## Environment Variables

| Variable                    | Required | Purpose                                       |
| --------------------------- | -------- | --------------------------------------------- |
| `PORT`                      | No       | Express port (default 3000)                   |
| `JWT_SECRET`                | Yes      | Secret for signing JWTs (32+ random chars)    |
| `ADMIN_PASSWORD`            | Yes      | Bootstrap password for `admin@goldprices.com` |
| `STORAGE_BACKEND`           | No       | `file` (default) or `supabase`                |
| `SUPABASE_URL`              | Supabase | Your Supabase project URL                     |
| `SUPABASE_ANON_KEY`         | Supabase | Anon key (browser-safe reads)                 |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase | Service-role key (server only, bypasses RLS)  |

---

## Testing

```bash
npm test          # runs all tests in tests/*.test.js
```

Test files:

- `tests/price-calculator.test.js` – pricing formulas
- `tests/shop-manager.test.js` – shop CRUD + confidence scoring
- `tests/audit-log.test.js` – audit log filtering, CSV export, injection prevention
- `tests/auth.test.js` – JWT auth, user management, middleware
- `tests/repositories.test.js` – repository layer (file backend)
