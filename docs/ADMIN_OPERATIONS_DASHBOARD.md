# Admin Operations Dashboard

## Purpose

Phase 9 adds a control-center layer for operations visibility in the admin dashboard, with read-only
status modules and guarded moderation actions.

## Modules

The dashboard now surfaces these operations modules:

- Provider Health
- Price Snapshots
- Alerts
- Shops Moderation
- Leads
- Newsletter
- Billing / Entitlements
- SEO Inventory
- X Automation
- Audit Logs

## Admin API Endpoints

All endpoints below are mounted under both `/api/admin` and `/api/v1/admin` via
`server/routes/admin/index.js` and require authenticated admin/editor JWT auth as noted.

### Read-only summary endpoints (admin role)

- `GET /ops/provider-health`
- `GET /ops/price-snapshots?limit=20`
- `GET /ops/alerts-summary`
- `GET /ops/leads-summary`
- `GET /ops/shops-moderation`
- `GET /ops/newsletter-stats`
- `GET /ops/billing-stats`
- `GET /ops/seo-summary`
- `GET /ops/x-automation`
- `GET /ops/audit-log-summary?limit=20`
- `GET /ops/control-center` (consolidated payload for dashboard cards)

### Moderation action endpoint (editor+ role)

- `POST /ops/shops-moderation/:id/:action` where `action` is `approve` or `reject`

This endpoint reuses the same moderation logic used by existing pending-shop routes.

## Audit Logging

Pending-shop moderation mutations now log structured before/after state in audit logs:

- `actor`
- `action`
- `entityType` / `entityId`
- `changes.before`
- `changes.after`

Sensitive values are not logged.

## Security and Hardening

- Operations endpoints are protected with `authMiddleware('admin')` plus `adminRateLimiter`.
- Moderation action endpoint is protected with `authMiddleware('editor')` plus rate limiting.
- Admin responses are `Cache-Control: no-store` (existing behavior retained).
- Endpoints use safe fallback behavior when Supabase or optional files are unavailable.

## Data Sources and Fallbacks

- Supabase-first where available (`provider_health`, `price_snapshots`, `alert_rules`,
  `alert_events`, `subscriptions`, `billing_audit_logs`, `audit_logs`).
- Local file fallback for static/low-infra mode (`data/provider_state.json`, `data/gold_price.json`,
  `data/last_tweet_state.json`, `reports/seo/inventory.json`, and repository-backed JSON stores).

## Frontend Dashboard Integration

`admin/index.html` now includes an **Operations Control Center** card grid with:

- module-level key metrics
- a module filter search input
- loading, empty, and degraded/fallback states
- mobile-safe card layout using shared admin CSS

## Verification

Recommended validation commands after changes:

- `npm run lint`
- `npm test`
- `npm run build`
- `npm run validate`
