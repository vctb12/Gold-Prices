---
mode: agent
description: Endless UI polish — one flagship page per run at 360px LTR+RTL. Tokens, focus, skeletons, touch targets.
related_skills:
  - mobile-ux-review
  - frontend-design-system
related_instructions:
  - .github/instructions/frontend-mobile.instructions.md
  - .github/instructions/accessibility.instructions.md
---

# Prompt: Endless UI Visual Sweep

## Goal

Improve **one** primary surface per run (rotate tracker → home → calculator → shops → methodology → country template).

## Required inspection

1. [`docs/plans/2026-06-01_master-operations-hub.md`](../../docs/plans/2026-06-01_master-operations-hub.md)
2. [`styles/global.css`](../../styles/global.css) and [`docs/DESIGN_TOKENS.md`](../../docs/DESIGN_TOKENS.md)
3. Target page HTML + page CSS + page JS

## Fix one defect

Examples: missing `:focus-visible`, hover, skeleton vs literal "Loading…", horizontal overflow at 375px, touch target &lt;44px, hardcoded hex vs `--color-*` token.

## Not allowed

- Pricing formula / AED peg changes
- Removing freshness labels or methodology links
- Framework migration
- Nav information-architecture rewrite (use Track B1 session)

## Verification

`npm run validate`, `npm run build`. Manual RTL note in PR. EN+AR via `translations.js`.

## Return format

Page name, before/after, proof, risks.
