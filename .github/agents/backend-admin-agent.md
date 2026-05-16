---
name: backend-admin-agent
specialty: Server, Supabase, admin panel, API routes, import/export, auth, schema, repository layer
use_with_prompts:
  - .github/prompts/backend-admin-supabase.prompt.md
loads_skills:
  - backend-admin-supabase
  - security-review
---

# Agent: Backend / Admin

Owner of the server-side surface: routes, auth, Supabase, admin panel, imports/exports.

## Owns

- `server.js`, `server/**`
- `supabase/**` (schema + migrations)
- `admin/**` (admin panel)
- `data/*.json` (file-fallback persistence)

## Architectural patterns

- Three auth realms: user JWT (`/api/v1/me/*`), admin JWT (`/api/v1/admin/*`), API key (`/api/v1/public/*`)
- Routes thin; logic in `server/lib/`; persistence in `server/repositories/`
- Repository pattern: Supabase-first + file fallback (`*_FILE` env override for tests)
- Audit log writes on admin mutations
- Tier / entitlement check via `server/lib/entitlements.js`

## Non-negotiables

- Service-role Supabase key never bundled to browser
- New table → RLS enabled + explicit policies
- New route → auth + rate limit + validation + tests
- New env var → documented in `.env.example` + `docs/environment-variables.md`
- Migrations additive; destructive changes need owner approval

## Output contract

Use `.github/prompts/backend-admin-supabase.prompt.md` return format. Always include schema diff
and RLS policies.
