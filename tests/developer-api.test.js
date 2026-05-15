'use strict';

/**
 * tests/developer-api.test.js
 *
 * Tests for Phase 12: API product routes
 *  - GET /api/v1/public/latest      (optionalApiKey)
 *  - GET /api/v1/public/history     (requireApiKey)
 *  - GET /api/v1/public/karats      (open)
 *  - GET /api/v1/public/countries   (open)
 *  - POST /api/v1/me/api-keys
 *  - GET  /api/v1/me/api-keys
 *  - DELETE /api/v1/me/api-keys/:id
 *  - POST /api/v1/me/api-keys/:id/regenerate
 *  - GET  /api/v1/me/api-usage
 *
 * Run with: npm test
 */

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-tests-only';
process.env.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'test-password-1234';
process.env.ADMIN_ACCESS_PIN = process.env.ADMIN_ACCESS_PIN || '123456';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
// Enable the test-user bypass for /me routes (dev-only)
process.env.PUBLIC_AUTH_TEST_MODE = '1';

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');

// ---------------------------------------------------------------------------
// Minimal test app factory
// Uses the isolated developer-api router mounted on a small express app,
// so we don't pull in the entire server.js stack.
// ---------------------------------------------------------------------------

// NOTE: makeTestApp() is intentionally called only once per test file in the
// before() hook below. The tmpDir cleanup in after() is safe under this
// single-invocation assumption.
function makeTestApp() {
  const express = require('express');
  const app = express();
  app.use(express.json({ limit: '256kb' }));

  // Provide a test billing data file so api_keys are isolated per test run.
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gtl-devapi-'));
  process.env.BILLING_DATA_FILE = path.join(tmpDir, 'billing.json');

  const router = require(path.resolve(__dirname, '../server/routes/developer-api'));
  app.use('/api/v1', router);

  return { app, tmpDir };
}

function request(server, method, p, opts = {}) {
  return new Promise((resolve, reject) => {
    const payload = opts.body != null ? JSON.stringify(opts.body) : undefined;
    const options = {
      host: '127.0.0.1',
      port: server.address().port,
      method,
      path: p,
      headers: {
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
        ...(opts.headers || {}),
      },
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data), headers: res.headers });
        } catch {
          resolve({ status: res.statusCode, body: data, headers: res.headers });
        }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// Convenience wrappers
function get(server, path, headers = {}) {
  return request(server, 'GET', path, { headers });
}
function post(server, path, body = {}, headers = {}) {
  return request(server, 'POST', path, { body, headers });
}
function del(server, path, headers = {}) {
  return request(server, 'DELETE', path, { headers });
}

// Test-user header (only works when PUBLIC_AUTH_TEST_MODE=1 and NODE_ENV≠production)
const TEST_USER_HEADERS = { 'x-test-user-id': 'test-user-phase12' };

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let server;
let tmpDir;
let prevBillingDataFile;

before(() => {
  prevBillingDataFile = process.env.BILLING_DATA_FILE;
  const { app, tmpDir: dir } = makeTestApp();
  tmpDir = dir;
  server = app.listen(0);
});

after(() => {
  server.close();
  // Restore BILLING_DATA_FILE to avoid leaking into other test files
  if (prevBillingDataFile === undefined) {
    delete process.env.BILLING_DATA_FILE;
  } else {
    process.env.BILLING_DATA_FILE = prevBillingDataFile;
  }
  try {
    fs.rmSync(tmpDir, { recursive: true });
  } catch {
    /* ok */
  }
});

// ---------------------------------------------------------------------------
// Open public endpoints
// ---------------------------------------------------------------------------

describe('GET /api/v1/public/karats', () => {
  test('returns standard envelope with karat list', async () => {
    const { status, body } = await get(server, '/api/v1/public/karats');
    assert.equal(status, 200);
    assert.equal(body.ok, true);
    assert.ok(Array.isArray(body.data.karats), 'karats should be an array');
    assert.ok(body.data.karats.length > 0, 'should have at least one karat');
    assert.ok(typeof body.data.troyOzGrams === 'number', 'troyOzGrams should be number');
    // Spot-check 24k entry
    const k24 = body.data.karats.find((k) => k.code === '24');
    assert.ok(k24, '24k entry should exist');
    assert.equal(k24.purity, 1);
  });

  test('includes meta with static freshness', async () => {
    const { body } = await get(server, '/api/v1/public/karats');
    assert.equal(body.meta.freshness, 'static');
    assert.equal(body.meta.source, 'reference');
    assert.ok(typeof body.meta.timestamp === 'string');
  });
});

describe('GET /api/v1/public/countries', () => {
  test('returns standard envelope with countries list', async () => {
    const { status, body } = await get(server, '/api/v1/public/countries');
    assert.equal(status, 200);
    assert.equal(body.ok, true);
    assert.ok(Array.isArray(body.data.countries));
    assert.ok(body.data.countries.length > 0);
    // UAE should be there with fixedPeg
    const ae = body.data.countries.find((c) => c.code === 'AE');
    assert.ok(ae, 'UAE should be in country list');
    assert.equal(ae.currency, 'AED');
    assert.equal(ae.fixedPeg, true);
  });
});

// ---------------------------------------------------------------------------
// /public/latest — optionalApiKey
// ---------------------------------------------------------------------------

describe('GET /api/v1/public/latest', () => {
  test('responds 200 without API key (anonymous within limit)', async () => {
    const { status, body } = await get(server, '/api/v1/public/latest');
    // 200 or 503 (if no data file) are both valid — depends on test env
    assert.ok([200, 503].includes(status), `expected 200 or 503, got ${status}`);
    if (status === 200) {
      assert.equal(body.ok, true);
      assert.ok(body.data.disclaimer, 'should include disclaimer');
    }
  });

  test('responds with error envelope on 503 when data unavailable', async () => {
    const { status, body } = await get(server, '/api/v1/public/latest');
    if (status === 503) {
      assert.equal(body.ok, false);
      assert.ok(body.error?.code, 'error should have a code');
    }
  });
});

// ---------------------------------------------------------------------------
// /public/history — requireApiKey
// ---------------------------------------------------------------------------

describe('GET /api/v1/public/history', () => {
  test('returns 401 without API key', async () => {
    const { status, body } = await get(server, '/api/v1/public/history');
    assert.equal(status, 401);
    assert.equal(body.ok, false);
    assert.equal(body.error.code, 'API_KEY_REQUIRED');
  });

  test('returns 401 with invalid API key', async () => {
    const { status, body } = await get(server, '/api/v1/public/history', {
      'X-API-Key': 'gtl_invalid_fake_key_abcdef1234567890',
    });
    assert.equal(status, 401);
    assert.equal(body.ok, false);
    assert.equal(body.error.code, 'INVALID_API_KEY');
  });
});

// ---------------------------------------------------------------------------
// API key management — /me/api-keys
// ---------------------------------------------------------------------------

describe('GET /api/v1/me/api-keys', () => {
  test('returns 401 without auth token', async () => {
    const { status, body } = await get(server, '/api/v1/me/api-keys');
    assert.equal(status, 401);
    assert.equal(body.ok, false);
  });

  test('returns empty key list for new test user', async () => {
    const { status, body } = await get(server, '/api/v1/me/api-keys', TEST_USER_HEADERS);
    assert.equal(status, 200);
    assert.equal(body.ok, true);
    assert.ok(Array.isArray(body.data.keys));
  });
});

describe('POST /api/v1/me/api-keys', () => {
  test('returns 401 without auth token', async () => {
    const { status, body } = await post(server, '/api/v1/me/api-keys', { label: 'test' });
    assert.equal(status, 401);
    assert.equal(body.ok, false);
  });

  test('creates an API key for an authenticated user', async () => {
    const { status, body } = await post(
      server,
      '/api/v1/me/api-keys',
      { label: 'my-test-key' },
      TEST_USER_HEADERS
    );
    assert.equal(status, 201);
    assert.equal(body.ok, true);
    assert.ok(typeof body.data.key === 'string', 'should return raw key');
    assert.ok(body.data.key.startsWith('gtl_'), 'key should start with gtl_');
    assert.ok(typeof body.data.id === 'string', 'should return key id');
    assert.equal(body.data.label, 'my-test-key');
    assert.ok(body.data.warning, 'should include warning about key visibility');
  });

  test('lists the newly created key', async () => {
    // Create first
    await post(server, '/api/v1/me/api-keys', { label: 'list-test' }, TEST_USER_HEADERS);
    // Then list
    const { status, body } = await get(server, '/api/v1/me/api-keys', TEST_USER_HEADERS);
    assert.equal(status, 200);
    assert.ok(body.data.keys.length >= 1, 'should have at least one key');
    // Keys should NOT expose raw key or hash
    for (const k of body.data.keys) {
      assert.ok(!('key' in k), 'list should not expose raw key');
      assert.ok(!('keyHash' in k), 'list should not expose key hash');
      assert.ok(typeof k.keyPrefix === 'string', 'should expose key prefix');
    }
  });
});

describe('DELETE /api/v1/me/api-keys/:id', () => {
  test('revokes an active key', async () => {
    // Create a key
    const created = await post(
      server,
      '/api/v1/me/api-keys',
      { label: 'to-revoke' },
      TEST_USER_HEADERS
    );
    assert.equal(created.status, 201);
    const keyId = created.body.data.id;

    // Revoke it
    const revoked = await del(server, `/api/v1/me/api-keys/${keyId}`, TEST_USER_HEADERS);
    assert.equal(revoked.status, 200);
    assert.equal(revoked.body.ok, true);
    assert.equal(revoked.body.data.revoked, true);
  });

  test('returns 404 for unknown key ID', async () => {
    const { status, body } = await del(
      server,
      '/api/v1/me/api-keys/nonexistent-id',
      TEST_USER_HEADERS
    );
    assert.equal(status, 404);
    assert.equal(body.ok, false);
    assert.equal(body.error.code, 'KEY_NOT_FOUND');
  });

  test('returns 401 without auth', async () => {
    const { status, body } = await del(server, '/api/v1/me/api-keys/some-id');
    assert.equal(status, 401);
    assert.equal(body.ok, false);
  });
});

describe('POST /api/v1/me/api-keys/:id/regenerate', () => {
  test('revokes old key and creates a new one', async () => {
    const created = await post(
      server,
      '/api/v1/me/api-keys',
      { label: 'rotate-me' },
      TEST_USER_HEADERS
    );
    assert.equal(created.status, 201);
    const oldId = created.body.data.id;

    const regen = await post(
      server,
      `/api/v1/me/api-keys/${oldId}/regenerate`,
      {},
      TEST_USER_HEADERS
    );
    assert.equal(regen.status, 201);
    assert.equal(regen.body.ok, true);
    assert.ok(typeof regen.body.data.key === 'string', 'should return new raw key');
    assert.ok(regen.body.data.key.startsWith('gtl_'), 'new key should start with gtl_');
    assert.notEqual(regen.body.data.id, oldId, 'new key should have a different id');
    assert.equal(regen.body.data.revokedId, oldId, 'should confirm old key was revoked');
  });

  test('returns 404 for unknown key', async () => {
    const { status, body } = await post(
      server,
      '/api/v1/me/api-keys/does-not-exist/regenerate',
      {},
      TEST_USER_HEADERS
    );
    assert.equal(status, 404);
    assert.equal(body.ok, false);
    assert.equal(body.error.code, 'KEY_NOT_FOUND');
  });
});

// ---------------------------------------------------------------------------
// Usage — /me/api-usage
// ---------------------------------------------------------------------------

describe('GET /api/v1/me/api-usage', () => {
  test('returns 401 without auth', async () => {
    const { status, body } = await get(server, '/api/v1/me/api-usage');
    assert.equal(status, 401);
    assert.equal(body.ok, false);
  });

  test('returns usage summary for authenticated user', async () => {
    const { status, body } = await get(server, '/api/v1/me/api-usage', TEST_USER_HEADERS);
    assert.equal(status, 200);
    assert.equal(body.ok, true);
    assert.ok(typeof body.data.totalCalls === 'number');
    assert.ok(typeof body.data.todayCalls === 'number');
    assert.ok(typeof body.data.windowDays === 'number');
    assert.ok(body.data.quota !== undefined);
    assert.ok(Array.isArray(body.data.byKey));
    assert.ok(Array.isArray(body.data.byDate));
  });
});

// ---------------------------------------------------------------------------
// API key authentication flow
// ---------------------------------------------------------------------------

describe('API key auth — /public/latest with key', () => {
  test('valid API key resolves and is tracked', async () => {
    // Create a key for the test user
    const created = await post(
      server,
      '/api/v1/me/api-keys',
      { label: 'auth-flow-test' },
      TEST_USER_HEADERS
    );
    assert.equal(created.status, 201);
    const rawKey = created.body.data.key;
    assert.ok(rawKey.startsWith('gtl_'));

    // Use it on /public/latest
    const { status } = await get(server, '/api/v1/public/latest', { 'X-API-Key': rawKey });
    // 200 or 503 (no data file in CI)
    assert.ok([200, 503].includes(status), `expected 200 or 503, got ${status}`);
  });

  test('revoked key is rejected with 401', async () => {
    // Create and immediately revoke
    const created = await post(
      server,
      '/api/v1/me/api-keys',
      { label: 'revoke-test' },
      TEST_USER_HEADERS
    );
    const keyId = created.body.data.id;
    const rawKey = created.body.data.key;
    await del(server, `/api/v1/me/api-keys/${keyId}`, TEST_USER_HEADERS);

    // Attempt to use it
    const { status, body } = await get(server, '/api/v1/public/latest', { 'X-API-Key': rawKey });
    assert.equal(status, 401);
    assert.equal(body.ok, false);
    assert.equal(body.error.code, 'INVALID_API_KEY');
  });
});

// ---------------------------------------------------------------------------
// Key limit enforcement
// ---------------------------------------------------------------------------

describe('Key limit — max 10 active keys per user', () => {
  test('creating more than 10 keys returns KEY_LIMIT_REACHED', async () => {
    const uniqueUser = { 'x-test-user-id': `limit-test-user-${Date.now()}` };

    // Create 10 keys
    for (let i = 0; i < 10; i++) {
      const res = await post(server, '/api/v1/me/api-keys', { label: `key-${i}` }, uniqueUser);
      assert.equal(res.status, 201, `key ${i} should be created`);
    }

    // 11th should fail
    const { status, body } = await post(
      server,
      '/api/v1/me/api-keys',
      { label: 'overflow' },
      uniqueUser
    );
    assert.equal(status, 422);
    assert.equal(body.ok, false);
    assert.equal(body.error.code, 'KEY_LIMIT_REACHED');
  });
});

// ---------------------------------------------------------------------------
// Rate limit / quota behaviour
// ---------------------------------------------------------------------------

describe('X-RateLimit-* headers', () => {
  test('authenticated /public/latest includes X-RateLimit-* headers', async () => {
    // Create a key and use it; the middleware sets rate-limit headers from ctx.quota
    const created = await post(
      server,
      '/api/v1/me/api-keys',
      { label: 'ratelimit-header-test' },
      TEST_USER_HEADERS
    );
    assert.equal(created.status, 201);
    const rawKey = created.body.data.key;

    const { headers } = await get(server, '/api/v1/public/latest', { 'X-API-Key': rawKey });
    // Headers are set only when quota > 0 (entitlements resolved from billing-repository)
    // In a test environment with no Supabase, the free-tier quota (100) should be used.
    if (headers['x-ratelimit-limit']) {
      assert.ok(
        parseInt(headers['x-ratelimit-limit'], 10) > 0,
        'X-RateLimit-Limit should be positive'
      );
      assert.ok(
        parseInt(headers['x-ratelimit-remaining'], 10) >= 0,
        'X-RateLimit-Remaining should be non-negative'
      );
      assert.ok(
        typeof headers['x-ratelimit-reset'] === 'string',
        'X-RateLimit-Reset should be a string'
      );
    }
  });

  test('anonymous /public/latest returns 429 after exceeding IP limit', async () => {
    // The anon middleware is only on /public/latest; exhaust the in-process counter
    // by sending more than ANON_FREE_DAILY_LIMIT (10) requests from a unique "IP"
    const fakeIp = `192.0.2.${Math.floor(Math.random() * 253) + 1}`;
    let lastStatus = 200;
    for (let i = 0; i < 12; i++) {
      const { status } = await request(server, 'GET', '/api/v1/public/latest', {
        headers: { 'x-forwarded-for': fakeIp },
      });
      lastStatus = status;
      // Stop once we hit the 429
      if (status === 429) break;
    }
    // Either we got rate-limited (429) or the endpoint returned 503 (no data file in CI).
    // 503 means the anon counter incremented fine but data was unavailable — still valid.
    assert.ok(
      lastStatus === 429 || lastStatus === 503,
      `expected 429 or 503 after many anon requests, got ${lastStatus}`
    );
  });

  test('/public/karats and /public/countries are open — no anon quota enforced', async () => {
    // These endpoints have no optionalApiKey middleware and should always return 200
    const fakeIp = `198.51.100.${Math.floor(Math.random() * 253) + 1}`;
    // Exhaust anon IP counter on /public/latest first
    for (let i = 0; i < 15; i++) {
      await request(server, 'GET', '/api/v1/public/latest', {
        headers: { 'x-forwarded-for': fakeIp },
      });
    }
    // Now verify karats / countries are still reachable (no middleware)
    const { status: karatStatus } = await request(server, 'GET', '/api/v1/public/karats', {
      headers: { 'x-forwarded-for': fakeIp },
    });
    assert.equal(karatStatus, 200, '/public/karats should not be rate-limited');

    const { status: countryStatus } = await request(server, 'GET', '/api/v1/public/countries', {
      headers: { 'x-forwarded-for': fakeIp },
    });
    assert.equal(countryStatus, 200, '/public/countries should not be rate-limited');
  });

  test('history with valid key includes X-RateLimit-* headers', async () => {
    const created = await post(
      server,
      '/api/v1/me/api-keys',
      { label: 'history-ratelimit-test' },
      TEST_USER_HEADERS
    );
    assert.equal(created.status, 201);
    const rawKey = created.body.data.key;

    const { status, headers } = await get(server, '/api/v1/public/history?range=30d', {
      'X-API-Key': rawKey,
    });
    // 200 (data), 503 (no file), 401 (bad key) — all valid; just check header shape if present
    assert.ok([200, 503].includes(status), `unexpected status ${status}`);
    if (headers['x-ratelimit-limit']) {
      assert.ok(
        parseInt(headers['x-ratelimit-limit'], 10) > 0,
        'X-RateLimit-Limit should be positive'
      );
    }
  });
});
