#!/usr/bin/env node
/**
 * enrich-placeholder-pages.js
 *
 * Replaces every remaining "auto-generated placeholder" HTML file with a
 * proper stub that has correct SEO metadata and real internal links.
 *
 * The previous tooling left ~180 placeholder pages that were either:
 *   (a) country/city/karat hub URLs exposed to search crawlers without
 *       canonical/hreflang/description (soft-404 risk), or
 *   (b) dev/internal directory listings (src/, scripts/, server/, …)
 *       that should never be indexed.
 *
 * Goals:
 *   - Every placeholder page ends up with `<meta name="robots"
 *     content="noindex,follow">` so it cannot produce a soft-404 or
 *     duplicate-content signal.
 *   - Country / city / karat hub stubs get real navigation to their
 *     sibling leaf pages (country config + filesystem siblings), a
 *     self-canonical, hreflang (x-default, en, ar) and an OG/Twitter
 *     minimum.
 *   - Dev/internal stubs get a tiny "Not a public page" body and
 *     `noindex,nofollow`.
 *
 * Idempotent: re-running produces byte-identical output.
 *
 * Usage:
 *   node scripts/node/enrich-placeholder-pages.js            # write
 *   node scripts/node/enrich-placeholder-pages.js --check    # exit 1 if
 *                                                              rewrites needed
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const BASE_URL = 'https://goldtickerlive.com';
const PLACEHOLDER_MARKER = 'auto-generated as a placeholder';

// --- country config (mirrored inline so this script is pure CJS) ------
// Keep in sync with src/config/countries.js. Any new slug added there
// should be added here if the URL is exposed.
const COUNTRIES = loadCountries();

function loadCountries() {
  // Parse src/config/countries.js without importing ESM. Safe subset: we
  // only need slug, nameEn, nameAr, currency, cities[{slug, nameEn, nameAr}].
  const src = fs.readFileSync(path.join(ROOT, 'src/config/countries.js'), 'utf8');
  // Very small tolerant extractor. Good enough because countries.js is
  // hand-written, well-formatted, and covered by lint + tests.
  const objs = [];
  const re = /\{\s*code:[\s\S]*?\n\s*\}(?=\s*,|\s*\])/g;
  for (const m of src.matchAll(re)) {
    const block = m[0];
    const pick = (k) => {
      const mm = block.match(new RegExp(`${k}:\\s*'([^']*)'`));
      return mm ? mm[1] : undefined;
    };
    const slug = pick('slug');
    if (!slug) continue; // skip reference-only countries (no pages)
    const nameEn = pick('nameEn');
    const nameAr = pick('nameAr');
    const currency = pick('currency');
    const cities = [];
    const citiesBlock = block.match(/cities:\s*\[([\s\S]*?)\]/);
    if (citiesBlock) {
      const cre =
        /\{\s*slug:\s*'([^']+)',\s*nameEn:\s*'?"?([^',"]+)'?"?,\s*nameAr:\s*'([^']+)'\s*\}/g;
      // the nameEn may contain spaces/apostrophes — fallback
      const simpler =
        /\{\s*slug:\s*'([^']+)',\s*nameEn:\s*(?:'([^']*)'|"([^"]*)"),\s*nameAr:\s*'([^']+)'\s*\}/g;
      let mm;
      while ((mm = simpler.exec(citiesBlock[1]))) {
        cities.push({ slug: mm[1], nameEn: mm[2] || mm[3], nameAr: mm[4] });
      }
      // fallback parse (if simpler missed any)
      if (cities.length === 0) {
        let mm2;
        while ((mm2 = cre.exec(citiesBlock[1]))) {
          cities.push({ slug: mm2[1], nameEn: mm2[2], nameAr: mm2[3] });
        }
      }
    }
    objs.push({ slug, nameEn, nameAr, currency, cities });
  }
  return objs;
}

function findCountry(slug) {
  return COUNTRIES.find((c) => c.slug === slug);
}
function findCity(country, slug) {
  return country?.cities?.find((c) => c.slug === slug);
}

// --- generic helpers ---------------------------------------------------

function urlFor(relFile) {
  // relFile is e.g. "countries/uae/dubai/index.html" or "404.html"
  if (relFile === 'index.html') return BASE_URL + '/';
  if (relFile.endsWith('/index.html')) {
    return BASE_URL + '/' + relFile.slice(0, -'index.html'.length);
  }
  return BASE_URL + '/' + relFile;
}

function hreflangAlternates(urlEn) {
  const sep = urlEn.includes('?') ? '&' : '?';
  const urlAr = urlEn + sep + 'lang=ar';
  return (
    `<link rel="alternate" hreflang="x-default" href="${urlEn}" />\n` +
    `    <link rel="alternate" hreflang="en" href="${urlEn}" />\n` +
    `    <link rel="alternate" hreflang="ar" href="${urlAr}" />`
  );
}

function breadcrumbJsonLd(items) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: it.url,
    })),
  };
  return `<script type="application/ld+json">${JSON.stringify(data)}</script>`;
}

// --- builders ----------------------------------------------------------

function buildCityHub(country, city, relFile) {
  const url = urlFor(relFile);
  const cityEn = city.nameEn;
  const cityAr = city.nameAr;
  const countryEn = country.nameEn;
  const countryAr = country.nameAr;
  const ccy = country.currency;
  const title = `Gold Prices in ${cityEn}, ${countryEn} — 24K, 22K, 21K, 18K | Gold Ticker Live`;
  const desc =
    `Live 24K, 22K, 21K and 18K gold prices in ${cityEn}, ${countryEn} — ` +
    `per gram in ${ccy}. Live rates, city shops, or specific karat pages.`;
  const dir = path.join(ROOT, path.dirname(relFile));
  const existing = (p) => fs.existsSync(path.join(dir, p));
  const links = [];
  if (existing('gold-rate/index.html')) {
    links.push({
      href: `/countries/${country.slug}/${city.slug}/gold-rate/`,
      title: `Live gold rate in ${cityEn}`,
      blurb: `24K, 22K, 21K and 18K reference rates per gram in ${ccy}, refreshed from spot.`,
    });
  }
  if (existing('gold-shops/index.html')) {
    links.push({
      href: `/countries/${country.slug}/${city.slug}/gold-shops/`,
      title: `Gold Shops in ${cityEn}`,
      blurb: `Directory of gold jewellers and dealers listed for ${cityEn}. Directory data, not verified store endorsements.`,
    });
  }
  const breadcrumbs = [
    { name: 'Home', url: BASE_URL + '/' },
    { name: countryEn, url: `${BASE_URL}/countries/${country.slug}/` },
    { name: cityEn, url },
  ];

  const body = `
    <main>
      <nav aria-label="Breadcrumb" class="stub-breadcrumbs">
        <a href="/">Home</a> ›
        <a href="/countries/${country.slug}/">${escapeHtml(countryEn)}</a> ›
        <span aria-current="page">${escapeHtml(cityEn)}</span>
      </nav>
      <h1>Gold Prices in ${escapeHtml(cityEn)}, ${escapeHtml(countryEn)}</h1>
      <p class="stub-lead">
        Live reference gold prices for ${escapeHtml(cityEn)} — covering 24K, 22K, 21K and 18K
        rates in ${escapeHtml(ccy)} per gram. Prices are derived from the international XAU/USD
        spot price and the ${escapeHtml(ccy)}/USD FX rate. Retail jewellery prices will differ
        once making charges and VAT are applied.
      </p>
      <ul class="stub-links">
${links
  .map(
    (l) =>
      `        <li><a href="${l.href}"><strong>${escapeHtml(l.title)}</strong><br />${escapeHtml(
        l.blurb
      )}</a></li>`
  )
  .join('\n')}
      </ul>
      <p class="stub-related">
        See also: <a href="/countries/${country.slug}/">Gold price in ${escapeHtml(
          countryEn
        )}</a> · <a href="/shops.html">All gold shops</a> · <a href="/methodology.html">Methodology</a>
      </p>
      <p class="stub-lang"><a href="${url}?lang=ar" hreflang="ar">العربية: ${escapeHtml(
        cityAr
      )} — ${escapeHtml(countryAr)}</a></p>
    </main>`.trim();

  return buildHtmlShell({
    url,
    title,
    desc,
    robots: 'noindex,follow',
    alternates: hreflangAlternates(url),
    jsonLd: breadcrumbJsonLd(breadcrumbs),
    body,
  });
}

function buildCityKaratHub(country, city, relFile) {
  const url = urlFor(relFile);
  const cityEn = city.nameEn;
  const countryEn = country.nameEn;
  const ccy = country.currency;
  const title = `Gold Rate by Karat in ${cityEn}, ${countryEn} — 24K, 22K, 21K, 18K | Gold Ticker Live`;
  const desc =
    `Today's gold rate in ${cityEn}, ${countryEn} by karat — 24K, 22K, 21K ` +
    `and 18K live prices per gram in ${ccy}, refreshed from the spot market.`;
  const dir = path.join(ROOT, path.dirname(relFile));
  const existing = (p) => fs.existsSync(path.join(dir, p));
  const karats = [
    {
      slug: '24-karat',
      label: '24K Gold (999 / pure)',
      note: 'Highest purity. Primarily used for bullion and investment.',
    },
    {
      slug: '22-karat',
      label: '22K Gold (916)',
      note: 'Common for wedding jewellery in GCC and South Asia.',
    },
    {
      slug: '21-karat',
      label: '21K Gold (875)',
      note: 'Popular jewellery standard in the GCC and Egypt.',
    },
    {
      slug: '18-karat',
      label: '18K Gold (750)',
      note: 'Durable jewellery purity used across Europe and gem settings.',
    },
  ].filter((k) => existing(`${k.slug}/index.html`));

  const breadcrumbs = [
    { name: 'Home', url: BASE_URL + '/' },
    { name: countryEn, url: `${BASE_URL}/countries/${country.slug}/` },
    { name: cityEn, url: `${BASE_URL}/countries/${country.slug}/${city.slug}/` },
    { name: 'Gold rate', url },
  ];

  const body = `
    <main>
      <nav aria-label="Breadcrumb" class="stub-breadcrumbs">
        <a href="/">Home</a> ›
        <a href="/countries/${country.slug}/">${escapeHtml(countryEn)}</a> ›
        <a href="/countries/${country.slug}/${city.slug}/">${escapeHtml(cityEn)}</a> ›
        <span aria-current="page">Gold rate</span>
      </nav>
      <h1>Gold Rate by Karat in ${escapeHtml(cityEn)}</h1>
      <p class="stub-lead">
        Live per-gram gold rate in ${escapeHtml(cityEn)}, ${escapeHtml(
          countryEn
        )} for each standard karat. Pick the karat that matches the jewellery you are buying
        or selling. Values are reference prices in ${escapeHtml(
          ccy
        )} derived from the spot market, not retail shop quotes.
      </p>
      <ul class="stub-links">
${karats
  .map(
    (k) =>
      `        <li><a href="/countries/${country.slug}/${city.slug}/gold-rate/${k.slug}/"><strong>${escapeHtml(
        k.label
      )}</strong><br />${escapeHtml(k.note)}</a></li>`
  )
  .join('\n')}
      </ul>
      <p class="stub-related">
        Back to: <a href="/countries/${country.slug}/${city.slug}/">${escapeHtml(
          cityEn
        )} overview</a> · <a href="/countries/${country.slug}/">${escapeHtml(
          countryEn
        )} gold price</a> · <a href="/methodology.html">How prices are calculated</a>
      </p>
    </main>`.trim();

  return buildHtmlShell({
    url,
    title,
    desc,
    robots: 'noindex,follow',
    alternates: hreflangAlternates(url),
    jsonLd: breadcrumbJsonLd(breadcrumbs),
    body,
  });
}

function buildCountryCitiesIndex(country, relFile, which) {
  const url = urlFor(relFile);
  const countryEn = country.nameEn;
  const label = which === 'markets' ? 'Gold markets' : 'Cities';
  const title = `${label} in ${countryEn} | Gold Ticker Live`;
  const desc =
    which === 'markets'
      ? `Gold trading markets and wholesale districts tracked for ${countryEn}.`
      : `Cities covered by Gold Ticker Live in ${countryEn} — live gold rates, shops and karat pages.`;
  const breadcrumbs = [
    { name: 'Home', url: BASE_URL + '/' },
    { name: countryEn, url: `${BASE_URL}/countries/${country.slug}/` },
    { name: label, url },
  ];
  const cityLinks = (country.cities || [])
    .map(
      (c) =>
        `        <li><a href="/countries/${country.slug}/${c.slug}/"><strong>${escapeHtml(
          c.nameEn
        )}</strong><br />Gold prices, shops, and karat pages in ${escapeHtml(c.nameEn)}.</a></li>`
    )
    .join('\n');
  const body = `
    <main>
      <nav aria-label="Breadcrumb" class="stub-breadcrumbs">
        <a href="/">Home</a> ›
        <a href="/countries/${country.slug}/">${escapeHtml(countryEn)}</a> ›
        <span aria-current="page">${escapeHtml(label)}</span>
      </nav>
      <h1>${escapeHtml(label)} in ${escapeHtml(countryEn)}</h1>
      <p class="stub-lead">${escapeHtml(desc)}</p>
      <ul class="stub-links">
${cityLinks || '        <li><em>No cities listed yet.</em></li>'}
      </ul>
    </main>`.trim();
  return buildHtmlShell({
    url,
    title,
    desc,
    robots: 'noindex,follow',
    alternates: hreflangAlternates(url),
    jsonLd: breadcrumbJsonLd(breadcrumbs),
    body,
  });
}

function buildInternalStub(relFile) {
  const url = urlFor(relFile);
  const title = 'Not a public page — Gold Ticker Live';
  const desc = 'This path is an internal directory index and is not intended for end users.';
  const body = `
    <main>
      <h1>Not a public page</h1>
      <p>This URL is an internal directory listing and has no public content.
        Continue to the <a href="/">Gold Ticker Live home page</a> instead.</p>
    </main>`.trim();
  return buildHtmlShell({
    url,
    title,
    desc,
    robots: 'noindex,nofollow',
    alternates: '', // no hreflang on internal stubs
    jsonLd: '',
    body,
  });
}

function buildHtmlShell({ url, title, desc, robots, alternates, jsonLd, body }) {
  const og = `
    <meta property="og:title" content="${escapeAttr(title)}" />
    <meta property="og:description" content="${escapeAttr(desc)}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${url}" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${escapeAttr(title)}" />
    <meta name="twitter:description" content="${escapeAttr(desc)}" />`.trim();
  return `<!doctype html>
<html lang="en" dir="ltr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="robots" content="${robots}" />
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeAttr(desc)}" />
    <link rel="canonical" href="${url}" />
    ${alternates}
    ${og}
    ${jsonLd}
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
             max-width: 720px; margin: 2rem auto; padding: 0 1rem; line-height: 1.55; color: #1a1a1a; }
      h1 { font-size: 1.6rem; margin: 0.6rem 0 1rem; }
      .stub-breadcrumbs { font-size: 0.9rem; color: #555; margin-bottom: 0.5rem; }
      .stub-breadcrumbs a { color: #555; text-decoration: none; }
      .stub-breadcrumbs a:hover { text-decoration: underline; }
      .stub-lead { margin: 0 0 1.25rem; }
      .stub-links { list-style: none; padding: 0; }
      .stub-links li { margin-bottom: 0.9rem; }
      .stub-links a { display: block; padding: 0.85rem 1rem; background: #f7f6f1; color: #1a1a1a;
                      border: 1px solid #e4dfcf; border-radius: 10px; text-decoration: none; }
      .stub-links a:hover, .stub-links a:focus { background: #efe9d4; border-color: #c9b26c; }
      .stub-related, .stub-lang { font-size: 0.9rem; color: #555; margin-top: 1.2rem; }
      a { color: #7a5a00; }
    </style>
  </head>
  <body>
${body}
  </body>
</html>
`;
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escapeAttr(s) {
  return escapeHtml(s).replace(/"/g, '&quot;');
}

// --- classifier --------------------------------------------------------

function classify(relFile) {
  // Normalize to forward slashes
  const p = relFile.split(path.sep).join('/');
  // Country dir patterns
  let m;
  if ((m = p.match(/^countries\/([^/]+)\/([^/]+)\/index\.html$/))) {
    const country = findCountry(m[1]);
    const city = findCity(country, m[2]);
    if (country && city) return { kind: 'city', country, city, relFile: p };
    // e.g. countries/uae/cities/index.html or markets
    if (country && (m[2] === 'cities' || m[2] === 'markets')) {
      return { kind: 'country-index', country, which: m[2], relFile: p };
    }
  }
  if ((m = p.match(/^countries\/([^/]+)\/([^/]+)\/gold-rate\/index\.html$/))) {
    const country = findCountry(m[1]);
    const city = findCity(country, m[2]);
    if (country && city) return { kind: 'city-karat', country, city, relFile: p };
  }
  // everything else → internal stub
  return { kind: 'internal', relFile: p };
}

// --- main -------------------------------------------------------------

function isPlaceholder(content) {
  return content.includes(PLACEHOLDER_MARKER);
}

function findPlaceholderFiles() {
  const found = [];
  const walk = (dir, base = '') => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      if (['node_modules', 'dist'].includes(entry.name)) continue;
      const full = path.join(dir, entry.name);
      const rel = base ? `${base}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(full, rel);
      else if (entry.name.endsWith('.html')) {
        let content;
        try {
          content = fs.readFileSync(full, 'utf8');
        } catch {
          continue;
        }
        if (isPlaceholder(content)) found.push(rel);
      }
    }
  };
  walk(ROOT);
  return found;
}

function run({ check }) {
  const files = findPlaceholderFiles();
  const outcomes = { rewritten: 0, unchanged: 0, needsRewrite: 0, skipped: 0 };
  for (const rel of files) {
    const cls = classify(rel);
    let html;
    try {
      if (cls.kind === 'city') html = buildCityHub(cls.country, cls.city, cls.relFile);
      else if (cls.kind === 'city-karat')
        html = buildCityKaratHub(cls.country, cls.city, cls.relFile);
      else if (cls.kind === 'country-index')
        html = buildCountryCitiesIndex(cls.country, cls.relFile, cls.which);
      else html = buildInternalStub(cls.relFile);
    } catch (e) {
      console.error(`skip ${rel}: ${e.message}`);
      outcomes.skipped++;
      continue;
    }
    const full = path.join(ROOT, rel);
    const existing = fs.readFileSync(full, 'utf8');
    if (existing === html) {
      outcomes.unchanged++;
      continue;
    }
    if (check) {
      outcomes.needsRewrite++;
      console.log('needs rewrite:', rel);
      continue;
    }
    fs.writeFileSync(full, html, 'utf8');
    outcomes.rewritten++;
  }
  const mode = check ? 'check' : 'write';
  console.log(
    `[enrich-placeholder-pages:${mode}] files=${files.length} rewritten=${outcomes.rewritten} unchanged=${outcomes.unchanged} needsRewrite=${outcomes.needsRewrite} skipped=${outcomes.skipped}`
  );
  if (check && outcomes.needsRewrite > 0) process.exit(1);
}

run({ check: process.argv.includes('--check') });
