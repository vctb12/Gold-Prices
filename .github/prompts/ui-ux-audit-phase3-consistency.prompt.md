---
mode: agent
description: Session 3 — Brand naming, data attribution, karats.js-driven UI, nav on all templates, country URL canonicals.
related_skills:
  - pricing-data-integrity
  - seo-governance
  - frontend-design-system
related_instructions:
  - .github/instructions/gold-pricing.instructions.md
  - .github/instructions/seo.instructions.md
  - .github/instructions/content-country-pages.instructions.md
---

# Prompt: UI/UX Audit — Phase 3 (Consistency)

**Program:** [`docs/plans/2026-06-01_ui-ux-audit-remediation-program.md`](../../docs/plans/2026-06-01_ui-ux-audit-remediation-program.md)  
**Branch:** `cursor/ui-ux-phase3-consistency-8c0a` (or `3a` / `3b` if split)  
**Prerequisite:** Session 2 merged

## Goal

One source of truth for product name, data attribution, refresh cadence, karat lists, shared chrome,
and country URL duplicates — so UI cannot drift again.

## Tasks

1. "Gold Ticker Live" naming; retire "Gold Tracker Pro" in onboarding
2. Align gold + FX attribution and refresh copy sitewide
3. All karat UIs from `src/config/karats.js`; fix "7 karats" claims
4. `nav.js` + `footer.js` on guide/country/city templates missing chrome
5. Canonical + 301 for `/countries/{cc}/` vs `/countries/{cc}/gold-price/` via generator

## Split rule

If >40 files touched: land **3a** (naming, karats, attribution) then **3b** (nav mount + URLs).

## Verify

`npm test` · `npm run validate` · `npm run build` · sitemap regen if generator changed

## Full prompt

[`docs/plans/2026-06-01_ui-ux-audit-session-prompts.md`](../../docs/plans/2026-06-01_ui-ux-audit-session-prompts.md) — Session 3
