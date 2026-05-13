'use strict';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-tests-only';
process.env.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'test-password-1234';
process.env.NODE_ENV = process.env.NODE_ENV || 'production';
process.env.ALERT_EMAIL_DRY_RUN = 'true';

const { test, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gtl-alerts-test-'));
const alertsDataFile = path.join(tmpDir, 'alerts-store.json');
const alertsPriceFile = path.join(tmpDir, 'gold_price.json');
process.env.ALERTS_DATA_FILE = alertsDataFile;
process.env.ALERTS_PRICE_FILE = alertsPriceFile;

const appPath = path.resolve(__dirname, '..', 'server.js');
const app = require(appPath);
const server = app.listen(0);
const port = server.address().port;

after(() => {
  server.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

beforeEach(() => {
  fs.writeFileSync(
    alertsDataFile,
    JSON.stringify(
      {
        alert_rules: [],
        alert_events: [],
        notification_subscriptions: [],
      },
      null,
      2
    )
  );
  fs.writeFileSync(
    alertsPriceFile,
    JSON.stringify(
      {
        xau_usd_per_oz: 2400,
        timestamp_utc: new Date().toISOString(),
        fetched_at_utc: new Date().toISOString(),
        is_fresh: true,
        is_fallback: false,
        provider: 'test-provider',
      },
      null,
      2
    )
  );
});

function request(method, routePath, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        path: routePath,
        method,
        headers: {
          ...(payload
            ? {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload),
              }
            : {}),
          ...headers,
        },
      },
      (res) => {
        let responseBody = '';
        res.on('data', (d) => (responseBody += d));
        res.on('end', () => {
          let parsed = null;
          try {
            parsed = responseBody ? JSON.parse(responseBody) : null;
          } catch {
            parsed = null;
          }
          resolve({ status: res.statusCode, body: parsed, raw: responseBody });
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

test('POST /api/v1/alerts validates create payload', async () => {
  const invalid = await request('POST', '/api/v1/alerts', {
    email: 'bad-email',
    channel: 'email',
    symbol: 'XAUUSD',
    currency: 'USD',
    condition: 'above',
    threshold_value: 2400,
  });
  assert.equal(invalid.status, 400);
  assert.equal(invalid.body?.ok, false);
});

test('alerts create + verify + dry-run check + cooldown skip', async () => {
  const createRes = await request('POST', '/api/v1/alerts', {
    email: 'alerts@example.com',
    channel: 'email',
    symbol: 'XAUUSD',
    currency: 'USD',
    condition: 'below',
    threshold_value: 2450,
    cooldown_minutes: 60,
  });
  assert.equal(createRes.status, 201);
  assert.equal(createRes.body?.ok, true);
  assert.equal(createRes.body?.data?.verifyDelivery, 'dry_run');
  assert.equal(typeof createRes.body?.data?.managementToken, 'string');
  assert.equal(typeof createRes.body?.data?.devVerificationToken, 'string');

  const verifyRes = await request('POST', '/api/v1/alerts/verify', {
    token: createRes.body.data.devVerificationToken,
  });
  assert.equal(verifyRes.status, 200);
  assert.equal(verifyRes.body?.data?.verified, true);
  assert.equal(verifyRes.body?.data?.alert?.is_active, true);

  const run1 = await request('POST', '/api/v1/jobs/check-alerts', { dryRun: true });
  assert.equal(run1.status, 200);
  assert.equal(run1.body?.ok, true);
  assert.equal(run1.body?.data?.triggered, 1);
  assert.equal(run1.body?.data?.sent, 1);
  assert.equal(run1.body?.data?.dryRun, true);

  const run2 = await request('POST', '/api/v1/jobs/check-alerts', { dryRun: true });
  assert.equal(run2.status, 200);
  assert.equal(run2.body?.ok, true);
  assert.equal(run2.body?.data?.triggered, 0);
  assert.equal(run2.body?.data?.sent, 0);
  assert.equal(run2.body?.data?.skipped >= 1, true);

  const store = JSON.parse(fs.readFileSync(alertsDataFile, 'utf8'));
  assert.equal(Array.isArray(store.alert_rules), true);
  assert.equal(store.alert_rules.length >= 1, true);
  store.alert_rules[0].last_triggered_at = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  fs.writeFileSync(alertsDataFile, JSON.stringify(store, null, 2));

  const run3 = await request('POST', '/api/v1/jobs/check-alerts', { dryRun: true });
  assert.equal(run3.status, 200);
  assert.equal(run3.body?.ok, true);
  assert.equal(run3.body?.data?.triggered, 1);
  assert.equal(run3.body?.data?.sent, 1);
});

test('alerts check skips stale/fallback snapshots', async () => {
  fs.writeFileSync(
    alertsPriceFile,
    JSON.stringify(
      {
        xau_usd_per_oz: 2400,
        timestamp_utc: new Date().toISOString(),
        fetched_at_utc: new Date().toISOString(),
        is_fresh: false,
        is_fallback: true,
        provider: 'test-provider',
      },
      null,
      2
    )
  );

  const run = await request('POST', '/api/v1/jobs/check-alerts', { dryRun: true });
  assert.equal(run.status, 202);
  assert.equal(run.body?.ok, true);
  assert.equal(run.body?.data?.skippedReason, 'stale_or_fallback_snapshot');
});

test('alerts unsubscribe deactivates subscriptions via token', async () => {
  const createRes = await request('POST', '/api/v1/alerts', {
    email: 'unsubscribe@example.com',
    channel: 'email',
    symbol: 'XAUUSD',
    currency: 'USD',
    condition: 'above',
    threshold_value: 2600,
  });
  assert.equal(createRes.status, 201);
  const unsubscribeUrl = String(createRes.body?.data?.unsubscribeHint || '');
  const token = unsubscribeUrl.split('token=')[1];
  assert.equal(typeof token, 'string');
  assert.equal(token.length > 10, true);

  const unsubscribe = await request('POST', '/api/v1/alerts/unsubscribe', { token });
  assert.equal(unsubscribe.status, 200);
  assert.equal(unsubscribe.body?.ok, true);
  assert.equal(unsubscribe.body?.data?.unsubscribed, true);
});
