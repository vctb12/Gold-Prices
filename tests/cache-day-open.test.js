'use strict';

/**
 * Tests for getDayOpenPrice() in src/lib/cache.js.
 * Verifies the new exported function returns the correct day-open price
 * when a valid localStorage entry exists, and returns null otherwise.
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

async function loadModule() {
  const url = new URL('file://' + path.resolve(__dirname, '..', 'src', 'lib', 'cache.js'));
  // Bust module cache to pick up fresh localStorage stub on each load
  const mod = await import(url.href + '?t=' + Date.now());
  return mod;
}

test('getDayOpenPrice: returns null when localStorage is empty', async () => {
  global.localStorage = makeLocalStorage();
  const { getDayOpenPrice } = await loadModule();
  const result = getDayOpenPrice();
  assert.equal(result, null, 'should return null when no entry exists');
});

test('getDayOpenPrice: returns null when stored date does not match today', async () => {
  const ls = makeLocalStorage();
  ls.setItem(
    'gold_day_open',
    JSON.stringify({ price: 2000, dubaiDate: '2000-01-01' }) // deliberately stale
  );
  global.localStorage = ls;
  const { getDayOpenPrice } = await loadModule();
  const result = getDayOpenPrice();
  assert.equal(result, null, 'should return null for a stale date');
});

test('getDayOpenPrice: returns the price for today', async () => {
  const today = getDubaiDateString();
  const expectedPrice = 3350.75;
  const ls = makeLocalStorage();
  ls.setItem('gold_day_open', JSON.stringify({ price: expectedPrice, dubaiDate: today }));
  global.localStorage = ls;
  const { getDayOpenPrice } = await loadModule();
  const result = getDayOpenPrice();
  assert.equal(result, expectedPrice, 'should return the stored price for today');
});

test('getDayOpenPrice: returns null when stored price is zero', async () => {
  const today = getDubaiDateString();
  const ls = makeLocalStorage();
  ls.setItem('gold_day_open', JSON.stringify({ price: 0, dubaiDate: today }));
  global.localStorage = ls;
  const { getDayOpenPrice } = await loadModule();
  const result = getDayOpenPrice();
  assert.equal(result, null, 'should return null for a zero price');
});

test('getDayOpenPrice: returns null when stored payload is malformed', async () => {
  const ls = makeLocalStorage();
  ls.setItem('gold_day_open', 'not-valid-json{{{');
  global.localStorage = ls;
  const { getDayOpenPrice } = await loadModule();
  // Should not throw — returns null gracefully
  const result = getDayOpenPrice();
  assert.equal(result, null, 'should return null for malformed JSON');
});
