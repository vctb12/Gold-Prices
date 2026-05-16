# AI Prompt Library

Reference for the 13 paste-ready prompts under `.github/prompts/`. For the system overview, see
[`AI_AGENT_OPERATING_SYSTEM.md`](./AI_AGENT_OPERATING_SYSTEM.md).

## Prompt format

Every prompt in this repo follows the same structure:

- **YAML frontmatter** — `mode`, `description`, related skills, related instructions
- **Goal** — one paragraph
- **Required inspection** — files / docs to load first
- **Permission** — what the prompt explicitly allows (counters timid agents)
- **Implementation expectations** — concrete rules
- **Verification** — exact commands to run
- **Return format** — markdown template

If you author a new prompt, follow this standard.

## Index

|   # | Prompt                                                                                    | When to use                                 | Output                                            | Related agent                                  |
| --: | ----------------------------------------------------------------------------------------- | ------------------------------------------- | ------------------------------------------------- | ---------------------------------------------- |
|   1 | [`pr-review`](../.github/prompts/pr-review.prompt.md)                                     | Reviewing any PR                            | Verdict + findings + verification + follow-ups    | `gold-ticker-live-reviewer`                    |
|   2 | [`mobile-ux-audit`](../.github/prompts/mobile-ux-audit.prompt.md)                         | Mobile / RTL polish across primary surfaces | Per-page report + screenshots                     | `frontend-polish-agent`                        |
|   3 | [`workflow-debug`](../.github/prompts/workflow-debug.prompt.md)                           | Any failing GitHub Actions workflow         | Root cause + fix + verification                   | `workflow-safety-agent`                        |
|   4 | [`tracker-flagship-revamp`](../.github/prompts/tracker-flagship-revamp.prompt.md)         | Level-5 tracker workspace rebuild           | Plan + coherent multi-commit PR                   | `frontend-polish-agent` + `pricing-data-agent` |
|   5 | [`seo-noindex-governance`](../.github/prompts/seo-noindex-governance.prompt.md)           | Canonical / noindex / sitemap audit         | Governance findings + governance updates          | `seo-governance-agent`                         |
|   6 | [`pricing-data-audit`](../.github/prompts/pricing-data-audit.prompt.md)                   | End-to-end pricing path audit               | Findings + unit tests                             | `pricing-data-agent`                           |
|   7 | [`provider-bakeoff`](../.github/prompts/provider-bakeoff.prompt.md)                       | Compare / extend price providers            | Scorecard + recommendation (no switch in same PR) | `pricing-data-agent` + `workflow-safety-agent` |
|   8 | [`release-readiness`](../.github/prompts/release-readiness.prompt.md)                     | Pre-merge / pre-deploy gate                 | Deploy / hold decision with evidence              | `gold-ticker-live-reviewer`                    |
|   9 | [`backend-admin-supabase`](../.github/prompts/backend-admin-supabase.prompt.md)           | Backend / admin / Supabase work             | Schema + routes + tests                           | `backend-admin-agent`                          |
|  10 | [`accessibility-audit`](../.github/prompts/accessibility-audit.prompt.md)                 | A11y audit on primary surfaces              | Findings + inline fixes                           | `accessibility-agent`                          |
|  11 | [`country-pages-expansion`](../.github/prompts/country-pages-expansion.prompt.md)         | Add / improve country pages                 | Real local content + SEO + AR                     | `seo-governance-agent`                         |
|  12 | [`shops-data-honesty`](../.github/prompts/shops-data-honesty.prompt.md)                   | Audit shops directory                       | Honesty findings + UX fixes                       | `frontend-polish-agent`                        |
|  13 | [`x-twitter-automation-review`](../.github/prompts/x-twitter-automation-review.prompt.md) | Audit hourly X-post pipeline                | Posture + findings + observability summary        | `workflow-safety-agent`                        |

## Agent routing matrix

| If the task is...                 | Use prompt                          | Use skill                                         | Use agent                                      |
| --------------------------------- | ----------------------------------- | ------------------------------------------------- | ---------------------------------------------- |
| Reviewing a PR                    | `pr-review`                         | `gold-ticker-live-audit`                          | `gold-ticker-live-reviewer`                    |
| Tracker redesign                  | `tracker-flagship-revamp`           | `mobile-ux-review` + `pricing-data-integrity`     | `frontend-polish-agent` + `pricing-data-agent` |
| Mobile / RTL polish               | `mobile-ux-audit`                   | `mobile-ux-review`                                | `frontend-polish-agent`                        |
| Workflow failure                  | `workflow-debug`                    | `github-actions-debug`                            | `workflow-safety-agent`                        |
| X-post pipeline review            | `x-twitter-automation-review`       | `github-actions-debug` + `pricing-data-integrity` | `workflow-safety-agent`                        |
| Canonical / sitemap / noindex     | `seo-noindex-governance`            | `seo-governance`                                  | `seo-governance-agent`                         |
| Country / city page expansion     | `country-pages-expansion`           | `seo-governance`                                  | `seo-governance-agent`                         |
| Pricing data audit                | `pricing-data-audit`                | `pricing-data-integrity`                          | `pricing-data-agent`                           |
| Price-provider bakeoff            | `provider-bakeoff`                  | `pricing-data-integrity` + `github-actions-debug` | `pricing-data-agent` + `workflow-safety-agent` |
| Server / Supabase / admin feature | `backend-admin-supabase`            | `backend-admin-supabase` + `security-review`      | `backend-admin-agent`                          |
| Release / deploy gate             | `release-readiness`                 | `gold-ticker-live-audit`                          | `gold-ticker-live-reviewer`                    |
| Security review (standalone)      | `pr-review` (security section only) | `security-review`                                 | `security-review-agent`                        |
| Accessibility audit               | `accessibility-audit`               | `mobile-ux-review` + `frontend-design-system`     | `accessibility-agent`                          |
| Shops directory data              | `shops-data-honesty`                | `mobile-ux-review`                                | `frontend-polish-agent`                        |

## Task depth levels

Use this to calibrate how ambitious your output should be.

| Level | Description                  | Examples                                                  |
| ----- | ---------------------------- | --------------------------------------------------------- |
| 1     | Quick fix                    | Typo, broken link, wrong meta description                 |
| 2     | Targeted improvement         | Single-component polish, single test, single route        |
| 3     | Page / module refactor       | Calculator inputs rebuild, one country page expansion     |
| 4     | Cross-system upgrade         | UI/UX revamp across 3+ pages, design-system consolidation |
| 5     | Product-level transformation | Tracker flagship revamp, backend foundation, billing      |

Level 4 and Level 5 tasks require a plan file under `docs/plans/` and a draft PR before
implementation.

## Prompt quality standard

A new prompt is "ready to ship" when it includes:

- [ ] Frontmatter (`mode`, `description`, related skills, related instructions)
- [ ] One-sentence goal
- [ ] Required inspection (files to read first)
- [ ] Permission block (explicit "you may / you may not")
- [ ] Implementation expectations
- [ ] Verification commands (real, from `package.json`)
- [ ] Return format with markdown template

## What not to do — bad vs. good prompts

**Bad:**

```text
Make the UI better.
```

**Good:**

```text
Audit tracker mobile layout at 360, 390, and 430 px. Improve sticky controls,
table overflow, primary CTA hierarchy, chart readability, Arabic RTL spacing,
and stale/reference labels. Preserve pricing formulas and run npm run build
plus the Playwright smoke tests.
```

**Bad:**

```text
Fix SEO.
```

**Good:**

```text
Audit canonicals, sitemap inclusion, robots.txt, noindex pages, country page
title/H1 uniqueness, internal methodology links, and custom-domain vs old
GitHub Pages path consistency. Use .github/prompts/seo-noindex-governance.prompt.md.
```
