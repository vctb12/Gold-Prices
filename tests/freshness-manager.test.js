'use strict';

/**
 * Freshness Manager — comprehensive edge case tests.
 *
 * Tests the FreshnessManager concept: given a timestamp and source,
 * determine the correct freshness label, CSS class, and icon.
 *
 * These tests validate the business logic independently of the DOM.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

// ── FreshnessManager implementation (standalone, mirrors production logic) ───
// This is the spec for the FreshnessManager class described in the problem statement.
// It can be used as the reference implementation or test harness.

const FRESHNESS_THRESHOLDS = {
  LIVE_MAX_AGE_MS: 60 * 1000, // 60 seconds
  STALE_THRESHOLD_MS: 15 * 60 * 1000, // 15 minutes
  VERY_STALE_THRESHOLD_MS: 60 * 60 * 1000, // 60 minutes
};

class FreshnessManager {
  constructor() {
    this._fetchedAt = null;
    this._source = '';
    this._isCached = false;
    this._isFallback = false;
  }

  update({ fetchedAt, source, isCached = false, isFallback = false }) {
    if (fetchedAt == null) {
      this._fetchedAt = null;
    } else {
      this._fetchedAt = fetchedAt instanceof Date ? fetchedAt : new Date(fetchedAt);
      if (!Number.isFinite(this._fetchedAt.getTime())) {
        this._fetchedAt = null;
      }
    }
    this._source = source || 'unknown';
    this._isCached = isCached;
    this._isFallback = isFallback;
  }

  getLabel(now = new Date()) {
    if (this._isFallback) {
      return {
        label: 'Fallback',
        labelAr: 'بديل احتياطي',
        class: 'price-cached',
        icon: '⚪',
        tone: 'fallback',
      };
    }

    if (this._isCached) {
      return {
        label: 'Cached',
        labelAr: 'محفوظ مؤقتاً',
        class: 'price-cached',
        icon: '⚪',
        tone: 'cached',
      };
    }

    if (!this._fetchedAt || !Number.isFinite(this._fetchedAt.getTime())) {
      return {
        label: 'Unavailable',
        labelAr: 'غير متاح',
        class: 'price-very-stale',
        icon: '🔴',
        tone: 'unavailable',
      };
    }

    const ageMs = now.getTime() - this._fetchedAt.getTime();

    if (ageMs < 0) {
      // Future timestamp — treat as live (clock skew)
      return {
        label: 'Live',
        labelAr: 'مباشر',
        class: 'price-fresh',
        icon: '🟢',
        tone: 'live',
      };
    }

    if (ageMs <= FRESHNESS_THRESHOLDS.LIVE_MAX_AGE_MS) {
      return {
        label: 'Live',
        labelAr: 'مباشر',
        class: 'price-fresh',
        icon: '🟢',
        tone: 'live',
      };
    }

    if (ageMs <= FRESHNESS_THRESHOLDS.STALE_THRESHOLD_MS) {
      const mins = Math.floor(ageMs / 60000);
      return {
        label: `${mins} min ago`,
        labelAr: `منذ ${mins} دقيقة`,
        class: 'price-fresh',
        icon: '🟢',
        tone: 'recent',
      };
    }

    if (ageMs <= FRESHNESS_THRESHOLDS.VERY_STALE_THRESHOLD_MS) {
      const mins = Math.floor(ageMs / 60000);
      return {
        label: `${mins} min ago`,
        labelAr: `منذ ${mins} دقيقة`,
        class: 'price-stale',
        icon: '🟡',
        tone: 'stale',
      };
    }

    // Very stale (> 60 min)
    const hours = Math.floor(ageMs / 3600000);
    return {
      label: hours > 0 ? `${hours}h+ ago` : 'Very stale',
      labelAr: hours > 0 ? `منذ ${hours}+ ساعة` : 'قديم جداً',
      class: 'price-very-stale',
      icon: '🔴',
      tone: 'very-stale',
    };
  }

  getRelativeAge(now = new Date()) {
    if (!this._fetchedAt) return null;
    return Math.max(0, now.getTime() - this._fetchedAt.getTime());
  }

  get source() {
    return this._source;
  }

  get isStale() {
    if (!this._fetchedAt) return true;
    const age = Date.now() - this._fetchedAt.getTime();
    return age > FRESHNESS_THRESHOLDS.STALE_THRESHOLD_MS;
  }

  get isCached() {
    return this._isCached;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEST SUITE
// ═══════════════════════════════════════════════════════════════════════════════

describe('FreshnessManager — label generation', () => {
  test('returns Live for data < 60s old', () => {
    const fm = new FreshnessManager();
    const now = new Date('2026-05-25T12:00:00Z');
    fm.update({ fetchedAt: new Date('2026-05-25T11:59:30Z'), source: 'goldpricez' });
    const label = fm.getLabel(now);
    assert.equal(label.label, 'Live');
    assert.equal(label.class, 'price-fresh');
    assert.equal(label.icon, '🟢');
    assert.equal(label.tone, 'live');
  });

  test('returns "X min ago" for data 1-15 min old (still fresh)', () => {
    const fm = new FreshnessManager();
    const now = new Date('2026-05-25T12:05:00Z');
    fm.update({ fetchedAt: new Date('2026-05-25T12:00:00Z'), source: 'goldpricez' });
    const label = fm.getLabel(now);
    assert.equal(label.label, '5 min ago');
    assert.equal(label.class, 'price-fresh');
    assert.equal(label.tone, 'recent');
  });

  test('returns stale (yellow) for data 15-60 min old', () => {
    const fm = new FreshnessManager();
    const now = new Date('2026-05-25T12:20:00Z');
    fm.update({ fetchedAt: new Date('2026-05-25T12:00:00Z'), source: 'goldpricez' });
    const label = fm.getLabel(now);
    assert.equal(label.class, 'price-stale');
    assert.equal(label.icon, '🟡');
    assert.equal(label.tone, 'stale');
    assert.match(label.label, /20 min ago/);
  });

  test('returns very stale (red) for data > 60 min old', () => {
    const fm = new FreshnessManager();
    const now = new Date('2026-05-25T14:00:00Z');
    fm.update({ fetchedAt: new Date('2026-05-25T12:00:00Z'), source: 'goldpricez' });
    const label = fm.getLabel(now);
    assert.equal(label.class, 'price-very-stale');
    assert.equal(label.icon, '🔴');
    assert.equal(label.tone, 'very-stale');
  });

  test('returns Cached when isCached=true regardless of age', () => {
    const fm = new FreshnessManager();
    const now = new Date('2026-05-25T12:00:05Z');
    fm.update({ fetchedAt: new Date('2026-05-25T12:00:00Z'), source: 'cache', isCached: true });
    const label = fm.getLabel(now);
    assert.equal(label.label, 'Cached');
    assert.equal(label.labelAr, 'محفوظ مؤقتاً');
    assert.equal(label.class, 'price-cached');
    assert.equal(label.tone, 'cached');
  });

  test('returns Fallback when isFallback=true', () => {
    const fm = new FreshnessManager();
    fm.update({ fetchedAt: new Date(), source: 'static', isFallback: true });
    const label = fm.getLabel();
    assert.equal(label.label, 'Fallback');
    assert.equal(label.labelAr, 'بديل احتياطي');
    assert.equal(label.tone, 'fallback');
  });

  test('returns Unavailable when fetchedAt is null', () => {
    const fm = new FreshnessManager();
    fm.update({ fetchedAt: null, source: '' });
    const label = fm.getLabel();
    assert.equal(label.label, 'Unavailable');
    assert.equal(label.tone, 'unavailable');
    assert.equal(label.icon, '🔴');
  });

  test('returns Unavailable for invalid date', () => {
    const fm = new FreshnessManager();
    fm.update({ fetchedAt: 'not-a-date', source: 'test' });
    const label = fm.getLabel();
    assert.equal(label.tone, 'unavailable');
  });

  test('handles future timestamp gracefully (clock skew)', () => {
    const fm = new FreshnessManager();
    const now = new Date('2026-05-25T12:00:00Z');
    fm.update({ fetchedAt: new Date('2026-05-25T12:05:00Z'), source: 'goldpricez' });
    const label = fm.getLabel(now);
    assert.equal(label.label, 'Live');
    assert.equal(label.tone, 'live');
  });
});

describe('FreshnessManager — Arabic labels', () => {
  test('Live in Arabic = مباشر', () => {
    const fm = new FreshnessManager();
    fm.update({ fetchedAt: new Date(), source: 'goldpricez' });
    const label = fm.getLabel(new Date());
    assert.equal(label.labelAr, 'مباشر');
  });

  test('Stale shows minutes in Arabic', () => {
    const fm = new FreshnessManager();
    const now = new Date('2026-05-25T12:30:00Z');
    fm.update({ fetchedAt: new Date('2026-05-25T12:00:00Z'), source: 'goldpricez' });
    const label = fm.getLabel(now);
    assert.match(label.labelAr, /منذ 30 دقيقة/);
  });

  test('Very stale shows hours in Arabic', () => {
    const fm = new FreshnessManager();
    const now = new Date('2026-05-25T15:00:00Z');
    fm.update({ fetchedAt: new Date('2026-05-25T12:00:00Z'), source: 'goldpricez' });
    const label = fm.getLabel(now);
    assert.match(label.labelAr, /منذ 3\+ ساعة/);
  });
});

describe('FreshnessManager — state properties', () => {
  test('isStale returns true for old data', () => {
    const fm = new FreshnessManager();
    fm.update({
      fetchedAt: new Date(Date.now() - 20 * 60 * 1000), // 20 min ago
      source: 'test',
    });
    assert.equal(fm.isStale, true);
  });

  test('isStale returns false for fresh data', () => {
    const fm = new FreshnessManager();
    fm.update({ fetchedAt: new Date(), source: 'test' });
    assert.equal(fm.isStale, false);
  });

  test('isStale returns true when no fetchedAt', () => {
    const fm = new FreshnessManager();
    assert.equal(fm.isStale, true);
  });

  test('source property returns set source', () => {
    const fm = new FreshnessManager();
    fm.update({ fetchedAt: new Date(), source: 'GoldPriceZ' });
    assert.equal(fm.source, 'GoldPriceZ');
  });

  test('getRelativeAge returns correct ms', () => {
    const fm = new FreshnessManager();
    const fetchedAt = new Date('2026-05-25T12:00:00Z');
    const now = new Date('2026-05-25T12:05:00Z');
    fm.update({ fetchedAt, source: 'test' });
    assert.equal(fm.getRelativeAge(now), 5 * 60 * 1000);
  });

  test('getRelativeAge returns null when no fetchedAt', () => {
    const fm = new FreshnessManager();
    assert.equal(fm.getRelativeAge(), null);
  });
});

describe('FreshnessManager — threshold boundaries', () => {
  test('exactly 60s = still live', () => {
    const fm = new FreshnessManager();
    const now = new Date('2026-05-25T12:01:00Z');
    fm.update({ fetchedAt: new Date('2026-05-25T12:00:00Z'), source: 'test' });
    const label = fm.getLabel(now);
    assert.equal(label.tone, 'live');
  });

  test('61s = recent (no longer live)', () => {
    const fm = new FreshnessManager();
    const now = new Date('2026-05-25T12:01:01Z');
    fm.update({ fetchedAt: new Date('2026-05-25T12:00:00Z'), source: 'test' });
    const label = fm.getLabel(now);
    assert.equal(label.tone, 'recent');
  });

  test('exactly 15 min = still recent/fresh', () => {
    const fm = new FreshnessManager();
    const now = new Date('2026-05-25T12:15:00Z');
    fm.update({ fetchedAt: new Date('2026-05-25T12:00:00Z'), source: 'test' });
    const label = fm.getLabel(now);
    assert.equal(label.class, 'price-fresh');
  });

  test('15 min + 1s = stale', () => {
    const fm = new FreshnessManager();
    const fetchedAt = new Date('2026-05-25T12:00:00Z');
    const now = new Date(fetchedAt.getTime() + 15 * 60 * 1000 + 1);
    fm.update({ fetchedAt, source: 'test' });
    const label = fm.getLabel(now);
    assert.equal(label.class, 'price-stale');
  });

  test('exactly 60 min = still stale (not very stale)', () => {
    const fm = new FreshnessManager();
    const fetchedAt = new Date('2026-05-25T12:00:00Z');
    const now = new Date(fetchedAt.getTime() + 60 * 60 * 1000);
    fm.update({ fetchedAt, source: 'test' });
    const label = fm.getLabel(now);
    assert.equal(label.class, 'price-stale');
  });

  test('60 min + 1s = very stale', () => {
    const fm = new FreshnessManager();
    const fetchedAt = new Date('2026-05-25T12:00:00Z');
    const now = new Date(fetchedAt.getTime() + 60 * 60 * 1000 + 1);
    fm.update({ fetchedAt, source: 'test' });
    const label = fm.getLabel(now);
    assert.equal(label.class, 'price-very-stale');
  });
});

describe('FreshnessManager — priority ordering', () => {
  test('isFallback takes precedence over age', () => {
    const fm = new FreshnessManager();
    fm.update({ fetchedAt: new Date(), source: 'fallback', isFallback: true });
    const label = fm.getLabel();
    assert.equal(label.tone, 'fallback');
  });

  test('isCached takes precedence over freshness', () => {
    const fm = new FreshnessManager();
    fm.update({ fetchedAt: new Date(), source: 'cache', isCached: true });
    const label = fm.getLabel();
    assert.equal(label.tone, 'cached');
  });

  test('isFallback takes precedence over isCached', () => {
    const fm = new FreshnessManager();
    fm.update({ fetchedAt: new Date(), source: 'x', isCached: true, isFallback: true });
    const label = fm.getLabel();
    assert.equal(label.tone, 'fallback');
  });
});
