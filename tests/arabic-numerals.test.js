'use strict';

/**
 * Arabic numeral conversion tests.
 *
 * The site supports optional Arabic (Eastern Arabic) numeral display
 * (٠١٢٣٤٥٦٧٨٩) for prices in Arabic mode. These tests validate the
 * conversion utility.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

// ── Arabic numeral converter (matches production logic) ─────────────────────
const EASTERN_ARABIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
const _WESTERN_DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

/**
 * Convert Western (0-9) digits to Eastern Arabic (٠-٩).
 * Preserves all non-digit characters (commas, dots, currency symbols).
 */
function toArabicNumerals(str) {
  if (typeof str !== 'string') str = String(str);
  return str.replace(/[0-9]/g, (d) => EASTERN_ARABIC_DIGITS[parseInt(d, 10)]);
}

/**
 * Convert Eastern Arabic (٠-٩) digits back to Western (0-9).
 */
function toWesternNumerals(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/[٠-٩]/g, (d) => String(EASTERN_ARABIC_DIGITS.indexOf(d)));
}

/**
 * Format a number for Arabic display with the correct decimal separator.
 * Arabic typically uses ٫ (U+066B) as decimal separator.
 */
function formatArabicNumber(num, decimals = 2) {
  if (typeof num !== 'number' || !Number.isFinite(num)) return '—';
  const formatted = num.toFixed(decimals);
  const arabicNum = toArabicNumerals(formatted);
  // Replace Western decimal point with Arabic decimal separator
  return arabicNum.replace('.', '٫');
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEST SUITE
// ═══════════════════════════════════════════════════════════════════════════════

describe('Arabic numerals — toArabicNumerals', () => {
  test('converts all digits 0-9', () => {
    assert.equal(toArabicNumerals('0123456789'), '٠١٢٣٤٥٦٧٨٩');
  });

  test('preserves non-digit characters', () => {
    assert.equal(toArabicNumerals('AED 1,234.56'), 'AED ١,٢٣٤.٥٦');
  });

  test('handles empty string', () => {
    assert.equal(toArabicNumerals(''), '');
  });

  test('handles string with no digits', () => {
    assert.equal(toArabicNumerals('hello'), 'hello');
  });

  test('converts numeric input', () => {
    assert.equal(toArabicNumerals(42), '٤٢');
  });

  test('converts price format (285.50)', () => {
    assert.equal(toArabicNumerals('285.50'), '٢٨٥.٥٠');
  });

  test('converts large number (2,500.00)', () => {
    assert.equal(toArabicNumerals('2,500.00'), '٢,٥٠٠.٠٠');
  });

  test('handles negative numbers', () => {
    assert.equal(toArabicNumerals('-1.5%'), '-١.٥%');
  });
});

describe('Arabic numerals — toWesternNumerals', () => {
  test('converts all Eastern Arabic digits back', () => {
    assert.equal(toWesternNumerals('٠١٢٣٤٥٦٧٨٩'), '0123456789');
  });

  test('preserves non-Arabic-digit characters', () => {
    assert.equal(toWesternNumerals('AED ١,٢٣٤.٥٦'), 'AED 1,234.56');
  });

  test('handles empty string', () => {
    assert.equal(toWesternNumerals(''), '');
  });

  test('roundtrip: Western → Arabic → Western', () => {
    const original = '3,672.50';
    const arabic = toArabicNumerals(original);
    const western = toWesternNumerals(arabic);
    assert.equal(western, original);
  });

  test('handles non-string input', () => {
    assert.equal(toWesternNumerals(null), null);
    assert.equal(toWesternNumerals(undefined), undefined);
  });
});

describe('Arabic numerals — formatArabicNumber', () => {
  test('formats basic number', () => {
    assert.equal(formatArabicNumber(285.5, 2), '٢٨٥٫٥٠');
  });

  test('formats zero', () => {
    assert.equal(formatArabicNumber(0, 2), '٠٫٠٠');
  });

  test('formats large number', () => {
    assert.equal(formatArabicNumber(2500.75, 2), '٢٥٠٠٫٧٥');
  });

  test('respects decimal places parameter', () => {
    assert.equal(formatArabicNumber(10.1, 4), '١٠٫١٠٠٠');
  });

  test('handles NaN gracefully', () => {
    assert.equal(formatArabicNumber(NaN), '—');
  });

  test('handles Infinity gracefully', () => {
    assert.equal(formatArabicNumber(Infinity), '—');
  });

  test('handles negative numbers', () => {
    assert.equal(formatArabicNumber(-5.5, 2), '-٥٫٥٠');
  });
});

describe('Arabic numerals — individual digit mapping', () => {
  for (let i = 0; i <= 9; i++) {
    test(`digit ${i} maps to ${EASTERN_ARABIC_DIGITS[i]}`, () => {
      assert.equal(toArabicNumerals(String(i)), EASTERN_ARABIC_DIGITS[i]);
    });
  }
});

describe('Arabic numerals — price display scenarios', () => {
  test('24K gold price: 295.36 AED/g', () => {
    const price = '295.36';
    const arabic = toArabicNumerals(price);
    assert.equal(arabic, '٢٩٥.٣٦');
  });

  test('XAU/USD spot: $2,500.00', () => {
    const price = '$2,500.00';
    const arabic = toArabicNumerals(price);
    assert.equal(arabic, '$٢,٥٠٠.٠٠');
  });

  test('percentage change: +0.53%', () => {
    const change = '+0.53%';
    const arabic = toArabicNumerals(change);
    assert.equal(arabic, '+٠.٥٣%');
  });

  test('time display: 14:30', () => {
    const time = '14:30';
    const arabic = toArabicNumerals(time);
    assert.equal(arabic, '١٤:٣٠');
  });

  test('date display: 25/05/2026', () => {
    const date = '25/05/2026';
    const arabic = toArabicNumerals(date);
    assert.equal(arabic, '٢٥/٠٥/٢٠٢٦');
  });
});
