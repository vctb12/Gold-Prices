# Appendix E — Test Suite & Validate Map

> Parent: [`GOLD_TICKER_LIVE_MASTER_WORKBOOK.md`](../GOLD_TICKER_LIVE_MASTER_WORKBOOK.md)  
> Count on `main`: **115** `tests/*.test.js` files · **1059** tests (run `npm test` to refresh)

## E.1 Before every test run

```bash
rm -rf playwright-report/ test-results/
export JWT_SECRET="dev-secret-key-for-local-development-32chars"
export ADMIN_PASSWORD="admin-dev-password"
export ADMIN_ACCESS_PIN="123456"
npm test
```

## E.2 Test suites by domain

| Domain | Files (representative) | When to run after changing |
| ------ | ---------------------- | -------------------------- |
| **Pricing / freshness** | `pricing-engine`, `price-calculator`, `freshness-*`, `data-attribution`, `provider-failover` | `api.js`, `constants.js`, `karats.js` |
| **First paint / UX** | `first-paint-skeleton`, `home-hero-loading` | home, api cache path |
| **Tracker** | `tracker-*` (modes, hero, chart, alerts, export, dom) | `tracker-pro.js`, `src/tracker/` |
| **Calculator** | `calculator-conversions`, `calculator-url-sharing`, `inline-calc` | `calculator.js` |
| **Shops** | `shops-compare`, `shops-business-api`, `verify-shops` | `shops.js`, shops data |
| **Compare** | `compare-core` | `compare-core.js` |
| **Insights** | `insights-feed-core`, `insights-data`, `insights-feed` | insights modules |
| **Country / SEO** | `country-canonical`, `country-pages-seo`, `country-consolidation`, `market-intel` | countries/, generators |
| **Nav / shell** | `nav-data`, `check-shell-guard` (via validate) | `nav-data.js`, `nav.js` |
| **Safe DOM** | `safe-dom` + validate baseline | any innerHTML |
| **API / server** | `api-foundation`, `price-api-routes`, `public-accounts-api`, `billing`, `alerts-*` | `server/` |
| **Auth** | `auth`, `auth-token-version` | `server/lib/auth.js` |
| **Admin** | `admin-ops-dashboard`, `admin-static`, `audit-log` | `admin/` |
| **Newsletter / leads** | `newsletter`, `leads` | respective routes |
| **Developer API** | `developer-api` | `developer-api.js` |
| **Automation** | `tweet-gold-price`, `test_post_gold_price.py` | python poster |
| **Sitemap** | `sitemap`, `sitemap-parity`, `sitemap-generator` | sitemap scripts |
| **PWA** | `sw-exclusions`, `sw-update-toast` | `sw.js` |
| **Content** | `audit-content-pages`, `learn-static-fallback` | content pages |
| **E2E** | `tests/e2e/*.spec.js` | large UX changes — `npm run test:e2e` |

## E.3 Mapping WB session → minimum tests

| Session | Must-run tests |
| ------- | -------------- |
| WB-102 | `nav-data`, `routes-integrity`, e2e `js-links` |
| WB-101 | `public-accounts-api` |
| WB-201 | `inventory-seo`, `sitemap`, `sitemap-parity` |
| WB-301 | `shops-compare`, `verify-shops` |
| WB-302 | `home-hero-loading`, `home-translations` |
| WB-401–404 | `tracker-modes`, `freshness-coverage`, e2e `mobile-smoke` |
| WB-801 | `freshness-coverage`, `spot-bar-freshness` |
| Trust | `pricing-formula.spec`, `data-attribution` |

## E.4 Known flaky / environmental

Document in PR if failing without your changes:

- `analytics.test.js` — Node 24 `navigator` (historical)
- `provider-failover`, `cache-revalidation` — network/timing
- `audit-content-pages` — content schema debt

Do not silence tests; fix or scope with evidence.

## E.5 Playwright smoke

```bash
npm run test:e2e
```

Specs: `homepage`, `tracker-flow`, `calculator`, `shops-search`, `mobile-smoke`, `lang-toggle`, `country-pages`, `nav-smoke`

Use after WB-102, WB-302, WB-403.

## E.6 Coverage (optional)

```bash
npm run test:coverage
```

Not a merge gate today; use for large refactors only.
