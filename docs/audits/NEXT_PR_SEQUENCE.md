# Recommended Next PR Sequence

> Companion to
> [`docs/GOLD_TICKER_LIVE_12_PHASE_POST_IMPLEMENTATION_AUDIT.md`](../GOLD_TICKER_LIVE_12_PHASE_POST_IMPLEMENTATION_AUDIT.md).
> Sequence is ordered to unblock highest-leverage gaps first while keeping each PR reviewable. Risk:
> 🟢 low · 🟡 medium · 🔴 high.

> **2026-06-01 update:** UI/UX audit **Sessions 0–5 are merged** ([#387](https://github.com/vctb12/GoldTickerLive/pull/387)–[#393](https://github.com/vctb12/GoldTickerLive/pull/393)).
> Use [`docs/plans/2026-06-01_master-operations-hub.md`](../plans/2026-06-01_master-operations-hub.md)
> for priority routing. **PR 3 (tracker focus) is unblocked** — coordinate with Track B3 in the UI/UX
> program if doing tracker declutter.

---

## PR 1 — P0/P1 hot-fixes + missing integration glue

**Goal:** close the smallest, highest-leverage gaps before any redesign.

**Likely files:**

- `server/routes/public-accounts.js` — add `DELETE /api/v1/me` (account delete) and
  `GET /api/v1/me/export` (GDPR export)
- `dashboard.html` + `src/pages/dashboard.js` — surface "Export my data" + "Delete account" buttons
- `tracker.html` + `src/pages/tracker-pro.js` — surface server-backed alerts more clearly (link from
  price card → create alert form)
- `docs/ALERTS_AND_NOTIFICATIONS.md` — document `ALERT_JOB_TOKEN` + `RESEND_API_KEY` owner action
- `docs/BILLING_AND_ENTITLEMENTS.md` — document Stripe secret loading (no code change)

**Acceptance criteria:**

- `DELETE /api/v1/me` removes user rows from `profiles`, `user_preferences`, `saved_calculations`,
  `watchlists`, `saved_shops`, `api_keys`; revokes Supabase user
- `GET /api/v1/me/export` returns JSON dump of all user data, gated by auth
- Dashboard UI exposes both flows in EN/AR
- Owner-action checklist exists in docs

**Tests:** new tests in `tests/public-accounts-api.test.js`; `npm test`, `npm run lint`,
`npm run validate`.

**Risk:** 🟢

---

## PR 2 — Product simplification plan (no deletions yet)

**Goal:** ship the _plan_ document + add `noindex` + canonical fixes for the worst offenders.

**Likely files:**

- `docs/plans/<date>_page-simplification-plan.md` (new) — locks the keep/merge/noindex/delete list
  from `PAGE_CLEANUP_AND_PRODUCT_FOCUS.md`
- `countries/*/<city>/gold-rate/{18,21,22,24}-karat/index.html` — add
  `<meta name="robots" content="noindex,follow">` (no content removed)
- `content/tools/investment-return.html`, `content/guides/invest-in-gold-gcc.html` — noindex
- `scripts/node/inventory-seo.js` — confirm noindex flags propagate
- `sitemap.xml` generator (`build/generateSitemap.js`) — exclude noindex pages

**Acceptance criteria:**

- ~420 per-karat sub-pages have `noindex,follow`
- Sitemap shrinks by ~400 entries
- `npm run validate` still green; SEO inventory reports the delta
- Internal nav untouched (so users can still reach pages if linked)

**Tests:** `tests/inventory-seo.test.js`, `tests/sitemap.test.js`, `tests/sitemap-parity.test.js`.

**Risk:** 🟡 (sitemap shrink is reversible; no content deleted)

---

## PR 3 — Live Tracker focus pass

**Goal:** consolidate the flagship surface around the command-center direction.

**Likely files:**

- `tracker.html` (1 629 lines) — tighten section order: live cards → karat table → chart → alerts →
  export
- `src/pages/tracker-pro.js`, `src/components/spotBar.js`, `src/components/ticker.js`
- `src/pages/calculator.js` — embed the simplest calculator view as a tracker panel (don't delete
  the standalone yet)
- `styles/pages/tracker.css`
- `src/tracker/*`

**Acceptance criteria:**

- Tracker mode/panel registry (`tests/tracker-modes` already there) unchanged
- Reference-vs-retail copy reviewed; freshness pulse remains
- Mobile audit: every section usable at 360px
- RTL spot-check on each panel
- No price-math change

**Tests:** `npm test` (tracker-modes), Playwright smoke at 360px + desktop.

**Risk:** 🟡 (touches flagship surface; keep diffs section-by-section as separate commits)

---

## PR 4 — Backend/API/Supabase hardening

**Goal:** consolidate billing routers, tighten history source-of-truth, add a few missing
observability bits.

**Likely files:**

- `server.js:288-303` — pick one billing surface (`/api/v1/billing/*`); deprecate `/api/stripe/*`
  behind a 308 redirect
- `server/routes/api-v1.js:308` history — prefer Supabase, fall back to static baseline only when DB
  empty
- `server/lib/env-validation.js` — surface Stripe / Resend / Supabase wiring in `/api/v1/status`
- `docs/PRICE_API_AND_HISTORY.md`, `docs/BILLING_AND_ENTITLEMENTS.md`

**Acceptance criteria:**

- One canonical billing surface
- History source documented and visible in `/api/v1/status`
- No regressions: `tests/billing.test.js`, `tests/historical.test.js`,
  `tests/price-api-routes.test.js`

**Risk:** 🟡

---

## PR 5 — Auth roles foundation (vendor role)

**Goal:** introduce a `vendor` role end-to-end without shipping vendor UI yet (foundation only).

**Likely files:**

- `supabase/schema.sql` — add `role` column on `profiles` (enum: `user|vendor|admin`); add RLS
  policies for vendor-owned `shop_listings`, `shop_leads`, `shop_claims`
- `server/lib/auth.js` — extend `ALLOWED_ROLES`; map Supabase role → JWT (where applicable)
- `server/routes/public-accounts.js` — vendor-scope query helpers
- `docs/SUPABASE_SCHEMA.md`

**Acceptance criteria:**

- Migration applies cleanly to a fresh Supabase instance (per `supabase/MASTERY.md`)
- RLS: vendor can read/write only their own listings & leads
- Tests: `tests/auth.test.js`, `tests/supabase-data.test.js`

**Risk:** 🔴 (schema migration; needs careful Supabase plan)

---

## PR 6 — Customer dashboard polish + GDPR

**Goal:** absorb residual customer-side UX gaps (presumes PR 1 already shipped export/delete).

**Likely files:**

- `dashboard.html`, `src/pages/dashboard.js`, `src/pages/account.js`
- New: `src/pages/dashboard/sections/*` (alerts list, watchlist editor, saved calcs editor)
- `docs/PUBLIC_ACCOUNTS_AND_SAVED_TOOLS.md`

**Acceptance criteria:**

- Customer can view + delete a single watchlist/alert/saved-calc inline
- Bilingual + RTL
- Lighthouse mobile score ≥ current baseline

**Risk:** 🟡

---

## PR 7 — Vendor / supplier panel + shop leads

**Goal:** ship the missing vendor self-serve surface.

**Likely files:**

- New: `vendor.html`, `src/pages/vendor.js`, `src/pages/vendor/sections/*`
- `server/routes/public-accounts.js` or new `server/routes/vendor.js` —
  `GET/POST/PATCH /api/v1/me/shops`, `GET /api/v1/me/shop-leads`
- `server/routes/shops-v1.js` — claim accept/reject by listing owner (currently admin-only)
- `nav-data.js` / `footer.js` — add "For vendors" link

**Acceptance criteria:**

- A user with `vendor` role can: create draft listing → submit for review → see status → see leads →
  respond
- Admin still moderates; vendor cannot bypass verification
- Tests: new `tests/vendor-api.test.js`, integration with `tests/shops-business-api.test.js`

**Risk:** 🔴 (largest net-new surface; depends on PR 5)

---

## PR 8 — Admin operations dashboard polish

**Goal:** wire admin UI pages to the existing `/ops/*` endpoints; mobile/usability pass.

**Likely files:**

- `admin/*/index.html`, `admin/shared/admin-shell.js`
- New admin pages: vendors list, lead funnel chart, X-automation panel

**Acceptance criteria:**

- Every `/api/v1/admin/ops/*` endpoint has an admin UI surface
- Mobile usable at 414px (target widths used in spec)
- Audit-log records every mutation

**Risk:** 🟢

---

## PR 9 — Alerts / newsletter / leads cleanup

**Goal:** finish the gaps Phase 3 + 4 left at the edges.

**Likely files:**

- `tracker.html` + `tracker-pro.js` — first-class "Create alert" UI tied to a logged-in user (or
  token)
- `dashboard.html` — list/manage alerts per user
- Footer newsletter form — confirmation copy
- `content/submit-shop/index.html` — lead-capture polish

**Acceptance criteria:**

- Authenticated user can create/manage alerts without juggling a management token
- All consent strings live in `src/config/translations.js` (EN + AR)

**Risk:** 🟢

---

## PR 10 — Billing / API monetization completion

**Goal:** flip developer monetization to externalisable once secrets land.

**Likely files:**

- `developer.html`, `src/pages/developer.js`
- `pricing.html` — checkout error/success surfaces
- `server/routes/billing.js` — sponsored-listing checkout path (links Phase 7 vendor flow →
  subscription)
- `docs/API_PRODUCT.md`

**Acceptance criteria:**

- End-to-end paid checkout in Stripe test mode
- Vendor sponsorship checkout works (depends on PR 7 + PR 5)

**Risk:** 🟡 (depends on owner-action keys)

---

## PR 11 — SEO + content cleanup execution

**Goal:** **delete** the pages PR 2 already `noindex`-ed, after 4–8 weeks of `noindex` settling.

**Likely files:**

- `countries/*/<city>/gold-rate/{18,21,22,24}-karat/*` — delete after 301 redirect map
- `content/tools/investment-return.html`, `content/guides/invest-in-gold-gcc.html` — delete
- `_redirects` + `.htaccess` — add 301s
- `sitemap.xml`, `robots.txt`, internal nav

**Acceptance criteria:**

- `npm run check-links` clean
- 301 map covers every removed URL
- Search Console submitted

**Risk:** 🔴 (irreversible without git history; do not skip the noindex grace period)

---

## PR 12 — Final mobile / polish / accessibility pass

**Goal:** end-of-arc QA sweep.

**Likely files:**

- `styles/global.css`, `styles/pages/*.css`
- `src/components/*`
- `tests/seo-sitewide.test.js`, `tests/freshness-coverage.test.js`, `.pa11yci.js`

**Acceptance criteria:**

- Lighthouse mobile ≥ current baseline on home + tracker + shops + pricing + dashboard
- Pa11y clean on the same five pages
- RTL spot-check on the same five
- DOM-safety baseline tighter or unchanged

**Risk:** 🟢

---

## Sequence diagram

```
PR 1  P0/P1 + GDPR        →  unblocks customers
PR 2  Page-cleanup PLAN   →  unblocks SEO
PR 3  Tracker focus       →  flagship polish
PR 4  Backend hardening   →  removes drift
PR 5  Vendor role schema  →  prerequisite for PR 7, PR 10
PR 6  Customer polish     →  ships on top of PR 1
PR 7  Vendor portal       →  closes biggest gap
PR 8  Admin polish        →  visibility for all of the above
PR 9  Alerts/newsletter   →  finishes Phase 3/4 last mile
PR 10 Billing complete    →  monetization live
PR 11 SEO deletions       →  executes the PR 2 plan (after noindex grace)
PR 12 Mobile/A11y/Polish  →  closes the arc
```

**Do not collapse this into one PR.** The whole point of the sequence is to keep diffs reviewable
and reversible.
