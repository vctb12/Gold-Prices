'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

async function loadInlineCalc() {
  const url = new URL(
    'file://' + path.resolve(__dirname, '..', 'src', 'tracker', 'inline-calc.js')
  );
  return import(url.href);
}

test('calculateInlineCalcReference uses fixed AED peg for AED output', async () => {
  const { calculateInlineCalcReference } = await loadInlineCalc();
  const value = calculateInlineCalcReference({
    goldPriceUsd: 3103.5,
    weight: 1,
    karat: '24',
    currency: 'AED',
    rates: {},
  });

  assert.equal(Number(value.toFixed(2)), 366.44);
});

test('calculateInlineCalcReference uses direct USD→local FX for non-AED currencies', async () => {
  const { calculateInlineCalcReference } = await loadInlineCalc();
  const value = calculateInlineCalcReference({
    goldPriceUsd: 3103.5,
    weight: 2,
    karat: '22',
    currency: 'EUR',
    rates: { EUR: 0.9 },
  });

  assert.equal(Number(value.toFixed(2)), 164.64);
});

test('calculateInlineCalcReference returns null for invalid weight or missing FX', async () => {
  const { calculateInlineCalcReference } = await loadInlineCalc();

  assert.equal(
    calculateInlineCalcReference({
      goldPriceUsd: 3103.5,
      weight: 0,
      karat: '24',
      currency: 'USD',
      rates: {},
    }),
    null
  );

  assert.equal(
    calculateInlineCalcReference({
      goldPriceUsd: 3103.5,
      weight: 1,
      karat: '24',
      currency: 'SAR',
      rates: {},
    }),
    null
  );
});
