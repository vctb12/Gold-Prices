'use strict';

/**
 * server/lib/billing-repository.js
 *
 * Persistence layer for billing data.
 *
 * Uses Supabase when available (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY set),
 * otherwise falls back to a local JSON file (data/billing.json).
 *
 * Tables managed:
 *   stripe_customers   — userId → stripeCustomerId mapping
 *   subscriptions      — active subscription records
 *   stripe_events      — idempotent webhook event store
 *   api_keys           — API key management
 *   api_usage          — per-key call counters (today window)
 *   billing_audit_logs — append-only billing event log
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { atomicWriteJSON } = require('./fs-atomic');
const { getSupabaseClient } = require('./supabase-client');

const BILLING_FILE =
  process.env.BILLING_DATA_FILE || path.join(__dirname, '../../data/billing.json');
const MAX_AUDIT_ROWS = 5000;
const MAX_EVENTS_ROWS = 10000;

// ---------------------------------------------------------------------------
// File-backed store helpers
// ---------------------------------------------------------------------------

function emptyStore() {
  return {
    stripe_customers: [],
    subscriptions: [],
    stripe_events: [],
    api_keys: [],
    api_usage: [],
    billing_audit_logs: [],
  };
}

function readStore() {
  try {
    const raw = fs.readFileSync(BILLING_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return emptyStore();
    const base = emptyStore();
    for (const key of Object.keys(base)) {
      base[key] = Array.isArray(parsed[key]) ? parsed[key] : [];
    }
    return base;
  } catch {
    return emptyStore();
  }
}

function writeStore(store) {
  const dir = path.dirname(BILLING_FILE);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  atomicWriteJSON(BILLING_FILE, store, { mode: 0o600 });
}

function generateId() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return crypto.randomBytes(16).toString('hex');
}

function nowIso() {
  return new Date().toISOString();
}

// ---------------------------------------------------------------------------
// stripe_customers
// ---------------------------------------------------------------------------

/**
 * Find a Stripe customer record by userId.
 * @param {string} userId
 * @returns {{ id, userId, stripeCustomerId, email, createdAt } | null}
 */
async function findCustomerByUserId(userId) {
  if (!userId) return null;
  const sb = getSupabaseClient();
  if (sb) {
    try {
      const { data, error } = await sb
        .from('stripe_customers')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        id: data.id,
        userId: data.user_id,
        stripeCustomerId: data.stripe_customer_id,
        email: data.email,
        createdAt: data.created_at,
      };
    } catch (err) {
      console.error('[billing-repo] findCustomerByUserId Supabase error:', err.message);
    }
  }
  // File fallback
  const store = readStore();
  const row = store.stripe_customers.find((r) => r.userId === userId);
  return row || null;
}

/**
 * Find a Stripe customer record by stripeCustomerId.
 */
async function findCustomerByStripeId(stripeCustomerId) {
  if (!stripeCustomerId) return null;
  const sb = getSupabaseClient();
  if (sb) {
    try {
      const { data, error } = await sb
        .from('stripe_customers')
        .select('*')
        .eq('stripe_customer_id', stripeCustomerId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        id: data.id,
        userId: data.user_id,
        stripeCustomerId: data.stripe_customer_id,
        email: data.email,
        createdAt: data.created_at,
      };
    } catch (err) {
      console.error('[billing-repo] findCustomerByStripeId Supabase error:', err.message);
    }
  }
  const store = readStore();
  const row = store.stripe_customers.find((r) => r.stripeCustomerId === stripeCustomerId);
  return row || null;
}

/**
 * Upsert a Stripe customer record.
 * @param {{ userId, stripeCustomerId, email }} params
 */
async function upsertCustomer({ userId, stripeCustomerId, email }) {
  const sb = getSupabaseClient();
  if (sb) {
    try {
      const { error } = await sb.from('stripe_customers').upsert(
        {
          user_id: userId,
          stripe_customer_id: stripeCustomerId,
          email: email || null,
          updated_at: nowIso(),
        },
        { onConflict: 'user_id' }
      );
      if (error) throw error;
      return;
    } catch (err) {
      console.error('[billing-repo] upsertCustomer Supabase error:', err.message);
    }
  }
  const store = readStore();
  const idx = store.stripe_customers.findIndex((r) => r.userId === userId);
  const row = {
    id: generateId(),
    userId,
    stripeCustomerId,
    email: email || null,
    createdAt: nowIso(),
  };
  if (idx >= 0) {
    store.stripe_customers[idx] = {
      ...store.stripe_customers[idx],
      stripeCustomerId,
      email: email || null,
    };
  } else {
    store.stripe_customers.push(row);
  }
  writeStore(store);
}

// ---------------------------------------------------------------------------
// subscriptions
// ---------------------------------------------------------------------------

/**
 * Get the active subscription for a user.
 * Returns null when no paid subscription exists.
 */
async function getActiveSubscription(userId) {
  if (!userId) return null;
  const sb = getSupabaseClient();
  if (sb) {
    try {
      const { data, error } = await sb
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .in('status', ['active', 'trialing'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return _mapSubRow(data);
    } catch (err) {
      console.error('[billing-repo] getActiveSubscription Supabase error:', err.message);
    }
  }
  const store = readStore();
  const row = store.subscriptions
    .filter((r) => r.userId === userId && ['active', 'trialing'].includes(r.status))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
  return row || null;
}

/**
 * Find a subscription by Stripe subscription ID.
 */
async function findSubscriptionByStripeId(stripeSubscriptionId) {
  if (!stripeSubscriptionId) return null;
  const sb = getSupabaseClient();
  if (sb) {
    try {
      const { data, error } = await sb
        .from('subscriptions')
        .select('*')
        .eq('stripe_subscription_id', stripeSubscriptionId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return _mapSubRow(data);
    } catch (err) {
      console.error('[billing-repo] findSubscriptionByStripeId Supabase error:', err.message);
    }
  }
  const store = readStore();
  const row = store.subscriptions.find((r) => r.stripeSubscriptionId === stripeSubscriptionId);
  return row || null;
}

/**
 * Create a subscription record.
 */
async function createSubscription({
  userId,
  tier,
  stripeCustomerId,
  stripeSubscriptionId,
  status,
  currentPeriodEnd,
  cancelAtPeriodEnd = false,
  interval = 'month',
}) {
  const sb = getSupabaseClient();
  const periodEnd = currentPeriodEnd ? new Date(currentPeriodEnd).toISOString() : null;
  if (sb) {
    try {
      const { data, error } = await sb
        .from('subscriptions')
        .insert({
          user_id: userId,
          tier,
          stripe_customer_id: stripeCustomerId,
          stripe_subscription_id: stripeSubscriptionId,
          status,
          current_period_end: periodEnd,
          cancel_at_period_end: cancelAtPeriodEnd,
          interval,
        })
        .select()
        .single();
      if (error) throw error;
      return _mapSubRow(data);
    } catch (err) {
      console.error('[billing-repo] createSubscription Supabase error:', err.message);
    }
  }
  const store = readStore();
  const row = {
    id: generateId(),
    userId,
    tier,
    stripeCustomerId,
    stripeSubscriptionId,
    status,
    currentPeriodEnd: periodEnd,
    cancelAtPeriodEnd,
    interval,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  store.subscriptions.push(row);
  writeStore(store);
  return row;
}

/**
 * Update a subscription by Stripe subscription ID.
 */
async function updateSubscription(stripeSubscriptionId, updates) {
  const sb = getSupabaseClient();
  const dbUpdates = {};
  if (updates.status !== undefined) dbUpdates.status = updates.status;
  if (updates.currentPeriodEnd !== undefined)
    dbUpdates.current_period_end = updates.currentPeriodEnd
      ? new Date(updates.currentPeriodEnd).toISOString()
      : null;
  if (updates.cancelAtPeriodEnd !== undefined)
    dbUpdates.cancel_at_period_end = updates.cancelAtPeriodEnd;
  if (updates.canceledAt !== undefined)
    dbUpdates.canceled_at = updates.canceledAt ? new Date(updates.canceledAt).toISOString() : null;
  dbUpdates.updated_at = nowIso();

  if (sb) {
    try {
      const { error } = await sb
        .from('subscriptions')
        .update(dbUpdates)
        .eq('stripe_subscription_id', stripeSubscriptionId);
      if (error) throw error;
      return;
    } catch (err) {
      console.error('[billing-repo] updateSubscription Supabase error:', err.message);
    }
  }
  const store = readStore();
  const idx = store.subscriptions.findIndex((r) => r.stripeSubscriptionId === stripeSubscriptionId);
  if (idx >= 0) {
    store.subscriptions[idx] = {
      ...store.subscriptions[idx],
      ...Object.fromEntries(Object.entries(dbUpdates).map(([k, v]) => [_toCamel(k), v])),
    };
    writeStore(store);
  }
}

function _toCamel(snakeKey) {
  return snakeKey.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

function _mapSubRow(data) {
  return {
    id: data.id,
    userId: data.user_id,
    tier: data.tier,
    stripeCustomerId: data.stripe_customer_id,
    stripeSubscriptionId: data.stripe_subscription_id,
    status: data.status,
    currentPeriodEnd: data.current_period_end,
    cancelAtPeriodEnd: data.cancel_at_period_end,
    canceledAt: data.canceled_at,
    interval: data.interval,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

// ---------------------------------------------------------------------------
// stripe_events (idempotency)
// ---------------------------------------------------------------------------

/**
 * Check whether a Stripe event has already been processed.
 * @returns {boolean}
 */
async function isEventProcessed(stripeEventId) {
  if (!stripeEventId) return false;
  const sb = getSupabaseClient();
  if (sb) {
    try {
      const { data, error } = await sb
        .from('stripe_events')
        .select('id')
        .eq('stripe_event_id', stripeEventId)
        .maybeSingle();
      if (error) throw error;
      return !!data;
    } catch (err) {
      console.error('[billing-repo] isEventProcessed Supabase error:', err.message);
    }
  }
  const store = readStore();
  return store.stripe_events.some((r) => r.stripeEventId === stripeEventId);
}

/**
 * Record a processed Stripe event to prevent re-processing.
 */
async function recordEvent({ stripeEventId, type, livemode, handledAt }) {
  const sb = getSupabaseClient();
  if (sb) {
    try {
      const { error } = await sb.from('stripe_events').insert({
        stripe_event_id: stripeEventId,
        type,
        livemode: Boolean(livemode),
        handled_at: handledAt || nowIso(),
      });
      if (error) throw error;
      return;
    } catch (err) {
      console.error('[billing-repo] recordEvent Supabase error:', err.message);
    }
  }
  const store = readStore();
  store.stripe_events.push({
    id: generateId(),
    stripeEventId,
    type,
    livemode: Boolean(livemode),
    handledAt: handledAt || nowIso(),
    createdAt: nowIso(),
  });
  // Trim to cap
  if (store.stripe_events.length > MAX_EVENTS_ROWS) {
    store.stripe_events = store.stripe_events.slice(-MAX_EVENTS_ROWS);
  }
  writeStore(store);
}

// ---------------------------------------------------------------------------
// api_keys
// ---------------------------------------------------------------------------

/**
 * Create an API key for a user.
 * @param {{ userId, label }} params
 * @returns {{ id, userId, keyHash, keyPrefix, label, createdAt }}
 */
async function createApiKey({ userId, label }) {
  const rawKey = 'gtl_' + crypto.randomBytes(24).toString('hex');
  // SHA-256 used as lookup index for a high-entropy (192-bit) random API key.
  // This is intentional — SHA-256 is appropriate here; bcrypt is only required
  // for low-entropy, user-chosen secrets such as passwords.
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex'); // lgtm[js/insufficient-password-hash] codeql[js/insufficient-password-hash]
  const keyPrefix = rawKey.slice(0, 12);

  const sb = getSupabaseClient();
  if (sb) {
    try {
      const { data, error } = await sb
        .from('api_keys')
        .insert({
          user_id: userId,
          key_hash: keyHash,
          key_prefix: keyPrefix,
          label: label || 'default',
        })
        .select('id, user_id, key_prefix, label, created_at')
        .single();
      if (error) throw error;
      return {
        id: data.id,
        userId: data.user_id,
        keyPrefix: data.key_prefix,
        label: data.label,
        createdAt: data.created_at,
        // Return raw key once — caller must show it to the user immediately
        key: rawKey,
      };
    } catch (err) {
      console.error('[billing-repo] createApiKey Supabase error:', err.message);
    }
  }
  const store = readStore();
  const row = {
    id: generateId(),
    userId,
    keyHash,
    keyPrefix,
    label: label || 'default',
    revoked: false,
    createdAt: nowIso(),
  };
  store.api_keys.push(row);
  writeStore(store);
  return { id: row.id, userId, keyPrefix, label: row.label, createdAt: row.createdAt, key: rawKey };
}

/**
 * Look up a user by raw API key (hash check).
 * SHA-256 is used here as a non-secret lookup index, NOT as a password hash.
 * API keys are 24 random bytes (192 bits of entropy) — they are not user-chosen
 * passwords, so SHA-256 is appropriate; bcrypt-style adaptive hashing is only
 * required for low-entropy, user-supplied secrets.
 */
async function resolveApiKey(rawKey) {
  if (!rawKey) return null;
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex'); // lgtm[js/insufficient-password-hash] codeql[js/insufficient-password-hash]
  const sb = getSupabaseClient();
  if (sb) {
    try {
      const { data, error } = await sb
        .from('api_keys')
        .select('id, user_id, revoked, label, created_at')
        .eq('key_hash', keyHash)
        .eq('revoked', false)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return { id: data.id, userId: data.user_id, label: data.label, createdAt: data.created_at };
    } catch (err) {
      console.error('[billing-repo] resolveApiKey Supabase error:', err.message);
    }
  }
  const store = readStore();
  const row = store.api_keys.find((r) => r.keyHash === keyHash && !r.revoked);
  if (!row) return null;
  return { id: row.id, userId: row.userId, label: row.label, createdAt: row.createdAt };
}

/**
 * List API keys for a user (redacted — no hashes).
 */
async function listApiKeys(userId) {
  const sb = getSupabaseClient();
  if (sb) {
    try {
      const { data, error } = await sb
        .from('api_keys')
        .select('id, key_prefix, label, revoked, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map((r) => ({
        id: r.id,
        keyPrefix: r.key_prefix,
        label: r.label,
        revoked: r.revoked,
        createdAt: r.created_at,
      }));
    } catch (err) {
      console.error('[billing-repo] listApiKeys Supabase error:', err.message);
    }
  }
  const store = readStore();
  return store.api_keys
    .filter((r) => r.userId === userId)
    .map(({ id, keyPrefix, label, revoked, createdAt }) => ({
      id,
      keyPrefix,
      label,
      revoked: Boolean(revoked),
      createdAt,
    }));
}

/**
 * Revoke an API key by id.
 */
async function revokeApiKey(keyId, userId) {
  const sb = getSupabaseClient();
  if (sb) {
    try {
      const { error } = await sb
        .from('api_keys')
        .update({ revoked: true, updated_at: nowIso() })
        .eq('id', keyId)
        .eq('user_id', userId);
      if (error) throw error;
      return true;
    } catch (err) {
      console.error('[billing-repo] revokeApiKey Supabase error:', err.message);
    }
  }
  const store = readStore();
  const idx = store.api_keys.findIndex((r) => r.id === keyId && r.userId === userId);
  if (idx < 0) return false;
  store.api_keys[idx].revoked = true;
  writeStore(store);
  return true;
}

// ---------------------------------------------------------------------------
// api_usage
// ---------------------------------------------------------------------------

/**
 * Increment the API usage counter for a key in the current UTC day window.
 * Returns the new count.
 */
async function incrementApiUsage(keyId) {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const sb = getSupabaseClient();
  if (sb) {
    try {
      const { data, error } = await sb.rpc('increment_api_usage', {
        p_key_id: keyId,
        p_date: today,
      });
      if (error) throw error;
      return data ?? 1;
    } catch (err) {
      console.error('[billing-repo] incrementApiUsage Supabase error:', err.message);
    }
  }
  const store = readStore();
  const idx = store.api_usage.findIndex((r) => r.keyId === keyId && r.date === today);
  if (idx >= 0) {
    store.api_usage[idx].count += 1;
    writeStore(store);
    return store.api_usage[idx].count;
  }
  store.api_usage.push({ id: generateId(), keyId, date: today, count: 1 });
  // Trim old entries (keep 90 days)
  const cutoff = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  store.api_usage = store.api_usage.filter((r) => r.date >= cutoff);
  writeStore(store);
  return 1;
}

/**
 * Get today's API usage count for a key.
 */
async function getApiUsageToday(keyId) {
  const today = new Date().toISOString().slice(0, 10);
  const sb = getSupabaseClient();
  if (sb) {
    try {
      const { data, error } = await sb
        .from('api_usage')
        .select('call_count')
        .eq('api_key_id', keyId)
        .eq('date', today)
        .maybeSingle();
      if (error) throw error;
      return data?.call_count ?? 0;
    } catch (err) {
      console.error('[billing-repo] getApiUsageToday Supabase error:', err.message);
    }
  }
  const store = readStore();
  const row = store.api_usage.find((r) => r.keyId === keyId && r.date === today);
  return row?.count ?? 0;
}

/**
 * List API usage rows for a user's keys over a date range.
 * Returns one row per (keyId, date) with call counts.
 * @param {string} userId
 * @param {{ days?: number }} [opts]
 * @returns {Promise<Array<{ keyId, date, count }>>}
 */
async function listApiUsageForUser(userId, opts = {}) {
  const days = typeof opts.days === 'number' && opts.days > 0 ? Math.min(opts.days, 90) : 30;
  const cutoff = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString().slice(0, 10);

  const sb = getSupabaseClient();
  if (sb) {
    try {
      // First get key IDs belonging to this user
      const { data: keyRows, error: keyErr } = await sb
        .from('api_keys')
        .select('id')
        .eq('user_id', userId);
      if (keyErr) throw keyErr;
      if (!keyRows || keyRows.length === 0) return [];
      const keyIds = keyRows.map((r) => r.id);
      const { data, error } = await sb
        .from('api_usage')
        .select('api_key_id, date, call_count')
        .in('api_key_id', keyIds)
        .gte('date', cutoff)
        .order('date', { ascending: false });
      if (error) throw error;
      return (data || []).map((r) => ({
        keyId: r.api_key_id,
        date: r.date,
        count: r.call_count,
      }));
    } catch (err) {
      console.error('[billing-repo] listApiUsageForUser Supabase error:', err.message);
    }
  }

  const store = readStore();
  const userKeyIds = new Set(store.api_keys.filter((k) => k.userId === userId).map((k) => k.id));
  return store.api_usage
    .filter((r) => userKeyIds.has(r.keyId) && r.date >= cutoff)
    .map(({ keyId, date, count }) => ({ keyId, date, count }))
    .sort((a, b) => (b.date > a.date ? 1 : -1));
}

// ---------------------------------------------------------------------------
// billing_audit_logs
// ---------------------------------------------------------------------------

/**
 * Append a billing audit log entry.
 * @param {{ userId, action, tier, metadata }} params
 */
async function appendAuditLog({ userId, action, tier, metadata }) {
  const sb = getSupabaseClient();
  if (sb) {
    try {
      const { error } = await sb.from('billing_audit_logs').insert({
        user_id: userId || null,
        action,
        tier: tier || null,
        metadata: metadata || null,
      });
      if (error) throw error;
      return;
    } catch (err) {
      console.error('[billing-repo] appendAuditLog Supabase error:', err.message);
    }
  }
  const store = readStore();
  store.billing_audit_logs.push({
    id: generateId(),
    userId: userId || null,
    action,
    tier: tier || null,
    metadata: metadata || null,
    createdAt: nowIso(),
  });
  if (store.billing_audit_logs.length > MAX_AUDIT_ROWS) {
    store.billing_audit_logs = store.billing_audit_logs.slice(-MAX_AUDIT_ROWS);
  }
  writeStore(store);
}

module.exports = {
  findCustomerByUserId,
  findCustomerByStripeId,
  upsertCustomer,
  getActiveSubscription,
  findSubscriptionByStripeId,
  createSubscription,
  updateSubscription,
  isEventProcessed,
  recordEvent,
  createApiKey,
  resolveApiKey,
  listApiKeys,
  revokeApiKey,
  incrementApiUsage,
  getApiUsageToday,
  listApiUsageForUser,
  appendAuditLog,
};
