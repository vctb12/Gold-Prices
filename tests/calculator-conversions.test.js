'use strict';

/**
 * Extended calculator conversion tests — all karats × multiple weight units × currencies.
 *
 * Validates the core pricing formula:
 *   price_per_gram_AED = (XAU/USD ÷ 31.1035) × 3.6725 × karat_purity
 *
 * Uses the same inline approach as price-calculator.test.js to avoid ESM
 * import complexity in the node:test runner.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

// ── Constants (must match src/config/constants.js) ───────────────────────────
const TROY_OZ_GRAMS = 31.1035;
const AED_PEG = 3.6725;
const TOLA_GRAMS = 11.6638;

// ── Karat purity factors ─────────────────────────────────────────────────────
const KARATS = {
  24: 1.0,
  22: 22 / 24,
  21: 21 / 24,
  18: 18 / 24,
  14: 14 / 24,
};

// ── Pure calculation functions (mirrors src/lib/price-calculator.js) ─────────
function usdPerGram(spotUsdPerOz, purity) {
  if (!spotUsdPerOz || !purity) return 0;
  return (spotUsdPerOz / TROY_OZ_GRAMS) * purity;
}

function aedPerGram(spotUsdPerOz, purity) {
  return usdPerGram(spotUsdPerOz, purity) * AED_PEG;
}

function toGrams(value, unit) {
  switch (unit) {
    case 'gram':
      return value;
    case 'tola':
      return value * TOLA_GRAMS;
    case 'oz':
      return value * TROY_OZ_GRAMS;
    default:
      return value;
  }
}

function totalValue(weight, unit, karat, spotUsdPerOz, fxRate) {
  const weightGrams = toGrams(weight, unit);
  const pricePerGram = usdPerGram(spotUsdPerOz, KARATS[karat]);
  return pricePerGram * weightGrams * fxRate;
}

// ── Reference spot for tests: $2500/oz (realistic 2025+ range) ──────────────
const SPOT = 2500.0;

// ═══════════════════════════════════════════════════════════════════════════════
// TEST SUITE
// ═══════════════════════════════════════════════════════════════════════════════

describe('Calculator — karat purity correctness', () => {
  test('24K = full spot value (purity 1.0)', () => {
    const price = usdPerGram(SPOT, KARATS[24]);
    const expected = SPOT / TROY_OZ_GRAMS;
    assert.ok(Math.abs(price - expected) < 0.001);
  });

  test('22K = 91.67% of 24K', () => {
    const p24 = usdPerGram(SPOT, KARATS[24]);
    const p22 = usdPerGram(SPOT, KARATS[22]);
    const ratio = p22 / p24;
    assert.ok(Math.abs(ratio - 22 / 24) < 0.0001);
  });

  test('21K = 87.5% of 24K', () => {
    const p24 = usdPerGram(SPOT, KARATS[24]);
    const p21 = usdPerGram(SPOT, KARATS[21]);
    const ratio = p21 / p24;
    assert.ok(Math.abs(ratio - 21 / 24) < 0.0001);
  });

  test('18K = 75% of 24K', () => {
    const p24 = usdPerGram(SPOT, KARATS[24]);
    const p18 = usdPerGram(SPOT, KARATS[18]);
    const ratio = p18 / p24;
    assert.ok(Math.abs(ratio - 18 / 24) < 0.0001);
  });

  test('14K = 58.33% of 24K', () => {
    const p24 = usdPerGram(SPOT, KARATS[24]);
    const p14 = usdPerGram(SPOT, KARATS[14]);
    const ratio = p14 / p24;
    assert.ok(Math.abs(ratio - 14 / 24) < 0.0001);
  });
});

describe('Calculator — AED conversion', () => {
  test('AED per gram = USD per gram × 3.6725', () => {
    const usd = usdPerGram(SPOT, KARATS[24]);
    const aed = aedPerGram(SPOT, KARATS[24]);
    assert.ok(Math.abs(aed - usd * AED_PEG) < 0.0001);
  });

  test('24K AED/g for $2500/oz ≈ 295.36', () => {
    const aed = aedPerGram(SPOT, KARATS[24]);
    // Expected: 2500 / 31.1035 * 3.6725 ≈ 295.36
    assert.ok(aed > 295 && aed < 296, `Got ${aed}`);
  });

  test('22K AED/g for $2500/oz ≈ 270.75', () => {
    const aed = aedPerGram(SPOT, KARATS[22]);
    assert.ok(aed > 270 && aed < 272, `Got ${aed}`);
  });

  test('21K AED/g for $2500/oz ≈ 258.44', () => {
    const aed = aedPerGram(SPOT, KARATS[21]);
    assert.ok(aed > 258 && aed < 259, `Got ${aed}`);
  });

  test('18K AED/g for $2500/oz ≈ 221.52', () => {
    const aed = aedPerGram(SPOT, KARATS[18]);
    assert.ok(aed > 221 && aed < 222, `Got ${aed}`);
  });
});

describe('Calculator — weight unit conversions', () => {
  test('1 gram = 1 gram', () => {
    assert.equal(toGrams(1, 'gram'), 1);
  });

  test('1 tola = 11.6638 grams', () => {
    assert.ok(Math.abs(toGrams(1, 'tola') - TOLA_GRAMS) < 0.0001);
  });

  test('1 troy oz = 31.1035 grams', () => {
    assert.ok(Math.abs(toGrams(1, 'oz') - TROY_OZ_GRAMS) < 0.0001);
  });

  test('50 grams of 22K at $2500 ≈ USD 3684', () => {
    const val = totalValue(50, 'gram', 22, SPOT, 1);
    // 50 × (2500 / 31.1035) × (22/24) ≈ 3683.94
    assert.ok(val > 3683 && val < 3685, `Got ${val}`);
  });

  test('1 tola of 21K at $2500 in AED ≈ AED 3013.16', () => {
    const val = totalValue(1, 'tola', 21, SPOT, AED_PEG);
    // 11.6638 × (2500 / 31.1035) × (21/24) × 3.6725 ≈ 3013.16
    assert.ok(val > 3010 && val < 3020, `Got ${val}`);
  });

  test('1 troy oz of 24K = spot price in USD', () => {
    const val = totalValue(1, 'oz', 24, SPOT, 1);
    assert.ok(Math.abs(val - SPOT) < 0.01, `Got ${val}`);
  });
});

describe('Calculator — edge cases', () => {
  test('zero weight returns 0', () => {
    const val = totalValue(0, 'gram', 24, SPOT, AED_PEG);
    assert.equal(val, 0);
  });

  test('zero spot returns 0', () => {
    const price = usdPerGram(0, KARATS[24]);
    assert.equal(price, 0);
  });

  test('negative spot still computes (no crash)', () => {
    const price = usdPerGram(-100, KARATS[24]);
    assert.ok(price < 0);
  });

  test('very large spot ($10000/oz) computes correctly', () => {
    const price = aedPerGram(10000, KARATS[24]);
    // 10000 / 31.1035 * 3.6725 ≈ 1181.44
    assert.ok(price > 1180 && price < 1183, `Got ${price}`);
  });

  test('unknown unit defaults to gram', () => {
    assert.equal(toGrams(5, 'unknown'), 5);
  });
});

describe('Calculator — multi-currency', () => {
  const FX_RATES = {
    AED: AED_PEG,
    USD: 1.0,
    SAR: 3.75,
    KWD: 0.308,
    QAR: 3.64,
  };

  for (const [currency, rate] of Object.entries(FX_RATES)) {
    test(`10g of 24K in ${currency} at $2500/oz`, () => {
      const val = totalValue(10, 'gram', 24, SPOT, rate);
      const expected = 10 * (SPOT / TROY_OZ_GRAMS) * rate;
      assert.ok(Math.abs(val - expected) < 0.01, `${currency}: got ${val}, expected ${expected}`);
    });
  }
});

describe('Calculator — Zakat threshold', () => {
  // Nisab = 85 grams of 24K gold
  const NISAB_GRAMS = 85;

  test('Nisab value in AED is calculable', () => {
    const nisabAed = totalValue(NISAB_GRAMS, 'gram', 24, SPOT, AED_PEG);
    // 85 × (2500/31.1035) × 3.6725 ≈ 25,105
    assert.ok(nisabAed > 25000 && nisabAed < 25200, `Nisab AED: ${nisabAed}`);
  });

  test('Below nisab (84g) is less than threshold', () => {
    const below = totalValue(84, 'gram', 24, SPOT, AED_PEG);
    const atNisab = totalValue(NISAB_GRAMS, 'gram', 24, SPOT, AED_PEG);
    assert.ok(below < atNisab);
  });
});

describe('Calculator — scrap gold estimator', () => {
  // Scrap gold deducts 2-5% refinery fees
  function scrapValue(weight, karat, spotUsdPerOz, fxRate, feePercent) {
    const raw = totalValue(weight, 'gram', karat, spotUsdPerOz, fxRate);
    return raw * (1 - feePercent / 100);
  }

  test('2% refinery fee on 50g 22K', () => {
    const raw = totalValue(50, 'gram', 22, SPOT, AED_PEG);
    const scrap = scrapValue(50, 22, SPOT, AED_PEG, 2);
    assert.ok(Math.abs(scrap - raw * 0.98) < 0.01);
  });

  test('5% refinery fee on 100g 18K', () => {
    const raw = totalValue(100, 'gram', 18, SPOT, AED_PEG);
    const scrap = scrapValue(100, 18, SPOT, AED_PEG, 5);
    assert.ok(Math.abs(scrap - raw * 0.95) < 0.01);
  });
});
