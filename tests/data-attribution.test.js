'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

async function loadModules() {
  const base = path.resolve(__dirname, '..', 'src', 'config');
  const [attr, karats] = await Promise.all([
    import('file://' + path.join(base, 'data-attribution.js')),
    import('file://' + path.join(base, 'karats.js')),
  ]);
  return { attr, karats };
}

test('karat marketing count matches KARATS config length', async () => {
  const { attr, karats } = await loadModules();
  assert.equal(attr.getKaratCount(), karats.KARATS.length);
  assert.equal(attr.getKaratCount(), 7);
});

test('refresh statement documents hourly source and ~90s client poll', async () => {
  const { attr } = await loadModules();
  const en = attr.getRefreshStatement('en');
  assert.match(en, /hourly/i);
  assert.match(en, /90/);
});

test('gold attribution points at GoldPriceZ per owner truth', async () => {
  const { attr } = await loadModules();
  assert.equal(attr.DATA_ATTRIBUTION.gold.domain, 'goldpricez.com');
});
