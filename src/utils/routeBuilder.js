/**
 * utils/routeBuilder.js
 * Single source of truth for URL generation.
 * All internal links and canonical tags should use these functions
 * instead of hardcoded path strings.
 */
import { COUNTRIES } from '../config/countries.js';
import { KARATS } from '../config/karats.js';
import { BASE_PATH } from '../config/constants.js';

/**
 * Build a URL path for any page type.
 * @param {Object} params
 * @param {string} [params.country]  Country slug (e.g. 'uae')
 * @param {string} [params.city]     City slug (e.g. 'dubai')
 * @param {string} [params.karat]    Karat code (e.g. '22')
 * @param {string} [params.page]     Page type override for static pages
 * @returns {string} Absolute path (no trailing slash, no host)
 */
export function buildRoute({ country, city, karat, page } = {}) {
  // Static pages
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

  // Country-level gold price page
  if (country && !city && !karat) {
    return `${BASE_PATH}${country}/gold-price`;
  }

  // City gold-rate hub (all karats on one page)
  if (country && city) {
    return `${BASE_PATH}${country}/${city}/gold-rate`;
  }

  return null;
}

/**
 * Build a shops page URL.
 * @param {string} country  Country slug
 * @param {string} city     City slug
 * @returns {string}
 */
export function buildShopsRoute(country, city) {
  return `${BASE_PATH}${country}/${city}/gold-shops`;
}

/**
 * Build a canonical URL (full absolute URL with domain).
 * @param {string} path  Path from buildRoute
 * @param {string} [domain]  Domain override
 * @returns {string}
 */
export function buildCanonicalURL(path, domain = 'https://goldtickerlive.com') {
  if (!path) return null;
  // Avoid double base path
  const fullPath = path.startsWith(BASE_PATH) ? path : `${BASE_PATH}${path}`;
  return `${domain}${fullPath}`;
}

/**
 * Generate all valid routes for the site (used by sitemap generator).
 * @returns {Array<{path: string, type: string, priority: number}>}
 */
export function generateAllRoutes() {
  const routes = [];

  // Homepage
  routes.push({ path: buildRoute({ page: 'home' }), type: 'home', priority: 1.0 });

  // Static pages
  const staticPages = [
    { page: 'calculator', priority: 0.75 },
    { page: 'tracker', priority: 0.95 },
    { page: 'shops', priority: 0.85 },
    { page: 'order', priority: 0.7 },
    { page: 'history', priority: 0.7 },
    { page: 'search', priority: 0.5 },
    { page: 'xpost', priority: 0.5 },
    { page: 'learn', priority: 0.65 },
    { page: 'insights', priority: 0.75 },
    { page: 'invest', priority: 0.65 },
    { page: 'methodology', priority: 0.5 },
    { page: 'terms', priority: 0.3 },
    { page: 'privacy', priority: 0.3 },
  ];
  for (const sp of staticPages) {
    routes.push({ path: buildRoute({ page: sp.page }), type: sp.page, priority: sp.priority });
  }

  // Country and city pages
  for (const country of COUNTRIES) {
    if (!country.slug || !country.cities) continue;

    // Country landing
    routes.push({
      path: buildRoute({ country: country.slug }),
      type: 'country',
      priority: 0.9,
    });

    // City pages
    for (const city of country.cities) {
      // City gold prices
      routes.push({
        path: buildRoute({ country: country.slug, city: city.slug }),
        type: 'city-prices',
        priority: 0.8,
      });

      // City gold shops
      routes.push({
        path: buildShopsRoute(country.slug, city.slug),
        type: 'city-shops',
        priority: 0.7,
      });

      // Karat-specific pages
      for (const karat of KARATS) {
        routes.push({
          path: buildRoute({ country: country.slug, city: city.slug, karat: karat.code }),
          type: 'city-karat',
          priority: 0.6,
        });
      }
    }
  }

  return routes;
}
