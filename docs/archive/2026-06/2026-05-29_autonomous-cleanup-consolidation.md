# Autonomous cleanup & consolidation — 2026-05-29

```yaml plan-status
status: landed
priority: P0
class: A
owner: @vctb12
last_run_at: '2026-05-29'
last_run_pr: 'cursor/autonomous-cleanup-consolidation-fda4'
last_run_agent: cursor-cloud
slices_remaining_estimate: 3
next_action: 'learn/insights overlap merge; wire content/ robots audit; migrate invest innerHTML to safe-dom'
blocked_on: ''
guardrails_reviewed: true
```

## Scope (this PR)

### Stale URL hygiene (post country consolidation)

- [x] `countries/country-page.js` city cards → `gold-rate/`
- [x] `src/seo/metadataGenerator.js` breadcrumb → `gold-rate/`
- [x] `scripts/node/enrich-placeholder-pages.js` stub builder → `gold-rate/`
- [x] `build/generatePages.js` generator → `gold-rate/` paths
- [x] `src/routes/routeRegistry.js` resolves `gold-rate` (+ legacy `gold-prices` alias)

### City hub stubs (69 pages)

- [x] `scripts/node/patch-city-stub-pages.js` — rebuild stubs with two links (rate + shops), shared CSS
- [x] `countries/stub-city.css` — extract inline styles
- [x] Deduped misleading duplicate gold-rate links and removed “per-karat page” copy

### invest.html slimming

- [x] Extract ~1,160 lines inline module → `src/pages/invest.js`
- [x] `invest.html` 1,575 → 413 lines; SW update toast wired like home
- [x] DOM-safety baseline entry for moved sinks (11, static I18N only)

### Dead code

- [x] Remove `src/lib/search.js` (orphan)
- [x] Trim unused exports: `deriveMarketState`, `exportCurrentViewCSV`, `buildFilterDropdowns`, shops helper dead fns
- [x] Tighten `shops/filters.js` DOM baseline 4 → 0

### Reports

- [x] Regenerate `reports/seo/inventory.json`, `reports/seo/governance.json`, analytics inventory

## Deferred (follow-up PRs)

- [ ] `learn.html` / `insights.html` overlap merge (product decision)
- [ ] Migrate `src/pages/invest.js` innerHTML blocks to `safe-dom` (baseline allows 11 today)
- [ ] Content `/content/` thin stubs — robots/canonical audit pass
- [ ] Optional: 301 city index → gold-rate (blocked on preserving gold-shops hub path without wildcard collisions on `cities/` index pages)

## Verification

- `npm run lint` — PASS
- `npm test` — 936/938 pass (2 pre-existing flaky cache/provider tests)
- `npm run validate` — PASS
- `npm run build` — PASS
