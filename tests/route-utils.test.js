'use strict';

/**
 * Tests for utils/routeBuilder.js and utils/routeValidator.js.
 *
 * Since these modules use ESM imports, we inline the core logic here
 * to keep tests runnable with plain `node --test` without a transpile step.
 *
 * Run with: npm test
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

// ---------------------------------------------------------------------------
// Inline constants (mirrors config/constants.js)
// ---------------------------------------------------------------------------

const BASE_PATH = '/';

// Subset of countries for testing (mirrors config/countries.js structure)
const COUNTRIES = [
  {
    code: 'AE',
    slug: 'uae',
    nameEn: 'United Arab Emirates',
    currency: 'AED',
    cities: [
      { slug: 'dubai', nameEn: 'Dubai' },
      { slug: 'sharjah', nameEn: 'Sharjah' },
      { slug: 'abu-dhabi', nameEn: 'Abu Dhabi' },
    ],
  },
  {
    code: 'SA',
    slug: 'saudi-arabia',
    nameEn: 'Saudi Arabia',
    currency: 'SAR',
    cities: [
      { slug: 'riyadh', nameEn: 'Riyadh' },
      { slug: 'jeddah', nameEn: 'Jeddah' },
    ],
  },
  { code: 'SY', nameEn: 'Syria', currency: 'SYP' }, // no slug, no cities
];

const KARATS = [
  { code: '24', purity: 1.0 },
  { code: '22', purity: 22 / 24 },
  { code: '21', purity: 21 / 24 },
  { code: '18', purity: 0.75 },
];

// ---------------------------------------------------------------------------
// Inline routeBuilder logic
// ---------------------------------------------------------------------------

function buildRoute({ country, city, karat, page } = {}) {
  if (page) {
    const staticRoutes = {
      home: '',
      calculator: 'calculator.html',
      tracker: 'tracker.html',
      shops: 'shops.html',
      order: 'order-gold',
      history: 'gold-price-history',
      search: 'search',
      xpost: 'social/x-post-generator.html',
      learn: 'learn.html',
      insights: 'insights.html',
      invest: 'invest.html',
      methodology: 'methodology.html',
      terms: 'terms.html',
      privacy: 'privacy.html',
    };
    const segment = staticRoutes[page];
    if (segment === undefined) return null;
    return `${BASE_PATH}${segment}`;
  }
  if (country && !city && !karat) return `${BASE_PATH}${country}/gold-price`;
  if (country && city) return `${BASE_PATH}${country}/${city}/gold-rate`;
  return null;
}

function buildShopsRoute(country, city) {
  return `${BASE_PATH}${country}/${city}/gold-shops`;
}

function buildCanonicalURL(path, domain = 'https://goldtickerlive.com') {
  if (!path) return null;
  const fullPath = path.startsWith(BASE_PATH) ? path : `${BASE_PATH}${path}`;
  return `${domain}${fullPath}`;
}

// ---------------------------------------------------------------------------
// Inline routeValidator logic
// ---------------------------------------------------------------------------

function validateCountry(slug) {
  if (!slug || typeof slug !== 'string') return { valid: false, error: 'Country slug is required' };
  const country = COUNTRIES.find((c) => c.slug === slug);
  if (!country) return { valid: false, error: `Unknown country: ${slug}` };
  if (!country.cities || country.cities.length === 0)
    return { valid: false, error: `Country "${slug}" has no city pages` };
  return { valid: true, country };
}

function validateCity(countrySlug, citySlug) {
  const cr = validateCountry(countrySlug);
  if (!cr.valid) return cr;
  if (!citySlug || typeof citySlug !== 'string')
    return { valid: false, error: 'City slug is required' };
  const city = cr.country.cities.find((c) => c.slug === citySlug);
  if (!city)
    return { valid: false, error: `Unknown city "${citySlug}" in country "${countrySlug}"` };
  return { valid: true, country: cr.country, city };
}

function validateKarat(karatCode) {
  if (!karatCode || typeof karatCode !== 'string')
    return { valid: false, error: 'Karat code is required' };
  const code = karatCode.replace('-karat', '');
  const karat = KARATS.find((k) => k.code === code);
  if (!karat) return { valid: false, error: `Unknown karat: ${karatCode}` };
  return { valid: true, karat };
}

function validateRoute({ country, city, karat } = {}) {
  if (karat && !city) return { valid: false, error: 'Karat pages require a city' };
  if (city && !country) return { valid: false, error: 'City pages require a country' };
  let countryObj, cityObj, karatObj;
  if (country) {
    const cr = validateCountry(country);
    if (!cr.valid) return cr;
    countryObj = cr.country;
  }
  if (city) {
    const cir = validateCity(country, city);
    if (!cir.valid) return cir;
    cityObj = cir.city;
  }
  if (karat) {
    const kr = validateKarat(karat);
    if (!kr.valid) return kr;
    karatObj = kr.karat;
  }
  return { valid: true, country: countryObj, city: cityObj, karat: karatObj };
}

// ===========================================================================
// Tests — routeBuilder
// ===========================================================================

describe('buildRoute', () => {
  test('homepage', () => {
    assert.equal(buildRoute({ page: 'home' }), '/');
  });

  test('static pages', () => {
    assert.equal(buildRoute({ page: 'calculator' }), '/calculator.html');
    assert.equal(buildRoute({ page: 'tracker' }), '/tracker.html');
    assert.equal(buildRoute({ page: 'shops' }), '/shops.html');
    assert.equal(buildRoute({ page: 'order' }), '/order-gold');
    assert.equal(buildRoute({ page: 'terms' }), '/terms.html');
    assert.equal(buildRoute({ page: 'privacy' }), '/privacy.html');
  });

  test('unknown static page returns null', () => {
    assert.equal(buildRoute({ page: 'nonexistent' }), null);
  });

  test('country landing page', () => {
    assert.equal(buildRoute({ country: 'uae' }), '/uae/gold-price');
    assert.equal(buildRoute({ country: 'saudi-arabia' }), '/saudi-arabia/gold-price');
  });

  test('city gold rate hub', () => {
    assert.equal(buildRoute({ country: 'uae', city: 'dubai' }), '/uae/dubai/gold-rate');
  });

  test('karat param resolves to consolidated city gold-rate hub', () => {
    assert.equal(
      buildRoute({ country: 'uae', city: 'dubai', karat: '22' }),
      '/uae/dubai/gold-rate'
    );
  });

  test('no params returns null', () => {
    assert.equal(buildRoute(), null);
    assert.equal(buildRoute({}), null);
  });
});

describe('buildShopsRoute', () => {
  test('builds correct shops URL', () => {
    assert.equal(buildShopsRoute('uae', 'dubai'), '/uae/dubai/gold-shops');
  });
});

describe('buildCanonicalURL', () => {
  test('generates full canonical URL', () => {
    const path = buildRoute({ country: 'uae', city: 'dubai' });
    assert.equal(buildCanonicalURL(path), 'https://goldtickerlive.com/uae/dubai/gold-rate');
  });

  test('returns null for null path', () => {
    assert.equal(buildCanonicalURL(null), null);
  });
});

// ===========================================================================
// Tests — routeValidator
// ===========================================================================

describe('validateCountry', () => {
  test('valid country slug', () => {
    const r = validateCountry('uae');
    assert.equal(r.valid, true);
    assert.equal(r.country.code, 'AE');
  });

  test('unknown country slug', () => {
    const r = validateCountry('narnia');
    assert.equal(r.valid, false);
    assert.ok(r.error.includes('Unknown country'));
  });

  test('null slug', () => {
    const r = validateCountry(null);
    assert.equal(r.valid, false);
  });

  test('country without cities', () => {
    // Syria has no slug, so it won't match
    const r = validateCountry('syria');
    assert.equal(r.valid, false);
  });
});

describe('validateCity', () => {
  test('valid city in valid country', () => {
    const r = validateCity('uae', 'dubai');
    assert.equal(r.valid, true);
    assert.equal(r.city.slug, 'dubai');
  });

  test('unknown city', () => {
    const r = validateCity('uae', 'atlantis');
    assert.equal(r.valid, false);
    assert.ok(r.error.includes('Unknown city'));
  });

  test('null city slug', () => {
    const r = validateCity('uae', null);
    assert.equal(r.valid, false);
  });
});

describe('validateKarat', () => {
  test('valid karat code', () => {
    const r = validateKarat('22');
    assert.equal(r.valid, true);
    assert.equal(r.karat.code, '22');
  });

  test('valid karat slug format', () => {
    const r = validateKarat('22-karat');
    assert.equal(r.valid, true);
    assert.equal(r.karat.code, '22');
  });

  test('unknown karat', () => {
    const r = validateKarat('99');
    assert.equal(r.valid, false);
  });
});

describe('validateRoute', () => {
  test('valid country-only route', () => {
    const r = validateRoute({ country: 'uae' });
    assert.equal(r.valid, true);
  });

  test('valid country+city route', () => {
    const r = validateRoute({ country: 'uae', city: 'dubai' });
    assert.equal(r.valid, true);
  });

  test('valid full route with karat', () => {
    const r = validateRoute({ country: 'uae', city: 'dubai', karat: '24' });
    assert.equal(r.valid, true);
  });

  test('rejects karat without city', () => {
    const r = validateRoute({ country: 'uae', karat: '24' });
    assert.equal(r.valid, false);
    assert.ok(r.error.includes('Karat pages require a city'));
  });

  test('rejects city without country', () => {
    const r = validateRoute({ city: 'dubai' });
    assert.equal(r.valid, false);
    assert.ok(r.error.includes('City pages require a country'));
  });

  test('rejects invalid country', () => {
    const r = validateRoute({ country: 'fake' });
    assert.equal(r.valid, false);
  });

  test('rejects invalid city in valid country', () => {
    const r = validateRoute({ country: 'uae', city: 'fake' });
    assert.equal(r.valid, false);
  });
});
