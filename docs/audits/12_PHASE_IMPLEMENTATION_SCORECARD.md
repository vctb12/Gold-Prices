# 12-Phase Implementation Scorecard

> Companion to
> [`docs/GOLD_TICKER_LIVE_12_PHASE_POST_IMPLEMENTATION_AUDIT.md`](../GOLD_TICKER_LIVE_12_PHASE_POST_IMPLEMENTATION_AUDIT.md).
> Status legend: ✅ done & verified · 🟡 partial · 🔴 missing/broken · ⚪ not verified · 🟣 exists
> but should be simplified/removed later.

---

## PR → Phase mapping (from `git log --merges`)

| Phase                                        | PR # | Merge commit | Branch                                         | Diff (files / +ins / −del) |
| -------------------------------------------- | ---- | ------------ | ---------------------------------------------- | -------------------------- |
| 1 — Backend/API foundation                   | #291 | `a3fd6c546`  | `copilot/create-express-api-foundation`        | 13 / 801 / 29              |
| 2 — Price API + history + provider health    | #292 | `ceb76259a`  | `copilot/phase-2-price-api-integration`        | 14 / 1 321 / 58            |
| 3 — Server-backed alerts                     | #294 | `1f7244a94`  | `copilot/add-server-backed-alerts`             | 29 / 2 232 / 606           |
| 4 — Newsletter / leads / CRM                 | #297 | `1aa74ee28`  | `copilot/connect-lead-generation-systems`      | 29 / 3 303 / 351           |
| 5 — Public accounts, saved tools, watchlists | #299 | `dd1337a08`  | `copilot/add-public-accounts-tools-watchlists` | 46 / 2 986 / 3 328         |
| 6 — Stripe billing & entitlements            | #301 | `2f25ca9b6`  | `copilot/implement-pricing-page-revenue`       | 18 / 2 793 / 142           |
| 7 — Shops directory v1 + sponsored + leads   | #302 | `c9c46faa5`  | `copilot/update-shops-directory-model`         | 19 / 1 585 / 47            |
| 8 — Analytics governance + SEO inventory     | #304 | `f4c993f86`  | `copilot/strengthen-event-governance`          | 26 / 12 347 / 52           |
| 9 — Admin operations dashboard               | #305 | `86c0c6e45`  | `copilot/build-admin-operations-dashboard`     | 11 / 1 283 / 130           |
| 10 — X automation observability              | #306 | `575cf5618`  | `copilot/add-twitter-automation-observability` | 13 / 980 / 49              |
| 11 — AI market summaries (draft-only)        | #307 | `cec6588e1`  | `copilot/create-ai-market-summaries`           | 15 / 2 605 / 268           |
| 12 — API product + developer keys            | #308 | `326b1fdae`  | `copilot/create-api-product-foundation`        | 18 / 3 516 / 1 359         |

Support PRs in the same window: #280 tracker revamp · #282 UI/UX redesign (411 files, +14 607) ·
#283 customer experience copy · #284 tracker workspace · #285 chart export · #286 mobile · #290
latest-state audit · #293/#300/#303 CI / workflow fixes.

Phase totals: **~36 000 added / ~6 300 deleted across the 12 PRs (~32 000 net)**.

---

## Scorecard

### Phase 1 — Backend/API foundation · ✅ Done (PR #291)

| Item                                                        | Status | Evidence                                                                                                             |
| ----------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------- |
| Express app + Helmet + CORS + rate limit                    | ✅     | `server.js:6-180`                                                                                                    |
| `/api/v1` versioned router                                  | ✅     | `server/routes/api-v1.js`, mounted `server.js:300`                                                                   |
| `/api/v1/health`, `/api/v1/status`, `/api/v1/config/public` | ✅     | `server/routes/api-v1.js:231-268`                                                                                    |
| Env validation at startup (warn, not crash)                 | ✅     | `server/lib/env-validation.js`, `server.js:43`                                                                       |
| Response envelope helpers                                   | ✅     | `server/lib/api-response.js`                                                                                         |
| Structured request logger                                   | ✅     | `server/lib/request-logger.js`                                                                                       |
| Trust-proxy in prod                                         | ✅     | `server.js:25`                                                                                                       |
| Tests                                                       | ✅     | `tests/api-foundation.test.js`, `tests/env-validation.test.js`, `tests/api-response.test.js`, `tests/server.test.js` |

**Verdict:** stay as-is. Production-grade foundation. No hot-fix needed.

---

### Phase 2 — Price API, provider health, historical DB · 🟡 Partial (PR #292)

| Item                                                         | Status | Evidence                                                                                                                                                                 |
| ------------------------------------------------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/api/v1/prices/latest`                                      | ✅     | `server/routes/api-v1.js:269`                                                                                                                                            |
| `/api/v1/prices/history`                                     | ✅     | `server/routes/api-v1.js:308`                                                                                                                                            |
| `/api/v1/prices/snapshots`                                   | ✅     | `server/routes/api-v1.js:389`                                                                                                                                            |
| `/api/v1/providers/status` (public)                          | ✅     | `server/routes/api-v1.js:467`                                                                                                                                            |
| `/api/v1/providers/runs` (admin only)                        | ✅     | `server/routes/api-v1.js:517`                                                                                                                                            |
| `price_snapshots`, `provider_runs`, `provider_health` tables | ✅     | `supabase/schema.sql:770, 1057, 1106`                                                                                                                                    |
| Supabase snapshot writer                                     | ✅     | `server/lib/price-snapshots.js`, `npm run sync:snapshot`                                                                                                                 |
| Fallback to local `data/gold_price.json` if Supabase down    | ✅     | `server/routes/api-v1.js:269-380`                                                                                                                                        |
| Tracker UI consumes `/prices/history` (true server history)  | 🟡     | `src/pages/tracker-pro.js` reads `/api/v1/prices/history`, but **also still ships `src/data/historical-baseline.json`** as a static fallback. Truthful but mixed source. |
| Freshness labels surfaced in UI                              | ✅     | `src/components/spotBar.js`, freshness pulse tests pass                                                                                                                  |

**Hot-fix candidates:** none. **Improvement:** document which surfaces use Supabase vs the baseline
JSON.

---

### Phase 3 — Server-backed alerts & notifications · 🟡 Partial (PR #294)

| Item                                                               | Status | Evidence                                                                                                                                               |
| ------------------------------------------------------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `alert_rules`, `alert_events`, `notification_subscriptions` tables | ✅     | `supabase/schema.sql:822, 909, 979`                                                                                                                    |
| Alert CRUD + verify + unsubscribe routes                           | ✅     | `server/routes/alerts.js:772-960`                                                                                                                      |
| Evaluation job route                                               | ✅     | `POST /api/v1/jobs/check-alerts` `server/routes/alerts.js:962`                                                                                         |
| GitHub Actions schedule with dry-run fallback                      | ✅     | `.github/workflows/check-alerts.yml`, falls back when `ALERT_JOB_TOKEN` missing                                                                        |
| Email provider abstraction (Resend / dry-run)                      | ✅     | `server/services/email.js`                                                                                                                             |
| Tracker UI surfaces server alerts (not just localStorage)          | 🟡     | `src/pages/tracker-pro.js` references alerts panel but verification UI / token entry surface is minimal. Tests assert API behaviour, not full UI flow. |
| Production-ready secrets wiring documented                         | 🟡     | `docs/ALERTS_AND_NOTIFICATIONS.md` exists, but `ALERT_JOB_TOKEN` setup needs owner action                                                              |
| Tests                                                              | ✅     | `tests/alerts-api.test.js`, `tests/alerts-route-helpers.test.js`, `tests/alerts-security-behavior.test.js`                                             |

**Hot-fix candidates:** confirm `ALERT_JOB_TOKEN` + Resend keys live in GitHub Secrets; otherwise
alerts are silently dry-run.

---

### Phase 4 — Newsletter, leads, CRM · ✅ Done (PR #297)

| Item                                                                                                                      | Status | Evidence                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------- |
| `newsletter_subscribers`, `lead_submissions`, `lead_events`, `email_campaigns`, `email_deliveries`, `consent_logs` tables | ✅     | `supabase/schema.sql:1377, 1432, 1489, 1521, 1566, 1608`                                                               |
| Newsletter subscribe / confirm / unsubscribe / prefs / stats                                                              | ✅     | `server/routes/newsletter.js:168-420`                                                                                  |
| Lead capture + admin list/patch                                                                                           | ✅     | `server/routes/leads.js:71, 160, 200`                                                                                  |
| Submit-shop wired to backend                                                                                              | ✅     | `server/routes/submissions.js:63`, `src/pages/submit-shop.js:270`                                                      |
| Rate limits + email regex + enum validation                                                                               | ✅     | `server/routes/newsletter.js`, `server/routes/leads.js`                                                                |
| Tests                                                                                                                     | ✅     | `tests/newsletter.test.js`, `tests/leads.test.js`, `tests/pending-shops.test.js`                                       |
| Admin UI for leads & subscribers                                                                                          | 🟡     | API routes exist; admin HTML pages under `admin/leads/`, `admin/newsletter/` need owner-spot-check, no end-to-end test |

**Hot-fix candidates:** none for the API; admin UX polish is P2.

---

### Phase 5 — Public accounts, saved tools, watchlists · ✅ Done (PR #299)

| Item                                                                                           | Status | Evidence                                                                                                       |
| ---------------------------------------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------- |
| Auth provider                                                                                  | ✅     | Supabase (`src/pages/account.js:128-147` uses `sb.auth.signInWithPassword/signUp/OAuth`)                       |
| `profiles`, `user_preferences`, `saved_calculations`, `watchlists`, `saved_shops` tables + RLS | ✅     | `supabase/schema.sql:518, 552, 588, 621, 661` (each has `enable row level security`)                           |
| Sign-in/up UI (`account.html`)                                                                 | ✅     | `account.html`, `src/pages/account.js`                                                                         |
| Customer dashboard                                                                             | ✅     | `dashboard.html`, `src/pages/dashboard.js` (preferences / watchlist / saved-shops / saved-calculations)        |
| `/api/v1/me/*` endpoints                                                                       | ✅     | `server/routes/public-accounts.js:649-761`                                                                     |
| localStorage → server migration helper                                                         | ✅     | `src/pages/dashboard.js:33-46` (import helper, bilingual)                                                      |
| Anonymous use still works                                                                      | ✅     | Tracker/calculator/shops do not require login                                                                  |
| Tests                                                                                          | ✅     | `tests/public-accounts-api.test.js`, `tests/public-account-client.test.js`, `tests/auth-token-version.test.js` |

**Verdict:** keep. Strongest end-to-end phase besides Phase 1.

---

### Phase 6 — Stripe billing & entitlements · 🟡 Partial (PR #301)

| Item                                                                                                       | Status | Evidence                                                                                                                                       |
| ---------------------------------------------------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Stripe SDK installed                                                                                       | ✅     | `package.json` `stripe@^22.1.1`                                                                                                                |
| Checkout + portal + webhook routes                                                                         | ✅     | `server/routes/billing.js:151, 229, 272` and legacy `server/routes/stripe.js`                                                                  |
| Webhook signature verification                                                                             | ✅     | `server/routes/stripe.js:184` (raw body) and `server/routes/billing.js:272`                                                                    |
| `plans`, `stripe_customers`, `subscriptions`, `entitlements`, `stripe_events`, `billing_audit_logs` tables | ✅     | `supabase/schema.sql:1646-1934`                                                                                                                |
| `/api/v1/me/entitlements`                                                                                  | ✅     | mounted at `server.js:303` (`billingMeRouter`)                                                                                                 |
| Pricing page CTA wired                                                                                     | ✅     | `pricing.html:142-172` (`data-tier="pro"`, `data-tier="api"`)                                                                                  |
| Missing-env safe mode                                                                                      | ✅     | `server/routes/billing.js:507` `/config` reflects readiness                                                                                    |
| Server-trusted entitlements (not client)                                                                   | ✅     | `server/lib/entitlements.js` resolves from DB, free tier = `apiAccess:true / apiCallsPerDay:100` (verified by `tests/billing.test.js:108-149`) |
| Two parallel router stacks (`/api/stripe/*` + `/api/v1/billing/*`)                                         | 🟡     | Both exist (`server.js:288-302`). Consolidate later.                                                                                           |
| Tests                                                                                                      | ✅     | `tests/billing.test.js`                                                                                                                        |

**Hot-fix candidates:** none in code; **owner action** = supply Stripe live keys + price IDs
(`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_API`). Without them
the system is in safe-mode.

---

### Phase 7 — Shops directory, sponsored listings, leads · 🟡 Partial (PR #302)

| Item                                                                                                                                            | Status | Evidence                                                                                                    |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------- |
| `shops`, `shop_listings`, `market_clusters`, `shop_claims`, `shop_leads`, `sponsored_placements`, `shop_verification_logs`, `shop_click_events` | ✅     | `supabase/schema.sql:15, 174, 157, 209, 224, 240, 256, 269`                                                 |
| Public `/api/v1/shops`, `/shops/:slug`, lead/claim/click                                                                                        | ✅     | `server/routes/shops-v1.js:266-428`                                                                         |
| Admin moderation queue, verify/reject, sponsored CRUD                                                                                           | ✅     | `server/routes/shops-v1.js:459-524`                                                                         |
| Verified-shop vs market-cluster separation                                                                                                      | ✅     | Distinct tables + JSON model                                                                                |
| Sponsored disclosure in UI                                                                                                                      | 🟡     | API returns `is_sponsored`; UI badge to be spot-checked on `shops.html`                                     |
| Vendor self-serve panel (login → create listing → see leads)                                                                                    | 🔴     | **No vendor UI exists.** `grep -rni "vendor\|supplier" --include=*.html` returns nothing. Admin-only flows. |
| Sponsored payments wired to Stripe                                                                                                              | 🔴     | No link between `sponsored_placements` and `subscriptions`/`entitlements`                                   |
| Tests                                                                                                                                           | ✅     | `tests/shops-business-api.test.js`, `tests/shop-manager.test.js`                                            |

**Hot-fix candidates:** none P0; flag vendor portal as P1 product gap.

---

### Phase 8 — Analytics governance + SEO inventory · ✅ Done (PR #304)

| Item                                                                         | Status | Evidence                                                                                           |
| ---------------------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------- |
| GA4 + Clarity loader externalised                                            | ✅     | `assets/analytics.js`; `validate` reports `clean=513, noAnalytics=189`                             |
| Event schema + governance check                                              | ✅     | `npm run analytics:inventory:check`, `npm run seo:governance:check` (both wired into `validate`)   |
| Tracker / calculator / shop / pricing / newsletter event coverage            | ✅     | `tests/analytics.test.js`, `docs/ANALYTICS_EVENTS.md`                                              |
| SEO inventory + sitemap + canonicals + hreflang                              | ✅     | `npm run validate` reports 657 files, 655 canonical, 644 with JSON-LD                              |
| Thin / duplicated pages (608 country pages incl. 18/21/22/24-karat per city) | 🟣     | Counted: 608 under `countries/`; many are template-grade. See `PAGE_CLEANUP_AND_PRODUCT_FOCUS.md`. |

**Verdict:** governance scaffolding is good; **content footprint is too wide** for current
direction.

---

### Phase 9 — Admin operations dashboard · ✅ Done (PR #305)

| Item                                                                                                                                | Status | Evidence                                                                                     |
| ----------------------------------------------------------------------------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------- |
| Admin login + token versioning                                                                                                      | ✅     | `server/lib/auth.js:282-330`; `tests/auth-token-version.test.js`                             |
| `/api/v1/admin/ops/*` modules (provider health, snapshots, alerts, leads, shops moderation, newsletter, billing, SEO, X automation) | ✅     | `server/routes/admin/index.js:886-1013`                                                      |
| Consolidated `/ops/control-center`                                                                                                  | ✅     | `server/routes/admin/index.js:1013-1040`                                                     |
| Audit logging for admin mutations                                                                                                   | ✅     | `server/lib/audit-log.js`, `tests/audit-log.test.js`, `tests/admin-ops-dashboard.test.js`    |
| Admin UI shell (`admin/`)                                                                                                           | ✅     | `admin/index.html`, `admin/shared/admin-shell.js`, `admin/supabase-auth.js` (Supabase OAuth) |
| Mobile usability of admin                                                                                                           | ⚪     | Not verified in audit                                                                        |

**Verdict:** keep. Strongest admin-side phase.

---

### Phase 10 — X / Twitter automation observability · ✅ Done (PR #306)

| Item                                                             | Status | Evidence                                                                                                  |
| ---------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------- |
| Structured run output (force, duplicate, dry-run, closed-market) | ✅     | `scripts/python/post_gold.py` + `.github/workflows/post_gold.yml`                                         |
| `automation_runs`, `tweet_posts`, `tweet_failures` tables        | ✅     | `supabase/schema.sql:1936, 1968, 2000`                                                                    |
| Fallback JSON logs if Supabase missing                           | ✅     | `data/automation_runs.json` (7172 lines), `data/tweet_posts.json` (7082), `data/tweet_failures.json` (92) |
| Admin dashboard visibility                                       | ✅     | `/api/v1/admin/ops/x-automation` (`server/routes/admin/index.js:987`)                                     |
| **No production posting changes**                                | ✅     | Per task scope. `post_gold.yml` schedule unchanged.                                                       |

**Verdict:** stay as-is. Do not touch the workflow.

---

### Phase 11 — AI market summaries / content automation · 🟡 Partial (PR #307)

| Item                                                                          | Status | Evidence                                                                                                  |
| ----------------------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------- |
| Draft-only system (no auto-publish)                                           | ✅     | `docs/AI_CONTENT_AUTOMATION.md`: “No content is ever auto-published or auto-posted.”                      |
| `ai_drafts` table + repository                                                | ✅     | `supabase/schema.sql:2085`, `server/repositories/ai-drafts.repository.js`                                 |
| Service builds bilingual templates                                            | ✅     | `server/services/ai-drafts.js`                                                                            |
| Admin endpoints to generate / list / get / patch / approve / reject / publish | ✅     | `server/routes/admin/index.js:1542-1786`                                                                  |
| Human review required before publish                                          | ✅     | Architecture mandates it (admin role only on `publish`)                                                   |
| Source labels / timestamps required                                           | ✅     | Templates include reference-only language                                                                 |
| EN/AR support                                                                 | ✅     | Template builder is bilingual                                                                             |
| Editorial UI in admin shell                                                   | ⚪     | API exists; HTML/JS surface not exercised in tests                                                        |
| Tests                                                                         | ✅     | `tests/ai-drafts.test.js`                                                                                 |
| External LLM call wired (vs template-only)                                    | 🔴     | Today it's **template-based, not generative**. That's the intended design choice (no hallucination risk). |

**Verdict:** if the product roadmap moves away from owned content, this becomes 🟣 (keep but
de-prioritize). Today it is harmless because nothing publishes without admin.

---

### Phase 12 — API product / developer monetization · ✅ Done (PR #308)

| Item                                                                             | Status | Evidence                                                                          |
| -------------------------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------- |
| Public API routes (`/api/v1/public/latest`, `/history`, `/karats`, `/countries`) | ✅     | `server/routes/developer-api.js:256-461`                                          |
| API key creation / list / delete / regenerate                                    | ✅     | `server/routes/developer-api.js:471-590`                                          |
| Hashed keys (SHA-256)                                                            | ✅     | `server/lib/api-key-auth.js` (CodeQL suppression annotated in commit `74d32ee50`) |
| Usage tracking + quotas (free=100/day, pro=250, api=500)                         | ✅     | `server/lib/entitlements.js:33-77`, `server/lib/api-key-auth.js:95-130`           |
| `api_keys`, `api_usage`, `api_rate_limits`, `developer_apps` tables              | ✅     | `supabase/schema.sql:1823, 1858, 2155, 2184`                                      |
| Developer dashboard                                                              | ✅     | `developer.html`, `src/pages/developer.js`                                        |
| API docs                                                                         | ✅     | `docs/API_PRODUCT.md`                                                             |
| Open endpoints (no middleware): `/public/karats`, `/public/countries`            | ✅     | `server/routes/developer-api.js:432-461` (intentional)                            |
| Rate limits per key + history days entitlement                                   | ✅     | `req.apiKeyContext.historyDays` consumed in `/public/history`                     |
| Tests                                                                            | ✅     | `tests/developer-api.test.js`, `tests/billing.test.js`                            |

**Verdict:** keep. Externalisable once Stripe live keys land.

---

## Summary scorecard

| Phase                   | Status  | Top blocker (if any)                                                    |
| ----------------------- | ------- | ----------------------------------------------------------------------- |
| 1 — API foundation      | ✅      | —                                                                       |
| 2 — Price API / history | 🟡      | Mixed history sources (Supabase + static baseline); document, don't fix |
| 3 — Alerts              | 🟡      | `ALERT_JOB_TOKEN` / Resend keys (owner action)                          |
| 4 — Newsletter / leads  | ✅      | Admin UX polish (P2)                                                    |
| 5 — Public accounts     | ✅      | —                                                                       |
| 6 — Billing             | 🟡      | Stripe live keys (owner action); two router stacks (consolidate later)  |
| 7 — Shops               | 🟡      | **No vendor self-serve UI** (P1)                                        |
| 8 — Analytics + SEO     | ✅      | Content footprint too wide (🟣 simplify)                                |
| 9 — Admin ops           | ✅      | —                                                                       |
| 10 — X observability    | ✅      | Do not touch                                                            |
| 11 — AI drafts          | 🟡 / 🟣 | Decide if product needs owned content                                   |
| 12 — API product        | ✅      | Open to external devs once billing is live                              |

**Composite:** the backend is **substantially built**. The public site has more pages than the
product strategy now wants. The biggest **integration gap is a vendor/supplier UI** for Phase 7.
