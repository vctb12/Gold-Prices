import { CONSTANTS } from '../config/index.js';
import { getFallbackGoldPrice, getFallbackFXRates } from './cache.js';

class NetworkError extends Error {
  constructor(msg) {
    super(msg);
    this.name = 'NetworkError';
  }
}
class TimeoutError extends Error {
  constructor(msg) {
    super(msg);
    this.name = 'TimeoutError';
  }
}
class DataError extends Error {
  constructor(msg) {
    super(msg);
    this.name = 'DataError';
  }
}

/**
 * When true, `fetchGold()` throws a NetworkError immediately.
 * Set via `setSimulateGoldFail()` for tests and the debug panel.
 * @type {boolean}
 */
export let _simulateGoldFail = false;

/**
 * When true, `fetchFX()` throws a NetworkError immediately.
 * Set via `setSimulateFxFail()` for tests and the debug panel.
 * @type {boolean}
 */
export let _simulateFxFail = false;

/**
 * Toggle gold-API failure simulation.
 * @param {boolean} v  Pass `true` to make `fetchGold()` throw; `false` to restore normal behaviour.
 */
export function setSimulateGoldFail(v) {
  _simulateGoldFail = v;
}

/**
 * Toggle FX-API failure simulation.
 * @param {boolean} v  Pass `true` to make `fetchFX()` throw; `false` to restore normal behaviour.
 */
export function setSimulateFxFail(v) {
  _simulateFxFail = v;
}

/**
 * Fetch `url` and reject if the response is not received within `timeoutMs`.
 * Re-throws `AbortError` as `TimeoutError` so callers can distinguish timeouts
 * from general network failures.
 * @param {string} url
 * @param {number} timeoutMs
 * @returns {Promise<Response>}
 */
async function fetchWithTimeout(url, timeoutMs, { signal } = {}) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  const abortFromExternalSignal = () => controller.abort();
  if (signal?.aborted) {
    abortFromExternalSignal();
  } else if (signal) {
    signal.addEventListener('abort', abortFromExternalSignal, { once: true });
  }
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(id);
    if (signal) signal.removeEventListener('abort', abortFromExternalSignal);
    if (!res.ok) throw new NetworkError(`HTTP ${res.status}: ${url}`);
    return res;
  } catch (e) {
    clearTimeout(id);
    if (signal) signal.removeEventListener('abort', abortFromExternalSignal);
    if (e.name === 'AbortError') throw new TimeoutError(`Timeout fetching ${url}`);
    if (e instanceof NetworkError || e instanceof TimeoutError) throw e;
    throw new NetworkError(e.message);
  }
}

/**
 * Call `fn` up to `maxRetries + 1` times with exponential back-off between
 * attempts (1 s, 2 s, …). Returns the first successful result or re-throws
 * the last error.
 * @template T
 * @param {() => Promise<T>} fn
 * @param {number} [maxRetries=2]
 * @returns {Promise<T>}
 */
async function retryWithBackoff(fn, maxRetries = 2) {
  let lastErr;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (attempt < maxRetries) {
        const delay = 1000 << attempt; // Bit-shift optimization: 1000 * 2^attempt
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastErr;
}

const GOLD_DATA_URL = '/data/gold_price.json';
const GOLD_BACKEND_URL = '/api/v1/prices/latest';

function unwrapApiEnvelope(data) {
  return data?.ok === true && data?.data && typeof data.data === 'object' ? data.data : data;
}

function normalizeGoldResponse(data) {
  if (!data || typeof data !== 'object') return null;

  const payload = unwrapApiEnvelope(data);
  const normalizedPrice = Number(payload?.xauUsdPerOz ?? payload?.xau_usd_per_oz);
  const legacyPrice = Number(payload?.gold?.ounce_usd);
  const price =
    Number.isFinite(normalizedPrice) && normalizedPrice > 0
      ? normalizedPrice
      : Number.isFinite(legacyPrice) && legacyPrice > 0
        ? legacyPrice
        : null;

  if (typeof price !== 'number' || price <= 0) return null;

  const updatedAt =
    payload?.timestampUtc ||
    payload?.timestamp_utc ||
    payload?.fetchedAtUtc ||
    payload?.fetched_at_utc ||
    new Date().toISOString();

  const source =
    payload?.provider ||
    payload?.source_provider ||
    payload?.source ||
    data?.meta?.source ||
    'goldpricez';

  // Pipe upstream truth metadata through so the client freshness engine can
  // honor anti-mislabel guards (isFallback, isFresh) instead of relying on
  // age alone. The provider-adapter writes these into data/gold_price.json
  // and the backend forwards them via /api/v1/prices/latest.
  const isFresh =
    payload?.isFresh === true || payload?.is_fresh === true
      ? true
      : payload?.isFresh === false || payload?.is_fresh === false
        ? false
        : null;
  const isFallback =
    payload?.isFallback === true || payload?.is_fallback === true
      ? true
      : payload?.isFallback === false || payload?.is_fallback === false
        ? false
        : null;
  const freshnessSeconds = Number(payload?.freshnessSeconds ?? payload?.freshness_seconds);
  const maxFreshnessSeconds = Number(
    payload?.maxFreshnessSeconds ?? payload?.max_freshness_seconds
  );
  const sourceTimestamp =
    payload?.sourceTimestamp || payload?.source_updated_at_gmt || payload?.timestamp_source || null;

  return {
    price,
    updatedAt,
    source,
    isFresh,
    isFallback,
    freshnessSeconds: Number.isFinite(freshnessSeconds) ? freshnessSeconds : null,
    maxFreshnessSeconds: Number.isFinite(maxFreshnessSeconds) ? maxFreshnessSeconds : null,
    sourceTimestamp,
    raw: data,
  };
}

/**
 * Fetch the current gold spot price (XAU/USD) from the committed static data
 * file `/data/gold_price.json`, which is refreshed hourly during market hours
 * by the `gold-price-fetch.yml` GitHub Actions workflow. Falls back to the
 * most-recent `localStorage` cache entry if the network request fails.
 *
 * @returns {Promise<{ price: number, updatedAt: string, source: string, raw?: object }>}
 * @throws {NetworkError} When both the data file fetch and the local cache fail.
 */
export async function fetchGold({ signal, timeoutMs } = {}) {
  if (_simulateGoldFail) throw new NetworkError('Simulated gold API failure');
  const effectiveTimeoutMs =
    Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : CONSTANTS.GOLD_FETCH_TIMEOUT;

  // Prefer backend API when available, then fall back to static JSON so
  // GitHub Pages mode stays fully functional.
  try {
    const backendRes = await fetchWithTimeout(
      GOLD_BACKEND_URL,
      Math.min(effectiveTimeoutMs, 4000),
      { signal }
    );
    const backendData = await backendRes.json();
    const normalized = normalizeGoldResponse(backendData);
    if (normalized) return normalized;
  } catch {
    // Backend unavailable or invalid; continue to static fallback.
  }

  try {
    return await retryWithBackoff(async () => {
      const res = await fetchWithTimeout(`${GOLD_DATA_URL}?t=${Date.now()}`, effectiveTimeoutMs, {
        signal,
      });
      const data = await res.json();
      const normalized = normalizeGoldResponse(data);
      if (!normalized) throw new DataError('Invalid gold price data file');
      return normalized;
    });
  } catch {
    // Fetching the static data file failed — fall through to cached fallback.
  }

  const cached = getFallbackGoldPrice();
  if (cached) {
    return {
      price: cached.price,
      updatedAt: cached.updatedAt,
      source: 'cache-fallback',
    };
  }
  throw new NetworkError('Gold price unavailable — data file could not be read');
}

/**
 * Fetch current FX exchange rates against USD from `open.er-api.com`.
 * The AED rate is removed from the response and replaced by the fixed UAE
 * Central Bank peg (`CONSTANTS.AED_PEG`) at the call sites, so the API
 * cannot accidentally override it.
 *
 * @returns {Promise<{ rates: Record<string, number>, time_last_update_utc: string, time_next_update_utc: string }>}
 * @throws {NetworkError|DataError} When the API is unreachable or the response is malformed.
 */
export async function fetchFX() {
  if (_simulateFxFail) throw new NetworkError('Simulated FX API failure');

  try {
    return await retryWithBackoff(async () => {
      const res = await fetchWithTimeout(CONSTANTS.API_FX_URL, CONSTANTS.FX_FETCH_TIMEOUT);
      const data = await res.json();
      if (!data.rates || typeof data.rates !== 'object') {
        throw new DataError('Invalid FX rates response');
      }
      // Never allow AED from API — enforce hardcoded peg
      const rates = { ...data.rates };
      delete rates.AED;
      return {
        rates,
        time_last_update_utc: data.time_last_update_utc || new Date().toUTCString(),
        time_next_update_utc:
          data.time_next_update_utc || new Date(Date.now() + 86400000).toUTCString(),
        source: 'live',
      };
    });
  } catch {
    // Live FX fetch failed — fall through to localStorage cache.
  }

  const cached = getFallbackFXRates();
  if (cached && cached.rates) {
    return {
      rates: cached.rates,
      time_last_update_utc: cached.time_last_update_utc || null,
      time_next_update_utc: cached.time_next_update_utc || null,
      source: 'cache-fallback',
    };
  }
  throw new NetworkError('FX rates unavailable — live fetch and cache both failed');
}
