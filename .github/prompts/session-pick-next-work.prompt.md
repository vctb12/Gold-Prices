---
mode: agent
description: Meta session — read the operations hub and ship the single highest-impact unblocked slice. Endless; run anytime.
related_skills:
  - gold-ticker-live-audit
related_instructions:
  - AGENTS.md
---

# Prompt: Pick Next Work (endless)

You are the lead engineer for Gold Ticker Live (`vctb12/GoldTickerLive`).

## Goal

Ship **one** PR-sized improvement from the current priority queue — not a survey, not a mega-refactor.

## Required inspection

1. [`AGENTS.md`](../../AGENTS.md)
2. [`PLAN.md`](../../PLAN.md)
3. [`docs/plans/2026-06-01_master-operations-hub.md`](../../docs/plans/2026-06-01_master-operations-hub.md)
4. [`docs/plans/README.md`](../../docs/plans/README.md)
5. Open PRs: `gh pr list --state open` — do not duplicate scope

## Discovery rule

Cite evidence (`file:line`, failing test, or audit row). If blocked (production workflow, `CANDIDATES.md`, owner gate), document in `PLAN.md` and pick the next slice.

## Permission

Level 2–4 depending on slice. Smallest correct change. May update plans/checklists in the same PR.

## Verification

`npm test`, `npm run lint`, `npm run validate`, `npm run build` — as applicable. State what you skipped.

## Return format

**What / Why / How / Proof / Risks** + `PLAN.md` diff summary.
