/**
 * Build shops directory href with optional country filter (Calculator → Shops handoff).
 * @param {{ countryCode?: string, lang?: 'en'|'ar' }} [options]
 * @returns {string}
 */
export function buildShopsHandoffHref({ countryCode = '', lang = 'en' } = {}) {
  const params = new URLSearchParams();
  const code = String(countryCode || '').trim().toUpperCase();
  if (code) params.set('country', code);
  if (lang === 'ar') params.set('lang', 'ar');
  const qs = params.toString();
  return qs ? `shops.html?${qs}` : 'shops.html';
}
