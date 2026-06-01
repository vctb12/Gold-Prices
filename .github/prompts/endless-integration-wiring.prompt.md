---
mode: agent
description: Endless integration — fix one broken internal link or weak cross-page flow per run.
related_skills:
  - seo-governance
related_instructions:
  - .github/instructions/content-country-pages.instructions.md
---

# Prompt: Endless Integration Wiring

## Goal

Strengthen **one** user flow per run (homepage → country → tracker → calculator → shops → content).

## Required inspection

1. [`docs/audits/NEXT_PR_SEQUENCE.md`](../../docs/audits/NEXT_PR_SEQUENCE.md) (PR 1 / Track D1)
2. [`src/components/nav-data.js`](../../src/components/nav-data.js)
3. [`_redirects`](../../_redirects)

## Pick one flow

- GCC grid → canonical country URL
- Tracker → calculator deep link
- Calculator → shops CTA
- Shops → city `gold-rate` hub
- Related guides target exists
- EN↔AR path parity

## Verification

`npm test`, `npm run validate`, `npm run build`. Grep proof for href fixes.

## Return format

Flow → broken link evidence → fix → risks.
