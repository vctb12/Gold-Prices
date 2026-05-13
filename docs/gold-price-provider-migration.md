# Gold-price provider migration

This is the runbook for flipping production from GoldPriceZ to whichever provider wins the bakeoff
(see [`gold-price-provider-bakeoff.md`](./gold-price-provider-bakeoff.md)).

Manual prerequisites (API keys, enablement flags, scorecard review, polling cadence decisions) are
tracked in [`operator-inputs-gold-provider-bakeoff.md`](./operator-inputs-gold-provider-bakeoff.md).

Owner-only pre-merge checklist:
[`OWNER_ACTIONS_REQUIRED_GOLD_BAKEOFF.md`](./OWNER_ACTIONS_REQUIRED_GOLD_BAKEOFF.md). Before opening
for review or merging, run the readiness gate:
`python scripts/python/gold_bakeoff_readiness.py --strict`.

Until the bakeoff has produced samples we **do not pick a winner**. The infrastructure is
intentionally drop-in so the migration is a config change, not a code change.

---

## 1. Pre-flight

Before flipping anything, confirm:

- [ ] Bakeoff has ≥ 24h of samples per candidate. `data/provider_scorecard.json` shows at least one
      provider with `recommendation = primary_candidate`.
- [ ] `longest_frozen_timestamp_seconds` for the chosen provider is **< 900s** (15 min). This is the
      GoldPriceZ failure mode — it is not optional.
- [ ] `success_rate ≥ 0.95` over the last 24h sample.
- [ ] No `auth_error` / `quota_exhausted` rows for the candidate in the last 24h.
- [ ] Public/social posting terms have been read for the chosen provider. Twelve Data and FMP both
      have explicit redistribution clauses; GoldAPI.io's terms are minimal but quota-bound.

## 2. Switch order

Once a winner is selected:

1. **Add the winner's secrets** to repository GitHub Secrets if not already (`*_API_KEY`,
   `*_ENABLED=true`, optional symbol overrides).
2. **Run the manual smoke test** (`Test Gold Providers (manual)` workflow) restricted to the winner
   — confirm a single fresh quote arrives.
3. **Update `GOLD_PROVIDER_ORDER`** so the winner is first. Suggested defaults:
   - Winner first.
   - One independent secondary (different vendor, different data source) second.
   - GoldPriceZ last as a final fallback while we monitor.
4. **Commit** the new order via `.env.example` (for documentation) and
   `.github/workflows/post_gold.yml` (env block). Production reads from secrets, not from
   `.env.example`.
5. **Watch one full hour** of the post workflow with `DRY_RUN_TWEET=true` — confirm:
   - `should_post=true` is emitted at least once.
   - The tweet-guard skip reasons make sense (especially `provider_timestamp_unchanged` should be
     rare, not constant — that was the old GoldPriceZ symptom).
6. **Flip `DRY_RUN_TWEET=false`** for the next run.
7. Keep the bakeoff workflow running so we keep getting drift signal on the secondary providers.

## 3. Polling cadence

The original spec asks for 6-minute polling. The hosted GitHub Actions scheduler is best-effort:
jobs at minute 0 are commonly delayed. The post workflow already uses an offset cron and
concurrency; the recommended starting point post-migration is **10 minutes**:

```yaml
- cron: '3-53/10 * * * *'
```

…and only tighten to 6 minutes (`2-56/6 * * * *`) once the chosen provider's quota and freshness
numbers in the scorecard prove a quieter 6-minute schedule won't push us over plan limits.

Do **not** use `*/6 * * * *` — it bunches at minute 0, which is the slot most vulnerable to
scheduler eviction.

## 4. Rollback

The legacy fetcher (`scripts/fetch_gold_price.py`) and the `scripts/python/post_gold_price.py`
price-change guard have **not** been touched, only extended. To roll back:

1. Set `GOLD_PROVIDER_ORDER=goldpricez` in the workflow env.
2. Disable other providers (`*_ENABLED=false`).
3. Optionally clear `data/last_tweet_state.json` (revert to `{ schema_version: 1, ... null }`).

The legacy duplicate guards (price-change + content-hash) are still the first line of defense even
with the new code.

## 5. What changes for downstream consumers

Nothing user-visible. The canonical `data/gold_price.json` schema is unchanged for consumers that
already read it; the new orchestrator produces a richer normalized schema (extra fields like
`is_fresh`, `is_fallback`, `freshness_seconds`, `source_type`). Existing consumers that read only
`gold.ounce_usd` keep working — see [`data-source-methodology.md`](./data-source-methodology.md) for
the exact transition shape.

## 6. Sign-off checklist

- [ ] Scorecard winner identified.
- [ ] Secrets configured.
- [ ] Smoke test green.
- [ ] One hour dry-run green.
- [ ] Production cron updated (10 min, offset).
- [ ] First live tweet after migration appears with the expected `provider` field in
      `data/last_tweet_state.json`.
- [ ] Bakeoff continues hourly so we keep evidence on standby providers.
