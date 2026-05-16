#!/usr/bin/env node
/**
 * build/generateSitemap.js
 * Generates sitemap.xml from all known route combinations.
 * Run: node build/generateSitemap.js
 */

const fs   = require('fs');
const path = require('path');
const vm   = require('vm');

const ROOT     = path.resolve(__dirname, '..');
const SITE_URL = 'https://goldtickerlive.com';
const TODAY    = new Date().toISOString().slice(0, 10);

function isNoindexFile(filePath) {
  try {
    const html = fs.readFileSync(filePath, 'utf8');
    return /<meta[^>]+name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(html);
  } catch {
    return false;
  }
}

function sitemapUrlToFilePath(loc) {
  const pathname = new URL(loc).pathname;
  if (pathname === '/') return path.join(ROOT, 'index.html');
  const rel = pathname.replace(/^\/+/, '');
  if (rel.endsWith('.html')) return path.join(ROOT, rel);
  return path.join(ROOT, rel, 'index.html');
}

/** Safely evaluate a JS array literal from a trusted local config file. */
function evalConfigArray(src) {
  return vm.runInNewContext(`(${src})`, Object.create(null), { timeout: 2000 });
}

const { COUNTRIES } = (() => {
  const raw = fs.readFileSync(path.join(ROOT, 'src/config/countries.js'), 'utf8');
  const match = raw.match(/export const COUNTRIES\s*=\s*(\[[\s\S]*?\]);/);
  if (!match) throw new Error('Could not parse COUNTRIES');
  return { COUNTRIES: evalConfigArray(match[1]) };
})();

const { KARATS } = (() => {
  const raw = fs.readFileSync(path.join(ROOT, 'src/config/karats.js'), 'utf8');
  const match = raw.match(/export const KARATS\s*=\s*(\[[\s\S]*?\]);/);
  if (!match) throw new Error('Could not parse KARATS');
  return { KARATS: evalConfigArray(match[1]) };
})();

function url(loc, changefreq, priority) {
  return `
  <url>
    <loc>${loc}</loc>
    <lastmod>${TODAY}</lastmod>
    <xhtml:link rel="alternate" hreflang="x-default" href="${loc}"/>
    <xhtml:link rel="alternate" hreflang="en" href="${loc}"/>
    <xhtml:link rel="alternate" hreflang="ar" href="${loc}?lang=ar"/>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

const urls = [];

// Static pages (from existing sitemap)
const staticPages = [
  { loc: `${SITE_URL}/`,                  changefreq: 'hourly',  priority: '1.0' },
  { loc: `${SITE_URL}/tracker.html`,      changefreq: 'always',  priority: '0.95' },
  { loc: `${SITE_URL}/shops.html`,        changefreq: 'weekly',  priority: '0.85' },
  { loc: `${SITE_URL}/calculator.html`,   changefreq: 'monthly', priority: '0.75' },
  { loc: `${SITE_URL}/learn.html`,        changefreq: 'monthly', priority: '0.65' },
  { loc: `${SITE_URL}/insights.html`,     changefreq: 'daily',   priority: '0.75' },
  { loc: `${SITE_URL}/methodology.html`,  changefreq: 'monthly', priority: '0.55' },
  { loc: `${SITE_URL}/invest.html`,       changefreq: 'monthly', priority: '0.60' },
  { loc: `${SITE_URL}/privacy.html`,      changefreq: 'yearly',  priority: '0.30' },
  { loc: `${SITE_URL}/terms.html`,        changefreq: 'yearly',  priority: '0.30' },
  { loc: `${SITE_URL}/content/guides/buying-guide.html`,          changefreq: 'monthly', priority: '0.65' },
  { loc: `${SITE_URL}/content/guides/24k-vs-22k.html`,            changefreq: 'monthly', priority: '0.60' },
  { loc: `${SITE_URL}/content/guides/gold-karat-comparison.html`, changefreq: 'monthly', priority: '0.60' },
  { loc: `${SITE_URL}/content/guides/aed-peg-explained.html`,     changefreq: 'monthly', priority: '0.55' },
  { loc: `${SITE_URL}/content/guides/gcc-market-hours.html`,      changefreq: 'monthly', priority: '0.55' },
  { loc: `${SITE_URL}/content/guides/invest-in-gold-gcc.html`,    changefreq: 'monthly', priority: '0.55' },
  { loc: `${SITE_URL}/content/guides/zakat-gold-guide.html`,      changefreq: 'monthly', priority: '0.55' },
  { loc: `${SITE_URL}/content/guides/`,                           changefreq: 'weekly',  priority: '0.55' },
  { loc: `${SITE_URL}/content/gold-price-history/`, changefreq: 'daily',   priority: '0.80' },
  { loc: `${SITE_URL}/content/order-gold/`,         changefreq: 'hourly',  priority: '0.85' },
  { loc: `${SITE_URL}/content/premium-watch/`,      changefreq: 'weekly',  priority: '0.70' },
  { loc: `${SITE_URL}/content/compare-countries/`,  changefreq: 'weekly',  priority: '0.70' },
  { loc: `${SITE_URL}/content/todays-best-rates/`,  changefreq: 'daily',   priority: '0.75' },
  { loc: `${SITE_URL}/content/news/`,               changefreq: 'weekly',  priority: '0.60' },
  { loc: `${SITE_URL}/content/changelog/`,          changefreq: 'weekly',  priority: '0.45' },
  { loc: `${SITE_URL}/content/faq/`,                changefreq: 'monthly', priority: '0.65' },
  { loc: `${SITE_URL}/content/submit-shop/`,        changefreq: 'monthly', priority: '0.55' },
  { loc: `${SITE_URL}/content/uae-gold-buying-guide/`,        changefreq: 'monthly', priority: '0.72' },
  { loc: `${SITE_URL}/content/dubai-gold-rate-guide/`,        changefreq: 'monthly', priority: '0.72' },
  { loc: `${SITE_URL}/content/gcc-gold-price-comparison/`,    changefreq: 'monthly', priority: '0.70' },
  { loc: `${SITE_URL}/content/spot-vs-retail-gold-price/`,    changefreq: 'monthly', priority: '0.68' },
  { loc: `${SITE_URL}/content/gold-making-charges-guide/`,    changefreq: 'monthly', priority: '0.68' },
  { loc: `${SITE_URL}/content/22k-gold-price-guide/`,         changefreq: 'monthly', priority: '0.68' },
  { loc: `${SITE_URL}/content/24k-gold-price-guide/`,         changefreq: 'monthly', priority: '0.68' },
  { loc: `${SITE_URL}/content/social/x-post-generator.html`, changefreq: 'monthly', priority: '0.40' },
  { loc: `${SITE_URL}/countries/index.html`, changefreq: 'monthly', priority: '0.60' },
];

for (const p of staticPages) {
  const filePath = sitemapUrlToFilePath(p.loc);
  if (fs.existsSync(filePath) && isNoindexFile(filePath)) continue;
  urls.push(url(p.loc, p.changefreq, p.priority));
}

// Old country pages (kept for backlinks)
for (const country of COUNTRIES) {
  if (!country.slug) continue;
  const htmlPath = path.join(ROOT, 'countries', country.slug, 'index.html');
  if (fs.existsSync(htmlPath) && !isNoindexFile(htmlPath)) {
    const oldUrl = `${SITE_URL}/countries/${country.slug}/`;
    urls.push(url(oldUrl, 'monthly', '0.40'));
  }
}

// Generated: country landing
for (const country of COUNTRIES) {
  if (!country.slug) continue;
  const countryGoldPriceFile = path.join(ROOT, 'countries', country.slug, 'gold-price', 'index.html');
  if (!(fs.existsSync(countryGoldPriceFile) && isNoindexFile(countryGoldPriceFile))) {
    urls.push(url(`${SITE_URL}/${country.slug}/gold-price/`, 'hourly', '0.90'));
  }

  for (const city of (country.cities || [])) {
    const cityGoldPricesFile = path.join(
      ROOT,
      'countries',
      country.slug,
      city.slug,
      'gold-prices',
      'index.html'
    );
    if (!(fs.existsSync(cityGoldPricesFile) && isNoindexFile(cityGoldPricesFile))) {
      urls.push(url(`${SITE_URL}/${country.slug}/${city.slug}/gold-prices/`, 'hourly', '0.85'));
    }

    const cityGoldShopsFile = path.join(
      ROOT,
      'countries',
      country.slug,
      city.slug,
      'gold-shops',
      'index.html'
    );
    if (!(fs.existsSync(cityGoldShopsFile) && isNoindexFile(cityGoldShopsFile))) {
      urls.push(url(`${SITE_URL}/${country.slug}/${city.slug}/gold-shops/`,  'weekly', '0.70'));
    }

    for (const karat of KARATS.filter(k => ['24', '22', '21', '18'].includes(k.code))) {
      const karatFile = path.join(
        ROOT,
        'countries',
        country.slug,
        city.slug,
        'gold-rate',
        `${karat.code}-karat`,
        'index.html'
      );
      if (fs.existsSync(karatFile) && isNoindexFile(karatFile)) continue;
      urls.push(url(`${SITE_URL}/${country.slug}/${city.slug}/gold-rate/${karat.code}-karat/`, 'hourly', '0.75'));
    }
  }
}

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.join('')}
</urlset>`;

const outPath = path.join(ROOT, 'sitemap.xml');
fs.writeFileSync(outPath, xml, 'utf8');
console.log(`✅ sitemap.xml written with ${urls.length} URLs`);
