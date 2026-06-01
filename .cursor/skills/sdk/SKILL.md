---
name: sdk
description: Guide users building apps, scripts, CI pipelines, or automations on top of the Cursor SDK - TypeScript (@cursor/sdk) or Python (cursor-sdk / cursor_sdk). Use when integrating Cursor agents programmatically; Agent.create, Agent.prompt, streaming, local vs cloud runtime, MCP, errors.
---

# Cursor SDK

The Cursor SDK runs Cursor agents programmatically. Two language variants share the same concepts:

- **TypeScript** (`@cursor/sdk`, npm) — [cursor.com/docs/sdk/typescript](https://cursor.com/docs/sdk/typescript)
- **Python** (`cursor-sdk`, pip) — [cursor.com/docs/sdk/python](https://cursor.com/docs/sdk/python)

Both follow the same `Agent` → `Run` model across **local** (`cwd`) and **cloud** (cloned repo) runtimes.

Use this skill to bootstrap integrations and avoid common traps. Full reference: official SDK docs linked above.

## Pick the language

1. User named `@cursor/sdk`, `cursor-sdk`, `pip install`, `import { Agent }` → match their choice.
2. Else `package.json` / `.ts` → TypeScript; `pyproject.toml` / `.py` → Python.
3. Else ask: *"TypeScript or Python?"*

## Three invocation patterns

### 1. `Agent.prompt(...)` — one-shot

Fire-and-forget scripts, CI steps. No follow-ups.

### 2. `Agent.create(...)` + `agent.send(...)` — durable

Streaming, multi-turn, cancel. TypeScript: `await using agent = await Agent.create(...)`. Python: `with Agent.create(...) as agent:`.

### 3. `Agent.resume(...)` — cross-process

Cloud IDs prefix `bc-`. **Inline MCP servers are not persisted on resume** — pass again.

## Top five traps

1. **Wrong runtime** — explicitly set `local: { cwd }` or `cloud: { repos: [...] }`; default is local silently.
2. **Two failure kinds** — thrown `CursorAgentError` = never started; `result.status === "error"` = ran and failed.
3. **Dispose** — `await using` / `with` / `agent.close()`; `Agent.prompt` disposes for you.
4. **Always `wait()`** — even if you skip streaming.
5. **`run.supports("cancel")`** — not every detached run supports all ops.

## Auth

```bash
export CURSOR_API_KEY="cursor_..."
```

## Model

`composer-2.5` default; list via `Cursor.models.list()`. **Required for local** in both SDKs.

## Production checklist

1. Always dispose.
2. Exit 1 = startup failure; exit 2 = run error; 0 = finished.
3. Log `run.id` and `agent.agentId` after `send()`.
4. Honor `isRetryable` / `retry_after`.
5. Cloud CI: `skipReviewerRequest: true` unless human should be paged.
6. Pass `apiKey` explicitly in shared infrastructure.

## What this skill does not cover

- Cloud Agents REST API (`/v1/agents/*`) for other languages
- `.cursor/hooks.json` (respected, not managed by SDK)
- Self-hosted cloud pools

For the full skill text (patterns, MCP, observing runs), see the Cursor command `sdk` or [SDK docs](https://cursor.com/docs/sdk/typescript).
