/**
 * Sitemap parity + canonical-origin invariants.
 *
 * The canonical sitemap generator is `scripts/node/generate-sitemap.js`,
 * invoked by `.github/workflows/deploy.yml`. It walks the filesystem and
 * emits a `<loc>` per indexable `.html` file.
 *
 * Invariants enforced:
 *   1. Generator runs cleanly and writes `sitemap.xml` at the repo root.
 *   2. Every `<loc>` uses the canonical origin (no `www.` / no `http://`).
 *   3. Core static pages that exist on disk are present in the sitemap.
 *   4. Every `<loc>` is unique (no duplicate entries).
 *   5. `offline.html` is excluded (per generator's EXCLUDE list).
 *   6. Every `countries/<slug>/index.html` that exists on disk has a `<loc>`.
 */

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const vm = require('node:vm');

const REPO_ROOT = path.join(__dirname, '..');
const SITEMAP_PATH = path.join(REPO_ROOT, 'sitemap.xml');
const GENERATOR = path.join(REPO_ROOT, 'scripts', 'node', 'generate-sitemap.js');
const CANONICAL_ORIGIN = 'https://goldtickerlive.com';

function loadCountries() {
  const raw = fs.readFileSync(path.join(REPO_ROOT, 'src/config/countries.js'), 'utf8');
  const match = raw.match(/export const COUNTRIES\s*=\s*(\[[\s\S]*?\]);/);
  if (!match) throw new Error('Could not parse COUNTRIES');
  return vm.runInNewContext(`(${match[1]})`, Object.create(null), { timeout: 2000 });
}

function ensureSitemap() {
  // Always regenerate so the test is deterministic and doesn't depend on
  // a possibly stale committed artifact.
  execFileSync(process.execPath, [GENERATOR], {
    cwd: REPO_ROOT,
    stdio: 'ignore',
  });
  return fs.readFileSync(SITEMAP_PATH, 'utf8');
}

function locs(xml) {
  return Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/g)).map((m) => m[1]);
}

test('generator produces sitemap.xml', () => {
  const xml = ensureSitemap();
  assert.ok(fs.existsSync(SITEMAP_PATH), 'sitemap.xml should exist after generator run');
  assert.match(xml, /<urlset\b/, 'sitemap.xml should contain <urlset>');
  assert.ok(locs(xml).length > 0, 'sitemap.xml should contain <loc> entries');
});

test('every <loc> uses canonical origin (no www, no http://)', () => {
  const xml = ensureSitemap();
  const all = locs(xml);
  const bad = all.filter(
    (u) => u.startsWith('http://') || /^https:\/\/www\.goldtickerlive\.com/.test(u)
  );
  assert.deepEqual(bad, [], 'Found non-canonical <loc>s: ' + bad.slice(0, 5).join(', '));
  const offOrigin = all.filter((u) => !u.startsWith(CANONICAL_ORIGIN + '/'));
  assert.deepEqual(
    offOrigin,
    [],
    'Every <loc> must start with canonical origin; offenders: ' + offOrigin.slice(0, 5).join(', ')
  );
});

test('core static pages are in the sitemap', () => {
  const xml = ensureSitemap();
  const all = new Set(locs(xml));
  const core = [
    '/',
    '/tracker.html',
    '/shops.html',
    '/calculator.html',
    '/learn.html',
    '/insights.html',
    '/methodology.html',
    '/invest.html',
  ];
  for (const p of core) {
    const expected = CANONICAL_ORIGIN + p;
    const filePath =
      p === '/' ? path.join(REPO_ROOT, 'index.html') : path.join(REPO_ROOT, p.replace(/^\//, ''));
    if (!fs.existsSync(filePath)) continue;
    assert.ok(
      all.has(expected),
      `Expected sitemap to include ${expected} (file exists at ${filePath})`
    );
  }
});

test('every <loc> is unique', () => {
  const xml = ensureSitemap();
  const all = locs(xml);
  const seen = new Set();
  const dups = [];
  for (const u of all) {
    if (seen.has(u)) dups.push(u);
    seen.add(u);
  }
  assert.deepEqual(dups, [], 'Duplicate <loc>s found: ' + dups.slice(0, 5).join(', '));
});

test('offline.html is excluded from sitemap', () => {
  const xml = ensureSitemap();
  const all = locs(xml);
  const offline = all.filter((u) => u.endsWith('/offline.html') || u.endsWith('/offline'));
  assert.deepEqual(offline, [], 'offline.html should not appear in sitemap');
});

test('every existing country page is present in the sitemap', () => {
  const xml = ensureSitemap();
  const all = new Set(locs(xml));
  const countries = loadCountries();
  let checked = 0;
  for (const c of countries) {
    if (!c.slug) continue;
    const idx = path.join(REPO_ROOT, 'countries', c.slug, 'index.html');
    if (!fs.existsSync(idx)) continue;
    checked++;
    // Country index is typically a noindex meta-refresh to `gold-price/`;
    // the generator correctly emits the gold-price page instead. Accept
    // either form so noindex country stubs don't trigger false failures.
    const slash = `${CANONICAL_ORIGIN}/countries/${c.slug}/`;
    const html = `${CANONICAL_ORIGIN}/countries/${c.slug}/index.html`;
    const goldPrice = `${CANONICAL_ORIGIN}/countries/${c.slug}/gold-price/`;
    assert.ok(
      all.has(slash) || all.has(html) || all.has(goldPrice),
      `Expected sitemap to include a loc for country "${c.slug}"`
    );
  }
  assert.ok(checked > 0, 'Expected to verify at least one country page');
});
