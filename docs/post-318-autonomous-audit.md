# Post-318 Autonomous Audit — Fixed in this execution

## Fixed findings

### Batch 1 — hard regressions (links/routes)

- Added missing redirect coverage for removed consolidated pages with both trailing-slash and
  `index.html` variants:
  - `/content/compare-countries/`
  - `/content/todays-best-rates/`
  - `/content/premium-watch/`
  - `/content/news/`
  - `/content/changelog/`
  - `/content/22k-gold-price-guide/`
  - `/content/24k-gold-price-guide/`
- Removed stale post-consolidation references:
  - `PAGE_SHELLS` no longer treats `/content/news/` as a primary Insights surface pattern.
  - Country page hydration compare CTA now routes to `tracker.html#mode=compare` for non-GCC flows.
- Added route-integrity regression tests:
  - Nav data test guards against linking removed consolidated landings.
  - `_redirects` test asserts both canonical and `index.html` redirect mappings remain present.

### Batch 2 — tracker trust UX polish

- Improved tracker freshness/source behavior by adding explicit **closed** source-state handling
  (EN/AR) for badge rendering.
- Added mobile sticky offset hardening by syncing spot-bar runtime height into `--spot-bar-height`
  (used by sticky tracker controls).
- Improved tracker keyboard/focus accessibility for overlays:
  - focus moves into opened overlay,
  - tab key is trapped within overlay dialog controls,
  - focus returns to the original trigger on close.

### Batch 3 — analytics instrumentation minimum map

- Added/standardized tracker events for:
  - mode switch (existing hook preserved),
  - compare actions,
  - export clicks,
  - language toggle consistency (both tracker selector and shell nav toggle).

## Notes

- Pricing integrity constants and AED peg behavior were not changed.
- Canonical host, sitemap generation flow, and PWA routing behavior were not changed in this pass.
