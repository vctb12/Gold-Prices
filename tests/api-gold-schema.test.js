'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

async function loadApiModule() {
  const url = new URL('file://' + path.resolve(__dirname, '..', 'src', 'lib', 'api.js'));
  return import(url.href);
}

test('fetchGold supports normalized schema (xau_usd_per_oz)', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    async json() {
      return {
        provider: 'gold_api_com',
        xau_usd_per_oz: 4731.2,
        timestamp_utc: '2026-05-07T10:34:52Z',
      };
    },
  });

  try {
    const api = await loadApiModule();
    const result = await api.fetchGold();
    assert.equal(result.price, 4731.2);
    assert.equal(result.updatedAt, '2026-05-07T10:34:52Z');
    assert.equal(result.source, 'gold_api_com');
  } finally {
    global.fetch = originalFetch;
  }
});

test('fetchGold supports legacy schema (gold.ounce_usd)', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    async json() {
      return {
        source: 'goldpricez.com',
        fetched_at_utc: '2026-05-07T13:11:59Z',
        gold: { ounce_usd: 4736.36 },
      };
    },
  });

  try {
    const api = await loadApiModule();
    const result = await api.fetchGold();
    assert.equal(result.price, 4736.36);
    assert.equal(result.updatedAt, '2026-05-07T13:11:59Z');
    assert.equal(result.source, 'goldpricez.com');
  } finally {
    global.fetch = originalFetch;
  }
});
