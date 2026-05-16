# Supabase Setup Guide

This document explains how to connect Gold Ticker Live to Supabase for persistent storage,
authentication, and future backend functionality.

---

## 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a free project.
2. Note your **Project URL** and **API keys** from _Settings → API_.

---

## 2. Configure Environment Variables

Copy `.env.example` to `.env` and fill in:

```bash
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here   # server side only
```

Owner setup checklist:

- [ ] `SUPABASE_URL` set in runtime env
- [ ] `SUPABASE_ANON_KEY` set (for token validation and browser auth flows)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` set (required for privileged server operations, including full
      auth-user deletion)
- [ ] Keep service-role key out of client bundles and logs

> **Never commit `.env` to source control.** The `.env.example` file shows what's needed.

---

## 3. Apply the Database Schema

Open the Supabase SQL Editor (_Database → SQL Editor → New query_), paste the contents of
[`supabase/schema.sql`](../supabase/schema.sql), and run it.

This creates:

| Table                       | Purpose                                                            |
| --------------------------- | ------------------------------------------------------------------ |
| `public.shops`              | Gold shop directory with confidence scores and verification status |
| `public.audit_logs`         | Immutable record of all admin actions                              |
| `public.user_profiles`      | Admin role/name data linked to `auth.users`                        |
| `public.profiles`           | Public account profile data for end users                          |
| `public.user_preferences`   | Per-user saved defaults (language, currency, tool preferences)     |
| `public.saved_calculations` | Saved calculator runs for signed-in users                          |
| `public.watchlists`         | Saved watchlist items (karats, currencies, alert markers)          |
| `public.saved_shops`        | Saved directory shops for signed-in users                          |
| `public.user_sessions`      | Lightweight public account session audit trail                     |
| `public.site_settings`      | Key-value store for admin-configurable site settings               |
| `public.gold_prices`        | Cached gold price snapshots (per-country, per-karat)               |
| `public.fetch_logs`         | Log of every gold-price fetch attempt (status, source, errors)     |

---

## 4. Row Level Security (RLS) Summary

All tables have RLS **enabled**. The policies enforce:

| Table                | Unauthenticated    | Authenticated user | Admin              |
| -------------------- | ------------------ | ------------------ | ------------------ |
| `shops`              | Read verified only | Read all           | Full CRUD          |
| `audit_logs`         | No access          | Read own           | Read all           |
| `user_profiles`      | No access          | Read own profile   | Read/update all    |
| `profiles`           | No access          | Own profile only   | Service-role/admin |
| `user_preferences`   | No access          | Own preferences    | Service-role/admin |
| `saved_calculations` | No access          | Own rows only      | Service-role/admin |
| `watchlists`         | No access          | Own rows only      | Service-role/admin |
| `saved_shops`        | No access          | Own rows only      | Service-role/admin |
| `user_sessions`      | No access          | Own rows only      | Service-role/admin |
| `site_settings`      | Public read        | Public read        | Admin write        |
| `gold_prices`        | No access          | No access          | Service-role only  |
| `fetch_logs`         | No access          | No access          | Service-role only  |

Writes to `audit_logs` are performed server-side using the **service-role key**, which bypasses RLS.
Never expose the service-role key to the browser.

---

## 5. Install the Supabase package

```bash
npm install @supabase/supabase-js
```

The package is not listed as a hard dependency so the app runs without it (falling back to file
storage). Install it only when you are ready to enable Supabase storage.

---

## 6. Using the Client in Code

`lib/supabase-client.js` provides a lazy-initialised factory. It returns `null` gracefully if the
env vars or the package are missing, so callers can fall back to file storage.

### Server-side (admin API routes / server.js)

```js
const { getSupabaseClient } = require('./lib/supabase-client');

// Anon client – respects RLS (suitable for read-only public queries)
const supabase = getSupabaseClient();

// Service-role client – bypasses RLS (server-only; never expose to the browser)
const supabaseAdmin = getSupabaseClient(true);

const { data, error } = await supabaseAdmin.from('audit_logs').insert([...]);
```

### Repository layer

The `repositories/` layer selects the backend automatically based on `STORAGE_BACKEND`. Direct
client usage is only needed for advanced queries outside the repository interface.

### Browser (public pages)

For browser-side Supabase access (e.g. live shop queries), load via CDN:

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
```

Then use the globally available `supabase` object, initialised with your `SUPABASE_URL` and
`SUPABASE_ANON_KEY`.

---

## 7. Migrating From File-Based Storage

The current server uses `data/shops-data.json` and `data/audit-logs.json` for persistence. When
Supabase is connected, you can migrate by:

1. Reading the existing JSON files.
2. Using a one-off import script that calls `supabase.from('shops').insert(shops)`.
3. Setting `STORAGE_BACKEND=supabase` in `.env`.
4. The `repositories/` layer (which the admin API routes use) will automatically switch to Supabase
   — no further code changes required.

The file-based layer continues to work as a fallback until the migration is verified.

See [`docs/ARCHITECTURE.md`](ARCHITECTURE.md) for the full storage abstraction details.

---

## 7. Authentication via Supabase Auth (Current)

The admin panel uses **Supabase GitHub OAuth** for authentication:

1. Enable **GitHub** provider in Supabase → Authentication → Providers.
2. Create a GitHub OAuth App at https://github.com/settings/developers and set the callback URL to
   your Supabase project's auth callback URL.
3. Enter the GitHub OAuth Client ID and Secret in the Supabase provider settings.
4. Set `ALLOWED_EMAIL` in `admin/supabase-config.js` to match the email on your GitHub account.

The login flow:

- User clicks "Sign in with GitHub" on `/admin/login/`
- Supabase redirects to GitHub for OAuth
- On success, Supabase creates a session
- `admin/supabase-auth.js` checks `session.user.email === ALLOWED_EMAIL`
- If the email doesn't match, the user is signed out and shown an error

The legacy JWT flow in `lib/auth.js` and `server/routes/admin/index.js` is still available for
self-hosted Express deployments.

---

## 8. Follow-up Recommendations

- Add Supabase Realtime subscriptions for live shop-count updates on the admin dashboard.
- Use Supabase Storage for shop images/logos.
- Use Supabase Edge Functions as a serverless proxy for the gold/FX API calls (removes CORS exposure
  of API keys from the browser).
- Set up Supabase database backups and point-in-time recovery for production data safety.
