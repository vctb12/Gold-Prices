---
mode: agent
description: Review the X / Twitter automation pipeline — hourly post workflow, duplicate handling, market-closed logic, OAuth, tweet length, freshness, observability.
related_skills:
  - github-actions-debug
  - pricing-data-integrity
  - security-review
related_instructions:
  - .github/instructions/github-actions.instructions.md
  - .github/instructions/security.instructions.md
  - .github/instructions/gold-pricing.instructions.md
---

# Prompt: X / Twitter Automation Review

The hourly X-post is **production**. This review checks safety, freshness, observability, and
duplicate handling.

## Goal

Confirm the X-posting pipeline:

- Posts fresh data (or skips / posts "market closed" on staleness)
- Never re-posts duplicates
- Never logs secrets
- Stays within X API limits and tweet length
- Persists observability state for debugging
- Recovers from OAuth / 403 / 429 gracefully

## Required inspection

1. `.github/workflows/post_gold.yml`
2. `scripts/python/` — poster + utils + spike detector
3. `data/automation-*.json`, `data/tweet-*.json` observability logs (recent 7d)
4. `docs/TWITTER_AUTOMATION.md`, `docs/X_AUTOMATION_OBSERVABILITY.md`
5. [`github-actions-debug/checklists/x-twitter-posting.md`](../skills/github-actions-debug/checklists/x-twitter-posting.md)

## Audit checklist

```md
- [ ] Workflow has `workflow_dispatch` with `dry_run`, `force_post` (optional) inputs
- [ ] Schedule cron documented (currently hourly UTC)
- [ ] `permissions:` minimal; `contents: write` only on the observability-commit step
- [ ] No `set -x` near `${{ secrets.* }}`
- [ ] Boolean inputs handled as strings
- [ ] Tweet body assembled from current snapshot, not a hardcoded fallback
- [ ] Length check counts URL as 23 chars (X's t.co shortening)
- [ ] Duplicate detection: state file tracks last posted body / hash; X 187/403 → back off, no retry
- [ ] Stale-price guard: if data age > threshold → "Market closed" message OR skip
- [ ] OAuth/credentials referenced by name only, never echoed
- [ ] Observability JSON written to `data/`, committed with `[skip ci]`
- [ ] Failures alert (e.g. Telegram / Discord) without exposing secret webhook URL
- [ ] Telegram/Discord notification step gated behind `if: always()` so failures don't break the main job
- [ ] Recent 24h of `data/tweet-failures*.json` reviewed — no recurring auth errors
- [ ] EN-only or EN+AR posts decided + documented
```

## Implementation expectations

- Fixes go in via PR, never direct commit.
- Any logic change tested via `workflow_dispatch` + `dry_run: true` first.
- If credentials rotated: operator step (note in PR), never embed in code.
- New observability fields documented in `docs/X_AUTOMATION_OBSERVABILITY.md`.

## Verification

- Dispatch with `dry_run: true`; verify the tweet text in logs.
- Inspect `data/tweet-*.json` after the next scheduled run.
- If a real post happens, verify on `https://x.com/GoldTickerLive`.

## Return format

```md
# X Automation Review — <date>

## Posture
<healthy / degraded / failing>

## Findings
### Blocking
- ...
### Important
- ...
### Nice-to-have
- ...

## Recent 7d observability
- Posts attempted: N
- Posts succeeded: N
- Duplicates rejected (187/403): N
- Stale-skipped: N
- OAuth errors: N

## Changes made (if any)
- ...

## Verification
- Dry-run dispatched: <run link>
- Next scheduled run: <UTC time>
- Last successful post: <link to tweet>

## Follow-ups / risks
- ...
```
