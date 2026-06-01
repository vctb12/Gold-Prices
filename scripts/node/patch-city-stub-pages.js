#!/usr/bin/env node
/**
 * patch-city-stub-pages.js
 *
 * Rebuilds lightweight city hub stubs under countries/{country}/{city}/index.html:
 * - Two clear links: gold-rate (live) + gold-shops
 * - Shared CSS (countries/stub-city.css) instead of per-file inline styles
 * - noindex,follow (navigation only; gold-rate is the indexable commercial URL)
 *
 * Run: node scripts/node/patch-city-stub-pages.js
 * Dry-run: node scripts/node/patch-city-stub-pages.js --dry-run
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '../..');
const SITE_URL = 'https://goldtickerlive.com';
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

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildStubPage(country, city) {
  const canonical = `${SITE_URL}/countries/${country.slug}/${city.slug}/`;
  const goldRateUrl = `/countries/${country.slug}/${city.slug}/gold-rate/`;
  const goldShopsUrl = `/countries/${country.slug}/${city.slug}/gold-shops/`;
  const title = `Gold Rate in ${city.nameEn}, ${country.nameEn} | Gold Ticker Live`;
  const description = `Navigate to live ${city.nameEn} gold rates (24K–18K in ${country.currency}) or gold shops. Reference pricing hub — commercial rates live on the gold-rate page.`;

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
      {
        '@type': 'ListItem',
        position: 2,
        name: country.nameEn,
        item: `${SITE_URL}/countries/${country.slug}/`,
      },
      { '@type': 'ListItem', position: 3, name: city.nameEn, item: canonical },
    ],
  };

  return `<!doctype html>
<html lang="en" dir="ltr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="robots" content="noindex,follow" />
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <link rel="canonical" href="${canonical}" />
    <link rel="alternate" hreflang="x-default" href="${canonical}" />
    <link rel="alternate" hreflang="en" href="${canonical}" />
    <link rel="alternate" hreflang="ar" href="${canonical}?lang=ar" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${canonical}" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <script type="application/ld+json">${JSON.stringify(breadcrumbLd)}</script>
    <link rel="stylesheet" href="../../../../styles/global.css" />
    <link rel="stylesheet" href="../../stub-city.css" />
  </head>
  <body>
    <a class="skip-link" href="#main-content">Skip to main content</a>
    <main id="main-content">
      <nav aria-label="Breadcrumb" class="stub-breadcrumbs">
        <a href="/">Home</a> ›
        <a href="/countries/${country.slug}/">${escapeHtml(country.nameEn)}</a> ›
        <span aria-current="page">${escapeHtml(city.nameEn)}</span>
      </nav>
      <h1>Gold in ${escapeHtml(city.nameEn)}, ${escapeHtml(country.nameEn)}</h1>
      <p class="stub-lead">
        Choose live reference gold rates for ${escapeHtml(city.nameEn)} (24K, 22K, 21K and 18K in
        ${escapeHtml(country.currency)} per gram) or browse listed gold shops. Retail jewellery prices
        include making charges and VAT — see our methodology for how reference rates are derived.
      </p>
      <ul class="stub-links">
        <li>
          <a href="${goldRateUrl}">
            <strong>Live gold rate by karat</strong><br />
            24K, 22K, 21K and 18K reference prices in ${escapeHtml(country.currency)} per gram — spot-linked with freshness labels.
          </a>
        </li>
        <li>
          <a href="${goldShopsUrl}">
            <strong>Gold shops in ${escapeHtml(city.nameEn)}</strong><br />
            Directory of jewellers and dealers — listings are informational, not endorsements.
          </a>
        </li>
      </ul>
      <p class="stub-related">
        See also:
        <a href="/countries/${country.slug}/">Gold price in ${escapeHtml(country.nameEn)}</a>
        · <a href="/shops.html">All gold shops</a>
        · <a href="/methodology.html">Methodology</a>
      </p>
      <p class="stub-lang">
        <a href="${canonical}?lang=ar" hreflang="ar">العربية: ${escapeHtml(city.nameAr)} — ${escapeHtml(country.nameAr)}</a>
      </p>
    </main>
    <script type="module">
      import { bootContentPage } from '../../../../src/lib/content-page-boot.js';
      bootContentPage({
        depth: 3,
        crumbs: [
          { label: 'Home', url: '/' },
          { label: '${escapeHtml(country.nameEn)}', url: '/countries/${country.slug}/' },
          { label: '${escapeHtml(city.nameEn)}', url: '#' },
        ],
        relatedGuides: false,
      });
    </script>
  </body>
</html>
`;
}

let patched = 0;
let skipped = 0;

for (const country of loadCountries()) {
  if (!country.slug || !Array.isArray(country.cities)) continue;
  for (const city of country.cities) {
    const cityIndex = path.join(ROOT, 'countries', country.slug, city.slug, 'index.html');
    if (!fs.existsSync(cityIndex)) {
      skipped += 1;
      continue;
    }
    const html = fs.readFileSync(cityIndex, 'utf8');
    if (!html.includes('stub-links') && !html.includes('stub-breadcrumbs')) {
      skipped += 1;
      continue;
    }
    const next = buildStubPage(country, city);
    if (dryRun) {
      console.log(`[dry-run] patch ${path.relative(ROOT, cityIndex)}`);
    } else {
      fs.writeFileSync(cityIndex, next, 'utf8');
    }
    patched += 1;
  }
}

console.log(
  `\n${dryRun ? '[dry-run] ' : ''}City stub patch complete: patched=${patched}, skipped=${skipped}`
);
