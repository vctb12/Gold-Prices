# Appendix D — Session Execution Guides (step-by-step)

> Parent: [`GOLD_TICKER_LIVE_MASTER_WORKBOOK.md`](../GOLD_TICKER_LIVE_MASTER_WORKBOOK.md)  
> Log outcomes in [`WORKBOOK_SESSION_REGISTRY.md`](./WORKBOOK_SESSION_REGISTRY.md)

Each guide: **pre-flight → steps → acceptance → verify → PR template**.

---

## D.1 WB-102 — Cross-page deep links

### Pre-flight

- [ ] On `main`; UI/UX sessions 0–5 merged
- [ ] Read [Appendix A](./APPENDIX_A_SURFACE_PLAYBOOKS.md) §A.1, §A.2, §A.3

### Steps

1. **Inventory links** — grep `href=` from `home.js`, `tracker-pro.js`, `calculator.js`, `shops.js`, `nav-data.js`
2. **Home → Tracker** — ensure hash carries karat/unit/currency (document format in PR)
3. **Tracker → Calculator** — inline calc link + full page link
4. **Calculator → Shops** — CTA with honest copy key in `translations.js` EN+AR
5. **Shops → city** — sample 5 cities; fix 404s or `_redirects`
6. **Related guides** — spot-check 10 `content/` links from insights/learn
7. **Language toggle** — same path on EN↔AR for changed pages

### Acceptance

- All new links return 200 (or valid redirect)
- No new hardcoded English
- No pricing formula changes

### Verify

`npm test`, `npm run validate`, `npm run build`; optional `npm run check-links`

### PR risks

Hash contract changes break bookmarks — document in Risks

---

## D.2 WB-101 — GDPR export/delete (dashboard UX)

### Pre-flight

- [ ] Read `server/routes/public-accounts.js` export/delete handlers
- [ ] Read `src/pages/dashboard.js` — may already partial

### Steps

1. Confirm API: `GET /api/v1/me/export`, `DELETE /api/v1/me` behavior + tests in `tests/public-accounts-api.test.js`
2. If UI missing: add Export + Delete buttons with confirm modal (not `window.confirm` on public pages — use pattern from developer or custom modal)
3. EN+AR strings: `dashboard.export*`, `dashboard.delete*`
4. Delete: clear localStorage keys documented in PR
5. Update `docs/PUBLIC_ACCOUNTS_AND_SAVED_TOOLS.md`

### Acceptance

- Logged-in user can export JSON download
- Delete requires explicit confirm; redirects to home or account signed-out
- Tests updated/added

### Verify

`npm test` with JWT env vars; manual curl if needed

---

## D.3 WB-201 — Noindex stub karat pages

### Pre-flight

- [ ] Read `docs/audits/PAGE_CLEANUP_AND_PRODUCT_FOCUS.md`
- [ ] Read `scripts/node/inventory-seo.js`

### Steps

1. Write `docs/plans/YYYY-MM-DD_noindex-karat-stubs.md` (if not exists) with counts
2. Add `<meta name="robots" content="noindex,follow">` to template or generator for per-karat city pages
3. Update sitemap generator to exclude noindex URLs
4. Run `inventory-seo --check` and sitemap tests

### Acceptance

- ~400 URLs noindex (per audit estimate)
- Sitemap entry count drops; validate green
- **No content deletion** in this PR

### Verify

`npm test` — `tests/sitemap.test.js`, `tests/inventory-seo.test.js`, `npm run validate`

---

## D.4 WB-301 — BUILD 7 shops map

### Pre-flight

- [ ] `PLAN.md` BUILD 7 notes; `tests/shops-compare.test.js`

### Steps

1. Verify Leaflet lazy load path in `shops.js`
2. Pin only shops with lat/lng; honest empty map state
3. Compare bar: max 3, persistence note in PR
4. Card redesign: tokens only; `card-interactive`
5. Filter counts match loaded set

### Acceptance

- Map works when CDN loads; list works when not
- EN+AR for new strings
- Compare tests green

---

## D.5 WB-302 — BUILD 9 homepage hero

### Pre-flight

- [ ] Session 4 declutter merged; read `index.html` structure

### Steps

1. Reduce to 5 sections: Hero | Karats | GCC | Tools | FAQ (per program B2)
2. One hero price + market status + direction
3. Optional sparkline only if data honest (cached labeled)
4. Remove duplicate snapshot/command blocks
5. RTL + 360 pass

### Acceptance

- Lighthouse mobile not regressed (note baseline in PR)
- `home-hero-loading` tests green

---

## D.6 WB-501 — Docs archive (C1a)

### Steps

1. Create `docs/archive/2026-06/`
2. Move **only** landed plans listed in `ARCHIVE_AND_SUPERSESSION_INDEX` Tier 1 landed
3. Leave stub in `docs/plans/README.md` → archived path
4. Fix broken relative links (`rg` on `docs/`)

### Acceptance

- No broken links from `docs/README.md`
- **No** code or URL changes

---

## D.7 WB-801 — Freshness label sweep (∞)

### Steps

1. Run scanner S5 from workbook Part 8
2. Pick first surface with price but missing `freshness` component
3. Wire existing freshness strip pattern
4. Add test if `tests/freshness-coverage.test.js` pattern applies

---

## D.8 WB-∞ template — endless micro-fix

```text
1. Run one Part 8 scanner
2. Record output in PR (first hit)
3. Fix one issue
4. Registry: WB-∞-YYYYMMDD-N
5. Verify per Part 9 track
```

---

## PR body template (all WB sessions)

```markdown
## What
WB-___ : <title>

## Why
<G-__ gap or scanner hit>

## How
<files touched>

## Proof
- [ ] npm test
- [ ] npm run lint
- [ ] npm run validate
- [ ] npm run build
- [ ] Manual: <RTL 360 / device>

## Risks
<rollback / SEO / cache>
```
