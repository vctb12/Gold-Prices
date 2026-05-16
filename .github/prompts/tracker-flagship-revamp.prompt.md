---
mode: agent
description: Push the Tracker page (`tracker.html`) toward a flagship gold-intelligence workspace — live price + historical + presets + compare + watchlist + alerts + exports.
related_skills:
  - mobile-ux-review
  - pricing-data-integrity
  - frontend-design-system
related_instructions:
  - .github/instructions/frontend-mobile.instructions.md
  - .github/instructions/gold-pricing.instructions.md
  - .github/instructions/accessibility.instructions.md
---

# Prompt: Tracker Flagship Revamp

The Tracker is the flagship of Gold Ticker Live. Treat it as a workspace, not a landing page.

## Goal

Transform `tracker.html` into a premium, mobile-first gold-intelligence workspace that:

- Surfaces the **live spot-linked price** with freshness state, source, and UTC timestamp
- Hosts a **historical chart** with range presets (1H / 24H / 7D / 30D / 1Y / 5Y / max)
- Supports **compare** (multi-country / multi-karat overlay)
- Exposes **watchlist** and **alerts** entries
- Provides **CSV / JSON export**
- Reads beautifully at 360 / 390 / 430 px in EN and AR

## Required inspection

1. `tracker.html` + `styles/pages/tracker.css` + `src/tracker/**` + `src/pages/tracker.js`
2. `docs/tracker-state.md` — current architecture
3. `docs/REVAMP_PLAN.md` — active tracker tracks
4. `src/lib/price-calculator.js`, `src/config/karats.js`, `src/lib/api.js`, `src/lib/cache.js`
5. [`pricing-data-integrity/SKILL.md`](../skills/pricing-data-integrity/SKILL.md)
6. [`mobile-ux-review/checklists/tracker.md`](../skills/mobile-ux-review/checklists/tracker.md)

## Permission

This is a Level 5 task (product-level transformation). You **may**:

- Significantly restructure the page layout
- Consolidate / rebuild components
- Introduce new tokens with rationale
- Reshape the URL parameter contract **if** you preserve back-compat for shared links

You **may not**:

- Change pricing formulas, AED peg, troy-oz constant, or karat factors
- Remove freshness labels, methodology link, or source attribution
- Add a runtime framework or heavy charting library without owner approval
- Break the existing tracker URL contract for shared links
- Migrate state to a service-side store without an approved plan

## Implementation expectations

- Plan first if scope > 4h: write `docs/plans/YYYY-MM-DD_tracker-revamp.md` and open a draft PR
- Coherent commits per concern: tokens → control bar → price card → chart → presets → compare
- Every visible price has a state label + source + UTC timestamp
- `aria-live="polite"` on the price card
- Tables → cards on small screens
- CSV/JSON export includes `source`, `resolution`, `timezone`, `disclaimer` fields
- AR / RTL tested at 360 px for every changed area
- Service worker cache version bumped if cached assets change
- No regression in `check-unsafe-dom` baseline

## Verification

```bash
rm -rf playwright-report test-results
npm run lint
npm test
npm run validate
npm run build
npm run preview     # spot-check the built page
```

Capture before/after screenshots at 360px EN + 360px AR + 430px EN. Capture Lighthouse mobile
before/after.

## Return format

```md
# Tracker Flagship Revamp — PR <#>

## What
<one-line summary>

## Why
<the gap this closes — link to docs/REVAMP_PLAN.md section>

## Structure
- Commit 1: tokens — <summary>
- Commit 2: control bar — <summary>
- ...

## Verification
- Tests / lint / validate / build: all green (commands + counts)
- Lighthouse mobile: LCP <before>→<after>; CLS <before>→<after>
- Screenshots: <links to before/after at 360px EN, 360px AR, 430px EN>
- DOM safety: baseline unchanged / tightened by N

## Risks
- <e.g. chart library upgrade — covered by a feature flag>

## Follow-ups
- <e.g. add alerts UI in a follow-up>
```
