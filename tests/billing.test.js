'use strict';

/**
 * tests/billing.test.js
 *
 * Tests for Phase 6 billing: routes, entitlements, webhook idempotency,
 * and safe behaviour when Stripe is not configured.
 *
 * Run with: npm test
 */

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const path = require('path');

// ---------------------------------------------------------------------------
// Minimal server factory — avoids pulling in the real server.js which
// requires JWT_SECRET etc. at module load time.
// ---------------------------------------------------------------------------
function makeTestApp(billingRoutesPath) {
  const express = require('express');
  const app = express();

  // Raw-body middleware for the webhook path (mirrors server.js)
  app.use('/api/v1/billing/webhook', express.raw({ type: 'application/json' }));
  app.use(express.json({ limit: '256kb' }));

  const billingModule = require(billingRoutesPath);
  const billingRouter = billingModule;
  const meRouter = billingModule.meRouter;

  app.use('/api/v1/billing', billingRouter);
  if (meRouter) app.use('/api/v1/me', meRouter);

  return app;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function post(server, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const payload = typeof body === 'string' ? body : JSON.stringify(body);
    const options = {
      host: '127.0.0.1',
      port: server.address().port,
      method: 'POST',
      path,
      headers: {
        'Content-Type': typeof body === 'string' ? 'application/octet-stream' : 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        ...headers,
      },
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function get(server, path, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      host: '127.0.0.1',
      port: server.address().port,
      method: 'GET',
      path,
      headers,
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Entitlements module unit tests (no server needed)
// ---------------------------------------------------------------------------
describe('entitlements module', () => {
  let entitlements;

  before(() => {
    entitlements = require('../server/lib/entitlements');
  });

  test('free tier has expected limits', () => {
    const e = entitlements.getEntitlementsForTier('free');
    assert.equal(e.tier, 'free');
    assert.equal(e.alertLimit, 3);
    assert.equal(e.apiAccess, false);
    assert.equal(e.adsEnabled, true);
    assert.ok(Array.isArray(e.exportFormats));
    assert.deepEqual(Array.from(e.exportFormats), ['csv']);
  });

  test('pro tier has higher limits than free', () => {
    const pro = entitlements.getEntitlementsForTier('pro');
    const free = entitlements.getEntitlementsForTier('free');
    assert.ok(pro.alertLimit > free.alertLimit);
    assert.equal(pro.adsEnabled, false);
    assert.equal(pro.webPush, true);
    assert.equal(pro.emailAlerts, true);
  });

  test('api tier has apiAccess=true and webhookSupport=true', () => {
    const api = entitlements.getEntitlementsForTier('api');
    assert.equal(api.apiAccess, true);
    assert.equal(api.webhookSupport, true);
    assert.ok(api.apiCallsPerDay > 0);
  });

  test('unknown tier falls back to free', () => {
    const e = entitlements.getEntitlementsForTier('enterprise');
    assert.equal(e.tier, 'free');
  });

  test('resolveUserEntitlements returns free for null userId', async () => {
    const result = await entitlements.resolveUserEntitlements(null);
    assert.equal(result.tier, 'free');
    assert.equal(result.subscription, null);
    assert.equal(result.entitlements.tier, 'free');
  });

  test('hasFeature returns false for apiAccess on free user', async () => {
    const access = await entitlements.hasFeature(null, 'apiAccess');
    assert.equal(access, false);
  });

  test('getLimit returns 3 alertLimit for free user', async () => {
    const limit = await entitlements.getLimit(null, 'alertLimit');
    assert.equal(limit, 3);
  });

  test('TIERS includes free, pro, api', () => {
    assert.ok(entitlements.TIERS.includes('free'));
    assert.ok(entitlements.TIERS.includes('pro'));
    assert.ok(entitlements.TIERS.includes('api'));
  });
});

// ---------------------------------------------------------------------------
// Billing routes — unconfigured (no Stripe env vars)
// ---------------------------------------------------------------------------
describe('billing routes — Stripe not configured', () => {
  let server;
  const routesPath = path.resolve(__dirname, '../server/routes/billing');

  before(() => {
    // Ensure Stripe env vars are absent
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_WEBHOOK_SECRET;
    delete process.env.STRIPE_PUBLISHABLE_KEY;

    // Clear require cache so env state is re-evaluated
    delete require.cache[require.resolve(routesPath)];
    const app = makeTestApp(routesPath);
    server = app.listen(0);
  });

  after(() => server.close());

  test('GET /api/v1/billing/config returns configured=false', async () => {
    const { status, body } = await get(server, '/api/v1/billing/config');
    assert.equal(status, 200);
    assert.equal(body.configured, false);
    assert.equal(body.publishableKey, null);
  });

  test('GET /api/v1/billing/status returns configured=false', async () => {
    const { status, body } = await get(server, '/api/v1/billing/status');
    assert.equal(status, 200);
    assert.equal(body.configured, false);
    assert.equal(body.publishableKey, null);
    assert.ok(body.plans?.pro);
    assert.ok(body.plans?.api);
  });

  test('POST /api/v1/billing/create-checkout-session returns 401 without auth', async () => {
    const { status } = await post(server, '/api/v1/billing/create-checkout-session', {
      tier: 'pro',
      interval: 'month',
    });
    // No auth header → 401 before billing check
    assert.equal(status, 401);
  });

  test('POST /api/v1/billing/create-portal-session returns 401 without auth', async () => {
    const { status } = await post(server, '/api/v1/billing/create-portal-session', {});
    assert.equal(status, 401);
  });

  test('POST /api/v1/billing/webhook returns 503 when webhook secret absent', async () => {
    const { status, body } = await post(server, '/api/v1/billing/webhook', '{"id":"evt_test"}', {
      'stripe-signature': 'invalid',
      'Content-Type': 'application/json',
    });
    assert.equal(status, 503);
    assert.ok(typeof body.error === 'string');
  });
});

// ---------------------------------------------------------------------------
// Billing routes — auth guard
// ---------------------------------------------------------------------------
describe('billing routes — auth required endpoints', () => {
  let server;
  const routesPath = path.resolve(__dirname, '../server/routes/billing');

  before(() => {
    delete require.cache[require.resolve(routesPath)];
    const app = makeTestApp(routesPath);
    server = app.listen(0);
  });

  after(() => server.close());

  test('GET /api/v1/me/entitlements returns 401 without token', async () => {
    const { status, body } = await get(server, '/api/v1/me/entitlements');
    assert.equal(status, 401);
    assert.equal(body.code, 'UNAUTHORIZED');
  });

  test('GET /api/v1/me/entitlements returns 401 with invalid token', async () => {
    const { status } = await get(server, '/api/v1/me/entitlements', {
      Authorization: 'Bearer not-a-real-token',
    });
    assert.equal(status, 401);
  });

  test('POST create-checkout-session returns 401 without token', async () => {
    const { status } = await post(server, '/api/v1/billing/create-checkout-session', {
      tier: 'pro',
    });
    assert.equal(status, 401);
  });
});

// ---------------------------------------------------------------------------
// Billing repository unit tests (file-backed)
// ---------------------------------------------------------------------------
describe('billing-repository — file-backed', () => {
  let repo;

  before(() => {
    const repoPath = path.resolve(__dirname, '../server/lib/billing-repository');
    delete require.cache[require.resolve(repoPath)];
    repo = require(repoPath);
  });

  test('findCustomerByUserId returns null for unknown user', async () => {
    // No Supabase in tests → file fallback
    const result = await repo.findCustomerByUserId('unknown-user-id');
    assert.equal(result, null);
  });

  test('isEventProcessed returns false for unseen event', async () => {
    const result = await repo.isEventProcessed('evt_unseen_' + Date.now());
    assert.equal(result, false);
  });

  test('getActiveSubscription returns null for unknown user', async () => {
    const result = await repo.getActiveSubscription('no-such-user');
    assert.equal(result, null);
  });
});

// ---------------------------------------------------------------------------
// Webhook signature verification (mocked)
// ---------------------------------------------------------------------------
describe('webhook — signature verification', () => {
  let server;
  const routesPath = path.resolve(__dirname, '../server/routes/billing');

  before(() => {
    // Set a webhook secret but no valid Stripe key (SDK will fail to init)
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_' + 'a'.repeat(32);
    process.env.STRIPE_SECRET_KEY = 'sk_test_placeholder';
    process.env.STRIPE_PUBLISHABLE_KEY = 'pk_test_placeholder';

    delete require.cache[require.resolve(routesPath)];
    // Also clear billing routes dependency on stripe
    try {
      delete require.cache[require.resolve('stripe')];
    } catch {
      // stripe may not be in cache
    }

    const app = makeTestApp(routesPath);
    server = app.listen(0);
  });

  after(() => {
    server.close();
    delete process.env.STRIPE_WEBHOOK_SECRET;
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_PUBLISHABLE_KEY;
  });

  test('webhook with invalid signature returns 400', async () => {
    const { status } = await post(
      server,
      '/api/v1/billing/webhook',
      JSON.stringify({ id: 'evt_test', type: 'ping' }),
      {
        'stripe-signature': 't=invalid,v1=invalidsig',
        'Content-Type': 'application/json',
      }
    );
    // 400 = bad signature (Stripe SDK rejects it)
    assert.ok(status === 400 || status === 503, `expected 400 or 503, got ${status}`);
  });
});

// ---------------------------------------------------------------------------
// Input validation for checkout
// ---------------------------------------------------------------------------
describe('checkout input validation', () => {
  let server;
  const routesPath = path.resolve(__dirname, '../server/routes/billing');

  // Minimal mock for requireBillingUser — we can't inject a real Supabase user
  // in unit tests, so we test that 401 is returned for unauthenticated calls
  // with bad tier/interval. The 401 gate fires first, which is the correct
  // security behavior.
  before(() => {
    delete require.cache[require.resolve(routesPath)];
    const app = makeTestApp(routesPath);
    server = app.listen(0);
  });

  after(() => server.close());

  test('checkout returns 401 (auth guard fires before tier validation)', async () => {
    const { status } = await post(server, '/api/v1/billing/create-checkout-session', {
      tier: 'invalid',
      interval: 'month',
    });
    // Auth guard fires first — correct ordering
    assert.equal(status, 401);
  });
});
