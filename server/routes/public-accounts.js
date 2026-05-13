'use strict';

const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { atomicWriteJSON } = require('../lib/fs-atomic');
const { getSupabaseClient } = require('../lib/supabase-client');
const { successResponse, errorResponse } = require('../lib/api-response');

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

function parseDevUser(req) {
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
      const row = {
        id: generateId(),
        user_id: user.id,
        ip_hash: crypto
          .createHash('sha256')
          .update(String(req.ip || req.socket?.remoteAddress || 'unknown'))
          .digest('hex'),
        user_agent: toSafeString(req.get('user-agent') || '', 500),
        created_at: nowIso(),
      };
      return runWithFallback(
        async (sb) => {
          const { error } = await sb.from('user_sessions').insert(row);
          if (error) throw error;
          return true;
        },
        () => {
          const store = readStore(storePath);
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

function createPublicAccountsRouter(options = {}) {
  const router = express.Router();
  const storePath =
    options.storePath || process.env.PUBLIC_ACCOUNTS_DATA_FILE || DEFAULT_STORE_PATH;
  const dataLayer = createDataLayer(storePath);
  const resolveUser = options.resolveUser || resolveSupabaseUser;

  router.use(async (req, res, next) => {
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
