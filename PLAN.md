# Gold Ticker Live — Active Task Plan

> This file is the persistent task tracker for AI agents and human contributors. Agents: read this
> before starting any task. Update it after completing work. Last updated: 2026-05-30

---

## 🔴 In Progress

<!-- Active tasks go here -->

---

## 🟡 Up Next

- [ ] BUILD 1: Live Price Ticker Marquee Bar (partially done via MarketSummaryTicker, needs sticky
      header strip behavior) — priority: high
- [ ] Replace hardcoded hex colors in CSS with design tokens (565 instances across styles/) —
      priority: medium — context: improves maintainability and dark mode consistency
- [ ] Add visibilitychange cleanup to insights.js sparkline/charts if added — priority: low —
      context: prevent stale chart renders
- [ ] Migrate `window.confirm()` in developer.js to a custom modal — priority: low — context: 2
      confirm dialogs for destructive key actions

---

## ✅ Recently Completed

- [x] BUILD 10: Price Alert System — full feature build (alert engine, manager drawer, trigger
      dialog, sound, import/export, WhatsApp share, 18 tests) — completed: 2026-05-30 — PR: (draft)
- [x] Visual excellence session 7b (full-surface interaction rollout) — completed: 2026-05-30 — PR: (pending)
- [x] Audit session 8 — memory leak fixes, alert() removal, lint cleanup, SEO h1 — completed:
      2026-05-30 — PR: (draft open)
- [x] Visual excellence session 7 (global interactions + homepage polish) — completed: 2026-05-30 — PR: #376
- [x] Launch push session 6 (content standardization, learn/insights) — completed: 2026-05-30 — PR: #375

- [x] Deep clean session 3: broken links, invest safe-dom, learn/insights split, cache.getPreference
      — completed: 2026-05-29 — PR: (pending)
- [x] Autonomous cleanup: gold-prices ref sweep, city stub rebuild, invest.js extraction, dead-code
      trim — completed: 2026-05-29 — PR: #371
- [x] Country URL consolidation (~345 pages removed, gold-rate hubs) — completed: 2026-05-29 — PR:
      #370

<!-- Last 10 completed items — older ones get archived -->
<!-- Format: - [x] Task description — completed: YYYY-MM-DD — PR: #NNN -->

---

## 🚫 Blocked / On Hold

<!-- Tasks waiting on external input or decisions -->

---

## 📌 Permanent Context for Agents

- Production site: https://goldtickerlive.com/
- Repo: vctb12/GoldTickerLive
- X account: @GoldTickerLive (hourly posting — treat as production-critical)
- AED peg: 1 USD = 3.6725 AED (fixed — never change)
- Troy ounce: 31.1034768 grams (immutable)
- Primary data source: goldpricez.com API
- Test command: npm test (delete playwright-report/ first)
- Validate command: npm run validate
- PR workflow only — no direct commits to main
- Dry-run any X posting change before merging

## 📋 Audit Notes (2026-05-30)

### ✅ Clean

- No `console.log` debug statements in src/
- No `var` declarations — all code uses `const`/`let`
- All `.then()` chains have `.catch()` error handlers
- All pages have meta description, OG tags, skip links, lang attrs
- `font-display: swap` and `tabular-nums` properly applied
- home.js, tracker-pro.js, invest.js all properly clean up intervals

### ⚠️ Fixed This Session

- **Memory leaks**: insights.js and calculator.js setInterval calls now paused on visibilitychange /
  pagehide
- **alert() calls**: Replaced 4 browser alert() calls with showCopyToast() in developer.js,
  export.js, shops/actions.js
- **Lint warning**: Removed unused `copyWithToast` import in calculator.js
- **SEO**: Added static `<h1>` to learn.html (was previously JS-only rendered)

### ⚠️ Pre-existing (Not Fixed)

- 44 content pages missing webpage-schema (pre-existing test failures)
- 3 pre-existing test failures (provider-failover, cache-revalidation, audit-content-pages)
- 565 hardcoded hex colors in CSS (large effort — tracked in backlog)
- `window.confirm()` used in developer.js for destructive actions (acceptable UX)

## 🏆 Big Build Catalog Status

- [x] BUILD 1: Ticker Strip — done (existing `src/components/ticker.js` + `MarketSummaryTicker.js`)
- [ ] BUILD 2: Country Pages — partial (pages exist, needs Market Intelligence Panel)
- [x] BUILD 3: Price Chart — done (existing `src/components/chart.js` with 24H–ALL ranges)
- [x] BUILD 4: Calculator Tabs — done (5 tabs: value, scrap, zakat, buying power, converter)
- [x] BUILD 5: PWA — done (sw.js, manifest.json, offline.html, install prompt)
- [ ] BUILD 6: Compare Tool — partial (tracker compare mode exists, no standalone page)
- [ ] BUILD 7: Shops Directory — partial (list + filter, needs map, card redesign)
- [ ] BUILD 8: Insights Feed — partial (exists, needs category filter, masonry, search)
- [ ] BUILD 9: Homepage Overhaul — partial (recent polish sessions improved it significantly)
- [x] BUILD 10: Alert System — **done this session** (engine + drawer + dialog + sound + tests)

## Notes for Next Agent

- Alert engine is wired into tracker-pro.js `applyRealtimeSnapshot` — fires on every 90s price tick
- Alert manager drawer CSS is at `styles/components/alert-manager.css` — imported only in
  tracker.html
- New localStorage key `gtl_alerts_v2` — migrates from legacy `gold_price_alerts` automatically
- 18 new tests in `tests/alert-engine.test.js` — all pass
- Next recommended build: BUILD 2 (Country Pages) or BUILD 6 (Compare Tool)
