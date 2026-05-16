---
mode: agent
description: Plan or implement backend / admin / Supabase work — schema, routes, admin features, import/export flows.
related_skills:
  - backend-admin-supabase
  - security-review
related_instructions:
  - .github/instructions/backend-supabase.instructions.md
  - .github/instructions/security.instructions.md
---

# Prompt: Backend / Admin / Supabase

Plan or implement a backend / admin / Supabase change.

## Goal

A coherent change that respects the route → lib → repository → schema layering, RLS by default,
file-fallback for tests, and the user-vs-admin auth boundary.

## Required inspection

1. `docs/API_BACKEND_FOUNDATION.md` — overall API shape
2. `docs/SUPABASE_SCHEMA.md` — current schema
3. `docs/ADMIN_GUIDE.md`, `docs/ADMIN_OPERATIONS_DASHBOARD.md`
4. `server.js` — mount order matters (developer-api before public-accounts, etc.)
5. `server/routes/` for an example route in the same domain
6. `server/repositories/` for the file-fallback pattern
7. [`backend-admin-supabase/SKILL.md`](../skills/backend-admin-supabase/SKILL.md) + checklists

## Permission

You may:

- Add new tables (with RLS + policies + repository + file fallback)
- Add new routes (with auth + rate limit + validation)
- Add new admin operations (with audit log)
- Extend `entitlements.js` with new tiers / limits
- Add new env vars (documented in `.env.example` + `docs/environment-variables.md`)

You may not (without owner approval):

- Drop or destructively alter existing tables / columns
- Disable RLS on an existing table
- Move secrets into client bundles
- Add a new external service without a `gh-advisory-database` check and a security review

## Implementation expectations

- Schema first (if new tables): write the SQL + RLS + policies
- Repository with Supabase-first + file-fallback (`SHOP_LEADS_FILE` env-override pattern)
- Route thin; logic in `lib/`
- Validation: reject unknown body fields
- Errors: server logs full; client gets a safe code/message
- Audit log writes for admin mutations
- Tests: success / auth failure / validation failure / rate-limit edge

## Verification

```bash
npm test                      # includes backend tests
npm run lint
npm run validate
node --test tests/<your-test>.test.js
# Manual: hit the new endpoint via curl with valid and invalid auth
```

## Return format

```md
# Backend Change — <feature>

## What
<one-liner>

## Architecture
- Route: <method> /api/v1/<...>
- Auth: <user / admin / api-key / none + rate limit>
- Lib: server/lib/<file>
- Repository: server/repositories/<file>  (Supabase + file fallback)
- Tables: <new tables or existing>

## Schema changes
<SQL diff>

## RLS policies
<policy list>

## Tests
- <test file>: <scenarios covered>

## Verification
- `npm test`: PASS — N tests
- Manual curl: <happy path + auth fail + validation fail>

## Docs updated
- docs/API_BACKEND_FOUNDATION.md (route table)
- docs/SUPABASE_SCHEMA.md (schema entry)
- .env.example (if new env var)

## Risks
- <e.g. new table needs a backfill if migrating existing data>
```
