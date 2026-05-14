# Alerts and Notifications (v1)

This document describes the server-backed alert lifecycle introduced in Phase 3.

## Scope

Alerts v1 is focused on:

- Server-backed price alert rules
- Email notification delivery as the first production channel
- Double opt-in verification before alerts activate
- Cooldown enforcement to reduce spam
- Delivery event logs for troubleshooting and admin visibility
- Unsubscribe flow for compliance and trust

Channels intentionally deferred to future phases:

- Web Push
- WhatsApp
- Telegram
- Premium-tier alert bundles

## Data model

Implemented tables in `supabase/schema.sql`:

- `alert_rules`
- `alert_events`
- `notification_subscriptions`

All three tables include RLS policies and indexes for active-rule lookup, threshold checks, and
event monitoring.

## API endpoints

- `POST /api/v1/alerts`
- `GET /api/v1/alerts/:managementToken`
- `PATCH /api/v1/alerts/:managementToken`
- `DELETE /api/v1/alerts/:managementToken`
- `POST /api/v1/alerts/verify`
- `POST /api/v1/alerts/unsubscribe`
- `POST /api/v1/jobs/check-alerts`

## Delivery behavior

### Email mode

- If both `RESEND_API_KEY` and `RESEND_FROM_EMAIL` are configured (and `ALERT_EMAIL_DRY_RUN` is not
  `true`), alert emails are sent through Resend API.
- Otherwise the system runs in dry-run/log-only mode and still records `alert_events`.

### Freshness guardrails

`/api/v1/jobs/check-alerts` skips sends when the latest snapshot is stale or fallback-marked. Alerts
must not be represented as live if freshness is degraded.

### Cooldowns

Each rule has `cooldown_minutes`. A trigger inside the cooldown window is logged as
`skipped_cooldown` and not re-sent.

## Frontend behavior (`tracker.html` / `tracker-pro`)

- Existing local browser alerts remain unchanged.
- New optional server alert mode is shown when backend config indicates alerts support.
- Server mode captures email + threshold context and returns management/unsubscribe references.

## Operations

### Scheduled checks

Workflow: `.github/workflows/check-alerts.yml`

- Supports schedule + manual dispatch
- Calls `POST /api/v1/jobs/check-alerts`
- Runs in dry mode when `ALERT_JOB_TOKEN` is absent
- Dry-run HTTP `405` responses are treated as skipped/non-fatal (to avoid noisy failures when public
  endpoints block POST in dry mode)

### Env vars

See `docs/environment-variables.md` and `.env.example`:

- `ALERT_EMAIL_DRY_RUN`
- `ALERT_JOB_TOKEN`
- `ALERTS_DATA_FILE`
- `ALERTS_PRICE_FILE`

## Notes for next phases

- Add Web Push subscriptions to `notification_subscriptions.metadata`
- Add provider adapters for WhatsApp/Telegram with per-channel delivery records in `alert_events`
- Introduce premium alert segmentation without breaking v1 management tokens and unsubscribe
  semantics
