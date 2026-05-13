# Data-source methodology

This is the canonical reference for how Gold Ticker Live takes a raw gold quote from any provider
and turns it into the prices the site displays and the bot tweets.

The same pipeline applies to every adapter in `scripts/python/gold_providers/`; nothing
provider-specific leaks into display or social copy.

---

## 1. Constants

```python
TROY_OUNCE_GRAMS = 31.1034768   # international troy ounce → grams
DEFAULT_AED_PEG  = 3.6725       # USD → AED, UAE Central Bank pegged rate
DEFAULT_MAX_FRESHNESS_SECONDS = 900   # 15 minutes
DEFAULT_MIN_VALID_XAU_USD = 500       # sanity floor (rejects "$0.50/oz")
DEFAULT_MAX_VALID_XAU_USD = 10000     # sanity ceiling
```

Overridable via env vars `AED_PEG`, `MAX_GOLD_FRESHNESS_SECONDS`, `MIN_VALID_XAU_USD`,
`MAX_VALID_XAU_USD`.

The AED peg is fixed by the UAE Central Bank — we do not derive it from a forex feed. If the peg
ever changes, update the env var; the math reflects it immediately.

## 2. AED math

```
usd_per_gram_24k = xau_usd_per_oz / TROY_OUNCE_GRAMS
aed_per_gram_24k = usd_per_gram_24k * AED_PEG
```

Lower karats are derived by purity ratio (in tracker code, not in the fetcher) —
`22K = 24K × 22/24`, `21K = 24K × 21/24`, `18K = 24K × 18/24`. The site is honest that retail
(jewelry shop) prices include making charges, VAT, and dealer premium **on top** of these
spot-derived references; no provider quote is presented as a retail/jewelry price.

## 3. Normalized schema

Every adapter emits — through `gold_providers.normalize.normalize_quote()` — a payload with this
shape (schema_version=1):

```json
{
  "schema_version": 1,
  "provider": "twelvedata_xauusd",
  "provider_url": "https://twelvedata.com/",
  "source_type": "spot_reference",
  "raw_symbol": "XAU/USD",
  "quote_currency": "USD",
  "xau_usd_per_oz": 4550.0,
  "usd_per_gram_24k": 146.2875,
  "aed_per_gram_24k": 537.3,
  "aed_peg": 3.6725,
  "timestamp_utc": "2026-05-01T10:00:00Z",
  "timestamp_source": "provider",
  "fetched_at_utc": "2026-05-01T10:00:10Z",
  "freshness_seconds": 10,
  "max_freshness_seconds": 900,
  "is_fresh": true,
  "is_fallback": false,
  "bid": null,
  "ask": null,
  "spread": null,
  "provider_response_time_ms": 220,
  "notes": null
}
```

### `source_type`

Values listed in priority order — defaults to `spot_reference` unless the provider clearly proves
real live spot:

- `spot_live` — sub-minute live spot, dealer-grade.
- `spot_reference` — quoted as XAU/USD spot but with vendor caveats (e.g. Twelve Data, GoldAPI.io).
  **The default for most adapters.**
- `spot_delayed` — 5–15 minute delayed spot.
- `futures_reference` — futures (e.g. FMP GCUSD = COMEX). Tweet copy is required to disclose this.
- `commodity_reference` — broader commodity index, not pure XAU/USD.
- `daily_fix` — once-a-day fix (LBMA / kitco AM/PM).
- `cache_last_known` — provider returned a cached/last-known value (e.g. weekend).
- `unknown` — adapter could not classify; conservative default.

### `timestamp_source`

- `provider` — extracted from the API response.
- `missing` — provider returned no timestamp; `is_fresh` is forced to `false`.

### `is_fresh`

`fetched_at_utc - timestamp_utc <= max_freshness_seconds`. If `timestamp_source == "missing"`,
`is_fresh` is always `false`.

### `is_fallback`

`true` when the orchestrator had to use a stale quote (with `ALLOW_STALE_PRICE=true`) or a
circuit-breaker fallback. Tweet copy must add a "(fallback source)" disclaimer when this is `true`.

## 4. Error categories

Every failure path uses one of the canonical categories in
[`gold_providers.base.ERROR_CATEGORIES`](../scripts/python/gold_providers/base.py):

`missing_api_key`, `provider_disabled`, `network_error`, `timeout`, `http_error`, `auth_error`,
`rate_limited`, `quota_exhausted`, `malformed_json`, `missing_price`, `missing_timestamp`,
`stale_timestamp`, `sanity_range_failed`, `unsupported_symbol`, `plan_gated`, `terms_unclear`,
`unknown_error`.

The bakeoff log and scorecard both depend on these names being stable and lowercase-snake-case.
Never invent new categories without adding them to `ERROR_CATEGORIES` first.

## 5. Sanity range

Every adapter rejects prices outside `[MIN_VALID_XAU_USD, MAX_VALID_XAU_USD]` with
`sanity_range_failed`. This catches obvious malformed responses (e.g. a provider returning grams
instead of ounces) before they propagate to display or X.

## 6. Provider-state circuit breaker

`scripts/python/fetch_gold_price.py` keeps `data/provider_state.json` with per-provider:

- `consecutive_failures` (resets to 0 on success).
- `last_success_utc` / `last_failure_utc`.
- `last_error_category`.
- `circuit_open_until_utc` — when set and `> now`, the provider is skipped for that round.

Open-window heuristics:

- `rate_limited` / `quota_exhausted` → open for 60 minutes.
- 3 consecutive failures of any other category → open for 30 minutes.

This avoids burning quota on a provider that is currently failing, without permanently disabling it.

## 7. Backwards compatibility

The legacy `data/gold_price.json` consumed `gold.ounce_usd` from a GoldPriceZ-shaped object. Until
the migration flips, the legacy fetcher (`scripts/fetch_gold_price.py`) keeps writing that shape.

The new fetcher (`scripts/python/fetch_gold_price.py`) writes the normalized schema above. When we
flip production:

- Tracker pages and downstream consumers read the new schema.
- The X bot reads the same file via `tweet_guard` which understands the new fields (`is_fresh`,
  `is_fallback`, `source_type`, `timestamp_utc`).
- Anything that still wants the legacy field names can compute them from the normalized payload
  (`xau_usd_per_oz` is `gold.ounce_usd`).

See [`gold-price-provider-migration.md`](./gold-price-provider-migration.md) for the migration steps
and rollback plan.
