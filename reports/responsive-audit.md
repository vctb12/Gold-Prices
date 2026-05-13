# Responsive audit — site-wide static analysis

**Generated:** 2026-04-25 **Scope:** All template families covered by `styles/global.css` +
`styles/pages/*.css` (19 CSS files), the entry HTML pages, and the country / city / karat / market
template families. **Method:** **Static analysis only.** Read-only scan of CSS rules (breakpoints,
fixed widths, grid templates, tap-target sizes, font-size literals, `overflow-x`) plus inspection of
HTML inline-style hex usage. **Playwright screenshot capture at the five canonical breakpoints (320
/ 375 / 768 / 1024 / 1440) is deferred** — it requires Chromium + `npm run preview`, called out in
§5.

This audit is the **Wave A deliverable for Track 1.2 (responsive)** of the multi-track quality
program — see
[`docs/plans/2026-04-25_multi-track-quality.md`](../docs/plans/2026-04-25_multi-track-quality.md)
§1.2. It informs Wave B fix PRs sliced by template family (home/tracker, shops, country/city,
calculator, content).

Per `AGENTS.md` §6.4 / §6.5: this audit does not move canonicals, sitemap, `og:*`, `CNAME`, and does
not propose any SPA migration. It only catalogues responsive risks present in the current static
MPA.

---

## 1. Headline numbers

| Item                                                           |                                                             Result | Severity                                                                                               |
| -------------------------------------------------------------- | -----------------------------------------------------------------: | ------------------------------------------------------------------------------------------------------ |
| CSS files scanned                                              |                    19 (`styles/global.css` + `styles/pages/*.css`) | —                                                                                                      |
| Distinct media-query breakpoints                               |      **5** — `min-width: 540`, `max-width: 640 / 768 / 820 / 1024` | 🟡 see §2.A                                                                                            |
| `prefers-reduced-motion` reset blocks                          |                       11 (covered by global reset in `global.css`) | ✅                                                                                                     |
| `overflow-x: hidden` usages on root containers                 |                                2 files (`global.css`, `admin.css`) | 🟡 see §2.D                                                                                            |
| `grid-template-columns` declarations using `minmax(>320px, …)` |                                      1 (`styles/pages/invest.css`) | 🟠 **breaks at 360 px**                                                                                |
| Button-like rules with `min-height < 44px`                     | 3 (`global.css .btn = 34`, `tracker-pro.css button × 2 = 36 / 38`) | 🟠 **WCAG 2.5.5 / 2.5.8**                                                                              |
| `font-size: <13px` declarations                                |                                                                  0 | ✅                                                                                                     |
| HTML files with inline hex colour in `style=`                  |                                                          443 / 689 | 🟡 design-system Track 1.3 ties; not a responsive issue                                                |
| Fixed `width: <Npx>` declarations > 320 (any selector)         |                                                      95 across CSS | 🟡 most are max-widths on contained elements; manual review needed for any that are full-width on root |

The site already uses CSS custom properties for spacing (`--space-*`) and typography (`--text-*`)
per `styles/global.css`, and the global reduced-motion reset is in place. The structural responsive
bones are healthy.

---

## 2. Findings by category

### 2.A Breakpoint inventory — 🟡 minor; consolidate in Track 1.3

The codebase uses **5 distinct breakpoints** across the CSS files:

| Breakpoint          | Direction | Files                        |
| ------------------- | --------- | ---------------------------- |
| `min-width: 540px`  | up        | global.css                   |
| `max-width: 640px`  | down      | several `styles/pages/*.css` |
| `max-width: 768px`  | down      | global.css, several pages    |
| `max-width: 820px`  | down      | tracker-pro.css              |
| `max-width: 1024px` | down      | global.css, several pages    |

That mix is fine for a static MPA but a touch noisy. **Recommendation (Track 1.3 fold-in, not a
Track 1.2 fix PR on its own):** standardise on three named tokens documented in
`docs/DESIGN_TOKENS.md` (e.g. `--bp-sm: 640px`, `--bp-md: 768px`, `--bp-lg: 1024px`) and replace the
one-off `820` and `540` with the closest documented breakpoint. Don't churn this in a Track 1.2 fix
PR — the style consolidation belongs to Track 1.3.

### 2.B Tap-target size — WCAG 2.5.5 / 2.5.8 — 🟠 moderate

**Finding 2.B.1 — `.btn` in `styles/global.css` declares `min-height: 34px`.** This is the **default
button across the entire site**. WCAG 2.5.5 (AAA) requires ≥ 44 × 44, and the new WCAG 2.5.8 (AA,
WCAG 2.2) requires ≥ 24 × 24 with spacing. 34 px hits 2.5.8 but fails 2.5.5; on dense surfaces
(mobile nav, tracker chrome), miss-taps are likely.

**Finding 2.B.2 — `styles/pages/tracker-pro.css` declares `min-height: 36px` and `38px` for two
button rules.** Same class of issue; tracker chrome is the densest surface on the site.

**Recommendation (fix PR — Track 1.2 cluster "tracker + chrome"):** bump `--btn-min-height` to a
token (`--space-11` or a new `--touch-target: 44px`), apply to `.btn`, `.icon-btn`, and the two
tracker-pro selectors. Spot-verify visually that no current layouts overflow the row height at the
new size — use the existing `--space-*` tokens for any accompanying padding bumps. EN+AR parity
automatic (CSS only).

### 2.C Grid template breaks at narrow widths — 🟠 moderate

**Finding 2.C.1 — `styles/pages/invest.css` uses
`grid-template-columns: minmax(0, 1.3fr) minmax(340px, 0.7fr)`.** At viewport ≤ 360 px (e.g. iPhone
SE landscape, low-end Android), the second column refuses to shrink below 340 px and forces
horizontal scroll on the page even though the parent `body` has `overflow-x: hidden` (which clips,
masking the issue but cutting off content).

**Recommendation (fix PR — Track 1.2 cluster "content templates"):** lower the `minmax(340px, …)`
floor to `minmax(0, …)` inside an `@media (max-width: 640px)` block, or wrap the two columns into a
single-column stack at small widths. Test at 320 / 375 with the served preview.

### 2.D `overflow-x: hidden` on root — 🟡 minor

**Finding 2.D — `styles/global.css` and `styles/admin.css` both declare `overflow-x: hidden` on a
root-level container.** This **clips overflow rather than fixing it**, which means overflow bugs at
narrow widths (e.g. wide tables, long words, the invest grid above) become invisible to manual QA
but still trigger horizontal scroll on iOS Safari (which ignores parent `overflow-x: hidden` on root
in some scrolling contexts).

**Recommendation (fix PR — Track 1.2 cluster "global"):** keep `overflow-x: hidden` only on the
`<html>` and not on `<body>`, and add a `tests/responsive.test.js` (Playwright) check that asserts
`document.documentElement.scrollWidth === document.documentElement.clientWidth` at 320 / 375 widths
for the top 15 templates. The check, not the clip, is what should catch the bug.

### 2.E Templates / surfaces to verify in the fix-PR Playwright run

These are the surfaces most likely to have responsive issues based on density and column count. The
Wave B 1.2 fix PR should screenshot each at 320 / 375 / 768 / 1024 / 1440:

| Template                                        | Why prioritised                                                          |
| ----------------------------------------------- | ------------------------------------------------------------------------ |
| `index.html` (home hero + ticker + karat strip) | 4-column karat strip risks wrap at 360; freshness pill must stay visible |
| `tracker.html`                                  | densest chrome (5 tabs + 2 panels), tap-target finding 2.B.2             |
| `shops.html` (search + grid)                    | search input + filter chip row; grid columns                             |
| `shops/<slug>` shop detail                      | hero + map + hours table                                                 |
| `calculator.html`                               | inputs + result; tap targets on unit toggles                             |
| `invest.html`                                   | grid finding 2.C.1 above                                                 |
| `countries/index.html`                          | country grid; multi-column flag tiles                                    |
| `countries/<c>/index.html` (× 21)               | country hero + karat list                                                |
| `countries/<c>/<city>/index.html`               | city hero + nearby cities                                                |
| `countries/<c>/<city>/gold-rate/<karat>/`       | dense karat table                                                        |
| `countries/<c>/<city>/gold-shops/`              | shop list at narrow widths                                               |
| `content/guides/<slug>`                         | long-form prose; verify reading width and image responsiveness           |
| `content/news/index.html`                       | feed of cards                                                            |
| `methodology.html`                              | tables risk overflow                                                     |
| `404.html`                                      | confirm hero scales                                                      |

15 templates, 5 breakpoints = 75 screenshots. Sharable as a Playwright trace.

### 2.F Font scaling at 200% zoom — WCAG 1.4.4 / 1.4.10 — 🟠 needs runtime check

The site uses `--text-*` rem-based tokens (per stored repo memory on motion / token primitives),
which is the right baseline for WCAG 1.4.4 (text resizes proportionally with browser zoom). The risk
lives in the few `font-size: <Npx>` declarations and in any layout that hardcodes a row height.
Static scan found **0** sub-13 px declarations, which is the hard floor; hand-verify the dense
surfaces (tracker chrome, freshness pill, breadcrumbs) at 200% zoom in the fix PR.

### 2.G RTL parity at narrow widths — `AGENTS.md` §6.6 — 🟡

Every screenshot in the §2.E matrix should also be captured with `dir="rtl"` toggled (set
`localStorage.lang = 'ar'` or use the lang switch). RTL spot-check is a checkbox item per
`AGENTS.md` §6.6 — the fix PR must include before/after at least at 320 and 768 in RTL.

---

## 3. Image responsiveness — 🟡 minor; defer to Track 5.2 / image audit

`scripts/node/image-audit.js` already exists and is part of the validate gate (per `package.json`).
Re-running it inside the fix PR is the right way to catch images missing `width` / `height` /
`loading="lazy"` / `decoding="async"`. **No new responsive-audit finding** here — the existing audit
owns it. Cross-link from the Wave B 1.2 fix PR body.

---

## 4. Suggested Wave B fix PRs (output of this audit)

The fix work splits into three small PRs:

| Fix PR                                                  | Scope                                                                                                                                                                                   | Approx surface        |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| **R-1: Tap targets + invest grid** (WCAG 2.5.5 / 2.5.8) | Bump `.btn` / `.icon-btn` / tracker-pro buttons to `min-height: 44px` via a `--touch-target` token. Fix the `invest.css` `minmax(340px, …)` floor.                                      | 2 CSS files           |
| **R-2: Horizontal-scroll regression test**              | Add Playwright check that asserts no horizontal scroll at 320 / 375 across the 15 templates in §2.E. Wire into CI (Wave A only emits the check; Wave B fixes any failures it surfaces). | 1 test file + CI step |
| **R-3: RTL + zoom spot-fixes**                          | After R-1 / R-2 land, run the 75-screenshot Playwright matrix in EN + AR + zoom 200%; address any layout breaks the screenshots reveal. Sliced by template family.                      | template-specific     |

Each fix PR follows the cross-cutting guardrails in `docs/plans/2026-04-25_multi-track-quality.md`:
bilingual parity, no DOM-safety regression, no canonical movement.

---

## 5. Items deferred to a separate audit (need browser / build)

These are flagged here so the fix PRs **do not accidentally claim coverage**:

| Item                                                          | Why deferred                                                                | Where it belongs                                                  |
| ------------------------------------------------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Playwright screenshot matrix at 320 / 375 / 768 / 1024 / 1440 | Needs Chromium + `npm run preview`. Sandbox can't run it deterministically. | Wave B R-2 / R-3                                                  |
| Real-device verification (iPhone SE, low-end Android)         | Owner / reviewer responsibility.                                            | R-3 reviewer                                                      |
| 200% zoom verification                                        | Browser-only.                                                               | R-3                                                               |
| Image dimension / lazy-loading audit                          | Already owned by `scripts/node/image-audit.js`.                             | Existing validate gate                                            |
| Lighthouse mobile performance                                 | Network + Chromium.                                                         | Track 2.1 / Track H §11 follow-up — see SEO audit deferred items. |

These are the only responsive pillars not claimed by §1 / §2 / §4 above. Static-scan findings in
§2.A–§2.G are reproducible by re-running the inline scan in this audit's commit message.

---

## 6. Verification of this audit itself

- 19 CSS files matches `find styles -name '*.css'`.
- Breakpoint set in §1 reproducible by
  `grep -hoE '@media[^{]*(min|max)-width: [0-9.]+(px|rem|em)' styles/**/*.css | sort -u`.
- Tap-target findings reproducible by reading `styles/global.css` and
  `styles/pages/tracker-pro.css`.
- Invest grid finding reproducible by reading `styles/pages/invest.css` (the single
  `minmax(340px, …)` line).
- No code changes shipped. No CSS modified. No HTML moved. The 689-file inventory is unchanged.
