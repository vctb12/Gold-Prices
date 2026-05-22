# Tracker Command Center Restructure (PR 3)

```yaml plan-status
status: not-started
priority: P2
class: A
owner: @vctb12
last_run_at: ""
last_run_pr: ""
last_run_agent: copilot
slices_remaining_estimate: 0
next_action: ""
blocked_on: ""
guardrails_reviewed: true
skills_used: []
```

## Current structure (before this pass)

1. Hero + controls + trust hints
2. Mixed live workspace where chart and karat/watchlist competed in a dense side-by-side layout
3. Alerts and planner primarily behind overlay tabs
4. Exports primarily in advanced mode
5. Source/freshness cues existed but were spread across multiple sections

## Target structure (this pass)

1. Live hero cards and status (unchanged trust/freshness behavior)
2. Karat reference table first in the live flow
3. Chart and range context second, with explicit history-source label
4. Alerts and watchlist desk surfaced as a first-class section
5. Compact inline calculator panel (weight × karat × currency)
6. Export/share command section with explicit source/freshness note
7. Methodology links preserved across trust-sensitive sections
8. Export readiness pill with live/limited/blocked state driven by source + freshness

## Components/files touched

- `tracker.html`
- `src/pages/tracker-pro.js`
- `src/tracker/render.js`
- `styles/pages/tracker-pro.css`
- `src/config/translations.js`
- `tests/e2e/tracker-flow.spec.js`
- `tests/tracker-dom.test.js`

## Key risks

1. Tracker DOM contracts are strict (`tests/tracker-dom.test.js`, `tests/tracker-modes.test.js`), so
   IDs and tab structure must remain intact.
2. Live-mode density changes can regress small-screen layout at 360px/414px.
3. New inline calculator must use existing pricing helpers and must not alter core price formulas.
4. Freshness/source cues must remain visible and not be weakened.
5. Export gating must avoid silent failures; blocked states must explain why exports are paused.

## Rollback plan

1. Revert `tracker.html` and `styles/pages/tracker-pro.css` to restore previous visual hierarchy.
2. Revert `src/pages/tracker-pro.js` and `src/tracker/render.js` to remove inline command-center
   behavior additions.
3. Revert `src/config/translations.js` additions if UI keys are removed.
4. Re-run `npm test`, `npm run lint`, `npm run validate`, `npm run build`, and tracker Playwright
   smoke to confirm rollback integrity.
