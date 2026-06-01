# UI/UX Audit — Session Prompts (copy-paste)

> Each prompt assumes prior sessions are **merged to `main`**. Read
> [`2026-06-01_ui-ux-audit-remediation-program.md`](./2026-06-01_ui-ux-audit-remediation-program.md)
> for scope, decisions, and splits. Update
> [`docs/audits/UI_UX_AUDIT_SESSION_REGISTRY.md`](../audits/UI_UX_AUDIT_SESSION_REGISTRY.md) when you
> open/merge a PR.

---

## Session 1 — Phase 1: First paint (CRITICAL)

**Branch:** `cursor/ui-ux-phase1-first-paint-8c0a`  
**Also:** `@.github/prompts/ui-ux-audit-phase1-first-paint.prompt.md`

```md
You are the senior product engineer for Gold Ticker Live (vctb12/GoldTickerLive). Execute **Session 1 / Phase 1 only** — fix the first-paint "Loading…/—" problem. Do not start homepage declutter, nav slim, or CSS splits (later sessions).

Read first:
1. AGENTS.md
2. docs/plans/2026-06-01_ui-ux-audit-remediation-program.md (Phase 1 checklist)
3. .github/instructions/gold-pricing.instructions.md
4. .github/instructions/frontend-mobile.instructions.md
5. src/lib/api.js, src/lib/cache.js (or equivalent cache module)

Non-negotiables:
- AED peg 3.6725; reference ≠ retail; freshness labels stay visible
- EN/AR via src/config/translations.js only
- Safe DOM (src/lib/safe-dom.js); no new innerHTML sinks
- Do not modify post_gold.yml, gold-price-fetch.yml, data/gold_price.json, sw.js, src/config/constants.js without owner approval

Tasks:
1. Add reusable skeleton component + CSS utilities (shimmer sized to final price cards/tables/freshness strip)
2. Replace literal "Loading…", "Loading freshness…", "Preparing…", "Connecting…", and bare "—" placeholders on index.html, tracker.html, shops.html, invest.html, and shared country/city price mounts with skeletons
3. On load, render last-known cached prices from existing localStorage/cache immediately, then refresh from network
4. Add error empty state (icon + message + retry) when gold/FX fail and no cache — wire to api.js failure path
5. Where gold + FX are still fetched sequentially, parallelize them (avoid waterfalls)

Out of scope this session: learn static content, 404, nav IA, homepage section removal, global.css split

Verify:
- npm test, npm run lint, npm run validate, npm run build
- Manual: 360px LTR + RTL, throttled network, offline after cache warm

PR body: What / Why / How / Proof / Risks. Update UI_UX_AUDIT_SESSION_REGISTRY.md and Phase 1 checkboxes in the program doc.
```

---

## Session 2 — Phase 2: Empty / abandoned pages (CRITICAL)

**Branch:** `cursor/ui-ux-phase2-empty-pages-8c0a`  
**Also:** `@.github/prompts/ui-ux-audit-phase2-empty-pages.prompt.md`

```md
You are the senior product engineer for Gold Ticker Live. Execute **Session 2 / Phase 2 only** — fix pages that look empty or abandoned. Session 1 (skeletons + cache-first prices) must already be on main.

Read first:
1. AGENTS.md
2. docs/plans/2026-06-01_ui-ux-audit-remediation-program.md (Phase 2 + decision log)
3. learn.html, src/pages/learn.js, invest.html, shops.html
4. .github/instructions/content-country-pages.instructions.md (for 404/links only)

Tasks:
1. **Learn:** Full educational body visible without JS (static HTML fallback); section cards, in-page TOC, anchors matching homepage #karats references; JS enhances, does not replace
2. **Invest:** Real anchor text on every link; budget widget uses skeletons then real values; theme-color → site gold (#d4a017 or --color-* token); **Decision required in PR:** rebuild properly OR 301 to /content/guides/ + remove from nav — only remove noindex if page has real content
3. **Shops:** Skeleton listing cards; empty state copy ("No listings match your filters"); fix 0/0/0 counters to reflect loaded data; if Supabase data cannot load, document blocker and propose nav hide (do not fake listings)
4. **404:** Branded 404.html (nav + footer + search + popular links); ensure GitHub Pages serves it

Reuse Session 1 skeleton/error patterns where prices appear.

Verify: npm test, npm run validate, npm run build; curl/static check that learn.html has substantive body without JS

PR: note Invest decision in Risks. Update registry + program checkboxes.
```

---

## Session 3 — Phase 3: Consistency (HIGH)

**Branch:** `cursor/ui-ux-phase3-consistency-8c0a`  
**Optional splits:** `cursor/ui-ux-phase3a-naming-karats-8c0a`, `cursor/ui-ux-phase3b-nav-canonical-8c0a`

```md
You are the senior product engineer for Gold Ticker Live. Execute **Session 3 / Phase 3** — single sources of truth for brand, data attribution, karats, chrome coverage, and country URLs.

Read first:
1. AGENTS.md + docs/plans/2026-06-01_ui-ux-audit-remediation-program.md
2. src/config/karats.js, translations.js, constants.js (read-only unless owner-approved)
3. src/components/nav.js, footer.js, nav-data.js
4. .github/instructions/seo.instructions.md
5. PLAN.md (primary data source line — align copy with owner truth)

Tasks:
1. Naming: "Gold Ticker Live" everywhere user-facing; remove "Gold Tracker Pro" from tracker onboarding; "Gold Command Center" only as subsection label if kept
2. Attribution: one gold source + one FX source + one refresh statement across homepage, methodology, footer, meta — e.g. "source updates hourly; page re-polls ~90s" if accurate
3. Karats: drive homepage, calculator, tracker, methodology tables from src/config/karats.js; fix marketing "7 karats" claims to match list
4. Mount nav.js + footer.js on buying guide, content guides hub, country pages, city pages missing chrome
5. Country URLs: pick canonical pattern (/countries/uae/gold-price/ vs /countries/uae/); 301 + rel=canonical via generator — regen sitemap

Do not declutter homepage sections (Session 4). Do not split global.css (Session 5).

Verify: npm test, npm run validate, npm run build; tests for karat list parity if pattern exists; spot-check 3 country pairs for canonical

If >40 files: stop and land 3a (naming+karats+attribution) first, then 3b in follow-up PR.
```

---

## Session 4 — Phase 4: Nav & layout polish (MEDIUM)

**Branch:** `cursor/ui-ux-phase4-nav-layout-8c0a`

```md
You are the senior product engineer for Gold Ticker Live. Execute **Session 4 / Phase 4** — navigation slimming and layout declutter. Sessions 1–3 must be on main.

Read first:
1. AGENTS.md, docs/plans/2026-06-01_ui-ux-audit-remediation-program.md
2. src/components/nav-data.js, nav.js
3. index.html, src/pages/home.js, tracker.html, styles/pages/home.css, tracker-pro.css
4. .github/prompts/mobile-ux-audit.prompt.md

Tasks:
1. Nav: reduce 6 dropdown groups to ~4–5 top-level items; mobile accordion sections; optional search-in-menu; keyboard focus order; ARIA attributes with tests if nav test pattern exists
2. Homepage: ONE hero price card + ONE karat table + ONE country grid + tools + FAQ — remove duplicate market snapshot / command card / repeated karat blocks
3. Tracker: clearer spacing/grouping for 7 mode tabs; empty tables use skeletons not blank rows
4. Global interactive states: hover + focus-visible rings using design tokens in global.css

Benchmark: first-time visitor sees a real price within ~1s (cache-first from Session 1) and any tool within two clicks.

Verify: npm test, npm run validate, npm run build; 360px RTL screenshots for nav + homepage + tracker
```

---

## Session 5 — Phase 5: Performance & hygiene (MEDIUM/LOW)

**Branch:** `cursor/ui-ux-phase5-performance-8c0a`

```md
You are the senior product engineer for Gold Ticker Live. Execute **Session 5 / Phase 5** — performance and hygiene. **Skip entirely if an SPA/framework migration is approved** (note in PR and close session as skipped).

Read first:
1. AGENTS.md, docs/plans/2026-06-01_ui-ux-audit-remediation-program.md
2. styles/global.css, vite.config.*, docs/PERFORMANCE.md
3. .github/prompts/accessibility-audit.prompt.md

Tasks:
1. Split global.css into partials (tokens, base, layout, components, utilities) imported through build; :root tokens remain single source
2. loading="lazy" on images/iframes; add WebP/srcset where images are maintained in-repo
3. AdSense slots: either working fill or remove empty layout holes
4. Wire basic a11y check into CI (contrast on gold text, form labels, alt) — extend existing validate if possible

Verify: npm run build, npm run validate, npm test; Lighthouse comparison note (before/after if run)

Do not change pricing logic or service worker caching semantics without explicit plan entry.
```

---

## Quick reference — session order

```
Session 0 (planning) → merge
Session 1 (first paint) → merge  ← highest ROI
Session 2 (empty pages) → merge
Session 3 (consistency) → merge
Session 4 (nav/layout) → merge
Session 5 (performance) → merge or skip
```
