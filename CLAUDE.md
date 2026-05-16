# CLAUDE.md

Claude Code reads this file on startup. **The canonical cross-agent charter is
[`AGENTS.md`](./AGENTS.md) — read it first.** Everything below is Claude-specific mechanics that
don't belong in the shared charter.

## Start here

1. [`AGENTS.md`](./AGENTS.md) — what this repo is, core commands, repository map, the Autonomy
   Contract, product-trust guardrails, style, done criteria.
2. [`docs/AI_AGENT_OPERATING_SYSTEM.md`](./docs/AI_AGENT_OPERATING_SYSTEM.md) — index for the skills
   / prompts / agents / checklists system layered on top of `AGENTS.md`.
3. [`docs/REVAMP_PLAN.md`](./docs/REVAMP_PLAN.md) — only if your task maps to an active section.
4. [`docs/plans/README.md`](./docs/plans/README.md) — only if your task was captured as a proposal.

Don't preload the whole `docs/` tree. Load files on demand.

## Operating system — pick the right entry point

For any non-trivial task, classify it and load only what you need:

| Task                          | Prompt (`.github/prompts/`)             | Skill (`.github/skills/`)                         |
| ----------------------------- | --------------------------------------- | ------------------------------------------------- |
| Review a PR                   | `pr-review.prompt.md`                   | `gold-ticker-live-audit`                          |
| Mobile / RTL polish           | `mobile-ux-audit.prompt.md`             | `mobile-ux-review` + `frontend-design-system`     |
| Tracker rebuild               | `tracker-flagship-revamp.prompt.md`     | `mobile-ux-review` + `pricing-data-integrity`     |
| GitHub Actions failure        | `workflow-debug.prompt.md`              | `github-actions-debug`                            |
| X-post pipeline review        | `x-twitter-automation-review.prompt.md` | `github-actions-debug` + `pricing-data-integrity` |
| Canonical / sitemap / noindex | `seo-noindex-governance.prompt.md`      | `seo-governance`                                  |
| Country pages expansion       | `country-pages-expansion.prompt.md`     | `seo-governance`                                  |
| Pricing data audit            | `pricing-data-audit.prompt.md`          | `pricing-data-integrity`                          |
| Provider bakeoff              | `provider-bakeoff.prompt.md`            | `pricing-data-integrity` + `github-actions-debug` |
| Backend / Supabase / admin    | `backend-admin-supabase.prompt.md`      | `backend-admin-supabase` + `security-review`      |
| Accessibility audit           | `accessibility-audit.prompt.md`         | `mobile-ux-review`                                |
| Shops data                    | `shops-data-honesty.prompt.md`          | `mobile-ux-review`                                |
| Release / deploy gate         | `release-readiness.prompt.md`           | `gold-ticker-live-audit`                          |

Full reference: [`docs/AI_PROMPT_LIBRARY.md`](./docs/AI_PROMPT_LIBRARY.md) and
[`docs/AGENT_SKILL_LIBRARY.md`](./docs/AGENT_SKILL_LIBRARY.md).

## Claude-specific mechanics

- **`report_progress`** — the canonical way to commit and push on this repo. Don't use `git push`
  directly; push is blocked for the task agent. Call `report_progress` before your first edit with a
  checklist, then again at meaningful milestones.
- **`parallel_validation`** — run before finalizing the task. Address valid findings; re-run if you
  made significant changes.
- **`store_memory`** — store durable repo-wide facts (conventions, commands you verified,
  invariants) with citations. Don't store user preferences or session-specific state.
- **Subagents (`task`)** — use `explore` only when a task decomposes into many independent research
  threads in a large codebase. For single-file lookups and known-path reads, use `view` / `grep` /
  `glob` directly.
- **Skills** — the `customize-cloud-agent` skill is available for editing `copilot-setup-steps.yml`
  and related cloud-agent environment config.
- **GitHub MCP tools** — use them for any CI / workflow / PR investigation. Don't claim you can't
  access logs; `get_job_logs`, `list_workflow_runs`, and friends are available.
- **`gh-advisory-database`** — call before adding any new dependency in a supported ecosystem (npm /
  pip / go / actions / maven / …).

## Verification defaults for Claude sessions

When you finish work, run the commands in [`AGENTS.md` §2](./AGENTS.md#2-core-commands) that match
the surface you touched (typically `npm test` + `npm run lint` + `npm run validate`, plus
`npm run build` for any change that touches HTML / CSS / JS). State in the PR body exactly what you
ran vs. what you inferred.

## When the two files disagree

If anything here contradicts `AGENTS.md`, `AGENTS.md` wins. File an edit to reconcile.
