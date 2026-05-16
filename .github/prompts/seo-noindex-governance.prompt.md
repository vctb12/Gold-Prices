---
mode: agent
description: Audit canonicals, noindex policy, sitemap inclusion, and content quality across Gold Ticker Live. Tighten governance.
related_skills:
  - seo-governance
related_instructions:
  - .github/instructions/seo.instructions.md
  - .github/instructions/content-country-pages.instructions.md
---

# Prompt: SEO + Noindex Governance

Audit and tighten Gold Ticker Live's SEO governance. Specifically: canonical correctness, noindex
policy, sitemap coverage, hreflang pairs, and thin-page detection.

## Goal

The site speaks with one canonical voice (`goldtickerlive.com`), every indexable page is real,
every thin page is `noindex` and governed, and the sitemap reflects reality.

## Required inspection

1. [`seo-governance/SKILL.md`](../skills/seo-governance/SKILL.md) and its checklists
2. `scripts/node/seo-governance.js` — current policy
3. `scripts/node/generate-sitemap.js`, `build/generateSitemap.js`
4. `scripts/node/inject-schema.js`, `scripts/node/check-seo-meta.js`
5. `robots.txt`, `sitemap.xml` (generated), `CNAME`
6. `docs/SEO_STRATEGY.md`, `docs/SEO_CHECKLIST.md`, `docs/SEO_SITEMAP_GUIDE.md`

## Findings to produce

- **Canonical mismatches**: any page where `<link rel=canonical>` ≠ `<meta og:url>` or points
  outside `goldtickerlive.com`
- **Hreflang gaps**: EN/AR pairs missing on either side
- **Thin pages indexed**: per-karat city, generic content/social, templated countries — should be
  noindex
- **Real pages noindexed by mistake**: anything with genuine local content stuck in the noindex
  allowlist
- **Sitemap drift**: `sitemap.xml` doesn't match the generator output (would be regenerated on
  next build — fine, but worth flagging)
- **Schema gaps**: FAQ pages without FAQPage schema, country pages without Place/BreadcrumbList

## Implementation expectations

- Edit pages or templates — never `sitemap.xml` directly
- Update `scripts/node/seo-governance.js` allowlist for any noindex change
- Add schema via `scripts/node/inject-schema.js`, not hand-authored `<script type="application/ld+json">`
- Preserve verification meta tags in `index.html`
- Use canonical `https://goldtickerlive.com/<path>` everywhere

## Verification

```bash
npm run seo:governance:check
npm run validate           # includes governance + meta + sitemap-coverage
npm run audit-pages
npm run linkcheck
npm run build              # regenerates sitemap
```

## Return format

```md
# SEO Governance Audit — <date>

## Summary
<2–4 sentences>

## Findings
### Canonical
- <file>: <issue> → <fix>

### Hreflang
- ...

### Indexation
- <file> currently indexed but thin → recommend noindex + governance entry
- <file> currently noindexed but has real content → recommend index + sitemap entry

### Schema
- ...

## Changes made
- <file>: <what>

## Verification
- `npm run seo:governance:check` → PASS
- `npm run validate` → PASS
- `npm run linkcheck` → N broken (none / list)

## Manual follow-up
- Submit updated sitemap to Search Console + Bing Webmaster
```
