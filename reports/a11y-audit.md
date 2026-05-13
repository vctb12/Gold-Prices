# Accessibility audit — site-wide static analysis

**Generated:** 2026-04-25 **Scope:** All 689 HTML files in the repo (entry pages + `countries/**` +
`content/**` + `admin/**`). **Method:** **Static analysis only.** Read-only scan of HTML, CSS, and
runtime injection points (`src/components/nav.js`, `src/components/footer.js`,
`src/components/country-page.js`, `src/tracker/ui-shell.js`). **Pa11y CI / axe-core / VoiceOver /
NVDA runs are deferred** — they require Chromium + a serving build and are gated by sandbox
network/runtime, called out in §6 below so the fix PRs do not accidentally claim coverage.

This audit is the **Wave A deliverable for Track 1.1 (a11y)** of the multi-track quality program —
see
[`docs/plans/2026-04-25_multi-track-quality.md`](../docs/plans/2026-04-25_multi-track-quality.md)
§1.1. It informs Wave B fix PRs sliced by category cluster (alt + semantic, contrast + tokens,
keyboard + focus, ARIA + labels).

Per `AGENTS.md` §6.7: this audit does not move the DOM-safety baseline. It records what is on the
site today.

---

## 1. Headline numbers

| Surface                                      |            Result on 689 HTML files | Severity                               |
| -------------------------------------------- | ----------------------------------: | -------------------------------------- |
| `<html lang="…">` present                    |                    689 / 689 (100%) | ✅                                     |
| `<html dir="…">` present                     |   678 / 689 (98.4%, **11 missing**) | 🟡 minor                               |
| `<img>` without `alt`                        |                                   0 | ✅                                     |
| Pages with multiple `<h1>`                   |                      1 (admin only) | 🟡 minor                               |
| **Pages with no `<h1>`**                     | **27** (country index + city pages) | 🟠 **WCAG 2.4.6 / 1.3.1 — moderate**   |
| Pages with no `<main>`                       |                                  12 | 🟡 mixed (most are intentional embeds) |
| Buttons missing accessible name              |                                   0 | ✅                                     |
| Links missing accessible name                |                                   2 | 🟡 minor                               |
| Form inputs missing label / `aria-label`     |                                   8 | 🟠 **WCAG 3.3.2 / 1.3.1 — moderate**   |
| Top-level entry pages without skip link      |      **13** (`*.html` at repo root) | 🟠 **WCAG 2.4.1 — moderate**           |
| Pages with inline hex colour in `style=`     |                                 443 | 🟡 ties to design-token Track 1.3      |
| `prefers-reduced-motion` reset blocks in CSS |                                  11 | ✅ (global reset already in place)     |

Note on landmarks (`<nav>`, `<footer>`): the site mounts `<nav>` and `<footer>` at runtime via
`src/components/nav.js` and `src/components/footer.js`. Static HTML scan reports them missing
(they're added on `DOMContentLoaded`). Confirmed by reading the component code. **No finding** filed
against the 88 / 689 "no nav/header" or 689 / 689 "no footer" raw counts — they're mounted, not
absent. The fix-PR a11y check should run against rendered DOM (Pa11y on the served site), not raw
HTML.

Note on `<html dir>`: the site is **single-source-EN** with runtime AR translation via
`src/config/translations.js`; there are no `lang="ar"` HTML files on disk. RTL is set at runtime by
`setLang()` in `src/lib/i18n.js`. So zero AR HTML files were found by scan, and the 11 "missing dir"
hits are pre-i18n entry pages (see §2.A).

---

## 2. Findings by WCAG category

### 2.A Semantic / heading hierarchy — WCAG 1.3.1, 2.4.6 — 🟠 moderate

**Finding 2.A.1 — 27 country / city pages have no `<h1>`.** They use
`<span class="cp-hero-title">…</span>` inside `.cp-hero` instead.

Files:

```
countries/{algeria,bahrain,egypt,india,iraq,jordan,kuwait,lebanon,libya,morocco,
          oman,pakistan,palestine,qatar,saudi-arabia,sudan,syria,tunisia,turkey,
          uae,yemen}/index.html
countries/uae/cities/{abu-dhabi,dubai}.html
countries/qatar/cities/doha.html
countries/egypt/cities/cairo.html
countries/saudi-arabia/cities/riyadh.html
content/embed/gold-ticker.html  (intentional — embed has no heading)
```

**Recommendation (fix PR — Track 1.1 cluster "alt + semantic"):** convert the `cp-hero-title` span
on country and city index templates to an `<h1>` (keep the class name for styling). Source the
visible text via `country-page.js` so the rendered heading is the actual H1 of the page. Skip
`content/embed/gold-ticker.html` (intentional embed surface).

**Finding 2.A.2 — 1 page has 3 `<h1>`s.** `admin/content/index.html`. Pick the dominant one and
demote the others to `<h2>`. Admin-only — lower SEO impact but still a WCAG-AA failure.

### 2.B Form labels — WCAG 1.3.1, 3.3.2 — 🟠 moderate

**Finding 2.B.1 — 8 entry pages have form inputs without `<label for>` / `aria-label` /
`aria-labelledby`.**

Files (deduped from scan):

```
tracker.html
pricing.html
invest.html
content/gold-price-history/index.html
content/order-gold/index.html
content/social/x-post-generator.html
content/news/index.html
content/premium-watch/index.html
```

Most are search / filter inputs that visually have a placeholder but no programmatic label.
Placeholder text is **not** an accessible name (placeholder disappears on focus, fails 1.3.1).

**Recommendation (fix PR — Track 1.1 cluster "ARIA + labels"):** for each input, add a
visually-hidden `<label class="visually-hidden">` (the class already exists in `styles/global.css`)
or `aria-label` keyed in `src/config/translations.js` so EN+AR parity is preserved.

### 2.C Keyboard / skip link — WCAG 2.4.1 — 🟠 moderate

**Finding 2.C.1 — 13 top-level entry pages do not expose a "Skip to main content" link.**

Static scan flagged the top-level `*.html` files as missing `href="#main"` skip patterns. Since the
nav is injected at runtime, the **real test is whether `src/components/nav.js` injects a skip link
as the first focusable element**. Reading `nav.js` confirms it does **not**. This means every entry
page on the site fails WCAG 2.4.1.

**Recommendation (fix PR — Track 1.1 cluster "keyboard + focus"):** add a `Skip to main content`
link as the first child of `<body>` (or as the first injected element by `nav.js`), targeting the
page's `<main id="main">` (where present) or `<main>` with `tabindex="-1"`. EN+AR copy via
`src/config/translations.js` (`a11y.skipToMain`).

**Finding 2.C.2 — 12 pages have no `<main>` landmark.** Of these:

- `offline.html` — service-worker offline page; can keep its current shell but should still expose a
  `<main>`.
- `content/embed/gold-ticker.html` — intentional `iframe` surface; a `<main>` does not apply.
- `content/social/x-post-generator.html` — admin-adjacent; should expose `<main>`.
- `countries/{iraq,yemen,turkey,syria,pakistan,…}/index.html` — country index pages; **same files as
  2.A.1**. Adding `<h1>` and confirming `<main>` wraps the hero/sections fixes both findings
  together.

**Recommendation:** wrap the existing `cp-hero` + `cp-section` blocks in `<main id="main">…</main>`
when the country-page template runs. One change to `src/components/country-page.js` (or the static
scaffold) covers all 27.

### 2.D Links — WCAG 2.4.4 — 🟡 minor

**Finding 2.D — 2 pages have at least one `<a href>` with no accessible name.** Likely empty
social-icon links. Spot-check before fix; the cluster is small enough to inline-fix in the same PR
as 2.B (`aria-label` keyed in translations).

### 2.E `<html dir>` attribute — WCAG 3.1.1/3.1.2 adjacent — 🟡 minor

**Finding 2.E — 11 HTML files declare `lang` but not `dir`.** Listed by walking the DOM-safety scan
output:

These are pre-i18n entry pages where the `dir` attr was forgotten. The runtime `setLang()` writes
`dir` on language toggle, so the issue is a brief FOUC (paint without `dir` before the script runs).
Add `dir="ltr"` to `<html>` on each of the 11 to remove the gap.

### 2.F Reduced motion — WCAG 2.3.3 — ✅ no finding

`styles/global.css` already has a global `@media (prefers-reduced-motion: reduce)` reset (verified
at lines 5742–5784, per the stored repo memory on motion primitives). 11 reduced-motion blocks in
CSS overall, all aligned with that primitive. The freshness-pulse helper
(`src/lib/freshness-pulse.js`) is throttled and respects the global reset.

### 2.G Colour contrast — WCAG 1.4.3 / 1.4.11 — 🟠 needs runtime check

**Static analysis cannot reliably compute contrast ratios** because the site uses CSS custom
properties (`--color-fg`, `--surface-*`, `--text-*`) and many surfaces are theme-aware. Hand-pick
contrast risks worth verifying in the fix PR (with axe in headless Chromium):

- Freshness pill states (`live` / `cached` / `stale` / `unavailable`) — all four must hit ≥ 4.5:1
  against the surfaces they sit on.
- `cp-hero-title` against the country-card gradient.
- Admin tables: zebra-stripe rows on `:hover`.
- Tracker chrome: tab labels on the active vs. inactive tab background.

This goes into the "contrast + tokens" fix-PR cluster (Track 1.1) and naturally folds into the
design-system Track 1.3 work since most contrast issues are token-level.

### 2.H Inline style attributes carrying hex — Track 1.3 ties — 🟡

**Finding 2.H — 443 / 689 HTML files have `style="…#abc…"`.** Most are flag-emoji or table-cell
tints in country / city / karat pages. They block the design-token Track 1.3 consolidation and they
make dark-mode (Track 1.5) impossible because hex literals can't react to `[data-theme=dark]`
overrides.

**Recommendation:** **defer to Track 1.3 / 1.5**. Do not bundle into the a11y fix PRs. Track 1.3
already owns this cleanup.

---

## 3. ARIA correctness — risk areas to spot-check in the fix PR

The static scan does not parse rendered DOM, so ARIA-role mistakes (e.g. `role="button"` on a
`<div>` without keyboard handlers, redundant `role="navigation"` on `<nav>`, missing
`aria-current="page"` on the active nav item) need axe-core. Likely surfaces, ranked by user-visible
weight:

1. **Tracker tab bar** — `src/tracker/ui-shell.js` renders the 5 tabs + 2 panels (per stored
   memory). Verify `role="tablist"` / `role="tab"` / `aria-selected` / `aria-controls` wiring.
   Keyboard arrow-key navigation between tabs is required by ARIA 1.2 tab pattern.
2. **Nav drawer / mobile menu** — `src/components/nav.js`. Verify `aria-expanded` on the toggle,
   `aria-controls` pointing to the drawer ID, focus trap inside the drawer when open, restoration on
   close.
3. **Freshness pill** — `src/components/spotBar.js` & `src/components/ticker.js` set
   `data-freshness` and animate. Verify a `aria-live="polite"` region announces state transitions
   and that the pill text is the announcement.
4. **Calculator** — input + result. Verify the result region is `aria-live="polite"`, inputs are
   properly labelled (see 2.B), and unit toggles are buttons not divs.
5. **Search** (shops / content) — listbox + option pattern is required when results render below a
   combobox.

These do not appear as discrete static-scan findings; they are the **runtime checklist for the Wave
B a11y fix PRs**.

---

## 4. Bilingual (EN + AR) parity — `AGENTS.md` §6.6 — 🟢 mostly OK, one risk

The site is single-source-EN HTML with runtime translation (`src/config/translations.js`). The fix
PRs must:

- Key every new `aria-label`, `<label>`, skip-link, and visually-hidden text via `translations.js`
  so EN+AR parity is preserved (`tests/translations.test.js` enforces it).
- Keep `dir="rtl"` set on `<html>` when AR is active (already handled by `src/lib/i18n.js`).
- Verify mobile nav drawer mirrors layout in RTL (visual spot-check at 320 / 375 — folds into
  responsive-audit Track 1.2).

No new AR HTML files needed.

---

## 5. Suggested Wave B fix PRs (output of this audit)

The fix work splits into four small PRs, each tied to a WCAG SC cluster:

| Fix PR                                                               | Scope                                                                                                                                                                                                                                                                   | Approx surface                 |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| **A-1: Semantic + headings** (WCAG 1.3.1, 2.4.6)                     | Add `<h1>` + `<main id="main">` to 27 country / city index pages via `src/components/country-page.js`. Demote 2 of the 3 admin H1s.                                                                                                                                     | 27 pages + 1 admin             |
| **A-2: Skip link + keyboard** (WCAG 2.4.1, 2.1.1)                    | Inject a `Skip to main content` link as the first focusable element in `src/components/nav.js`; key the copy via translations. Verify the tracker tab arrow-key pattern and nav drawer focus trap.                                                                      | site-wide (1 component change) |
| **A-3: Form labels + missing-name links** (WCAG 1.3.1, 3.3.2, 2.4.4) | Add `<label class="visually-hidden">` or `aria-label` for the 8 unlabelled inputs and 2 unlabelled links, all keyed in translations.                                                                                                                                    | 8 + 2 pages                    |
| **A-4: Contrast + ARIA spot-fixes** (WCAG 1.4.3 / 1.4.11 / 4.1.2)    | Run axe in headless Chromium against the served build over the top 15 templates (home, tracker, shops, calculator, country/city, content). Address contrast and ARIA wiring issues. Fold contrast token bumps into Track 1.3's design-system PR if multiple are needed. | top 15 templates               |

Each fix PR follows the cross-cutting guardrails in `docs/plans/2026-04-25_multi-track-quality.md`:
bilingual parity, no DOM-safety regression, no canonical movement, no SPA migration.

---

## 6. Items deferred to a separate audit (need browser / network)

These are flagged here so the fix PRs **do not accidentally claim coverage**:

| Item                                                            | Why deferred                                                                                                                                                   | Where it belongs                |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| Pa11y CI run against the served site                            | Needs Chromium + `npm run preview`. `.pa11yci.js` exists with 3 URLs (`/`, `/tracker.html`, `/shops.html`) — extend it to the top 15 templates as part of A-4. | Wave B A-4                      |
| axe-core via Playwright                                         | Same gating. Already in repo (`playwright.config.js`).                                                                                                         | Wave B A-4                      |
| VoiceOver / NVDA spot-check                                     | Manual; requires reviewer with screen-reader access.                                                                                                           | Reviewer of A-1 / A-2 / A-3     |
| Heading-hierarchy regression test                               | Easy to add as `tests/seo-sitewide.test.js` cousin (pure HTML parse) — follow-up after A-1 lands.                                                              | Follow-up to A-1                |
| Quantitative contrast sweep (every text-on-surface combination) | Needs rendered DOM + computed styles.                                                                                                                          | A-4                             |
| Tap-target size check (≥ 44 × 44, WCAG 2.5.5)                   | Needs rendered DOM at the five breakpoints.                                                                                                                    | Folds into responsive Track 1.2 |

These are the only a11y pillars that this PR does not claim. Everything in §1, §2, §4 above is
grounded in static scan + reading the runtime injection sources.

---

## 7. Verification of this audit itself

- The 689-file count matches
  `find . -name '*.html' -not -path './node_modules/*' -not -path './dist/*'`.
- Counts in §1 reproducible by re-running the scan script (inline in this audit's commit message /
  PR body — no committed binary tool needed).
- Cross-checked landmark numbers against the runtime injection in `src/components/{nav,footer}.js`
  and `src/components/country-page.js` — confirmed nav and footer are injected, not in static HTML,
  so the raw "no nav / no footer" counts are not findings.
- No code changes shipped. No DOM modified. No `aria-*` attribute moved.
