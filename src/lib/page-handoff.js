/**
 * Canonical cross-page handoff URLs (homepage ↔ tracker ↔ calculator ↔ shops).
 * Keeps hash/query shapes consistent across surfaces.
 */

const ALLOWED_TRACKER_MODE = new Set(['live', 'compare', 'archive', 'exports', 'method']);
const ALLOWED_K = new Set(['24', '22', '21', '20', '18', '16', '14']);
const ALLOWED_U = new Set(['gram', 'tola', 'oz', 'kg']);
const ALLOWED_LANG = new Set(['en', 'ar']);

/**
 * @param {object} [options]
 * @param {string} [options.mode]
 * @param {string} [options.cur]
 * @param {string} [options.k]
 * @param {string} [options.u]
 * @param {string} [options.lang]
 * @param {string} [options.r]
 * @param {string} [options.panel]
 * @param {string} [options.base]
 */
export function buildTrackerHandoffUrl({
  mode = 'live',
  cur = 'AED',
  k = '24',
  u = 'gram',
  lang = 'en',
  r,
  panel,
  base = 'tracker.html',
} = {}) {
  const params = new URLSearchParams();
  params.set('mode', ALLOWED_TRACKER_MODE.has(String(mode)) ? String(mode) : 'live');
  params.set('cur', String(cur));
  if (ALLOWED_K.has(String(k))) params.set('k', String(k));
  if (ALLOWED_U.has(String(u))) params.set('u', String(u));
  if (ALLOWED_LANG.has(String(lang))) params.set('lang', String(lang));
  if (r) params.set('r', String(r));
  if (panel) params.set('panel', String(panel));
  return `${base}#${params.toString()}`;
}

/**
 * @param {object} [options]
 * @param {string} [options.countryCode] ISO country code (e.g. AE)
 * @param {string} [options.lang]
 * @param {string} [options.base]
 */
export function buildShopsHandoffUrl({ countryCode, lang, base = 'shops.html' } = {}) {
  const params = new URLSearchParams();
  if (countryCode) params.set('country', String(countryCode).toUpperCase());
  if (lang === 'ar' || lang === 'en') params.set('lang', lang);
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

/** Homepage anchors that should inherit the default live-tracker handoff (unit + lang). */
export const HOME_DEFAULT_TRACKER_LINK_IDS = [
  'hero-cta-tracker',
  'hlc-tracker-link',
  'karat-strip-cta',
  'home-action-track',
  'markets-see-tracker',
  'gcc-see-all',
  'home-tool-tracker',
];

/**
 * Apply a tracker handoff href to a list of element ids (missing nodes are skipped).
 * @param {string} href
 * @param {string[]} ids
 */
export function applyTrackerHandoffToIds(href, ids = HOME_DEFAULT_TRACKER_LINK_IDS) {
  for (const id of ids) {
    const node = document.getElementById(id);
    if (node) node.setAttribute('href', href);
  }
}

/**
 * Parse karat code from a karat-strip item element id (`kstrip-22` → `22`).
 * @param {HTMLElement} item
 * @returns {string|null}
 */
export function karatFromKstripItem(item) {
  const match = /^kstrip-(\d{1,2})$/.exec(item?.id || '');
  return match ? match[1] : null;
}
