# Price API and Historical Data (Phase 2)

This document explains how Gold Ticker Live now serves price data in two modes:

1. **Backend API mode** (preferred when server + Supabase are configured)
2. **Static JSON mode** (fallback, including GitHub Pages deployments)

## Endpoints

- `GET /api/v1/prices/latest`
- `GET /api/v1/prices/history?range=1d|7d|30d|1y`
- `GET /api/v1/prices/snapshots?limit=120&provider=<name>`
- `GET /api/v1/providers/status`
- `GET /api/v1/providers/runs?limit=100&provider=<name>` (**admin auth required**)

## Data source behavior

### Latest price (`/api/v1/prices/latest`)

- Uses `price_snapshots` (Supabase) when available.
- Falls back to `data/gold_price.json` when Supabase is unavailable or not configured.

### History (`/api/v1/prices/history`)

- `meta.source` now makes the history source explicit:
  - `supabase` — DB-backed snapshot history from `price_snapshots`
  - `static-baseline` — reference-only fallback from `src/data/historical-baseline.json`
  - `json-fallback` — single-point fallback derived from `data/gold_price.json`
  - `empty` — no Supabase history or fallback data currently available
- `meta.coverageStartUtc`, `meta.coverageEndUtc`, and `meta.coveragePoints` describe the returned
  coverage window when timestamps exist.
- `data.coverage` includes source-specific flags such as `providerBacked`, `referenceOnly`,
  `snapshotFallback`, or `empty`.
- Static baseline and JSON fallback responses are clearly marked as fallback/reference data and
  should not be presented as live retail or live market history.

### Provider telemetry

- `/api/v1/providers/status` uses `provider_health` when available.
- `/api/v1/providers/runs` uses `provider_runs` when available and requires admin authentication.
- Both routes return safe fallback payloads when DB data is unavailable.

## Snapshot ingestion

Workflow: `.github/workflows/gold-price-fetch.yml`

After successful fetch:

- `scripts/node/sync-price-snapshot.js` validates `data/gold_price.json`
- Computes `raw_payload_hash`
- Inserts into `price_snapshots` unless duplicate
  `(timestamp_utc, source_provider, raw_payload_hash)`
- Writes provider run into `provider_runs`
- Updates `provider_health` summary

If Supabase credentials are missing, sync is skipped cleanly.

## Strict mode

Set workflow variable:

- `SNAPSHOT_SYNC_STRICT=true`

When enabled, snapshot sync failures fail the workflow step. Default behavior is non-strict: fetch
succeeds even if DB sync fails.

## Freshness and trust metadata

The API preserves trust metadata so UI can keep accurate labels:

- `isFresh`
- `isFallback`
- `freshnessSeconds`
- `provider`
- `timestampUtc`
- `fetchedAtUtc`
- `meta.source`
- `data.coverage`

Use this metadata to avoid presenting stale/cached values as live.

## Static GitHub Pages compatibility

Frontend `fetchGold()` now:

1. Tries `/api/v1/prices/latest` first
2. Falls back to `/data/gold_price.json`
3. Falls back to local cached values if network fails

This keeps static deployments working without a backend.
