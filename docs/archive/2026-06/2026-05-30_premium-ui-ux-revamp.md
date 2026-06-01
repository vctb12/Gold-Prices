# Premium UI/UX revamp — 2026-05-30

## Goal

Make Gold Ticker Live feel like a premium, trustworthy financial data product after three cleanup sessions. Focus on visible polish, micro-interactions, and completing half-built UX (shop vs reference, quick convert, copy feedback).

## Scope (this session)

| Area | Deliverable |
| ---- | ----------- |
| Shared | `copy-toast.js`, premium UI CSS tokens/components in `global.css` |
| Homepage | Quick-convert widget, count-up on command metrics + hero karat cells, copy toast |
| Calculator | Shop vs reference comparison panel, karat purity ring, count-up on result |
| Country | Hero price pulse + copy-toast on karat grid |
| i18n | New keys in `translations.js` (EN/AR) + calculator local `T` |
| Docs | This plan + `REVAMP_PLAN.md` checklist |

## Out of scope (follow-up)

- Tracker chart range redesign (already functional)
- Dark mode theme toggle (tokens ready; no toggle UI)
- Bulk country HTML rewrites

## Rollback points

1. Revert `src/lib/copy-toast.js` + global toast CSS — copy buttons fall back to inline ✓
2. Revert homepage quick-convert mount — command center unchanged structurally
3. Revert calculator shop panel HTML/JS — value calc unchanged

## Done checklist

- [x] Shared copy toast + UI component CSS
- [x] Homepage quick convert + smoother price transitions
- [x] Calculator shop vs reference + purity indicator
- [x] Country page hero card hover polish
- [x] `npm run validate`, `npm run build` green; `npm test` 936/938 pass (2 pre-existing failures on main)
- [x] PR opened with proof
