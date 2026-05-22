# Multi-area polish — 2026-04-30

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

**Branch:** `copilot/gold-ticker-live-multi-area-change`

## Goal

Ship a wide set of small, safe, visible improvements across the full site without touching
price-math, deployment config, the AED peg, or framework architecture. Each commit covers exactly
one bucket. Reviewer can read top-to-bottom.

## Done checklist

### Bucket 1 — chore: scaffold plan

- [x] This document created.

### Bucket 2 — style: CSS token consolidation

- [ ] Audit `styles/global.css` and page CSS for any remaining raw colour/size values that should
      use canonical tokens (`--surface-*`, `--text-*`, `--border-*`, etc.).
- [ ] Remove any duplicate or dead CSS rules found.

### Bucket 3 — feat: shared components / nav / footer

- [ ] Footer: fix hard-coded string(s) not going through translation layer.
- [ ] Nav: verify active-state logic is consistent for all top-level pages.
- [ ] Footer social links: audit for correctness (handle space-in-URL bug if present).

### Bucket 4 — feat: home + hero polish

- [x] Fix broken X/Twitter social link (space in URL → URL-encoded / corrected).
- [x] Improve region-tab aria labels (descriptive `aria-label` on tablist + each tab). _(2026-05-12
      core slice: localized tablist + per-tab aria labels wired in `home.js` / `translations.js`.)_
- [x] Karat-strip copy buttons: ensure `aria-label` values are complete and bilingual. _(2026-05-12
      validation: `home.karatCopyAriaLabel` applied on each update cycle.)_
- [ ] Hero lead copy: tighten wording and trust language.
- [ ] Add `aria-live="polite"` guard where missing (karat strip footer update span).

### Bucket 5 — feat: tracker freshness + states

- [ ] Tracker hero: verify all freshness badge states (live/cached/stale/unavailable) have correct
      accessible text.
- [x] Improve empty/loading state copy for first-time users. _(2026-05-12 core slice: tracker
      planner and karat-table empty/loading strings moved to EN/AR translation keys.)_
- [ ] Ensure "last updated" label is always visible on mobile (not hidden by overflow).

### Bucket 6 — feat: calculator + tools UX

- [x] Add `inputmode="decimal"` to all weight/value numeric inputs for mobile keyboard. _(verified
      in `calculator.html` top-level calculators.)_
- [x] Add `autocomplete="off"` to calculator weight/price inputs (prevent browser autofill).
      _(verified in `calculator.html`.)_
- [ ] Ensure copy button has an accessible label update after copy ("Copied!").
- [ ] Verify scrap-gold payout-rate input has `min`, `max`, `step`, and `aria-label`.

### Bucket 7 — feat: shops directory polish

- [x] Shops search input: add `aria-label` and `autocomplete="off"`. _(already present and
      verified.)_
- [x] Empty-state message: improve copy when no shops match filters. _(2026-05-12 core slice:
      query-aware empty message in `shops.js`.)_
- [ ] Add `lang="ar"` on Arabic text blocks if rendered from JS.

### Bucket 8 — chore: SEO metadata + JSON-LD

- [ ] Verify all top-level pages have `og:image:alt` (shops/learn/methodology).
- [ ] Ensure `insights.html` JSON-LD uses `Article` type, not just BreadcrumbList.
- [ ] Check methodology `og:type` is `article` (already is, confirm).

### Bucket 9 — perf: lazy-load + CLS

- [ ] Image-audit: run `npm run image-audit`, document findings.
- [ ] Verify hero skeleton dimensions prevent CLS on home page.

### Bucket 10 — a11y: focus + ARIA + reduced-motion

- [ ] Verify all interactive elements have visible focus indicators.
- [ ] Check heading order on all main pages (h1 → h2 → h3 flow).
- [ ] Confirm `prefers-reduced-motion` guards are in place for karat-strip animations.

### Bucket 11 — i18n: AR copy + RTL fixes

- [ ] Verify `dir="rtl"` is applied on lang switch for all top-level pages.
- [ ] Check RTL mirroring of chevrons/arrows in nav and cards.
- [ ] Verify Arabic copy in trust banner matches updated English.

### Bucket 12 — chore: docs (REVAMP_PLAN, CHANGELOG)

- [ ] Update `docs/REVAMP_PLAN.md` §27 with this execution log.
- [ ] Update `CHANGELOG.md` with shipped items.

### Bucket 13 — test: regression coverage

- [ ] Add test for X social link URL correctness in `tests/seo-sitewide.test.js`.
- [ ] Add test for `inputmode` on calculator inputs.

### Bucket 14 — chore: cleanup + dead-code removal

- [ ] Remove any commented-out blocks that are clearly no longer relevant.
- [ ] Remove duplicate CSS selectors if found.

## Guardrails

- No price-math changes.
- No `BASE_PATH` / `vite.config.js` base / `CNAME` / SW scope changes.
- No new framework, no new heavy dependency.
- No deleting `countries/**/gold-prices/` URL paths.
- DOM-safety baseline must not regress.
- Bilingual EN + AR for every user-visible string.

## Verification per push

```bash
npm run validate
npm test
npm run quality
npm run build
```

## Final verification

All four of the above plus `npm run check-links` and `npm run seo-audit`.
