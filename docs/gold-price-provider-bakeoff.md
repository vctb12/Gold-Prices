# Gold-price provider bakeoff

> Status: infrastructure landed; **no provider has been crowned yet**. The bakeoff is the source of
> truth — until it produces samples, every provider in the registry is a _candidate_.
>
> Operator checklist for keys, enablement flags, and the go/no-go gates for production cutover lives
> in [`operator-inputs-gold-provider-bakeoff.md`](./operator-inputs-gold-provider-bakeoff.md).
>
> Owner-only pre-merge checklist:
> [`OWNER_ACTIONS_REQUIRED_GOLD_BAKEOFF.md`](./OWNER_ACTIONS_REQUIRED_GOLD_BAKEOFF.md). Before
> opening for review or merging, run the readiness gate:
> `python scripts/python/gold_bakeoff_readiness.py --strict` (also available as **Actions → Gold
> Bakeoff Readiness**).
>
> ⚠️ **Pre-merge smoke testing path.** A brand-new `workflow_dispatch` workflow on a feature branch
> is **not** reliably visible in the Actions UI — GitHub only lists the "Run workflow" button after
> the file is on the default branch. To validate providers before merge, use the
> `pull_request`-triggered **PR Provider Smoke** check (`.github/workflows/pr-provider-smoke.yml`),
> which appears under PR → Checks immediately. Local CLI fallback and full instructions: see
> [`OWNER_ACTIONS_REQUIRED_GOLD_BAKEOFF.md`](./OWNER_ACTIONS_REQUIRED_GOLD_BAKEOFF.md#exact-next-action-from-github-ui).

This doc covers:

1. Why we stopped depending on a single provider.
2. How the adapter system is shaped.
3. How to run the bakeoff locally and in GitHub Actions.
4. How to read the scorecard.
5. What input is still needed from the user.

Related docs:

- [`docs/gold-price-provider-migration.md`](./gold-price-provider-migration.md) — how to flip the
  production switch once a winner is chosen.
- [`docs/gold-api-provider-evaluation.md`](./gold-api-provider-evaluation.md) — deep-dive evaluation
  of gold-api.com and all candidates; request math; Phase 2 bakeoff plan.
- [`docs/data-source-methodology.md`](./data-source-methodology.md) — how the normalized schema and
  AED math work.
- [`docs/x-automation-duplicate-policy.md`](./x-automation-duplicate-policy.md) — how the X bot
  avoids duplicate posts.

---

## 1. Why a bakeoff (and not "just pick Twelve Data")

| Provider                  | Why it isn't a free pick                                                                                                                                                                                    |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **GoldPriceZ** (current)  | Real-world freezes for **30–45 minutes**, which causes duplicate-post rejections from X (HTTP 403, error code 187).                                                                                         |
| **gold-api.com** (legacy) | Hit limits / became unreliable in this project's previous production usage. Disabled by default; not primary.                                                                                               |
| **Twelve Data**           | Indexed docs show `/time_series` is 1 credit per symbol and Basic = 8 credits/min, 800/day, but free-key access for `XAU/USD` and public/social-display terms must still be confirmed against real samples. |
| **GoldAPI.io**            | Different vendor from gold-api.com. Free quota historically very low (~100/month). Candidate only.                                                                                                          |
| **Finnhub OANDA XAU/USD** | Free key may be plan-gated for forex/metals. Adapter detects `s=no_data` and "don't have access" responses and tags them `plan_gated`.                                                                      |
| **FMP GCUSD**             | GCUSD is COMEX gold _futures_, not pure spot — labeled `futures_reference`. Free plan is tight for 240/day.                                                                                                 |
| **Metal Sentinel**        | Adapter implemented permissively because the docs/dashboard couldn't be verified at implementation time. Bakeoff will tell us if it's real.                                                                 |

The right answer is therefore not _which provider_ — it's _measure them_.

## 2. Adapter architecture

```
scripts/python/gold_providers/
├── __init__.py        ← public re-exports
├── base.py            ← shared types, error categories, env helpers,
│                        timestamp/price parsers, sanity checks
├── normalize.py       ← raw quote → canonical schema (see methodology doc)
├── http_client.py     ← timeout + retry + rate-limit-header extraction;
│                        never logs URLs, headers, or bodies
├── registry.py        ← name → fetch() mapping; safe dispatch
├── metal_sentinel.py
├── finnhub.py         ← OANDA:XAU_USD
├── fmp.py             ← GCUSD
├── goldapi_io.py      ← XAU/USD via x-access-token
├── twelvedata.py      ← /time_series interval=1min
├── goldpricez.py      ← legacy production source
└── gold_api_com.py    ← legacy reference, disabled by default
```

Every adapter:

- Reads its own `*_ENABLED` and `*_API_KEY` env vars.
- Returns either a `make_success(...)` raw quote or a structured `make_error(...)` result. Never
  raises.
- Skips cleanly with `provider_disabled` / `missing_api_key` so downstream code keeps walking the
  order.
- Categorizes failures into the canonical set in
  [`base.ERROR_CATEGORIES`](../scripts/python/gold_providers/base.py).
- Never logs API keys — and the bakeoff JSONL captures only a SHA-256 hash of parsed bodies unless
  `BAKEOFF_LOG_RAW=true`.

Provider order is configured by `GOLD_PROVIDER_ORDER` (comma-separated), with a sensible default in
[`fetch_gold_price.py`](../scripts/python/fetch_gold_price.py) and `.env.example`.

## 3. Running the bakeoff

### Local (one round)

```bash
cp .env.example .env       # then fill in the keys you have
set -a && . ./.env && set +a
python scripts/python/provider_bakeoff.py --once
```

### Local (timed sampling)

```bash
# 30 minutes @ every 60s, only against two providers
python scripts/python/provider_bakeoff.py \
  --duration-hours 0.5 \
  --interval-seconds 60 \
  --providers metal_sentinel,goldpricez
```

### GitHub Actions

Two workflows ship:

- **Manual smoke test:**
  [`.github/workflows/test-gold-providers.yml`](../.github/workflows/test-gold-providers.yml) — runs
  once, no commit, no X post, uploads a sanitized artifact. Use this when you wire up a new key.
- **Hourly + on-demand bakeoff:**
  [`.github/workflows/gold-provider-bakeoff.yml`](../.github/workflows/gold-provider-bakeoff.yml) —
  runs one round per hour at minute 11 (offset away from the busy minute 0 where Actions sees the
  most schedule starvation), and supports `workflow_dispatch` with `duration_hours`,
  `interval_seconds`, `providers`, and `commit_results`. Uploads JSONL + scorecard as artifacts.
  Commits to the branch only if `commit_results=true`.

The hourly cadence intentionally avoids one long 24–48 h run because hosted runners can be
evicted/timed out, especially during platform incidents.

## 4. Reading the scorecard

Run:

```bash
python scripts/python/provider_scorecard.py
# → data/provider_scorecard.json
```

The scorecard ranks providers by a weighted score in `[0, 100]`:

| Component            | Weight | Reasoning                                                           |
| -------------------- | ------ | ------------------------------------------------------------------- |
| Update frequency     | 35%    | `unique_timestamps_per_hour` and longest-frozen-timestamp interval. |
| Success rate         | 25%    | Successful samples / total attempts.                                |
| Freshness            | 20%    | Median + p95 of `freshness_seconds`.                                |
| Response time        | 10%    | Average response time (≤500 ms = full credit, ≥5 s = none).         |
| Quota / terms safety | 10%    | Penalizes 429s, auth failures, malformed responses.                 |

Recommendation labels:

- `primary_candidate` — score ≥ 75, success ≥ 90%, longest frozen TS < 15 min.
- `secondary_candidate` — score ≥ 55, success ≥ 80%, longest frozen TS < 30 min.
- `fallback_only` — usable but slow/frozen-prone.
- `avoid` — quota/auth blocks or zero successful samples.

Real update frequency is weighted higher than provider claims. A provider that _says_ it's 1-minute
spot but freezes for 30 minutes will rank below a provider that honestly reports a 5-minute
reference price that actually advances.

## 5. What's still on the user

The infrastructure is now done. The remaining decisions need real keys / real signals:

- **Add API keys** to GitHub Secrets for the providers you want to test (`TWELVEDATA_API_KEY`,
  `FINNHUB_API_KEY`, `GOLDAPI_IO_KEY`, `FMP_API_KEY`, `METAL_SENTINEL_API_KEY` + `*_ENABLED=true`).
  Missing keys produce a clean `missing_api_key` row and don't break anything.
- **Let the hourly bakeoff run** for ≥ 24 hours so the scorecard has enough samples per provider.
- **Decide whether to commit bakeoff results** to git or keep them as artifacts.
  (`commit_results=true` workflow input.)
- **Pick the winner** based on the scorecard, then follow
  [`docs/gold-price-provider-migration.md`](./gold-price-provider-migration.md) to flip
  `GOLD_PROVIDER_ORDER` in production.
- **Optional:** reduce polling from 6 minutes to 10 minutes (cron `3-53/10 * * * *`) if a winner has
  tighter quota; see the migration doc.

No claim of "best provider" should be made until the scorecard has at least 24 hours of samples
across providers in both market-open and market-closed windows.
