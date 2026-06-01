# Repo Cleanup Proposal — Dead Code, Dead Files, Stale Artifacts (captured 2026-04-23)

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

> **Status:** 📥 _Proposal — Phase 0 reconciled. Phase 1 (audit-only) is in progress on branch
> `copilot/clean-repo-files-dead-code`. Phases 2+ are gated by owner sign-off on
> `reports/cleanup-audit/CANDIDATES.md`._ **Constraints:** [`AGENTS.md`](../../AGENTS.md) only — no
> public URL removal, no SEO/sitemap regression, DOM-safety baseline intact, ≤ ~50 files per removal PR.
>
> The **single source of truth** for execution is [`docs/REVAMP_PLAN.md`](../REVAMP_PLAN.md) §29
> ("Repo hygiene pass"). This file is the verbatim capture of the originating prompt plus the agreed
> plan, kept here so the intake history is preserved.

---

## Origin

Captured from the prompt: _"full repo files cleaning, remove dead code, dead files and clean all
files and be extra conservative and be careful"_ (2026-04-23). Reconciled with the audit-first /
delete-last plan agreed in the same conversation.

## Goal

Safely reduce dead code, dead files, and stale artifacts across the repo without altering any public
URL, breaking any CI gate, or weakening SEO/trust surfaces.

---

## Phases (mirrored in `REVAMP_PLAN.md` §29)

### Phase 0 — Reconcile into the plan system

1. Add this file (`docs/plans/REPO_CLEANUP_PROPOSAL.md`).
2. Add a row to the "Pending proposals" table in [`docs/plans/README.md`](./README.md).
3. Score sub-tasks into the priority matrix (Wave 2 / Wave 3 — most rows are Impact 2, Effort 2–3,
   Score 0).
4. Slot a "Repo hygiene pass" subsection into `docs/REVAMP_PLAN.md` (§29) with per-phase checklists
   mirroring the phases below.
5. Do **not** execute Phase 1+ until the owner has confirmed scope and the Keep-list (see Phase
   1.3).

### Phase 1 — Baseline audit (read-only, zero deletions)

Produce a single audit artifact under `reports/cleanup-audit/` (working copies gitignored, committed
summary only). No files are changed in this phase.

1. **Inventory** — full file list with size, last-modified, last-commit-touching SHA. Language /
   extension breakdown. Flag obvious candidates (empty files, files >6 months untouched, `.bak`,
   `.old`, `_tmp`, `*-copy.*`, `.DS_Store`, editor swap files).
2. **Reachability graph** (a file is _live_ if **any** signal marks it live):
   - HTML → asset graph (`<script src>`, `<link href>`, `<img src>`, `<source srcset>`, inline
     `url()`).
   - JS import graph from every HTML entrypoint plus `server.js` / `server/routes/**`.
   - CSS `@import` and `url()` graph from every `<link rel="stylesheet">`.
   - Config / tooling refs: `package.json`, `vite.config.js`, `eslint.config.mjs`,
     `.stylelintrc.json`, `.prettierrc.json`, `playwright.config.js`, `.pa11yci.js`,
     `pyproject.toml`, `.github/workflows/**`, `.husky/**`, `scripts/**`.
   - Runtime-only refs: `sw.js` precache list, `manifest.json` icons, `sitemap.xml`, `robots.txt`,
     `_redirects`, `_headers`, `.htaccess`, `CNAME`.
   - Test refs (`tests/**`, `scripts/node/check-*.js`) and fixtures (`tests/fixtures/`, `data/`,
     `supabase/`).
   - Workflow refs: Python scripts under `scripts/python/**` referenced by workflows; Node scripts
     referenced by `npm run *`.
   - Dynamic refs (string-grep, not static): `fetch("…")`, `new URL("…")`, `import("…")` literals,
     Vite `import.meta.glob` patterns, template-interpolated paths.
3. **Keep-list** — kept unconditionally:
   - Reachable in the graph above.
   - All `**/*.html` under `countries/**`, `content/**`, or repo root.
   - Anything listed in `sitemap.xml`, `_redirects`, `_headers`, `.htaccess`, `robots.txt`,
     `manifest.json`, `sw.js`, `CNAME`.
   - `.git/`, `.github/`, `.husky/`, `node_modules/`.
   - Governance / meta files: `LICENSE`, `README.md`, `CHANGELOG.md`, `CONTRIBUTING.md`,
     `AGENTS.md`, `CLAUDE.md`, `.editorconfig`, `.gitignore`, `.prettierignore`, `.nvmrc`,
     `.nojekyll`, `.replit`, dotfiles in general.
   - Everything under `docs/` (handled in the stricter Phase 7).
   - Everything under `supabase/` (external schema source of truth).
4. **Candidate-list** (everything not on the Keep-list) bucketed by confidence:
   - **Bucket A — High confidence dead** (proposable for removal): `.DS_Store`, editor swaps
     (`*.swp`, `*.swo`, `*~`), zero-byte files, obvious backups (`*.bak`, `*.old`, `*-copy.*`,
     `* 2.html`), orphaned `.map` files without matching source, byte-identical duplicate binary
     assets.
   - **Bucket B — Medium confidence**: JS / CSS / PY files not reachable from any entrypoint, no
     test references, not executed by any workflow, no grep hits outside themselves / comments.
   - **Bucket C — Low confidence** (human review required): unreferenced-looking items in
     `reports/`, `build/`, `config/`, `assets/`, anywhere the static graph cannot see (OG images,
     analytics pixels, server-rendered admin partials, template-interpolated paths).
5. **Dead-code-inside-live-files audit** (no file deletion):
   - `knip` (or `ts-prune`) against `src/` for unused exports / dead re-exports.
   - `eslint --rule 'no-unused-vars: error'` non-blocking report (beyond the current `^_` ignore).
   - `stylelint --report-needless-disables` plus `purgecss` in **report-only** mode against
     `countries/**/*.html`, `content/**/*.html`, `*.html`, `src/**/*.js`.
   - `ruff check --select F401,F811,F841` for Python (already enabled; confirm clean).
   - `depcheck` for unused `dependencies` / `devDependencies` in `package.json`.
6. **Deliverable**: `reports/cleanup-audit/CANDIDATES.md` with Bucket A/B/C tables, knip / depcheck
   / purgecss reports inlined or linked, and an empty checkbox per row for owner sign-off.

> **STOP** here. Phases 2+ run only after the owner reviews `CANDIDATES.md` and checks off approved
> removals.

### Phase 2 — Trivially safe removals (Bucket A only, owner-approved)

1. One category per commit (`.DS_Store`, editor swaps, zero-byte files, orphan `.map` files,
   byte-identical duplicates).
2. Each PR must pass `npm run lint`, `npm run validate`, `npm test`, `npm run build`,
   `npm run quality`.
3. `.gitignore` hardened to prevent re-committing OS / editor junk (`.DS_Store`, `Thumbs.db`,
   `*.swp`, `*~` — `.DS_Store` and `*.swp` are already ignored; verify the rest).
4. No changes to any public HTML page.

### Phase 3 — Script & module orphans (Bucket B, one-at-a-time, owner-approved)

For each approved file:

1. Re-verify it is still unreferenced as of HEAD.
2. Check for **dynamic** references: grep filename stem across repo, workflows, docs, and `dist/`
   after a fresh `npm run build`.
3. Delete only if all of: zero static refs, zero dynamic grep hits outside itself, no tests import
   it, no workflow invokes it, `npm run build` output is byte-identical (or differs only in ways
   explained by the removal).
4. Small PRs grouped by subsystem (e.g. "remove unused `scripts/node/*` helpers", "remove unused
   `src/lib/*` exports").
5. One-line entry in `CHANGELOG.md` under an "Internal" heading per removal.

### Phase 4 — Dead exports inside live files (no file removal)

1. For each unused export flagged by knip / ts-prune, confirm no consumer (including tests and
   workflows).
2. Remove the export (and, if the function / constant has no internal consumer either, remove its
   body).
3. Group edits by module; keep diffs small.
4. **Do not touch** `src/lib/safe-dom.js` or `src/lib/cache.js` fallback paths — defensive by
   design.
5. Run full test + build after each module.

### Phase 5 — Dependencies

1. From depcheck output, remove truly unused `dependencies` / `devDependencies`.
2. Keep anything used by a workflow only (depcheck misses those) — verify by grep in
   `.github/workflows/**` and `scripts/**`.
3. Run `npm audit`; run full test + build.
4. **No version bumps in this pass.**

### Phase 6 — CSS / style hygiene (report-first)

1. From the purgecss report, pick only selectors that are **class-based** and clearly unused across
   all 600+ HTML pages.
2. Never remove utility classes from `styles/global.css` referenced via `setAttribute('class', …)`
   or template strings in JS. The `hover-lift`, `data-freshness-pulse`, `data-reveal`,
   `flash-up/down` primitives are easy to miss — protect them explicitly.
3. Group by stylesheet; run Playwright visual smoke (`npm run test:playwright`) where available to
   confirm no regressions on home / tracker / shops / country-page.

### Phase 7 — Docs hygiene (strictly non-destructive by default)

`docs/` holds governance surfaces (`REVAMP_PLAN.md`, `AGENTS.md`, `CLAUDE.md`, `plans/README.md`)
that must not be touched as cleanup. For everything else:

1. Identify clearly superseded docs (e.g. `REVAMP_STATUS.md` and `REVAMP_EXECUTION_SUMMARY.md`
   relative to `REVAMP_PLAN.md`; `issues-found.md`, `pr-audit.md`, `risks.md` if duplicated by the
   master plan).
2. Propose **archival** under `docs/archive/YYYY-MM/` rather than deletion. Update `docs/README.md`
   index.
3. Owner approves each archival individually. Governance files are never archived.

### Phase 8 — Formatting-only pass (optional, default skip)

Only if explicitly requested:

1. `npm run format` and `npm run style:fix` across the repo in a single commit
   (`chore: format only (no semantic changes)`).
2. Review the diff to confirm no unintended content changes.
3. Default behaviour for this proposal: **skip** unless asked.

### Phase 9 — Final validation

After every PR and at the end of the effort:

- `npm test`, `npm run lint`, `npm run validate`, `npm run quality`, `npm run build`,
  `npm run perf:ci`, `npm run check-links`, `npm run a11y`, `npm run seo-audit`.
- Diff `dist/` sitemap before/after; verify every public URL still ships.
- Verify no new `innerHTML` / `outerHTML` / `insertAdjacentHTML` / `document.write` sinks
  (`check-unsafe-dom` baseline untouched or tightened).
- Deploy preview smoke test: home, tracker, shops, calculator, insights, one country, one city, one
  market, 404, offline.

---

## Conservative guardrails (apply to every phase)

- **Never** delete a file under `countries/`, `content/`, `admin/`, or repo-root HTML as cleanup.
- **Never** delete items listed in `sitemap.xml`, `_redirects`, `_headers`, `.htaccess`,
  `robots.txt`, `manifest.json`, `sw.js`, or `CNAME`.
- **Never** modify `data/shops.js`, DataHub baseline CSVs, or pre-build outputs under `assets/`,
  `config/`, `data/` as cleanup.
- **Never** batch removals across multiple subsystems; one subsystem per PR.
- **Never** force-push; never rewrite history.
- Every removal PR is ≤ ~50 files and has a concrete Keep-list justification in its description.
- If any gate fails, roll back that PR entirely; do not patch over.
- If in doubt → **leave the file alone** and note it in `CANDIDATES.md` Bucket C for human review.

## Out of scope (explicit non-goals)

- Version bumps / dependency upgrades.
- Architecture changes (SPA migration, directory reorg — Wave 3 #18, gated separately).
- Content rewrites / SEO rewrites / copy edits.
- New features, new pages, new scripts.
- Changing any public URL, redirect, or canonical.
