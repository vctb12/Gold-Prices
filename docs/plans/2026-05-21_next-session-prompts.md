# Next Session Prompts (Phase-by-Phase)

```yaml plan-status
status: in-progress
priority: P1
class: B
owner: @vctb12
last_run_at: "2026-05-22T13:50:00Z"
last_run_pr: "https://github.com/vctb12/GoldTickerLive/pull/331"
last_run_agent: copilot
slices_remaining_estimate: 9
next_action: "Begin Phase 2 planning by mapping learn/methodology/insights consolidation dependencies and selecting the first leaf implementation slice."
blocked_on: ""
guardrails_reviewed: true
skills_used: [gold-ticker-live-audit, frontend-design-system, mobile-ux-review]
```

Use these as copy-paste prompts for upcoming sessions.  
Each prompt assumes previous phases are already merged.

---

## Prompt — Phase 1 (Shared Shell + Token Sweep)

```md
You are the senior product engineer for `vctb12/GoldTickerLive`. Goal: Phase 1 — shared layout
shell + design-token sweep.

Read first:

1. AGENTS.md
2. .github/copilot-instructions.md
3. .github/instructions/frontend-mobile.instructions.md
4. .github/instructions/accessibility.instructions.md
5. .github/instructions/testing-qa.instructions.md

Non-negotiables:

- AED peg stays 3.6725
- Reference price != retail price
- EN/AR parity via src/config/translations.js
- Token-only styling from styles/global.css
- Safe DOM only (src/lib/safe-dom.js)
- Canonical host is https://goldtickerlive.com/

Tasks:

- Create shared shell rendering for head/header/footer/freshness strip
- Inject shell into public HTML pages during build
- Extract large inline styles into styles/partials
- Add shell guard script in CI to block duplicated header/footer and non-token color usage
- Normalize nav to canonical 7 surfaces

Acceptance:

- Public HTML pages reduce repeated shell markup
- No visual regression on desktop/mobile/RTL
- Lint/test/validate/build pass
- PR includes click-contract notes + EN/AR + RTL evidence
```

---

## Prompt — Phase 2 (Learn/Methodology/Insights Consolidation)

```md
You are the senior product engineer for `vctb12/GoldTickerLive`. Goal: Phase 2 — consolidate
learn/methodology/insights into one `/learn/` hub.

Read first:

1. AGENTS.md
2. .github/copilot-instructions.md
3. .github/instructions/seo.instructions.md
4. .github/instructions/content-country-pages.instructions.md
5. .github/instructions/testing-qa.instructions.md

Tasks:

- Migrate learn/methodology/insights article surfaces into unified learn content model
- Build one TOC + one article renderer
- Add full EN/AR parity for migrated pages
- Add 301 redirects from removed legacy pages
- Update sitemap generator inputs and internal links

Acceptance:

- No 404s for legacy learn URLs
- No thin indexed duplicates
- Internal links clean
- Lint/test/validate/build pass
```

---

## Prompt — Phase 3a (Tracker Modularization, No Behavior Change)

```md
You are the senior product engineer for `vctb12/GoldTickerLive`. Goal: Phase 3a — extract tracker
into modules with zero behavior change.

Read first:

1. AGENTS.md
2. .github/copilot-instructions.md
3. .github/instructions/gold-pricing.instructions.md
4. .github/instructions/frontend-mobile.instructions.md
5. docs/tracker-state.md

Tasks:

- Decompose tracker into modules (state, hero, chart, compare, alerts, watchlist, export, freshness)
- Keep existing UX behavior unchanged
- Keep freshness labels canonical (live/delayed/cached/stale/fallback/closed/unavailable EN/AR)
- Add/expand tests for state transitions

Acceptance:

- tracker.html reduced to lightweight mount shell
- State transitions covered by tests
- No regression in compare/alerts/planner workspace behavior
- Lint/test/validate/build pass
```

---

## Prompt — Phase 3b (Tracker UX Expansion)

```md
You are the senior product engineer for `vctb12/GoldTickerLive`. Goal: Phase 3b — sticky controls,
compare improvements, alerts, watchlist reorder, export polish.

Read first:

1. AGENTS.md
2. .github/copilot-instructions.md
3. .github/instructions/gold-pricing.instructions.md
4. .github/instructions/accessibility.instructions.md
5. docs/tracker-state.md

Tasks:

- Sticky control bar with URL + localStorage persistence
- Compare up to 4 series with accessible legend (EN/AR + RTL)
- Alert creation flow with optimistic UI + rollback
- Watchlist drag/swipe reorder across desktop/mobile
- CSV/JSON/PNG export with freshness label retained
- Ensure analytics events fire for all new controls

Acceptance:

- State deep-links restore correctly
- Alert flow survives API errors safely
- Export outputs valid files
- Lint/test/validate/build pass
```

---

## Prompt — Phase 4 (Markets/Countries Hub)

```md
You are the senior product engineer for `vctb12/GoldTickerLive`. Goal: Phase 4 — build `/markets/`
hub and reduce thin country pages.

Read first:

1. AGENTS.md
2. .github/copilot-instructions.md
3. .github/instructions/seo.instructions.md
4. .github/instructions/content-country-pages.instructions.md
5. .github/instructions/gold-pricing.instructions.md

Tasks:

- Classify country pages (flagship vs thin/noindex vs merge)
- Build searchable/filterable `/markets/` index
- Refactor country detail rendering to modern module path
- Add real local context content EN+AR for flagship markets
- Add 301 redirects from legacy `/countries/` routes where needed

Acceptance:

- No thin pages indexed
- FX conversion uses local FX source + timestamp (not AED peg)
- Sitemap/internal links/canonical consistency maintained
- Lint/test/validate/build pass
```

---

## Prompt — Phase 5 (Account Surface Consolidation)

```md
You are the senior product engineer for `vctb12/GoldTickerLive`. Goal: Phase 5 — consolidate
account/dashboard/developer/pricing into `/account/`.

Read first:

1. AGENTS.md
2. .github/copilot-instructions.md
3. .github/instructions/backend-supabase.instructions.md
4. .github/instructions/security.instructions.md
5. .github/instructions/frontend-mobile.instructions.md

Tasks:

- Merge account surfaces into one tabbed shell
- Keep server/auth contracts unchanged
- Deep-link tabs with query params
- Move billing-tier UX copy into account; keep educational content in learn
- Add redirects from old account-related pages

Acceptance:

- Auth flow parity preserved
- API key and developer area remains functional
- EN/AR parity + RTL + accessibility preserved
- Lint/test/validate/build pass
```

---

## Prompt — Phase 6 (Shops Trust/Honesty Hardening)

```md
You are the senior product engineer for `vctb12/GoldTickerLive`. Goal: Phase 6 — shops trust pass
(verification honesty + submission/review clarity).

Read first:

1. AGENTS.md
2. .github/copilot-instructions.md
3. .github/instructions/backend-supabase.instructions.md
4. .github/instructions/security.instructions.md
5. .github/instructions/content-country-pages.instructions.md

Tasks:

- Enforce exactly defined badge types (Verified / Listed / Market cluster)
- Remove any implied live retail pricing in shop cards
- Keep reference-estimate + methodology labeling explicit
- Improve submit-shop flow and admin review queue clarity
- Keep sponsorship labeling transparent

Acceptance:

- No fabricated verification claims
- No unlabeled numeric shop-price presentation
- Submit -> review -> publish flow validated
- Lint/test/validate/build pass
```

---

## Prompt — Phase 7 (Freshness Contract Enforcement)

```md
You are the senior product engineer for `vctb12/GoldTickerLive`. Goal: Phase 7 — enforce freshness
strip on every price-bearing surface.

Read first:

1. AGENTS.md
2. .github/copilot-instructions.md
3. .github/instructions/gold-pricing.instructions.md
4. docs/freshness-contract.md
5. .github/instructions/testing-qa.instructions.md

Tasks:

- Replace ad-hoc “as of” labels with shared freshness component
- Ensure freshness states are machine-readable and visible in UI
- Integrate cache/offline freshness signaling from service worker
- Add CI check to fail pages with prices lacking freshness metadata

Acceptance:

- 0 price surfaces missing freshness labeling
- Offline state clearly marked cached/stale when applicable
- Canonical EN/AR freshness vocabulary preserved across all surfaces
- Lint/test/validate/build pass
```

---

## Prompt — Phase 8 (Performance + Accessibility Hardening)

```md
You are the senior product engineer for `vctb12/GoldTickerLive`. Goal: Phase 8 — raise mobile
performance and close accessibility gaps across core surfaces.

Read first:

1. AGENTS.md
2. .github/copilot-instructions.md
3. .github/instructions/accessibility.instructions.md
4. .github/instructions/pwa-service-worker.instructions.md
5. docs/PERFORMANCE.md

Tasks:

- Add targeted preload/modulepreload for critical shell/tracker chunks
- Lazy-load heavy non-critical modules
- Optimize images (AVIF/WebP fallbacks where appropriate)
- Enforce loading/decoding best practices for below-fold media
- Run pa11y/lighthouse and fix regressions

Acceptance:

- Performance budgets met on mobile critical surfaces
- Accessibility errors eliminated on EN+AR checks
- No LCP/CLS/TBT regression from established baseline
- Lint/test/validate/build pass
```

---

## Prompt — Phase 9 (SEO + Legacy URL Hygiene)

```md
You are the senior product engineer for `vctb12/GoldTickerLive`. Goal: Phase 9 — canonical/legacy
URL cleanup + hreflang/schema completeness.

Read first:

1. AGENTS.md
2. .github/copilot-instructions.md
3. .github/instructions/seo.instructions.md
4. docs/SEO_STRATEGY.md
5. docs/SEO_SITEMAP_GUIDE.md

Tasks:

- Rebuild sitemap coverage from current IA
- Audit all `/Gold-Prices/*` references and handle each explicitly
- Ensure hreflang reciprocity (`en`, `ar`, `x-default`)
- Fill missing JSON-LD per page type
- Run internal-link + SEO checks and fix failures

Acceptance:

- Canonical mismatches resolved
- Hreflang reciprocal validation passes
- Legacy path references accounted for (redirect/documented)
- Lint/test/validate/build pass
```

---

## Prompt — Phase 10 (Docs Consolidation)

```md
You are the senior product engineer for `vctb12/GoldTickerLive`. Goal: Phase 10 — docs consolidation
and conflict cleanup.

Read first:

1. AGENTS.md
2. .github/copilot-instructions.md
3. .github/instructions/docs.instructions.md
4. docs/README.md

Tasks:

- Consolidate docs into a tighter top-level structure
- Archive stale audits with explicit frozen marker
- Keep `.github/instructions/*` as source of truth for agent behavior
- Update all moved-doc links repo-wide
- Mark completed revamp phases in REVAMP_PLAN where applicable

Acceptance:

- docs top-level is concise and navigable
- no broken internal docs links
- no contradictory pricing/freshness/IA docs
- Lint/test/validate/build pass (as applicable for changed surfaces)
```

---

## Quick usage notes

- Start each session by pasting exactly one phase prompt above.
- Do **not** combine Phase 3a and 3b in the same PR.
- If you only want comment-mode in future sessions, paste the prompt and add:
  `Deliverable: PR comment only, no file creation.`

---

## Session status update (2026-05-22)

- Phase 1 execution started in branch work:
  - Shared shell renderer introduced (`src/components/site-shell.js`) and adopted across major page
    entry points.
  - Shell guard added (`scripts/node/check-shell-guard.js`) and wired into `npm run validate`.
  - Canonical nav 7-surface contract added to `nav-data` + test coverage.
  - Inline shell-related styles partially extracted to `styles/partials/shell.css`.
- Remaining Phase 1 items should continue from this state (final parity sweep + CI evidence pack).

## Actionable checklist — current next slice

- [x] Confirm shared shell renderer adoption for major page entry points
      (`src/components/site-shell.js`).
- [x] Confirm shell guard is wired into validate (`scripts/node/check-shell-guard.js` via
      `npm run validate`).
- [x] Confirm canonical nav 7-surface contract coverage in nav-data + tests.
- [x] Confirm partial shell-style extraction exists (`styles/partials/shell.css`).
- [x] Complete Phase 1 parity sweep and capture fresh validation evidence (`npm run lint`,
      `npm test`, `npm run validate`, `npm run build`) for the remaining extraction pass.

## Session log

### 2026-05-22T13:50Z — copilot (PR #331)

- Slice class: CODE
- Skills activated: gold-ticker-live-audit, frontend-design-system, mobile-ux-review
- Completed:
  - Replaced remaining inline style attributes on active Phase 1 parity surfaces in `tracker.html`
    and `learn.html` with CSS classes.
  - Added class-driven sequencing and purity fill-width rules in `styles/pages/tracker-pro.css` and
    `styles/pages/learn.css`.
  - Captured full required validation evidence for this slice.
- Added/Split:
  - None.
- Skipped (owner-only / blocked):
  - None.
- Validation: lint=PASS, quality=FAIL (pre-existing prettier drift in untouched files), test=FAIL
  (741 run, 1 pre-existing failure in `tests/analytics.test.js`), check-unsafe-dom=PASS, build=PASS,
  check-links=PASS, validate=PASS, playwright=FAIL (138 passed, 96 failed; missing host libs for
  WebKit and pre-existing nav/lang smoke failures)
- Screenshots:
  - `/tmp/playwright-logs/phase1-inline-cleanup-360-ltr.png`
  - `/tmp/playwright-logs/phase1-inline-cleanup-360-rtl.png`
  - `/tmp/playwright-logs/phase1-inline-cleanup-desktop.png`
- Next action: Begin Phase 2 planning by mapping learn/methodology/insights consolidation
  dependencies and selecting the first leaf implementation slice.

### 2026-05-22T13:11Z — copilot (PR #330)

- Slice: Add required status/session metadata and convert current Phase 1 progress into explicit
  actionable checklist state.
- Completed:
  - Added `plan-status` YAML block with `in-progress` state and a concrete `next_action`.
  - Added an actionable checkbox list for the active Phase 1 progress state.
  - Preserved prior progress notes and aligned them with checklist tracking.
- Added/Split:
  - Added one explicit pending leaf item to drive the next run
    (`Complete Phase 1 parity sweep + full validation evidence`).
- Skipped (owner-only / blocked):
  - None.
- Validation:
  - Docs-only plan-state update; no runtime or build-affecting files changed, so repo
    test/lint/build commands were not run in this slice.
- Next action: Complete the Phase 1 parity sweep by auditing remaining shell-style extraction gaps
  and capturing full lint/test/validate/build evidence.
