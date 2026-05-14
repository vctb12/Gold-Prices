'use strict';

/**
 * AI Drafts — Integration & Unit Tests (Phase 11)
 *
 * Covers:
 *  - Draft schema validation (required fields present)
 *  - No auto-publish (status always starts as "draft")
 *  - Timestamp required in generated drafts
 *  - Trust language required (spot/reference wording, disclaimer)
 *  - Arabic + English fields required
 *  - Anomaly flag logic (spike, stale, fallback detection)
 *  - Admin API: generate, list, get, approve, reject, edit, publish, audit-log
 *  - Auth protection on all AI draft endpoints
 */

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-ai-drafts';
process.env.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'test-password-ai-drafts';
process.env.ADMIN_ACCESS_PIN = process.env.ADMIN_ACCESS_PIN || '123456';
process.env.NODE_ENV = 'test';

const { test, describe, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

// ---------------------------------------------------------------------------
// Isolated tmp storage
// ---------------------------------------------------------------------------

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gtl-ai-drafts-test-'));
const draftsDataFile = path.join(tmpDir, 'ai-drafts.json');
process.env.AI_DRAFTS_DATA_FILE = draftsDataFile;

// Disable anomaly detection thresholds that would affect test data
process.env.ANOMALY_SPIKE_THRESHOLD_PCT = '999';
process.env.ANOMALY_DRIFT_THRESHOLD_PCT = '999';
process.env.ANOMALY_EXTREME_THRESHOLD_PCT = '999';

const appPath = path.resolve(__dirname, '..', 'server.js');
const app = require(appPath);
const server = app.listen(0);
const port = server.address().port;

after(() => {
  server.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function _resetDrafts() {
  fs.writeFileSync(draftsDataFile, JSON.stringify({ schema_version: 1, drafts: [] }, null, 2));
}

beforeEach(() => {
  _resetDrafts();
});

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

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
            ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
            : {}),
          ...headers,
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          let json = null;
          try {
            json = JSON.parse(data);
          } catch {}
          resolve({ status: res.statusCode, body: json, raw: data });
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function getAdminToken() {
  const res = await request('POST', '/api/admin/auth/login', {
    email: 'admin@goldprices.com',
    password: process.env.ADMIN_PASSWORD,
  });
  return res.body?.token;
}

function authHeader(token) {
  return { Authorization: `Bearer ${token}` };
}

// ---------------------------------------------------------------------------
// Unit tests — repository
// ---------------------------------------------------------------------------

describe('ai-drafts repository', () => {
  const repo = require('../server/repositories/ai-drafts.repository');

  test('insertDraft always sets status=draft', () => {
    const draft = repo.insertDraft({
      type: 'daily_summary',
      title_en: 'Test EN',
      title_ar: 'اختبار',
      body_en: 'Body EN',
      body_ar: 'نص عربي',
      data_timestamp_utc: new Date().toISOString(),
    });
    assert.equal(draft.status, 'draft', 'Status must be "draft" on insert');
    assert.equal(draft.is_spot_estimate, true, 'is_spot_estimate must be true');
  });

  test('insertDraft generates a unique id', () => {
    const d1 = repo.insertDraft({
      type: 'x_post',
      title_en: 'A',
      title_ar: 'أ',
      body_en: 'b',
      body_ar: 'ب',
      data_timestamp_utc: new Date().toISOString(),
    });
    const d2 = repo.insertDraft({
      type: 'x_post',
      title_en: 'A',
      title_ar: 'أ',
      body_en: 'b',
      body_ar: 'ب',
      data_timestamp_utc: new Date().toISOString(),
    });
    assert.notEqual(d1.id, d2.id);
  });

  test('getDraftById returns null for unknown id', () => {
    assert.equal(repo.getDraftById('nonexistent'), null);
  });

  test('transitionDraft: draft → approved', () => {
    const draft = repo.insertDraft({
      type: 'seo_brief',
      title_en: 'T',
      title_ar: 'ت',
      body_en: 'B',
      body_ar: 'ب',
      data_timestamp_utc: new Date().toISOString(),
    });
    const approved = repo.transitionDraft(draft.id, 'approved', {
      actor: 'editor@test.com',
      note: 'looks good',
    });
    assert.equal(approved.status, 'approved');
    assert.equal(approved.reviewed_by, 'editor@test.com');
    assert.equal(approved.review_action, 'approved');
    assert.ok(approved.audit_trail.length >= 1);
  });

  test('transitionDraft: approved → published sets published_at_utc', () => {
    const draft = repo.insertDraft({
      type: 'newsletter_block',
      title_en: 'T',
      title_ar: 'ت',
      body_en: 'B',
      body_ar: 'ب',
      data_timestamp_utc: new Date().toISOString(),
    });
    repo.transitionDraft(draft.id, 'approved', { actor: 'a@b.com' });
    const published = repo.transitionDraft(draft.id, 'published', {
      actor: 'a@b.com',
      export_channel: 'newsletter',
    });
    assert.equal(published.status, 'published');
    assert.ok(published.published_at_utc, 'published_at_utc must be set');
    assert.equal(published.export_channel, 'newsletter');
  });

  test('updateDraft only modifies allowed fields', () => {
    const draft = repo.insertDraft({
      type: 'daily_summary',
      title_en: 'Original',
      title_ar: 'أصلي',
      body_en: 'old',
      body_ar: 'قديم',
      data_timestamp_utc: new Date().toISOString(),
    });
    repo.updateDraft(draft.id, { title_en: 'Updated', status: 'published' }); // status is not allowed
    const updated = repo.getDraftById(draft.id);
    assert.equal(updated.title_en, 'Updated');
    assert.equal(updated.status, 'draft', 'status must not be changed via updateDraft');
  });

  test('getDraftCounts returns accurate totals', () => {
    repo.insertDraft({
      type: 'x_post',
      title_en: 'A',
      title_ar: 'أ',
      body_en: 'b',
      body_ar: 'ب',
      data_timestamp_utc: new Date().toISOString(),
    });
    const counts = repo.getDraftCounts();
    assert.equal(counts.draft, 1);
    assert.equal(counts.total, 1);
  });
});

// ---------------------------------------------------------------------------
// Unit tests — anomaly detector
// ---------------------------------------------------------------------------

describe('anomaly-detector', () => {
  const {
    detectAnomaly,
    _extractPriceUsdOz,
    _pctChange,
  } = require('../server/lib/anomaly-detector');

  test('_extractPriceUsdOz returns null for missing data', () => {
    assert.equal(_extractPriceUsdOz(null), null);
    assert.equal(_extractPriceUsdOz({}), null);
    assert.equal(_extractPriceUsdOz({ xau_usd_per_oz: 'invalid' }), null);
  });

  test('_extractPriceUsdOz extracts from xau_usd_per_oz', () => {
    assert.equal(_extractPriceUsdOz({ xau_usd_per_oz: 1800.5 }), 1800.5);
  });

  test('_extractPriceUsdOz extracts from gold.ounce_usd', () => {
    assert.equal(_extractPriceUsdOz({ gold: { ounce_usd: 1900.0 } }), 1900.0);
  });

  test('_pctChange returns null when from is 0', () => {
    assert.equal(_pctChange(0, 100), null);
  });

  test('_pctChange computes correct percentage', () => {
    const pct = _pctChange(1000, 1030);
    assert.ok(Math.abs(pct - 3.0) < 0.001);
  });

  test('detectAnomaly: no anomaly when no previous price', () => {
    const result = detectAnomaly(
      { xau_usd_per_oz: 1800, is_fresh: true, is_fallback: false },
      null
    );
    assert.equal(typeof result.anomaly_flag, 'boolean');
    assert.ok(Object.prototype.hasOwnProperty.call(result, 'checked_at_utc'));
  });

  test('detectAnomaly: flags stale data', () => {
    const result = detectAnomaly(
      { xau_usd_per_oz: 1800, is_fresh: false, is_fallback: false },
      null
    );
    assert.equal(result.anomaly_flag, true);
    assert.ok(result.anomaly_detail, 'anomaly_detail must be set when flagged');
  });

  test('detectAnomaly: flags fallback provider', () => {
    const result = detectAnomaly({ xau_usd_per_oz: 1800, is_fresh: true, is_fallback: true }, null);
    assert.equal(result.anomaly_flag, true);
  });

  test('detectAnomaly result has all required fields', () => {
    const result = detectAnomaly({ xau_usd_per_oz: 1800, is_fresh: true }, null);
    for (const field of [
      'anomaly_flag',
      'anomaly_detail',
      'anomaly_reasons',
      'current_price_usd_oz',
      'checked_at_utc',
    ]) {
      assert.ok(Object.prototype.hasOwnProperty.call(result, field), `Missing field: ${field}`);
    }
  });
});

// ---------------------------------------------------------------------------
// Unit tests — draft generation service
// ---------------------------------------------------------------------------

describe('ai-drafts service — generateDraft', () => {
  const svc = require('../server/services/ai-drafts');
  const repo = require('../server/repositories/ai-drafts.repository');

  const MOCK_PRICE = {
    xau_usd_per_oz: 3200.5,
    aed_per_gram_24k: 380.1,
    aed_peg: 3.6725,
    timestamp_utc: '2026-01-01T12:00:00Z',
    fetched_at_utc: '2026-01-01T12:00:17Z',
    is_fresh: true,
    is_fallback: false,
    provider: 'test_provider',
    gold: { ounce_usd: 3200.5, ounce_aed: 11752, gram_aed: 380.1 },
    karats_aed_per_gram: { '24k': 380.1, '22k': 348.4, '21k': 332.6, '18k': 285.1 },
  };

  test('generateDraft returns a draft with status=draft (never auto-publishes)', () => {
    const draft = svc.generateDraft('daily_summary', { currentPrice: MOCK_PRICE });
    assert.equal(draft.status, 'draft', 'Generated draft must start as "draft"');
  });

  test('generateDraft includes data_timestamp_utc', () => {
    const draft = svc.generateDraft('daily_summary', { currentPrice: MOCK_PRICE });
    assert.ok(draft.data_timestamp_utc, 'data_timestamp_utc must be set');
  });

  test('generateDraft includes both EN and AR body', () => {
    const draft = svc.generateDraft('daily_summary', { currentPrice: MOCK_PRICE });
    assert.ok(draft.body_en && draft.body_en.length > 20, 'body_en must be non-trivial');
    assert.ok(draft.body_ar && draft.body_ar.length > 20, 'body_ar must be non-trivial');
  });

  test('generateDraft body_en contains spot/reference disclaimer', () => {
    const draft = svc.generateDraft('daily_summary', { currentPrice: MOCK_PRICE });
    const hasDisclaimer =
      draft.body_en.includes('spot') ||
      draft.body_en.includes('estimate') ||
      draft.body_en.includes('reference');
    assert.ok(hasDisclaimer, 'body_en must contain trust language (spot/estimate/reference)');
  });

  test('generateDraft body_ar contains Arabic trust language', () => {
    const draft = svc.generateDraft('daily_summary', { currentPrice: MOCK_PRICE });
    const hasArabicTrust =
      draft.body_ar.includes('تقديري') ||
      draft.body_ar.includes('مرجعي') ||
      draft.body_ar.includes('الفوري');
    assert.ok(hasArabicTrust, 'body_ar must contain Arabic trust language');
  });

  test('generateDraft sets is_spot_estimate=true', () => {
    const draft = svc.generateDraft('x_post', { currentPrice: MOCK_PRICE });
    assert.equal(draft.is_spot_estimate, true);
  });

  test('generateDraft sets anomaly_flag when price is stale', () => {
    const stalePrice = { ...MOCK_PRICE, is_fresh: false };
    const draft = svc.generateDraft('daily_summary', { currentPrice: stalePrice });
    assert.equal(draft.anomaly_flag, true, 'Stale price must set anomaly_flag');
    assert.ok(draft.anomaly_detail, 'anomaly_detail must be set when flagged');
  });

  test('generateDraft does not set anomaly_flag for clean fresh data', () => {
    const draft = svc.generateDraft('daily_summary', {
      currentPrice: MOCK_PRICE,
      prevPrice: { ...MOCK_PRICE, xau_usd_per_oz: 3200.5 },
    });
    assert.equal(draft.anomaly_flag, false);
  });

  test('generateDraft: all seven types produce a draft', () => {
    const types = repo.DRAFT_TYPES;
    for (const type of types) {
      const draft = svc.generateDraft(type, { currentPrice: MOCK_PRICE });
      assert.equal(draft.type, type, `Draft type mismatch for ${type}`);
      assert.equal(draft.status, 'draft');
      assert.ok(draft.body_en, `body_en missing for type ${type}`);
      assert.ok(draft.body_ar, `body_ar missing for type ${type}`);
    }
  });

  test('generateDrafts returns one draft per type', () => {
    const drafts = svc.generateDrafts(['daily_summary', 'x_post'], { currentPrice: MOCK_PRICE });
    assert.equal(drafts.length, 2);
    assert.equal(drafts[0].type, 'daily_summary');
    assert.equal(drafts[1].type, 'x_post');
  });

  test('generateDraft: x_post body_en contains DRAFT notice', () => {
    const draft = svc.generateDraft('x_post', { currentPrice: MOCK_PRICE });
    assert.ok(
      draft.body_en.toUpperCase().includes('DRAFT') ||
        draft.body_en.includes('review required') ||
        draft.body_en.includes('Human review'),
      'x_post body_en must contain draft/review notice'
    );
  });

  test('generateDraft throws on unknown type', () => {
    assert.throws(
      () => svc.generateDraft('invalid_type', { currentPrice: MOCK_PRICE }),
      /Unknown draft type/
    );
  });
});

// ---------------------------------------------------------------------------
// API integration tests — admin auth required
// ---------------------------------------------------------------------------

describe('AI drafts admin API — auth protection', () => {
  test('GET /api/admin/ai-drafts requires auth', async () => {
    const res = await request('GET', '/api/admin/ai-drafts');
    assert.ok([401, 403].includes(res.status), `Expected 401/403, got ${res.status}`);
  });

  test('POST /api/admin/ai-drafts/generate requires auth', async () => {
    const res = await request('POST', '/api/admin/ai-drafts/generate', { types: ['x_post'] });
    assert.ok([401, 403].includes(res.status));
  });

  test('POST /api/admin/ai-drafts/:id/approve requires auth', async () => {
    const res = await request('POST', '/api/admin/ai-drafts/fake-id/approve');
    assert.ok([401, 403].includes(res.status));
  });
});

describe('AI drafts admin API — generate + lifecycle', () => {
  let adminToken;

  test('setup: get admin token', async () => {
    adminToken = await getAdminToken();
    assert.ok(adminToken, 'Admin token must be obtained');
  });

  test('POST /api/admin/ai-drafts/generate creates drafts with status=draft', async () => {
    const token = await getAdminToken();
    const res = await request(
      'POST',
      '/api/admin/ai-drafts/generate',
      { types: ['daily_summary', 'x_post'] },
      authHeader(token)
    );
    assert.equal(res.status, 201, `Expected 201, got ${res.status}: ${JSON.stringify(res.body)}`);
    assert.equal(res.body.generated, 2);
    for (const draft of res.body.drafts) {
      assert.equal(draft.status, 'draft', 'All generated drafts must start as draft');
      assert.ok(draft.data_timestamp_utc, 'data_timestamp_utc must be present');
      assert.equal(draft.is_spot_estimate, true);
    }
  });

  test('POST /api/admin/ai-drafts/generate rejects invalid type', async () => {
    const token = await getAdminToken();
    const res = await request(
      'POST',
      '/api/admin/ai-drafts/generate',
      { types: ['fake_type'] },
      authHeader(token)
    );
    assert.equal(res.status, 400);
  });

  test('GET /api/admin/ai-drafts returns draft list', async () => {
    const token = await getAdminToken();
    // Generate one first
    await request(
      'POST',
      '/api/admin/ai-drafts/generate',
      { types: ['seo_brief'] },
      authHeader(token)
    );

    const res = await request('GET', '/api/admin/ai-drafts', null, authHeader(token));
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.drafts));
    assert.ok(typeof res.body.total === 'number');
    assert.ok(res.body.counts);
  });

  test('GET /api/admin/ai-drafts supports status filter', async () => {
    const token = await getAdminToken();
    await request(
      'POST',
      '/api/admin/ai-drafts/generate',
      { types: ['daily_summary'] },
      authHeader(token)
    );

    const res = await request('GET', '/api/admin/ai-drafts?status=draft', null, authHeader(token));
    assert.equal(res.status, 200);
    for (const d of res.body.drafts) {
      assert.equal(d.status, 'draft');
    }
  });

  test('GET /api/admin/ai-drafts/:id returns draft detail', async () => {
    const token = await getAdminToken();
    const genRes = await request(
      'POST',
      '/api/admin/ai-drafts/generate',
      { types: ['newsletter_block'] },
      authHeader(token)
    );
    const draftId = genRes.body.drafts[0].id;

    const res = await request('GET', `/api/admin/ai-drafts/${draftId}`, null, authHeader(token));
    assert.equal(res.status, 200);
    assert.equal(res.body.draft.id, draftId);
    assert.ok(res.body.draft.body_en);
    assert.ok(res.body.draft.body_ar);
  });

  test('GET /api/admin/ai-drafts/:id returns 404 for unknown id', async () => {
    const token = await getAdminToken();
    const res = await request(
      'GET',
      '/api/admin/ai-drafts/nonexistent-id',
      null,
      authHeader(token)
    );
    assert.equal(res.status, 404);
  });

  test('PATCH /api/admin/ai-drafts/:id edits title and body', async () => {
    const token = await getAdminToken();
    const genRes = await request(
      'POST',
      '/api/admin/ai-drafts/generate',
      { types: ['seo_brief'] },
      authHeader(token)
    );
    const draftId = genRes.body.drafts[0].id;

    const res = await request(
      'PATCH',
      `/api/admin/ai-drafts/${draftId}`,
      { title_en: 'Edited Title EN', title_ar: 'عنوان معدل' },
      authHeader(token)
    );
    assert.equal(res.status, 200);
    assert.equal(res.body.draft.title_en, 'Edited Title EN');
    assert.equal(res.body.draft.title_ar, 'عنوان معدل');
    assert.equal(res.body.draft.status, 'draft', 'Edit must not change status');
  });

  test('POST /api/admin/ai-drafts/:id/approve transitions to approved', async () => {
    const token = await getAdminToken();
    const genRes = await request(
      'POST',
      '/api/admin/ai-drafts/generate',
      { types: ['weekly_summary'] },
      authHeader(token)
    );
    const draftId = genRes.body.drafts[0].id;

    const res = await request(
      'POST',
      `/api/admin/ai-drafts/${draftId}/approve`,
      { note: 'LGTM' },
      authHeader(token)
    );
    assert.equal(res.status, 200);
    assert.equal(res.body.draft.status, 'approved');
    assert.ok(res.body.draft.reviewed_at_utc);
  });

  test('POST /api/admin/ai-drafts/:id/approve rejects double-approval', async () => {
    const token = await getAdminToken();
    const genRes = await request(
      'POST',
      '/api/admin/ai-drafts/generate',
      { types: ['uae_gcc_summary'] },
      authHeader(token)
    );
    const draftId = genRes.body.drafts[0].id;
    await request('POST', `/api/admin/ai-drafts/${draftId}/approve`, {}, authHeader(token));

    const res = await request(
      'POST',
      `/api/admin/ai-drafts/${draftId}/approve`,
      {},
      authHeader(token)
    );
    assert.equal(res.status, 409, 'Cannot approve an already-approved draft');
  });

  test('POST /api/admin/ai-drafts/:id/reject transitions to rejected', async () => {
    const token = await getAdminToken();
    const genRes = await request(
      'POST',
      '/api/admin/ai-drafts/generate',
      { types: ['provider_report'] },
      authHeader(token)
    );
    const draftId = genRes.body.drafts[0].id;

    const res = await request(
      'POST',
      `/api/admin/ai-drafts/${draftId}/reject`,
      { reason: 'Not ready' },
      authHeader(token)
    );
    assert.equal(res.status, 200);
    assert.equal(res.body.draft.status, 'rejected');
    assert.ok(res.body.draft.reviewed_at_utc);
  });

  test('POST /api/admin/ai-drafts/:id/publish requires approved status', async () => {
    const token = await getAdminToken();
    const genRes = await request(
      'POST',
      '/api/admin/ai-drafts/generate',
      { types: ['daily_summary'] },
      authHeader(token)
    );
    const draftId = genRes.body.drafts[0].id;

    // Try to publish without approving first
    const res = await request(
      'POST',
      `/api/admin/ai-drafts/${draftId}/publish`,
      {},
      authHeader(token)
    );
    assert.equal(res.status, 409, 'Should reject publish if not approved first');
  });

  test('Full lifecycle: generate → approve → publish', async () => {
    const token = await getAdminToken();

    // Generate
    const genRes = await request(
      'POST',
      '/api/admin/ai-drafts/generate',
      { types: ['newsletter_block'] },
      authHeader(token)
    );
    assert.equal(genRes.status, 201);
    const draftId = genRes.body.drafts[0].id;
    assert.equal(genRes.body.drafts[0].status, 'draft');

    // Approve
    const approveRes = await request(
      'POST',
      `/api/admin/ai-drafts/${draftId}/approve`,
      { note: 'Ready' },
      authHeader(token)
    );
    assert.equal(approveRes.status, 200);
    assert.equal(approveRes.body.draft.status, 'approved');

    // Publish
    const publishRes = await request(
      'POST',
      `/api/admin/ai-drafts/${draftId}/publish`,
      { export_channel: 'newsletter' },
      authHeader(token)
    );
    assert.equal(publishRes.status, 200);
    assert.equal(publishRes.body.draft.status, 'published');
    assert.ok(publishRes.body.draft.published_at_utc);
    assert.equal(publishRes.body.draft.export_channel, 'newsletter');
  });

  test('GET /api/admin/ai-drafts/:id/audit-log returns audit trail', async () => {
    const token = await getAdminToken();
    const genRes = await request(
      'POST',
      '/api/admin/ai-drafts/generate',
      { types: ['x_post'] },
      authHeader(token)
    );
    const draftId = genRes.body.drafts[0].id;
    await request(
      'POST',
      `/api/admin/ai-drafts/${draftId}/approve`,
      { note: 'ok' },
      authHeader(token)
    );

    const res = await request(
      'GET',
      `/api/admin/ai-drafts/${draftId}/audit-log`,
      null,
      authHeader(token)
    );
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.audit_trail));
    assert.ok(res.body.audit_trail.length >= 1);
    assert.equal(res.body.audit_trail[0].action, 'approved');
  });

  test('PATCH cannot change status to published directly', async () => {
    const token = await getAdminToken();
    const genRes = await request(
      'POST',
      '/api/admin/ai-drafts/generate',
      { types: ['daily_summary'] },
      authHeader(token)
    );
    const draftId = genRes.body.drafts[0].id;

    await request(
      'PATCH',
      `/api/admin/ai-drafts/${draftId}`,
      { status: 'published' },
      authHeader(token)
    );
    const res = await request('GET', `/api/admin/ai-drafts/${draftId}`, null, authHeader(token));
    assert.equal(res.body.draft.status, 'draft', 'PATCH must not allow status change');
  });
});
