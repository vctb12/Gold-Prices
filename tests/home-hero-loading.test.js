'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

test('home hero command chips expose localized status landmark hook', () => {
  assert.match(
    HTML,
    /<div class="home-command-card__chips" id="home-command-status" aria-label="Live status chips">/,
    'expected #home-command-status container for localized aria-label updates'
  );
});

test('home command chips render with loading skeleton classes', () => {
  assert.match(
    HTML,
    /class="trust-chip skeleton-inline home-command-chip--loading"[\s\S]*id="home-command-freshness"/,
    'freshness chip should ship with loading skeleton class'
  );
  assert.match(
    HTML,
    /class="trust-chip skeleton-inline home-command-chip--loading"[\s\S]*id="home-command-spot-chip"/,
    'spot chip should ship with loading skeleton class'
  );
});

test('home command metric values ship with skeleton placeholders', () => {
  for (const id of [
    'home-command-24-value',
    'home-command-22-value',
    'home-command-21-value',
    'home-command-18-value',
  ]) {
    assert.match(
      HTML,
      new RegExp(
        `class="mobile-command-card__metric-value skeleton-inline shell-skeleton-karat home-command-metric-loading"[\\s\\S]*id="${id}"`
      ),
      `${id} should ship with metric skeleton classes`
    );
  }
});
