---
mode: agent
description: Plan or implement expansion of country / city / karat pages with real local context — not thin templated duplicates.
related_skills:
  - seo-governance
related_instructions:
  - .github/instructions/content-country-pages.instructions.md
  - .github/instructions/seo.instructions.md
---

# Prompt: Country Pages Expansion

Add or improve country / city pages with **real local context**. Thin templated duplicates are
not acceptable.

## Goal

For each country in scope:

- A real local-context paragraph (currency, common karats, market structure, VAT/duty, where
  people buy)
- A live karat table with freshness label
- Methodology link in-context
- Internal links: country index, neighbours, top cities, calculator, related guides
- Schema (Place + BreadcrumbList; FAQPage if FAQ present)
- EN + AR variants where the plan calls for them
- Hreflang pairs
- Unique title / H1 / meta description (no templated swap-the-country-name)

## Required inspection

1. `countries/` — what already exists?
2. `docs/revamp-page-map.md` — site map
3. `docs/REVAMP_PLAN.md` — active country tracks
4. [`content-country-pages.instructions.md`](../instructions/content-country-pages.instructions.md)
5. [`seo-governance/checklists/country-pages.md`](../skills/seo-governance/checklists/country-pages.md)

## Implementation expectations

- Local currency conversion uses USD → local FX (not via AED) unless the country is the UAE.
- Karat factors from `src/config/karats.js`. Always.
- Citations for local context (LBMA, World Gold Council, IMF, central bank, market authority).
- Don't fabricate VAT / duty rates — cite or omit.
- No "best shop" / "trusted seller" claims without evidence (link to the shops page disclaimer).
- AR copy must read naturally — not a literal translation.
- If a page can't meet the bar, `noindex` it + add to `scripts/node/seo-governance.js` allowlist.

## Verification

```bash
npm run validate
npm run audit-pages          # flags thin / templated pages
npm run seo:governance:check
npm run linkcheck
npm run build                # regenerates sitemap
```

## Return format

```md
# Country Pages Expansion — <countries>

## Scope
- <country 1>: EN + AR
- <country 2>: EN only (AR follow-up tracked)
- ...

## Content sources cited
- <country 1>: LBMA <link>, central bank <link>, ...
- ...

## SEO
- Canonical: <list of URLs>
- Hreflang pairs: <list>
- Schema: <Place + BreadcrumbList per page>

## Indexation decisions
- <country / page>: index (real content)
- <country / page>: noindex → added to governance allowlist

## Verification
- `npm run audit-pages`: 0 thin flags on new pages
- `npm run seo:governance:check`: PASS
- `npm run validate`: PASS
- Manual: 360 px EN + AR for each new page

## Follow-ups
- AR variants for <list> in next PR
```
