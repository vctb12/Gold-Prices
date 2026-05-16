'use strict';

const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { atomicWriteJSON } = require('../lib/fs-atomic');
const { getSupabaseClient } = require('../lib/supabase-client');
const { successResponse, errorResponse } = require('../lib/api-response');
const billingRepo = require('../lib/billing-repository');
const { resolveUserEntitlements } = require('../lib/entitlements');

const ROOT = path.resolve(__dirname, '../..');
const DEFAULT_STORE_PATH = path.join(ROOT, 'data', 'public-accounts.json');
const MAX_SAVED_ROWS = 200;

function nowIso() {
  return new Date().toISOString();
}

function generateId() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return crypto.randomBytes(16).toString('hex');
}

function toSafeString(value, maxLength = 200) {
  if (typeof value !== 'string') return null;
  const clean = value.trim().slice(0, maxLength);
  return clean.length ? clean : null;
}

function toUpperCode(value, maxLength = 8) {
  const clean = toSafeString(value, maxLength);
  return clean ? clean.toUpperCase() : null;
}

function toPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value;
}

function createEmptyStore() {
  return {
    profiles: [],
    user_preferences: [],
    saved_calculations: [],
    watchlists: [],
    saved_shops: [],
    user_sessions: [],
    alert_rules: [],
    notification_subscriptions: [],
    api_keys: [],
    subscriptions: [],
    entitlements: [],
  };
}

function readStore(storePath) {
  try {
    const raw = fs.readFileSync(storePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return createEmptyStore();
    return {
      profiles: Array.isArray(parsed.profiles) ? parsed.profiles : [],
      user_preferences: Array.isArray(parsed.user_preferences) ? parsed.user_preferences : [],
      saved_calculations: Array.isArray(parsed.saved_calculations) ? parsed.saved_calculations : [],
      watchlists: Array.isArray(parsed.watchlists) ? parsed.watchlists : [],
      saved_shops: Array.isArray(parsed.saved_shops) ? parsed.saved_shops : [],
      user_sessions: Array.isArray(parsed.user_sessions) ? parsed.user_sessions : [],
      alert_rules: Array.isArray(parsed.alert_rules) ? parsed.alert_rules : [],
      notification_subscriptions: Array.isArray(parsed.notification_subscriptions)
        ? parsed.notification_subscriptions
        : [],
      api_keys: Array.isArray(parsed.api_keys) ? parsed.api_keys : [],
      subscriptions: Array.isArray(parsed.subscriptions) ? parsed.subscriptions : [],
      entitlements: Array.isArray(parsed.entitlements) ? parsed.entitlements : [],
    };
  } catch {
    return createEmptyStore();
  }
}

function writeStore(storePath, store) {
  const dir = path.dirname(storePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  atomicWriteJSON(storePath, store, { mode: 0o600 });
}

function extractBearerToken(req) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return null;
  const token = auth.slice('Bearer '.length).trim();
  return token || null;
}

function resolveClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

function parseDevUser(req) {
  if (process.env.NODE_ENV === 'production') return null;
  if (process.env.PUBLIC_AUTH_TEST_MODE !== '1') return null;
  const id = toSafeString(req.headers['x-test-user-id'], 128);
  if (!id) return null;
  const email = toSafeString(req.headers['x-test-user-email'], 320) || `${id}@example.test`;
  return {
    id,
    email,
    user_metadata: {},
    app_metadata: {},
  };
}

async function resolveSupabaseUserFromHttp(token) {
  const url = process.env.SUPABASE_URL;
  const apiKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !apiKey || !token) return null;
  try {
    const res = await fetch(`${url.replace(/\/$/, '')}/auth/v1/user`, {
      method: 'GET',
      headers: {
        apikey: apiKey,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function resolveSupabaseUser(token) {
  if (!token) return null;
  const sb = getSupabaseClient(false);
  if (sb?.auth?.getUser) {
    try {
      const { data, error } = await sb.auth.getUser(token);
      if (!error && data?.user) return data.user;
    } catch {
      // Fall through to HTTP validation.
    }
  }
  return resolveSupabaseUserFromHttp(token);
}

function createDataLayer(storePath) {
  const runWithFallback = async (supabaseTask, fileTask) => {
    const sb = getSupabaseClient(false);
    if (sb) {
      try {
        return await supabaseTask(sb);
      } catch (error) {
        console.warn(
          '[public-accounts] Supabase operation failed, using file fallback:',
          error.message
        );
      }
    }
    return fileTask();
  };

  return {
    async getOrCreateProfile(user) {
      return runWithFallback(
        async (sb) => {
          const upsertPayload = {
            id: user.id,
            email: toSafeString(user.email, 320),
            display_name:
              toSafeString(user.user_metadata?.full_name, 120) ||
              toSafeString(user.user_metadata?.name, 120) ||
              toSafeString(user.email, 120),
            avatar_url: toSafeString(user.user_metadata?.avatar_url, 500),
            last_seen_at: nowIso(),
            updated_at: nowIso(),
          };
          const { data, error } = await sb
            .from('profiles')
            .upsert(upsertPayload, { onConflict: 'id' })
            .select('*')
            .limit(1);
          if (error) throw error;
          return Array.isArray(data) ? data[0] : null;
        },
        () => {
          const store = readStore(storePath);
          const existing = store.profiles.find((row) => row.id === user.id);
          const row = {
            id: user.id,
            email: toSafeString(user.email, 320),
            display_name:
              toSafeString(user.user_metadata?.full_name, 120) ||
              toSafeString(user.user_metadata?.name, 120) ||
              toSafeString(user.email, 120),
            avatar_url: toSafeString(user.user_metadata?.avatar_url, 500),
            created_at: existing?.created_at || nowIso(),
            updated_at: nowIso(),
            last_seen_at: nowIso(),
          };
          if (existing) {
            Object.assign(existing, row);
          } else {
            store.profiles.push(row);
          }
          writeStore(storePath, store);
          return row;
        }
      );
    },

    async touchSession(user, req) {
      const ipHash = crypto
        .createHash('sha256')
        .update(String(resolveClientIp(req)))
        .digest('hex');
      const row = {
        id: generateId(),
        user_id: user.id,
        ip_hash: ipHash,
        user_agent: toSafeString(req.get('user-agent') || '', 500),
        created_at: nowIso(),
      };
      return runWithFallback(
        async (sb) => {
          const cutoffIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
          const { data: existing, error: existingError } = await sb
            .from('user_sessions')
            .select('id')
            .eq('user_id', user.id)
            .eq('ip_hash', ipHash)
            .gte('created_at', cutoffIso)
            .order('created_at', { ascending: false })
            .limit(1);
          if (existingError) throw existingError;
          if (Array.isArray(existing) && existing.length > 0) return false;
          const { error } = await sb.from('user_sessions').insert(row);
          if (error) throw error;
          return true;
        },
        () => {
          const store = readStore(storePath);
          const cutoff = Date.now() - 24 * 60 * 60 * 1000;
          const hasRecent = store.user_sessions.some(
            (entry) =>
              entry.user_id === user.id &&
              entry.ip_hash === ipHash &&
              Number.isFinite(new Date(entry.created_at).getTime()) &&
              new Date(entry.created_at).getTime() >= cutoff
          );
          if (hasRecent) return false;
          store.user_sessions.push(row);
          store.user_sessions = store.user_sessions.slice(-1000);
          writeStore(storePath, store);
          return true;
        }
      );
    },

    async getPreferences(userId) {
      return runWithFallback(
        async (sb) => {
          const { data, error } = await sb
            .from('user_preferences')
            .select('*')
            .eq('user_id', userId)
            .limit(1);
          if (error) throw error;
          return Array.isArray(data) && data[0] ? data[0] : null;
        },
        () => {
          const store = readStore(storePath);
          return store.user_preferences.find((row) => row.user_id === userId) || null;
        }
      );
    },

    async updatePreferences(userId, updates) {
      return runWithFallback(
        async (sb) => {
          const payload = { user_id: userId, ...updates, updated_at: nowIso() };
          const { data, error } = await sb
            .from('user_preferences')
            .upsert(payload, { onConflict: 'user_id' })
            .select('*')
            .limit(1);
          if (error) throw error;
          return Array.isArray(data) ? data[0] : null;
        },
        () => {
          const store = readStore(storePath);
          const existing = store.user_preferences.find((row) => row.user_id === userId);
          const next = {
            user_id: userId,
            created_at: existing?.created_at || nowIso(),
            updated_at: nowIso(),
            ...existing,
            ...updates,
          };
          if (existing) Object.assign(existing, next);
          else store.user_preferences.push(next);
          writeStore(storePath, store);
          return next;
        }
      );
    },

    async listSavedCalculations(userId) {
      return runWithFallback(
        async (sb) => {
          const { data, error } = await sb
            .from('saved_calculations')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });
          if (error) throw error;
          return Array.isArray(data) ? data : [];
        },
        () => {
          const store = readStore(storePath);
          return store.saved_calculations
            .filter((row) => row.user_id === userId)
            .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
        }
      );
    },

    async addSavedCalculation(userId, payload) {
      const row = {
        id: generateId(),
        user_id: userId,
        tool: payload.tool,
        label: payload.label,
        input_data: payload.input_data,
        output_data: payload.output_data,
        created_at: nowIso(),
      };
      return runWithFallback(
        async (sb) => {
          const { data, error } = await sb
            .from('saved_calculations')
            .insert(row)
            .select('*')
            .limit(1);
          if (error) throw error;
          return Array.isArray(data) ? data[0] : row;
        },
        () => {
          const store = readStore(storePath);
          store.saved_calculations.push(row);
          const mine = store.saved_calculations.filter((item) => item.user_id === userId);
          if (mine.length > MAX_SAVED_ROWS) {
            const overshoot = mine.length - MAX_SAVED_ROWS;
            const sortedMine = mine.sort((a, b) =>
              String(a.created_at || '').localeCompare(String(b.created_at || ''))
            );
            const dropIds = new Set(sortedMine.slice(0, overshoot).map((item) => item.id));
            store.saved_calculations = store.saved_calculations.filter(
              (item) => !dropIds.has(item.id)
            );
          }
          writeStore(storePath, store);
          return row;
        }
      );
    },

    async deleteSavedCalculation(userId, id) {
      return runWithFallback(
        async (sb) => {
          const { data, error } = await sb
            .from('saved_calculations')
            .delete()
            .eq('user_id', userId)
            .eq('id', id)
            .select('id')
            .limit(1);
          if (error) throw error;
          return Array.isArray(data) && data.length > 0;
        },
        () => {
          const store = readStore(storePath);
          const before = store.saved_calculations.length;
          store.saved_calculations = store.saved_calculations.filter(
            (row) => !(row.user_id === userId && row.id === id)
          );
          writeStore(storePath, store);
          return store.saved_calculations.length < before;
        }
      );
    },

    async listWatchlist(userId) {
      return runWithFallback(
        async (sb) => {
          const { data, error } = await sb
            .from('watchlists')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });
          if (error) throw error;
          return Array.isArray(data) ? data : [];
        },
        () => {
          const store = readStore(storePath);
          return store.watchlists
            .filter((row) => row.user_id === userId)
            .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
        }
      );
    },

    async addWatchlistItem(userId, payload) {
      const row = {
        id: generateId(),
        user_id: userId,
        item_type: payload.item_type,
        item_key: payload.item_key,
        item_label: payload.item_label,
        metadata: payload.metadata,
        created_at: nowIso(),
      };
      return runWithFallback(
        async (sb) => {
          const { data, error } = await sb
            .from('watchlists')
            .upsert(row, { onConflict: 'user_id,item_type,item_key' })
            .select('*')
            .limit(1);
          if (error) throw error;
          return Array.isArray(data) ? data[0] : row;
        },
        () => {
          const store = readStore(storePath);
          const existing = store.watchlists.find(
            (item) =>
              item.user_id === userId &&
              item.item_type === row.item_type &&
              item.item_key === row.item_key
          );
          if (existing) {
            Object.assign(existing, row, { id: existing.id, created_at: existing.created_at });
            writeStore(storePath, store);
            return existing;
          }
          store.watchlists.push(row);
          writeStore(storePath, store);
          return row;
        }
      );
    },

    async deleteWatchlistItem(userId, id) {
      return runWithFallback(
        async (sb) => {
          const { data, error } = await sb
            .from('watchlists')
            .delete()
            .eq('user_id', userId)
            .eq('id', id)
            .select('id')
            .limit(1);
          if (error) throw error;
          return Array.isArray(data) && data.length > 0;
        },
        () => {
          const store = readStore(storePath);
          const before = store.watchlists.length;
          store.watchlists = store.watchlists.filter(
            (row) => !(row.user_id === userId && row.id === id)
          );
          writeStore(storePath, store);
          return store.watchlists.length < before;
        }
      );
    },

    async listSavedShops(userId) {
      return runWithFallback(
        async (sb) => {
          const { data, error } = await sb
            .from('saved_shops')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });
          if (error) throw error;
          return Array.isArray(data) ? data : [];
        },
        () => {
          const store = readStore(storePath);
          return store.saved_shops
            .filter((row) => row.user_id === userId)
            .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
        }
      );
    },

    async addSavedShop(userId, payload) {
      const row = {
        id: generateId(),
        user_id: userId,
        shop_id: payload.shop_id,
        shop_name: payload.shop_name,
        city: payload.city,
        country_code: payload.country_code,
        source_url: payload.source_url,
        notes: payload.notes,
        created_at: nowIso(),
      };
      return runWithFallback(
        async (sb) => {
          const { data, error } = await sb
            .from('saved_shops')
            .upsert(row, { onConflict: 'user_id,shop_id' })
            .select('*')
            .limit(1);
          if (error) throw error;
          return Array.isArray(data) ? data[0] : row;
        },
        () => {
          const store = readStore(storePath);
          const existing = store.saved_shops.find(
            (item) => item.user_id === userId && item.shop_id === row.shop_id
          );
          if (existing) {
            Object.assign(existing, row, { id: existing.id, created_at: existing.created_at });
            writeStore(storePath, store);
            return existing;
          }
          store.saved_shops.push(row);
          writeStore(storePath, store);
          return row;
        }
      );
    },

    async deleteSavedShop(userId, id) {
      return runWithFallback(
        async (sb) => {
          const { data, error } = await sb
            .from('saved_shops')
            .delete()
            .eq('user_id', userId)
            .eq('id', id)
            .select('id')
            .limit(1);
          if (error) throw error;
          return Array.isArray(data) && data.length > 0;
        },
        () => {
          const store = readStore(storePath);
          const before = store.saved_shops.length;
          store.saved_shops = store.saved_shops.filter(
            (row) => !(row.user_id === userId && row.id === id)
          );
          writeStore(storePath, store);
          return store.saved_shops.length < before;
        }
      );
    },

    async listUserSessions(userId) {
      return runWithFallback(
        async (sb) => {
          const { data, error } = await sb
            .from('user_sessions')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });
          if (error) throw error;
          return Array.isArray(data) ? data : [];
        },
        () => {
          const store = readStore(storePath);
          return store.user_sessions
            .filter((row) => row.user_id === userId)
            .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
        }
      );
    },

    async getAdminRoleForUser(userId) {
      return runWithFallback(
        async (sb) => {
          const { data, error } = await sb
            .from('user_profiles')
            .select('role')
            .eq('id', userId)
            .maybeSingle();
          if (error) throw error;
          return toSafeString(data?.role, 32);
        },
        () => null
      );
    },

    async listAlertRulesForUser(userId, email) {
      const normalizedEmail = toSafeString(String(email || '').toLowerCase(), 320);
      return runWithFallback(
        async (sb) => {
          const byUser = await sb
            .from('alert_rules')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });
          if (byUser.error) throw byUser.error;

          let byEmail = { data: [] };
          if (normalizedEmail) {
            byEmail = await sb
              .from('alert_rules')
              .select('*')
              .is('user_id', null)
              .eq('email', normalizedEmail)
              .order('created_at', { ascending: false });
            if (byEmail.error) throw byEmail.error;
          }

          const dedup = new Map();
          [...(byUser.data || []), ...(byEmail.data || [])].forEach((row) => {
            if (!row?.id) return;
            dedup.set(row.id, sanitizeAlertRuleForExport(row));
          });
          return Array.from(dedup.values());
        },
        () => {
          const store = readStore(storePath);
          const dedup = new Map();
          store.alert_rules
            .filter((row) => {
              const rowEmail = toSafeString(String(row.email || '').toLowerCase(), 320);
              return row.user_id === userId || (normalizedEmail && rowEmail === normalizedEmail);
            })
            .forEach((row) => {
              if (!row?.id) return;
              dedup.set(row.id, sanitizeAlertRuleForExport(row));
            });
          return Array.from(dedup.values());
        }
      );
    },

    async listNotificationSubscriptionsForUser(userId, email) {
      const normalizedEmail = toSafeString(String(email || '').toLowerCase(), 320);
      return runWithFallback(
        async (sb) => {
          const byUser = await sb
            .from('notification_subscriptions')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });
          if (byUser.error) throw byUser.error;

          let byEmail = { data: [] };
          if (normalizedEmail) {
            byEmail = await sb
              .from('notification_subscriptions')
              .select('*')
              .is('user_id', null)
              .eq('destination', normalizedEmail)
              .order('created_at', { ascending: false });
            if (byEmail.error) throw byEmail.error;
          }

          const dedup = new Map();
          [...(byUser.data || []), ...(byEmail.data || [])].forEach((row) => {
            if (!row?.id) return;
            dedup.set(row.id, sanitizeNotificationSubscriptionForExport(row));
          });
          return Array.from(dedup.values());
        },
        () => {
          const store = readStore(storePath);
          const dedup = new Map();
          store.notification_subscriptions
            .filter((row) => {
              const destination = toSafeString(String(row.destination || '').toLowerCase(), 320);
              return row.user_id === userId || (normalizedEmail && destination === normalizedEmail);
            })
            .forEach((row) => {
              if (!row?.id) return;
              dedup.set(row.id, sanitizeNotificationSubscriptionForExport(row));
            });
          return Array.from(dedup.values());
        }
      );
    },

    async listSubscriptionRows(userId) {
      return runWithFallback(
        async (sb) => {
          const { data, error } = await sb
            .from('subscriptions')
            .select(
              'id,user_id,tier,status,current_period_end,cancel_at_period_end,canceled_at,interval,created_at,updated_at'
            )
            .eq('user_id', userId)
            .order('created_at', { ascending: false });
          if (error) throw error;
          return Array.isArray(data) ? data : [];
        },
        () => {
          const store = readStore(storePath);
          return store.subscriptions
            .filter((row) => row.userId === userId || row.user_id === userId)
            .map((row) => ({
              id: row.id || null,
              user_id: row.user_id || row.userId || null,
              tier: row.tier || null,
              status: row.status || null,
              current_period_end: row.current_period_end || row.currentPeriodEnd || null,
              cancel_at_period_end: Boolean(row.cancel_at_period_end || row.cancelAtPeriodEnd),
              canceled_at: row.canceled_at || row.canceledAt || null,
              interval: row.interval || null,
              created_at: row.created_at || row.createdAt || null,
              updated_at: row.updated_at || row.updatedAt || null,
            }))
            .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
        }
      );
    },

    async listEntitlementRows(userId) {
      return runWithFallback(
        async (sb) => {
          const { data, error } = await sb
            .from('entitlements')
            .select('id,user_id,feature,value,expires_at,created_at,updated_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });
          if (error) throw error;
          return Array.isArray(data) ? data : [];
        },
        () => {
          const store = readStore(storePath);
          return store.entitlements
            .filter((row) => row.userId === userId || row.user_id === userId)
            .map((row) => ({
              id: row.id || null,
              user_id: row.user_id || row.userId || null,
              feature: row.feature || null,
              value: row.value ?? null,
              expires_at: row.expires_at || row.expiresAt || null,
              created_at: row.created_at || row.createdAt || null,
              updated_at: row.updated_at || row.updatedAt || null,
            }))
            .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
        }
      );
    },

    async deleteAccountData(user) {
      const userId = user.id;
      const normalizedEmail = toSafeString(String(user.email || '').toLowerCase(), 320);
      const counts = {
        profiles: 0,
        user_preferences: 0,
        saved_calculations: 0,
        watchlists: 0,
        saved_shops: 0,
        user_sessions: 0,
        api_keys: 0,
        subscriptions: 0,
        entitlements: 0,
        alert_rules: 0,
        notification_subscriptions: 0,
      };

      await runWithFallback(
        async (sb) => {
          const deleteAndCount = async (table, matcher) => {
            const { data, error } = await matcher(sb.from(table).delete()).select('id');
            if (error) throw error;
            return Array.isArray(data) ? data.length : 0;
          };

          counts.saved_calculations = await deleteAndCount('saved_calculations', (q) =>
            q.eq('user_id', userId)
          );
          counts.watchlists = await deleteAndCount('watchlists', (q) => q.eq('user_id', userId));
          counts.saved_shops = await deleteAndCount('saved_shops', (q) => q.eq('user_id', userId));
          counts.user_sessions = await deleteAndCount('user_sessions', (q) =>
            q.eq('user_id', userId)
          );
          counts.user_preferences = await deleteAndCount('user_preferences', (q) =>
            q.eq('user_id', userId)
          );
          counts.api_keys = await deleteAndCount('api_keys', (q) => q.eq('user_id', userId));
          counts.subscriptions = await deleteAndCount('subscriptions', (q) =>
            q.eq('user_id', userId)
          );
          counts.entitlements = await deleteAndCount('entitlements', (q) =>
            q.eq('user_id', userId)
          );
          counts.alert_rules = await deleteAndCount('alert_rules', (q) => q.eq('user_id', userId));
          counts.notification_subscriptions = await deleteAndCount(
            'notification_subscriptions',
            (q) => q.eq('user_id', userId)
          );

          if (normalizedEmail) {
            counts.alert_rules += await deleteAndCount('alert_rules', (q) =>
              q.is('user_id', null).eq('email', normalizedEmail)
            );
            counts.notification_subscriptions += await deleteAndCount(
              'notification_subscriptions',
              (q) => q.is('user_id', null).eq('destination', normalizedEmail)
            );
          }

          counts.profiles = await deleteAndCount('profiles', (q) => q.eq('id', userId));
        },
        () => {
          const store = readStore(storePath);
          const removeOwned = (key, predicate) => {
            const before = store[key].length;
            store[key] = store[key].filter((row) => !predicate(row));
            return before - store[key].length;
          };
          counts.saved_calculations = removeOwned(
            'saved_calculations',
            (row) => row.user_id === userId
          );
          counts.watchlists = removeOwned('watchlists', (row) => row.user_id === userId);
          counts.saved_shops = removeOwned('saved_shops', (row) => row.user_id === userId);
          counts.user_sessions = removeOwned('user_sessions', (row) => row.user_id === userId);
          counts.user_preferences = removeOwned(
            'user_preferences',
            (row) => row.user_id === userId
          );
          counts.profiles = removeOwned('profiles', (row) => row.id === userId);
          counts.api_keys = removeOwned(
            'api_keys',
            (row) => row.user_id === userId || row.userId === userId
          );
          counts.subscriptions = removeOwned(
            'subscriptions',
            (row) => row.user_id === userId || row.userId === userId
          );
          counts.entitlements = removeOwned(
            'entitlements',
            (row) => row.user_id === userId || row.userId === userId
          );
          counts.alert_rules = removeOwned('alert_rules', (row) => {
            const rowEmail = toSafeString(String(row.email || '').toLowerCase(), 320);
            return row.user_id === userId || (normalizedEmail && rowEmail === normalizedEmail);
          });
          counts.notification_subscriptions = removeOwned('notification_subscriptions', (row) => {
            const destination = toSafeString(String(row.destination || '').toLowerCase(), 320);
            return row.user_id === userId || (normalizedEmail && destination === normalizedEmail);
          });
          writeStore(storePath, store);
        }
      );

      return counts;
    },
  };
}

function sanitizePreferencePatch(payload) {
  const patch = {};
  const lang = toSafeString(payload?.lang, 8);
  if (lang === 'en' || lang === 'ar') patch.lang = lang;
  const currency = toUpperCode(payload?.currency, 8);
  if (currency) patch.currency = currency;
  const karat = toSafeString(payload?.karat, 4);
  if (karat) patch.karat = karat;
  const unit = toSafeString(payload?.unit, 12);
  if (unit) patch.unit = unit;
  const theme = toSafeString(payload?.theme, 16);
  if (theme) patch.theme = theme;
  const alertDelivery = toSafeString(payload?.alert_delivery, 24);
  if (alertDelivery) patch.alert_delivery = alertDelivery;
  return patch;
}

function sanitizeCalculation(payload) {
  const tool = toSafeString(payload?.tool, 40);
  if (!tool) return { ok: false, message: 'tool is required.' };
  const label = toSafeString(payload?.label, 200) || tool;
  return {
    ok: true,
    value: {
      tool,
      label,
      input_data: toPlainObject(payload?.input_data) || {},
      output_data: toPlainObject(payload?.output_data) || {
        value: toSafeString(String(payload?.value || ''), 200),
      },
    },
  };
}

function sanitizeWatchlist(payload) {
  const itemType = toSafeString(payload?.item_type, 40);
  const itemKey = toSafeString(payload?.item_key, 120);
  if (!itemType || !itemKey) {
    return { ok: false, message: 'item_type and item_key are required.' };
  }
  return {
    ok: true,
    value: {
      item_type: itemType,
      item_key: itemKey,
      item_label: toSafeString(payload?.item_label, 200) || itemKey,
      metadata: toPlainObject(payload?.metadata) || {},
    },
  };
}

function sanitizeSavedShop(payload) {
  const shopId = toSafeString(payload?.shop_id, 160);
  if (!shopId) return { ok: false, message: 'shop_id is required.' };
  return {
    ok: true,
    value: {
      shop_id: shopId,
      shop_name: toSafeString(payload?.shop_name, 200) || shopId,
      city: toSafeString(payload?.city, 120),
      country_code: toUpperCode(payload?.country_code, 8),
      source_url: toSafeString(payload?.source_url, 500),
      notes: toSafeString(payload?.notes, 500),
    },
  };
}

function sanitizeAlertRuleForExport(row) {
  return {
    id: row.id || null,
    user_id: row.user_id || null,
    email: row.email || null,
    channel: row.channel || null,
    symbol: row.symbol || null,
    currency: row.currency || null,
    condition: row.condition || null,
    threshold_value: row.threshold_value ?? null,
    karat: row.karat || null,
    country_code: row.country_code || null,
    is_active: Boolean(row.is_active),
    cooldown_minutes: row.cooldown_minutes ?? null,
    last_triggered_at: row.last_triggered_at || null,
    verified_at: row.verified_at || null,
    unsubscribed_at: row.unsubscribed_at || null,
    created_at: row.created_at || null,
    updated_at: row.updated_at || null,
  };
}

function sanitizeNotificationSubscriptionForExport(row) {
  return {
    id: row.id || null,
    user_id: row.user_id || null,
    channel: row.channel || null,
    destination: row.destination || null,
    verified_at: row.verified_at || null,
    unsubscribed_at: row.unsubscribed_at || null,
    metadata: row.metadata && typeof row.metadata === 'object' ? row.metadata : {},
    created_at: row.created_at || null,
    updated_at: row.updated_at || null,
  };
}

function sanitizeApiKeyForExport(key) {
  return {
    id: key.id,
    keyPrefix: key.keyPrefix,
    label: key.label,
    revoked: Boolean(key.revoked),
    createdAt: key.createdAt || null,
  };
}

function createPublicAccountsRouter(options = {}) {
  const router = express.Router();
  const storePath =
    options.storePath || process.env.PUBLIC_ACCOUNTS_DATA_FILE || DEFAULT_STORE_PATH;
  const dataLayer = createDataLayer(storePath);
  const resolveUser = options.resolveUser || resolveSupabaseUser;

  router.use('/me', async (req, res, next) => {
    const devUser = parseDevUser(req);
    if (devUser) {
      req.publicUser = devUser;
      return next();
    }

    const token = extractBearerToken(req);
    if (!token) {
      return res.status(401).json(errorResponse('UNAUTHORIZED', 'Missing bearer token.'));
    }
    const user = await resolveUser(token);
    if (!user?.id) {
      return res
        .status(401)
        .json(errorResponse('UNAUTHORIZED', 'Invalid or expired session token.'));
    }
    req.publicUser = user;
    next();
  });

  router.get('/me', async (req, res) => {
    const profile = await dataLayer.getOrCreateProfile(req.publicUser);
    await dataLayer.touchSession(req.publicUser, req);
    const preferences = (await dataLayer.getPreferences(req.publicUser.id)) || {};
    const [savedCalculations, watchlist, savedShops] = await Promise.all([
      dataLayer.listSavedCalculations(req.publicUser.id),
      dataLayer.listWatchlist(req.publicUser.id),
      dataLayer.listSavedShops(req.publicUser.id),
    ]);

    res.json(
      successResponse(
        {
          user: {
            id: req.publicUser.id,
            email: req.publicUser.email || null,
          },
          profile,
          preferences,
          counts: {
            savedCalculations: savedCalculations.length,
            watchlist: watchlist.length,
            savedShops: savedShops.length,
          },
        },
        { source: 'public-accounts', freshness: 'live' }
      )
    );
  });

  router.get('/me/export', async (req, res) => {
    const profile = await dataLayer.getOrCreateProfile(req.publicUser);
    const [preferences, savedCalculations, watchlist, savedShops, userSessions] = await Promise.all(
      [
        dataLayer.getPreferences(req.publicUser.id),
        dataLayer.listSavedCalculations(req.publicUser.id),
        dataLayer.listWatchlist(req.publicUser.id),
        dataLayer.listSavedShops(req.publicUser.id),
        dataLayer.listUserSessions(req.publicUser.id),
      ]
    );
    const [alertRules, notificationSubscriptions, apiKeys, resolvedEntitlements, subscriptionRows] =
      await Promise.all([
        dataLayer.listAlertRulesForUser(req.publicUser.id, req.publicUser.email),
        dataLayer.listNotificationSubscriptionsForUser(req.publicUser.id, req.publicUser.email),
        billingRepo.listApiKeys(req.publicUser.id),
        resolveUserEntitlements(req.publicUser.id),
        dataLayer.listSubscriptionRows(req.publicUser.id),
      ]);
    const entitlementRows = await dataLayer.listEntitlementRows(req.publicUser.id);

    res.json(
      successResponse(
        {
          exportedAt: nowIso(),
          user: {
            id: req.publicUser.id,
            email: req.publicUser.email || null,
          },
          profile: profile || null,
          preferences: preferences || {},
          savedCalculations,
          watchlist,
          savedShops,
          userSessions,
          alertRules,
          notificationSubscriptions,
          // Export metadata only; keyPrefix is safe for user reference, while
          // raw keys and key hashes are intentionally excluded for security.
          apiKeys: (apiKeys || []).map(sanitizeApiKeyForExport),
          subscriptions: {
            active:
              resolvedEntitlements?.subscription &&
              typeof resolvedEntitlements.subscription === 'object'
                ? {
                    tier: resolvedEntitlements.subscription.tier || null,
                    status: resolvedEntitlements.subscription.status || null,
                    currentPeriodEnd: resolvedEntitlements.subscription.currentPeriodEnd || null,
                    cancelAtPeriodEnd: Boolean(resolvedEntitlements.subscription.cancelAtPeriodEnd),
                    canceledAt: resolvedEntitlements.subscription.canceledAt || null,
                    interval: resolvedEntitlements.subscription.interval || null,
                  }
                : null,
            rows: subscriptionRows,
          },
          entitlements: {
            tier: resolvedEntitlements?.tier || 'free',
            resolved: resolvedEntitlements?.entitlements || {},
            overrides: entitlementRows,
          },
        },
        { source: 'public-accounts', freshness: 'live' }
      )
    );
  });

  router.delete('/me', async (req, res) => {
    const role = await dataLayer.getAdminRoleForUser(req.publicUser.id);
    if (role === 'admin' || role === 'editor') {
      return res
        .status(403)
        .json(
          errorResponse('FORBIDDEN', 'Admin/editor accounts cannot be deleted from this route.')
        );
    }

    const deleted = await dataLayer.deleteAccountData(req.publicUser);

    let authUserDeleted = false;
    let authDeletionMode = 'safe_mode';
    let authDeletionMessage =
      'Local app data was removed. Supabase auth-user deletion requires service-role configuration.';

    const hasServiceRoleKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
    const sb = hasServiceRoleKey ? getSupabaseClient() : null;
    if (sb?.auth?.admin?.deleteUser) {
      try {
        const { error } = await sb.auth.admin.deleteUser(req.publicUser.id);
        if (!error) {
          authUserDeleted = true;
          authDeletionMode = 'full';
          authDeletionMessage = 'Account data and Supabase auth user were deleted.';
        } else {
          authDeletionMessage =
            'Local app data was removed. Supabase auth-user deletion failed and requires owner review.';
        }
      } catch {
        authDeletionMessage =
          'Local app data was removed. Supabase auth-user deletion failed and requires owner review.';
      }
    } else if (!hasServiceRoleKey) {
      authDeletionMessage =
        'Local app data was removed. Supabase auth-user deletion is not configured because SUPABASE_SERVICE_ROLE_KEY is missing.';
    }

    res.json(
      successResponse(
        {
          deleted,
          auth: {
            userDeleted: authUserDeleted,
            mode: authDeletionMode,
            message: authDeletionMessage,
          },
        },
        { source: 'public-accounts', freshness: 'live' }
      )
    );
  });

  router.get('/me/preferences', async (req, res) => {
    const preferences = (await dataLayer.getPreferences(req.publicUser.id)) || {};
    res.json(successResponse({ preferences }, { source: 'public-accounts', freshness: 'live' }));
  });

  router.patch('/me/preferences', async (req, res) => {
    const patch = sanitizePreferencePatch(req.body || {});
    if (!Object.keys(patch).length) {
      return res
        .status(400)
        .json(errorResponse('VALIDATION_ERROR', 'No valid preference fields provided.'));
    }
    const preferences = await dataLayer.updatePreferences(req.publicUser.id, patch);
    res.json(successResponse({ preferences }, { source: 'public-accounts', freshness: 'live' }));
  });

  router.get('/me/saved-calculations', async (req, res) => {
    const items = await dataLayer.listSavedCalculations(req.publicUser.id);
    res.json(successResponse({ items }, { source: 'public-accounts', freshness: 'live' }));
  });

  router.post('/me/saved-calculations', async (req, res) => {
    const parsed = sanitizeCalculation(req.body || {});
    if (!parsed.ok) {
      return res.status(400).json(errorResponse('VALIDATION_ERROR', parsed.message));
    }
    const item = await dataLayer.addSavedCalculation(req.publicUser.id, parsed.value);
    res
      .status(201)
      .json(successResponse({ item }, { source: 'public-accounts', freshness: 'live' }));
  });

  router.delete('/me/saved-calculations/:id', async (req, res) => {
    const id = toSafeString(req.params.id, 128);
    if (!id) return res.status(400).json(errorResponse('VALIDATION_ERROR', 'id is required.'));
    const deleted = await dataLayer.deleteSavedCalculation(req.publicUser.id, id);
    if (!deleted)
      return res.status(404).json(errorResponse('NOT_FOUND', 'Saved calculation not found.'));
    res.json(successResponse({ deleted: true }, { source: 'public-accounts', freshness: 'live' }));
  });

  router.get('/me/watchlist', async (req, res) => {
    const items = await dataLayer.listWatchlist(req.publicUser.id);
    res.json(successResponse({ items }, { source: 'public-accounts', freshness: 'live' }));
  });

  router.post('/me/watchlist', async (req, res) => {
    const parsed = sanitizeWatchlist(req.body || {});
    if (!parsed.ok) {
      return res.status(400).json(errorResponse('VALIDATION_ERROR', parsed.message));
    }
    const item = await dataLayer.addWatchlistItem(req.publicUser.id, parsed.value);
    res
      .status(201)
      .json(successResponse({ item }, { source: 'public-accounts', freshness: 'live' }));
  });

  router.delete('/me/watchlist/:id', async (req, res) => {
    const id = toSafeString(req.params.id, 128);
    if (!id) return res.status(400).json(errorResponse('VALIDATION_ERROR', 'id is required.'));
    const deleted = await dataLayer.deleteWatchlistItem(req.publicUser.id, id);
    if (!deleted)
      return res.status(404).json(errorResponse('NOT_FOUND', 'Watchlist item not found.'));
    res.json(successResponse({ deleted: true }, { source: 'public-accounts', freshness: 'live' }));
  });

  router.get('/me/saved-shops', async (req, res) => {
    const items = await dataLayer.listSavedShops(req.publicUser.id);
    res.json(successResponse({ items }, { source: 'public-accounts', freshness: 'live' }));
  });

  router.post('/me/saved-shops', async (req, res) => {
    const parsed = sanitizeSavedShop(req.body || {});
    if (!parsed.ok) {
      return res.status(400).json(errorResponse('VALIDATION_ERROR', parsed.message));
    }
    const item = await dataLayer.addSavedShop(req.publicUser.id, parsed.value);
    res
      .status(201)
      .json(successResponse({ item }, { source: 'public-accounts', freshness: 'live' }));
  });

  router.delete('/me/saved-shops/:id', async (req, res) => {
    const id = toSafeString(req.params.id, 128);
    if (!id) return res.status(400).json(errorResponse('VALIDATION_ERROR', 'id is required.'));
    const deleted = await dataLayer.deleteSavedShop(req.publicUser.id, id);
    if (!deleted) return res.status(404).json(errorResponse('NOT_FOUND', 'Saved shop not found.'));
    res.json(successResponse({ deleted: true }, { source: 'public-accounts', freshness: 'live' }));
  });

  return router;
}

module.exports = {
  createPublicAccountsRouter,
  publicAccountsRouter: createPublicAccountsRouter(),
};
