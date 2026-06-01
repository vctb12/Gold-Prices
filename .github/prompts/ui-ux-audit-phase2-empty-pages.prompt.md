---
mode: agent
description: Session 2 — Learn static body, Invest/Shops fixes, branded 404. Fixes empty/abandoned-looking pages.
related_skills:
  - mobile-ux-review
  - frontend-design-system
related_instructions:
  - .github/instructions/frontend-mobile.instructions.md
  - .github/instructions/content-country-pages.instructions.md
  - .github/instructions/testing-qa.instructions.md
---

# Prompt: UI/UX Audit — Phase 2 (Empty Pages)

**Program:** [`docs/plans/2026-06-01_ui-ux-audit-remediation-program.md`](../../docs/plans/2026-06-01_ui-ux-audit-remediation-program.md)  
**Branch:** `cursor/ui-ux-phase2-empty-pages-8c0a`  
**Prerequisite:** Session 1 merged

## Goal

Pages must not look abandoned when JS is slow or disabled. Learn ships real static content; Shops
shows honest loading/empty states; Invest is rebuilt or redirected; site has a branded 404.

## Tasks

1. **Learn** — static educational HTML + TOC; JS enhances only
2. **Invest** — anchor text, theme-color, budget widget; **PR must state:** rebuild vs redirect to guides
3. **Shops** — skeletons, empty state, real counters (or nav-hide proposal if data dead)
4. **404.html** — nav, footer, search, popular links

## Verify

`npm test` · `npm run validate` · `npm run build`  
Static check: `learn.html` has substantive body without executing JS

## Full prompt

[`docs/plans/2026-06-01_ui-ux-audit-session-prompts.md`](../../docs/plans/2026-06-01_ui-ux-audit-session-prompts.md) — Session 2
