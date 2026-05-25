'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  detectPriceBearingPage,
  hasFreshnessInfrastructure,
  scanFreshnessMetadata,
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

test('scanFreshnessMetadata reports only price pages missing freshness infrastructure', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gtl-freshness-'));

  try {
    fs.mkdirSync(path.join(tmp, 'content'), { recursive: true });
    fs.mkdirSync(path.join(tmp, 'dist'), { recursive: true });
    fs.writeFileSync(
      path.join(tmp, 'index.html'),
      '<div id="hlc-price" data-testid="gold-price"></div><div id="home-freshness-badge-slot"></div>'
    );
    fs.writeFileSync(
      path.join(tmp, 'content', 'missing.html'),
      '<main><div id="karat-cards"></div></main>'
    );
    fs.writeFileSync(path.join(tmp, 'content', 'plain.html'), '<main><h1>Learn</h1></main>');
    fs.writeFileSync(
      path.join(tmp, 'dist', 'ignored.html'),
      '<div id="price-display"></div>'
    );

    assert.deepEqual(scanFreshnessMetadata(tmp), ['content/missing.html']);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
