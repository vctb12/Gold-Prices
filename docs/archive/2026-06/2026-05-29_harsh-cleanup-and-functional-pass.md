# Harsh cleanup, slimming & functional pass — 2026-05-29

```yaml plan-status
status: in-progress
priority: P2
class: A
owner: @vctb12
last_run_at: '2026-05-29'
last_run_pr: 'cursor/harsh-cleanup-functional-pass-ebfb'
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
[`docs/plans/REPO_CLEANUP_PROPOSAL.md`](../../plans/REPO_CLEANUP_PROPOSAL.md) (Phase 1 audit shipped in
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

- [x] Regenerate `reports/seo/governance.json` (stale per validate) — now 706 pages, validate green.
- [x] Regenerate `reports/analytics/event-inventory.json` (stale per validate) — 37 events.

### Bucket C — fully-dead module removal

- [x] `src/utils/slugify.js` (60 lines) — not imported anywhere; all 5 exports (`karatToSlug`,
      `slugToKarat`, `countryCodeToSlug`, `cityToSlug`, `toKebabCase`) have zero references
      repo-wide. Removed the file and its stale annotation in
      `scripts/node/audit-freshness-coverage.js`.

## Documented follow-ups (deliberately NOT touched this PR)

Per the conservative cleanup guardrails ("if in doubt, leave it alone"), these are real slimming
opportunities that need owner judgement because they are **unshipped/authored** rather than dead:

- **`src/learn-hub/` (1265 lines, incl. 41KB authored article content).** A complete article-hub
  system (`article-renderer`, `content-model`, `content-registry`, `toc-renderer`, barrel
  `index.js`) that is **not imported by any page** — `learn.html` ships the simpler
  `src/pages/learn.js` instead. Either wire it into a content hub or remove it; both are owner calls
  on product roadmap.
- **Scattered unused named exports** (verified zero consumers across src/tests/scripts/server/html):
  `learn-hub/*` exports, `lib/export.js::exportCurrentViewCSV`,
  `lib/freshness-pulse.js::FRESHNESS_PULSE_MIN_INTERVAL_MS`, `lib/freshness.js::deriveMarketState`,
  `lib/search.js::matchesQuery`, `pages/shops/filters.js::buildFilterDropdowns`,
  `pages/shops/helpers.js::{detailsConfidenceTier,isDirectShop,loadShortlistFromStorage}`,
  `routes/routeRegistry.js::{ROUTE_PATTERNS,getCountrySlugs,getCitySlugs,getKaratSlugs,resolveRoute}`,
  `seo/metadataGenerator.js::generateMetadata`, `social/postTemplates.js::getTemplate`,
  `utils/routeBuilder.js::generateAllRoutes`. These live in cohesive utility/registry modules whose
  other exports are still consumed; trimming them is safe but should be reviewed module-by-module so
  the intended public API surface isn't accidentally gutted.

## Carve-outs preserved

- Pricing formula, AED peg, troy-ounce constant, karat purity table.
- `STALE_AFTER_MS`, `FX_STALE_AFTER_MS`, `GOLD_REFRESH_MS`, cache/localStorage keys.
- Canonical URLs, `hreflang`, `/Gold-Prices/` compatibility, sitemap generation flow.
- No new dependencies, frameworks, or workflow changes.

## Verification gate (run after every removal)

`npm run lint`, `npm test`, `npm run validate`, `npm run build`.
