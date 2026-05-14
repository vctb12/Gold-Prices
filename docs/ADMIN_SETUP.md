# Admin Panel Setup Guide

## Overview

The admin panel uses **Supabase GitHub OAuth** for authentication and **Supabase Postgres** for data
storage. It runs as static HTML on GitHub Pages — no server required.

There is a single login page at `admin/login/` with a "Sign in with GitHub" button. Only the
configured admin email can access the panel.

## Quick Start (GitHub Pages + Supabase)

### 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Note your **Project URL** and **anon public key** from Settings → API

### 2. Run the Database Schema

1. Open the SQL Editor in your Supabase dashboard
2. Paste the contents of `supabase/schema.sql` and run it
3. This creates the `shops` and `site_settings` tables with Row Level Security policies

### 3. Enable GitHub OAuth

1. **In GitHub:** Settings → Developer settings → OAuth Apps → New OAuth App
   - **Application name:** Gold Ticker Live Admin (or any name)
   - **Homepage URL:** `https://yourusername.github.io/Gold-Prices/`
   - **Authorization callback URL:** `https://<your-project-ref>.supabase.co/auth/v1/callback`
   - Click **Register application**
   - Copy the **Client ID** and generate a **Client Secret**

2. **In Supabase:** Authentication → Providers → GitHub → Enable
   - Paste the **Client ID** and **Client Secret** from step 1
   - Save

> **Important:** The callback URL in GitHub must exactly match your Supabase project reference. For
> example: `https://nebdpxjazlnsrfmlpgeq.supabase.co/auth/v1/callback`

### 4. Configure the Admin Panel

Edit `admin/supabase-config.js`:

```js
export const SUPABASE_URL = 'https://<your-project-ref>.supabase.co';
export const SUPABASE_ANON_KEY = '<your-anon-public-key>';
export const ALLOWED_EMAIL = 'your-github-email@example.com';
```

`ALLOWED_EMAIL` must match the **primary email** on your GitHub account (GitHub → Settings →
Emails).

> **Private email?** If your GitHub email is set to private, the admin panel uses fallback
> resolution: it checks `user_metadata.email` and identity data from the GitHub provider. Make sure
> at least one email matches `ALLOWED_EMAIL`.

### 5. Access the Admin Panel

Navigate to: `https://yourusername.github.io/Gold-Prices/admin/`

Click **Sign in with GitHub** and authorize the OAuth app. After redirect, you will land on the
admin dashboard.

---

## What Works Today

| Page      | Path               | Status                | Data Source                     |
| --------- | ------------------ | --------------------- | ------------------------------- |
| Login     | `admin/login/`     | ✅ Working            | Supabase Auth                   |
| Dashboard | `admin/` (index)   | ✅ Ops control center | Supabase + server/file fallback |
| Shops     | `admin/shops/`     | ✅ Full CRUD          | Supabase `shops`                |
| Settings  | `admin/settings/`  | ✅ Read/Write         | Supabase `site_settings`        |
| Pricing   | `admin/pricing/`   | 🔲 UI shell           | localStorage                    |
| Orders    | `admin/orders/`    | 🔲 UI shell           | localStorage                    |
| Content   | `admin/content/`   | 🔲 UI shell           | localStorage                    |
| Social    | `admin/social/`    | 🔲 UI shell           | localStorage                    |
| Analytics | `admin/analytics/` | 🔲 UI shell           | localStorage                    |

---

## Authentication

- **Method:** Supabase GitHub OAuth (single sign-on via GitHub)
- **Guard:** Every admin page calls `requireAuth()` from `admin/supabase-auth.js` on load
- **Access control:** Only the email in `ALLOWED_EMAIL` is allowed; all other accounts are signed
  out and redirected to login
- **Email resolution:** Uses `resolveEmail()` which checks `user.email`, `user_metadata.email`, and
  GitHub identity data — handles private GitHub emails
- **Session storage:** Supabase stores the session in localStorage under `sb-<ref>-auth-token`

### Auth Flow

```
/admin/login/  →  loginWithGitHub()  →  GitHub OAuth  →  Supabase callback
                                                              ↓
                                                    Redirect to /admin/
                                                    (with #access_token=… hash)
                                                              ↓
                                               Supabase client parses hash → session
                                                              ↓
                                               requireAuth() checks email via resolveEmail()
```

### Flash Prevention

All admin pages include an inline `<script>` that redirects to `/admin/login/` if no Supabase
session token exists in localStorage. This prevents a flash of admin content before the async auth
check completes. The script skips the redirect if an OAuth hash fragment (`#access_token=…`) is
present, allowing the Supabase client to process the callback.

---

## Data Storage

- **Shops:** Supabase `shops` table (full CRUD from the Shops admin page)
- **Settings:** Supabase `site_settings` table (key-value pairs)
- **UI shell pages:** localStorage only (Pricing, Orders, Content, Social, Analytics)

### Database Schema

Run `supabase/schema.sql` to create all required tables and RLS policies. The schema includes:

- `shops` — shop directory entries
- `site_settings` — key-value site configuration

---

## Security

### Best Practices

1. Set `ALLOWED_EMAIL` to your GitHub account's primary email
2. Keep RLS policies enabled — they restrict data access even with the anon key
3. Use HTTPS (GitHub Pages provides this by default)
4. Do not commit service role keys to the repo — the anon key is safe to commit because RLS protects
   the data
5. Periodically review Supabase Auth logs (Authentication → Logs) for unusual activity

---

## Troubleshooting

### Cannot Login / "Sign in with GitHub" Does Nothing

1. **GitHub OAuth provider not enabled in Supabase:** Go to Supabase Dashboard → Authentication →
   Providers → GitHub and verify it is enabled with the correct Client ID and Client Secret from
   your GitHub OAuth App.

2. **Wrong callback URL in GitHub:** The Authorization callback URL in your GitHub OAuth App must be
   exactly: `https://<your-project-ref>.supabase.co/auth/v1/callback`

3. **Browser errors:** Open DevTools → Console and look for error messages. Common ones:
   - `"provider is not enabled"` — Enable GitHub in Supabase Providers
   - `"redirect_uri_mismatch"` — Fix the callback URL in GitHub OAuth App settings
   - Network errors — Check internet connection and Supabase project status

### Logged In But Redirected to Login

- Your GitHub email does not match `ALLOWED_EMAIL` in `admin/supabase-config.js`
- If your GitHub email is private, make sure it still appears in your GitHub profile's identity data
- Check your GitHub primary email (GitHub → Settings → Emails) and update the config to match

### "Could not read your GitHub email"

- Your GitHub email is set to private and the fallback resolution could not find a matching email
- Go to GitHub → Settings → Emails and either:
  - Make your email public, OR
  - Ensure the email in `ALLOWED_EMAIL` is listed as a verified email on your GitHub account

### Data Not Persisting

- For Shops / Settings: check your Supabase dashboard — the tables should have data
- For other pages: they use localStorage only (data is lost on browser clear)
- If Supabase writes fail silently, check RLS policies and the browser console

### Page Shows Blank or Errors

- Ensure the Supabase CDN script loads: check for network errors on
  `cdn.jsdelivr.net/npm/@supabase/supabase-js@2`
- Verify `SUPABASE_URL` and `SUPABASE_ANON_KEY` in `admin/supabase-config.js`

---

## Admin Panel File Structure

```
admin/
├── index.html              # Dashboard page
├── login/index.html        # Login page (GitHub OAuth)
├── supabase-auth.js        # Auth module (loginWithGitHub, requireAuth, resolveEmail, etc.)
├── supabase-config.js      # Supabase credentials + ALLOWED_EMAIL
├── auth.js                 # Compatibility shim (re-exports from supabase-auth.js)
├── shops/index.html        # Shops management (Supabase backend)
├── settings/index.html     # Settings management (Supabase backend)
├── pricing/index.html      # Pricing management (localStorage)
├── orders/index.html       # Orders management (localStorage)
├── content/index.html      # Content management (localStorage)
├── social/index.html       # Social post generator (localStorage)
└── analytics/index.html    # Analytics dashboard (localStorage)
```

---

## Optional: Self-Hosted Express Server

For self-hosted deployments, the Express server (`server.js`) and its JWT-based auth still exist as
a legacy option. This is **not required** for GitHub Pages. The `/admin` route on the Express server
now redirects to `/admin/` (the Supabase-integrated admin panel).

### Express Quick Start

```bash
cp .env.example .env
# Edit .env: set JWT_SECRET, ADMIN_PASSWORD
npm start
# Server runs on http://localhost:3000
```

The Express server provides:

- JWT authentication via `server/lib/auth.js`
- File-based storage in `data/*.json`
- REST API at `/api/admin/` (shops, audit logs, users)

---

## Tests

Run the test suite to verify nothing is broken:

```bash
npm test
```
