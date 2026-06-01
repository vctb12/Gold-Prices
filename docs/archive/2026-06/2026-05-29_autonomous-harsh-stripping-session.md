# Autonomous harsh stripping session — 2026-05-29

```yaml plan-status
status: in-progress
priority: P0
class: A
owner: @vctb12
last_run_at: '2026-05-29'
last_run_pr: 'cursor/harsh-cleanup-functional-pass-ebfb'
last_run_agent: cursor-cloud
slices_remaining_estimate: 0
next_action: 'Verify CI + merge after owner review'
blocked_on: ''
guardrails_reviewed: true
skills_used: [gold-ticker-live-audit, pricing-data-integrity, seo-governance]
```

## Internal execution prompt (agent)

Strip duplicate country/city SEO surfaces (~345 HTML files), consolidate city commercial
URLs on **`/countries/{country}/{city}/gold-rate/`** with live `page-hydrator.js` pricing,
301 legacy paths (`gold-prices`, per-karat slugs), noindex off-strategy root pages, remove verified
dead exports, and record every change in `REVAMP_PLAN.md` + this file. Pricing formula, AED peg,
freshness labels, and canonical host stay untouched.

## Baseline (pre-change)

| Gate            | Result        |
| --------------- | ------------- |
| `npm run lint`  | PASS          |
| `npm test`      | 933/935 pass (2 flaky cache/provider tests) |
| `npm run validate` | PASS (with stale report warnings) |

## Scope — this session

### Phase A — Country page consolidation (game changer)

| Action | Count | Rationale |
| ------ | ----- | --------- |
| Delete per-karat city pages | ~276 | Templated dupes; karat grid lives on city `gold-rate` hub |
| Delete `gold-prices/` city pages | ~69 | Duplicate of `gold-rate`; 301 redirect |
| Regenerate `gold-rate/index.html` | ~69 | Functional hydrated pages, **indexable** (remove erroneous `noindex`) |
| Wildcard `_redirects` | 3 rules | `gold-prices` + `*-karat` → `gold-rate` |

### Phase B — Root / content slimming

| Action | Notes |
| ------ | ----- |
| `invest.html` | `noindex,follow` + shell extraction to `src/pages/invest.js` |
| Off-strategy tools/guides | `noindex` on `investment-return`, `invest-in-gold-gcc` |
| Nav/search links | Point city URLs at `gold-rate` not `gold-prices` |

### Phase C — Code hygiene

| Action | Notes |
| ------ | ----- |
| `build/generatePages.js` | Stop generating karat subpages + `gold-prices`; emit `gold-rate` only |
| `scripts/node/consolidate-country-pages.js` | Repeatable maintainer script |
| Unused named exports | Trim per `2026-05-29_harsh-cleanup` follow-up list |
| `enrich-placeholder-pages.js` | Stop advertising removed URL shapes |

### Carve-outs (never touch)

- `data/gold_price.json`, `post_gold.yml`, `gold-price-fetch.yml`, `sw.js`, `constants.js` peg/oz
- Country **landing** pages with full `country-page.js` experience (`countries/{slug}/index.html`)
- Pricing freshness contract on tracker/home/calculator

## Done checklist

- [ ] `node scripts/node/consolidate-country-pages.js` run + committed
- [ ] `_redirects` wildcard rules added
- [ ] `page-hydrator.js` + `searchIndex.js` + `nav-data` city URLs updated
- [ ] `invest.html` slimmed + noindex
- [ ] `npm test` + `npm run validate` + `npm run build` green
- [ ] `REVAMP_PLAN.md` §29 + `docs/plans/README.md` updated
- [ ] PR opened with proof section

## Rollback

1. Revert branch `cursor/harsh-cleanup-functional-pass-ebfb`
2. Re-run prior `build/generatePages.js` if pages were generated from it
3. Regenerate sitemap: `node scripts/node/generate-sitemap.js`
