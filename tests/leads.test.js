'use strict';

/**
 * Leads API integration tests.
 *
 * Tests:
 *  - POST /api/v1/leads: validation, honeypot, types, event_track
 *  - GET /api/v1/admin/leads: admin protection, filters
 *  - PATCH /api/v1/admin/leads/:id: status update, admin protection
 */

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-leads-tests';
process.env.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'test-password-leads';
process.env.ADMIN_ACCESS_PIN = process.env.ADMIN_ACCESS_PIN || '123456';
process.env.NODE_ENV = 'test';

const { test, describe, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gtl-leads-test-'));
const leadsDataFile = path.join(tmpDir, 'leads.json');
process.env.LEADS_DATA_FILE = leadsDataFile;

const appPath = path.resolve(__dirname, '..', 'server.js');
const app = require(appPath);
const server = app.listen(0);
const port = server.address().port;

after(() => {
  server.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

beforeEach(() => {
  fs.writeFileSync(leadsDataFile, JSON.stringify({ leads: [], events: [] }, null, 2));
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
          resolve({ status: res.statusCode, body: json, raw: data, headers: res.headers });
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

// ---------------------------------------------------------------------------
// POST /api/v1/leads
// ---------------------------------------------------------------------------

describe('POST /api/v1/leads — validation', () => {
  test('rejects invalid lead type', async () => {
    const res = await request('POST', '/api/v1/leads', { type: 'invalid_type', email: 'a@b.com' });
    assert.equal(res.status, 400);
    assert.equal(res.body?.success, false);
  });

  test('rejects invalid email format', async () => {
    const res = await request('POST', '/api/v1/leads', { type: 'contact', email: 'notvalid' });
    assert.equal(res.status, 400);
    assert.equal(res.body?.success, false);
  });

  test('accepts lead without email (anonymous)', async () => {
    const res = await request('POST', '/api/v1/leads', {
      type: 'contact',
      message: 'Anonymous inquiry',
      source: 'footer',
    });
    assert.equal(res.status, 201);
    assert.equal(res.body?.success, true);
    assert.ok(res.body?.id, 'should return lead ID');
  });
});

describe('POST /api/v1/leads — honeypot', () => {
  test('silently accepts honeypot-filled submissions without storing', async () => {
    const res = await request('POST', '/api/v1/leads', {
      type: 'contact',
      email: 'bot@example.com',
      website: 'http://spam.example.com',
    });
    assert.equal(res.status, 201);
    assert.equal(res.body?.success, true);
    assert.equal(res.body?.id, null); // no real lead ID

    const repo = require('../server/repositories/leads.repository');
    const leads = repo.getLeads();
    assert.equal(leads.length, 0);
  });
});

describe('POST /api/v1/leads — success flow', () => {
  test('creates a contact lead', async () => {
    const res = await request('POST', '/api/v1/leads', {
      type: 'contact',
      email: 'user@example.com',
      name: 'Test User',
      message: 'Hello',
      source: 'footer',
    });
    assert.equal(res.status, 201);
    assert.equal(res.body?.success, true);

    const repo = require('../server/repositories/leads.repository');
    const lead = repo.getLeadById(res.body.id);
    assert.ok(lead);
    assert.equal(lead.type, 'contact');
    assert.equal(lead.status, 'new');
    assert.equal(lead.email, 'user@example.com');
    assert.equal(lead.name, 'Test User');
  });

  test('creates a shop_interest lead', async () => {
    const res = await request('POST', '/api/v1/leads', {
      type: 'shop_interest',
      email: 'shop@example.com',
      name: 'Gold Shop Dubai',
      message: 'I want to list my shop',
      entity_type: 'shop',
      entity_id: 'shop_123',
    });
    assert.equal(res.status, 201);

    const repo = require('../server/repositories/leads.repository');
    const lead = repo.getLeadById(res.body.id);
    assert.equal(lead.type, 'shop_interest');
    assert.equal(lead.entity_type, 'shop');
  });

  test('event_track creates an event record (not a full lead)', async () => {
    const res = await request('POST', '/api/v1/leads', {
      type: 'event_track',
      event_type: 'click',
      entity_type: 'shop',
      entity_id: 'shop_abc',
      page_path: '/shops',
    });
    assert.equal(res.status, 201);
    assert.equal(res.body?.success, true);

    const repo = require('../server/repositories/leads.repository');
    const leads = repo.getLeads();
    assert.equal(leads.length, 0, 'event_track should not create a lead record');
  });

  test('event_track rejects invalid event_type', async () => {
    const res = await request('POST', '/api/v1/leads', {
      type: 'event_track',
      event_type: 'invalid_event',
    });
    assert.equal(res.status, 400);
  });

  test('sanitizes metadata — strips non-primitive values', async () => {
    const res = await request('POST', '/api/v1/leads', {
      type: 'contact',
      email: 'meta@example.com',
      metadata: {
        country: 'AE',
        karat: 22,
        nested: { dangerous: 'value' }, // should be stripped
      },
    });
    assert.equal(res.status, 201);

    const repo = require('../server/repositories/leads.repository');
    const lead = repo.getLeadById(res.body.id);
    assert.equal(lead.metadata?.country, 'AE');
    assert.equal(lead.metadata?.karat, 22);
    assert.ok(!lead.metadata?.nested, 'nested objects should be stripped');
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/admin/leads — admin protection
// ---------------------------------------------------------------------------

describe('GET /api/v1/admin/leads — protection', () => {
  test('returns 401 without authentication', async () => {
    const res = await request('GET', '/api/v1/admin/leads');
    assert.equal(res.status, 401);
  });

  test('returns leads list for admin', async () => {
    await request('POST', '/api/v1/leads', { type: 'contact', email: 'l1@example.com' });
    await request('POST', '/api/v1/leads', { type: 'shop_interest', email: 'l2@example.com' });

    const token = await getAdminToken();
    const res = await request('GET', '/api/v1/admin/leads', null, {
      Authorization: `Bearer ${token}`,
    });
    assert.equal(res.status, 200);
    assert.equal(res.body?.success, true);
    assert.ok(Array.isArray(res.body?.data));
    assert.ok(res.body?.data.length >= 2);
    assert.ok(typeof res.body?.counts?.total === 'number');
  });

  test('filters by status=new', async () => {
    await request('POST', '/api/v1/leads', { type: 'contact', email: 'newlead@example.com' });
    const token = await getAdminToken();
    const res = await request('GET', '/api/v1/admin/leads?status=new', null, {
      Authorization: `Bearer ${token}`,
    });
    assert.equal(res.status, 200);
    res.body.data.forEach((l) => assert.equal(l.status, 'new'));
  });

  test('filters by type=contact', async () => {
    await request('POST', '/api/v1/leads', { type: 'contact', email: 'c1@example.com' });
    await request('POST', '/api/v1/leads', { type: 'shop_interest', email: 's1@example.com' });
    const token = await getAdminToken();
    const res = await request('GET', '/api/v1/admin/leads?type=contact', null, {
      Authorization: `Bearer ${token}`,
    });
    assert.equal(res.status, 200);
    res.body.data.forEach((l) => assert.equal(l.type, 'contact'));
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/v1/admin/leads/:id
// ---------------------------------------------------------------------------

describe('PATCH /api/v1/admin/leads/:id', () => {
  test('returns 401 without authentication', async () => {
    const res = await request('PATCH', '/api/v1/admin/leads/nonexistent');
    assert.equal(res.status, 401);
  });

  test('returns 404 for unknown lead', async () => {
    const token = await getAdminToken();
    const res = await request(
      'PATCH',
      '/api/v1/admin/leads/nonexistent-id',
      { status: 'contacted' },
      {
        Authorization: `Bearer ${token}`,
      }
    );
    assert.equal(res.status, 404);
  });

  test('returns 400 for invalid status value', async () => {
    await request('POST', '/api/v1/leads', { type: 'contact', email: 'patch@example.com' });
    const repo = require('../server/repositories/leads.repository');
    const lead = repo.getLeads()[0];
    const token = await getAdminToken();
    const res = await request(
      'PATCH',
      `/api/v1/admin/leads/${lead.id}`,
      { status: 'invalid_status' },
      {
        Authorization: `Bearer ${token}`,
      }
    );
    assert.equal(res.status, 400);
  });

  test('updates lead status to contacted', async () => {
    await request('POST', '/api/v1/leads', { type: 'contact', email: 'patch2@example.com' });
    const repo = require('../server/repositories/leads.repository');
    const lead = repo.getLeads()[0];
    const token = await getAdminToken();
    const res = await request(
      'PATCH',
      `/api/v1/admin/leads/${lead.id}`,
      { status: 'contacted', notes: 'Called them.' },
      {
        Authorization: `Bearer ${token}`,
      }
    );
    assert.equal(res.status, 200);
    assert.equal(res.body?.success, true);
    assert.equal(res.body?.data?.status, 'contacted');
    assert.equal(res.body?.data?.notes, 'Called them.');
  });

  test('marks lead as spam', async () => {
    await request('POST', '/api/v1/leads', { type: 'contact', email: 'spam@example.com' });
    const repo = require('../server/repositories/leads.repository');
    const lead = repo.getLeads()[0];
    const token = await getAdminToken();
    const res = await request(
      'PATCH',
      `/api/v1/admin/leads/${lead.id}`,
      { status: 'spam' },
      {
        Authorization: `Bearer ${token}`,
      }
    );
    assert.equal(res.status, 200);
    assert.equal(res.body?.data?.status, 'spam');
  });
});
