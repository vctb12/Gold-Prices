'use strict';

const crypto = require('crypto');

const HISTORY_RANGE_DAYS = {
  '1d': 1,
  '7d': 7,
  '30d': 30,
  '1y': 365,
};

function toFiniteNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toBoolean(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return fallback;
}

function parseIsoTimestamp(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return date.toISOString();
}

function sortObjectDeep(value) {
  if (Array.isArray(value)) return value.map(sortObjectDeep);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value)
    .sort()
    .reduce((acc, key) => {
      acc[key] = sortObjectDeep(value[key]);
      return acc;
    }, {});
}

/**
 * Return a deterministic JSON representation by recursively sorting object keys
 * before serialization. This ensures semantically identical payloads hash to
 * the same value even when key insertion order differs.
 *
 * @param {unknown} value
 * @returns {string}
 */
function stableJsonStringify(value) {
  return JSON.stringify(sortObjectDeep(value));
}

function computeRawPayloadHash(payload) {
  return crypto.createHash('sha256').update(stableJsonStringify(payload)).digest('hex');
}

function validatePricePayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return { ok: false, errors: ['payload must be an object'] };
  }

  const xauUsdPerOz = toFiniteNumber(payload.xau_usd_per_oz ?? payload?.gold?.ounce_usd);
  if (!xauUsdPerOz || xauUsdPerOz <= 0) {
    return { ok: false, errors: ['xau_usd_per_oz must be a positive number'] };
  }

  const provider = String(payload.provider || payload.source || '').trim();
  if (!provider) return { ok: false, errors: ['provider/source is required'] };

  const timestampUtc = parseIsoTimestamp(payload.timestamp_utc || payload.fetched_at_utc);
  const fetchedAtUtc = parseIsoTimestamp(payload.fetched_at_utc || payload.timestamp_utc);
  if (!timestampUtc || !fetchedAtUtc) {
    return { ok: false, errors: ['timestamp_utc or fetched_at_utc must be valid ISO timestamps'] };
  }

  const aedPerGram24k = toFiniteNumber(payload.aed_per_gram_24k ?? payload?.gold?.gram_aed);
  const freshnessSeconds = toFiniteNumber(payload.freshness_seconds);
  const normalized = {
    xauUsdPerOz,
    xauAedPerGram: aedPerGram24k && aedPerGram24k > 0 ? aedPerGram24k : null,
    currency: String(payload.quote_currency || 'USD').toUpperCase(),
    sourceProvider: provider,
    timestampUtc,
    fetchedAtUtc,
    freshnessSeconds: freshnessSeconds !== null ? Math.max(0, Math.round(freshnessSeconds)) : null,
    isFresh: toBoolean(payload.is_fresh, false),
    isFallback: toBoolean(payload.is_fallback, false),
    isMarketOpen: typeof payload.is_market_open === 'boolean' ? payload.is_market_open : null,
    providerResponseTimeMs: toFiniteNumber(payload.provider_response_time_ms),
    rawPayloadHash: computeRawPayloadHash(payload),
  };

  return {
    ok: true,
    errors: [],
    normalized,
  };
}

function buildPriceSnapshotRow(normalized, { providerChain = '' } = {}) {
  return {
    xau_usd_per_oz: normalized.xauUsdPerOz,
    xau_aed_per_gram: normalized.xauAedPerGram,
    currency: normalized.currency || 'USD',
    source_provider: normalized.sourceProvider,
    provider_chain: String(providerChain || ''),
    timestamp_utc: normalized.timestampUtc,
    fetched_at_utc: normalized.fetchedAtUtc,
    freshness_seconds: normalized.freshnessSeconds,
    is_fresh: normalized.isFresh,
    is_fallback: normalized.isFallback,
    is_market_open: normalized.isMarketOpen,
    raw_payload_hash: normalized.rawPayloadHash,
  };
}

async function hasDuplicateSnapshot(supabase, row) {
  const { data, error } = await supabase
    .from('price_snapshots')
    .select('id')
    .eq('timestamp_utc', row.timestamp_utc)
    .eq('source_provider', row.source_provider)
    .eq('raw_payload_hash', row.raw_payload_hash)
    .limit(1);
  if (error) throw new Error(`duplicate-check failed: ${error.message}`);
  return Array.isArray(data) && data.length > 0;
}

async function insertSnapshotIfNew(supabase, row) {
  const { data, error } = await supabase
    .from('price_snapshots')
    .insert([row])
    .select('id')
    .single();
  if (error) {
    // Postgres duplicate key violations use SQLSTATE 23505. Some client stacks
    // may omit `code`, so we keep a narrow message fallback for compatibility.
    const isDuplicate =
      error.code === '23505' ||
      /\bduplicate\s+key\b|\bunique\s+constraint\b/i.test(String(error.message || ''));
    if (isDuplicate) return { inserted: false, duplicate: true };
    throw new Error(`snapshot insert failed: ${error.message}`);
  }
  return { inserted: true, duplicate: false, id: data?.id || null };
}

async function insertProviderRun(supabase, normalized, { circuitState = null } = {}) {
  let status = 'stale';
  if (normalized.isFresh) status = 'success';
  else if (normalized.isFallback) status = 'fallback';
  const row = {
    provider_name: normalized.sourceProvider,
    status,
    latency_ms:
      normalized.providerResponseTimeMs !== null
        ? Math.round(normalized.providerResponseTimeMs)
        : null,
    http_status: null,
    error_code: null,
    error_message: null,
    freshness_seconds: normalized.freshnessSeconds,
    circuit_state: circuitState || (normalized.isFallback ? 'fallback' : 'closed'),
  };
  const { error } = await supabase.from('provider_runs').insert([row]);
  if (error) throw new Error(`provider_runs insert failed: ${error.message}`);
  return row;
}

async function upsertProviderHealth(supabase, providerName, fallbackCircuitState = 'closed') {
  const sinceIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('provider_runs')
    .select('status,latency_ms,circuit_state,created_at')
    .eq('provider_name', providerName)
    .gte('created_at', sinceIso)
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) throw new Error(`provider health query failed: ${error.message}`);
  const rows = Array.isArray(data) ? data : [];
  const total = rows.length;
  const successCount = rows.filter((row) => row.status === 'success').length;
  const latencyRows = rows
    .map((row) => toFiniteNumber(row.latency_ms))
    .filter((value) => value !== null && value >= 0);
  const avgLatency24h =
    latencyRows.length > 0
      ? Number((latencyRows.reduce((sum, value) => sum + value, 0) / latencyRows.length).toFixed(2))
      : null;

  const latestSuccess = rows.find((row) => row.status === 'success')?.created_at || null;
  const latestFailure =
    rows.find((row) => row.status && row.status !== 'success')?.created_at || null;
  const latest = rows[0] || null;
  const currentStatus = latest?.status || 'unknown';
  const circuitState = latest?.circuit_state || fallbackCircuitState || 'unknown';
  const successRate24h =
    total > 0
      ? Number(((successCount / total) * 100).toFixed(2))
      : currentStatus === 'success'
        ? 100
        : 0;

  const row = {
    provider_name: providerName,
    last_success_at: latestSuccess,
    last_failure_at: latestFailure,
    success_rate_24h: successRate24h,
    avg_latency_24h: avgLatency24h,
    current_status: currentStatus,
    circuit_state: circuitState,
    updated_at: new Date().toISOString(),
  };

  const { error: upsertError } = await supabase
    .from('provider_health')
    .upsert([row], { onConflict: 'provider_name' });
  if (upsertError) throw new Error(`provider_health upsert failed: ${upsertError.message}`);
  return row;
}

function normalizeHistoryRange(range) {
  const key = String(range || '30d').toLowerCase();
  return Object.prototype.hasOwnProperty.call(HISTORY_RANGE_DAYS, key) ? key : '30d';
}

function getHistoryWindowStart(range) {
  const key = normalizeHistoryRange(range);
  const days = HISTORY_RANGE_DAYS[key];
  return new Date(Date.now() - days * 86400000).toISOString();
}

module.exports = {
  HISTORY_RANGE_DAYS,
  normalizeHistoryRange,
  getHistoryWindowStart,
  computeRawPayloadHash,
  validatePricePayload,
  buildPriceSnapshotRow,
  hasDuplicateSnapshot,
  insertSnapshotIfNew,
  insertProviderRun,
  upsertProviderHealth,
};
