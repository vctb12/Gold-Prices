---
mode: agent
description: Accessibility audit — keyboard, focus, semantic HTML, forms, tables, charts, modals, contrast, RTL, screen readers.
related_skills:
  - mobile-ux-review
  - frontend-design-system
related_instructions:
  - .github/instructions/accessibility.instructions.md
  - .github/instructions/frontend-mobile.instructions.md
---

# Prompt: Accessibility Audit

Audit Gold Ticker Live's accessibility surface. Treat findings as product quality, not box-ticks.

## Scope

Default: every primary page (homepage, tracker, calculator, shops, methodology, country index +
a top country page). Adjust per user ask.

## Required inspection

1. [`accessibility.instructions.md`](../instructions/accessibility.instructions.md)
2. `docs/ACCESSIBILITY.md`
3. `.pa11yci.js` — current config
4. `styles/global.css` — focus ring tokens, reduced-motion reset
5. Each page in scope — both EN and AR

## Method

1. **Automated**: `npm run a11y` → triage findings.
2. **Keyboard**: tab through each page. Order matches visual? Focus rings visible? Esc closes
   modals?
3. **Semantic**: view source; landmarks present (`<header>`, `<nav>`, `<main>`, `<footer>`)?
   Heading hierarchy clean? Lists for lists? Buttons for buttons?
4. **Forms**: labels associated? Errors linked via `aria-describedby`? `inputmode` correct?
5. **Live regions**: price card uses `aria-live="polite"`? Errors use `assertive`?
6. **Color contrast**: verify body 4.5:1, UI 3:1 against current dark/gold theme.
7. **Reduced motion**: throttle in DevTools, verify global reset prevents animation.
8. **Screen reader**: smoke test with VoiceOver or NVDA on the tracker.
9. **RTL**: every check above also at `dir="rtl"`.

## Implementation expectations

- Fix findings inline where they are clear and isolated.
- Open follow-up issues for systemic findings (e.g. "all icon buttons missing accessible names").
- Don't add ARIA where native semantics suffice (`<button role="button">` is wrong).
- Don't auto-focus on page load.
- Preserve / strengthen the global reduced-motion reset.

## Verification

```bash
npm run a11y
npm test
npm run validate
# Manual: keyboard + screen-reader smoke on tracker
```

## Return format

```md
# Accessibility Audit — <date>

## Summary
<2–4 sentences — overall posture>

## Findings
### Blocking (WCAG AA failure)
- <page>: <issue> — <evidence> — <fix>

### Important (UX-impacting)
- ...

### Polish
- ...

## Fixes applied
- <file>: <what>

## Verification
- `npm run a11y` → <N findings before> → <N findings after>
- Keyboard smoke: tracker / calculator PASS
- Screen reader smoke: VoiceOver, tracker price update announced

## Follow-up issues opened
- <link or title>
```
