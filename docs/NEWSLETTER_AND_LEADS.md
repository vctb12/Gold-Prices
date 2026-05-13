# Newsletter and Lead Capture

> **Phase 4 documentation** — covers subscriber management, lead capture, email sending, admin
> views, and database schema.

---

## Overview

Phase 4 connects all public contact surfaces — footer newsletter form, shop interest, pricing
inquiries, and link tracking — into a unified backend system.

The system is file-backed by default (no database required) and Supabase-synced when
`STORAGE_BACKEND=supabase` + credentials are set.

---

## Architecture

```
Public form → POST /api/v1/newsletter/subscribe
                 ↓
          newsletter.repository.js (file: data/newsletter-subscribers.json)
                 ↓ async (best-effort)
          Supabase newsletter_subscribers table
                 ↓
          server/services/email.js (Resend or dry-run)
                 ↓
          Confirmation email → GET /api/v1/newsletter/confirm/:token
```

```
Shop/pricing/contact form → POST /api/v1/leads
                                ↓
                     leads.repository.js (file: data/leads.json)
                                ↓ admin panel
                     GET/PATCH /api/v1/admin/leads/:id
```

---

## Newsletter Endpoints

| Method | Path                                | Description                            |
| ------ | ----------------------------------- | -------------------------------------- |
| `POST` | `/api/v1/newsletter/subscribe`      | Double opt-in subscribe                |
| `GET`  | `/api/v1/newsletter/confirm/:token` | Confirm email address                  |
| `POST` | `/api/v1/newsletter/unsubscribe`    | Unsubscribe by email or token          |
| `PUT`  | `/api/v1/newsletter/preferences`    | Update preferences (token required)    |
| `GET`  | `/api/v1/newsletter/stats`          | Subscriber counts (admin-only)         |
| `GET`  | `/api/v1/newsletter/subscribers`    | Paginated subscriber list (admin-only) |

### Subscribe request body

```json
{
  "email": "user@example.com",
  "source": "footer",
  "locale": "en",
  "page_path": "/",
  "preferences": {
    "frequency": "weekly",
    "language": "en",
    "metals": [],
    "countries": []
  }
}
```

### Subscriber statuses

| Status         | Meaning                                           |
| -------------- | ------------------------------------------------- |
| `pending`      | Subscribed but email not confirmed yet            |
| `active`       | Confirmed — receives newsletters                  |
| `unsubscribed` | Opted out                                         |
| `bounced`      | Email bounced (set externally via Resend webhook) |

---

## Lead Endpoints

| Method  | Path                      | Description                      |
| ------- | ------------------------- | -------------------------------- |
| `POST`  | `/api/v1/leads`           | Capture a lead                   |
| `GET`   | `/api/v1/admin/leads`     | List leads (admin-only)          |
| `PATCH` | `/api/v1/admin/leads/:id` | Update status/notes (admin-only) |

### Lead types

| Type              | Use case                                                           |
| ----------------- | ------------------------------------------------------------------ |
| `contact`         | General contact form                                               |
| `shop_interest`   | Shop listing interest                                              |
| `pricing_inquiry` | Pricing/quote request                                              |
| `event_track`     | Shop click/call/map interaction (stored as events, not full leads) |

### Lead statuses

| Status      | Meaning                            |
| ----------- | ---------------------------------- |
| `new`       | Just submitted                     |
| `contacted` | Admin has reached out              |
| `converted` | Lead became a customer/listed shop |
| `closed`    | No longer relevant                 |
| `spam`      | Marked as spam                     |

---

## Email Provider

Email is sent via the `server/services/email.js` abstraction.

- **Resend** is used when `RESEND_API_KEY` and `RESEND_FROM_EMAIL` are set.
- **Dry-run mode** logs emails to console without sending. Active when:
  - `NEWSLETTER_DRY_RUN=true`, or
  - either Resend env var is missing.

To install Resend:

```bash
npm install resend
```

---

## Environment Variables

| Variable               | Required    | Description                                         |
| ---------------------- | ----------- | --------------------------------------------------- |
| `RESEND_API_KEY`       | Recommended | Resend API key                                      |
| `RESEND_FROM_EMAIL`    | Recommended | From address (e.g. `newsletter@goldtickerlive.com`) |
| `NEWSLETTER_DRY_RUN`   | No          | Set `true` to log emails without sending            |
| `NEWSLETTER_DATA_FILE` | No          | Override file path for subscriber store             |
| `LEADS_DATA_FILE`      | No          | Override file path for leads store                  |
| `SITE_URL`             | Yes (prod)  | Used to build confirmation/unsubscribe links        |

---

## Database Tables (Supabase)

Six tables added in Phase 4 — see `supabase/schema.sql`:

| Table                    | Purpose                                    |
| ------------------------ | ------------------------------------------ |
| `newsletter_subscribers` | Email subscribers with double opt-in state |
| `lead_submissions`       | Shop/pricing/contact leads                 |
| `lead_events`            | Click/call/status change events            |
| `email_campaigns`        | Newsletter sends (daily/weekly)            |
| `email_deliveries`       | Per-recipient delivery tracking            |
| `consent_logs`           | GDPR-friendly action audit trail           |

---

## Admin Panel

New pages added to `/admin/`:

- `/admin/newsletter/` — subscriber list, status filter, CSV export
- `/admin/leads/` — lead list, type/status filters, status update modal

Both are added to the sidebar under the **Growth** group.

---

## Double Opt-In Flow

1. User submits email on any newsletter form.
2. Server creates subscriber with `status: pending`.
3. Confirmation email is sent via Resend (or logged in dry-run mode).
4. User clicks the link: `GET /api/v1/newsletter/confirm/:token`.
5. Server activates the subscriber: `status: active`.
6. User is redirected to `/?newsletter=confirmed`.

---

## Unsubscribe

Users can unsubscribe by:

1. Clicking the unsubscribe link in any newsletter email.
2. Visiting `/content/unsubscribe/` and submitting their email.
3. Sending `POST /api/v1/newsletter/unsubscribe` with `{ email }` or `{ token }`.

---

## Security

- **Honeypot field**: A hidden `website` input field. Bots fill it; humans don't. Honeypot hits are
  silently accepted but not stored.
- **Rate limiting**: Subscribe and unsubscribe endpoints are rate-limited to 5 and 10 requests per
  15 minutes respectively (per IP).
- **Token hashing**: Confirmation and unsubscribe tokens are SHA-256 hashed before storage. The raw
  token is single-use (cleared after confirmation).
- **No email enumeration**: All subscribe/unsubscribe responses are identical regardless of whether
  the email exists.
- **Admin routes**: Stats and subscriber list endpoints require JWT admin auth.

---

## Testing

```bash
npm test
# Runs newsletter.test.js and leads.test.js among all tests
```

Tests cover:

- Subscribe validation (missing email, invalid format)
- Honeypot suppression
- Duplicate/re-subscribe flows
- Confirmation token flow
- Unsubscribe by email and token
- Admin protection (401 without token)
- Lead creation, event tracking
- PATCH status updates
- Spam marking

---

## Sending Newsletters

The `scripts/node/send-newsletter.js` script sends the daily or weekly newsletter. It reads active
subscribers from the file store (or Supabase if configured) and sends via the email service
abstraction.

```bash
node scripts/node/send-newsletter.js daily
node scripts/node/send-newsletter.js weekly
```

GitHub Actions workflows trigger these automatically:

- `daily-newsletter.yml` — 7:00 AM Dubai time daily
- `weekly-newsletter.yml` — Sunday 6:00 PM Dubai time

---

## Consent Logging

The `consent_logs` table (Supabase) records every consent action:

- `consent_given` on subscribe
- `confirmed` on email confirmation
- `unsubscribed` on opt-out
- `resubscribed` on re-subscribe after unsubscribe

IP addresses and user agents are hashed for privacy compliance.
