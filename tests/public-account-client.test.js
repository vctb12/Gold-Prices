'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

function createLocalStorageMock(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
    key(index) {
      return Array.from(store.keys())[index] || null;
    },
    get length() {
      return store.size;
    },
  };
}

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
