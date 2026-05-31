'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

// Minimal DOM mock
globalThis.document = {
  getElementById: () => null,
  createElement: () => ({
    id: '',
    className: '',
    setAttribute: () => {},
    addEventListener: () => {},
    appendChild: () => {},
    querySelectorAll: () => [],
    querySelector: () => null,
    hidden: false,
    innerHTML: '',
  }),
  body: { appendChild: () => {}, style: {} },
  head: { appendChild: () => {}, querySelector: () => null },
};

let mod;
async function load() {
  if (!mod) mod = await import('../src/components/shops-compare.js');
  return mod;
}

const MOCK_SHOPS = [
  {
    id: 'shop-1',
    name: 'Shop One',
    city: 'Dubai',
    countryCode: 'AE',
    market: 'Souk A',
    category: 'Jewellery',
    specialties: ['22K'],
    detailsAvailability: 'full',
    phone: '+971-4-111',
    website: 'https://shop1.com',
    notes: 'Test 1',
  },
  {
    id: 'shop-2',
    name: 'Shop Two',
    city: 'Riyadh',
    countryCode: 'SA',
    market: 'Souk B',
    category: 'Bullion',
    specialties: ['24K'],
    detailsAvailability: 'partial',
    phone: '',
    website: '',
    notes: 'Test 2',
  },
  {
    id: 'shop-3',
    name: 'Shop Three',
    city: 'Cairo',
    countryCode: 'EG',
    market: 'Khan',
    category: 'Jewellery',
    specialties: ['21K'],
    detailsAvailability: 'limited',
    phone: '',
    website: '',
    notes: 'Test 3',
  },
  {
    id: 'shop-4',
    name: 'Shop Four',
    city: 'Doha',
    countryCode: 'QA',
    market: 'Gold Souq',
    category: 'Retail',
    specialties: [],
    detailsAvailability: 'limited',
    phone: '',
    website: '',
    notes: 'Test 4',
  },
];

function setup(m, overrides = {}) {
  m.clearCompare();
  m.initCompare({
    lang: 'en',
    shops: MOCK_SHOPS,
    countryNameFn: (code) => code,
    onCompareChange: () => {},
    ...overrides,
  });
}

test('starts with empty compare list', async () => {
  const m = await load();
  setup(m);
  assert.deepEqual(m.getCompareList(), []);
});

test('adds a shop to compare list', async () => {
  const m = await load();
  setup(m);
  const result = m.toggleCompare('shop-1');
  assert.equal(result.added, true);
  assert.equal(result.maxReached, false);
  assert.equal(m.isInCompareList('shop-1'), true);
  assert.deepEqual(m.getCompareList(), ['shop-1']);
});

test('removes a shop when toggled twice', async () => {
  const m = await load();
  setup(m);
  m.toggleCompare('shop-1');
  const result = m.toggleCompare('shop-1');
  assert.equal(result.added, false);
  assert.equal(m.isInCompareList('shop-1'), false);
  assert.deepEqual(m.getCompareList(), []);
});

test('allows up to 3 shops', async () => {
  const m = await load();
  setup(m);
  m.toggleCompare('shop-1');
  m.toggleCompare('shop-2');
  const result = m.toggleCompare('shop-3');
  assert.equal(result.added, true);
  assert.equal(result.maxReached, true);
  assert.equal(m.getCompareList().length, 3);
});

test('blocks adding a 4th shop', async () => {
  const m = await load();
  setup(m);
  m.toggleCompare('shop-1');
  m.toggleCompare('shop-2');
  m.toggleCompare('shop-3');
  const result = m.toggleCompare('shop-4');
  assert.equal(result.added, false);
  assert.equal(result.maxReached, true);
  assert.equal(m.getCompareList().length, 3);
  assert.equal(m.isInCompareList('shop-4'), false);
});

test('clearCompare empties the list', async () => {
  const m = await load();
  setup(m);
  m.toggleCompare('shop-1');
  m.toggleCompare('shop-2');
  m.clearCompare();
  assert.deepEqual(m.getCompareList(), []);
  assert.equal(m.isInCompareList('shop-1'), false);
});

test('setCompareLang does not throw', async () => {
  const m = await load();
  setup(m);
  assert.doesNotThrow(() => m.setCompareLang('ar'));
  assert.doesNotThrow(() => m.setCompareLang('en'));
});

test('onCompareChange callback fires on toggle', async () => {
  const m = await load();
  let callCount = 0;
  setup(m, {
    onCompareChange: () => {
      callCount++;
    },
  });
  m.toggleCompare('shop-1');
  assert.equal(callCount, 1);
  m.toggleCompare('shop-1');
  assert.equal(callCount, 2);
});

test('removing a shop restores slot for new one', async () => {
  const m = await load();
  setup(m);
  m.toggleCompare('shop-1');
  m.toggleCompare('shop-2');
  m.toggleCompare('shop-3');
  m.toggleCompare('shop-2'); // remove
  const result = m.toggleCompare('shop-4');
  assert.equal(result.added, true);
  assert.equal(m.isInCompareList('shop-4'), true);
});
