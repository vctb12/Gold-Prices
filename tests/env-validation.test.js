'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { getRuntimeEnvSnapshot, validateServerEnv } = require('../server/lib/env-validation');

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

test('getRuntimeEnvSnapshot exposes readiness-friendly integration booleans', () => {
  const snapshot = getRuntimeEnvSnapshot({
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role',
    STRIPE_SECRET_KEY: 'sk_test_123',
    STRIPE_WEBHOOK_SECRET: 'whsec_test_123',
    STRIPE_PUBLISHABLE_KEY: 'pk_test_123',
    RESEND_API_KEY: 're_123',
    RESEND_FROM_EMAIL: 'alerts@goldtickerlive.com',
    ALERT_JOB_TOKEN: 'token_123',
  });

  assert.equal(snapshot.supabaseConfigured, true);
  assert.equal(snapshot.stripeConfigured, true);
  assert.equal(snapshot.stripeWebhookConfigured, true);
  assert.equal(snapshot.resendConfigured, true);
  assert.equal(snapshot.newsletterConfigured, true);
  assert.equal(snapshot.alertJobTokenConfigured, true);
});
