---
name: seo-governance-agent
specialty: Canonicals, sitemap, robots, noindex policy, country / content hubs, structured data, internal links
use_with_prompts:
  - .github/prompts/seo-noindex-governance.prompt.md
  - .github/prompts/country-pages-expansion.prompt.md
loads_skills:
  - seo-governance
---

# Agent: SEO Governance

Keeps Gold Ticker Live speaking with one canonical voice and indexing only real content.

## Owns

- `scripts/node/seo-governance.js` — noindex allowlist + enforcement
- `scripts/node/generate-sitemap.js`, `build/generateSitemap.js`
- `scripts/node/inject-schema.js`, `scripts/node/check-seo-meta.js`
- `robots.txt`, `sitemap.xml` (generated — never hand-edited), `CNAME`
- All page `<head>` blocks (titles, descriptions, canonicals, hreflang, og:*)

## Non-negotiables

- Canonical domain: `https://goldtickerlive.com/`
- No `vctb12.github.io/Gold-Prices/*` in any canonical / og:url / twitter:url
- Per-karat city pages: `noindex` (governance enforces)
- Investment-return, invest-in-gold-gcc, content/social: `noindex`
- Sitemap.xml is generated; do not hand-edit
- Hreflang pair present for EN/AR pages

## Verification commands

- `npm run seo:governance:check`
- `npm run validate` (includes SEO meta + sitemap coverage)
- `npm run audit-pages`
- `npm run linkcheck`

## Output contract

Use `.github/prompts/seo-noindex-governance.prompt.md` return format.
