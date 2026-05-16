---
mode: agent
description: Deep audit of pricing data integrity — providers, formulas, freshness, historical data, exports, calculator correctness.
related_skills:
  - pricing-data-integrity
related_instructions:
  - .github/instructions/gold-pricing.instructions.md
---

# Prompt: Pricing Data Audit

Audit the pricing data path end-to-end: from upstream provider to rendered price + freshness
label to CSV export.

## Goal

Produce a report (and optional fixes) confirming the pricing path is honest, accurate, and
consistent across tracker, calculator, country pages, and exports.

## Required inspection

1. `src/lib/price-calculator.js` — formula
2. `src/config/karats.js`, `src/config/constants.js` — constants
3. `src/lib/api.js`, `src/lib/cache.js` — fetching + caching
4. `src/lib/formatter.js` — number formatting
5. Pricing components / freshness pill in `src/components/`
6. `data/*.json` snapshots — recent freshness behaviour
7. `docs/data-source-methodology.md`, `docs/PRICE_API_AND_HISTORY.md`
8. [`pricing-data-integrity/SKILL.md`](../skills/pricing-data-integrity/SKILL.md) + its 4 checklists

## Findings to produce

- **Constants drift**: any inline number that should come from `karats.js` / `constants.js`
- **Cross-page inconsistency**: tracker vs. calculator vs. country page producing different prices
  for the same inputs
- **Freshness gaps**: any visible price without a state label, source, or timestamp
- **Cache lying about live**: cached responses rendered as `live`
- **Historical interpolation**: gaps silently smoothed
- **Export omissions**: CSV/JSON missing `source` / `timezone` / `resolution` / `disclaimer`
- **Calculator missing disclaimers**: VAT / making-charge wording absent
- **Reference vs. retail**: any surface where derived price is shown as a shop quote

## Implementation expectations

- Constants live in `src/config/*` only
- Calculator uses the same formula module as the tracker
- Add unit tests for any formula touched
- Don't change AED peg (`3.6725`), troy-oz (`31.1034768`), or karat factors without owner approval
- Don't switch the production provider in this PR — that's a separate flow (see provider-bakeoff
  prompt)

## Verification

```bash
npm test                   # includes price-calculator tests
npm run validate
npm run build
# Manual: tracker / calculator / 3 country pages — eyeball prices for same inputs match
```

## Return format

```md
# Pricing Data Audit — <date>

## Summary
<2–4 sentences>

## Findings
### Blocking
- ...

### Important
- ...

### Nice-to-have
- ...

## Changes made (if any)
- ...

## Constants verified unchanged
- AED peg: 3.6725 ✓
- Troy ounce: 31.1034768 ✓
- Karat factors: from src/config/karats.js ✓

## Verification
- `npm test` → N tests, PASS
- `npm run validate` → PASS
- Manual cross-page check: <pages> render same value for same inputs ✓

## Risks / follow-ups
- ...
```
