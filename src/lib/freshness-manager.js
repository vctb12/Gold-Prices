/**
 * src/lib/freshness-manager.js — Standalone Freshness Manager class.
 *
 * Tracks the freshness state of price data and produces labels, CSS classes,
 * icons, and Arabic translations for display in price cards and UI components.
 *
 * This module complements the existing freshness.js (which handles state
 * normalization and translation keys) by providing a class-based API that
 * tracks timing and produces display-ready labels with auto-updating support.
 *
 * Usage:
 *   import { FreshnessManager, FRESHNESS_THRESHOLDS } from './freshness-manager.js';
 *   const fm = new FreshnessManager();
 *   fm.update({ fetchedAt: new Date(), source: 'goldpricez' });
 *   const label = fm.getLabel(); // { label, labelAr, class, icon, tone }
 */

// ── Thresholds ───────────────────────────────────────────────────────────────
export const FRESHNESS_THRESHOLDS = {
  LIVE_MAX_AGE_MS: 60 * 1000, // 60 seconds
  STALE_THRESHOLD_MS: 15 * 60 * 1000, // 15 minutes
  VERY_STALE_THRESHOLD_MS: 60 * 60 * 1000, // 60 minutes
};

// ── CSS class map (can be applied to price cards) ────────────────────────────
export const FRESHNESS_CLASSES = {
  fresh: 'price-fresh',
  stale: 'price-stale',
  veryStale: 'price-very-stale',
  cached: 'price-cached',
};

/**
 * FreshnessManager — tracks fetched-at timestamp and produces display labels.
 *
 * Each price surface (hero card, karat strip, table cell, etc.) should have
 * its own FreshnessManager instance or share one per data source.
 */
export class FreshnessManager {
  constructor() {
    this._fetchedAt = null;
    this._source = '';
    this._isCached = false;
    this._isFallback = false;
  }

  /**
   * Update the freshness state after a successful (or failed) fetch.
   *
   * @param {Object} opts
   * @param {Date|string|null} opts.fetchedAt  — when the data was fetched
   * @param {string}           opts.source     — data source name (e.g. 'goldpricez')
   * @param {boolean}          opts.isCached   — true if served from cache
   * @param {boolean}          opts.isFallback — true if from static fallback
   */
  update({ fetchedAt, source, isCached = false, isFallback = false }) {
    if (fetchedAt == null) {
      this._fetchedAt = null;
    } else {
      this._fetchedAt = fetchedAt instanceof Date ? fetchedAt : new Date(fetchedAt);
      // Treat invalid dates as null
      if (!Number.isFinite(this._fetchedAt.getTime())) {
        this._fetchedAt = null;
      }
    }
    this._source = source || 'unknown';
    this._isCached = isCached;
    this._isFallback = isFallback;
  }

  /**
   * Get the current freshness label for display.
   *
   * @param {Date} [now] — current time (injectable for testing)
   * @returns {{ label: string, labelAr: string, class: string, icon: string, tone: string }}
   */
  getLabel(now = new Date()) {
    // Priority 1: Fallback
    if (this._isFallback) {
      return {
        label: 'Fallback',
        labelAr: 'بديل احتياطي',
        class: FRESHNESS_CLASSES.cached,
        icon: '⚪',
        tone: 'fallback',
      };
    }

    // Priority 2: Cached
    if (this._isCached) {
      return {
        label: 'Cached',
        labelAr: 'محفوظ مؤقتاً',
        class: FRESHNESS_CLASSES.cached,
        icon: '⚪',
        tone: 'cached',
      };
    }

    // Priority 3: No valid timestamp
    if (!this._fetchedAt || !Number.isFinite(this._fetchedAt.getTime())) {
      return {
        label: 'Unavailable',
        labelAr: 'غير متاح',
        class: FRESHNESS_CLASSES.veryStale,
        icon: '🔴',
        tone: 'unavailable',
      };
    }

    const ageMs = now.getTime() - this._fetchedAt.getTime();

    // Future timestamp (clock skew) — treat as live
    if (ageMs < 0) {
      return {
        label: 'Live',
        labelAr: 'مباشر',
        class: FRESHNESS_CLASSES.fresh,
        icon: '🟢',
        tone: 'live',
      };
    }

    // Live (< 60s)
    if (ageMs <= FRESHNESS_THRESHOLDS.LIVE_MAX_AGE_MS) {
      return {
        label: 'Live',
        labelAr: 'مباشر',
        class: FRESHNESS_CLASSES.fresh,
        icon: '🟢',
        tone: 'live',
      };
    }

    // Recent (1-15 min) — still green but shows age
    if (ageMs <= FRESHNESS_THRESHOLDS.STALE_THRESHOLD_MS) {
      const mins = Math.floor(ageMs / 60000);
      return {
        label: `${mins} min ago`,
        labelAr: `منذ ${mins} دقيقة`,
        class: FRESHNESS_CLASSES.fresh,
        icon: '🟢',
        tone: 'recent',
      };
    }

    // Stale (15-60 min) — yellow warning
    if (ageMs <= FRESHNESS_THRESHOLDS.VERY_STALE_THRESHOLD_MS) {
      const mins = Math.floor(ageMs / 60000);
      return {
        label: `${mins} min ago`,
        labelAr: `منذ ${mins} دقيقة`,
        class: FRESHNESS_CLASSES.stale,
        icon: '🟡',
        tone: 'stale',
      };
    }

    // Very stale (> 60 min) — red warning
    const hours = Math.floor(ageMs / 3600000);
    return {
      label: hours > 0 ? `${hours}h+ ago` : 'Very stale',
      labelAr: hours > 0 ? `منذ ${hours}+ ساعة` : 'قديم جداً',
      class: FRESHNESS_CLASSES.veryStale,
      icon: '🔴',
      tone: 'very-stale',
    };
  }

  /**
   * Get the age of the data in milliseconds.
   * @param {Date} [now]
   * @returns {number|null}
   */
  getRelativeAge(now = new Date()) {
    if (!this._fetchedAt) return null;
    return Math.max(0, now.getTime() - this._fetchedAt.getTime());
  }

  /** @returns {string} The data source name */
  get source() {
    return this._source;
  }

  /** @returns {boolean} True if data is older than stale threshold */
  get isStale() {
    if (!this._fetchedAt) return true;
    const age = Date.now() - this._fetchedAt.getTime();
    return age > FRESHNESS_THRESHOLDS.STALE_THRESHOLD_MS;
  }

  /** @returns {boolean} True if data is from cache */
  get isCached() {
    return this._isCached;
  }

  /** @returns {boolean} True if data is from fallback */
  get isFallback() {
    return this._isFallback;
  }

  /** @returns {Date|null} When the data was last fetched */
  get fetchedAt() {
    return this._fetchedAt;
  }
}
