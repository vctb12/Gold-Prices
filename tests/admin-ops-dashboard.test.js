'use strict';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-tests-only';
process.env.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'test-password-1234';
process.env.NODE_ENV = process.env.NODE_ENV || 'production';

const { test, after, before } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const app = require(path.resolve(__dirname, '..', 'server.js'));
const auth = require(path.resolve(__dirname, '..', 'server', 'lib', 'auth.js'));
const pendingRepo = require(
  path.resolve(__dirname, '..', 'server', 'repositories', 'pending-shops.repository.js')
);

const AUDIT_LOG_FILE = path.join(__dirname, '..', 'data', 'audit-logs.json');
const PENDING_FILE = path.join(__dirname, '..', 'data', 'pending_shops.json');

let auditBackup = null;
let pendingBackup = null;

before(() => {
  if (fs.existsSync(AUDIT_LOG_FILE)) auditBackup = fs.readFileSync(AUDIT_LOG_FILE, 'utf8');
  if (fs.existsSync(PENDING_FILE)) pendingBackup = fs.readFileSync(PENDING_FILE, 'utf8');
});

const server = app.listen(0);
const port = server.address().port;

after(() => {
  server.close();
  if (auditBackup !== null) fs.writeFileSync(AUDIT_LOG_FILE, auditBackup);
  else if (fs.existsSync(AUDIT_LOG_FILE)) fs.unlinkSync(AUDIT_LOG_FILE);
  if (pendingBackup !== null) fs.writeFileSync(PENDING_FILE, pendingBackup);
  else if (fs.existsSync(PENDING_FILE)) fs.unlinkSync(PENDING_FILE);
});

function request(method, routePath, { token, body } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        path: routePath,
        method,
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
      },
      (res) => {
        let text = '';
        res.on('data', (chunk) => (text += chunk));
        res.on('end', () => {
          let json = null;
          try {
            json = text ? JSON.parse(text) : null;
          } catch {
            json = null;
          }
          resolve({ status: res.statusCode, body: json, raw: text });
        });
      }
    );
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function getAdminToken() {
  const adminUser = auth.getAllUsers().find((user) => user.role === 'admin');
  assert.ok(adminUser, 'expected at least one admin user');
  return auth.generateToken({
    id: adminUser.id,
    email: adminUser.email,
    role: adminUser.role,
    tokenVersion: adminUser.tokenVersion,
  });
}

test('GET /api/v1/admin/ops/control-center requires admin auth', async () => {
  const res = await request('GET', '/api/v1/admin/ops/control-center');
  assert.equal(res.status, 401);
});

test('GET /api/v1/admin/ops/control-center returns module payload for admin token', async () => {
  const token = getAdminToken();
  const res = await request('GET', '/api/v1/admin/ops/control-center', { token });
  assert.equal(res.status, 200);
  assert.equal(res.body?.success, true);
  assert.ok(res.body?.data?.modules, 'modules payload should exist');
  assert.ok(res.body.data.modules.providerHealth, 'providerHealth module should exist');
  assert.ok(res.body.data.modules.priceSnapshots, 'priceSnapshots module should exist');
  assert.ok(res.body.data.modules.audit, 'audit module should exist');
});

test('POST /api/v1/admin/ops/shops-moderation/:id/reject logs audit with before/after state', async () => {
  const id = `pending_test_${crypto.randomUUID()}`;
  pendingRepo.insert({
    id,
    shop_name: 'Test Pending Shop',
    contact_email: 'owner@example.com',
    city: 'Dubai',
    country_code: 'AE',
    status: 'pending',
    submitted_at: new Date().toISOString(),
  });

  const token = getAdminToken();
  const res = await request('POST', `/api/v1/admin/ops/shops-moderation/${id}/reject`, {
    token,
    body: { reason: 'Missing verification details' },
  });
  assert.equal(res.status, 200);
  assert.equal(res.body?.success, true);
  assert.equal(res.body?.submission?.status, 'rejected');

  const logs = JSON.parse(fs.readFileSync(AUDIT_LOG_FILE, 'utf8'));
  const row = [...logs]
    .reverse()
    .find((entry) => entry?.entityType === 'pending_shop' && entry?.entityId === id);
  assert.ok(row, 'expected moderation audit entry');
  assert.equal(row.action, 'reject');
  assert.equal(row.changes?.before?.status, 'pending');
  assert.equal(row.changes?.after?.status, 'rejected');
});
