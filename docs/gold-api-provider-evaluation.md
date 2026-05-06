# Gold-price provider evaluation — gold-api.com and candidates

> **Status:** Infrastructure in place, no winner crowned yet. This document records what is known,
> what has been tested, and what still needs bakeoff evidence before any provider can be promoted to
> primary.
>
> **Companion docs:**
>
> - [`gold-price-provider-bakeoff.md`](./gold-price-provider-bakeoff.md) — how to run the bakeoff
> - [`gold-price-provider-migration.md`](./gold-price-provider-migration.md) — production cutover
>   runbook
> - [`operator-inputs-gold-provider-bakeoff.md`](./operator-inputs-gold-provider-bakeoff.md) —
>   operator checklist
> - [`OWNER_ACTIONS_REQUIRED_GOLD_BAKEOFF.md`](./OWNER_ACTIONS_REQUIRED_GOLD_BAKEOFF.md) —
>   owner-only pre-merge gates
> - [`x-automation-duplicate-policy.md`](./x-automation-duplicate-policy.md) — X duplicate-post
>   guard

---

## 1. Executive summary

The X/Twitter automation posts gold price updates every 6 minutes while markets are open. This
requires approximately **7,200 provider calls per month per provider** (10 calls/hour × 24 h × 30
days). A 3-provider parallel bakeoff requires approximately **21,600 calls/month total**.

The current production provider (GoldPriceZ) is known to freeze its published price for **30–45
minutes at a time**, causing duplicate post attempts that X rejects (HTTP 403, code 187). The search
for a better primary provider led to the provider-adapter architecture and bakeoff system now in
place.

**gold-api.com** is the focus of this evaluation. Its marketing claims (free, no rate limiting,
real-time) sound attractive, but this project has **a documented prior production failure with it**:
it hit limits and became unreliable. It is therefore treated as a re-evaluation candidate, not a
presumed replacement, and remains disabled by default.

Three providers passed the pre-merge smoke test on 2026-05-01: `goldapi_io`, `twelvedata_xauusd`,
and `fmp_gcusd`. The 24h+ bakeoff is the next step to produce real update-frequency evidence before
any winner is selected.

**Recommendation (pre-bakeoff):** Do not switch production from GoldPriceZ until bakeoff data
exists. Run the hourly bakeoff against `goldapi_io,twelvedata_xauusd,fmp_gcusd` for ≥ 24 hours. Only
add `gold_api_com` to a bakeoff run manually (via `Test Gold Providers` or `Gold Provider Bakeoff`
with the explicit `providers` input) to re-measure it. Choose a winner based on scorecard evidence,
not documentation claims.

---

## 2. Request volume calculation

| Scenario                                   | Calls/hour | Calls/day | Calls/30-day month |
| ------------------------------------------ | ---------: | --------: | -----------------: |
| Single provider, 6-min interval            |         10 |       240 |              7,200 |
| Two providers in bakeoff, 6-min interval   |         20 |       480 |             14,400 |
| Three providers in bakeoff, 6-min interval |         30 |       720 |             21,600 |

These numbers assume the GitHub Actions cron fires on every scheduled tick. In practice the
scheduler can drop or delay ticks under high platform load, so real volume is slightly lower.

The hourly bakeoff chunks (`gold-provider-bakeoff.yml`) produce approximately 8 samples per provider
per hourly run (50 min ÷ 6 min), accumulating to approximately 600 samples per provider across 24
runs.

---

## 3. Current repo provider state

### 3.1 Production path (unchanged)

```
gold-price-fetch.yml
  → scripts/fetch_gold_price.py      (legacy GoldPriceZ-only fetcher)
  → data/gold_price.json             (committed to git every 6 min if changed)

post_gold.yml
  → scripts/python/post_gold_price.py  (reads gold_price.json, X posting)
  → data/last_gold_price.json          (last posted price + content hash)
  → data/last_tweet_state.json         (full tweet-guard state)
```

GoldPriceZ is the only provider in the production path. **No cutover has happened.**

### 3.2 New orchestrator (dormant, not yet scheduled)

`scripts/python/fetch_gold_price.py` is the new provider-adapter orchestrator. It tries providers
from `GOLD_PROVIDER_ORDER` in order, respects a circuit-breaker, and writes `data/gold_price.json`
in the same schema as the legacy fetcher. It is **not yet referenced from any scheduled workflow** —
only from the bakeoff testing workflows. A cutover PR will wire it into `post_gold.yml` once a
winner is chosen.

### 3.3 Provider adapter summary

| Adapter name        | File                               | Default state | Smoke test (2026-05-01)     |
| ------------------- | ---------------------------------- | ------------- | --------------------------- |
| `goldpricez`        | `gold_providers/goldpricez.py`     | **enabled**   | ❌ missing_price (HTTP 200) |
| `gold_api_com`      | `gold_providers/gold_api_com.py`   | **disabled**  | Not tested — see §5         |
| `goldapi_io`        | `gold_providers/goldapi_io.py`     | disabled      | ✅ ok — $4,637 @ 15:34:53Z  |
| `twelvedata_xauusd` | `gold_providers/twelvedata.py`     | disabled      | ✅ ok — $4,639 @ 15:33:00Z  |
| `fmp_gcusd`         | `gold_providers/fmp.py`            | disabled      | ✅ ok — $4,647 @ 15:24:54Z  |
| `finnhub_oanda`     | `gold_providers/finnhub.py`        | disabled      | ❌ plan_gated (HTTP 403)    |
| `metal_sentinel`    | `gold_providers/metal_sentinel.py` | disabled      | ❌ http_error (HTTP 400)    |

### 3.4 State files used for duplicate prevention

| File                         | Written by                 | Purpose                                            |
| ---------------------------- | -------------------------- | -------------------------------------------------- |
| `data/gold_price.json`       | `fetch_gold_price.py`      | Canonical price; read by `post_gold_price.py`      |
| `data/last_gold_price.json`  | `post_gold_price.py`       | Last posted price, timestamp, content hash         |
| `data/last_tweet_state.json` | `tweet_guard.save_state()` | Full tweet-guard state (provider, timestamp, hash) |
| `data/provider_state.json`   | `fetch_gold_price.py`      | Circuit-breaker bookkeeping per provider           |

### 3.5 Workflows and safety contract

| Workflow                     | Trigger                  | Posts to X? | Commits? | Production? |
| ---------------------------- | ------------------------ | ----------- | -------- | ----------- |
| `gold-price-fetch.yml`       | cron + dispatch          | No          | Yes      | **Yes**     |
| `post_gold.yml`              | cron + dispatch          | **Yes**     | Yes      | **Yes**     |
| `gold-provider-bakeoff.yml`  | cron (hourly) + dispatch | No          | opt-in   | **No**      |
| `test-gold-providers.yml`    | manual dispatch          | No          | No       | **No**      |
| `pr-provider-smoke.yml`      | pull_request             | No          | No       | **No**      |
| `gold-bakeoff-readiness.yml` | dispatch + PR            | No          | No       | **No**      |

---

## 4. Provider comparison table

> Values marked **"Needs confirmation"** come from marketing copy or repo comments and have not been
> verified against real bakeoff samples.

| Provider           | Free tier limit                                                        | 7,200/month OK?         | Claimed update freq. | Smoke result          | Key required? | XAU/USD direct?           | Timestamp in response? | Source type           | Score / 10                       |
| ------------------ | ---------------------------------------------------------------------- | ----------------------- | -------------------- | --------------------- | ------------- | ------------------------- | ---------------------- | --------------------- | -------------------------------- |
| **gold-api.com**   | "No rate limiting" (claim)                                             | Needs confirmation      | "Real-time" (claim)  | Not tested (disabled) | No (optional) | Yes (XAU)                 | `updatedAt` field      | spot_reference        | ?/10 — needs bakeoff             |
| **GoldAPI.io**     | ~100/month (historically) or more on current plan — needs confirmation | Needs confirmation      | Needs confirmation   | ✅ ok (2026-05-01)    | Yes           | Yes (XAU/USD)             | `timestamp` field      | spot_reference        | ?/10 — smoke pass, needs bakeoff |
| **Twelve Data**    | 800 credits/day, 8/min                                                 | ✅ Yes (240/day << 800) | 1-min candles        | ✅ ok (2026-05-01)    | Yes           | Yes (XAU/USD time_series) | `datetime` in candle   | spot_reference        | ?/10 — smoke pass, needs bakeoff |
| **FMP GCUSD**      | ~250/day                                                               | Marginal (240 ≈ limit)  | Needs confirmation   | ✅ ok (2026-05-01)    | Yes           | GCUSD (futures, not spot) | `timestamp` field      | **futures_reference** | ?/10 — not pure spot             |
| **Finnhub OANDA**  | Plan-gated for metals                                                  | ❌ No (plan block)      | 1-min candles (paid) | ❌ plan_gated (403)   | Yes           | OANDA:XAU_USD             | `t` array (unix)       | spot_reference        | 1/10 (plan block)                |
| **Metal Sentinel** | Unknown                                                                | Unknown                 | Unknown              | ❌ http_error (400)   | Yes           | Unknown                   | Unknown                | spot_reference        | 1/10 (HTTP error)                |
| **GoldPriceZ**     | API key required                                                       | Needs confirmation      | Freezes 30–45 min    | ❌ missing_price      | Yes           | Yes (XAU/USD)             | `date_gmt` field       | spot_reference        | 2/10 (known freeze)              |

**Score weighting used in this table (and in `provider_scorecard.py`):**

| Component                   | Weight |
| --------------------------- | ------ |
| Update frequency            | 35%    |
| Success rate                | 25%    |
| Freshness                   | 20%    |
| Response time               | 10%    |
| Quota / terms / rate limits | 10%    |

Final numeric scores are intentionally left blank — they must come from the bakeoff, not from claims
or a single smoke round.

---

## 5. gold-api.com deep dive

### 5.1 Endpoint

```
GET https://api.gold-api.com/price/XAU
Accept: application/json
X-API-KEY: <optional>   # Accepted but not required per marketing docs
```

The adapter is already implemented at `scripts/python/gold_providers/gold_api_com.py` with this
exact endpoint. It parses:

- `price` → `price_usd_oz`
- `updatedAt` or `timestamp` → provider timestamp

### 5.2 What the adapter already handles

- Optional API key (`X-API-KEY` header, read from `GOLD_API_COM_KEY`)
- Enable guard (`GOLD_API_COM_ENABLED`, default `false`)
- Structured errors for every failure mode
- Sanity range check ($500 – $10,000 XAU/USD)
- Timestamp parsing (`updatedAt` ISO-8601 or epoch)
- SHA-256 hash of response body for the bakeoff log (no raw body stored)

### 5.3 What is unknown / needs bakeoff confirmation

The following questions can only be answered by running the bakeoff:

| Question                                                            | Known from repo?     | Need bakeoff? |
| ------------------------------------------------------------------- | -------------------- | ------------- |
| Is it truly free with no key (no hidden quota)?                     | Marketing claim only | **Yes**       |
| Does it sustain 7,200 req/month without rate-limiting?              | Not confirmed        | **Yes**       |
| Does `updatedAt` actually advance every minute during market hours? | Not confirmed        | **Yes**       |
| What is the worst-case frozen-timestamp interval?                   | Not confirmed        | **Yes**       |
| Does it provide a server-side timestamp or a client-generated one?  | Unknown              | **Yes**       |
| Can the data be used for public website display?                    | Needs ToS review     | Needs review  |
| Can the data be used in automated X posts?                          | Needs ToS review     | Needs review  |
| What is the typical response latency?                               | Unknown              | **Yes**       |
| Does it return silver or other metals (for future use)?             | Not tested           | Optional      |
| Is there a status page or SLA?                                      | Unknown              | Needs review  |

### 5.4 Prior production failure

> **Docstring in `gold_api_com.py`:** "The product team already had a bad experience with
> gold-api.com in production — it became unreliable / hit limits quickly. This adapter exists only
> so the bakeoff can re-measure it cleanly. Disabled by default."

This is not a rumor — it is a documented production failure for this project. The bakeoff's job is
to re-measure it under controlled conditions and with fresh evidence. Until that evidence exists,
gold-api.com must be treated as a re-evaluation candidate, not a confirmed primary.

### 5.5 Enabling gold_api_com in the bakeoff

The bakeoff infrastructure fully supports gold_api_com. To test it:

**Via `Test Gold Providers` (Actions → manual dispatch):**

1. Add `GOLD_API_COM_ENABLED=true` as a GitHub repository secret.
2. Optionally add `GOLD_API_COM_KEY=<your key>` if you have one (key is optional per the provider's
   docs).
3. Run **Actions → Test Gold Providers (manual)** with `providers: gold_api_com` (or blank to
   include all enabled).
4. Review the one-round artifact — confirm `ok` row with a real price.

**Via `Gold Provider Bakeoff` (Actions → manual dispatch):**

1. After the smoke passes, run: `providers: gold_api_com,goldapi_io,twelvedata_xauusd`
   `duration_hours: 24` `interval_seconds: 360`
2. Download the artifact after 24h and inspect `provider_scorecard.json`.

**Local (no Actions):**

```bash
export GOLD_API_COM_ENABLED=true
# No key needed, but you can set GOLD_API_COM_KEY if you have one
python scripts/python/provider_bakeoff.py \
  --once \
  --providers gold_api_com
```

The hourly scheduled bakeoff cron hard-pins the current trio
(`goldapi_io,twelvedata_xauusd,fmp_gcusd`). To include gold_api_com in the accumulated hourly run,
you need a manual dispatch — the scheduled default is kept narrow to avoid accidentally burning new
quota on a provider with an unconfirmed free tier.

---

## 6. Bakeoff plan

The full bakeoff architecture is documented in
[`gold-price-provider-bakeoff.md`](./gold-price-provider-bakeoff.md). The operator checklist lives
in [`operator-inputs-gold-provider-bakeoff.md`](./operator-inputs-gold-provider-bakeoff.md).

**Recommended sequence:**

### Phase 1 — Current trio (underway)

Run the hourly bakeoff (`gold-provider-bakeoff.yml`) for ≥ 24 hours against
`goldapi_io,twelvedata_xauusd,fmp_gcusd`. This is the smoke-validated set from 2026-05-01.

Minimum signal needed before calling a winner:

- ≥ 200 samples per provider
- Longest frozen timestamp interval documented
- Success rate ≥ 95%
- No 429 / auth errors

### Phase 2 — Add gold_api_com to bakeoff (optional, after Phase 1)

If Phase 1 does not produce a clear winner, or if you want to give gold-api.com a fresh chance:

1. Confirm `GOLD_API_COM_ENABLED=true` in secrets.
2. Run one manual smoke round via `Test Gold Providers (manual)`.
3. If smoke passes, run a full 24h bakeoff with
   `providers: gold_api_com,goldapi_io,twelvedata_xauusd`.
4. Compare the scorecard against Phase 1 results.

### Phase 3 — Production cutover

Follow [`gold-price-provider-migration.md`](./gold-price-provider-migration.md) exactly. Do not
switch production until:

- Scorecard winner has `recommendation = primary_candidate`
- `longest_frozen_timestamp_seconds < 900` (15 min)
- `success_rate ≥ 0.95` over 24h
- No 429 / quota exhaustion in the last 24h sample window
- Terms of service confirmed for public display and automated X posts
- `DRY_RUN_TWEET=true` confirmed in production workflow

---

## 7. Duplicate-posting logic audit

The duplicate guard is fully implemented and consists of two layers.

### Layer 1 — Legacy guards (`post_gold_price.py`)

In `get_gold_price()` and `_load_last_price()`:

- Reads `data/last_gold_price.json` for the last posted price
- Computes `chp` (change percent) against last price
- Computes content hash of generated tweet text
- Skips if generated tweet text hash matches previous hash

### Layer 2 — `tweet_guard.py` (`decide()`)

Evaluates five skip rules in order:

| #   | Skip reason                    | Trigger                                                                                  |
| --- | ------------------------------ | ---------------------------------------------------------------------------------------- | ----- | ------------------------- | --- | ------------------------------------------- |
| 1   | `stale_quote`                  | `is_fresh=false` (freshness > `MAX_GOLD_FRESHNESS_SECONDS`) and `ALLOW_STALE_TWEET≠true` |
| 2   | `provider_timestamp_unchanged` | Provider timestamp = last post's timestamp, `FORCE_SUMMARY_AFTER_MINUTES` not elapsed    |
| 3   | `duplicate_text_hash`          | SHA-256 of tweet text = last posted hash (X would reject anyway)                         |
| 4   | `fallback_no_change`           | `is_fallback=true` / `cache_last_known` / `spot_delayed` AND price unchanged             |
| 5   | `price_move_below_threshold`   | `                                                                                        | Δ USD | < MIN_TWEET_MOVE_USD`AND` | Δ % | < MIN_TWEET_MOVE_PCT` and no forced summary |

All state is stored in `data/last_tweet_state.json`.

### Recommended policy (for any provider switch)

```
Only post when ALL of:
  1. Provider returned a valid, fresh price (freshness_seconds ≤ 900)
  2. Provider timestamp advanced (or FORCE_SUMMARY window due)
  3. Tweet text hash differs from last posted
  4. Price moved enough (|Δ| ≥ $1.00 OR ≥ 0.03%), OR FORCE_SUMMARY window elapsed
```

This is exactly what `tweet_guard.decide()` enforces. No changes are needed to the guard logic — the
current implementation is correct.

The key upstream requirement is that the winning provider must **advance its timestamp** regularly.
A provider that serves the same timestamp for 30 minutes (like GoldPriceZ) will trigger rule 2
repeatedly, reducing live posts to the forced-summary cadence only.

---

## 8. Risks

| Risk                                                      | Severity | Mitigation                                                              |
| --------------------------------------------------------- | -------- | ----------------------------------------------------------------------- |
| gold-api.com hits limits again at production cadence      | High     | Bakeoff first; measure 7,200+ calls before switching production         |
| gold-api.com `updatedAt` does not advance during markets  | High     | Bakeoff tracks unique timestamps per hour and longest frozen interval   |
| goldapi_io free quota exhausted mid-month                 | Medium   | Bakeoff tracks 429s; confirm free plan allows 7,200/month before switch |
| Twelve Data terms restrict automated X posting            | Medium   | Review TwelveData ToS before naming as primary; use "reference" wording |
| FMP quota ~250/day too tight for 240/day production       | Medium   | Use as secondary or benchmark only; not tight enough at 6-min polling   |
| GoldPriceZ missing_price regression (seen 2026-05-01)     | High     | Do not restore GoldPriceZ as primary; keep only as last-resort fallback |
| Provider returns frozen price without advancing timestamp | Medium   | tweet_guard rule 2 catches this — bot skips, does not post duplicate    |
| X 403 duplicate rejection if guard is bypassed            | Low      | Guard is always active (`SKIP_DUPLICATE_TWEETS` defaults `true`)        |
| Bakeoff consumes API quota across multiple providers      | Low      | Bakeoff is non-production; only 3 providers × 7,200/month               |

---

## 9. Recommendation

### Current recommendation (pre-bakeoff, as of this writing)

> **"Need more bakeoff data before switching."**

No provider has been measured for ≥ 24 hours of continuous samples. The smoke test on 2026-05-01
confirms that `goldapi_io`, `twelvedata_xauusd`, and `fmp_gcusd` can return a real price for a
single round. That is not the same as proven reliability at 6-minute polling over a full market
cycle.

**gold-api.com specifically:**

- Its adapter is ready and complete.
- It previously failed in production for this project.
- Its free-tier claims have not been re-verified since the failure.
- It should be added to a **dedicated Phase 2 bakeoff run** rather than promoted on marketing claims
  alone.

**Minimum conditions for naming gold-api.com as primary:**

1. Smoke round passes (single round, no error).
2. 24h bakeoff completes with ≥ 200 samples, ≥ 95% success rate.
3. `longest_frozen_timestamp_seconds < 900` (15 min).
4. No 429 / rate-limit rows in the 24h window.
5. Terms of service explicitly permit automated public X posting.
6. Score ≥ 75 and `recommendation = primary_candidate` in scorecard.

---

## 10. Exact next steps before production switch

Walk through in order:

- [ ] Merge this infra PR (if not already merged).
- [ ] Wait for ≥ 24 hourly bakeoff runs to accumulate (the cron fires at minute 11 of every hour).
- [ ] Download the `gold-provider-bakeoff-<run_id>` artifact and open
      `data/provider_scorecard.json`.
- [ ] Fill in sections 4 and 5 of `docs/operator-inputs-gold-provider-bakeoff.md` with real numbers.
- [ ] Confirm the winner has `recommendation = primary_candidate`.
- [ ] _(Optional)_ Run Phase 2 bakeoff to include `gold_api_com`:
  - Set `GOLD_API_COM_ENABLED=true` as a GitHub repository secret.
  - Run `Test Gold Providers` with `providers: gold_api_com` to smoke.
  - If smoke passes, run 24h bakeoff with `providers: gold_api_com,goldapi_io,twelvedata_xauusd`.
- [ ] Review ToS for the winning provider (public display + X auto-post).
- [ ] Follow `docs/gold-price-provider-migration.md` for cutover.
- [ ] Run one hour of `DRY_RUN_TWEET=true` in `post_gold.yml` before flipping to live posting.

---

## 11. What still needs manual confirmation

| Item                                                                   | How to confirm                                                    |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------- |
| gold-api.com free tier: does it actually allow 7,200+ req/month?       | Run bakeoff for 48h at 6-min interval; count 429s                 |
| gold-api.com `updatedAt`: does it advance every minute during markets? | Bakeoff `did_timestamp_change_vs_previous_provider_sample` column |
| gold-api.com ToS: public display and automated X posting allowed?      | Read https://gold-api.com and its API docs/ToS page               |
| GoldAPI.io free plan: current actual monthly limit?                    | Account dashboard or support email                                |
| Twelve Data: is automated X posting explicitly permitted?              | Read https://twelvedata.com/legal                                 |
| FMP: is 240/day sustainable or will the free plan run out mid-month?   | Account dashboard; test 2-week bakeoff                            |
| Metal Sentinel HTTP 400: wrong endpoint or wrong API host?             | Inspect Metal Sentinel dashboard for correct host/path            |
| Finnhub: can you get XAU on a paid plan cost-effectively?              | Check Finnhub pricing; compare with Twelve Data free              |

---

## 12. GitHub Secrets checklist for bakeoff testing

These are **not** production secrets (production uses GoldPriceZ only until cutover). Set these to
enable bakeoff providers.

| Secret name              | Required for                         | Notes                                            |
| ------------------------ | ------------------------------------ | ------------------------------------------------ |
| `GOLDAPI_IO_KEY`         | goldapi_io bakeoff                   | Already in use from 2026-05-01 smoke             |
| `TWELVEDATA_API_KEY`     | twelvedata_xauusd bakeoff            | Already in use from 2026-05-01 smoke             |
| `FMP_API_KEY`            | fmp_gcusd bakeoff                    | Already in use from 2026-05-01 smoke             |
| `GOLD_API_COM_ENABLED`   | gold_api_com bakeoff (set to `true`) | Controls `GOLD_API_COM_ENABLED` in test workflow |
| `GOLD_API_COM_KEY`       | gold_api_com bakeoff (optional)      | gold-api.com works without a key per their docs  |
| `FINNHUB_API_KEY`        | finnhub_oanda bakeoff                | Only useful if XAU confirmed on free/paid tier   |
| `METAL_SENTINEL_API_KEY` | metal_sentinel bakeoff               | Only useful after HTTP 400 root cause fixed      |

---

_Last updated: 2026-05-06. Update this file when bakeoff samples arrive and a winner is selected._
