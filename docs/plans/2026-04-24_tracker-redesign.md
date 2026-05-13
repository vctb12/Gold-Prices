# Tracker.html Redesign Plan — 20-Phase Track

**Created:** 2026-04-24  
**Source reports:** [`reports/tracker-ux-audit.md`](../../reports/tracker-ux-audit.md) (Phase 1
deliverable), [`reports/token-audit.md`](../../reports/token-audit.md) (Phase 2 deliverable),
[`reports/tracker-primitive-map.md`](../../reports/tracker-primitive-map.md) (Phase 3
deliverable).  
**Master plan section:** `docs/REVAMP_PLAN.md` §22b.  
**Status:** ⬜ Pending — Phase 1–3 audit reports complete; implementation Phases 4–20 awaiting slot
into `REVAMP_PLAN.md`.

---

## Problem Statement

The tracker.html page has become overly complex and scattered through multiple iterations by
different agents and developers. The current implementation has:

1. **241 tracker-specific CSS classes** — indicating significant fragmentation.
2. **Overly dense hero section** with too many competing elements: 4 status badges, title +
   subtitle, description, hero stats grid, 4 selector dropdowns, 4 action buttons, 4 hint chips,
   keyboard shortcuts hint, live-desk sidebar, explore-links sidebar.
3. **Scattered information architecture**: trust banner separate from hero, welcome strip
   conditionally shown, hero split between main and aside, mode tabs immediately after hero,
   multiple overlapping toolbars.
4. **27 `innerHTML` / `outerHTML` / `insertAdjacentHTML` sinks** across 4 tracker files — the
   largest DOM-safety surface in the repo.

---

## Surface footprint (from `reports/tracker-ux-audit.md` §1)

| File                           | LOC   | Notes                                                                                   |
| ------------------------------ | ----- | --------------------------------------------------------------------------------------- |
| `tracker.html`                 | 1,312 | 7 modes (live · compare · archive · alerts · planner · exports · method) + hero + trust |
| `src/pages/tracker-pro.js`     | 716   | Orchestrator; lazy-loads render / events / wire / ad-slot                               |
| `src/tracker/render.js`        | 1,031 | Biggest `innerHTML` concentration (18 sinks)                                            |
| `src/tracker/state.js`         | 270   | URL-hash contract frozen in `docs/tracker-state.md`                                     |
| `src/tracker/ui-shell.js`      | 220   | Tab + overlay wiring (target of Phase 7 extraction)                                     |
| `src/tracker/events.js`        | 308   | Trust / welcome-strip / keyboard                                                        |
| `src/tracker/wire.js`          | 98    | Live headlines belt                                                                     |
| `styles/pages/tracker-pro.css` | 2,577 | Target of Phase 17 split                                                                |

### DOM-safety baseline (must not increase; reductions require tightening the per-file baseline)

| File                       | Current sinks |
| -------------------------- | :-----------: |
| `src/tracker/render.js`    |      18       |
| `src/tracker/events.js`    |       2       |
| `src/tracker/wire.js`      |       3       |
| `src/pages/tracker-pro.js` |       4       |
| **Total tracker surface**  |    **27**     |

---

## Token audit summary (from `reports/token-audit.md` — Phase 2 deliverable)

**Finding: nothing to promote.** All three surfaces audited are already in the correct state:

- **Tracker (`styles/pages/tracker-pro.css`)** — `:root` block is a thin alias layer; every `--tp-*`
  maps through `var(--…)` to a canonical token in `styles/global.css`. No hand-picked hex values.
  Alias layer deliberately kept for future "pro dark" theme capability.
- **Homepage** — no page-scoped `:root` of hero tokens; `index.html` + `src/pages/home.js` consume
  `--surface-*`, `--text-*`, `--color-gold-*`, `--shadow-*`, `--radius-*` directly.
- **Admin (`styles/admin.css`)** — intentionally divergent palette (always dark-themed, tighter
  radius scale, indigo primary accent, heavier shadows). Divergence documented with rationale; do
  **not** promote. Rename to `--admin-*` prefix in Phases 23–28.

**Phase 2 follow-up rows:**

- Phase 14 (CSS split): keep the `--tp-*` alias `:root` block in the shared file.
- Phases 15–22 (homepage rebuild): wire count-up and sparkline colors via `--color-up*` /
  `--color-down*`.
- Phases 23–28 (admin revamp): rename admin tokens to `--admin-*` prefix.

---

## Shared-primitive adoption map (from `reports/tracker-primitive-map.md` — Phase 3 deliverable)

Primitives in play:

| Primitive                                                                             | Surface role                                                           |
| ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `src/lib/live-status.js` (`getLiveFreshness`, `getMarketStatus`, `formatRelativeAge`) | Canonical freshness / market-open / relative-age strings               |
| `src/lib/freshness-pulse.js` (`pulseFreshness`)                                       | 600 ms attribute toggle, 90 s throttle, reduced-motion safe            |
| `src/lib/reveal.js` (`observeReveal`, auto-init)                                      | Fade-in-up for `[data-reveal]` via one shared `IntersectionObserver`   |
| `src/lib/count-up.js` (`countUp`)                                                     | rAF easeOutQuad numeric counter, auto directional `data-flash=up/down` |
| `src/lib/safe-dom.js` (`el`, `clear`, `escape`, `safeHref`, `safeTel`)                | DOM-safe builders — the only home for `innerHTML`                      |

Adoption status per site:

| Site                                                          | Target primitive                         | Status                | Phase  |
| ------------------------------------------------------------- | ---------------------------------------- | --------------------- | ------ |
| `render.js` — hero badges                                     | `getLiveFreshness` + `getMarketStatus`   | ✅ Adopted            | —      |
| `tracker-pro.js` — reveal import                              | `observeReveal` auto-init                | ✅ Adopted            | —      |
| Mode-tab registry                                             | `src/tracker/modes.js`                   | ✅ Shipped            | 7      |
| Sections below the fold                                       | `[data-reveal]` HTML attribute           | ✅ Shipped            | 7      |
| `render.js` — `#tp-xauusd-value`                              | `countUp`                                | ⚠️ Not adopted        | 17     |
| `render.js` — karat strip cells                               | `countUp` + `pulseFreshness`             | ⚠️ Not adopted        | 17     |
| `render.js` — `#tp-chart-stats`                               | `countUp`                                | ⚠️ Not adopted        | 9 / 17 |
| Tracker "just-refreshed" cells (hero + karat strip + compare) | `pulseFreshness(el, {})`                 | ⚠️ Not adopted        | 9 / 18 |
| `wire.js` — live-wire items                                   | `safe-dom.el()` + `formatRelativeAge`    | ⚠️ 3 sinks pending    | 9      |
| `render.js` — archive table                                   | `safe-dom.el()` + `clear()`              | ❌ Ad-hoc `innerHTML` | 11     |
| `render.js` — compare results table                           | `safe-dom.el()`                          | ❌ Ad-hoc `innerHTML` | 10     |
| `events.js` — welcome-strip                                   | `observeReveal` (`[data-reveal]` opt-in) | ⚠️ No tag yet         | 6      |

**Invariant:** Any future change on the tracker surface must check this map before introducing a
local helper. If the primitive does not cover the new case, add a row and extend the primitive — do
not fork a sibling in `src/tracker/`.

---

## Defect log (from `reports/tracker-ux-audit.md` §2)

Each defect is mapped to the phase that owns it. Severity: 🟥 critical, 🟧 serious, 🟨 polish.

### Hero + trust (Phase 5, Phase 16)

- 🟧 Badge row wraps awkwardly on 320 px widths (overflow-x hidden hides the XAU/USD tail).
- 🟧 `#tp-hero-stats` is built via `el()` but has no loading skeleton; first paint shows an empty
  grid until prices resolve.
- 🟨 Selectors row (language · currency · karat · unit) does not stick on scroll on mobile — users
  lose the unit context when reading the chart.
- 🟨 `#tp-jump-chart` anchors to `#mode-live` but does not set focus on the chart heading; keyboard
  users jump visually without landing on a focusable target.

### Welcome + orientation (Phase 6)

- 🟧 `#tracker-welcome-strip` renders on every first-paint before JS decides whether to hide it
  (FOUC on slow connections).
- 🟨 Chips do not reveal progressively; all three animate in lockstep.

### Mode tabs (Phase 7, Phase 8)

- 🟧 Tab wiring, overlay wiring, keyboard shortcuts, hashchange handling, and workspace-level toggle
  are all co-located in `ui-shell.js`. Extracting a registry makes each mode independently testable
  and unlocks lazy-mount in Phase 19.
- 🟨 `aria-controls` on `#tab-alerts` / `#tab-planner` points at overlay IDs, not mode panels —
  correct today, but the shape differs from other tabs and is confusing.

### Live mode (Phase 9)

- 🟧 No explicit loading skeleton — chart-empty state only shows _after_ a first successful fetch.
- 🟧 Pinch/pan on mobile chart is fiddly; two-finger pan competes with page scroll.
- 🟨 `#tp-chart-stats` numbers do not pulse/flash on refresh, making it unclear whether a value
  actually changed.

### Compare mode (Phase 10)

- 🟧 Results are built via `innerHTML` concatenation — part of the `render.js` 18-sink count.
  Semantic `<table>` via `el()` needed.
- 🟨 Spot vs retail framing isn't explicit per row; users can misread the comparison as retail.

### Archive mode (Phase 11) — largest single debug target

- 🟥 Pagination is missing; loading a long range renders every row (LCP regression on mobile).
- 🟥 Sort state is not reflected in the hash → users can't share a sorted view.
- 🟧 Largest `innerHTML` concentration in the tracker; refactor to `el()` must bring `render.js`
  from 18 → ≤ 10 sinks.

### Alerts mode (Phase 12)

- 🟧 No disclaimer that alerts are browser-only — risk of user thinking they're SMS/email.
- 🟨 No `aria-live` on the fire-notification strip.

### Planner mode (Phase 13)

- 🟧 Retail-vs-spot switch is buried; the disclaimer must be re-used from the sitewide §0.2 snippet.
- 🟨 Zakat calculator inputs do not round-trip in the hash.

### Exports mode (Phase 14)

- 🟧 CSV filename does not include ISO timestamp + karat + currency — brittle for repeat exports.
- 🟨 "Copy brief" uses HTML templating; consolidate into a tested generator.

### Method mode (Phase 15)

- 🟨 Method tab is a static block; does not deep-link to `methodology.html` anchors.

---

## A11y / performance baselines to beat

- **Pa11y (mobile):** owed — Phase 20 defines the "clean" bar.
- **Lighthouse (mobile):** previous LCP ≈ 2.8 s on 4G emulation — Phase 19 + Phase 5 must not
  regress.
- **DOM-safety baseline:** tightened on Phase 11 (archive) and Phase 5 (hero).

---

## Implementation phases

All 20 phases are defined by `REVAMP_PLAN.md` §22b. The table below maps each phase to the defects
it resolves and the primitives it must adopt. Phases 1–3 are already shipped (audit deliverables).

| Phase | Title                                                 | Defects resolved | Primitive targets                              | Status                                       |
| ----- | ----------------------------------------------------- | ---------------- | ---------------------------------------------- | -------------------------------------------- |
| 1     | Surface audit                                         | —                | —                                              | ✅ Done — `reports/tracker-ux-audit.md`      |
| 2     | Token audit                                           | —                | —                                              | ✅ Done — `reports/token-audit.md`           |
| 3     | Primitive adoption map                                | —                | —                                              | ✅ Done — `reports/tracker-primitive-map.md` |
| 4     | Audit tooling gate                                    | —                | `check-unsafe-dom.js` baseline                 | ⬜ Pending                                   |
| 5     | Hero + trust redesign                                 | Hero 🟧×2, 🟨×2  | `el()` skeleton, badge layout                  | ⬜ Pending                                   |
| 6     | Welcome strip FOUC + progressive chips                | Welcome 🟧, 🟨   | `[data-reveal]` opt-in                         | ⬜ Pending                                   |
| 7     | Mode-tab registry extraction                          | Tabs 🟧, 🟨      | `modes.js` registry                            | ✅ Shipped                                   |
| 8     | Keyboard + hash wiring cleanup                        | Tabs wiring      | `ui-shell.js` refactor                         | ⬜ Pending                                   |
| 9     | Live mode: skeleton + touch + pulse                   | Live 🟧×2, 🟨    | `countUp`, `pulseFreshness`, 3 `wire.js` sinks | ⬜ Pending                                   |
| 10    | Compare mode: safe-dom table + retail framing         | Compare 🟧, 🟨   | `safe-dom.el()`                                | ⬜ Pending                                   |
| 11    | Archive mode: pagination + sort hash + sink reduction | Archive 🟥×2, 🟧 | `safe-dom.el()` + `clear()`                    | ⬜ Pending                                   |
| 12    | Alerts mode: browser-only disclaimer + aria-live      | Alerts 🟧, 🟨    | `aria-live` region                             | ⬜ Pending                                   |
| 13    | Planner mode: retail disclaimer + hash round-trip     | Planner 🟧, 🟨   | §0.2 snippet reuse                             | ⬜ Pending                                   |
| 14    | Exports mode: CSV filename + copy-brief generator     | Exports 🟧, 🟨   | —                                              | ⬜ Pending                                   |
| 15    | Method mode: deep-links to methodology.html           | Method 🟨        | —                                              | ⬜ Pending                                   |
| 16    | Hero stats: count-up animation                        | Hero polish      | `countUp` on hero stats                        | ⬜ Pending                                   |
| 17    | Karat strip + XAU/USD: count-up + pulse               | —                | `countUp`, `pulseFreshness` on strip           | ⬜ Pending                                   |
| 18    | Pulse all "just-refreshed" cells                      | —                | `pulseFreshness` sitewide on tracker           | ⬜ Pending                                   |
| 19    | Performance: lazy-mount below-fold modes              | —                | —                                              | ⬜ Pending                                   |
| 20    | Pa11y audit + final Lighthouse baseline               | —                | —                                              | ⬜ Pending                                   |

---

## Hard guards (out of scope — never)

From `reports/tracker-ux-audit.md` §4:

- **No chart-lib swap** — `docs/plans/README.md` matrix row #11 rejected. `lightweight-charts` stays
  for tick/OHLC (tracker); `chart.js` stays for multi-series overlay (history page).
- **No URL-hash contract change** — frozen in `docs/tracker-state.md`.
- **No new backend / Supabase / auth.**
- **No opportunistic edits outside the tracker surface.**
- **No new URL paths** — matrix row #15 gated behind owner approval.

---

## Design goals

1. **Simplify visual hierarchy** — establish clear primary/secondary/tertiary levels.
2. **Consolidate related controls** — group selectors, reduce redundancy.
3. **Improve information flow** — guide users from overview → action → data.
4. **Maintain all functionality** — no features removed, only reorganised.
5. **Preserve product-trust guardrails** — all §6 trust elements stay visible; freshness labels and
   disclaimers are product elements, not decoration.
6. **Enhance mobile experience** — better responsive behaviour at 360 px+; 44 px touch targets.
7. **Improve bilingual parity** — verify EN/AR RTL consistency on every changed surface.

---

## Done criteria

- All 20 phase rows ticked in the table above.
- `render.js` sink count ≤ 10 (down from 18) after Phase 11.
- DOM-safety baseline in `check-unsafe-dom.js` tightened to match reduced counts.
- Lighthouse LCP on mobile ≤ 2.8 s (does not regress).
- Pa11y mobile clean bar established (Phase 20).
- `npm test`, `npm run lint`, `npm run validate`, `npm run build` all green.
- Before/after screenshots at 360 px + 1440 px for every phase that touches visible surfaces.
- RTL spot-check (Arabic + `dir=rtl`) for Phases 5, 6, 9, 10, 11.
- All §6 product-trust guardrails intact (freshness labels, spot-vs-retail framing, disclaimer
  copy).

---

## Rollback strategy

Each phase ships as a standalone commit. Phases 5–15 (defect fixes) are fully reversible because
they touch a bounded set of files within the tracker surface. Phase 11 (archive pagination) carries
the highest regression risk — land it behind a feature flag or as the last phase before Phase 20
verification.

---

## Risks

| Risk                          | Mitigation                                                                        |
| ----------------------------- | --------------------------------------------------------------------------------- |
| Breaking URL hash state       | `state.js` is untouched; test with `tests/tracker-hash.test.js` after every phase |
| Raising DOM-safety sink count | Run `npm run validate` after every phase; revert if count increases               |
| LCP regression on mobile      | Run Lighthouse before Phase 19 and after Phase 20                                 |
| Bilingual regression (RTL)    | Test Arabic mode at every phase that touches `tracker.html`                       |
| Archive pagination edge cases | Gate Phase 11 behind a feature flag; load-test with 365-day range                 |
