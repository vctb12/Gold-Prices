/**
 * Historical Gold Price Data
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ARCHITECTURE:
 *   Layer 1 — BASELINE  : Monthly averages 2019–present (embedded in code)
 *                          Source: LBMA monthly average data / public domain records
 *                          Granularity: monthly  |  Unit: USD/troy oz
 *   Layer 2 — CACHED    : Daily snapshots from localStorage (user's session history)
 *                          Granularity: daily  |  Coverage: up to 90 days back
 *   Layer 3 — LIVE      : Current session chart ticks (90s resolution)
 *                          Granularity: ~90s  |  Coverage: last ~5 days
 *
 * All layers use the same normalised record schema:
 *   { date: 'YYYY-MM' | 'YYYY-MM-DD', price, granularity, source, derived }
 *
 * LIMITATIONS:
 *   - Monthly baseline is embedded (not fetched), so it needs code update for new months.
 *   - Daily resolution for periods > 90 days requires a paid/licensed API.
 *   - We clearly label derived vs. baseline data in exports.
 *
 * TO ADD FUTURE DAILY DATA:
 *   1. Add a daily data fetcher (e.g. stooq, metals-api, gold-api historic)
 *   2. Call mergeHistoricalLayers() with the new daily array
 *   3. The export/archive views automatically pick it up via getUnifiedHistory()
 */

// ─────────────────────────────────────────────────────────────────────────────
// MONTHLY BASELINE — XAU/USD average per month
// Source: LBMA PM fix monthly averages (public domain)
// ─────────────────────────────────────────────────────────────────────────────

import MONTHLY_BASELINE from '../data/historical-baseline.json' with { type: 'json' };

// ─────────────────────────────────────────────────────────────────────────────
// SCHEMA HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalise a monthly baseline entry into a unified record.
 * @param {{ date: string, price: number }} entry
 * @returns {HistoryRecord}
 */
function baselineToRecord(entry) {
  const isEstimated = Boolean(entry.estimated);
  return {
    date: entry.date, // 'YYYY-MM'
    price: entry.price, // USD/troy oz
    granularity: 'monthly',
    source: isEstimated ? 'estimated' : 'LBMA-baseline',
    freshnessState: 'historical',
    derived: false,
  };
}

/**
 * Normalise a daily cached entry (from localStorage/STATE.history).
 * @param {{ date: string, price: number, timestamp: number }} entry
 * @returns {HistoryRecord}
 */
function cachedToRecord(entry) {
  return {
    date: entry.date, // 'YYYY-MM-DD'
    price: entry.price, // USD/troy oz
    granularity: 'daily',
    source: 'local-snapshot',
    freshnessState: 'cached',
    derived: false,
    timestamp: entry.timestamp,
  };
}

/**
 * Returns the first and last dates covered by the embedded baseline.
 * Useful for showing coverage labels in the UI without hardcoding dates.
 *
 * @returns {{ first: string, last: string, count: number }}
 */
export function getBaselineRange() {
  if (!MONTHLY_BASELINE.length) return { first: '', last: '', count: 0 };
  const sorted = [...MONTHLY_BASELINE].sort((a, b) => a.date.localeCompare(b.date));
  return {
    first: sorted[0].date,
    last: sorted[sorted.length - 1].date,
    count: sorted.length,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// UNIFIED HISTORY API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns a merged array of all available history records, sorted ascending.
 * Monthly baseline + daily cached snapshots, with cached taking precedence
 * when both cover the same month.
 *
 * @param {Array}  cachedDaily  — STATE.history (daily localStorage entries)
 * @returns {HistoryRecord[]}
 */
export function getUnifiedHistory(cachedDaily = []) {
  const baselineRecords = MONTHLY_BASELINE.map(baselineToRecord);
  const cachedRecords = cachedDaily.map(cachedToRecord);

  // Build a month-map so recent daily data supersedes old monthly entries
  const monthMap = {};
  for (const r of baselineRecords) {
    monthMap[r.date] = r; // monthly key e.g. '2025-03'
  }

  // Inject daily records — don't overwrite baseline months with future projections
  for (const r of cachedRecords) {
    const monthKey = r.date.slice(0, 7); // 'YYYY-MM' from 'YYYY-MM-DD'
    // Always add daily as its own entry (don't collapse to monthly)
    monthMap[r.date] = r;
    // If we now have real daily data for this month, mark the monthly aggregate
    // as superseded so chart prefers the daily granularity
    if (monthMap[monthKey] && monthMap[monthKey].granularity === 'monthly') {
      monthMap[monthKey].superseded = true;
    }
  }

  const allRecords = Object.values(monthMap)
    .filter((r) => !r.superseded)
    .sort((a, b) => a.date.localeCompare(b.date));

  return allRecords;
}

/**
 * Returns only monthly baseline records (no localStorage).
 * Safe to call even with no browser state.
 */
export function getBaselineHistory() {
  return MONTHLY_BASELINE.map(baselineToRecord);
}

/**
 * Returns records formatted for the Lightweight Charts library:
 *   [{ time: 'YYYY-MM-DD', value: price }, ...]
 *
 * Monthly records get mapped to the 1st of each month.
 */
export function toChartData(records) {
  return records.map((r) => ({
    time: r.date.length === 7 ? `${r.date}-01` : r.date,
    value: r.price,
  }));
}

function normalizeHistoryDate(value) {
  const date =
    value instanceof Date
      ? new Date(value.getTime())
      : typeof value === 'string' && /^\d{4}-\d{2}$/.test(value)
        ? new Date(`${value}-01T00:00:00Z`)
        : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function normalizeRecord(record) {
  const date = normalizeHistoryDate(record.date);
  const price = Number(record.price ?? record.spot);
  if (!date || !Number.isFinite(price) || price <= 0) return null;
  return {
    ...record,
    date,
    price,
    granularity: record.granularity || (String(record.date).length === 7 ? 'monthly' : 'daily'),
    source: record.source || 'derived',
  };
}

const RANGE_WINDOWS = {
  '24H': 1,
  '7D': 7,
  '30D': 30,
  '90D': 90,
  '1Y': 365,
  '3Y': 365 * 3,
  '5Y': 365 * 5,
};

/**
 * Filter records by a date range.
 * @param {HistoryRecord[]} records
 * @param {'1Y'|'3Y'|'5Y'|'ALL'|'90D'|'30D'} range
 */
export function filterByRange(records, range) {
  if (!range || range === 'ALL') return records;
  const days = RANGE_WINDOWS[range.toUpperCase()];
  if (!days) return records;
  const normalized = records.map(normalizeRecord).filter(Boolean);
  if (!normalized.length) return [];
  const latest = normalized[normalized.length - 1].date;
  const cutoff = new Date(latest.getTime() - days * 86400000);
  return normalized
    .filter((r) => r.date >= cutoff)
    .map((r) => ({
      ...r,
      date: r.date instanceof Date ? r.date.toISOString().slice(0, 10) : r.date,
    }));
}

export function filterByMonth(records, monthValue) {
  if (!monthValue) return records;
  const normalized = records.map(normalizeRecord).filter(Boolean);
  if (!normalized.length) return [];
  return normalized
    .filter((record) => record.date.toISOString().slice(0, 7) === monthValue)
    .map((record) => ({
      ...record,
      date: record.date.toISOString().slice(0, 10),
    }));
}

export function describeHistoryResolution(records = [], { hasLive = false } = {}) {
  if (!records.length && !hasLive) {
    return {
      key: 'unavailable',
      label: 'Unavailable',
      detail: 'No historical data is available for this selection.',
    };
  }

  const normalized = records.map(normalizeRecord).filter(Boolean);
  const granularities = new Set(normalized.map((record) => record.granularity));
  const sources = new Set(normalized.map((record) => String(record.source || '').toLowerCase()));
  const hasMonthly = granularities.has('monthly');
  const hasDaily = granularities.has('daily');
  const hasEstimated = [...sources].some((source) => source.includes('estimated'));
  const hasDerived = [...sources].some(
    (source) => source.includes('derived') || source.includes('baseline')
  );

  if (hasLive && !normalized.length) {
    return {
      key: 'live',
      label: 'Live snapshot',
      detail: 'The workspace currently has a live spot-linked snapshot only.',
    };
  }

  if (hasLive && hasDaily && !hasMonthly) {
    return {
      key: 'daily',
      label: 'Live + cached daily snapshots',
      detail: 'Short ranges combine the latest live snapshot with cached browser checkpoints.',
    };
  }

  if (hasDaily && !hasMonthly) {
    return {
      key: 'daily',
      label: 'Cached daily snapshots',
      detail: 'Daily history comes from browser snapshots captured while the tracker was used.',
    };
  }

  if (hasMonthly && !hasDaily) {
    return {
      key: hasEstimated ? 'estimated' : 'monthly',
      label: hasEstimated ? 'Estimated monthly baseline' : 'Monthly baseline',
      detail:
        'Long-range history uses monthly XAU/USD baseline records. It is not intraday or shop pricing.',
    };
  }

  return {
    key: hasDerived || hasEstimated ? 'derived' : 'mixed',
    label: hasEstimated ? 'Mixed live + estimated baseline' : 'Mixed live + monthly baseline',
    detail:
      'Recent browser snapshots are merged with the monthly baseline, so precision changes across the selected window.',
  };
}

export function buildHistorySummary(records = [], { range = 'ALL', liveRecord = null } = {}) {
  const normalized = records.map(normalizeRecord).filter(Boolean);
  const summaryRecords = [...normalized];
  const liveNormalized = liveRecord ? normalizeRecord(liveRecord) : null;
  if (liveNormalized) summaryRecords.push(liveNormalized);
  if (!summaryRecords.length) return null;

  summaryRecords.sort((a, b) => a.date - b.date);
  const start = summaryRecords[0];
  const end = summaryRecords[summaryRecords.length - 1];
  const prices = summaryRecords.map((record) => record.price);
  const highest = Math.max(...prices);
  const lowest = Math.min(...prices);
  const change = end.price - start.price;
  const pctChange = start.price ? (change / start.price) * 100 : 0;
  const resolution = describeHistoryResolution(normalized, { hasLive: Boolean(liveNormalized) });

  return {
    range,
    start,
    end,
    points: summaryRecords.length,
    absoluteChange: change,
    percentageChange: pctChange,
    highest,
    lowest,
    resolution,
  };
}

/**
 * Compute YoY % change for a given history array.
 */
export function computeYoYChange(records) {
  if (records.length < 2) return null;
  const latest = records[records.length - 1].price;
  // Find ~1 year ago entry
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const yearAgoStr = oneYearAgo.toISOString().slice(0, 7);
  const yearAgoEntry = [...records].reverse().find((r) => r.date.slice(0, 7) <= yearAgoStr);
  if (!yearAgoEntry) return null;
  return ((latest - yearAgoEntry.price) / yearAgoEntry.price) * 100;
}

/**
 * Get key stats from history:
 *   - allTimeHigh (from baseline + cached)
 *   - allTimeLow
 *   - ytdChange (%)
 *   - oneYearChange (%)
 */
export function getHistoryStats(records) {
  if (!records.length) return {};
  const prices = records.map((r) => r.price);
  const allTimeHigh = Math.max(...prices);
  const allTimeLow = Math.min(...prices);
  const latest = records[records.length - 1].price;

  // YTD: compare to start of this year
  const yearStart = `${new Date().getFullYear()}-01`;
  const ytdEntry = records.find((r) => r.date.slice(0, 7) === yearStart || r.date >= yearStart);
  const ytdChange = ytdEntry ? ((latest - ytdEntry.price) / ytdEntry.price) * 100 : null;

  const yoyChange = computeYoYChange(records);

  return { allTimeHigh, allTimeLow, latest, ytdChange, yoyChange };
}
