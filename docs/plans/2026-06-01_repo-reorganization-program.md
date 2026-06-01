# Repo Reorganization Program — Phased Sessions

```yaml plan-status
status: ready
priority: P1
class: program
owner: @vctb12
created: "2026-06-01"
blocked_on: "Owner sign-off on reports/cleanup-audit/CANDIDATES.md for deletions"
guardrails_reviewed: true
```

> **Purpose:** Make the repository effortless to navigate **without** breaking GitHub Pages URLs,
> SEO, or the static multi-page architecture. Each sub-session is **one PR**, one focus.
>
> **Hub:** [`2026-06-01_master-operations-hub.md`](./2026-06-01_master-operations-hub.md)

---

## Rules (all sessions)

- No direct commits to `main`. Branch: `cursor/wb-<WB-ID>-<slug>-cb21` for workbook sessions; otherwise `cursor/repo-<slug>-cb21`.
- Every URL change needs `_redirects` + sitemap regen + `npm run validate`.
- Do not move `post_gold.yml`, `gold-price-fetch.yml`, `data/gold_price.json`, `sw.js`,
  `src/config/constants.js` paths without owner approval.
- Verify: `npm test`, `npm run lint`, `npm run validate`, `npm run build` after path changes.
- ≤ ~50 files per PR unless generator-only country batch.

---

## Session map

| ID | Focus | Risk | Depends on |
| -- | ----- | ---- | ------------ |
| **C1a** | Docs archive + supersession index only | 🟢 | — |
| **C1b** | CSS: ensure partials import graph documented; no moves | 🟢 | Session 5 CSS split on main |
| **C1c** | Move `styles/pages/*` co-location **or** document why not | 🟡 | Owner |
| **C1d** | `assets/` consolidation (favicons, og-image) | 🟡 | Link audit |
| **C1e** | Root HTML → `pages/` **pilot** (404 + offline only) | 🟡 | Redirects |
| **C1f** | Root HTML bulk move (remaining entry pages) | 🔴 | C1e green + owner |
| **C2a** | Country canonical 301 audit (generator-only) | 🟡 | — |
| **C2b** | City gold-rate static price snapshot | 🟡 | C2a |
| **C3a** | Wire `check-sw-precache` + content audit in CI | 🟢 | — |
| **C3b** | `docs/plans/` archive completed proposals to `docs/archive/YYYY-MM/` | 🟢 | C1a index |

**Do not run C1f** in the same PR as UI polish.

---

## C1a — Docs consolidation (recommended first)

**Branch:** `cursor/repo-c1a-docs-archive-cb21`

**Tasks:**

1. Update [`ARCHIVE_AND_SUPERSESSION_INDEX.md`](./ARCHIVE_AND_SUPERSESSION_INDEX.md).
2. Move **completed** plan files (UI/UX sessions done, landed 2026-05-29 cleanup) to
   `docs/archive/2026-06/` with a one-line pointer stub left in `docs/plans/` OR update README
   status only (prefer **status update** without move if links are widespread).
3. Trim duplicate "Governing constraints" blocks in old proposals (point to `AGENTS.md`).
4. Ensure `docs/README.md` lists the master operations hub.

**Verify:** Docs-only PR; link check with `rg` for broken relative links.

---

## C1f — Full root HTML move (deferred / owner-gated)

Target structure documented in
[`2026-06-01_ui-ux-audit-remediation-program.md`](./2026-06-01_ui-ux-audit-remediation-program.md)
(§ Repo file/folder reorganization). Summary:

- Root keeps: `index.html` **or** redirect stub, `CNAME`, `sw.js`, `package.json`, config.
- Other entry HTML under `pages/` with Vite `base` + `_redirects` updates.

**Rollback:** Revert PR + `_redirects` backup in PR description.

---

## Redirect checklist (any move session)

- [ ] `_redirects` (GitHub Pages)
- [ ] `scripts/node/check-seo-meta.js` paths if hardcoded
- [ ] `sw.js` precache list
- [ ] `build/generateSitemap.js` entry roots
- [ ] Internal nav `nav-data.js` hrefs
- [ ] `tests/*` fixture paths

---

## Reconciliation

| Doc | Relationship |
| --- | ------------ |
| `REPO_CLEANUP_PROPOSAL.md` | Deletion/hygiene; C1 does not delete without CANDIDATES sign-off |
| `2026-05-21_next-session-prompts.md` | Shell parity; after C1a |
| `PLATFORM_UPGRADE_PROPOSAL.md` | Historical; do not execute wholesale |

---

## Session prompt (copy-paste)

```md
Execute **repo reorganization session C1a only** (docs archive + supersession index).

Read: AGENTS.md, docs/plans/2026-06-01_repo-reorganization-program.md, docs/plans/ARCHIVE_AND_SUPERSESSION_INDEX.md.

Do not move HTML or change URLs this session. Update indices and stale statuses; archive only files listed in the program as safe. One PR.

Verify: grep for broken markdown links; update PLAN.md.
```
