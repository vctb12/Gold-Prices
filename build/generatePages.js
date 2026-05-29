#!/usr/bin/env node
/**
 * build/generatePages.js
 * Generates static HTML pages for all country/city/karat route combinations.
 * Run: node build/generatePages.js
 *
 * Output structure:
 *   {country}/gold-price/index.html
 *   {country}/{city}/gold-rate/index.html  (consolidated city hub — all karats)
 *   {country}/{city}/gold-shops/index.html
 */

const fs   = require('fs');
const path = require('path');
const vm   = require('vm');

const ROOT = path.resolve(__dirname, '..');

/** Safely evaluate a JS array literal from a trusted local config file. */
function evalConfigArray(src) {
  return vm.runInNewContext(`(${src})`, Object.create(null), { timeout: 2000 });
}

// Load config (CommonJS-compatible inline data since config is ES modules)
const { COUNTRIES } = (() => {
  // Inline a copy because ES modules can't be require()'d directly
  // This must stay in sync with config/countries.js
  const raw = fs.readFileSync(path.join(ROOT, 'src/config/countries.js'), 'utf8');
  const match = raw.match(/export const COUNTRIES\s*=\s*(\[[\s\S]*?\]);/);
  if (!match) throw new Error('Could not parse COUNTRIES from config/countries.js');
  return { COUNTRIES: evalConfigArray(match[1]) };
})();

const { KARATS } = (() => {
  const raw = fs.readFileSync(path.join(ROOT, 'src/config/karats.js'), 'utf8');
  const match = raw.match(/export const KARATS\s*=\s*(\[[\s\S]*?\]);/);
  if (!match) throw new Error('Could not parse KARATS from config/karats.js');
  return { KARATS: evalConfigArray(match[1]) };
})();

const SITE_URL = 'https://goldtickerlive.com';

function mkdirSync(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

/** Calculate relative path prefix for a page at the given depth below ROOT */
function relPrefix(depth) {
  return depth === 0 ? '' : '../'.repeat(depth);
}

/**
 * Generate a complete HTML page.
 * @param {{ title, description, canonical, h1, introText, depth, jsonLd }} opts
 * @returns {string} full HTML
 */
function buildPage({ title, description, canonical, h1, introText, depth, jsonLd, relatedLinks, lang = 'en' }) {
  const rel = relPrefix(depth);
  const hreflangAr = canonical + '/?lang=ar';
  const jsonLdStr = JSON.stringify(jsonLd, null, 2);

  return `<!DOCTYPE html>
<html lang="${lang}" dir="ltr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="description" content="${description}" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${canonical}/" />
  <meta property="og:image" content="${SITE_URL}/assets/og-image.png" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image" content="${SITE_URL}/assets/og-image.png" />
  <link rel="canonical" href="${canonical}/" />
  <link rel="alternate" hreflang="x-default" href="${canonical}/" />
  <link rel="alternate" hreflang="en" href="${canonical}/" />
  <link rel="alternate" hreflang="ar" href="${hreflangAr}" />
  <title>${title}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link rel="preconnect" href="https://open.er-api.com" />
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;700;800&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="${rel}styles/global.css" />
  <link rel="icon" href="${rel}favicon.svg" type="image/svg+xml" />
  <script type="application/ld+json">
${jsonLdStr}
  </script>
</head>
<body>
  <div id="nav-root"></div>

  <main class="country-page-main" style="max-width:900px;margin:0 auto;padding:1.5rem 1rem;">
    <nav class="breadcrumb" aria-label="Breadcrumb" id="breadcrumb-root"></nav>

    <h1 style="font-size:1.75rem;font-weight:700;margin:1rem 0 0.5rem;">${h1}</h1>
    <p style="color:#64748b;margin-bottom:1.5rem;">${introText}</p>

    <!-- Live price placeholder — hydrated by page-hydrator.js -->
    <div id="price-display" style="display:none;">
      <div id="freshness-badge" style="margin-bottom:1rem;"></div>
      <div id="karat-cards" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:1rem;margin-bottom:1.5rem;"></div>
    </div>

    <div id="price-loading" style="padding:2rem;text-align:center;color:#94a3b8;">
      Loading live prices…
    </div>

    ${relatedLinks ? `<section style="margin-top:2rem;"><h2 style="font-size:1.1rem;font-weight:600;margin-bottom:0.75rem;">Related Pages</h2><div style="display:flex;flex-wrap:wrap;gap:0.5rem;">${relatedLinks}</div></section>` : ''}
  </main>

  <div id="footer-root"></div>

  <script type="module" src="${rel}src/lib/page-hydrator.js"></script>
</body>
</html>`;
}

/**
 * Build JSON-LD for a country or city price page.
 */
function buildPriceLd({ title, description, canonical, breadcrumbItems }) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': canonical + '/',
        'name': title,
        'description': description,
        'url': canonical + '/',
        'inLanguage': 'en',
      },
      {
        '@type': 'BreadcrumbList',
        'itemListElement': breadcrumbItems.map((item, i) => ({
          '@type': 'ListItem',
          'position': i + 1,
          'name': item.name,
          'item': item.url,
        })),
      },
    ],
  };
}

let generatedCount = 0;

function writeFile(filePath, content) {
  mkdirSync(path.dirname(filePath));
  fs.writeFileSync(filePath, content, 'utf8');
  generatedCount++;
}

// ── Country landing pages ────────────────────────────────────────────────────

for (const country of COUNTRIES) {
  if (!country.slug) continue;

  const dir  = path.join(ROOT, country.slug, 'gold-price');
  const file = path.join(dir, 'index.html');
  const canonical = `${SITE_URL}/${country.slug}/gold-price`;

  const title       = `Gold Price in ${country.nameEn} Today — 24K, 22K, 21K, 18K | Gold Ticker Live`;
  const description = `Live gold prices in ${country.nameEn} today. 24K, 22K, 21K and 18K gold rates in ${country.currency} per gram and per ounce. Updated every 90 seconds.`;
  const h1          = `Gold Price in ${country.nameEn} Today`;
  const introText   = `Live and updated gold prices for ${country.nameEn} (${country.currency}). All karats, updated every 90 seconds.`;

  const breadcrumbItems = [
    { name: 'Home', url: SITE_URL + '/' },
    { name: country.nameEn + ' Gold Price', url: canonical + '/' },
  ];

  // Related: links to all cities
  const cityLinks = (country.cities || [])
    .map(city => `<a href="${SITE_URL}/${country.slug}/${city.slug}/gold-rate/" style="padding:0.4rem 0.75rem;background:#f1f5f9;border-radius:6px;font-size:0.875rem;text-decoration:none;color:#1e293b;">${city.nameEn} Gold Rate</a>`)
    .join('\n    ');

  writeFile(file, buildPage({
    title, description, canonical, h1, introText, depth: 2,
    breadcrumbs: breadcrumbItems,
    relatedLinks: cityLinks,
    jsonLd: buildPriceLd({ title, description, canonical, breadcrumbItems }),
  }));

  // ── City price pages ─────────────────────────────────────────────────────

  for (const city of (country.cities || [])) {
    // City gold rate hub (hydrated via page-hydrator when regenerated)
    const cityPricesDir  = path.join(ROOT, country.slug, city.slug, 'gold-rate');
    const cityPricesFile = path.join(cityPricesDir, 'index.html');
    const cityCanonical  = `${SITE_URL}/${country.slug}/${city.slug}/gold-rate`;

    const cityTitle       = `Gold Price in ${city.nameEn} Today — 24K, 22K, 21K, 18K in ${country.currency} | Gold Ticker Live`;
    const cityDescription = `Live 24K, 22K, 21K, 18K gold prices in ${city.nameEn}, ${country.nameEn} today. Compare rates in ${country.currency} per gram. Updated every 90 seconds.`;
    const cityH1          = `Gold Price in ${city.nameEn}, ${country.nameEn} Today`;
    const cityIntro       = `Current gold rates for ${city.nameEn} in ${country.currency}. All karats, updated every 90 seconds.`;

    const cityBc = [
      { name: 'Home',                       url: SITE_URL + '/' },
      { name: country.nameEn + ' Gold',     url: `${SITE_URL}/${country.slug}/gold-price/` },
      { name: city.nameEn + ' Gold Prices', url: cityCanonical + '/' },
    ];

    // Related: country page + shops page + sibling cities
    const shopsLink = `<a href="${SITE_URL}/${country.slug}/${city.slug}/gold-shops/" style="padding:0.4rem 0.75rem;background:#fef9c3;border-radius:6px;font-size:0.875rem;text-decoration:none;color:#713f12;">Gold Shops in ${city.nameEn}</a>`;
    const countryLink = `<a href="${SITE_URL}/${country.slug}/gold-price/" style="padding:0.4rem 0.75rem;background:#f1f5f9;border-radius:6px;font-size:0.875rem;text-decoration:none;color:#1e293b;">${country.nameEn} Overview</a>`;
    const siblingLinks = (country.cities || [])
      .filter(c => c.slug !== city.slug)
      .slice(0, 4)
      .map(c => `<a href="${SITE_URL}/${country.slug}/${c.slug}/gold-rate/" style="padding:0.4rem 0.75rem;background:#f1f5f9;border-radius:6px;font-size:0.875rem;text-decoration:none;color:#1e293b;">${c.nameEn}</a>`)
      .join('\n    ');

    writeFile(cityPricesFile, buildPage({
      title: cityTitle, description: cityDescription, canonical: cityCanonical,
      h1: cityH1, introText: cityIntro, depth: 3,
      breadcrumbs: cityBc,
      relatedLinks: [countryLink, shopsLink, siblingLinks].join('\n    '),
      jsonLd: buildPriceLd({ title: cityTitle, description: cityDescription, canonical: cityCanonical, breadcrumbItems: cityBc }),
    }));

    // City gold shops
    const cityShopsDir  = path.join(ROOT, country.slug, city.slug, 'gold-shops');
    const cityShopsFile = path.join(cityShopsDir, 'index.html');
    const cityShopsCanonical = `${SITE_URL}/${country.slug}/${city.slug}/gold-shops`;

    const shopsTitle = `Gold Shops in ${city.nameEn} — Dealers & Jewellers | Gold Ticker Live`;
    const shopsDesc  = `Find gold shops, dealers and jewellers in ${city.nameEn}, ${country.nameEn}. Browse verified listings with contact information.`;
    const shopsH1    = `Gold Shops in ${city.nameEn}`;
    const shopsIntro = `Directory of gold shops and dealers in ${city.nameEn}, ${country.nameEn}.`;

    const shopsBc = [
      { name: 'Home',                   url: SITE_URL + '/' },
      { name: country.nameEn + ' Gold', url: `${SITE_URL}/${country.slug}/gold-price/` },
      { name: 'Gold Shops in ' + city.nameEn, url: cityShopsCanonical + '/' },
    ];

    const pricesLink = `<a href="${cityCanonical}/" style="padding:0.4rem 0.75rem;background:#f1f5f9;border-radius:6px;font-size:0.875rem;text-decoration:none;color:#1e293b;">Gold Prices in ${city.nameEn}</a>`;

    writeFile(cityShopsFile, buildPage({
      title: shopsTitle, description: shopsDesc, canonical: cityShopsCanonical,
      h1: shopsH1, introText: shopsIntro, depth: 3,
      breadcrumbs: shopsBc,
      relatedLinks: pricesLink,
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        'name': shopsTitle,
        'description': shopsDesc,
        'url': cityShopsCanonical + '/',
        'breadcrumb': {
          '@type': 'BreadcrumbList',
          'itemListElement': shopsBc.map((item, i) => ({
            '@type': 'ListItem', 'position': i + 1, 'name': item.name, 'item': item.url,
          })),
        },
      },
    }));

    // Karat-specific pages (24K, 22K, 21K, 18K only for city pages)
    for (const karat of KARATS.filter(k => ['24', '22', '21', '18'].includes(k.code))) {
      const karatSlug = `${karat.code}-karat`;
      const karatDir  = path.join(ROOT, country.slug, city.slug, 'gold-rate', karatSlug);
      const karatFile = path.join(karatDir, 'index.html');
      const karatCanonical = `${SITE_URL}/${country.slug}/${city.slug}/gold-rate/${karatSlug}`;

      const karatTitle = `${karat.code} Karat Gold Price in ${city.nameEn} Today — ${country.currency} per Gram | Gold Ticker Live`;
      const karatDesc  = `Live ${karat.code}K gold price in ${city.nameEn}, ${country.nameEn} today. ${country.currency} per gram, per ounce and per tola. Updated every 90 seconds.`;
      const karatH1    = `${karat.code}K Gold Price in ${city.nameEn} Today`;
      const karatIntro = `Current ${karat.code} karat (${(karat.purity * 100).toFixed(1)}% pure) gold price in ${city.nameEn}, ${country.nameEn}.`;

      const karatBc = [
        { name: 'Home',                      url: SITE_URL + '/' },
        { name: country.nameEn + ' Gold',    url: `${SITE_URL}/${country.slug}/gold-price/` },
        { name: city.nameEn + ' Prices',     url: cityCanonical + '/' },
        { name: karat.code + 'K Gold Price', url: karatCanonical + '/' },
      ];

      writeFile(karatFile, buildPage({
        title: karatTitle, description: karatDesc, canonical: karatCanonical,
        h1: karatH1, introText: karatIntro, depth: 4,
        breadcrumbs: karatBc,
        relatedLinks: `<a href="${cityCanonical}/" style="padding:0.4rem 0.75rem;background:#f1f5f9;border-radius:6px;font-size:0.875rem;text-decoration:none;color:#1e293b;">All Karats in ${city.nameEn}</a>`,
        jsonLd: buildPriceLd({ title: karatTitle, description: karatDesc, canonical: karatCanonical, breadcrumbItems: karatBc }),
      }));
    }
  }
}

console.log(`\n✅ Generated ${generatedCount} pages`);
