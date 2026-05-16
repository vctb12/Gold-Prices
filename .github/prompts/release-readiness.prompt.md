---
mode: agent
description: Pre-merge / pre-deploy release-readiness gate. Run every check that matters and produce a deploy/no-deploy decision.
related_skills:
  - gold-ticker-live-audit
related_instructions:
  - .github/instructions/testing-qa.instructions.md
---

# Prompt: Release Readiness

You are gating a merge or a production deploy. Run every relevant check. Produce a clear
deploy / no-deploy decision with evidence.

## Required steps (in order)

```bash
# 1. Clean
rm -rf playwright-report test-results node_modules
npm install

# 2. Static checks
npm run lint
npm run quality        # lint + prettier:check + stylelint

# 3. Tests
npm test               # node:test under tests/*.test.js

# 4. Build + governance
npm run validate       # full gate
npm run build

# 5. Optional but recommended
npm run a11y           # pa11y-ci
npm run linkcheck      # link health
npm run audit-pages    # per-page audit
npm run perf:ci        # image audit + Playwright reporter
npm run test:playwright # if Playwright suite exists for the change
```

## Manual smoke (do not skip)

- Open `dist/` locally via `npm run preview`
- Homepage, Tracker, Calculator, Shops, Methodology at 360 / 768 / desktop
- Same at `dir="rtl"` (Arabic)
- Freshness label visible on every priced surface
- No console errors

## Pricing / data smoke

- AED peg unchanged: `grep -nE '3\.6725' src/config/constants.js`
- Troy-oz unchanged: `grep -nE '31\.1034768' src/lib/`
- Karat factors sourced from `src/config/karats.js` (no inline replacements in diff)

## SEO smoke

- `npm run seo:governance:check` PASS
- Canonical URLs in `dist/` use `goldtickerlive.com`
- Sitemap regenerated (compare timestamp to `dist/` build)

## Security smoke

- `grep -r SUPABASE_SERVICE_ROLE_KEY dist/` empty
- `grep -r STRIPE_SECRET dist/` empty
- `grep -r JWT_SECRET dist/` empty
- `npm audit --omit=dev` reviewed

## Automation smoke

- If workflow changes are in the PR: `dry_run: true` dispatched and reviewed
- `post_gold.yml` last 24h healthy (`data/automation-*.json`)

## Return format

```md
# Release Readiness — PR <#> / Branch <name>

## Decision
<deploy / hold / block>

## Evidence
| Check                       | Result                                  |
|-----------------------------|-----------------------------------------|
| npm run lint                | PASS                                    |
| npm test                    | PASS — N tests                          |
| npm run validate            | PASS                                    |
| npm run build               | PASS                                    |
| npm run quality             | PASS                                    |
| npm run a11y                | PASS (or N findings — see below)        |
| npm run linkcheck           | 0 broken                                |
| Manual mobile smoke         | PASS at 360/768/desktop                 |
| Manual RTL smoke            | PASS                                    |
| Pricing constants           | Unchanged                               |
| SEO governance              | PASS                                    |
| Security: no secrets in dist| PASS                                    |
| Automation: dry-run         | <PASS / not applicable>                 |

## Notes / findings
- <if any>

## Recommended next action
<merge / fix listed issues then re-run / escalate>
```

Be honest. If you didn't run a step, say so and explain why.
