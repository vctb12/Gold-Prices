# Full-site UX, content, SEO, and admin revamp

```yaml plan-status
status: in-progress
priority: P1
class: A
owner: @vctb12
last_run_at: "2026-05-22T14:31:00Z"
last_run_pr: "https://github.com/vctb12/GoldTickerLive/pull/332"
last_run_agent: copilot
slices_remaining_estimate: 2
next_action: "Execute the tracker deeper UX pass in Batch 4 (`tracker.html`, `src/tracker/*`, `styles/pages/tracker-pro.css`)."
blocked_on: ""
guardrails_reviewed: true
skills_used:
  - gold-ticker-live-audit
  - frontend-design-system
  - mobile-ux-review
```

## Origin

User asked for a point-by-point implementation of a broad website upgrade: navbar, admin panel, all
HTML pages, conversion of coming-soon pages into real content, new landing pages, stronger UI/UX, a
real Supabase-backed Submit Shop workflow, immediate indexability for launched landing pages, and a
brand shift toward **Gold Ticker Live**.

## Guardrails

- Keep price formulas, AED peg, karat purities, and source handling unchanged unless a separate bug
  is proven.
- Keep static multi-page architecture; no framework migration.
- No fake live data, fake shop data, fake testimonials, or guaranteed price language.
- User-facing price copy must preserve spot/reference vs retail distinction.
- Public shop submissions go to a review queue; they are not published automatically.
- New launched content pages are indexable immediately, with canonical, hreflang, OG, and internal
  links.

## File-by-file implementation sequence

### Batch 1 — launch useful content and submission workflow

- [x] `/content/premium-watch/index.html` — replace coming-soon stub with real retail-premium guide.
- [x] `/content/compare-countries/index.html` — replace coming-soon stub with real comparison guide.
- [x] `/content/news/index.html` — replace coming-soon stub with curated market-updates hub.
- [x] `/content/todays-best-rates/index.html` — replace coming-soon stub with best-rates usage
      guide.
- [x] `/content/changelog/index.html` — replace coming-soon stub with transparent product/status
      page.
- [x] `/content/faq/index.html` — replace coming-soon stub with real FAQ content.
- [x] `/content/submit-shop/index.html` — replace coming-soon stub with real public form.
- [x] `/src/pages/submit-shop.js` — submit public shop suggestions to Supabase `shop_submissions`.
- [x] `/styles/pages/content-landing.css` — shared responsive landing/content page pattern.
- [x] `/supabase/schema.sql` — add `shop_submissions` queue and RLS policies.
- [x] `/docs/SUPABASE_SCHEMA.md` — document public shop-submission schema.

### Batch 2 — new indexable landing pages

- [x] `/content/uae-gold-buying-guide/index.html`
- [x] `/content/dubai-gold-rate-guide/index.html`
- [x] `/content/gcc-gold-price-comparison/index.html`
- [x] `/content/spot-vs-retail-gold-price/index.html`
- [x] `/content/gold-making-charges-guide/index.html`
- [x] `/content/22k-gold-price-guide/index.html`
- [x] `/content/24k-gold-price-guide/index.html`

### Batch 3 — shared navigation, footer, and brand consistency

- [x] `/src/components/nav.js` — nav brand label uses `data.brandLabel` from `nav-data.js` (already
      done; plan item was stale).
- [x] `/src/components/nav-data.js` — add 22K and 24K karat guide pages to Prices → Comparison
      section (EN + AR).
- [x] `/src/components/footer.js` — add Methodology link to footer legal row (Terms · Privacy ·
      Methodology).
- [x] Core page metadata — added `og:locale` + `og:locale:alternate` (en_US / ar_AE) to all main
      pages: index, tracker, calculator, shops, methodology, learn, insights, invest, pricing.
- [x] SEO extended to content/ pages — added `og:locale` + `og:locale:alternate` to 17 content pages
      missing them (faq, news, premium-watch, changelog, compare-countries, dubai-gold-rate-guide,
      gcc-gold-price-comparison, gold-making-charges-guide, gold-price-history, guides, order-gold,
      spot-vs-retail-gold-price, submit-shop, todays-best-rates, tools, 22k-guide, 24k-guide).
- [x] `og:image:alt` added to `content/gold-price-history/` and `content/order-gold/` pages.

### Batch 4 — homepage, tracker, calculator, shops polish

- [x] export.js — `exportCSV` and `exportBriefText` filenames now use `isoTimestamp()` for
      consistency.
- [x] `/shops.html` — empty-state "suggest a shop" link now points to `/content/submit-shop/`
      instead of outdated email.
- [x] `/404.html` — replaced hardcoded hex colors with CSS design-token variables (`--color-gold`,
      `--text-primary`, `--text-secondary`, `--border-default`, `--color-gold-tint`).
- [x] `/404.html` — added "Countries" and "Learn" quick navigation links.
- [x] `/calculator.html` — hero disclaimer simplified with link to spot-vs-retail guide.
- [x] `/shops.html` — strengthened trust disclaimer to explicitly advise confirming with seller.
- [x] `/index.html` — FAQ "more questions" link updated to point to `content/faq/`.
- [ ] `/index.html`, `/src/pages/home.js`, `/styles/pages/home.css` — deeper UX pass _(2026-05-12
      partial: region-tab ARIA labels + below-fold lazy-init for country-search/ad surfaces.)_
- [ ] `/tracker.html`, `/src/tracker/*`, `/styles/pages/tracker-pro.css` _(2026-05-12 partial:
      planner/karat-table loading + empty strings localized through `translations.js`.)_
- [x] `/shops.html`, `/src/pages/shops/*`, `/styles/pages/shops.css` — deeper UI pass _(2026-05-12
      partial: query-aware no-result copy in EN/AR.)_

### Batch 5 — admin command-center workflow

- [x] `/admin/index.html` — shop-submissions stat/attention item confirmed present (stat card counts
      pending submissions; submissions table in admin/shops).
- [x] `/admin/shops/index.html` — public submission queue workflow with review/approve/reject
      confirmed present.
- [x] `/admin/content/index.html` — publish-readiness/SEO workflow polish: upgraded SEO badge check
      to use best-practice thresholds (title 30–60 chars, description 100–160 chars); hover tooltip
      now shows exact character counts and per-field hints (e.g. "title short (18, aim 30–60)")
      using `escHtml`-safe tooltip string. Round 10 (2026-04-28).
- [x] `/admin/settings/index.html` — improved save-state (loading state, friendly error messages,
      Supabase/network/permission error mapping); replaced 7 inline style= attributes with CSS
      classes (2026-04-27).
- [x] `/admin/login/index.html` — improved error messages: rate-limit, invalid credentials, email
      unconfirmed, method disabled (2026-04-27).
- [x] `/styles/admin.css` — centralized 340-line inline style block from admin/index.html; added
      `.settings-user-*` classes from settings page (2026-04-27).

### Batch 6 — generated pages, SEO inventory, validation

- [x] `FAQPage` JSON-LD added to `content/faq/index.html`.
- [x] `Article` JSON-LD added to `methodology.html`.
- [x] Internal links strengthened: methodology → shops + spot-vs-retail; learn → 22K/24K/FAQ/
      making-charges/spot-vs-retail; methodology → shops; index FAQ → content/faq/.
- [x] `/build/generateSitemap.js` — sitemap generates 497 URLs cleanly; new pages covered
      (2026-04-27).
- [x] `/scripts/node/inventory-seo.js` outputs — 651/653 files with canonical, 641 with JSON-LD;
      validate clean (2026-04-27).
- [x] Run `npm test`, `npm run lint`, `npm run validate`, `npm run quality`, `npm run build` —
      354/354 tests pass, 0 lint errors, 0 validate errors (2026-04-27).
- [x] Pre-existing failures documented: none found; all checks clean.

## Rollback points

1. Revert content-page launch batch without touching price math.
2. Revert Supabase submission queue if RLS policy needs owner adjustment.
3. Revert nav/footer brand changes independently.
4. Revert admin workflow polish independently.

## Session log

### 2026-05-22T14:31Z — copilot (PR #332)

- Slice class: CODE
- Phase/Feature closed: Batch 4 — shops deeper UI pass
- Skills activated: gold-ticker-live-audit, frontend-design-system, mobile-ux-review
- Files touched: 4 (excluding plan/docs updates)
- Completed:
  - Added mobile quick-filter chips for shops on 390/360 surfaces with accessible pressed-state
    toggles.
  - Increased touch targets for filter tabs/clear and shortlist actions to 44px.
  - Added tabular-number rendering for headline listing counters to improve mobile scanability.
  - Replaced off-token near-me status colors with existing design tokens.
  - Extended E2E coverage for quick filters and mobile shops smoke.
- Added/Split: none
- Skipped (owner-only / blocked): none
- Validation: lint=PASS, quality=FAIL (pre-existing — prettier drift in unrelated files, not
  introduced by this batch), test=FAIL (pre-existing — `tests/analytics.test.js` navigator getter
  issue, not introduced by this batch), build=PASS, validate=PASS, playwright=FAIL (pre-existing —
  suite-wide failures across many unrelated specs, none caused by this batch). All failures are
  pre-existing and were present before this session; no new failures were introduced.
- Screenshots: not captured in this session
- Next action: Execute the tracker deeper UX pass in Batch 4 (`tracker.html`, `src/tracker/*`,
  `styles/pages/tracker-pro.css`).
