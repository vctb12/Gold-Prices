'use strict';

const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

function createLocalStorageMock(initial = {}) {
  const store = new Map(Object.entries(initial));
  const localStorageMock = {};
  function syncEnumerableKeys() {
    for (const key of Object.keys(localStorageMock)) {
      if (!['getItem', 'setItem', 'removeItem', 'clear', 'key', 'length'].includes(key)) {
        delete localStorageMock[key];
      }
    }
    for (const [key, value] of store.entries()) {
      localStorageMock[key] = value;
    }
  }
  syncEnumerableKeys();

  localStorageMock.getItem = (key) => (store.has(key) ? store.get(key) : null);
  localStorageMock.setItem = (key, value) => {
    store.set(key, String(value));
    syncEnumerableKeys();
  };
  localStorageMock.removeItem = (key) => {
    store.delete(key);
    syncEnumerableKeys();
  };
  localStorageMock.clear = () => {
    store.clear();
    syncEnumerableKeys();
  };
  localStorageMock.key = (index) => Array.from(store.keys())[index] || null;
  Object.defineProperty(localStorageMock, 'length', {
    get() {
      return store.size;
    },
  });

  return localStorageMock;
}

beforeEach(() => {
  delete global.fetch;
  delete global.localStorage;
  delete global.window;
});

afterEach(() => {
  delete global.fetch;
  delete global.localStorage;
  delete global.window;
});

test('buildLocalStorageImportPreview reads legacy keys', async () => {
  global.localStorage = createLocalStorageMock({
    user_prefs: JSON.stringify({ lang: 'ar', selectedKarat: '22', unit: 'gram' }),
    gold_price_alerts: JSON.stringify([{ direction: 'above', target: 2300, scope: 'spot' }]),
    tracker_pro_favorites_v5: JSON.stringify(['AED', 'USD']),
    shops_shortlist: JSON.stringify(['dubai-gold-souk']),
    gold_saved_calculations_local_v1: JSON.stringify([{ tool: 'value', label: 'sample' }]),
  });

  const mod = await import('../src/lib/public-account-client.js');
  const preview = mod.buildLocalStorageImportPreview();

  assert.equal(preview.preferences.lang, 'ar');
  assert.equal(preview.preferences.karat, '22');
  assert.equal(preview.watchlistCurrencies.length, 2);
  assert.equal(preview.alerts.length, 1);
  assert.equal(preview.shortlistShopIds.length, 1);
  assert.equal(preview.localCalculations.length, 1);
});

test('buildLocalStorageImportPreview handles invalid storage payloads', async () => {
  global.localStorage = createLocalStorageMock({
    user_prefs: 'not-json',
    gold_price_alerts: 'bad',
    tracker_pro_favorites_v5: '{}',
    shops_shortlist: 'null',
    gold_saved_calculations_local_v1: '"abc"',
  });

  const mod = await import('../src/lib/public-account-client.js');
  const preview = mod.buildLocalStorageImportPreview();

  assert.equal(preview.preferences, null);
  assert.deepEqual(preview.alerts, []);
  assert.deepEqual(preview.watchlistCurrencies, []);
  assert.deepEqual(preview.shortlistShopIds, []);
  assert.deepEqual(preview.localCalculations, []);
});

test('buildLocalStorageImportPreview maps selectedKaratSpotlight fallback', async () => {
  global.localStorage = createLocalStorageMock({
    user_prefs: JSON.stringify({ selectedKaratSpotlight: '21', currency: 'AED' }),
  });

  const mod = await import('../src/lib/public-account-client.js');
  const preview = mod.buildLocalStorageImportPreview();

  assert.equal(preview.preferences.karat, '21');
  assert.equal(preview.preferences.currency, 'AED');
});

test('getAccessToken resolves from supabase token key variants', async () => {
  global.localStorage = createLocalStorageMock({
    'sb-test-auth-token': JSON.stringify({ currentSession: { access_token: 'token-current' } }),
  });
  const mod = await import('../src/lib/public-account-client.js');
  assert.equal(mod.getAccessToken(), 'token-current');

  global.localStorage = createLocalStorageMock({
    'sb-test-auth-token': JSON.stringify({ session: { access_token: 'token-session' } }),
  });
  assert.equal(mod.getAccessToken(), 'token-session');

  global.localStorage = createLocalStorageMock({
    'sb-test-auth-token': JSON.stringify({ access_token: 'token-root' }),
  });
  assert.equal(mod.getAccessToken(), 'token-root');
  assert.equal(mod.isAuthenticated(), true);
});

test('redirectToAccount includes encoded next URL', async () => {
  global.window = { location: { href: 'https://goldtickerlive.com/tracker.html?x=1' } };
  const mod = await import('../src/lib/public-account-client.js');

  mod.redirectToAccount();
  assert.equal(
    global.window.location.href,
    '/account.html?next=https%3A%2F%2Fgoldtickerlive.com%2Ftracker.html%3Fx%3D1'
  );

  mod.redirectToAccount('/calculator.html?unit=gram');
  assert.equal(global.window.location.href, '/account.html?next=%2Fcalculator.html%3Funit%3Dgram');
});

test('getMe sends bearer auth and returns data payload', async () => {
  const calls = [];
  global.localStorage = createLocalStorageMock({
    'sb-test-auth-token': JSON.stringify({ access_token: 'abc123' }),
  });
  global.fetch = async (url, options) => {
    calls.push({ url, options });
    return { ok: true, json: async () => ({ data: { id: 'user-1' } }) };
  };

  const mod = await import('../src/lib/public-account-client.js');
  const me = await mod.getMe();

  assert.deepEqual(me, { id: 'user-1' });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, '/api/v1/me');
  assert.equal(calls[0].options.method, 'GET');
  assert.equal(calls[0].options.headers.Authorization, 'Bearer abc123');
});

test('updatePreferences sends PATCH JSON body', async () => {
  const calls = [];
  global.localStorage = createLocalStorageMock({
    'sb-test-auth-token': JSON.stringify({ access_token: 'token-1' }),
  });
  global.fetch = async (url, options) => {
    calls.push({ url, options });
    return { ok: true, json: async () => ({ data: { ok: true } }) };
  };

  const mod = await import('../src/lib/public-account-client.js');
  await mod.updatePreferences({ lang: 'ar', currency: 'AED' });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, '/api/v1/me/preferences');
  assert.equal(calls[0].options.method, 'PATCH');
  assert.equal(calls[0].options.body, JSON.stringify({ lang: 'ar', currency: 'AED' }));
});

test('API errors expose server code and message', async () => {
  global.localStorage = createLocalStorageMock({
    'sb-test-auth-token': JSON.stringify({ access_token: 'token-err' }),
  });
  global.fetch = async () => ({
    ok: false,
    status: 409,
    json: async () => ({ error: { code: 'CONFLICT', message: 'Already exists' } }),
  });

  const mod = await import('../src/lib/public-account-client.js');
  await assert.rejects(
    () => mod.createSavedShop({ shop_id: 'x' }),
    (error) => {
      assert.equal(error.code, 'CONFLICT');
      assert.equal(error.status, 409);
      assert.equal(error.message, 'Already exists');
      return true;
    }
  );
});

test('API errors fall back to status message when JSON parsing fails', async () => {
  global.localStorage = createLocalStorageMock({
    'sb-test-auth-token': JSON.stringify({ access_token: 'token-err-2' }),
  });
  global.fetch = async () => ({
    ok: false,
    status: 503,
    json: async () => {
      throw new Error('bad json');
    },
  });

  const mod = await import('../src/lib/public-account-client.js');
  await assert.rejects(
    () => mod.getPreferences(),
    (error) => {
      assert.equal(error.code, 'API_ERROR');
      assert.equal(error.status, 503);
      assert.equal(error.message, 'Request failed (503)');
      return true;
    }
  );
});

test('importLocalStorageData imports normalized records and counts results', async () => {
  const calls = [];
  global.localStorage = createLocalStorageMock({
    'sb-test-auth-token': JSON.stringify({ access_token: 'token-import' }),
    user_prefs: JSON.stringify({ lang: 'ar', selectedKarat: '22', unit: 'gram' }),
    gold_price_alerts: JSON.stringify([
      { direction: 'above', target: 2350, scope: 'spot' },
      { direction: null, target: null, scope: null },
    ]),
    tracker_pro_favorites_v5: JSON.stringify([' usd ', '']),
    shops_shortlist: JSON.stringify([' dubai-gold-souk ', '']),
    gold_saved_calculations_local_v1: JSON.stringify([
      { tool: 'value', label: 'value calc', input_data: { grams: 2 }, output_data: { aed: 500 } },
      { label: 'missing tool' },
    ]),
  });
  global.fetch = async (url, options) => {
    calls.push({ url, options });
    return { ok: true, json: async () => ({ data: { ok: true } }) };
  };

  const mod = await import('../src/lib/public-account-client.js');
  const result = await mod.importLocalStorageData();

  assert.deepEqual(result, {
    preferences: true,
    watchlist: 1,
    savedShops: 1,
    savedCalculations: 1,
    alerts: 1,
    failed: 0,
  });

  const watchlistCall = calls.find((call) => call.url === '/api/v1/me/watchlist');
  const watchlistPayload = JSON.parse(watchlistCall.options.body);
  assert.equal(watchlistPayload.item_key, 'USD');

  const savedShopsCall = calls.find((call) => call.url === '/api/v1/me/saved-shops');
  const savedShopPayload = JSON.parse(savedShopsCall.options.body);
  assert.equal(savedShopPayload.shop_id, 'dubai-gold-souk');
});

test('importLocalStorageData tracks failed writes without throwing', async () => {
  let watchlistFailed = false;
  global.localStorage = createLocalStorageMock({
    'sb-test-auth-token': JSON.stringify({ access_token: 'token-import-fail' }),
    user_prefs: JSON.stringify({ lang: 'en' }),
    tracker_pro_favorites_v5: JSON.stringify(['AED']),
  });
  global.fetch = async (url) => {
    if (url === '/api/v1/me/watchlist' && !watchlistFailed) {
      watchlistFailed = true;
      return {
        ok: false,
        status: 500,
        json: async () => ({ error: { code: 'SAVE_FAILED', message: 'save failed' } }),
      };
    }
    return { ok: true, json: async () => ({ data: { ok: true } }) };
  };

  const mod = await import('../src/lib/public-account-client.js');
  const result = await mod.importLocalStorageData();

  assert.equal(result.preferences, true);
  assert.equal(result.watchlist, 0);
  assert.equal(result.failed, 1);
});

test('buildSupabaseBrowserClient requires browser supabase client', async () => {
  const mod = await import('../src/lib/public-account-client.js');
  assert.equal(mod.buildSupabaseBrowserClient(), null);

  global.window = { supabase: {} };
  assert.throws(
    () => mod.buildSupabaseBrowserClient(),
    (error) => {
      assert.match(
        String(error?.message || ''),
        /createClient is not a function/,
        'should throw when window.supabase exists but createClient is missing'
      );
      return true;
    }
  );

  global.window = {
    supabase: {
      createClient(url, key) {
        return { url, key, marker: 'client' };
      },
    },
  };
  const client = mod.buildSupabaseBrowserClient();
  assert.equal(client.marker, 'client');
  assert.ok(typeof client.url === 'string');
  assert.ok(typeof client.key === 'string');
});

test('importLocalStorageData requires auth token', async () => {
  global.localStorage = createLocalStorageMock({
    user_prefs: JSON.stringify({ lang: 'en' }),
  });
  const mod = await import('../src/lib/public-account-client.js');

  await assert.rejects(
    () => mod.importLocalStorageData(),
    (error) => {
      assert.equal(error.code, 'AUTH_REQUIRED');
      return true;
    }
  );
});

test('exportMyData requires auth token', async () => {
  global.localStorage = createLocalStorageMock();
  const mod = await import('../src/lib/public-account-client.js');

  await assert.rejects(
    () => mod.exportMyData(),
    (error) => {
      assert.equal(error.code, 'AUTH_REQUIRED');
      return true;
    }
  );
});

test('deleteMyAccount requires auth token', async () => {
  global.localStorage = createLocalStorageMock();
  const mod = await import('../src/lib/public-account-client.js');

  await assert.rejects(
    () => mod.deleteMyAccount(),
    (error) => {
      assert.equal(error.code, 'AUTH_REQUIRED');
      return true;
    }
  );
});
