---
mode: agent
description: Endless gold product-trust — one pricing/freshness/attribution/karat fix per run. P0 for credibility.
related_skills:
  - pricing-data-integrity
related_instructions:
  - .github/instructions/gold-pricing.instructions.md
---

# Prompt: Endless Gold Product Trust

## Goal

Protect pricing truth — **one** trust defect per run.

## Required inspection

1. [`docs/freshness-contract.md`](../../docs/freshness-contract.md)
2. [`src/config/karats.js`](../../src/config/karats.js)
3. [`src/config/constants.js`](../../src/config/constants.js) — read only; do not change peg/ounce without owner approval

## Discovery

- Visible price missing source + timestamp + state label
- Inlined karat factor outside `karats.js`
- Wrong FX path (USD→AED→local on country pages)
- Copy implying retail/shop price from spot
- Stale provider attribution string

## Verification

`npm test`, `npm run validate`. Add/update tests under `tests/` if pattern exists.

## Return format

Defect → fix → test → risks.
