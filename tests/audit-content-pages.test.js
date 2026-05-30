'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

test('audit-content-pages passes on repo content HTML', () => {
  const res = spawnSync('node', ['scripts/node/audit-content-pages.js', '--fail-on-error'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  assert.equal(res.status, 0, res.stderr || res.stdout);
});

test('check-sw-precache resolves all sw.js precache URLs', () => {
  const res = spawnSync('node', ['scripts/node/check-sw-precache.js', '--fail-on-error'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  assert.equal(res.status, 0, res.stderr || res.stdout);
});
