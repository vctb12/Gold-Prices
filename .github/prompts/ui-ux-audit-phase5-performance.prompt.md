---
mode: agent
description: Session 5 — Split global.css partials, lazy images, AdSense gaps, a11y CI. Skip if SPA migration approved.
related_skills:
  - frontend-design-system
related_instructions:
  - .github/instructions/accessibility.instructions.md
  - .github/instructions/frontend-mobile.instructions.md
---

# Prompt: UI/UX Audit — Phase 5 (Performance & Hygiene)

**Program:** [`docs/plans/2026-06-01_ui-ux-audit-remediation-program.md`](../../docs/plans/2026-06-01_ui-ux-audit-remediation-program.md)  
**Branch:** `cursor/ui-ux-phase5-performance-8c0a`  
**Prerequisite:** Session 4 merged (or owner defers)

## Goal

Maintainability and performance hygiene without changing pricing truth or SW semantics.

## Skip condition

If owner approved SPA/framework migration → close session as **skipped** in registry; do not split CSS.

## Tasks

1. `global.css` → partials via build (`:root` tokens stay canonical)
2. `loading="lazy"`; WebP/srcset for in-repo images
3. AdSense: working ads or remove empty slots
4. Basic a11y gate in CI (contrast, labels, alt)

## Verify

`npm run build` · `npm run validate` · `npm test`  
Optional Lighthouse before/after note

## Full prompt

[`docs/plans/2026-06-01_ui-ux-audit-session-prompts.md`](../../docs/plans/2026-06-01_ui-ux-audit-session-prompts.md) — Session 5
