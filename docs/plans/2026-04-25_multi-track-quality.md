# Multi-track quality, SEO, testing, docs, CI & release plan

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

**Origin:** User prompt · 2026-04-25 **Status:** 🟡 IN PROGRESS — PR 1 (this file + intake row) ✅
landed. PR 2 (SEO audit · Wave A) ✅ landed → [`reports/seo-audit.md`](../../reports/seo-audit.md).
PR 3 (a11y + responsive audits · Wave A) ✅ landed →
[`reports/a11y-audit.md`](../../reports/a11y-audit.md),
[`reports/responsive-audit.md`](../../reports/responsive-audit.md). PR 4 (Wave B-1 SEO fixes:
duplicate Tripoli title disambiguation, 13 over-length meta descriptions trimmed,
`og:url === canonical` cross-check) ✅ landed. PR 5 (2026-04-27 multi-batch — Track 1.4
[`reports/ux-friction.md`](../../reports/ux-friction.md), Track 2.3
[`reports/internal-linking.md`](../../reports/internal-linking.md), Track 4.1 README quickstart
refresh, Track 4.3 CONTRIBUTING ↔ AGENTS.md alignment, Track 4.4 narrow `src/lib/` audit, Track 5.4
[`reports/env-audit.md`](../../reports/env-audit.md)) ✅ landed. PR 6 (2026-04-28 Round 9 — Track
3.2 E2E flows: `lang-toggle.spec.js` + `tracker-flow.spec.js` for flows 1 + 2 from the
critical-flows list; Track 1.3 freshness coverage: `tests/freshness-coverage.test.js`) ✅ landed. PR
7+ pending. **Reconcile into:** [`docs/REVAMP_PLAN.md`](../REVAMP_PLAN.md) — each track folds into
its matching section as PRs land (§22 production tracks owns most of it; §6.x guardrails apply to
all). Track 2 SEO results feed §11 (Track H — SEO & metadata).

This proposal captures a 20-task program that spans frontend/UX, SEO, testing, documentation, CI/CD,
and release shipping. Trying to do all 20 in one PR would itself violate the autonomy contract —
huge churn, uninspectable diff. The plan below sequences them into reviewable slices, each shippable
independently, with audits landing first so the owner can redirect cheaply.

Nothing here weakens the §6 product-trust guardrails in [`AGENTS.md`](../../AGENTS.md): no
spot-vs-retail blurring, freshness labels stay, EN/AR parity, DOM-safety baseline doesn't regress,
no SPA migration, canonical apex (`goldtickerlive.com`) untouched.

---

## Sequencing principle

Three waves, ordered so cheap correctness/trust wins land first and bigger redesign-ish passes land
last with evidence:

- **Wave A — Audits & guardrails (read-only / additive):** every "audit" task ships first as a
  written audit + report, no behavior change. Gives the owner a chance to redirect before
  implementation cost is sunk.
- **Wave B — Surgical fixes:** each audit is followed by a scoped fix PR.
- **Wave C — Larger passes:** dark mode, design-token consolidation, E2E suite — items needing
  broader code change — land last, after Waves A/B have de-risked the surface.

Each PR follows the Autonomy Contract in [`AGENTS.md`](../../AGENTS.md) §4: explore → expand → plan
→ implement → verify → ship. PR bodies use What/Why/How/Proof/Risks.

---

## Track 1 — Frontend / UX

### 1.1 Accessibility audit (Wave A → Wave B)

- **Audit deliverable:** `reports/a11y-audit.md`. Cover all entry HTML pages plus tracker, shops,
  calculator, country/city templates, admin. Method: Pa11y CI (`.pa11yci.js` already exists),
  axe-core via Playwright, manual keyboard sweep, screen-reader spot-check (VoiceOver/NVDA),
  heading-hierarchy script.
- **Categories audited:** alt text, color contrast (WCAG 1.4.3 / 1.4.11), keyboard traps & focus
  order (2.1.1, 2.4.3, 2.4.7), ARIA labels & roles (4.1.2), heading hierarchy (1.3.1, 2.4.6),
  landmark/semantic HTML (1.3.1), link purpose (2.4.4), form labels (3.3.2), reduced-motion respect
  (2.3.3 — already enforced globally per `styles/global.css`), language attributes for AR pages
  (3.1.1/3.1.2).
- **Fix PRs:** one per category cluster (alt text + semantic HTML; contrast + tokens; keyboard +
  focus; ARIA + labels). Each fix cites the WCAG SC in PR body.
- **Bilingual:** every copy/aria-label change ships EN+AR via `src/config/translations.js`.
- **Verification:** Pa11y CI passes; axe Playwright run added to CI; before/after issue counts in PR
  body.

### 1.2 Responsive pass (Wave A → Wave B)

- **Audit deliverable:** `reports/responsive-audit.md`. Use Playwright to capture screenshots at
  320, 375, 768, 1024, 1440 for the top ~15 templates (home, tracker, shops list, shop detail,
  calculator, invest, country index, country detail, city detail, karat, market, learn, news,
  methodology, 404).
- **Catalogue:** overflow, awkward wrap, broken layout, tap-target < 44×44 (WCAG 2.5.5/2.5.8), font
  scaling at 200% zoom (WCAG 1.4.4/1.4.10), horizontal scroll at 320.
- **Fix PRs:** sliced by template family (home/tracker, shops, country/city, calculator, content).
  Use existing `--space-*` / `--text-*` tokens; no new media-query strategies; no framework
  migration.
- **Verification:** Playwright visual diff at the five breakpoints; before/after attached to each
  PR.

### 1.3 Design system consistency (Wave A → Wave C)

- **Audit deliverable:** `reports/design-system-audit.md`. Inventory raw hex / rgb / px / shadow /
  radius literals across `styles/**` and inline `style=` / `el({style})` usages. Cross-reference
  against tokens in `styles/global.css` (`--color-*`, `--surface-*`, `--space-*`, `--text-*`,
  `--radius-*`, `--shadow-*`, `--ease-*`, `--duration-*`).
- **Consolidation plan:** for every literal, propose either a token mapping or a new token (named
  per existing convention). Group by component (button, card, panel, nav, ticker, freshness pill,
  form input).
- **Fix PRs:** one per concern — buttons → cards/panels → forms → nav → tracker chrome. Each PR is a
  token-substitution PR with no visual diff except where a literal was off-system; PR body shows
  pixel-diff screenshots to prove no regression.
- **Guard:** add a stylelint rule (or extend the existing config) to forbid raw hex / px outside
  `:root` token blocks. Doesn't introduce churn-only formatting.

### 1.4 UX friction sweep (Wave A → Wave B)

- **Audit deliverable:** `reports/ux-friction.md`. Ranked list of: unclear errors, missing loading
  states, slow feedback, dead clicks (anchors that don't navigate, buttons that no-op), confusing
  labels, missing empty states (shops with zero results, search with no hits, admin lists,
  calculator with bad input).
- **Method:** walkthrough each primary flow (price-check, calculator, shop search, language toggle,
  admin login + edit). Source from existing telemetry/CSP-error/console logs if available.
- **Fix PRs:** top 10 issues, one PR each or bundled by surface. Improve what exists; don't
  redesign. EN+AR copy via `src/config/translations.js`.

### 1.5 Dark mode pass (Wave C)

- **Plan:** introduce `:root[data-theme=dark]` token overrides on top of existing `--color-*` /
  `--surface-*` tokens. Default to `prefers-color-scheme` with manual toggle persisted in
  `localStorage` under `gtl:theme`. Toggle in nav (EN+AR labels). Apply via inline blocking
  `<script>` in `<head>` of every entry page to set `data-theme` before paint — avoids FOUC/flicker.
- **Coverage:** every component reads tokens (no hardcoded colors → ties to 1.3); images that assume
  light bg get `prefers-color-scheme` `<picture>` swaps where needed; brand gold accent stays
  consistent in both modes; freshness pill states (live/cached/stale/unavailable) revalidated for
  contrast (WCAG 1.4.3 ≥ 4.5:1).
- **Verification:** axe contrast pass in both themes; Playwright screenshots of top 10 templates in
  dark; manual flicker test (network throttled, slow CPU).
- **Out of scope:** redesigning anything; switching to a CSS-in-JS theming lib.

---

## Track 2 — SEO & discoverability

### 2.1 SEO audit (Wave A → Wave B)

- **Audit deliverable:** `reports/seo-audit.md`. Reuses `scripts/node/inventory-seo.js` output
  (already a `validate` gate) plus a fresh Lighthouse SEO + Core Web Vitals run on the top 20
  templates.
- **Catalogue per page:** title length, meta description length/uniqueness, canonical correctness
  (must remain `goldtickerlive.com` apex), broken internal links (Linkinator), structured data
  validity, URL structure (countries are `/countries/<slug>/` — don't break that), image
  dimensions/lazy/decoding, render-blocking resources, LCP/CLS/INP scores.
- **Fix PRs:** sliced per concern (titles+meta, canonicals, broken links, CWV). Each PR lists pages
  changed.

### 2.2 Structured data pass (Wave B)

- **Plan:** add or improve JSON-LD per page type — `Article` (guides/news), `Product` / `Offer` only
  where retail prices are actually shown (and labelled — guardrail §6.1), `FAQPage` (only on pages
  with visible FAQ), `BreadcrumbList` (country/city/shop), `Organization` (homepage),
  `LocalBusiness` (shop detail), `WebSite` + `SearchAction` (homepage).
- **Validation:** schema.org validator + Google Rich Results Test in CI (additive script).
- **Constraint:** never schema for content not actually on the page — fail the validator script if a
  JSON-LD field has no DOM equivalent.

### 2.3 Internal linking pass (Wave A → Wave B)

- **Audit deliverable:** `reports/internal-linking.md`. Build site-wide link graph from generated
  `dist/` HTML + `countries/`. Identify orphan pages (no inbound links), weak hubs (< N inbound),
  and missed contextual opportunities (e.g. country page → city pages, karat page → calculator).
- **Fix PRs:** add contextual links sliced by hub (countries hub, karat hub, content hub, market
  hub). No nav stuffing; no footer link farm. Each link addition is editorial and bilingual.

### 2.4 Metadata + canonical + social previews (Wave B)

- **Audit:** every page's `<title>`, meta description, `link rel=canonical`, `og:*`, `twitter:*`.
  Diff against `inventory-seo.js` output.
- **Fix PR:** consolidate to a small `setHead()` helper or per-template constants; ensure canonical
  apex (no `www`); ensure `og:image` exists and is 1200×630; add `og:locale` + `og:locale:alternate`
  for AR/EN parity; ensure `<link rel=alternate hreflang>` pairs are mutual.
- **Deliverable:** PR body lists every page changed.

---

## Track 3 — Testing

### 3.1 Coverage analysis & expansion (Wave A → Wave B)

- **Tooling:** add c8 over `node --test` (existing harness — `package.json` scripts +
  `.github/workflows/ci.yml`). No new test framework.
- **Audit deliverable:** `reports/coverage.md`. Current coverage % per directory; ranked list of
  under-tested critical paths: `server/lib/auth.js` (token rotation), `server/lib/site-url.js`
  (allow-list), `src/lib/safe-dom.js`, freshness state machines (`src/components/spotBar.js`,
  `src/components/ticker.js`), translation completeness, hash router (`src/tracker/state.js`), nav
  data invariants (already strong).
- **Fix PRs:** one per module cluster. Prioritize edge cases (timezone boundaries, stale data,
  malformed hashes, RTL) over trivial getters.
- **Coverage gate:** add a soft floor in CI (don't drop below baseline) — not a hard %.

### 3.2 E2E tests for critical flows (Wave C)

- **Framework:** Playwright is already configured (`playwright.config.js`). Reuse it.
- **Critical flows (5):**
  1. ✅ Home → tracker → mode tabs → method panel (Round 9 · `tests/e2e/tracker-flow.spec.js`).
  2. ✅ Language toggle EN ↔ AR persists across navigation; key strings render in AR (Round 9 ·
     `tests/e2e/lang-toggle.spec.js`).
  3. Shops directory: search, filter, open detail.
  4. Admin login (with test creds via env), edit a piece of content, see it reflected.
  5. Hourly freshness state: simulate live → cached → stale and assert pill + ARIA states.
- **CI:** run on PR; record traces on failure; shard if > 2 min.

### 3.3 Flaky test stabilization (Wave B)

- **Method:** rerun suite N=20 in CI matrix; collect failures; classify (timing, shared state,
  network, ordering, locale).
- **Fix per category:** replace `setTimeout` waits with `waitFor`; isolate fixtures; mock outbound
  HTTP; freeze `Date.now`; pin locale.
- **Constraint:** never `.skip` as a "fix" — flag any irreducible flake in `reports/flaky-tests.md`
  with diagnosis + proposed next step.

### 3.4 Test quality review (Wave A → Wave B)

- **Audit deliverable:** `reports/test-quality.md`. Flag tests with: no assertions, only snapshot
  assertions, over-mocking (mocks the SUT itself), duplicates, tautologies, tests that pass when
  source is mutated (mutation testing spot-check via Stryker on `src/lib/` and `server/lib/` —
  additive dev-dep, behind a script, not in default CI).
- **Fix PR:** improve or delete flagged tests, with rationale per test.

---

## Track 4 — Documentation

### 4.1 Documentation pass (Wave B)

- Update `README.md`: quickstart, env vars (cross-link `docs/environment-variables.md`),
  build/deploy, test commands.
- JSDoc on all exported functions in `src/lib/**` and `server/lib/**` (public surface only).
- Document env vars in one canonical place (extend `docs/environment-variables.md`); flag
  undocumented ones with a script.
- Constraint per `.github/instructions/docs.instructions.md`: docs-only PR, no behavior change.

### 4.2 ARCHITECTURE.md (Wave B)

- New file at repo root. ~15-min read. Sections: components (static site, admin server, Python
  automations, GH Actions), data flow (price ingest → JSON → static pages + ticker → social posts),
  key decisions (static MPA over SPA, JWT+bcrypt, Supabase RLS, hourly poster, CNAME apex),
  trade-offs (rebuild cadence vs. freshness, server-required env vars at boot).
- Cross-link from `README.md` and `AGENTS.md`.

### 4.3 CONTRIBUTING.md (Wave B)

- Already exists — audit it. Update with current commands (`npm test` / `lint` / `validate` /
  `quality` / `build`), branch/commit conventions, PR expectations (What/Why/How/Proof/Risks per
  `AGENTS.md`), how to file an issue, the PR-only / no-force-push rule, the EN+AR parity
  requirement.

### 4.4 Inline comment cleanup (Wave B)

- Sweep `src/**` and `server/**` for: outdated comments, obvious comments (`// increment i`),
  commented-out code blocks (delete unless flagged TODO/FIXME with owner+date).
- Add comments only where intent is non-obvious (state-machine transitions, regex rationales,
  security checks).
- No code-behavior change; small focused PRs per directory.

---

## Track 5 — Build, CI/CD, tooling

### 5.1 CI/CD hardening (Wave A → Wave B)

- **Audit:** `reports/ci-audit.md`. Per workflow in `.github/workflows/`: average runtime, p95,
  failure rate, cache hit rate, redundant steps. Special attention to `post_gold.yml` (production
  hourly — guardrail §6.10, do not break).
- **Fixes:** add `actions/setup-node` cache + `actions/cache` for `node_modules` / Vite cache /
  Playwright browsers; collapse duplicated install steps; parallelize independent test/lint jobs;
  pin action SHAs; add concurrency groups to cancel superseded runs; ensure `pytest` is wired
  (currently only `node --test` + ruff run).
- **Verification:** before/after pipeline duration in PR body for each workflow touched.

### 5.2 Dependency cleanup (Wave A → Wave B)

- **Tooling:** `depcheck` (unused), `npm outdated`, `npm audit`, `gh-advisory-database` MCP for any
  new dep.
- **Audit deliverable:** `reports/deps-audit.md`. Per dep: status
  (used/unused/duplicate/outdated/vulnerable), recommended action.
- **Fix PRs:** remove unused; apply safe minor/patch bumps in one PR per ecosystem (npm, pip, GH
  Actions); list majors separately for owner approval — do not bump them.
- Same audit for `scripts/python/` requirements and GitHub Actions versions.

### 5.3 Linter & formatter (Wave B)

- Audit `eslint.config.mjs`, `.stylelintrc.json`, `.prettierrc.json`. Tighten rules the codebase
  already follows in 95%+ of cases (e.g. `no-console` outside `scripts/`, `no-restricted-imports`
  already in place). Relax noisy rules with no real-world catches.
- Ensure husky pre-commit (`.husky/`) runs lint+format on staged files only (lint-staged) — fast.
- Ensure CI runs the same set.
- **Constraint:** no churn-only formatting commits; if a rule change would touch >50 files, defer or
  autofix in a separate PR labelled "no-review-needed-formatting".

### 5.4 Env & config audit (Wave A → Wave B docs-only)

- **Audit deliverable:** `reports/env-audit.md`. Every `process.env.*` reference, every
  `import.meta.env.*`, every secret name in workflows. Cross-reference against
  `docs/environment-variables.md`.
- Confirm none are committed (check `git log` for known patterns; secret-scanning is on for the
  org).
- Verify dev/staging/prod separation (the auth boot-time check is documented per `AGENTS.md` §2 —
  keep it).
- Document each variable: name, purpose, where consumed, required/optional, default, example.
- **Constraint:** no runtime behavior change.

---

## Track 6 — Review & shipping

### 6.1 Strict code-review pass (continuous, per-PR)

- Every PR in this program gets the strict-reviewer treatment: correctness, edge cases, security
  (XSS via DOM-safety baseline, JWT handling, redirect allow-list), performance (Lighthouse delta),
  naming, consistency with tokens & translations.
- Use `parallel_validation` (Code Review + CodeQL) before finalizing each PR.

### 6.2 Pre-deploy checklist (one-shot, late in program)

- Add `scripts/node/pre-deploy-check.js`: build green, tests green, no `console.error/warn` from
  build, no broken internal links (Linkinator on `dist/`), env vars all documented, CSP regression
  test green, freshness audit green, sitemap coverage green, CNAME unchanged, `robots.txt` unchanged
  unless intentional.
- Output: go/no-go summary in CI artifact + PR comment.

### 6.3 Changelog & release notes (recurring)

- Adopt a lightweight conventional-commit-ish convention (already partly used).
- Add `scripts/node/changelog.js` to group commits since last tag into Added / Changed / Fixed /
  Removed and rewrite into user-facing language. Cite PR numbers.
- Update `CHANGELOG.md` per release. First run covers everything since the last tag.

---

## Cross-cutting guardrails (every PR in this program)

- PR-only, no direct push, no force-push (`AGENTS.md` §6.9).
- Bilingual EN+AR parity for any user-visible string (§6.6).
- DOM-safety baseline (`scripts/node/check-unsafe-dom.js`) does not regress (§6.7).
- Spot/reference vs. retail distinction preserved; freshness labels preserved (§6.1–§6.3).
- SEO integrity: don't silently move canonicals, sitemap, `robots.txt`, `og:*`, `CNAME` (§6.4) —
  anything intentional is called out explicitly.
- Static MPA architecture stays static (§6.5).
- `post_gold.yml` and `scripts/python/utils/*` import layout untouched unless the PR is explicitly
  about it (§6.10).
- Honest verification: PR body separates what was run from what was assumed (§6.11).

---

## Suggested execution order (concrete first 6 PRs)

1. **PR 1 (this PR, docs-only):** capture this plan + intake row.
2. **PR 2 (audit-only):** SEO + metadata + structured data audit reports under `reports/`. No code
   change.
3. **PR 3 (audit-only):** A11y + responsive audit reports + screenshots.
4. **PR 4 (fix):** SEO/metadata/canonical fixes — highest ROI on trust/discoverability axis, lowest
   risk.
5. **PR 5 (fix):** A11y high-severity fixes (contrast, missing alt, focus traps).
6. **PR 6 (fix):** UX friction top 10.

Then Track 3 (testing), Track 4 (docs), Track 5 (CI/deps/lint/env) in parallel branches. Wave C
(dark mode + E2E) finishes the program.

---

## What this plan will NOT do

- No SPA migration, no framework introduction (`AGENTS.md` §6.5).
- No `www.` reintroduction in canonicals (CNAME apex stays).
- No major-version dep bumps without owner approval.
- No `.skip` on flaky tests as a "fix".
- No JSON-LD for content not visible on the page.
- No churn-only formatting PRs.
- No edits to `.github/agents/`.
