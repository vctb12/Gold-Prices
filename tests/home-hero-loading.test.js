'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

test('home hero ships a single live price card without duplicate karat grid', () => {
  assert.match(HTML, /id="hero-live-card"/);
  assert.doesNotMatch(HTML, /id="hlc-aed24"/);
  assert.match(HTML, /id="hlc-karat-teaser-link"/);
});

test('home does not ship duplicate command card or market snapshot blocks', () => {
  assert.doesNotMatch(HTML, /id="home-command-card"/);
  assert.doesNotMatch(HTML, /id="home-market-snapshot-title"/);
});

test('home tools section exposes quick actions rail', () => {
  assert.match(HTML, /class="home-tools"/);
  assert.match(HTML, /id="home-action-rail"/);
  assert.match(HTML, /id="home-quick-convert-mount"/);
});

test('home hero freshness uses skeleton strip until hydrated', () => {
  assert.match(
    HTML,
    /id="hlc-updated"[\s\S]*shell-skeleton-freshness-strip/
  );
  assert.doesNotMatch(HTML, /id="hlc-updated"[^>]*>Loading/);
});
