# Navbar Audit & Redesign Plan

```yaml plan-status
status: not-started
priority: P2
class: A
owner: @vctb12
last_run_at: ""
last_run_pr: ""
last_run_agent: copilot
slices_remaining_estimate: 0
next_action: ""
blocked_on: ""
guardrails_reviewed: true
skills_used: []
```

**Created:** 2026-04-24  
**Source:** Full structural audit of `src/components/nav.js`, `src/components/nav-data.js`, and
`styles/global.css` nav sections.  
**Status:** 🟡 IN PROGRESS — Phase 2 CSS fixes (S1, S5, S7) shipped 2026-04-27.

---

## What the audit found

The navbar is architecturally sound (bilingual, accessible skip link, keyboard nav, focus trap,
scroll hide/reveal, theme toggle, mobile bottom bar). The implementation is tested by 11 node:test
cases in `tests/nav-data.test.js`. These are real strengths to preserve.

The audit found **23 issues** across four categories: bugs, CSS, information architecture, and
accessibility gaps. They are grouped into three implementation phases below.

### Bug inventory (must fix)

| ID  | Severity | Issue                                                                                                                                                                                                                                                                                          |
| --- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1  | 🔴       | `#nav-search-btn` has no `aria-expanded` or `aria-controls="nav-search-overlay"`. Screen readers get no announcement when the search overlay opens or closes. `openOverlay()`/`closeOverlay()` do not set these attributes.                                                                    |
| B2  | 🔴       | `updateNavLang` (nav.js:802) queries `[data-nav-key="invest"]` — a selector that is never rendered by `injectNav`. This is a silent no-op on every language switch. The Invest item inside the More group is handled correctly by the generic group loop; only this legacy selector is broken. |

### CSS issues

| ID  | Severity | Issue                                                                                                                                                                                                                                                                                        |
| --- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1  | 🟠       | `.nav-dropdown-item` rule block is defined **twice** (global.css:3548 and 5969) with conflicting properties. The later block wins for most properties, but `min-height: 40px`, `white-space: nowrap`, and `font-size: 0.88rem` leak forward from the earlier block into the effective style. |
| S2  | 🟠       | Dropdown items `min-height: 40px` — 4px below the 44px WCAG touch target recommendation (applies on 641–820px tablet viewports where the dropdown is reachable by touch).                                                                                                                    |
| S3  | 🟠       | `nav-link--shops` class is applied (nav.js:241) but has zero CSS rules — a no-op class.                                                                                                                                                                                                      |
| S4  | 🟠       | `.nav-drawer-bottom` (global.css:6333) and `.nav-drawer-search` (global.css:5239) are defined but never emitted by `injectNav` or `buildDrawerGroup` — dead CSS.                                                                                                                             |
| S5  | 🟠       | `.nav-icon-btn:hover` background `var(--surface-subtle, rgb(0,0,0,0.04))` is invisible on the dark nav bar (`rgb(15 12 8 / 92%)`). No `[data-theme='dark'] .nav-icon-btn` override exists.                                                                                                   |
| S6  | 🟠       | `.nav-skip-link` uses `left: 8px` (global.css:708) instead of `inset-inline-start`. In RTL the skip link stays pinned to the physical left edge. No `[dir='rtl']` override.                                                                                                                  |
| S7  | 🟠       | `body.has-spot-bar .site-nav[data-nav-hidden='true']` (global.css:6254) sets `transform: translateY(-100%)` — identical to the base rule at 6249. The intended offset (accounting for spot-bar height) was never added.                                                                      |

### Information architecture issues

| ID  | Severity | Issue                                                                                                                                                                                                                                    |
| --- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| IA1 | 🟡       | All 4 drawer groups render `<details open>`. Opening the drawer presents all 46 items expanded simultaneously — many scroll-lengths on a 375px phone.                                                                                    |
| IA2 | 🟡       | Emoji icon collisions: 📈 appears in both Prices (Live Tracker) and Tools (Investment Return); 📰 appears twice in More; 🛒 appears in both Learn and Prices; 🏙️ is identical across 5 city entries; 🕌 appears in both Tools and Learn. |
| IA3 | 🟡       | `NAV_DATA.en.invest` / `NAV_DATA.ar.invest` exist as a legacy top-level entry that is referenced by zero live HTML elements and duplicates the Invest item already inside the More group.                                                |
| IA4 | 🟡       | Learn dropdown mixes educational guide content (items 1–8) with site-meta pages: Methodology (`/methodology.html`) and FAQ (`/content/faq/`) are about how the site works, not gold education.                                           |
| IA5 | 🟡       | More dropdown mixes editorial (Insights, News), transactional (Invest, Submit a Shop), operational (Changelog), and legal (Privacy, Terms). Privacy and Terms are footer-appropriate, not primary nav.                                   |
| IA6 | 🟡       | Prices dropdown has 16 items in two columns. City/market links (items 8–14) are highly specific; they belong on country pages, not in a top-level nav dropdown.                                                                          |

### Accessibility gaps

| ID  | Severity | Issue                                                                                                                                         |
| --- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | 🔵       | Search button `aria-expanded` / `aria-controls` (same as B1).                                                                                 |
| A2  | 🔵       | All 4 drawer groups open by default; screen reader users must traverse all 46 items to reach the language toggle at the bottom of the drawer. |
| A3  | 🔵       | Brand `aria-label="Gold Ticker Live Home"` is hardcoded in English regardless of current language.                                            |
| A4  | 🔵       | Theme toggle `THEME_LABEL` strings are hardcoded in English; `updateNavLang` does not update the theme button label.                          |
| A5  | 🔵       | "Recent searches" section header in the search dropdown is hardcoded in English even in AR mode.                                              |
| A6  | 🔵       | Mobile bottom bar "More" button triggers the drawer but has no `aria-expanded` or `aria-controls="nav-drawer"`.                               |

---

## Implementation plan

Three phases, ordered by risk and scope. Each phase is a standalone PR.

---

### Phase 1 — Bug fixes and accessibility gaps (no IA changes)

**Scope:** `src/components/nav.js` only. No changes to `nav-data.js` or `global.css`.  
**Risk:** Low — targeted JS-only changes. All existing tests should continue to pass.  
**Gate:** `npm test`, `npm run lint`.

#### P1-1 — Fix `aria-expanded` / `aria-controls` on search button (B1 / A1)

In `injectNav`, add `aria-expanded="false"` and `aria-controls="nav-search-overlay"` to
`#nav-search-btn` in the HTML template. In `initNavSearch`, update `openOverlay()` to set
`aria-expanded="true"` and `closeOverlay()` to set `aria-expanded="false"` on the button.

#### P1-2 — Remove dead `[data-nav-key="invest"]` selector (B2)

In `updateNavLang` (nav.js:802), delete the `nav.querySelectorAll('[data-nav-key="invest"]')` block.
The Invest item in the More group is already handled correctly by the generic group-item loop above
it. No data or behaviour changes.

#### P1-3 — Add `aria-expanded` / `aria-controls` to mobile bottom-bar "More" button (A6)

In `_injectMobileBottomNav`, add `aria-expanded="false"` and `aria-controls="nav-drawer"` to the
menu button template. In the `menuBtn.addEventListener('click', …)` handler, mirror the hamburger's
`aria-expanded` state onto the bottom-bar button after delegating the click.

#### P1-4 — Internationalise hardcoded English strings (A3, A4, A5)

- Brand `aria-label`: derive from `data.home.label` or add `data.brandLabel` to `NAV_DATA`. Update
  `updateNavLang` to refresh it.
- Theme toggle labels: add an `themeLabels` object to `NAV_DATA` for each locale. Update
  `_applyTheme` to read from the current locale's map. Update `updateNavLang` to re-apply the
  current mode label.
- "Recent searches" header: add `data.recentSearches` string to `NAV_DATA`. `initNavSearch` reads
  `_currentLang` to pick the correct locale string.

---

### Phase 2 — CSS consolidation and fixes (no IA changes)

**Scope:** `styles/global.css` only.  
**Risk:** Low-medium — visual-only changes, no JS. Existing tests pass unchanged.  
**Gate:** `npm run lint`, `npm run build`, manual visual check at 360px / 768px / 1280px in light
and dark mode, RTL spot-check.

#### P2-1 — Deduplicate `.nav-dropdown-item` (S1, S2) ✅ DONE 2026-04-27

Earlier `.nav-dropdown-item` block removed; sub-element styles (icon, body, primary modifier,
dark-mode primary label) merged into the enriched grid-layout block. `min-height` verified at `58px`
in surviving block (exceeds 44px WCAG minimum).

#### P2-2 — Remove dead CSS rules (S3, S4)

Remove `.nav-link--shops` mentions from `nav.js` template (or add real CSS — confirm with owner
which). Remove `.nav-drawer-bottom` and `.nav-drawer-search` rule blocks from `global.css` (they are
never rendered; confirm with `grep` before deleting).

#### P2-3 — Fix dark-mode icon button hover (S5) ✅ DONE 2026-04-27

Added:

```css
[data-theme='dark'] .nav-icon-btn:hover,
[data-theme='dark'] .nav-icon-btn:focus-visible {
  background: rgb(255 255 255 / 0.08);
  color: var(--color-text);
}
```

#### P2-4 — Fix skip link RTL positioning (S6)

Replace `left: 8px` with `inset-inline-start: 8px` on `.nav-skip-link` (global.css:708).

#### P2-5 — Fix spot-bar nav-hidden offset (S7) ✅ DONE 2026-04-27

`body.has-spot-bar .site-nav[data-nav-hidden='true']` now uses
`transform: translateY(calc(-100% - var(--spot-bar-height, 36px)))`.

---

### Phase 3 — Information architecture (IA changes — requires owner approval)

**Scope:** `src/components/nav-data.js` (content only), `tests/nav-data.test.js` (update counts if
item counts change).  
**Risk:** Medium — changes what users see. All 11 nav-data tests must stay green; update expected
counts where needed.  
**Gate:** `npm test`, `npm run lint`.

#### P3-1 — Drawer groups default-collapsed except Prices (IA1, A2)

In `buildDrawerGroup`, render `<details>` without `open` by default. Add `open` only to the first
group (`prices`) so mobile users land with the most important group pre-expanded and the rest
collapsed, reducing the initial scroll depth from 46-item wall to ~16 visible items.

#### P3-2 — Remove legacy `invest` top-level key (IA3)

Delete `NAV_DATA.en.invest` and `NAV_DATA.ar.invest` from `nav-data.js`. Verify no live code
references them (B2 cleanup in Phase 1 removes the only JS reference). The Invest link lives
correctly inside the More group already.

#### P3-3 — Deduplicate emoji icons (IA2)

Assign distinct icons to items that currently share glyphs across groups:

| Item                                  | Current | Proposed                                                                   |
| ------------------------------------- | ------- | -------------------------------------------------------------------------- |
| Investment Return (Tools)             | 📈      | 💹                                                                         |
| Why Gold Moved Today (More) second 📰 | 📰      | 📡                                                                         |
| How to Buy Gold (Learn)               | 🛒      | 📖                                                                         |
| Zakat on Gold (Learn)                 | 🕌      | 🌙                                                                         |
| All 5 city entries (Prices)           | 🏙️      | City-specific flags (🇦🇪 Dubai, 🇦🇪 Abu Dhabi, 🇸🇦 Riyadh, 🇪🇬 Cairo, 🇶🇦 Doha) |

Both EN and AR entries must be updated in sync (the tests enforce EN/AR parity by position, not by
icon, so this is safe).

#### P3-4 — Trim Prices dropdown from 16 to 10 items (IA6)

Move city/market entries (Dubai, Abu Dhabi, Riyadh, Cairo, Doha, Dubai Gold Souk, Khan el-Khalili)
out of the Prices dropdown. Replace them with a single "Browse Cities & Markets →" link pointing to
`/countries/index.html`. This leaves Prices at 10 items (same count as Tools), making the two-col
layout much less dense. Both EN and AR arrays must stay in parity (same count, same positions).

#### P3-5 — Clean up Learn dropdown (IA4)

Move Methodology and FAQ from Learn to More (or a new "About" sub-group within More). Rationale:
they describe the site, not gold. Learn becomes a pure educational group (9 items). More becomes a
mixed site-info + editorial group (11 items with Methodology + FAQ added). Confirm item counts
remain in EN/AR parity.

#### P3-6 — Move Privacy and Terms to footer (IA5)

Remove Privacy and Terms from the More dropdown. They should live in the site footer only (which
already exists on most pages) — they are legal boilerplate, not primary navigation. This takes More
from 9 items to 7. Both EN and AR arrays must be trimmed in parallel; update tests if the count
assertion is hardcoded.

---

## Files impacted per phase

| Phase | Files touched                                                                    |
| ----- | -------------------------------------------------------------------------------- |
| P1    | `src/components/nav.js`, `src/components/nav-data.js` (string additions only)    |
| P2    | `styles/global.css`                                                              |
| P3    | `src/components/nav-data.js`, `tests/nav-data.test.js` (count updates if needed) |

---

## Done criteria

- **Phase 1:** All 11 `nav-data.test.js` tests pass; screen reader announces search open/close
  state; AR mode shows Arabic labels on brand, theme, and recent searches.
- **Phase 2:** `npm run build` green; no visible regressions at 360/768/1280px light+dark+RTL;
  duplicate CSS block removed; dead rules absent.
- **Phase 3:** All nav-data tests pass (update expected counts where needed); Prices dropdown ≤10
  items; Learn is pure educational content; More has no legal links; Privacy/Terms remain accessible
  via footer.

---

## What is explicitly out of scope

- Visual redesign of the nav bar (colours, typography, layout) — the bar is already premium and
  well-built.
- Adding new top-level links or groups beyond what the IA cleanup yields.
- Changing the hamburger animation, scroll-hide behaviour, or theme toggle cycle — these are working
  correctly.
- Any change to how `injectNav` is called from individual pages — the `depth` contract is stable.
