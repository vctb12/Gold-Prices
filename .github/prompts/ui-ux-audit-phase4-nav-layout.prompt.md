---
mode: agent
description: Session 4 — Slim nav, homepage declutter, tracker grouping, focus-visible polish.
related_skills:
  - mobile-ux-review
  - frontend-design-system
related_instructions:
  - .github/instructions/frontend-mobile.instructions.md
  - .github/instructions/accessibility.instructions.md
---

# Prompt: UI/UX Audit — Phase 4 (Nav & Layout)

**Program:** [`docs/plans/2026-06-01_ui-ux-audit-remediation-program.md`](../../docs/plans/2026-06-01_ui-ux-audit-remediation-program.md)  
**Branch:** `cursor/ui-ux-phase4-nav-layout-8c0a`  
**Prerequisite:** Session 3 merged

## Goal

Calmer IA and layout: fewer nav groups, no duplicate homepage price blocks, clearer tracker modes,
accessible focus states. Benchmark: real price ~1s, any tool within two clicks.

## Tasks

1. Nav 6→4–5 groups; mobile accordion; optional in-menu search; ARIA + keyboard order
2. Homepage: one hero price + one karat table + one country grid + tools + FAQ
3. Tracker: spacing for 7 modes; skeleton rows in tables
4. Global `:focus-visible` + hover using design tokens

## Verify

`npm test` · `npm run validate` · `npm run build`  
Screenshots: 360px RTL nav + homepage + tracker

## Full prompt

[`docs/plans/2026-06-01_ui-ux-audit-session-prompts.md`](../../docs/plans/2026-06-01_ui-ux-audit-session-prompts.md) — Session 4
