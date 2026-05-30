# Gold Ticker Live — Active Task Plan

> This file is the persistent task tracker for AI agents and human contributors. Agents: read this
> before starting any task. Update it after completing work. Last updated: 2026-05-30

---

## 🔴 In Progress

<!-- Active tasks go here -->

---

## 🟡 Up Next

- [ ] Replace hardcoded hex colors in CSS with design tokens (565 instances across styles/) —
      priority: medium — context: improves maintainability and dark mode consistency
- [ ] Add visibilitychange cleanup to insights.js sparkline/charts if added — priority: low —
      context: prevent stale chart renders
- [ ] Migrate `window.confirm()` in developer.js to a custom modal — priority: low — context: 2
      confirm dialogs for destructive key actions

---

## ✅ Recently Completed

- [x] Audit session 8 — memory leak fixes, alert() removal, lint cleanup, SEO h1 — completed:
      2026-05-30 — PR: (draft open)
- [x] Visual excellence session 7 (global interactions + homepage polish) — completed: 2026-05-30 —
      PR: (draft open)
- [x] Launch push session 6 (content standardization, learn/insights) — completed: 2026-05-30 — PR:
      #375

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
- 1 provider-failover test failure (pre-existing)
- 565 hardcoded hex colors in CSS (large effort — tracked in backlog)
- `window.confirm()` used in developer.js for destructive actions (acceptable UX)
