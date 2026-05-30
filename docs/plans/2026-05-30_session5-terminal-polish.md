# Session 5 — Terminal polish & cross-surface cohesion

**Date:** 2026-05-30  
**Branch:** `cursor/session5-terminal-polish-09de`

## Scope (shipping this session)

### Tracker — Bloomberg terminal feel
- [x] Karat/unit keyboard cycling (`K`, `U`) + copy spot (`Shift+C`) via shared `copy-toast`
- [x] Currency selector shows GCC flags; units extended to gram / oz / tola / kg with animated `countUp`
- [x] Hero stats update in-place with `countUp` (no full DOM rebuild on tick)
- [x] Price-change strip (day open vs spot) in hero
- [x] Chart range pill label `1D` (data-range `24H` unchanged for data layer)
- [x] Terminal CSS: tabular nums, market pulse, range pill polish

### Shops — directory trust
- [x] Copy shop details action
- [x] City-grouped results toggle
- [x] Sort: relevance (default), A–Z, city, specialty count
- [x] Filter option counts in dropdowns
- [x] City gold-rate page links where slug exists

### Design system & polish
- [x] `.badge` component family in `global.css`
- [x] `page-enter` fade on `DOMContentLoaded`
- [x] `lazy-section.js` for below-fold deferral
- [x] `RelatedGuides` footer block for content pages (guides index + key guides)

### Deferred (documented, not blocking)
- Full content stub audit / noindex sweep (252+ pages — separate PR)
- Service worker precache full regen (touched only if broken paths found)
- Server-backed alerts UI (keep education overlay; hide broken server CTA when unavailable)

## Verification

```bash
export JWT_SECRET="dev-secret-key-for-local-development-32chars"
export ADMIN_PASSWORD="admin-dev-password"
export ADMIN_ACCESS_PIN="123456"
npm test
npm run validate
npm run build
```

## Rollback

Revert branch; tracker/shops changes are isolated to listed files.
