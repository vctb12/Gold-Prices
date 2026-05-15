'use strict';

/**
 * server/lib/api-key-auth.js
 *
 * API key authentication and quota enforcement middleware for the
 * public developer API (/api/v1/public/*).
 *
 * Usage:
 *   const { requireApiKey, optionalApiKey } = require('./api-key-auth');
 *
 *   router.get('/public/latest', optionalApiKey, handler);   // 10 free req/day anon
 *   router.get('/public/history', requireApiKey, handler);   // key required
 *
 * After the middleware runs, req.apiKeyContext is set:
 *   {
 *     keyId:       string,   // API key record ID
 *     userId:      string,   // owner user ID
 *     tier:        string,   // 'free' | 'pro' | 'api'
 *     quota:       number,   // daily call limit for this key
 *     used:        number,   // calls used today (after increment)
 *     historyDays: number,   // days of history the tier allows (0 = unlimited)
 *   }
 *
 * For anonymous requests under optionalApiKey, req.apiKeyContext is null
 * and a lighter anonymous quota is applied (keyed to IP).
 */

const billingRepo = require('./billing-repository');
const { resolveUserEntitlements } = require('./entitlements');

// How many free (unauthenticated) calls we allow per IP per day.
// This applies to anonymous API requests only (no key provided).
const ANON_FREE_DAILY_LIMIT = 10;

// In-memory anon counter: Map<ip:date, count>.  Resets naturally on server restart.
// Not persisted — fine for rate-limiting anonymous public access.
const _anonCounters = new Map();
// Track the last date we pruned so we only iterate the map once per day.
let _lastPruneDay = '';

function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Increment the in-memory anon counter and return the new count.
 * Prunes stale keys once per UTC day rather than on every request.
 */
function incrementAnonCounter(ip) {
  const today = todayUtc();
  const k = `${ip}:${today}`;
  // Prune only when the calendar day rolls over (O(n) but at most once/day)
  if (_lastPruneDay !== today) {
    for (const existing of _anonCounters.keys()) {
      if (!existing.endsWith(`:${today}`)) _anonCounters.delete(existing);
    }
    _lastPruneDay = today;
  }
  const count = (_anonCounters.get(k) || 0) + 1;
  _anonCounters.set(k, count);
  return count;
}

function resolveIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.trim()) return fwd.split(',')[0].trim();
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

function extractRawKey(req) {
  // Accept: Authorization: Bearer <key>  OR  X-API-Key: <key>
  // Note: query-parameter API keys are intentionally NOT supported because they
  // appear in server access logs and browser history, which is a security risk
  // for long-lived credentials.
  const authHeader = req.headers['authorization'] || '';
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice('Bearer '.length).trim();
    if (token.startsWith('gtl_')) return token;
  }
  const xApiKey = req.headers['x-api-key'];
  if (typeof xApiKey === 'string' && xApiKey.startsWith('gtl_')) return xApiKey.trim();
  return null;
}

/**
 * Shared resolution logic.
 * Returns { context, errorCode, errorMessage, statusCode } or { context }.
 */
async function resolveKeyContext(rawKey) {
  const keyRecord = await billingRepo.resolveApiKey(rawKey);
  if (!keyRecord) {
    return {
      context: null,
      statusCode: 401,
      errorCode: 'INVALID_API_KEY',
      errorMessage: 'The API key is invalid or has been revoked.',
    };
  }

  // Resolve entitlements to get quota and history window
  const { tier, entitlements } = await resolveUserEntitlements(keyRecord.userId);
  const quota = entitlements.apiCallsPerDay || 0;
  const historyDays = entitlements.historyDays || 30;

  // Increment usage and check quota
  const used = await billingRepo.incrementApiUsage(keyRecord.id);

  if (quota > 0 && used > quota) {
    return {
      context: null,
      statusCode: 429,
      errorCode: 'QUOTA_EXCEEDED',
      errorMessage: `Daily quota of ${quota} calls exceeded. Resets at midnight UTC.`,
      extra: { quota, used, resetAt: `${todayUtc()}T23:59:59Z` },
    };
  }

  return {
    context: {
      keyId: keyRecord.id,
      userId: keyRecord.userId,
      tier,
      quota,
      used,
      historyDays,
    },
  };
}

/**
 * requireApiKey — the API key is mandatory.
 * Rejects with 401 if no key is provided, 401 if invalid/revoked,
 * 429 if quota exceeded.
 */
async function requireApiKey(req, res, next) {
  const rawKey = extractRawKey(req);
  if (!rawKey) {
    return res.status(401).json({
      ok: false,
      error: {
        code: 'API_KEY_REQUIRED',
        message:
          'An API key is required. Pass it via the X-API-Key header or Authorization: Bearer header.',
      },
    });
  }

  try {
    const result = await resolveKeyContext(rawKey);
    if (result.errorCode) {
      const body = { ok: false, error: { code: result.errorCode, message: result.errorMessage } };
      if (result.extra) body.error.details = result.extra;
      return res.status(result.statusCode).json(body);
    }
    req.apiKeyContext = result.context;
    return next();
  } catch (err) {
    console.error('[api-key-auth] requireApiKey error:', err.message);
    return res.status(500).json({
      ok: false,
      error: { code: 'AUTH_ERROR', message: 'API key validation failed. Please try again.' },
    });
  }
}

/**
 * optionalApiKey — the API key is optional.
 * If present, validates it and enforces per-key quota.
 * If absent, enforces a light anonymous IP-based quota.
 * Sets req.apiKeyContext (or null for anon requests).
 */
async function optionalApiKey(req, res, next) {
  const rawKey = extractRawKey(req);

  if (rawKey) {
    try {
      const result = await resolveKeyContext(rawKey);
      if (result.errorCode) {
        const body = {
          ok: false,
          error: { code: result.errorCode, message: result.errorMessage },
        };
        if (result.extra) body.error.details = result.extra;
        return res.status(result.statusCode).json(body);
      }
      req.apiKeyContext = result.context;
      return next();
    } catch (err) {
      console.error('[api-key-auth] optionalApiKey error:', err.message);
      return res.status(500).json({
        ok: false,
        error: { code: 'AUTH_ERROR', message: 'API key validation failed. Please try again.' },
      });
    }
  }

  // Anonymous request — apply IP-based limit
  const ip = resolveIp(req);
  const used = incrementAnonCounter(ip);
  if (used > ANON_FREE_DAILY_LIMIT) {
    return res.status(429).json({
      ok: false,
      error: {
        code: 'ANON_QUOTA_EXCEEDED',
        message: `Anonymous daily limit of ${ANON_FREE_DAILY_LIMIT} requests exceeded. Create a free API key for a higher quota.`,
        details: { limit: ANON_FREE_DAILY_LIMIT, used, resetAt: `${todayUtc()}T23:59:59Z` },
      },
    });
  }

  req.apiKeyContext = null;
  return next();
}

module.exports = { requireApiKey, optionalApiKey };
