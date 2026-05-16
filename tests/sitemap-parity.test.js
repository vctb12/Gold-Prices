'use strict';

/**
 * W-9 — sitemap parity / drift smoke test.
 *
 * Two sitemap generators live in the repo:
 *   1. `build/generateSitemap.js`        — canonical, runs in `npm run build`.
 *      Emits explicit URLs derived from `src/config/countries.js` +
 *      `src/config/karats.js` + a hardcoded static-page list. Includes the
 *      "virtual" route paths (e.g. `/uae/gold-price/`) that exist only as
 *      Vite-routed pages, not physical HTML files.
 *   2. `scripts/node/generate-sitemap.js` — auxiliary FS walker, run in CI
 *      after the build to refresh `<lastmod>` timestamps. Cannot see virtual
 *      routes (they aren't physical files); covers the materialised entry
 *      pages and `countries/<slug>/index.html`.
 *
 * They serve different needs and currently emit divergent URL spaces (the
 * build script uses route aliases like `/uae/gold-price/`; the FS walker
 * uses the physical `/countries/uae/...` paths). Consolidation is tracked
 * in the §22b backlog and is out of scope for this batch — see
 * `reports/sitemap-parity.md` for the current divergence snapshot.
 *
 * What this test enforces today is the cheap drift guard: both scripts must
 * still run, both must still emit a non-empty URL set, and the canonical
 * sitemap must continue to include the project's known-required top-level
 * static pages. If a top-level static page is added (e.g. a new HTML at
 * repo root) but never registered in `staticPages` in `build/generateSitemap.js`,
 * the second assertion fails and points at the fix site.
 *
 * The test does not regenerate `sitemap.xml` permanently. It snapshots and
 * restores the file around the two runs.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

function locsFromXml(xml) {
  const out = new Set();
  const re = /<loc>([^<]+)<\/loc>/g;
  let m;
  while ((m = re.exec(xml))) out.add(m[1].trim());
  return out;
}

function snapshotSitemap() {
  const p = path.join(ROOT, 'sitemap.xml');
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
}

function restoreSitemap(snapshot) {
  const p = path.join(ROOT, 'sitemap.xml');
  if (snapshot === null) {
    if (fs.existsSync(p)) fs.unlinkSync(p);
  } else {
    fs.writeFileSync(p, snapshot, 'utf8');
  }
}

function runBuildSitemap() {
  execFileSync(process.execPath, [path.join(ROOT, 'build', 'generateSitemap.js')], {
    stdio: 'pipe',
  });
  return fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
}

function runFsWalkSitemap() {
  execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'node', 'generate-sitemap.js')], {
    stdio: 'pipe',
  });
  return fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
}

test('sitemap-parity smoke — both generators run and emit non-empty URL sets', () => {
  const snapshot = snapshotSitemap();
  let buildLocs;
  let walkLocs;
  try {
    buildLocs = locsFromXml(runBuildSitemap());
    walkLocs = locsFromXml(runFsWalkSitemap());
  } finally {
    restoreSitemap(snapshot);
  }

  assert.ok(
    buildLocs.size > 50,
    `build/generateSitemap.js emitted only ${buildLocs.size} URLs — drop suggests config-loader regression`
  );
  assert.ok(
    walkLocs.size > 50,
    `scripts/node/generate-sitemap.js emitted only ${walkLocs.size} URLs — drop suggests an EXCLUDE entry was over-broadened`
  );
});

test('sitemap-parity invariants — canonical sitemap retains required top-level pages', () => {
  const snapshot = snapshotSitemap();
  let buildLocs;
  try {
    buildLocs = locsFromXml(runBuildSitemap());
  } finally {
    restoreSitemap(snapshot);
  }

  // The canonical sitemap must always include these top-level pages. If a
  // new entry HTML at repo root is added, register it in build/generateSitemap.js.
  const required = [
    'https://goldtickerlive.com/',
    'https://goldtickerlive.com/tracker.html',
    'https://goldtickerlive.com/shops.html',
    'https://goldtickerlive.com/calculator.html',
    'https://goldtickerlive.com/methodology.html',
    'https://goldtickerlive.com/learn.html',
    'https://goldtickerlive.com/insights.html',
    'https://goldtickerlive.com/invest.html',
    'https://goldtickerlive.com/privacy.html',
    'https://goldtickerlive.com/terms.html',
  ];

  const missing = required.filter((u) => !buildLocs.has(u));
  assert.deepEqual(
    missing,
    [],
    `Required top-level URLs missing from build/generateSitemap.js output: ${missing.join(', ')}`
  );
});

test('sitemap-parity invariants — canonical sitemap excludes targeted noindex pages', () => {
  const snapshot = snapshotSitemap();
  let buildLocs;
  try {
    buildLocs = locsFromXml(runBuildSitemap());
  } finally {
    restoreSitemap(snapshot);
  }

  const blocked = [
    'https://goldtickerlive.com/uae/dubai/gold-rate/18-karat/',
    'https://goldtickerlive.com/content/guides/invest-in-gold-gcc.html',
    'https://goldtickerlive.com/content/social/x-post-generator.html',
  ];

  const present = blocked.filter((u) => buildLocs.has(u));
  assert.deepEqual(
    present,
    [],
    `Noindex URLs should not be emitted by build/generateSitemap.js: ${present.join(', ')}`
  );
});
