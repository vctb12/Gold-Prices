# Changelog

All notable changes to the Gold-Prices platform are documented here.

## [Unreleased]

### 2026-05-22 — Shops deeper mobile UI pass

- Added mobile quick-filter chips to `shops.html` via `src/pages/shops.js` to provide one-tap filter
  actions without opening the full dropdown panel.
- Improved touch-target compliance on shops filter tabs, clear controls, and shortlist actions (44px
  minimum) in `styles/pages/shops.css`.
- Added tabular-number rendering for shops headline counts and replaced near-me status hardcoded
  colors with design tokens.
- Extended Playwright coverage in `tests/e2e/mobile-smoke.spec.js` and
  `tests/e2e/shops-search.spec.js` for the new mobile quick-filter flow.

### 2026-04-27 — Multi-batch UX, admin, CSS, and trust improvements

#### Stylelint

- Fixed 53 stylelint errors across `styles/admin.css`, `styles/global.css`,
  `styles/pages/tracker-pro.css`, `styles/pages/home.css`, `styles/pages/methodology.css`,
  `styles/pages/pricing.css`, `styles/pages/stub.css`: all `rgba()` calls converted to modern
  `rgb(... / ...)` syntax; deprecated `clip:` replaced with `clip-path:`; deprecated
  `overflow-wrap: break-word` replaced with `overflow-wrap: anywhere`.

#### Admin Dashboard (`admin/index.html`)

- Migrated 340-line inline `<style>` block to `styles/admin.css` (sections 20+): `.welcome-banner`,
  `.quick-action-card`, `.dashboard-grid`, `.activity-list`, `.ticker-badge`, `.insight-list`,
  `.data-pill` and all related modifiers.

#### Admin Login (`admin/login/index.html`)

- Improved `showError()` to map raw Supabase/server error strings to friendly user-facing copy:
  rate-limit (429/too-many), invalid credentials, email not confirmed, method not enabled.

#### Admin Settings (`admin/settings/index.html`)

- Save button now shows "⏳ Saving…" loading state during async save and disables itself to prevent
  double-submission.
- Save failure messages now map to readable descriptions: Supabase unavailability (local cache
  note), network error, permission/RLS denied.
- Replaced 6 inline `style=` attributes on the account-info card with CSS classes in
  `styles/admin.css` (`.settings-user-info`, `.settings-user-details`, `.settings-user-email`,
  `.settings-user-provider`, `.settings-admin-badge`, `.settings-notice`).
- Removed remaining inline `style="padding-bottom: 80px"` replaced with `.settings-content-area`.

#### Tracker (`tracker.html`)

- Method mode: added a **Karat purity** explanation card with the formula for 24K/22K/21K/18K/14K
  purity scaling.
- Method mode: improved FX card copy to name the AED peg (3.6725) explicitly.
- Method mode: added `.tracker-method-footer` bar with "Read full methodology →" CTA + anchored
  links to freshness and disclaimer sections on `methodology.html`.
- Fixed all methodology deep-links: `#karat-purity` → `#karat-conversion`, `#spot-vs-retail` →
  `#not-included`, `#freshness` → `#gold-data`, `#limitations` → `#disclaimer`.
- Alerts mode: promoted browser-only disclaimer to a `.tracker-browser-only-note` styled warning box
  (amber background, border, bold label). Removed inline `style=` attribute.

#### Homepage (`index.html`)

- Social follow section: replaced 3 inline `style=` attributes with CSS classes `.home-social-wrap`,
  `.home-social-text`, `.home-social-btn` in `styles/pages/home.css`.
- Trust banner: added `aria-labelledby="trust-banner-title"` to the section element, updated copy to
  be clearer about source chain ("XAU/USD · live FX from ExchangeRate-API · AED at fixed peg
  3.6725"), changed title to "About Our Prices", added `aria-hidden="true"` to icon.
- Trust banner: updated translations in `src/config/translations.js` (EN + AR) to match.

#### Typography (`styles/global.css`)

- Added base `h1`–`h6` element rules as low-specificity fallbacks. The ~40 bespoke page-level
  selectors continue to dominate by specificity — no regression risk. REVAMP_PLAN.md Slice 2b
  complete.

#### Tracker CSS (`styles/pages/tracker-pro.css`)

- Added `.tracker-help-text`, `.tracker-browser-only-note` utility classes.
- Added `.tracker-method-footer` for the methodology footer bar.

#### Validation

- All 354 unit tests pass.
- `npm run lint` — clean.
- `npm run style` (stylelint) — clean.
- `npm run validate` — clean (0 errors, 0 warnings; 497-URL sitemap; 696 HTML files; 0 unsafe DOM
  sinks).

### Admin Panel — Supabase Migration

- Migrated admin authentication from JWT/Express to **Supabase GitHub OAuth**
- Admin panel now at `/admin/` with dedicated login, dashboard, shops, settings, pricing, orders,
  content, social, and analytics pages
- **Shops** and **Settings** pages fully connected to Supabase database
- Pricing, Orders, Content, Social, and Analytics pages are UI shells (localStorage) pending
  Supabase migration
- Deprecated `admin/api-client.js` (Express JWT client) — no admin page imports it
- Added `admin/supabase-auth.js` and `admin/supabase-config.js` for Supabase integration

### Twitter / Social Automation

- Added Python-based posting system (`scripts/gold_poster.py`) with support for:
  - Hourly gold price posts
  - Market session open/close events
  - Price spike alerts
  - System health checks
- Added Supabase logging to `gold_prices` and `fetch_logs` tables
- Added GitHub Actions workflows: `hourly_post.yml`, `market_events.yml`, `spike_alert.yml`,
  `health_check.yml`
- Original JavaScript system (`scripts/tweet-gold-price.js`) retained for compatibility

### Infrastructure & Bug Fixes

- Fixed `sync-db-to-git.yml`: corrected secret name (`SUPABASE_SERVICE_KEY` →
  `SUPABASE_SERVICE_ROLE_KEY`) and output format (CommonJS → ES module)
- Created `.env.example` template with all required environment variables
- Added `supabase/schema.sql` with 6 tables: `shops`, `site_settings`, `audit_logs`,
  `user_profiles`, `gold_prices`, `fetch_logs`
- Upgraded Vite to ^8.0.8, express-rate-limit to ^8.3.2 (0 npm audit vulnerabilities)

### Documentation Overhaul

- Rewrote `docs/ADMIN_GUIDE.md` and `docs/ADMIN_SETUP.md` for Supabase auth
- Updated all 20+ docs files for accuracy
- Fixed version contradictions across docs (Vite, express-rate-limit)
- Added comprehensive automation docs covering all 14 GitHub Actions workflows

### Phase 4 — Tracker Fixes

#### tracker-pro.js

- **Fix 1 (DOM guard):** `init()` now waits for `DOMContentLoaded` before proceeding if the document
  is not yet interactive/complete, preventing null-element errors during early script execution.
- **Fix 2 (Countdown timer):** Added `startCountdown()` function that counts down from
  `CONSTANTS.GOLD_REFRESH_MS / 1000` seconds and updates a `#tp-countdown` element. Called at
  startup and on each auto-refresh cycle.
- **Fix 3 (Offline banner):** Added `handleOnlineStatus()` function that injects a fixed red banner
  when the browser goes offline, showing the timestamp of the last cached price. Banner is removed
  automatically when connectivity is restored.
- **Fix 4 (Touch swipe):** Added `touchstart`/`touchend` listeners on `#tp-market-board` to support
  swipe navigation between region tabs (gcc → levant → africa → global) on mobile devices. Minimum
  swipe distance: 50px.

### Phase 8 — SEO Engine

#### seo/metadataGenerator.js (new)

- Created centralized metadata generator for all page types: `home`, `country`, `city-prices`,
  `city-shops`, `city-karat`, `calculator`, `history`, `order`, `tracker`, `shops`.
- Each route produces: `title`, `description`, `canonical`, `hreflang` array, `og` object, and
  `jsonLd` schema.
- JSON-LD output includes `BreadcrumbList` for all routes, plus specialised schema for `calculator`
  (SoftwareApplication), `history` (Dataset), and `order` (Offer).

### Phase 10 — Monetization (Ad Slots)

#### components/adSlot.js (new)

- Lazy-loading Google AdSense slot component using `IntersectionObserver`.
- Supports three ad formats: `leaderboard` (728×90 / 320×50 mobile), `rectangle` (300×250),
  `skyscraper` (160×600, hidden on mobile).
- Reserves space before ad loads via `minHeight` to prevent CLS (Cumulative Layout Shift).
- Skips rendering on admin pages and in SSR/non-browser environments.
- Placeholder publisher ID `ca-pub-XXXXXXXXXX` must be replaced before going live.

### Phase 11 — Navigation & UX Polish

#### components/nav-data.js

- Added to **Tools** group (both `en` and `ar`):
  - Price History → `../gold-price-history/`
  - Order Gold → `../order-gold/`
  - X Post Generator → `../social/x-post-generator.html`

#### components/footer.js

- Added to Tools column (both EN and AR):
  - Price History link → `../gold-price-history/`
  - Order Gold link → `../order-gold/`

#### components/breadcrumbs.js

- Added `generateBreadcrumbSchema(items, baseUrl)` export that returns a
  `<script type="application/ld+json">` string containing a `schema.org/BreadcrumbList` for use in
  page `<head>` sections.

### Phase 12 — Performance & Cleanup

#### index.html

- Added `<link rel="preconnect">` hints for `https://api.goldpricez.com` and
  `https://open.er-api.com` to reduce latency on first API call after page load.
