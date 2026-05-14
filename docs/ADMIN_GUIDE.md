# Admin Panel Access Guide

## How to Access the Admin Dashboard

### URL

- **GitHub Pages:** `https://yourusername.github.io/Gold-Prices/admin/`
- **Local development:** serve the repo statically (e.g. `python3 -m http.server 8080`) and open
  `http://localhost:8080/admin/`

> The admin panel is a set of static pages under `admin/`. No Express server is required for GitHub
> Pages deployments.

---

## Authentication

The admin panel uses **Supabase GitHub OAuth**. Only the email address configured in
`admin/supabase-config.js` (`ALLOWED_EMAIL`) is granted access.

### How Login Works

1. User visits `/admin/` — the auth guard (`supabase-auth.js → requireAuth()`) checks for a valid
   Supabase session.
2. If no session (or wrong email), the user is redirected to `/admin/login/`.
3. The login page calls `loginWithGitHub()`, which redirects to GitHub's OAuth consent screen.
4. After GitHub authorization, Supabase issues a session and redirects back to `/admin/`.
5. `requireAuth()` verifies `session.user.email === ALLOWED_EMAIL` on every page load.

### Key Auth Files

| File                       | Purpose                                           |
| -------------------------- | ------------------------------------------------- |
| `admin/supabase-config.js` | Supabase URL, anon key, and allowed admin email   |
| `admin/supabase-auth.js`   | Auth helpers: login, logout, session check, guard |
| `admin/login/index.html`   | Login page with "Sign in with GitHub" button      |

---

## Admin Page Matrix

| Page      | Path               | Status                                | Data Source                     |
| --------- | ------------------ | ------------------------------------- | ------------------------------- |
| Login     | `admin/login/`     | ✅ Working                            | Supabase Auth                   |
| Dashboard | `admin/` (index)   | ✅ Ops control center + summary cards | Supabase + server/file fallback |
| Shops     | `admin/shops/`     | ✅ Working (CRUD)                     | Supabase `shops`                |
| Settings  | `admin/settings/`  | ✅ Working (read/write)               | Supabase `site_settings`        |
| Pricing   | `admin/pricing/`   | 🔲 UI shell only                      | localStorage                    |
| Orders    | `admin/orders/`    | 🔲 UI shell only                      | localStorage                    |
| Content   | `admin/content/`   | 🔲 UI shell only                      | localStorage                    |
| Social    | `admin/social/`    | 🔲 UI shell only                      | localStorage                    |
| Analytics | `admin/analytics/` | 🔲 UI shell only                      | localStorage                    |

**✅ Working** = reads/writes Supabase tables.  
**⚠️ Partial** = has some real data but still relies on localStorage for parts.  
**🔲 UI shell** = page renders but uses localStorage only; Supabase integration not yet wired.

---

## Features

### 1. Dashboard Overview

- Stat cards for key business metrics
- Operations Control Center modules (provider health, snapshots, alerts, moderation, leads,
  newsletter, billing, SEO, X automation, audit)
- Recent activity feed
- API status checks with refresh timing

See [`docs/ADMIN_OPERATIONS_DASHBOARD.md`](./ADMIN_OPERATIONS_DASHBOARD.md) for endpoint and module
details.

### 2. Shop Management (Supabase)

- View all shops with filtering by status (verified/pending/unverified) and type (direct/market)
- Add new shops with name, city, type, verification status, and confidence score
- Edit existing shop details
- Toggle verification status with one click
- Delete shops with confirmation
- Search shops by name or city

### 3. Settings (Supabase)

- Read and write `site_settings` table
- Cache management
- Data export functionality

#### Canonical WhatsApp number

The public-facing WhatsApp contact number is managed here:

- **UI:** `admin/settings/` → `whatsappNumber` field (format `+<country><number>`, validated by
  `/^\+\d{7,15}$/`).
- **Storage:** `site_settings` table in Supabase (key: `whatsappNumber`).
- **Default / placeholder:** `+971501234567` (see `admin/settings/index.html`).

> ⚠️ **Known gap.** The public order flow at
> [`content/order-gold/index.html`](../content/order-gold/index.html) currently opens
> `https://wa.me/?text=…` **without a destination number**, which forces the user to pick a contact
> manually on their device. Wiring the admin- configured `whatsappNumber` into the order page (and
> any future floating WhatsApp button) is tracked in [`docs/plans/README.md`](./plans/README.md) →
> Wave 1 #2 / Wave 4 chatbot. Do not hardcode a number in HTML — read it from `site_settings` at
> build or runtime, keeping the single source of truth in admin Settings.

### 4. UI Shell Pages (localStorage)

The following pages render a functional-looking UI but are not yet backed by Supabase:

- **Pricing** — placeholder price configuration
- **Orders** — placeholder order management
- **Content** — placeholder content/guide management
- **Social** — placeholder social media integration
- **Analytics** — placeholder analytics dashboard

---

## Technical Details

### Authentication

- Supabase GitHub OAuth via `admin/supabase-auth.js`
- Single allowed email configured in `admin/supabase-config.js`
- Session managed by Supabase Auth (stored in localStorage under `sb-<ref>-auth-token`)
- Every admin page calls `requireAuth()` on load — redirects to login if session is missing or email
  does not match

### Data Storage

- **Primary (Supabase):** `shops` and `site_settings` tables with Row Level Security
- **UI shell pages:** localStorage only (no server persistence)
- **Schema:** `supabase/schema.sql` defines tables and RLS policies

### Security Checklist

1. Set `ALLOWED_EMAIL` in `admin/supabase-config.js` to your GitHub account email
2. Enable GitHub as an OAuth provider in your Supabase project
3. Use HTTPS (GitHub Pages provides this automatically)
4. Keep `SUPABASE_ANON_KEY` scoped — RLS policies protect data server-side
5. Review Supabase Auth logs for unauthorized access attempts

---

## Integration with Supabase

Admin pages talk directly to Supabase using the browser client loaded from CDN:

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
```

The client is initialized lazily in `supabase-auth.js` via `window.supabase.createClient()`.

### Database Tables

| Table           | Used By       | Operations   |
| --------------- | ------------- | ------------ |
| `shops`         | Shops page    | Full CRUD    |
| `site_settings` | Settings page | Read / Write |

### Legacy Express Server

The Express server (`server.js`) and its `/api/admin` endpoints still exist for self-hosted
deployments that prefer server-side storage. For GitHub Pages deployments, the Express server is
**not used** — all admin operations go directly to Supabase.

Legacy files (not required for Supabase deployment):

- `server.js`, `server/routes/admin/`
- `lib/auth.js` (JWT auth)
- `admin/api-client.js` (deprecated — not imported by any current page)
- `data/*.json` (file-based storage)

---

## File Structure

```
admin/
├── index.html              # Dashboard page
├── admin.css               # Admin-specific styles
├── supabase-config.js      # Supabase URL, anon key, allowed email
├── supabase-auth.js        # Auth helpers (login, logout, guard)
├── auth.js                 # Legacy auth compatibility shim
├── api-client.js           # Deprecated (not imported anywhere)
├── login/
│   └── index.html          # GitHub OAuth login page
├── shops/
│   └── index.html          # Shop management (Supabase CRUD)
├── settings/
│   └── index.html          # Site settings (Supabase read/write)
├── pricing/
│   └── index.html          # UI shell (localStorage)
├── orders/
│   └── index.html          # UI shell (localStorage)
├── content/
│   └── index.html          # UI shell (localStorage)
├── social/
│   └── index.html          # UI shell (localStorage)
└── analytics/
    └── index.html          # UI shell (localStorage)

supabase/
└── schema.sql              # Database tables + RLS policies
```

---

## Troubleshooting

### Can't access admin page?

- Ensure you are visiting `/admin/` (with trailing slash) — each page is a directory with
  `index.html`
- For local development, serve the repo root statically; the admin pages are plain HTML

### Login not working?

- Confirm GitHub is enabled as an OAuth provider in your Supabase project (Authentication →
  Providers → GitHub)
- Check that the OAuth callback URL in GitHub matches your Supabase project
- Verify `SUPABASE_URL` and `SUPABASE_ANON_KEY` in `admin/supabase-config.js` are correct
- Open browser DevTools → Console for Supabase error messages

### Logged in but immediately redirected back to login?

- Your GitHub email may not match `ALLOWED_EMAIL` in `admin/supabase-config.js`
- Check your GitHub account's primary email (Settings → Emails) and update `ALLOWED_EMAIL` to match
- If you changed `ALLOWED_EMAIL`, hard-refresh the page to pick up the new value

### Changes not persisting?

- **Shops / Settings:** data is stored in Supabase — check your Supabase dashboard for the tables
- **Other pages (Pricing, Orders, etc.):** these are UI shells using localStorage only — data does
  not survive a browser clear
- If Supabase writes fail, check RLS policies in `supabase/schema.sql`

---

## Next Steps

1. **Immediate:** Verify `ALLOWED_EMAIL` matches your GitHub email
2. **Short-term:** Wire remaining UI shell pages (Dashboard, Pricing, Orders, Content, Social,
   Analytics) to Supabase tables
3. **Medium-term:** Add audit logging to Supabase for admin actions
4. **Long-term:** Role-based access for multiple admin users via Supabase Auth
