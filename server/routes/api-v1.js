'use strict';

const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { atomicWriteJSON } = require('../lib/fs-atomic');
const { getRuntimeEnvSnapshot, validateServerEnv } = require('../lib/env-validation');
const { successResponse, errorResponse } = require('../lib/api-response');
const { authMiddleware } = require('../lib/auth');
const { getSupabaseClient } = require('../lib/supabase-client');
const {
  normalizeHistoryRange,
  getHistoryWindowStart,
  validatePricePayload,
} = require('../lib/price-snapshots');

const router = express.Router();
const ROOT = path.resolve(__dirname, '../..');
const PACKAGE_JSON_PATH = path.join(ROOT, 'package.json');
const GOLD_PRICE_FILE = path.join(ROOT, 'data', 'gold_price.json');
const PROVIDER_STATE_FILE = path.join(ROOT, 'data', 'provider_state.json');
const PRICE_HISTORY_FILE = path.join(ROOT, 'src', 'data', 'historical-baseline.json');
const PRICE_SNAPSHOT_SYNC_SCRIPT = path.join(ROOT, 'scripts', 'node', 'sync-price-snapshot.js');
const EVENTS_FILE = path.join(ROOT, 'data', 'analytics-events.json');
const LEADS_FILE = path.join(ROOT, 'data', 'leads.json');
const MAX_EVENT_NAME_LENGTH = 80;
const MAX_EVENT_PAGE_LENGTH = 200;
const MAX_LEAD_NAME_LENGTH = 120;
const MAX_LEAD_MESSAGE_LENGTH = 1200;
const MAX_LEAD_SOURCE_LENGTH = 120;
const MAX_STORED_EVENTS = 5000;
const MAX_STORED_LEADS = 5000;
const ISO_YEAR_MONTH_STRING_LENGTH = 7;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const EVENTS_RATE_LIMIT_WINDOW_MINUTES = 15;
const LEADS_RATE_LIMIT_WINDOW_MINUTES = 15;
const DEFAULT_LIMIT_PROVIDER_RUNS = 100;

const PACKAGE_VERSION = (() => {
  try {
    return JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf8')).version || '0.0.0';
  } catch {
    return '0.0.0';
  }
})();

function fileExists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

function readJsonFile(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function readJsonArray(filePath) {
  if (!fileExists(filePath)) return [];
  const parsed = readJsonFile(filePath);
  return Array.isArray(parsed) ? parsed : [];
}

function writeJsonArray(filePath, entries) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  atomicWriteJSON(filePath, entries);
}

function buildSystemStatus() {
  const envValidation = validateServerEnv(process.env, console);
  const envSnapshot = getRuntimeEnvSnapshot(process.env);
  const goldPrice = readJsonFile(GOLD_PRICE_FILE);
  const providerState = readJsonFile(PROVIDER_STATE_FILE);
  const supabaseWriteAvailable = Boolean(getSupabaseClient(false));
  const providerStateAvailable = fileExists(PROVIDER_STATE_FILE);
  const priceSnapshotSyncScriptAvailable = fileExists(PRICE_SNAPSHOT_SYNC_SCRIPT);
  const readiness = {
    supabaseConfigured: envSnapshot.supabaseConfigured,
    supabaseWriteAvailable,
    stripeConfigured: envSnapshot.stripeConfigured,
    stripeWebhookConfigured: envSnapshot.stripeWebhookConfigured,
    resendConfigured: envSnapshot.resendConfigured,
    alertJobTokenConfigured: envSnapshot.alertJobTokenConfigured,
    providerStateAvailable,
    priceSnapshotSyncAvailable: priceSnapshotSyncScriptAvailable && supabaseWriteAvailable,
  };

  return {
    status: 'ok',
    version: PACKAGE_VERSION,
    environment: envSnapshot.mode,
    uptimeSeconds: Math.floor(process.uptime()),
    checks: {
      dataFileAvailable: fileExists(GOLD_PRICE_FILE),
      providerStateFileAvailable: providerStateAvailable,
      supabaseConfigured: envSnapshot.supabaseConfigured,
      newsletterConfigured: envSnapshot.newsletterConfigured,
      stripeConfigured: envSnapshot.stripeConfigured,
      supabaseWriteAvailable,
      stripeWebhookConfigured: envSnapshot.stripeWebhookConfigured,
      resendConfigured: envSnapshot.resendConfigured,
      alertJobTokenConfigured: envSnapshot.alertJobTokenConfigured,
      priceSnapshotSyncScriptAvailable,
    },
    readiness,
    providers: {
      latestSource: goldPrice?.provider || goldPrice?.source || null,
      latestTimestampUtc: goldPrice?.timestamp_utc || goldPrice?.fetched_at_utc || null,
      state: providerState || {},
    },
    warnings: envValidation.warnings,
  };
}

function computeFreshnessLabel(pricePayload) {
  if (!pricePayload || typeof pricePayload !== 'object') return 'unknown';
  if (pricePayload.is_fresh === true) return 'fresh';
  if (pricePayload.is_fresh === false) return 'stale';
  if (pricePayload.is_fallback === true) return 'fallback';
  return 'unknown';
}

function parseLimit(input, fallback = 120, max = 1000) {
  const n = Number.parseInt(input, 10);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(n, max);
}

function sanitizeString(value, maxLength, fallback = null) {
  if (typeof value !== 'string') return fallback;
  const cleaned = value.trim().slice(0, maxLength);
  return cleaned || fallback;
}

function coerceToNumber(value, { positive = false, integer = false } = {}) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  if (positive && parsed <= 0) return null;
  if (integer) return Math.trunc(parsed);
  return parsed;
}

function toBooleanOrNull(value) {
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return null;
}

function toHistoryTimestampUtc(dateValue) {
  if (typeof dateValue !== 'string') return null;
  const isoCandidate =
    dateValue.length === ISO_YEAR_MONTH_STRING_LENGTH
      ? `${dateValue}-01T00:00:00.000Z`
      : dateValue.length === 10
        ? `${dateValue}T00:00:00.000Z`
        : dateValue;
  const date = new Date(isoCandidate);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

async function querySupabase(table, queryBuilder) {
  const sb = getSupabaseClient(false);
  if (!sb) return null;
  try {
    const query = sb.from(table);
    const { data, error } = await queryBuilder(query);
    if (error) {
      console.warn(`[api-v1] Supabase query failed for table "${table}": ${error.message}`);
      return null;
    }
    return data;
  } catch (error) {
    console.warn(`[api-v1] Supabase query exception for table "${table}": ${error.message}`);
    return null;
  }
}

function mapPricePayloadToApiData(pricePayload) {
  const freshnessSeconds = coerceToNumber(pricePayload?.freshness_seconds, { integer: true });
  return {
    xauUsdPerOz: coerceToNumber(pricePayload?.xau_usd_per_oz ?? pricePayload?.gold?.ounce_usd, {
      positive: true,
    }),
    usdPerGram24k: coerceToNumber(pricePayload?.usd_per_gram_24k, { positive: true }),
    aedPerGram24k: coerceToNumber(pricePayload?.aed_per_gram_24k ?? pricePayload?.gold?.gram_aed, {
      positive: true,
    }),
    karatsAedPerGram: pricePayload?.karats_aed_per_gram || null,
    timestampUtc: pricePayload?.timestamp_utc || null,
    fetchedAtUtc: pricePayload?.fetched_at_utc || null,
    provider: pricePayload?.provider || pricePayload?.source || null,
    providerChain: pricePayload?.provider_chain || null,
    freshnessSeconds: freshnessSeconds !== null && freshnessSeconds >= 0 ? freshnessSeconds : null,
    isFresh: toBooleanOrNull(pricePayload?.is_fresh),
    isFallback: toBooleanOrNull(pricePayload?.is_fallback),
    isMarketOpen: toBooleanOrNull(pricePayload?.is_market_open),
    sourceMode: 'file',
  };
}

function mapSnapshotRowToLatestApiData(row) {
  const freshnessSeconds = coerceToNumber(row?.freshness_seconds, { integer: true });
  return {
    xauUsdPerOz: coerceToNumber(row?.xau_usd_per_oz, { positive: true }),
    usdPerGram24k: null,
    aedPerGram24k: coerceToNumber(row?.xau_aed_per_gram, { positive: true }),
    karatsAedPerGram: null,
    timestampUtc: row?.timestamp_utc || null,
    fetchedAtUtc: row?.fetched_at_utc || null,
    provider: row?.source_provider || null,
    providerChain: row?.provider_chain || null,
    freshnessSeconds: freshnessSeconds !== null && freshnessSeconds >= 0 ? freshnessSeconds : null,
    isFresh: toBooleanOrNull(row?.is_fresh),
    isFallback: toBooleanOrNull(row?.is_fallback),
    isMarketOpen: toBooleanOrNull(row?.is_market_open),
    sourceMode: 'supabase',
  };
}

function buildHistoryCoverage(points, extra = {}) {
  if (!Array.isArray(points) || points.length === 0) {
    return {
      startTimestampUtc: null,
      endTimestampUtc: null,
      pointsAvailable: 0,
      ...extra,
    };
  }
  const timestamps = points
    .map((point) => point?.timestampUtc || null)
    .filter((value) => typeof value === 'string' && value);
  return {
    startTimestampUtc: timestamps[0] || null,
    endTimestampUtc: timestamps[timestamps.length - 1] || null,
    pointsAvailable: points.length,
    ...extra,
  };
}

function buildHistorySuccessPayload({
  range,
  total,
  points,
  source,
  sourceMode,
  freshness,
  coverage,
  latestTimestampUtc = null,
  latestFetchedAtUtc = null,
  note = null,
  fallback = false,
}) {
  const normalizedCoverage = coverage || buildHistoryCoverage(points);
  return successResponse(
    {
      range,
      total,
      returned: points.length,
      points,
      sourceMode,
      historySource: source,
      coverage: normalizedCoverage,
      latestTimestampUtc,
      latestFetchedAtUtc,
      fallback,
      note,
    },
    {
      source,
      freshness,
      extra: {
        mode: sourceMode,
        fallback,
        coverageStartUtc: normalizedCoverage.startTimestampUtc,
        coverageEndUtc: normalizedCoverage.endTimestampUtc,
        coveragePoints: normalizedCoverage.pointsAvailable,
      },
    }
  );
}

function buildHistoryResponse({ range, limit, supabaseRows, baselineHistory, latestPricePayload }) {
  if (Array.isArray(supabaseRows) && supabaseRows.length > 0) {
    const points = supabaseRows.slice(-limit).map((row) => ({
      timestampUtc: row.timestamp_utc,
      fetchedAtUtc: row.fetched_at_utc,
      xauUsdPerOz: coerceToNumber(row.xau_usd_per_oz, { positive: true }),
      xauAedPerGram: coerceToNumber(row.xau_aed_per_gram, { positive: true }),
      provider: row.source_provider,
      freshnessSeconds: coerceToNumber(row.freshness_seconds, { integer: true }),
      isFresh: toBooleanOrNull(row.is_fresh),
      isFallback: toBooleanOrNull(row.is_fallback),
    }));
    return {
      status: 200,
      body: buildHistorySuccessPayload({
        range,
        total: supabaseRows.length,
        points,
        source: 'supabase',
        sourceMode: 'supabase',
        freshness: 'historical',
        coverage: buildHistoryCoverage(points, {
          providerBacked: true,
          partial: points.length < supabaseRows.length,
        }),
        latestTimestampUtc: points[points.length - 1]?.timestampUtc || null,
        latestFetchedAtUtc: points[points.length - 1]?.fetchedAtUtc || null,
      }),
    };
  }

  if (Array.isArray(baselineHistory)) {
    const rangeStartTime = new Date(getHistoryWindowStart(range)).getTime();
    const points = baselineHistory
      .filter((point) => {
        const ts = toHistoryTimestampUtc(point?.date);
        if (!ts) return false;
        return new Date(ts).getTime() >= rangeStartTime;
      })
      .slice(-limit)
      .map((point) => ({
        timestampUtc: toHistoryTimestampUtc(point.date),
        xauUsdPerOz: coerceToNumber(point.price, { positive: true }),
        provider: point.source || 'historical-baseline',
        granularity:
          point.granularity ||
          (String(point.date).length === ISO_YEAR_MONTH_STRING_LENGTH ? 'monthly' : 'daily'),
      }));
    return {
      status: 200,
      body: buildHistorySuccessPayload({
        range,
        total: baselineHistory.length,
        points,
        source: 'static-baseline',
        sourceMode: 'file',
        freshness: 'reference',
        coverage: buildHistoryCoverage(points, {
          providerBacked: false,
          referenceOnly: true,
        }),
        latestTimestampUtc: points[points.length - 1]?.timestampUtc || null,
        note: 'Reference baseline fallback. This dataset is not a live shop or live market history feed.',
        fallback: true,
      }),
    };
  }

  const validatedLatestPayload = validatePricePayload(latestPricePayload);
  if (validatedLatestPayload.ok) {
    const point = {
      timestampUtc: validatedLatestPayload.normalized.timestampUtc,
      fetchedAtUtc: validatedLatestPayload.normalized.fetchedAtUtc,
      xauUsdPerOz: validatedLatestPayload.normalized.xauUsdPerOz,
      xauAedPerGram: validatedLatestPayload.normalized.xauAedPerGram,
      provider: validatedLatestPayload.normalized.sourceProvider,
      freshnessSeconds: validatedLatestPayload.normalized.freshnessSeconds,
      isFresh: validatedLatestPayload.normalized.isFresh,
      isFallback: validatedLatestPayload.normalized.isFallback,
    };
    return {
      status: 200,
      body: buildHistorySuccessPayload({
        range,
        total: 1,
        points: [point],
        source: 'json-fallback',
        sourceMode: 'file',
        freshness: 'fallback',
        coverage: buildHistoryCoverage([point], {
          providerBacked: false,
          snapshotFallback: true,
        }),
        latestTimestampUtc: point.timestampUtc,
        latestFetchedAtUtc: point.fetchedAtUtc,
        note: 'Single-point snapshot fallback only. Treat this as a cached reference point, not full live history.',
        fallback: true,
      }),
    };
  }

  return {
    status: 200,
    body: buildHistorySuccessPayload({
      range,
      total: 0,
      points: [],
      source: 'empty',
      sourceMode: 'none',
      freshness: 'unavailable',
      coverage: buildHistoryCoverage([], {
        providerBacked: false,
        empty: true,
      }),
      note: 'No Supabase history, static baseline, or JSON snapshot fallback is currently available.',
      fallback: true,
    }),
  };
}

const eventsRateLimiter = rateLimit({
  windowMs: EVENTS_RATE_LIMIT_WINDOW_MINUTES * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: errorResponse(
    'RATE_LIMITED',
    'Too many events from this address. Please try again later.'
  ),
});

const leadsRateLimiter = rateLimit({
  windowMs: LEADS_RATE_LIMIT_WINDOW_MINUTES * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: errorResponse(
    'RATE_LIMITED',
    'Too many leads from this address. Please try again later.'
  ),
});

router.get('/health', (_req, res) => {
  const status = buildSystemStatus();
  res.json(
    successResponse(status, {
      source: 'backend',
      freshness: 'live',
    })
  );
});

router.get('/status', (_req, res) => {
  const status = buildSystemStatus();
  res.json(
    successResponse(status, {
      source: 'backend',
      freshness: 'live',
    })
  );
});

router.get('/config/public', (_req, res) => {
  const envSnapshot = getRuntimeEnvSnapshot(process.env);
  const data = {
    version: PACKAGE_VERSION,
    apiVersion: 'v1',
    environment: envSnapshot.mode,
    storageBackend: envSnapshot.storageBackend,
    features: {
      supabase: envSnapshot.supabaseConfigured,
      newsletter: envSnapshot.newsletterConfigured,
      alerts: true,
      stripe: envSnapshot.stripeConfigured,
      adminPin: envSnapshot.adminPinConfigured,
    },
  };
  res.json(successResponse(data, { source: 'backend-config', freshness: 'current' }));
});

router.get('/prices/latest', async (_req, res) => {
  const latestSnapshotRows = await querySupabase('price_snapshots', (table) =>
    table.select('*').order('timestamp_utc', { ascending: false }).limit(1)
  );

  if (Array.isArray(latestSnapshotRows) && latestSnapshotRows.length > 0) {
    const latest = mapSnapshotRowToLatestApiData(latestSnapshotRows[0]);
    return res.json(
      successResponse(latest, {
        source: latest.provider || 'price_snapshots',
        freshness:
          latest.isFresh === true ? 'fresh' : latest.isFresh === false ? 'stale' : 'unknown',
        extra: {
          mode: 'supabase',
        },
      })
    );
  }

  const pricePayload = readJsonFile(GOLD_PRICE_FILE);
  if (!pricePayload) {
    return res
      .status(503)
      .json(errorResponse('PRICE_DATA_UNAVAILABLE', 'Price data file is unavailable or invalid.'));
  }

  const data = mapPricePayloadToApiData(pricePayload);

  return res.json(
    successResponse(data, {
      source: data.provider || 'gold_price_file',
      freshness: computeFreshnessLabel(pricePayload),
      extra: {
        mode: 'file',
      },
    })
  );
});

router.get('/prices/history', async (req, res) => {
  const range = normalizeHistoryRange(req.query.range);
  const limit = parseLimit(req.query.limit, 120, 5000);
  const supabaseStart = getHistoryWindowStart(range);
  const supabaseRows = await querySupabase('price_snapshots', (table) =>
    table
      .select(
        'timestamp_utc,fetched_at_utc,xau_usd_per_oz,xau_aed_per_gram,source_provider,freshness_seconds,is_fresh,is_fallback'
      )
      .gte('timestamp_utc', supabaseStart)
      .order('timestamp_utc', { ascending: true })
      .limit(5000)
  );
  const history = readJsonFile(PRICE_HISTORY_FILE);
  const latestPricePayload = readJsonFile(GOLD_PRICE_FILE);
  const response = buildHistoryResponse({
    range,
    limit,
    supabaseRows,
    baselineHistory: Array.isArray(history) ? history : null,
    latestPricePayload,
  });
  return res.status(response.status).json(response.body);
});

router.get('/prices/snapshots', async (req, res) => {
  const limit = parseLimit(req.query.limit, 120, 1000);
  const provider = sanitizeString(req.query.provider, 120, null);

  const supabaseRows = await querySupabase('price_snapshots', (table) => {
    let query = table
      .select(
        'id,timestamp_utc,fetched_at_utc,xau_usd_per_oz,xau_aed_per_gram,source_provider,provider_chain,freshness_seconds,is_fresh,is_fallback,raw_payload_hash,created_at'
      )
      .order('timestamp_utc', { ascending: false })
      .limit(limit);
    if (provider) query = query.eq('source_provider', provider);
    return query;
  });

  if (Array.isArray(supabaseRows) && supabaseRows.length > 0) {
    return res.json(
      successResponse(
        {
          total: supabaseRows.length,
          returned: supabaseRows.length,
          snapshots: supabaseRows.map((row) => ({
            ...row,
            xau_usd_per_oz: coerceToNumber(row.xau_usd_per_oz, { positive: true }),
            xau_aed_per_gram: coerceToNumber(row.xau_aed_per_gram, { positive: true }),
            freshness_seconds: coerceToNumber(row.freshness_seconds, { integer: true }),
            is_fresh: toBooleanOrNull(row.is_fresh),
            is_fallback: toBooleanOrNull(row.is_fallback),
          })),
          sourceMode: 'supabase',
        },
        {
          source: 'price_snapshots',
          freshness: 'historical',
          extra: { mode: 'supabase' },
        }
      )
    );
  }

  const payload = readJsonFile(GOLD_PRICE_FILE);
  const validated = validatePricePayload(payload);
  const snapshots = validated.ok
    ? [
        {
          id: null,
          timestamp_utc: validated.normalized.timestampUtc,
          fetched_at_utc: validated.normalized.fetchedAtUtc,
          xau_usd_per_oz: validated.normalized.xauUsdPerOz,
          xau_aed_per_gram: validated.normalized.xauAedPerGram,
          source_provider: validated.normalized.sourceProvider,
          provider_chain: null,
          freshness_seconds: validated.normalized.freshnessSeconds,
          is_fresh: validated.normalized.isFresh,
          is_fallback: validated.normalized.isFallback,
          raw_payload_hash: null,
          created_at: null,
        },
      ]
    : [];

  return res.json(
    successResponse(
      {
        total: snapshots.length,
        returned: snapshots.length,
        snapshots,
        sourceMode: 'file',
      },
      {
        source: 'gold_price_file',
        freshness: snapshots.length ? computeFreshnessLabel(payload) : 'unknown',
        extra: { mode: 'file' },
      }
    )
  );
});

router.get('/providers/status', async (_req, res) => {
  const providerHealthRows = await querySupabase('provider_health', (table) =>
    table.select('*').order('provider_name', { ascending: true }).limit(200)
  );

  if (Array.isArray(providerHealthRows) && providerHealthRows.length > 0) {
    const latestSnapshotRows = await querySupabase('price_snapshots', (table) =>
      table
        .select('source_provider,timestamp_utc')
        .order('timestamp_utc', { ascending: false })
        .limit(1)
    );
    return res.json(
      successResponse(
        {
          providers: providerHealthRows,
          latestProvider: latestSnapshotRows?.[0]?.source_provider || null,
          latestTimestampUtc: latestSnapshotRows?.[0]?.timestamp_utc || null,
          sourceMode: 'supabase',
        },
        {
          source: 'provider_health',
          freshness: 'current',
          extra: { mode: 'supabase' },
        }
      )
    );
  }

  const state = readJsonFile(PROVIDER_STATE_FILE);
  const latest = readJsonFile(GOLD_PRICE_FILE);
  return res.json(
    successResponse(
      {
        providerStateFileAvailable: fileExists(PROVIDER_STATE_FILE),
        providerState: state || {},
        latestProvider: latest?.provider || latest?.source || null,
        latestTimestampUtc: latest?.timestamp_utc || latest?.fetched_at_utc || null,
        providers: [],
        sourceMode: 'file',
      },
      {
        source: 'provider-state',
        freshness: state ? 'current' : 'unknown',
        extra: { mode: 'file' },
      }
    )
  );
});

router.get('/providers/runs', authMiddleware('admin'), async (req, res) => {
  const limit = parseLimit(req.query.limit, DEFAULT_LIMIT_PROVIDER_RUNS, 1000);
  const provider = sanitizeString(req.query.provider, 120, null);

  const providerRuns = await querySupabase('provider_runs', (table) => {
    let query = table.select('*').order('created_at', { ascending: false }).limit(limit);
    if (provider) query = query.eq('provider_name', provider);
    return query;
  });

  if (Array.isArray(providerRuns) && providerRuns.length > 0) {
    return res.json(
      successResponse(
        {
          total: providerRuns.length,
          returned: providerRuns.length,
          runs: providerRuns,
          sourceMode: 'supabase',
        },
        {
          source: 'provider_runs',
          freshness: 'current',
          extra: { mode: 'supabase' },
        }
      )
    );
  }

  return res.json(
    successResponse(
      {
        total: 0,
        returned: 0,
        runs: [],
        sourceMode: 'file',
      },
      {
        source: 'provider-state',
        freshness: 'unknown',
        extra: { mode: 'file' },
      }
    )
  );
});

router.post('/events', eventsRateLimiter, (req, res) => {
  const eventName = sanitizeString(req.body?.event, MAX_EVENT_NAME_LENGTH, '');
  if (!eventName) {
    return res.status(400).json(errorResponse('VALIDATION_ERROR', 'event is required.'));
  }

  const entry = {
    id: `evt_${crypto.randomBytes(8).toString('hex')}`,
    event: eventName,
    page: sanitizeString(req.body?.page, MAX_EVENT_PAGE_LENGTH),
    ts: typeof req.body?.ts === 'number' ? req.body.ts : Date.now(),
    properties:
      req.body?.properties && typeof req.body.properties === 'object' ? req.body.properties : {},
    createdAt: new Date().toISOString(),
  };

  const events = readJsonArray(EVENTS_FILE);
  events.push(entry);
  writeJsonArray(EVENTS_FILE, events.slice(-MAX_STORED_EVENTS));

  return res
    .status(202)
    .json(
      successResponse(
        { id: entry.id, accepted: true },
        { source: 'events-ingest', freshness: 'current' }
      )
    );
});

router.post('/leads', leadsRateLimiter, (req, res) => {
  const email = sanitizeString(req.body?.email, 320, '')?.toLowerCase() || '';
  if (!EMAIL_REGEX.test(email)) {
    return res.status(400).json(errorResponse('VALIDATION_ERROR', 'A valid email is required.'));
  }

  const lead = {
    id: `lead_${crypto.randomBytes(8).toString('hex')}`,
    email,
    name: sanitizeString(req.body?.name, MAX_LEAD_NAME_LENGTH),
    message: sanitizeString(req.body?.message, MAX_LEAD_MESSAGE_LENGTH),
    source: sanitizeString(req.body?.source, MAX_LEAD_SOURCE_LENGTH, 'public'),
    createdAt: new Date().toISOString(),
  };

  const leads = readJsonArray(LEADS_FILE);
  leads.push(lead);
  writeJsonArray(LEADS_FILE, leads.slice(-MAX_STORED_LEADS));

  return res.status(201).json(
    successResponse(
      {
        id: lead.id,
        accepted: true,
      },
      {
        source: 'leads-ingest',
        freshness: 'current',
      }
    )
  );
});

module.exports = router;
module.exports.__testables = {
  buildHistoryCoverage,
  buildHistoryResponse,
  buildHistorySuccessPayload,
  buildSystemStatus,
};
