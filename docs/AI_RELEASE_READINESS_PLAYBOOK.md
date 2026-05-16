# Release Readiness Playbook

End-to-end gate for merging a PR or deploying to production. Use the
[`release-readiness.prompt.md`](../.github/prompts/release-readiness.prompt.md) prompt to invoke
this with an agent; this doc is the human-readable reference.

## Pre-release checks (in order)

### 1. Clean workspace

```bash
rm -rf playwright-report test-results
git status   # confirm no uncommitted changes you didn't intend
```

> `playwright-report/` and `test-results/` contain inline scripts that `validate-build.js` will
> refuse. Always remove before running tests / validate.

### 2. Install + static checks

```bash
npm install
npm run lint
npm run quality       # lint + prettier:check + stylelint
```

### 3. Unit + integration tests

```bash
npm test              # node:test under tests/*.test.js
```

Expected: all tests PASS. Note the test count in the PR body.

### 4. Validate (full gate)

```bash
npm run validate
```

This includes:

- build integrity
- DOM-safety baseline (`check-unsafe-dom`)
- SEO meta check
- sitemap coverage
- placeholder scan
- analytics gate
- SEO governance (non-blocking warn)
- export-analytics-inventory check (non-blocking warn)

### 5. Build

```bash
npm run build
```

Verify `dist/` contains:

- `index.html`, `tracker.html`, `calculator.html`, etc.
- Regenerated `sitemap.xml` and `robots.txt`
- `CNAME` (for the custom domain)
- `404.html`
- `sw.js` and hashed assets

### 6. Accessibility (optional but recommended)

```bash
npm run a11y          # pa11y-ci
```

### 7. Link health (optional)

```bash
npm run linkcheck
npm run audit-pages
```

### 8. Performance (optional, for changes touching key pages)

```bash
npm run perf:ci       # image audit + Playwright reporter
```

Compare LCP / CLS / TBT against `docs/performance-baseline.json`.

### 9. Playwright (if the change has a Playwright suite)

```bash
npm run test:playwright
```

---

## Manual smoke (cannot be skipped)

Open `dist/` via `npm run preview` and verify on real device emulation:

### Mobile (360 px) — EN

- [ ] Homepage renders, freshness pill visible, primary CTA reachable
- [ ] Tracker renders, price + state + source + timestamp visible, chart legible
- [ ] Calculator renders, inputs labelled, result shows VAT + making-charge disclaimer
- [ ] Shops renders, filter chips visible, verified tier wording honest
- [ ] Methodology renders, sections navigable
- [ ] No console errors on any of the above

### Mobile (360 px) — AR (`dir="rtl"`)

Same set as above. Verify:

- [ ] Chevrons / arrows mirrored
- [ ] Layout balanced (no overflow caused by AR length)
- [ ] Tabular numbers still tabular

### Desktop (1280 px) — EN

- [ ] Homepage hero balanced
- [ ] Tracker workspace usable
- [ ] No visible layout shift on price update

---

## Pricing constants smoke

```bash
grep -nE '3\.6725' src/config/constants.js          # must show the AED peg
grep -nE '31\.1034768' src/lib/price-calculator.js  # must show troy ounce
```

If you don't see these, **stop** — owner approval required before continuing.

---

## SEO smoke

```bash
npm run seo:governance:check
grep -r 'rel="canonical"' dist/ | grep -v 'goldtickerlive.com'
# ^ should be empty (canonicals all point to the custom domain)
ls -la dist/sitemap.xml
# ^ should be regenerated (timestamp within build window)
```

---

## Security smoke

```bash
grep -r SUPABASE_SERVICE_ROLE_KEY dist/   # must be empty
grep -r STRIPE_SECRET dist/                # must be empty
grep -r JWT_SECRET dist/                   # must be empty
npm audit --omit=dev                        # HIGH/CRITICAL triaged
```

---

## Automation smoke

If the PR changes any workflow file:

- [ ] Dispatched with `workflow_dispatch` + `dry_run: true` (where supported)
- [ ] Logs reviewed via GitHub MCP tools (`get_job_logs`)
- [ ] No secrets in logs

If the PR changes `post_gold.yml`:

- [ ] Last 24h of `data/automation-*.json` reviewed and healthy
- [ ] Tweet body produced in dry-run reviewed for length + content + freshness

---

## Decision

| Outcome | Meaning                                                                |
| ------- | ---------------------------------------------------------------------- |
| Deploy  | All pre-release + manual + pricing + SEO + security checks PASS        |
| Hold    | One or more important non-blocking findings; fix then re-gate          |
| Block   | A blocking finding (pricing regression, secret leak, broken canonical) |

---

## Post-release checks (after deploy lands on production)

- [ ] `https://goldtickerlive.com/` loads with freshness label
- [ ] `https://goldtickerlive.com/tracker.html` shows live price
- [ ] `https://goldtickerlive.com/sitemap.xml` contains today's `lastmod`
- [ ] `https://goldtickerlive.com/robots.txt` unchanged
- [ ] Service worker registered (DevTools → Application)
- [ ] First post-deploy `post_gold.yml` run succeeds (within 1h)
- [ ] Search Console / Bing Webmaster show no new errors (24h)

---

## Rollback

If a critical regression is detected post-deploy:

1. **Don't force-push.** `git revert <commit>` on `main`, push, deploy.
2. If the regression is data-only (a stale snapshot, a bad tweet), trigger the relevant workflow
   with corrected inputs — no code revert needed.
3. If `post_gold.yml` is misbehaving, set the schedule to manual-only by dispatching with a known
   safe input until the code revert lands.
4. Open a postmortem issue tagged `incident` with:
   - Symptoms
   - Detection (how, when, who)
   - Cause
   - Fix
   - Prevention (what new check would have caught this?)

Postmortems should produce new entries in `AI_AGENT_REVIEW_CHECKLISTS.md` Risk Register where the
failure mode wasn't previously listed.

---

## Final-report template (release PR)

```md
# Release Readiness — PR #<n>

## Decision

<deploy / hold / block>

## Verification matrix

| Check                       | Result            |
| --------------------------- | ----------------- |
| npm run lint                | PASS              |
| npm test                    | PASS — N tests    |
| npm run validate            | PASS              |
| npm run build               | PASS              |
| npm run quality             | PASS / SKIPPED    |
| npm run a11y                | PASS / N findings |
| npm run linkcheck           | 0 broken          |
| Manual mobile smoke (EN)    | PASS              |
| Manual RTL smoke (AR)       | PASS              |
| Pricing constants unchanged | PASS              |
| SEO governance              | PASS              |
| No secrets in dist/         | PASS              |
| Automation dry-run          | PASS / N/A        |

## Notes

- <if any>

## Post-deploy follow-ups

- [ ] Confirm first post-deploy X-post (within 1h)
- [ ] Confirm Search Console crawl (within 24h)
```
