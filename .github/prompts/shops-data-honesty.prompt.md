---
mode: agent
description: Audit and improve the Shops directory — honest verification tiers, missing-data handling, no fake trust claims.
related_skills:
  - mobile-ux-review
related_instructions:
  - .github/instructions/frontend-mobile.instructions.md
  - .github/instructions/content-country-pages.instructions.md
---

# Prompt: Shops Data Honesty

Audit and improve `shops.html` and the underlying shops data pipeline. Honesty over polish.

## Goal

A directory that:

- Differentiates **verified** / **listed** / **market cluster** entries honestly
- Surfaces "last checked" timestamps for every entry
- Handles missing data gracefully (no fake addresses / phone numbers / hours)
- Has filterable, accessible UI on mobile
- Includes a clear "this is informational" disclaimer
- Links to methodology and explains shop prices ≠ reference price

## Required inspection

1. `shops.html`, `styles/pages/shops.css`, `src/pages/shops.js`
2. `data/shops*.json` and `scripts/node/normalize-shops.js`
3. `server/routes/shops-v1.js`, `server/repositories/shops*` (if present)
4. `docs/shops-*.md` (any shops-related docs)
5. [`mobile-ux-review/checklists/shops.md`](../skills/mobile-ux-review/checklists/shops.md)

## Honesty rules

- **No** "trusted by N customers" without a real source.
- **No** "best price" / "official rate" / "guaranteed quality" claims.
- **Verified** tier requires evidence (license number, callback confirmation, on-site visit).
- **Listed** = publicly listed contact info, not endorsed.
- **Market cluster** = geographic grouping, not individual shops.
- Missing phone / hours / address → show "Not available" or hide that row, never invent.
- "Last checked" timestamp visible per entry.

## Implementation expectations

- Filter chips on mobile (city, karat, verified tier), not nested dropdowns
- Each card: name, area, verified-tier badge, last-checked date
- Contact actions use `safeTel()` for phone, `safeHref()` for website
- Empty state when filters return zero results, with "clear filters" CTA
- Internal link to methodology + an explanation block: "Shop prices include making charges, VAT,
  and dealer premiums — these can differ from our reference estimate."
- RTL parity tested at 360 px

## Verification

```bash
npm test                            # shops route tests
npm run lint
npm run validate
node --test tests/shops*.test.js
# Manual: filters work, cards render, no broken `tel:` / `href`
```

## Return format

```md
# Shops Audit — <date>

## Summary
<2–4 sentences>

## Findings
### Honesty issues
- <entry>: <claim> not supported by evidence → removed / qualified

### Data quality
- <count> entries with missing phone (hidden gracefully)
- <count> stale `last_checked` (> N days)

### UX
- ...

## Changes
- <file>: <what>

## Verification
- `npm test`: PASS
- `npm run validate`: PASS
- Manual mobile + RTL smoke: PASS

## Follow-ups
- Outreach to <count> shops to refresh data
```
