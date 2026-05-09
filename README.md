<div align="center">

# Gold Ticker Live

### Live Gold Intelligence Platform for UAE, GCC, Arab Markets & Global Reference Pricing

### منصة أسعار الذهب المباشرة والتحليلية

A bilingual gold-price platform built for users who need more than a basic spot quote — combining
live spot-linked pricing, market comparison, calculator tools, historical views, exports, alerts,
country pages, and Arabic-first accessibility.

> **For coding agents:** see [`AGENTS.md`](AGENTS.md) and the
> [Agent Prompt Library v2](docs/GOLD_TICKER_LIVE_AGENT_PROMPTS.md).

<p>
  <a href="https://goldtickerlive.com/">
    <img src="https://img.shields.io/badge/Live%20Site-Open%20Now-C9A227?style=for-the-badge&logo=googlechrome&logoColor=white" alt="Live Site" />
  </a>
  <a href="https://goldtickerlive.com/tracker.html">
    <img src="https://img.shields.io/badge/Tracker-Live%20Workspace-1F6FEB?style=for-the-badge&logo=dependabot&logoColor=white" alt="Tracker Workspace" />
  </a>
  <a href="https://goldtickerlive.com/calculator.html">
    <img src="https://img.shields.io/badge/Calculator-Gold%20Tools-2DA44E?style=for-the-badge&logo=calculator&logoColor=white" alt="Calculator" />
  </a>
  <a href="https://goldtickerlive.com/shops.html">
    <img src="https://img.shields.io/badge/Shops-Directory-E67E22?style=for-the-badge&logo=google-maps&logoColor=white" alt="Shops" />
  </a>
  <a href="https://github.com/vctb12/GoldTickerLive/wiki">
    <img src="https://img.shields.io/badge/Wiki-Full%20Docs-6F42C1?style=for-the-badge&logo=github&logoColor=white" alt="Wiki" />
  </a>
</p>

<p>
  <a href="#platform-highlights">
    <img src="https://img.shields.io/badge/Language-English%20%2F%20Arabic-8B5CF6?style=flat-square" alt="Bilingual" />
  </a>
  <a href="#supported-markets">
    <img src="https://img.shields.io/badge/Markets-24%2B-C2410C?style=flat-square" alt="Markets" />
  </a>
  <a href="#platform-highlights">
    <img src="https://img.shields.io/badge/Karats-7-F59E0B?style=flat-square" alt="Karats" />
  </a>
  <a href="#core-workspaces">
    <img src="https://img.shields.io/badge/Exports-CSV%20%2B%20JSON-059669?style=flat-square" alt="Exports" />
  </a>
  <a href="#automation--social-posting">
    <img src="https://img.shields.io/badge/Automation-8%20Workflows-FF6B6B?style=flat-square" alt="Automation" />
  </a>
  <a href="#system-resilience-and-offline-behavior">
    <img src="https://img.shields.io/badge/Offline-Friendly-111827?style=flat-square" alt="Offline Friendly" />
  </a>
  <a href="#system-resilience-and-offline-behavior">
    <img src="https://img.shields.io/badge/PWA-Ready-0EA5E9?style=flat-square" alt="PWA" />
  </a>
  <a href="#license">
    <img src="https://img.shields.io/badge/License-MIT-2563EB?style=flat-square" alt="License" />
  </a>
</p>

</div>

---

## Table of Contents

- [Overview](#overview)
- [Platform Highlights](#platform-highlights)
- [Screenshots](#screenshots)
- [Architecture](#architecture)
- [Quick Start](#quick-start)
- [All Pages & Tools](#all-pages--tools)
- [Core Workspaces](#core-workspaces)
- [Supported Markets](#supported-markets)
- [Data Sources & Price Logic](#data-sources--price-logic)
- [Automation & Social Posting](#automation--social-posting)
- [Admin Panel](#admin-panel)
- [System Resilience](#system-resilience-and-offline-behavior)
- [Deployment](#deployment)
- [API Setup](#api-setup)
- [Project Structure](#project-structure)
- [Contributing](#contributing)
- [Troubleshooting](#troubleshooting)
- [Roadmap](#roadmap)
- [License](#license)

---

## Overview

**Gold Ticker Live** is a bilingual, multi-page gold pricing platform built for the UAE, GCC, the
wider Arab world, and selected global reference markets.

The front-end is a static, multi-page site (no SPA, no heavy framework) authored as vanilla ES
modules and styled with hand-written CSS. It is bundled for production with Vite and deployed as
static assets. An optional Node/Express surface (`server.js` + `server/`) backs the admin area —
authentication, shop/order/content management, and rate-limited API proxying — and is **not**
required for the public pages, which remain 100% static.

> Most gold sites are either too narrow, too messy, too static, too ad-heavy, or too unclear about
> how their numbers are formed.

Gold Ticker Live is built to be **cleaner, more transparent, more bilingual, and more useful in
practice**, combining:

- Live **XAU/USD spot-linked pricing** refreshed every 90 seconds
- **Local currency estimates** for 24+ markets
- **7 purity-adjusted karat views** (24K → 14K)
- **Historical archive**, date lookup, and price comparison
- **Browser-based alerts** and saved presets
- **Practical gold calculators** (value, scrap, zakat, weight conversion)
- **Country-specific market pages** (395+ HTML pages across 15 countries)
- **Gold shop directory** with city/market browsing
- **Order gold online** feature with live pricing
- **CSV / JSON exports** and shareable URL state
- **English + Arabic** with full RTL support
- **Offline-friendly**, local-first architecture with service worker
- **Automated social posting** to X/Twitter, Telegram, and Discord

---

## Platform Highlights

| Feature                      | Description                                                       |
| ---------------------------- | ----------------------------------------------------------------- |
| 🏷️ **Live Pricing**          | XAU/USD spot-linked, refreshed every 90 seconds                   |
| 💎 **7 Karats**              | 24K, 22K, 21K, 20K, 18K, 16K, 14K with purity fractions           |
| 🌍 **24+ Markets**           | GCC, Levant, North Africa, India, global references               |
| 🌐 **Bilingual**             | Full English + Arabic interface with RTL                          |
| 📊 **Tracker Workspace**     | Multi-mode: Live, Compare, Archive, Alerts, Planner, Exports      |
| 🧮 **Calculator Suite**      | Value, Scrap, Zakat, Buying Power, Weight Converter               |
| 🏪 **Shop Directory**        | Gold shops searchable by country, city, and market                |
| 🛒 **Order Gold**            | 1g–100g bars, 4 karats, live pricing with VAT                     |
| 📱 **PWA Ready**             | Installable, offline-capable with service worker                  |
| 🤖 **8 Automated Workflows** | Hourly tweets, Telegram, Discord, spike alerts, uptime monitoring |
| 📰 **RSS Feed**              | Auto-generated RSS for price updates                              |
| 🔍 **Full-text Search**      | Bilingual search across countries, cities, and tools              |

---

## Screenshots

<p align="center">
  <img src="./assets/screenshots/home.png" alt="Home" width="32%" />
  <img src="./assets/screenshots/calculator.png" alt="Calculator" width="32%" />
  <img src="./assets/screenshots/methodology.png" alt="Methodology" width="32%" />
</p>

---

## Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│                        HTML Pages                           │
│  index.html · tracker.html · calculator.html · shops.html   │
│  learn.html · insights.html · methodology.html · invest.html│
│  countries/*.html · content/guides/ · content/order-gold/   │
├─────────────────────────────────────────────────────────────┤
│              Page-specific JS (src/pages/)                  │
│  home.js · tracker-pro.js · calculator.js · shops.js · …    │
├─────────────────────────────────────────────────────────────┤
│              Shared Components (src/components/)            │
│  nav.js · footer.js · ticker.js · breadcrumbs.js · chart.js │
│  adSlot.js (Google AdSense lazy loader)                     │
├─────────────────────────────────────────────────────────────┤
│                Core Libraries (src/lib/)                    │
│  api.js → cache.js → price-calculator.js → formatter.js     │
│  export.js · historical-data.js · search.js · alerts.js     │
├─────────────────────────────────────────────────────────────┤
│              Configuration (src/config/)                    │
│  constants.js · countries.js · karats.js · translations.js  │
├─────────────────────────────────────────────────────────────┤
│                External APIs                                │
│  goldpricez.com (XAU/USD) · open.er-api.com (FX rates)        │
│  datahub.io (historical) · GDELT (news headlines)           │
└─────────────────────────────────────────────────────────────┘
```

**Data flow:** HTML page → page JS → `src/lib/api.js` → `src/lib/cache.js` (dual-layer localStorage)
→ `src/lib/price-calculator.js` → `src/lib/formatter.js` → DOM

---

## Quick Start

### Run locally (no build required)

```bash
git clone https://github.com/vctb12/GoldTickerLive.git
cd GoldTickerLive
python3 -m http.server 8080
# Open http://localhost:8080
```

### Run with Vite (for development with HMR)

```bash
npm install
npm run dev
# Open http://localhost:5000
```

### Build for production

```bash
npm run build        # Outputs to dist/
npm run preview      # Preview the production build
```

### Debug mode

Append `?debug=true` to any page URL to expose a debug panel for:

- Simulating gold API failure
- Simulating FX API failure
- Clearing localStorage cache
- Inspecting live state

### Run tests

```bash
npm install
npm test             # ~350 unit tests across the suite
npm run lint         # ESLint (flat config in eslint.config.mjs)
npm run validate     # build integrity + DOM safety + SEO + sitemap + sw-coverage gates
npm run quality      # lint + prettier --check + stylelint
```

### Run preflight checks

```bash
npm run preflight    # Runs audit-pages + check-links
npm run seo-audit    # Validates SEO metadata across all pages
```

### Environment variables

The Express admin backend (`server.js`) refuses to start without `JWT_SECRET`, `ADMIN_PASSWORD`, and
`ADMIN_ACCESS_PIN`. The full env-var matrix — including optional Supabase, newsletter, and Stripe
keys — lives in [`docs/environment-variables.md`](./docs/environment-variables.md). A `.env.example`
template ships in repo root.

---

## All Pages & Tools

### Core Pages

| Page            | URL                                                                | Description                                                            |
| --------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| **Homepage**    | [`/`](https://goldtickerlive.com/)                                 | Live price hero, GCC grid, tool cards                                  |
| **Tracker**     | [`/tracker.html`](https://goldtickerlive.com/tracker.html)         | Multi-mode workspace: live, compare, archive, alerts, planner, exports |
| **Calculator**  | [`/calculator.html`](https://goldtickerlive.com/calculator.html)   | Value, scrap, zakat, buying power, unit converter                      |
| **Shops**       | [`/shops.html`](https://goldtickerlive.com/shops.html)             | Gold shop directory by country/city/market                             |
| **Invest**      | [`/invest.html`](https://goldtickerlive.com/invest.html)           | Gold investing guide for UAE, Saudi & Egypt                            |
| **Learn**       | [`/learn.html`](https://goldtickerlive.com/learn.html)             | Educational content, glossary, FAQ                                     |
| **Insights**    | [`/insights.html`](https://goldtickerlive.com/insights.html)       | Market analysis and weekly briefs                                      |
| **Methodology** | [`/methodology.html`](https://goldtickerlive.com/methodology.html) | Data sources, formulas, transparency                                   |

### Tools & Features

| Tool                  | URL                                                                                                        | Description                                    |
| --------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| **Order Gold**        | [`/content/order-gold/`](https://goldtickerlive.com/content/order-gold/)                                   | Order 1g–100g bars with live pricing + UAE VAT |
| **X Post Generator**  | [`/content/social/x-post-generator.html`](https://goldtickerlive.com/content/social/x-post-generator.html) | Generate ready-to-post X/Twitter updates       |
| **Price History**     | [`/content/gold-price-history/`](https://goldtickerlive.com/content/gold-price-history/)                   | Historical gold price data and charts          |
| **Search**            | [`/content/search/`](https://goldtickerlive.com/content/search/)                                           | Bilingual full-text search                     |
| **Weight Converter**  | [`/content/tools/weight-converter.html`](https://goldtickerlive.com/content/tools/weight-converter.html)   | Grams ↔ Troy oz ↔ Tola ↔ Baht ↔ Mithqal        |
| **Zakat Calculator**  | [`/content/tools/zakat-calculator.html`](https://goldtickerlive.com/content/tools/zakat-calculator.html)   | Interactive gold zakat calculation             |
| **Investment Return** | [`/content/tools/investment-return.html`](https://goldtickerlive.com/content/tools/investment-return.html) | Historical investment return calculator        |
| **Embed Widget**      | [`/content/embed/gold-ticker.html`](https://goldtickerlive.com/content/embed/gold-ticker.html)             | Embeddable gold price ticker                   |

### Guides

| Guide                 | URL                                                                                                                  |
| --------------------- | -------------------------------------------------------------------------------------------------------------------- |
| How to Buy Gold       | [`/content/guides/buying-guide.html`](https://goldtickerlive.com/content/guides/buying-guide.html)                   |
| 24K vs 22K Gold       | [`/content/guides/24k-vs-22k.html`](https://goldtickerlive.com/content/guides/24k-vs-22k.html)                       |
| Gold Karat Comparison | [`/content/guides/gold-karat-comparison.html`](https://goldtickerlive.com/content/guides/gold-karat-comparison.html) |
| AED Peg Explained     | [`/content/guides/aed-peg-explained.html`](https://goldtickerlive.com/content/guides/aed-peg-explained.html)         |
| GCC Market Hours      | [`/content/guides/gcc-market-hours.html`](https://goldtickerlive.com/content/guides/gcc-market-hours.html)           |
| Invest in Gold (GCC)  | [`/content/guides/invest-in-gold-gcc.html`](https://goldtickerlive.com/content/guides/invest-in-gold-gcc.html)       |
| Zakat on Gold         | [`/content/guides/zakat-gold-guide.html`](https://goldtickerlive.com/content/guides/zakat-gold-guide.html)           |

### Country Pages (15 countries, 45+ cities)

| Country         | URL                                                                                      | Cities                                               |
| --------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| 🇦🇪 UAE          | [`/countries/uae.html`](https://goldtickerlive.com/countries/uae.html)                   | Dubai, Abu Dhabi, Sharjah, Ajman, Fujairah, RAK, UAQ |
| 🇸🇦 Saudi Arabia | [`/countries/saudi-arabia.html`](https://goldtickerlive.com/countries/saudi-arabia.html) | Riyadh, Jeddah, Mecca, Medina, Dammam                |
| 🇰🇼 Kuwait       | [`/countries/kuwait.html`](https://goldtickerlive.com/countries/kuwait.html)             | Kuwait City, Hawalli, Salmiya                        |
| 🇶🇦 Qatar        | [`/countries/qatar.html`](https://goldtickerlive.com/countries/qatar.html)               | Doha, Al Rayyan, Al Wakrah                           |
| 🇧🇭 Bahrain      | [`/countries/bahrain.html`](https://goldtickerlive.com/countries/bahrain.html)           | Manama, Muharraq, Rifaa                              |
| 🇴🇲 Oman         | [`/countries/oman.html`](https://goldtickerlive.com/countries/oman.html)                 | Muscat, Salalah, Sohar                               |
| 🇪🇬 Egypt        | [`/countries/egypt.html`](https://goldtickerlive.com/countries/egypt.html)               | Cairo, Alexandria, Giza                              |
| 🇯🇴 Jordan       | [`/countries/jordan.html`](https://goldtickerlive.com/countries/jordan.html)             | Amman, Irbid, Zarqa                                  |
| 🇱🇧 Lebanon      | [`/countries/lebanon.html`](https://goldtickerlive.com/countries/lebanon.html)           | Beirut, Tripoli, Sidon                               |
| 🇲🇦 Morocco      | [`/countries/morocco.html`](https://goldtickerlive.com/countries/morocco.html)           | Casablanca, Rabat, Marrakech                         |
| 🇹🇳 Tunisia      | [`/countries/tunisia.html`](https://goldtickerlive.com/countries/tunisia.html)           | Tunis, Sfax, Sousse                                  |
| 🇩🇿 Algeria      | [`/countries/algeria.html`](https://goldtickerlive.com/countries/algeria.html)           | Algiers, Oran, Constantine                           |
| 🇱🇾 Libya        | [`/countries/libya.html`](https://goldtickerlive.com/countries/libya.html)               | Tripoli, Benghazi, Misrata                           |
| 🇸🇩 Sudan        | [`/countries/sudan.html`](https://goldtickerlive.com/countries/sudan.html)               | Khartoum, Omdurman, Port Sudan                       |
| 🇮🇳 India        | [`/countries/india.html`](https://goldtickerlive.com/countries/india.html)               | Mumbai, Delhi, Chennai                               |

---

## Core Workspaces

### Tracker Workspace

| Mode        | Purpose                                                                |
| ----------- | ---------------------------------------------------------------------- |
| **Live**    | Live chart, key metrics, karat ladder, watchlist, and directional cues |
| **Compare** | Compare markets and rank countries by selected view                    |
| **Archive** | Browse historical data and run date lookup                             |
| **Alerts**  | Save local browser alerts and preset states                            |
| **Planner** | Budget, jewelry estimate, accumulation, and scenario planning          |
| **Exports** | Download CSV, JSON, and brief outputs                                  |
| **Method**  | Review sources, pricing assumptions, and methodology                   |

### Calculator Suite

- **Gold Value Calculator** — Weight × karat × live price
- **Scrap Gold Calculator** — Price old jewelry by weight and purity
- **Zakat on Gold Calculator** — Islamic zakat obligation threshold
- **Buying Power Calculator** — How much gold can you buy with X amount?
- **Weight Unit Converter** — Grams ↔ Troy oz ↔ Tola ↔ Baht ↔ Mithqal

---

## Supported Markets

| Region                  | Countries                                                                              |
| ----------------------- | -------------------------------------------------------------------------------------- |
| **GCC**                 | UAE, Saudi Arabia, Kuwait, Qatar, Bahrain, Oman                                        |
| **Levant**              | Jordan, Lebanon, Syria, Palestine                                                      |
| **North & East Africa** | Egypt, Libya, Tunisia, Algeria, Morocco, Sudan, Somalia, Mauritania, Djibouti, Comoros |
| **Global Reference**    | USA, United Kingdom, Eurozone, India                                                   |

---

## Data Sources & Price Logic

| Source                                                                       | Used for                | Notes                       |
| ---------------------------------------------------------------------------- | ----------------------- | --------------------------- |
| [GoldPriceZ](https://goldpricez.com/docs)                                    | Live XAU/USD spot price | Primary live market layer   |
| [ExchangeRate-API](https://www.exchangerate-api.com/docs/free)               | Currency conversion     | FX layer                    |
| Hardcoded `3.6725`                                                           | UAE pricing             | Official AED/USD peg        |
| [DataHub Gold Prices](https://datahub.io/core/gold-prices)                   | Historical baseline     | Long-range historical layer |
| [GDELT DOC API](https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/amp/) | Market wire / headlines | News strip layer            |

### Price formulas

```text
1 troy ounce = 31.1035 grams

usdPerGram(karat) = (spotUsdPerOz / 31.1035) × purity
usdPerOz(karat)   = spotUsdPerOz × purity
localPrice        = usdPrice × fxRate
AED price         = usdPrice × 3.6725 (fixed peg)
```

> ⚠️ Prices are **spot-linked bullion-equivalent estimates**, not final retail prices. Real store
> prices may differ due to making charges, dealer premiums, VAT, and shop markup.

---

## Automation & Social Posting

Gold Ticker Live runs **GitHub Actions workflows** for automated operations:

| Workflow                  | Schedule                              | Description                                                                 |
| ------------------------- | ------------------------------------- | --------------------------------------------------------------------------- |
| `gold-price-fetch.yml`    | Hourly (market hours, :02)            | Fetches gold prices from provider waterfall; commits `data/gold_price.json` |
| `post_gold.yml`           | Hourly (market hours, :09) + dispatch | Posts to X/Twitter from cached price; full guard stack                      |
| `gold-price-telegram.yml` | 3×/day                                | Posts to Telegram channel (07:00, 12:00, 18:00 UTC)                         |
| `gold-price-discord.yml`  | Daily                                 | Posts to Discord server at noon Dubai time                                  |
| `gold-price-spike.yml`    | Hourly                                | Alerts on >2% intra-day price spikes                                        |
| `uptime-monitor.yml`      | Every 30min                           | Pings the live site and alerts on failure                                   |
| `weekly-link-check.yml`   | Weekly (Mon)                          | Checks for broken internal links                                            |
| `deploy.yml`              | On push to main                       | Builds with Vite and deploys to GitHub Pages                                |
| `sync-db-to-git.yml`      | On dispatch                           | Syncs Supabase shop data to Git                                             |

**X / Twitter posting architecture:** `gold-price-fetch.yml` (at `:02`) fetches and caches the
price; `post_gold.yml` (at `:09`) reads the cache and posts. Only the fetch workflow calls provider
APIs. See `docs/twitter_bot_architecture.md` for the full guard stack, post types, and operator
inputs.

### Required GitHub Secrets

| Secret                | Used by                                           |
| --------------------- | ------------------------------------------------- |
| `CONSUMER_KEY`        | `post_gold.yml` (X / Twitter posting)             |
| `CONSUMER_SECRET`     | `post_gold.yml`                                   |
| `ACCESS_TOKEN`        | `post_gold.yml`                                   |
| `ACCESS_TOKEN_SECRET` | `post_gold.yml`                                   |
| `GOLD_API_COM_KEY`    | `gold-price-fetch.yml`, `post_gold.yml` (refresh) |
| `TWELVEDATA_API_KEY`  | `gold-price-fetch.yml`, `post_gold.yml` (refresh) |
| `FMP_API_KEY`         | `gold-price-fetch.yml`, `post_gold.yml` (refresh) |
| `GOLDPRICEZ_API_KEY`  | `gold-price-fetch.yml` (legacy fallback)          |
| `TELEGRAM_BOT_TOKEN`  | Telegram workflow                                 |
| `TELEGRAM_CHAT_ID`    | Telegram workflow                                 |
| `DISCORD_WEBHOOK_URL` | Discord workflow                                  |

4. **Adjust spike threshold** — edit `config/twitter_bot/thresholds.json` (no code changes needed)

5. **Change tweet format** — edit `config/twitter_bot/tweet_templates.json` (no code changes needed)

See [`docs/twitter_bot_architecture.md`](docs/twitter_bot_architecture.md) for the full system
design, [`docs/twitter_bot_secrets.md`](docs/twitter_bot_secrets.md) for secret details, and
[`docs/twitter_bot_schema.md`](docs/twitter_bot_schema.md) for database schema.

---

## Admin Panel

The platform includes a full admin panel at `/admin/` with:

| Module    | Path                | Description                                   |
| --------- | ------------------- | --------------------------------------------- |
| Dashboard | `/admin/`           | Stats overview, API status, activity timeline |
| Shops     | `/admin/shops/`     | Manage gold shop directory                    |
| Orders    | `/admin/orders/`    | Track gold orders                             |
| Pricing   | `/admin/pricing/`   | Price management and overrides                |
| Content   | `/admin/content/`   | Content management                            |
| Social    | `/admin/social/`    | Social media management                       |
| Analytics | `/admin/analytics/` | Traffic and engagement analytics              |
| Settings  | `/admin/settings/`  | Site configuration and ad management          |

**Server-side API:** The admin panel is backed by an Express.js server (`server.js`) with JWT
authentication, rate limiting, and Helmet security headers.

---

## System Resilience and Offline Behavior

| State      | Gold       | FX         | Behavior                                      |
| ---------- | ---------- | ---------- | --------------------------------------------- |
| ✅ Live    | Live       | Live       | Full precision, live state                    |
| ⚠️ Partial | Live       | Stale      | FX badge shows stale age                      |
| ⚠️ Partial | Stale      | Live       | Gold badge shows stale age                    |
| 🔶 Cached  | Both stale | Both stale | Dual stale indicators, cache-backed rendering |
| 🔴 Empty   | No cache   | No cache   | Empty state with retry flow                   |

**Cache strategy:** Dual-layer localStorage persistence (primary + fallback) prevents data loss.
Service worker (`sw.js`) serves static assets cache-first and API calls network-first. Offline
fallback page shows last-known prices.

---

## Deployment

### GitHub Pages (default)

The site deploys automatically to GitHub Pages on push to `main` via `.github/workflows/deploy.yml`:

1. `npm ci` → `npm run build` (Vite)
2. Auto-regenerates `sitemap.xml` and `feed.xml`
3. Copies static assets, country pages, and ES modules to `dist/`
4. Deploys to GitHub Pages

**Live URL:** `https://goldtickerlive.com/`

### Custom domain

The site is served from the custom domain `goldtickerlive.com` (configured via the `CNAME` file). To
set up your own custom domain:

1. Add a `CNAME` file to the repo root with your domain name
2. Configure DNS: `CNAME` record pointing to `vctb12.github.io`
3. Enable "Enforce HTTPS" in GitHub Pages settings

### Self-hosted

```bash
npm install
npm run build
# Serve the dist/ directory with any static file server (nginx, Apache, Caddy, etc.)
```

For the admin API:

```bash
npm install
npm start  # Starts Express server on port 3000
```

---

## API Setup

### GoldPriceZ (required for live prices)

1. Sign up at [goldpricez.com](https://goldpricez.com)
2. Get your API key
3. Add as GitHub Secret: `GOLDPRICEZ_API_KEY`
4. The `gold-price-fetch` workflow (`.github/workflows/gold-price-fetch.yml`) calls goldpricez.com
   every 6 minutes and commits the response to `data/gold_price.json`. The frontend and all bots
   read from that committed file — the key never ships to the browser.

### ExchangeRate API (required for FX conversion)

1. Sign up at [exchangerate-api.com](https://www.exchangerate-api.com)
2. Free tier: 1,500 requests/month
3. Configure in `src/config/constants.js`

### X/Twitter API (for automated tweets)

1. Apply for X Developer account at [developer.twitter.com](https://developer.twitter.com)
2. Create a project with read+write permissions
3. Generate OAuth 1.0a tokens
4. Add 4 secrets: `TWITTER_API_KEY`, `TWITTER_API_SECRET`, `TWITTER_ACCESS_TOKEN`,
   `TWITTER_ACCESS_TOKEN_SECRET`

### Telegram Bot (for channel posts)

1. Create a bot via [@BotFather](https://t.me/BotFather)
2. Add bot to your channel as admin
3. Add secrets: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`

### Discord Webhook (for server posts)

1. Create a webhook in your Discord server's channel settings
2. Add secret: `DISCORD_WEBHOOK_URL`

---

## Project Structure

```text
GoldTickerLive/
├── index.html                 # Landing page / homepage
├── tracker.html               # Multi-mode live gold tracker workspace
├── calculator.html            # Gold calculator page (5 calculators)
├── shops.html                 # Gold shop directory
├── learn.html                 # Educational content and glossary
├── insights.html              # Market analysis and insights
├── methodology.html           # Data sources and transparency
├── invest.html                # Gold investing guide
├── offline.html               # Offline fallback page
├── styles/global.css            # Shared global styles (theme, layout, responsive)
├── sw.js                      # Service worker (cache-first static, network-first API)
├── server.js                  # Express.js admin API server
├── vite.config.js             # Vite build configuration
│
├── src/pages/                 # Page-specific JavaScript
│   ├── home.js                # Homepage logic
│   ├── tracker-pro.js         # Tracker workspace orchestrator
│   ├── calculator.js          # Calculator logic
│   ├── shops.js               # Shop directory logic
│   ├── learn.js               # Learn page logic
│   ├── insights.js            # Insights page logic
│   └── methodology.js         # Methodology page logic
│
├── styles/pages/              # Page-specific CSS
│   ├── home.css               # Homepage styling
│   ├── tracker-pro.css        # Tracker workspace styling
│   ├── calculator.css         # Calculator styling
│   ├── shops.css              # Shop directory styling
│   ├── learn.css              # Learn page styling
│   ├── insights.css           # Insights page styling
│   ├── methodology.css        # Methodology styling
│   └── invest.css             # Invest page styling
│
├── src/config/                 # Configuration modules
│   ├── constants.js           # API URLs, timing, AED peg (3.6725), troy oz (31.1035)
│   ├── countries.js           # 24+ countries with codes, names (EN/AR), currencies, flags
│   ├── karats.js              # 7 karat definitions with purity fractions
│   ├── translations.js        # All UI strings in English and Arabic
│   └── index.js               # Central config export
│
├── src/lib/                   # Core libraries
│   ├── api.js                 # Fetch with timeout, retry, simulation hooks
│   ├── cache.js               # Dual-layer localStorage persistence
│   ├── price-calculator.js    # Core pricing formulas
│   ├── formatter.js           # Price, date, time formatting
│   ├── export.js              # CSV / JSON / brief export
│   ├── historical-data.js     # Merges session history with DataHub baseline
│   ├── search.js              # Bilingual search and filtering
│   ├── live-status.js         # Market status, freshness helpers
│   ├── count-up.js            # Animated numeric transitions
│   ├── freshness-pulse.js     # One-shot freshness-pulse animation primitive
│   └── reveal.js              # IntersectionObserver scroll-reveal helper
│
├── src/components/            # Shared UI components
│   ├── nav.js                 # Bilingual navigation bar (desktop dropdowns + mobile drawer)
│   ├── nav-data.js            # Navigation menu structure (EN/AR)
│   ├── footer.js              # 5-column footer with data source attribution
│   ├── ticker.js              # Live price ticker strip
│   ├── chart.js               # Interactive price chart
│   ├── breadcrumbs.js         # Breadcrumb navigation
│   └── adSlot.js              # Google AdSense lazy-loading ad component
│
├── src/tracker/               # Tracker workspace modules
│   ├── state.js               # URL hash-synced state management
│   ├── ui-shell.js            # UI orchestration
│   ├── render.js              # Rendering functions
│   ├── events.js              # Event bindings
│   └── wire.js                # News wire module
│
├── content/tools/              # Standalone tool pages
│   ├── weight-converter.html  # Unit conversion tool
│   ├── zakat-calculator.html  # Interactive zakat calculator
│   └── investment-return.html # Historical investment return calculator
│
├── countries/                 # Country landing pages (15 countries)
├── content/guides/            # Educational guide articles (7 guides)
├── content/social/            # X post generator + templates
├── content/order-gold/        # Gold ordering feature
├── content/gold-price-history/# Historical price data page
├── content/search/            # Bilingual search page
├── content/embed/             # Embeddable gold ticker widget
├── admin/                     # Admin panel (dashboard, shops, orders, settings, etc.)
│
├── scripts/                   # Automation & build scripts
│   ├── node/
│   │   ├── tweet-gold-price.js    # X/Twitter posting (10+ rotating templates)
│   │   ├── notify-telegram.js     # Telegram channel notifications
│   │   ├── notify-discord.js      # Discord server notifications
│   │   ├── price-spike-alert.js   # Price spike detection
│   │   ├── uptime-check.js        # Site uptime monitoring
│   │   ├── generate-sitemap.js    # Auto-generate sitemap.xml
│   │   ├── generate-rss.js        # Auto-generate feed.xml
│   │   ├── seo-audit.js           # SEO metadata validation
│   │   ├── check-links.js         # Internal link checker
│   │   └── audit-pages.js         # Page audit script
│   └── python/
│       └── gold_poster.py         # Python gold price poster
│
├── .github/workflows/         # GitHub Actions (8 workflows)
├── data/                      # Static data files (shops, audit logs)
├── assets/                    # Images, screenshots, icons
├── server/                    # Server-side admin routes, middleware, and lib
│   ├── routes/admin/index.js  # Admin API routes
│   ├── lib/                   # Server-side libraries (auth, errors, audit-log, admin/)
│   ├── repositories/          # Data access layer (file + Supabase backends)
│   └── services/              # Backend services (pricing engine, FX, gold API adapter)
├── docs/                      # Extended documentation
│   ├── TEARDOWN.md            # 📖 COMPLETE technical teardown (start here!)
│   ├── ARCHITECTURE.md        # Full system architecture and data flow
│   ├── FILES_GUIDE.md         # Every major file explained
│   ├── EDIT_GUIDE.md          # "Change X → go to Y" quick reference
│   ├── LIMITATIONS.md         # Technical limitations and bottlenecks
│   ├── ERROR_REPORT.md        # Error audit findings and fixes
│   ├── ADMIN_GUIDE.md         # Admin panel usage guide
│   ├── ADMIN_SETUP.md         # Admin setup instructions
│   ├── CONTRIBUTING.md        # Contribution guidelines
│   ├── CHANGELOG.md           # Version history
│   └── …                      # SEO, Supabase, automation, risk docs
├── .env.example               # Environment variable template
└── tests/                     # Test suite (205 tests across 10 files)
```

---

## Developer Documentation

| Document                                                         | Purpose                                                                                   |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| **[`docs/TEARDOWN.md`](docs/TEARDOWN.md)**                       | **📖 Complete technical teardown — every file, system, limitation, and production guide** |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)                   | Full system architecture, data flow, component dependencies                               |
| [`docs/FILES_GUIDE.md`](docs/FILES_GUIDE.md)                     | Every major file — what it does, when to edit it                                          |
| [`docs/EDIT_GUIDE.md`](docs/EDIT_GUIDE.md)                       | "If you want to change X → go to Y" quick reference                                       |
| [`docs/LIMITATIONS.md`](docs/LIMITATIONS.md)                     | Technical limitations, bottlenecks, UX/SEO weaknesses                                     |
| [`docs/ERROR_REPORT.md`](docs/ERROR_REPORT.md)                   | Error audit findings, root causes, and fixes                                              |
| [`docs/environment-variables.md`](docs/environment-variables.md) | Environment variable reference                                                            |
| [`docs/SUPABASE_SETUP.md`](docs/SUPABASE_SETUP.md)               | Supabase migration guide                                                                  |
| [`docs/SEO_CHECKLIST.md`](docs/SEO_CHECKLIST.md)                 | SEO optimization checklist                                                                |
| [`docs/AUTOMATIONS.md`](docs/AUTOMATIONS.md)                     | CI/CD workflow documentation                                                              |
| [`docs/ADMIN_GUIDE.md`](docs/ADMIN_GUIDE.md)                     | Admin dashboard usage guide                                                               |
| [`docs/ADMIN_SETUP.md`](docs/ADMIN_SETUP.md)                     | Admin setup instructions                                                                  |
| [`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md)                   | Contribution guidelines                                                                   |
| [`docs/DEPENDENCIES.md`](docs/DEPENDENCIES.md)                   | Dependency documentation                                                                  |
| [`docs/CHANGELOG.md`](docs/CHANGELOG.md)                         | Version history                                                                           |
| [`.env.example`](.env.example)                                   | Environment variable template — copy to `.env`                                            |

---

## Contributing

See [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) for:

- Code style guide (vanilla ES6, no framework)
- PR workflow and branch naming
- How to add new countries and cities
- How to add new guide pages
- How to add new calculator tools

### Quick rules

- **No frameworks** — vanilla ES6 modules only on the front-end (admin surface uses Express
  server-side)
- **All UI strings** in `src/config/translations.js` (never hard-code)
- **Bilingual** — all user-facing features must support EN + AR
- **Test your changes** — `npm test` must pass
- **Preflight before PR** — `npm run preflight` + `npm run seo-audit`

---

## Troubleshooting

### Pages show "No data available"

- Check browser console for API errors
- Verify GoldPriceZ key is valid at [goldpricez.com](https://goldpricez.com)
- Try `?debug=true` to use the debug panel
- Clear localStorage: `localStorage.clear()` then refresh

### Tracker page not loading

- Ensure `src/pages/tracker-pro.js` exists (moved from root in v11)
- Check for script tag issues in tracker.html
- Verify `src/tracker/state.js` and `src/tracker/ui-shell.js` are accessible

### Service worker serving stale content

- Open DevTools → Application → Service Workers → Unregister
- Hard refresh: Ctrl+Shift+R / Cmd+Shift+R
- Or visit the page with `?debug=true` and click "Clear Cache"

### Build fails with Vite

- Use Node.js 22 LTS (recommended) — see `.nvmrc`
- Run `npm ci` to clean-install dependencies
- Check `vite.config.js` EXCLUDE_DIRS matches your directory structure
- Note: Vite 8.x may not fully support Node.js v24+

### Tests failing

- Run `npm install` first (some tests require `jsonwebtoken` package)
- Pre-existing: `repositories.test.js` may fail if `server/lib/supabase-client.js` is not present

### Tweet workflow not posting

- Verify all 5 Twitter secrets are set in GitHub repository settings
- Check workflow logs in Actions tab
- Ensure the X API app has read+write permissions

---

## Roadmap

### Near-term

- [ ] Multi-source price aggregation (Kitco + London Fix cross-validation)
- [ ] Silver/Platinum/Palladium price expansion
- [ ] Premium tier with ad-free experience
- [ ] Email newsletter automation (daily/weekly digest)
- [ ] Instagram and LinkedIn post automation
- [ ] Portfolio tracker (track gold holdings over time)

### Medium-term

- [ ] Interactive gold price heatmap (world map, color-coded by country)
- [ ] Crypto-gold correlation tracker
- [ ] WhatsApp Business API integration for price alerts
- [ ] Google Sheets plugin (`=GOLDPRICE("UAE","24K")`)
- [ ] Push notifications via Web Push API
- [ ] Multi-language expansion (French, Urdu, Hindi)

### Long-term

- [ ] Premium API for developers (rate-limited free tier)
- [ ] White-label solution for gold dealers
- [ ] Payment integration (Stripe) for gold ordering
- [ ] Mobile app (PWA or React Native)
- [ ] AI-powered market analysis and price predictions

---

## License

MIT
