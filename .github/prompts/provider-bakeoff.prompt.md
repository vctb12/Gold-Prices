---
mode: agent
description: Run or extend the price-provider bakeoff. Compare providers on freshness, latency, gap behaviour, cost. No production switch in the same PR.
related_skills:
  - pricing-data-integrity
  - github-actions-debug
related_instructions:
  - .github/instructions/gold-pricing.instructions.md
  - .github/instructions/github-actions.instructions.md
---

# Prompt: Provider Bakeoff

Add, refine, or analyze the price-provider bakeoff. Evidence first, switches later.

## Goal

Produce / update a scorecard comparing candidate price providers across measurable axes, and
recommend (but do not execute) a provider change.

## Required inspection

1. `.github/workflows/gold-provider-bakeoff.yml`, `gold-bakeoff-readiness.yml`,
   `test-gold-providers.yml`, `pr-provider-smoke.yml`
2. `scripts/` adapters per provider
3. `docs/gold-price-provider-bakeoff.md`, `docs/gold-price-provider-migration.md`
4. Recent `reports/` outputs
5. [`github-actions-debug/checklists/provider-bakeoff.md`](../skills/github-actions-debug/checklists/provider-bakeoff.md)

## Axes to measure

| Axis              | How to measure                                                              |
| ----------------- | --------------------------------------------------------------------------- |
| Freshness         | Median age of returned timestamp vs. wall clock                             |
| Latency           | p50 / p95 HTTP request time                                                 |
| Update cadence    | Real interval between distinct price values                                 |
| Gap behaviour     | What happens during market-closed windows                                   |
| Rate limit        | Documented vs. observed                                                     |
| Cost              | Free tier limit, paid tier price, currency                                  |
| Terms             | Attribution required? Commercial use allowed?                               |
| Failure modes     | 4xx / 5xx rate; recovery behaviour                                          |
| Historical data   | Available resolutions and ranges                                            |

## Implementation expectations

- New provider adapter: smoke test in PR-smoke style + bakeoff entry
- Keys via env, never inline
- Don't change the production provider in this PR
- Run bakeoff for at least one full cycle window before recommending a switch
- Update `docs/gold-price-provider-bakeoff.md` with the latest scorecard

## Verification

```bash
# PR-smoke (runs on PR automatically)
# Bakeoff (workflow_dispatch)
gh workflow run gold-provider-bakeoff.yml
# Inspect:
ls reports/
cat docs/gold-price-provider-bakeoff.md
```

## Return format

```md
# Provider Bakeoff — <date>

## Scorecard

| Provider | Freshness (median) | p50 latency | p95 latency | Cadence | Cost | Notes |
|----------|--------------------|-------------|-------------|---------|------|-------|
| ...      | ...                | ...         | ...         | ...     | ...  | ...   |

## Recommendation
<which provider to promote, AND a separate PR that does the switch>

## Risks
- <e.g. provider X requires attribution — update methodology page if we switch>

## Next step
- Open follow-up PR for the actual switch after one more bakeoff window
```
