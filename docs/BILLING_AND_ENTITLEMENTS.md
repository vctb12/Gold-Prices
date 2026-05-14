# Billing & Entitlements

Gold Ticker Live uses [Stripe](https://stripe.com/) for paid subscriptions. This document covers the
backend billing API, entitlement system, webhook flow, and Stripe Dashboard setup.

---

## Plans

| Feature            |    Free |              Pro |              API |
| ------------------ | ------: | ---------------: | ---------------: |
| Live tracker       |     Yes |              Yes |              Yes |
| Basic calculator   |     Yes |              Yes |              Yes |
| Price alerts       |       3 |               50 |              100 |
| History            | 30 days |         365 days |        Unlimited |
| Saved calculations |       5 |              100 |              500 |
| Export formats     |     CSV | CSV, JSON, Excel | CSV, JSON, Excel |
| Push notifications |      No |              Yes |              Yes |
| Email alerts       |      No |              Yes |              Yes |
| API access         |      No |               No |              Yes |
| API calls/day      |       — |                — |              500 |
| Webhook support    |      No |               No |              Yes |
| Ad-free            |      No |              Yes |              Yes |
| Portfolios         |       1 |               10 |               50 |
| Priority support   |      No |              Yes |              Yes |
| Price (monthly)    |      $0 |            $4.99 |           $19.99 |
| Price (yearly)     |      $0 |           $49.99 |          $199.99 |

---

## Environment Variables

Set all six together. Partial configuration is detected and warned at startup.

```bash
# Required for billing to be live
STRIPE_PUBLISHABLE_KEY=pk_live_…   # shown to frontend
STRIPE_SECRET_KEY=sk_live_…        # never sent to client
STRIPE_WEBHOOK_SECRET=whsec_…      # from Stripe Dashboard → Webhooks

# Stripe price IDs (monthly)
STRIPE_PRICE_PRO_MONTHLY=price_…
STRIPE_PRICE_API_MONTHLY=price_…

# Stripe price IDs (yearly) — use either suffix
STRIPE_PRICE_PRO_YEARLY=price_…    # or STRIPE_PRICE_PRO_ANNUAL
STRIPE_PRICE_API_YEARLY=price_…    # or STRIPE_PRICE_API_ANNUAL
```

When these vars are absent the billing API returns `{ configured: false }` — the tracker and all
free features continue working normally.

---

## API Endpoints

All billing routes are mounted at `/api/v1/billing/`.

### `GET /api/v1/billing/config`

Returns the publishable key and configuration status. Safe to call unauthenticated.

```json
{ "configured": true, "publishableKey": "pk_live_…" }
```

### `GET /api/v1/billing/status`

Returns configuration status and, when an auth token is provided, the caller's current subscription
and entitlements.

```json
{
  "configured": true,
  "publishableKey": "pk_live_…",
  "plans": { "pro": { "priceMonthly": 4.99, "priceYearly": 49.99, "entitlements": {…} }, … },
  "subscription": {
    "userId": "uuid",
    "tier": "pro",
    "status": "active",
    "currentPeriodEnd": "2026-06-14T00:00:00.000Z",
    "entitlements": {…}
  }
}
```

### `POST /api/v1/billing/create-checkout-session`

**Auth required** (Supabase Bearer token).

```json
// Request
{ "tier": "pro", "interval": "month" }

// Response
{ "sessionId": "cs_…", "url": "https://checkout.stripe.com/…" }
```

Redirects the user to Stripe Checkout. On success, Stripe redirects to
`/content/subscription/success.html?session_id=…`.

### `POST /api/v1/billing/create-portal-session`

**Auth required.**

```json
// Request
{}

// Response
{ "url": "https://billing.stripe.com/session/…" }
```

Returns a Stripe Customer Portal URL for managing or canceling the subscription.

### `POST /api/v1/billing/webhook`

Stripe calls this endpoint. **Not for direct use** — configure in Stripe Dashboard.

- Verifies the `Stripe-Signature` header before processing.
- Stores each event idempotently by `event.id`.
- Handles: `checkout.session.completed`, `customer.subscription.updated`,
  `customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.payment_failed`.
- Returns `200` even on handler errors (to prevent Stripe infinite retries); errors are logged.

### `GET /api/v1/me/entitlements`

**Auth required.** Returns the caller's current entitlement flags.

```json
{
  "userId": "uuid",
  "tier": "pro",
  "status": "active",
  "currentPeriodEnd": "2026-06-14T00:00:00.000Z",
  "entitlements": {
    "tier": "pro",
    "alertLimit": 50,
    "historyDays": 365,
    "savedCalcLimit": 100,
    "apiAccess": false,
    "apiCallsPerDay": 0,
    "exportFormats": ["csv", "json", "excel"],
    "webPush": true,
    "emailAlerts": true,
    "adsEnabled": false,
    "portfolioLimit": 10,
    "webhookSupport": false,
    "prioritySupport": true
  }
}
```

---

## Database Tables

Defined in `supabase/schema.sql` (Phase 6 section). Apply with Supabase SQL Editor.

| Table                | Purpose                                           |
| -------------------- | ------------------------------------------------- |
| `plans`              | Product catalogue (seeded with free/pro/api rows) |
| `subscriptions`      | Per-user subscription records, updated by webhook |
| `entitlements`       | Manual grants / feature overrides per user        |
| `stripe_customers`   | userId ↔ Stripe customer ID mapping               |
| `stripe_events`      | Idempotent webhook event log                      |
| `api_keys`           | API key management (hashed, never stored raw)     |
| `api_usage`          | Per-key daily call counters                       |
| `billing_audit_logs` | Append-only billing event audit trail             |

---

## Stripe Dashboard Setup Checklist

### Test mode

- [ ] Create products: **Gold Ticker Pro** and **Gold Ticker API**
- [ ] Add pricing:
  - Pro: $4.99/month recurring, $49.99/year recurring
  - API: $19.99/month recurring, $199.99/year recurring
- [ ] Copy the four price IDs to `.env`
- [ ] Copy test publishable key and secret key to `.env`
- [ ] Add webhook endpoint: `https://your-dev-tunnel/api/v1/billing/webhook`
- [ ] Subscribe to events:
  - `checkout.session.completed`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_succeeded`
  - `invoice.payment_failed`
- [ ] Copy webhook signing secret (`whsec_…`) to `STRIPE_WEBHOOK_SECRET`
- [ ] Configure Stripe Customer Portal (Billing → Customer portal → Settings)

### Local testing with Stripe CLI

```bash
stripe listen --forward-to localhost:3000/api/v1/billing/webhook
# Triggers a test checkout completion:
stripe trigger checkout.session.completed
```

### Production mode

- [ ] Repeat all steps above with live-mode keys
- [ ] Add webhook endpoint with your production URL
- [ ] Ensure `SITE_URL` is set to `https://goldtickerlive.com` so redirect URLs are correct

---

## Architecture Notes

### Security

- The publishable key is the only Stripe credential that touches the browser.
- The secret key and webhook secret live exclusively in server env vars.
- Webhook signature verification uses `stripe.webhooks.constructEvent()` — any request with a bad or
  missing `Stripe-Signature` header is rejected with 400.
- Client-reported payment success (e.g., `?session_id=…` in the URL) is **never trusted** for
  entitlement changes. Only webhook-confirmed events update subscription state.

### Idempotency

Every Stripe event is stored in `stripe_events` by `event.id` before any state mutation. Duplicate
deliveries are detected and acknowledged without re-processing.

### Fail-safe behaviour

When Stripe environment variables are absent:

- `/api/v1/billing/config` returns `{ configured: false }` — no 500.
- `/api/v1/billing/create-checkout-session` returns 503 with `code: BILLING_NOT_CONFIGURED`.
- The pricing page disables CTA buttons and shows a "Payments coming soon" notice.
- The free tracker, calculator, and all free features are unaffected.

### Entitlement resolution

1. `resolveUserEntitlements(userId)` calls `billingRepo.getActiveSubscription(userId)`.
2. If an active/trialing subscription exists, its `tier` is used.
3. Otherwise falls back to `'free'`.
4. `getEntitlementsForTier(tier)` returns the static feature flag map.

For manual grants (gifted Pro access, test accounts), insert a row into the `entitlements` table
with `feature='tier'` and `value='"pro"'`.

---

## File Map

| Path                                | Role                                          |
| ----------------------------------- | --------------------------------------------- |
| `server/routes/billing.js`          | Express routes for all billing endpoints      |
| `server/lib/billing-repository.js`  | Supabase + file-backed persistence            |
| `server/lib/entitlements.js`        | Tier feature flag definitions and resolution  |
| `server/lib/subscriptions.js`       | Legacy shim — delegates to billing-repository |
| `server/routes/stripe.js`           | Legacy stub (backwards-compat, returns 501)   |
| `supabase/schema.sql`               | Database schema — Phase 6 billing section     |
| `pricing.html`                      | Pricing page with live Stripe Checkout CTAs   |
| `content/subscription/success.html` | Post-checkout confirmation page               |
| `docs/BILLING_AND_ENTITLEMENTS.md`  | This file                                     |
