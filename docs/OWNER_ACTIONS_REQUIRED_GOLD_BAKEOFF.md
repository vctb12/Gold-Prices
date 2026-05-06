# Owner Actions Required — Gold Provider Bakeoff & X Duplicate-Post Guard

> Direct, manual-only checklist of what the **repo owner** still has to do before this PR is safe to
> mark Ready for Review or merge. Copilot/agents cannot do these for you — they require your
> accounts, your secrets, and your decisions.

---

## Current repo status

- ✅ **Infrastructure implemented.** Provider adapters, bakeoff runner, scorecard, fetch
  orchestrator, X duplicate-post guard, manual provider test workflow, hourly bakeoff workflow,
  operator checklist, env example, and tests are all present.
- ✅ **Tests passing.** `pytest tests/ scripts/python/` — 65/65 green.
- ✅ **Production unchanged.** `gold-price-fetch.yml` still runs the legacy
  `scripts/fetch_gold_price.py`; `post_gold.yml` still consumes the legacy `data/gold_price.json`.
  No production cutover has been performed.
- ✅ **New provider system dormant.** The new orchestrator at `scripts/python/fetch_gold_price.py`
  is not scheduled in any workflow yet.
- ❌ **No real provider winner yet.** No real bakeoff samples exist, the scorecard contains only
  no-key skip data, and no winning/backup provider has been chosen.
- ✅ **PR-visible smoke gate satisfied (2026-05-01).** `PR Provider Smoke` returned real `ok` rows
  from `twelvedata_xauusd`, `goldapi_io`, and `fmp_gcusd`. Details in
  [Smoke test results — 2026-05-01](#smoke-test-results--2026-05-01) below. Winner / backup / 24h
  bakeoff / production cutover are still pending.

---

## Owner must do before merge

Walk through these in order. Do not check the next box until the previous one is genuinely true.

- [x] Open the PR as **Draft**
- [x] Add at least **2 provider API keys** as GitHub Secrets (see "Recommended provider keys" below)
      — `TWELVEDATA_API_KEY`, `GOLDAPI_IO_KEY`, `FMP_API_KEY`, `FINNHUB_API_KEY`,
      `METAL_SENTINEL_API_KEY` confirmed exposed in the PR Provider Smoke run
- [x] Enable those providers in workflow/env (`*_ENABLED=true` flags) — set inside the smoke job env
      block only; production env is unchanged
- [x] Confirm **PR Provider Smoke** check is green on PR #253 with at least one real `ok` row from a
      non-legacy provider — **3 real `ok` rows** observed (see "Smoke test results — 2026-05-01"
      below)
- [ ] Run `gold-provider-bakeoff.yml` for **at least 24 hours**, preferably **48 hours** — restrict
      the first run to `goldapi_io,twelvedata_xauusd,fmp_gcusd` (see notes below)
- [ ] Download the bakeoff artifact and review `data/provider_scorecard.json`
- [ ] Select a **winning provider** based on the scorecard (not on docs/marketing)
- [ ] Select a **backup provider**
- [ ] Fill in `docs/operator-inputs-gold-provider-bakeoff.md` (sections 2, 3, 4, 5, 6, 8, 11)
- [ ] Ask Copilot to prepare an explicit **production cutover** PR
- [ ] Run a dry-run tweet with **real data** (`DRY_RUN_TWEET=true`)
- [ ] Confirm the **rollback path** works (legacy `post_gold.yml` can be re-enabled)
- [ ] Only then mark the PR **Ready for Review**
- [ ] Only then **merge**

---

## Recommended provider keys to add first

Add whichever ones you actually have. **At least two candidates** must be tested for the bakeoff to
be meaningful.

| Secret name               | Provider                | Notes                                                                                                       |
| ------------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------- |
| `TWELVEDATA_API_KEY`      | Twelve Data XAU/USD     | Strong candidate; verify social/display terms                                                               |
| `FINNHUB_API_KEY`         | Finnhub OANDA:XAU_USD   | Confirm XAU is on free tier                                                                                 |
| `FMP_API_KEY`             | Financial Modeling Prep | Tight free quota — likely fallback only                                                                     |
| `GOLDAPI_IO_KEY`          | GoldAPI.io              | Candidate-only; not previously used                                                                         |
| `METAL_SENTINEL_API_KEY`  | Metal Sentinel          | Set with `METAL_SENTINEL_API_HOST`                                                                          |
| `METAL_SENTINEL_API_HOST` | Metal Sentinel host     | RapidAPI host or direct URL                                                                                 |
| `GOLD_API_COM_ENABLED`    | gold-api.com (Phase 2)  | Set to `true` to enable for bakeoff. **Re-evaluation candidate** — previously hit limits; adapter is ready. |
| `GOLD_API_COM_KEY`        | gold-api.com (optional) | No key required per provider docs. Set if you have one.                                                     |

Notes:

- **GoldPriceZ** can remain as legacy/fallback but should **not** be the winning provider unless the
  scorecard somehow proves it (it has historically frozen for 30–45 minutes at a time).
- **gold-api.com** is **disabled by default** because it previously hit limits in production. It is
  a re-evaluation candidate — see
  [`docs/gold-api-provider-evaluation.md`](./gold-api-provider-evaluation.md) for the full deep-dive
  and the Phase 2 bakeoff plan.
- **goldapi.io** is **candidate-only**, disabled by default.

---

## Exact GitHub UI steps

1. Go to the repo → **Settings**.
2. Click **Secrets and variables** → **Actions**.
3. Click **New repository secret**.
4. Add each provider key from the table above (one secret per row).
5. Optionally also add `*_ENABLED=true` repository variables (or set the matching env flag in
   `.env.example` for local runs).
6. Go to **Actions** → **Test Gold Providers (manual)** → **Run workflow**.
7. After the smoke test passes, go to **Actions** → **Gold Provider Bakeoff** → **Run workflow** (or
   let the hourly cron collect samples for ≥ 24 h).
8. Download the artifact from the bakeoff run; inspect `data/provider_scorecard.json`.

---

## After adding secrets, run these

```text
# Manual smoke test (Actions UI):
Actions → Test Gold Providers (manual) → Run workflow
  providers: (leave blank to test all enabled, or e.g. twelvedata_xauusd,finnhub_oanda)
  log_raw: false

# Manual bakeoff (Actions UI):
Actions → Gold Provider Bakeoff → Run workflow
  providers: twelvedata_xauusd,finnhub_oanda,fmp_gcusd,goldapi_io
  duration_hours: 24
  interval_seconds: 360
  commit_results: false
  log_raw: false

# Local readiness gate (run before opening for review or merging):
python scripts/python/gold_bakeoff_readiness.py --strict
```

---

## Smoke test results — 2026-05-01

The `PR Provider Smoke` check ran successfully against PR #253. One-round smoke results:

| Provider            | Status           | HTTP | Price (USD/oz) | Source timestamp     |
| ------------------- | ---------------- | ---- | -------------- | -------------------- |
| `twelvedata_xauusd` | ✅ ok            | 200  | ~4639.14       | 2026-05-01T15:33:00Z |
| `goldapi_io`        | ✅ ok            | 200  | ~4637.47       | 2026-05-01T15:34:53Z |
| `fmp_gcusd`         | ✅ ok            | 200  | ~4647.50       | 2026-05-01T15:24:54Z |
| `finnhub_oanda`     | ❌ plan_gated    | 403  | —              | —                    |
| `metal_sentinel`    | ❌ http_error    | 400  | —              | —                    |
| `goldpricez`        | ❌ missing_price | 200  | —              | —                    |

**The smoke gate is satisfied.** Three non-legacy providers returned real `ok` rows, which clears
the "PR Provider Smoke ≥ 1 real `ok` row" merge-checklist item above. **Every other gate is still
blocked** — winner selection, backup selection, 24h+ bakeoff, scorecard review, and production
cutover all remain pending.

### Notes on individual providers

- **`finnhub_oanda`** — currently **plan-gated** on the configured key (HTTP 403). Exclude from the
  first 24h bakeoff unless the operator intentionally retests it after upgrading the Finnhub plan or
  re-verifying that XAU is on the free tier.
- **`metal_sentinel`** — returned **HTTP 400**. Either fix separately (host/path/symbol may need
  adjustment per the Metal Sentinel dashboard) or exclude from the first 24h bakeoff. Do not promote
  to candidate without a clean smoke first.
- **`goldpricez`** — returned HTTP 200 but the parser reported `missing_price`. Keep as legacy /
  problematic; **do not use as a primary candidate** right now. Matches its known history of 30–45
  minute frozen periods.

### Recommended first 24h bakeoff candidate set

```text
goldapi_io,twelvedata_xauusd,fmp_gcusd
```

Pass this to the bakeoff `providers` input (or set the matching `*_ENABLED=true` flags and leave the
others false) for the first 24h+ run. **Do not pick a winner from this single round** — the bakeoff
still needs at least 24 hours of samples, scorecard review, and an explicit owner decision on
winner + backup.

### 24h bakeoff plan — GitHub-only hourly chunked accumulation

**A single 24h GitHub Actions bakeoff is not feasible.** Two platform constraints combine:

1. **Hosted-runner job cap = 6 hours.** `gold-provider-bakeoff.yml` already pins
   `timeout-minutes: 350` (~5h50m) under that ceiling. Raising the timeout cannot bypass the runner
   ceiling.
2. **`workflow_dispatch` and `schedule` only fire from the default branch.** The bakeoff file is
   only on `copilot/replace-gold-api-key` until merge, so its hourly cron (`cron: "11 * * * *"`)
   does not run pre-merge and the dispatch button does not appear in the Actions UI.

**Primary plan (GitHub-only, post-merge of this infra PR):** the bakeoff workflow has been updated
so each scheduled run does an **hourly chunked accumulation**:

- The hourly cron (`cron: "11 * * * *"`) auto-pins providers to
  `goldapi_io,twelvedata_xauusd,fmp_gcusd` and runs for **0.83 hours (~50 minutes)** at
  `interval_seconds=360` — about **8 samples per provider per hourly run**.
- Each run **restores the JSONL log from the previous successful run's artifact** (via
  `gh run download` against this workflow), appends new samples, regenerates the scorecard, and
  uploads a fresh artifact named `gold-provider-bakeoff-<run_id>`. Results accumulate across runs
  without ever writing to git.
- After ~24 hourly runs (≈24h wall clock) the latest artifact contains **~600 samples** (3 providers
  × ~8/hour × 24h) — sufficient to compute update frequency, unique prices/timestamps per hour,
  longest frozen period, stale rate, failure rate, freshness, and response speed.
- Provider enable flags are pinned **literally inside this workflow only**
  (`GOLDAPI_IO_ENABLED: "true"`, `TWELVEDATA_ENABLED: "true"`, `FMP_ENABLED: "true"`). The
  smoke-failing providers (`finnhub_oanda` / `metal_sentinel` / `goldpricez`) are explicitly
  disabled in the bakeoff workflow so quota isn't burned on known-broken endpoints. Production
  (`gold-price-fetch.yml` → `data/gold_price.json` → `post_gold.yml`) does not read these env vars
  and is unaffected.
- `BAKEOFF_LOG_RAW` is hard-pinned to `"false"` — raw upstream payloads never reach CI logs or
  artifacts; only sha256 hashes of parsed bodies are recorded.
- `commit_results` defaults to `false` — the rolling artifact is the canonical store. Nothing is
  committed back to git from the cron path.

**How to review results from the GitHub UI (post-merge):**

1. Wait at least 24 hourly runs after this PR merges so accumulation reaches 24h coverage (the
   `Set-up Python` and provider-fetch steps each take under a minute, the bakeoff loop runs ~50 min,
   then artifact upload).
2. Open Actions → **Gold Provider Bakeoff** → most recent successful run.
3. Download the `gold-provider-bakeoff-<run_id>` artifact. It contains:
   - `data/provider_bakeoff_log.jsonl` — accumulated sanitized samples across all hourly runs
     covered by the artifact retention window (30 days).
   - `data/provider_scorecard.json` — rolling scorecard regenerated on each run, with per-provider
     unique-prices/hour, unique-timestamps/hour, longest frozen period, stale-rate, failure-rate,
     p50/p95 response time, and a derived ranking.
4. Review the scorecard. **Do not** commit it or paste raw API responses anywhere. The JSONL has
   zero raw bodies by construction.
5. Choose winner + backup providers (owner-only), then open a separate production-cutover PR.
   Production stays on the legacy GoldPriceZ path until that cutover PR merges.

**On-demand burst (post-merge, optional).** If the operator wants denser sampling than the cron
schedule provides, manually dispatch the workflow from the Actions UI with:

- `providers`: `goldapi_io,twelvedata_xauusd,fmp_gcusd`
- `duration_hours`: any value up to `5` (stays under the 350-minute cap)
- `interval_seconds`: `360`
- `commit_results`: `false`

Manual dispatches do **not** restore prior artifacts (only the scheduled path does), so a manual run
produces its own standalone artifact rather than joining the rolling log. Use the cron path as the
canonical accumulator; use dispatch only for ad-hoc bursts.

**Local CLI is explicitly NOT the recommended path.** A local `scripts/python/provider_bakeoff.py`
invocation is technically possible but is not the primary path for this rollout — operator does not
run local bakeoffs. The GitHub-only chunked accumulation above is the canonical method.

**Reaffirmed constraints.** No merge of cutover PR. No Ready for Review on that cutover PR. No
production cutover. No X posting. No commit of bakeoff data (cron path is artifacts-only by
construction). Winner / backup / production cutover all remain owner-only decisions made after
scorecard review.

---

> **GitHub limitation — `workflow_dispatch` visibility.** A `workflow_dispatch`-only workflow file
> that exists **only on a feature branch** is not reliably exposed in the Actions tab. The "Run
> workflow" button only appears after the workflow file is present on the **default branch**. **Do
> not merge just to make the dispatch button appear.** Use the `pull_request`-triggered smoke check
> below or the local CLI fallback first.

### Preferred path: PR Provider Smoke (visible in PR Checks)

`.github/workflows/pr-provider-smoke.yml` runs on `pull_request` and therefore appears under **PR
#253 → Checks** immediately, no merge required.

1. Open **PR #253 → Checks** tab.
2. Find **PR Provider Smoke / One-round provider smoke (PR check)**.
3. Click into the run, expand "Run one-round smoke (real providers)".
4. Confirm at least one provider returns a real `ok` row (not `provider_disabled`,
   `missing_api_key`, or `auth_error`).
5. Download the **`pr-provider-smoke-<run_id>`** artifact and inspect `out/provider_scorecard.json`.

If the check did not auto-trigger (e.g. you re-ran the PR but no listed paths changed), re-run it
from **Checks → PR Provider Smoke → Re-run jobs**, or push an empty commit:
`git commit --allow-empty -m "trigger smoke" && git push`.

> 💡 The smoke job sets `<NAME>_ENABLED=true` **only inside its own env block**. Those flags do not
> propagate to `post_gold.yml`, `gold-price-fetch.yml`, or any other production workflow. You do
> **not** need to add `*_ENABLED=true` repository variables to make the PR smoke run — only the
> `*_API_KEY` secrets.

### Fallback A: dispatch from the file URL (sometimes works for branch-only workflows)

This works **only** when GitHub has already indexed the workflow against the default branch via a
previous run on `main`. For brand-new files it usually 404s; treat it as a "try, and if it fails use
the smoke check or local fallback."

1. Open the workflow file on the PR branch:
   `https://github.com/<org>/<repo>/blob/copilot/replace-gold-api-key/.github/workflows/test-gold-providers.yml`
2. If a "Run workflow" picker is offered at the top of the file, select branch
   `copilot/replace-gold-api-key` and dispatch.

### Fallback B: local CLI smoke test

Clone the branch locally, export the provider keys you want to test as environment variables (one
terminal session, **never commit them, never paste them into GitHub comments or docs**), and run:

```bash
export TWELVEDATA_API_KEY=...     # paste; do NOT share or commit
export TWELVEDATA_ENABLED=true
export FINNHUB_API_KEY=...
export FINNHUB_ENABLED=true
export FMP_API_KEY=...
export FMP_ENABLED=true
export GOLDAPI_IO_KEY=...
export GOLDAPI_IO_ENABLED=true
export GOLDPRICEZ_API_KEY=...
export GOLDPRICEZ_ENABLED=true
export METAL_SENTINEL_API_KEY=...
export METAL_SENTINEL_API_HOST=...
export METAL_SENTINEL_ENABLED=true

python scripts/python/provider_bakeoff.py --once \
  --providers twelvedata_xauusd,finnhub_oanda,fmp_gcusd,goldapi_io,metal_sentinel,goldpricez
python scripts/python/provider_scorecard.py
```

This calls the same code path as the workflow without any commit, artifact upload, or X post.

### After the smoke check (PR or local) shows real `ok` rows

Only after PR Provider Smoke succeeds with at least one real `ok` row from a non-legacy provider do
you proceed to the 24h+ bakeoff. The bakeoff workflow (`gold-provider-bakeoff.yml`) becomes
UI-visible only once it lands on the default branch via a separate cutover PR — until then,
accumulate samples by waiting for the hourly cron once the file is on `main`, or extend the smoke
loop locally.

### Why the previous `gold-provider-bakeoff.yml #1..#6` runs appeared

The earlier "failed runs" you saw labelled with `gold-provider-bakeoff.yml` are explained by one of:

1. **Likely**: they were `gold-bakeoff-readiness.yml` runs triggered by `pull_request` on this PR.
   The Actions tab labels each run by workflow name; older readiness runs would show under "Gold
   Bakeoff Readiness", not under bakeoff itself. Cross-check the run's "Triggered by" line.
2. The file briefly had a different trigger in an earlier branch revision and those runs persist in
   history. The current trigger set is `workflow_dispatch` + hourly `cron` only — verify with:
   ```bash
   sed -n '/^on:/,/^[a-z]/p' .github/workflows/gold-provider-bakeoff.yml
   ```
3. The hourly cron only runs from the default branch in normal operation; if you saw runs attributed
   to the PR head SHA, that is GitHub showing the schedule run that happened to coincide with the PR
   being open.

In all three cases the current state is safe: no `push` trigger on any bakeoff/test/smoke workflow.

Run the bakeoff with safe defaults:

| Field              | Value                                                                            |
| ------------------ | -------------------------------------------------------------------------------- |
| `providers`        | `twelvedata_xauusd,finnhub_oanda,fmp_gcusd,goldapi_io,metal_sentinel,goldpricez` |
| `duration_hours`   | `24` (or `48`)                                                                   |
| `interval_seconds` | `360`                                                                            |
| `commit_results`   | `false` (artifact only)                                                          |

> ⚠️ Hosted GitHub runners cap a single run at ~6 hours. For 24h+ coverage, prefer the hourly cron
> schedule already wired into `gold-provider-bakeoff.yml` (`cron: "11 * * * *"`) and let it
> accumulate samples, then download artifacts from the latest run after a day.

---

## Secret-name reference

You added every secret listed below. Only the ones the workflows actually read are documented;
duplicates are noted so nothing is accidentally rotated and silently broken.

### Provider adapter env-var mapping (from the adapter source)

| Secret you added          | Read by adapter             | Adapter behavior if absent    |
| ------------------------- | --------------------------- | ----------------------------- |
| `TWELVEDATA_API_KEY`      | `twelvedata.fetch`          | `missing_api_key`             |
| `FINNHUB_API_KEY`         | `finnhub.fetch`             | `missing_api_key`             |
| `FMP_API_KEY`             | `fmp.fetch`                 | `missing_api_key`             |
| `GOLDAPI_IO_KEY`          | `goldapi_io.fetch`          | `missing_api_key`             |
| `METAL_SENTINEL_API_KEY`  | `metal_sentinel.fetch`      | `missing_api_key`             |
| `METAL_SENTINEL_API_HOST` | `metal_sentinel.fetch`      | adapter falls back to default |
| `GOLDPRICEZ_API_KEY`      | `goldpricez.fetch` (legacy) | `missing_api_key`             |

Each adapter **also** checks a per-provider `*_ENABLED` flag (default `false` except
`GOLDPRICEZ_ENABLED` which defaults `true`). To actually exercise an adapter in the workflow, add
`<NAME>_ENABLED=true` as a repository **variable** (or another secret).

> ❗ Owner-side legacy / unused secrets — keep them, but they are **not** wired up:
>
> - `GOLD_API_KEY` — no adapter reads this; not the same as `GOLDAPI_IO_KEY`. Likely a relic from
>   the old `goldpricez.com`-only flow. Safe to leave; do not rename.
> - `API_NINJAS_API_KEY`, `API_FX_URL`, `API_GOLD_URL` — no adapter reads these. There is no
>   `api_ninjas` adapter, and per the brief, API Ninjas should stay out of the default provider
>   order on the free tier. Leave the secrets but do not add an adapter.
> - `SUPABASE_*` — used by other automations (admin / newsletter); unrelated to the bakeoff.

### X / Twitter secret mapping (production poster)

`.github/workflows/post_gold.yml` (production) **only reads the `CONSUMER_*` / `ACCESS_TOKEN*`
names**, then maps them into the `TWITTER_*` env vars the script expects:

```yaml
env:
  TWITTER_API_KEY: ${{ secrets.CONSUMER_KEY }}
  TWITTER_API_SECRET: ${{ secrets.CONSUMER_SECRET }}
  TWITTER_ACCESS_TOKEN: ${{ secrets.ACCESS_TOKEN }}
  TWITTER_ACCESS_TOKEN_SECRET: ${{ secrets.ACCESS_TOKEN_SECRET }}
```

You also added `TWITTER_API_KEY`, `TWITTER_API_SECRET`, `TWITTER_ACCESS_TOKEN`,
`TWITTER_ACCESS_TOKEN_SECRET`. Those are **not currently referenced by any workflow** — they are
spares with the names the script uses internally. Either:

- Keep them as backup (no harm), or
- Drop them later in a separate cleanup PR once you confirm `CONSUMER_*` is the canonical pair.

**Do not delete `CONSUMER_*` — that breaks production tweeting.**

---

## What is still OWNER ACTION REQUIRED

Only the following remain — every one needs your account, your decision, or your wait:

1. **Real provider API keys** — added; `TWELVEDATA_API_KEY`, `GOLDAPI_IO_KEY`, `FMP_API_KEY`,
   `FINNHUB_API_KEY`, `METAL_SENTINEL_API_KEY` all confirmed reachable in the smoke run.
2. **Per-provider `*_ENABLED=true` variables** — turn on whichever providers you want to test.
3. ~~**Run the smoke test** in Actions and confirm at least one provider returns real data.~~ ✅
   Done 2026-05-01 — see [Smoke test results](#smoke-test-results--2026-05-01).
4. **Run / wait for the 24–48 h bakeoff** to accumulate samples. Restrict the first run to
   `goldapi_io,twelvedata_xauusd,fmp_gcusd`; exclude `finnhub_oanda` (plan-gated), `metal_sentinel`
   (HTTP 400), and `goldpricez` (parser `missing_price`) until they are investigated separately.
5. **Review `data/provider_scorecard.json`** in the artifact — Copilot must not pick the winner.
6. **Select winning + backup provider** based on the scorecard data.
7. **Fill `docs/operator-inputs-gold-provider-bakeoff.md`** (sections 2, 3, 4, 5, 6, 8, 11).
8. **Approve a separate production-cutover PR** — the cutover is intentionally not in this PR.
9. **Dry-run a tweet with real data** before flipping production.
10. **Mark Ready for Review** and **merge** — only after all above steps are done.

---

## PR comment to paste (when you're ready to share status)

```text
This PR remains Draft.

Repo-side hardening is complete. Production remains unchanged (legacy GoldPriceZ path).
Test/bakeoff workflows are safe — no X posting, no auto-commit, no production cutover.
No provider winner has been selected yet.

Real provider testing and the 24h+ bakeoff are still pending. Merge is blocked until
the owner-side checklist in docs/OWNER_ACTIONS_REQUIRED_GOLD_BAKEOFF.md is complete.

Owner-side checklist:
- [x] Provider smoke test with real keys (2026-05-01: 3 ✅ — twelvedata_xauusd, goldapi_io, fmp_gcusd; 3 ❌ — finnhub_oanda plan_gated, metal_sentinel http_error, goldpricez missing_price)
- [ ] 24h+ bakeoff (first run focuses on `goldapi_io,twelvedata_xauusd,fmp_gcusd`)
- [ ] Scorecard reviewed
- [ ] Winner selected
- [ ] Backup selected
- [ ] Operator checklist filled
- [ ] Production cutover approved (separate PR)
- [ ] Dry-run tweet tested with real data
- [ ] Ready for Review
- [ ] Merge
```

---

## What Copilot / coding agents cannot do for you

- **Cannot create provider accounts** — pricing pages, ToS acceptance, and email verification must
  be done by you.
- **Cannot know secret values** — and must never print them. The agent only sees that a secret is
  referenced; it never receives the value.
- **Cannot prove provider quality** without real samples. A scorecard with all `score=0.00 avoid`
  rows means the bakeoff never ran with real keys, not that the providers are bad.
- **Cannot choose the winner** before bakeoff data exists. Only you can compare unique prices/hour,
  longest frozen period, and 429 counts and make the call.
- **Cannot approve production cutover** without your decision. The cutover edits real schedules and
  must be a separate, owner-approved change.

---

## Related documents

- [`docs/operator-inputs-gold-provider-bakeoff.md`](./operator-inputs-gold-provider-bakeoff.md) —
  full operator checklist (secrets, providers, scorecard decision, rollback).
- [`docs/gold-price-provider-bakeoff.md`](./gold-price-provider-bakeoff.md) — how the bakeoff works.
- [`docs/gold-price-provider-migration.md`](./gold-price-provider-migration.md) — exact production
  cutover steps.
- [`docs/x-automation-duplicate-policy.md`](./x-automation-duplicate-policy.md) — duplicate-tweet
  guard rules.
- [`docs/data-source-methodology.md`](./data-source-methodology.md) — source labels and trust
  wording.
- [`scripts/python/gold_bakeoff_readiness.py`](../scripts/python/gold_bakeoff_readiness.py) —
  readiness gate; run before review/merge.
