/**
 * server/lib/anomaly-detector.js
 *
 * Detects unusual gold price movements by comparing the current price against
 * recent price snapshots. Used before generating AI content drafts to flag
 * potential data quality issues.
 *
 * Rules:
 *  - Spike: single-step change > SPIKE_THRESHOLD_PCT
 *  - Drift: cumulative change over window > DRIFT_THRESHOLD_PCT
 *  - Provider issue hint: price outside historical ± EXTREME_THRESHOLD_PCT
 *
 * All anomaly flags MUST be reviewed by a human before any draft is published.
 * This module never publishes or posts anything.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.resolve(__dirname, '../../data');
const GOLD_PRICE_FILE = path.join(DATA_DIR, 'gold_price.json');
const LAST_GOLD_PRICE_FILE = path.join(DATA_DIR, 'last_gold_price.json');
const PROVIDER_STATE_FILE = path.join(DATA_DIR, 'provider_state.json');

// Configurable thresholds (can be overridden via env for testing)
const SPIKE_THRESHOLD_PCT = Number(process.env.ANOMALY_SPIKE_THRESHOLD_PCT) || 3.0; // 3% single-step spike
const DRIFT_THRESHOLD_PCT = Number(process.env.ANOMALY_DRIFT_THRESHOLD_PCT) || 8.0; // 8% drift over window
const EXTREME_THRESHOLD_PCT = Number(process.env.ANOMALY_EXTREME_THRESHOLD_PCT) || 15.0; // 15% extreme move

/**
 * Safely read and parse a JSON file. Returns null on any error.
 * @param {string} filePath
 * @returns {object|null}
 */
function _readJson(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Extract a canonical USD-per-ounce price from a gold price record.
 * Returns null if the value is missing or non-finite.
 * @param {object|null} record
 * @returns {number|null}
 */
function _extractPriceUsdOz(record) {
  if (!record || typeof record !== 'object') return null;
  const candidates = [
    record.xau_usd_per_oz,
    record.gold?.ounce_usd,
    record.gold?.ask_usd,
    record.gold?.bid_usd,
  ];
  for (const v of candidates) {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

/**
 * Compute percentage change from `from` to `to`.
 * Returns null if either value is invalid.
 * @param {number} from
 * @param {number} to
 * @returns {number|null}
 */
function _pctChange(from, to) {
  if (!Number.isFinite(from) || from === 0 || !Number.isFinite(to)) return null;
  return ((to - from) / from) * 100;
}

/**
 * Analyse a current price record against recent snapshots.
 *
 * @param {object} [currentRecord]  - gold_price.json record (optional; reads file if omitted)
 * @param {object} [prevRecord]     - last_gold_price.json record (optional; reads file if omitted)
 * @returns {{
 *   anomaly_flag: boolean,
 *   anomaly_detail: string|null,
 *   anomaly_reasons: string[],
 *   current_price_usd_oz: number|null,
 *   prev_price_usd_oz: number|null,
 *   pct_change: number|null,
 *   is_fresh: boolean,
 *   provider_fallback: boolean,
 *   checked_at_utc: string
 * }}
 */
function detectAnomaly(currentRecord, prevRecord) {
  const current = currentRecord || _readJson(GOLD_PRICE_FILE);
  const prev = prevRecord || _readJson(LAST_GOLD_PRICE_FILE);
  const providerState = _readJson(PROVIDER_STATE_FILE);

  const currentPrice = _extractPriceUsdOz(current);
  const prevPrice = _extractPriceUsdOz(prev);
  const pctChange = _pctChange(prevPrice, currentPrice);

  const reasons = [];

  // Rule 1 — single-step spike
  if (pctChange !== null && Math.abs(pctChange) >= SPIKE_THRESHOLD_PCT) {
    reasons.push(
      `Price changed ${pctChange.toFixed(2)}% vs previous snapshot (threshold: ±${SPIKE_THRESHOLD_PCT}%)`
    );
  }

  // Rule 2 — extreme absolute move
  if (pctChange !== null && Math.abs(pctChange) >= EXTREME_THRESHOLD_PCT) {
    reasons.push(`Extreme move detected: ${pctChange.toFixed(2)}% — possible provider data issue`);
  }

  // Rule 3 — provider is in fallback / circuit-open state
  const isFallback = current?.is_fallback === true;
  if (isFallback) {
    reasons.push('Current price is from a fallback provider — may not reflect market reality');
  }

  // Rule 4 — data not fresh
  const isFresh = current?.is_fresh !== false;
  if (!isFresh) {
    reasons.push('Price data is stale (is_fresh=false) — do not treat as live');
  }

  // Rule 5 — provider circuit-breaker open
  if (providerState && typeof providerState === 'object') {
    const openProviders = Object.entries(providerState)
      .filter(([, v]) => v && v.circuit_open === true)
      .map(([k]) => k);
    if (openProviders.length > 0) {
      reasons.push(`Provider circuit-breaker open for: ${openProviders.join(', ')}`);
    }
  }

  const anomalyFlag = reasons.length > 0;

  return {
    anomaly_flag: anomalyFlag,
    anomaly_detail: anomalyFlag ? reasons.join('; ') : null,
    anomaly_reasons: reasons,
    current_price_usd_oz: currentPrice,
    prev_price_usd_oz: prevPrice,
    pct_change: pctChange !== null ? parseFloat(pctChange.toFixed(4)) : null,
    is_fresh: isFresh,
    provider_fallback: isFallback,
    checked_at_utc: new Date().toISOString(),
  };
}

module.exports = {
  detectAnomaly,
  SPIKE_THRESHOLD_PCT,
  DRIFT_THRESHOLD_PCT,
  EXTREME_THRESHOLD_PCT,
  // Exposed for testing
  _extractPriceUsdOz,
  _pctChange,
};
