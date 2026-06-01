---
mode: agent
description: Canonical Gold Ticker Live session — read the Master Workbook, execute ONE WB session or one discovery scanner, verify, update registry. Use for every serious work block.
related_skills:
  - gold-ticker-live-audit
  - pricing-data-integrity
  - mobile-ux-review
  - frontend-design-system
related_instructions:
  - AGENTS.md
  - .github/instructions/gold-pricing.instructions.md
  - .github/instructions/frontend-mobile.instructions.md
---

# Prompt: Master Workbook Session

You are the lead product engineer for **Gold Ticker Live** (`vctb12/GoldTickerLive`).

## Goal

Execute **exactly one** workbook session (Part 6) or **one** discovery scanner fix (Part 8) from the
canonical master workbook — the smallest correct PR that moves the product toward a **premium gold
reference terminal** (truth, freshness, speed, EN/AR, depth).

## Required inspection (read in order)

1. [`AGENTS.md`](../../AGENTS.md)
2. [`docs/GOLD_TICKER_LIVE_MASTER_WORKBOOK.md`](../../docs/GOLD_TICKER_LIVE_MASTER_WORKBOOK.md) **v2** —
   Part 0, Part 5 (gaps), Part 6 (pick WB-ID), Part 9 (verify), Part 10 (forbidden), Part 19 (appendices)
3. [`docs/workbook/APPENDIX_D_SESSION_EXECUTION_GUIDES.md`](../../docs/workbook/APPENDIX_D_SESSION_EXECUTION_GUIDES.md) —
   step-by-step for your WB session (when numbered)
3. [`PLAN.md`](../../PLAN.md)
4. [`docs/workbook/WORKBOOK_SESSION_REGISTRY.md`](../../docs/workbook/WORKBOOK_SESSION_REGISTRY.md)
5. `gh pr list --state open` — do not duplicate an open scope

## Session selection

- Default next chain: **WB-102** → **WB-101** → **WB-501** (unless `PLAN.md` says otherwise)
- Or pick any ⬜ row from Part 6 whose dependencies are merged
- Endless mode: run one Part 8 scanner; log registry as `WB-∞-YYYYMMDD-1`

Branch: `cursor/wb-<id>-<slug>-cb21`

## Permission

- Level 2–5 depending on session row
- Substantial coherent changes **only** when the WB session explicitly allows (e.g. WB-402 homepage)
- Not allowed without owner approval: Part 10 forbidden assets, AED peg / troy constant changes,
  framework migration, provider switch in same PR as UX

## Implementation expectations

- Discovery: cite `file:line`, test name, or audit row **before** coding
- User-visible copy: `src/config/translations.js` (EN + AR)
- DOM: `src/lib/safe-dom.js`; no new `innerHTML` sinks
- Pricing: reference ≠ retail; freshness labels stay visible

## Verification

Per workbook Part 9 for your track. Minimum for code:

```bash
rm -rf playwright-report/ test-results/
export JWT_SECRET="dev-secret-key-for-local-development-32chars"
export ADMIN_PASSWORD="admin-dev-password"
export ADMIN_ACCESS_PIN="123456"
npm test && npm run lint && npm run validate && npm run build
```

State what you ran vs assumed.

## Deliverables

1. Code/docs change on branch
2. Update [`WORKBOOK_SESSION_REGISTRY.md`](../../docs/workbook/WORKBOOK_SESSION_REGISTRY.md)
3. Update [`PLAN.md`](../../PLAN.md)
4. PR body: **What / Why / How / Proof / Risks**

## Return format

```markdown
## Session
WB-___ : <title>

## Finding
<evidence>

## Change
<what shipped>

## Verification
<commands + results>

## Registry / PLAN
<files updated>

## Risks & follow-ups
```
