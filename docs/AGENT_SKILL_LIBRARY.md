# Agent Skill Library

Reference for the 8 skills under `.github/skills/`. Each entry says **when** to use the skill,
**what** it covers, **which files** it relates to, **which prompts** invoke it, and an **example
invocation**.

For the system overview, see [`AI_AGENT_OPERATING_SYSTEM.md`](./AI_AGENT_OPERATING_SYSTEM.md).

---

## 1. `gold-ticker-live-audit`

> Path: [`.github/skills/gold-ticker-live-audit/`](../.github/skills/gold-ticker-live-audit/)

**When to use**

- Onboarding to the repo for the first time in a session
- Planning a multi-surface change ("revamp", "redesign", "expand")
- Pre-PR sanity sweep
- Audit-only PRs that produce a report instead of code

**What it covers**

- Repo inspection order
- Pricing / frontend / SEO / automation / security / release checklists
- Audit-only PR report template

**Related files**

- `AGENTS.md`, `docs/REVAMP_PLAN.md`, all `.github/instructions/*`

**Related prompts**

- [`pr-review.prompt.md`](../.github/prompts/pr-review.prompt.md)
- [`release-readiness.prompt.md`](../.github/prompts/release-readiness.prompt.md)

**Example invocation**

```text
Use the gold-ticker-live-audit skill to plan a revamp of the homepage hero +
country index. Produce a draft plan file before editing.
```

---

## 2. `github-actions-debug`

> Path: [`.github/skills/github-actions-debug/`](../.github/skills/github-actions-debug/)

**When to use**

- A scheduled or PR workflow failed
- `post_gold.yml` is silent / duplicating / OAuth-failing
- Provider smoke / bakeoff failing
- GitHub Pages deploy not picking up changes
- CodeQL flagged a finding

**What it covers**

- Triage with GitHub MCP tools
- `post_gold.yml` specifics (duplicate detect, length, OAuth, stale)
- Provider bakeoff
- Pages deploy
- Common failure modes table

**Related files**

- `.github/workflows/**`, `scripts/python/**`, `docs/AUTOMATIONS.md`,
  `docs/X_AUTOMATION_OBSERVABILITY.md`

**Related prompts**

- [`workflow-debug.prompt.md`](../.github/prompts/workflow-debug.prompt.md)
- [`x-twitter-automation-review.prompt.md`](../.github/prompts/x-twitter-automation-review.prompt.md)
- [`provider-bakeoff.prompt.md`](../.github/prompts/provider-bakeoff.prompt.md)

**Example invocation**

```text
Use the github-actions-debug skill. post_gold.yml just failed run <id> with a
403. Triage and fix.
```

---

## 3. `mobile-ux-review`

> Path: [`.github/skills/mobile-ux-review/`](../.github/skills/mobile-ux-review/)

**When to use**

- Mobile-first redesign / polish
- Tracker, homepage, calculator, shops UX work
- Arabic / RTL mobile parity check
- Mobile keyboard / input / sticky-control regression

**What it covers**

- Page-by-page checklists (homepage / tracker / calculator / shops)
- RTL mobile checklist
- Common mobile mistakes

**Related prompts**

- [`mobile-ux-audit.prompt.md`](../.github/prompts/mobile-ux-audit.prompt.md)
- [`tracker-flagship-revamp.prompt.md`](../.github/prompts/tracker-flagship-revamp.prompt.md)
- [`accessibility-audit.prompt.md`](../.github/prompts/accessibility-audit.prompt.md)

**Example invocation**

```text
Use the mobile-ux-review skill. Audit tracker.html and calculator.html at 360 /
390 / 430 px, EN + AR. Implement fixes.
```

---

## 4. `seo-governance`

> Path: [`.github/skills/seo-governance/`](../.github/skills/seo-governance/)

**When to use**

- SEO audit or strategy change
- Adding / removing / consolidating pages
- Sitemap or robots changes
- Country / city / karat / content hub expansion
- Custom-domain vs. legacy GitHub Pages cleanup

**What it covers**

- Canonical / sitemap / noindex / country-pages / content-pages checklists
- Governance allowlist mechanics
- Schema injection

**Related prompts**

- [`seo-noindex-governance.prompt.md`](../.github/prompts/seo-noindex-governance.prompt.md)
- [`country-pages-expansion.prompt.md`](../.github/prompts/country-pages-expansion.prompt.md)

**Example invocation**

```text
Use the seo-governance skill. Audit canonicals + noindex policy across the
countries/ tree. Update governance allowlist where needed.
```

---

## 5. `pricing-data-integrity`

> Path: [`.github/skills/pricing-data-integrity/`](../.github/skills/pricing-data-integrity/)

**When to use**

- Editing `src/lib/price-calculator.js`, `src/config/karats.js`, `src/config/constants.js`
- Adding / swapping a price provider adapter
- Changing freshness thresholds or cache strategies
- Editing historical data resolution / aggregation
- Editing CSV / JSON export shape

**What it covers**

- Formula / freshness / historical-data / exports checklists
- The non-negotiable constants
- Common mistakes (inline karat factors, `31.1`, AED double conversion)

**Related prompts**

- [`pricing-data-audit.prompt.md`](../.github/prompts/pricing-data-audit.prompt.md)
- [`provider-bakeoff.prompt.md`](../.github/prompts/provider-bakeoff.prompt.md)

**Example invocation**

```text
Use the pricing-data-integrity skill. Audit calculator vs. tracker for the same
inputs. Add unit tests for any drift.
```

---

## 6. `frontend-design-system`

> Path: [`.github/skills/frontend-design-system/`](../.github/skills/frontend-design-system/)

**When to use**

- Consolidating duplicated card / button / panel variants
- Adding a new design token
- Auditing CSS for off-token values
- Building a new reusable component

**What it covers**

- Token / component / responsive-layout / accessibility checklists
- The token taxonomy

**Related prompts**

- [`mobile-ux-audit.prompt.md`](../.github/prompts/mobile-ux-audit.prompt.md)
- [`tracker-flagship-revamp.prompt.md`](../.github/prompts/tracker-flagship-revamp.prompt.md)

**Example invocation**

```text
Use the frontend-design-system skill. Consolidate the 6 .card variants under
styles/pages/ into a token-driven primitive.
```

---

## 7. `security-review`

> Path: [`.github/skills/security-review/`](../.github/skills/security-review/)

**When to use**

- Adding / changing an API route
- Touching Supabase access patterns
- Editing workflows that reference secrets
- Reviewing `.env.example` changes
- Triaging a secret-scanning alert

**What it covers**

- Secrets / server / Supabase / workflows checklists
- Top 6 threat model
- Standing grep commands

**Related prompts**

- [`pr-review.prompt.md`](../.github/prompts/pr-review.prompt.md)
- [`backend-admin-supabase.prompt.md`](../.github/prompts/backend-admin-supabase.prompt.md)

**Example invocation**

```text
Use the security-review skill. Scan the PR diff for secret leaks and verify
no service-role key in the built bundle.
```

---

## 8. `backend-admin-supabase`

> Path: [`.github/skills/backend-admin-supabase/`](../.github/skills/backend-admin-supabase/)

**When to use**

- Adding a server route
- Touching the Supabase schema
- Building / modifying the admin panel
- Import / export flows (shops, leads, newsletter, billing)

**What it covers**

- Database / admin / API / auth checklists
- Route → lib → repository → schema layering
- File-fallback pattern for tests

**Related prompts**

- [`backend-admin-supabase.prompt.md`](../.github/prompts/backend-admin-supabase.prompt.md)

**Example invocation**

```text
Use the backend-admin-supabase skill. Add a /api/v1/admin/alerts/audit endpoint
with file-fallback and tests.
```
