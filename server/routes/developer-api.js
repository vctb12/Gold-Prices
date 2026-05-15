'use strict';

/**
 * server/routes/developer-api.js
 *
 * API Product routes for Phase 12 — Developer Monetization.
 *
 * Public read endpoints (GET /api/v1/public/*):
 *   GET /api/v1/public/latest      — latest gold spot price
 *   GET /api/v1/public/history     — historical price series (key required)
 *   GET /api/v1/public/karats      — karat purity reference table
 *   GET /api/v1/public/countries   — supported countries & currencies
 *
 * User key management (requires Supabase bearer token via /me auth):
 *   POST   /api/v1/me/api-keys              — create a new API key
 *   GET    /api/v1/me/api-keys              — list the user's keys
 *   DELETE /api/v1/me/api-keys/:id          — revoke a key
 *   POST   /api/v1/me/api-keys/:id/regenerate — revoke + create replacement
 *   GET    /api/v1/me/api-usage             — usage summary for the user's keys
 *
 * Middleware:
 *   optionalApiKey — public/* routes; allows anonymous (10 req/day) or keyed access
 *   requireApiKey  — enforced on /public/history
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const { requireApiKey, optionalApiKey } = require('../lib/api-key-auth');
const billingRepo = require('../lib/billing-repository');
const { resolveUserEntitlements } = require('../lib/entitlements');
const { successResponse, errorResponse } = require('../lib/api-response');
const { getSupabaseClient } = require('../lib/supabase-client');
const { normalizeHistoryRange, getHistoryWindowStart } = require('../lib/price-snapshots');

const router = express.Router();
const ROOT = path.resolve(__dirname, '../..');
const GOLD_PRICE_FILE = path.join(ROOT, 'data', 'gold_price.json');
const PRICE_HISTORY_FILE = path.join(ROOT, 'src', 'data', 'historical-baseline.json');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const AED_PEG = 3.6725;
const TROY_OZ_GRAMS = 31.1035;
const MAX_KEY_LABEL_LENGTH = 60;
const MAX_KEYS_PER_USER = 10;

// Karat purity reference — matches src/config/karats.js exactly.
// Defined inline to avoid importing an ES-module from a CJS server file.
const KARATS = [
  { code: '24', purity: 1.0, labelEn: '24 Karat (Pure Gold)', labelAr: 'عيار 24 (ذهب خالص)' },
  { code: '22', purity: 22 / 24, labelEn: '22 Karat', labelAr: 'عيار 22' },
  { code: '21', purity: 21 / 24, labelEn: '21 Karat', labelAr: 'عيار 21' },
  { code: '20', purity: 20 / 24, labelEn: '20 Karat', labelAr: 'عيار 20' },
  { code: '18', purity: 18 / 24, labelEn: '18 Karat', labelAr: 'عيار 18' },
  { code: '16', purity: 16 / 24, labelEn: '16 Karat', labelAr: 'عيار 16' },
  { code: '14', purity: 14 / 24, labelEn: '14 Karat', labelAr: 'عيار 14' },
];

// Countries reference — matches src/config/countries.js (GCC + major markets).
const COUNTRIES = [
  {
    code: 'AE',
    slug: 'uae',
    nameEn: 'United Arab Emirates',
    currency: 'AED',
    group: 'gcc',
    fixedPeg: true,
  },
  {
    code: 'SA',
    slug: 'saudi-arabia',
    nameEn: 'Saudi Arabia',
    currency: 'SAR',
    group: 'gcc',
    fixedPeg: false,
  },
  { code: 'KW', slug: 'kuwait', nameEn: 'Kuwait', currency: 'KWD', group: 'gcc', fixedPeg: false },
  { code: 'QA', slug: 'qatar', nameEn: 'Qatar', currency: 'QAR', group: 'gcc', fixedPeg: true },
  { code: 'BH', slug: 'bahrain', nameEn: 'Bahrain', currency: 'BHD', group: 'gcc', fixedPeg: true },
  { code: 'OM', slug: 'oman', nameEn: 'Oman', currency: 'OMR', group: 'gcc', fixedPeg: true },
  { code: 'IN', slug: 'india', nameEn: 'India', currency: 'INR', group: 'asia', fixedPeg: false },
  {
    code: 'PK',
    slug: 'pakistan',
    nameEn: 'Pakistan',
    currency: 'PKR',
    group: 'asia',
    fixedPeg: false,
  },
  { code: 'EG', slug: 'egypt', nameEn: 'Egypt', currency: 'EGP', group: 'mena', fixedPeg: false },
  { code: 'TR', slug: 'turkey', nameEn: 'Turkey', currency: 'TRY', group: 'mena', fixedPeg: false },
  {
    code: 'US',
    slug: 'usa',
    nameEn: 'United States',
    currency: 'USD',
    group: 'international',
    fixedPeg: false,
  },
  {
    code: 'GB',
    slug: 'uk',
    nameEn: 'United Kingdom',
    currency: 'GBP',
    group: 'international',
    fixedPeg: false,
  },
  {
    code: 'EU',
    slug: 'europe',
    nameEn: 'European Union',
    currency: 'EUR',
    group: 'international',
    fixedPeg: false,
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readJsonFile(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function coercePositive(val) {
  const n = typeof val === 'number' ? val : parseFloat(val);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function _nowIso() {
  return new Date().toISOString();
}

/**
 * Resolve freshness label from a price payload.
 */
function freshnessLabel(payload) {
  if (!payload) return 'unknown';
  if (payload.is_fresh === true || payload.isFresh === true) return 'fresh';
  if (payload.is_fresh === false || payload.isFresh === false) return 'stale';
  const ts = payload.timestamp_utc || payload.fetched_at_utc;
  if (!ts) return 'unknown';
  const ageMs = Date.now() - new Date(ts).getTime();
  return ageMs < 300_000 ? 'fresh' : 'stale';
}

/**
 * Add standard API usage headers to the response.
 * Called after the middleware has set req.apiKeyContext.
 */
function setUsageHeaders(res, ctx, quota) {
  if (!ctx) return;
  if (quota > 0) {
    res.setHeader('X-RateLimit-Limit', quota);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, quota - ctx.used));
    res.setHeader('X-RateLimit-Reset', `${new Date().toISOString().slice(0, 10)}T23:59:59Z`);
  }
}

// ---------------------------------------------------------------------------
// User auth middleware — re-uses Supabase token validation from public-accounts
// ---------------------------------------------------------------------------

async function resolveSupabaseUser(token) {
  if (!token) return null;
  const sb = getSupabaseClient(false);
  if (sb?.auth?.getUser) {
    try {
      const { data, error } = await sb.auth.getUser(token);
      if (!error && data?.user) return data.user;
    } catch {
      // fall through
    }
  }
  const url = process.env.SUPABASE_URL;
  const apiKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !apiKey) return null;
  try {
    const res = await fetch(`${url.replace(/\/$/, '')}/auth/v1/user`, {
      method: 'GET',
      headers: { apikey: apiKey, Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function parseTestUser(req) {
  if (process.env.NODE_ENV === 'production') return null;
  if (process.env.PUBLIC_AUTH_TEST_MODE !== '1') return null;
  const id = req.headers['x-test-user-id'];
  if (typeof id !== 'string' || !id.trim()) return null;
  return { id: id.trim(), email: `${id.trim()}@example.test` };
}

/**
 * Middleware: authenticate the calling user via Supabase bearer token.
 * Sets req.devUser = { id, email }.
 */
async function requireDevUser(req, res, next) {
  const devUser = parseTestUser(req);
  if (devUser) {
    req.devUser = devUser;
    return next();
  }

  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) {
    return res
      .status(401)
      .json(errorResponse('UNAUTHORIZED', 'A Supabase bearer token is required.'));
  }
  const token = auth.slice('Bearer '.length).trim();
  const user = await resolveSupabaseUser(token);
  if (!user?.id) {
    return res.status(401).json(errorResponse('UNAUTHORIZED', 'Invalid or expired session token.'));
  }
  req.devUser = { id: user.id, email: user.email || null };
  return next();
}

// ---------------------------------------------------------------------------
// Supabase price data helpers (mirrors api-v1.js patterns)
// ---------------------------------------------------------------------------

async function querySupabase(table, buildQuery) {
  const sb = getSupabaseClient();
  if (!sb) return null;
  try {
    const { data, error } = await buildQuery(sb.from(table));
    if (error) throw error;
    return data;
  } catch (err) {
    console.error(`[developer-api] Supabase query error on ${table}:`, err.message);
    // Return null so callers fall back to the local file store.
    // Both "no data" and "error" return null; callers only need to know
    // whether Supabase data is available — they always fall back to file.
    return null;
  }
}

// ---------------------------------------------------------------------------
// GET /api/v1/public/latest
// ---------------------------------------------------------------------------

router.get('/public/latest', optionalApiKey, async (req, res) => {
  const ctx = req.apiKeyContext;

  // ctx.quota is set by the middleware from entitlements; no second resolution needed
  setUsageHeaders(res, ctx, ctx?.quota ?? 0);

  // Try Supabase first
  const rows = await querySupabase('price_snapshots', (t) =>
    t
      .select(
        'timestamp_utc,fetched_at_utc,xau_usd_per_oz,xau_aed_per_gram,source_provider,freshness_seconds,is_fresh,is_fallback'
      )
      .order('timestamp_utc', { ascending: false })
      .limit(1)
  );

  if (Array.isArray(rows) && rows.length > 0) {
    const r = rows[0];
    const xauUsd = coercePositive(r.xau_usd_per_oz);
    const xauAed =
      coercePositive(r.xau_aed_per_gram) || (xauUsd ? (xauUsd / TROY_OZ_GRAMS) * AED_PEG : null);
    return res.json(
      successResponse(
        {
          timestampUtc: r.timestamp_utc,
          fetchedAtUtc: r.fetched_at_utc,
          xauUsdPerOz: xauUsd,
          xauAedPerGram: xauAed,
          provider: r.source_provider,
          isFresh: r.is_fresh ?? null,
          isFallback: r.is_fallback ?? null,
          freshnessSeconds: r.freshness_seconds ?? null,
          disclaimer:
            'Spot-based reference price only. Does not include retail premiums, making charges, or VAT.',
        },
        {
          source: r.source_provider || 'price_snapshots',
          freshness: r.is_fresh ? 'fresh' : 'stale',
        }
      )
    );
  }

  // File fallback
  const payload = readJsonFile(GOLD_PRICE_FILE);
  if (!payload) {
    return res
      .status(503)
      .json(errorResponse('PRICE_DATA_UNAVAILABLE', 'Price data is temporarily unavailable.'));
  }
  const xauUsd = coercePositive(payload.price_usd) || coercePositive(payload.xau_usd);
  const xauAed =
    coercePositive(payload.xau_aed) || (xauUsd ? (xauUsd / TROY_OZ_GRAMS) * AED_PEG : null);
  return res.json(
    successResponse(
      {
        timestampUtc: payload.timestamp_utc || payload.fetched_at_utc || null,
        fetchedAtUtc: payload.fetched_at_utc || null,
        xauUsdPerOz: xauUsd,
        xauAedPerGram: xauAed,
        provider: payload.provider || payload.source || 'file',
        isFresh: null,
        isFallback: true,
        freshnessSeconds: null,
        disclaimer:
          'Spot-based reference price only. Does not include retail premiums, making charges, or VAT.',
      },
      { source: 'gold_price_file', freshness: freshnessLabel(payload) }
    )
  );
});

// ---------------------------------------------------------------------------
// GET /api/v1/public/history
// API key required — history access is gated behind having a key.
// Free tier keys get 30-day window; API tier gets unlimited.
// ---------------------------------------------------------------------------

router.get('/public/history', requireApiKey, async (req, res) => {
  const ctx = req.apiKeyContext;
  // historyDays and quota are already resolved by the middleware — no second entitlement call needed
  setUsageHeaders(res, ctx, ctx.quota);

  const historyDays = ctx.historyDays; // 0 = unlimited
  const range = normalizeHistoryRange(req.query.range);
  const requestedStart = getHistoryWindowStart(range);

  // If user's tier limits history, cap the start date
  let effectiveStart = requestedStart;
  if (historyDays > 0) {
    const tierCutoff = new Date(Date.now() - historyDays * 24 * 3600 * 1000).toISOString();
    effectiveStart = requestedStart > tierCutoff ? requestedStart : tierCutoff;
  }

  // Supabase
  const rows = await querySupabase('price_snapshots', (t) =>
    t
      .select('timestamp_utc,xau_usd_per_oz,xau_aed_per_gram,source_provider,is_fresh,is_fallback')
      .gte('timestamp_utc', effectiveStart)
      .order('timestamp_utc', { ascending: true })
      .limit(5000)
  );

  if (Array.isArray(rows) && rows.length > 0) {
    return res.json(
      successResponse(
        {
          range,
          historyDaysAllowed: historyDays || 'unlimited',
          total: rows.length,
          points: rows.map((r) => ({
            timestampUtc: r.timestamp_utc,
            xauUsdPerOz: coercePositive(r.xau_usd_per_oz),
            xauAedPerGram: coercePositive(r.xau_aed_per_gram),
            provider: r.source_provider,
            isFresh: r.is_fresh ?? null,
            isFallback: r.is_fallback ?? null,
          })),
          disclaimer: 'Historical spot prices only. Not suitable for transaction pricing.',
        },
        { source: 'price_snapshots', freshness: 'historical' }
      )
    );
  }

  // File fallback
  const history = readJsonFile(PRICE_HISTORY_FILE);
  if (!Array.isArray(history)) {
    return res
      .status(503)
      .json(
        errorResponse(
          'PRICE_HISTORY_UNAVAILABLE',
          'Historical price data is temporarily unavailable.'
        )
      );
  }
  const effectiveStartTime = new Date(effectiveStart).getTime();
  const filtered = history.filter((p) => {
    if (!p?.date) return false;
    return (
      new Date(String(p.date).length === 7 ? `${p.date}-01` : p.date).getTime() >=
      effectiveStartTime
    );
  });
  return res.json(
    successResponse(
      {
        range,
        historyDaysAllowed: historyDays || 'unlimited',
        total: filtered.length,
        points: filtered.map((p) => {
          const xauUsd = coercePositive(p.price);
          const xauAed =
            xauUsd != null ? Math.round((xauUsd / TROY_OZ_GRAMS) * AED_PEG * 1e6) / 1e6 : null;
          return {
            timestampUtc:
              String(p.date).length === 7 ? `${p.date}-01T00:00:00Z` : `${p.date}T00:00:00Z`,
            xauUsdPerOz: xauUsd,
            xauAedPerGram: xauAed,
            provider: p.source || 'historical-baseline',
            granularity: String(p.date).length === 7 ? 'monthly' : 'daily',
          };
        }),
        disclaimer: 'Historical spot prices only. Not suitable for transaction pricing.',
      },
      { source: 'historical-baseline', freshness: 'reference' }
    )
  );
});

// ---------------------------------------------------------------------------
// GET /api/v1/public/karats
// ---------------------------------------------------------------------------

// GET /api/v1/public/karats — open endpoint, no key or quota enforcement
router.get('/public/karats', (_req, res) => {
  res.json(
    successResponse(
      {
        troyOzGrams: TROY_OZ_GRAMS,
        karats: KARATS.map((k) => ({
          code: k.code,
          purity: parseFloat(k.purity.toFixed(6)),
          labelEn: k.labelEn,
          labelAr: k.labelAr,
        })),
        note: 'Purity is the fraction of pure gold. Price per gram = (xauUsdPerOz / troyOzGrams) × purity.',
      },
      { source: 'reference', freshness: 'static' }
    )
  );
});

// ---------------------------------------------------------------------------
// GET /api/v1/public/countries
// ---------------------------------------------------------------------------

// GET /api/v1/public/countries — open endpoint, no key or quota enforcement
router.get('/public/countries', (_req, res) => {
  res.json(
    successResponse(
      {
        countries: COUNTRIES,
        note: 'AED, QAR, BHD, OMR are pegged to USD; others float. Currency conversion rates are not provided by this endpoint.',
      },
      { source: 'reference', freshness: 'static' }
    )
  );
});

// ---------------------------------------------------------------------------
// POST /api/v1/me/api-keys — create a new API key
// ---------------------------------------------------------------------------

router.post('/me/api-keys', requireDevUser, async (req, res) => {
  const userId = req.devUser.id;
  const rawLabel =
    typeof req.body?.label === 'string'
      ? req.body.label.trim().slice(0, MAX_KEY_LABEL_LENGTH)
      : 'default';
  const label = rawLabel || 'default';

  // Enforce per-user key limit
  const existing = await billingRepo.listApiKeys(userId);
  const activeCount = existing.filter((k) => !k.revoked).length;
  if (activeCount >= MAX_KEYS_PER_USER) {
    return res
      .status(422)
      .json(
        errorResponse(
          'KEY_LIMIT_REACHED',
          `You may have at most ${MAX_KEYS_PER_USER} active API keys. Revoke an existing key before creating a new one.`
        )
      );
  }

  const result = await billingRepo.createApiKey({ userId, label });
  if (!result?.key) {
    return res
      .status(500)
      .json(errorResponse('KEY_CREATE_FAILED', 'Failed to create API key. Please try again.'));
  }

  return res.status(201).json(
    successResponse(
      {
        id: result.id,
        key: result.key, // shown once
        keyPrefix: result.keyPrefix,
        label: result.label,
        createdAt: result.createdAt,
        warning: 'Store this key securely. It will not be shown again.',
      },
      { source: 'api-keys', freshness: 'live' }
    )
  );
});

// ---------------------------------------------------------------------------
// GET /api/v1/me/api-keys — list keys (no hashes, no raw keys)
// ---------------------------------------------------------------------------

router.get('/me/api-keys', requireDevUser, async (req, res) => {
  const userId = req.devUser.id;
  const keys = await billingRepo.listApiKeys(userId);
  return res.json(successResponse({ keys }, { source: 'api-keys', freshness: 'live' }));
});

// ---------------------------------------------------------------------------
// DELETE /api/v1/me/api-keys/:id — revoke a key
// ---------------------------------------------------------------------------

router.delete('/me/api-keys/:id', requireDevUser, async (req, res) => {
  const userId = req.devUser.id;
  const keyId = req.params.id;
  if (!keyId || typeof keyId !== 'string') {
    return res.status(400).json(errorResponse('INVALID_KEY_ID', 'Key ID is required.'));
  }
  const ok = await billingRepo.revokeApiKey(keyId, userId);
  if (!ok) {
    return res
      .status(404)
      .json(errorResponse('KEY_NOT_FOUND', 'API key not found or already revoked.'));
  }
  return res.json(
    successResponse({ id: keyId, revoked: true }, { source: 'api-keys', freshness: 'live' })
  );
});

// ---------------------------------------------------------------------------
// POST /api/v1/me/api-keys/:id/regenerate — revoke + create replacement
// ---------------------------------------------------------------------------

router.post('/me/api-keys/:id/regenerate', requireDevUser, async (req, res) => {
  const userId = req.devUser.id;
  const keyId = req.params.id;
  if (!keyId || typeof keyId !== 'string') {
    return res.status(400).json(errorResponse('INVALID_KEY_ID', 'Key ID is required.'));
  }

  // Find the old key's label before revoking
  const keys = await billingRepo.listApiKeys(userId);
  const oldKey = keys.find((k) => k.id === keyId);
  if (!oldKey) {
    return res.status(404).json(errorResponse('KEY_NOT_FOUND', 'API key not found.'));
  }
  await billingRepo.revokeApiKey(keyId, userId);

  const result = await billingRepo.createApiKey({ userId, label: oldKey.label });
  if (!result?.key) {
    return res
      .status(500)
      .json(errorResponse('KEY_CREATE_FAILED', 'Failed to create replacement API key.'));
  }
  return res.status(201).json(
    successResponse(
      {
        id: result.id,
        key: result.key,
        keyPrefix: result.keyPrefix,
        label: result.label,
        createdAt: result.createdAt,
        revokedId: keyId,
        warning: 'Store this key securely. It will not be shown again.',
      },
      { source: 'api-keys', freshness: 'live' }
    )
  );
});

// ---------------------------------------------------------------------------
// GET /api/v1/me/api-usage — usage summary for the authenticated user's keys
// ---------------------------------------------------------------------------

router.get('/me/api-usage', requireDevUser, async (req, res) => {
  const userId = req.devUser.id;
  const days = Math.min(parseInt(req.query.days, 10) || 30, 90);

  const [keys, usageRows] = await Promise.all([
    billingRepo.listApiKeys(userId),
    billingRepo.listApiUsageForUser(userId, { days }),
  ]);

  // Build a map of keyId → keyPrefix for readability
  const keyMap = Object.fromEntries(keys.map((k) => [k.id, k]));

  // Aggregate usage into per-key and per-day summaries
  const byKey = {};
  const byDate = {};
  let totalCalls = 0;

  for (const row of usageRows) {
    if (!byKey[row.keyId])
      byKey[row.keyId] = {
        keyId: row.keyId,
        keyPrefix: keyMap[row.keyId]?.keyPrefix || null,
        total: 0,
      };
    byKey[row.keyId].total += row.count;
    byDate[row.date] = (byDate[row.date] || 0) + row.count;
    totalCalls += row.count;
  }

  // Today's individual key usage for quota display
  const today = new Date().toISOString().slice(0, 10);
  const todayRows = usageRows.filter((r) => r.date === today);
  const todayTotal = todayRows.reduce((s, r) => s + r.count, 0);

  const { entitlements } = await resolveUserEntitlements(userId);

  return res.json(
    successResponse(
      {
        windowDays: days,
        totalCalls,
        todayCalls: todayTotal,
        quota: { daily: entitlements.apiCallsPerDay || 0, tier: entitlements.tier || 'free' },
        byKey: Object.values(byKey),
        byDate: Object.entries(byDate)
          .sort(([a], [b]) => (b > a ? 1 : -1))
          .map(([date, count]) => ({ date, count })),
      },
      { source: 'api-usage', freshness: 'live' }
    )
  );
});

module.exports = router;
