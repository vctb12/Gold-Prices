'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  detectPriceBearingPage,
  hasFreshnessInfrastructure,
} = require('../scripts/node/check-freshness-metadata.js');

test('detectPriceBearingPage finds primary price surfaces by known markers', () => {
  assert.equal(
    detectPriceBearingPage(
      '/repo/index.html',
      '<div id="hlc-price" data-testid="gold-price"></div><div id="home-freshness-badge-slot"></div>'
    ),
    true
  );
  assert.equal(
    detectPriceBearingPage('/repo/tracker.html', '<span id="tp-xauusd-value">—</span>'),
    true
  );
  assert.equal(detectPriceBearingPage('/repo/learn.html', '<main><h1>Learn</h1></main>'), false);
});

test('hasFreshnessInfrastructure accepts data attributes and freshness mount ids', () => {
  assert.equal(hasFreshnessInfrastructure('<div data-freshness-state="live"></div>'), true);
  assert.equal(hasFreshnessInfrastructure('<div id="calc-freshness-badge-slot"></div>'), true);
  assert.equal(hasFreshnessInfrastructure('<div id="country-status-list"></div>'), true);
  assert.equal(hasFreshnessInfrastructure('<div id="tracker-slot"></div>'), false);
});
