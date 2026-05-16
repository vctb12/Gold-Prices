import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config/supabase.js';

const API_BASE = '/api/v1';
const SUPABASE_AUTH_TOKEN_KEY_REGEX = /^sb-[a-z0-9]+-auth-token$/i;

function readJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function readSessionFromStorage() {
  if (typeof localStorage === 'undefined') return null;
  const keys = Object.keys(localStorage);
  for (const key of keys) {
    if (!SUPABASE_AUTH_TOKEN_KEY_REGEX.test(key)) continue;
    const parsed = readJson(localStorage.getItem(key));
    if (!parsed) continue;
    if (parsed.access_token) return parsed;
    if (parsed.currentSession?.access_token) return parsed.currentSession;
    if (parsed.session?.access_token) return parsed.session;
  }
  return null;
}

export function getAccessToken() {
  return readSessionFromStorage()?.access_token || null;
}

export function isAuthenticated() {
  return Boolean(getAccessToken());
}

export function redirectToAccount(nextUrl = null) {
  // `next` is validated on the account page before redirecting back, so
  // cross-origin values are rejected there.
  const next = encodeURIComponent(nextUrl || window.location.href);
  window.location.href = `/account.html?next=${next}`;
}

async function authedFetch(path, options = {}) {
  const token = getAccessToken();
  if (!token) {
    const error = new Error('Authentication required.');
    error.code = 'AUTH_REQUIRED';
    throw error;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method: options.method || 'GET',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload?.error?.message || `Request failed (${response.status})`;
    const error = new Error(message);
    error.code = payload?.error?.code || 'API_ERROR';
    error.status = response.status;
    throw error;
  }
  return payload?.data || {};
}

export function getMe() {
  return authedFetch('/me');
}

export function exportMyData() {
  return authedFetch('/me/export');
}

export function deleteMyAccount(confirm) {
  return authedFetch('/me', { method: 'DELETE', body: { confirm } });
}

export function getPreferences() {
  return authedFetch('/me/preferences');
}

export function updatePreferences(preferences) {
  return authedFetch('/me/preferences', { method: 'PATCH', body: preferences });
}

export function listSavedCalculations() {
  return authedFetch('/me/saved-calculations');
}

export function createSavedCalculation(payload) {
  return authedFetch('/me/saved-calculations', { method: 'POST', body: payload });
}

export function deleteSavedCalculation(id) {
  return authedFetch(`/me/saved-calculations/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export function listWatchlist() {
  return authedFetch('/me/watchlist');
}

export function createWatchlistItem(payload) {
  return authedFetch('/me/watchlist', { method: 'POST', body: payload });
}

export function deleteWatchlistItem(id) {
  return authedFetch(`/me/watchlist/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export function listSavedShops() {
  return authedFetch('/me/saved-shops');
}

export function createSavedShop(payload) {
  return authedFetch('/me/saved-shops', { method: 'POST', body: payload });
}

export function deleteSavedShop(id) {
  return authedFetch(`/me/saved-shops/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function parseStorageArray(key) {
  try {
    return asArray(JSON.parse(localStorage.getItem(key) || '[]'));
  } catch {
    return [];
  }
}

export function buildLocalStorageImportPreview() {
  if (typeof localStorage === 'undefined') {
    return {
      preferences: null,
      alerts: [],
      watchlistCurrencies: [],
      shortlistShopIds: [],
      localCalculations: [],
    };
  }

  let preferences = null;
  try {
    const prefs = JSON.parse(localStorage.getItem('user_prefs') || '{}');
    preferences =
      prefs && typeof prefs === 'object'
        ? {
            lang: typeof prefs.lang === 'string' ? prefs.lang : null,
            currency: typeof prefs.currency === 'string' ? prefs.currency : null,
            karat:
              typeof prefs.selectedKarat === 'string'
                ? prefs.selectedKarat
                : typeof prefs.selectedKaratSpotlight === 'string'
                  ? prefs.selectedKaratSpotlight
                  : null,
            unit: typeof prefs.unit === 'string' ? prefs.unit : null,
            theme: typeof prefs.theme === 'string' ? prefs.theme : null,
          }
        : null;
  } catch {
    preferences = null;
  }

  return {
    preferences,
    alerts: parseStorageArray('gold_price_alerts'),
    watchlistCurrencies: parseStorageArray('tracker_pro_favorites_v5'),
    shortlistShopIds: parseStorageArray('shops_shortlist'),
    localCalculations: parseStorageArray('gold_saved_calculations_local_v1'),
  };
}

export async function importLocalStorageData() {
  const preview = buildLocalStorageImportPreview();
  if (!isAuthenticated()) {
    const error = new Error('Authentication required.');
    error.code = 'AUTH_REQUIRED';
    throw error;
  }

  const result = {
    preferences: false,
    watchlist: 0,
    savedShops: 0,
    savedCalculations: 0,
    alerts: 0,
    failed: 0,
  };

  async function runConcurrent(items, worker, concurrency = 4) {
    const queue = [...items];
    const runners = Array.from({ length: Math.min(concurrency, queue.length || 1) }, async () => {
      while (queue.length) {
        const next = queue.shift();
        try {
          await worker(next);
        } catch {
          result.failed += 1;
        }
      }
    });
    await Promise.all(runners);
  }

  if (preview.preferences) {
    try {
      await updatePreferences(preview.preferences);
      result.preferences = true;
    } catch {
      result.failed += 1;
    }
  }

  const watchlistItems = preview.watchlistCurrencies.filter(
    (currency) => typeof currency === 'string' && currency.trim()
  );
  await runConcurrent(watchlistItems, async (currency) => {
    const normalized = currency.trim().toUpperCase();
    await createWatchlistItem({
      item_type: 'currency',
      item_key: normalized,
      item_label: `${normalized} watch`,
      metadata: { source: 'localStorage-import' },
    });
    result.watchlist += 1;
  });

  const alertItems = preview.alerts.filter((alert) => alert && typeof alert === 'object');
  await runConcurrent(alertItems, async (alert) => {
    const key = [alert.direction, alert.target, alert.scope].filter(Boolean).join(':');
    if (!key) return;
    await createWatchlistItem({
      item_type: 'alert',
      item_key: key.slice(0, 120),
      item_label: `${alert.direction || 'target'} ${alert.target || ''}`.trim(),
      metadata: { ...alert, source: 'localStorage-import' },
    });
    result.alerts += 1;
  });

  const shortlistIds = preview.shortlistShopIds.filter(
    (shopId) => typeof shopId === 'string' && shopId.trim()
  );
  await runConcurrent(shortlistIds, async (shopId) => {
    const normalized = shopId.trim();
    await createSavedShop({
      shop_id: normalized,
      shop_name: normalized,
      notes: 'Imported from local shortlist',
      source_url: '/shops.html',
    });
    result.savedShops += 1;
  });

  const calculations = preview.localCalculations.filter(
    (calc) => calc && typeof calc === 'object' && calc.tool
  );
  await runConcurrent(calculations, async (calc) => {
    await createSavedCalculation({
      tool: String(calc.tool).slice(0, 40),
      label: String(calc.label || calc.tool).slice(0, 200),
      input_data: calc.input_data && typeof calc.input_data === 'object' ? calc.input_data : {},
      output_data: calc.output_data && typeof calc.output_data === 'object' ? calc.output_data : {},
    });
    result.savedCalculations += 1;
  });

  return result;
}

export function buildSupabaseBrowserClient() {
  if (typeof window === 'undefined' || !window.supabase || !SUPABASE_URL || !SUPABASE_ANON_KEY)
    return null;
  return window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
