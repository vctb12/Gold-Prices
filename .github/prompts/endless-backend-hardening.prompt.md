---
mode: agent
description: Endless backend — one Express/Supabase/auth/test gap per run.
related_skills:
  - backend-admin-supabase
  - security-review
related_instructions:
  - .github/instructions/backend-admin.instructions.md
---

# Prompt: Endless Backend Hardening

## Goal

Close **one** backend gap per run (`server/`, `server.js`, admin routes, public accounts API).

## Required inspection

1. [`docs/API_BACKEND_FOUNDATION.md`](../../docs/API_BACKEND_FOUNDATION.md)
2. [`docs/BILLING_AND_ENTITLEMENTS.md`](../../docs/BILLING_AND_ENTITLEMENTS.md)
3. [`server/lib/auth.js`](../../server/lib/auth.js)

## Discovery examples

- Missing auth on a route
- Undocumented env var
- Missing test in `tests/*api*.test.js`
- Rate limit / Helmet gap vs `docs/SECURITY_NOTES.md`

## Not allowed

- New npm deps without advisory check
- Secrets in git

## Verification

```bash
export JWT_SECRET="dev-secret-key-for-local-development-32chars"
export ADMIN_PASSWORD="admin-dev-password"
export ADMIN_ACCESS_PIN="123456"
npm test && npm run lint
```

## Return format

Route/issue → fix → test name → risks.
