'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  buildGoldPricesPage,
  buildGoldShopsPage,
  buildKaratPage,
  loadCountries,
} = require('../scripts/node/generate-city-pages.js');
const { NEW_CITIES, getCityContent } = require('../scripts/node/city-content.js');

const ROOT = path.resolve(__dirname, '..');

function findCity(countries, countrySlug, citySlug) {
  const country = countries.find((c) => c.slug === countrySlug);
  const city = country && (country.cities || []).find((c) => c.slug === citySlug);
  return { country, city };
}

test('every curated city in city-content.js exists in countries.js', () => {
  const countries = loadCountries();
  for (const entry of NEW_CITIES) {
    const { country, city } = findCity(countries, entry.country, entry.city);
    assert.ok(country, `country ${entry.country} present in countries.js`);
    assert.ok(city, `city ${entry.country}/${entry.city} present in countries.js`);
  }
});

test('gold-prices page is indexable, localized and carries schema', () => {
  const countries = loadCountries();
  const { country, city } = findCity(countries, 'oman', 'nizwa');
  const html = buildGoldPricesPage(country, city, getCityContent('oman', 'nizwa'));
  assert.doesNotMatch(html, /name="robots"/, 'gold-prices must not be noindex');
  assert.match(
    html,
    /canonical" href="https:\/\/goldtickerlive\.com\/countries\/oman\/nizwa\/gold-prices\/"/
  );
  assert.match(html, /"@type": "BreadcrumbList"/);
  assert.match(html, /"@type": "Product"/);
  assert.match(html, /"@type": "Dataset"/);
  assert.match(html, /schema\.org\/FAQPage/);
  assert.ok(html.includes('OMR'), 'uses the country currency');
  assert.ok(html.includes('Nizwa Souq'), 'uses the curated local market name');
  assert.ok(html.includes('page-hydrator.js'), 'wired to the shared hydrator');
});

test('per-karat page is noindex,follow and currency-correct', () => {
  const countries = loadCountries();
  const { country, city } = findCity(countries, 'turkey', 'bursa');
  const html = buildKaratPage(country, city, { code: '22', label: '22 Karat' });
  assert.match(html, /<meta name="robots" content="noindex,follow" \/>/);
  assert.match(html, /22K Gold Price in Bursa Today/);
  assert.ok(html.includes('TRY'), 'uses Turkish Lira');
});

test('non-pegged currencies never claim the AED peg', () => {
  const countries = loadCountries();
  const { country, city } = findCity(countries, 'india', 'jaipur');
  const html = buildGoldPricesPage(country, city, getCityContent('india', 'jaipur'));
  assert.doesNotMatch(html, /3\.6725/, 'INR page must not mention the AED peg');
  assert.match(html, /INR\/USD exchange rate/);
});

test('gold-shops page links back to the city gold-prices page', () => {
  const countries = loadCountries();
  const { country, city } = findCity(countries, 'egypt', 'luxor');
  const html = buildGoldShopsPage(country, city, getCityContent('egypt', 'luxor'));
  assert.match(html, /countries\/egypt\/luxor\/gold-prices\//);
  assert.match(html, /Gold Shops in Luxor/);
});

test('all curated cities have their owned pages materialized on disk', () => {
  for (const entry of NEW_CITIES) {
    const base = path.join(ROOT, 'countries', entry.country, entry.city);
    for (const rel of [
      'gold-prices/index.html',
      'gold-shops/index.html',
      'gold-rate/index.html',
      'index.html',
      'gold-rate/24-karat/index.html',
      'gold-rate/18-karat/index.html',
    ]) {
      assert.ok(
        fs.existsSync(path.join(base, rel)),
        `${entry.country}/${entry.city}/${rel} exists`
      );
    }
  }
});
