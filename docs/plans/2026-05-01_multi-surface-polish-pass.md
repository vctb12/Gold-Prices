# Multi-surface polish pass — 2026-05-01

```yaml plan-status
status: not-started
priority: P2
class: B
owner: @vctb12
last_run_at: ""
last_run_pr: ""
last_run_agent: copilot
slices_remaining_estimate: 0
next_action: ""
blocked_on: ""
guardrails_reviewed: true
skills_used: []
```

**Branch:** `copilot/select-gold-ticker-prompts`

## Goal

Ship one coherent polish PR across the homepage, live tracker, shared breadcrumbs, and shared footer
trust language without touching pricing math, freshness thresholds, cache keys, deployment settings,
or canonical URL structure.

## Surfaces in scope

- `index.html`
- `tracker.html`
- `src/pages/home.js`
- `src/pages/tracker-pro.js`
- `src/tracker/render.js`
- `src/components/breadcrumbs.js`
- `src/components/footer.js`
- `src/config/translations.js`
- `styles/pages/home.css`
- `styles/pages/tracker-pro.css`
- `styles/global.css`
- `docs/REVAMP_PLAN.md`

## Buckets

### Bucket 1 — docs / cleanup

- [x] Add this plan file.
- [x] Keep the working tree clear of new accidental generated-file drift before shipping product
      changes.

### Bucket 2 — homepage trust + search polish

- [x] Tighten hero copy and CTA wording for trust and next-step clarity.
- [x] Move live-region emphasis to freshness text instead of the whole hero card.
- [x] Improve country-search empty-state messaging with query-aware copy.
- [x] Keep karat-strip and hero freshness labels visible on mobile.

### Bucket 3 — tracker clarity + bilingual static copy

- [x] Correct tracker trust/source wording so spot and FX sources are clearly distinguished.
- [x] Localize tracker static hero, toolbar, quick-tools, countdown, and offline-banner copy.
- [x] Improve unavailable/cached/stale freshness wording without changing thresholds or math.
- [x] Keep tracker controls and freshness badges legible at 320–414 px.

### Bucket 4 — shared navigation surfaces

- [x] Localize breadcrumb labels and aria text from the current page language.
- [x] Improve footer freshness wording and accessibility labels.

### Bucket 5 — verification + docs

- [x] Update `docs/REVAMP_PLAN.md` with this execution pass.
- [x] Run `npm test`, `npm run lint`, `npm run validate`, `npm run build`, `npm run check-links`,
      and `npm run quality`.
- [x] Refresh `reports/seo/inventory.json` so `inventory-seo --check` passes after the touched HTML
      and translation surfaces changed.
- [x] Note that `npm run quality` still fails on unrelated repo-wide Prettier drift in 22 untouched
      files (for example `AGENTS.md`, `README.md`, `src/lib/analytics.js`, and
      `src/pages/shops/actions.js`).

## Carve-outs preserved

- Pricing formula, AED peg, troy-ounce constant, karat purity table
- `STALE_AFTER_MS`, `FX_STALE_AFTER_MS`, `GOLD_REFRESH_MS`
- Existing cache / localStorage keys
- Canonical URLs, `hreflang`, `/Gold-Prices/` compatibility
- No new dependencies, frameworks, or workflow changes
