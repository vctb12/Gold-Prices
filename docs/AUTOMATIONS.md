# Gold Ticker Live — Automation Setup Guide

All automation runs via GitHub Actions and requires only GitHub Secrets — no paid hosting.

---

## Secrets required

Go to **Settings → Secrets and variables → Actions → New repository secret** for each:

| Secret                      | Used by                 | How to get it                                        |
| --------------------------- | ----------------------- | ---------------------------------------------------- |
| `GOLDPRICEZ_API_KEY`        | All price scripts       | Sign up at https://goldpricez.com                    |
| `CONSUMER_KEY`              | X/Twitter posts         | X Developer Portal: API Key (Consumer Key)           |
| `CONSUMER_SECRET`           | X/Twitter posts         | X Developer Portal: API Key Secret                   |
| `ACCESS_TOKEN`              | X/Twitter posts         | X Developer Portal: Access Token (read-write)        |
| `ACCESS_TOKEN_SECRET`       | X/Twitter posts         | X Developer Portal: Access Token Secret              |
| `SUPABASE_URL`              | Python poster, DB sync  | Supabase project → Settings → API → URL              |
| `SUPABASE_SERVICE_ROLE_KEY` | Python poster, DB sync  | Supabase project → Settings → API → service_role key |
| `TELEGRAM_BOT_TOKEN`        | Telegram posts & alerts | @BotFather on Telegram                               |
| `TELEGRAM_CHANNEL_ID`       | Telegram posts & alerts | Channel username e.g. `@mygoldchannel` or numeric ID |
| `DISCORD_WEBHOOK_URL`       | Discord posts & alerts  | Discord channel → Integrations → Webhooks            |

> **Note on Twitter secrets:** Workflows map these GitHub secrets to environment variables named
> `TWITTER_API_KEY`, `TWITTER_API_SECRET`, `TWITTER_ACCESS_TOKEN`, and `TWITTER_ACCESS_TOKEN_SECRET`
> inside the workflow YAML files. The actual GitHub secret names are the shorter forms listed above.

---

## Workflows

> ### ⚠️ Dual Twitter Bot Systems — Action Required
>
> Two X/Twitter posting systems exist and overlap:
>
> | System                 | Script                             | Workflow                                                                      | Status                                                                   |
> | ---------------------- | ---------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
> | **Node.js** (original) | `scripts/node/tweet-gold-price.js` | `gold-price-tweet.yml`                                                        | Active — simple hourly tweet with 10 rotating templates                  |
> | **Python** (newer)     | `scripts/python/gold_poster.py`    | `hourly_post.yml`, `market_events.yml`, `spike_alert.yml`, `health_check.yml` | Active — richer templates, Supabase logging, market events, spike alerts |
>
> **Recommendation:** Keep the **Python** system active. It is more capable (supports market events,
> spike alerts, health checks, and Supabase logging). Deactivate the Node.js system by disabling
> `gold-price-tweet.yml` in GitHub Actions (or deleting it). Both systems use the same Twitter API
> credentials (`CONSUMER_KEY`, `CONSUMER_SECRET`, `ACCESS_TOKEN`, `ACCESS_TOKEN_SECRET`). Running
> both will cause duplicate tweets.
>
> See `docs/twitter_bot_architecture.md` for the Python system's full architecture. See
> `MANUAL_INPUTS.md` item for deactivation instructions.

### 1. Hourly X/Twitter posts (JS) — `gold-price-tweet.yml`

Posts every hour. Rotates 10 templates by Dubai time.

- Script: `scripts/tweet-gold-price.js`
- See `docs/TWITTER_AUTOMATION.md` for detailed setup.

### 2. Telegram posts — `gold-price-telegram.yml`

Posts at **07:00, 12:00, 18:00 UTC** (11:00, 16:00, 22:00 Dubai).

- Script: `scripts/notify-telegram.js`
- Secrets needed: `GOLDPRICEZ_API_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHANNEL_ID`

**Telegram setup:**

1. Open Telegram → search `@BotFather`
2. Send `/newbot` → follow steps → copy token
3. Create a channel/group, add your bot as admin
4. Get channel ID via `@userinfobot` or the
   [getUpdates API](https://core.telegram.org/bots/api#getupdates)
5. Add as GitHub Secrets

### 3. Discord posts — `gold-price-discord.yml`

Posts a rich embed daily at **08:00 UTC** (noon Dubai).

- Script: `scripts/notify-discord.js`
- Secrets needed: `GOLDPRICEZ_API_KEY`, `DISCORD_WEBHOOK_URL`

**Discord setup:**

1. In Discord server: Server Settings → Integrations → Webhooks → New Webhook
2. Pick channel → copy webhook URL
3. Add as `DISCORD_WEBHOOK_URL` GitHub Secret

### 4. Price spike alerts — `gold-price-spike.yml`

Checks every hour (`:30`). Fires to all configured channels when gold moves >2% from open.

- Script: `scripts/price-spike-alert.js`
- Threshold: change `SPIKE_THRESHOLD_PCT` secret (default `2.0`)
- Alerts: Telegram + Discord + X (all optional, uses whichever secrets are present)

### 5. Auto-sitemap + RSS on deploy — `deploy.yml`

Both `sitemap.xml` and `feed.xml` are regenerated on every deploy:

- `node scripts/generate-sitemap.js` — updates `sitemap.xml`
- `node scripts/generate-rss.js` — generates `feed.xml`
- Both are copied to `dist/` automatically

The RSS feed is live at: `https://vctb12.github.io/Gold-Prices/feed.xml`

### 6. Weekly dead-link checker — `weekly-link-check.yml`

Runs every **Monday at 06:00 UTC**. Builds the site and checks all internal links. Fails the GitHub
Action if broken links are found.

### 7. Uptime monitor — `uptime-monitor.yml`

Pings the site every **30 minutes**. Alerts via Telegram and/or Discord if site is down.

- Script: `scripts/uptime-check.js`

### 8. Python X/Twitter posts — `post_gold.yml`

Runs **hourly** while the global gold market is open (Sunday 21:00 UTC through Friday 20:59 UTC),
offset a few minutes after the fetch workflow so it reads freshly committed data. It posts only when
the cached result passes the stale, duplicate, cooldown, and 280-character guards.

Manual `workflow_dispatch` is supported for GitHub UI and iPhone Shortcut triggers. Manual runs do
not fetch gold prices themselves and do not bypass GitHub guardrails; they reuse the same cached
`data/gold_price.json` source-of-truth and are protected by the same skip logic. `force_post=true`
only overrides the cooldown guard.

- Script: `scripts/python/post_gold_price.py`
- Secrets needed: `CONSUMER_KEY`, `CONSUMER_SECRET`, `ACCESS_TOKEN`, `ACCESS_TOKEN_SECRET`
- State file: `data/last_gold_price.json` records the last successful post and is ignored by the
  deploy workflow to avoid redeploying the site for tweet-state-only commits.
- `data/last_tweet_state.json` stores duplicate/cooldown state for safe scheduled + manual runs.
- Recommended manual inputs: `dry_run`, `force_post`, and `source` (`manual`, `shortcut`,
  `scheduled`).

### 8a. Gold provider bakeoff & migration (infrastructure only)

The provider-adapter pipeline (`scripts/python/fetch_gold_price.py`,
`scripts/python/provider_bakeoff.py`, `scripts/python/provider_scorecard.py`,
`scripts/python/tweet_guard.py`) and its workflows (`gold-provider-bakeoff.yml`,
`test-gold-providers.yml`) are landed but **not** wired into production. Legacy GoldPriceZ remains
the active path until you flip it.

Before activating, fill in the operator checklist:
[`docs/operator-inputs-gold-provider-bakeoff.md`](./operator-inputs-gold-provider-bakeoff.md). For
the owner-only pre-merge checklist see
[`docs/OWNER_ACTIONS_REQUIRED_GOLD_BAKEOFF.md`](./OWNER_ACTIONS_REQUIRED_GOLD_BAKEOFF.md). Run the
readiness gate before review/merge: `python scripts/python/gold_bakeoff_readiness.py --strict` (also
available as **Actions → Gold Bakeoff Readiness**). See also
[`gold-price-provider-bakeoff.md`](./gold-price-provider-bakeoff.md),
[`gold-price-provider-migration.md`](./gold-price-provider-migration.md), and
[`x-automation-duplicate-policy.md`](./x-automation-duplicate-policy.md).

Fast safe workflows:

- **Immediate smoke:** **Actions → Test Gold Providers (manual)** → one round, artifact-only, no X
  post, no commit.
- **Micro-bakeoff:** **Actions → Gold Provider Bakeoff** with `mode=micro`,
  `duration_minutes=50..90`, `interval_seconds=360`, `commit_results=false`.

The 24h+ bakeoff is still the confidence gate for picking a winning provider and changing
production, but it is **not** required to keep iterating on the automation or to gather quick
same-day evidence.

### 9. Market events — `market_events.yml`

Posts session open/close alerts (e.g. London open, New York close) to X/Twitter.

- Script: `scripts/gold_poster.py` (market events mode)
- Secrets needed: same as workflow 8

### 10. Spike alerts (Python) — `spike_alert.yml`

Python-based price spike detection. Fires alerts when gold moves significantly.

- Script: `scripts/gold_poster.py` (spike alert mode)
- Secrets needed: same as workflow 8

### 11. Health check — `health_check.yml`

Daily system health verification. Checks API connectivity, credential validity, and posting status.

- Script: `scripts/gold_poster.py` (health check mode)
- Secrets needed: same as workflow 8

### 12. Sync DB to Git — `sync-db-to-git.yml`

Syncs Supabase shops data to `data/shops.js` and commits the result.

- Secrets needed: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

### 13. CI validation — `ci.yml`

Runs on pull requests. Executes tests, validation, and build checks.

### 14. Deploy — `deploy.yml`

Builds and deploys the site to GitHub Pages on push to `main`.

- Also regenerates `sitemap.xml` and `feed.xml` (see workflow 5).

---

## Testing a workflow manually

1. Go to **Actions** tab in your repo
2. Select the workflow
3. Click **Run workflow** → **Run workflow**

This triggers it immediately without waiting for the cron schedule.

---

## Reducing X post frequency (Free tier)

X Free tier allows ~17 posts per 24 hours. To post every 2 hours instead of every hour, change the
cron in `gold-price-tweet.yml`:

```yaml
# Every 2 hours instead of every hour
- cron: '0 */2 * * *'
```

---

## Adding WhatsApp alerts

WhatsApp Business API is not free but can be added similarly:

1. Sign up for [Meta Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api)
2. Add `WHATSAPP_PHONE_ID` and `WHATSAPP_TOKEN` secrets
3. Create `scripts/notify-whatsapp.js` modelled after `notify-telegram.js`
4. Add a new workflow calling the script

---

## Email digest

Use [Resend](https://resend.com) (free: 100 emails/day):

1. Sign up → get API key
2. Add `RESEND_API_KEY` and `DIGEST_EMAIL_TO` secrets
3. Create `scripts/send-digest.js` using the Resend REST API
4. Schedule via GitHub Actions cron
