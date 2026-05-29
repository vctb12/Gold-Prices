# Harsh cleanup, slimming & functional pass — 2026-05-29

```yaml plan-status
status: in-progress
priority: P2
class: A
owner: @vctb12
last_run_at: '2026-05-29'
last_run_pr: ''
last_run_agent: copilot
slices_remaining_estimate: 0
next_action: ''
blocked_on: ''
guardrails_reviewed: true
skills_used: [gold-ticker-live-audit]
```

## Origin

Captured from the prompt: _"harsh website cleaning … harsh code cleaning … harsh stripping and
slimming … make it fully functional based on the features in it already."_ (2026-05-29). Granted
full autonomy to scope and execute.

This continues the never-executed removal phases of
[`docs/plans/REPO_CLEANUP_PROPOSAL.md`](./REPO_CLEANUP_PROPOSAL.md) (Phase 1 audit shipped in
`reports/cleanup-audit/`, Phases 2–4 were gated and never run).

## Baseline (verified before any change)

- `npm run lint` → PASS
- `npm test` → PASS (908/908)
- `npm run validate` → PASS (2 non-blocking stale-report warnings: seo-governance,
  analytics-inventory)

## Scope (this PR)

Safe, reviewable slimming + report hygiene. No public URL removed, no pricing/freshness/canonical
change, no new dependency.

### Bucket A — dead module removal (verified orphans)

Each below has **zero static imports, zero test references**, and is only mentioned in stale docs
(`REFACTORING_SUMMARY.md`, agent-prompt archives). They are extracted-but-never-wired leftovers from
a prior refactor. `dom-builders.js` / `dropdown-builders.js` are dead **duplicates** — the live code
(`tracker/hero.js`, `components/nav.js`) re-defines those helpers inline.

- [x] `src/components/MarketSummaryTicker.js` (215 lines)
- [x] `src/components/internalLinks.js` (86)
- [x] `src/components/nav/dropdown-builders.js` (80)
- [x] `src/lib/freshness-manager.js` (206)
- [x] `src/pages/calculator/value-calculator.js` (54)
- [x] `src/tracker/dom-builders.js` (164)
- [x] `REFACTORING_SUMMARY.md` (root) — stale one-off summary, unreferenced, describes the
      now-removed modules.

### Feature fix — make an existing-but-broken feature functional

- [x] `initSwUpdateToast()` was **called** in `src/pages/home.js` after SW registration but **never
      imported**, so the PWA "Update available — refresh" toast was a silent `ReferenceError`
      swallowed by `.catch()`. The SW already broadcasts `SW_UPDATED` (`sw.js`). Added the missing
      import and a regression suite (`tests/sw-update-toast.test.js`, 6 tests).

### Bucket B — report hygiene

- [x] Regenerate `reports/seo/governance.json` (stale per validate).
- [x] Regenerate `reports/analytics/event-inventory.json` (stale per validate).
- [x] Refresh `reports/cleanup-audit/` so the audit reflects current HEAD.

### Bucket C — dead exports inside live files

- [x] Run knip-style unused-export sweep on `src/`; remove safe dead exports flagged with zero
      consumers (excluding defensive `safe-dom.js` / `cache.js` fallbacks).

## Carve-outs preserved

- Pricing formula, AED peg, troy-ounce constant, karat purity table.
- `STALE_AFTER_MS`, `FX_STALE_AFTER_MS`, `GOLD_REFRESH_MS`, cache/localStorage keys.
- Canonical URLs, `hreflang`, `/Gold-Prices/` compatibility, sitemap generation flow.
- No new dependencies, frameworks, or workflow changes.

## Verification gate (run after every removal)

`npm run lint`, `npm test`, `npm run validate`, `npm run build`.
