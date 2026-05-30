#!/usr/bin/env node
/**
 * Verify every URL in sw.js PRECACHE_URLS resolves to an existing file at build root.
 *
 * Usage:
 *   node scripts/node/check-sw-precache.js
 *   node scripts/node/check-sw-precache.js --fail-on-error
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const SW_PATH = path.join(ROOT, 'sw.js');
const FAIL = process.argv.includes('--fail-on-error');

function extractPrecacheUrls(swSource) {
  const match = swSource.match(/const\s+PRECACHE_URLS\s*=\s*\[([\s\S]*?)\];/);
  if (!match) throw new Error('Could not find PRECACHE_URLS in sw.js');
  const urls = [];
  const re = /['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(match[1]))) urls.push(m[1]);
  return urls;
}

function urlToFile(url) {
  if (!url.startsWith('/')) return null;
  let p = url.slice(1);
  if (p === '') return path.join(ROOT, 'index.html');
  if (p.endsWith('/')) p += 'index.html';
  if (!path.extname(p)) {
    const asHtml = path.join(ROOT, `${p}.html`);
    if (fs.existsSync(asHtml)) return asHtml;
    const asIndex = path.join(ROOT, p, 'index.html');
    if (fs.existsSync(asIndex)) return asIndex;
  }
  return path.join(ROOT, p);
}

function main() {
  const sw = fs.readFileSync(SW_PATH, 'utf8');
  const urls = extractPrecacheUrls(sw);
  const missing = [];

  for (const url of urls) {
    const file = urlToFile(url);
    if (!file || !fs.existsSync(file)) {
      missing.push({ url, file: file ? path.relative(ROOT, file) : '(unmapped)' });
    }
  }

  console.log(`[check-sw-precache] ${urls.length} precache entries in sw.js`);

  if (missing.length === 0) {
    console.log('✅ All precache URLs resolve to files on disk.');
    process.exit(0);
  }

  console.error(`❌ ${missing.length} precache URL(s) missing on disk:\n`);
  for (const { url, file } of missing) {
    console.error(`  ${url} → ${file}`);
  }

  if (FAIL) process.exit(1);
  process.exit(0);
}

main();
