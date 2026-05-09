# Architecture — @GoldTickerLive X / Twitter Posting System

> **Last updated:** May 2026.  
> This file documents the **current production system** only.  
> Historical postmortem notes live in `docs/plans/` and `docs/REVAMP_PLAN.md`.

---

## Overview

The X / Twitter automation is a two-workflow, cache-only pipeline:

1. **`gold-price-fetch.yml`** — runs on a cron schedule, calls the provider waterfall via
   `scripts/python/fetch_gold_price.py`, and commits `data/gold_price.json` if the price changed.
   This is the **only** workflow that calls external gold-price APIs.

2. **`post_gold.yml`** — runs on a cron schedule 7 minutes later, reads the cached
   `data/gold_price.json` (never calls providers directly), evaluates a layered set of duplicate /
   staleness / cooldown guards, and posts to X via `scripts/python/post_gold_price.py`. Also
   supports `workflow_dispatch` for manual / iPhone Shortcut operator runs.

No other workflow posts to X. There is no separate Node.js posting system in production.

---

## System Diagram

```
GitHub Actions cron (market hours only)
┌──────────────────────────────────────────────────────────┐
│  gold-price-fetch.yml (at :02 each open hour)            │
│   └─ fetch_gold_price.py → provider waterfall            │
│        gold_api_com → twelvedata_xauusd → fmp_gcusd      │
│        Commits data/gold_price.json if changed           │
└──────────────────────────────────────────────────────────┘
                          │  7-minute gap
                          ▼
┌──────────────────────────────────────────────────────────┐
│  post_gold.yml (at :09 each open hour)                   │
│   └─ post_gold_price.py                                  │
│        Reads data/gold_price.json (no provider call)     │
│        Evaluates guard stack (see below)                 │
│        Posts to X via Tweepy v2                          │
│        Commits data/last_gold_price.json                 │
│                data/last_tweet_state.json                │
└──────────────────────────────────────────────────────────┘
```

`workflow_dispatch` triggers (GitHub UI / iPhone Shortcut) are supported by `post_gold.yml` only.
They still read cached `data/gold_price.json` unless `refresh_price_first=true` is also set.

---

## Market Hours Schedule

| Workflow               | Schedule (UTC)                                 | Market window                   |
| ---------------------- | ---------------------------------------------- | ------------------------------- |
| `gold-price-fetch.yml` | `2 21-23 * * 0`, `2 * * * 1-4`, `2 0-20 * * 5` | Sunday 21:02 → Friday 20:02 UTC |
| `post_gold.yml`        | `9 21-23 * * 0`, `9 * * * 1-4`, `9 0-20 * * 5` | Sunday 21:09 → Friday 20:09 UTC |

Market open = Sunday 21:00 UTC (Monday 01:00 UAE/GMT+4) → Friday 20:59 UTC (Saturday 00:59 UAE).

---

## Provider Waterfall

Production order (set via `GOLD_PROVIDER_ORDER` in `gold-price-fetch.yml`):

```
gold_api_com → twelvedata_xauusd → fmp_gcusd
```

**Do not change this order without a documented migration plan.** The provider order affects which
timestamps and staleness signals the guard stack sees.

---

## Guard Stack — `post_gold_price.py`

Guards are evaluated in this fixed order. Each guard can exit early; later guards are only reached
if earlier ones pass.

```
1. shortcut_anti_spam      — source=shortcut only: skip if last shortcut attempt < 2 min ago
2. staleness               — skip if provider timestamp > 12 h old (unless market_closed_reference + within CLOSED_MARKET_MAX_STALE_HOURS)
3. market_hours            — skip regular hourly posts outside 24/5 market hours (operator runs bypass)
4. price_change            — skip if price is unchanged vs last successful post (operator can override for market_closed_reference)
5. content_hash            — skip if tweet text is identical to last post (post_gold_price.py legacy guard)
6. tweet_guard.decide()    — full guard stack in tweet_guard.py (see below)
7. dry_run                 — skip actual X call if DRY_RUN_TWEET=true (applied unconditionally)
```

### `tweet_guard.decide()` sub-guards (in order)

```
1. stale_quote             — is_fresh=false → skip unless ALLOW_STALE_TWEET=true
2. first_post              — no prior state → allow
3. cooldown                — last post < MIN_TWEET_INTERVAL_MINUTES ago → skip (bypass: force_post=true)
4. provider_sample_unchanged — same price AND same timestamp → always skip
5. provider_timestamp_unchanged — timestamp not advanced → skip unless force_summary due
6. duplicate_text_hash     — identical tweet text → always skip (X rejects anyway)
7. fallback_no_change      — fallback/cached source with same price → skip
8. price_move_below_threshold — small move, no force-summary due → skip
```

Guard order is fixed. `force_post=true` bypasses **cooldown only** (rule 3). `duplicate_text_hash`
and `stale_quote` are **never** bypassed by any operator input.

Each guard emits a `[guard] <name>: ... → PASS/SKIP` trace line to the workflow log.

---

## Post Types

| Type                      | When                                                     | Template                                 |
| ------------------------- | -------------------------------------------------------- | ---------------------------------------- |
| `hourly`                  | Regular scheduled post during market hours               | `format_hourly_tweet()`                  |
| `market_open`             | First scheduled post on Sunday 21:xx UTC (or event cron) | `format_market_open_tweet()`             |
| `market_close`            | First scheduled post on Friday 21:xx UTC (or event cron) | `format_market_close_tweet()`            |
| `market_closed_reference` | Operator `workflow_dispatch` while market is closed      | `format_market_closed_reference_tweet()` |

`market_closed_reference` uses cached spot data labelled clearly as closed/reference price. Stale
cache age is logged to the workflow but **never** included in the public tweet body.

---

## Workflow Dispatch Inputs — `post_gold.yml`

| Input                                   | Default  | Effect                                                                                                                                                                                                        |
| --------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dry_run`                               | `false`  | Evaluate all guards; skip actual X API call. Safe to use for diagnostics.                                                                                                                                     |
| `force_post`                            | `false`  | Bypass cooldown guard only; duplicate, stale, and content-hash guards still apply.                                                                                                                            |
| `source`                                | `manual` | Trigger source label (`manual`, `shortcut`). Determines operator bypass eligibility.                                                                                                                          |
| `refresh_price_first`                   | `false`  | Run `fetch_gold_price.py` once before posting. Manual/operator `workflow_dispatch` only.                                                                                                                      |
| `trigger_nonce`                         | `""`     | Optional unique label for tracing a specific Shortcut trigger in the logs.                                                                                                                                    |
| `allow_same_price_closed_market_repost` | `false`  | Override price-change guard for `market_closed_reference` when closing price is unchanged. Manual/shortcut only. Does NOT bypass `duplicate_text_hash` or cooldown. Scheduled runs are completely unaffected. |

All inputs default to their safe values. Scheduled cron runs see `dry_run=false`,
`force_post=false`, `source=scheduled`, and `allow_same_price_closed_market_repost=false`.

---

## State Files

| File                         | Written by                | Contents                                                                                   |
| ---------------------------- | ------------------------- | ------------------------------------------------------------------------------------------ |
| `data/gold_price.json`       | `fetch_gold_price.py`     | Canonical price payload, provider, timestamps, karat prices                                |
| `data/last_gold_price.json`  | `post_gold_price.py`      | Last successfully posted price + timestamp + content hash                                  |
| `data/last_tweet_state.json` | `tweet_guard.py` / poster | Full guard state: last price, provider ts, tweet hash, cooldown, Shortcut attempt metadata |

All three files are committed back to the repo by their respective workflows (with `[skip ci]` to
avoid triggering a deploy). `data/last_tweet_state.json` is written atomically (write-to-temp →
rename).

---

## Secrets

| Secret                | Used by                                                | Purpose                              |
| --------------------- | ------------------------------------------------------ | ------------------------------------ |
| `CONSUMER_KEY`        | `post_gold.yml`                                        | X API consumer key (OAuth 1.0a)      |
| `CONSUMER_SECRET`     | `post_gold.yml`                                        | X API consumer secret                |
| `ACCESS_TOKEN`        | `post_gold.yml`                                        | X API access token                   |
| `ACCESS_TOKEN_SECRET` | `post_gold.yml`                                        | X API access token secret            |
| `GOLD_API_COM_KEY`    | `gold-price-fetch.yml`, `post_gold.yml` (refresh only) | Gold-API.com API key                 |
| `TWELVEDATA_API_KEY`  | same                                                   | Twelve Data API key                  |
| `TWELVEDATA_SYMBOL`   | same                                                   | Symbol override (e.g., `XAU/USD`)    |
| `FMP_API_KEY`         | same                                                   | Financial Modeling Prep API key      |
| `FMP_SYMBOL`          | same                                                   | Symbol override (e.g., `GCUSD`)      |
| `GOLDPRICEZ_API_KEY`  | same                                                   | GoldPriceZ API key (legacy fallback) |

Secrets are never echoed to logs. All secret names are pinned in the workflow YAML — do not rename
without updating the workflow.

---

## Error Handling

| Failure                          | Behaviour                                                                                   |
| -------------------------------- | ------------------------------------------------------------------------------------------- |
| `data/gold_price.json` missing   | `FATAL` log, `exit(1)` — workflow fails visibly                                             |
| `data/gold_price.json` malformed | `FATAL` log, `exit(1)` — workflow fails visibly                                             |
| Provider quote stale (> 12 h)    | Skip post; log `ERROR: UPSTREAM SEVERELY STALE`; `exit(0)` unless `market_closed_reference` |
| X API 403 (duplicate)            | Log structured error with response body; re-raise; workflow fails                           |
| X API 401 (bad credentials)      | Log structured error; re-raise; workflow fails                                              |
| X API 429 (rate limit)           | Log with `Retry-After`; re-raise; workflow fails                                            |
| Tweet > 280 characters           | Warning-only log (`⚠️ tweet_length=N > 280`); still attempts post; X enforces its own limit |
| Missing Twitter credentials      | Warning log, `exit(0)` — workflow succeeds silently (safe for environments without secrets) |
| `last_tweet_state.json` corrupt  | Warning log; treated as first run; no crash                                                 |

---

## Shortcut Anti-Spam Protection

iPhone Shortcut runs (`source=shortcut`) are protected against accidental floods:

1. **Workflow-level concurrency**: `group: post-gold, cancel-in-progress: true` — a new Shortcut run
   cancels any still-running job.
2. **Python-level anti-spam**: If the same `source=shortcut` trigger arrives within 2 minutes of the
   previous attempt (tracked in `last_tweet_state.json`), the run exits early with a
   `SKIP: shortcut anti-spam guard` message. Bypassed by `force_post=true` only.
3. **Normal guards still apply**: Any Shortcut run that passes the anti-spam gate still faces the
   full stale / duplicate / content-hash / cooldown guard stack.

**If a flood occurs:**

1. Disable `post_gold.yml` in Actions immediately.
2. Disable or revoke the Shortcut (remove or rotate the PAT).
3. Re-enable the workflow only after the Shortcut is safe.
4. Do **not** place the Shortcut inside iOS Repeat / Wait loops or iOS Automations.

---

## Operator Diagnosis Flow

When a manual/Shortcut run exits unexpectedly:

1. Open the failed run in GitHub Actions → **Post gold price to X** job → expand logs.
2. Find the `=== RUN CONTEXT ===` block at the top — verify `source`, `post_type`,
   `selected_post_type`, `market_open`, `operator_trigger`.
3. Check the `stale_age_hours` and `closed_market_stale_allowed` lines.
4. Look for `SKIP:` lines to identify which guard fired.
5. Check `[guard]` trace lines (from `tweet_guard.decide()`) for sub-guard evaluation.
6. Check the `=== RUN RESULT ===` block at the bottom — present only on a successful post.
7. For `market_closed_reference` same-price skips, the skip log uses `├──` / `└──` tree format with
   all relevant fields. Re-run with `allow_same_price_closed_market_repost=true` if needed.
