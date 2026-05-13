# Gold Ticker Live — Rebrand Notes

This document records the migration from the old product brand (**Gold Prices** / **GoldPrices** /
**GoldTickerLive** compact form) to the canonical brand **Gold Ticker Live** (compact form:
**GTL**). It is the source of truth for what was changed, what was intentionally kept, and what
manual GitHub actions are needed if the repository itself is renamed.

> Companion file: [`docs/GOLD_TICKER_LIVE_AGENT_PROMPTS.md`](./GOLD_TICKER_LIVE_AGENT_PROMPTS.md)
> includes **Prompt 12 — Rebrand Maintenance Prompt**, which can be re-run any time to verify
> consistency.

## What changed

| Surface                                      | Before                                                | After                                                                                                               |
| -------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Brand identity (full)                        | `GoldPrices`, `GoldTickerLive` (one word)             | **Gold Ticker Live** (three words)                                                                                  |
| Brand identity (compact)                     | `GoldPrices`, `GoldTickerLive`                        | **GTL** (used sparingly, only where space is tight)                                                                 |
| Public site canonical domain                 | `goldtickerlive.com`                                  | `goldtickerlive.com` (unchanged — already on the new domain)                                                        |
| PWA `manifest.json` `name`                   | `GoldPrices — Live Gold Tracker`                      | `Gold Ticker Live — Live Gold Price Tracker`                                                                        |
| PWA `manifest.json` `short_name`             | `GoldPrices`                                          | `Gold Ticker Live`                                                                                                  |
| Service worker cache name                    | `goldprices-v14`                                      | `goldtickerlive-v15` (bumped to invalidate old caches cleanly)                                                      |
| `<title>` brand suffix                       | `… \| GoldPrices` / `… \| GoldTickerLive`             | `… \| Gold Ticker Live`                                                                                             |
| OG / Twitter card titles                     | `… \| GoldPrices` etc.                                | `… \| Gold Ticker Live`                                                                                             |
| OG image `alt` text                          | `GoldTickerLive — live gold price tracker`            | `Gold Ticker Live — live gold price tracker`                                                                        |
| JSON-LD Organization / WebSite `name`        | `GoldTickerLive` / `GoldPrices`                       | `Gold Ticker Live`                                                                                                  |
| `src/seo/seoHead.js` `SITE_NAME`             | `GoldPrices`                                          | `Gold Ticker Live`                                                                                                  |
| `src/seo/metadataGenerator.js` `SITE_NAME`   | `GoldPrices`                                          | `Gold Ticker Live`                                                                                                  |
| `scripts/node/inject-schema.js` `SITE_NAME`  | `GoldTickerLive`                                      | `Gold Ticker Live`                                                                                                  |
| Nav brand label + footer                     | `GoldTickerLive` (compact)                            | `Gold Ticker Live`                                                                                                  |
| Tracker `document.title`                     | `… \| GoldTickerLive`                                 | `… \| Gold Ticker Live`                                                                                             |
| CSV / export brand header                    | `# GoldTickerLive — …`                                | `# Gold Ticker Live — …`                                                                                            |
| Newsletter sender display                    | `Gold Prices Platform`                                | `Gold Ticker Live`                                                                                                  |
| Server log banner                            | `🚀 Gold Prices Platform Server`                      | `🚀 Gold Ticker Live Server`                                                                                        |
| X / Twitter post template                    | `🥇 Gold Prices Today — …`                            | `🥇 Gold Ticker Live — Gold Prices Today, …`                                                                        |
| Discord / Telegram / Spike alerts            | `GoldPrices Bot`, `GoldPrices Alert`, `GoldPrices.io` | `Gold Ticker Live Bot`, `Gold Ticker Live Alert`, `Gold Ticker Live`                                                |
| Uptime check User-Agent                      | `GoldPrices-UptimeMonitor/1.0`                        | `GoldTickerLive-UptimeMonitor/1.0` (no-space identifier preserved as User-Agent token)                              |
| RSS feed `<title>`                           | `GoldPrices — Live Gold Price Updates`                | `Gold Ticker Live — Live Gold Price Updates`                                                                        |
| Privacy / Terms `legal-sub`                  | `… GoldPrices.app …`                                  | `… Gold Ticker Live …`                                                                                              |
| Stub `index.html` files                      | `Not a public page — GoldPrices`                      | `Not a public page — Gold Ticker Live`                                                                              |
| `package.json` `name`                        | `gold-prices`                                         | `gold-ticker-live`                                                                                                  |
| `package-lock.json` `name`                   | `gold-prices`                                         | `gold-ticker-live`                                                                                                  |
| `README.md` H1                               | `# GoldPrices`                                        | `# Gold Ticker Live`                                                                                                |
| `docs/CONTRIBUTING.md` H1                    | `# Contributing to GoldPrices`                        | `# Contributing to Gold Ticker Live`                                                                                |
| `CONTRIBUTING.md` H1 (root)                  | `# Contributing to Gold-Prices`                       | `# Contributing to Gold Ticker Live` (2026-04-30)                                                                   |
| `CONTRIBUTING.md` project description        | `Gold-Prices is a bilingual …`                        | `Gold Ticker Live is a bilingual …` (2026-04-30)                                                                    |
| `docs/replit.md` H1                          | `# GoldPrices`                                        | `# Gold Ticker Live`                                                                                                |
| `docs/TEARDOWN.md` H1 + body                 | `# 🏗️ GoldPrices …`, `**GoldPrices**`                 | `# 🏗️ Gold Ticker Live …`, `**Gold Ticker Live**`                                                                   |
| `docs/AUTOMATIONS.md` H1                     | `# GoldPrices — Automation Setup Guide`               | `# Gold Ticker Live — Automation Setup Guide`                                                                       |
| `assets/og-image.svg` rendered text          | `GoldPrices` + `vctb12.github.io/Gold-Prices`         | `Gold Ticker Live` + `goldtickerlive.com` (verified 2026-04-28)                                                     |
| `admin/social/index.html` post templates     | `goldprices.ae` URLs + `🥇 Gold Prices Today` daily   | `goldtickerlive.com` + `🥇 Gold Ticker Live — Gold Prices Today` (verified 2026-04-28)                              |
| `content/order-gold/index.html` UTM + footer | `utm_source=goldprices`, `goldprices.ae/order`        | `utm_source=goldtickerlive`, `goldtickerlive.com/content/order-gold/` (2026-04-28)                                  |
| `scripts/python/utils/tweet_formatter.py`    | `SITE_URL = "goldprices.ae"`                          | `SITE_URL = "goldtickerlive.com"` (verified 2026-04-28)                                                             |
| Newsletter `RESEND_FROM_EMAIL` defaults      | `newsletter@goldprices.com`                           | `newsletter@goldtickerlive.com` in `scripts/node/send-newsletter.js` and `server/routes/newsletter.js` (2026-04-28) |
| Newsletter workflows `SITE_URL` env          | `https://goldprices.com` (wrong domain)               | `https://goldtickerlive.com` in daily + weekly workflows (2026-04-28)                                               |
| `supabase/schema.sql` header                 | `-- Gold Prices Platform — Supabase Schema`           | `-- Gold Ticker Live — Supabase Schema` (2026-04-28)                                                                |
| `server.js` CORS comment example             | `https://goldtickerlive.com,https://goldprices.com`   | `https://goldtickerlive.com,https://www.goldtickerlive.com` (2026-04-28)                                            |
| `docs/MANUAL_INPUTS.md` CNAME example        | `goldprices.ae`                                       | `goldtickerlive.com` (2026-04-28)                                                                                   |

## What was intentionally **not** changed

These references were left in place for **deployment safety**, **URL stability**, **historical
accuracy**, or **third-party identifier compatibility**. Each entry below is intentional. If
**Prompt 12** flags one of these in a future sweep, do **not** edit it.

| Reference                                                          | Where it appears                                                           | Reason it stays                                                                                                                                                                                                                                                                                            |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `https://github.com/vctb12/Gold-Prices` URL paths                  | `README.md`, `.github/copilot-instructions.md`, history                    | The GitHub repository slug is still `Gold-Prices`. Changing these references silently would create dead links until the repo is actually renamed (see "Manual GitHub steps" below).                                                                                                                        |
| `vctb12.github.io/Gold-Prices/` GitHub Pages URLs                  | `README.md`                                                                | GitHub Pages fallback URL. Lives only if the repo is renamed.                                                                                                                                                                                                                                              |
| `BASE_PATH = '/Gold-Prices/'` mention                              | `src/config/constants.js` comment                                          | Documents the GitHub Pages project-path fallback. Required so future contributors know how to flip the base path if the custom domain ever stops working.                                                                                                                                                  |
| `countries/<country>/<city>/gold-prices/`                          | Filesystem path + URL paths for ~600+ city pages                           | These are indexed SEO routes. Renaming would break canonical URLs, sitemap, and external backlinks.                                                                                                                                                                                                        |
| `countries/<country>/<city>/gold-shops/`                           | Filesystem path + URL paths                                                | Same SEO-stability reason.                                                                                                                                                                                                                                                                                 |
| Topic phrases in copy (descriptive, not brand)                     | `index.html`, `insights.html`, `learn.html`, content guides, country pages | "How Gold Prices Work", "Why UAE Gold Prices Differ from Global Spot", "Gold Prices Today" (H1), "Live Gold Prices" (H2), "UAE Gold Prices" (tool card), city page H1s like "Gold Prices in Abu Dhabi". These are subject-matter labels, not the brand. They stay because the page is _about_ gold prices. |
| H1 / H2 / breadcrumb labels using "Gold Prices"                    | `countries/**/*.html`, `content/**/*.html`                                 | They describe the topic of the page (e.g. `BreadcrumbList` `name: "Gold Prices"`), not the product.                                                                                                                                                                                                        |
| `localStorage` cache key prefixes (`gold_price_*`, `goldprices_*`) | `src/config/constants.js` (`CACHE_KEYS.*`)                                 | Returning users have data under these keys (cached spot prices, alerts, user prefs). Renaming the keys would silently nuke their saved settings. The bumped service-worker cache name (`goldtickerlive-v15`) handles asset-cache invalidation; localStorage stays.                                         |
| Twitter / X handle `@GoldTickerLive`                               | `src/config/translations.js`, social templates                             | The X account handle is owned and registered. Cannot be renamed casually.                                                                                                                                                                                                                                  |
| Uptime-monitor User-Agent `GoldTickerLive-UptimeMonitor/1.0`       | `scripts/node/uptime-check.js`                                             | This is a wire-format identifier; spaces would break header conventions. Acceptable to keep as a single token.                                                                                                                                                                                             |
| Supabase table `gold_prices`                                       | `docs/twitter_bot_schema.md`, `docs/twitter_bot_architecture.md`           | Database table name. Renaming requires a migration, RLS update, and bot redeploy — separate task.                                                                                                                                                                                                          |
| External dataset reference "DataHub Gold Prices"                   | `README.md`                                                                | External third-party dataset name, not ours.                                                                                                                                                                                                                                                               |
| Historical changelog entries / commit messages                     | `CHANGELOG.md`, git history                                                | Historical record. Rewriting history is forbidden by the repo's contribution rules.                                                                                                                                                                                                                        |
| `reports/perf-baseline-2026-04-25.md` mentioning `goldprices-v14`  | `reports/`                                                                 | Historical perf baseline. New baselines should reference `goldtickerlive-v15`.                                                                                                                                                                                                                             |
| `User input: "Live Gold Prices"` quote-style strings               | Examples in `tracker.html`, `index.html` SEO meta                          | Used as a description, e.g. `Gold Ticker Live — Live Gold Prices for GCC & the Arab World`. Kept because it makes the title readable in search results.                                                                                                                                                    |
| `admin/access/index.html` title                                    | `Admin Access — Gold Prices`                                               | → `Admin Access — Gold Ticker Live` (2026-04-30)                                                                                                                                                                                                                                                           |
| `admin/login/index.html` title + tagline                           | `Admin Login — Gold Prices`, `Gold Prices Admin Panel`                     | → `Admin Login — Gold Ticker Live`, `Gold Ticker Live Admin Panel` (2026-04-30)                                                                                                                                                                                                                            |
| `admin/settings/index.html` siteName default + placeholder         | `'Gold Prices'` JS default + `placeholder="Gold Prices"`                   | → `'Gold Ticker Live'` (2026-04-30)                                                                                                                                                                                                                                                                        |
| `admin/analytics/index.html` UI text                               | `Visit your public Gold Prices pages`                                      | → `Visit your public Gold Ticker Live pages` (2026-04-30)                                                                                                                                                                                                                                                  |
| `docs/ARCHITECTURE.md` product description                         | `Gold Prices is a **zero-dependency…`                                      | → `Gold Ticker Live is a **zero-dependency…` (2026-04-30)                                                                                                                                                                                                                                                  |
| `docs/SUPABASE_SCHEMA.md` description                              | `Gold Prices platform roadmap features`                                    | → `Gold Ticker Live roadmap features` (2026-04-30)                                                                                                                                                                                                                                                         |
| `docs/SUPABASE_SETUP.md` description                               | `connect the Gold Prices platform to Supabase`                             | → `connect Gold Ticker Live to Supabase` (2026-04-30)                                                                                                                                                                                                                                                      |
| `docs/ADMIN_SETUP.md` OAuth app example                            | `Gold Prices Admin`                                                        | → `Gold Ticker Live Admin` (2026-04-30)                                                                                                                                                                                                                                                                    |
| `supabase/MASTERY.md` H1                                           | `# Supabase Mastery Guide — Gold-Prices Platform`                          | → `# Supabase Mastery Guide — Gold Ticker Live` (2026-04-30)                                                                                                                                                                                                                                               |
| `supabase/MASTERY.md` JSON example                                 | `"siteName": "Gold Prices"`                                                | → `"siteName": "Gold Ticker Live"` (2026-04-30)                                                                                                                                                                                                                                                            |
| `src/routes/routeRegistry.js` code comment                         | `Gold-Prices platform`                                                     | → `Gold Ticker Live platform` (2026-04-30)                                                                                                                                                                                                                                                                 |
| `pyproject.toml` file header comment                               | `Python tooling config for the Gold-Prices repo.`                          | Intentionally unchanged: "Gold-Prices" here is the GitHub repository slug, same reason as `README.md` GitHub URLs.                                                                                                                                                                                         |
| `scripts/node/seo-audit.js` file comment                           | `across all public HTML pages in the Gold-Prices repository.`              | Intentionally unchanged: repo slug reference. See `README.md` carve-out.                                                                                                                                                                                                                                   |
| `supabase/MASTERY.md` Supabase project hint                        | `search for "Gold-Prices"` (line ~101)                                     | Intentionally unchanged: the Supabase project may be named `Gold-Prices` in the dashboard; changing the hint would confuse the operator.                                                                                                                                                                   |
| `reports/seo-audit.md` example title strings                       | `… \| GoldPrices` in title-length examples                                 | Intentionally unchanged: historical audit report. The underlying HTML files have been updated; the report is a snapshot.                                                                                                                                                                                   |

## Manual GitHub steps if you rename the repository later

If you decide to rename the GitHub repo from `vctb12/Gold-Prices` to `vctb12/Gold-Ticker-Live` (or
similar), **the custom domain `goldtickerlive.com` keeps working unchanged** — but you must walk
through this checklist to keep everything consistent:

1. **Rename the repo** in GitHub → Settings → Repository name. GitHub will set up an HTTP redirect
   from the old name automatically; this covers most external backlinks.
2. **Verify `CNAME`** still contains `goldtickerlive.com`. (It does, and the rename does not touch
   it.)
3. **GitHub Pages settings** → confirm the source branch is still `main`, the custom domain is still
   `goldtickerlive.com`, and HTTPS enforcement is on.
4. **Update README links** that reference `vctb12.github.io/Gold-Prices/...` and
   `github.com/vctb12/Gold-Prices`. They will still redirect, but updating them is cleaner.
5. **Update `.github/copilot-instructions.md`** title line that currently reads
   `# Gold Ticker Live / Gold-Prices — GPT-5.5 Copilot Agent Execution Prompt`. Drop the
   `/ Gold-Prices` part once the repo is renamed.
6. **Update the `BASE_PATH` documentation comment** in `src/config/constants.js` to reference the
   new repo slug as the GitHub Pages fallback.
7. **Update any GitHub Actions workflow that references the repo name explicitly.** As of this
   migration, none do — workflows use `${{ github.repository }}` — but re-grep `.github/workflows/`
   for the old slug to be sure: `grep -rn "Gold-Prices" .github/workflows/`.
8. **Update branch-protection / required-status-checks rule sets** if any reference the old slug.
9. **Notify external integrations** that hard-code the repo URL (Supabase deploy hooks, Vercel
   webhooks, Slack notifiers, etc.). Most do not, but check.
10. **Run a full sweep**: paste **Prompt 12 — Rebrand Maintenance Prompt** from
    `docs/GOLD_TICKER_LIVE_AGENT_PROMPTS.md` into a fresh agent session.

## Manual non-GitHub steps (owner-only)

These are external to this repo. They have no automated migration; the owner must do them
deliberately:

- **Twitter / X account handle:** keep `@GoldTickerLive` if currently registered. If not yet
  claimed, register it before publishing the rebrand more broadly.
- **AdSense / analytics property name:** rename the GA4 / AdSense property label to "Gold Ticker
  Live" so reporting reads correctly. The tracking IDs do not change.
- **Newsletter ESP / Formspree project name:** rename the project label so subscribers see
  consistent branding. Subscribers and lists do not migrate.
- **Search Console property:** if a separate property exists for the old domain, keep it active and
  add a property for `goldtickerlive.com` (verified by DNS). The DNS-verified property is the
  authoritative one.

## Verification after deploy

After this rebrand PR merges to `main` and Pages publishes:

1. Visit `https://goldtickerlive.com/` and confirm:
   - Browser tab title reads "Gold Ticker Live …".
   - Footer brand reads "Gold Ticker Live".
   - PWA install prompt shows "Gold Ticker Live" as the app name.
   - Open the share menu / "Add to Home Screen" in iOS and Android Chrome — both should display
     "Gold Ticker Live".
2. Visit a country page (e.g. `/countries/uae/dubai/gold-prices/`) and confirm:
   - The page title and meta still mention the city + topic correctly.
   - Brand suffix in `<title>` reads `| Gold Ticker Live`.
3. Check service worker:
   - DevTools → Application → Service Workers → `Cache Storage` should show `goldtickerlive-v15` and
     the old `goldprices-v14` should be evicted on next reload (the service worker handles this
     automatically via the version bump).
4. Check the X / Twitter automation:
   - Wait for the next hourly post or run the workflow manually.
   - Confirm the post reads "🥇 Gold Ticker Live — Gold Prices Today, …".
5. Run grep sweeps locally:
   ```bash
   git grep -nI "GoldPrices"
   git grep -nI "GoldTickerLive" | grep -v "@GoldTickerLive\|GoldTickerLive-Uptime"
   git grep -nI "Gold Prices Platform"
   ```
   Each of these should be effectively empty (only intentional carve-outs from the table above).

## Rollback

If something visibly breaks after deploy:

1. Revert the merge commit on `main` (`git revert -m 1 <merge-sha>`) and push.
2. The service worker will continue serving the new `goldtickerlive-v15` cache until the revert
   propagates; users will see the previous brand on next refresh.
3. localStorage is untouched, so user preferences survive the rollback.
4. If only specific surfaces are broken (e.g. the manifest), cherry-pick a fix instead of reverting
   the whole rebrand.

## Verification log

A permanent post-migration QA log lives in
[`docs/REBRAND_VERIFICATION_REPORT.md`](./REBRAND_VERIFICATION_REPORT.md). Append a dated section to
that file every time **Prompt 12** is re-run.

## How to keep this in sync

- Whenever you change a brand surface intentionally, append a row to the **What changed** table.
- Whenever you find an old reference that must stay for a non-obvious reason, append a row to the
  **What was intentionally not changed** table.
- Re-run **Prompt 12** before each major release.
