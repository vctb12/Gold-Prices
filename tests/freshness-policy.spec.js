'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

async function load() {
  const url = new URL(
    'file://' + path.resolve(__dirname, '..', 'src', 'lib', 'freshness-policy.js')
  );
  return import(url.href + `?v=${Date.now()}`);
}

test('freshness-policy: classifies live/cached/delayed/estimated windows', async () => {
  const { evaluateFreshnessState } = await load();

  assert.equal(evaluateFreshnessState({ ageMs: 9000 }).state, 'live');
  assert.equal(evaluateFreshnessState({ ageMs: 30000 }).state, 'cached');
  assert.equal(evaluateFreshnessState({ ageMs: 120000 }).state, 'delayed');
  assert.equal(evaluateFreshnessState({ ageMs: 400000 }).state, 'estimated');
});

test('freshness-policy: never returns live for unhealthy/fallback/closed paths', async () => {
  const { evaluateFreshnessState } = await load();

  assert.equal(evaluateFreshnessState({ ageMs: 1000, providerHealthy: false }).state, 'fallback');
  assert.equal(
    evaluateFreshnessState({ ageMs: 1000, providerPathSuccessful: false }).state,
    'fallback'
  );
  assert.equal(evaluateFreshnessState({ ageMs: 1000, forcedState: 'fallback' }).state, 'fallback');
  assert.equal(evaluateFreshnessState({ ageMs: 1000, marketOpen: false }).state, 'closed');
});
