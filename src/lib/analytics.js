/**
 * src/lib/analytics.js — Standardized analytics event catalog.
 *
 * Exports:
 *   EVENTS     — frozen object of snake_case event-name constants.
 *   track(name, params) — fire an event to GA4 and Supabase.
 *
 * Safety guarantees:
 *   - Respects navigator.doNotTrack and localStorage 'gp_no_analytics'.
 *   - Strips PII: email and phone fields are deleted; raw search text is
 *     replaced by its character length only.
 *   - page_view is sampled at PAGE_VIEW_SAMPLE_RATE to avoid volume noise.
 *   - Supabase write is best-effort / non-blocking (never throws).
 *   - No new runtime dependency; uses the existing Supabase anon key.
 */

import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config/supabase.js';

// ── Event name catalog ────────────────────────────────────────────────────────

/**
 * Canonical event names.  Import this object and use its properties instead
 * of bare strings so that a typo is a lint/build error, not a silent gap.
 */
export const EVENTS = Object.freeze({
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

// ── Configuration ─────────────────────────────────────────────────────────────

/**
 * Fraction of page_view events that are persisted to Supabase (0–1).
 * GA4 still receives every call; only the Supabase write is sampled.
 */
const PAGE_VIEW_SAMPLE_RATE = 0.5;

/** Per-event sample rates.  Unlisted events default to 1.0 (always persist). */
const SAMPLE_RATES = {
  [EVENTS.PAGE_VIEW]: PAGE_VIEW_SAMPLE_RATE,
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

  const safe = sanitize(params);

  // Always send to GA4 (GA4 has its own sampling controls).
  if (typeof window.gtag === 'function') {
    window.gtag('event', name, safe);
  }

  // Persist to Supabase with per-event sample rate.
  const rate = SAMPLE_RATES[name] ?? 1.0;
  if (rate >= 1 || Math.random() <= rate) {
    _persistToSupabase(name, safe);
  }
}
