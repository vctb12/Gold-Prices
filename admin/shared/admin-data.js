/**
 * admin/shared/admin-data.js
 * Small, defensive data helpers for the static admin panel.
 */

export const ADMIN_DATA_CONSTANTS = {
  API_GOLD_URL: '/data/gold_price.json',
  API_FX_URL: 'https://open.er-api.com/v6/latest/USD',
  API_TIMEOUT_MS: 8000,
};

let cachedSupabaseTokenKey = null;
let cachedSupabaseTokenKeyScanned = false;

export function readJsonCache(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJsonCache(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function readLegacyAdminToken() {
  try {
    return localStorage.getItem('gp_admin_token');
  } catch {
    return null;
  }
}

export function getAuthToken() {
  try {
    const legacy = localStorage.getItem('gp_admin_token');
    if (legacy) return legacy;
    if (cachedSupabaseTokenKeyScanned && !cachedSupabaseTokenKey) return null;
    let sbKey = cachedSupabaseTokenKey;
    if (!sbKey || !localStorage.getItem(sbKey)) {
      sbKey = Object.keys(localStorage).find(
        (key) => key.startsWith('sb-') && key.endsWith('-auth-token')
      );
      cachedSupabaseTokenKey = sbKey || null;
      cachedSupabaseTokenKeyScanned = true;
    }
    if (!sbKey) return null;
    const raw = localStorage.getItem(sbKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Supabase can store either { access_token } or an array [{ access_token }]
    // depending on client/runtime serialization behavior across auth flows.
    // Keep both branches for backwards compatibility with existing sessions.
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed.access_token || null;
    }
    if (Array.isArray(parsed) && parsed[0] && typeof parsed[0] === 'object') {
      return parsed[0].access_token || null;
    }
    return null;
  } catch {
    return null;
  }
}

export async function fetchJsonWithTimeout(
  url,
  options = {},
  timeoutMs = ADMIN_DATA_CONSTANTS.API_TIMEOUT_MS
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const data = await response.json().catch(() => null);
    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    return { ok: false, status: 'Error', error };
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchServerAdminStats() {
  const token = getAuthToken();
  if (!token) {
    return { ok: false, skipped: true, reason: 'No legacy API token available' };
  }

  const result = await fetchJsonWithTimeout('/api/admin/stats', {
    cache: 'no-store',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!result.ok || !result.data?.success) {
    return {
      ok: false,
      status: result.status,
      reason: result.data?.message || 'Server stats unavailable',
    };
  }

  return { ok: true, stats: result.data.stats };
}

export async function countSupabaseRows(sb, table, queryBuilder) {
  if (!sb) return { ok: false, count: null, reason: 'Supabase not connected' };
  try {
    let query = sb.from(table).select('*', { count: 'exact', head: true });
    if (queryBuilder) query = queryBuilder(query);
    const { count, error } = await query;
    if (error) return { ok: false, count: null, reason: error.message || 'Query failed' };
    return { ok: true, count: count ?? 0 };
  } catch (error) {
    return { ok: false, count: null, reason: error?.message || 'Query failed' };
  }
}

export async function fetchSupabaseRows(sb, table, queryBuilder) {
  if (!sb) return { ok: false, rows: [], reason: 'Supabase not connected' };
  try {
    let query = sb.from(table).select('*');
    if (queryBuilder) query = queryBuilder(query);
    const { data, error } = await query;
    if (error) return { ok: false, rows: [], reason: error.message || 'Query failed' };
    return { ok: true, rows: Array.isArray(data) ? data : [] };
  } catch (error) {
    return { ok: false, rows: [], reason: error?.message || 'Query failed' };
  }
}

export function formatCount(value) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return Number(value).toLocaleString('en-US');
}
