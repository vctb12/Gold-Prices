'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const alertsRouter = require('../server/routes/alerts');

const { computeRulePrice, shouldTrigger } = alertsRouter.__private;

test('computeRulePrice returns USD spot for USD rules', () => {
  const value = computeRulePrice(
    { xauUsdPerOz: 2400 },
    { currency: 'USD', condition: 'above', threshold_value: 2000 }
  );
  assert.equal(value, 2400);
});

test('computeRulePrice returns AED 24K per gram when no karat is provided', () => {
  const value = computeRulePrice(
    { xauUsdPerOz: 2400 },
    { currency: 'AED', karat: null, condition: 'above', threshold_value: 200 }
  );
  assert.equal(Math.round(value * 100) / 100, 283.38);
});

test('computeRulePrice applies karat purity for AED rules', () => {
  const value = computeRulePrice(
    { xauUsdPerOz: 2400 },
    { currency: 'AED', karat: '18', condition: 'above', threshold_value: 200 }
  );
  assert.equal(Math.round(value * 100) / 100, 212.53);
});

test('shouldTrigger uses inclusive threshold boundaries', () => {
  assert.equal(shouldTrigger({ condition: 'above', threshold_value: 2400 }, 2400), true);
  assert.equal(shouldTrigger({ condition: 'below', threshold_value: 2400 }, 2400), true);
});

test('shouldTrigger returns false for unsupported conditions', () => {
  assert.equal(shouldTrigger({ condition: 'sideways', threshold_value: 2400 }, 2400), false);
});
