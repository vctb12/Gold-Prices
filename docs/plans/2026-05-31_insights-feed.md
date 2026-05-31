# Insights Feed — Market Analysis Hub (BUILD 8) — 2026-05-31

```yaml plan-status
status: complete
priority: P1
class: A
owner: @vctb12
last_run_at: "2026-05-31"
last_run_pr: ""
last_run_agent: copilot
slices_remaining_estimate: 0
next_action: "Start BUILD 7 — Shops Directory (map view, card redesign, advanced filters)"
blocked_on: ""
guardrails_reviewed: true
skills_used: []
```

## Goal

Transform the Insights page from a static three-card list into a rich, filterable market-analysis
hub (Big Build Catalog — BUILD 8): category filter strip, client-side search, masonry card grid,
read-time estimates and a live "Related to current gold price" contextual callout.

## Scope (this session)

| Area      | Deliverable                                                                                                                                                              |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Config    | `src/config/insights-data.js` — `INSIGHT_CATEGORIES` taxonomy + 12 bilingual `INSIGHTS`, each linking to an existing `content/guides/` page (no dead links)              |
| Core      | `src/lib/insights-feed-core.js` — DOM-free filter / search / read-time / category-count / price-context helpers                                                          |
| Component | `src/components/insights-feed.js` — `mountInsightsFeed()`, safe-DOM render of chips, debounced search, masonry grid, context card at position 3, no-results state, EN/AR |
| Wiring    | `insights.html` (feed mount + static fallback cards) and `src/pages/insights.js` (mount, week-ago lookup, live `setPriceContext`, language switch)                       |
| CSS       | Feed styles appended to `styles/pages/insights.css` (design tokens, CSS-columns masonry, RTL logical properties, dark mode via tokens, reduced-motion, 44px tap targets) |
| Tests     | `tests/insights-feed-core.test.js` — 18 tests covering read-time, filtering, search (EN/AR), counts, price context, config integrity                                     |

## Acceptance — verified

- Category chips filter the grid with live counts; active chip uses the gold token fill.
- Search is debounced (200 ms), case-insensitive, matches title + excerpt in the active language,
  and shows a branded no-results state with a "clear" reset.
- Masonry grid: 3 columns desktop → 2 tablet → 1 mobile (CSS `columns`, no JS layout).
- Read-time computed from per-article word count at 200 wpm; minimum 1 min; bilingual label.
- Live context card renders only when a genuine ~7-day-ago daily snapshot exists in localStorage
  (honest week-over-week), is pinned to grid position 3, and updates on the 90-second cycle.
- RTL verified in Arabic; entrance animation respects `prefers-reduced-motion`.
- `npm run lint`, stylelint, `check-unsafe-dom`, and `npm run build` all clean; full suite 993 tests
  / 990 pass (3 failures pre-existing and unrelated: audit-content-pages webpage-schema,
  cache-revalidation, provider-failover — all documented in PLAN.md).

## Notes

- The static three guide cards remain in `insights.html` inside `#insights-feed-mount` as a no-JS
  fallback; the feed component clears and replaces them at runtime (progressive enhancement).
