/**
 * Shared href builders for flagship cross-page flows (home ↔ tracker ↔ calculator ↔ shops).
 * Pure functions — unit-tested; keep pricing/hash contracts documented in docs/tracker-state.md.
 */

const TRACKER_KARATS = new Set(['24', '22', '21', '20', '18', '16', '14']);
const TRACKER_UNITS = new Set(['gram', 'tola', 'oz']);
const TRACKER_MODES = new Set(['live', 'compare', 'archive', 'method', 'exports']);
/**
 * @param {string} currency
 * @param {Array<{ currency: string, code?: string }>} countries
 * @returns {{ code?: string, currency: string } | null}
 */
export function countryForCurrency(currency, countries = []) {
  if (!currency || !Array.isArray(countries)) return null;
  return countries.find((country) => country.currency === currency) ?? null;
}

/**
 * @param {{ countryCode?: string }} [options]
 * @returns {string}
 */
export function buildShopsHref({ countryCode } = {}) {
  if (!countryCode) return 'shops.html';
  return `shops.html?country=${encodeURIComponent(countryCode)}`;
}

/**
 * Tracker hash contract: mode, cur, k, u, lang (+ optional r for range).
 * @see docs/tracker-state.md
 */
export function buildTrackerHashHref({
  mode = 'live',
  cur = 'AED',
  k = '24',
  u = 'gram',
  lang = 'en',
  range,
} = {}) {
  const safeMode = TRACKER_MODES.has(String(mode)) ? String(mode) : 'live';
  const safeK = TRACKER_KARATS.has(String(k)) ? String(k) : '24';
  const safeU = TRACKER_UNITS.has(String(u)) ? String(u) : 'gram';
  const params = new URLSearchParams({
    mode: safeMode,
    cur: String(cur || 'AED'),
    k: safeK,
    u: safeU,
    lang: String(lang || 'en'),
  });
  if (range) params.set('r', String(range));
  return `tracker.html#${params.toString()}`;
}

/**
 * @param {string} [homeTrackerKarat]
 * @param {'gram'|'tola'|'oz'} [unit]
 * @param {string} [lang]
 */
export function buildHomeTrackerHref(homeTrackerKarat = '24', unit = 'gram', lang = 'en') {
  const safeUnit = TRACKER_UNITS.has(unit) ? unit : 'gram';
  const safeK = TRACKER_KARATS.has(String(homeTrackerKarat)) ? String(homeTrackerKarat) : '24';
  return buildTrackerHashHref({ mode: 'live', cur: 'AED', k: safeK, u: safeUnit, lang });
}
