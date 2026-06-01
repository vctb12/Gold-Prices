# Appendix B — GitHub Actions & CI Gate Catalog

> Parent: [`GOLD_TICKER_LIVE_MASTER_WORKBOOK.md`](../GOLD_TICKER_LIVE_MASTER_WORKBOOK.md)  
> Debug failures: `@.github/prompts/workflow-debug.prompt.md`

## B.1 Production-critical workflows

| Workflow | Schedule (UTC) | Purpose | Touch policy |
| -------- | -------------- | ------- | ------------ |
| `gold-price-fetch.yml` | Hourly :02 (market hours) | Fetch → commit `data/gold_price.json` | **Owner only** |
| `post_gold.yml` | Hourly :09 (market hours) | Read JSON → post @GoldTickerLive | **Owner only** |
| `deploy.yml` | Push `main` | Vite build → GitHub Pages | Careful — site down if broken |

### Dry-run discipline

```bash
# Always workflow_dispatch with dry_run when available — read workflow inputs first
gh workflow run gold-price-fetch.yml -f dry_run=true
gh workflow run post_gold.yml -f dry_run=true
```

## B.2 Quality gates (`ci.yml`)

Typical PR pipeline (verify locally with `npm run validate`):

| Step | Script | What it enforces |
| ---- | ------ | ---------------- |
| Tests | `npm test` | 115 `tests/*.test.js` suites |
| Lint | `npm run lint` | ESLint flat config |
| Validate bundle | `npm run validate` | See B.3 |
| Build | `npm run build` | extract-baseline → shops → learn fallback → schema → sitemap → vite |

## B.3 `npm run validate` decomposition

Run individually when debugging:

| Command | Enforces |
| ------- | -------- |
| `node scripts/node/validate-build.js` | Build artifacts integrity |
| `npm run check-unsafe-dom` | Per-file innerHTML baseline |
| `npm run check-shell-guard` | Shared nav/footer contract |
| `npm run check-basic-a11y` | Basic a11y gate |
| `node scripts/node/check-seo-meta.js` | canonical, hreflang, titles, descriptions |
| `node scripts/node/check-sw-coverage.js` | SW vs built assets |
| `npm run check-sw-precache` | Precache list sanity |
| `npm run audit-content-pages` | Content page schema contract |
| `enrich-placeholder-pages --check` | No placeholder leaks |
| `externalize-analytics --check` | Analytics externalization |
| `inventory-seo --check` | SEO inventory |
| `seo-governance --check` | Governance rules |
| `export-analytics-inventory --check` | Event catalog parity |
| `inject-schema --check` | JSON-LD injection drift |

## B.4 Monitoring workflows

| Workflow | Cadence | Action on fail |
| -------- | ------- | -------------- |
| `uptime-monitor.yml` | 30 min | Page down alert |
| `spike_alert.yml` | 15 min | >2% move alert |
| `health_check.yml` | periodic | API health |
| `check-alerts.yml` | periodic | User alert subscriptions |

## B.5 Data sync & newsletters

| Workflow | Notes |
| -------- | ----- |
| `sync-db-to-git.yml` | Supabase shops → `data/shops.js` |
| `daily-newsletter.yml` / `weekly-newsletter.yml` | Content generation |
| `generate-sitemap.yml` | May overlap build sitemap — know which is canonical |

## B.6 Security & perf

| Workflow | Notes |
| -------- | ----- |
| `codeql.yml` | Security scanning |
| `perf-check.yml` / `lighthouse.yml` | Regression budgets |
| `gold-provider-bakeoff.yml` | Long-running — never in UX PR |
| `pr-provider-smoke.yml` | PRs touching provider code |

## B.7 Python workflow rules

- Pin: `scripts/python/requirements.txt`
- Import path: add `scripts/python/` to `sys.path`; `from utils.*`
- CI Python version: aligned to 3.11 across poster workflows

## B.8 When CI fails — workbook protocol

1. Identify job name + step from GitHub Actions UI
2. Reproduce locally (table B.3)
3. If workflow-only: `@.github/prompts/workflow-debug.prompt.md`
4. If code: fix minimal; do not disable gate without owner approval
5. Log in PR **Proof** section
