# Twitter / X Automation — Setup Guide

Automated hourly gold price tweets via GitHub Actions.

---

## Two Posting Systems

This repo contains **two** X/Twitter posting systems:

| System     | Script                        | Workflow               | Notes                                                                                           |
| ---------- | ----------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------- |
| JavaScript | `scripts/tweet-gold-price.js` | `gold-price-tweet.yml` | Original system. Hourly posts with template rotation.                                           |
| Python     | `scripts/gold_poster.py`      | `hourly_post.yml`      | Newer, more capable. Supports market events, spike alerts, health checks, and Supabase logging. |

- The **JavaScript system** is documented in detail on this page.
- The **Python system** also supports market events (`market_events.yml`), spike alerts
  (`spike_alert.yml`), and health checks (`health_check.yml`).
- See `docs/twitter_bot_architecture.md` for the Python system's full architecture.
- Both systems can coexist and **share the same Twitter API credentials**.
- For new setups, the **Python system is recommended**.

---

## How it works

1. The workflow (`.github/workflows/gold-price-tweet.yml`) runs on a cron **every hour at :00**.
2. It executes `scripts/tweet-gold-price.js`, which:
   - Fetches the live XAU/USD spot from **goldpricez.com**.
   - Picks a template based on the hour (Dubai time / UTC+4).
   - Signs the request with **OAuth 1.0a** and posts to the X API v2.

### Template rotation

| Dubai time       | Template used                 |
| ---------------- | ----------------------------- |
| 00:00            | Daily full karat breakdown    |
| 06:00            | Morning market-open edition   |
| 08:00            | Arabic edition (GCC audience) |
| 20:00            | Evening close / end-of-day    |
| 12:00 on Fri/Sat | Weekend wrap-up               |
| All other hours  | Compact hourly snapshot       |

---

## Step 1 — Get a GoldPriceZ key

1. Sign up at **https://goldpricez.com** (free tier available).
2. Copy your API key from the dashboard.

---

## Step 2 — Create an X Developer account and app

1. Go to **https://developer.twitter.com** and apply for a developer account (select "Free" tier).
2. Create a project and app.
3. In the app settings, set **App permissions** to **Read and Write**.
4. Generate the following four credentials from the "Keys and tokens" tab:
   - **API Key** (also called Consumer Key)
   - **API Key Secret** (also called Consumer Secret)
   - **Access Token** — must be generated with _your own account_ to post as you
   - **Access Token Secret**

> ⚠️ Access Tokens generated under "Read and Write" permission are required. Tokens generated under
> "Read only" cannot post tweets.

---

## Step 3 — Add GitHub Secrets

In your repository on GitHub:

1. Go to **Settings → Secrets and variables → Actions**.
2. Add each of the following secrets:

| Secret name           | Value                        |
| --------------------- | ---------------------------- |
| `GOLDPRICEZ_API_KEY`  | Your goldpricez.com API key  |
| `CONSUMER_KEY`        | X App API Key (Consumer Key) |
| `CONSUMER_SECRET`     | X App API Key Secret         |
| `ACCESS_TOKEN`        | X Access Token (read-write)  |
| `ACCESS_TOKEN_SECRET` | X Access Token Secret        |

> **Note:** The workflow YAML files map these GitHub secrets to environment variables named
> `TWITTER_API_KEY`, `TWITTER_API_SECRET`, `TWITTER_ACCESS_TOKEN`, and
> `TWITTER_ACCESS_TOKEN_SECRET`. You do not need to create secrets with the `TWITTER_` prefix — the
> mapping is handled in the workflow.

---

## Step 4 — Test the workflow

1. Go to **Actions → "Hourly Gold Price Tweet"** in your repository.
2. Click **"Run workflow"** → **"Run workflow"** to trigger it manually.
3. Check the logs — a successful run ends with:
   ```
   ✅ Tweet posted! https://twitter.com/i/web/status/...
   ```

---

## Customising templates

Templates are defined in two places:

| File                          | Purpose                                                                                                   |
| ----------------------------- | --------------------------------------------------------------------------------------------------------- |
| `scripts/tweet-gold-price.js` | **Automation** — self-contained templates used by the GitHub Action                                       |
| `social/postTemplates.js`     | **Manual generator** — templates used by the in-browser post generator at `/social/x-post-generator.html` |

Both sets share the same design language. If you change one, mirror the changes in the other.

### Available template IDs

| ID           | Description                                |
| ------------ | ------------------------------------------ |
| `hourly`     | Compact snapshot — spot price + AED karats |
| `daily`      | Full karat breakdown + day change          |
| `morning`    | Good-morning market open                   |
| `evening`    | End-of-day close recap                     |
| `arabic`     | Arabic language for GCC audience           |
| `investment` | Investment framing with 52-week context    |
| `milestone`  | For ATH or round-number events             |
| `weekend`    | Friday/Saturday weekly wrap                |
| `alert`      | Urgent post for big price moves            |
| `weekly`     | Week-in-review with high/low               |

---

## Troubleshooting

### "Missing environment variables"

Make sure all 5 secrets are added in GitHub Settings → Secrets → Actions.

### "HTTP 401 Unauthorized"

- Verify your Access Token has **Read + Write** permissions.
- Regenerate the Access Token and Secret in the X Developer Portal and update the GitHub secrets.

### "HTTP 403 Forbidden"

- You may be on the X Free tier which restricts posting to 17 tweets per 24 hours.
- Reduce frequency by changing `cron: '0 * * * *'` to e.g. `cron: '0 */3 * * *'` (every 3 hours).
- If the response body says `SpendCapReached`, the workflow now logs the reset date and exits
  cleanly without updating tweet-state files because no post was sent.

### Tweet > 280 characters

The market-closed reference template is now compact enough to fit the normal 280-character limit for
realistic price widths. Hourly / market-open / market-close posts now try compact fallback variants
before the repo relies on X's own length enforcement. If X still rejects a post because of
platform-level character rules or account eligibility, the API error should appear in the workflow
logs. X Premium / verified longer-post eligibility is handled by X, not by this repo.

---

## Monetisation context

This automation is designed to drive traffic to **https://vctb12.github.io/Gold-Prices/** where
Google AdSense ads serve on the main pages. More frequent, relevant tweets → more organic clicks →
more ad impressions.

Recommended posting frequency by X plan:

| X Plan        | Safe posting rate                        |
| ------------- | ---------------------------------------- |
| Free          | Max 17/day → post every ~2 h             |
| Basic ($3/mo) | 100/month → hourly for ~4 days then slow |
| Pro / higher  | Hourly with no restriction               |
