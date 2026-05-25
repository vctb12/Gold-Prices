'use strict';

/**
 * Price change direction detection tests.
 *
 * Validates the logic that determines whether a price has gone up, down,
 * or stayed neutral — used for directional arrows, color indicators, and
 * accessibility labels throughout the UI.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

// ── Price change direction logic ─────────────────────────────────────────────

/**
 * Determine the direction of a price change.
 * @param {number} current - Current price
 * @param {number} previous - Previous price (e.g., day open)
 * @param {number} [threshold=0.001] - Minimum change to be considered non-neutral (0.1%)
 * @returns {{ direction: 'up'|'down'|'neutral', change: number, changePct: number, icon: string, ariaLabel: string }}
 */
function detectPriceChange(current, previous, threshold = 0.001) {
  if (!current || !previous || previous === 0) {
    return {
      direction: 'neutral',
      change: 0,
      changePct: 0,
      icon: '–',
      ariaLabel: 'Price unchanged',
    };
  }

  const change = current - previous;
  const changePct = (change / previous) * 100;

  if (Math.abs(changePct / 100) < threshold) {
    return {
      direction: 'neutral',
      change: 0,
      changePct: 0,
      icon: '–',
      ariaLabel: 'Price unchanged',
    };
  }

  if (change > 0) {
    return {
      direction: 'up',
      change,
      changePct,
      icon: '▲',
      ariaLabel: `Price up ${Math.abs(changePct).toFixed(2)} percent`,
    };
  }

  return {
    direction: 'down',
    change,
    changePct,
    icon: '▼',
    ariaLabel: `Price down ${Math.abs(changePct).toFixed(2)} percent`,
  };
}

/**
 * Format a change value for display.
 */
function formatChange(changePct, lang = 'en') {
  if (changePct === 0) return lang === 'ar' ? 'بدون تغيير' : 'No change';
  const sign = changePct > 0 ? '+' : '';
  return `${sign}${changePct.toFixed(2)}%`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEST SUITE
// ═══════════════════════════════════════════════════════════════════════════════

describe('Price change direction — basic detection', () => {
  test('detects upward movement', () => {
    const result = detectPriceChange(2510, 2500);
    assert.equal(result.direction, 'up');
    assert.equal(result.icon, '▲');
    assert.ok(result.changePct > 0);
  });

  test('detects downward movement', () => {
    const result = detectPriceChange(2490, 2500);
    assert.equal(result.direction, 'down');
    assert.equal(result.icon, '▼');
    assert.ok(result.changePct < 0);
  });

  test('detects neutral (no change)', () => {
    const result = detectPriceChange(2500, 2500);
    assert.equal(result.direction, 'neutral');
    assert.equal(result.icon, '–');
    assert.equal(result.changePct, 0);
  });

  test('detects neutral for very small change within threshold', () => {
    // 0.01% change should be neutral at default 0.1% threshold
    const result = detectPriceChange(2500.25, 2500);
    assert.equal(result.direction, 'neutral');
  });
});

describe('Price change direction — percentage calculation', () => {
  test('1% increase', () => {
    const result = detectPriceChange(2525, 2500);
    assert.ok(Math.abs(result.changePct - 1.0) < 0.01);
  });

  test('1% decrease', () => {
    const result = detectPriceChange(2475, 2500);
    assert.ok(Math.abs(result.changePct - -1.0) < 0.01);
  });

  test('large increase (5%)', () => {
    const result = detectPriceChange(2625, 2500);
    assert.ok(Math.abs(result.changePct - 5.0) < 0.01);
  });

  test('change amount is correct', () => {
    const result = detectPriceChange(2510, 2500);
    assert.equal(result.change, 10);
  });

  test('negative change amount', () => {
    const result = detectPriceChange(2490, 2500);
    assert.equal(result.change, -10);
  });
});

describe('Price change direction — edge cases', () => {
  test('null current returns neutral', () => {
    const result = detectPriceChange(null, 2500);
    assert.equal(result.direction, 'neutral');
  });

  test('null previous returns neutral', () => {
    const result = detectPriceChange(2500, null);
    assert.equal(result.direction, 'neutral');
  });

  test('zero previous returns neutral (avoids division by zero)', () => {
    const result = detectPriceChange(2500, 0);
    assert.equal(result.direction, 'neutral');
  });

  test('both zero returns neutral', () => {
    const result = detectPriceChange(0, 0);
    assert.equal(result.direction, 'neutral');
  });

  test('very large price handles correctly', () => {
    const result = detectPriceChange(100000, 99000);
    assert.equal(result.direction, 'up');
    assert.ok(result.changePct > 1);
  });

  test('custom threshold — tighter sensitivity', () => {
    // 0.01% threshold: even small changes are detected
    const result = detectPriceChange(2500.5, 2500, 0.0001);
    assert.equal(result.direction, 'up');
  });

  test('custom threshold — looser sensitivity', () => {
    // 1% threshold: small changes are neutral
    const result = detectPriceChange(2510, 2500, 0.01);
    assert.equal(result.direction, 'neutral');
  });
});

describe('Price change direction — accessibility labels', () => {
  test('up label includes percentage', () => {
    const result = detectPriceChange(2525, 2500);
    assert.match(result.ariaLabel, /Price up \d+\.\d+ percent/);
  });

  test('down label includes percentage', () => {
    const result = detectPriceChange(2475, 2500);
    assert.match(result.ariaLabel, /Price down \d+\.\d+ percent/);
  });

  test('neutral label says unchanged', () => {
    const result = detectPriceChange(2500, 2500);
    assert.equal(result.ariaLabel, 'Price unchanged');
  });
});

describe('Price change direction — formatChange', () => {
  test('formats positive change', () => {
    assert.equal(formatChange(1.5), '+1.50%');
  });

  test('formats negative change', () => {
    assert.equal(formatChange(-0.75), '-0.75%');
  });

  test('formats zero change in English', () => {
    assert.equal(formatChange(0, 'en'), 'No change');
  });

  test('formats zero change in Arabic', () => {
    assert.equal(formatChange(0, 'ar'), 'بدون تغيير');
  });

  test('formats small fractional change', () => {
    assert.equal(formatChange(0.01), '+0.01%');
  });

  test('formats large change', () => {
    assert.equal(formatChange(10.5), '+10.50%');
  });
});
