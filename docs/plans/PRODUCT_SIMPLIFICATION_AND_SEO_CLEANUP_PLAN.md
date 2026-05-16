# Product Simplification & SEO Cleanup Plan (PR 2 Safety Pass)

Status: locked for this PR (no deletions, no redirects rollout yet).

Source baseline: `docs/audits/PAGE_CLEANUP_AND_PRODUCT_FOCUS.md`

## Scope guardrails

- No page deletions in this PR.
- No route deletions in this PR.
- No gold pricing formula changes.
- No X/Twitter automation changes.
- Keep EN/AR and RTL behavior intact.

## Keep pages (indexable now)

- Core product/legal pages:
  - `index.html`, `tracker.html`, `methodology.html`, `shops.html`, `pricing.html`
  - `developer.html`, `dashboard.html`, `account.html`
  - `privacy.html`, `terms.html`, `404.html`, `offline.html`
- Country main pages:
  - `countries/<country>/index.html` and core country/city gold-rate hubs
- Important city gold-rate hub pages:
  - `countries/*/*/gold-rate/index.html` (do not newly noindex in this PR)

## Merge pages (later PRs, no merge now)

- `learn.html` + `insights.html` toward one knowledge hub.
- Overlapping karat guides under `content/guides/` + `content/22k-gold-price-guide/` + `content/24k-gold-price-guide/`.
- City `gold-prices/` overlap candidates into city `gold-rate/` in later sequence.

## Noindex pages (this PR)

- Per-karat city pages:
  - `countries/*/*/gold-rate/18-karat/index.html`
  - `countries/*/*/gold-rate/21-karat/index.html`
  - `countries/*/*/gold-rate/22-karat/index.html`
  - `countries/*/*/gold-rate/24-karat/index.html`
- Off-strategy thin pages:
  - `content/tools/investment-return.html`
  - `content/guides/invest-in-gold-gcc.html`
- Social tooling pages:
  - `content/social/*` (ensure noindex remains enforced)

## Delete-later page families (not this PR)

- Per-karat city pages listed above.
- Off-strategy pages:
  - `content/tools/investment-return.html`
  - `content/guides/invest-in-gold-gcc.html`

## Redirect target map for delete-later patterns

- `countries/<country>/<city>/gold-rate/<karat>-karat/` → `countries/<country>/<city>/gold-rate/`
- `content/tools/investment-return.html` → `tracker.html` (or calculator panel destination in follow-up)
- `content/guides/invest-in-gold-gcc.html` → `methodology.html` or consolidated knowledge hub target
- `content/social/x-post-generator.html` (if removed later) → `content/social/` stub or `developer.html` (final target to decide with product owner)

## Sitemap governance in this PR

- Exclude noindex pages from sitemap generation (including build-time generator).
- Keep canonical URLs unchanged for all touched pages.
- Add test coverage for noindex-exclusion behavior.

## Internal-link risk inventory (pre-deletion)

Links that still point to noindex/delete-later surfaces and must be rewired before deletion:

- `src/components/nav-data.js` (tools and markets groups include off-strategy pages)
- `src/components/footer.js` (shared footer group links inherit nav data)
- Country/city hub pages linking to per-karat pages (`countries/*/*/gold-rate/index.html`)
- Existing content cross-links to:
  - `content/guides/invest-in-gold-gcc.html`
  - `content/tools/investment-return.html`
  - `content/social/x-post-generator.html`

This PR keeps links in place except where they would directly contradict sitemap/indexing policy.

## Risk notes

- Search coverage may temporarily drop for long-tail templated pages after noindex rollout.
- Internal navigation can still expose noindex pages during soak period (expected for this phase).
- Build generator and FS generator previously diverged; this PR tightens noindex parity.

## Rollback plan

1. Revert noindex meta tags on targeted pages.
2. Revert sitemap generator noindex filters.
3. Revert sitemap/governance tests added in this PR.
4. Regenerate SEO reports and rebuild sitemap.

## Soak + next-step plan

- Wait 4–8 weeks after deployment.
- Track impressions/clicks/index coverage and crawl behavior.
- Prepare deletion PR with explicit 301 mapping and link rewiring before file removal.
