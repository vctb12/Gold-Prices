# Deep clean session 3 — 2026-05-29

```yaml
plan-status: landed
priority: P0
owner: @vctb12
branch: cursor/deep-clean-session3-d417
```

## Decisions

### learn.html vs insights.html — **keep both, differentiate**

| Surface | Role | Primary content |
| ------- | ---- | --------------- |
| `learn.html` | Evergreen **education hub** | Learn-hub article registry (karats, pricing, Zakat, methodology topics) |
| `insights.html` | **Market intelligence** | Live mini price bar, featured analysis, guide grid for GCC buyers |

No merge: URLs are indexed, nav already routes Markets → Insights and Tools → Learn. Merging would lose a clean sitemap slot and blur product-trust boundaries (education vs market context).

Actions taken: tightened meta descriptions, nav labels (`Learn hub` / `Market insights`), cross-link copy on learn related-tools row.

### Service worker precache

All `PRECACHE_URLS` in `sw.js` resolve at repo root (`/`, `tracker.html`, … `404.html`). No stale deleted paths in the v16 list.

## Shipped

- [x] Fix 22 broken internal links (`/content/22k-gold-price-guide/` → `/learn.html#karats`)
- [x] Migrate `src/pages/invest.js` — 11 `innerHTML` sinks → `safe-dom` `el()` / `clear()`; baseline 11 → 0
- [x] Add `cache.getPreference()` (pair to `savePreference`) — fixes `learn.js` runtime on load
- [x] Differentiate learn vs insights SEO/nav copy (EN; AR nav learn label)
- [x] Regenerate `reports/seo/inventory.json`, `reports/seo/governance.json`
- [x] `npm run check-links` — 0 broken
- [x] `npm run validate` + `npm run build` — green

## Deferred

- [ ] CSS purge / dead-rule pass (`global.css`, page CSS) — report-first per REVAMP_PLAN §29 Phase 6
- [ ] Full content `/content/` thin-stub deletion (hub index pages already 301 to learn/calculator)
- [ ] Visual token alignment pass across all content guide heroes (guide-hero vs insights-hero)

## Verification

- `npm run check-links` — PASS
- `npm test` — 936/938 (2 pre-existing: cache boot + provider failover)
- `npm run validate` — PASS
- `npm run build` — PASS
