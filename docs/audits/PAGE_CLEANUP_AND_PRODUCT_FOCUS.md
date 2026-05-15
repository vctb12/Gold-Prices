# Page Cleanup and Product Focus

> Companion to
> [`docs/GOLD_TICKER_LIVE_12_PHASE_POST_IMPLEMENTATION_AUDIT.md`](../GOLD_TICKER_LIVE_12_PHASE_POST_IMPLEMENTATION_AUDIT.md).
> **No deletions in this PR.** This file is a recommendation only. Status: 🟢 keep · 🟦 merge · ⚫
> hide/noindex · 🔴 remove later.

## Headline numbers

Counted on `HEAD` (excludes `node_modules/`, `dist/`, `playwright-report/`, `reports/`, `.git/`):

| Surface                                            | HTML files  |
| -------------------------------------------------- | ----------- |
| Root (`./*.html`)                                  | 16          |
| `content/` (guides, tools, social, faq, etc.)      | 35          |
| `countries/` (country + city + market + per-karat) | **608**     |
| Other (admin, supabase, etc.)                      | ~ remainder |
| **Total HTML**                                     | **702**     |

Per-country: UAE 63 · Saudi Arabia 44 · Egypt 30 · Qatar 28 · 17 others ≈ 26 each.

Each city ships `gold-rate/`, `gold-prices/`, `gold-shops/`, and four per-karat pages (18/21/22/24).
The per-karat pages are 200-line templates.

---

## Root pages (16)

| Page               | Purpose                      | Recommendation                                                                  | Reason                                                                          | Risk if removed                        |
| ------------------ | ---------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | -------------------------------------- |
| `index.html`       | Homepage                     | 🟢 keep                                                                         | Flagship landing                                                                | n/a                                    |
| `tracker.html`     | Live tracker                 | 🟢 keep                                                                         | Flagship product                                                                | n/a                                    |
| `pricing.html`     | Pricing / Stripe CTA         | 🟢 keep                                                                         | Revenue surface                                                                 | Breaks billing funnel                  |
| `methodology.html` | Methodology / trust          | 🟢 keep                                                                         | Trust anchor; required by data labels                                           | Breaks trust story                     |
| `shops.html`       | Shops directory              | 🟢 keep                                                                         | Becomes revenue path once vendors land                                          | Breaks Phase 7                         |
| `developer.html`   | API console                  | 🟢 keep                                                                         | Phase 12 surface                                                                | Breaks API monetization                |
| `dashboard.html`   | Customer dashboard           | 🟢 keep                                                                         | Phase 5 surface                                                                 | Breaks customer features               |
| `account.html`     | Sign in / sign up            | 🟢 keep                                                                         | Auth surface                                                                    | Breaks Phase 5                         |
| `privacy.html`     | Privacy policy               | 🟢 keep                                                                         | Legal                                                                           | Regulatory risk                        |
| `terms.html`       | Terms                        | 🟢 keep                                                                         | Legal                                                                           | Regulatory risk                        |
| `404.html`         | Not-found                    | 🟢 keep                                                                         | Required                                                                        | UX breakage                            |
| `offline.html`     | Service-worker offline       | 🟢 keep                                                                         | PWA fallback                                                                    | Breaks SW                              |
| `calculator.html`  | Calculator                   | 🟦 merge into tracker or 🟣 simplify                                            | Today duplicates tracker conversions; users rarely need three karat calculators | Internal links from guides             |
| `invest.html`      | "Why invest in gold" landing | 🔴 remove later (noindex first)                                                 | Off-strategy: not a tracker product, reads like SEO bait, 69 KB single page     | Some inbound links from learn/insights |
| `learn.html`       | Education hub                | 🟦 merge with `insights.html` and `content/guides/` into a single Knowledge Hub | Three competing content surfaces dilute SEO                                     | Inbound links from nav                 |
| `insights.html`    | Market notes / news          | 🟦 merge with `learn.html`                                                      | Same as above                                                                   | Inbound links from nav                 |

---

## `content/` (35 pages)

| Path                                                                                                                                                                                                                                              | Recommendation                                                        | Reason                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------- |
| `content/guides/buying-guide.html` (and `uae-gold-buying-guide/`)                                                                                                                                                                                 | 🟦 merge into single Knowledge Hub                                    | Two competing buying guides                             |
| `content/guides/zakat-gold-guide.html` + `content/tools/zakat-calculator.html`                                                                                                                                                                    | 🟢 keep zakat-calculator (utility); 🟦 merge guide into Knowledge Hub | Zakat is a real GCC user need                           |
| `content/guides/24k-vs-22k.html` + `content/22k-gold-price-guide/` + `content/24k-gold-price-guide/` + `content/guides/gold-karat-comparison.html`                                                                                                | 🟦 collapse into ONE karat-comparison page                            | Four overlapping pages                                  |
| `content/guides/aed-peg-explained.html`                                                                                                                                                                                                           | 🟢 keep                                                               | Linked from methodology, important for trust            |
| `content/guides/gcc-market-hours.html`                                                                                                                                                                                                            | 🟢 keep                                                               | Real user question                                      |
| `content/guides/invest-in-gold-gcc.html`                                                                                                                                                                                                          | 🔴 remove later (overlaps `invest.html`)                              | Off-strategy                                            |
| `content/dubai-gold-rate-guide/`, `content/uae-gold-buying-guide/`, `content/todays-best-rates/`, `content/gcc-gold-price-comparison/`, `content/gold-price-history/`, `content/spot-vs-retail-gold-price/`, `content/gold-making-charges-guide/` | 🟦 audit + merge wherever they overlap city/country pages             | Many duplicate the city/country structure               |
| `content/tools/investment-return.html`                                                                                                                                                                                                            | 🔴 remove later                                                       | Off-strategy (not a price product)                      |
| `content/tools/weight-converter.html`                                                                                                                                                                                                             | 🟣 simplify or remove                                                 | Marginal product fit                                    |
| `content/embed/`                                                                                                                                                                                                                                  | 🟢 keep                                                               | Distribution surface                                    |
| `content/social/`, `content/social/x-post-generator.html`                                                                                                                                                                                         | ⚫ hide/noindex                                                       | Internal tooling, not for public SEO                    |
| `content/order-gold/`, `content/submit-shop/`, `content/premium-watch/`                                                                                                                                                                           | 🟢 keep if vendor flow lands                                          | Lead capture; otherwise 🟣 simplify                     |
| `content/search/`, `content/faq/`, `content/news/`, `content/changelog/`                                                                                                                                                                          | 🟢 keep                                                               | Real user value                                         |
| `content/compare-countries/`                                                                                                                                                                                                                      | 🟢 keep                                                               | Real value, but consolidate with the `countries/` index |

---

## `countries/` (608 pages) — the biggest content debt

For each of ~21 countries we ship:

- `countries/<c>/index.html` (country landing)
- `countries/<c>/<city>/index.html` (city landing)
- `countries/<c>/<city>/gold-rate/index.html`
- `countries/<c>/<city>/gold-rate/{18,21,22,24}-karat/index.html` (4 thin pages)
- `countries/<c>/<city>/gold-prices/index.html`
- `countries/<c>/<city>/gold-shops/index.html`
- Some countries also: `markets/<market>/index.html`

A typical per-karat page is ~200 lines and **structurally identical** across cities — the gold-rate
value itself is the only differentiator.

**Recommendation tiers:**

| Pattern                                                                                                   | Recommendation                                                                     | Reason                                                                        |
| --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Country landing (`countries/<c>/index.html`)                                                              | 🟢 keep                                                                            | One per country is fair                                                       |
| Top-tier city landings (Dubai, Abu Dhabi, Riyadh, Jeddah, Doha, Manama, Kuwait City, Muscat, Cairo, etc.) | 🟢 keep                                                                            | Real search demand                                                            |
| Long-tail city landings (smaller cities)                                                                  | 🟦 merge into country page, or ⚫ noindex                                          | Low search demand, dilutes signal                                             |
| `gold-rate/index.html` per city                                                                           | 🟢 keep (it's the city's main commercial page)                                     | —                                                                             |
| **Per-karat sub-pages (`gold-rate/18-karat`, `21-karat`, `22-karat`, `24-karat`)**                        | ⚫ **noindex first, 🔴 remove later**                                              | Pure templated dupes; karat data already lives on the city's `gold-rate` page |
| `gold-shops/index.html` per city                                                                          | 🟢 keep if shops directory lands the vendor portal; otherwise 🟣 simplify          | Same surface as `shops.html` filtered                                         |
| `gold-prices/index.html` per city                                                                         | 🟦 merge with `gold-rate/index.html` for the same city                             | Two pages, same data                                                          |
| `markets/<market>/index.html`                                                                             | 🟢 keep top markets (Gold Souk Dubai, Cairo Gold District); 🔴 remove generic ones | Real user search intent only for famous markets                               |

**Estimated cleanup math:**

- Cut per-karat sub-pages: ~21 countries × ~5 avg cities × 4 karats ≈ **420 pages** out of 608.
- Merge `gold-prices/` into `gold-rate/`: ~80 pages.
- Net potential reduction: **~500 of 608 country pages (~82%)**, leaving ~100 high-quality
  city+country pages.

**Risk:** internal-link rot. Mitigation in PR 11 of the sequence:

1. Build inbound-link inventory (`scripts/node/inventory-seo.js` already enumerates).
2. Add 301 redirects for each removed URL → city `gold-rate/` page or country index.
3. Update `sitemap.xml` and `robots.txt`.
4. Keep the templates around in `src/` so they can be regenerated if needed.

---

## Calculator widgets

| Calculator                                                            | Recommendation                                                                   | Reason                                                     |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `calculator.html` main (USD/AED, karat conversion)                    | 🟦 merge into tracker as a panel                                                 | Today it's a separate tab; users want it next to the price |
| Zakat calculator (`content/tools/zakat-calculator.html`)              | 🟢 keep standalone                                                               | Genuine GCC utility                                        |
| Investment-return calculator (`content/tools/investment-return.html`) | 🔴 remove later                                                                  | Off-strategy; financial advice surface area                |
| Weight converter (`content/tools/weight-converter.html`)              | 🟣 simplify                                                                      | Embed inside tracker if useful; otherwise drop             |
| CAD calculator                                                        | 🔍 search yielded none in root — likely already removed; verify                  |
| Premium watch (`content/premium-watch/`)                              | 🟣 keep only if a real product purpose; otherwise 🔴                             |
| Weekend charges concept                                               | 🔍 verify — if it's an unclear pricing concept, hide until methodology clarifies |

---

## "Where to buy / sell gold" / "How to buy / sell"

Currently surfaced via:

- `content/guides/buying-guide.html`
- `content/uae-gold-buying-guide/`
- `content/order-gold/`
- `content/submit-shop/`
- `countries/*/<city>/gold-shops/`

**Recommendation:** keep one canonical "How to buy gold in the UAE/GCC" guide (Knowledge Hub)
**and** the shops directory (`shops.html` + per-city `gold-shops/`). Remove the SEO-bait duplicates.

---

## Internal-linking risk register (must check before any removal)

The following surfaces inbound-link the at-risk pages and must be re-pointed:

| Source                                                      | Currently links to                                                             |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Nav (`src/components/nav.js`, `src/components/nav-data.js`) | `learn`, `insights`, `invest`, `methodology`, `calculator`, `shops`, `tracker` |
| Footer (`src/components/footer.js`)                         | Same + legal pages + content links                                             |
| `content/guides/index.html`                                 | All sibling guides                                                             |
| `index.html` features section                               | `invest`, `learn`, `insights`, `pricing`, `shops`                              |
| Country landings                                            | Their own city/karat sub-pages                                                 |

**Rule:** never delete a page without first running `npm run check-links` and updating both nav +
sitemap.

---

## Net recommendation

- **Keep ~24 high-value root + content pages** (the ones flagged 🟢 above).
- **Merge ~12 overlapping content/guides pages** into one Knowledge Hub.
- **Hide / noindex ~420 per-karat city sub-pages** in PR 2 of the next sequence.
- **Plan 301 redirects** before any deletion.
- **Net target footprint:** ~150 indexable pages (from ~660), all with a clear purpose.
