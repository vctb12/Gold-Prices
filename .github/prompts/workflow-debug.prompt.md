---
mode: agent
description: Triage and fix a failing GitHub Actions workflow. Use for any CI / scheduled / deploy / posting workflow failure.
related_skills:
  - github-actions-debug
related_instructions:
  - .github/instructions/github-actions.instructions.md
  - .github/instructions/security.instructions.md
---

# Prompt: Workflow Debug

A workflow is failing. Triage, fix the root cause, and verify.

## Required inputs (gather these first)

- Workflow file path
- Failing run ID (and last successful run ID if available)
- Recent diffs to the workflow YAML or scripts it invokes

## Use GitHub MCP tools

- `list_workflow_runs` to find recent runs
- `get_job_logs` (with `failed_only: true`, `return_content: true`) to read logs
- `get_workflow_job` for step-by-step status

Do NOT claim you can't read logs. The tools exist.

## Required inspection

1. Read [`github-actions-debug/SKILL.md`](../skills/github-actions-debug/SKILL.md).
2. Read the workflow YAML in full.
3. Read recent diffs (`git log -p .github/workflows/<file>`).
4. Read the failing step's logs.
5. Compare to the last successful run.
6. Check `data/*.json` observability logs if the workflow writes them.

## Implementation expectations

- Fix root cause, not just the visible symptom.
- If the fix changes `post_gold.yml` logic: dispatch with `dry_run: true` and verify the tweet
  body in logs before merging.
- If the fix changes `permissions:`, scope it minimally.
- Never `set -x` on a step that touches secrets.
- Boolean inputs from `workflow_dispatch` are strings — compare with `!= 'true'`.
- State commits use `[skip ci]` to avoid feedback loops.

## Verification

- Re-dispatch the workflow (with `dry_run: true` where applicable) and confirm green.
- For scheduled workflows, note the time of the next scheduled run for follow-up monitoring.
- If logs change shape: update `docs/X_AUTOMATION_OBSERVABILITY.md` or
  `docs/AUTOMATIONS.md`.

## Return format

```md
# Workflow Debug — <workflow file>

## Failure
- Run: <link>
- Step: <step name>
- Error excerpt: <1–3 lines>

## Root cause
<short explanation>

## Fix
- <file>: <change>

## Verification
- Re-dispatched: <link, outcome>
- Next scheduled run: <UTC time> — monitoring planned

## Side effects / follow-ups
- <if any>

## Risks
- <if any>
```
