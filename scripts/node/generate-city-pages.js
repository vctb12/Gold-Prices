#!/usr/bin/env node
'use strict';

/**
 * scripts/node/generate-city-pages.js
 *
 * Data-driven generator for the per-city gold pages. It rebuilds the static
 * page tree for every city declared in `src/config/countries.js`, so coverage
 * is expanded by editing config + curated content (`city-content.js`) instead
 * of hand-authoring HTML — the workflow called for in
 * `docs/plans/2026-04-24_revenue-focused-growth-plan.md`.
 *
 * Pages it OWNS and writes directly (these are the rich, hydrated pages):
 *   countries/<country>/<city>/gold-prices/index.html        (indexable)
 *   countries/<country>/<city>/gold-shops/index.html          (indexable)
 *   countries/<country>/<city>/gold-rate/<k>-karat/index.html (noindex,follow)
 *
 * Hub stubs (city index + gold-rate hub) are intentionally left to
 * `enrich-placeholder-pages.js`: this script drops a placeholder there so the
 * existing enrich tooling can fill them with the canonical stub markup.
 *
 * The generator never overwrites a city that already has hand-tuned pages
 * unless `--force` is passed, so the existing curated cities (Dubai, etc.) are
 * preserved byte-for-byte.
 *
 * Usage:
 *   node scripts/node/generate-city-pages.js           # create missing pages
 *   node scripts/node/generate-city-pages.js --force   # rewrite owned pages
 *   node scripts/node/generate-city-pages.js --check    # exit 1 if missing
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..');
const BASE_URL = 'https://goldtickerlive.com';
const PLACEHOLDER_HTML = (title) =>
  `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} — Gold Ticker Live</title></head><body><h1>Placeholder for ${title}</h1><p>This page was auto-generated as a placeholder. Please replace with real content.</p><p><a href="/index.html">Home</a></p></body></html>`;

const { getCityContent } = require('./city-content.js');

const KARATS = [
  { code: '24', label: '24 Karat (Pure Gold)' },
  { code: '22', label: '22 Karat' },
  { code: '21', label: '21 Karat' },
  { code: '18', label: '18 Karat' },
];

// ── config loader (mirrors build/generateSitemap.js) ─────────────────────────
function loadCountries() {
  const raw = fs.readFileSync(path.join(ROOT, 'src/config/countries.js'), 'utf8');
  const match = raw.match(/export const COUNTRIES\s*=\s*(\[[\s\S]*?\]);/);
  if (!match) throw new Error('Could not parse COUNTRIES');
  return vm.runInNewContext(`(${match[1]})`, Object.create(null), { timeout: 2000 });
}

// ── helpers ──────────────────────────────────────────────────────────────────
function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escapeAttr(s) {
  return escapeHtml(s).replace(/"/g, '&quot;');
}
function titleCaseSlug(slug) {
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
function relPrefix(depth) {
  return '../'.repeat(depth);
}
function karatPurityLabel(code) {
  const pct = ((Number(code) / 24) * 100).toFixed(1);
  return `${code} karat (${pct}% pure)`;
}

// Most common jewellery karat by region — used in FAQ copy.
function commonKarat(country) {
  if (country.slug === 'india' || country.slug === 'pakistan') return '22K';
  if (country.group === 'global') return '22K';
  return '21K';
}

function breadcrumbJson(items) {
  return JSON.stringify(
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: items.map((it, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: it.name,
        item: it.url,
      })),
    },
    null,
    2
  );
}
function productJson(name, description, currency) {
  return JSON.stringify(
    {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name,
      description,
      category: 'Precious Metals',
      offers: {
        '@type': 'AggregateOffer',
        priceCurrency: currency,
        availability: 'https://schema.org/InStock',
        itemCondition: 'https://schema.org/NewCondition',
      },
    },
    null,
    2
  );
}
function datasetJson(name, description, url, measured) {
  return JSON.stringify(
    {
      '@context': 'https://schema.org',
      '@type': 'Dataset',
      name,
      description,
      url,
      creator: {
        '@type': 'Organization',
        name: 'Gold Ticker Live',
        url: 'https://goldtickerlive.com',
      },
      license: 'https://goldtickerlive.com/terms.html',
      variableMeasured: measured,
      isAccessibleForFree: true,
      inLanguage: ['en', 'ar'],
    },
    null,
    2
  );
}

// ── shared head/body shell for hydrated pages ────────────────────────────────
function hydratedShell({
  depth,
  robots,
  description,
  ogTitle,
  title,
  canonical,
  schemaBlocks,
  headStyle,
  body,
}) {
  const pre = relPrefix(depth);
  const robotsMeta = robots ? `\n    <meta name="robots" content="${robots}" />` : '';
  const schemas = schemaBlocks
    .map((s) => `  <script type="application/ld+json">\n${s}\n  </script>`)
    .join('\n');
  return `<!doctype html>
<html lang="en" dir="ltr">
  <head>
    <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8578581906562588"
         crossorigin="anonymous"></script>
    <meta charset="UTF-8" />
    <script src="${pre}assets/analytics.js" defer></script>
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />${robotsMeta}
    <meta
      name="description"
      content="${escapeAttr(description)}"
    />
    <meta
      property="og:title"
      content="${escapeAttr(ogTitle)}"
    />
    <meta
      property="og:description"
      content="${escapeAttr(description)}"
    />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${canonical}" />
    <meta property="og:image" content="https://goldtickerlive.com/assets/og-image.png" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta
      name="twitter:title"
      content="${escapeAttr(ogTitle)}"
    />
    <meta
      name="twitter:description"
      content="${escapeAttr(description)}"
    />
    <meta name="twitter:image" content="https://goldtickerlive.com/assets/og-image.png" />
    <link rel="canonical" href="${canonical}" />
    <link
      rel="alternate"
      hreflang="x-default"
      href="${canonical}"
    />
    <link
      rel="alternate"
      hreflang="en"
      href="${canonical}"
    />
    <link
      rel="alternate"
      hreflang="ar"
      href="${canonical}?lang=ar"
    />
    <title>${escapeHtml(title)}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />

    <link rel="preconnect" href="https://open.er-api.com" />
    <link
      href="https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;700;800&display=swap"
      rel="stylesheet"
    />
    <link rel="stylesheet" href="${pre}styles/global.css" />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />${headStyle || ''}
${schemas}
  </head>
  <body>
    <div id="nav-root"></div>

${body}

    <div id="footer-root"></div>

    <script type="module" src="${pre}src/lib/page-hydrator.js"></script>
  </body>
</html>
`;
}

function pricePlaceholder() {
  return `      <!-- Live price placeholder — hydrated by page-hydrator.js -->
      <div id="price-display" style="display: none">
        <div id="freshness-badge" style="margin-bottom: 1rem"></div>
        <div
          id="karat-cards"
          style="
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 1rem;
            margin-bottom: 1.5rem;
          "
        ></div>
        <div id="price-disclaimer"></div>
      </div>

      <div id="price-loading" style="padding: 2rem; text-align: center; color: #94a3b8">
        Loading live prices…
      </div>`;
}

function relatedChip(href, text, highlight) {
  const bg = highlight ? '#fef9c3' : '#f1f5f9';
  const color = highlight ? '#713f12' : '#1e293b';
  return `          <a
            href="${href}"
            style="
              padding: 0.4rem 0.75rem;
              background: ${bg};
              border-radius: 6px;
              font-size: 0.875rem;
              text-decoration: none;
              color: ${color};
            "
            >${escapeHtml(text)}</a
          >`;
}

// ── FAQ (microdata, matches existing curated pages) ──────────────────────────
function faqItem(question, answerHtml, open) {
  return `          <details
            class="faq-item"${open ? '\n            open' : ''}
            itemscope
            itemprop="mainEntity"
            itemtype="https://schema.org/Question"
          >
            <summary class="faq-question" itemprop="name">
              ${escapeHtml(question)}
            </summary>
            <div
              class="faq-answer"
              itemprop="acceptedAnswer"
              itemscope
              itemtype="https://schema.org/Answer"
            >
              <p itemprop="text">
                ${answerHtml}
              </p>
            </div>
          </details>`;
}

function cityFaq(country, city, content) {
  const cityEn = city.nameEn;
  const ccy = country.currency;
  const market =
    content && content.marketEn ? content.marketEn : `the local gold market in ${cityEn}`;
  const common = commonKarat(country);
  const pegLine =
    country.fixedPeg && ccy === 'AED'
      ? 'the UAE Dirham fixed peg of 3.6725 to the US Dollar'
      : `the live ${ccy}/USD exchange rate`;
  const convertLine =
    country.fixedPeg && ccy === 'AED'
      ? 'The UAE Dirham is pegged to the US Dollar at 3.6725. To convert: AED price ÷ 3.6725 = USD price. Use our live tracker to view prices in 24+ currencies at once.'
      : `Gold here is quoted in ${ccy}. Because the local rate already blends the global XAU/USD spot price with the ${ccy}/USD exchange rate, you can use our live tracker to view the same gold in 24+ currencies at once.`;
  const note =
    content && content.noteEn
      ? escapeHtml(content.noteEn)
      : `The live ${ccy} gold rate in ${escapeHtml(cityEn)} is derived from the global XAU/USD spot price and updated every 90 seconds on this page.`;
  const buyAnswer =
    content && content.marketEn
      ? `${escapeHtml(market)}${content.areaEn ? ` in ${escapeHtml(content.areaEn)}` : ''} is the best-known place to buy gold in ${escapeHtml(cityEn)}. Our Gold Shops directory lists additional jewellers and dealers in the city.`
      : `Established jewellery shops and the city gold market are the main places to buy gold in ${escapeHtml(cityEn)}. Our Gold Shops directory lists jewellers and dealers for the city.`;

  const items = [
    faqItem(
      `What is the gold price in ${cityEn} today?`,
      `The live 24K gold price in ${escapeHtml(cityEn)} is updated every 90 seconds on this page,
                based on the global XAU/USD spot rate and ${pegLine}. Check the price cards above for
                current 24K, 22K, 21K and 18K rates per gram in ${escapeHtml(ccy)}. ${note}`,
      true
    ),
    faqItem(
      `Is the ${market} price the same as the spot price shown here?`,
      `${escapeHtml(market)} follows the same spot-derived gold rate, but retail shops add a making
                charge for jewellery that depends on design complexity, plus any local tax. This page shows
                the pure spot equivalent in ${escapeHtml(ccy)}; investment bars carry much smaller premiums.`,
      false
    ),
    faqItem(
      `Which karat of gold is most common in ${cityEn}?`,
      `${common} is the most popular karat for jewellery in ${escapeHtml(cityEn)}. 24K is used mainly for
                investment bars and coins, while 18K is favoured for detailed and gem-set pieces.`,
      false
    ),
    faqItem('How do I convert this gold price to other currencies?', convertLine, false),
    faqItem(`Where can I buy gold in ${cityEn}?`, buyAnswer, false),
  ];

  return `      <section class="city-faq" aria-labelledby="city-faq-heading">
        <h2 id="city-faq-heading">Frequently Asked Questions — Gold Price in ${escapeHtml(cityEn)}</h2>
        <div itemscope itemtype="https://schema.org/FAQPage">
${items.join('\n')}
        </div>
      </section>`;
}

const FAQ_STYLE = `
    <style>
      .city-faq {
        margin-top: 2.5rem;
        padding-top: 1.5rem;
        border-top: 1px solid #e2e8f0;
      }
      .city-faq h2 {
        font-size: 1.1rem;
        font-weight: 600;
        margin-bottom: 1rem;
        color: #1e293b;
      }
      .city-faq details {
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        margin-bottom: 0.6rem;
        overflow: hidden;
      }
      .city-faq summary {
        padding: 0.85rem 1rem;
        font-weight: 600;
        font-size: 0.9rem;
        cursor: pointer;
        list-style: none;
        color: #1e293b;
        background: #f8fafc;
      }
      .city-faq summary::-webkit-details-marker {
        display: none;
      }
      .city-faq summary::after {
        content: '+';
        float: right;
        font-size: 1.1rem;
        color: #94a3b8;
      }
      .city-faq details[open] summary::after {
        content: '−';
      }
      .city-faq .faq-body {
        padding: 0.85rem 1rem;
        font-size: 0.875rem;
        line-height: 1.65;
        color: #475569;
      }
    </style>`;

// ── page builders ────────────────────────────────────────────────────────────
function buildGoldPricesPage(country, city, content) {
  const cityEn = city.nameEn;
  const countryEn = country.nameEn;
  const ccy = country.currency;
  const slugBase = `${country.slug}/${city.slug}`;
  const canonical = `${BASE_URL}/countries/${slugBase}/gold-prices/`;
  const title = `Gold Price in ${cityEn} Today — 24K, 22K, 21K, 18K in ${ccy} | Gold Ticker Live`;
  const description = `Live 24K, 22K, 21K, 18K gold prices in ${cityEn}, ${countryEn} today. Compare rates in ${ccy} per gram. Updated every 90 seconds.`;

  const breadcrumbs = breadcrumbJson([
    { name: 'Home', url: BASE_URL },
    { name: 'Countries', url: `${BASE_URL}/countries` },
    { name: titleCaseSlug(country.slug), url: `${BASE_URL}/countries/${country.slug}` },
    { name: cityEn, url: `${BASE_URL}/countries/${slugBase}` },
    { name: 'Gold Prices', url: canonical },
  ]);

  const siblings = (country.cities || []).filter((c) => c.slug !== city.slug).slice(0, 4);
  const relatedChips = [
    relatedChip(
      `${BASE_URL}/countries/${country.slug}/gold-price/`,
      `${countryEn} Overview`,
      false
    ),
    relatedChip(`${BASE_URL}/countries/${slugBase}/gold-shops/`, `Gold Shops in ${cityEn}`, true),
    ...siblings.map((c) =>
      relatedChip(`${BASE_URL}/countries/${country.slug}/${c.slug}/gold-prices/`, c.nameEn, false)
    ),
  ].join('\n');

  const body = `    <main class="country-page-main" style="max-width: 900px; margin: 0 auto; padding: 1.5rem 1rem">
      <nav class="breadcrumb" aria-label="Breadcrumb" id="breadcrumb-root"></nav>

      <h1 style="font-size: 1.75rem; font-weight: 700; margin: 1rem 0 0.5rem">
        Gold Price in ${escapeHtml(cityEn)}, ${escapeHtml(countryEn)} Today
      </h1>
      <p style="color: #64748b; margin-bottom: 1.5rem">
        Current gold rates for ${escapeHtml(cityEn)} in ${escapeHtml(ccy)}. All karats, updated every 90 seconds.
      </p>

${pricePlaceholder()}

      <section
        style="
          margin-top: 1.5rem;
          padding: 1rem;
          background: #fef9c3;
          border-radius: 10px;
          border: 1px solid #fde68a;
        "
      >
        <h2 style="font-size: 0.95rem; font-weight: 600; margin-bottom: 0.6rem; color: #92400e">
          📖 Gold Buying Resources
        </h2>
        <div style="display: flex; flex-wrap: wrap; gap: 0.5rem">
          <a
            href="/content/guides/buying-guide.html"
            style="
              padding: 0.35rem 0.7rem;
              background: #fff;
              border: 1px solid #fde68a;
              border-radius: 6px;
              font-size: 0.825rem;
              text-decoration: none;
              color: #92400e;
              font-weight: 500;
            "
            >How to Buy Gold →</a
          >
          <a
            href="/content/guides/24k-vs-22k.html"
            style="
              padding: 0.35rem 0.7rem;
              background: #fff;
              border: 1px solid #e2e8f0;
              border-radius: 6px;
              font-size: 0.825rem;
              text-decoration: none;
              color: #1e293b;
            "
            >24K vs 22K →</a
          >
          <a
            href="/calculator.html"
            style="
              padding: 0.35rem 0.7rem;
              background: #fff;
              border: 1px solid #e2e8f0;
              border-radius: 6px;
              font-size: 0.825rem;
              text-decoration: none;
              color: #1e293b;
            "
            >Gold Calculator →</a
          >
        </div>
      </section>
      <section style="margin-top: 2rem">
        <h2 style="font-size: 1.1rem; font-weight: 600; margin-bottom: 0.75rem">Related Pages</h2>
        <div style="display: flex; flex-wrap: wrap; gap: 0.5rem">
${relatedChips}
        </div>
      </section>

${cityFaq(country, city, content)}
    </main>`;

  return hydratedShell({
    depth: 4,
    robots: '',
    description,
    ogTitle: title,
    title,
    canonical,
    headStyle: FAQ_STYLE,
    schemaBlocks: [
      breadcrumbs,
      productJson(title, description, ccy),
      datasetJson(title, description, canonical, `24K gold price per gram in ${ccy}`),
    ],
    body,
  });
}

function buildGoldShopsPage(country, city, content) {
  const cityEn = city.nameEn;
  const countryEn = country.nameEn;
  const slugBase = `${country.slug}/${city.slug}`;
  const canonical = `${BASE_URL}/countries/${slugBase}/gold-shops/`;
  const title = `Gold Shops in ${cityEn} — Dealers & Jewellers | Gold Ticker Live`;
  const marketLine =
    content && content.marketEn
      ? ` ${content.marketEn} is the best-known gold market in the city.`
      : '';
  const description = `Directory of gold shops, dealers and jewellers in ${cityEn}, ${countryEn}.${marketLine}`;

  const breadcrumbs = breadcrumbJson([
    { name: 'Home', url: BASE_URL },
    { name: 'Countries', url: `${BASE_URL}/countries` },
    { name: titleCaseSlug(country.slug), url: `${BASE_URL}/countries/${country.slug}` },
    { name: cityEn, url: `${BASE_URL}/countries/${slugBase}` },
    { name: 'Gold Shops', url: canonical },
  ]);

  const body = `    <main class="country-page-main" style="max-width: 900px; margin: 0 auto; padding: 1.5rem 1rem">
      <nav class="breadcrumb" aria-label="Breadcrumb" id="breadcrumb-root"></nav>

      <h1 style="font-size: 1.75rem; font-weight: 700; margin: 1rem 0 0.5rem">
        Gold Shops in ${escapeHtml(cityEn)}
      </h1>
      <p style="color: #64748b; margin-bottom: 1.5rem">
        Directory of gold shops and dealers in ${escapeHtml(cityEn)}, ${escapeHtml(countryEn)}.${escapeHtml(marketLine)}
      </p>

${pricePlaceholder()}

      <section style="margin-top: 2rem">
        <h2 style="font-size: 1.1rem; font-weight: 600; margin-bottom: 0.75rem">Related Pages</h2>
        <div style="display: flex; flex-wrap: wrap; gap: 0.5rem">
${relatedChip(`${BASE_URL}/countries/${slugBase}/gold-prices/`, `Gold Prices in ${cityEn}`, false)}
        </div>
      </section>
    </main>`;

  return hydratedShell({
    depth: 4,
    robots: '',
    description,
    ogTitle: title,
    title,
    canonical,
    headStyle: '',
    schemaBlocks: [breadcrumbs],
    body,
  });
}

function buildKaratPage(country, city, karat) {
  const cityEn = city.nameEn;
  const countryEn = country.nameEn;
  const ccy = country.currency;
  const slugBase = `${country.slug}/${city.slug}`;
  const canonical = `${BASE_URL}/countries/${slugBase}/gold-rate/${karat.code}-karat/`;
  const title = `${karat.code} Karat Gold Price in ${cityEn} Today — ${ccy} per Gram | Gold Ticker Live`;
  const description = `Live ${karat.code}K gold price in ${cityEn}, ${countryEn} today. ${ccy} per gram, per ounce and per tola. Updated every 90 seconds.`;

  const breadcrumbs = breadcrumbJson([
    { name: 'Home', url: BASE_URL },
    { name: 'Countries', url: `${BASE_URL}/countries` },
    { name: titleCaseSlug(country.slug), url: `${BASE_URL}/countries/${country.slug}` },
    { name: cityEn, url: `${BASE_URL}/countries/${slugBase}` },
    { name: 'Gold Rate', url: `${BASE_URL}/countries/${slugBase}/gold-rate` },
    { name: `${karat.code} Karat`, url: canonical },
  ]);

  const body = `    <main class="country-page-main" style="max-width: 900px; margin: 0 auto; padding: 1.5rem 1rem">
      <nav class="breadcrumb" aria-label="Breadcrumb" id="breadcrumb-root"></nav>

      <h1 style="font-size: 1.75rem; font-weight: 700; margin: 1rem 0 0.5rem">
        ${karat.code}K Gold Price in ${escapeHtml(cityEn)} Today
      </h1>
      <p style="color: #64748b; margin-bottom: 1.5rem">
        Current ${escapeHtml(karatPurityLabel(karat.code))} gold price in ${escapeHtml(cityEn)}, ${escapeHtml(countryEn)}.
      </p>

${pricePlaceholder()}

      <section style="margin-top: 2rem">
        <h2 style="font-size: 1.1rem; font-weight: 600; margin-bottom: 0.75rem">Related Pages</h2>
        <div style="display: flex; flex-wrap: wrap; gap: 0.5rem">
${relatedChip(`${BASE_URL}/countries/${slugBase}/gold-prices/`, `All Karats in ${cityEn}`, false)}
        </div>
      </section>
    </main>`;

  return hydratedShell({
    depth: 5,
    robots: 'noindex,follow',
    description,
    ogTitle: title,
    title,
    canonical,
    headStyle: '',
    schemaBlocks: [
      breadcrumbs,
      productJson(title, description, ccy),
      datasetJson(title, description, canonical, `${karat.code}K gold price per gram in ${ccy}`),
    ],
    body,
  });
}

// ── runner ────────────────────────────────────────────────────────────────────
function writeOwned(relFile, html, opts, outcomes) {
  const abs = path.join(ROOT, relFile);
  const exists = fs.existsSync(abs);
  if (exists && !opts.force) {
    outcomes.skipped++;
    return;
  }
  if (exists && opts.force) {
    if (fs.readFileSync(abs, 'utf8') === html) {
      outcomes.unchanged++;
      return;
    }
  }
  if (opts.check) {
    outcomes.missing++;
    console.log('missing/stale:', relFile);
    return;
  }
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, html, 'utf8');
  outcomes.written++;
}

function ensurePlaceholder(relFile, label, opts, outcomes) {
  const abs = path.join(ROOT, relFile);
  if (fs.existsSync(abs)) return;
  if (opts.check) {
    outcomes.missing++;
    console.log('missing hub stub:', relFile);
    return;
  }
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, PLACEHOLDER_HTML(label), 'utf8');
  outcomes.placeholders++;
}

function run(opts) {
  const countries = loadCountries();
  const outcomes = { written: 0, skipped: 0, unchanged: 0, missing: 0, placeholders: 0 };
  for (const country of countries) {
    if (!country.slug || !Array.isArray(country.cities)) continue;
    for (const city of country.cities) {
      const base = `countries/${country.slug}/${city.slug}`;
      const content = getCityContent(country.slug, city.slug);

      // Hub stubs handled by enrich-placeholder-pages.js
      ensurePlaceholder(`${base}/index.html`, `${base}`, opts, outcomes);
      ensurePlaceholder(`${base}/gold-rate/index.html`, `${base}/gold-rate`, opts, outcomes);

      // Owned rich pages
      writeOwned(
        `${base}/gold-prices/index.html`,
        buildGoldPricesPage(country, city, content),
        opts,
        outcomes
      );
      writeOwned(
        `${base}/gold-shops/index.html`,
        buildGoldShopsPage(country, city, content),
        opts,
        outcomes
      );
      for (const karat of KARATS) {
        writeOwned(
          `${base}/gold-rate/${karat.code}-karat/index.html`,
          buildKaratPage(country, city, karat),
          opts,
          outcomes
        );
      }
    }
  }
  const mode = opts.check ? 'check' : opts.force ? 'force' : 'write';
  console.log(
    `[generate-city-pages:${mode}] written=${outcomes.written} placeholders=${outcomes.placeholders} skipped=${outcomes.skipped} unchanged=${outcomes.unchanged} missing=${outcomes.missing}`
  );
  if (opts.check && outcomes.missing > 0) process.exit(1);
}

if (require.main === module) {
  run({
    check: process.argv.includes('--check'),
    force: process.argv.includes('--force'),
  });
}

module.exports = { buildGoldPricesPage, buildGoldShopsPage, buildKaratPage, loadCountries };
