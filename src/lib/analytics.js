/**
 * src/lib/analytics.js — Standardized analytics event catalog.
 *
 * Exports:
 *   EVENTS         — frozen object of snake_case event-name constants.
 *   EVENT_SCHEMA   — required payload fields by event.
 *   track(name, params) — fire an event to GA4 and Supabase with validation.
 *
 * Safety guarantees:
 *   - Respects navigator.doNotTrack and localStorage 'gp_no_analytics'.
 *   - Strips PII: email and phone fields are deleted; raw search text is
 *     replaced by its character length only.
 *   - Event payloads are validated against EVENT_SCHEMA (non-throwing).
 *   - price_view is sampled at PRICE_VIEW_SAMPLE_RATE to avoid volume noise.
 *   - Supabase write is best-effort / non-blocking (never throws).
 *   - Local/dev debug mode can log event validation + dispatch details.
 *   - No new runtime dependency; uses the existing Supabase anon key.
 */

import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config/supabase.js';

// ── Event name catalog ────────────────────────────────────────────────────────

/**
 * Canonical event names.  Import this object and use its properties instead
 * of bare strings so that a typo is a lint/build error, not a silent gap.
 */
export const EVENTS = Object.freeze({
  // Phase 8 canonical events
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
  // Existing catalog (kept for backward compatibility)
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

/**
 * Event governance schema (required payload keys).
 * - Keep this list stable and additive to preserve analytics dashboards.
 * - Optional keys are allowed; only `required` keys are validated.
 */
export const EVENT_SCHEMA = Object.freeze({
  [EVENTS.PRICE_VIEW]: { required: ['path', 'surface'] },
  [EVENTS.TRACKER_MODE_CHANGE]: { required: ['from_mode', 'to_mode'] },
  [EVENTS.ALERT_CREATE_START]: { required: ['surface', 'delivery', 'currency'] },
  [EVENTS.ALERT_CREATE_SUCCESS]: { required: ['surface', 'delivery', 'currency', 'direction'] },
  [EVENTS.CALCULATOR_SUBMIT]: { required: ['tool'] },
  [EVENTS.CALCULATOR_SHARE]: { required: ['tool', 'channel'] },
  [EVENTS.SHOP_FILTER_APPLY]: { required: ['listing_tab', 'region', 'country'] },
  [EVENTS.SHOP_CARD_OPEN]: { required: ['shop_id', 'listing_type', 'surface'] },
  [EVENTS.SHOP_WHATSAPP_CLICK]: { required: ['shop_id'] },
  [EVENTS.SHOP_CALL_CLICK]: { required: ['shop_id'] },
  [EVENTS.SHOP_CLAIM_START]: { required: ['shop_id', 'surface'] },
  [EVENTS.NEWSLETTER_SUBSCRIBE]: { required: ['source'] },
  [EVENTS.PRICING_PLAN_CLICK]: { required: ['tier', 'interval'] },
  [EVENTS.CHECKOUT_START]: { required: ['tier', 'interval'] },
  [EVENTS.CHECKOUT_SUCCESS]: { required: ['source'] },
  [EVENTS.API_KEY_CREATE]: { required: ['surface'] },
  [EVENTS.LANGUAGE_SWITCH]: { required: ['to'] },
  [EVENTS.COUNTRY_PAGE_VIEW]: { required: ['country_slug', 'currency'] },
  // Existing/backward compatible events
  [EVENTS.PAGE_VIEW]: { required: ['path', 'locale'] },
  [EVENTS.TRACKER_VIEW]: { required: ['karat', 'currency'] },
  [EVENTS.KARAT_CHANGE]: { required: ['from', 'to'] },
  [EVENTS.COUNTRY_CHANGE]: { required: ['from', 'to'] },
  [EVENTS.UNIT_CHANGE]: { required: ['from', 'to'] },
  [EVENTS.CURRENCY_CHANGE]: { required: ['from', 'to'] },
  [EVENTS.CALCULATOR_USE]: { required: ['karat', 'currency'] },
  [EVENTS.TOOL_USE]: { required: ['tool'] },
  [EVENTS.SHARE_CLICK]: { required: ['surface', 'channel'] },
  [EVENTS.COPY_CLICK]: { required: ['surface', 'value_type'] },
  [EVENTS.ALERT_SET]: { required: ['karat', 'threshold', 'direction', 'currency'] },
  [EVENTS.ALERT_CLEAR]: { required: ['karat'] },
  [EVENTS.SEARCH_QUERY]: { required: ['length'] },
  [EVENTS.SEARCH_OPEN]: { required: [] },
  [EVENTS.THEME_CHANGE]: { required: ['to'] },
  [EVENTS.OUTBOUND_CLICK]: { required: ['url_host'] },
  [EVENTS.ERROR]: { required: ['type', 'where'] },
});

/**
 * Legacy event aliases to canonical names.
 * Existing event emitters can stay stable while downstream reporting uses
 * the new Phase 8 event taxonomy.
 */
export const EVENT_ALIASES = Object.freeze({
  [EVENTS.LANG_CHANGE]: EVENTS.LANGUAGE_SWITCH,
});

// ── Configuration ─────────────────────────────────────────────────────────────

/**
 * Fraction of high-volume view events persisted to Supabase (0–1).
 * GA4 still receives every call; only the Supabase write is sampled.
 */
const PRICE_VIEW_SAMPLE_RATE = 0.5;

/** Per-event sample rates.  Unlisted events default to 1.0 (always persist). */
const SAMPLE_RATES = {
  [EVENTS.PRICE_VIEW]: PRICE_VIEW_SAMPLE_RATE,
  [EVENTS.PAGE_VIEW]: PRICE_VIEW_SAMPLE_RATE,
};

// ── Session ID ─────────────────────────────────────────────────────────────────

function _getSessionId() {
  try {
    let id = sessionStorage.getItem('gp_session_id');
    if (!id) {
      // Prefer the Web Crypto API (available in all modern browsers) for
      // generating the session token. Fall back to a timestamp-based
      // string when the API is absent (very old browsers/jsdom).
      if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        id = crypto.randomUUID();
      } else {
        // Fallback: timestamp + random hex — analytics use only, not security.
        id =
          Date.now().toString(36) +
          (crypto?.getRandomValues
            ? Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) =>
                b.toString(16).padStart(2, '0')
              ).join('')
            : Math.floor(Math.random() * 0xffffffff).toString(16));
      }
      sessionStorage.setItem('gp_session_id', id);
    }
    return id;
  } catch {
    return 'anon';
  }
}

// ── Opt-out guard ─────────────────────────────────────────────────────────────

function _isOptedOut() {
  try {
    if (navigator.doNotTrack === '1' || window.doNotTrack === '1') return true;
    if (localStorage.getItem('gp_no_analytics') === '1') return true;
  } catch {
    // localStorage unavailable in sandboxed contexts — allow tracking.
  }
  return false;
}

function _isDebugMode() {
  if (typeof window === 'undefined') return false;
  try {
    if (localStorage.getItem('gp_analytics_debug') === '1') return true;
  } catch {
    // ignore
  }
  try {
    const qp = new URLSearchParams(location.search);
    if (qp.get('analytics_debug') === '1') return true;
  } catch {
    // ignore
  }
  const host = location?.hostname || '';
  return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host.endsWith('.local');
}

// ── PII sanitizer ─────────────────────────────────────────────────────────────

/**
 * Returns a copy of params with PII stripped:
 *   - email and phone fields are removed.
 *   - A 'query' string is replaced by its character count under 'length'.
 *   - value_type strings are kept (they describe data shape, not user data).
 * @param {Record<string, unknown>} params
 * @returns {Record<string, unknown>}
 */
export function sanitize(params) {
  const safe = Object.assign({}, params);
  delete safe.email;
  delete safe.phone;
  if (typeof safe.query === 'string') {
    safe.length = safe.query.length;
    delete safe.query;
  }
  return safe;
}

/**
 * Validate required payload keys for an event.
 * @param {string} name
 * @param {Record<string, unknown>} params
 * @returns {{ valid: boolean, missing: string[], normalizedName: string, schemaExists: boolean }}
 */
export function validateEvent(name, params = {}) {
  const normalizedName = EVENT_ALIASES[name] || name;
  const schema = EVENT_SCHEMA[normalizedName] || EVENT_SCHEMA[name];
  if (!schema) return { valid: false, missing: [], normalizedName, schemaExists: false };
  const missing = (schema.required || []).filter((key) => {
    const value = params[key];
    if (value === undefined || value === null) return true;
    if (typeof value === 'string') return value.trim() === '';
    if (typeof value === 'number') return Number.isNaN(value);
    return false;
  });
  return { valid: missing.length === 0, missing, normalizedName, schemaExists: true };
}

export function getEventInventory() {
  return Object.entries(EVENT_SCHEMA)
    .map(([event, rule]) => ({ event, required: [...(rule.required || [])] }))
    .sort((a, b) => a.event.localeCompare(b.event));
}

// ── Supabase persistence ───────────────────────────────────────────────────────

/**
 * Best-effort, non-blocking POST to the analytics_events table.
 * Failures are silently swallowed — the table may not exist in all envs.
 * @param {string} name
 * @param {Record<string, unknown>} safeParams  Already-sanitized parameters.
 */
function _persistToSupabase(name, safeParams) {
  const url = `${SUPABASE_URL}/rest/v1/analytics_events`;
  const body = JSON.stringify({
    event: name,
    page: typeof location !== 'undefined' ? location.pathname : '',
    session_id: _getSessionId(),
    ts: Date.now(),
    properties: safeParams,
  });
  fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      Prefer: 'return=minimal',
    },
    body,
    keepalive: true,
  }).catch(() => {
    // Non-fatal; Supabase may be unreachable or the table may not exist yet.
  });
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Fire a tracked analytics event.
 *
 * GA4 receives every call that passes the opt-out check.
 * Supabase persistence is additionally subject to the per-event sample rate.
 *
 * @param {string} name  One of the EVENTS constants.
 * @param {Record<string, unknown>} [params]  Event-specific parameters — no PII.
 *
 * @example
 * import { track, EVENTS } from '../lib/analytics.js';
 * track(EVENTS.KARAT_CHANGE, { from: '22', to: '24' });
 */
export function track(name, params = {}) {
  if (typeof window === 'undefined') return; // Node / SSG guard
  if (_isOptedOut()) return;

  const validation = validateEvent(name, params);
  if (!validation.valid) {
    if (!validation.schemaExists) {
      console.warn('[analytics] skipped unregistered event', { name });
      return;
    }
    if (_isDebugMode()) {
      console.warn('[analytics] skipped invalid event', {
        name,
        normalizedName: validation.normalizedName,
        schemaExists: validation.schemaExists,
        missing: validation.missing,
      });
    }
    return;
  }

  const eventName = validation.normalizedName;
  const safe = sanitize(params);
  if (_isDebugMode()) {
    console.info('[analytics] track', { name: eventName, params: safe });
  }

  // Always send to GA4 (GA4 has its own sampling controls).
  if (typeof window.gtag === 'function') {
    window.gtag('event', eventName, safe);
  }

  // Persist to Supabase with per-event sample rate.
  const rate = SAMPLE_RATES[eventName] ?? 1.0;
  if (rate >= 1 || Math.random() <= rate) {
    _persistToSupabase(eventName, safe);
  }
}
