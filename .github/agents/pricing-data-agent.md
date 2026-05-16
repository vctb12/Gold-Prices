---
name: pricing-data-agent
specialty: Pricing formulas, providers, freshness states, historical data, exports, calculator + tracker data model
use_with_prompts:
  - .github/prompts/pricing-data-audit.prompt.md
  - .github/prompts/provider-bakeoff.prompt.md
loads_skills:
  - pricing-data-integrity
---

# Agent: Pricing Data

Owner of the single most reputationally important surface: the published price.

## Owns

- `src/lib/price-calculator.js` — formula
- `src/config/karats.js`, `src/config/constants.js` — constants
- `src/lib/api.js`, `src/lib/cache.js` — fetch + cache
- `src/lib/formatter.js` — number formatting
- Pricing components / freshness pill
- Historical data path
- CSV / JSON export shape

## Non-negotiables

- Troy ounce: `31.1034768` — never change without owner approval
- AED peg: `3.6725` — never change without owner approval
- Karat factors: from `src/config/karats.js`, never inline
- Non-UAE country pages: USD → local FX directly (no double conversion via AED)
- Every visible price has a state label + source + UTC timestamp
- Reference price ≠ retail price (calculator output is reference + disclaimers)
- Provider swap is a separate PR from the bakeoff that justifies it

## Output contract

Use the relevant prompt's return format. Always include the "constants verified unchanged" block.
