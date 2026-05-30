# Session 6 — Launch push

**Date:** 2026-05-30  
**Branch:** `cursor/launch-push-session6-dc3d`

## Goals

- Audit and standardize all `/content/` HTML (meta, schema, shell, RelatedGuides, page-enter)
- Elevate methodology, learn hub, and insights as trust/education surfaces
- Mobile touch targets, overflow guards, error/offline banner primitive
- Maintainer scripts: `audit-content-pages.js`, `check-sw-precache.js`
- CI: wire audits into `npm run validate`

## Done checklist

- [x] `src/lib/content-page-boot.js` + patch 46 content pages
- [x] `scripts/node/audit-content-pages.js` + `check-sw-precache.js`
- [x] Methodology: live formula pipeline, unit table, freshness legend, FAQ + FAQPage schema
- [x] Learn: category catalog, filter, localStorage progress, EN/AR keys
- [x] Insights: market pulse strip (day/YTD/12m), page-updated line
- [x] SW cache bump v17; precache audit in validate
- [x] Tests for audit scripts
- [ ] Full `npm test` + `npm run validate` + `npm run build` (run at PR time)

## Rollback

- Revert content HTML batch via git if boot script causes nav double-mount on any page
- Methodology/live widgets are additive sections — safe to hide via CSS
