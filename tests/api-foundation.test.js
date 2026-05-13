'use strict';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-tests-only';
process.env.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'test-password-1234';
process.env.NODE_ENV = process.env.NODE_ENV || 'production';

const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');

const appPath = path.resolve(__dirname, '..', 'server.js');
const app = require(appPath);
const server = app.listen(0);
const port = server.address().port;

after(() => {
  server.close();
});

function get(p) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path: p, method: 'GET' }, (res) => {
      let body = '';
      res.on('data', (d) => (body += d));
      res.on('end', () => resolve({ status: res.statusCode, body, headers: res.headers }));
    });
    req.on('error', reject);
    req.end();
  });
}

test('GET /api/v1/health returns standard envelope and system checks', async () => {
  const res = await get('/api/v1/health');
  assert.equal(res.status, 200);
  const parsed = JSON.parse(res.body);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.data.status, 'ok');
  assert.equal(typeof parsed.data.version, 'string');
  assert.equal(typeof parsed.data.environment, 'string');
  assert.equal(typeof parsed.meta.timestamp, 'string');
  assert.equal(typeof parsed.data.checks.dataFileAvailable, 'boolean');
  assert.equal(typeof parsed.data.checks.providerStateFileAvailable, 'boolean');
  assert.equal(typeof parsed.data.checks.supabaseConfigured, 'boolean');
  assert.equal(typeof parsed.data.checks.newsletterConfigured, 'boolean');
  assert.equal(typeof parsed.data.checks.stripeConfigured, 'boolean');
});

test('GET /api/v1/status returns standard envelope and uptime', async () => {
  const res = await get('/api/v1/status');
  assert.equal(res.status, 200);
  const parsed = JSON.parse(res.body);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.data.status, 'ok');
  assert.equal(typeof parsed.data.uptimeSeconds, 'number');
  assert.equal(Array.isArray(parsed.data.warnings), true);
  assert.equal(typeof parsed.meta.timestamp, 'string');
});
