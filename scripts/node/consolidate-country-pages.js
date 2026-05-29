#!/usr/bin/env node
/**
 * consolidate-country-pages.js
 *
 * Harsh country/city URL consolidation:
 * 1. Promote each city's live `gold-prices/` hydrated page → `gold-rate/index.html`
 * 2. Delete duplicate `gold-prices/` trees
 * 3. Delete per-karat sub-pages
 * 4. Replace stub `gold-rate/index.html` when no hydrator present
 *
 * Run: node scripts/node/consolidate-country-pages.js
 * Dry-run: node scripts/node/consolidate-country-pages.js --dry-run
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '../..');
const SITE_URL = 'https://goldtickerlive.com';
const KARAT_SLUGS = ['18-karat', '21-karat', '22-karat', '24-karat'];
const dryRun = process.argv.includes('--dry-run');

function evalConfigArray(src) {
  return vm.runInNewContext(`(${src})`, Object.create(null), { timeout: 2000 });
}

function loadCountries() {
  const raw = fs.readFileSync(path.join(ROOT, 'src/config/countries.js'), 'utf8');
  const match = raw.match(/export const COUNTRIES\s*=\s*(\[[\s\S]*?\]);/);
  if (!match) throw new Error('Could not parse COUNTRIES');
  return evalConfigArray(match[1]);
}

function relPrefix(depth) {
  return depth === 0 ? '' : '../'.repeat(depth);
}

function rmrf(target) {
  if (!fs.existsSync(target)) return;
  if (dryRun) {
    console.log(`[dry-run] rm -rf ${path.relative(ROOT, target)}`);
    return;
  }
  fs.rmSync(target, { recursive: true, force: true });
}

function writeFile(filePath, content) {
  if (dryRun) {
    console.log(`[dry-run] write ${path.relative(ROOT, filePath)} (${content.length} bytes)`);
    return;
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

function migrateGoldPricesToGoldRate(goldPricesFile, goldRateFile) {
  let html = fs.readFileSync(goldPricesFile, 'utf8');

  html = html.replace(/gold-prices\/?/g, 'gold-rate/');
  html = html.replace(/\bGold Prices\b/g, 'Gold Rate');
  html = html.replace(
    /<meta\s+name="robots"\s+content="noindex,follow"\s*\/?>\s*/i,
    ''
  );

  writeFile(goldRateFile, html);
}

function buildCityGoldRatePage({ country, city, depth }) {
  const rel = relPrefix(depth);
  const canonical = `${SITE_URL}/countries/${country.slug}/${city.slug}/gold-rate`;
  const title = `Gold Rate in ${city.nameEn}, ${country.nameEn} Today — 24K, 22K, 21K, 18K | Gold Ticker Live`;
  const description = `Live 24K, 22K, 21K, 18K gold rates in ${city.nameEn}, ${country.nameEn} today. ${country.currency} per gram, updated every 90 seconds. Reference estimate only.`;
  const h1 = `Gold Rate in ${city.nameEn}, ${country.nameEn} Today`;
  const intro = `Current reference gold rates for ${city.nameEn} in ${country.currency}. All standard karats, spot-linked estimates with freshness labels.`;

  const siblingLinks = (country.cities || [])
    .filter((c) => c.slug !== city.slug)
    .slice(0, 4)
    .map(
      (c) =>
        `<a href="${SITE_URL}/countries/${country.slug}/${c.slug}/gold-rate/" style="padding:0.4rem 0.75rem;background:#f1f5f9;border-radius:6px;font-size:0.875rem;text-decoration:none;color:#1e293b;">${c.nameEn}</a>`
    )
    .join('\n          ');

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': `${canonical}/`,
        name: title,
        description,
        url: `${canonical}/`,
        inLanguage: 'en',
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
          {
            '@type': 'ListItem',
            position: 2,
            name: country.nameEn,
            item: `${SITE_URL}/countries/${country.slug}/`,
          },
          {
            '@type': 'ListItem',
            position: 3,
            name: city.nameEn,
            item: `${SITE_URL}/countries/${country.slug}/${city.slug}/`,
          },
          { '@type': 'ListItem', position: 4, name: 'Gold rate', item: `${canonical}/` },
        ],
      },
    ],
  };

  return `<!DOCTYPE html>
<html lang="en" dir="ltr">
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
  <link rel="alternate" hreflang="ar" href="${canonical}/?lang=ar" />
  <title>${title}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link rel="preconnect" href="https://open.er-api.com" />
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;700;800&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="${rel}styles/global.css" />
  <link rel="icon" href="${rel}favicon.svg" type="image/svg+xml" />
  <script type="application/ld+json">
${JSON.stringify(jsonLd, null, 2)}
  </script>
</head>
<body>
  <div id="nav-root"></div>
  <main class="country-page-main" style="max-width:900px;margin:0 auto;padding:1.5rem 1rem;">
    <nav class="breadcrumb" aria-label="Breadcrumb" id="breadcrumb-root"></nav>
    <h1 style="font-size:1.75rem;font-weight:700;margin:1rem 0 0.5rem;">${h1}</h1>
    <p style="color:#64748b;margin-bottom:1.5rem;">${intro}</p>
    <div id="price-display" style="display:none;">
      <div id="freshness-badge" style="margin-bottom:1rem;"></div>
      <div id="karat-cards" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:1rem;margin-bottom:1.5rem;"></div>
      <div id="price-disclaimer"></div>
    </div>
    <div id="price-loading" style="padding:2rem;text-align:center;color:#94a3b8;">Loading live prices…</div>
    <section style="margin-top:2rem;">
      <h2 style="font-size:1.1rem;font-weight:600;margin-bottom:0.75rem;">Related Pages</h2>
      <div style="display:flex;flex-wrap:wrap;gap:0.5rem;">
        <a href="${SITE_URL}/countries/${country.slug}/" style="padding:0.4rem 0.75rem;background:#f1f5f9;border-radius:6px;font-size:0.875rem;text-decoration:none;color:#1e293b;">${country.nameEn} overview</a>
        <a href="${SITE_URL}/countries/${country.slug}/${city.slug}/gold-shops/" style="padding:0.4rem 0.75rem;background:#fef9c3;border-radius:6px;font-size:0.875rem;text-decoration:none;color:#713f12;">Gold shops in ${city.nameEn}</a>
        ${siblingLinks}
      </div>
    </section>
  </main>
  <div id="footer-root"></div>
  <script type="module" src="${rel}src/lib/page-hydrator.js"></script>
</body>
</html>`;
}

function patchGoldRateStub(goldRateFile, country, city) {
  if (!fs.existsSync(goldRateFile)) return;
  let html = fs.readFileSync(goldRateFile, 'utf8');
  if (!html.includes('stub-links')) return;

  let changed = false;

  for (const slug of KARAT_SLUGS) {
    const re = new RegExp(
      `<li><a href="/countries/${country.slug}/${city.slug}/gold-rate/${slug}/">[\\s\\S]*?</a></li>\\s*`,
      'g'
    );
    if (re.test(html)) {
      html = html.replace(re, '');
      changed = true;
    }
  }

  html = html.replace(
    /<meta\s+name="robots"\s+content="noindex,follow"\s*\/?>\s*/i,
    () => {
      changed = true;
      return '';
    }
  );

  if (changed) writeFile(goldRateFile, html);
}

function patchStubCityIndex(cityIndexFile, country, city) {
  if (!fs.existsSync(cityIndexFile)) return;
  let html = fs.readFileSync(cityIndexFile, 'utf8');
  if (!html.includes('stub-links') && !html.includes('-karat/')) return;

  const goldRateUrl = `/countries/${country.slug}/${city.slug}/gold-rate/`;
  let changed = false;

  for (const slug of KARAT_SLUGS) {
    const re = new RegExp(
      `<li><a href="/countries/${country.slug}/${city.slug}/gold-rate/${slug}/">[\\s\\S]*?</a></li>\\s*`,
      'g'
    );
    if (re.test(html)) {
      html = html.replace(re, '');
      changed = true;
    }
  }

  if (html.includes('gold-prices/')) {
    html = html.replace(
      new RegExp(`/countries/${country.slug}/${city.slug}/gold-prices/`, 'g'),
      goldRateUrl
    );
    changed = true;
  }

  if (html.includes('stub-links') && !html.includes('Live gold rate by karat')) {
    const card = `<li><a href="${goldRateUrl}"><strong>Live gold rate by karat</strong><br />24K, 22K, 21K and 18K reference prices in ${country.currency} per gram — updated from spot.</a></li>`;
    html = html.replace(/<ul class="stub-links">/, `<ul class="stub-links">\n        ${card}`);
    changed = true;
  }

  if (changed) writeFile(cityIndexFile, html);
}

const stats = {
  karatDirsRemoved: 0,
  goldPricesRemoved: 0,
  goldRateMigrated: 0,
  goldRateGenerated: 0,
  stubsPatched: 0,
};

const countries = loadCountries();

for (const country of countries) {
  if (!country.slug || !Array.isArray(country.cities)) continue;

  for (const city of country.cities) {
    const cityBase = path.join(ROOT, 'countries', country.slug, city.slug);
    const goldPricesFile = path.join(cityBase, 'gold-prices', 'index.html');
    const goldRateFile = path.join(cityBase, 'gold-rate', 'index.html');
    const cityIndexFile = path.join(cityBase, 'index.html');
    const depth = 4;

    for (const karatSlug of KARAT_SLUGS) {
      const karatDir = path.join(cityBase, 'gold-rate', karatSlug);
      if (fs.existsSync(karatDir)) {
        rmrf(karatDir);
        stats.karatDirsRemoved += 1;
      }
    }

    if (fs.existsSync(goldPricesFile)) {
      migrateGoldPricesToGoldRate(goldPricesFile, goldRateFile);
      stats.goldRateMigrated += 1;
      rmrf(path.join(cityBase, 'gold-prices'));
      stats.goldPricesRemoved += 1;
    } else if (
      !fs.existsSync(goldRateFile) ||
      !fs.readFileSync(goldRateFile, 'utf8').includes('page-hydrator')
    ) {
      writeFile(goldRateFile, buildCityGoldRatePage({ country, city, depth }));
      stats.goldRateGenerated += 1;
    } else {
      patchGoldRateStub(goldRateFile, country, city);
    }

    patchStubCityIndex(cityIndexFile, country, city);
    stats.stubsPatched += 1;
  }
}

console.log(
  `\n${dryRun ? '[dry-run] ' : ''}Country consolidation complete:`,
  JSON.stringify(stats, null, 2)
);
