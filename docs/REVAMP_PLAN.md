# Gold-Prices Site Revamp — master plan

This is the active plan. It owns the homepage / nav / tracker revamp (§0–§18) and the consolidated
production tracks (§19–§28). New proposals are captured under [`docs/plans/`](./plans/); reconcile
them into the right section here before execution. Agent operating rules are in
[`AGENTS.md`](../AGENTS.md) — this file is the plan, not the charter.

**How to use this file**

- Open the section that matches your task; update its checklist in the same PR that ships the code.
- If a task doesn't fit any existing section, add a subsection rather than starting a parallel plan
  file.
- Keep completed items as `[x]` with enough context to serve as a record. Don't re-open closed items
  to pad status; don't invent new phases to look ambitious.

**Last updated:** 2026-04-30 (Round 16 — 404 page redesigned with live freshness pill, bilingual
EN/AR, search pre-fill, primary-intent card links, and analytics error logging; `_redirects`
extended with clean-URL aliases, country shorthands, and legacy guide slug redirects; `not-found.js`
fully rewritten; `translations.js` extended with `notfound.*` key family in both locales).

Previous: Round 15 — prefers-reduced-motion guards added to shops.css, calculator.css, invest.css,
tracker-pro.css; WCAG 2.5.5 touch target pass — all interactive elements raised to ≥44px across
global.css, shops.css, calculator.css, tracker-pro.css, invest.css; complete canonical token sweep
removing all legacy `--color-surface` / `--color-border-subtle` / `--color-text` /
`--color-text-muted` fallback overrides across home.css, shops.css, calculator.css, stub.css,
order.css, global.css).

### 2026-05-13 flagship UI/CX rewrite — Phase 1

- [x] Country gold-price pages: FAQPage + Dataset JSON-LD generated for all 18 country pages via
      inject-schema.js; Saudi Arabia Product schema priceCurrency corrected (AED→SAR); SEO inventory
      refreshed; all 410+ tests passing.
- [x] Global CSS: Added freshness-chip, price-unavailable, section-anchor-link, trust-note-inline,
      and info-box utility component classes.
- [x] Methodology page: Added "Before you visit a shop" info-box callout linking to spot-vs-retail
      guide and calculator.
- [x] Calculator: Added hero breakdown chips (what's included / excluded) for clearer upfront trust.
- [x] Tracker: Added spot-vs-retail secondary link in hero and tools sidebar.
- [x] Country FAQ headings improved: "Country page FAQ" → "Gold price questions & answers".
- [x] Homepage how-it-works section: Added spot-vs-retail link for better internal discovery.

### 2026-05-12 scoped execution slice (core public pages)

Scope for this cycle is intentionally constrained to top-level public website surfaces first (home,
tracker, calculator, shops, shared shell), with no admin expansion, no country/city bulk rewrites,
and no long-term roadmap/platform items.

- [x] Reconcile open tasks from this master plan + active proposal files into one core-first slice.
- [x] Homepage accessibility + clarity sub-slice: region-tab ARIA labels and below-fold lazy-init
      for heavy enhancements.
- [x] Tracker copy/localization sub-slice: remove remaining hardcoded English planner/empty strings
      and wire them to EN/AR translations.
- [x] Shops empty-state sub-slice: query-aware no-result messaging in both languages.
- [x] Calculator copy-button sub-slice: bilingual copied-state aria-label feedback on delegated copy
      buttons.
- [ ] Shared-shell follow-up items (if still needed after verification): nav/footer parity pass.
- [ ] Final cycle verification and checklist sync.

### 2026-04-27 full-site UX/admin/content revamp intake

This workstream tracks the user-requested broad upgrade to make Gold Ticker Live feel substantially
more complete: stronger navigation, real content instead of coming-soon pages, indexable landing
pages, public Supabase-backed shop submissions, admin workflow improvements, and broader Gold Ticker
Live brand consistency.

- [x] Plan captured in
      [`docs/plans/2026-04-27_full-site-ux-admin-revamp.md`](./plans/2026-04-27_full-site-ux-admin-revamp.md).
- [x] First content slice launched: premium watch, compare countries, news, best rates, changelog,
      FAQ, and submit-shop pages.
- [x] New indexable landing pages launched for UAE buying, Dubai rates, GCC comparison, spot vs
      retail, making charges, 22K, and 24K.
- [x] Supabase `shop_submissions` intake queue added for public shop suggestions pending admin
      review.
- [x] Phase 1 page-purpose map created: [`docs/revamp-page-map.md`](./revamp-page-map.md).
- [x] Shared nav/footer Gold Ticker Live brand and information architecture pass for the Phase 1
      journey labels.
- [x] SEO pass: `og:locale` + `og:locale:alternate` added to 17 content pages; `og:image:alt` added
      where missing; `FAQPage` JSON-LD added to `content/faq/`; `Article` JSON-LD added to
      `methodology.html`; CSS nav duplicate block removed; dark-mode nav icon hover fixed; spot-bar
      nav-hidden offset corrected; internal links strengthened across learn/methodology/calculator/
      shops/404.
- [x] Homepage/tracker/calculator/shops visible UX pass (partial, 2026-04-27): trust banner copy,
      social section inline-style removal, trust-banner aria-labelledby, tracker method mode
      deep-links + karat card, tracker alerts browser-only disclaimer, admin settings + login page
      UX polish.
- [x] Admin command-center and shop-submission review workflow pass (partial, 2026-04-27):
      admin/index.html 340-line inline `<style>` migrated to `styles/admin.css`; settings inline
      styles replaced with CSS classes; login error messages improved; settings save button state
      management improved.
- [x] Sitemap/SEO inventory refresh and full validation (2026-04-27): `npm run validate` clean, 497
      URLs in sitemap, 0 errors.
- [x] **404 page + redirects overhaul (2026-04-30, Round 16):**
  - `404.html` redesigned: friendly heading ("We couldn't find that page"), primary 4-intent card
    links (tracker / calculator / countries / search), secondary chip links, live reference-price
    pill (reads local cache, shows XAU/USD with freshness age), search input pre-filled with failing
    slug, bilingual EN/AR via `data-tx` attributes, `prefers-reduced-motion` guards, WCAG 2.5.5
    touch targets (min-height 44px).
  - `not-found.js` fully rewritten: language detection from `user_prefs` localStorage, DOM
    translation apply, slug pre-fill, freshness pill render, analytics `error { type:'404', where }`
    event, global `window.addEventListener('error')` for SPA render errors.
  - `translations.js` extended: `notfound.*` key family (heading, desc, search, nav labels, 4
    primary link title+desc, freshness label+via) in both EN and AR.
  - `_redirects` extended with: clean URL aliases for all top-level `.html` pages (tracker,
    calculator, shops, learn, methodology, insights, invest, pricing, privacy, terms, offline);
    ISO-2 and common country-code shorthands (`/uae`, `/ksa`, `/kw`, `/qa`, `/bh`, `/om`, `/eg`,
    `/jo`, `/lb`, `/tr`, `/pk`, `/in`) → canonical `/countries/<slug>/`; legacy guide slug aliases
    (`/faq`, `/search`, `/compare`, `/guides`, `/gold-history`, `/making-charges`,
    `/spot-vs-retail`, `/uae-guide`, `/dubai-guide`, `/22k`, `/24k`, `/best-rates`, `/news`,
    `/submit-shop`). No indexed canonical URLs are self-redirected; no redirect loops introduced.

| §      | Owns                                                       | Absorbed from                                                     |
| ------ | ---------------------------------------------------------- | ----------------------------------------------------------------- |
| §0     | Product context (mission, users, jobs, pillars)            | `product/PRD.md`                                                  |
| §0.1   | Trust guardrails (labels, required elements)               | `product/PHASE0_GUARDRAILS.md`                                    |
| §0.2   | Reusable trust copy snippets                               | `product/TRUST_SNIPPETS.md`                                       |
| §1–§18 | Homepage + nav + tracker revamp (current work)             | _native to this file_                                             |
| §19    | Decisions log                                              | `product/DECISIONS.md`                                            |
| §20    | Project memory                                             | `product/MEMORY.md`                                               |
| §21    | Rollout governance (release waves, merge gate)             | `product/ROLLOUT_GOVERNANCE.md`                                   |
| §22    | Production-revamp tracks (30-phase, post-homepage)         | `REVAMP_STATUS.md`                                                |
| §23    | Historical execution summary (20-phase)                    | `REVAMP_EXECUTION_SUMMARY.md`                                     |
| §24    | Product roadmap (monetization, newsletter, portfolio, API) | `ROADMAP_IMPLEMENTATION.md`                                       |
| §25    | Known issues, risks, open items                            | `issues-found.md` + `risks.md` + `pr-audit.md` + `LIMITATIONS.md` |
| §26    | Codebase architecture snapshot                             | `codebase-audit.md`                                               |
| §27    | Historical execution log                                   | `execution-log.md`                                                |
| §28    | Task backlog                                               | `product/TASKS.md`                                                |

---

---

## 0. Product context

_Absorbs `docs/product/PRD.md`._

### Product

Gold-Prices website — a bilingual (EN/AR), multi-page, mostly-static site with live data, tools,
country/city/market pages, educational content, and a shops directory.

### Mission

Help users quickly and confidently understand gold prices, historical movement, market context, and
where/how to buy.

### Primary users

- Retail users checking today's prices
- Users comparing countries / cities / karats
- Users looking for gold shops / markets
- Users researching gold buying and pricing
- SEO users landing on country / city / guide pages

### Core jobs to be done

- See the current gold price clearly
- Compare karats and currencies
- Browse historical data with confidence
- Find relevant local market / shop information
- Understand the difference between spot and retail pricing
- Use calculators and educational pages without confusion

### Product pillars

1. Trust and clarity
2. Speed
3. Mobile-first UX
4. SEO depth
5. Clean information architecture

### Core sections

- Homepage
- Tracker / historical prices
- Country pages
- City pages
- Markets / famous gold souks
- Shops directory
- Calculators
- Learn / methodology / guides

### Product non-negotiables

- Label estimated, fallback, and derived values clearly
- Preserve internal linking between pages
- No fake "live" claims without support
- No weak SEO duplication
- No misleading store verification

---

## 0.1 Trust guardrails

_Absorbs `docs/product/PHASE0_GUARDRAILS.md`. These are non-negotiable product rules for trust
language that must land before any broad visual or UX change._

### Purpose

Keep the site explicit about what prices represent and what they do **not** represent. Applies to
all pages that show prices, rates, listings, or market comparisons.

### Core trust rules

1. **Always separate reference prices from retail outcomes.**
   - Use "spot-linked reference estimate" for computed values.
   - Never label computed values as "shop price" unless sourced from a real store feed.
2. **Always label data freshness and source layer.**
   - Every critical price surface must indicate one of: `Live`, `Cached`, `Fallback`,
     `Derived estimate`.
3. **Always expose timing context.**
   - Show timestamp / age where possible (e.g., "Updated 3 min ago").
   - If stale, show "Delayed" or "Stale" state explicitly.
4. **Never imply store verification without evidence.**
   - For market clusters or area listings, use wording such as "Market-area listing" or "Directory
     reference profile".
5. **Always include user next-step guidance.**
   - On shops / listings surfaces, include: "Confirm final prices, making charges, and VAT directly
     with seller."

### Global label taxonomy

Canonical labels to use across UI:

- `Spot/reference estimate`
- `Retail price (from seller)`
- `Live data`
- `Cached data`
- `Fallback value`
- `Derived value`
- `Last reviewed`
- `Methodology`

Avoid ambiguous terms: "accurate retail now", "verified price" (unless provenance is explicit),
"official market price" (unless the source is named).

### Required trust elements by page type

**Tracker pages** must include:

- source-layer label (live / cached / fallback)
- methodology link
- spot-vs-retail distinction
- timestamp or age indicator

**Shops directory and listing detail modal** must include:

- listing-type clarity (store vs market area)
- details availability badge (full / partial / limited)
- "confirm directly with seller" disclaimer
- last-reviewed date for directory content

**Country / city / market guide pages** must include:

- clear separation between benchmark prices and local retail variability
- links to methodology and relevant tracker / shops pages

### Copy pattern rules

- Short, explicit sentences over marketing-heavy claims.
- Prefer "estimate", "reference", "indicative", "derived" where applicable.
- Keep disclaimers informative and actionable.
- Avoid fear language and avoid overconfidence claims.

### PR review checklist (Phase 0 gate)

For any PR touching pricing / listing UI, reviewers must confirm:

- [ ] Spot/reference vs retail is explicit on the changed surface.
- [ ] Live / cached / fallback / derived status is visible where relevant.
- [ ] Timestamp or recency context is present or intentionally not applicable.
- [ ] Trust disclaimer is present and not vague.
- [ ] Methodology link remains discoverable.
- [ ] No wording implies verification without supporting data.

If any item fails, the PR must not be marked complete.

---

## 0.2 Reusable trust copy snippets

_Absorbs `docs/product/TRUST_SNIPPETS.md`. Use these as defaults for banners, cards, and modals.
Adapt wording to context without changing meaning._

| Id  | Use                            | Copy                                                                                                         |
| --- | ------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| A   | Spot/reference estimate banner | "These are spot-linked reference estimates, not final retail jewelry prices."                                |
| B   | Retail variance helper         | "Final shop prices can include making charges, premiums, and local taxes."                                   |
| C1  | Source-layer badge — live      | "Live source"                                                                                                |
| C2  | Source-layer badge — cached    | "Cached value"                                                                                               |
| C3  | Source-layer badge — fallback  | "Fallback value"                                                                                             |
| C4  | Source-layer badge — derived   | "Derived estimate"                                                                                           |
| D   | Shops directory disclaimer     | "Directory listings may represent market areas or dealer clusters unless direct business details are shown." |
| E   | Seller-confirmation CTA        | "Before purchasing, confirm final price, making charges, and tax directly with the seller."                  |
| F   | Freshness label                | "Last reviewed: {date}"                                                                                      |
| G   | Staleness label                | "Data may be delayed. Check timestamp before relying on this value."                                         |
| H   | Method transparency link text  | "See methodology and data sources"                                                                           |

### Usage notes

- Keep one primary trust sentence near the top of each critical page.
- Do not stack multiple long disclaimers above the fold.
- For mobile, prefer concise labels + expandable detail text.

---

## 0.3 Engineering notes specific to the revamp

General engineering conventions (tokens, DOM safety, motion, RTL, priority order) live in
[`AGENTS.md`](../AGENTS.md) — not repeated here. Revamp-specific notes:

- Canonical tokens for this work resolve in `styles/global.css` under `--color-*`, `--surface-*`,
  `--space-*`, `--text-*`, `--radius-*`, `--shadow-*`, `--ease-*`, `--duration-*`, `--weight-*`,
  `--leading-*`. Don't introduce bespoke scales alongside them.
- Treat each track (A–J) as a reversible unit. Keep commits focused per concern (tokens / layout /
  motion / a11y / …) so bisection stays cheap, but don't split mechanically into trivial commits
  when one cohesive change is clearer.

## 1. Shipping order

Cycle tracks **A → B → C → D → E → F → G → H → I → J** across rounds. No target commit count; ship
what the next round of work honestly produces.

---

## 3. Status at a glance

| Track                          | Status         | Notes                                                                |
| ------------------------------ | -------------- | -------------------------------------------------------------------- |
| **A** Cross-cutting foundation | 🟢 **shipped** | tokens, motion primitives, surface utilities, reveal.js, count-up.js |
| **B** Navigation rebuild       | ⚪ not started | —                                                                    |
| **C** Homepage revamp          | 🟡 in progress | sections opted into `[data-reveal]`; karat strip uses `countUp`      |
| **D** Tracker continuation     | 🟡 in progress | reveal.js imported; wire + brief sections opted in                   |
| **E** Motion & liveness layer  | 🟡 in progress | primitives live; most application sites still pending                |
| **F** Mobile & tablet pass     | ⚪ not started | —                                                                    |
| **G** Accessibility pass       | ⚪ not started | —                                                                    |
| **H** SEO & metadata pass      | ⚪ not started | —                                                                    |
| **I** Perf & cleanup           | ⚪ not started | —                                                                    |
| **J** Final QA                 | ⚪ not started | continuous `npm test` / `validate` checks passing                    |

Legend: 🟢 shipped · 🟡 in progress · ⚪ not started · 🔴 blocked

---

## 4. Track A — Cross-cutting foundation

Goal: unify the system every other track leans on. Each bullet = 1–2 commits.

- [x] **Motion primitives** in `styles/global.css`: `[data-reveal]` reveal-up, `flash-up`,
      `flash-down`, `pulse-dot`, `underline-slide`, `drawer-slide-in`, `reveal-up`, plus a global
      `prefers-reduced-motion: reduce` reset. (commit `788feb14`)
- [x] **Surface utility classes** `.surface-elevated` / `.surface-subtle` / `.surface-accent` /
      `.surface-glass` consumed by nav/home/tracker. (`0d2c40c8`)
- [x] **Spacing rhythm tokens** `--rhythm-inline` / `--rhythm-block` / `--rhythm-section` /
      `--rhythm-section-lg`, plus `--surface-glass` token (light + dark). (`ab3f8dc3`)
- [x] **`IntersectionObserver` primitive** `src/lib/reveal.js` — one shared observer, `WeakSet`
      dedup, auto-runs on DOMContentLoaded, IO-missing fallback reveals immediately. (`82b8d77c`)
- [x] **`count-up` primitive** `src/lib/count-up.js` — rAF easeOutQuad, duration magnitude-capped
      180–800 ms, auto directional `data-flash`, reduced-motion no-op, robust numeric parse.
      (`0b03c603`, `0a3c7591`)
- [x] **Token audit.** Inventoried per-prefix: `--tp-*` in `styles/pages/tracker-pro.css` is already
      fully aliased to canonical site tokens (`--surface-*`, `--border-*`, `--text-*`,
      `--color-gold*`, `--color-live*`, `--color-error*`, `--color-fixed*`, `--shadow-*`,
      `--radius-*`); `--home-*`, `--nav-*`, and `--shops-*` color palettes do not exist (only a
      single `--nav-height` sizing token in `styles/global.css`). `--invest-*` in
      `styles/pages/invest.css` is an intentional dark-premium page identity that differs from the
      canonical dark mode on purpose — not drift. `styles/critical.css` intentionally inlines
      fallback hex for `--tp-bg` / `--tp-text` / `--tp-accent` so above-the-fold paint doesn't
      depend on the deferred global-token sheet.
- [x] **Canonical card consolidation.** _Audit (2026-04-28, Round 11):_ no `.section-card` or
      `.panel` rules exist anywhere in `styles/global.css` or `styles/pages/*.css`. The canonical
      `.card` + `.card--elevated` + `.card--accent` + `.card--compact` set in
      [`styles/global.css`](../styles/global.css) lines 519-550 is the only card primitive in the
      tree. Page-specific surfaces (e.g. `.hero-live-card`, `.gcc-card`, `.tool-card`,
      `.market-card`, `.shops-card`) are intentional component-level cards that compose canonical
      tokens (`--surface-*`, `--border-*`, `--radius-card`, `--shadow-*`); they do not duplicate
      `.card`. Closing this item; future page-level surfaces should compose tokens or extend
      `.card`, not introduce new primitives.
- [x] **Heading scale confirmation.** Token + utility-class + base-element baseline confirmed across
      slices 1, 2a, 2b. Slice 3 (per-page selector cleanup) remains as its own ongoing track, not a
      blocker for this confirmation. _Audit (2026-04-23, prior to Slice 2a):_ base ad-hoc sizes.
      _Audit (2026-04-23, prior to Slice 2a):_ base `h1`..`h6` element selectors are not styled in
      `styles/global.css`. Every page hand-sizes headings via bespoke selectors (~40 sites, e.g.
      `.tracker-hero-copy h1`, `.pricing-hero-content h1`, `.legal-hero h1`, `.method-section h2`,
      `.learn-section h3`). Token gaps: no display-tier sizes (`--text-4xl` / `--text-5xl`) for hero
      headings, and the `--text-*` scale in `styles/global.css` drifts from the one documented in
      [`docs/DESIGN_TOKENS.md`](DESIGN_TOKENS.md) (e.g. `--text-3xl` is `1.875rem` in code but
      `2.25rem` in docs). Split into four sequenced slices: - [x] **Slice 1 (tokens).** Added
      `--text-4xl: 2.25rem` / `--text-5xl: 3rem` display-tier tokens to `styles/global.css`;
      reconciled `docs/DESIGN_TOKENS.md` to match the implemented body scale (doc→code — the shipped
      tight 17–20 px body scale is intentional for dense price-data UI). - [x] **Slice 2a
      (typography — utility classes).** Added `.h1`…`.h6` utility classes plus a `.display-1` opt-in
      class in `styles/global.css`. Purely additive — no base `h1..h6` element rules, no existing
      selectors touched. New markup should prefer these classes. - [x] **Slice 2b (typography — base
      element baseline, 2026-04-27).** Added `h1`–`h6` element rules to `styles/global.css` as
      low-specificity fallbacks. The ~40 bespoke page-level selectors (`.tracker-hero-copy h1`,
      etc.) continue to dominate by specificity — no regression. - [ ] **Slice 3 (cleanup).**
      Migrate per-page hand-sized heading selectors to the canonical classes, one page per commit.
      (Partial — Round 9: 10 `tracker-pro.css` heading selectors migrated to dual `.element/.h{N}`
      form in `6e63e1f`. Round 13: `home-section-sub` and `section-link` in `home.css` migrated from
      raw `0.88/0.86rem` to `var(--text-sm)`. Remaining: major heading selectors in home.css,
      shops.css, other pages.)
- [x] **Focus ring token audit.** Canonical `:focus-visible` baseline in `styles/global.css` uses
      `--focus-ring-width` / `--focus-ring-color` / `--focus-ring-offset`. Page-level outline
      overrides normalized to the same tokens: `.calc-tab`, `.tracker-mode-tab`,
      `.shops-control--checkbox input[type='checkbox']`, `.shops-filter-toggle`, and `.btn`.
      `.methodology-link` relies on the baseline (no override). _Follow-up (separate concern, not
      this audit):_ sites that intentionally suppress `outline` in favor of a custom box-shadow or
      color-only cue — `.karat-pill`, `.shops-chip`, `.shops-clear-btn`, `.modal-close-cta`,
      `.stub-cta`, `.stub-related-link` — need a dedicated a11y review to decide whether the
      alternative ring is visible enough.

## 5. Track B — Navigation rebuild

> **Progress note (Track B data + dropdown enrichment pass):** B.1 data model, B.4 dropdown row
> anatomy (icon + label + description + primary emphasis + layout hint), B.5 command-palette
> shortcuts (`/`, `Ctrl/Cmd+K`) + recent-searches + safe-DOM result rendering, B.6 details-based
> mobile drawer groups, and B.10 dark-mode-aware nav tokens are shipped in this branch. The
> `src/components/nav.js` unsafe-DOM baseline tightened from 5 → 2 sinks.
>
> **Progress note (Track B polish pass):** B.2 scrolled-state elevation, B.3 animated underline
> slide under group triggers (reduced-motion aware), B.4 split 180 ms open / 120 ms close panel
> timings, B.6 drawer `100svh` fallback + bottom-cluster slot, B.7 scroll hide/reveal with
> `data-nav-hidden` + rAF throttling (suspended while dropdown/drawer open, reduced-motion, or near
> top), and B.8 theme-toggle icon rotate per mode are shipped in the same branch. Full Playwright
> a11y sweep remains deferred.

### B.1 IA & data shape

- [x] Keep 5-group IA (Home · Prices · Tools · Learn · More, solo Shops) but **split "More"** — move
      high-value items up where possible. Audit for ambiguity.
- [x] Enforce `description` on every group child in `nav-data.js`; trim labels for parallelism;
      ensure bilingual pairs. _(tests/nav-data.test.js now enforces EN/AR parity + non-empty
      description on every item)_
- [x] Tag **primary destinations** (Tracker, Calculator, Shops, Countries) vs **secondary** (Learn
      articles) so the UI can emphasize them. _(primary flag parity enforced in tests)_

### B.2 Desktop shell

- [x] Sticky top bar, glass surface (`backdrop-filter: blur`, `--surface-glass`), bottom hairline
      `--border-default`. _(`.site-nav[data-scrolled='true']` elevates shadow + border tint; base
      blur already in place)_
- [x] Left: brand lockup. Center: group links. Right: utility cluster (search trigger · language ·
      theme · CTA "Live Tracker"). _(shipped in `nav.js` `injectNav()`: `.nav-brand` left,
      `.nav-links` center, `.nav-actions` right with `#nav-search-btn` · `#nav-theme-toggle` ·
      `#nav-lang-toggle` · `#nav-cta-tracker` "Live Tracker" CTA.)_
- [x] Group links as buttons opening dropdown on hover **and** click/Enter/Space/Down. Touch users
      get click (no hover trap). _(shipped; hover handled via CSS `:hover .nav-dropdown-panel`)_
- [x] 44 px minimum tap targets; visible `:focus-visible` rings using `--focus-ring`. _(applied to
      `.nav-icon-btn`, `.nav-dropdown-item`, `.nav-search-*`)_

### B.3 Active state

- [x] On page load, compute current URL → find matching group + sub-item; add `aria-current="page"`
      to the item and `data-active="true"` to its parent group. _(data-active now set by
      `buildDropdown`)_
- [x] Animated underline that slides between groups on hover/focus, snaps to active on mouseleave.
      Disabled under reduced motion. _(`.nav-link::after` / `.nav-dropdown-btn::after` scaleX
      transition; gated by `prefers-reduced-motion`)_

### B.4 Dropdown panels

- [x] Two-column layout for Prices + Tools, one-column for Learn + More. _(data-driven via
      `group.layout` hint + `.nav-dropdown-panel-items[data-layout]` CSS grid)_
- [x] Each item: label + one-line description from `nav-data.js`, optional leading icon. _(rendered
      as `nav-dropdown-item-icon` + `nav-dropdown-item-body`)_
- [x] Open: fade + translate-Y 4 px, 180 ms `--ease-out`. Close: 120 ms. Reduced-motion: instant.
      _(split transitions on `.nav-dropdown-panel` vs `.nav-dropdown.is-open .nav-dropdown-panel`)_
- [x] First item receives focus on open. `Escape` closes and returns focus to trigger.
      `ArrowUp`/`ArrowDown` cycle. `Tab` exits. _(already wired in
      `navEl.querySelectorAll('.nav-dropdown-panel')` keydown handlers)_

### B.5 Command-palette search

- [x] Progressive enhancement: `<a href="/content/search/">Search</a>` is the fallback. _(still
      present in Tools group)_
- [x] JS-enhanced overlay triggered by search icon, `/`, or `Ctrl/Cmd+K`. _(`/` and `Ctrl/Cmd+K`
      listeners added in `initNavSearch`; ignored while focus is in an
      input/textarea/contentEditable)_
- [x] Queries page titles + country/city/market slugs + tool names via `src/lib/search.js`. _(via
      the existing `src/search/searchEngine.js` lazy import)_
- [x] Keyboard-first: arrow keys, Enter, Esc. Results grouped (Pages · Countries · Markets · Tools).
      _(grouping now keyed on `result.type`)_
- [x] Recent searches in `localStorage` namespaced `nav.search.recent`, capped. _(cap 8, shown when
      the overlay opens with an empty query)_

### B.6 Mobile drawer

- [x] Slide-in from inline-end, full-height using `100svh` with `100vh` fallback. _(`100dvh` base +
      `@supports (height: 100svh)` override)_
- [x] Sections with group headings, dividers, large tap targets. Expandable groups (`<details>` or
      custom with `aria-expanded`), not a flat stack. _(now uses native `<details>/<summary>` with
      caret chevron)_
- [x] Top: search input (progressive enhancement). Bottom: theme toggle + language switcher +
      primary CTA. _(bottom-cluster CSS slot `.nav-drawer-bottom` shipped; markup rewired in
      `nav.js` to wrap both a new `#nav-theme-toggle-drawer` and `#nav-lang-toggle-mobile` in the
      `.nav-drawer-bottom` cluster; `_applyTheme()` syncs both buttons; `_cycleTheme()` shared.
      Round 9.)_
- [x] `body` scroll lock while open. Close on: Escape, backdrop tap, route change.
- [x] Focus trap inside drawer. Return focus to hamburger on close.

### B.7 Scroll behavior

- [x] Hide on scroll down (> 6 px delta, after 64 px), reveal on scroll up. Throttled via
      `requestAnimationFrame`. Disabled under reduced motion. Suspended while drawer open or an open
      dropdown is present. _(`_initNavScrollBehavior` in `nav.js`; `data-nav-hidden` on `.site-nav`
      translates the shell offscreen)_

### B.8 Micro-interactions

- [x] Underline slide on hover, group fade+slide on open, theme-toggle icon cycle (auto → light →
      dark, rotate 180 ms). _(theme icon rotates to a distinct angle per mode via
      `[data-theme-mode]` attribute selectors; rotation disabled under reduced motion)_
- [x] Active-dropdown chevron flip. _(caret rotation gated by `prefers-reduced-motion`)_

### B.9 Touch behavior

- [x] No hover-only dropdowns on touch. First tap opens, tap outside closes. Tap on active trigger
      closes. _(click-to-toggle on `.nav-dropdown-btn`; outside click listener on document)_

### B.10 Dark-mode parity

- [x] All nav surfaces resolved via `--surface-*` and `--color-text-*`. Manual sweep only if token
      misuse found. _(new nav CSS block in `styles/global.css` uses tokens with safe fallbacks;
      dark-mode overrides for search overlay shipped)_

## 6. Track C — Homepage revamp

### C.1 IA & section order (first-scroll priority)

Target order:

1. Hero — live spot + freshness + trust + 2 CTAs.
2. Karat reference strip — live per-karat prices, unit toggle, copy.
3. Trust band — methodology / sources / estimated vs live legend.
4. Tools strip — Tracker · Calculator · Converter · Zakat · Alerts · Order.
5. Countries quick-picker — flag grid, searchable inline.
6. Markets highlights — top 3–6 markets with freshness.
7. Explainer strip — scannable bullets.
8. FAQ — condensed, reveal-on-scroll.
9. Social strip — minimal.
10. Deep-link footer rail.

- [x] Dedup the overlapping "Live Gold Prices" (`gcc-section-title`) and "Karat strip" sections into
      one clearer live-price journey: hero spot card → karat reference rail → country reference
      grid.

### C.2 Hero rebuild

- [x] Headline + subhead + primary CTA "Open Live Tracker" + secondary "Open Calculator".
- [x] Inline live XAU/USD (large), delta vs prev close, 24 h high/low display (H:/L: from
      `max/min(goldPrice, dayOpenPrice)`), freshness pill (1-second age display with amber/red color
      shift via `data-freshness-key`), market-open/closed chip, trust line. (Round 9 — `daf150a`)
- [x] Mobile: stacks vertically, price block prominent, CTAs full-width.
- [ ] Canonical hero surface + gold inset ring; no bespoke gradients.

### C.3 Karat reference strip

- [x] Per-karat cards (24K, 22K, 21K, 18K, 14K): gram price, unit toggle (g / tola / oz),
      copy-to-clipboard. (Round 8 — unit toggle + copy buttons shipped with bilingual labels)
- [x] **Count-up on update.** Directional flash (green up / red down). (home only, via `countUp` —
      `14d365cc`)
- [x] Skeleton shimmer on first load.
- [x] Clear "reference only" framing on the strip header.

### C.4 Country quick-picker

- [x] Flag grid deep-linking to country pages. Inline searchable (filters as you type). Keyboard
      navigable. — `#country-search` input + `initCountrySearch()` in `home.js`; ArrowDown/Up/
      Escape keyboard nav; bilingual placeholder and empty-state wired into `applyLangToPage()`.
      CSS: `.country-search-input`, `.country-tile--filtered`, `.country-search-empty`.
      `role="list"` on tiles wrap; `aria-hidden="true"` on flag emoji; `aria-live="polite"` on empty
      state. (_Round 10_)
- [x] Cached/stale state clearly labeled.

### C.5 Tools strip

- [x] Primary tools weighted larger: `tool-card--primary` variant on Tracker + Calculator cards —
      gold-tinted background, larger icon, gold star indicator, RTL-mirrored. (_Round 10_)

### C.6 Trust band

- [x] Methodology link. Data-source list. AED peg note. "Estimated vs live" legend. Links to
      `methodology.html`. _(methodology/data-source placement shipped on home; the `about.html`
      sub-link is **deferred** — the file does not yet exist on the site, so linking would 404.
      Tracked as an open question in §16; will re-link from the trust band once `about.html` is
      authored. Closing the parent C.6 item in Round 11 because the data-source / AED peg /
      methodology surface is live and complete.)_

### C.7 Markets highlights

- [x] 3–6 top markets as cards with freshness + "reference price" framing. Deep-links to market
      pages. (Round 8 — Dubai, Riyadh, Kuwait, Cairo cards with bilingual copy, responsive 4→2→1
      grid, focus rings, `home-section--markets` with `data-reveal`)

### C.8 Explainer strip

- [x] Scannable bullets, not paragraphs. Reveal-on-scroll.

### C.9 FAQ

- [x] Tight copy, each item collapsible via `<details>`/custom with `aria-expanded`.
      One-open-at-a-time optional. (Round 8 — one-open-at-a-time via `toggle` event listener; focus
      ring added for keyboard access)

### C.10 Social + footer rail

- [x] Minimal social; footer rail provides deep-links without duplicating nav. _(shared
      [`src/components/footer.js`](../src/components/footer.js) renders 5-column deep-link rail
      sourced from `NAV_DATA.groups` capped at `MAX_FOOTER_LINKS_PER_SECTION = 3` per section, plus
      a brand column with bilingual tagline + badges; social-strip on home is reveal-on-scroll
      `[data-reveal]` and minimal. No duplicate nav rendering — footer items are derived from the
      same `nav-data.js` source so groups stay parallel.)_

### C.11 Liveness

- [x] **Section reveal-on-scroll** on trust-strip, trust-banner, tools, countries-quick, explainer,
      FAQ, social via `[data-reveal]`. (`e19aae33`)
- [x] Hero + karat cards count-up on update (duration proportional to delta, capped). (karat strip
      done · hero count-up via `renderHeroCard` flash ✓)
- [x] Freshness pill re-computes exact age every **10 seconds** (down from 30 s; 1s was revised to
      10s for battery/CPU balance on mobile); color shifts amber for `cached`/`stale` states (with
      `⚠ ` icon prefix for color-blind users), dark-amber for `unavailable` state (with `✕ ` prefix)
      via `data-freshness-key` attribute + CSS pseudo-elements. (`daf150a` + review-fix Round 9)
- [x] Gentle hero-backdrop parallax (transform-only). Reduced-motion bypass. _(shipped Round 11 via
      `home.js` ~L836-859: rAF-throttled `scroll` listener writes `--hero-parallax-y` as a
      `transform: translateY()` on `.hero::before` only, capped at hero-height; the listener is not
      installed when `prefers-reduced-motion: reduce` matches, and `styles/pages/home.css`
      additionally hard-resets `transform: none !important` under the same media query as
      defense-in-depth.)_

### C.12 Content density & rhythm

- [x] Consistent `--rhythm-section` block padding on `.home-section`; `overflow-x: hidden` to
      prevent child bleed; `@media (width ≤ 360px)` block for `hero-inner`, `hero-live-card`,
      `tools-grid`, `markets-grid`, `karat-strip-inner` single-column and scrollable strip.
      (`daf150a` Round 9)
- [x] Cap body width to `--content-max-width`. _(canonical `.container` utility in
      [`styles/global.css`](../styles/global.css) L510-514 caps inline width to
      `var(--content-max-width)` with `--page-gutter` inline padding; `.hero-inner` uses an explicit
      1200 px cap; home/tracker section wrappers use `.container` or page-scoped max-width tokens.
      Closing this sub-bullet in Round 11; no remaining un-capped prose sections found on
      home/tracker/calculator/methodology.)_
- [ ] Rebalance H1/H2/H3 scale using canonical tokens. Remove dead space + low-signal filler.
      _(tracked alongside Track A "Heading scale" Slice 3; per-page selector cleanup happens one
      page per commit.)_

## 7. Track D — Tracker continuation

Resume the 15-phase tracker plan in small commits:

- [x] **Phase 2** — Trust & freshness framing (exact-age pill, AED-peg note, stale/cached/fallback
      labeling with icon + tooltip). _(working tree: tracker hero, live desk summary, market/watch
      cards, and shared shell freshness now read from the same live timestamp; touched render paths
      switched to `safe-dom` helpers.)_
- [ ] **Phase 3** — Single sticky control bar
      (currency/karat/unit/compare/range/auto-refresh/language).
- [ ] **Phase 4** — Hero rebuild (large price, delta vs prev close, high/low, 24 h change,
      sparkline). Mobile-safe at 320 px.
- [ ] **Phase 5** — Chart UX (snap-to-point tooltip, per-range source labels, main-vs-compare
      legend, empty/error/stale states).
- [ ] **Phase 6** — Karat table (sticky header, `scope` attrs, bilingual labels, tap-to-copy per
      row).
- [ ] **Phase 7** — Markets grid (filter/sort/view correctness, empty states, per-country freshness,
      reference-price framing).
- [ ] **Phase 8** — Alerts/presets/planners as tabbed cards with real add/edit/delete affordances.
      Disabled-not-broken.
- [x] **Phase 9** — Wire + archive: `aria-live="polite" aria-atomic="false"` added to
      `<tbody id="tp-karat-table">` so screen readers announce price row updates. (`6e63e1f`
      Round 9)
- [x] **Phase 12** — Replace remaining `innerHTML` sinks in `src/tracker/render.js` with
      `safe-dom.js` helpers. All planner, seasonal, and SVG chart sinks migrated to `el()` /
      `replaceChildren()` / `createElementNS()`. Baseline tightened from 10 → 0. (`2fe030d`
      2026-04-27)
- [ ] **Phase 13** — Split 2,541-line `tracker-pro.css` into per-section files or prune dead rules.
      `IntersectionObserver`-gated rendering of below-fold sections.
- [x] Side-effect import of shared `reveal.js` from `src/pages/tracker-pro.js`. (`39138e7e`)
- [x] Wire + brief sections opted into `[data-reveal]`. (`1e484954`)

## 8. Track E — Motion & liveness layer

Applied on top of primitives from Track A. Rules:

- Every effect must have a **purpose**: feedback, continuity, or attention — never decorative.
- Every effect has a **reduced-motion path** that no-ops.

- [x] Price-change directional flash (green up, red down, 1 s fade). Primitive live; applied on
      karat strip. Pending on hero + tracker hero + market cards.
- [x] Number animations: count-up duration ∝ magnitude, capped 800 ms. Primitive live.
- [x] Section reveal: fade + translate-Y 8 px, 300 ms, single shared observer.
- [x] Card hover: translate-Y 2 px + shadow-up, 200 ms `--ease-out`. _(canonical `.hover-lift`
      utility in [`styles/global.css`](../styles/global.css) Motion Primitives block; opt-in,
      reduced-motion no-op.)_
- [ ] Skeletons on every async surface.
- [x] Dropdown open: fade + slide 4 px, 180 ms. _(applied on `.nav-dropdown-panel` in
      [`styles/global.css`](../styles/global.css) — `translateY(-4px) → 0`, 0.18 s
      `cubic-bezier(0.4, 0, 0.2, 1)`.)_
- [x] Drawer slide in 220 ms. _(applied on `.nav-drawer` in
      [`styles/global.css`](../styles/global.css) — `translateX(100%) → 0`, 0.22 s
      `cubic-bezier(0.4, 0, 0.2, 1)`, visibility paired.)_
- [x] Freshness pill pulse once per tick, capped 1 per 90 s. _(primitive
      [`styles/global.css`](../styles/global.css) `@keyframes freshness-pulse` +
      `[data-freshness-pulse]` attribute; throttled helper
      [`src/lib/freshness-pulse.js`](../src/lib/freshness-pulse.js) — `pulseFreshness(el)` enforces
      90 s per-element cap, auto-clears attr after 600 ms, reduced-motion no-op. Tests:
      [`tests/freshness-pulse.test.js`](../tests/freshness-pulse.test.js).)_
- [ ] Hero parallax: transform-only on inner backdrop layer only.

## 9. Track F — Mobile & tablet

- [x] 320–480 px no horizontal overflow on home/tracker/nav: `overflow-x: hidden` on
      `.home-section`; `@media (width ≤ 360px)` block forces single-column on `hero-inner`,
      `tools-grid`, `markets-grid`, `karat-strip-inner`; `karat-strip-prices` scrollable. (`daf150a`
      Round 9)
- [x] 481–640 px phone-landscape spacing: `home.css` 481–640 px query keeps hero CTAs in row layout
      where there's horizontal room. `@supports (padding-bottom: env(safe-area-inset-bottom))` block
      clears hero CTAs from iPhone home indicator. (`a1f1b6b` Round 13)
- [ ] 481–700 px phone-landscape & small-tablet spacing compression rules instead of premature
      desktop layout (remaining: section-level gaps, karat strip, tracker controls).
- [ ] 700–1024 px tablet layout — no awkward scaling, no oversized gaps, no premature column drops.
- [x] Sticky controls with safe-area insets (`env(safe-area-inset-*)`): hero CTA block gets
      `padding-bottom: max(0px, env(safe-area-inset-bottom))` via `@supports` guard at `≤ 640px`.
      (`a1f1b6b` Round 13)- [ ] Tap targets ≥ 44 × 44 px across nav, drawer, CTA, cards.
- [ ] Chart pinch/pan sane on tracker.
- [ ] Drawer `100svh` with `100vh` fallback (iOS Safari-safe).
- [ ] Freshness pills, CTAs, and pickers legible at smallest breakpoint.

## 10. Track G — Accessibility

- [x] `:focus-visible` rings on `.faq-item summary`, `.country-tile`, `.tool-card`, `.market-card`,
      `.kstrip-copy-btn`, `.kstrip-unit-btn` (Round 8). Added `.gcc-card` + `.gcc-copy-btn` (Round
      9, `daf150a`).
- [ ] Keyboard nav on groups, dropdowns, range pills, tabs, command palette.
- [x] `aria-live="polite"` on live price cells: karat strip has
      `aria-live="polite" aria-atomic="false"`; tracker karat table `<tbody>` has
      `aria-live="polite" aria-atomic="false"` (Round 9 `6e63e1f`).
- [ ] `aria-current="page"` on active nav item + group.
- [x] `aria-label` on icon-only buttons; `aria-expanded`/`aria-controls` on toggles (ongoing — major
      pass done in earlier rounds; mob drawer theme button includes label).
- [ ] Semantic HTML: `nav`, `main`, `section[aria-labelledby]`, one `h1` per page.
- [ ] Contrast audit light + dark, EN + AR.
- [ ] Touch-without-hover fallback for every hover-dependent UI.
- [ ] `role="dialog"` + focus trap on drawer + palette.

## 11. Track H — SEO & metadata

> **Audit input (2026-04-25):** [`reports/seo-audit.md`](../reports/seo-audit.md) — site-wide audit
> produced by the multi-track quality program
> ([`docs/plans/2026-04-25_multi-track-quality.md`](./plans/2026-04-25_multi-track-quality.md),
> Track 2 Wave A). 100% presence on `<title>` / meta-desc / canonical / `og:*` / `twitter:*` /
> hreflang / JSON-LD. Three Wave B fix PRs identified: (B-1) title-length trim on 394 long titles +
> 13 long descriptions + Tripoli disambiguation; (B-2) `FAQPage` / `WebApplication` schema +
> `Product`-vs-trust-label alignment + `check-jsonld-dom.js` validator; (B-3)
> `og:locale[:alternate]` capture + `og:url === canonical` cross-check + `og:image` dimension check.

- [ ] Unique `<title>` + `<meta name="description">` preserved on every page touched.
- [ ] Canonical `https://goldtickerlive.com/...` (apex, no www, no trailing slash inconsistencies).
- [x] Structured data reflects each page's real purpose:
  - Home: `WebSite` + `SearchAction` + `BreadcrumbList` + `Organization`. ✅ (was already present)
  - Tracker: `WebApplication`. ✅ Added `tracker.html` (`2fe030d` 2026-04-27)
  - Calculator: `WebApplication`. ✅ Added `calculator.html` (`2fe030d` 2026-04-27)
  - Country gold-price pages: `BreadcrumbList` + `Product` (correct local `priceCurrency`) +
    `FAQPage` + `Dataset`. ✅ (`inject-schema.js` extended; all 20 country pages re-injected,
    2026-05-13)
  - No `Product` schema on non-product pages.
- [ ] Internal linking: home ↔ tracker, calculator, shops, top country pages. Tracker ↔ calculator,
      methodology, country pages, shops.
- [ ] `sitemap.xml` correctness preserved; existing sitewide canonical test must still pass.

## 12. Track I — Perf & cleanup

- [ ] Measure initial JS + CSS for tracker and home before/after.
- [ ] Split oversized CSS files or prune dead rules (`tracker-pro.css` at 2,541 lines).
- [ ] `IntersectionObserver`-gated rendering for below-fold sections (tracker wire + archive, home
      FAQ + social + explainer).
- [ ] `loading="lazy"` + `decoding="async"` on non-critical images.
- [x] Preconnect to data origins — `open.er-api.com` preconnect+dns-prefetch added to `tracker.html`
      and `calculator.html` (`2fe030d` 2026-04-27). Google Fonts already in both.
- [ ] Verify `sw.js` still caches revamped assets correctly.
- [ ] Remove duplicate inline styles once systemized into classes.

## 13. Track J — Final QA

Before marking the PR ready for review:

- [ ] `npm test` — all suites pass (requires `JWT_SECRET`, `ADMIN_PASSWORD`, `ADMIN_ACCESS_PIN`).
      Latest: **410 / 410 pass** (2026-05-13, `revamp/mobile-ui-cx-hotfix-pass` branch).
- [ ] `npm run validate` — HTML + imports + DOM-sink check green; baseline tightened where sinks
      were removed. Latest: **0 errors**.
- [ ] `npm run quality` — ESLint + Prettier + Stylelint green.
- [ ] `npm run build` — Vite production build succeeds; bundle sizes reported in PR body.
- [ ] Visual screenshot diff on desktop + mobile, light + dark, EN + AR for hero, nav, drawer, karat
      strip, tools strip.
- [ ] PR body lists: what was verified, what wasn't (Lighthouse needs deploy), known risks, known
      remaining scope.

### 13.1 Per-PR verification checklist

_Absorbs `docs/product/VERIFICATION.md`. Use this before merging any PR that affects user-facing
pages._

#### Functional checks

- [ ] Primary buttons / CTAs work on target pages.
- [ ] Filters / search / sort controls update results correctly.
- [ ] Deep links and query-parameter state restore as expected.
- [ ] Local state persistence (where used) behaves correctly after refresh.
- [ ] Modal / dialog behaviour works with click, Escape, and focus flow.

#### UX and accessibility checks

- [ ] Mobile layout verified at narrow width (≥ 360 px).
- [ ] Empty / loading / error states are visible and understandable.
- [ ] Keyboard tab order is usable and skip-link path is valid.
- [ ] Focus indicators are visible on interactive controls.
- [ ] Contrast and readable hierarchy are acceptable for core flows.

#### SEO and metadata checks

- [ ] Unique `<title>` and `<meta name="description">` on changed pages.
- [ ] Canonical URL is present and points to the intended final URL.
- [ ] Open Graph + Twitter metadata are present and aligned.
- [ ] Internal links resolve from actual file depth (no broken relatives).
- [ ] Structured data (if present) matches page reality.
- [ ] Sitemap / robots impact reviewed when adding new indexable pages.

#### Trust and product clarity checks

- [ ] Spot / reference values are clearly distinguished from retail / jewelry pricing.
- [ ] Estimated / derived / cached / fallback states are labelled where relevant.
- [ ] Freshness / review-date labels are visible and not misleading.
- [ ] Shops / market listings do not overstate verification status.
- [ ] Methodology / disclaimer links remain discoverable.

#### Performance and resilience checks

- [ ] `npm run build` passes.
- [ ] Service-worker changes validated for cache version and fallback behaviour.
- [ ] No accidental broad asset / cache growth from query-param caching.

#### Final report format (required)

Every implementation update must explicitly separate:

1. **What was verified**
2. **What was not verified**
3. **Remaining risks**

Do not claim "fixed" unless the relevant checks were actually run.

---

## 14. Explicit non-goals

- **No** SPA conversion. No client-side router.
- **No** chart-library swap.
- **No** CSS/JS framework introduction (no Tailwind, React, Vue, Alpine).
- **No** rewrite of `server.js` or the admin backend.
- **No** new third-party runtime dependencies unless specifically justified (advisory-DB consulted
  first).
- **No** re-opening of already-completed work unless a regression is found.
- **No** mass content rewrites outside the sections listed here.

## 15. Reversibility & risk management

- Every commit is narrow, so `git revert <sha>` undoes exactly that concern.
- The PR can land in stages if reviewers prefer chunked review.
- Visual regressions caught via screenshot-diff in Track J; structural regressions via tests.
- Any new dependency or new DOM-sink pattern triggers a hard stop and re-evaluation.

## 16. Open questions (carry forward until answered)

1. Should the nav search be shipped in this PR or deferred (adds meaningful JS)? **Default:** ship
   behind progressive enhancement.
2. Should the homepage drop any existing sections entirely (e.g., social strip) or just
   de-emphasize? **Default:** keep all, re-rank + tighten.
3. Are bilingual strings for all new homepage copy expected in this PR or a follow-up? **Default:**
   English now, stub Arabic for follow-up.
4. Is the tracker sticky control bar OK to ship if it changes the visual identity of the page
   materially? **Default:** ship it.
5. Should an `about.html` page be authored so the C.6 Trust band can deep-link to a "team /
   editorial standards / publishing policy" page, or is the methodology + footer surface sufficient
   on its own? **Default until decided:** do **not** add an `about.html` link from the Trust band —
   a link to a non-existent page would 404 and undermine trust. Re-link from Trust band when the
   page is authored.

---

## 17. Progress log (append-only)

Append one row per commit on the revamp branch. Keep commit SHA short (8 chars). When a PR merges,
update the "Last updated" banner at the top of the file and copy the merged commits into the
"Merged" section below.

### Round 1 — Track A foundation + Track C/D reveal wiring (in-branch, pending merge)

| SHA        | Bucket    | Summary                                                     |
| ---------- | --------- | ----------------------------------------------------------- |
| `ab3f8dc3` | `tokens`  | Add `--surface-glass` and `--rhythm-*` scale                |
| `788feb14` | `motion`  | Reveal/flash/pulse/drawer primitives + reduced-motion reset |
| `0d2c40c8` | `surface` | `.surface-elevated/subtle/accent/glass` utility classes     |
| `82b8d77c` | `wiring`  | `src/lib/reveal.js` shared `IntersectionObserver`           |
| `0b03c603` | `wiring`  | `src/lib/count-up.js` numeric count-up primitive            |
| `e19aae33` | `motion`  | Opt home sections into `[data-reveal]` reveal-on-scroll     |
| `14d365cc` | `wiring`  | Count-up + directional flash on karat strip prices          |
| `39138e7e` | `wiring`  | Tracker imports shared `reveal.js`                          |
| `1e484954` | `motion`  | Opt tracker wire + brief sections into `[data-reveal]`      |
| `0a3c7591` | `wiring`  | count-up: robust numeric parse + named `FLASH_DURATION_MS`  |

### Round 2 — Track A focus-ring audit + follow-ups (in-branch, pending merge)

| SHA       | Bucket    | Summary                                                                                                        |
| --------- | --------- | -------------------------------------------------------------------------------------------------------------- |
| _pending_ | `cleanup` | Remove duplicate `:focus-visible` in `global.css` that shadowed the token-based baseline with hardcoded values |

### Round 3 — Tracker trust & freshness framing (working tree, pending commit)

| SHA       | Bucket  | Summary                                                                                        |
| --------- | ------- | ---------------------------------------------------------------------------------------------- |
| _pending_ | `trust` | Finish tracker Phase 2 trust/freshness framing and reduce touched `innerHTML` sinks in tracker |

### Round 4 — §22b 30-phase tracker/home/admin revamp (this PR)

| SHA       | Bucket   | Summary                                                                                                                                                                                                                                                  |
| --------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| _pending_ | `plan`   | Reconcile 30-phase plan into `REVAMP_PLAN.md` §22b and `docs/plans/README.md` matrix                                                                                                                                                                     |
| _pending_ | `phase1` | Phase 1 baseline snapshots: `reports/baseline-{tracker,home,admin}.json` (sink counts, LOC, CSS size)                                                                                                                                                    |
| _pending_ | `phase7` | Phase 7 tracker URL-hash contract: `docs/tracker-state.md` + `tests/tracker-hash.test.js` round-trip tests                                                                                                                                               |
| _pending_ | `phase4` | Phase 4 (homepage slice) — dedupe `src/pages/home.js` `getMarketStatus` → shared `src/lib/live-status.js`; add equivalence guard test over a full week of samples                                                                                        |
| _pending_ | `phase2` | Phase 2 closed — design-token completeness audit at `reports/token-audit.md`: tracker 100 % aliased, homepage consumes canonical directly, admin retains intentionally divergent dark-theme palette (rationale documented per token). Net promotable: 0. |

### Round 5 — 20-phase tracker redesign supplement (this PR)

_Reconciles the 20-phase tracker redesign
(`tracker landing page, full redesign, refactor, restructure, revamp, debug`) as a superset of §22b
Phases 6–14. Execution phases land in the order below; high-risk phases get their own scoped PRs
(see §22b "specific risks"). Supersedes the earlier proposal row "30-phase tracker / homepage /
admin revamp" for the tracker-only subset._

| SHA        | Bucket    | Summary                                                                                                                                                                                                                                           |
| ---------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| _pending_  | `phase1`  | 20-phase Phase 1 — UX audit deliverable at [`reports/tracker-ux-audit.md`](../reports/tracker-ux-audit.md); per-mode defect log drives Phases 5–15.                                                                                               |
| _pending_  | `phase2`  | 20-phase Phase 2 — IA + mode ordering frozen in [`docs/tracker-state.md`](./tracker-state.md) § "IA & mode ordering".                                                                                                                             |
| _pending_  | `phase3`  | 20-phase Phase 3 — shared-primitive adoption map at [`reports/tracker-primitive-map.md`](../reports/tracker-primitive-map.md); drives Phases 4, 6, 9, 16, 18.                                                                                     |
| _pending_  | `phase7`  | 20-phase Phase 7 — tab registry extracted into [`src/tracker/modes.js`](../src/tracker/modes.js); `ui-shell.js` consumes it for overlays + keyboard shortcuts. Contract tests in [`tests/tracker-modes.test.js`](../tests/tracker-modes.test.js). |
| _pending_  | `phase6`  | 20-phase Phase 6 (partial) — welcome strip inner opts into `[data-reveal]`; full first-visit-only rework deferred to follow-up PR.                                                                                                                |
| _deferred_ | `phase5`  | 20-phase Phase 5 (hero rebuild) — own PR; LCP-critical, visual-diff screenshots required.                                                                                                                                                         |
| _deferred_ | `phase11` | 20-phase Phase 11 (archive rewrite) — own PR; biggest `innerHTML` reduction; behaviour-diff tests required.                                                                                                                                       |
| _deferred_ | `phase14` | 20-phase Phase 14 / §22b Phase 14 (CSS split) — own PR; highest visual-regression risk.                                                                                                                                                           |
| _deferred_ | `phase19` | 20-phase Phase 19 (lazy-mount) — own PR; Playwright deep-link smoke test per mode required.                                                                                                                                                       |

### Round 6 — 20-item low-risk multi-batch rollout · 2026-04-27 (this PR)

_Cross-cuts three pending proposals (`2026-04-25_codebase-analysis.md`,
`2026-04-25_multi-track-quality.md`, `2026-04-27_full-site-ux-admin-revamp.md`) with a
non-architectural slice that does not touch price math, dependencies, or canonical URLs. See PR
description for the full sequencing._

| SHA       | Bucket | Summary                                                                                                                                                                                                                                                            |
| --------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| _pending_ | `plan` | Group D · Reconcile §17 (this row) and §29 statuses + flag W-2/W-6/W-9/W-10/W-11/W-12/W-14 as "Resolved (2026-04-27)" in `docs/plans/2026-04-25_codebase-analysis.md`                                                                                              |
| `85f904c` | `weak` | Group A · W-2 (`STALE_AFTER_MS` 10 → 12 min + cron-comment fix), W-6 (karat-cards inline → `.ph-karat-card`), W-9 (sitemap-parity guard test), W-10 (lowdb refs out), W-11 (drop `uuid`), W-12 (analytics IDs in `EDIT_GUIDE`), W-14 (sw-coverage script + report) |
| `ad2108e` | `docs` | Group B · README quickstart refresh, CONTRIBUTING ↔ AGENTS.md alignment, `src/lib/` comment audit (clean), `reports/env-audit.md`, `reports/internal-linking.md`, `reports/ux-friction.md`                                                                         |
| `2e813ae` | `seo`  | Group C · 130 over-length meta descriptions tightened (template + existing pages), `og:locale` / `og:locale:alternate` on `privacy.html` + `terms.html`, error-state copy softened in EN+AR                                                                        |

**Verification (Round 6):** `npm test` (354 ✓), `npm run validate` (incl. new sitemap-parity +
sw-coverage gates ✓), `npx prettier --write` on touched files. Pre-existing `npm run style` failures
(53 `rgb`/`rgba` style errors in unrelated CSS) carried forward; not caused by this slice.

### Round 8 — 20-task heavy/medium improvement batch · 2026-04-28 (this PR)

_Focuses on homepage UX polish, tracker bilingual improvements, freshness system upgrade, and
accessibility. Draws from §22b Track C (homepage plan) and the freshness/trust backlog._

| SHA       | Bucket      | Summary                                                                                                                                                                                                                                 |
| --------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ca3eb59` | `home`      | C.3 karat strip: unit toggle (g / tola / oz) + copy-to-clipboard buttons. Bilingual labels. State persisted in `user_prefs` localStorage. 320 px mobile overflow fix.                                                                   |
| `ca3eb59` | `home`      | C.7 markets highlights: 4-card grid (Dubai, Riyadh, Kuwait, Cairo). Bilingual copy in 29 new translation keys. Responsive 4→2→1 grid. Focus rings. `data-reveal` scroll-in.                                                             |
| `ca3eb59` | `home`      | C.9 FAQ: one-open-at-a-time via `toggle` event delegation. Focus ring on `summary:focus-visible`.                                                                                                                                       |
| `ca3eb59` | `freshness` | §22b Phase 4: `home.js` `getFreshnessMeta()` now wraps `getLiveFreshness()`; shows `ageText` ("2 min. ago") instead of raw timestamp. `startFreshnessTimer()` ticks "Updated X min ago" labels every 30 s. Removed from `KNOWN_GAPS`.   |
| `ca3eb59` | `tracker`   | §22b Phase 6 (partial): `renderAll()` updates `document.title` with live XAU/USD price. Market badge carries explicit `aria-label` (EN+AR). Welcome strip `_localizeWelcomeStrip()` via safe `el()`/`replaceChildren()` — no innerHTML. |
| `ca3eb59` | `a11y`      | Focus rings: `.faq-item summary`, `.country-tile`, `.tool-card`, `.market-card`, `.kstrip-copy-btn`, `.kstrip-unit-btn`.                                                                                                                |
| `ca3eb59` | `trust`     | Calculator: added `methodology.html` internal link next to "Spot vs retail explained". Shops: improved trust disclaimer copy including making charges + methodology link.                                                               |
| `ca3eb59` | `tests`     | `tests/home-translations.test.js` — 4 new tests covering 36 new translation keys (EN/AR parity, karat label distinctness, market key coverage, `{karat}` placeholder).                                                                  |
| `ca3eb59` | `docs`      | `REVAMP_PLAN.md` C.3/C.7/C.9/Phase4/Phase6 marked done; Round 8 log added.                                                                                                                                                              |

**Verification (Round 8):** `npm test` (370 ✓, +4 new), `npm run validate` (0 errors, baseline
unchanged), `npm run lint` clean, `npm run build` ✓.

### Round 9 — 20-task heavy/medium improvement batch · 2026-04-28 (this PR)

_Focuses on: freshness 1s ticking + color shift, hero high/low, mobile overflow fix, focus ring
audit, mobile nav drawer bottom cluster, tracker aria-live, heading Slice 3 canonical classes, admin
inline styles → CSS, admin pricing estimate disclaimer, admin content SEO column, shops trust +
mobile pass, RTL chrome parity verification (+ `applyStaticText` bug fix), and new test coverage
(freshness coverage, language toggle E2E, tracker flow E2E)._

| SHA       | Bucket      | Summary                                                                                                                                                                                                                                                                             |
| --------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `daf150a` | `freshness` | C.11: `getFreshnessMeta()` returns `key`; `startFreshnessTimer()` ticks every 1 s (was 30 s) and sets `data-freshness-key` on `#hlc-updated` + `#karat-strip-updated`. CSS amber/red color shift.                                                                                   |
| `daf150a` | `home`      | C.2: `renderHeroCard()` populates `#hlc-high-low` with H:/L: from `max/min(goldPrice, dayOpenPrice)`; hidden when no data.                                                                                                                                                          |
| `daf150a` | `home`      | C.12 (partial): `.home-section` uses `var(--rhythm-section, 3.5rem)` block padding + `overflow-x: hidden`. `@media (width ≤ 360px)` block for single-column hero/tools/markets and scrollable karat strip.                                                                          |
| `daf150a` | `a11y`      | Track G: `:focus-visible` on `.gcc-card` + `.gcc-copy-btn` with canonical `--focus-ring-*` tokens.                                                                                                                                                                                  |
| `6e63e1f` | `nav`       | B.6: `nav-drawer-inner` now wraps `#nav-theme-toggle-drawer` + `#nav-lang-toggle-mobile` in `.nav-drawer-bottom`; `_cycleTheme()` shared; `_applyTheme()` syncs both buttons.                                                                                                       |
| `6e63e1f` | `tracker`   | Phase 9: `<tbody id="tp-karat-table">` gains `aria-live="polite" aria-atomic="false"` for screen-reader announcements on price row updates.                                                                                                                                         |
| `6e63e1f` | `tokens`    | Track A Heading Slice 3: 10 tracker-pro.css heading selectors migrated to dual `.element/.h{N}` form (`.tracker-hero-copy h1`, `.tracker-side-block h2`, panel/subpanel/method/onboarding/tips/overlay/help headings).                                                              |
| `8a78de2` | `tests`     | W-5 freshness coverage: `tests/freshness-coverage.test.js` (6 static-analysis assertions verifying surfaces use `getLiveFreshness` primitive). E2E lang-toggle: `tests/e2e/lang-toggle.spec.js` (4 Playwright tests).                                                               |
| `8a78de2` | `tests`     | E2E tracker flow: `tests/e2e/tracker-flow.spec.js` (7 Playwright tests: landmarks, 5 mode tabs, live panel, compare/method tab clicks, methodology links, XAU/USD element).                                                                                                         |
| `d975fa6` | `admin`     | Phase 24: inline styles from `admin/index.html` + `admin/pricing/index.html` moved to CSS classes in `styles/admin.css` (`.admin-flex-row`, `.admin-meta-dim`, `.admin-table-empty`, `.admin-mt-14/16`, `.admin-action-row`).                                                       |
| `d975fa6` | `admin`     | Phase 26: "Estimate-only" disclaimer (`<p class="admin-estimate-note">`) added to Override Price form in `admin/pricing/index.html`; styled with amber warning palette.                                                                                                             |
| `d975fa6` | `admin`     | Batch 5: SEO readiness ✓/⚠/✗ badge column added to each post card in `admin/content/index.html` `renderPostsList()`; checks `title.length > 10` + `excerpt.length > 50`.                                                                                                            |
| `d975fa6` | `shops`     | T17: shops loading overlay (`shops-grid--upgrading` CSS pulse), mobile `overflow-wrap: break-word`, stronger 4-point trust disclaimer, empty-state visual polish.                                                                                                                   |
| `2c27a44` | `rtl`       | T18: RTL chrome parity verified (nav-drawer `inset-inline-end`, footer `direction: rtl`, ← arrows in AR translations ✓). Bug fix: `applyStaticText()` used `.textContent` which destroyed `<a href="methodology.html">` child — fixed with `replaceChildren(textNode, methodLink)`. |

**Verification (Round 9):** `npm test` (376 ✓), `npm run validate` (0 errors), `npm run lint` clean,
`npm run build` ✓ (2.15 s).

### Round 12 — Shops trust copy, hover a11y, next-step bilingual, calculator links, E2E expansion · 2026-04-28

_Works pending tasks from `2026-04-27_full-site-ux-admin-revamp.md` Batch 4 (shops/home/calculator
deeper pass), `reports/internal-linking.md`, and multi-track quality Track 3.2 / Track G._

| SHA       | Bucket  | Summary                                                                                                                                                                                                                                                      |
| --------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| _pending_ | `ux`    | `shops.js` — `freshnessSemantics` rewritten to user-friendly copy in both EN and AR; `priceDisclaimer` reinstated with "always confirm" sentence (was missing from JS version); spot-vs-retail link added alongside methodology link in rendered disclaimer. |
| _pending_ | `html`  | `shops.html` — static fallback text for `#shops-freshness-semantics` and `#shops-price-disclaimer` updated to match new JS copy; `#shops-nearme-title` emoji wrapped in `aria-hidden="true"` for accessible heading fallback.                                |
| _pending_ | `html`  | `calculator.html` — "Related tools" section expanded: 22K Guide, 24K Guide, and Spot vs Retail cards added (3 → 6 cards). Addresses `reports/internal-linking.md` `calculator.html` weak-hub finding.                                                        |
| _pending_ | `i18n`  | `index.html` — translation IDs added to "next-step" guide-cards section (14 elements across 4 cards + section header/sub).                                                                                                                                   |
| _pending_ | `i18n`  | `src/config/translations.js` — 14 EN + 14 AR keys added for `home.nextStep*` and `home.next{Uae,Dubai,Gcc,Svr}*` (section title/sub, 4×3 card title/desc/cta).                                                                                               |
| _pending_ | `i18n`  | `src/pages/home.js` `applyLangToPage()` — 14 new `setTextById()` calls for the next-step section.                                                                                                                                                            |
| _pending_ | `tests` | `tests/home-translations.test.js` — 14 new keys added to `REQUIRED_KEYS` (EN/AR parity enforced).                                                                                                                                                            |
| _pending_ | `css`   | `styles/global.css` — `.hover-lift:hover` wrapped in `@media (hover: hover)` (Track G touch-without-hover); `:focus-visible` kept always-active; `.card--elevated:hover` transform guard; `.ticker-track:hover` animation-pause guard.                       |
| _pending_ | `tests` | `tests/e2e/shops-search.spec.js` — 4 new test cases added (trust disclaimer copy, search input interaction, country filter interaction, methodology+spot-vs-retail links present).                                                                           |
| _pending_ | `docs`  | `REVAMP_PLAN.md` last-updated bumped to Round 12; §22 Phase 15 + §22b Batch 4 shops/home/calc pending items noted.                                                                                                                                           |

**Verification (Round 12):** `npm test` (379 ✓), `npm run lint` clean, `npm run validate` (0
errors), `npm run build` ✓ (2.21 s).

### Round 13 — Content date fix, a11y table scope, 404 autofocus, mobile CSS, token cleanup, methodology clarity · 2026-04-28

_Small batch of safe cross-page improvements: stale date removed from featured article, table
accessibility hardened, 404 page keyboard-focus fixed, hero CTAs cleared from iPhone notch,
`home-section-sub` and `section-link` migrated to canonical tokens (Slice 3 partial), and the
two-tier gold-data polling model made explicit in the Methodology page._

| SHA       | Bucket    | Summary                                                                                                                                                                                     |
| --------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `a1f1b6b` | `content` | `insights.html`: article date "March 2026" → "April 2026" in `<time datetime="2026-04">`; `og:type` corrected from `website` to `article`.                                                  |
| `a1f1b6b` | `a11y`    | `learn.html`: `scope="col"` on all `<th>` column headers in karat and fineness tables; first-column karat/fineness cells promoted to `<th scope="row">`.                                    |
| `a1f1b6b` | `a11y`    | `404.html`: `autofocus` on search input; `aria-label` on `<form>` and submit button.                                                                                                        |
| `a1f1b6b` | `css`     | `home.css`: `@supports (padding-bottom: env(safe-area-inset-bottom))` block for hero CTAs; 481–640 px phone-landscape query keeps row layout.                                               |
| `a1f1b6b` | `tokens`  | `home.css`: `.home-section-sub` and `.section-link` migrated from raw `0.88/0.86rem` to `var(--text-sm)` (Track A Slice 3 partial).                                                         |
| `a1f1b6b` | `trust`   | `methodology.html`: source card frequency clarified to "Server-side refresh: every 6 minutes · Client re-poll: every 90 s"; Update Frequency paragraph explains the two-tier polling model. |

**Verification (Round 13):** `npm test` (379 ✓), `npm run lint` clean, `npm run validate` (SEO
inventory regenerated, 0 errors), `npm run build` ✓; all 5 modified files pass `prettier --check`;
CodeQL + Code Review passed with no issues.

### Round 15 — Sitewide UI/UX revamp: prefers-reduced-motion guards, canonical token sweep, WCAG 2.5.5 touch targets · 2026-04-30

_Three-bucket improvement pass: accessibility motion guards across all page-level CSS, complete
canonical design-token sweep removing legacy fallback overrides, and WCAG 2.5.5 touch-target
compliance across every interactive element sitewide._

| Bucket   | Files                                                                            | Summary                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| -------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `a11y`   | `shops.css`, `calculator.css`, `invest.css`, `tracker-pro.css`                   | Added explicit `animation: none` guards inside `@media (prefers-reduced-motion: reduce)` for: shops-trust-icon pulse-glow, shops modal entry, shops-grid upgrading-pulse, calculator badge-dot pulse, invest-skeleton shimmer, tracker-pro tp-marquee ticker, tracker-skeleton shimmer, tracker-toast entry. Supplements existing global `*` rule with proper per-class fallback states.                                                                                                                                                                                                                                                                        |
| `a11y`   | `global.css`, `shops.css`, `calculator.css`, `tracker-pro.css`, `invest.css`     | WCAG 2.5.5 touch target pass — raised all interactive elements to ≥44px: `fav-btn` (36→44), `btn-sm` (34→44), `tool-chip` (40→44), `nav-dropdown-btn`/`nav-link` (42→44), `modal-close-cta` (40→44), `modal-action-btn` (40→44), `calc-preset-chip` (32→44), `tracker-workspace-badge` (36→44), `tracker-pill` (34→44), `tracker-chip` (38→44), `tracker-market-links`/`tracker-icon-btn` (36→44), `tracker-region-pill` (34→44), `tracker-mode-tab` (40→44), `tracker-field` select/input (42→44), `tp-control-select` (42→44), `tracker-wire-refresh`/`pause` (36→44), `invest-mini-chip` (38→44), `invest-compare-tag` (34→44), `invest-guide-pill` (34→44). |
| `tokens` | `home.css`, `shops.css`, `calculator.css`, `stub.css`, `order.css`, `global.css` | Complete canonical token sweep — removed all remaining `var(--color-surface, #fff)`, `var(--color-text-muted, #6b7280)`, `var(--color-text, #1a1a1a)`, `var(--color-border-subtle, rgb())`, `var(--color-gold-light, #e5c96e)` legacy fallback overrides; replaced with canonical `--surface-primary`, `--surface-secondary`, `--border-subtle`, `--text-primary`, `--text-secondary`, `--color-gold-light` tokens. Skeleton shimmer in home.css also switched from `--color-border-subtle` legacy to `--border-subtle`.                                                                                                                                        |

**Verification (Round 15):** `npm test` (379/379 pass), `npm run lint` (clean), `npm run style`
(clean), `npm run validate` (0 errors, 0 warnings), `npm run build` (clean, 2.21 s); Code Review +
CodeQL passed with no findings.

### Round 14 — Sitewide UI/UX revamp: surface tokens, touch targets, deprecated CSS, RTL, critical.css · 2026-04-28

_Focused batch addressing real dark-mode surface token bugs, WCAG touch-target violations,
deprecated CSS, explainer-strip token misuse, hover inconsistency, RTL coverage gaps, and page-load
FOUC prevention across five secondary pages._

| Bucket    | Summary                                                                                                                                                                                                              |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tokens`  | `home.css`: `.kstrip-unit-btn` and `.market-card` backgrounds fixed from undefined `--surface-base`/`--surface-card` fallbacks → `--surface-primary`. Ensures correct dark-mode surface on both elements.            |
| `tokens`  | `home.css`: `.home-explainer-strip` padding and border tokens corrected (`--surface-secondary`, `--border-subtle`, `var(--space-6)`, `var(--space-5)`). Titles/descriptions use `--text-primary`/`--text-secondary`. |
| `tokens`  | `home.css`: `.markets-note` uses `--text-tertiary` (was undefined `--color-text-subtle`).                                                                                                                            |
| `a11y`    | `home.css`: `.kstrip-unit-btn` and `.hfb-dismiss` gain `min-height: 44px; min-width: 44px` to meet WCAG 2.5.5.                                                                                                       |
| `a11y`    | `shops.css`: `.shops-guide-chip` gains `min-height: 44px`.                                                                                                                                                           |
| `a11y`    | `index.html`: stale `aria-label="Loading price update time"` removed from `#hlc-updated` (was overriding the live `textContent` for screen readers in the `aria-live` region).                                       |
| `css`     | `home.css`: `.market-card:hover` adds `transform: translateY(-4px)` + gold box-shadow to match `gcc-card` / `tool-card` hover; `@media (prefers-reduced-motion: reduce)` guard added.                                |
| `css`     | `home.css`: Removed redundant `[dir='rtl'] .market-card-cta { direction: rtl; }` that could cause layout issues.                                                                                                     |
| `css`     | `home.css`, `global.css`, `tracker-pro.css`, `calculator.css`, `learn.css`, `country-page.css`: all `–webkit-overflow-scrolling: touch` declarations removed (deprecated, no-op in modern browsers).                 |
| `rtl`     | `home.css`: Added `[dir='rtl']` overrides for `.trust-banner-box` and `.explainer-strip-item` (flex-direction row-reverse); text-align right for explainer title/desc.                                               |
| `content` | `src/config/translations.js`: `home.karatStripCta` capitalised to "Full Tracker →" for consistency with `home.trackerLink`.                                                                                          |
| `perf`    | `calculator.html`, `learn.html`, `insights.html`, `methodology.html`, `invest.html`: `critical.css` preload + link added to prevent FOUC (matching pattern used on `index.html`, `tracker.html`, `shops.html`).      |
| `ux`      | `index.html`: trust-banner icon changed from `⚠️` to `ℹ️` — informative tone, not alarming.                                                                                                                          |

**Verification (Round 14):** `npm test` (379 ✓), `npm run lint` clean, `npm run validate` (0
errors), `npm run build` ✓; all changed files pass `prettier --check`. Pre-existing Prettier
warnings (13 files, unchanged) not introduced by this round.

### Round 11 — Status reconciliation + small-batch wins · 2026-04-28

_Reconciles `REVAMP_PLAN.md` §4 / §5 / §6 status against actual code state shipped in PR #218 (the
merge base on this branch), then layers a small batch of audit-confirmed micro-improvements. The
problem-statement called out a list of items that were in fact already shipped; Round 11 closes them
out so the plan does not lie about its own state._

| SHA       | Bucket | Summary                                                                                                                                                                                                                                                                                                 |
| --------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| _pending_ | `docs` | §4 closed: **Canonical card consolidation** (no `.section-card` / `.panel` rules in tree; `.card` + `.card--accent` + `.card--compact` + `.card--elevated` is the only primitive). **Heading scale confirmation** parent-level closed (slices 1/2a/2b shipped; Slice 3 stays as its own ongoing track). |
| _pending_ | `docs` | §5 closed: **B.2 desktop shell** brand-left / links-center / utility-cluster (search · theme · lang · "Live Tracker" CTA) confirmed shipped in `nav.js` `injectNav()`.                                                                                                                                  |
| _pending_ | `docs` | §6 closed: **C.2** market-open chip + freshness pill + trust line confirmed; **C.6** trust-band parent (about.html sub-link deferred → §16 open question 5); **C.10** social + footer rail; **C.11** hero parallax (transform-only, reduced-motion bypass); **C.12** `--content-max-width` cap.         |
| _pending_ | `docs` | §16 open question 5 added — `about.html` linking decision; defaults to **do not link** until the page is authored to avoid 404 from the Trust band.                                                                                                                                                     |

**Verification (Round 11):** `npm test` (377 ✓), `npm run lint` clean, `npm run validate` (0
errors). Documentation-only update — no shipped code or markup changed.

### Round 10 — Homepage UX + admin SEO workflow batch · 2026-04-28

_Track C.4 (country quick-picker search), Track C.5 (tools strip primary emphasis), Track F (tablet
breakpoints 700px + 560px), Track A Slice 3 (heading selector dual form in home.css), admin content
SEO workflow polish, and E2E homepage test expansion._

| SHA       | Bucket  | Summary                                                                                                                                                                                                                                                                                                                                              |
| --------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| _pending_ | `ux`    | C.4: `#country-search` input + `initCountrySearch()` in `home.js`; ArrowDown/Up/Escape keyboard nav; bilingual placeholder + empty-state via `applyLangToPage()`; `role="list"` on tiles wrap; `aria-hidden="true"` on emoji; `aria-live="polite"` on empty state. CSS: `.country-search-input`, `.country-tile--filtered`, `.country-search-empty`. |
| _pending_ | `ux`    | C.5: `tool-card--primary` class on Tracker + Calculator links in `index.html`; `.tool-card--primary` CSS variant (gold-tinted bg, larger icon, star badge RTL-mirrored).                                                                                                                                                                             |
| _pending_ | `css`   | Track F: `@media (width <= 700px)` + `@media (width <= 560px)` inserted in `home.css` for tablet and phone-landscape surfaces; `.country-search-input { max-width: 100% }`, `.markets-grid` 2-col, tighter section padding.                                                                                                                          |
| _pending_ | `a11y`  | Track A Slice 3: `.trust-banner-content h3, .trust-banner-content .h3` dual-form selector in `home.css` (mirrors Round 9 tracker-pro.css pattern).                                                                                                                                                                                                   |
| _pending_ | `admin` | Admin content SEO workflow: upgraded SEO check thresholds to best-practice ranges (title 30–60, description 100–160); hover tooltip now shows exact char counts + hints per field; `escHtml`-safe tooltip string.                                                                                                                                    |
| _pending_ | `tests` | `tests/e2e/homepage.spec.js` expanded: 9 new test cases (main landmark, skip-link, tracker CTA, karat strip, trust/methodology link, country tiles, country search filter, primary tool card variants, markets section). `tests/home-translations.test.js`: 2 new tests for country-search keys.                                                     |
| _pending_ | `docs`  | `REVAMP_PLAN.md` §17/§22b Track 3 Phase 19+20 checked; last-updated bumped to Round 10.                                                                                                                                                                                                                                                              |

**Verification (Round 10):** `npm test` (377 ✓, +1 new unit test), `npm run validate` (0 errors),
`npm run lint` clean, `npm run build` ✓ (2.22 s).

### Round 7 — 20-task implementation batch · 2026-04-27 (this PR)

_Executes 20 heavy/medium tasks drawn from `2026-04-25_codebase-analysis.md` W-items and the
multi-track quality plan. Focus: DOM-safety (W-1, Track D Phase 12), FX staleness (W-3), atomic
writes (W-4), SEO structured data, accessibility, performance, tests (W-7, W-8), CI hardening, new
tooling scripts, and docs update._

| SHA       | Bucket       | Summary                                                                                                                                                                                                                        |
| --------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `2fe030d` | `dom-safety` | W-1: `page-hydrator.js` all 3 `innerHTML` → `safe-dom`; baseline 3→0. Track D Phase 12: `render.js` all 10 remaining sinks (planner + SVG chart) → `el()`/`replaceChildren()`/`createElementNS()`; baseline 10→0.              |
| `2fe030d` | `trust`      | W-3: `getFXFreshness()` + `FX_MARKET` in `live-status.js`; `fetchFX()` passes `source:'cache-fallback'` on cache hit; test added.                                                                                              |
| `2fe030d` | `safety`     | W-4: `server/lib/fs-atomic.js` atomicWriteJSON helper; `auth.js`, both repositories, `audit-log.js`, `shop-manager.js` updated; `tests/fs-atomic.test.js` 5 cases.                                                             |
| `2fe030d` | `seo`        | Track H: `WebApplication` JSON-LD added to `tracker.html` and `calculator.html`. preconnect/dns-prefetch for `open.er-api.com` added to `tracker.html` and `calculator.html`. `dir="ltr"` on `content/embed/gold-ticker.html`. |
| `2fe030d` | `a11y`       | Track G: empty `<label>` + missing `aria-labelledby`/`aria-label` on budget/range inputs in `invest.html` fixed.                                                                                                               |
| `2fe030d` | `tests`      | W-7: `tests/supabase-data.test.js` 6 test cases (mock-fetch). W-8: `tests/e2e/calculator.spec.js` + `tests/e2e/shops-search.spec.js`. `tests/fs-atomic.test.js`.                                                               |
| `2fe030d` | `ci`         | Vite build artifact cache (`node_modules/.vite`) added to `ci.yml`; `npm run pre-deploy` + `npm run changelog` added to `package.json`.                                                                                        |
| `2fe030d` | `tooling`    | `scripts/node/pre-deploy-check.js`: 8-check go/no-go script. `scripts/node/changelog.js`: grouped conventional-commit CHANGELOG generator.                                                                                     |
| _pending_ | `docs`       | `REVAMP_PLAN.md` §7/§17 updated; `docs/plans/2026-04-25_codebase-analysis.md` W-1/W-3/W-4/W-7/W-8 marked resolved.                                                                                                             |

**Verification (Round 7):** `npm test` (366 ✓, +11 new), `npm run validate` (0 errors, baseline
tighter), `npm run lint` clean.

### Merged PRs

_None yet._ Populate when the first revamp PR merges: PR number, merge date, branch name, range of
SHAs covered, any follow-ups.

---

## 18. Update protocol (how to keep this file honest)

1. **On every `report_progress` call**, edit this file in the same commit:
   - Tick checkboxes that completed.
   - Append a row to §17 "Progress log" with the new commit SHA and one-line summary.
   - Bump the "Last updated" banner (top of file) and "Round" counter if applicable.
2. **On PR merge**, add an entry to §17 "Merged PRs" with PR number, date, branch, SHA range, and
   migrate in-branch rows from "Round N (pending merge)" into the merged round's table.
3. **If a new track or bucket is required**, add it in the relevant section; do not invent a side
   document.
4. **If scope changes**, record the change here before coding. A scope change without a doc update
   is a scope violation.
5. **If this file is deleted, renamed, or forked**, treat that as a scope violation and restore it.

> This file replaces `docs/REVAMP_STATUS.md` for the homepage + nav + tracker revamp. Legacy tracks
> from that file remain valid for their respective scopes.

---

## 19. Decisions log

_Absorbs `docs/product/DECISIONS.md`. Append-only. One entry per architectural or product decision
that future agents need to know about._

### 2026-04-04 — Keep the current static architecture

- **Decision.** Keep current static multi-page architecture for now.
- **Why.** The biggest issues are trust, UX, state reliability, and SEO — not framework limitations.
- **Consequence.** Prefer targeted refactors over migrations.

### 2026-04-04 — Spot/reference vs retail, always distinguished

- **Decision.** Always distinguish spot/reference prices from retail shop prices.
- **Why.** This is core to trust.
- **Consequence.** UI labels, methodology notes, and page copy must reflect this. Codified in §0.1
  Trust guardrails and §0.2 trust snippets.

### 2026-04-22 — REVAMP_PLAN.md is the single source of truth

- **Decision.** Consolidate every planning / status / roadmap / task / audit doc into
  `docs/REVAMP_PLAN.md`. Source files become thin pointers.
- **Why.** Multiple overlapping plan docs caused drift and confusion about which file to update when
  reporting progress.
- **Consequence.** All planning edits land here. `docs/README.md` maps the pointer index. Reference
  docs (ARCHITECTURE, DESIGN_TOKENS, SEO_STRATEGY, etc.) stay independent.

---

## 20. Project memory

_Absorbs `docs/product/MEMORY.md`. Long-lived project-level facts that future contributors need.
Repository-wide memory lives in the agent memory store; this section is for facts that benefit every
contributor (human or agent)._

- Users care a lot about trust wording.
- Avoid generic "AI-looking" page layouts.
- Do not overbuild. Small reliable improvements beat broad rewrites.
- Tracker and shops pages are high priority.
- Country / city pages need strong SEO and internal linking.
- Any fallback / estimated data must be clearly labeled.
- When reviewing code, inspect relevant files before proposing architecture changes.
- Always separate review, plan, debug, and build modes.
- `buildFilters()` on the shops page already validates each dropdown value and resets invalid ones
  to `'all'` — lean on that safety net rather than duplicating validation upstream.

---

## 21. Rollout governance

_Absorbs `docs/product/ROLLOUT_GOVERNANCE.md`. Defines a safe rollout sequence and release gate for
multi-PR revamp work._

### Release waves

#### Wave 1 — Shops

Scope: `shops.html`, `shops.js`, `shops.css`.

Gate to move forward:

- Functional and trust checks pass for shops flows.
- No unresolved accessibility blockers in modal / filter path.

#### Wave 2 — Tracker

Scope: `tracker.html`, `tracker-pro.js`, `tracker-pro.css`, `tracker/` modules touched by tracker
PRs.

Gate to move forward:

- Onboarding and source-state clarity validated.
- Compare / archive / planner critical paths verified.

#### Wave 3 — Country / City / Market templates

Scope: country / city / market HTML templates and metadata / canonical / internal-link consistency.

Gate to move forward:

- Metadata parity (title / description / canonical / OG / Twitter).
- Internal links and depth-relative assets verified.

### Merge gate checklist (all waves)

- [ ] PR is narrow and task-specific.
- [ ] Verification checklist completed (§13 Track J — Final QA).
- [ ] Risks are documented (not hidden in summary copy).
- [ ] No unrelated cleanup / refactors included.

### Post-merge monitoring

After each wave merge:

1. Validate key pages render with expected assets.
2. Confirm no high-severity console / runtime breakage.
3. Confirm trust labels and disclaimers still present.
4. Confirm service-worker update behavior is stable after refresh.

### Rollback guidance

Rollback if any of the following appears in production checks:

- Broken primary navigation or blocked core flow.
- Misleading trust wording (spot vs retail ambiguity).
- Major SEO regression (missing canonical / title / meta).
- Unrecoverable JS error affecting primary page content.

Prefer reverting the smallest offending PR, then re-shipping a focused fix.

---

## 22. Production-revamp tracks (30-phase)

_Absorbs `docs/REVAMP_STATUS.md`. This is the longer-running production track that runs in parallel
with the homepage + nav + tracker revamp in §1–§18. Status rolls into `CHANGELOG.md` at Phase 30
(launch)._

### Track A — Stabilize

- [x] Phase 1 — Repo hygiene
  - [x] Untrack `dist/`, `playwright-report/`, `test-results/`
  - [x] Deduplicate Prettier config → `.prettierrc.json` is canonical
  - [x] Deduplicate ESLint config → `eslint.config.mjs` is canonical
- [x] Phase 2 — Workflow triage
  - [x] Fix invalid `ci.yml` (previously two concatenated YAML docs → zero jobs ran)
  - [x] Fix `perf-check.yml` (deprecated `microsoft/playwright-github-action@v1`)
  - [x] Pin Node 20 LTS across CI workflows
  - [x] `post_gold.yml` untouched (user directive)
- [x] Phase 3 — Testing foundation
  - [x] CI provides test-only `JWT_SECRET` / `ADMIN_PASSWORD` / `ADMIN_ACCESS_PIN`
  - [x] Smoke suite covers 404 + country page
- [x] Phase 4 — Lint / format single source of truth
  - [x] Husky v9 pre-commit hook (lint-staged only; `npm test` removed from hook)
- [x] Phase 5 — CSP hardening
  - [x] Externalised inline gtag/clarity snippets to `assets/analytics.js` via
        `scripts/node/externalize-analytics.js` codemod (501 HTML files rewritten; 189 no-analytics
        files untouched). Idempotent `--check` mode wired into `npm run validate`.
  - [x] Dropped `'unsafe-inline'` from `scriptSrc` in `server.js` CSP.

### Track B — Backend, auth & users (not started)

- [ ] Phase 6 — Backend architecture decision & scaffolding
- [ ] Phase 7 — Supabase schema & migrations
- [ ] Phase 8 — Auth system (email OTP + OAuth)
- [ ] Phase 9 — Server API surface (`/api/v1/*`, OpenAPI spec)
- [ ] Phase 10 — User data flows (alerts, watchlist, preferences)
- [ ] Phase 11 — Admin panel consolidation + RBAC
- [ ] Phase 12 — Background jobs (price poll, alert eval, aggregates)
- [ ] Phase 13 — Notifications (email + web push)

### Track C — Product polish & trust (in progress)

- [ ] Phase 14 — Trust & labeling audit (in progress)
- [x] Phase 15 — Shops directory trust pass (in progress → closed Round 12: `freshnessSemantics`
      user-friendly copy in EN+AR; `priceDisclaimer` "always confirm" reinstated in JS;
      spot-vs-retail link added to rendered disclaimer; `shops.html` static fallback updated; nearme
      h2 emoji accessibility fixed)
- [ ] Phase 16 — Tracker UX polish (in progress — `renderSeasonal()` now populates
      `#tp-seasonal-results` with monthly high/low/spread from `state.history`)
- [x] Phase 17 — Calculator polish (Round 12: Related-tools section expanded 3→6 cards — 22K guide,
      24K guide, spot-vs-retail; addresses internal-linking weak-hub finding)
- [ ] Phase 18 — Country / city / market pages
- [ ] Phase 19 — Educational / Learn pages
- [ ] Phase 20 — Design system completion (in progress — Round 15: complete canonical token sweep
      across home.css, shops.css, calculator.css, stub.css, order.css, global.css; all legacy
      `--color-surface` / `--color-text` / `--color-text-muted` / `--color-border-subtle` fallback
      overrides removed and replaced with `--surface-primary`, `--text-primary`, `--text-secondary`,
      `--border-subtle` canonical tokens)
- [x] Phase 21 — Accessibility audit (Round 15: comprehensive WCAG 2.5.5 touch-target pass — all
      interactive elements raised to ≥44px across global.css, shops.css, calculator.css,
      tracker-pro.css, invest.css; prefers-reduced-motion guards added for shops.css,
      calculator.css, invest.css, tracker-pro.css animations; nav-cta, fav-btn, btn-sm, tool-chip,
      nav-dropdown-btn, nav-link, modal buttons, calc chips, tracker filter pills/chips/tabs, invest
      chips all fixed)

### Track D — Performance, SEO, monetisation (not started)

- [ ] Phase 22 — Performance budgets
- [ ] Phase 23 — SEO comprehensive pass
- [ ] Phase 24 — Ads integration (AdSense, consent banner, `ads.txt`)
- [ ] Phase 25 — Analytics & observability (Sentry, health / ready)
- [ ] Phase 26 — Deployment hardening (Docker, zero-downtime, secret scanning)

### Track E — Launch readiness (not started)

- [ ] Phase 27 — Load & resilience testing (k6, chaos, backup drill)
- [ ] Phase 28 — Legal & compliance (GDPR export / delete, cookie policy)
- [ ] Phase 29 — Docs & runbooks
- [ ] Phase 30 — Launch (tag v1.0.0, flip DNS, 48h enhanced monitoring)

### Track F — 404-hardening (shipped on `revamp/404-hardening`)

Orthogonal track completed in one focused branch. Every step landed as a tiny commit with a
`phx/NN:` prefix. The goal: eliminate broken internal links, harden 404 behavior, and add CI
guardrails so regressions get caught automatically.

- [x] **phx/01** — Baseline linkinator scan committed to `reports/links-initial.json` (28 links, 10
      broken, all flat `countries/<slug>.html` references).
- [x] **phx/02** — `404.html` pre-existing; verified content + canonical treatment.
- [x] **phx/03** — `server.js` `send404()` pre-existing with path-traversal-safe fallback.
- [x] **phx/04** — `_redirects` hardened: SPA catch-all removed, 21 country 301s added
      (`/countries/<slug>.html → /countries/<slug>/`), explicit `/* → /404.html 404`.
- [x] **phx/05** — linkinator wired into CI (`ci.yml`) with nightly job + artifact upload of
      `reports/`.
- [x] **phx/06** — AR nav data in `src/components/nav-data.js` rewritten from `../` relative hrefs
      to root-safe `/` form (98 `/` hrefs, 0 `../` remaining).
- [x] **phx/07** — `resolveHref` / `isPageMatch` hardened in `src/components/nav.js`:
      null/non-string guards, passthrough for `/`, `//`, `#`, `?`, URI schemes; root `/` now matches
      only the exact homepage.
- [x] **phx/08** — Country placeholder pages verified (all 21 present).
- [x] **phx/09** — 29 `countries/<slug>.html` references rewritten to `/countries/<slug>/` across
      top-level pages + components.
- [x] **phx/10** — 6 `guides/*.html` references rewritten to `content/guides/*.html` in
      shops/insights surfaces.
- [x] **phx/11** — `_headers` added: immutable long-cache for assets, short-cache for HTML,
      `X-Content-Type-Options` / `X-Frame-Options` / `Referrer-Policy` / `Permissions-Policy`
      globally; `/admin/*` `X-Robots-Tag: noindex` + `no-store`.
- [x] **phx/12** — `tests/e2e/nav-smoke.spec.js`: nav presence on 9 key pages + every country tile
      on `/countries/` resolves without 404.
- [x] **phx/13** — `tests/e2e/js-links.spec.js`: tracker hash deep-link round-trip + search page
      renders.
- [x] **phx/14** — Favicon / manifest / asset refs (`../favicon.svg` etc.) rewritten to root-safe
      absolute via `scripts/node/fix-asset-refs.js` (479 files).
- [x] **phx/15** — `build/generateSitemap.js` paths fixed (478 URLs, added privacy / terms /
      guides).
- [x] **phx/16** — `scripts/node/check-seo-meta.js` regression guard wired into `npm run validate`
      (canonical + hreflang on public pages, noindex on internal).
- [x] **phx/17** — Nav a11y: skip-link (WCAG 2.4.1) + focus trap inside mobile drawer + legacy-safe
      `.sr-only` with `clip-path` addition.
- [x] **phx/18** — Mobile bottom nav uses root-safe hrefs (aligned with phx/06).
- [x] **phx/19** — `scripts/node/generate-placeholders.js` pre-existing.
- [x] **phx/20** — Broken hrefs rewritten across 50 more pages via
      `scripts/node/fix-broken-hrefs.js` (top-page, guide, country-flat, country-dir rules). Asset
      audit: 0 broken ref types across 690 HTML files.
- [x] **phx/21** — Dev-mode 404 logging to `data/404-logs.json` in `server.js` (ring buffer, cap 500
      entries, no-op in production).
- [x] **phx/22** — CI enforcement flip: `scripts/node/enforce-linkcheck.js` parses the linkinator
      JSON report and fails the build on any broken internal link.
- [x] **phx/27** — This log (docs update per REVAMP_PLAN protocol).

**Verified outcomes on `revamp/404-hardening`:**

- `npm run lint` — clean
- `npm run validate` — 0 errors, 0 warnings (includes SEO + DOM-safety + inline-analytics checks)
- `npm test` — 271/271 passing
- `npm run linkcheck:report` — 28/28 OK
- Playwright chromium — 18/18 (smoke + nav-smoke + js-links) passing
- Asset audit — 0 broken reference types across 690 HTML files

### Items blocked on external inputs

These items cannot be completed without credentials or third-party accounts. Surface them to the
project owner before the associated phase starts.

| Phase | Blocker                                    |
| ----- | ------------------------------------------ |
| 7–13  | Supabase project URL + service role key    |
| 8     | OAuth client IDs (Google)                  |
| 13    | Email provider (Resend / Postmark) API key |
| 24    | AdSense publisher ID                       |
| 25    | Sentry DSNs (frontend + backend)           |
| 26    | Deployment target (Render / Fly / Railway) |

---

## 22b. Tracker + Homepage + Admin revamp (30-phase)

_Reconciled from [`docs/plans/PLATFORM_UPGRADE_PROPOSAL.md`](./plans/PLATFORM_UPGRADE_PROPOSAL.md)
and the 2026-04-23 agent proposal. Surface-scoped supplement to §22: §22 owns cross-cutting
production phases (repo hygiene → backend/auth → launch); §22b owns the three highest-traffic UI
surfaces (`tracker.html`, `index.html`, `admin/`). Phases ship as single-concern commits per §1._

**Scope guards (non-negotiable):**

- No new backend, Supabase schema, or auth changes (preserves §14 non-goals and Wave-3 gates).
- No chart library swap (`plans/README.md` matrix row #11 rejected — keep `lightweight-charts` on
  tracker, `chart.js` on history).
- No URL hierarchy changes (matrix row #15 gated).
- No new `innerHTML` / `outerHTML` / `insertAdjacentHTML` / `document.write` sinks — every phase
  must **not raise** the baseline in `scripts/node/check-unsafe-dom.js`. Reduction is encouraged
  wherever a phase's surface touches existing sinks (notably Phases 5, 11, 24).
- No opportunistic cleanup outside a phase's surface.

**Per-phase definition of done (every commit):**

1. Update this §22b checklist and §17 "Progress log" with the commit SHA in the same commit.
2. `npm test`, `npm run lint`, `npm run validate`, `npm run quality`, `npm run build` all green.
3. Do not regress Phase 1 baseline counters (bundle size, sinks, a11y violations).
4. Ship bilingual (EN + AR) copy or explicitly defer with a tracked follow-up row.
5. Add/update at least one `node:test` or Playwright test for new behavior.

### Track 1 — Shared foundation

- [x] **Phase 1** — Baseline audit & telemetry snapshot. `reports/baseline-tracker.json`,
      `reports/baseline-home.json`, `reports/baseline-admin.json` record current `innerHTML` sink
      counts, LOC, and CSS size. Used as the regression yardstick for every later phase.
- [x] **Phase 2** — Shared design-token completeness. Audit `--tp-*`, homepage hero tokens,
      `admin.css` variables against `styles/global.css`; promote redefined tokens up. No visual
      change. _Audit deliverable: [`reports/token-audit.md`](../reports/token-audit.md). Finding:
      tracker is 100 % aliased to canonical; homepage consumes canonical directly; admin retains an
      intentionally divergent dark-theme palette (documented with per-token rationale). Net
      promotable tokens: 0; closed without a mechanical substitution to preserve no-visual-change
      guarantee._
- [ ] **Phase 3** — Shared chrome parity (nav/footer/skip-link, RTL, mobile drawer focus-trap).
- [x] **Phase 4** — Trust/freshness primitive unification via `src/lib/live-status.js`. Replace
      ad-hoc freshness strings on the three surfaces without redesigning them. _Round 8: `home.js`
      `getFreshnessMeta()` now wraps `getLiveFreshness()` directly; `ageText` shown instead of raw
      `formatTimestampShort`; real-time freshness ticker (`startFreshnessTimer()`) ticks the
      "Updated X min ago" labels every 30 s; `home.js` removed from `KNOWN_GAPS` in the freshness
      coverage audit. Tracker `render.js` + admin `pricing` call-sites remain for a follow-up._
- [ ] **Phase 5** — DOM-safety baseline tightening for the highest-churn `innerHTML` sinks touched
      by later phases; lower the numbers in `scripts/node/check-unsafe-dom.js`.

### Track 2 — Tracker

- [x] **Phase 6** — Hero trust framing (`#tp-live-badge`, `#tp-xauusd-badge`, `#tp-hero-stats`) via
      the Phase 4 primitive. _Market badge now carries explicit `aria-label` (EN+AR) that strips
      decorative bullets for screen readers (`tracker.marketOpenAriaLabel` /
      `tracker.marketClosedAriaLabel`); `renderAll()` updates `document.title` with live XAU/USD
      price; welcome strip chips localized via `_localizeWelcomeStrip()` using
      `el()`/`replaceChildren()` — no new `innerHTML`. Prior hero badge / XAU badge trust framing
      shipped in Round 7._
- [x] **Phase 7** — State/URL-hash contract freeze. Document `src/tracker/state.js` hash schema in
      [`docs/tracker-state.md`](./tracker-state.md); add round-trip tests in
      `tests/tracker-hash.test.js`.
- [x] **Phase 8** — Mode-tabs refactor (extract `#tab-*` wiring from `ui-shell.js` into `modes.js`).
      Landed as [`src/tracker/modes.js`](../src/tracker/modes.js): pure registry of 7 tab entries (5
      modes + 2 panels), bilingual labels, workspace gates, keyboard-shortcut map. `ui-shell.js`
      consumes it for overlay construction and keyboard dispatch. Contract invariants enforced by
      [`tests/tracker-modes.test.js`](../tests/tracker-modes.test.js).
- [x] **Phase 9** — Live-mode polish: `aria-live="polite" aria-atomic="false"` on
      `<tbody id="tp-karat-table">` for screen-reader price announcements. (`6e63e1f` Round 9)
- [ ] **Phase 10** — Compare mode (multi-select, `el()`-only results table, spot-linked reference).
- [ ] **Phase 11** — Archive mode (pagination + CSV export; retire `innerHTML` sinks in
      `src/tracker/render.js`).
- [ ] **Phase 12** — Alerts mode (local-only, explicit "Browser-only reminder" disclaimer).
- [ ] **Phase 13** — Planner + Exports + Method (CSV/JSON/brief polish; Method links into
      `methodology.html`).
- [ ] **Phase 14** — `styles/pages/tracker-pro.css` split into per-mode files + dead-rule prune.

### Track 3 — Homepage

- [ ] **Phase 15** — Above-the-fold rebuild (§6 Track C scope) with `WebSite` + `BreadcrumbList`
      JSON-LD.
- [ ] **Phase 16** — `#hero-live-card` trust pass (`formatRelativeAge`, explicit stale state).
- [ ] **Phase 17** — Karat strip `countUp` parity across 24K–14K with directional flash.
- [ ] **Phase 18** — Day sparkline (one per karat, IntersectionObserver-gated, no new chart lib).
- [x] **Phase 19** — Tools strip (Tracker · Calculator primary-emphasis, 9-tool grid):
      `tool-card--primary` variant on Tracker and Calculator cards (gold-tinted background, larger
      icon, star badge); tablet 700px + 560px breakpoints in `home.css`. (_Round 10_)
- [x] **Phase 20** — Country/city linking block (inline search filter on country-tiles section):
      `#country-search` input + `initCountrySearch()` in `home.js`; keyboard navigation
      (ArrowDown/Up/ Escape); bilingual placeholder + empty-state text wired into
      `applyLangToPage()`; `role="list"` on tiles wrap; `aria-hidden="true"` on flag emoji;
      `aria-live="polite"` on empty state. (_Round 10_)
- [ ] **Phase 21** — Trust & methodology band re-using §0.2 snippets.
- [ ] **Phase 22** — `src/pages/home.js` dead-import audit + below-fold lazy-load.

### Track 4 — Admin (UI-only, no server/auth changes)

- [ ] **Phase 23** — Admin chrome consolidation: `admin/shared/chrome.js` shared sidebar/header.
      Reuse `admin/supabase-auth.js`. Ship behind a shared-chrome feature gate; roll subpages in one
      at a time if parity is at risk.
- [x] **Phase 24** — `admin/index.html` dashboard rebuild: inline styles moved to CSS classes in
      `styles/admin.css` (`.admin-flex-row`, `.admin-meta-dim`, `.admin-table-empty`);
      `admin/pricing/index.html` inline styles also moved (`.admin-mt-14/16`, `.admin-flex-240/200`,
      `.admin-action-row`). (`d975fa6` Round 9)
- [ ] **Phase 25** — `admin/login/` flow polish (honest errors, rate-limit wording matching
      `server.js` `express-rate-limit`; PIN flow matches `server/routes/admin/index.js:189-205`).
- [x] **Phase 26** — Settings + Pricing admin pages: "Estimate-only" disclaimer added to Override
      Price form in `admin/pricing/index.html` (amber-styled `<p class="admin-estimate-note">`).
      (`d975fa6` Round 9)
- [ ] **Phase 27** — Shops + Orders admin pages (virtualize tables > 200 rows; WhatsApp field per
      `docs/ADMIN_GUIDE.md` and matrix row #2).
- [ ] **Phase 28** — Analytics + Content + Social admin pages (read-only panels, "Last synced" label
      reusing Phase 4 primitive).

### Track 5 — Finish line

- [ ] **Phase 29** — A11y + perf final pass (Pa11y on three surfaces, Lighthouse ≥ 90 mobile, CSS/JS
      budgets in `perf-check.yml`, DOM-safety baseline tightened).
- [ ] **Phase 30** — Docs, changelog, rollout. Update `CHANGELOG.md`, this section, and
      `docs/ADMIN_GUIDE.md`; bump "Last updated"; tag release per §21 Rollout Governance.

### §22b-specific risks (mirror in §25)

- **Phase 14** — Tracker CSS split is the highest regression risk; visual-diff screenshots required
  before merge.
- **Phase 23** — Admin chrome consolidation touches all admin subsurfaces; gated behind the
  shared-chrome toggle.
- **Phase 15** — Homepage above-fold rebuild must preserve canonical / `og:url` or sitewide
  `tests/seo-sitewide.test.js` + `scripts/node/check-seo-meta.js` will fail.

---

## 23. Historical execution summary (20-phase revamp)

_Absorbs `docs/REVAMP_EXECUTION_SUMMARY.md`. Condensed snapshot of the earlier 20-phase mega-revamp.
Full prose originally lived in the source file and is preserved in git history; the material
deliverables that matter for future work are summarised here and now live as reference docs._

| Phase | Area                                  | Primary deliverable(s)                                                           |
| ----- | ------------------------------------- | -------------------------------------------------------------------------------- |
| 1     | Foundation & design-system completion | `docs/DESIGN_TOKENS.md` (196 tokens catalogued)                                  |
| 2     | Accessibility overhaul                | `docs/ACCESSIBILITY.md` — WCAG 2.1 AA patterns                                   |
| 3     | Performance optimisation              | `docs/PERFORMANCE.md` — budgets, critical-CSS, SW caching                        |
| 4     | SEO & metadata                        | `docs/SEO_STRATEGY.md`, `docs/SEO_CHECKLIST.md`, `docs/SEO_SITEMAP_GUIDE.md`     |
| 5     | Mobile-first UX refinement            | Breakpoint spec at 320 / 375 / 414 / 768 / 1024 px; 44 × 44 touch targets        |
| 6     | Component library                     | Canonical `.btn`, `.card`, badge, input, modal, toast, skeleton patterns         |
| 7     | State-management modernisation        | `src/tracker/state.js` + URL-hash synchronisation                                |
| 8     | Data-layer enhancement                | `services/goldPriceService.js`, `services/fxService.js`, circuit breakers        |
| 9     | Testing expansion                     | 231+ Node `node:test` suites under `tests/*.test.js`; target ≥ 80% coverage      |
| 10    | Error handling & resilience           | `src/lib/errors.js`, retry with backoff, fallback UI, EN/AR error copy           |
| 11    | i18n enhancement                      | `src/config/translations.js`, RTL CSS, locale-aware formatters                   |
| 12    | Admin-panel modernisation             | `admin/*` (9 pages) on Supabase GitHub OAuth + RBAC groundwork                   |
| 13    | CMS                                   | Markdown-based content pipeline (architecture planned, not shipped)              |
| 14    | Analytics & monitoring                | GA4 snippet, uptime / health / spike-alert workflows                             |
| 15    | Security hardening                    | Helmet CSP, rate-limit, bcrypt auth, secret scanning, `utils/inputValidation.js` |
| 16    | DevEx & tooling                       | ESLint flat config, Prettier, Stylelint, Husky v9 + lint-staged                  |
| 17    | Documentation overhaul                | The `docs/` tree itself (now consolidated into this master plan)                 |
| 18    | Content enhancement                   | Guides, learn, invest, insights pages                                            |
| 19    | Deployment & DevOps                   | GitHub Actions CI + Pages deploy; see `.github/workflows/README.md`              |
| 20    | Quality assurance                     | Pre-commit hooks + CI merge gate + `npm run validate` DOM-safety baseline        |

> **Note.** All "design-specifications" / "architecture-planned" / "roadmap-defined" items from the
> original summary are either (a) already shipped as code, (b) rolled into §22 Production-revamp
> tracks as concrete phases, or (c) deferred to §24 Product roadmap. See git history of
> `docs/REVAMP_EXECUTION_SUMMARY.md` for the original long-form prose.

---

## 24. Product roadmap

_Absorbs `docs/ROADMAP_IMPLEMENTATION.md`. Multi-phase roadmap for features beyond the current
revamp. Full implementation notes (env vars, code templates, SQL, cost projections) are preserved in
git history; the active deliverable inventory lives here._

### Phase 1 — Foundation & quick wins (current)

| Feature           | Status                             | Blocker                                                                                                      |
| ----------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Premium tier      | Infra complete, code stubs present | Stripe account + price IDs, `npm i stripe`                                                                   |
| Email newsletter  | Infra complete, workflows present  | Resend account + verified sender domain                                                                      |
| Portfolio tracker | DB schema ready, UI pending        | Supabase Auth enabled; `portfolio.html` + `src/components/auth-modal.js` + `src/lib/portfolio-calculator.js` |

**Newsletter cadence** (when live): daily 07:00 Dubai (03:00 UTC) via `daily-newsletter.yml`; weekly
Sunday 18:00 Dubai (14:00 UTC) via `weekly-newsletter.yml`.

### Phase 2 — Data & social (4–6 months)

- [ ] **Multi-source price aggregation** — Kitco, LBMA, weighted average, ±2% outlier detection,
      "Price Sources" transparency modal.
- [ ] **Silver / platinum / palladium expansion** — generalise `price-calculator.js` to
      `metal-price-calculator.js`, add metal selector on tracker, create `silver.html` /
      `platinum.html` / `palladium.html`.
- [ ] **Instagram & LinkedIn automation** — visual-content generator (Puppeteer), posting scripts +
      workflows.

### Phase 3 — Platform evolution (12+ months)

- [ ] **Premium developer API** — `/api/v1/spot`, `/api/v1/price/:country/:karat`,
      `/api/v1/historical`, `/api/v1/markets`. Tiered rate limits (Free / Basic / Pro). Redis-backed
      rate limiting. API-key generation system. OpenAPI docs.
- [ ] **Interactive heatmap** — regional price heat map.
- [ ] **Crypto correlation** — gold vs BTC / ETH overlay.
- [ ] **WhatsApp / Google Sheets integrations, push notifications, multi-language expansion** —
      detail to be specified per feature.

### Packages to install when activating roadmap items

> Run `gh-advisory-database` before adding any of these.

| Package                 | Phase | For                        |
| ----------------------- | ----- | -------------------------- |
| `stripe`                | 1     | Premium tier               |
| `resend`                | 1     | Newsletter                 |
| `@supabase/supabase-js` | 1     | Portfolio, shops, settings |
| `puppeteer`             | 2     | Visual content generation  |
| `redis` / `ioredis`     | 3     | API rate limiting          |
| `swagger-ui-express`    | 3     | Developer-API docs         |

### External inputs blocking roadmap delivery

| Phase          | Blocker                               |
| -------------- | ------------------------------------- |
| Premium tier   | Stripe account + Price IDs            |
| Newsletter     | Resend API key + verified domain      |
| Portfolio      | Supabase Auth enabled (email / OAuth) |
| Multi-source   | Kitco / LBMA API keys                 |
| Social (Ph. 2) | Instagram Graph + LinkedIn OAuth      |
| API (Ph. 3)    | Deployment target + Redis instance    |

See `docs/SUPABASE_SCHEMA.md` for the database migration workflow that supports these features.

---

## 25. Known issues, risks, open items

_Absorbs `docs/issues-found.md`, `docs/risks.md`, and `docs/pr-audit.md`. For deeper technical
limitations see the reference doc `docs/LIMITATIONS.md` — that file is not folded here because it is
a stable reference inventory, not an actionable backlog._

### 25.1 Active issues (actionable)

| #   | Severity | Area     | Issue                                                                                    | Owner / Next step                                                 |
| --- | -------- | -------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| A1  | Low      | Ads      | `components/adSlot.js` uses placeholder `AD_PUBLISHER_ID = 'ca-pub-XXXXXXXXXX'`          | Site owner must supply real AdSense publisher ID.                 |
| A2  | Low      | SEO      | Legacy country pages (`countries/*.html`, 15 files) coexist with new hierarchical pages. | Add canonical tags pointing legacy → new, or 301 redirects.       |
| A3  | Low      | PR state | PR #77 (revert of master revamp) left **open** but no longer needed.                     | Close PR #77 — PR #76 changes are stable.                         |
| A4  | Info     | Cache    | `services/cacheLayer.js` referenced in Phase 3 spec was never created.                   | No action — `src/lib/cache.js` is functional and covers the need. |

### 25.2 Active risks (carry forward)

| #   | Risk                                                                               | Mitigation                                                                               | Residual impact                       |
| --- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------- |
| R1  | AdSense integration incomplete                                                     | Placeholder code already in place; flips live when owner supplies publisher ID.          | Low — monetisation only, no UX impact |
| R2  | Supabase anon key is committed in `config/supabase.js`                             | Anon key is designed for client-side use; Row-Level Security only exposes verified rows. | Low — intended Supabase architecture  |
| R3  | Vite / esbuild moderate vuln (≤ 0.24.2)                                            | Only affects local dev server; prod build is unaffected.                                 | None in production                    |
| R4  | GitHub Pages cannot set HTTP security headers                                      | Meta-equivalents in `.htaccess` + proper headers on Express server when self-hosted.     | Medium — CSP / HSTS meta is limited   |
| R5  | Dual routing (legacy flat `/countries/uae.html` + hierarchical `/uae/gold-price/`) | `.htaccess` redirects cover some paths; canonical tags on 97% of pages.                  | Medium — possible split link equity   |

### 25.3 PR-reconciliation audit (snapshot 2026-04-13)

- **PRs analysed:** 95 (PR #1 – #95)
- **Open at audit time:** 1 (PR #77 — revert, no longer needed)
- **Changes reflected in code:** ≈ 95 %
- **Gaps found:** only the three items in §25.1 (all Low severity)

> See `docs/pr-audit.md` (pointer) and git history for the full table. No Critical or High severity
> items were found in that audit.

### 25.4 Open questions (carry forward until answered)

Duplicated from §16 for convenience — see §16 for defaults.

1. Ship nav search in the current PR or defer? (JS weight trade-off.)
2. Drop any existing homepage sections entirely or re-rank + tighten?
3. Bilingual strings for all new homepage copy now or follow-up?
4. Is the tracker sticky control bar OK to ship if it changes the visual identity of the page
   materially?

---

## 26. Codebase architecture snapshot

_Absorbs `docs/codebase-audit.md`. A concise snapshot. For long-form module catalogues and deep
architecture notes see the reference doc `docs/ARCHITECTURE.md`. For design tokens see
`docs/DESIGN_TOKENS.md`._

### Routing

File-based static site with Vite build. Clean URLs via `index.html`:

| Pattern                                      | Example                                      |
| -------------------------------------------- | -------------------------------------------- |
| Homepage                                     | `/`                                          |
| Country gold price                           | `/{country}/gold-price/`                     |
| City gold prices                             | `/{country}/{city}/gold-prices/`             |
| City gold shops                              | `/{country}/{city}/gold-shops/`              |
| Karat rate per city                          | `/{country}/{city}/gold-rate/{karat}-karat/` |
| Legacy country / city / market               | `/countries/*.html` (kept; see §25.1 A2)     |
| Tools (calc, tracker, history, order, shops) | `/calculator.html`, `/tracker.html`, etc.    |
| Admin                                        | `/admin/*` (9 pages, Supabase OAuth)         |

Route helpers: `utils/routeBuilder.js`, `utils/routeValidator.js`, `routes/routeRegistry.js`.

### Build

Vite 8 + Terser. `vite.config.js` excludes the 15 country directories, `admin/`, `embed/`, `dist/`,
`node_modules/`. Those are copied as-is by the deploy workflow. Manual chunks: `vendor`
(lightweight-charts) and `utils` (cache, api, price-calculator, formatter). See
`docs/DEPENDENCIES.md` for the version matrix.

### External APIs

| Domain                      | Purpose                                                |
| --------------------------- | ------------------------------------------------------ |
| `api.goldpricez.com`        | Primary XAU/USD spot (`goldPriceService.js`)           |
| `goldpricez.com`            | Fallback gold price (`lib/api.js`)                     |
| `open.er-api.com`           | FX rates (USD base) (`fxService.js`)                   |
| Supabase project URL        | Shops / settings / auth (`lib/supabase-data.js`)       |
| `api.gdeltproject.org`      | Market news (`scripts/pages/insights.js`)              |
| `raw.githubusercontent.com` | DataHub historical baseline (`lib/historical-data.js`) |

Waterfall on gold price: primary → fallback → cache → last-known with label.

### State management

- Homepage: `STATE` object in `src/pages/home.js`.
- Tracker: `src/tracker/state.js`, URL-hash serialised (`#mode=live&cur=AED&k=24&u=gram`).
- Shops: filter / shortlist state in `src/pages/shops.js`.
- Persistence: `src/lib/cache.js` wraps `localStorage`.

Key `localStorage` namespaces: `goldprices_gold_*`, `goldprices_fx_*`, `user_prefs`, `gp_pref_lang`,
`shops_shortlist`, `tracker_*`, `sb-*-auth-token`, `gp_admin_shops`.

### SEO layer

Canonical coverage ≈ 97 %. Sitemap at `/sitemap.xml` with hreflang alternates. JSON-LD: `WebSite` +
`SearchAction` + `Organization` on home; `BreadcrumbList` sitewide; `FAQPage`, `HowTo`, `Dataset` on
specific pages. `robots.txt` blocks admin, server, tests, node_modules, supabase, repositories,
dist.

### Dependencies

See `docs/DEPENDENCIES.md` for the full version matrix. Production deps: bcryptjs, cors, express 5,
express-rate-limit, helmet, jsonwebtoken, lowdb, morgan, uuid. Dev: terser, vite 8.

### CI / CD

15+ GitHub Actions workflows grouped in four tiers:

1. **Merge gate** — `ci.yml`
2. **Informational scans** — `codeql.yml`, `semgrep.yml`, `perf-check.yml`, `lighthouse.yml`
3. **Production deploy** — `deploy.yml`
4. **Content / sync bots** — `post_gold.yml`, `daily-newsletter.yml`, `weekly-newsletter.yml`,
   `uptime-monitor.yml`, `health_check.yml`, `spike_alert.yml`, `sync-db-to-git.yml`

Only `ci.yml` blocks merges. See `.github/workflows/README.md`.

---

## 27. Historical execution log

_Absorbs `docs/execution-log.md`. Snapshot of completed phases of the earlier multi-phase audit. The
active progress tracking continues in §17 (current revamp) and §22 (production tracks)._

### 2026-05-01 — homepage + tracker trust / mobile polish ✅

- Homepage hero copy now frames prices as spot-linked reference prices before retail premiums,
  making charges, and tax. The live-card announcement surface moved to the freshness line instead of
  the whole hero card, and country search now shows a query-aware empty state.
- Tracker trust copy now distinguishes spot (GoldPriceZ snapshots) from FX (`open.er-api.com`) and
  localizes static hero / toolbar / quick-tools / countdown / offline text in EN + AR. Unavailable
  freshness states now fall back to human wording instead of `—`-style timestamps.
- Shared breadcrumbs now localize labels from the active document language and replace prior mounts
  instead of appending duplicates. Shared footer freshness wording is clearer (`Gold updated`,
  `Data sync`) and the brand link aria-label is localized.
- Verification in this pass: `npm test`, `npm run lint`, `npm run validate`, `npm run build`, and
  `npm run check-links` passed. `npm run quality` still fails on unrelated repo-wide Prettier drift
  in untouched files.

### Phase 0 — Repository audit + PR reconciliation ✅

- **0A — Git history & PR audit.** 95 PRs analysed (1 open: PR #77 — revert, no longer needed). ≈ 95
  % of PR changes reflected in codebase. Gap: AdSense placeholder publisher ID. Original output:
  `docs/pr-audit.md` (now pointer).
- **0B — Codebase structural audit.** 380 HTML pages, 68 JS files, 16 CSS files. Vite build. 15+
  workflows. Supabase for admin + shops. Bilingual EN/AR. 369/380 pages have canonicals & unique
  descriptions. 205 tests passing at the time. Two moderate vulns in esbuild (no prod impact).
  Original output: `docs/codebase-audit.md` (now pointer).
- **0C — Performance baseline.** Expected Lighthouse 85–95. No blocking JS for initial paint.
  Service worker cache-first for assets, network-first for HTML. Output:
  `docs/performance-baseline.json` (retained as reference data).

### Phase 1 — PR reconciliation ✅

No Critical or High severity items found. Only the three items in §25.1 remain as Low-severity gaps.

### Phase 2 — URL architecture ✅

- `utils/routeBuilder.js` — single source of truth for URL generation (`buildRoute`,
  `buildShopsRoute`, `buildCanonicalURL`, `generateAllRoutes`).
- `utils/routeValidator.js` — validates country / city / karat param combos.
- `tests/route-utils.test.js` — 27 tests covering every route type.
- Hierarchical URLs already in place (`/{country}/{city}/gold-prices/`).

### Phase 12 — Accessibility + performance (partial) ✅

- Security meta headers (`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
  `Referrer-Policy: strict-origin-when-cross-origin`) added to 6 main pages.
- All pages carry `lang="en"` + `dir="ltr"` (RTL switched via CSS).
- No `tabindex > 0` anywhere; no `<img>` missing alt text (flags are emoji, not images).

### Phase 13 — Security hardening (partial) ✅

- `server.js` CSP extended for AdSense, GA4, Supabase.
- `utils/inputValidation.js` — shared validators (UAE phone, email, numeric range, text
  sanitisation, URL-param sanitisation, price-alert validation).
- `tests/input-validation.test.js` — 31 tests.
- `.env.example` created; `docs/environment-variables.md` retained as reference.

### Phase 15 — CI/CD + tests (partial) ✅

- `ci.yml` runs on PR to `main`; `deploy.yml` on push to `main`.
- 205 tests passing at audit time (now 231+; see §26 CI / CD).
- 15+ workflows across CI, deploy, monitoring, social posting.

### Phases 3–11, 14 — status at audit

Already substantially implemented — see `services/`, `lib/cache.js`, `lib/api.js`,
`components/chart.js`, 380 pages with prices, shops, charts, `seo/metadataGenerator.js` (97 %
canonical coverage), 9 admin pages with Supabase auth, `order-gold/` with WhatsApp + Supabase,
`social/postTemplates.js` (10 templates), `search/searchEngine.js` (bilingual fuzzy),
`config/translations.js` + RTL CSS. Only Phase 11 (monetisation) remains partial — blocked on a real
AdSense publisher ID (see §25.1 A1).

---

## 28. Task backlog

_Absorbs `docs/product/TASKS.md`. Near-term, narrowly-scoped backlog. Wider roadmap items live in
§24; production tracks in §22; current revamp work in §17._

### Ready

- [ ] Fix tracker tab switching and state persistence.
- [ ] Audit every tracker button and disable / remove unfinished controls.
- [ ] Rebuild shops featured / filter behavior.
- [x] Parse and honour query params on shops page.
- [ ] Improve compare / archive readability on mobile.
- [ ] Review canonical / meta tags across main pages.
- [ ] Add sitemap verification checklist.
- [ ] Migrate admin dashboard to pull real stats from Supabase.
- [ ] Create `pricing_overrides` Supabase table and migrate `admin/pricing/`.
- [ ] Create `orders` Supabase table and migrate `admin/orders/`.
- [ ] Migrate `admin/social/` to read from Supabase `fetch_logs`.
- [ ] Read `site_settings` from Supabase on public pages for dynamic feature flags.

### In progress

- [ ] Master docs update — **consolidation sweep** folding every planning doc into this master plan.
      See Round 2 progress log in §17.

### Blocked

- [ ] Admin panel full Supabase migration — needs the Supabase schema confirmed running.
- [ ] Public-site dynamic settings — needs `site_settings` populated in Supabase.

### Done

- [x] Fix `sync-db-to-git.yml` secret name (`SUPABASE_SERVICE_KEY` → `SUPABASE_SERVICE_ROLE_KEY`)
      and ES-module output format.
- [x] Create `.env.example`.
- [x] Deprecate dead `admin/api-client.js`.
- [x] Rewrite `ADMIN_GUIDE.md` for Supabase auth.
- [x] Rewrite `ADMIN_SETUP.md` for Supabase auth.
- [x] Update `DEPENDENCIES.md` with correct versions.
- [x] Update all automation docs.
- [x] Fix Vite version across all docs.

---

## 29. Repo hygiene pass

_Reconciled from [`docs/plans/REPO_CLEANUP_PROPOSAL.md`](./plans/REPO_CLEANUP_PROPOSAL.md) on
2026-04-23. Audit-first / delete-last. Phases 2+ are gated by owner sign-off on
`reports/cleanup-audit/CANDIDATES.md`._

**Branch:** `copilot/clean-repo-files-dead-code`

### Scope

Reduce dead code, dead files, and stale artifacts across the repo without altering any public URL,
breaking any CI gate, or weakening SEO/trust surfaces. Preserve the static multi-page architecture.

### Guardrails (binding for every PR in this track)

- Never delete `**/*.html` under `countries/`, `content/`, `admin/`, or repo root as cleanup.
- Never delete anything listed in `sitemap.xml`, `_redirects`, `_headers`, `.htaccess`,
  `robots.txt`, `manifest.json`, `sw.js`, `CNAME`.
- Never modify `data/shops.js`, DataHub baseline CSVs, or pre-build outputs (`assets/`, `config/`,
  `data/`) as cleanup.
- One subsystem per PR. ≤ ~50 files per removal PR.
- Never force-push; never rewrite history.
- DOM-safety baseline (`check-unsafe-dom`) and SEO/sitemap gates must stay green or tighten.
- Out of scope: version bumps, architecture changes, directory reorgs, content rewrites, new
  features, new pages, URL changes.

### Phase checklists

#### Phase 0 — Reconcile into the plan system

- [x] `docs/plans/REPO_CLEANUP_PROPOSAL.md` created with raw prompt + plan
- [x] Row added to "Pending proposals" in `docs/plans/README.md`
- [x] Sub-tasks scored into the priority matrix (rows 15a–15g, Wave 2/3)
- [x] This subsection (§29) added to `REVAMP_PLAN.md`

#### Phase 1 — Baseline audit (read-only, zero deletions)

- [ ] Inventory: full file list with size + last-modified + last-touched commit SHA
- [ ] Reachability graph (HTML→assets, JS imports, CSS imports, config refs, runtime refs, test
      refs, workflow refs, dynamic refs)
- [ ] Keep-list per `REPO_CLEANUP_PROPOSAL.md` §Phase 1.3
- [ ] Candidate-list bucketed A / B / C
- [ ] Dead-code-inside-live-files audit: knip (or ts-prune), depcheck, purgecss (report-only), ruff
      F401/F811/F841, eslint unused-vars (non-blocking)
- [ ] `reports/cleanup-audit/CANDIDATES.md` committed with empty checkboxes for owner sign-off
- [ ] PR opened: "repo hygiene: audit-only (no deletions)"
- [ ] **STOP — owner reviews `CANDIDATES.md` and checks off approvals before Phase 2+**

#### Phase 2 — Trivially safe removals (Bucket A only, owner-approved)

- [ ] One category per commit (`.DS_Store`, editor swaps, zero-byte, orphan `.map`, byte-identical
      duplicates)
- [ ] `.gitignore` hardened (`Thumbs.db`, `*~` confirmed; `.DS_Store` and `*.swp` already present)
- [ ] Per-PR gates: `npm run lint`, `npm run validate`, `npm test`, `npm run build`,
      `npm run quality`
- [ ] No public HTML changed

#### Phase 3 — Script & module orphans (Bucket B, one-at-a-time)

- [ ] Re-verify each file unreferenced at HEAD
- [ ] Dynamic-ref grep across repo + workflows + docs + `dist/`
- [ ] `npm run build` output byte-diff acceptable
- [ ] One subsystem per PR; one-line `CHANGELOG.md` "Internal" entry per removal

#### Phase 4 — Dead exports inside live files (no file removal)

- [ ] Per knip / ts-prune output, confirm zero consumers (incl. tests + workflows)
- [ ] Remove export; remove body if no internal consumer
- [ ] Group edits by module
- [ ] **Do not** touch `src/lib/safe-dom.js` or `src/lib/cache.js` fallback paths

#### Phase 5 — Dependencies

- [ ] depcheck-flagged unused deps removed; cross-checked against workflow refs
- [ ] `npm audit` + full test + build green
- [ ] No version bumps

#### Phase 6 — CSS / style hygiene (report-first)

- [ ] purgecss-flagged class selectors removed (class-based only)
- [ ] Protected primitives kept: `hover-lift`, `data-freshness-pulse`, `data-reveal`,
      `flash-up/down`, `pulse-dot`, `drawer-slide-in`
- [ ] Playwright visual smoke (where available) green on home / tracker / shops / country-page

#### Phase 7 — Docs hygiene (non-destructive)

- [ ] Identify clearly superseded docs vs `REVAMP_PLAN.md`
- [ ] **Archive** under `docs/archive/YYYY-MM/`, do not delete
- [ ] `docs/README.md` index updated
- [ ] Governance files never archived: `AGENTS.md`, `CLAUDE.md`, `REVAMP_PLAN.md`, `plans/README.md`

#### Phase 8 — Formatting-only pass (default skip)

- [ ] _Default: skip._ Run only if explicitly requested
      (`chore: format only (no semantic     changes)`).

#### Phase 9 — Final validation

- [ ] `npm test`, `npm run lint`, `npm run validate`, `npm run quality`, `npm run build`,
      `npm run perf:ci`, `npm run check-links`, `npm run a11y`, `npm run seo-audit`
- [ ] `dist/` sitemap diff: every public URL still ships
- [ ] DOM-safety baseline untouched or tightened
- [ ] Deploy preview smoke: home, tracker, shops, calculator, insights, one country, one city, one
      market, 404, offline
