# AI Agent Review Checklists + Risk Register

Consolidated, paste-ready checklists for the most common Gold Ticker Live review surfaces, plus a
risk register that maps known failure modes to their defences.

For per-skill detail, see the individual checklists under `.github/skills/*/checklists/`. This doc
is the **convenient cross-reference** — the skill folders are the **source of truth**.

---

## Gold Ticker Live Golden Rules

> Read these every session. Memorize them. They're short on purpose.

1. **Reference price is not retail price.** Calculator output is a reference estimate.
2. **Freshness must be visible.** State + source + UTC timestamp on every priced surface.
3. **AED peg = 3.6725.** Troy ounce = 31.1034768. Karat factors from `src/config/karats.js`.
4. **Arabic / RTL is first-class.** EN+AR ship together for user-visible copy.
5. **Secrets never enter the repo.** Public repo, public site, public X channel.
6. **Production X posting is delicate.** `dry_run: true` before any change to `post_gold.yml`.
7. **Canonical domain is `goldtickerlive.com`.** Never `vctb12.github.io/Gold-Prices/*`.
8. **Tracker is the flagship.** Treat it as a workspace, not a landing page.
9. **Country pages must not be thin clones.** Real local context or `noindex`.
10. **Verify before reporting.** Say what you ran. Be honest about what you didn't.

---

## Pricing Review

```md
- [ ] Troy ounce = 31.1034768
- [ ] AED peg = 3.6725
- [ ] Karat factors via `src/config/karats.js`
- [ ] Non-UAE pages: USD → local FX directly
- [ ] Every visible price has a state label (live/cached/delayed/estimated/fallback/closed)
- [ ] Source + UTC timestamp adjacent to every price
- [ ] Reference vs. retail wording explicit
- [ ] Methodology link present
- [ ] Calculator discloses VAT + making charges
- [ ] Historical data declares resolution + gap behaviour
- [ ] CSV/JSON exports include source + timezone + resolution + disclaimer
- [ ] Unit tests cover any formula touched
```

## Freshness Review

```md
- [ ] State component shared (not reinvented per page)
- [ ] `live` budget defined (≤ 60 s default)
- [ ] `cached` set when SW / in-memory cache serves the response
- [ ] `fallback` set when provider failed
- [ ] `estimated` on calculator + derived surfaces
- [ ] No silent stale (no state → banner, not blank price)
- [ ] `aria-live="polite"` on the price card
- [ ] No layout shift when state changes
- [ ] State labels translated for AR
```

## Tracker Review

```md
- [ ] Sticky control bar condensed to one row at 360 px
- [ ] Sticky bar does NOT occlude price card / chart
- [ ] Price card always shows: price + state + source + UTC timestamp
- [ ] Chart legible at 360 px
- [ ] Range presets reachable without nested menus
- [ ] Export buttons discoverable but not dominant
- [ ] Loading state: skeleton + freshness "loading"
- [ ] Error state: clear message + retry
- [ ] Offline state: cached price + offline.html link
- [ ] RTL: chart + controls mirrored correctly
- [ ] `aria-live="polite"` on price card
```

## Mobile Review

```md
- [ ] Tokens used (no off-token hex / rem)
- [ ] Tested at 360 / 390 / 430 / 768
- [ ] Touch targets ≥ 44×44 px
- [ ] Tables → cards on small screens
- [ ] One dominant CTA per primary card
- [ ] Tabular-nums for numbers
- [ ] All strings via `translations.js`
- [ ] No horizontal scroll at 360 px
- [ ] LCP < 2.5 s, CLS < 0.1 on mobile
```

## EN / AR Review

```md
- [ ] `<html lang="ar" dir="rtl">` on AR variant
- [ ] All visible strings via `translations.js`
- [ ] Arabic reads naturally (not English word-for-word)
- [ ] Chevrons / arrows mirrored
- [ ] `Intl.NumberFormat` for numbers
- [ ] Hreflang pair present (`ar`, `en`, `x-default`)
- [ ] No layout shift caused by AR being longer than EN
- [ ] `<span lang>` used when switching languages inline
```

## SEO Review

```md
- [ ] Unique `<title>`, `<h1>`, meta description per indexed page
- [ ] Canonical = `https://goldtickerlive.com/<path>`
- [ ] `og:url` = canonical
- [ ] Hreflang pair present for EN/AR
- [ ] Schema via `inject-schema.js` only
- [ ] `sitemap.xml` not hand-edited
- [ ] New noindex page → entry in `seo-governance.js`
- [ ] At least one internal link in + one out
- [ ] `npm run seo:governance:check` PASS
- [ ] `npm run validate` PASS
```

## GitHub Actions Review

```md
- [ ] `permissions:` block declared and minimal
- [ ] `workflow_dispatch` with `dry_run` input for any workflow with side effects
- [ ] No `set -x` near `${{ secrets.* }}`
- [ ] Secrets referenced by name only
- [ ] Boolean inputs handled as strings
- [ ] State commits use `[skip ci]`
- [ ] Schedule cron in UTC + documented
- [ ] Logs reviewed via GitHub MCP tools after any change
```

## X / Twitter Automation Review

```md
- [ ] Tweet body assembled from current snapshot, not hardcoded
- [ ] Length check counts URL as 23 chars
- [ ] Duplicate detection: state file tracks last posted hash
- [ ] X 187/403 → back off (no retry)
- [ ] Stale-price guard → "market closed" or skip
- [ ] OAuth referenced by name only
- [ ] Observability JSON written to `data/`, committed with `[skip ci]`
- [ ] Recent 7d failures triaged
- [ ] Failure alert step gated `if: always()`
```

## Security Review

```md
- [ ] No secrets in diff
- [ ] `.env.example` placeholders not real-looking
- [ ] After `npm run build`: no `SERVICE_ROLE_KEY` / `JWT_SECRET` / `STRIPE_SECRET` in `dist/`
- [ ] New routes: auth + rate limit + input validation
- [ ] No `eval()` / `Function(string)` / unsafe `child_process` with user input
- [ ] Error responses don't leak stack traces
- [ ] `helmet()` defaults not weakened
- [ ] `npm audit --omit=dev` HIGH/CRITICAL triaged
- [ ] Webhook handlers verify signature
```

## Accessibility Review

```md
- [ ] Semantic HTML (landmarks, heading hierarchy)
- [ ] Keyboard order matches visual order
- [ ] `:focus-visible` rings visible
- [ ] Form labels associated + `aria-describedby` for help/errors
- [ ] `aria-live="polite"` on price card; `assertive` for errors only
- [ ] Contrast: body 4.5:1, UI 3:1
- [ ] Reduced motion respected (global reset preserved)
- [ ] `inputmode` correct on numeric inputs
- [ ] No auto-focus on load
- [ ] Skip link to `<main>` works
- [ ] `npm run a11y` PASS
```

## Backend / Supabase Review

```md
- [ ] Route under correct realm (`/api/v1/me/*`, `/api/v1/admin/*`, `/api/v1/public/*`)
- [ ] Auth applied + rate limit + validation
- [ ] Logic in `server/lib/`; persistence in `server/repositories/`
- [ ] File-fallback for hermetic tests
- [ ] New table → RLS enabled + explicit policies
- [ ] Service-role key not bundled to browser
- [ ] Audit log writes on admin mutations
- [ ] Migration additive
- [ ] `.env.example` + `docs/environment-variables.md` updated for new env vars
- [ ] Tests cover happy + auth-fail + validation-fail + rate-limit-edge
```

## Release Readiness Review

See [`AI_RELEASE_READINESS_PLAYBOOK.md`](./AI_RELEASE_READINESS_PLAYBOOK.md).

---

# Risk Register

For each risk: **what can go wrong**, **how to detect it**, **how to prevent it**, **files to
inspect**, **tests to run**.

## R1. Pricing truth regression

- **What can go wrong:** Reference price shown as a retail/shop quote; AED peg changed silently;
  inline karat factor drifts from `karats.js`.
- **Detect:** PR diff touches `src/lib/price-calculator.js`, `src/config/karats.js`,
  `src/config/constants.js`, or any pricing component without matching tests.
- **Prevent:** `pricing-data-integrity` skill + `pricing-data-agent` review + unit tests for any
  formula touched.
- **Inspect:** `src/lib/price-calculator.js`, `src/config/*`, `tests/price-calculator*.test.js`.
- **Tests:** `npm test`, manual cross-page check (tracker vs. calculator vs. country page).

## R2. Stale data as live

- **What can go wrong:** Cache serves a 30-min-old price labelled `live`; X-post tweets stale.
- **Detect:** Any change to `src/lib/cache.js`, `src/lib/api.js`, or `post_gold.yml` without an
  age-check.
- **Prevent:** Freshness checklist; `live` budget threshold; `aria-live` price card; X-poster's
  stale guard.
- **Inspect:** `src/lib/cache.js`, `src/lib/api.js`, `scripts/python/utils/*`.
- **Tests:** `data/automation-*.json` 24h health; manual tracker offline test.

## R3. Reference vs. retail confusion

- **What can go wrong:** Calculator/tracker copy implies the price is a shop quote.
- **Detect:** Translations diff introduces "shop rate", "today's price", "buy now at"; missing
  methodology link.
- **Prevent:** Calculator must show "estimated" + VAT + making-charge disclaimer; methodology link
  required.
- **Inspect:** `src/config/translations.js`, `calculator.html`, `tracker.html`, `methodology.html`.
- **Tests:** Manual EN+AR copy review on calculator + tracker.

## R4. Canonical / SEO drift

- **What can go wrong:** Canonical points to `vctb12.github.io/Gold-Prices/*`; sitemap hand-edited
  and stale; per-karat city page indexed.
- **Detect:** PR diff touches `<link rel=canonical>`, `sitemap.xml` directly, or any page in
  `countries/`.
- **Prevent:** `seo-governance.js` enforces noindex policy; build regenerates sitemap; canonical
  template uses `goldtickerlive.com`.
- **Inspect:** all `.html`, `scripts/node/seo-governance.js`, `scripts/node/generate-sitemap.js`.
- **Tests:** `npm run seo:governance:check`, `npm run validate`.

## R5. Base-path / service worker breakage

- **What can go wrong:** Service worker caches a URL under `/Gold-Prices/` after a domain migration;
  absolute paths break under the custom domain.
- **Detect:** PR diff touches `sw.js`, `vite.config.js`, or asset paths.
- **Prevent:** Use root-relative paths; bump SW cache version on cache-shape changes; test `dist/`
  after build.
- **Inspect:** `sw.js`, `vite.config.js`, `dist/sw.js` after build.
- **Tests:** `npm run build`; open `dist/` and verify SW registers + caches.

## R6. Secret leak

- **What can go wrong:** Service-role Supabase key bundled to browser; Stripe secret echoed in
  workflow logs; real value in `.env.example`.
- **Detect:** `grep` after build; secret-scanning alerts.
- **Prevent:** `security-review` skill standing checks; `.env.example` review in every PR.
- **Inspect:** `dist/**`, `.env.example`, `.github/workflows/**`.
- **Tests:** `grep -r SERVICE_ROLE_KEY dist/`; `npm audit`.

## R7. X-posting failure (production)

- **What can go wrong:** Hourly post fails silently; duplicates posted; stale posted as live;
  OAuth/403 unhandled.
- **Detect:** `data/automation-*.json` shows failures; `https://x.com/GoldTickerLive` quiet
  unexpectedly.
- **Prevent:** Stale guard; duplicate detect; back-off on 187/403; `dry_run` before changes;
  observability commits.
- **Inspect:** `.github/workflows/post_gold.yml`, `scripts/python/`.
- **Tests:** `workflow_dispatch` with `dry_run: true`; monitor next scheduled run.

## R8. EN/AR parity regression

- **What can go wrong:** New copy shipped EN-only; AR variant left empty; RTL layout broken.
- **Detect:** PR diff touches user-visible copy without updating both `en` and `ar` blocks of
  `translations.js`; AR page screenshot missing.
- **Prevent:** Translations test enforces parity; every prompt requires EN+AR ship together.
- **Inspect:** `src/config/translations.js`, AR variants of changed pages.
- **Tests:** `npm test` (translations test), manual RTL spot at 360 px.

## R9. Mobile UX regression

- **What can go wrong:** Sticky bar overlaps price card; table overflows at 360 px; touch target
  shrinks below 44 px.
- **Detect:** PR diff touches `tracker.html`, `calculator.html`, layout CSS without screenshots.
- **Prevent:** `mobile-ux-review` skill; screenshots at 360/430 required in PR.
- **Inspect:** changed HTML / CSS / JS.
- **Tests:** Manual device emulation at 360/390/430; Lighthouse mobile.

## R10. Provider freshness regression

- **What can go wrong:** Provider switch drops update cadence from 1m to 1h; gap behaviour changes
  silently.
- **Detect:** PR diff touches provider adapter without bakeoff entry.
- **Prevent:** Bakeoff before production switch; `pricing-data-integrity` checklist.
- **Inspect:** `scripts/` provider adapters, `reports/`.
- **Tests:** Bakeoff workflow + readiness workflow before switch.

## R11. Fake shop verification

- **What can go wrong:** "Trusted by N customers" / "official rate" / "best price" claims without
  evidence.
- **Detect:** PR diff to `shops.html` / `data/shops*.json` introduces claim language.
- **Prevent:** `shops-data-honesty` prompt; tier vocabulary fixed at `verified` / `listed` /
  `market cluster`.
- **Inspect:** `shops.html`, `data/shops*.json`, `src/pages/shops.js`.
- **Tests:** Manual content review; `npm run audit-pages`.

## R12. Historical data smoothing

- **What can go wrong:** Market-closed gaps interpolated silently; resolution mislabelled.
- **Detect:** PR diff touches historical chart / data adapter without explicit gap handling.
- **Prevent:** Historical-data checklist; gaps rendered as gaps, not lines.
- **Inspect:** chart component, historical data adapter.
- **Tests:** Manual: render a weekend window; gaps visible.
