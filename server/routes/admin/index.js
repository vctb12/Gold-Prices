/**
 * Admin API Routes
 * RESTful endpoints for admin operations
 */

const express = require('express');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const auth = require('../../lib/auth');
const { authenticate, authMiddleware } = auth;
const shopManager = require('../../lib/admin/shop-manager');
const auditLog = require('../../lib/audit-log');
const shopsRepo = require('../../repositories/shops.repository');
const auditRepo = require('../../repositories/audit.repository');
const { ValidationError, NotFoundError: _NotFoundError } = require('../../lib/errors');
const pendingShopsRepo = require('../../repositories/pending-shops.repository');
const leadsRepo = require('../../repositories/leads.repository');
const newsletterRepo = require('../../repositories/newsletter.repository');
const { getSupabaseClient } = require('../../lib/supabase-client');

const ROOT = path.resolve(__dirname, '../../..');
const DATA_DIR = path.join(ROOT, 'data');
const REPORTS_DIR = path.join(ROOT, 'reports');
const GOLD_PRICE_FILE = path.join(DATA_DIR, 'gold_price.json');
const PROVIDER_STATE_FILE = path.join(DATA_DIR, 'provider_state.json');
const LAST_TWEET_STATE_FILE = path.join(DATA_DIR, 'last_tweet_state.json');
const ALERTS_DATA_FILE = process.env.ALERTS_DATA_FILE || path.join(DATA_DIR, 'alerts-v1.json');
const BILLING_DATA_FILE = path.join(DATA_DIR, 'billing.json');
const SEO_INVENTORY_FILE = path.join(REPORTS_DIR, 'seo', 'inventory.json');
const POST_GOLD_WORKFLOW_FILE = path.join(ROOT, '.github', 'workflows', 'post_gold.yml');

// ---------------------------------------------------------------------------
// Admin responses carry sensitive data (audit logs, user records, shop
// drafts). Force every admin reply to be uncacheable — this prevents
// intermediate proxies, browser disk cache, or a shared CDN from storing a
// stale (or leaked) authenticated response and serving it to a later user.
// Track B #6 in docs/plans/2026-04-24_security-performance-deps-audit.md.
// ---------------------------------------------------------------------------
router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  res.set('Pragma', 'no-cache'); // HTTP/1.0 proxies
  res.set('Expires', '0');
  next();
});

// ---------------------------------------------------------------------------
// Simple in-memory rate limiter for the login endpoint
// Tracks *failed* attempts per IP; blocks after MAX_ATTEMPTS within WINDOW_MS.
// Uses a custom implementation so it only counts failures, not all requests.
//
// Bounds: a periodic sweep drops expired windows and a hard size cap evicts
// the oldest entry when the map grows beyond LOGIN_MAX_ENTRIES. Without these
// an attacker cycling source IPs can balloon the Map until the process OOMs.
// See docs/plans/2026-04-24_security-performance-deps-audit.md Track A #2.
// ---------------------------------------------------------------------------
const LOGIN_MAX_ATTEMPTS = 10;
const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const LOGIN_MAX_ENTRIES = 10_000;
const LOGIN_SWEEP_MS = 60 * 1000; // prune expired entries every minute

const loginAttempts = new Map(); // ip -> { count, firstAttemptAt }

function sweepExpiredAttempts(map, windowMs) {
  // Deleting entries during synchronous Map iteration is safe — per spec, a
  // Map iterator tolerates in-loop `.delete()` calls on already-visited or
  // current keys without skipping or throwing.
  const now = Date.now();
  for (const [key, record] of map) {
    if (now - record.firstAttemptAt > windowMs) {
      map.delete(key);
    }
  }
}

function evictIfOverCap(map, cap) {
  if (map.size <= cap) return;
  // Map iteration order is insertion order — the first key is the oldest.
  // Drop oldest entries until we're back under the cap.
  const toDrop = map.size - cap;
  const it = map.keys();
  for (let i = 0; i < toDrop; i++) {
    const { value } = it.next();
    if (value === undefined) break;
    map.delete(value);
  }
}

// Hold onto the timer so tests can clear it via `.unref()` and the process
// does not hang on shutdown.
const loginSweepTimer = setInterval(() => {
  sweepExpiredAttempts(loginAttempts, LOGIN_WINDOW_MS);
}, LOGIN_SWEEP_MS);
if (typeof loginSweepTimer.unref === 'function') loginSweepTimer.unref();

function loginRateLimiter(req, res, next) {
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  const now = Date.now();
  const record = loginAttempts.get(ip);

  if (record) {
    if (now - record.firstAttemptAt > LOGIN_WINDOW_MS) {
      loginAttempts.delete(ip);
    } else if (record.count >= LOGIN_MAX_ATTEMPTS) {
      const retryAfterSec = Math.ceil((LOGIN_WINDOW_MS - (now - record.firstAttemptAt)) / 1000);
      res.set('Retry-After', retryAfterSec);
      return res.status(429).json({
        success: false,
        message: 'Too many login attempts. Please try again later.',
      });
    }
  }
  next();
}

function recordFailedLogin(ip) {
  const now = Date.now();
  const record = loginAttempts.get(ip);
  if (!record || now - record.firstAttemptAt > LOGIN_WINDOW_MS) {
    loginAttempts.set(ip, { count: 1, firstAttemptAt: now });
  } else {
    record.count += 1;
  }
  evictIfOverCap(loginAttempts, LOGIN_MAX_ENTRIES);
}

function clearLoginAttempts(ip) {
  loginAttempts.delete(ip);
}

// ---------------------------------------------------------------------------
// Rate limiter for authenticated admin routes (user management, stats).
// 100 requests per IP per 15-minute window.
// Using express-rate-limit so static analysis tools can recognise the pattern.
// ---------------------------------------------------------------------------
const adminRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please try again later.' },
});

// ---------------------------------------------------------------------------
// Input validation helpers
// ---------------------------------------------------------------------------

/** Sanitise a string: trim, collapse whitespace, limit length. Returns undefined for non-string values. */
function sanitizeString(val, maxLen = 500) {
  if (val === undefined || val === null) return undefined;
  if (typeof val !== 'string') return undefined;
  const cleaned = val.trim().replace(/\s+/g, ' ').slice(0, maxLen);
  return cleaned || undefined;
}

/** Validate integer query param (returns parsed int or default). */
function parseIntParam(val, defaultVal, min = 1, max = 1000) {
  if (val === undefined || val === null) return defaultVal;
  const n = parseInt(val, 10);
  if (isNaN(n) || n < min) return defaultVal;
  return Math.min(n, max);
}

/** Validate shop data fields. Returns sanitised object or throws ValidationError. */
function validateShopInput(body) {
  const cleaned = {};
  const stringFields = [
    'name',
    'city',
    'country',
    'phone',
    'email',
    'website',
    'address',
    'hours',
    'type',
    'status',
    'description',
  ];
  const booleanFields = ['verified', 'featured'];
  const numberFields = ['latitude', 'longitude'];

  for (const field of stringFields) {
    if (body[field] !== undefined) {
      const val = sanitizeString(body[field]);
      if (val !== undefined) cleaned[field] = val;
    }
  }

  for (const field of booleanFields) {
    if (body[field] !== undefined) {
      if (typeof body[field] === 'boolean') {
        cleaned[field] = body[field];
      } else if (body[field] === 'true' || body[field] === 'false') {
        cleaned[field] = body[field] === 'true';
      }
      // Silently ignore invalid boolean values
    }
  }

  for (const field of numberFields) {
    if (body[field] !== undefined) {
      const num = Number(body[field]);
      if (!isNaN(num) && isFinite(num)) {
        cleaned[field] = num;
      }
    }
  }

  return cleaned;
}

function readJsonSafe(filePath, fallback = null) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function hasFile(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

function maskEmail(email) {
  if (typeof email !== 'string') return null;
  const [name, domain] = email.split('@');
  if (!name || !domain) return null;
  const prefixLength = Math.min(2, Math.max(0, name.length - 1));
  if (prefixLength === 0) return `***@${domain}`;
  return `${name.slice(0, prefixLength)}***@${domain}`;
}

function parseIsoDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}

/**
 * Validate a Supabase query response and throw when it contains an error.
 * @param {{ error?: { message?: string } } | null | undefined} response
 * @param {string} context
 */
function assertSupabaseResponseOk(response, context) {
  if (response?.error) {
    const message = response.error.message || 'Unknown Supabase query error';
    throw new Error(`${context}: ${message}`);
  }
}

async function getProviderHealthSummary() {
  const sb = getSupabaseClient(false);
  if (sb) {
    try {
      const [providersRes, latestSnapshotRes, recentRunsRes] = await Promise.all([
        sb
          .from('provider_health')
          .select('*')
          .order('provider_name', { ascending: true })
          .limit(100),
        sb
          .from('price_snapshots')
          .select('source_provider,timestamp_utc,is_fresh,is_fallback')
          .order('timestamp_utc', { ascending: false })
          .limit(1)
          .maybeSingle(),
        sb
          .from('provider_runs')
          .select('provider_name,status,created_at,latency_ms')
          .order('created_at', { ascending: false })
          .limit(20),
      ]);
      assertSupabaseResponseOk(providersRes, 'provider_health query failed');
      assertSupabaseResponseOk(latestSnapshotRes, 'latest price_snapshots query failed');
      assertSupabaseResponseOk(recentRunsRes, 'provider_runs query failed');
      const providers = providersRes?.data;
      const latestSnapshot = latestSnapshotRes?.data;
      const recentRuns = recentRunsRes?.data;
      return {
        sourceMode: 'supabase',
        providers: Array.isArray(providers) ? providers : [],
        latestProvider: latestSnapshot?.source_provider || null,
        latestTimestampUtc: latestSnapshot?.timestamp_utc || null,
        latestFresh: latestSnapshot?.is_fresh ?? null,
        latestFallback: latestSnapshot?.is_fallback ?? null,
        recentRuns: Array.isArray(recentRuns) ? recentRuns : [],
      };
    } catch (err) {
      console.warn('[admin] provider health supabase fallback:', err.message);
    }
  }

  const providerState = readJsonSafe(PROVIDER_STATE_FILE, {});
  const latestPrice = readJsonSafe(GOLD_PRICE_FILE, {});
  return {
    sourceMode: 'file',
    providers: [],
    providerStateFileAvailable: hasFile(PROVIDER_STATE_FILE),
    providerState: providerState || {},
    latestProvider: latestPrice?.provider || latestPrice?.source || null,
    latestTimestampUtc: latestPrice?.timestamp_utc || latestPrice?.fetched_at_utc || null,
    latestFresh: latestPrice?.is_fresh ?? null,
    latestFallback: latestPrice?.is_fallback ?? null,
    recentRuns: [],
  };
}

async function getPriceSnapshotsSummary(limit = 20) {
  const boundedLimit = Math.max(1, Math.min(Number(limit) || 20, 200));
  const sb = getSupabaseClient(false);
  if (sb) {
    try {
      const snapshotsRes = await sb
        .from('price_snapshots')
        .select(
          'id,timestamp_utc,fetched_at_utc,xau_usd_per_oz,xau_aed_per_gram,source_provider,freshness_seconds,is_fresh,is_fallback,provider_chain'
        )
        .order('timestamp_utc', { ascending: false })
        .limit(boundedLimit);
      assertSupabaseResponseOk(snapshotsRes, 'price_snapshots query failed');
      const data = snapshotsRes?.data;
      return {
        sourceMode: 'supabase',
        total: Array.isArray(data) ? data.length : 0,
        snapshots: Array.isArray(data) ? data : [],
      };
    } catch (err) {
      console.warn('[admin] snapshots supabase fallback:', err.message);
    }
  }

  const latestPrice = readJsonSafe(GOLD_PRICE_FILE, null);
  const fallbackSnapshots = latestPrice
    ? [
        {
          id: null,
          timestamp_utc: latestPrice.timestamp_utc || latestPrice.fetched_at_utc || null,
          fetched_at_utc: latestPrice.fetched_at_utc || null,
          xau_usd_per_oz: latestPrice.xau_usd_per_oz ?? latestPrice?.gold?.ounce_usd ?? null,
          xau_aed_per_gram: latestPrice.aed_per_gram_24k ?? latestPrice?.gold?.gram_aed ?? null,
          source_provider: latestPrice.provider || latestPrice.source || null,
          freshness_seconds: latestPrice.freshness_seconds ?? null,
          is_fresh: latestPrice.is_fresh ?? null,
          is_fallback: latestPrice.is_fallback ?? null,
          provider_chain: latestPrice.provider_chain || null,
        },
      ]
    : [];
  return {
    sourceMode: 'file',
    total: fallbackSnapshots.length,
    snapshots: fallbackSnapshots,
  };
}

async function getAlertsSummary() {
  const sb = getSupabaseClient(false);
  if (sb) {
    try {
      const [rulesRes, eventsRes] = await Promise.all([
        sb
          .from('alert_rules')
          .select('id,is_active,verified_at,unsubscribed_at,currency,condition,updated_at')
          .order('updated_at', { ascending: false })
          .limit(5000),
        sb
          .from('alert_events')
          .select('id,event_type,delivery_status,created_at')
          .order('created_at', { ascending: false })
          .limit(20),
      ]);
      assertSupabaseResponseOk(rulesRes, 'alert_rules query failed');
      assertSupabaseResponseOk(eventsRes, 'alert_events query failed');
      const rules = rulesRes?.data;
      const events = eventsRes?.data;
      const allRules = Array.isArray(rules) ? rules : [];
      return {
        sourceMode: 'supabase',
        counts: {
          total: allRules.length,
          active: allRules.filter((r) => r.is_active === true).length,
          verified: allRules.filter((r) => Boolean(r.verified_at)).length,
          unsubscribed: allRules.filter((r) => Boolean(r.unsubscribed_at)).length,
        },
        recentEvents: Array.isArray(events) ? events : [],
      };
    } catch (err) {
      console.warn('[admin] alerts supabase fallback:', err.message);
    }
  }

  const store = readJsonSafe(ALERTS_DATA_FILE, {});
  const rules = Array.isArray(store?.alert_rules) ? store.alert_rules : [];
  const events = Array.isArray(store?.alert_events) ? store.alert_events : [];
  return {
    sourceMode: 'file',
    counts: {
      total: rules.length,
      active: rules.filter((r) => r.is_active === true).length,
      verified: rules.filter((r) => Boolean(r.verified_at)).length,
      unsubscribed: rules.filter((r) => Boolean(r.unsubscribed_at)).length,
    },
    recentEvents: events.slice(-20).reverse(),
  };
}

function getLeadsSummary() {
  const counts = leadsRepo.getLeadCounts();
  const recent = leadsRepo.getLeads({ limit: 10, offset: 0 }).map((lead) => ({
    id: lead.id,
    type: lead.type,
    status: lead.status,
    locale: lead.locale || null,
    source: lead.source || null,
    email: maskEmail(lead.email),
    created_at: lead.created_at,
    updated_at: lead.updated_at,
  }));
  return { counts, recent };
}

function getShopsModerationSummary() {
  const queueCounts = pendingShopsRepo.getCounts();
  const pendingQueue = pendingShopsRepo
    .getPending()
    .sort((a, b) => new Date(b.submitted_at || 0) - new Date(a.submitted_at || 0))
    .slice(0, 20)
    .map((submission) => ({
      id: submission.id,
      shop_name: submission.shop_name,
      city: submission.city,
      country_code: submission.country_code,
      status: submission.status,
      submitted_at: submission.submitted_at || null,
    }));
  const unverified = shopManager.getFilteredShops({
    status: 'unverified',
    page: 1,
    limit: 1,
  }).total;
  return {
    counts: {
      ...queueCounts,
      unverifiedShops: typeof unverified === 'number' ? unverified : 0,
    },
    pendingQueue,
  };
}

function getNewsletterSummary() {
  const counts = newsletterRepo.getCounts();
  const latestSubscribers = newsletterRepo
    .getAll()
    .slice()
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
    .slice(0, 10)
    .map((subscriber) => ({
      id: subscriber.id,
      email: maskEmail(subscriber.email),
      status: subscriber.status,
      locale: subscriber.locale || null,
      source: subscriber.source || null,
      created_at: subscriber.created_at || null,
      confirmed_at: subscriber.confirmed_at || null,
    }));
  return { counts, latestSubscribers };
}

async function getBillingSummary() {
  const configured = Boolean(
    process.env.STRIPE_SECRET_KEY &&
    process.env.STRIPE_WEBHOOK_SECRET &&
    process.env.STRIPE_PUBLISHABLE_KEY
  );
  const sb = getSupabaseClient(false);
  if (sb) {
    try {
      const [subscriptionsRes, customersRes, auditRes] = await Promise.all([
        sb
          .from('subscriptions')
          .select('id,status,tier,updated_at,cancel_at_period_end')
          .order('updated_at', { ascending: false })
          .limit(5000),
        sb.from('stripe_customers').select('id', { count: 'exact', head: true }),
        sb
          .from('billing_audit_logs')
          .select('id,action,created_at')
          .order('created_at', { ascending: false })
          .limit(10),
      ]);
      assertSupabaseResponseOk(subscriptionsRes, 'subscriptions query failed');
      assertSupabaseResponseOk(customersRes, 'stripe_customers count query failed');
      assertSupabaseResponseOk(auditRes, 'billing_audit_logs query failed');
      const subscriptions = subscriptionsRes?.data;
      const customerCount = customersRes?.count;
      const auditLogs = auditRes?.data;
      const rows = Array.isArray(subscriptions) ? subscriptions : [];
      return {
        sourceMode: 'supabase',
        configured,
        counts: {
          customers: customerCount || 0,
          subscriptions: rows.length,
          active: rows.filter((row) => row.status === 'active').length,
          trialing: rows.filter((row) => row.status === 'trialing').length,
          past_due: rows.filter((row) => row.status === 'past_due').length,
          canceled: rows.filter((row) => row.status === 'canceled').length,
          pro: rows.filter((row) => row.tier === 'pro').length,
          api: rows.filter((row) => row.tier === 'api').length,
        },
        recentAudit: Array.isArray(auditLogs) ? auditLogs : [],
      };
    } catch (err) {
      console.warn('[admin] billing supabase fallback:', err.message);
    }
  }

  const store = readJsonSafe(BILLING_DATA_FILE, {});
  const subs = Array.isArray(store?.subscriptions) ? store.subscriptions : [];
  const customers = Array.isArray(store?.stripe_customers) ? store.stripe_customers : [];
  const audit = Array.isArray(store?.billing_audit_logs) ? store.billing_audit_logs : [];
  return {
    sourceMode: 'file',
    configured,
    counts: {
      customers: customers.length,
      subscriptions: subs.length,
      active: subs.filter((row) => row.status === 'active').length,
      trialing: subs.filter((row) => row.status === 'trialing').length,
      past_due: subs.filter((row) => row.status === 'past_due').length,
      canceled: subs.filter((row) => row.status === 'canceled').length,
      pro: subs.filter((row) => row.tier === 'pro').length,
      api: subs.filter((row) => row.tier === 'api').length,
    },
    recentAudit: audit.slice(-10).reverse(),
  };
}

function getSeoSummary() {
  const inventory = readJsonSafe(SEO_INVENTORY_FILE, null);
  if (!inventory || typeof inventory !== 'object') {
    return {
      available: false,
      sourceMode: 'file',
      message: 'SEO inventory report not available.',
    };
  }
  return {
    available: true,
    sourceMode: 'file',
    generatedAtDate: inventory.generatedAtDate || null,
    summary: inventory.summary || {},
  };
}

function getXAutomationSummary() {
  const state = readJsonSafe(LAST_TWEET_STATE_FILE, {});
  const providerState = readJsonSafe(PROVIDER_STATE_FILE, {});
  return {
    workflowConfigured: hasFile(POST_GOLD_WORKFLOW_FILE),
    stateFileAvailable: hasFile(LAST_TWEET_STATE_FILE),
    lastPost: {
      tweetId: state.last_tweet_id || null,
      timeUtc: parseIsoDate(state.last_tweet_time_utc),
      sourceType: state.last_source_type || null,
      provider: state.last_provider || null,
      providerTimestampUtc: parseIsoDate(state.last_provider_timestamp_utc),
      postReason: state.last_post_reason || null,
      triggerSource: state.last_trigger_source || null,
      runId: state.last_trigger_run_id || null,
      runAttempt: state.last_trigger_run_attempt || null,
    },
    providerCircuit: providerState || {},
  };
}

async function getAuditLogSummary(limit = 20) {
  const capped = Math.max(1, Math.min(Number(limit) || 20, 200));
  const result = await auditRepo.query({ page: 1, limit: capped });
  const actionCounts = {};
  for (const row of result.logs || []) {
    const key = row.action || 'unknown';
    actionCounts[key] = (actionCounts[key] || 0) + 1;
  }
  return {
    total: result.total || 0,
    returned: (result.logs || []).length,
    actionCounts,
    logs: result.logs || [],
  };
}

async function getControlCenterSummary() {
  const [providerHealth, priceSnapshots, alerts, billing, audit] = await Promise.all([
    getProviderHealthSummary(),
    getPriceSnapshotsSummary(10),
    getAlertsSummary(),
    getBillingSummary(),
    getAuditLogSummary(10),
  ]);
  return {
    generatedAt: new Date().toISOString(),
    modules: {
      providerHealth,
      priceSnapshots,
      alerts,
      shopsModeration: getShopsModerationSummary(),
      leads: getLeadsSummary(),
      newsletter: getNewsletterSummary(),
      billing,
      seo: getSeoSummary(),
      xAutomation: getXAutomationSummary(),
      audit,
    },
  };
}

function moderatePendingSubmission({ submissionId, action, actorEmail, reason }) {
  const sub = pendingShopsRepo.getById(submissionId);
  if (!sub) {
    return { statusCode: 404, body: { success: false, message: 'Submission not found' } };
  }
  if (sub.status !== 'pending') {
    return {
      statusCode: 409,
      body: { success: false, message: `Submission is already ${sub.status}` },
    };
  }

  const before = {
    status: sub.status,
    reviewed_at: sub.reviewed_at || null,
    reviewed_by: sub.reviewed_by || null,
  };

  if (action === 'approve') {
    const shopData = {
      name: sub.shop_name,
      city: sub.city,
      country: sub.country_code,
      phone: sub.contact_phone || '',
      email: sub.contact_email || '',
      website: sub.website || '',
      notes: sub.notes || '',
      type: 'direct',
      verified: false,
    };
    const createResult = shopManager.createShop(shopData, actorEmail);
    if (!createResult.success) {
      return {
        statusCode: 500,
        body: {
          success: false,
          message: `Failed to create shop: ${createResult.message || 'unknown error'}`,
        },
      };
    }

    const now = new Date().toISOString();
    const updatedSubmission = pendingShopsRepo.update(sub.id, {
      status: 'approved',
      reviewed_at: now,
      reviewed_by: actorEmail,
      approved_shop_id: createResult.shop.id,
    });

    auditLog.logAction(actorEmail, 'approve', 'pending_shop', sub.id, {
      before,
      after: {
        status: 'approved',
        reviewed_at: now,
        reviewed_by: actorEmail,
        approved_shop_id: createResult.shop.id,
      },
      shop_name: sub.shop_name,
    });

    return {
      statusCode: 200,
      body: { success: true, shop: createResult.shop, submission: updatedSubmission },
    };
  }

  const normalizedReason = sanitizeString(reason, 500);
  const safeReason =
    typeof normalizedReason === 'string' && normalizedReason.trim().length > 0
      ? normalizedReason.trim()
      : 'No reason provided';
  const now = new Date().toISOString();
  const updatedSubmission = pendingShopsRepo.update(sub.id, {
    status: 'rejected',
    reviewed_at: now,
    reviewed_by: actorEmail,
    rejection_reason: safeReason,
  });

  auditLog.logAction(actorEmail, 'reject', 'pending_shop', sub.id, {
    before,
    after: {
      status: 'rejected',
      reviewed_at: now,
      reviewed_by: actorEmail,
    },
    shop_name: sub.shop_name,
    reason: safeReason,
  });

  return {
    statusCode: 200,
    body: { success: true, submission: updatedSubmission },
  };
}

// Login endpoint
router.post('/auth/login', loginRateLimiter, async (req, res) => {
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password required',
      });
    }

    const result = await authenticate(email, password);

    if (!result.success) {
      recordFailedLogin(ip);
      return res.status(401).json(result);
    }

    clearLoginAttempts(ip);

    // Log login
    auditLog.logAction(result.user.email, 'login', 'user', result.user.id, {
      success: true,
    });

    res.json(result);
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({
      success: false,
      message: 'Authentication failed',
    });
  }
});

// Verify token endpoint
router.get('/auth/verify', authMiddleware(), (req, res) => {
  res.json({
    success: true,
    user: req.user,
  });
});

// ===== OPERATIONS CONTROL CENTER (admin-only) =====

router.get('/ops/provider-health', adminRateLimiter, authMiddleware('admin'), async (_req, res) => {
  try {
    const data = await getProviderHealthSummary();
    res.json({ success: true, data });
  } catch (err) {
    console.error('[admin] provider-health error:', err);
    res.status(500).json({ success: false, message: 'Failed to load provider health.' });
  }
});

router.get('/ops/price-snapshots', adminRateLimiter, authMiddleware('admin'), async (req, res) => {
  try {
    const limit = parseIntParam(req.query.limit, 20, 1, 200);
    const data = await getPriceSnapshotsSummary(limit);
    res.json({ success: true, data });
  } catch (err) {
    console.error('[admin] price-snapshots error:', err);
    res.status(500).json({ success: false, message: 'Failed to load price snapshots.' });
  }
});

router.get('/ops/alerts-summary', adminRateLimiter, authMiddleware('admin'), async (_req, res) => {
  try {
    const data = await getAlertsSummary();
    res.json({ success: true, data });
  } catch (err) {
    console.error('[admin] alerts-summary error:', err);
    res.status(500).json({ success: false, message: 'Failed to load alerts summary.' });
  }
});

router.get('/ops/leads-summary', adminRateLimiter, authMiddleware('admin'), (_req, res) => {
  try {
    res.json({ success: true, data: getLeadsSummary() });
  } catch (err) {
    console.error('[admin] leads-summary error:', err);
    res.status(500).json({ success: false, message: 'Failed to load leads summary.' });
  }
});

router.get('/ops/shops-moderation', adminRateLimiter, authMiddleware('admin'), (_req, res) => {
  try {
    res.json({ success: true, data: getShopsModerationSummary() });
  } catch (err) {
    console.error('[admin] shops-moderation error:', err);
    res.status(500).json({ success: false, message: 'Failed to load moderation summary.' });
  }
});

router.post(
  '/ops/shops-moderation/:id/:action',
  adminRateLimiter,
  authMiddleware('editor'),
  (req, res) => {
    try {
      const action = sanitizeString(req.params.action, 20);
      if (!['approve', 'reject'].includes(action)) {
        return res.status(400).json({ success: false, message: 'Invalid moderation action.' });
      }
      const result = moderatePendingSubmission({
        submissionId: req.params.id,
        action,
        actorEmail: req.user.email,
        reason: req.body?.reason,
      });
      return res.status(result.statusCode).json(result.body);
    } catch (err) {
      console.error('[admin] moderation action error:', err);
      return res.status(500).json({ success: false, message: 'Failed moderation action.' });
    }
  }
);

router.get('/ops/newsletter-stats', adminRateLimiter, authMiddleware('admin'), (_req, res) => {
  try {
    res.json({ success: true, data: getNewsletterSummary() });
  } catch (err) {
    console.error('[admin] newsletter-stats error:', err);
    res.status(500).json({ success: false, message: 'Failed to load newsletter stats.' });
  }
});

router.get('/ops/billing-stats', adminRateLimiter, authMiddleware('admin'), async (_req, res) => {
  try {
    const data = await getBillingSummary();
    res.json({ success: true, data });
  } catch (err) {
    console.error('[admin] billing-stats error:', err);
    res.status(500).json({ success: false, message: 'Failed to load billing stats.' });
  }
});

router.get('/ops/seo-summary', adminRateLimiter, authMiddleware('admin'), (_req, res) => {
  try {
    res.json({ success: true, data: getSeoSummary() });
  } catch (err) {
    console.error('[admin] seo-summary error:', err);
    res.status(500).json({ success: false, message: 'Failed to load SEO summary.' });
  }
});

router.get('/ops/x-automation', adminRateLimiter, authMiddleware('admin'), (_req, res) => {
  try {
    res.json({ success: true, data: getXAutomationSummary() });
  } catch (err) {
    console.error('[admin] x-automation error:', err);
    res.status(500).json({ success: false, message: 'Failed to load X automation summary.' });
  }
});

router.get(
  '/ops/audit-log-summary',
  adminRateLimiter,
  authMiddleware('admin'),
  async (req, res) => {
    try {
      const limit = parseIntParam(req.query.limit, 20, 1, 200);
      const data = await getAuditLogSummary(limit);
      res.json({ success: true, data });
    } catch (err) {
      console.error('[admin] audit-log-summary error:', err);
      res.status(500).json({ success: false, message: 'Failed to load audit summary.' });
    }
  }
);

router.get('/ops/control-center', adminRateLimiter, authMiddleware('admin'), async (_req, res) => {
  try {
    const data = await getControlCenterSummary();
    res.json({ success: true, data });
  } catch (err) {
    console.error('[admin] control-center error:', err);
    res.status(500).json({ success: false, message: 'Failed to load operations dashboard.' });
  }
});

// ---------------------------------------------------------------------------
// PIN verification endpoint (server-side check).
// The ADMIN_ACCESS_PIN env var controls the quick-access PIN.
// If not set, PIN access is disabled and the endpoint tells the client.
// Rate-limited to prevent brute-force attacks on the 6-digit PIN.
// ---------------------------------------------------------------------------
const PIN_MAX_ATTEMPTS = 5;
const PIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const PIN_MAX_ENTRIES = 10_000;
const pinAttempts = new Map(); // ip -> { count, firstAttemptAt }

// Periodic sweep mirrors loginAttempts — see Track A #2 in the plan file.
const pinSweepTimer = setInterval(() => {
  sweepExpiredAttempts(pinAttempts, PIN_WINDOW_MS);
}, LOGIN_SWEEP_MS);
if (typeof pinSweepTimer.unref === 'function') pinSweepTimer.unref();

router.post('/auth/verify-pin', (req, res) => {
  const pin = process.env.ADMIN_ACCESS_PIN;

  // If PIN not configured, tell client to skip to OAuth login
  if (!pin) {
    return res.json({ success: false, redirect: true, message: 'PIN access is disabled.' });
  }

  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  const now = Date.now();
  const record = pinAttempts.get(ip);

  // Check rate limit
  if (record) {
    if (now - record.firstAttemptAt > PIN_WINDOW_MS) {
      pinAttempts.delete(ip);
    } else if (record.count >= PIN_MAX_ATTEMPTS) {
      const retryAfterSec = Math.ceil((PIN_WINDOW_MS - (now - record.firstAttemptAt)) / 1000);
      res.set('Retry-After', String(retryAfterSec));
      return res.status(429).json({
        success: false,
        message: 'Too many PIN attempts. Please use GitHub login.',
      });
    }
  }

  const { pin: submittedPin } = req.body;
  if (!submittedPin || typeof submittedPin !== 'string' || !/^\d{6}$/.test(submittedPin)) {
    return res.status(400).json({ success: false, message: 'Invalid PIN format.' });
  }

  // Constant-time comparison using Node.js crypto to prevent timing attacks
  const expectedBuf = Buffer.from(String(pin).padEnd(6, '0').slice(0, 6), 'utf8');
  const submittedBuf = Buffer.from(submittedPin.padEnd(6, '0').slice(0, 6), 'utf8');
  const match = crypto.timingSafeEqual(expectedBuf, submittedBuf);

  if (match) {
    pinAttempts.delete(ip);
    return res.json({ success: true });
  }

  // Record failed attempt
  const rec = pinAttempts.get(ip);
  if (!rec || now - rec.firstAttemptAt > PIN_WINDOW_MS) {
    pinAttempts.set(ip, { count: 1, firstAttemptAt: now });
  } else {
    rec.count += 1;
  }
  evictIfOverCap(pinAttempts, PIN_MAX_ENTRIES);

  const remaining = PIN_MAX_ATTEMPTS - (pinAttempts.get(ip)?.count || 0);
  return res.status(401).json({
    success: false,
    message: 'Incorrect PIN.',
    remaining: Math.max(0, remaining),
  });
});

// ===== SHOP ROUTES =====

// Get all shops with filters
router.get('/shops', authMiddleware(), (req, res) => {
  try {
    const options = {
      search: sanitizeString(req.query.search, 200),
      status: sanitizeString(req.query.status, 50),
      type: sanitizeString(req.query.type, 50),
      city: sanitizeString(req.query.city, 100),
      country: sanitizeString(req.query.country, 100),
      minConfidence: parseIntParam(req.query.minConfidence, null, 0, 100),
      sortBy: sanitizeString(req.query.sortBy, 50),
      sortDesc: req.query.sortDesc === 'true',
      page: parseIntParam(req.query.page, 1, 1, 10000),
      limit: parseIntParam(req.query.limit, 50, 1, 200),
    };

    const result = shopManager.getFilteredShops(options);
    res.json(result);
  } catch (err) {
    console.error('Error fetching shops:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch shops',
    });
  }
});

// Get single shop
router.get('/shops/:id', authMiddleware(), (req, res) => {
  try {
    const shop = shopManager.getShopById(req.params.id);

    if (!shop) {
      return res.status(404).json({
        success: false,
        message: 'Shop not found',
      });
    }

    res.json({ success: true, shop });
  } catch (err) {
    console.error('Error fetching shop:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch shop',
    });
  }
});

// Create shop
router.post('/shops', authMiddleware('editor'), (req, res) => {
  try {
    const shopData = validateShopInput(req.body);
    const result = shopManager.createShop(shopData, req.user.email);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.status(201).json(result);
  } catch (err) {
    if (err instanceof ValidationError) {
      return res.status(err.statusCode).json(err.toJSON());
    }
    console.error('Error creating shop:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to create shop',
    });
  }
});

// Update shop
router.put('/shops/:id', authMiddleware('editor'), (req, res) => {
  try {
    const shopData = validateShopInput(req.body);
    const result = shopManager.updateShop(req.params.id, shopData, req.user.email);

    if (!result.success) {
      return res.status(404).json(result);
    }

    res.json(result);
  } catch (err) {
    if (err instanceof ValidationError) {
      return res.status(err.statusCode).json(err.toJSON());
    }
    console.error('Error updating shop:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to update shop',
    });
  }
});

// Delete shop
router.delete('/shops/:id', authMiddleware('admin'), (req, res) => {
  try {
    const result = shopManager.deleteShop(req.params.id, req.user.email);

    if (!result.success) {
      return res.status(404).json(result);
    }

    res.json(result);
  } catch (err) {
    console.error('Error deleting shop:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to delete shop',
    });
  }
});

// Batch import shops
router.post('/shops/batch-import', authMiddleware('admin'), (req, res) => {
  try {
    const { shops } = req.body;

    if (!Array.isArray(shops)) {
      return res.status(400).json({
        success: false,
        message: 'Shops must be an array',
      });
    }

    if (shops.length > 500) {
      return res.status(400).json({
        success: false,
        message: 'Batch import limited to 500 shops per request',
      });
    }

    const sanitisedShops = shops.map((s) => validateShopInput(s));
    const result = shopManager.batchImportShops(sanitisedShops, req.user.email);
    res.json(result);
  } catch (err) {
    console.error('Error importing shops:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to import shops',
    });
  }
});

// ===== AUDIT LOG ROUTES =====

// Get audit logs
router.get('/audit-logs', authMiddleware(), (req, res) => {
  try {
    const options = {
      action: sanitizeString(req.query.action, 50),
      entityType: sanitizeString(req.query.entityType, 50),
      actor: sanitizeString(req.query.actor, 200),
      startDate: sanitizeString(req.query.startDate, 30),
      endDate: sanitizeString(req.query.endDate, 30),
      page: parseIntParam(req.query.page, 1, 1, 10000),
      limit: parseIntParam(req.query.limit, 50, 1, 200),
    };

    const result = auditLog.getFilteredLogs(options);
    res.json(result);
  } catch (err) {
    console.error('Error fetching audit logs:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch audit logs',
    });
  }
});

// Export audit logs as CSV
router.get('/audit-logs/export', authMiddleware('admin'), (req, res) => {
  try {
    const csv = auditLog.exportToCSV();

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="audit-logs.csv"');
    res.send(csv);
  } catch (err) {
    console.error('Error exporting audit logs:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to export audit logs',
    });
  }
});

// ===== USER MANAGEMENT ROUTES =====
// All routes require admin role and are rate-limited.

// List all users (no passwords)
router.get('/users', adminRateLimiter, authMiddleware('admin'), (req, res) => {
  try {
    const users = auth.getAllUsers();
    res.json({ success: true, users });
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch users' });
  }
});

// Create a new user
router.post('/users', adminRateLimiter, authMiddleware('admin'), async (req, res) => {
  try {
    const email = sanitizeString(req.body.email, 254);
    const name = sanitizeString(req.body.name, 200);
    const role = sanitizeString(req.body.role, 20);
    const { password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const allowedRoles = ['viewer', 'editor', 'admin'];
    if (role && !allowedRoles.includes(role)) {
      return res
        .status(400)
        .json({ success: false, message: `Role must be one of: ${allowedRoles.join(', ')}` });
    }

    const result = await auth.createUser({ email, password, name, role }, req.user.email);

    if (!result.success) {
      return res.status(400).json(result);
    }

    auditLog.logAction(req.user.email, 'create', 'user', result.user.id, {
      email: result.user.email,
      role: result.user.role,
    });
    res.status(201).json(result);
  } catch (err) {
    console.error('Error creating user:', err);
    res.status(500).json({ success: false, message: 'Failed to create user' });
  }
});

// Update a user (name, role, or password)
router.put('/users/:id', adminRateLimiter, authMiddleware('admin'), async (req, res) => {
  try {
    const { name, role, password } = req.body;
    const updates = {};
    if (name !== undefined) updates.name = sanitizeString(name, 200);
    if (role !== undefined) {
      const allowedRoles = ['viewer', 'editor', 'admin'];
      const cleanRole = sanitizeString(role, 20);
      if (!allowedRoles.includes(cleanRole)) {
        return res
          .status(400)
          .json({ success: false, message: `Role must be one of: ${allowedRoles.join(', ')}` });
      }
      updates.role = cleanRole;
    }
    // Require password to be a non-empty string of at least 8 chars if provided
    if (password !== undefined) {
      if (typeof password !== 'string' || password.length < 8) {
        return res
          .status(400)
          .json({ success: false, message: 'Password must be at least 8 characters' });
      }
      updates.password = password;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: 'No valid fields to update' });
    }

    const result = await auth.updateUser(req.params.id, updates, req.user.email);

    if (!result.success) {
      return res.status(404).json(result);
    }

    const auditUpdates = { ...updates };
    if (auditUpdates.password) auditUpdates.password = '[redacted]';
    auditLog.logAction(req.user.email, 'update', 'user', req.params.id, auditUpdates);
    res.json(result);
  } catch (err) {
    console.error('Error updating user:', err);
    res.status(500).json({ success: false, message: 'Failed to update user' });
  }
});

// Delete a user
router.delete('/users/:id', adminRateLimiter, authMiddleware('admin'), (req, res) => {
  try {
    const result = auth.deleteUser(req.params.id, req.user.email);

    if (!result.success) {
      return res.status(400).json(result);
    }

    auditLog.logAction(req.user.email, 'delete', 'user', req.params.id, {});
    res.json(result);
  } catch (err) {
    console.error('Error deleting user:', err);
    res.status(500).json({ success: false, message: 'Failed to delete user' });
  }
});

// ===== DASHBOARD STATS =====

// GET /counts — lightweight summary counts for the admin dashboard
router.get('/counts', adminRateLimiter, authMiddleware(), (req, res) => {
  const pendingOrders = 0;
  let totalShops = 0;
  let pendingSubmissions = 0;
  try {
    const result = shopManager.getFilteredShops({ page: 1, limit: 1 });
    totalShops = typeof result.total === 'number' ? result.total : 0;
  } catch {
    // Non-critical — return default 0
  }
  try {
    pendingSubmissions = pendingShopsRepo.getCounts().pending;
  } catch {
    // Non-critical — return default 0
  }
  res.json({ pendingOrders, totalShops, pendingSubmissions });
});

// GET /stats — aggregate metrics for the admin dashboard
router.get('/stats', adminRateLimiter, authMiddleware(), async (req, res) => {
  try {
    const shopStats = await shopsRepo.getStats();
    const recentLogs = await auditRepo.query({ page: 1, limit: 10 });
    const users = auth.getAllUsers();

    res.json({
      success: true,
      stats: {
        shops: shopStats,
        users: {
          total: users.length,
          admins: users.filter((u) => u.role === 'admin').length,
        },
        auditLog: {
          recentEntries: recentLogs.logs,
          total: recentLogs.total,
        },
        storageBackend: 'configured',
      },
    });
  } catch (err) {
    console.error('Error fetching stats:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch stats' });
  }
});

// ===== PENDING SHOP SUBMISSIONS =====

// GET /api/admin/pending-shops — list submissions (optionally filtered by status)
router.get('/pending-shops', adminRateLimiter, authMiddleware('editor'), (req, res) => {
  try {
    const statusFilter = sanitizeString(req.query.status, 20);
    let submissions = pendingShopsRepo.getAll();

    if (statusFilter) {
      submissions = submissions.filter((s) => s.status === statusFilter);
    } else {
      // Default: return pending only
      submissions = submissions.filter((s) => s.status === 'pending');
    }

    // Sort newest first
    submissions.sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at));

    const counts = pendingShopsRepo.getCounts();
    res.json({ success: true, submissions, counts });
  } catch (err) {
    console.error('[admin] Error fetching pending shops:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch pending submissions' });
  }
});

// GET /api/admin/pending-shops/:id — get a single submission
router.get('/pending-shops/:id', adminRateLimiter, authMiddleware('editor'), (req, res) => {
  try {
    const sub = pendingShopsRepo.getById(req.params.id);
    if (!sub) {
      return res.status(404).json({ success: false, message: 'Submission not found' });
    }
    res.json({ success: true, submission: sub });
  } catch (err) {
    console.error('[admin] Error fetching submission:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch submission' });
  }
});

// POST /api/admin/pending-shops/:id/approve
// Moves the submission into the main shop directory and marks it approved.
router.post(
  '/pending-shops/:id/approve',
  adminRateLimiter,
  authMiddleware('editor'),
  (req, res) => {
    try {
      const result = moderatePendingSubmission({
        submissionId: req.params.id,
        action: 'approve',
        actorEmail: req.user.email,
      });
      return res.status(result.statusCode).json(result.body);
    } catch (err) {
      console.error('[admin] Error approving submission:', err);
      res.status(500).json({ success: false, message: 'Failed to approve submission' });
    }
  }
);

// POST /api/admin/pending-shops/:id/reject
// Marks the submission rejected and records the reason in the audit log.
router.post('/pending-shops/:id/reject', adminRateLimiter, authMiddleware('editor'), (req, res) => {
  try {
    const result = moderatePendingSubmission({
      submissionId: req.params.id,
      action: 'reject',
      actorEmail: req.user.email,
      reason: req.body?.reason,
    });
    return res.status(result.statusCode).json(result.body);
  } catch (err) {
    console.error('[admin] Error rejecting submission:', err);
    res.status(500).json({ success: false, message: 'Failed to reject submission' });
  }
});

module.exports = router;
