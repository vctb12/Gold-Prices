---
mode: agent
description: Endless frontend — one JS/HTML/CSS fix per run (i18n, shell, intervals, safe DOM, placeholders).
related_skills:
  - mobile-ux-review
  - frontend-design-system
related_instructions:
  - .github/instructions/frontend-mobile.instructions.md
---

# Prompt: Endless Frontend Polish

## Goal

One frontend defect per run across HTML, `src/pages/`, `src/components/`, `styles/pages/`.

## Discovery (pick one)

- Hardcoded user-visible string → `src/config/translations.js` (EN+AR)
- Missing shared nav/footer on a template
- `setInterval` without `visibilitychange` / `pagehide` cleanup
- New `innerHTML` sink (forbidden — use `safe-dom.js`)
- Placeholder page with no static body fallback

## Verification

`npm test`, `npm run lint`, `npm run validate`, `npm run build`.

## Return format

Evidence → change → tests → risks.
