/**
 * assets/analytics.js — External analytics loader.
 *
 * Consolidates the Google Tag (GA4) loader + init and the Microsoft
 * Clarity loader into a single external script so that the site's
 * Content-Security-Policy can drop `'unsafe-inline'` from `script-src`.
 *
 * Loaded with `defer` from every public HTML page via the codemod at
 * `scripts/node/externalize-analytics.js`.
 */

(function () {
  'use strict';

  // Respect Do-Not-Track and local opt-out stored under 'gp_no_analytics'.
  try {
    if (navigator.doNotTrack === '1' || window.doNotTrack === '1') return;
    if (localStorage.getItem('gp_no_analytics') === '1') return;
  } catch (_e) {
    // localStorage may be unavailable in sandboxed contexts; continue.
  }

  // ── Google Analytics 4 (gtag.js) ─────────────────────────────────────────
  const GA_ID = 'G-K3GNY9M8TE';
  window.dataLayer = window.dataLayer || [];
  function gtag() {
    window.dataLayer.push(arguments);
  }
  window.gtag = window.gtag || gtag;
  gtag('js', new Date());
  gtag('config', GA_ID, { anonymize_ip: true });

  // Inject the gtag loader if it isn't already present.
  try {
    const gaSrc = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
    const exists = Array.prototype.some.call(document.getElementsByTagName('script'), function (s) {
      return s.src && s.src.indexOf('googletagmanager.com/gtag/js') !== -1;
    });
    if (!exists) {
      const s = document.createElement('script');
      s.async = true;
      s.src = gaSrc;
      document.head.appendChild(s);
    }
  } catch (_e) {
    // non-fatal
  }

  // ── Microsoft Clarity ────────────────────────────────────────────────────
  (function (c, l, a, r, i) {
    c[a] =
      c[a] ||
      function () {
        (c[a].q = c[a].q || []).push(arguments);
      };
    const t = l.createElement(r);
    t.async = 1;
    t.src = 'https://www.clarity.ms/tag/' + i;
    const y = l.getElementsByTagName(r)[0];
    if (y && y.parentNode) y.parentNode.insertBefore(t, y);
    else l.head.appendChild(t);
  })(window, document, 'clarity', 'script', 'w4e0nhdxt5');

  // ── Event name catalog (for non-module / inline scripts) ─────────────────
  // The canonical source of truth is src/lib/analytics.js (ES module).
  // This mirror on window.GP_EVENTS lets any inline or non-bundled script
  // reference event names without duplicating strings.
  window.GP_EVENTS = Object.freeze({
    PRICE_VIEW: 'price_view',
    TRACKER_MODE_CHANGE: 'tracker_mode_change',
    ALERT_CREATE_START: 'alert_create_start',
    ALERT_CREATE_SUCCESS: 'alert_create_success',
    CALCULATOR_SUBMIT: 'calculator_submit',
    CALCULATOR_SHARE: 'calculator_share',
    SHOP_FILTER_APPLY: 'shop_filter_apply',
    SHOP_CARD_OPEN: 'shop_card_open',
    SHOP_WHATSAPP_CLICK: 'shop_whatsapp_click',
    SHOP_CALL_CLICK: 'shop_call_click',
    SHOP_CLAIM_START: 'shop_claim_start',
    PRICING_PLAN_CLICK: 'pricing_plan_click',
    CHECKOUT_START: 'checkout_start',
    CHECKOUT_SUCCESS: 'checkout_success',
    API_KEY_CREATE: 'api_key_create',
    LANGUAGE_SWITCH: 'language_switch',
    COUNTRY_PAGE_VIEW: 'country_page_view',
    PAGE_VIEW: 'page_view',
    TRACKER_VIEW: 'tracker_view',
    KARAT_CHANGE: 'karat_change',
    COUNTRY_CHANGE: 'country_change',
    UNIT_CHANGE: 'unit_change',
    CURRENCY_CHANGE: 'currency_change',
    CALCULATOR_USE: 'calculator_use',
    TOOL_USE: 'tool_use',
    SHARE_CLICK: 'share_click',
    COPY_CLICK: 'copy_click',
    ALERT_SET: 'alert_set',
    ALERT_CLEAR: 'alert_clear',
    NEWSLETTER_SUBSCRIBE: 'newsletter_subscribe',
    SEARCH_QUERY: 'search_query',
    SEARCH_OPEN: 'search_open',
    THEME_CHANGE: 'theme_change',
    LANG_CHANGE: 'lang_change',
    OUTBOUND_CLICK: 'outbound_click',
    ERROR: 'error',
  });
})();
