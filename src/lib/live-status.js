import { formatTimestampShort } from './formatter.js';

/**
 * Gold-market timing constants.
 *
 * - `OPEN_SUN_MINUTES`: minutes past midnight UTC when the market re-opens on Sunday.
 * - `CLOSE_FRI_MINUTES`: minutes past midnight UTC when the market closes on Friday.
 * - `DELAYED_AFTER_MS`: age in ms after which a price is considered `delayed`
 *   (still trustworthy, but no longer "Live"). 30 minutes is half of the
 *   actual hourly refresh window so the pill flips honestly midway through.
 * - `STALE_AFTER_MS`: age in ms after which a price is considered stale
 *   (75 minutes). The gold-price-fetch workflow runs **hourly** at minute :02
 *   (`'2 * * * 1-4'` etc., see `.github/workflows/gold-price-fetch.yml`), so
 *   a 75-minute threshold tolerates one missed cron tick before the badge
 *   flips to "stale". This must match upstream cadence — never claim "Live"
 *   for data that is older than the refresh interval.
 *
 * If you change the cron cadence, update these thresholds in lock-step and
 * keep `docs/realtime-baseline-audit.md` in sync. The truth invariant is:
 *   DELAYED_AFTER_MS < STALE_AFTER_MS <= upstream cron interval + tolerance
 */
export const GOLD_MARKET = {
  OPEN_SUN_MINUTES: 22 * 60,
  CLOSE_FRI_MINUTES: 21 * 60,
  DELAYED_AFTER_MS: 30 * 60 * 1000,
  STALE_AFTER_MS: 75 * 60 * 1000,
};

/**
 * FX-freshness constants.
 *
 * `open.er-api.com` free tier updates FX rates approximately once per 24 hours.
 * A rate older than `FX_STALE_AFTER_MS` (26 hours — one full day plus a margin)
 * is considered stale and should be visibly labelled as a cached value.
 */
export const FX_MARKET = {
  FX_STALE_AFTER_MS: 26 * 60 * 60 * 1000,
};

/** Sentinel ageMs value for an unavailable / unresolvable timestamp. */
const UNAVAILABLE_AGE_MS = Number.POSITIVE_INFINITY;

function toDate(value) {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return value;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Determine whether the global gold market (LBMA / London Fix schedule) is
 * currently open. The market is closed from 21:00 UTC Friday to 22:00 UTC Sunday.
 *
 * @param {Date} [now=new Date()]  Reference timestamp (defaults to current time).
 * @returns {{ isOpen: boolean, key: 'open'|'closed' }}
 */
export function getMarketStatus(now = new Date()) {
  const date = toDate(now) || new Date();
  const utcDay = date.getUTCDay();
  const utcMinutes = date.getUTCHours() * 60 + date.getUTCMinutes();

  const isOpen = !(
    utcDay === 6 ||
    (utcDay === 5 && utcMinutes >= GOLD_MARKET.CLOSE_FRI_MINUTES) ||
    (utcDay === 0 && utcMinutes < GOLD_MARKET.OPEN_SUN_MINUTES)
  );

  return { isOpen, key: isOpen ? 'open' : 'closed' };
}

/**
 * Return the age of `updatedAt` in milliseconds relative to `now`.
 * Returns `Number.POSITIVE_INFINITY` when `updatedAt` is absent or invalid.
 *
 * @param {string|Date|number|null} updatedAt  Timestamp of the last update.
 * @param {number}                 [now]       Reference epoch ms (default: `Date.now()`).
 * @returns {number}
 */
export function getAgeMs(updatedAt, now = Date.now()) {
  const date = toDate(updatedAt);
  if (!date) return UNAVAILABLE_AGE_MS;
  return Math.max(0, now - date.getTime());
}

/**
 * Format `ageMs` as a human-readable relative-time string using
 * `Intl.RelativeTimeFormat` (e.g. `"2 min. ago"`, `"منذ دقيقتين"`).
 * Returns `'—'` for non-finite values.
 *
 * @param {number}      ageMs  Age in milliseconds (must be ≥ 0).
 * @param {'en'|'ar'} [lang]   Display language (default `'en'`).
 * @returns {string}
 */
export function formatRelativeAge(ageMs, lang = 'en') {
  if (!Number.isFinite(ageMs)) return '—';

  const locale = lang === 'ar' ? 'ar-AE' : 'en';
  const formatter = new Intl.RelativeTimeFormat(locale, {
    numeric: 'auto',
    style: 'short',
  });

  const totalSeconds = Math.max(0, Math.round(ageMs / 1000));
  if (totalSeconds < 60) return formatter.format(-totalSeconds, 'second');

  const totalMinutes = Math.round(totalSeconds / 60);
  if (totalMinutes < 60) return formatter.format(-totalMinutes, 'minute');

  const totalHours = Math.round(totalMinutes / 60);
  if (totalHours < 24) return formatter.format(-totalHours, 'hour');

  const totalDays = Math.round(totalHours / 24);
  return formatter.format(-totalDays, 'day');
}

/**
 * Derive the freshness key and human-readable age text for a price timestamp.
 *
 * Freshness keys (anti-mislabel ordering — hard guards first, then age):
 * - `'unavailable'` — `updatedAt` is absent or unparseable.
 * - `'fallback'`    — upstream marked this snapshot as a provider fallback
 *                     (`isFallback === true`). Highest-priority truth signal;
 *                     overrides age. The upstream pipeline already detected
 *                     that the live provider call failed; we must never
 *                     repaint this as "Live" no matter how recent the file
 *                     write timestamp is.
 * - `'stale'`       — age > `staleAfterMs` (default 75 min). Anything older
 *                     than the upstream refresh window is no longer trustworthy.
 * - `'cached'`      — local live fetch failed and we are serving from cache,
 *                     but the cached value is still within the freshness window.
 * - `'delayed'`     — age > `delayedAfterMs` (default 30 min) but ≤ stale.
 *                     Still trustworthy, but no longer "Live". UI must visibly
 *                     reflect the delay so users see source/freshness honestly.
 * - `'live'`        — age ≤ `delayedAfterMs`, upstream marked fresh, no local
 *                     fetch failure. The only state where "Live" may be shown.
 *
 * The function is the single sanctioned source of truth for the
 * `live | delayed | cached | stale | fallback | unavailable` vocabulary used
 * across hero, tracker, footer ticker, country pages, and footer ticker.
 * Do not branch on raw `ageMs` outside this module — call it instead so the
 * anti-mislabel guards stay centralized.
 *
 * @param {{
 *   updatedAt?: string|Date|number|null,
 *   lang?: 'en'|'ar',
 *   hasLiveFailure?: boolean,
 *   isFallback?: boolean|null,
 *   isFresh?: boolean|null,
 *   delayedAfterMs?: number,
 *   staleAfterMs?: number,
 * }} [options]
 * @returns {{
 *   key: 'live'|'delayed'|'cached'|'stale'|'fallback'|'unavailable',
 *   ageMs: number,
 *   ageText: string,
 *   timeText: string,
 *   updatedAt: string|Date|number|null,
 *   reason: string,
 * }}
 */
export function getLiveFreshness({
  updatedAt,
  lang = 'en',
  hasLiveFailure = false,
  isFallback = null,
  isFresh = null,
  delayedAfterMs = GOLD_MARKET.DELAYED_AFTER_MS,
  staleAfterMs = GOLD_MARKET.STALE_AFTER_MS,
} = {}) {
  if (!updatedAt) {
    return {
      key: 'unavailable',
      ageMs: UNAVAILABLE_AGE_MS,
      ageText: '—',
      timeText: '—',
      updatedAt: null,
      reason: 'missing-timestamp',
    };
  }

  const ageMs = getAgeMs(updatedAt);
  const ageText = formatRelativeAge(ageMs, lang);
  const timeText = formatTimestampShort(updatedAt, lang);

  // Hard anti-mislabel guard 1: upstream pipeline already flagged this
  // snapshot as a provider fallback. Never paint as Live regardless of age.
  if (isFallback === true) {
    return { key: 'fallback', ageMs, ageText, timeText, updatedAt, reason: 'upstream-fallback' };
  }

  // Hard anti-mislabel guard 2: upstream explicitly says stale.
  if (isFresh === false) {
    return { key: 'stale', ageMs, ageText, timeText, updatedAt, reason: 'upstream-stale' };
  }

  // Age-based classification.
  if (ageMs > staleAfterMs) {
    return { key: 'stale', ageMs, ageText, timeText, updatedAt, reason: 'age-exceeds-stale' };
  }

  if (hasLiveFailure) {
    return { key: 'cached', ageMs, ageText, timeText, updatedAt, reason: 'local-fetch-failed' };
  }

  if (ageMs > delayedAfterMs) {
    return { key: 'delayed', ageMs, ageText, timeText, updatedAt, reason: 'age-exceeds-delayed' };
  }

  return { key: 'live', ageMs, ageText, timeText, updatedAt, reason: 'fresh' };
}

/**
 * Derive the freshness key for FX exchange rates.
 *
 * `open.er-api.com` free-tier rates update approximately once per 24 hours.
 * When rates come from a local cache and are older than `FX_STALE_AFTER_MS`
 * (26 hours), the returned key is `'stale'` so callers can show a visible
 * label (AGENTS.md §6.2 — cached values must be labelled).
 *
 * @param {{ fxUpdatedAt?: string|Date|number|null, hasCacheFailure?: boolean, lang?: 'en'|'ar', staleAfterMs?: number }} [options]
 * @returns {{ key: 'live'|'cached'|'stale'|'unavailable', ageMs: number, ageText: string, timeText: string }}
 */
export function getFXFreshness({
  fxUpdatedAt,
  hasCacheFailure = false,
  lang = 'en',
  staleAfterMs = FX_MARKET.FX_STALE_AFTER_MS,
} = {}) {
  if (!fxUpdatedAt) {
    return {
      key: 'unavailable',
      ageMs: UNAVAILABLE_AGE_MS,
      ageText: '—',
      timeText: '—',
    };
  }

  const ageMs = getAgeMs(fxUpdatedAt);
  const key = ageMs > staleAfterMs ? 'stale' : hasCacheFailure ? 'cached' : 'live';

  return {
    key,
    ageMs,
    ageText: formatRelativeAge(ageMs, lang),
    timeText: formatTimestampShort(fxUpdatedAt, lang),
  };
}
