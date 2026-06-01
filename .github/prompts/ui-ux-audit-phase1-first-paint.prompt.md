---
mode: agent
description: Session 1 — skeleton loaders, cache-first prices, parallel gold+FX fetch, error states. Fixes the site looking "broken" on first paint.
related_skills:
  - mobile-ux-review
  - pricing-data-integrity
  - frontend-design-system
related_instructions:
  - .github/instructions/gold-pricing.instructions.md
  - .github/instructions/frontend-mobile.instructions.md
  - .github/instructions/testing-qa.instructions.md
---

# Prompt: UI/UX Audit — Phase 1 (First Paint)

**Program:** [`docs/plans/2026-06-01_ui-ux-audit-remediation-program.md`](../../docs/plans/2026-06-01_ui-ux-audit-remediation-program.md)  
**Branch:** `cursor/ui-ux-phase1-first-paint-8c0a`  
**Registry:** [`docs/audits/UI_UX_AUDIT_SESSION_REGISTRY.md`](../../docs/audits/UI_UX_AUDIT_SESSION_REGISTRY.md)

## Goal

Eliminate the dominant "dev project" signal: literal `Loading…`, `—`, and blank price surfaces on
first paint. Users should see **cached numbers or skeletons** immediately, then live data.

## Scope (in)

- Reusable skeleton component + CSS utilities
- `index.html`, `tracker.html`, `shops.html`, `invest.html`, country/city price mounts
- `src/lib/api.js` — parallel gold + FX; failure → retry UI
- Existing cache/localStorage layer — hydrate before network

## Scope (out)

- Learn static content, 404, nav IA, homepage section removal, `global.css` split
- `post_gold.yml`, `gold-price-fetch.yml`, `data/gold_price.json`, `sw.js`, `constants.js`

## Non-negotiables

- Freshness labels remain (live/cached/fallback/etc.)
- EN/AR via `src/config/translations.js`
- Safe DOM only; `npm run validate` must pass

## Verify

`npm test` · `npm run lint` · `npm run validate` · `npm run build`  
Manual: 360px LTR + RTL, throttled network, offline after cache warm

## Full task list

See Session 1 in [`docs/plans/2026-06-01_ui-ux-audit-session-prompts.md`](../../docs/plans/2026-06-01_ui-ux-audit-session-prompts.md).
