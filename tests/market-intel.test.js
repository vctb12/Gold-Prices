'use strict';

/**
 * Tests for src/config/market-intel.js
 * Validates that every supported country resolves to a complete, well-formed
 * market-intelligence record powering the country-page Market Intelligence Panel.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');

const REQUIRED_KEYS = [
  'vatRate',
  'vatNoteEn',
  'vatNoteAr',
  'makingChargeMin',
  'makingChargeMax',
  'karatPrefEn',
  'karatPrefAr',
  'marketNoteEn',
  'marketNoteAr',
];

test('every country in the config resolves to a complete market-intel record', async () => {
  const { MARKET_INTEL } = await import('../src/config/market-intel.js');
  const { COUNTRIES } = await import('../src/config/countries.js');

  for (const country of COUNTRIES) {
    const intel = MARKET_INTEL[country.code];
    assert.ok(intel, `missing market-intel entry for ${country.code} (${country.nameEn})`);
    for (const key of REQUIRED_KEYS) {
      assert.notStrictEqual(intel[key], undefined, `${country.code} missing key ${key}`);
    }
  }
});

test('numeric fields are within sane bounds for all entries', async () => {
  const { MARKET_INTEL } = await import('../src/config/market-intel.js');

  for (const [code, intel] of Object.entries(MARKET_INTEL)) {
    assert.ok(intel.vatRate >= 0 && intel.vatRate <= 0.3, `${code} vatRate out of range`);
    assert.ok(
      intel.makingChargeMin >= 0 && intel.makingChargeMin < intel.makingChargeMax,
      `${code} makingChargeMin must be >= 0 and below max`
    );
    assert.ok(intel.makingChargeMax <= 0.6, `${code} makingChargeMax unrealistically high`);
  }
});

test('getMarketIntel falls back to the default record for unknown codes', async () => {
  const { getMarketIntel, MARKET_INTEL_DEFAULT, MARKET_INTEL } =
    await import('../src/config/market-intel.js');

  assert.strictEqual(getMarketIntel('ZZ'), MARKET_INTEL_DEFAULT);
  assert.strictEqual(getMarketIntel(undefined), MARKET_INTEL_DEFAULT);
  assert.strictEqual(getMarketIntel('AE'), MARKET_INTEL['AE']);
});

test('default record is complete', async () => {
  const { MARKET_INTEL_DEFAULT } = await import('../src/config/market-intel.js');
  for (const key of REQUIRED_KEYS) {
    assert.notStrictEqual(MARKET_INTEL_DEFAULT[key], undefined, `default missing key ${key}`);
  }
});
