/**
 * routes/routeRegistry.js
 * Defines all valid route patterns for the Gold Ticker Live platform.
 * Used by the page generator, breadcrumb, and internal links components.
 */
import { COUNTRIES } from '../config/countries.js';
import { KARATS } from '../config/karats.js';

export const ROUTE_TYPES = {
  COUNTRY_LANDING: 'country-landing',
  CITY_PRICES: 'city-prices',
  CITY_SHOPS: 'city-shops',
  CITY_KARAT: 'city-karat',
  HOME: 'home',
  CALCULATOR: 'calculator',
  HISTORY: 'history',
  ORDER: 'order',
  TRACKER: 'tracker',
  SHOPS: 'shops',
};

export const ROUTE_PATTERNS = [
  { pattern: '/:country/gold-price', type: ROUTE_TYPES.COUNTRY_LANDING },
  { pattern: '/:country/:city/gold-rate', type: ROUTE_TYPES.CITY_PRICES },
  { pattern: '/:country/:city/gold-prices', type: ROUTE_TYPES.CITY_PRICES },
  { pattern: '/:country/:city/gold-shops', type: ROUTE_TYPES.CITY_SHOPS },
  { pattern: '/:country/:city/gold-rate/:karat', type: ROUTE_TYPES.CITY_KARAT },
];

/**
 * Get all valid country slugs.
 */
export function getCountrySlugs() {
  return COUNTRIES.filter((c) => c.slug).map((c) => c.slug);
}

/**
 * Get all valid city slugs for a country.
 * @param {string} countrySlug
 */
export function getCitySlugs(countrySlug) {
  const country = COUNTRIES.find((c) => c.slug === countrySlug);
  return (country?.cities || []).map((city) => city.slug);
}

/**
 * Get all valid karat slugs (e.g. '24-karat', '22-karat').
 */
export function getKaratSlugs() {
  return KARATS.map((k) => `${k.code}-karat`);
}

/**
 * Resolve a URL path to route metadata.
 * @param {string} path  e.g. '/uae/dubai/gold-rate'
 * @returns {{ type, country, city, karat, countryObj, cityObj } | null}
 */
export function resolveRoute(path) {
  // Strip leading/trailing slashes
  const clean = path.replace(/^\/+|\/+$/g, '');
  const parts = clean.split('/');

  // /:country/gold-price
  if (parts.length === 2 && parts[1] === 'gold-price') {
    const countryObj = COUNTRIES.find((c) => c.slug === parts[0]);
    if (!countryObj) return null;
    return { type: ROUTE_TYPES.COUNTRY_LANDING, country: parts[0], countryObj };
  }

  // /:country/:city/gold-rate | gold-prices (legacy alias, 301 → gold-rate)
  if (parts.length === 3 && (parts[2] === 'gold-rate' || parts[2] === 'gold-prices')) {
    const countryObj = COUNTRIES.find((c) => c.slug === parts[0]);
    if (!countryObj) return null;
    const cityObj = (countryObj.cities || []).find((ci) => ci.slug === parts[1]);
    if (!cityObj) return null;
    return {
      type: ROUTE_TYPES.CITY_PRICES,
      country: parts[0],
      city: parts[1],
      countryObj,
      cityObj,
    };
  }

  // /:country/:city/gold-shops
  if (parts.length === 3 && parts[2] === 'gold-shops') {
    const countryObj = COUNTRIES.find((c) => c.slug === parts[0]);
    if (!countryObj) return null;
    const cityObj = (countryObj.cities || []).find((ci) => ci.slug === parts[1]);
    if (!cityObj) return null;
    return { type: ROUTE_TYPES.CITY_SHOPS, country: parts[0], city: parts[1], countryObj, cityObj };
  }

  // /:country/:city/gold-rate/:karat
  if (parts.length === 4 && parts[2] === 'gold-rate') {
    const countryObj = COUNTRIES.find((c) => c.slug === parts[0]);
    if (!countryObj) return null;
    const cityObj = (countryObj.cities || []).find((ci) => ci.slug === parts[1]);
    if (!cityObj) return null;
    const karatSlug = parts[3]; // e.g. '22-karat'
    const karatCode = karatSlug.replace('-karat', '');
    const karatObj = KARATS.find((k) => k.code === karatCode);
    if (!karatObj) return null;
    return {
      type: ROUTE_TYPES.CITY_KARAT,
      country: parts[0],
      city: parts[1],
      karat: karatSlug,
      karatCode,
      countryObj,
      cityObj,
      karatObj,
    };
  }

  return null;
}
