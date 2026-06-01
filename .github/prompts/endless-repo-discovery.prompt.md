---
mode: agent
description: Endless repo hygiene — find one dead export, doc drift, script mismatch, or test gap per run.
related_skills:
  - gold-ticker-live-audit
related_instructions:
  - AGENTS.md
---

# Prompt: Endless Repo Discovery

## Goal

Fix **one** repository hygiene issue per session (dead code, doc drift, tooling mismatch).

## Required inspection

1. [`AGENTS.md`](../../AGENTS.md)
2. [`docs/plans/2026-06-01_repo-reorganization-program.md`](../../docs/plans/2026-06-01_repo-reorganization-program.md)
3. [`reports/cleanup-audit/CANDIDATES.md`](../../reports/cleanup-audit/CANDIDATES.md) if present
4. [`docs/plans/ARCHIVE_AND_SUPERSESSION_INDEX.md`](../../docs/plans/ARCHIVE_AND_SUPERSESSION_INDEX.md)

## Scan order (first unfixed hit wins)

- Dead export with zero importers (confirm via ripgrep)
- Plan doc contradicting `main` or `AGENTS.md`
- `package.json` script pointing at missing file
- Undocumented workflow env var
- Committed `playwright-report/` or `test-results/`

## Not allowed

- Delete public URLs or change canonicals without SEO plan
- Touch `post_gold.yml`, `gold-price-fetch.yml`, `data/gold_price.json`, `sw.js`, `src/config/constants.js` without owner approval
- Batch-delete >15 files without a plan row

## Verification

`npm test`, `npm run validate`. Update `PLAN.md` or `REVAMP_PLAN.md` §29.

## Return format

Finding → fix → proof → risks.
