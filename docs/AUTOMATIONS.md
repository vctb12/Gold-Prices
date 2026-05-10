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

### 1. Price fetch — `gold-price-fetch.yml`

Runs on a cron schedule during the 24/5 gold market window (Sunday 21:00 UTC → Friday 20:59 UTC).
Calls the provider waterfall (`gold_api_com → twelvedata_xauusd → fmp_gcusd`) via
`scripts/python/fetch_gold_price.py` and commits `data/gold_price.json` if the price changed.

**This is the only workflow that calls external price APIs on a schedule.**

- Cron: `2 21-23 * * 0`, `2 * * * 1-4`, `2 0-20 * * 5` (`:02` of each open hour)
- State file: `data/gold_price.json`, `data/last_gold_price.json`
- No X API calls.

### 1a. Manual price refresh via post_gold.yml dispatch

`workflow_dispatch` on `post_gold.yml` supports `refresh_price_first=true` to trigger a one-shot
provider fetch before posting. This is the only non-scheduled provider call path.

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

The RSS feed is live at: `https://goldtickerlive.com/feed.xml`

### 6. Weekly dead-link checker — `weekly-link-check.yml`

Runs every **Monday at 06:00 UTC**. Builds the site and checks all internal links. Fails the GitHub
Action if broken links are found.

### 7. Uptime monitor — `uptime-monitor.yml`

Pings the site every **30 minutes**. Alerts via Telegram and/or Discord if site is down.

- Script: `scripts/uptime-check.js`

### 8. Python X/Twitter posts — `post_gold.yml`

Runs **hourly** during the gold market window (Sunday 21:09 UTC → Friday 20:09 UTC), offset 9
minutes after the fetch workflow so it reads freshly committed data. Scheduled hourly runs are
market-aware: regular hourly posts only go out when the market is open, and they post only when the
cached result passes the stale, duplicate, and cooldown guards.

**Architecture:** `post_gold.yml` posts from cached `data/gold_price.json` only. It never fetches
prices itself on scheduled runs. The gold price is written by `gold-price-fetch.yml` (see §1). This
separation keeps the posting workflow free of provider API keys on scheduled runs and makes the two
responsibilities independently testable.

**Provider order** (production, set in `gold-price-fetch.yml`):
`gold_api_com → twelvedata_xauusd → fmp_gcusd`

Manual `workflow_dispatch` is supported for GitHub UI and iPhone Shortcut triggers.
Operator-triggered manual / Shortcut runs may still attempt a post outside market hours, but they do
not fetch gold prices on the normal posting path and still reuse the same cached
`data/gold_price.json` source-of-truth. Those operator-triggered runs still obey stale-data checks,
duplicate/content-hash checks, cooldown rules, and normal X API behavior. `dry_run=true` never
posts. `force_post=true` only overrides the cooldown guard; it does not bypass stale, duplicate,
content-hash, or provider-based safety checks. The poster now uses a small template matrix with
compact fallbacks: `market_closed_reference` is always compact, and hourly/open/close posts can fall
back to compact variants before the workflow ever relies on X's own length enforcement.

Shortcut anti-spam protection is also enabled for `source=shortcut`: the workflow still keeps
workflow-level concurrency (`group: post-gold`, `cancel-in-progress: true`), and the Python poster
records the latest Shortcut-triggered attempt in `data/last_tweet_state.json`. If another
Shortcut-triggered attempt arrives less than 2 minutes later, it exits early unless
`force_post=true`. This is intentionally narrow: scheduled runs are unaffected, and the normal
stale, duplicate, content-hash, and cooldown guards still run for any Shortcut run that is allowed
past this early check.

Outside market hours, a manual GitHub UI / Shortcut run switches to a **market-closed reference**
post type instead of reusing the normal hourly live-update template. That closed-market path uses
the last cached spot/reference price, labels the copy as market closed and not live retail pricing,
and only allows stale cached data when the timestamp exists and the data age is within
`CLOSED_MARKET_MAX_STALE_HOURS` (default `48`). Market-open hourly posts still block stale quotes.

**Price-change guard and same-price market-closed skips:** The bot is price-change driven. It skips
posting when the current price equals the previous successfully posted price. For
`market_closed_reference` posts, when this guard fires, the workflow logs a detailed diagnostic
message that includes the previous price, current price, previous post timestamp, minutes since last
post, `selected_post_type`, `source`, `trigger_nonce`, and `refresh_price_first`. This is a clean
successful skip — not a workflow failure. Operators who need to repost the same closing price (for
example, to announce a market closure that was not posted earlier, or to post after a gap where the
closing price has not moved) can set `allow_same_price_closed_market_repost=true` in the
`workflow_dispatch` inputs — see below.

**Why two runs with identical visible inputs can behave differently:** The visible workflow inputs
(`force_post`, `source`, `refresh_price_first`, `allow_same_price_closed_market_repost`,
`trigger_nonce`) are set by the operator and do not change between runs. However, the internal
`data/last_tweet_state.json` is updated after every successful post. If the first run posts and the
second run arrives shortly after, `minutes_since_last_tweet` will be small, `force_summary_due` will
be `False`, and the `price_move_below_threshold` guard will fire and skip the second run even though
the visible inputs appear identical. This is correct behavior. See
[`docs/x-automation-duplicate-policy.md § 8`](./x-automation-duplicate-policy.md) for the full
analysis including the 18:29/18:46 example and the dual-state explanation.

**State-file authority:** `data/last_tweet_state.json` is now the authoritative previous-post source
for cooldown, duplicate, and operator metadata. `data/last_gold_price.json` is still written for
legacy compatibility, but the poster no longer trusts it when `last_tweet_state.json` already has a
valid last-post record. The RUN CONTEXT block still lists both files so operators can spot schema
drift quickly.

**Workflow_dispatch inputs:**

| Input                                   | Default  | Description                                                                                                                                                                                                                                                                                                                                                                                                  |
| --------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `dry_run`                               | `false`  | Evaluate all guards; skip the real X API call                                                                                                                                                                                                                                                                                                                                                                |
| `force_post`                            | `false`  | Bypass cooldown only; duplicate and stale guards still apply                                                                                                                                                                                                                                                                                                                                                 |
| `source`                                | `manual` | Trigger source label for logs/state (`manual`, `shortcut`)                                                                                                                                                                                                                                                                                                                                                   |
| `refresh_price_first`                   | `false`  | Run one price refresh before posting (manual/operator only). Fetches `data/gold_price.json` from providers once before the normal posting path runs. Post type is still determined by market hours and the operator trigger — not the provider timestamp. If the market is closed and the price is unchanged, `allow_same_price_closed_market_repost=true` is also required to bypass the price-change guard |
| `trigger_nonce`                         | `""`     | Optional unique manual trigger label. Appears in logs and `last_tweet_state.json` for traceability. Does not affect tweet text or `duplicate_text_hash`. `trigger_nonce=none` / empty is allowed                                                                                                                                                                                                             |
| `allow_same_price_closed_market_repost` | `false`  | Manual/operator only: allow `market_closed_reference` repost even if the closing price is unchanged, subject to duplicate/content-hash/cooldown protections. Scheduled runs ignore this                                                                                                                                                                                                                      |

`refresh_price_first=true` only runs for manual `workflow_dispatch`; scheduled runs always post from
cached data and never trigger a provider fetch inside `post_gold.yml`.

`allow_same_price_closed_market_repost=true` applies only when:

- `event == workflow_dispatch`
- `source` is `manual` or `shortcut`
- `selected_post_type == market_closed_reference`

It does NOT apply to scheduled runs and does NOT bypass `duplicate_text_hash`, cooldown (unless
`force_post=true`), or X's own duplicate-detection.

- Script: `scripts/python/post_gold_price.py`
- Secrets needed: `CONSUMER_KEY`, `CONSUMER_SECRET`, `ACCESS_TOKEN`, `ACCESS_TOKEN_SECRET`
- State file: `data/last_gold_price.json` records the last successful post and is ignored by the
  deploy workflow to avoid redeploying the site for tweet-state-only commits.
- `data/last_tweet_state.json` stores duplicate/cooldown state plus the latest Shortcut-triggered
  attempt metadata used by the soft anti-spam guard.
- X billing-cap failures (`SpendCapReached`) are treated as a clean skip: the workflow logs the
  reset date, exits `0`, and does not update tweet-state files because no post was sent.
- `post_gold.yml` also passes a temporary `POST_GOLD_RESULT_PATH` into the poster so the Python step
  can write a structured runtime outcome file. The always-on summary step reads that file and adds a
  machine-readable outcome table to `$GITHUB_STEP_SUMMARY`.

**Shortcut safety note**

- The iPhone Shortcut must contain **only one** **Get Contents of URL** action for this workflow
  call.
- Do **not** place the Shortcut inside Repeat / Wait loops.
- Do **not** create an iOS Automation that triggers the Shortcut repeatedly.
- If a flood happens, **disable the `post_gold.yml` workflow immediately**, then disable or revoke
  the Shortcut token before re-enabling the workflow.

### 8a. Gold provider bakeoff & migration (infrastructure only)

The provider-adapter pipeline (`scripts/python/fetch_gold_price.py`,
`scripts/python/provider_bakeoff.py`, `scripts/python/provider_scorecard.py`,
`scripts/python/tweet_guard.py`) and its workflows (`gold-provider-bakeoff.yml`,
`test-gold-providers.yml`) support provider testing and migration. The active provider waterfall
(`gold_api_com → twelvedata_xauusd → fmp_gcusd`) is configured in `gold-price-fetch.yml`.

Before changing providers, fill in the operator checklist:
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

### 9. Sync DB to Git — `sync-db-to-git.yml`

Syncs Supabase shops data to `data/shops.js` and commits the result.

- Secrets needed: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

### 10. CI validation — `ci.yml`

Runs on pull requests. Executes tests, validation, and build checks.

### 11. Deploy — `deploy.yml`

Builds and deploys the site to GitHub Pages on push to `main`.

- Also regenerates `sitemap.xml` and `feed.xml` (see the deploy workflow).

---

## Testing a workflow manually

1. Go to **Actions** tab in your repo
2. Select the workflow
3. Click **Run workflow** → **Run workflow**

This triggers it immediately without waiting for the cron schedule.

---

## Reducing X post frequency (Free tier)

X Free tier allows ~17 posts per 24 hours. To reduce posting frequency, change the market-hours cron
schedules in `post_gold.yml` to run every 2 hours:

```yaml
# Every 2 hours, offset from fetch workflow
- cron: '9 21,23 * * 0'
- cron: '9 1,3,5,7,9,11,13,15,17,19 * * 1-4'
- cron: '9 1,3,5,7,9,11,13,15,17,19 * * 5'
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
