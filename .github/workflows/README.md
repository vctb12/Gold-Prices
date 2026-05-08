# GitHub Actions workflows

This directory holds every CI / ops / content workflow for the repo.
Each workflow file starts with a standard classification header so
contributors can tell at a glance whether the workflow is a blocking
merge gate or informational. Four tiers are in use:

## Status badges

| Workflow | Status |
| -------- | ------ |
| CI | [![CI](https://github.com/vctb12/GoldTickerLive/actions/workflows/ci.yml/badge.svg)](https://github.com/vctb12/GoldTickerLive/actions/workflows/ci.yml) |
| Deploy to GitHub Pages | [![Deploy](https://github.com/vctb12/GoldTickerLive/actions/workflows/deploy.yml/badge.svg)](https://github.com/vctb12/GoldTickerLive/actions/workflows/deploy.yml) |
| CodeQL Advanced | [![CodeQL](https://github.com/vctb12/GoldTickerLive/actions/workflows/codeql.yml/badge.svg)](https://github.com/vctb12/GoldTickerLive/actions/workflows/codeql.yml) |
| Gold Price Fetch | [![Gold Price Fetch](https://github.com/vctb12/GoldTickerLive/actions/workflows/gold-price-fetch.yml/badge.svg)](https://github.com/vctb12/GoldTickerLive/actions/workflows/gold-price-fetch.yml) |
| Post Gold Price to X | [![Post Gold](https://github.com/vctb12/GoldTickerLive/actions/workflows/post_gold.yml/badge.svg)](https://github.com/vctb12/GoldTickerLive/actions/workflows/post_gold.yml) |
| Daily Health Check | [![Health Check](https://github.com/vctb12/GoldTickerLive/actions/workflows/health_check.yml/badge.svg)](https://github.com/vctb12/GoldTickerLive/actions/workflows/health_check.yml) |
| Uptime Monitor | [![Uptime](https://github.com/vctb12/GoldTickerLive/actions/workflows/uptime-monitor.yml/badge.svg)](https://github.com/vctb12/GoldTickerLive/actions/workflows/uptime-monitor.yml) |
| Spike Alert | [![Spike Alert](https://github.com/vctb12/GoldTickerLive/actions/workflows/spike_alert.yml/badge.svg)](https://github.com/vctb12/GoldTickerLive/actions/workflows/spike_alert.yml) |
| Daily Newsletter | [![Daily Newsletter](https://github.com/vctb12/GoldTickerLive/actions/workflows/daily-newsletter.yml/badge.svg)](https://github.com/vctb12/GoldTickerLive/actions/workflows/daily-newsletter.yml) |
| Weekly Newsletter | [![Weekly Newsletter](https://github.com/vctb12/GoldTickerLive/actions/workflows/weekly-newsletter.yml/badge.svg)](https://github.com/vctb12/GoldTickerLive/actions/workflows/weekly-newsletter.yml) |

## Tier 1 — Required merge gates

Must be green for a PR to merge. Failures here block the PR.

| File | What it protects |
| ---- | ---- |
| `ci.yml` | lint, unit tests, `npm run validate`, production build, Playwright smoke |

## Tier 2 — Informational scans

Run on every push/PR, surface findings to the Security tab or as logs,
but do **not** block merges. Promote a check here to Tier 1 by moving
its step into `ci.yml` after it has been stable for a while.

| File | What it reports |
| ---- | ---- |
| `codeql.yml` | CodeQL static analysis (JS/TS), findings in Security tab |
| `perf-check.yml` | Playwright + image-audit, visibility only (uses `\|\| true`) |
| `lighthouse.yml` | Manual-only Lighthouse CI run (`workflow_dispatch`); uploads `.lighthouseci/` artifact |

## Tier 3 — Production deploy

Not a merge gate — runs after merge to publish the site.

| File | Trigger |
| ---- | ---- |
| `deploy.yml` | Push to `main` publishes `dist/` to GitHub Pages |

## Tier 4 — Scheduled operational / content jobs

Periodic bots. Failures here are visible in the Actions tab but do not
affect any PR. Most carry `contents: write` scope on a single job to
commit derived data; others only read and post to external APIs.

| File | Cadence | Effect |
| ---- | ---- | ---- |
| `health_check.yml` | daily at 04:00 UTC | smoke-tests public URLs + upstream APIs |
| `uptime-monitor.yml` | every 30 min | pings live site, reports failures |
| `spike_alert.yml` | every 15 min | detects price spikes, posts alerts |
| `post_gold.yml` | hourly while markets are open (Sun 21:00–Fri 20:59 UTC) + manual dispatch | posts from cached `data/gold_price.json` to X after duplicate/stale/cooldown/length guards |
| `gold-price-fetch.yml` | hourly while markets are open (Sun 21:00–Fri 20:59 UTC) + manual dispatch | single production provider-call path; updates `data/gold_price.json` for `post_gold.yml` |
| `daily-newsletter.yml` | daily at 03:00 UTC | generates + dispatches daily digest |
| `weekly-newsletter.yml` | weekly Sun at 14:00 UTC | generates + dispatches weekly digest |
| `sync-db-to-git.yml` | `repository_dispatch: sync-shops` | syncs admin DB to `data/shops.js` |

## Conventions

- Every workflow uses `actions/checkout@<sha> # v6` and `actions/setup-node@<sha> # v6`
  with `node-version: 24` and `cache: npm`. **All third-party actions must be pinned to
  a full commit SHA** (not a tag or branch) with the version as a comment.
  Run `gh-advisory-database` before adding a new action. Match the existing pattern when
  adding a new workflow.
- Every workflow declares `permissions: contents: read` at the top
  level. Jobs that must commit elevate with a per-job
  `permissions: contents: write`. Stay least-privilege.
- Every workflow has a `timeout-minutes:` on its jobs to prevent a
  runaway run from burning minutes. Default to 20 minutes.
- Workflows that can overlap (CI on the same PR, deploy of `main`,
  any scheduled bot) set a `concurrency:` group with
  `cancel-in-progress: true` for PR-scoped groups and `false` for
  serialized production jobs (e.g. `deploy.yml`, `sync-db-to-git.yml`).
- Tier-2 informational workflows may end with `|| true` to avoid
  surfacing noisy failures as merge-blocking red X marks. Tier-1
  `ci.yml` never does.

## How to classify a new workflow

Add a top-of-file comment block like this, then update the table
above:

```yaml
# ------------------------------------------------------------------
# <Workflow name> — <one-line purpose>.
# <Short explanation of trigger / cadence / side effects>.
# Tier: <merge gate | informational scan | production deploy | content / sync bot>
# ------------------------------------------------------------------
name: <Workflow name>
```

## SHA pinning reference

The table below records the pinned SHAs in use. When you bump an action,
update this table and every workflow that references it.

| Action | Version | SHA |
| ------ | ------- | --- |
| `actions/checkout` | v6 | `de0fac2e4500dabe0009e67214ff5f5447ce83dd` |
| `actions/setup-node` | v6 | `48b55a011bda9f5d6aeb4c2d9c7362e8dae4041e` |
| `actions/setup-python` | v6 | `a309ff8b426b58ec0e2a45f0f869d46889d02405` |
| `actions/cache` | v5 | `27d5ce7f107fe9357f9df03efb73ab90386fccae` |
| `actions/upload-artifact` | v7 | `043fb46d1a93c77aae656e7c1c64a875d1fc6a0a` |
| `actions/upload-pages-artifact` | v5 | `fc324d3547104276b827a68afc52ff2a11cc49c9` |
| `actions/deploy-pages` | v5 | `cd2ce8fcbc39b97be8ca5fce6e763baed58fa128` |
| `github/codeql-action` | v4 | `95e58e9a2cdfd71adc6e0353d5c52f41a045d225` |
| `stefanzweifel/git-auto-commit-action` | v7 | `04702edda442b2e678b25b537cec683a1493fcb9` |
