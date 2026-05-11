'use strict';

/**
 * Tests for getDayOpenPrice() in src/lib/cache.js.
 * Verifies the new exported function returns the correct day-open price
 * when a valid localStorage entry exists, and returns null otherwise.
 *
 * The storage key is read from CONSTANTS.CACHE_KEYS.dayOpen so the test
 * stays in sync with the production config automatically.
 * A monotonic sequence counter is used for ESM cache-busting to avoid
 * false sharing across tests in fast runs.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

// Minimal localStorage stub
function makeLocalStorage() {
  const store = new Map();
  return {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  };
}

function getDubaiDateString() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dubai' }); // YYYY-MM-DD
}

// Monotonic counter for cache-busting ESM imports (avoids timestamp collisions in fast runs)
let _seq = 0;

async function loadModule() {
  _seq += 1;
  const url = new URL('file://' + path.resolve(__dirname, '..', 'src', 'lib', 'cache.js'));
  return import(url.href + '?seq=' + _seq);
}

// Read the day-open key from the production constants module (single import, cached)
const CONSTANTS_URL = new URL(
  'file://' + path.resolve(__dirname, '..', 'src', 'config', 'constants.js')
);
let _dayOpenKey = null;
async function getDayOpenKey() {
  if (!_dayOpenKey) {
    const { CONSTANTS } = await import(CONSTANTS_URL.href);
    _dayOpenKey = CONSTANTS.CACHE_KEYS.dayOpen;
  }
  return _dayOpenKey;
}

test('getDayOpenPrice: returns null when localStorage is empty', async () => {
  global.localStorage = makeLocalStorage();
  const { getDayOpenPrice } = await loadModule();
  const result = getDayOpenPrice();
  assert.equal(result, null, 'should return null when no entry exists');
});

test('getDayOpenPrice: returns null when stored date does not match today', async () => {
  const key = await getDayOpenKey();
  const ls = makeLocalStorage();
  ls.setItem(key, JSON.stringify({ price: 2000, dubaiDate: '2000-01-01' })); // deliberately stale
  global.localStorage = ls;
  const { getDayOpenPrice } = await loadModule();
  const result = getDayOpenPrice();
  assert.equal(result, null, 'should return null for a stale date');
});

test('getDayOpenPrice: returns the price for today', async () => {
  const key = await getDayOpenKey();
  const today = getDubaiDateString();
  const expectedPrice = 3350.75;
  const ls = makeLocalStorage();
  ls.setItem(key, JSON.stringify({ price: expectedPrice, dubaiDate: today }));
  global.localStorage = ls;
  const { getDayOpenPrice } = await loadModule();
  const result = getDayOpenPrice();
  assert.equal(result, expectedPrice, 'should return the stored price for today');
});

test('getDayOpenPrice: returns null when stored price is zero', async () => {
  const key = await getDayOpenKey();
  const today = getDubaiDateString();
  const ls = makeLocalStorage();
  ls.setItem(key, JSON.stringify({ price: 0, dubaiDate: today }));
  global.localStorage = ls;
  const { getDayOpenPrice } = await loadModule();
  const result = getDayOpenPrice();
  assert.equal(result, null, 'should return null for a zero price');
});

test('getDayOpenPrice: returns null when stored payload is malformed', async () => {
  const key = await getDayOpenKey();
  const ls = makeLocalStorage();
  ls.setItem(key, 'not-valid-json{{{');
  global.localStorage = ls;
  const { getDayOpenPrice } = await loadModule();
  // Should not throw — returns null gracefully
  const result = getDayOpenPrice();
  assert.equal(result, null, 'should return null for malformed JSON');
});
