# Integration Reality Check

> Companion to
> [`docs/GOLD_TICKER_LIVE_12_PHASE_POST_IMPLEMENTATION_AUDIT.md`](../GOLD_TICKER_LIVE_12_PHASE_POST_IMPLEMENTATION_AUDIT.md).
> Status legend: ✅ done & verified · 🟡 partial · 🔴 missing/broken · ⚪ not verified.

## Feature integration matrix

| Feature                    | Frontend                                              | Backend                                                                               | DB                                                                                                                                                 | Auth / role                                     | Admin view                             | Tests                                                                                           | Prod-ready?                                |
| -------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------ |
| Price — latest             | ✅ `tracker-pro.js`, `spotBar.js`                     | ✅ `GET /api/v1/prices/latest` (`api-v1.js:269`)                                      | ✅ `price_snapshots` (`schema.sql:770`) + file fallback                                                                                            | n/a (public)                                    | ✅ `/ops/price-snapshots`              | ✅ `tests/price-api-routes.test.js`, `tests/price-snapshots.test.js`                            | ✅                                         |
| Price — history            | ✅ chart loader (`tracker-chart-loader.js`)           | ✅ `GET /api/v1/prices/history` (`api-v1.js:308`)                                     | 🟡 `price_snapshots` + static `historical-baseline.json`                                                                                           | n/a (public)                                    | ✅ via snapshots view                  | ✅ `tests/historical.test.js`                                                                   | 🟡 (mixed sources)                         |
| Provider health            | ⚪ admin shell only                                   | ✅ `GET /api/v1/providers/status`, admin-only `/runs` (`api-v1.js:467, 517`)          | ✅ `provider_health`, `provider_runs` (`schema.sql:1106, 1057`)                                                                                    | ✅ admin for `/runs`                            | ✅ `/ops/provider-health`              | ✅ via api-foundation tests                                                                     | ✅                                         |
| Alerts                     | 🟡 tracker `tracker-pro.js` (token-managed alerts)    | ✅ full CRUD + verify + unsubscribe (`alerts.js`)                                     | ✅ `alert_rules`, `alert_events`, `notification_subscriptions` (`schema.sql:822, 909, 979`)                                                        | ✅ token-based; admin for jobs                  | ✅ `/ops/alerts-summary`               | ✅ `tests/alerts-*.test.js` (3 files)                                                           | 🟡 (needs `ALERT_JOB_TOKEN` + Resend keys) |
| Newsletter                 | ✅ footer form, confirm pages                         | ✅ subscribe/confirm/unsubscribe/prefs/stats (`newsletter.js`)                        | ✅ `newsletter_subscribers`, `email_campaigns`, `email_deliveries`, `consent_logs`                                                                 | n/a public; admin for `/subscribers`            | 🟡 API done; admin HTML to spot-check  | ✅ `tests/newsletter.test.js`                                                                   | ✅                                         |
| Leads                      | ✅ submit-shop form, lead capture in shops            | ✅ `POST /api/v1/leads`, admin CRUD (`leads.js`)                                      | ✅ `lead_submissions`, `lead_events`                                                                                                               | admin only for list/patch                       | 🟡 admin HTML to spot-check            | ✅ `tests/leads.test.js`                                                                        | ✅                                         |
| Customer dashboard         | ✅ `dashboard.html`, `src/pages/dashboard.js`         | ✅ `/api/v1/me/*` (`public-accounts.js`)                                              | ✅ `profiles`, `user_preferences`, `saved_calculations`, `watchlists`, `saved_shops` (with RLS)                                                    | ✅ Supabase JWT                                 | ✅ via users view                      | ✅ `tests/public-account*-test.js`                                                              | ✅                                         |
| **Vendor dashboard**       | 🔴 **none**                                           | 🟡 partial (shops-v1 has claim + lead routes, but vendor-scope endpoints not exposed) | ✅ `shop_claims`, `shop_leads`, `shop_listings`                                                                                                    | 🔴 no vendor role                               | ✅ admin moderates                     | 🔴 no vendor flow tests                                                                         | 🔴                                         |
| Admin dashboard            | ✅ `admin/index.html`, `admin/shared/admin-shell.js`  | ✅ `/api/v1/admin/*` (40+ endpoints)                                                  | ✅ `audit_logs`, `site_settings`, etc.                                                                                                             | ✅ JWT + token-version; Supabase OAuth fallback | n/a (this _is_ admin)                  | ✅ `tests/admin-ops-dashboard.test.js`, `tests/admin-static.test.js`, `tests/audit-log.test.js` | ✅                                         |
| Shops directory            | ✅ `shops.html`, `src/pages/shops.js`, per-city pages | ✅ `/api/v1/shops*` (`shops-v1.js`)                                                   | ✅ `shops`, `shop_listings`, `market_clusters`, `shop_claims`, `shop_leads`, `sponsored_placements`, `shop_verification_logs`, `shop_click_events` | mixed: public read, admin write                 | ✅ `/admin/shops/*`                    | ✅ `tests/shops-business-api.test.js`, `tests/shop-manager.test.js`                             | 🟡 (vendor portal missing)                 |
| Billing                    | ✅ `pricing.html` CTAs (`data-tier="pro\|api"`)       | ✅ `/api/v1/billing/*` + legacy `/api/stripe/*`                                       | ✅ `plans`, `stripe_customers`, `subscriptions`, `entitlements`, `stripe_events`, `billing_audit_logs`                                             | ✅ admin for ops; user for checkout             | ✅ `/ops/billing-stats`                | ✅ `tests/billing.test.js`                                                                      | 🟡 (live Stripe keys missing)              |
| API keys                   | ✅ `developer.html`, `src/pages/developer.js`         | ✅ `/api/v1/me/api-keys*`, `/api/v1/me/api-usage` (`developer-api.js`)                | ✅ `api_keys` (hashed), `api_usage`, `api_rate_limits`, `developer_apps`                                                                           | ✅ user-scoped                                  | ✅ admin sees via users                | ✅ `tests/developer-api.test.js`                                                                | ✅                                         |
| Analytics events           | ✅ `assets/analytics.js` (externalised)               | ✅ `POST /api/v1/events` (`api-v1.js:562`)                                            | ✅ `analytics_events`, `api_call_logs`                                                                                                             | n/a (public; rate-limited)                      | 🟡 limited admin view                  | ✅ `tests/analytics.test.js`, governance check in `validate`                                    | ✅                                         |
| AI drafts (Phase 11)       | ⚪ no public/admin UI exercised                       | ✅ admin CRUD (`admin/index.js:1542-1786`)                                            | ✅ `ai_drafts` (`schema.sql:2085`)                                                                                                                 | ✅ admin only                                   | 🟡 API only, UI not exercised in tests | ✅ `tests/ai-drafts.test.js`                                                                    | 🟡 (template-based, no LLM call)           |
| X automation observability | n/a (workflow)                                        | ✅ logs JSON + Supabase (`post_gold.yml:132,190,218`)                                 | ✅ `automation_runs`, `tweet_posts`, `tweet_failures`                                                                                              | n/a                                             | ✅ `/ops/x-automation`                 | ✅ `test_post_gold_price.py`, `tests/seo-metadata.test.js`                                      | ✅                                         |
| Pricing snapshots fallback | n/a                                                   | ✅ `npm run sync:snapshot`                                                            | ✅ file + DB                                                                                                                                       | n/a                                             | ✅ admin module                        | ✅ `tests/price-snapshots.test.js`                                                              | ✅                                         |

---

## "Scaffolded vs actually working" classification

### Fully working end-to-end (FE + BE + DB + tests + production data flowing today)

- Price latest + history + freshness labels
- Customer accounts (sign-up / sign-in / dashboard / preferences / watchlist / saved calcs / saved
  shops)
- Newsletter (subscribe + confirm + unsubscribe)
- Lead capture (submit-shop, generic leads)
- Admin operations (login, ops dashboard, audit logs, shops moderation)
- API key issuance + usage tracking + quotas
- X/Twitter posting + observability
- Provider health snapshots
- Analytics events (governed)

### Scaffolded — works as plumbing but missing user-facing surface

- **Vendor self-serve panel** — DB & some API routes exist, **no vendor UI, no vendor role**
- **AI drafts editorial UI** — backend complete, admin HTML view not exercised
- **Alerts UI on tracker** — backend complete; tracker surface is minimal
- **Sponsored placements payment flow** — admin CRUD only; no vendor-paid path to Stripe

### Working but inert without owner action

- **Stripe billing** — code complete, needs live keys + price IDs
- **Resend email + alert evaluation cron** — code complete, needs `ALERT_JOB_TOKEN` +
  `RESEND_API_KEY`
- **Supabase persistence** — code complete, falls back to JSON files when service-role key missing

### Risk classification

| Risk                      | Where                                                                    |
| ------------------------- | ------------------------------------------------------------------------ |
| P0 (blocker)              | None identified that block deployment as-is                              |
| P1 (major UX/integration) | Vendor portal missing; GDPR export/delete missing; mixed history sources |
| P2 (cleanup)              | Page sprawl; two billing router stacks; admin mobile not verified        |
| P3 (polish)               | AI-drafts admin UI; tracker alerts UI; sponsored→billing link            |
