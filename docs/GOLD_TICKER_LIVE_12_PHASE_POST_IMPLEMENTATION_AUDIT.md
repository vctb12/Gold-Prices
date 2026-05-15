# Gold Ticker Live — 12-Phase Post-Implementation Audit

**Audit date:** 2026-05-15 **Audit branch:** `copilot/audit-previous-prs` **Scope:** evidence-based
audit of the 12-phase roadmap implementation work, with no code changes to product surfaces. Reports
`<plan>` only; recommendations live in supporting files.

**Companion files:**

- [`docs/audits/12_PHASE_IMPLEMENTATION_SCORECARD.md`](audits/12_PHASE_IMPLEMENTATION_SCORECARD.md)
- [`docs/audits/STAKEHOLDER_READINESS_MATRIX.md`](audits/STAKEHOLDER_READINESS_MATRIX.md)
- [`docs/audits/PAGE_CLEANUP_AND_PRODUCT_FOCUS.md`](audits/PAGE_CLEANUP_AND_PRODUCT_FOCUS.md)
- [`docs/audits/INTEGRATION_REALITY_CHECK.md`](audits/INTEGRATION_REALITY_CHECK.md)
- [`docs/audits/NEXT_PR_SEQUENCE.md`](audits/NEXT_PR_SEQUENCE.md)

---

## 1. Executive Summary

| Question                             | Answer                                                                                                                                                                                                                              |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Is the project **production-ready**? | 🟡 **Yes for the public read-only site and admin operations; partial for paid features.** All 675 tests pass, lint is clean, validate is clean. Stripe/Resend/Supabase live keys remain owner action.                               |
| Is it **customer-ready**?            | ✅ Sign-up / sign-in / dashboard / watchlists / saved calcs / saved shops are end-to-end. 🔴 GDPR export/delete missing.                                                                                                            |
| Is it **vendor/supplier-ready**?     | 🔴 **No.** Schema exists (`shop_listings`, `shop_claims`, `shop_leads`, `sponsored_placements`) and admin can moderate, **but there is no vendor login or vendor UI anywhere in the repo.** This is the single biggest product gap. |
| Is it **admin-ready**?               | ✅ Strongest persona. JWT + Supabase OAuth; full `/api/v1/admin/ops/*` surface with consolidated `/control-center`; audit log on mutations.                                                                                         |
| Is the **backend truly integrated**? | ✅ ~40 API routes wired in `server.js`, 51 Supabase tables, 141 RLS policies, 62 Node test files (675 tests, 100% pass). Not scaffolding.                                                                                           |
| Is **Supabase truly used**?          | ✅ as primary store for accounts/billing/shops/alerts; with **JSON-file fallback** for price snapshots, leads, newsletter, X automation. Both layers are wired.                                                                     |
| Is **auth truly working**?           | ✅ Two parallel layers: admin JWT (`server/lib/auth.js`, token-versioned) + Supabase auth for public users (`account.html`, `admin/supabase-auth.js`).                                                                              |
| Is the **site too bloated**?         | 🟣 **Yes.** 702 HTML files total. 608 of them are templated country/city/per-karat pages. Roughly **~500 are removable/noindex candidates** without affecting product.                                                              |
| **What should be fixed first?**      | (1) GDPR export/delete on `/api/v1/me`. (2) `noindex` the ~420 per-karat city pages. (3) Land Stripe + Resend + Supabase secrets. (4) Build a vendor portal. (5) Consolidate the two billing router stacks.                         |

---

## 2. Diff and PR Summary

Inspected commit range: `git log --merges` between PR #280 and PR #308 (12 roadmap PRs + 8 support
PRs). Branch `copilot/audit-previous-prs` has no diff vs `main`; all roadmap work is already on
`main`.

### Per-PR diff stats (computed from merge-commit parents)

| PR                    | Phase                           |   Files |       + ins |      − del |
| --------------------- | ------------------------------- | ------: | ----------: | ---------: |
| #291                  | 1 — API foundation              |      13 |         801 |         29 |
| #292                  | 2 — Price API + history         |      14 |       1 321 |         58 |
| #294                  | 3 — Server-backed alerts        |      29 |       2 232 |        606 |
| #297                  | 4 — Newsletter / leads / CRM    |      29 |       3 303 |        351 |
| #299                  | 5 — Public accounts             |      46 |       2 986 |      3 328 |
| #301                  | 6 — Stripe billing              |      18 |       2 793 |        142 |
| #302                  | 7 — Shops directory v1          |      19 |       1 585 |         47 |
| #304                  | 8 — Analytics + SEO governance  |      26 |      12 347 |         52 |
| #305                  | 9 — Admin operations dashboard  |      11 |       1 283 |        130 |
| #306                  | 10 — X automation observability |      13 |         980 |         49 |
| #307                  | 11 — AI market summaries        |      15 |       2 605 |        268 |
| #308                  | 12 — API product + dev keys     |      18 |       3 516 |      1 359 |
| **Total (12 phases)** | —                               | **251** | **~35 752** | **~6 419** |

Support PRs in the same window: #280 tracker revamp (517 +) · #282 UI/UX redesign (411 files,
+14 607) · #283 customer experience copy · #284 tracker workspace · #285 chart export · #286 mobile
pass · #290 latest-state audit · #293/#300/#303 CI fixes.

### Biggest / riskiest changed files

- `supabase/schema.sql` — 2 223 lines / 51 tables / 141 policies (largest single surface; touched by
  Phases 2–12)
- `server/routes/admin/index.js` — 1 800+ lines (Phase 9 + 11)
- `server/routes/developer-api.js` — Phase 12
- `tracker.html` — 1 629 lines (Phases 2 + 8 + tracker PRs #280, #284, #285)
- `tests/*.test.js` — grew from a small set to 62 files / 675 tests

### Most likely "dead or duplicate" areas

- 420+ per-karat city pages (`countries/*/<city>/gold-rate/{18,21,22,24}-karat/index.html`)
- Overlapping karat guides (`content/guides/24k-vs-22k.html`, `content/22k-gold-price-guide/`,
  `content/24k-gold-price-guide/`, `content/guides/gold-karat-comparison.html`)
- Two billing router stacks (`/api/stripe/*` and `/api/v1/billing/*`)
- Off-strategy pages: `invest.html`, `content/tools/investment-return.html`,
  `content/guides/invest-in-gold-gcc.html`

---

## 3. 12-Phase Scorecard (summary; details in companion)

| Phase                   | Status  | What changed                                                                       | What worked                                                                        | What's partial / risky                                                    | Evidence                                                                                           | Next action              |
| ----------------------- | ------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------ |
| 1 — API foundation      | ✅      | Express + `/api/v1`, env-validation, response helpers, request logger, trust-proxy | Production-grade base                                                              | —                                                                         | `server/routes/api-v1.js`, `server/lib/*`, `tests/api-foundation.test.js`                          | None                     |
| 2 — Price API + history | 🟡      | latest/history/snapshots + provider runs; Supabase writer                          | Public + admin endpoints work; fallback to JSON                                    | History served from **both** Supabase and `historical-baseline.json`      | `server/routes/api-v1.js:269-389`, `server/lib/price-snapshots.js`                                 | Document source-of-truth |
| 3 — Alerts              | 🟡      | CRUD + verify + unsubscribe + job route + GH cron                                  | API + workflow ready                                                               | Tracker UI surface is minimal; needs `ALERT_JOB_TOKEN` + `RESEND_API_KEY` | `server/routes/alerts.js`, `.github/workflows/check-alerts.yml`                                    | Owner: load secrets      |
| 4 — Newsletter / leads  | ✅      | Subscribe/confirm/unsub/prefs/stats + lead capture + submissions                   | Full API + DB + tests                                                              | Admin UI polish                                                           | `server/routes/newsletter.js`, `server/routes/leads.js`, `server/routes/submissions.js`            | Spot-check admin views   |
| 5 — Public accounts     | ✅      | Supabase auth + `/api/v1/me/*` + dashboard                                         | Best end-to-end phase                                                              | No GDPR export/delete                                                     | `src/pages/account.js`, `dashboard.html`, `server/routes/public-accounts.js`                       | PR 1 in next sequence    |
| 6 — Billing             | 🟡      | Stripe checkout + portal + webhook + entitlements + `/me/entitlements`             | Webhook-verified; server-trusted                                                   | Two parallel router stacks; live keys missing                             | `server/routes/billing.js`, `server/routes/stripe.js`, `server/lib/entitlements.js`                | Consolidate + load keys  |
| 7 — Shops               | 🟡      | shop_listings + claims + leads + sponsored + click events + admin moderation       | DB & admin side complete                                                           | **No vendor portal at all**                                               | `server/routes/shops-v1.js`, schema                                                                | Build vendor UI          |
| 8 — Analytics + SEO     | ✅      | Externalised analytics, governance check, inventory check                          | Validate gates added                                                               | 608 country pages dilute SEO                                              | `assets/analytics.js`, `scripts/node/{seo-governance,export-analytics-inventory,inventory-seo}.js` | Noindex + cleanup        |
| 9 — Admin ops           | ✅      | `/ops/*` modules + control-center + audit logs                                     | Most complete phase                                                                | Mobile usability ⚪                                                       | `server/routes/admin/index.js:886-1040`                                                            | Mobile spot-check        |
| 10 — X observability    | ✅      | Structured run output + Supabase tables + JSON fallback + admin view               | Live: 7 172 automation_runs / 7 082 tweet_posts / 92 tweet_failures already logged | **Do not touch**                                                          | `.github/workflows/post_gold.yml`, `data/automation_runs.json`                                     | None                     |
| 11 — AI drafts          | 🟡 / 🟣 | Draft-only system, bilingual templates, admin CRUD, approve/publish                | Safe (no auto-publish), human-review enforced                                      | Template-only (no LLM); editorial UI not exercised                        | `server/services/ai-drafts.js`, `server/routes/admin/index.js:1542-1786`                           | Decide if needed         |
| 12 — API product        | ✅      | Public `/api/v1/public/*`, key mgmt, hashed keys, per-tier quotas                  | Externalisable                                                                     | Paid tiers need Stripe keys                                               | `server/routes/developer-api.js`, `server/lib/api-key-auth.js`, `server/lib/entitlements.js`       | Owner: load Stripe       |

Full scorecard with file/line evidence: see
[`12_PHASE_IMPLEMENTATION_SCORECARD.md`](audits/12_PHASE_IMPLEMENTATION_SCORECARD.md).

---

## 4. Stakeholder Readiness

Full matrix: [`STAKEHOLDER_READINESS_MATRIX.md`](audits/STAKEHOLDER_READINESS_MATRIX.md).

| Stakeholder                        | Status | Biggest blocker                        |
| ---------------------------------- | ------ | -------------------------------------- |
| Public visitor                     | ✅     | Page sprawl is dilutive but not broken |
| Customer / logged-in user          | ✅     | Missing GDPR export + delete           |
| **Vendor / supplier / shop owner** | 🔴     | **No vendor portal exists**            |
| Admin / operator                   | ✅     | Mobile usability not verified          |
| Developer / API user               | 🟡     | Live Stripe keys missing               |

---

## 5. Product Focus and Page Cleanup

Full inventory + recommendations:
[`PAGE_CLEANUP_AND_PRODUCT_FOCUS.md`](audits/PAGE_CLEANUP_AND_PRODUCT_FOCUS.md).

Top-line numbers:

- **702 HTML files total** (excluding node_modules / dist / reports / playwright artifacts)
- **608 under `countries/`** (UAE 63 · Saudi 44 · Egypt 30 · Qatar 28 · ~26 each across 17 others)
- **Roughly 420 per-karat city sub-pages** are templated dupes
- **~12 content/guides pages** overlap and can be merged
- **Net target footprint:** ~150 indexable pages (from ~660 today, **~77% reduction**), all with
  clear purpose

**Process:** noindex first → 4–8 week soak → then delete with 301 redirects. Do **not** delete in
one sweep.

---

## 6. Live Tracker Redesign Findings

Tracker today (`tracker.html`, 1 629 lines):

**Strengths**

- Mode/panel registry well-defined (`tests/tracker-modes`)
- Freshness pulse + spot bar (`src/components/spotBar.js`) labels prices honestly
- Chart export & historical range pulls from `/api/v1/prices/history` (post Phase 2)
- Bilingual + RTL safe (passes `tests/home-translations`)

**Weaknesses**

- Single HTML file at 1 629 lines is hard to scan; sections compete for attention
- Alerts UI is token-based and minimal; logged-in users can't manage from one place
- Calculator lives in a separate file (`calculator.html`) and duplicates several conversions
- History still mixes Supabase + static baseline; not surfaced to user
- Compare/archive panels are present but unclear in purpose

**Proposed structure (audit only; no code change here)**

1. Live price cards (XAU/USD, AED/g, per-karat row) with freshness pulse
2. Karat table (24/22/21/18) with city pivot
3. Chart with simple ranges (1D / 1W / 1M / 6M / 1Y)
4. Alerts (logged-in: list + create; anonymous: token entry)
5. Simple calculator panel (weight × karat → AED)
6. Export only when data source is real
7. Source / freshness / methodology callout footer

**Out of scope for this audit:** structural rewrite. The above is a recommendation for PR 3 in the
next sequence.

---

## 7. Backend/API Integration Findings

Routes mounted on `server.js:288-304`:

```
/api/admin              admin (legacy)
/api/stripe             stripe (legacy)
/api/v1/billing         billing
/api/v1/me              billing me-router (entitlements)  + public-accounts + developer-api (mounted last)
/api/newsletter         newsletter (legacy)
/api                    submissions (submit-shop)
/api/v1                 shops-v1
/api/v1/admin           admin (versioned)
/api/v1/stripe          stripe (versioned)
/api/v1/newsletter      newsletter (versioned)
/api/v1                 submissions (versioned)
/api/v1                 leads
/api/v1                 api-v1 (prices, status, events, leads, providers)
/api/v1                 alerts
/api/v1                 developer-api (public + me/api-keys)
/api/v1                 public-accounts (me/*)
```

**Observations:**

- Versioned + legacy routers coexist; intentional during the migration, but now there are **two
  billing surfaces** (`/api/stripe/*` and `/api/v1/billing/*`). Consolidate later.
- Mount order matters: `developerApiRoutes` is mounted before `publicAccountsRouter` so
  `/api/v1/me/api-keys*` resolves correctly (per stored memory and `server.js:300-302`).
- All admin endpoints gate on `authMiddleware('admin')` or `authMiddleware('editor')`.
- Rate limits applied per-route group (`adminRateLimiter`, `eventsRateLimiter`, `leadsRateLimiter`,
  `subscribeLimiter`, etc.).

Test coverage: 62 test files, 675 tests, **100% passing**, including API foundation, alerts,
billing, developer-api, leads, newsletter, public-accounts, shops, audit-log, env-validation,
freshness, sitemap.

---

## 8. Database / Supabase Findings

`supabase/schema.sql` — **2 223 lines, 51 tables, 141 RLS policies**. Every table has
`enable row level security`.

**Table groups:**

- Shops core: `shops`, `shop_submissions`
- Shops v1 (Phase 7): `market_clusters`, `shop_listings`, `shop_claims`, `shop_leads`,
  `sponsored_placements`, `shop_verification_logs`, `shop_click_events`
- Pricing & providers (Phase 2): `gold_prices`, `fetch_logs`, `price_snapshots`, `provider_runs`,
  `provider_health`, `pricing_overrides`
- Alerts (Phase 3): `alert_rules`, `alert_events`, `notification_subscriptions`
- Newsletter / leads (Phase 4): `newsletter_subscribers`, `lead_submissions`, `lead_events`,
  `email_campaigns`, `email_deliveries`, `consent_logs`
- Public accounts (Phase 5): `profiles`, `user_profiles`, `user_preferences`, `saved_calculations`,
  `watchlists`, `saved_shops`, `user_sessions`
- Billing (Phase 6): `plans`, `stripe_customers`, `subscriptions`, `entitlements`, `stripe_events`,
  `billing_audit_logs`
- API product (Phase 12): `api_keys`, `api_usage`, `api_rate_limits`, `developer_apps`
- X automation (Phase 10): `automation_runs`, `tweet_posts`, `tweet_failures`
- AI drafts (Phase 11): `ai_drafts`
- Operations: `site_settings`, `audit_logs`, `analytics_events`, `api_call_logs`, `orders`,
  `content_posts`, `social_posts`

**Gaps:**

- No `vendors` table; vendor identity would have to be modelled on `profiles.role` (proposed PR 5).
- No `gdpr_export_jobs` / soft-delete on user data (proposed PR 1).

---

## 9. Auth and Role Findings

**Layer 1 — admin JWT (`server/lib/auth.js`):**

- Roles: `viewer < editor < admin` (`ALLOWED_ROLES` line 56; hierarchy line 325)
- bcrypt for password hashing; token-version for revocation (`tests/auth-token-version.test.js`)
- "Cannot delete last admin" guard (line 271)
- `authMiddleware(requiredRole)` gates routes

**Layer 2 — Supabase (`src/pages/account.js`, `admin/supabase-auth.js`):**

- `signInWithPassword`, `signUp`, `signInWithOAuth`, magic-link `signInWithOtp`
- Used by both public users (`account.html`) and the admin shell (`admin/index.html`)

**Gaps:**

- No `vendor` role yet (this is the proposed PR 5).
- Role separation between Supabase auth and admin JWT is fine in practice but not formally
  documented in one place — see
  [`docs/PUBLIC_ACCOUNTS_AND_SAVED_TOOLS.md`](PUBLIC_ACCOUNTS_AND_SAVED_TOOLS.md) and
  [`docs/ADMIN_SETUP.md`](ADMIN_SETUP.md).

---

## 10. UI/UX and Mobile Findings

- Mobile pass PR #286 landed; tracker still warrants a phone spot-check at 360px
- Admin shell on mobile ⚪ not verified in audit
- Customer dashboard is functional but minimal (list + delete); polish landing in PR 6 of the next
  sequence
- Tracker layout is dense; reorganise per "Live Tracker Redesign Findings" above
- RTL: translations present (`src/config/translations.js`); spot-check anything touched

---

## 11. SEO and Content Findings

- `npm run validate` confirms **702 HTML files scanned, 657 surveyed, 655 with canonical, 644 with
  JSON-LD** — coverage is excellent.
- Two non-blocking warnings during validate: `seo-governance` and `analytics-inventory` reports
  stale — both have `npm run seo:governance` / `npm run analytics:inventory` to refresh. Not
  blocking.
- Service worker coverage clean: `5 registered, 11 allow-listed, 0 unregistered`.
- DOM-safety baseline tight: "No new unsafe DOM sinks."
- **Content footprint is too wide** for the current product direction — see Section 5.

---

## 12. Security Findings

| Priority | Finding                                                                                                                         | Evidence                                                             | Note                                                                                                                                                                                                                                                                                                       |
| -------- | ------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0       | None identified                                                                                                                 | —                                                                    | Lint/validate/tests all clean; DOM-safety baseline tight; CSP locked down in prod (`server.js:46-104`); webhook signature verification present (`stripe.js:184`, `billing.js:272`); admin auth gated on `authMiddleware('admin'/'editor')`; SHA-256 hashing for API keys with CodeQL suppression annotated |
| P1       | GDPR export/delete missing                                                                                                      | `server/routes/public-accounts.js` — no `/me/export` or `DELETE /me` | Fix in PR 1                                                                                                                                                                                                                                                                                                |
| P1       | Two billing router stacks could drift                                                                                           | `server.js:288, 290, 302`                                            | Consolidate in PR 4                                                                                                                                                                                                                                                                                        |
| P2       | Stripe / Resend / Supabase live keys absent (assumed; cannot inspect GH Secrets)                                                | env-validation prints warnings only                                  | Owner action                                                                                                                                                                                                                                                                                               |
| P2       | `.env.example` lacks vendor-related entries                                                                                     | n/a yet                                                              | Add when vendor portal lands                                                                                                                                                                                                                                                                               |
| P3       | `package-lock.json` is committed but `npm install` warned `EBADENGINE` for `listr2@10.2.1` (needs Node ≥22.13; CI Node 20.20.2) | install log                                                          | Warning only, install succeeded                                                                                                                                                                                                                                                                            |
| P3       | `playwright-report/` artifacts can fail tests if present (stored memory)                                                        | `tests/seo-sitewide.test.js:53-77`                                   | Remove before running tests                                                                                                                                                                                                                                                                                |

No committed secrets found in `.env.example` (placeholders only).

---

## 13. Test Results

Commands run during this audit on a clean checkout of `main`:

| Command                                                                  | Result                                                           | Notes                                                                                                                       |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `npm install`                                                            | ✅ added 348 packages in 4 s                                     | One `EBADENGINE` warning (`listr2` wants Node ≥22.13; runner has Node 20.20.2). Install succeeded.                          |
| `npm test` (with `JWT_SECRET`, `ADMIN_PASSWORD`, `ADMIN_ACCESS_PIN` set) | ✅ **tests 675 / pass 675 / fail 0** across 108 suites in 29.9 s | 62 Node `*.test.js` files                                                                                                   |
| `npm run lint`                                                           | ✅ ESLint clean                                                  | —                                                                                                                           |
| `npm run validate`                                                       | ✅ all gates passed                                              | Two non-blocking advisories: `seo-governance` report stale; `analytics-inventory` report stale. Both have refresh commands. |

Not run in this audit:

- `npm run build` — produces in-place HTML rewrites via `inject-schema` (stored memory); would dirty
  the working tree, irrelevant for an audit-only PR
- `npx playwright test` — needs browser install; out of scope
- `pytest` — python tests live under `tests/test_*.py`, exercised by `pr-provider-smoke.yml` in CI

**Failure analysis:** none. There are no blocking failures.

---

## 14. What Should Stay As-Is

Do **not** touch in any next PR unless explicitly required:

1. **`.github/workflows/post_gold.yml`** — production X automation; logs healthy (7 172 runs / 7 082
   posts / 92 failures = ~98.7% success).
2. **Gold-price formulas** (`src/lib/price-calculator.js`, `server/services/pricingEngine.js`,
   `src/config/karats.js`, AED peg in `.env.example`).
3. **Freshness / cached / stale / fallback labels** — they are product elements, not decoration.
4. **`server/routes/api-v1.js`** request envelope and Phase 1 foundation.
5. **`supabase/schema.sql`** RLS policies — 141 policies provide defense-in-depth.
6. **`server/lib/api-key-auth.js`** SHA-256 hashing — annotated and tested.
7. **`server/lib/auth.js`** token-versioning and last-admin guard.
8. **DOM-safety baseline** (`scripts/node/check-unsafe-dom.js`) — never let it grow.
9. **Bilingual translations** in `src/config/translations.js`.
10. **Validation gates** in `npm run validate`.

---

## 15. What Should Be Removed or Simplified Later

(Recommendations only — no deletion in this PR.)

1. ~420 per-karat city pages under `countries/*/<city>/gold-rate/{18,21,22,24}-karat/`
2. `invest.html` (off-strategy, 69 KB single page)
3. `content/tools/investment-return.html` and `content/guides/invest-in-gold-gcc.html`
4. `content/tools/weight-converter.html` (marginal product fit)
5. Overlapping karat guides — collapse 4 pages into 1
6. Overlapping buying guides (`content/guides/buying-guide.html` + `content/uae-gold-buying-guide/`)
7. Per-city `gold-prices/index.html` (merge into `gold-rate/`)
8. Long-tail city landings (noindex + merge into country page)
9. Generic markets pages (keep only famous ones)
10. Legacy `/api/stripe/*` router (consolidate into `/api/v1/billing/*`)
11. `content/premium-watch/` if no real product purpose
12. AI drafts feature: keep DB + admin endpoints, but de-prioritize UI if the product moves away
    from owned content

---

## 16. Immediate Hot-Fix List (P0 / P1 only)

None are P0. P1 backlog:

- **P1.** Add `GET /api/v1/me/export` and `DELETE /api/v1/me` to close GDPR gap (PR 1).
- **P1.** Document Stripe / Resend / Supabase secret loading; surface readiness in `/api/v1/status`
  (PR 1 + PR 4).
- **P1.** Surface server-backed alerts to logged-in users in the tracker (PR 1 then PR 9).
- **P1.** Build a vendor portal so Phase 7 is end-to-end (PR 5 + PR 7).
- **P1.** `noindex` the ~420 per-karat city pages (PR 2).

---

## 17. Recommended Next PR Sequence

Full file: [`NEXT_PR_SEQUENCE.md`](audits/NEXT_PR_SEQUENCE.md). Short form:

| PR  | Goal                                                              | Risk |
| --- | ----------------------------------------------------------------- | ---- |
| 1   | P0/P1 hotfixes + GDPR export/delete + docs for secret loading     | 🟢   |
| 2   | Page-simplification plan + noindex ~420 thin pages (no deletions) | 🟡   |
| 3   | Live Tracker focus pass (no math change)                          | 🟡   |
| 4   | Backend/API/Supabase hardening (consolidate billing routers)      | 🟡   |
| 5   | Vendor role schema + RLS (no UI yet)                              | 🔴   |
| 6   | Customer dashboard polish + GDPR UI                               | 🟡   |
| 7   | **Vendor / supplier portal + shop leads dashboard**               | 🔴   |
| 8   | Admin operations dashboard polish + mobile                        | 🟢   |
| 9   | Alerts / newsletter / leads cleanup                               | 🟢   |
| 10  | Billing / API monetization completion (depends on owner keys)     | 🟡   |
| 11  | SEO + content deletions (executes PR 2 plan after noindex grace)  | 🔴   |
| 12  | Final mobile / a11y / polish pass                                 | 🟢   |

Do not collapse into one PR. Each is reviewable and reversible.

---

## 18. Final Recommendation

- **Should this be deployed now?** ✅ Yes for the public site, customer dashboard, admin ops, X
  automation, and developer API key issuance. 🟡 Hold paid Stripe/Resend flows until live keys land.
- **Should anything be rolled back?** No. The 12-phase work is coherent and tested.
- **Fastest path to a clean, usable product:**
  1. Land **owner-action secrets** (Stripe, Resend, Supabase service role).
  2. Ship **PR 1** (GDPR export/delete + alert UI surface + docs).
  3. Ship **PR 2** (noindex thin pages — no deletes).
  4. Ship **PR 5 → PR 7** (vendor role + vendor portal).
  5. Defer PR 11 (deletions) until 4–8 weeks of noindex soak.

---

## Actionable Next Step — exact next Copilot prompt

Paste verbatim:

> You are working on Gold Ticker Live, post-audit. Read
> `docs/GOLD_TICKER_LIVE_12_PHASE_POST_IMPLEMENTATION_AUDIT.md` and
> `docs/audits/NEXT_PR_SEQUENCE.md` first. Implement **PR 1 — P0/P1 hot-fixes** from that sequence
> and **only that PR**. Specifically:
>
> 1. Add `GET /api/v1/me/export` returning a JSON dump of the current user's `profiles`,
>    `user_preferences`, `saved_calculations`, `watchlists`, `saved_shops`, and `api_keys` (hashed
>    only — never plaintext). Gate on Supabase auth.
> 2. Add `DELETE /api/v1/me` that revokes the Supabase user and removes their rows from the tables
>    above (soft-delete if RLS forbids hard delete). Confirm with `confirm: "DELETE"` body field.
>    Audit-log the action.
> 3. In `dashboard.html` + `src/pages/dashboard.js`, expose two new buttons in EN + AR: "Export my
>    data" (downloads JSON) and "Delete my account" (modal confirmation, types `DELETE`).
> 4. In `tracker.html` + `src/pages/tracker-pro.js`, add a first-class "Create alert" link from the
>    price card for logged-in users (anonymous users still see the token entry surface).
> 5. Update `docs/PUBLIC_ACCOUNTS_AND_SAVED_TOOLS.md`, `docs/ALERTS_AND_NOTIFICATIONS.md`, and
>    `docs/BILLING_AND_ENTITLEMENTS.md` with the owner-action checklist (Stripe live keys,
>    `ALERT_JOB_TOKEN`, `RESEND_API_KEY`, Supabase service role).
>
> Hard constraints: do not change gold-price math; do not change `post_gold.yml` or freshness
> labels; do not delete any pages; do not add new dependencies; keep diffs reviewable. Tests: extend
> `tests/public-accounts-api.test.js`; keep `npm test`, `npm run lint`, `npm run validate` green.
> Bilingual EN/AR for every user-visible string. Ship a PR titled "PR 1 — P0/P1 hotfixes: GDPR
> export/delete + alerts UI surface + secret-loading docs".
