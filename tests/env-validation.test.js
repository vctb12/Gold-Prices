'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateServerEnv } = require('../server/lib/env-validation');

test('validateServerEnv warns for partial Stripe config', () => {
  const logs = [];
  const env = {
    NODE_ENV: 'production',
    STRIPE_SECRET_KEY: 'sk_test_123',
    CORS_ORIGINS: 'https://goldtickerlive.com',
  };
  const result = validateServerEnv(env, {
    warn: (msg) => logs.push(msg),
  });

  assert.equal(result.ok, false);
  assert.ok(result.warnings.some((w) => w.includes('Stripe env appears partially configured.')));
  assert.ok(logs.some((line) => line.includes('[env-validation]')));
});

test('validateServerEnv passes when optional features are disabled and production CORS is set', () => {
  const env = {
    NODE_ENV: 'production',
    CORS_ORIGINS: 'https://goldtickerlive.com',
    STORAGE_BACKEND: 'file',
  };
  const result = validateServerEnv(env, { warn: () => {} });
  assert.equal(result.ok, true);
  assert.deepEqual(result.warnings, []);
});
