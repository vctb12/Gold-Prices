// BASE_PATH: the root path under which the site is served.
// '/' for custom domain (goldtickerlive.com) or Replit; '/Gold-Prices/' for GitHub Pages sub-path.
// Must match vite.config.js `base` and the service worker scope.
export const BASE_PATH = '/';

export const CONSTANTS = {
  API_GOLD_URL: '/data/gold_price.json',
  API_FX_URL: 'https://open.er-api.com/v6/latest/USD',
  AED_PEG: 3.6725,
  TROY_OZ_GRAMS: 31.1035,
  GOLD_REFRESH_MS: 90000,
  GOLD_FETCH_TIMEOUT: 8000,
  FX_FETCH_TIMEOUT: 8000,
  HISTORY_DAYS: 90,
  CACHE_KEYS: {
    goldPrice: 'gold_price_cache',
    goldFallback: 'gold_price_fallback',
    fxRates: 'fx_rates_cache',
    fxFallback: 'fx_rates_fallback',
    dayOpen: 'gold_day_open',
    history: 'gold_price_history',
    userPrefs: 'user_prefs',
    alerts: 'gold_price_alerts',
  },
};

// ── Ad monetization config ──────────────────────────────────────────────────
// Fill in after Google AdSense approval. Leave empty to silently hide all ads.
export const AD_CONFIG = {
  ADSENSE_PUBLISHER_ID: '', // e.g. 'ca-pub-1234567890'
  AD_SLOTS: {
    homeLeaderboard: '', // 728x90 below hero
    homeRectangle: '', // 300x250 in tool cards sidebar
    trackerSidebar: '', // 300x250 sticky sidebar
    calculatorResult: '', // 300x250 below results
    countryBanner: '', // 728x90 above FAQ
    learnRectangle: '', // 300x250 after 3rd section
    toolBanner: '', // 728x90 bottom of tool pages
    guideMidContent: '', // 300x250 after 2nd section
  },
};

// ── Newsletter ──────────────────────────────────────────────────────────────
// Newsletter subscription endpoint. Uses the internal API by default.
// Set FORMSPREE_ENDPOINT to use Formspree as a fallback (legacy).
export const NEWSLETTER_API_ENDPOINT = '/api/v1/newsletter/subscribe';
export const FORMSPREE_ENDPOINT = ''; // legacy — leave empty to use NEWSLETTER_API_ENDPOINT
