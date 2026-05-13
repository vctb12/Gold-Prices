'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

async function loadApiModule() {
  const url = pathToFileURL(path.resolve(__dirname, '..', 'src', 'lib', 'api.js'));
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

test('fetchGold supports backend API envelope (/api/v1/prices/latest)', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    async json() {
      return {
        ok: true,
        data: {
          provider: 'price_snapshots',
          xauUsdPerOz: 4720.55,
          timestampUtc: '2026-05-07T10:40:00Z',
        },
      };
    },
  });

  try {
    const api = await loadApiModule();
    const result = await api.fetchGold();
    assert.equal(result.price, 4720.55);
    assert.equal(result.updatedAt, '2026-05-07T10:40:00Z');
    assert.equal(result.source, 'price_snapshots');
  } finally {
    global.fetch = originalFetch;
  }
});

test('fetchGold falls back to static JSON when backend endpoint fails', async () => {
  const originalFetch = global.fetch;
  let call = 0;
  global.fetch = async () => {
    call += 1;
    if (call === 1) {
      return {
        ok: false,
        status: 404,
        async json() {
          return {};
        },
      };
    }
    return {
      ok: true,
      async json() {
        return {
          provider: 'gold_api_com',
          xau_usd_per_oz: 4719.91,
          timestamp_utc: '2026-05-07T10:41:00Z',
        };
      },
    };
  };

  try {
    const api = await loadApiModule();
    const result = await api.fetchGold();
    assert.equal(call >= 2, true);
    assert.equal(result.price, 4719.91);
    assert.equal(result.updatedAt, '2026-05-07T10:41:00Z');
    assert.equal(result.source, 'gold_api_com');
  } finally {
    global.fetch = originalFetch;
  }
});

test('fetchGold accepts numeric strings from backend payload', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    async json() {
      return {
        ok: true,
        data: {
          provider: 'price_snapshots',
          xauUsdPerOz: '4733.42',
          timestampUtc: '2026-05-07T10:42:00Z',
        },
      };
    },
  });

  try {
    const api = await loadApiModule();
    const result = await api.fetchGold();
    assert.equal(result.price, 4733.42);
    assert.equal(result.updatedAt, '2026-05-07T10:42:00Z');
    assert.equal(result.source, 'price_snapshots');
  } finally {
    global.fetch = originalFetch;
  }
});
