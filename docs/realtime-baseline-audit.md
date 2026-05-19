# Realtime Baseline Audit (Phase 0)

> Purpose: measured snapshot of the gold-price data path **as it actually runs today**, before any
> "realtime" changes are claimed. Subsequent phases build on this baseline; the validation report
> (`docs/realtime-validation-report.md`) compares before/after against the same hops.

Status: **valid** for the snapshot date below. Re-measure on cron cadence changes, provider swaps,
or transport upgrades (see runbook).

---

## 1. End-to-end data path

```
┌────────────────────────┐
│ gold-api.com (free)    │  upstream spot reference (XAU/USD)
└──────────┬─────────────┘
           │  HTTPS GET ~400 ms (provider_response_time_ms)
           ▼
┌────────────────────────┐
│ GitHub Actions cron    │  .github/workflows/gold-price-fetch.yml
│   '2 21-23 * * 0'      │  Sunday  21:02–23:02 UTC
│   '2 *  * * 1-4'       │  Mon–Thu hourly at :02
│   '2 0-20 * * 5'       │  Friday  00:02–20:02 UTC
└──────────┬─────────────┘
           │  scripts/python/fetch_gold_price.py writes
           ▼
┌────────────────────────┐
│ data/gold_price.json   │  committed back to main; static JSON
│  + is_fresh            │  truth metadata written by the adapter
│  + is_fallback         │  (was thrown away by the client before
│  + freshness_seconds   │  this PR — see Phase 2)
│  + max_freshness_seconds
│  + timestamp_source    │
└──────────┬─────────────┘
           │  served by GitHub Pages / custom domain
           ▼  (also fetched by Node admin backend)
┌────────────────────────┐
│ Node/Express backend   │  server/routes/api-v1.js
│ /api/v1/prices/latest  │  reads Supabase price_snapshots first,
└──────────┬─────────────┘  then falls back to gold_price.json
           │   JSON envelope, ~10–50 ms
           ▼
┌────────────────────────┐
│ Client src/lib/api.js  │  fetchGold() — backend first (4 s timeout),
│ normalizeGoldResponse  │  static JSON second, localStorage cache third
└──────────┬─────────────┘
           │
           ▼
┌────────────────────────┐
│ getLiveFreshness()     │  src/lib/live-status.js — single source of
│  live | delayed |      │  truth for the freshness vocabulary used by
│  cached | stale |      │  hero, tracker, ticker, country pages,
│  fallback |            │  footer, country grids, etc.
│  unavailable           │
└────────────────────────┘
```

## 2. Measured timestamps at each hop

Sampled from `data/gold_price.json` on 2026-05-19:

| Hop                                       | Field                       | Value                  |
| ----------------------------------------- | --------------------------- | ---------------------- |
| Upstream provider source time             | `timestamp_utc`             | `2026-05-19T08:12:06Z` |
| Adapter ingestion (file write)            | `fetched_at_utc`            | `2026-05-19T08:12:17Z` |
| Adapter ingest lag                        | `fetched_at - timestamp`    | **≈ 11 s**             |
| Provider HTTP response time               | `provider_response_time_ms` | **384 ms**             |
| Provider freshness budget                 | `max_freshness_seconds`     | 900 s (15 min)         |
| `is_fresh` (provider reports fresh)       | `is_fresh`                  | `true`                 |
| `is_fallback` (adapter served from cache) | `is_fallback`               | `false`                |

The adapter publishes within ~11 s of the provider's source timestamp. The **dominant latency
contributor is the cron cadence, not the network path.**

## 3. Cadence reality (the most important truth in this audit)

- **Upstream provider cadence**: configurable; gold-api.com free tier returns a current spot
  reference per call. The provider does not push.
- **Workflow cadence**: **once per hour at minute :02**, market hours only. `'2 * * * 1-4'` is the
  Mon–Thu schedule.
- **Client poll cadence**: 90 s (`CONSTANTS.GOLD_REFRESH_MS = 90000` in `src/config/constants.js`).
- **Stale threshold prior to this PR**: 12 min (`STALE_AFTER_MS = 12 * 60 * 1000` with a comment
  that wrongly claimed "the workflow runs every 6 minutes"). With hourly upstream and a 12-minute
  threshold, the pill flipped to "stale" for ~48 of every 60 minutes — **truthful in direction,
  wrong in documentation**.

> The doc-comment in `src/lib/live-status.js` claiming "every 6 minutes" was simply wrong; this PR
> corrects it and aligns thresholds with the **actual hourly cadence** (DELAYED_AFTER_MS = 30 min,
> STALE_AFTER_MS = 75 min).

## 4. Baseline metrics (back-of-envelope, before this PR)

Computed from the cron schedule + provider response time. These are deterministic properties of the
schedule, not stochastic measurements requiring a soak test.

| Metric                                | Baseline (pre-PR)                | Notes                                                                                                          |
| ------------------------------------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| End-to-end ingest latency (median)    | ≈ 11 s after source timestamp    | Bounded by `fetched_at_utc - timestamp_utc`.                                                                   |
| End-to-end ingest latency (p95)       | ≈ 30 s (network/CI jitter)       | Bounded by cron-job runtime in Actions.                                                                        |
| Staleness age, median                 | ≈ 30 min                         | Mean midpoint of an hourly refresh interval.                                                                   |
| Staleness age, p95                    | ≈ 57 min                         | Just before next refresh.                                                                                      |
| Update frequency observed over 15 min | ≤ 1 refresh in any 15-min window | Cron at :02, so 75% of 15-min windows contain zero refreshes.                                                  |
| Fallback rate                         | depends on provider uptime       | `is_fallback === true` rows in `data/gold_price.json` history.                                                 |
| **Truth bug (pre-PR)**: `isFallback`  | **lost by client**               | `normalizeGoldResponse()` discarded the field; UI could show "Live" for a fallback snapshot. Fixed in Phase 2. |

## 5. Top bottlenecks (ranked)

1. **Hourly cron cadence**. The single largest contributor to staleness. Tightening it requires a
   paid provider tier or persistent backend worker (see `docs/realtime-architecture.md`).
2. **Truth-metadata loss at the client boundary**. Even when the upstream pipeline knew the data was
   a fallback, the client UI threw away `is_fallback` / `is_fresh` / `freshness_seconds` /
   `max_freshness_seconds` and labelled based on age alone. **Fixed in this PR** by extending
   `normalizeGoldResponse()` and the `getLiveFreshness()` engine.
3. **Wrong cadence documented**. `STALE_AFTER_MS = 12 min` plus a doc comment claiming a 6-minute
   cron schedule. **Fixed in this PR**.
4. **Polling-only transport**. Client polls every 90 s but upstream only changes hourly; 39 of every
   40 polls observe no change. A push transport (SSE/WebSocket) would eliminate this, but does not
   change the upstream refresh rate — it only minimizes time-to-glass once a new value lands.

## 6. What is **not** measured here

- A 30-min real-traffic soak test (not run in this PR; see runbook).
- Dropped-event rate under packet loss (no streaming transport today).
- CPU/memory profile of long-lived clients (no soak harness in repo).

These are deferred to the SSE/WS upgrade described in `docs/realtime-architecture.md`.

## 7. Re-measure trigger checklist

Re-run this audit whenever:

- [ ] The `gold-price-fetch.yml` cron schedule changes (cadence or windows).
- [ ] The upstream provider is swapped (gold-api.com → another vendor).
- [ ] `GOLD_REFRESH_MS` changes in `src/config/constants.js`.
- [ ] `getLiveFreshness()` thresholds change in `src/lib/live-status.js`.
- [ ] An SSE/WebSocket push transport ships.

Update `docs/realtime-validation-report.md` in the same PR.
