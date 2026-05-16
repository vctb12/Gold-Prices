'use strict';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-tests-only';
process.env.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'test-password-1234';
process.env.NODE_ENV = process.env.NODE_ENV || 'production';
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const { __testables } = require('../server/routes/api-v1');

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
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

test('GET /api/v1/prices/latest returns latest price payload with file fallback mode', async () => {
  const res = await get('/api/v1/prices/latest');
  assert.equal(res.status, 200);
  const parsed = JSON.parse(res.body);
  assert.equal(parsed.ok, true);
  assert.equal(typeof parsed.data.xauUsdPerOz, 'number');
  assert.equal(parsed.data.sourceMode, 'file');
});

test('GET /api/v1/prices/history returns range-aware response', async () => {
  const res = await get('/api/v1/prices/history?range=7d');
  assert.equal(res.status, 200);
  const parsed = JSON.parse(res.body);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.data.range, '7d');
  assert.equal(Array.isArray(parsed.data.points), true);
  assert.equal(parsed.meta.source, 'static-baseline');
});

test('GET /api/v1/prices/history applies range window in file fallback mode', async () => {
  const res = await get('/api/v1/prices/history?range=30d&limit=5000');
  assert.equal(res.status, 200);
  const parsed = JSON.parse(res.body);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.data.range, '30d');
  assert.equal(parsed.data.historySource, 'static-baseline');
  assert.equal(parsed.data.fallback, true);
  assert.equal(parsed.meta.coveragePoints, parsed.data.points.length);
  if (parsed.data.points.length > 0) {
    assert.equal(typeof parsed.meta.coverageStartUtc, 'string');
    assert.equal(typeof parsed.meta.coverageEndUtc, 'string');
  } else {
    assert.equal(parsed.meta.coverageStartUtc, null);
    assert.equal(parsed.meta.coverageEndUtc, null);
  }
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  for (const point of parsed.data.points) {
    const ts = new Date(point.timestampUtc).getTime();
    assert.equal(Number.isFinite(ts), true);
    assert.equal(ts >= cutoff, true);
  }
});

test('buildHistoryResponse prefers Supabase rows and labels source explicitly', () => {
  const { body, status } = __testables.buildHistoryResponse({
    range: '7d',
    limit: 120,
    supabaseRows: [
      {
        timestamp_utc: '2026-05-15T00:00:00.000Z',
        fetched_at_utc: '2026-05-15T00:02:00.000Z',
        xau_usd_per_oz: 3200.55,
        xau_aed_per_gram: 377.11,
        source_provider: 'supabase-feed',
        freshness_seconds: 120,
        is_fresh: true,
        is_fallback: false,
      },
    ],
    baselineHistory: null,
    latestPricePayload: null,
  });
  assert.equal(status, 200);
  assert.equal(body.meta.source, 'supabase');
  assert.equal(body.data.historySource, 'supabase');
  assert.equal(body.data.coverage.providerBacked, true);
});

test('buildHistoryResponse falls back to JSON snapshot when baseline is unavailable', () => {
  const { body, status } = __testables.buildHistoryResponse({
    range: '7d',
    limit: 120,
    supabaseRows: null,
    baselineHistory: null,
    latestPricePayload: {
      provider: 'file-provider',
      xau_usd_per_oz: 3210.45,
      aed_per_gram_24k: 378.22,
      timestamp_utc: '2026-05-15T00:00:00.000Z',
      fetched_at_utc: '2026-05-15T00:05:00.000Z',
      freshness_seconds: 300,
      is_fresh: true,
      is_fallback: false,
    },
  });
  assert.equal(status, 200);
  assert.equal(body.meta.source, 'json-fallback');
  assert.equal(body.meta.freshness, 'fallback');
  assert.equal(body.data.coverage.snapshotFallback, true);
  assert.equal(body.data.points.length, 1);
});

test('buildHistoryResponse returns an explicit empty source when no history data exists', () => {
  const { body, status } = __testables.buildHistoryResponse({
    range: '7d',
    limit: 120,
    supabaseRows: null,
    baselineHistory: null,
    latestPricePayload: null,
  });
  assert.equal(status, 200);
  assert.equal(body.meta.source, 'empty');
  assert.equal(body.data.points.length, 0);
  assert.equal(body.data.coverage.empty, true);
});

test('GET /api/v1/providers/status returns provider status envelope', async () => {
  const res = await get('/api/v1/providers/status');
  assert.equal(res.status, 200);
  const parsed = JSON.parse(res.body);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.data.sourceMode, 'file');
});

test('GET /api/v1/providers/runs requires admin auth', async () => {
  const res = await get('/api/v1/providers/runs?limit=10');
  assert.equal(res.status, 401);
  const parsed = JSON.parse(res.body);
  assert.equal(parsed.ok === false || parsed.success === false, true);
});

test('GET /api/v1/prices/snapshots returns fallback snapshot from local JSON', async () => {
  const res = await get('/api/v1/prices/snapshots?limit=1');
  assert.equal(res.status, 200);
  const parsed = JSON.parse(res.body);
  assert.equal(parsed.ok, true);
  assert.equal(Array.isArray(parsed.data.snapshots), true);
  assert.equal(parsed.data.sourceMode, 'file');
});
