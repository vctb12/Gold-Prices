# `docs/` — index

Agent operating rules live in [`AGENTS.md`](../AGENTS.md) at the repo root, not here. This directory
holds the master plan plus human-facing reference docs.

## Plan & proposals

| File                                               | Role                                                                              |
| -------------------------------------------------- | --------------------------------------------------------------------------------- |
| [`GOLD_TICKER_LIVE_MASTER_WORKBOOK.md`](./GOLD_TICKER_LIVE_MASTER_WORKBOOK.md) | **Start here** — workbook v2: vision, 25 gaps, 50+ sessions, 16 scanners, 90-day map. |
| [`workbook/`](./workbook/) | **Deep appendices** A–G: surfaces, CI, API map, execution guides, tests, secrets, SEO. |
| [`workbook/WORKBOOK_SESSION_REGISTRY.md`](./workbook/WORKBOOK_SESSION_REGISTRY.md) | Workbook session branch ↔ PR tracker + priority queue. |
| [`plans/2026-06-01_master-operations-hub.md`](./plans/2026-06-01_master-operations-hub.md) | One-screen routing summary (details in workbook). |
| [`REVAMP_PLAN.md`](./REVAMP_PLAN.md)               | Master plan — tracks in progress, decisions, production tracks, issues, backlog.  |
| [`plans/README.md`](./plans/README.md)             | Proposal intake + priority matrix. New plans follow `plans/YYYY-MM-DD_<slug>.md`. |
| [`plans/ARCHIVE_AND_SUPERSESSION_INDEX.md`](./plans/ARCHIVE_AND_SUPERSESSION_INDEX.md) | Which docs are authoritative vs archive candidates. |
| [`archive/README.md`](./archive/README.md)         | Frozen landed plans (`docs/archive/YYYY-MM/`); moves are C3b only.                |
| [`plans/`](./plans/)                               | Raw proposal captures.                                                            |
| [`AGENT_REFRESH_PLAN.md`](./AGENT_REFRESH_PLAN.md) | Historical record of the 2026-04 agent-instruction refresh.                       |

## Reference docs

Stable knowledge base. These are referenced from the master plan but have their own lifecycle.

| File                                                           | Role                                                     |
| -------------------------------------------------------------- | -------------------------------------------------------- |
| [`ARCHITECTURE.md`](./ARCHITECTURE.md)                         | System / data-flow overview.                             |
| [`DESIGN_TOKENS.md`](./DESIGN_TOKENS.md)                       | Canonical CSS custom-property catalog.                   |
| [`ACCESSIBILITY.md`](./ACCESSIBILITY.md)                       | WCAG 2.1 AA patterns used in the codebase.               |
| [`PERFORMANCE.md`](./PERFORMANCE.md)                           | Perf budgets, critical-CSS strategy, image / font rules. |
| [`SEO_STRATEGY.md`](./SEO_STRATEGY.md)                         | Long-form SEO strategy.                                  |
| [`SEO_CHECKLIST.md`](./SEO_CHECKLIST.md)                       | Per-release SEO checklist.                               |
| [`SEO_SITEMAP_GUIDE.md`](./SEO_SITEMAP_GUIDE.md)               | Sitemap authoring guide.                                 |
| [`DEPENDENCIES.md`](./DEPENDENCIES.md)                         | Runtime + devDep version matrix.                         |
| [`FILES_GUIDE.md`](./FILES_GUIDE.md)                           | Repository file tour.                                    |
| [`EDIT_GUIDE.md`](./EDIT_GUIDE.md)                             | How to add a country / city / shop / page.               |
| [`CONTRIBUTING.md`](./CONTRIBUTING.md)                         | Branching, PR discipline, conventions.                   |
| [`ADMIN_GUIDE.md`](./ADMIN_GUIDE.md)                           | Admin panel usage.                                       |
| [`ADMIN_SETUP.md`](./ADMIN_SETUP.md)                           | Admin Supabase setup.                                    |
| [`SUPABASE_SETUP.md`](./SUPABASE_SETUP.md)                     | Supabase project setup.                                  |
| [`SUPABASE_SCHEMA.md`](./SUPABASE_SCHEMA.md)                   | Database schema reference.                               |
| [`ALERTS_AND_NOTIFICATIONS.md`](./ALERTS_AND_NOTIFICATIONS.md) | Alerts lifecycle, channels, and operations guide.        |
| [`AUTOMATIONS.md`](./AUTOMATIONS.md)                           | GitHub Actions & scheduled bots.                         |
| [`TWITTER_AUTOMATION.md`](./TWITTER_AUTOMATION.md)             | Social-posting architecture.                             |
| [`twitter_bot_architecture.md`](./twitter_bot_architecture.md) | Twitter bot runtime architecture.                        |
| [`twitter_bot_schema.md`](./twitter_bot_schema.md)             | Twitter bot DB schema.                                   |
| [`twitter_bot_secrets.md`](./twitter_bot_secrets.md)           | Twitter bot secrets inventory.                           |
| [`MANUAL_INPUTS.md`](./MANUAL_INPUTS.md)                       | Human inputs required per release.                       |
| [`TEARDOWN.md`](./TEARDOWN.md)                                 | Full-site teardown / decommission playbook.              |
| [`environment-variables.md`](./environment-variables.md)       | Env-var inventory (server + CI + workflows).             |
| [`tracker-state.md`](./tracker-state.md)                       | Tracker URL-hash schema.                                 |
| [`performance-baseline.json`](./performance-baseline.json)     | Perf baseline snapshot.                                  |
| [`replit.md`](./replit.md)                                     | Replit setup (legacy).                                   |
| [`ERROR_REPORT.md`](./ERROR_REPORT.md)                         | Known-error inventory (historical).                      |
| [`LIMITATIONS.md`](./LIMITATIONS.md)                           | Current technical limitations.                           |
| [`CHANGELOG.md`](./CHANGELOG.md)                               | Changelog.                                               |

## Note on consolidation

Content that once lived as pointer stubs under `docs/` (`REVAMP_STATUS.md`,
`REVAMP_EXECUTION_SUMMARY.md`, `ROADMAP_IMPLEMENTATION.md`, `execution-log.md`, `issues-found.md`,
`risks.md`, `pr-audit.md`, `codebase-audit.md`, `PR_REVIEW_REQUEST.md`) and under `docs/product/`
(`PRD.md`, `PHASE0_GUARDRAILS.md`, `TRUST_SNIPPETS.md`, `DECISIONS.md`, `PLANNING.md`, `TASKS.md`,
`VERIFICATION.md`, `ROLLOUT_GOVERNANCE.md`, `MEMORY.md`) was consolidated into the master plan and
removed in the 2026-04 agent-instruction refresh. See
[`AGENT_REFRESH_PLAN.md`](./AGENT_REFRESH_PLAN.md) for the audit.
