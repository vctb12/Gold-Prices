/**
 * shops/filters.js - Extract filter logic from shops.js
 * Separates filter building and application logic
 */

import { countryByCode, regionName } from './helpers.js';

export function getShopsMatchingPrimaryFilters(SHOPS, STATE) {
  return SHOPS.filter((shop) => {
    const country = countryByCode(shop.countryCode);
    if (!country) return false;
    if (STATE.region !== 'all' && country.group !== STATE.region) return false;
    if (STATE.country !== 'all' && shop.countryCode !== STATE.country) return false;
    if (STATE.city !== 'all' && shop.city !== STATE.city) return false;
    return true;
  });
}

export function filterShops(SHOPS, STATE) {
  const q = STATE.search.trim().toLowerCase();
  const filtered = SHOPS.filter((shop) => {
    const country = countryByCode(shop.countryCode);
    if (!country) {
      console.warn('[shops] Shop missing country:', shop.id, shop.countryCode);
      return false;
    }

    if (STATE.region !== 'all' && country.group !== STATE.region) return false;
    if (STATE.country !== 'all' && shop.countryCode !== STATE.country) return false;
    if (STATE.city !== 'all' && shop.city !== STATE.city) return false;
    if (STATE.specialty !== 'all' && !(shop.specialties || []).includes(STATE.specialty))
      return false;
    if (STATE.verifiedOnly && !(shop.phone || shop.website)) return false;

    if (!q) return true;

    const haystack = [
      shop.name,
      shop.city,
      shop.market,
      shop.category,
      ...(shop.specialties || []),
      shop.notes,
      country.nameEn,
      country.nameAr,
      regionName(country.group, STATE.lang),
    ]
      .join(' ')
      .toLowerCase();

    return haystack.includes(q);
  });

  return filtered;
}
