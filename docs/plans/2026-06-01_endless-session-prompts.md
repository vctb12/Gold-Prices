# Endless Session Prompts — Gold Ticker Live

> **How these work:** Each prompt tells the agent to **scan first**, pick **one** highest-impact
> item not already fixed, implement it, verify, update `PLAN.md`, then stop (or continue only if the
> user asked for a batch). Run the same prompt again tomorrow — it should find **new** work.
>
> **Composer:** `@.github/prompts/<name>.prompt.md`  
> **Copy-paste:** sections below mirror those files.

---

## Meta — pick next work

**File:** `.github/prompts/session-pick-next-work.prompt.md`

```md
You are the lead engineer for Gold Ticker Live (vctb12/GoldTickerLive).

Read first: AGENTS.md, PLAN.md, docs/plans/2026-06-01_master-operations-hub.md, docs/plans/README.md.

1. List open PRs (gh pr list --state open). Do not duplicate an open scope.
2. From the hub "Priority order", pick the single highest-impact **unblocked** slice not recently done.
3. State intent in one paragraph, then implement the smallest correct PR-sized change.
4. If blocked (owner approval, production workflow, CANDIDATES.md), document the blocker in PLAN.md and pick the next slice.

Discovery rule: you must cite evidence of the issue (file:line, test name, or audit row) — no generic refactors.

Verify: npm test, npm run lint, npm run validate, npm run build (as applicable). Update PLAN.md + relevant program checklist.

Return: What / Why / How / Proof / Risks.
```

---

## Repo — discovery & hygiene

**File:** `.github/prompts/endless-repo-discovery.prompt.md`

```md
Gold Ticker Live — **endless repo hygiene** session. Find ONE issue per run.

Read: AGENTS.md, docs/plans/2026-06-01_repo-reorganization-program.md, reports/cleanup-audit/CANDIDATES.md (if present), docs/plans/ARCHIVE_AND_SUPERSESSION_INDEX.md.

Scan (pick the first hit you have not fixed in the last 7 days on main):
- Dead export in a live module (grep importers)
- Duplicate doc saying the opposite of AGENTS.md / PLAN.md
- Script referenced in package.json but missing, or vice versa
- Workflow env var documented in environment-variables.md but missing from workflow (or undocumented secret name)
- Test file importing removed module
- Obvious committed artifact (playwright-report, test-results) — delete + ensure gitignore

Do NOT: delete public URLs, change canonicals, touch post_gold.yml / gold-price-fetch.yml / data/gold_price.json / sw.js / constants.js without approval, or batch-delete >15 files without a plan row.

Fix one item. One commit. npm test + npm run validate. Update PLAN.md backlog or REVAMP_PLAN §29.
```

---

## UI — visual sweep

**File:** `.github/prompts/endless-ui-visual-sweep.prompt.md`

```md
Gold Ticker Live — **endless UI visual sweep**. One page per run.

Read: AGENTS.md, styles/global.css (tokens), docs/DESIGN_TOKENS.md, .github/instructions/frontend-mobile.instructions.md.

1. Open docs/plans/2026-06-01_master-operations-hub.md — pick a primary surface not polished in the last merged PR (rotate: tracker → index → calculator → shops → methodology → country template).
2. At 360px LTR + RTL, fix the worst **single** UX defect: missing focus ring, hover, skeleton vs "Loading…", horizontal scroll, touch target <44px, hardcoded hex where a token exists.
3. EN+AR via translations.js only. Safe DOM only.

Out of scope: pricing formulas, nav IA rewrites, deleting freshness labels.

Verify: npm run validate, npm run build; note manual RTL check in PR.

Update PLAN.md with page name + date.
```

---

## Frontend — page/module polish

**File:** `.github/prompts/endless-frontend-polish.prompt.md`

```md
Gold Ticker Live — **endless frontend** session (JS + HTML + page CSS).

Read: AGENTS.md, src/lib/safe-dom.js, the target page's HTML + src/pages/*.js + styles/pages/*.css.

Discovery (choose one):
- User-visible string not in translations.js (EN+AR)
- Page missing shared nav/footer injection
- interval/setInterval without visibilitychange cleanup
- innerHTML sink not in baseline (must not add new sinks)
- Module with zero importers (candidate removal — confirm via grep + tests)
- Placeholder section with no static fallback on a content page

Implement one fix. Add/update tests if an existing pattern exists in tests/.

Verify: npm test, npm run lint, npm run validate, npm run build.
```

---

## Backend — admin & API

**File:** `.github/prompts/endless-backend-hardening.prompt.md`

```md
Gold Ticker Live — **endless backend** session (Express + Supabase + tests).

Read: AGENTS.md, server.js, server/lib/auth.js, docs/API_BACKEND_FOUNDATION.md, docs/BILLING_AND_ENTITLEMENTS.md.

Discovery (one item):
- Missing auth guard on a route
- Undocumented env var used in server/
- Test gap for public-accounts or admin route
- Rate limit / helmet misconfig vs SECURITY_NOTES.md
- JSON persistence edge case (corrupt file handling)

Do not add new npm dependencies without advisory check. No secrets in code.

Verify: export JWT_SECRET, ADMIN_PASSWORD, ADMIN_ACCESS_PIN; npm test; npm run lint.
```

---

## Integration — links & flows

**File:** `.github/prompts/endless-integration-wiring.prompt.md`

```md
Gold Ticker Live — **endless integration** session.

Read: AGENTS.md, docs/audits/NEXT_PR_SEQUENCE.md PR 1/D1, src/components/nav.js, _redirects.

Pick one flow and fix one broken or weak link:
- Homepage GCC grid → country canonical URL
- Tracker → calculator deep link (hash/query)
- Calculator → shops CTA
- Shops → city gold-rate hub
- Content RelatedGuides → target exists
- EN↔AR toggle preserves path

Prove: grep href, or add a small node:test if pattern exists.

Verify: npm test, npm run validate, npm run build.
```

---

## Monetization — growth without trust loss

**File:** `.github/prompts/endless-monetization-growth.prompt.md`

```md
Gold Ticker Live — **endless monetization** session (no dark patterns).

Read: AGENTS.md, docs/SHOPS_DIRECTORY_AND_SPONSORSHIPS.md, docs/BILLING_AND_ENTITLEMENTS.md, docs/ANALYTICS_EVENTS.md, src/lib/analytics.js.

Discovery (one):
- Empty AdSense slot or layout hole → collapse or remove
- Missing GA4 event on a high-value action (calculator submit, copy price, alert create, shop click)
- Shop listing without "reference vs retail" honesty label
- Lead form without estimate-only disclaimer

Never label reference prices as shop prices. Never hide freshness state for revenue.

Verify: npm test; confirm no new tracking without documentation in ANALYTICS_EVENTS.md.
```

---

## AI — gated integrations

**File:** `.github/prompts/endless-ai-integration.prompt.md`

```md
Gold Ticker Live — **endless AI integration** session (conservative).

Read: AGENTS.md, docs/AI_CONTENT_AUTOMATION.md, docs/AI_RELEASE_READINESS_PLAYBOOK.md.

Allowed without new secrets in git:
- Improve static copy templates for social/newsletter (no LLM keys in repo)
- Document owner steps for API keys in environment-variables.md
- Add disclaimer strings to translations.js for any "AI-generated" surface
- Tests for pure functions that format price context for commentary

NOT allowed in one PR: ship live LLM calls without owner-approved env + disclaimer UI + rate limits.

Pick one doc or pure-function improvement. Verify tests.
```

---

## Docs — governance & consolidation

**File:** `.github/prompts/endless-docs-governance.prompt.md`

```md
Gold Ticker Live — **endless docs governance** session.

Read: AGENTS.md, docs/plans/ARCHIVE_AND_SUPERSESSION_INDEX.md, docs/plans/README.md, PLAN.md.

Pick one:
- Stale status in a plan file vs main (fix checkboxes + date)
- Duplicate instruction (same rule in 3 places) → single canonical pointer
- Missing cross-link from docs/README.md to a new doc
- REVAMP_PLAN.md row out of sync with merged PR

Do not delete historical proposals without archive index entry. No code changes unless a doc references wrong command/path — then fix the doc.

Commit: docs only. No npm build required unless you touched scripts referenced in docs.
```

---

## Trust — gold pricing & freshness

**File:** `.github/prompts/endless-gold-product-trust.prompt.md`

```md
Gold Ticker Live — **endless gold product-trust** session.

Read: AGENTS.md, .github/instructions/gold-pricing.instructions.md, src/config/constants.js, src/config/karats.js, docs/freshness-contract.md.

Discovery (one):
- Visible price without freshness label (source + timestamp + state)
- Karat factor inlined outside karats.js
- Country page using USD→AED→local instead of USD→local FX
- Copy implying shop/retail price from spot formula
- Stale "gold-api.com" attribution vs goldpricez.com canonical

Fix with tests if tests/pricing*.test.js pattern exists.

Verify: npm test, npm run validate. Never change AED peg 3.6725 or troy constant without owner approval.
```

---

## One-shot sessions (not endless)

Use these for **bounded** work; do not re-run until merged:

| Session | Prompt location |
| ------- | ---------------- |
| UI/UX audit 1–5 | `docs/plans/2026-06-01_ui-ux-audit-session-prompts.md`, `.github/prompts/ui-ux-audit-phase*.prompt.md` |
| Repo move C1a–f | `docs/plans/2026-06-01_repo-reorganization-program.md` |
| 12-phase follow-ups | `docs/audits/NEXT_PR_SEQUENCE.md` |

Deep catalog (50+ prompts): [`docs/GOLD_TICKER_LIVE_AGENT_PROMPTS.md`](../GOLD_TICKER_LIVE_AGENT_PROMPTS.md).
