'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SITE = 'https://goldtickerlive.com';

const PAIRS = [
  { slug: 'uae', countryCanonical: `${SITE}/countries/uae/` },
  { slug: 'saudi-arabia', countryCanonical: `${SITE}/countries/saudi-arabia/` },
  { slug: 'egypt', countryCanonical: `${SITE}/countries/egypt/` },
];

function readCanonical(filePath) {
  const html = fs.readFileSync(filePath, 'utf8');
  const m = html.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i);
  return m ? m[1] : null;
}

for (const { slug, countryCanonical } of PAIRS) {
  test(`${slug}: country hub canonical is /countries/${slug}/`, () => {
    const hub = path.join(ROOT, 'countries', slug, 'index.html');
    assert.ok(fs.existsSync(hub), 'country hub should exist');
    assert.equal(readCanonical(hub), countryCanonical);
  });

  test(`${slug}: gold-price duplicate canonical points at country hub`, () => {
    const dup = path.join(ROOT, 'countries', slug, 'gold-price', 'index.html');
    if (!fs.existsSync(dup)) return;
    assert.equal(readCanonical(dup), countryCanonical);
    const html = fs.readFileSync(dup, 'utf8');
    assert.match(html, /noindex/i, 'duplicate hub should be noindex');
  });
}

test('_redirects maps /countries/:country/gold-price/ to country hub', () => {
  const redirects = fs.readFileSync(path.join(ROOT, '_redirects'), 'utf8');
  assert.match(redirects, /\/countries\/:country\/gold-price\/\s+\/countries\/:country\/\s+301/);
});
