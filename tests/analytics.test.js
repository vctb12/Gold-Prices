/**
 * Tests for src/lib/analytics.js
 *
 * The module is authored as ESM and imports from config/supabase.js.
 * We test the exported pure helpers (sanitize) and the track() function
 * using a minimal mock environment (no real DOM/window required for the
 * sanitize unit tests).
 */

'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

async function loadAnalytics() {
  const url = new URL('file://' + path.resolve(__dirname, '..', 'src', 'lib', 'analytics.js'));
  return import(url.href);
}

// ── EVENTS catalog ────────────────────────────────────────────────────────────

test('EVENTS object is frozen and contains all required event names', async () => {
  const { EVENTS } = await loadAnalytics();

  // Verify the object cannot be mutated
  assert.ok(Object.isFrozen(EVENTS), 'EVENTS must be frozen');

  // All required event names from the spec
  const required = [
    'PRICE_VIEW',
    'TRACKER_MODE_CHANGE',
    'ALERT_CREATE_START',
    'ALERT_CREATE_SUCCESS',
    'CALCULATOR_SUBMIT',
    'CALCULATOR_SHARE',
    'SHOP_FILTER_APPLY',
    'SHOP_CARD_OPEN',
    'SHOP_WHATSAPP_CLICK',
    'SHOP_CALL_CLICK',
    'SHOP_CLAIM_START',
    'PRICING_PLAN_CLICK',
    'CHECKOUT_START',
    'CHECKOUT_SUCCESS',
    'API_KEY_CREATE',
    'LANGUAGE_SWITCH',
    'COUNTRY_PAGE_VIEW',
    'PAGE_VIEW',
    'TRACKER_VIEW',
    'KARAT_CHANGE',
    'COUNTRY_CHANGE',
    'UNIT_CHANGE',
    'CURRENCY_CHANGE',
    'CALCULATOR_USE',
    'TOOL_USE',
    'SHARE_CLICK',
    'COPY_CLICK',
    'ALERT_SET',
    'ALERT_CLEAR',
    'NEWSLETTER_SUBSCRIBE',
    'SEARCH_QUERY',
    'SEARCH_OPEN',
    'THEME_CHANGE',
    'LANG_CHANGE',
    'OUTBOUND_CLICK',
    'ERROR',
  ];

  for (const key of required) {
    assert.ok(key in EVENTS, `EVENTS.${key} should exist`);
    assert.equal(typeof EVENTS[key], 'string', `EVENTS.${key} should be a string`);
  }
});

test('EVENTS values are snake_case strings', async () => {
  const { EVENTS } = await loadAnalytics();
  const snakeCase = /^[a-z][a-z0-9_]*$/;
  for (const [key, value] of Object.entries(EVENTS)) {
    assert.match(value, snakeCase, `EVENTS.${key} value "${value}" must be snake_case`);
  }
});

test('EVENTS values are unique (no duplicate event names)', async () => {
  const { EVENTS } = await loadAnalytics();
  const values = Object.values(EVENTS);
  const unique = new Set(values);
  assert.equal(unique.size, values.length, 'All EVENTS values must be unique');
});

// ── PII sanitizer ─────────────────────────────────────────────────────────────

describe('sanitize()', () => {
  test('removes email field', async () => {
    const { sanitize } = await loadAnalytics();
    const out = sanitize({ email: 'user@example.com', karat: '24' });
    assert.ok(!('email' in out), 'email must be stripped');
    assert.equal(out.karat, '24');
  });

  test('removes phone field', async () => {
    const { sanitize } = await loadAnalytics();
    const out = sanitize({ phone: '+971501234567', currency: 'AED' });
    assert.ok(!('phone' in out), 'phone must be stripped');
    assert.equal(out.currency, 'AED');
  });

  test('replaces query string with its character length', async () => {
    const { sanitize } = await loadAnalytics();
    const out = sanitize({ query: 'United Arab Emirates', locale: 'en' });
    assert.ok(!('query' in out), 'raw query must be removed');
    assert.equal(out.length, 'United Arab Emirates'.length, 'length should match query char count');
    assert.equal(out.locale, 'en');
  });

  test('sets length: 0 for empty query string', async () => {
    const { sanitize } = await loadAnalytics();
    const out = sanitize({ query: '' });
    assert.ok(!('query' in out));
    assert.equal(out.length, 0);
  });

  test('leaves non-PII fields unchanged', async () => {
    const { sanitize } = await loadAnalytics();
    const params = { karat: '22', currency: 'AED', surface: 'tracker' };
    const out = sanitize(params);
    assert.deepEqual(out, params);
  });

  test('does not mutate the original params object', async () => {
    const { sanitize } = await loadAnalytics();
    const original = { email: 'x@y.com', karat: '18' };
    const copy = { ...original };
    sanitize(original);
    assert.deepEqual(original, copy, 'sanitize must not mutate input');
  });
});

// ── track() — opt-out guard ───────────────────────────────────────────────────

test('track() is a no-op when window is undefined (SSG/Node guard)', async () => {
  const { track, EVENTS } = await loadAnalytics();
  // In Node, window is undefined — track() must not throw
  assert.doesNotThrow(() => track(EVENTS.PAGE_VIEW, { path: '/test', locale: 'en' }));
});

test('track() does not throw when payload is invalid (validation guard)', async () => {
  const { track, EVENTS } = await loadAnalytics();
  assert.doesNotThrow(() => track(EVENTS.CHECKOUT_START, { tier: 'pro' }));
});

test('track() skips dispatch for invalid payloads', async () => {
  const { track, EVENTS } = await loadAnalytics();
  const gtagCalls = [];
  const prevWindow = global.window;
  const prevLocation = global.location;
  const prevNavigator = global.navigator;
  const prevLocalStorage = global.localStorage;

  try {
    global.location = { search: '', hostname: 'localhost', pathname: '/pricing.html' };
    global.navigator = { doNotTrack: '0' };
    global.localStorage = { getItem: () => null };
    global.window = {
      doNotTrack: '0',
      gtag: (...args) => gtagCalls.push(args),
    };

    assert.doesNotThrow(() => track(EVENTS.CHECKOUT_START, { tier: 'pro' }));
    assert.equal(gtagCalls.length, 0, 'invalid payload should not be sent to gtag');
  } finally {
    global.window = prevWindow;
    global.location = prevLocation;
    global.navigator = prevNavigator;
    global.localStorage = prevLocalStorage;
  }
});

// ── Event name symmetry with window.GP_EVENTS ──────────────────────────────--

test('EVENTS keys match the GP_EVENTS constant names expected in assets/analytics.js', async () => {
  const { EVENTS } = await loadAnalytics();

  // These are the keys exposed as window.GP_EVENTS in assets/analytics.js.
  // If EVENTS grows, assets/analytics.js must be updated too.
  const WINDOW_GP_EVENTS_KEYS = [
    'PRICE_VIEW',
    'TRACKER_MODE_CHANGE',
    'COMPARE_ACTION',
    'EXPORT_CLICK',
    'ALERT_CREATE_START',
    'ALERT_CREATE_SUCCESS',
    'CALCULATOR_SUBMIT',
    'CALCULATOR_SHARE',
    'SHOP_FILTER_APPLY',
    'SHOP_CARD_OPEN',
    'SHOP_WHATSAPP_CLICK',
    'SHOP_CALL_CLICK',
    'SHOP_CLAIM_START',
    'PRICING_PLAN_CLICK',
    'CHECKOUT_START',
    'CHECKOUT_SUCCESS',
    'API_KEY_CREATE',
    'LANGUAGE_SWITCH',
    'COUNTRY_PAGE_VIEW',
    'PAGE_VIEW',
    'TRACKER_VIEW',
    'KARAT_CHANGE',
    'COUNTRY_CHANGE',
    'UNIT_CHANGE',
    'CURRENCY_CHANGE',
    'CALCULATOR_USE',
    'TOOL_USE',
    'SHARE_CLICK',
    'COPY_CLICK',
    'ALERT_SET',
    'ALERT_CLEAR',
    'NEWSLETTER_SUBSCRIBE',
    'SEARCH_QUERY',
    'SEARCH_OPEN',
    'THEME_CHANGE',
    'LANG_CHANGE',
    'OUTBOUND_CLICK',
    'ERROR',
  ];

  for (const key of WINDOW_GP_EVENTS_KEYS) {
    assert.ok(key in EVENTS, `EVENTS.${key} must exist to match window.GP_EVENTS`);
  }

  // Verify the values in EVENTS also match what's in assets/analytics.js
  const ASSETS_VALUES = {
    PRICE_VIEW: 'price_view',
    TRACKER_MODE_CHANGE: 'tracker_mode_change',
    COMPARE_ACTION: 'compare_action',
    EXPORT_CLICK: 'export_click',
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
  };

  for (const [key, val] of Object.entries(ASSETS_VALUES)) {
    assert.equal(EVENTS[key], val, `EVENTS.${key} must equal '${val}'`);
  }
});

test('EVENT_SCHEMA includes required field definitions for canonical funnel events', async () => {
  const { EVENT_SCHEMA, EVENTS } = await loadAnalytics();
  assert.ok(EVENT_SCHEMA[EVENTS.PRICE_VIEW]);
  assert.deepEqual(EVENT_SCHEMA[EVENTS.CHECKOUT_START].required, ['tier', 'interval']);
  assert.deepEqual(EVENT_SCHEMA[EVENTS.CHECKOUT_SUCCESS].required, ['source']);
  assert.deepEqual(EVENT_SCHEMA[EVENTS.COUNTRY_PAGE_VIEW].required, ['country_slug', 'currency']);
});

test('validateEvent() normalizes aliases and detects missing required fields', async () => {
  const { validateEvent, EVENTS } = await loadAnalytics();
  const ok = validateEvent(EVENTS.LANG_CHANGE, { to: 'ar' });
  assert.equal(ok.valid, true);
  assert.equal(ok.normalizedName, EVENTS.LANGUAGE_SWITCH);

  const bad = validateEvent(EVENTS.CHECKOUT_START, { tier: 'pro' });
  assert.equal(bad.valid, false);
  assert.deepEqual(bad.missing, ['interval']);
});
