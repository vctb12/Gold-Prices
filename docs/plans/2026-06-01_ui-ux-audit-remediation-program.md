# UI/UX Audit Remediation — Multi-Session Program

```yaml plan-status
status: ready
priority: P0
class: program
owner: @vctb12
created: "2026-06-01"
last_updated: "2026-06-01"
source: external-audit-prompt-2026-06-01
sessions_total: 6
sessions_open: 5
next_session: 1
next_branch: cursor/ui-ux-phase1-first-paint-8c0a
blocked_on: ""
guardrails_reviewed: true
skills_used: [mobile-ux-review, pricing-data-integrity, frontend-design-system, seo-governance]
```

> **Pending reconciliation → Active program.** Raw audit captured 2026-06-01. Execution is split into
> **one planning PR (Session 0)** plus **five implementation sessions (Phases 1–5)**. Each session
> ships as its own branch and PR; merge in order unless noted.

**Companion files**

| File | Purpose |
| ---- | ------- |
| [`2026-06-01_ui-ux-audit-session-prompts.md`](./2026-06-01_ui-ux-audit-session-prompts.md) | Copy-paste Composer prompts per session |
| [`.github/prompts/ui-ux-audit-phase*.prompt.md`](../../.github/prompts/) | Cursor / Copilot @-mention prompts |
| [`docs/audits/UI_UX_AUDIT_SESSION_REGISTRY.md`](../audits/UI_UX_AUDIT_SESSION_REGISTRY.md) | Branch ↔ PR ↔ status tracker (update each session) |

---

## Executive summary (audit)

Gold Ticker Live is feature-rich but reads as an unfinished dev project on first paint. Root causes
are **systemic**, not cosmetic:

1. **Client-side price pipeline** — gold/FX fetch + calc/render happen after JS boot, exposing `Loading…`, `—`,
   and empty tables before the UI hydrates; crawlers and slow networks can see skeleton shells.
2. **JS-only content pages** — Learn, Invest, Shops, and many country/city shells ship almost no
   static body; a JS hiccup = blank page.
3. **Drift** — three product names, conflicting data-source attribution (gold-api.com vs
   goldpricez.com), refresh cadence (90s vs hourly), karat set mismatches (5/6/7 claims).
4. **Chrome gaps** — some templates omit shared nav; no branded `404.html`; Invest `noindex` +
   wrong `theme-color`.
5. **Layout debt** — homepage/tracker duplication; 6× nav groups / 40+ links; 4,548-line
   `styles/global.css`.

**Quality bar to match:** Methodology, content guides hub, buying guide (content-rich static HTML).

**Competitive gap:** goldprice.org / livepriceofgold.com lead with numbers; GTL leads with marketing
copy and placeholders.

---

## Session map (do not parallelize across phases)

| Session | Phase | Branch (template) | PR title (draft) | Merge gate | Est. scope |
| :-----: | ----- | ------------------- | ---------------- | ---------- | ---------- |
| **0** | Planning | `cursor/ui-ux-audit-session-program-8c0a` | docs: UI/UX audit session program + phase prompts | Docs only | This file + prompts |
| **1** | Phase 1 — First paint | `cursor/ui-ux-phase1-first-paint-8c0a` | fix(ux): skeletons, cache-first prices, parallel fetch, error states | **Ship alone first** | `src/lib/api.js`, cache, skeleton component, index/tracker/shops/country/invest surfaces |
| **2** | Phase 2 — Empty pages | `cursor/ui-ux-phase2-empty-pages-8c0a` | fix(ux): learn/invest/shops static fallbacks, branded 404 | After Session 1 merged | `learn.html`, `invest.html`, `shops.html`, `404.html`, `_redirects` |
| **3** | Phase 3 — Consistency | `cursor/ui-ux-phase3-consistency-8c0a` | fix(ux): brand, sources, karats config-driven, nav on all templates | After Session 2 | `translations.js`, `karats.js`, nav injection, canonical/duplicate URLs |
| **4** | Phase 4 — Nav & layout | `cursor/ui-ux-phase4-nav-layout-8c0a` | fix(ux): slim nav, homepage declutter, tracker grouping | After Session 3 | `nav-data.js`, `home.js`, `index.html`, `tracker.html` |
| **5** | Phase 5 — Performance | `cursor/ui-ux-phase5-performance-8c0a` | chore(css): global.css partials, lazy images, a11y CI | After Session 4; **defer if framework migration planned** | `styles/`, build pipeline, CI |

### Optional splits (if a session is too large)

| Parent | Split | When |
| ------ | ----- | ---- |
| Session 3 | **3a** naming + attribution + karats · **3b** nav-on-all-templates + country URL canonical | Session 3 PR > ~40 files or generator touch |
| Session 4 | **4a** nav slim · **4b** homepage · **4c** tracker | Mobile nav ARIA work needs isolated review |
| Session 2 | **2a** learn + 404 · **2b** invest (merge vs rebuild decision) · **2c** shops | Shops Supabase deprecation → skip 2c, hide nav link |

---

## Phase deliverables (from audit)

### Phase 1 — Kill Loading…/— first paint (CRITICAL)

- [ ] Reusable skeleton component + CSS utilities (price cards, tables, freshness strip)
- [ ] Replace literal `Loading…`, `Preparing…`, `Connecting…`, bare `—` on index, tracker, shops,
      country/city, invest
- [ ] Hydrate from `localStorage` / existing cache layer before network
- [ ] Error empty state (icon, message, retry) on `api.js` failure path when no cache
- [ ] Parallelize gold + FX fetches (today: sequential)

**Verify:** `npm test`, `npm run validate`, `npm run build`; manual 360px LTR + RTL first paint &
      hard-offline.

### Phase 2 — Empty / abandoned pages (CRITICAL)

- [ ] **Learn:** static educational body without JS; TOC + anchor links aligned to homepage `#karats`
- [ ] **Invest:** anchor text on icon links; budget widget skeletons → values; `theme-color` → site
      gold; **decision:** rebuild vs merge into `/content/guides/` + redirect (keep `noindex` until
      real content)
- [ ] **Shops:** skeleton cards, honest empty state, counters reflect loaded data (or hide from nav if
      backend dead)
- [ ] **404:** branded `404.html` + GitHub Pages config

### Phase 3 — Consistency (HIGH)

- [ ] Single product name: **Gold Ticker Live** (retire “Gold Tracker Pro” in onboarding; “Command
      Center” = section label only)
- [ ] Single attribution + refresh statement (README source of truth: gold-api.com + FX provider;
      reconcile 90s poll vs hourly source updates in copy)
- [ ] All karat UIs driven by `src/config/karats.js`; fix “7 karats” marketing claims
- [ ] `nav.js` + `footer.js` on buying guide, content guides, country, city templates
- [ ] Canonicalize `/countries/{cc}/` vs `/countries/{cc}/gold-price/` (301 + `<link rel="canonical">`
      across generated pages)

### Phase 4 — Navigation & layout polish (MEDIUM)

- [ ] Nav: 6 groups → ~4–5; mobile accordion + in-menu search; keyboard order + ARIA tests
- [ ] Homepage: one hero price + one karat table + one country grid + tools + FAQ
- [ ] Tracker: visual grouping for 7 modes; skeleton rows not blank tables
- [ ] Global hover/focus-visible on interactive elements (tokens)

### Phase 5 — Performance & hygiene (MEDIUM/LOW)

- [ ] Split `global.css` into partials (tokens, base, layout, components, utilities) via build
- [ ] `loading="lazy"` on images/iframes; WebP + `srcset` where assets exist
- [ ] AdSense: fill or remove empty slots
- [ ] Basic a11y check in CI (contrast on gold text, labels, alt)

---

## Decision log (thresholds)

| Trigger | Plan change |
| ------- | ----------- |
| Analytics: most traffic = country/city | Prioritize static pre-render of prices on country pages **before** homepage declutter (swap Session 4b with country work in Session 1 extension) |
| Shops Supabase deprecated | Session 2c → remove Shops from nav; no directory fix |
| Framework / SPA migration approved | Do Sessions 1–3; **defer Session 5** CSS split |
| Invest cannot get real content this cycle | Session 2b → redirect to `/content/guides/`; keep `noindex` on stub until redirect lands |

---

## Dependencies & risks

| Risk | Mitigation |
| ---- | ---------- |
| Service worker cache stale after cache-first UX | Version bump + freshness labels unchanged |
| Country URL canonical touches 395+ pages | Generator-only change; one PR; sitemap regen |
| `global.css` split breaks Pages deploy | Session 5 only; visual diff screenshots |
| Production workflows | Do not touch `post_gold.yml` / `gold-price-fetch.yml` in UX sessions |
| DOM-safety regression | No new `innerHTML` sinks; run `npm run validate` |

---

## Reconciliation with existing plans

| Existing doc | Relationship |
| ------------ | ------------ |
| [`2026-05-21_next-session-prompts.md`](./2026-05-21_next-session-prompts.md) | Parallel track (shell/learn-hub). **This program takes priority for perceived “broken site” UX** until Session 1–2 land. |
| [`2026-05-30_premium-ui-ux-revamp.md`](./2026-05-30_premium-ui-ux-revamp.md) | Visual polish; run **after** Session 1 cache-first + skeletons |
| [`2026-04-24_navbar-audit-and-redesign.md`](./2026-04-24_navbar-audit-and-redesign.md) | Superseded for nav work by Session 4 |
| [`docs/GOLD_TICKER_LIVE_AGENT_PROMPTS.md`](../GOLD_TICKER_LIVE_AGENT_PROMPTS.md) §8 | Legacy full revamp prompt; use **phase prompts** in `.github/prompts/ui-ux-audit-phase*.prompt.md` instead |

---

## REVAMP_PLAN.md hook

TODO (owner): add under backlog / UX in [`docs/REVAMP_PLAN.md`](../REVAMP_PLAN.md) (owner may relocate):

```markdown
### UI/UX audit remediation (2026-06-01)

- [ ] Session 1 — first paint (skeletons, cache-first, parallel fetch)
- [ ] Session 2 — learn / invest / shops / 404
- [ ] Session 3 — naming, sources, karats, nav coverage, country canonicals
- [ ] Session 4 — nav slim, homepage + tracker declutter
- [ ] Session 5 — CSS partials, lazy media, a11y CI
```

---

## Session log

### 2026-06-01 — cursor (Session 0 — planning)

- **Slice:** PLAN
- **Completed:** Program doc, session prompts, `.github/prompts/ui-ux-audit-phase*.prompt.md`, session
  registry, README + PLAN.md intake
- **Validation:** Docs-only; no `npm test` required
- **Next action:** Open Session 1 branch `cursor/ui-ux-phase1-first-paint-8c0a`; paste prompt from
  [`2026-06-01_ui-ux-audit-session-prompts.md`](./2026-06-01_ui-ux-audit-session-prompts.md) or
  `@.github/prompts/ui-ux-audit-phase1-first-paint.prompt.md`
