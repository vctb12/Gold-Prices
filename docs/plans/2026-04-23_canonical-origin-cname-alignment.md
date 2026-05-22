# Plan — Canonical-origin / `CNAME` alignment

```yaml plan-status
status: not-started
priority: P2
class: A
owner: @vctb12
last_run_at: ""
last_run_pr: ""
last_run_agent: copilot
slices_remaining_estimate: 0
next_action: ""
blocked_on: ""
guardrails_reviewed: true
skills_used: []
```

**Date:** 2026-04-23 **Status:** 📥 Proposal (plan-only, awaiting owner approval) **Audit ref:**
[`docs/REPO_AUDIT.md` §D, §J-P0-1](../REPO_AUDIT.md) **Campaign ref:** PR #2 of the
charter-respecting multi-PR campaign (plan-first per [`AGENTS.md` §4.3](../../AGENTS.md))
**Requires:** owner decision between Option A and Option B below before any implementation PR is
opened.

> This is a **plan file**. It proposes no code, SEO, or `CNAME` edits. Per
> [`AGENTS.md` §6.4](../../AGENTS.md#6-product-trust-guardrails), canonicals / `robots.txt` /
> sitemap / `og:*` / `CNAME` changes must ride on a reviewed plan, never a silent diff. Approval of
> this plan unblocks a separate focused implementation PR.

---

## 1. Problem statement

The repo publishes an **apex** canonical origin everywhere except `CNAME`:

| Surface                        | Value                                    | Source                                                           |
| ------------------------------ | ---------------------------------------- | ---------------------------------------------------------------- |
| `index.html` `rel="canonical"` | `https://goldtickerlive.com/`            | [`index.html`](../../index.html)                                 |
| `index.html` `og:url`          | `https://goldtickerlive.com/`            | [`index.html`](../../index.html)                                 |
| `robots.txt` sitemap           | `https://goldtickerlive.com/sitemap.xml` | [`robots.txt`](../../robots.txt)                                 |
| Sitewide test enforcement      | **forbids** `www.` and `http://`         | [`tests/seo-sitewide.test.js`](../../tests/seo-sitewide.test.js) |
| `CNAME`                        | `www.goldtickerlive.com`                 | [`CNAME`](../../CNAME)                                           |

The GitHub Pages deployment copies `CNAME` into `dist/`
([`deploy.yml:71-72`](../../.github/workflows/deploy.yml)) and publishes on the value in `CNAME`,
which forces apex requests through a 301 redirect to `www.` before they resolve. That extra hop is
inconsistent with every canonical URL the site publishes and costs a small but real amount of Core
Web Vitals + crawl budget on every apex visit.

**This is the kind of decision §6.4 exists to protect.** A silent edit to `CNAME` would change the
host every indexed URL redirects through and could invalidate external inbound links. A silent edit
to every canonical and the sitemap would flip hundreds of indexed URLs at once. Either direction is
reviewable work; neither is a drive-by fix.

---

## 2. Goal

Pick one canonical origin and make every artefact in the repo agree with it. The choice is the
owner's. This plan lays out the two options, the files each touches, and the rollback/testing
posture.

---

## 3. Options

### Option A — Align `CNAME` to the apex origin (**recommended by default**)

Change `CNAME` from `www.goldtickerlive.com` → `goldtickerlive.com`. Every other repo surface
already matches this choice; the implementation is a one-line file change plus a single DNS sanity
check by the owner.

**Files the implementation PR would touch:**

| File                   | Change                                                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------------------------------ |
| `CNAME`                | `www.goldtickerlive.com` → `goldtickerlive.com`                                                              |
| `docs/SEO_STRATEGY.md` | Add a short "Canonical origin" subsection recording the apex decision                                        |
| `docs/REVAMP_PLAN.md`  | Check off the relevant item in §22 / §25 (known issues) if an entry exists; otherwise append a one-line note |
| `docs/REPO_AUDIT.md`   | Update §D note: "resolved in PR #<n>" with date                                                              |

**Out-of-repo prerequisite (owner-only):** the apex DNS must already resolve to GitHub Pages
(ALIAS/ANAME or the four A records `185.199.108-111.153`) with `AAAA` fallbacks, and the www CNAME
must point at `<owner>.github.io`. GitHub Pages' "Enforce HTTPS" setting must be enabled for the
apex. If any of this is missing, the PR is blocked until the owner confirms DNS is ready. The plan
does not modify DNS.

**User-visible impact:** after DNS propagation, apex requests stop redirecting to `www.`; `www.`
requests redirect to apex. Every already-indexed URL (which already uses the apex form in
canonicals) now resolves without a hop. Inbound links that targeted `www.` get a single 301 to apex.

### Option B — Align canonicals + sitemap + tests to `www.`

Flip every canonical / `og:url` / sitemap reference + the sitewide test expectation from apex to
`www.`. This is the larger-blast-radius option and is only justified if the owner wants to keep the
`www.` subdomain as the marketing primary.

**Files the implementation PR would touch (enumerated, not scoped-creeping):**

| File / pattern                                                               | Change                                                                        |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Every HTML with `rel="canonical"` or `og:url` (~689 files)                   | `goldtickerlive.com` → `www.goldtickerlive.com`                               |
| `robots.txt`                                                                 | Sitemap URL host                                                              |
| `tests/seo-sitewide.test.js`                                                 | Invert the www/apex assertion (this is intentional, the test is the contract) |
| `tests/seo-metadata.test.js`                                                 | Update expected canonical                                                     |
| `build/generateSitemap.js` + any generator that emits URLs                   | Origin constant                                                               |
| `scripts/node/generate-sitemap.js`                                           | Origin constant                                                               |
| `src/seo/*`                                                                  | Any hardcoded origin                                                          |
| `docs/SEO_STRATEGY.md`, `docs/SEO_CHECKLIST.md`, `docs/SEO_SITEMAP_GUIDE.md` | Documentation                                                                 |

**Migration/SEO risk:** search engines need to reprocess every canonical change. Historic backlinks
using apex will all redirect through www. The charter's prior convention (repo memory “Canonical
origin is `https://goldtickerlive.com` (apex, no www). Never use www in canonical/og:url”) is
reversed — the test contract inverts — so this has to be a single atomic PR.

**Recommendation:** Option A unless there is a marketing / analytics reason the owner prefers
`www.`.

---

## 4. Success criteria

(Applies to whichever option ships.)

- `tests/seo-sitewide.test.js` passes on the new origin (test is updated if Option B).
- `tests/seo-metadata.test.js` passes.
- `npm run validate` — 0 errors, no new warnings.
- `scripts/node/check-sitemap-coverage.js` — 100% aligned.
- `linkinator` baseline (`npm run linkcheck:dist`) does not show new broken internals.
- After deploy: `curl -sI https://goldtickerlive.com/` and
  `curl -sI https://www.goldtickerlive.com/` both resolve, with exactly one 301 between them in the
  expected direction, both serving `HTTP/2 200` on the destination, and both serving the same
  `Cache-Control` from `_headers`.
- No change to `robots.txt` `Disallow` lines, `og:image`, `twitter:*`, or JSON-LD shape. The only
  values changing are origin hostnames.

---

## 5. Rollback

Single-commit revert. Because §6.9 forbids force-push, rollback is `git revert <sha>` and redeploy.
DNS does not need to be rolled back — both hostnames remain valid; only which one is primary
changes. GitHub Pages accepts `CNAME` swaps without caching issues beyond normal DNS TTL.

For Option B, rollback is larger but still a single revert because the implementation PR is required
to be a single atomic commit (no intermediate half-state where some canonicals point apex and others
point www).

---

## 6. Charter-compliance checklist

| Clause                                | How honored                                                                                                                                                    |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| §6.1 – §6.3 price-data invariants     | No price / freshness / retail-vs-reference surface is touched. N/A.                                                                                            |
| §6.4 SEO surface integrity            | This is the plan PR §6.4 requires. Implementation only proceeds after owner approval on this file.                                                             |
| §6.5 static architecture stays static | No SPA / framework migration. Static multi-page architecture unchanged.                                                                                        |
| §6.6 EN/AR parity                     | Origin change applies identically to EN and AR pages; no user-visible copy changes. `tests/nav-data.test.js` and sitewide parity checks remain green.          |
| §6.7 DOM-safety baseline              | No `innerHTML` / `safe-dom` surface touched. Baseline unchanged.                                                                                               |
| §6.8 no secrets in git                | N/A — no secrets.                                                                                                                                              |
| §6.9 PR-only, no force-push           | Both the plan PR and the implementation PR will be opened against `main`, reviewed, and merged normally.                                                       |
| §6.10 `post_gold.yml` untouched       | This workflow is not referenced or modified.                                                                                                                   |
| §6.11 honest verification             | Post-deploy `curl -sI` output + test run outputs attached to the implementation PR. No fabricated Lighthouse numbers; those belong to a separate perf plan PR. |

---

## 7. Test plan

### Pre-merge (CI)

- `npm run validate` — passes with 0 errors.
- `npm run quality` — eslint + prettier + stylelint clean on the touched files.
- `npm test` — all 23 suites green. Specifically:
  - `tests/seo-sitewide.test.js` — asserts the new origin and rejects the old form.
  - `tests/seo-metadata.test.js` — index.html canonical matches new origin.
  - `tests/sitemap.test.js` — sitemap URLs use new origin.
- `NODE_ENV=production npm run build` — dist builds; `CNAME` is copied through to dist; sitemap
  regenerates with correct origin.
- Playwright `e2e` job — smoke tests remain green against the `python3 -m http.server` preview
  (Playwright tests don't depend on the public origin).

### Post-merge (manual, recorded in implementation PR body)

- `curl -sI https://goldtickerlive.com/ | head -20` — status code, Location header, Cache-Control.
- `curl -sI https://www.goldtickerlive.com/ | head -20` — status code, Location header.
- `curl -s https://goldtickerlive.com/robots.txt | head -20` — sitemap URL.
- `curl -s https://goldtickerlive.com/sitemap.xml | head -20` — first entries match the chosen
  origin.
- Google Search Console → confirm the preferred property (apex or www) is the one we just aligned
  on. If changing, submit a re-crawl of the sitemap. (Owner-only; not scripted.)

### No live-site Lighthouse claim

Post-deploy Lighthouse deltas belong to a separate performance plan PR (audit §J-P1-6). Claiming LCP
/ INP / CLS improvements from origin alignment alone without measured evidence would violate §6.11.
The implementation PR body will note only the redirect-hop saving qualitatively.

---

## 8. Phased rollout

Not applicable. This is atomic:

- **Option A (1 PR):** change `CNAME`, update docs cross-refs, merge, deploy. GitHub Pages picks up
  the new primary domain on the next deploy.
- **Option B (1 PR):** change every origin reference in one atomic commit so no intermediate
  half-state is indexable.

No feature flag. No percentage rollout. No canary (doesn't apply to static origin alignment).

---

## 9. Out of scope (explicit)

- Any performance optimization, image work, font-loading change, or Lighthouse-driven edits.
- Any change to `robots.txt` `Disallow` lines, `og:image`, `twitter:card` type, JSON-LD `@type`
  values, or `hreflang`.
- Any change to `_redirects`, `_headers`, or `.htaccess` beyond what is strictly required to make
  the chosen origin resolve correctly (current `_redirects` does not contain origin hostnames; no
  change expected).
- Dependency version bumps.
- Any change to `deploy.yml`, `ci.yml`, `post_gold.yml`, or any other workflow.
- Any change to EN/AR translations in `src/config/translations.js`.

---

## 10. Open questions for the owner

1. **Option A or Option B?** Default recommendation is A (apex primary) because every existing
   canonical already points there; B is larger and only justified by marketing / analytics
   preference for `www.`.
2. **DNS readiness for Option A:** does apex `goldtickerlive.com` already have ALIAS/ANAME or the
   four GitHub Pages A records + AAAA fallbacks, with HTTPS enforcement enabled in Pages settings?
   If not, the implementation PR is blocked on DNS.
3. **Historic backlinks:** are there meaningful inbound links on `www.` that would benefit from
   being left as the primary, or are inbound links already apex-heavy?
4. **Search Console:** is the verified property apex, www, or both? If only one, the implementation
   PR should note the need to add / swap the preferred property.

Approval of one option (and clearance of (2)) unblocks the implementation PR.
