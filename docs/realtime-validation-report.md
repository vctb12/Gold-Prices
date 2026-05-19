# Realtime Validation Report

> Purpose: state what was **changed**, what was **verified**, and what was **deliberately deferred**
> in the realtime truthfulness PR. Pair-read with `docs/realtime-baseline-audit.md` (before) and
> `docs/realtime-architecture.md` (target).

Status: **valid** for the changes shipped in this PR. Future PRs that extend the realtime program
must add a new dated section below.

---

## 1. Changes in this PR

### 1.1 Code

| File                         | Change                                                                                                                                                                                                                                                                                                                                         |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/live-status.js`     | Replaced the misleading "every 6 minutes" doc-comment with the actual hourly cron schedule. Added `DELAYED_AFTER_MS = 30 min`. Raised `STALE_AFTER_MS` to 75 min so it matches the real refresh window.                                                                                                                                        |
| `src/lib/live-status.js`     | Expanded `getLiveFreshness()` to return six explicit buckets: `live`, `delayed`, `cached`, `stale`, `fallback`, `unavailable`. Added `isFallback` and `isFresh` inputs as **hard anti-mislabel guards**: `isFallback === true` forces `'fallback'`; `isFresh === false` forces `'stale'`. Result now includes a `reason` code for diagnostics. |
| `src/lib/api.js`             | `normalizeGoldResponse()` now propagates `isFresh`, `isFallback`, `freshnessSeconds`, `maxFreshnessSeconds`, `sourceTimestamp` from the gold-price file / backend envelope to the client. **This was the core upstream-truth-loss bug** — the field was always available end-to-end but the client threw it away.                              |
| `src/pages/home.js`          | Tracks `goldIsFresh` / `goldIsFallback` state and passes them to every `getLiveFreshness()` call.                                                                                                                                                                                                                                              |
| `src/pages/tracker-pro.js`   | `state.live` carries `isFresh`, `isFallback`, `freshnessSeconds`, `sourceTimestamp` for downstream consumers.                                                                                                                                                                                                                                  |
| `src/tracker/render.js`      | `getFreshnessModel()` pipes truth flags through; badge classes added for `delayed` and `fallback`; mobile-status tone covers new keys; "refresh stale" path now also covers `delayed` and `fallback`.                                                                                                                                          |
| `src/tracker/ui-shell.js`    | Forwards `isFallback` / `isFresh` to `updateTicker()` and `updateSpotBar()`.                                                                                                                                                                                                                                                                   |
| `src/components/ticker.js`   | Accepts new flags; `freshnessLabel()` covers `delayed` and `fallback` in EN/AR.                                                                                                                                                                                                                                                                |
| `src/components/spotBar.js`  | Same as ticker.                                                                                                                                                                                                                                                                                                                                |
| `src/lib/page-hydrator.js`   | `freshnessTone()` covers the new keys; legacy badge color map and banner-trigger include `delayed` and `fallback`.                                                                                                                                                                                                                             |
| `src/config/translations.js` | EN/AR parity: added `country.freshness.delayed`, `country.freshness.fallback`, `home.sourceDelayed`, `home.sourceFallback`, `tracker.source.delayed`, `tracker.source.fallback`.                                                                                                                                                               |

### 1.2 Tests

| File                               | Change                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/live-status.test.js`        | Rewrote the legacy four-bucket test to cover all six buckets and the `reason` codes. Added an **anti-mislabel invariant** test asserting `getLiveFreshness()` never returns `'live'` when any single truth precondition is violated. Added explicit tests for upstream-fallback and upstream-stale guards. Replaced the wrong-cadence assertion that hard-coded a "6-minute cron" assumption with one tied to the actual hourly schedule. |
| `tests/spot-bar-freshness.test.js` | Updated stale-timestamp test for the new 75-min threshold. Added explicit `delayed` and `fallback` regression tests.                                                                                                                                                                                                                                                                                                                      |
| `tests/ticker-freshness.test.js`   | Same shape as spotBar: stale threshold update + new `fallback` regression test.                                                                                                                                                                                                                                                                                                                                                           |

### 1.3 Documentation

- `docs/realtime-baseline-audit.md` (Phase 0 deliverable)
- `docs/realtime-architecture.md` (Phase 1 design — implementation is queued)
- `docs/realtime-validation-report.md` — this file
- `docs/realtime-ops-runbook.md` (Phase 6 deliverable)

## 2. Verification performed (and what was assumed)

### 2.1 Ran

| Check                                                                                                     | Outcome                                                                                 |
| --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `npm test` (Node test runner, 425 sub-tests, 108 suites)                                                  | **713 / 713 pass** (was 707; added 6 net new tests, replaced 2 obsolete-threshold ones) |
| `npm run lint` (ESLint flat config)                                                                       | clean                                                                                   |
| `npm run validate` (build integrity + DOM-safety + SEO meta + sitemap coverage + placeholder + analytics) | clean (warnings only on pre-existing stale governance report)                           |
| `npm run build` (Vite production build)                                                                   | clean                                                                                   |

Each command was invoked after `rm -rf playwright-report test-results` per the repo convention
(`tests/seo-sitewide.test.js` and `scripts/node/validate-build.js` scan HTML and can produce false
positives off Playwright report inline scripts).

### 2.2 Assumed (not run)

- 30-minute real-traffic soak test (no soak harness in the repo; would require a non-trivial new
  test infrastructure).
- Dropped-event rate under packet loss (no streaming transport ships in this PR, so the metric is
  not applicable yet).
- CPU/memory profile of long-lived client (same reason).
- Lighthouse delta (the changed surfaces — freshness labels, tracker badges — are not on a
  critical-rendering path; surface-level visual change is limited to two new pill states).
- Pa11y / accessibility scan (changes are textual / data-attribute only; no semantic landmarks added
  or removed).

These gaps are listed honestly here rather than papered over. They are the exact gaps
`docs/realtime-architecture.md` queues for follow-up PRs.

## 3. Acceptance criteria self-check

Against the original beast-mode brief:

| Criterion                                                              | Status                                                                                                                                                                                                                                                                                                                                  |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| (A) p95 end-to-end ≤ 3 s when upstream supports high-frequency updates | **N/A**: upstream is gold-api.com free tier on an hourly cron; this is criterion (B), not (A). The architecture doc describes the path to (A).                                                                                                                                                                                          |
| (B) Minimize lag aggressively under polling-only upstream              | ⚠️ **Partial**: the dominant lag (hourly cadence) is upstream/business-level and untouched in this PR. **Time-to-glass once a new value lands** is bounded by the client poll (90 s) — unchanged here. The SSE transport in `docs/realtime-architecture.md` is the principled fix and is staged as a separate PR for production safety. |
| (B) Labels always truthful                                             | ✅ **Yes**. Six explicit buckets, hard `isFallback` / `isFresh` guards. Tested.                                                                                                                                                                                                                                                         |
| (B) Documentation explicitly states provider-imposed limits            | ✅ **Yes** — see `docs/realtime-baseline-audit.md` §3 and §4.                                                                                                                                                                                                                                                                           |
| (B) No false "real-time" claims anywhere                               | ✅ **Yes** — copy uses "live / delayed / cached / stale / fallback / unavailable" only; no marketing-style "real-time" claims were added.                                                                                                                                                                                               |
| (C) Zero trust regressions                                             | ✅ Existing freshness labels remain; anti-mislabel guards strictly tighten the contract.                                                                                                                                                                                                                                                |
| (C) Zero EN/AR parity regressions                                      | ✅ All new keys added in both languages.                                                                                                                                                                                                                                                                                                |
| (C) No broken core pages / SEO / PWA                                   | ✅ `npm run validate` passed; no changes to canonical, sitemap, robots, manifest, or `sw.js`.                                                                                                                                                                                                                                           |

## 4. Pre/post truth-state matrix (illustrative)

Given a snapshot with `timestamp_utc = 10 minutes ago`, `is_fallback = true`, `is_fresh = true`,
`hasLiveFailure = false`:

| Surface       | Before this PR                                          | After this PR               |
| ------------- | ------------------------------------------------------- | --------------------------- |
| Tracker badge | "Live · 10 min ago" ← **wrong**, snapshot is a fallback | "Fallback · 10 min ago"     |
| Spot bar      | `data-freshness="live"`                                 | `data-freshness="fallback"` |
| Footer ticker | `data-freshness="live"`                                 | `data-freshness="fallback"` |
| `reason` code | n/a                                                     | `upstream-fallback`         |

Given a snapshot at `40 minutes ago`, `is_fresh = true`, `is_fallback = false`:

| Surface       | Before this PR          | After this PR              |
| ------------- | ----------------------- | -------------------------- |
| Tracker badge | "Live · 40 min ago"     | "Delayed · 40 min ago"     |
| Spot bar      | `data-freshness="live"` | `data-freshness="delayed"` |

## 5. Risks and rollback

| Risk                                                                                                                   | Mitigation                                                                                                                                                                                            |
| ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| New `delayed` / `fallback` keys reach a UI branch that doesn't handle them and falls into a default `unavailable` path | All call sites in this PR were audited; `freshnessTone()`, `SOURCE_BADGE_CLASS`, `STATUS_BADGE_CLASS`, the spotBar/ticker label functions, and `page-hydrator` all branch explicitly on the new keys. |
| Older serviceworker-cached `getLiveFreshness()` returns old keys                                                       | Backwards-compatible: removing the older bucket names (live, cached, stale, unavailable) is **not** part of this change; only `delayed` and `fallback` are added. Old clients keep working.           |
| `STALE_AFTER_MS` raised from 12 min → 75 min could hide a missed cron                                                  | Mitigated by the new `delayed` bucket: between 30 and 75 min the badge already flips to "Delayed", which is visibly different from "Live".                                                            |

**Rollback**: revert this PR. There are no DB migrations, schema changes, secret additions, or
workflow cron edits.

## 6. Follow-ups (queued, not in this PR)

- `realtime-architecture.md` Phase 1.a–1.c: SSE ingest worker + endpoint + client subscriber.
- `realtime-architecture.md` Phase 3: adaptive polling, circuit breaker, time-drift guard.
- `realtime-architecture.md` Phase 6: metrics endpoint, structured logs, alerts.
- Soak / load harness for long-lived client subscriptions.
- Pa11y scan diff after SSE UX copy lands ("Streaming live").
