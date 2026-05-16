'use strict';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-tests-only';
process.env.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'test-password-1234';
process.env.PUBLIC_AUTH_TEST_MODE = '1';
process.env.NODE_ENV = 'test';

const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');

const storePath = path.join(os.tmpdir(), `public-accounts-${Date.now()}-${Math.random()}.json`);
process.env.PUBLIC_ACCOUNTS_DATA_FILE = storePath;
const app = require('../server.js');
const server = app.listen(0);
const port = server.address().port;

after(() => {
  server.close();
  if (fs.existsSync(storePath)) fs.unlinkSync(storePath);
});

function request({ method, path: urlPath, userId, userEmail, body, headers = {} }) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        path: urlPath,
        method,
        headers: {
          ...(userId ? { 'x-test-user-id': userId } : {}),
          ...(userEmail ? { 'x-test-user-email': userEmail } : {}),
          ...(body
            ? {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(JSON.stringify(body)),
              }
            : {}),
          ...headers,
        },
      },
      (res) => {
        let data = '';
        res.on('data', (d) => (data += d));
        res.on('end', () => {
          resolve({
            status: res.statusCode,
            json: data ? JSON.parse(data) : null,
          });
        });
      }
    );
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function upsertStore(mutator) {
  const initial = {
    profiles: [],
    user_preferences: [],
    saved_calculations: [],
    watchlists: [],
    saved_shops: [],
    user_sessions: [],
    alert_rules: [],
    notification_subscriptions: [],
    api_keys: [],
    subscriptions: [],
    entitlements: [],
  };
  const store = fs.existsSync(storePath) ? JSON.parse(fs.readFileSync(storePath, 'utf8')) : initial;
  mutator(store);
  fs.writeFileSync(storePath, JSON.stringify(store, null, 2));
}

test('public accounts auth guard blocks unauthorized requests', async () => {
  const response = await request({ method: 'GET', path: '/api/v1/me' });
  assert.equal(response.status, 401);
  assert.equal(response.json.ok, false);
});

test('saved calculations CRUD is user-scoped', async () => {
  const create = await request({
    method: 'POST',
    path: '/api/v1/me/saved-calculations',
    userId: 'user-1',
    userEmail: 'user1@example.com',
    body: {
      tool: 'value',
      label: '22k sample',
      input_data: { weight: 10, karat: '22' },
      output_data: { value: 'AED 2,000' },
    },
  });
  assert.equal(create.status, 201);
  const id = create.json?.data?.item?.id;
  assert.ok(id);

  const list = await request({
    method: 'GET',
    path: '/api/v1/me/saved-calculations',
    userId: 'user-1',
  });
  assert.equal(list.status, 200);
  assert.equal(list.json.data.items.length, 1);

  const otherUserDelete = await request({
    method: 'DELETE',
    path: `/api/v1/me/saved-calculations/${id}`,
    userId: 'user-2',
  });
  assert.equal(otherUserDelete.status, 404);

  const deleteOwn = await request({
    method: 'DELETE',
    path: `/api/v1/me/saved-calculations/${id}`,
    userId: 'user-1',
  });
  assert.equal(deleteOwn.status, 200);
});

test('watchlist CRUD works and unauthorized tokens are rejected', async () => {
  const badToken = await request({
    method: 'GET',
    path: '/api/v1/me/watchlist',
  });
  assert.equal(badToken.status, 401);

  const create = await request({
    method: 'POST',
    path: '/api/v1/me/watchlist',
    userId: 'user-1',
    body: {
      item_type: 'currency',
      item_key: 'AED',
      item_label: 'AED watch',
    },
  });
  assert.equal(create.status, 201);
  const id = create.json?.data?.item?.id;
  assert.ok(id);

  const list = await request({
    method: 'GET',
    path: '/api/v1/me/watchlist',
    userId: 'user-1',
  });
  assert.equal(list.status, 200);
  assert.equal(list.json.data.items.length, 1);

  const del = await request({
    method: 'DELETE',
    path: `/api/v1/me/watchlist/${id}`,
    userId: 'user-1',
  });
  assert.equal(del.status, 200);
});

test('GET /api/v1/me/export rejects unauthorized requests', async () => {
  const response = await request({ method: 'GET', path: '/api/v1/me/export' });
  assert.equal(response.status, 401);
  assert.equal(response.json?.ok, false);
});

test('DELETE /api/v1/me rejects unauthorized requests', async () => {
  const response = await request({ method: 'DELETE', path: '/api/v1/me' });
  assert.equal(response.status, 401);
  assert.equal(response.json?.ok, false);
});

test('DELETE /api/v1/me requires explicit confirmation payload', async () => {
  const response = await request({
    method: 'DELETE',
    path: '/api/v1/me',
    userId: 'confirm-user',
    userEmail: 'confirm-user@example.com',
  });
  assert.equal(response.status, 400);
  assert.equal(response.json?.ok, false);
});

test('DELETE /api/v1/me blocks admin/editor role users', async () => {
  const response = await request({
    method: 'DELETE',
    path: '/api/v1/me',
    userId: 'admin-user',
    userEmail: 'admin-user@example.com',
    headers: { 'x-test-user-role': 'admin', 'x-delete-confirm': 'DELETE' },
    body: { confirm: 'DELETE' },
  });
  assert.equal(response.status, 403);
  assert.equal(response.json?.ok, false);

  const forbiddenEditor = await request({
    method: 'DELETE',
    path: '/api/v1/me',
    userId: 'editor-user',
    userEmail: 'editor-user@example.com',
    headers: { 'x-test-user-role': 'editor', 'x-delete-confirm': 'DELETE' },
    body: { confirm: 'DELETE' },
  });
  assert.equal(forbiddenEditor.status, 403);
  assert.equal(forbiddenEditor.json?.ok, false);
});

test('GET /api/v1/me/export returns account data and excludes sensitive fields', async () => {
  await request({
    method: 'POST',
    path: '/api/v1/me/saved-calculations',
    userId: 'export-user',
    userEmail: 'export-user@example.com',
    body: {
      tool: 'value',
      label: 'Export sample',
      input_data: { weight: 10, karat: '24' },
      output_data: { value: 'AED 3000' },
    },
  });
  await request({
    method: 'POST',
    path: '/api/v1/me/watchlist',
    userId: 'export-user',
    userEmail: 'export-user@example.com',
    body: {
      item_type: 'currency',
      item_key: 'AED',
      item_label: 'AED',
    },
  });
  await request({
    method: 'POST',
    path: '/api/v1/me/saved-shops',
    userId: 'export-user',
    userEmail: 'export-user@example.com',
    body: {
      shop_id: 'shop-1',
      shop_name: 'Demo Shop',
    },
  });
  await request({
    method: 'POST',
    path: '/api/v1/alerts',
    body: {
      user_id: 'export-user',
      email: 'export-user@example.com',
      channel: 'email',
      symbol: 'XAUUSD',
      currency: 'USD',
      condition: 'above',
      threshold_value: 2600,
    },
  });
  upsertStore((store) => {
    store.alert_rules.push({
      id: 'legacy-email-alert-export',
      user_id: null,
      email: 'export-user@example.com',
      channel: 'email',
      symbol: 'XAUUSD',
      currency: 'USD',
      condition: 'below',
      threshold_value: 2000,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  });

  const exportRes = await request({
    method: 'GET',
    path: '/api/v1/me/export',
    userId: 'export-user',
    userEmail: 'export-user@example.com',
  });

  assert.equal(exportRes.status, 200);
  assert.equal(exportRes.json?.ok, true);
  const data = exportRes.json?.data || {};
  assert.equal(typeof data.exportedAt, 'string');
  assert.equal(data.user?.id, 'export-user');
  assert.equal(Array.isArray(data.savedCalculations), true);
  assert.equal(Array.isArray(data.watchlist), true);
  assert.equal(Array.isArray(data.savedShops), true);
  assert.equal(Array.isArray(data.alertRules), true);
  assert.equal(
    data.alertRules.some((row) => row.email === 'export-user@example.com'),
    true
  );
  assert.equal(Array.isArray(data.notificationSubscriptions), true);
  assert.equal(Array.isArray(data.apiKeys), true);
  assert.equal(typeof data.subscriptions, 'object');
  assert.equal(typeof data.entitlements, 'object');

  const serialized = JSON.stringify(data);
  assert.equal(serialized.includes('key_hash'), false);
  assert.equal(serialized.includes('management_token_hash'), false);
  assert.equal(serialized.includes('verification_token_hash'), false);
  assert.equal(serialized.includes('unsubscribe_token_hash'), false);
  assert.equal(serialized.includes('SUPABASE_SERVICE_ROLE_KEY'), false);
  assert.equal(
    Array.isArray(data.apiKeys) &&
      data.apiKeys.some((row) => row?.key_hash || row?.keyHash || row?.key),
    false
  );
  assert.equal(
    Array.isArray(data.alertRules) &&
      data.alertRules.some(
        (row) =>
          row?.management_token_hash || row?.managementTokenHash || row?.verification_token_hash
      ),
    false
  );
  assert.equal(
    Array.isArray(data.notificationSubscriptions) &&
      data.notificationSubscriptions.some(
        (row) => row?.unsubscribe_token_hash || row?.unsubscribeTokenHash
      ),
    false
  );
});

test('DELETE /api/v1/me removes account data, safe-modes auth deletion, and is idempotent', async () => {
  await request({
    method: 'POST',
    path: '/api/v1/me/saved-calculations',
    userId: 'delete-user',
    userEmail: 'delete-user@example.com',
    body: {
      tool: 'value',
      label: 'Delete sample',
      input_data: { weight: 1, karat: '24' },
      output_data: { value: 'AED 300' },
    },
  });
  await request({
    method: 'POST',
    path: '/api/v1/me/watchlist',
    userId: 'delete-user',
    userEmail: 'delete-user@example.com',
    body: {
      item_type: 'currency',
      item_key: 'USD',
      item_label: 'USD',
    },
  });
  await request({
    method: 'POST',
    path: '/api/v1/me/saved-shops',
    userId: 'delete-user',
    userEmail: 'delete-user@example.com',
    body: {
      shop_id: 'shop-delete',
      shop_name: 'Delete Shop',
    },
  });

  await request({
    method: 'POST',
    path: '/api/v1/alerts',
    body: {
      email: 'delete-user@example.com',
      channel: 'email',
      symbol: 'XAUUSD',
      currency: 'USD',
      condition: 'above',
      threshold_value: 2800,
    },
  });
  upsertStore((store) => {
    store.alert_rules.push({
      id: 'legacy-email-alert-delete',
      user_id: null,
      email: 'delete-user@example.com',
      channel: 'email',
      symbol: 'XAUUSD',
      currency: 'USD',
      condition: 'above',
      threshold_value: 2800,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  });

  const deleteRes = await request({
    method: 'DELETE',
    path: '/api/v1/me',
    userId: 'delete-user',
    userEmail: 'delete-user@example.com',
    headers: { 'x-delete-confirm': 'DELETE' },
    body: { confirm: 'DELETE' },
  });
  assert.equal(deleteRes.status, 200);
  assert.equal(deleteRes.json?.ok, true);
  assert.equal(deleteRes.json?.data?.auth?.mode, 'safe_mode');
  assert.equal(deleteRes.json?.data?.auth?.userDeleted, false);
  assert.equal(deleteRes.json?.data?.auth?.sessionInvalidated, false);
  assert.ok(deleteRes.json?.data?.deleted?.saved_calculations > 0);
  assert.ok(deleteRes.json?.data?.deleted?.watchlists > 0);
  assert.ok(deleteRes.json?.data?.deleted?.saved_shops > 0);
  assert.ok(deleteRes.json?.data?.deleted?.alert_rules > 0);

  const meAfterDelete = await request({
    method: 'GET',
    path: '/api/v1/me',
    userId: 'delete-user',
    userEmail: 'delete-user@example.com',
  });
  assert.equal(meAfterDelete.status, 200);
  assert.equal(meAfterDelete.json?.data?.counts?.savedCalculations, 0);
  assert.equal(meAfterDelete.json?.data?.counts?.watchlist, 0);
  assert.equal(meAfterDelete.json?.data?.counts?.savedShops, 0);

  const secondDelete = await request({
    method: 'DELETE',
    path: '/api/v1/me',
    userId: 'delete-user',
    userEmail: 'delete-user@example.com',
    headers: { 'x-delete-confirm': 'DELETE' },
    body: { confirm: 'DELETE' },
  });
  assert.equal(secondDelete.status, 200);
  assert.equal(secondDelete.json?.ok, true);
  assert.equal(secondDelete.json?.data?.deleted?.saved_calculations, 0);
  assert.equal(secondDelete.json?.data?.deleted?.watchlists, 0);
  assert.equal(secondDelete.json?.data?.deleted?.saved_shops, 0);
});
