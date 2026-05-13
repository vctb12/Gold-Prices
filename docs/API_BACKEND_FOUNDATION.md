# API Backend Foundation (Phase 1)

This document describes the production API foundation for Gold Ticker Live and how it coexists with
the static multi-page website.

## Architecture

- Frontend remains static and deployable to GitHub Pages.
- Express backend provides operational API endpoints and protected/admin-compatible APIs.
- Versioned API namespace is now available at:
  - `/api/v1/...`
- Existing `/api/...` routes remain in place for backward compatibility.

## API Versioning

New and standardized API endpoints are under `/api/v1`:

- `GET /api/v1/health`
- `GET /api/v1/status`
- `GET /api/v1/config/public`
- `GET /api/v1/prices/latest`
- `GET /api/v1/prices/history`
- `GET /api/v1/providers/status`
- `POST /api/v1/events`
- `POST /api/v1/leads`

Legacy compatibility:

- Existing `/api/admin/*`, `/api/newsletter/*`, `/api/stripe/*`, `/api/submit-shop` remain
  supported.
- Versioned aliases are also mounted for these route groups where applicable.

## Response Envelopes

Success shape:

```json
{
  "ok": true,
  "data": {},
  "meta": {
    "timestamp": "",
    "source": "",
    "freshness": ""
  }
}
```

Error shape:

```json
{
  "ok": false,
  "error": {
    "code": "",
    "message": ""
  }
}
```

## Health and Status Coverage

`/api/v1/health` and `/api/v1/status` include non-secret operational checks:

- app version
- environment mode
- current timestamp
- uptime
- data file availability (`data/gold_price.json`)
- provider state file availability (`data/provider_state.json`)
- Supabase configured or not
- newsletter configured or not
- Stripe configured or not
- env validation warnings (non-fatal)

## Environment Validation

Startup performs non-fatal feature-aware env validation:

- Required optional-feature variables produce warnings when partially configured.
- Missing optional integrations do **not** crash the server.
- CORS production misconfiguration is warned clearly.
- Supabase requirements are checked when `STORAGE_BACKEND=supabase`.

## Security and Production Safety

- Structured request logging (JSON line format) for production diagnostics.
- Public POST endpoint rate limiting:
  - `/api/v1/events`
  - `/api/v1/leads`
- Existing global API rate limits remain active.
- CORS behavior stays explicit and production-safe.
- No secrets are exposed in API responses.

## Deployment Options

### Option A (recommended now): split deployment

- Keep static site on GitHub Pages.
- Deploy Express API separately (Render / Railway / Vercel server target).
- Use API subdomain (example: `api.goldtickerlive.com`) and set `CORS_ORIGINS` appropriately.

### Option B (later): unified deployment

- Move frontend and backend together to a single platform if desired.
- Keep `/api/v1` stable so frontend integration and clients are unaffected.

## Environment Variables by Feature

### Core server (required)

- `JWT_SECRET`
- `ADMIN_PASSWORD`

### Optional admin pin

- `ADMIN_ACCESS_PIN` (6+ digits)

### API/server runtime

- `NODE_ENV`
- `PORT`
- `SITE_URL`
- `CORS_ORIGINS`
- `STORAGE_BACKEND`

### Supabase backend (required when using Supabase storage)

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

### Newsletter (optional)

- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`

### Stripe (optional)

- `STRIPE_PUBLISHABLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_PRO_MONTHLY`
- `STRIPE_PRICE_PRO_ANNUAL`
- `STRIPE_PRICE_API_MONTHLY`
- `STRIPE_PRICE_API_ANNUAL`
