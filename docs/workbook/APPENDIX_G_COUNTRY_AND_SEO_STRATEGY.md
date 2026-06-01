# Appendix G — Country Pages & SEO Strategy

> Parent: [`GOLD_TICKER_LIVE_MASTER_WORKBOOK.md`](../GOLD_TICKER_LIVE_MASTER_WORKBOOK.md)  
> Deep reference: [`docs/audits/PAGE_CLEANUP_AND_PRODUCT_FOCUS.md`](../audits/PAGE_CLEANUP_AND_PRODUCT_FOCUS.md)

## G.1 The problem in one paragraph

~**600+** HTML files under `countries/` create long-tail SEO surface area. Many city **per-karat**
pages are thin templates (~200 lines, duplicate structure). They dilute crawl budget and E-E-A-T
vs flagship URLs (`index`, `tracker`, `/countries/{cc}/gold-price/`).

## G.2 URL taxonomy (current)

Per city (typical):

```text
/countries/{cc}/
/countries/{cc}/gold-price/
/countries/{cc}/{city}/
/countries/{cc}/{city}/gold-rate/
/countries/{cc}/{city}/gold-rate/{18,21,22,24}-karat/
/countries/{cc}/{city}/gold-shops/
```

**Canonical policy (post Session 3):** prefer **one** country hub URL; 301 duplicates; sitemap excludes dupes.

## G.3 Recommendation tiers (from page cleanup audit)

| Tier | Action | Example |
| ---- | ------ | ------- |
| 🟢 keep | Flagship + real utility | `index`, `tracker`, `gold-rate` hub |
| 🟦 merge | Consolidate content | learn + insights + guides |
| ⚫ noindex | Keep linkable, drop sitemap | per-karat stubs |
| 🔴 remove later | After noindex + 301 plan | `invest`, off-strategy tools |

## G.4 Phased SEO program (workbook sessions)

| Phase | WB ID | Action | Risk |
| ----- | ----- | ------ | ---- |
| 1 | WB-201 | noindex + sitemap shrink | 🟡 reversible |
| 2 | WB-202 | canonical 301 generator-only | 🟡 |
| 3 | WB-203 | webpage-schema on content | 🟢 |
| 4 | — | Pre-render last-known prices on hubs | 🟡 |
| 5 | — | Delete stubs (owner approval) | 🔴 |

## G.5 Generator discipline

Country HTML is **generated** — never hand-edit 200 files.

| Task | Tool |
| ---- | ---- |
| Regenerate country/city | `scripts/node/` / `build/` generators (read `docs/EDIT_GUIDE.md`) |
| Sitemap | `build/generateSitemap.js` or `npm run generate-sitemap` |
| Schema | `scripts/node/inject-schema.js` |
| SEO inventory | `scripts/node/inventory-seo.js` |

## G.6 Internal linking rules

- GCC grid → canonical country URL only
- City stubs → `gold-rate` hub, not 4 karat orphans
- Breadcrumbs: `src/components/breadcrumbs.js`
- Footer sitemap: derived from `nav-data.js`

## G.7 hreflang & canonical checklist (per new page)

- [ ] `<link rel="canonical">` absolute, matches `og:url`
- [ ] `hreflang` en + ar + x-default
- [ ] Unique `<title>` and meta description (length limits — `check-seo-meta.js`)
- [ ] One visible `<h1>`
- [ ] WebPage or appropriate JSON-LD where required

## G.8 Competitor SEO lesson

Win on **freshness + trust labels + tools**, not page count. Quality &gt; quantity.

Prompt: `@.github/prompts/seo-noindex-governance.prompt.md`
