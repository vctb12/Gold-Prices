# AI-Agent Operating System

> **Purpose.** This document explains the AI-agent operating system layered on top of
> [`AGENTS.md`](../AGENTS.md). It's the index every future Claude / Copilot / Codex / Gemini /
> Cursor / Aider session should hit after `AGENTS.md` itself.

## Why this system exists

Gold Ticker Live is a bilingual gold-price intelligence platform with real production surfaces:

- A live spot-linked price feed published to a public site
- An hourly X-post auto-publish (production, hourly, public)
- Bilingual EN/AR content (SEO-sensitive)
- A Supabase-backed backend + admin + API product
- A growing country / city / karat content surface

The cost of a wrong agent action ranges from "broken layout" to "tweeted stale data as live" to
"leaked service-role key". The cost of a _redundant_ agent action (re-asking the same context every
session) is high too — the user has already explained these constraints many times.

This operating system encodes that context once, so agents can:

- Load the right rules for the file they're touching
- Pick the right workflow for the task they're solving
- Verify with the right commands
- Report in a structured, honest way

## File map

```
AGENTS.md                                    ← canonical charter (read first)
CLAUDE.md                                    ← Claude-specific mechanics (subagents, skills, etc.)
.github/copilot-instructions.md              ← always-on Copilot instructions (concise)
.github/instructions/                        ← path-scoped instructions (loaded by applyTo)
  gold-pricing.instructions.md
  frontend-mobile.instructions.md
  seo.instructions.md
  github-actions.instructions.md
  security.instructions.md
  accessibility.instructions.md
  backend-supabase.instructions.md
  testing-qa.instructions.md
  content-country-pages.instructions.md
  pwa-service-worker.instructions.md
.github/skills/                              ← reusable workflows + checklists
  gold-ticker-live-audit/      (broad audit)
  github-actions-debug/        (CI / posting / deploy)
  mobile-ux-review/            (mobile + RTL)
  seo-governance/              (canonical / noindex / sitemap)
  pricing-data-integrity/      (formulas / freshness / exports)
  frontend-design-system/      (tokens / components / layout)
  security-review/             (secrets / server / Supabase)
  backend-admin-supabase/      (schema / routes / admin)
.github/prompts/                             ← paste-ready prompts (one per task type)
  pr-review.prompt.md
  mobile-ux-audit.prompt.md
  workflow-debug.prompt.md
  tracker-flagship-revamp.prompt.md
  seo-noindex-governance.prompt.md
  pricing-data-audit.prompt.md
  provider-bakeoff.prompt.md
  release-readiness.prompt.md
  backend-admin-supabase.prompt.md
  accessibility-audit.prompt.md
  country-pages-expansion.prompt.md
  shops-data-honesty.prompt.md
  x-twitter-automation-review.prompt.md
.github/agents/                              ← specialist agents
  gold-ticker-live-reviewer.md
  workflow-safety-agent.md
  frontend-polish-agent.md
  seo-governance-agent.md
  pricing-data-agent.md
  backend-admin-agent.md
  security-review-agent.md
  accessibility-agent.md
docs/
  AI_AGENT_OPERATING_SYSTEM.md               ← this file
  AGENT_SKILL_LIBRARY.md                     ← skill reference
  AI_PROMPT_LIBRARY.md                       ← prompt reference
  AI_AGENT_REVIEW_CHECKLISTS.md              ← consolidated checklists
  AI_RELEASE_READINESS_PLAYBOOK.md           ← deploy gate
```

## The four layers

| Layer                 | Lives in                                 | When it activates                 |
| --------------------- | ---------------------------------------- | --------------------------------- |
| **Canonical charter** | `AGENTS.md`                              | Every session, every agent        |
| **Always-on**         | `.github/copilot-instructions.md`        | Copilot sessions                  |
| **Path-scoped**       | `.github/instructions/*.md`              | When you touch files in `applyTo` |
| **On-demand**         | `.github/skills/`, `prompts/`, `agents/` | When you invoke them              |

The four layers don't override each other randomly — they stack:

1. `AGENTS.md` (charter) is the source of truth for **rules**.
2. `.github/copilot-instructions.md` is the source of truth for **always-on guidance**.
3. `.github/instructions/*.md` is the source of truth for **path-scoped specifics**.
4. Skills / prompts / agents are the source of truth for **how to execute a task**.

If two layers disagree, the more specific layer wins **for that file**. If `AGENTS.md` contradicts
everything else on a non-negotiable, `AGENTS.md` wins. File an edit to reconcile.

## Recommended agent workflow

```
┌──────────────────────────────────────────────────────────────────────┐
│ 1. Read AGENTS.md                                                    │
│ 2. Read .github/copilot-instructions.md  (or CLAUDE.md / etc.)       │
│ 3. Classify the task → pick a prompt from .github/prompts/           │
│ 4. Prompt's frontmatter tells you which skills + instructions apply  │
│ 5. Load those skills' checklists + the matching instruction files    │
│ 6. Run the preflight checklist (skills/gold-ticker-live-audit/...)   │
│ 7. If task > 2h → write docs/plans/YYYY-MM-DD_<slug>.md (draft PR)   │
│ 8. Implement                                                          │
│ 9. Verify (AGENTS.md §2 + the task's verification block)             │
│ 10. Report (use the prompt's return format)                          │
└──────────────────────────────────────────────────────────────────────┘
```

## How to start a new Claude / Copilot session

**Claude Code session:**

```
Read CLAUDE.md and AGENTS.md. Then use the prompt at
.github/prompts/<task>.prompt.md to start <task>.
```

**Copilot cloud agent session:**

The cloud agent reads `.github/copilot-instructions.md` automatically; it points back here.

**Generic session (Codex / Gemini / Cursor / Aider):**

```
Read AGENTS.md. Then read docs/AI_AGENT_OPERATING_SYSTEM.md and use
.github/prompts/<task>.prompt.md to start.
```

## How to run verification

See [`AGENTS.md` §2](../AGENTS.md#2-core-commands) and the task's prompt for verification specifics.
For a release gate, see [`AI_RELEASE_READINESS_PLAYBOOK.md`](./AI_RELEASE_READINESS_PLAYBOOK.md).

## How to update the system

| Change type                           | Who edits what                                                           |
| ------------------------------------- | ------------------------------------------------------------------------ |
| New repo-wide rule                    | `AGENTS.md` + sync to `.github/copilot-instructions.md`                  |
| Rule for a specific path              | the matching `.github/instructions/*.instructions.md`                    |
| New task workflow                     | add `.github/prompts/<task>.prompt.md` + entry in `AI_PROMPT_LIBRARY.md` |
| New reusable workflow with checklists | add `.github/skills/<name>/` + entry in `AGENT_SKILL_LIBRARY.md`         |
| Skill checklist updated               | edit the `.md` directly                                                  |
| New specialist agent                  | add `.github/agents/<name>.md` + entry in this doc                       |
| Risk identified                       | add to `AI_AGENT_REVIEW_CHECKLISTS.md` Risk Register                     |

Keep updates small and atomic. Don't rewrite the system every quarter.

## How to avoid stale instructions

- **Single source of truth per rule.** If two files repeat the same rule, one of them links to the
  other.
- **Quote the source.** When a skill cites a repo invariant, link to the file/line that proves it.
- **Date stamps on plans.** Plans under `docs/plans/` use `YYYY-MM-DD_<slug>.md` so age is visible.
- **Quarterly sweep.** Once a quarter, read `AGENTS.md` end-to-end and reconcile any divergence.

## Common mistakes this system prevents

| Mistake                                                 | Defended by                                    |
| ------------------------------------------------------- | ---------------------------------------------- |
| Treating Gold Ticker Live as a generic static site      | `AGENTS.md` §1 + copilot-instructions §1       |
| Mixing reference and retail prices                      | `gold-pricing.instructions.md`, pricing skill  |
| Hand-editing `sitemap.xml`                              | `seo.instructions.md`, sitemap checklist       |
| Pushing a tracker tweak that strips the freshness pill  | `frontend-polish-agent`, pricing skill         |
| `set -x` on a step that touches `${{ secrets.* }}`      | `security.instructions.md`, workflow checklist |
| Service-role Supabase key in browser bundle             | `security-review` skill                        |
| Per-karat city page indexed                             | `seo-governance.js` + governance skill         |
| Posting stale data as live on X                         | `x-twitter-automation-review` prompt           |
| Migrating to React because "it would be easier"         | `AGENTS.md` §6 #5                              |
| Tweet > 280 chars because URL counted as 0              | X-posting checklist                            |
| Adding a 7th `.card` variant                            | `frontend-design-system` skill                 |
| Sub-agent (`explore`) launched for a single-file lookup | `AGENTS.md` tools section                      |

## How this protects pricing truth, SEO, automation, EN/AR

- **Pricing truth.** Constants live in `src/config/`. The pricing-data-integrity skill enforces it.
  The pricing-data-agent owns it. The PR-review prompt blocks regressions.
- **SEO.** Governance script (`seo-governance.js`) enforces noindex policy. The seo-governance
  skill + agent + prompt own canonical, sitemap, hreflang.
- **Automation.** The x-twitter-automation-review prompt + workflow-safety agent + github-actions
  instructions own `post_gold.yml`. `dry_run` is the safety net.
- **EN/AR.** Every prompt that touches user-visible copy requires the EN+AR pair. The
  `translations.js` rule is repeated in every relevant instruction file.

## Quick links

- [Agent skill library](./AGENT_SKILL_LIBRARY.md)
- [AI prompt library](./AI_PROMPT_LIBRARY.md)
- [Review checklists + risk register](./AI_AGENT_REVIEW_CHECKLISTS.md)
- [Release readiness playbook](./AI_RELEASE_READINESS_PLAYBOOK.md)
- [Master charter (`AGENTS.md`)](../AGENTS.md)
- [Claude-specific (`CLAUDE.md`)](../CLAUDE.md)
- [Copilot always-on (`.github/copilot-instructions.md`)](../.github/copilot-instructions.md)
