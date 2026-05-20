'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('e2e-live-freshness fixture exists for optional Playwright coverage', () => {
  const target = path.resolve(__dirname, '..', 'index.html');
  assert.equal(fs.existsSync(target), true);
});
