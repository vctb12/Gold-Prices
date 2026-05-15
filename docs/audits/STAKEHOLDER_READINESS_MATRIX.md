# Stakeholder Readiness Matrix

> Companion to
> [`docs/GOLD_TICKER_LIVE_12_PHASE_POST_IMPLEMENTATION_AUDIT.md`](../GOLD_TICKER_LIVE_12_PHASE_POST_IMPLEMENTATION_AUDIT.md).
> Status: ✅ ready · 🟡 partial · 🔴 missing/broken · ⚪ not verified.

## Snapshot

| Stakeholder                        | Status | Biggest blocker                                                    | Next action                            |
| ---------------------------------- | ------ | ------------------------------------------------------------------ | -------------------------------------- |
| Public visitor (anonymous browser) | ✅     | Page sprawl (608 country pages) is dilutive but not broken         | Trim/noindex thin pages                |
| Customer (logged-in user)          | ✅     | Customer dashboard surface area is small; no GDPR export/delete UI | Add account export + delete            |
| Vendor / supplier / shop owner     | 🔴     | No vendor login or self-serve UI exists at all                     | Build vendor portal (PR 7 in sequence) |
| Admin / operator                   | ✅     | Mobile usability of admin not verified                             | Spot-check on phone                    |
| Developer / API user               | 🟡     | Live Stripe keys missing; quotas live but checkout fails           | Owner action: load Stripe secrets      |

---

## 1. Public visitor (anonymous browser)

| Question                            | Status | Evidence                                                                                                       |
| ----------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------- |
| Open the site                       | ✅     | `index.html`, `tracker.html`, `shops.html`, `pricing.html`, `methodology.html` all build and pass `validate`   |
| Understand what the product does    | ✅     | Homepage hero + freshness pulse                                                                                |
| View live prices                    | ✅     | `src/components/spotBar.js`, ticker, tracker                                                                   |
| Use the tracker                     | ✅     | `tracker.html` (1 629 lines) with chart, karats, range controls                                                |
| Trust the data labels               | ✅     | Freshness pulse + cached/stale labels (`tests/spot-bar-freshness.test.js`, `tests/freshness-coverage.test.js`) |
| Mobile-friendly                     | 🟡     | PR #286 mobile pass landed, but `tracker.html` is large; needs phone spot-check                                |
| Switch Arabic ↔ English             | ✅     | `src/config/translations.js`, RTL handling                                                                     |
| Avoid confusion from too many pages | 🟣     | 16 root HTML pages + 608 country pages + 35 content pages = ~660 indexable surfaces. Many are thin/templated.  |

**Verdict:** ✅ with simplification debt. Public visitor is well-served on the primary surfaces; the
long tail dilutes E-E-A-T signals.

---

## 2. Customer / logged-in user

| Question                               | Status | Evidence                                                                     |
| -------------------------------------- | ------ | ---------------------------------------------------------------------------- |
| Sign up                                | ✅     | `src/pages/account.js:141` (`sb.auth.signUp`)                                |
| Sign in (password / OAuth)             | ✅     | `src/pages/account.js:128`, `:147` (`signInWithOAuth`)                       |
| Dashboard                              | ✅     | `dashboard.html`, `src/pages/dashboard.js`                                   |
| Save watchlist                         | ✅     | `POST /api/v1/me/watchlist` (`server/routes/public-accounts.js:725`)         |
| Save / manage alerts                   | 🟡     | API exists (`/api/v1/alerts/*`); UI on tracker is partial (token-based mgmt) |
| Save calculator results                | ✅     | `POST /api/v1/me/saved-calculations` (`public-accounts.js:700`)              |
| Save shops                             | ✅     | `POST /api/v1/me/saved-shops` (`public-accounts.js:750`)                     |
| Manage preferences                     | ✅     | `PATCH /api/v1/me/preferences` (`public-accounts.js:684`)                    |
| Export account data (GDPR)             | 🔴     | No export route; only audit-log export for admin                             |
| Delete account / right-to-be-forgotten | 🔴     | No `DELETE /api/v1/me` route surfaced                                        |
| LocalStorage → server migration        | ✅     | Bilingual import helper `src/pages/dashboard.js:33-46`                       |

**Verdict:** ✅ for the happy path, 🔴 for GDPR plumbing. Add data export + delete in PR 6 of the
next sequence.

---

## 3. Supplier / vendor / shop owner

| Question                           | Status | Evidence                                                                                                                           |
| ---------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| Register as a vendor               | 🔴     | No vendor signup; only generic `account.html`                                                                                      |
| Log in to a vendor dashboard       | 🔴     | No vendor route. `grep -rni "vendor\|supplier" --include="*.html"` returns **0 hits.**                                             |
| Create vendor profile              | 🔴     | `shop_listings` table exists but no UI mints rows for the owner role                                                               |
| Submit shop / listing              | 🟡     | Anyone can submit via `submit-shop.html` → `POST /api/submit-shop` (`server/routes/submissions.js:63`); claim-by-owner is separate |
| Claim listing                      | 🟡     | `POST /api/v1/shops/:id/claim` exists (`shops-v1.js:380`), no public UI to claim from a shop page                                  |
| Update contact details after claim | 🔴     | No vendor-self-serve endpoint or UI                                                                                                |
| Receive leads                      | 🟡     | Leads land in `shop_leads`; **only admin** can view (`shops-v1.js:464`)                                                            |
| Lead dashboard for vendors         | 🔴     | None                                                                                                                               |
| Sponsor / upgrade listing          | 🔴     | `sponsored_placements` is admin-CRUD; no Stripe-checkout path for vendors                                                          |
| View analytics for own listing     | 🔴     | No vendor scope                                                                                                                    |
| Contact admin                      | 🟡     | Generic support link only                                                                                                          |

**Verdict:** 🔴 **Vendor portal is the single biggest product gap.** The DB and admin sides exist;
the vendor-facing slice does not.

---

## 4. Admin / operator

| Question                     | Status | Evidence                                                                                                               |
| ---------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------- |
| Log in securely              | ✅     | JWT + bcrypt + token-version (`server/lib/auth.js:282-330`) **and** Supabase OAuth fallback (`admin/supabase-auth.js`) |
| View users                   | ✅     | `GET /api/v1/admin/users` (admin role)                                                                                 |
| View vendors                 | 🟡     | No separate "vendors" view; shops moderation queue serves as the proxy                                                 |
| Moderate shops               | ✅     | `/api/v1/admin/shops/moderation-queue`, `verify`, `reject` (`shops-v1.js:459-509`)                                     |
| Approve / reject claims      | ✅     | `/api/v1/admin/shops/claims` (`shops-v1.js:468`) — list exists; explicit approve/reject endpoint to spot-check         |
| View leads                   | ✅     | `/api/v1/admin/leads` (`leads.js:160`) + `/api/v1/admin/shops/leads`                                                   |
| View newsletter subscribers  | ✅     | `/api/newsletter/subscribers` (`newsletter.js:420`)                                                                    |
| View provider health         | ✅     | `/api/v1/admin/ops/provider-health`                                                                                    |
| View price snapshots         | ✅     | `/api/v1/admin/ops/price-snapshots`                                                                                    |
| View alert logs              | ✅     | `/api/v1/admin/ops/alerts-summary`                                                                                     |
| View billing / subscriptions | ✅     | `/api/v1/admin/ops/billing-stats`                                                                                      |
| View audit logs              | ✅     | `/api/v1/admin/audit-logs`, export endpoint                                                                            |
| Monitor X automation         | ✅     | `/api/v1/admin/ops/x-automation` + JSON logs                                                                           |
| Export data                  | ✅     | Audit-log CSV export route                                                                                             |
| Consolidated control-center  | ✅     | `/api/v1/admin/ops/control-center`                                                                                     |
| Mobile usability of admin    | ⚪     | Not verified                                                                                                           |

**Verdict:** ✅ Admin is the most complete persona. Consider mobile audit (P2/P3).

---

## 5. Developer / API user

| Question                           | Status | Evidence                                                                                                                     |
| ---------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------- |
| Understand API docs                | ✅     | `docs/API_PRODUCT.md`                                                                                                        |
| Create API key                     | ✅     | `POST /api/v1/me/api-keys` (`developer-api.js:471`)                                                                          |
| View usage                         | ✅     | `GET /api/v1/me/api-usage` (`developer-api.js:591`)                                                                          |
| Test endpoints                     | ✅     | `/public/latest`, `/public/history`, `/public/karats`, `/public/countries`                                                   |
| See freshness / source fields      | ✅     | Public payload mirrors internal price envelope                                                                               |
| Understand rate limits             | ✅     | Per-tier `apiCallsPerDay` (100/250/500) enforced (`api-key-auth.js:95-130`)                                                  |
| Upgrade plan                       | 🟡     | UI CTA in `pricing.html` posts to `/api/v1/billing/create-checkout-session`; **succeeds only when Stripe live keys are set** |
| Hashed key storage                 | ✅     | SHA-256 with CodeQL note (`74d32ee50`, `785e41375`)                                                                          |
| Open endpoints (karats, countries) | ✅     | Intentional (no key required) — `developer-api.js:432, 455`                                                                  |
| Dashboard                          | ✅     | `developer.html` + `src/pages/developer.js`                                                                                  |

**Verdict:** 🟡 — fully built; **owner action** to provide `STRIPE_SECRET_KEY`,
`STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_API` for paid tiers.

---

## Owner-action checklist (to flip 🟡 → ✅)

1. Stripe live keys + price IDs (Phase 6 + 12 monetization).
2. `ALERT_JOB_TOKEN` + `RESEND_API_KEY` (Phase 3 production delivery).
3. Supabase service-role key + URL in GitHub Secrets (Phases 2, 3, 4, 5, 7).
4. Decide vendor portal scope (next-PR sequence PR 7).
5. Decide content footprint cuts (next-PR sequence PR 2 + PR 11).
