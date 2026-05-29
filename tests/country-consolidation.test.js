'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

test('per-karat city pages were removed from countries/', () => {
  const hits = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (/-karat$/.test(entry.name)) hits.push(full);
        else walk(full);
      }
    }
  };
  walk(path.join(ROOT, 'countries'));
  assert.deepEqual(hits, [], `Unexpected per-karat dirs: ${hits.join(', ')}`);
});

test('city gold-prices directories were removed', () => {
  const hits = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'gold-prices') hits.push(full);
        else walk(full);
      }
    }
  };
  walk(path.join(ROOT, 'countries'));
  assert.deepEqual(hits, [], `Unexpected gold-prices dirs: ${hits.join(', ')}`);
});

test('city gold-rate hubs are hydrated and indexable', () => {
  const sample = path.join(ROOT, 'countries/uae/dubai/gold-rate/index.html');
  assert.ok(fs.existsSync(sample), 'sample gold-rate hub should exist');
  const html = fs.readFileSync(sample, 'utf8');
  assert.match(html, /page-hydrator\.js/);
  assert.doesNotMatch(html, /noindex/i, 'gold-rate hub should be indexable');
  assert.match(html, /gold-rate\//);
});
