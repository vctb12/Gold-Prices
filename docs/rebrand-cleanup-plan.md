# Rebrand & Cleanup Plan — Minimal IA (2026-05-19)

## 1) Audit inventory snapshot

- Root HTML pages: **16**
- Content HTML pages: **23** (down from 35)
- Country/city/karat pages: **608** (kept as core programmatic SEO cluster)
- Total HTML pages (repo-wide): **690** (down from 702)

### Landing/content pages reviewed

- Core tool pages: `index.html`, `tracker.html`, `calculator.html`, `methodology.html`
- Trust/legal: `terms.html`, `privacy.html`
- Country cluster: `countries/**`
- Content cluster: `content/**` (guides/tools/insights-support pages)

## 2) Scoring rubric (0–5 each)

| Bucket                                                                                                       | User value | Organic value | Uniqueness | Maintainability (inverse cost) | Tracker-first fit | Decision                                   |
| ------------------------------------------------------------------------------------------------------------ | ---------: | ------------: | ---------: | -----------------------------: | ----------------: | ------------------------------------------ |
| Core pages (`/`, `/tracker`, `/calculator`, `/methodology`)                                                  |          5 |             5 |          5 |                              4 |                 5 | **KEEP**                                   |
| Country gold-price + city gold-prices + gold-rate clusters                                                   |          5 |             5 |          4 |                              2 |                 4 | **KEEP**                                   |
| Shops + submit-shop + order-gold                                                                             |          4 |             4 |          4 |                              3 |                 3 | **KEEP**                                   |
| High-intent guides (`spot-vs-retail`, `making-charges`, `gold-price-history`, UAE/Dubai/GCC guides)          |          4 |             4 |          4 |                              3 |                 4 | **KEEP**                                   |
| Utility tools (`weight-converter`, `zakat-calculator`, `investment-return`)                                  |          3 |             3 |          3 |                              3 |                 3 | **KEEP**                                   |
| Thin/duplicative hubs (`content/`, `content/guides/`, `content/tools/`, `content/embed/`, `content/social/`) |          1 |             1 |          1 |                              1 |                 1 | **REMOVE + REDIRECT**                      |
| Overlapping landing pages (`compare-countries`, `todays-best-rates`, `premium-watch`, `news`, `changelog`)   |          2 |             2 |          2 |                              1 |                 2 | **MERGE into Tracker/Insights + REDIRECT** |
| Overlapping karat landings (`22k-gold-price-guide`, `24k-gold-price-guide`)                                  |          2 |             2 |          1 |                              1 |                 2 | **MERGE into Learn + REDIRECT**            |

## 3) Decision buckets

## KEEP

- `index.html`
- `tracker.html` (flagship command center)
- `calculator.html`
- `methodology.html`
- `learn.html`, `insights.html`, `invest.html`
- `shops.html`
- `content/gold-price-history/`
- `content/spot-vs-retail-gold-price/`
- `content/gold-making-charges-guide/`
- `content/uae-gold-buying-guide/`
- `content/dubai-gold-rate-guide/`
- `content/gcc-gold-price-comparison/`
- `content/guides/*.html` (article pages, not deleted)
- `content/tools/*.html` (tool pages, not deleted)
- `content/submit-shop/`, `content/order-gold/`, `content/faq/`, `content/search/`
- `countries/**`

## MERGE / CONSOLIDATE

- `content/compare-countries/` → merge intent into `tracker.html#mode=compare`
- `content/todays-best-rates/` → merge intent into `tracker.html#mode=compare`
- `content/premium-watch/` → merge intent into `insights.html`
- `content/news/` + `content/changelog/` → merge intent into `insights.html`
- `content/22k-gold-price-guide/` + `content/24k-gold-price-guide/` → merge intent into
  `learn.html#karats`

## REMOVE / REDIRECT

- `content/index.html`
- `content/guides/index.html`
- `content/tools/index.html`
- `content/embed/index.html`
- `content/social/index.html`
- `content/compare-countries/index.html`
- `content/todays-best-rates/index.html`
- `content/premium-watch/index.html`
- `content/news/index.html`
- `content/changelog/index.html`
- `content/22k-gold-price-guide/index.html`
- `content/24k-gold-price-guide/index.html`

## 4) Reduced architecture (minimal sitemap intent)

1. Home (`/`)
2. Tracker command center (`/tracker.html`)
3. Calculator (`/calculator.html`)
4. Methodology (`/methodology.html`)
5. Country/city/karat core clusters (`/countries/**`)
6. Shops + submission flows (`/shops.html`, `/content/submit-shop/`)
7. Essential trust/legal/help (`/privacy.html`, `/terms.html`, `/learn.html`, `/insights.html`,
   selected high-value guides/tools)

Rationale: keep core jobs and trust pages, remove duplicate entry points, and route auxiliary intent
into stronger parent experiences (Tracker/Learn/Insights).

## 5) Redirect mapping (old → new)

| Old URL                          | New URL                      |
| -------------------------------- | ---------------------------- |
| `/content/index.html`            | `/learn.html`                |
| `/content/guides/`               | `/learn.html`                |
| `/content/tools/`                | `/calculator.html`           |
| `/content/embed/`                | `/tracker.html`              |
| `/content/social/`               | `/insights.html`             |
| `/content/compare-countries/`    | `/tracker.html#mode=compare` |
| `/content/todays-best-rates/`    | `/tracker.html#mode=compare` |
| `/content/premium-watch/`        | `/insights.html`             |
| `/content/news/`                 | `/insights.html`             |
| `/content/changelog/`            | `/insights.html`             |
| `/content/22k-gold-price-guide/` | `/learn.html#karats`         |
| `/content/24k-gold-price-guide/` | `/learn.html#karats`         |
| `/compare`                       | `/tracker.html#mode=compare` |
| `/best-rates`                    | `/tracker.html#mode=compare` |
| `/news`                          | `/insights.html`             |
| `/22k`                           | `/learn.html#karats`         |
| `/24k`                           | `/learn.html#karats`         |
