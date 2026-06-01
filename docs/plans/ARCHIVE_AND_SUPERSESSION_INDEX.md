# Archive & Supersession Index

> **Purpose:** One place to know which `.md` file is authoritative. Agents: read this before creating
> a new plan doc. Humans: archive to `docs/archive/YYYY-MM/` only in session **C1a/C3b** (see
> [`2026-06-01_repo-reorganization-program.md`](./2026-06-01_repo-reorganization-program.md)).

---

## Tier 0 — Always read first

| File | Role |
| ---- | ---- |
| [`AGENTS.md`](../../AGENTS.md) | Cross-agent charter |
| [`docs/GOLD_TICKER_LIVE_MASTER_WORKBOOK.md`](../GOLD_TICKER_LIVE_MASTER_WORKBOOK.md) | **Canonical workbook** — vision, gaps, WB sessions, scanners |
| [`docs/workbook/WORKBOOK_SESSION_REGISTRY.md`](../workbook/WORKBOOK_SESSION_REGISTRY.md) | Workbook PR tracker |
| [`PLAN.md`](../../PLAN.md) | Active task checklist |
| [`docs/plans/2026-06-01_master-operations-hub.md`](./2026-06-01_master-operations-hub.md) | One-screen routing summary |
| [`docs/REVAMP_PLAN.md`](../REVAMP_PLAN.md) | Master backlog narrative |

---

## Tier 1 — Active programs (2026-06)

| File | Status | Supersedes |
| ---- | ------ | ---------- |
| [`2026-06-01_ui-ux-audit-remediation-program.md`](./2026-06-01_ui-ux-audit-remediation-program.md) | Sessions 0–5 **done**; Tracks B–E open | Ad-hoc "fix loading" prompts |
| [`2026-06-01_endless-session-prompts.md`](./2026-06-01_endless-session-prompts.md) | **Active** endless runs | Inline endless blocks in program doc |
| [`2026-06-01_repo-reorganization-program.md`](./2026-06-01_repo-reorganization-program.md) | **Active** (not started) | Wave 3 #18 wholesale move without phases |
| [`docs/audits/NEXT_PR_SEQUENCE.md`](../audits/NEXT_PR_SEQUENCE.md) | **Active** post-12-phase | — |

---

## Tier 1 — Active programs (2026-04 / 2025 — reconcile, don't duplicate)

| File | Status | Notes |
| ---- | ------ | ----- |
| [`2026-04-25_multi-track-quality.md`](./2026-04-25_multi-track-quality.md) | 🟡 partial | Many waves landed; check README matrix |
| [`2026-04-25_codebase-analysis.md`](./2026-04-25_codebase-analysis.md) | 🟡 W-5, W-13 remain | — |
| [`2026-04-24_security-performance-deps-audit.md`](./2026-04-24_security-performance-deps-audit.md) | 🟡 Track A partial | — |
| [`2026-04-27_full-site-ux-admin-revamp.md`](./2026-04-27_full-site-ux-admin-revamp.md) | 🟡 partial | Tracker/admin batches |
| [`2026-05-21_next-session-prompts.md`](./2026-05-21_next-session-prompts.md) | 🟡 shell work | Defer if conflicts with open UX |
| [`REPO_CLEANUP_PROPOSAL.md`](./REPO_CLEANUP_PROPOSAL.md) | Phase 1 audit | Deletions gated on `CANDIDATES.md` |
| [`PLATFORM_UPGRADE_PROPOSAL.md`](./PLATFORM_UPGRADE_PROPOSAL.md) | 📥 pending | Reconcile to REVAMP_PLAN only |

---

## Tier 1 — Landed (2026-05-29 / 05-30) — historical record

| File | Notes |
| ---- | ----- |
| `2026-05-29_autonomous-harsh-stripping-session.md` | Country page removal — landed |
| `2026-05-29_autonomous-cleanup-consolidation.md` | Ref sweep — landed |
| `2026-05-29_deep-clean-session3.md` | Links + learn — landed |
| `2026-05-29_harsh-cleanup-and-functional-pass.md` | Superseded for country work |

**Archive candidate (C3b):** move to `docs/archive/2026-05/` when link audit passes.

---

## Tier 2 — Reference docs (stable)

Listed in [`docs/README.md`](../README.md). Do not archive without owner approval:

- Architecture, SEO, perf, admin, Supabase, automations, pricing methodology, freshness contract.

---

## Tier 3 — Reports (point-in-time)

| Path | Role |
| ---- | ---- |
| [`reports/`](../../reports/) | Audits (seo, a11y, perf, cleanup) |
| [`docs/audits/`](../audits/) | Session registries, scorecards |

Regenerate rather than edit stale numbers in place.

---

## Tier 4 — Superseded pointers (do not use as primary)

| Deprecated pattern | Use instead |
| ------------------ | ----------- |
| `docs/REVAMP_STATUS.md`, `docs/product/*` planning stubs | `REVAMP_PLAN.md` (removed 2026-04 refresh) |
| `GOLD_TICKER_LIVE_AGENT_PROMPTS.md` §8 full UI revamp | `ui-ux-audit-phase*` + endless UI prompt |
| `2026-04-24_navbar-audit-and-redesign.md` nav phases | UI/UX Session 4 (merged) + Track B1 |
| Duplicate "Governing constraints" in proposal files | `AGENTS.md` only |

---

## Tier 5 — Agent prompt sources

| Source | When to use |
| ------ | ----------- |
| [`.github/prompts/*.prompt.md`](../../.github/prompts/) | Composer `@` — **preferred** |
| [`docs/AI_PROMPT_LIBRARY.md`](../AI_PROMPT_LIBRARY.md) | Index of `.github/prompts` |
| [`docs/GOLD_TICKER_LIVE_AGENT_PROMPTS.md`](../GOLD_TICKER_LIVE_AGENT_PROMPTS.md) | Deep 50+ prompt catalog |
| [`2026-06-01_endless-session-prompts.md`](./2026-06-01_endless-session-prompts.md) | Repeatable discovery prompts |

---

## Consolidation policy

1. **No new** `docs/plans/*_PROPOSAL.md` without a row in [`docs/plans/README.md`](./README.md).
2. **Endless work** → `.github/prompts/endless-*.prompt.md`, not new plan files.
3. **One-shot programs** → one `YYYY-MM-DD_<slug>.md` + registry if multi-PR.
4. **Archive** → `docs/archive/YYYY-MM/<original-name>.md` + stub line in README status table.
