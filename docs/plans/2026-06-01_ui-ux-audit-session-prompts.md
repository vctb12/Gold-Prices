# UI/UX Audit — Session Prompts (copy-paste)

> Each prompt assumes prior sessions are **merged to `main`**. Read
> [`2026-06-01_ui-ux-audit-remediation-program.md`](./2026-06-01_ui-ux-audit-remediation-program.md)
> for scope, decisions, and splits. Update
> [`docs/audits/UI_UX_AUDIT_SESSION_REGISTRY.md`](../audits/UI_UX_AUDIT_SESSION_REGISTRY.md) when you
> open/merge a PR.

---

## Session 1 — Phase 1: First paint (CRITICAL)

**Branch:** `cursor/ui-ux-phase1-first-paint-8c0a`  
**Also:** `@.github/prompts/ui-ux-audit-phase1-first-paint.prompt.md`

```md
You are the senior product engineer for Gold Ticker Live (vctb12/GoldTickerLive). Execute **Session 1 / Phase 1 only** — fix the first-paint "Loading…/—" problem. Do not start homepage declutter, nav slim, or CSS splits (later sessions).

Read first:
1. AGENTS.md
2. docs/plans/2026-06-01_ui-ux-audit-remediation-program.md (Phase 1 checklist)
3. .github/instructions/gold-pricing.instructions.md
4. .github/instructions/frontend-mobile.instructions.md
5. src/lib/api.js, src/lib/cache.js (or equivalent cache module)

Non-negotiables:
- AED peg 3.6725; reference ≠ retail; freshness labels stay visible
- EN/AR via src/config/translations.js only
- Safe DOM (src/lib/safe-dom.js); no new innerHTML sinks
- Do not modify post_gold.yml, gold-price-fetch.yml, data/gold_price.json, sw.js, src/config/constants.js without owner approval

Tasks:
1. Add reusable skeleton component + CSS utilities (shimmer sized to final price cards/tables/freshness strip)
2. Replace literal "Loading…", "Loading freshness…", "Preparing…", "Connecting…", and bare "—" placeholders on index.html, tracker.html, shops.html, invest.html, and shared country/city price mounts with skeletons
3. On load, render last-known cached prices from existing localStorage/cache immediately, then refresh from network
4. Add error empty state (icon + message + retry) when gold/FX fail and no cache — wire to api.js failure path
5. Where gold + FX are still fetched sequentially, parallelize them (avoid waterfalls)

Out of scope this session: learn static content, 404, nav IA, homepage section removal, global.css split

Verify:
- npm test, npm run lint, npm run validate, npm run build
- Manual: 360px LTR + RTL, throttled network, offline after cache warm

PR body: What / Why / How / Proof / Risks. Update UI_UX_AUDIT_SESSION_REGISTRY.md and Phase 1 checkboxes in the program doc.
```

---

## Session 2 — Phase 2: Empty / abandoned pages (CRITICAL)

**Branch:** `cursor/ui-ux-phase2-empty-pages-8c0a`  
**Also:** `@.github/prompts/ui-ux-audit-phase2-empty-pages.prompt.md`

```md
You are the senior product engineer for Gold Ticker Live. Execute **Session 2 / Phase 2 only** — fix pages that look empty or abandoned. Session 1 (skeletons + cache-first prices) must already be on main.

Read first:
1. AGENTS.md
2. docs/plans/2026-06-01_ui-ux-audit-remediation-program.md (Phase 2 + decision log)
3. learn.html, src/pages/learn.js, invest.html, shops.html
4. .github/instructions/content-country-pages.instructions.md (for 404/links only)

Tasks:
1. **Learn:** Full educational body visible without JS (static HTML fallback); section cards, in-page TOC, anchors matching homepage #karats references; JS enhances, does not replace
2. **Invest:** Real anchor text on every link; budget widget uses skeletons then real values; theme-color → site gold (#d4a017 or --color-* token); **Decision required in PR:** rebuild properly OR 301 to /content/guides/ + remove from nav — only remove noindex if page has real content
3. **Shops:** Skeleton listing cards; empty state copy ("No listings match your filters"); fix 0/0/0 counters to reflect loaded data; if Supabase data cannot load, document blocker and propose nav hide (do not fake listings)
4. **404:** Branded 404.html (nav + footer + search + popular links); ensure GitHub Pages serves it

Reuse Session 1 skeleton/error patterns where prices appear.

Verify: npm test, npm run validate, npm run build; curl/static check that learn.html has substantive body without JS

PR: note Invest decision in Risks. Update registry + program checkboxes.
```

---

## Session 3 — Phase 3: Consistency (HIGH)

**Branch:** `cursor/ui-ux-phase3-consistency-8c0a`  
**Optional splits:** `cursor/ui-ux-phase3a-naming-karats-8c0a`, `cursor/ui-ux-phase3b-nav-canonical-8c0a`

```md
You are the senior product engineer for Gold Ticker Live. Execute **Session 3 / Phase 3** — single sources of truth for brand, data attribution, karats, chrome coverage, and country URLs.

Read first:
1. AGENTS.md + docs/plans/2026-06-01_ui-ux-audit-remediation-program.md
2. src/config/karats.js, translations.js, constants.js (read-only unless owner-approved)
3. src/components/nav.js, footer.js, nav-data.js
4. .github/instructions/seo.instructions.md
5. PLAN.md (primary data source line — align copy with owner truth)

Tasks:
1. Naming: "Gold Ticker Live" everywhere user-facing; remove "Gold Tracker Pro" from tracker onboarding; "Gold Command Center" only as subsection label if kept
2. Attribution: one gold source + one FX source + one refresh statement across homepage, methodology, footer, meta — e.g. "source updates hourly; page re-polls ~90s" if accurate
3. Karats: drive homepage, calculator, tracker, methodology tables from src/config/karats.js; fix marketing "7 karats" claims to match list
4. Mount nav.js + footer.js on buying guide, content guides hub, country pages, city pages missing chrome
5. Country URLs: pick canonical pattern (/countries/uae/gold-price/ vs /countries/uae/); 301 + rel=canonical via generator — regen sitemap

Do not declutter homepage sections (Session 4). Do not split global.css (Session 5).

Verify: npm test, npm run validate, npm run build; tests for karat list parity if pattern exists; spot-check 3 country pairs for canonical

If >40 files: stop and land 3a (naming+karats+attribution) first, then 3b in follow-up PR.
```

---

## Session 4 — Phase 4: Nav & layout polish (MEDIUM)

**Branch:** `cursor/ui-ux-phase4-nav-layout-8c0a`

```md
You are the senior product engineer for Gold Ticker Live. Execute **Session 4 / Phase 4** — navigation slimming and layout declutter. Sessions 1–3 must be on main.

Read first:
1. AGENTS.md, docs/plans/2026-06-01_ui-ux-audit-remediation-program.md
2. src/components/nav-data.js, nav.js
3. index.html, src/pages/home.js, tracker.html, styles/pages/home.css, tracker-pro.css
4. .github/prompts/mobile-ux-audit.prompt.md

Tasks:
1. Nav: reduce 6 dropdown groups to ~4–5 top-level items; mobile accordion sections; optional search-in-menu; keyboard focus order; ARIA attributes with tests if nav test pattern exists
2. Homepage: ONE hero price card + ONE karat table + ONE country grid + tools + FAQ — remove duplicate market snapshot / command card / repeated karat blocks
3. Tracker: clearer spacing/grouping for 7 mode tabs; empty tables use skeletons not blank rows
4. Global interactive states: hover + focus-visible rings using design tokens in global.css

Benchmark: first-time visitor sees a real price within ~1s (cache-first from Session 1) and any tool within two clicks.

Verify: npm test, npm run validate, npm run build; 360px RTL screenshots for nav + homepage + tracker
```

---

## Session 5 — Phase 5: Performance & hygiene (MEDIUM/LOW)

**Branch:** `cursor/ui-ux-phase5-performance-8c0a`

```md
You are the senior product engineer for Gold Ticker Live. Execute **Session 5 / Phase 5** — performance and hygiene. **Skip entirely if an SPA/framework migration is approved** (note in PR and close session as skipped).

Read first:
1. AGENTS.md, docs/plans/2026-06-01_ui-ux-audit-remediation-program.md
2. styles/global.css, vite.config.*, docs/PERFORMANCE.md
3. .github/prompts/accessibility-audit.prompt.md

Tasks:
1. Split global.css into partials (tokens, base, layout, components, utilities) imported through build; :root tokens remain single source
2. loading="lazy" on images/iframes; add WebP/srcset where images are maintained in-repo
3. AdSense slots: either working fill or remove empty layout holes
4. Wire basic a11y check into CI (contrast on gold text, form labels, alt) — extend existing validate if possible

Verify: npm run build, npm run validate, npm test; Lighthouse comparison note (before/after if run)

Do not change pricing logic or service worker caching semantics without explicit plan entry.
```

---

## Quick reference — session order

```
Session 0 (planning) → merge
Session 1 (first paint) → merge  ← highest ROI
Session 2 (empty pages) → merge
Session 3 (consistency) → merge
Session 4 (nav/layout) → merge
Session 5 (performance) → merge or skip
```






# Gold Ticker Live — Cursor Prompt Library

**Every prompt below is ready to paste into Cursor Composer.** Start a fresh chat for each.

---

## CATEGORY 1: UI / VISUAL / DESIGN PROMPTS

### UI-1: Navigation bar overhaul
```
Read @src/components/nav.js @src/components/nav-data.js and find all nav CSS in @styles/global.css

The nav bar appears on every page. It currently has 6 dropdown groups with 40+ links.
On mobile it becomes an endless scroll.

DO ALL OF THIS:

1. Restructure nav-data.js: collapse to 4 groups maximum:
   - Prices (homepage, tracker, countries dropdown)
   - Tools (calculator, shops, price history)
   - Learn (guides hub, methodology, insights)
   - About (methodology, privacy, terms)

2. Sticky nav with scroll awareness:
   - Add backdrop-filter: blur(12px) when scrolled
   - Show subtle bottom border shadow on scroll (toggle .nav--scrolled class via
     IntersectionObserver on a sentinel element at top of page)
   - Ensure spot bar below nav doesn't break the sticky behavior

3. Active page indicator:
   - Match location.pathname against nav hrefs
   - Active link gets gold bottom border or bold weight
   - Works on both desktop and mobile

4. Mobile menu redesign:
   - Hamburger → X icon with smooth CSS rotation transition
   - Menu slides in from inline-end (RTL-aware) with 250ms transform
   - Backdrop overlay behind menu (dark semi-transparent)
   - Body scroll lock when menu is open
   - Each nav group is a collapsible accordion section
   - Touch targets ≥ 44px on every link

5. Language toggle: clear hover state, smooth text swap animation

6. All nav interactive elements:
   - Hover underline slide (::after pseudo-element)
   - Focus-visible gold ring
   - Min-height 44px

Commit: "feat(nav): sticky blur, 4-group slim, mobile slide-in, active indicator"
```

### UI-2: Homepage landing page redesign
```
Read @index.html @src/pages/home.js @styles/pages/home.css

The homepage has 10+ sections that repeat the same price data. Consolidate to 5 sections
that make an immediate impact.

SECTION 1 — HERO (above the fold):
- Large spot price: XAU/USD with countUp animation on load (800ms, dramatic)
- Price direction: ▲ green or ▼ red arrow with smooth color transition
- Market status: "Market Open" with green pulse dot, or "Closed — opens in Xh Ym"
- "Updated X seconds ago" live counter (setInterval every second)
- AED 24K/g price below spot (the number GCC users actually want)
- Subtle gold gradient background that slowly shifts (CSS animation, 20s cycle)
- CTA: "Open Live Tracker →" button with shimmer effect

SECTION 2 — KARAT STRIP:
- 24K | 22K | 21K | 18K horizontal cards
- Each card: karat label, AED/gram price, animated countUp
- On hover: tooltip showing "per gram · per tola · per oz" values
- Hover lift + gold border glow

SECTION 3 — GCC MARKET GRID:
- 8 country cards with flags (UAE, Saudi, Kuwait, Qatar, Oman, Bahrain, Egypt, Jordan)
- Each card: flag, country name, 22K/gram price, currency
- On hover: card lifts, "View live prices →" text fades in
- Stagger animation on first paint (50ms per card)

SECTION 4 — TOOLS ROW:
- 4 cards: Tracker, Calculator, Shops, Learn
- Each card: icon, title, 1-line description, "Open →" link
- Hover lift + gold accent

SECTION 5 — FAQ:
- 5-6 questions about gold pricing in GCC
- Smooth accordion expand with max-height transition
- FAQPage schema markup

DELETE: all duplicate sections — "Market snapshot", "command card", second karat table,
"by the numbers", "what should I check next", "Browse by Country" (merged into GCC grid),
"Major Gold Markets", methodology teaser, city-guides teaser.

The homepage should be 1 screen of immediate data + 3 screens of useful tools and context.
Not 10 screens of repeated prices with marketing copy.

Commit: "feat(home): redesign — 5-section layout, delete redundant blocks"
```

### UI-3: Tracker terminal redesign
```
Read @tracker.html @src/pages/tracker-pro.js @src/tracker/hero.js @styles/pages/tracker-pro.css

The tracker is a powerful tool buried under complexity. Simplify the surface, keep the power.

1. HERO AREA:
   - Large XAU/USD price with countUp + gold pulse on update
   - Day change: +/- amount and % with green/red color, smooth transition
   - Market status badge with pulse dot when open
   - AED 24K/g, AED 22K/g stat cards with countUp
   - Freshness badge prominent

2. CHART:
   - Range pills: 1D / 1W / 1M / 3M / 1Y — gold active state, smooth transition
   - Chart switches with brief opacity crossfade (250ms)
   - Responsive canvas, readable axis labels at 375px

3. KARAT TABLE:
   - Clean table with .table-interactive row hover
   - Selected row: gold left border (RTL: right border)
   - Tabular nums on all price cells
   - Unit toggle (gram/oz/tola) in table header
   - Copy any cell with copy-toast

4. CONTROLS:
   - Karat / unit / currency selectors: gold focus glow
   - Keyboard shortcuts shown in footer: K (karat), U (unit), Shift+C (copy)

5. MODE TABS:
   - Consolidate 7 tabs to 3: Live, Compare, Tools (export/alerts/planner as sub-tabs)
   - Tab switch with crossfade (use .tab-panels--crossfade CSS)

6. MOBILE:
   - Full-width stacked panels
   - Range pills wrap to 2 rows if needed
   - Karat table: horizontal scroll with visible scroll affordance
   - Bottom dock: proper spacing, no content overlap

7. REMOVE/SIMPLIFY:
   - "Welcome to Gold Tracker Pro" modal → rename to "Gold Ticker Live" or remove entirely
   - Reduce onboarding to a single dismissible tip bar

Commit: "feat(tracker): declutter, 3-mode tabs, hero polish, mobile stack"
```

### UI-4: Global visual system rollout
```
Read @styles/global.css — find the interaction system (cards, buttons, links, inputs, tables)

Roll the global interaction system to EVERY page that doesn't have it yet.
Go through each page one by one:

For EACH page (calculator, shops, country pages, learn, insights, methodology, guides):
1. Find every card-like element → add .card-interactive class
2. Find every primary CTA → add .btn--shimmer class
3. Find every form input/select → verify gold focus glow (no competing border styles)
4. Find every data table → add .table-interactive class
5. Find every section heading → add [data-reveal] for scroll animation
6. Find every price display → verify font-variant-numeric: tabular-nums
7. Find every grid of cards → add [data-reveal-stagger] on parent

Check at 375px width: no overflow, all touch targets ≥ 44px.

Commit per page: "feat({page}): apply global interaction system"
```

### UI-5: Mobile-first audit (every page at 375px)
```
Go through EVERY page at 375px viewport width. For each page:

HOMEPAGE:
- Hero text: readable? No overflow?
- GCC grid: 2 columns? Cards don't overlap?
- Quick-convert: inputs full-width? Usable with thumb?
- All buttons: ≥ 44px touch target?

TRACKER:
- Range pills: wrap to 2 rows? Don't overflow?
- Karat table: horizontal scroll with scroll indicator?
- Controls: full-width selects?
- Mobile dock: no content overlap?

CALCULATOR:
- Inputs: full-width with labels above?
- Purity ring: sized for mobile?
- Shop panel: stacks vertically?
- Result: large and prominent?

SHOPS:
- Filter bar: collapses on mobile?
- Cards: single column?
- Touch targets on action buttons?

COUNTRY PAGES:
- Karat grid: 2 columns?
- City links: full-width?
- FAQ: readable expand/collapse?

ALL PAGES:
- No text < 14px
- No horizontal overflow (check with body { outline: 1px solid red })
- No z-index overlap between nav, modals, bottom dock
- Footer: all links tappable

Fix CSS in each page's own stylesheet. Only add to global.css if the fix is shared.

Commit per page: "fix({page}): mobile 375px — overflow, touch targets, stacking"
```

---

## CATEGORY 2: FRONTEND / CODE PROMPTS

### FE-1: Kill the loading wall (first-paint fix)
```
Read @src/lib/api.js @src/lib/cache.js @index.html @tracker.html @shops.html

Every page that fetches data currently shows "Loading..." or "—" placeholders.
This makes the entire site look broken on first visit.

FIX:

1. Create reusable skeleton loader CSS utility in global.css:
   .skeleton-card: card-shaped shimmer placeholder
   .skeleton-text: single line shimmer
   .skeleton-price: large price-shaped shimmer
   All use the existing skeleton gradient animation.

2. In src/lib/cache.js: add getLastKnownGoldPrice() and getLastKnownFxRates()
   that return the most recent cached values instantly (no async, no fetch).

3. In every page's init function:
   - IMMEDIATELY render last-known cached prices on load (before any fetch)
   - Show skeleton ONLY if there's zero cached data
   - When fresh data arrives, countUp from cached → fresh value

4. In src/lib/api.js: parallelize fetchGold() and fetchFxRates()
   (currently sequential — gold fetches first, then FX, then calculate, then render)
   Use Promise.all([fetchGold(), fetchFxRates()]) or Promise.allSettled()

5. Create src/lib/error-state.js:
   - showErrorState(container, { message, onRetry, lang })
   - Renders: icon + message + "Retry" button
   - On retry: spinner on button, re-fetch, hide on success
   - Wire into every fetchGold().catch() handler

6. Replace every literal "Loading..." text with skeleton elements
   in: index.html, tracker.html, shops.html, calculator.html, invest.html,
   all country pages, all city gold-rate pages.

Commit: "feat: cache-first render, parallel fetch, skeleton loaders, error states"
```

### FE-2: CSS architecture split
```
Read @styles/global.css (4,548 lines)

Split global.css into logical partials. Do NOT change any styles — only reorganize.

Create:
- styles/tokens.css — :root custom properties (colors, spacing, typography, shadows, etc.)
- styles/base.css — reset, body, html, typography, base elements (h1-h6, p, a, ul, etc.)
- styles/layout.css — containers, grids, responsive breakpoints, page-level layout
- styles/components.css — cards, buttons, badges, forms, tables, toast, skeleton, nav, footer
- styles/utilities.css — helpers, animations, keyframes, reduced-motion, print styles
- styles/global.css — just @import statements for the above 5 files (or inline them)

Rules:
- Every CSS rule moves to exactly one file
- No rule appears in two files
- The cascade order must be preserved: tokens → base → layout → components → utilities
- Dark mode overrides stay with the components they modify
- Page-specific CSS files (styles/pages/*.css) stay where they are

After splitting: verify every page renders identically. No visual changes.

Commit: "refactor: split global.css into tokens/base/layout/components/utilities"
```

### FE-3: Dead code elimination
```
Read @src/ recursively.

Find and remove:
1. Every exported function with zero callers (grep for the function name across all files)
2. Every imported module that's never used in the importing file
3. Every CSS class that exists in stylesheets but is never referenced in any HTML or JS
4. Every file in src/ that is not imported or referenced by any other file
5. Every translation key in translations.js that is not referenced in any JS file

For each removal: verify npm test still passes BEFORE moving to the next one.

Do NOT remove:
- Anything referenced in tests (it's used)
- Anything in config/ (may be consumed dynamically)
- Anything in the service worker precache list

Commit after every 5 removals: "chore: remove N dead exports/files/classes"
```

### FE-4: Translations audit
```
Read @src/config/translations.js

Every user-visible string on the website must be in translations.js with both EN and AR keys.

1. Grep all HTML files for hardcoded English text that should be translatable
   (button labels, headings, placeholder text, error messages, tooltips)
2. For each found: add a translation key, wire it through the JS render path
3. Verify all existing AR translations are complete (no EN fallbacks showing in AR mode)
4. Check for orphan keys: translations that exist but are never referenced in code

Commit: "feat(i18n): complete EN/AR translation coverage"
```

---

## CATEGORY 3: BACKEND / DATA PROMPTS

### BE-1: Data pipeline audit
```
Read @src/lib/api.js @src/lib/cache.js @data/gold_price.json
Read @.github/workflows/ for all automation

Audit the data pipeline end-to-end:

1. Gold price source: what API is actually called? Is it gold-api.com per CLAUDE.md
   or goldpricez.com per the homepage? Make them match.

2. FX rate source: what's the actual endpoint? Update all documentation to match.

3. Refresh cadence:
   - Server-side: what does the GitHub Action hourly_post.yml actually do?
   - Client-side: what's the actual setInterval value in api.js?
   - Document the truth: "Spot data committed hourly; browser re-polls every 90 seconds"

4. Cache strategy: verify cache.js TTLs are appropriate
   - Gold price: how long before stale?
   - FX rates: how long before stale?
   - Are stale values shown with correct freshness badges?

5. Fallback tiers: verify methodology page matches actual fallback behavior:
   - Primary: live API
   - Fallback 1: cached data from localStorage
   - Fallback 2: data/gold_price.json (embedded snapshot)
   - What actually happens on total failure?

Fix any mismatches between documentation and code.

Commit: "fix: align data source docs with actual API calls + cache TTLs"
```

### BE-2: Service worker audit
```
Read @sw.js completely.

1. Compare every URL in PRECACHE_URLS against actual files on disk.
   Remove entries for files that don't exist.
   Add entries for files created in recent sessions:
   copy-toast.js, page-enter.js, lazy-section.js, KaratPurityIndicator.js,
   QuickConvertWidget.js, ShopVsReferencePanel.js, RelatedGuides.js,
   control-shortcuts.js, content-page-boot.js, data-status-banner.js,
   learn-hub-ui.js, learn-hub-catalog.js, methodology-live.js, stub-city.css

2. Verify API caching strategy:
   - gold-api.com: network-first (data must be fresh)
   - exchangerate-api.com: network-first
   - Static assets: cache-first (CSS, JS, HTML)
   - Never cache: admin/, server/

3. Bump cache version (currently v17 → v18)

4. Run scripts/node/check-sw-precache.js --fail-on-error to verify

Commit: "fix(sw): precache audit v18 — sync with current file tree"
```

### BE-3: Supabase + shops data
```
Read @supabase/ @data/shops.js @src/pages/shops.js

The shops page shows "0 Shops / 0 Countries" on load.

1. Is the shops data coming from Supabase or from data/shops.js?
   If Supabase: verify the connection works, add error handling
   If data/shops.js: verify the file has real data, not empty arrays

2. Add a loading skeleton for shop cards (3 placeholder cards with shimmer)

3. Add a real empty state:
   "No gold shops match your filters. Try broadening your search."
   With icon + clear filters button

4. If shops data works: verify the filter/sort/group features from Session 5
5. If shops data is broken: fall back to data/shops.js hardcoded data
   and show a "Directory data may not be current" disclaimer

Commit: "fix(shops): data loading, skeleton, empty state"
```

---

## CATEGORY 4: INTEGRATION / CROSS-PAGE PROMPTS

### INT-1: Full link integrity audit
```
Find every <a href="..."> in the entire repo (all HTML + JS template strings).

For each internal link (not starting with http:// or https://):
1. Resolve the href relative to the file it's in
2. Check if the target file exists on disk
3. If not: fix the link or add a _redirects rule

Also check:
- Every nav link in src/components/nav-data.js → does the target exist?
- Every link in footer.js → target exists?
- Every RelatedGuides href → target exists?
- Every breadcrumb URL → target exists?
- sitemap.xml: every <loc> resolves to a real file that is not noindex
- _redirects: no redirect points to a file that also doesn't exist

Create a report of all broken links found and fixed.

Commit: "fix: link integrity audit — N broken links fixed"
```

### INT-2: Deep-link state preservation
```
Read @src/pages/home.js @src/pages/tracker-pro.js @src/pages/calculator.js

Verify these user flows preserve state across pages:

1. Homepage "Open Tracker" button:
   - Should pass current karat strip unit preference in URL hash
   - Tracker should read #mode=live&cur=AED&k=24&u=gram and set those values on load
   - Verify: click button, check tracker state matches

2. Homepage quick-convert "Open full calculator →":
   - Should pass weight, karat, unit to calculator via URL params
   - Calculator should pre-fill those values on load
   - Verify: set 10g/22K in quick-convert, click, check calculator has same values

3. Tracker inline calculator "Open full calculator":
   - Should pass current karat, currency, spot price
   - Calculator should use those values

4. Calculator "Find gold shops →" (add if missing):
   - Should link to shops.html?country={relevant country}
   - Shops should pre-filter to that country

5. Shop "View gold rates" per shop:
   - Should link to /countries/{country}/{city}/gold-rate/
   - Verify the target page exists and renders

For each flow: test it, fix any broken state transfer, commit.

Commit: "feat: cross-page deep-link state preservation"
```

### INT-3: RTL / Arabic full audit
```
Switch every major page to Arabic (?lang=ar or via language toggle).

For each page, verify:
1. Layout flips to dir="rtl"
2. All text is Arabic (no untranslated English strings)
3. Navigation works correctly in RTL
4. Price displays still work (numbers are LTR inside RTL context)
5. Hover effects work (slide-in from inline-start, not hardcoded left)
6. Tooltips appear in correct position
7. Cards, grids, flexbox layouts don't break
8. Mobile hamburger menu works in RTL
9. Breadcrumbs read right-to-left
10. Copy-toast appears correctly

Fix every RTL issue found.

Commit: "fix(rtl): full Arabic layout audit"
```

---

## CATEGORY 5: MONETIZATION PROMPTS

### MON-1: AdSense optimization
```
Read every HTML file that has an AdSense script or ad slot.

1. Find all ad slot containers (google-ad, ad-slot, adsbygoogle, etc.)
2. For each: is it rendering an ad or just empty white space?
3. If empty: either fix the ad unit config or remove the container entirely
   (empty ad slots create ugly layout holes)
4. Ensure ads don't shift layout on load (reserve space with min-height)
5. Verify ads don't appear on noindex pages (waste of impressions)
6. Add proper ad labeling for transparency ("Advertisement" text above each slot)

Commit: "fix: AdSense slots — remove empties, reserve space, add labels"
```

### MON-2: Affiliate integration for shops
```
Read @src/pages/shops.js @data/shops.js

The shops directory is a natural affiliate monetization surface.

1. Add an "affiliate" or "partner" field to the shops data schema
2. For shops with affiliate links: add rel="sponsored" and UTM parameters
3. Add a "Partner shop" badge (distinct from regular listings)
4. Track affiliate link clicks via analytics
5. Add a disclosure notice: "Some listings include affiliate partnerships"
6. Keep non-affiliate shops prominent — never bury them

Commit: "feat(shops): affiliate link support with disclosure"
```

### MON-3: Gold price API documentation page
```
Create content/api-docs/index.html

Build a page for developers who want to use gold price data:
1. Explain what data is available (spot XAU/USD, FX rates, historical)
2. Show the data/gold_price.json format
3. Explain the hourly update cadence
4. Add attribution requirements
5. Include code examples (fetch + parse)
6. Link to the methodology page for formula details
7. This becomes an SEO page targeting "gold price API" keywords

Commit: "feat: gold price API documentation page"
```

---

## CATEGORY 6: AI INTEGRATION PROMPTS

### AI-1: AI-powered gold assistant chat
```
Create @src/components/AiGoldChat.js

Build a lightweight "Ask about gold" chat widget using the Anthropic API:

1. Widget UI:
   - Floating button (bottom-right, above any bottom nav)
   - Click to expand chat panel (slide up, 400px tall)
   - Input field + send button
   - Message history (scrollable)
   - "Powered by Claude" attribution

2. System prompt for the API:
   "You are a gold market assistant for Gold Ticker Live. You answer questions
   about gold prices, karats, buying gold in GCC countries, making charges,
   and the AED peg. You use current data: AED peg is 3.6725, spot XAU/USD
   is [inject current price]. You are NOT a financial advisor. Always add
   a disclaimer for investment questions."

3. Pre-seeded quick questions:
   - "What's the difference between 22K and 24K?"
   - "Why is gold cheaper in Dubai?"
   - "Should I buy gold now?" (disclaimer response)

4. Inject current spot price into system prompt from cache
5. Rate limit: max 10 messages per session (localStorage counter)
6. Works in both EN and AR

Commit: "feat: AI gold assistant chat widget"
```

### AI-2: AI daily market commentary
```
Create @src/lib/ai-commentary.js

Auto-generate a brief daily market commentary from price data:

1. On insights page load (if data is >4 hours old or missing):
   - Gather: current spot, day change %, week change %, 12-month average
   - Send to Anthropic API with prompt:
     "Write a 2-sentence market commentary for GCC gold buyers. Current spot:
     $X. Day change: Y%. The tone should be neutral and informative.
     Do NOT give buy/sell advice. Just state what happened and possible context."

2. Cache the commentary for 4 hours in localStorage
3. Display in the insights "Market pulse" section
4. Add "AI-generated summary" label
5. Falls back to static text if API fails

Commit: "feat: AI-generated daily market commentary on insights"
```

### AI-3: Smart search with embeddings
```
Read @src/search/searchEngine.js @content/search/index.html

Enhance the site search with AI:

1. Keep the existing keyword search as the fast default
2. Add a "smart search" toggle that uses the Anthropic API
3. Smart search: user types natural language question
   → Claude classifies intent (price lookup, guide, tool, shop, country)
   → Return the most relevant page/section with a snippet
4. Examples:
   - "gold price in Dubai" → /countries/uae/dubai/gold-rate/
   - "how to check fake gold" → /content/guides/how-to-spot-fake-gold/
   - "calculator" → /calculator.html
   - "22K vs 24K" → /content/guides/24k-vs-22k-vs-18k-gold/

Commit: "feat: AI-powered smart search"
```

---

## CATEGORY 7: REPO / ARCHITECTURE PROMPTS

### REPO-1: Git hygiene (URGENT — do first)
```
1. Check if node_modules/ is committed to git.
   If yes: add to .gitignore, remove from tracking:
   git rm -r --cached node_modules/
   Commit: "chore: remove node_modules from git"

2. Check if dist/ is committed to git.
   If yes: add to .gitignore, remove from tracking:
   git rm -r --cached dist/
   Commit: "chore: remove dist from git"

3. Delete .replit if it exists (not used)

4. Verify .gitignore has:
   node_modules/
   dist/
   .env
   .env.local
   *.log
   .DS_Store
   Thumbs.db

Commit: "chore: git hygiene — .gitignore, remove tracked artifacts"
```

### REPO-2: Documentation update
```
Read @CLAUDE.md @README.md @PLAN.md @docs/plans/README.md

Update ALL documentation to match the current state of the repo:

1. CLAUDE.md:
   - Verify architecture section matches actual file structure
   - Add recent modules (copy-toast, page-enter, content-page-boot, etc.)
   - Update the key modules table
   - Add the Session 1-7 summary as "Recent changes" section

2. README.md:
   - Product name: "Gold Ticker Live" (not "GoldPrices")
   - Feature list should match what actually works
   - Remove claims about features that don't work yet
   - Fix karat count to match config/karats.js
   - Fix data source to match actual API calls
   - Fix refresh cadence to match reality

3. PLAN.md:
   - Mark completed sessions as done
   - Add upcoming sessions from the master program
   - Remove stale "In Progress" items that are actually done

4. docs/plans/README.md:
   - Update status of every plan file
   - Add new plan files from Sessions 4-7
   - Remove or archive plans that are fully completed

Commit: "docs: comprehensive documentation update to match current state"
```

### REPO-3: Test coverage expansion
```
Read @tests/ directory. Understand what's tested.

Add tests for:
1. copy-toast.js: show/hide toast, clipboard mock
2. count-up.js: animates from start to target, pulse option
3. page-enter.js: adds correct class, respects reduced motion
4. content-page-boot.js: injects nav/footer/breadcrumbs/related-guides
5. QuickConvertWidget.js: calculates correct AED value for given weight/karat
6. ShopVsReferencePanel.js: renders correct making charge range
7. KaratPurityIndicator.js: renders correct purity percentage

Each test file goes in tests/ matching the source file name.
Use the existing test patterns (node:test, assert/strict).

Commit: "test: add coverage for Session 4-7 modules"
```

---

## CATEGORY 8: SEO / CONTENT PROMPTS

### SEO-1: Schema markup completeness
```
Audit every indexable HTML page for schema markup:

HOMEPAGE: needs WebSite + Organization + SiteNavigationElement
EVERY PAGE: needs WebPage + BreadcrumbList
COUNTRY PAGES: needs FAQPage (if has FAQ) + Product (gold price with currency)
CONTENT GUIDES: needs Article or HowTo schema
CALCULATOR: needs WebApplication schema
METHODOLOGY: needs FAQPage schema

For each missing schema: add it as a <script type="application/ld+json"> in <head>.
Use accurate data — don't fabricate. Prices should reference the live data or be omitted.

Commit: "feat(seo): comprehensive schema markup on all indexable pages"
```

### SEO-2: Meta tag audit
```
For every indexable HTML page in the repo:

Check and fix:
1. <title> — unique, descriptive, < 60 chars
2. <meta name="description"> — unique, < 160 chars, includes target keyword
3. <link rel="canonical"> — correct, absolute URL
4. <meta property="og:title"> — matches <title>
5. <meta property="og:description"> — matches meta description
6. <meta property="og:url"> — matches canonical
7. <meta property="og:image"> — points to existing og-image.png
8. <meta name="twitter:card"> — summary_large_image
9. og:url === canonical (they must match exactly)
10. No page should have duplicate title or description as another page

Create a report of all fixes made.

Commit: "fix(seo): meta tag audit — titles, descriptions, canonicals, og tags"
```

---

## HOW TO USE THESE PROMPTS

1. Start a FRESH Cursor Composer chat for each prompt
2. Paste the prompt exactly as written
3. Add @file references for the specific files mentioned
4. Let Composer execute fully
5. Review the changes before accepting
6. After each commit: git push to keep a checkpoint
7. After each session: update PLAN.md and REVAMP_PLAN.md

### Recommended execution order:
```
Week 1: REPO-1 (git hygiene) → FE-1 (loading wall) → UI-2 (homepage)
Week 2: UI-1 (nav) → UI-3 (tracker) → INT-1 (links)
Week 3: UI-4 (global rollout) → UI-5 (mobile) → FE-2 (CSS split)
Week 4: BE-1 (data) → BE-2 (SW) → BE-3 (shops)
Week 5: INT-2 (deep links) → INT-3 (RTL) → SEO-1 + SEO-2
Week 6: MON-1 → AI-1 → REPO-2 (docs) → REPO-3 (tests)
```

Or: run the "Always Something" and "Visual Sweep" reusable prompts
between dedicated sessions to keep momentum.
