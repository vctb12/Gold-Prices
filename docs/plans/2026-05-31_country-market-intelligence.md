# Country Pages — Market Intelligence Panel (BUILD 2) — 2026-05-31

```yaml plan-status
status: complete
priority: P1
class: A
owner: @vctb12
last_run_at: "2026-05-31"
last_run_pr: ""
last_run_agent: copilot
slices_remaining_estimate: 0
next_action: "Start BUILD 6 — standalone Compare Countries tool"
blocked_on: ""
guardrails_reviewed: true
skills_used: []
```

## Goal

Transform templated country gold-price pages into richer buyer destinations by adding a Market
Intelligence Panel and a "Should I Buy Today?" indicator (Big Build Catalog — BUILD 2).

## Scope (this session)

| Area       | Deliverable                                                                                                                                                 |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Config     | `src/config/market-intel.js` — per-country VAT, making charges, karat preferences, bilingual market notes (28 countries + generic fallback)                 |
| Country JS | `countries/country-page.js` — Market Intelligence Panel render, retail estimate, "Should I Buy Today?" indicator, daily snapshot persistence, EN/AR strings |
| CSS        | Market Intelligence styles appended to `styles/country-page.css` (design tokens, RTL, dark mode, reduced-motion, 44px CTA)                                  |
| Tests      | `tests/market-intel.test.js` — config completeness + fallback                                                                                               |
| Docs       | This plan, `PLAN.md`, `CHANGELOG.md`                                                                                                                        |

## What was built

- **Market Intelligence Panel** (sticky-feeling card inserted after the hero on every country page):
  current 22K/gram local price, 24h change, country VAT/sales-tax rate with a short note, typical
  making-charge range, a live **retail estimate** = `gram × (1 + median making%) × (1 + VAT)`,
  popular karats, and a one-line market note.
- **"Should I Buy Today?" indicator**: compares the live price to the rolling 7-day average from
  local `gtl_history` snapshots — 🟢 below / 🔴 above / ⚪ normal (±0.5% band), with a pending state
  until ≥3 daily snapshots exist. Always labelled "reference only, not financial advice".
- Panel mounts via `ensureMarketIntelMount()` so all ~21 country HTML files pick it up with no
  per-file edits; `renderMarketIntel()` is idempotent and re-runs on language toggle / 90s refresh.
- A "Open calculator →" CTA deep-links to `/calculator.html?currency=<CCY>` (currency param honoured
  by the calculator's `applyUrlPreset`).

## Verification

- `npm run lint` — 0 errors (4 pre-existing warnings unrelated to this change).
- `npm run build` — green.
- `npm test` — 959 pass / 3 pre-existing failures (audit-content-pages, cache-revalidation,
  provider-failover) unchanged by this work; 4 new market-intel tests pass.
- Manual Playwright check (dev server): panel renders in correct position, retail estimate computes,
  buy indicator pending state shows, and full RTL mirror verified in Arabic.

## Rollback

- Additive only. Remove the `cp-mi-*` CSS block, revert `countries/country-page.js`, and delete
  `src/config/market-intel.js` + `tests/market-intel.test.js`. No pricing-formula or workflow
  changes; the AED peg (3.6725) and 90s refresh are untouched.

## Next recommended build

- **BUILD 6 — Compare Countries tool**: a standalone sortable/filterable comparison table with a
  side-by-side detail panel and a "cheapest to buy" callout. The new `market-intel.js` config (VAT +
  making charges) can feed its columns directly.
