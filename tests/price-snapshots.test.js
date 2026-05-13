'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  validatePricePayload,
  buildPriceSnapshotRow,
  computeRawPayloadHash,
  insertSnapshotIfNew,
} = require('../server/lib/price-snapshots');

function samplePayload() {
  return {
    provider: 'gold_api_com',
    xau_usd_per_oz: 4700.12,
    aed_per_gram_24k: 554.2,
    quote_currency: 'USD',
    timestamp_utc: '2026-05-13T14:29:59Z',
    fetched_at_utc: '2026-05-13T14:30:33Z',
    freshness_seconds: 34,
    is_fresh: true,
    is_fallback: false,
  };
}

function createSupabaseMock({ duplicate = false } = {}) {
  const state = { inserts: [] };
  return {
    state,
    from(table) {
      if (table !== 'price_snapshots') throw new Error(`Unexpected table: ${table}`);
      return {
        insert(rows) {
          state.inserts.push(...rows);
          return {
            select() {
              return {
                single() {
                  if (duplicate) {
                    return Promise.resolve({
                      data: null,
                      error: {
                        code: '23505',
                        message: 'duplicate key value violates unique constraint',
                      },
                    });
                  }
                  return Promise.resolve({ data: { id: 'new-id' }, error: null });
                },
              };
            },
          };
        },
      };
    },
  };
}

test('validatePricePayload rejects invalid payload shape', () => {
  const result = validatePricePayload({ provider: 'x' });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes('xau_usd_per_oz')));
});

test('validatePricePayload normalizes a valid payload and computes a stable hash', () => {
  const payload = samplePayload();
  const resultA = validatePricePayload(payload);
  const resultB = validatePricePayload({ ...payload });
  assert.equal(resultA.ok, true);
  assert.equal(resultB.ok, true);
  assert.equal(resultA.normalized.xauUsdPerOz, 4700.12);
  assert.equal(resultA.normalized.rawPayloadHash, resultB.normalized.rawPayloadHash);
  assert.equal(resultA.normalized.rawPayloadHash, computeRawPayloadHash(payload));
});

test('insertSnapshotIfNew prevents duplicate inserts for same key', async () => {
  const validated = validatePricePayload(samplePayload());
  assert.equal(validated.ok, true);
  const row = buildPriceSnapshotRow(validated.normalized, {
    providerChain: 'gold_api_com=fresh',
  });
  const mock = createSupabaseMock({ duplicate: true });
  const result = await insertSnapshotIfNew(mock, row);
  assert.equal(result.inserted, false);
  assert.equal(result.duplicate, true);
  assert.equal(mock.state.inserts.length, 1);
});

test('insertSnapshotIfNew inserts when duplicate does not exist', async () => {
  const validated = validatePricePayload(samplePayload());
  assert.equal(validated.ok, true);
  const row = buildPriceSnapshotRow(validated.normalized, {
    providerChain: 'gold_api_com=fresh',
  });
  const mock = createSupabaseMock({ duplicate: false });
  const result = await insertSnapshotIfNew(mock, row);
  assert.equal(result.inserted, true);
  assert.equal(result.duplicate, false);
  assert.equal(mock.state.inserts.length, 1);
});
