# Insights Page — Market Analysis Feed (BUILD 8) — 2026-05-31

```yaml plan-status
status: complete
priority: P1
class: A
owner: @vctb12
last_run_at: "2026-05-31"
last_run_pr: ""
last_run_agent: copilot
slices_remaining_estimate: 0
next_action: "Start BUILD 7 — Shops Directory (map, card redesign, filters)"
blocked_on: ""
guardrails_reviewed: true
skills_used: []
```

## Goal

Transform the insights page from a simple static card list into a rich, filterable, searchable
market analysis feed with masonry layout, category chips, contextual price callout, and animated
card entrances (Big Build Catalog — BUILD 8).

## Scope (this session)

| Area   | Deliverable                                                                                     |
| ------ | ----------------------------------------------------------------------------------------------- |
| Config | `src/config/insights-articles.js` — 15 bilingual articles, 6 categories, read-time calculator   |
| JS     | `src/pages/insights.js` — category filter, search, masonry rendering, context callout, i18n     |
| HTML   | `insights.html` — search input, category strip, masonry grid container, result meta             |
| CSS    | `styles/pages/insights.css` — masonry grid, search, category chips, context callout, animations |
| Tests  | `tests/insights-feed.test.js` — 9 tests for config completeness and read-time logic             |
| Docs   | `PLAN.md`, `CHANGELOG.md`, this plan file                                                       |

## What was built

### A) Category Filter Strip

- Horizontally scrollable chip strip with 7 categories: All, Price Analysis, Market News, Buying
  Guides, Zakat & Islamic Finance, Investment, Education
- Active category = gold-filled chip with box shadow
- Category counts shown in badges: "Price Analysis (2)"
- Clicking filters the masonry grid with smooth re-render (no page reload)
- Full bilingual EN/AR labels

### B) Client-Side Search

- Pill-shaped search input with magnifying glass icon
- Debounced 200ms — filters articles by title + excerpt text
- Escape key clears search
- No results state: "No insights match '{query}'. Try 'karat' or 'Dubai'."
- Result count shown when filter is active: "Showing 5 of 15 articles"

### C) Masonry Card Grid

- CSS `columns` masonry layout: 3 columns desktop, 2 tablet, 1 mobile
- Each card: category tag chip (color-coded), read time estimate, title, excerpt (3-line clamp),
  date, "Read →" link
- Cards animate in with `data-reveal` (opacity + translateY, respects reduced-motion)
- Hover: subtle lift with `--shadow-md` + gold border accent

### D) Contextual Price Callout

- Dynamic card inserted at position 3 in the grid (only when showing "All" category, no search)
- Compares current XAU/USD spot to 7-day baseline average
- Shows: "📈 Gold is currently ▲ up X.XX% from last week." or "📉 Gold is currently ▼ down…"
- Links to tracker page
- Updates on each 90-second price refresh

### E) Estimated Read Time

- Calculated from `wordCount` field in article config (200 wpm)
- Shown on every card: "5 min read" / "قراءة 5 دقائق"

### F) Featured Card Enhancement

- Added `data-reveal` scroll animation to existing featured article card
- 400ms ease-out entrance with `prefers-reduced-motion` fallback

### G) 15 Articles Across 6 Categories

- price-analysis (2): AED peg, UAE vs Saudi vs Kuwait
- market-news (1): GCC market hours
- buying-guide (3): best time to buy, making charges, online vs store
- islamic-finance (2): zakat guide, gold savings plans
- investment (3): beginners, bars vs coins, inflation hedge
- education (4): 24K vs 22K, hallmarks, spot fake gold, karat comparison

## Verification

- `npm run build` — green (355 modules transformed)
- `npm test` — 981 pass / 3 pre-existing failures (audit-content-pages, cache-revalidation,
  provider-failover) unchanged by this work; 9 new insights-feed tests pass.
- No lint errors introduced (eslint not installed in sandbox, but build passes)

## Rollback

- Additive only. Revert `src/config/insights-articles.js`, revert `src/pages/insights.js` and
  `insights.html` feed section, remove new CSS block from `styles/pages/insights.css`, delete
  `tests/insights-feed.test.js`. No pricing-formula or workflow changes; the AED peg (3.6725) and
  90s refresh are untouched.

## Next recommended build

- **BUILD 7 — Shops Directory**: add Leaflet map view, card redesign with specialty tags, advanced
  multi-filter UI, shop detail modal with URL deep-link, "Suggest a Shop" CTA.
- **BUILD 9 — Homepage Overhaul**: asymmetric hero layout, live sparkline strip, market context
  section, country grid with flag + price cards, animated count-up numbers.
