#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const EXCLUDED_DIRS = new Set([
  '.git',
  'admin',
  'dist',
  'node_modules',
  'playwright-report',
  'reports',
  'server',
  'test-results',
]);

const PRICE_MARKERS = [
  /data-testid=["']gold-price["']/i,
  /\bkarat-strip\b/i,
  /id=["']hlc-price["']/i,
  /id=["']calc-spot-price["']/i,
  /id=["']tp-xauusd-value["']/i,
  /id=["']country-karat-cards["']/i,
  /id=["']country-price-table["']/i,
  /id=["']price-display["']/i,
  /id=["']karat-cards["']/i,
];

const FRESHNESS_ATTR_RE = /data-freshness-state\s*=/i;
const FRESHNESS_ID_RE = /\bid=["'][^"']*(?:freshness|(?:^|-)fresh(?:-|$))[^"']*["']/i;
const FRESHNESS_KNOWN_MOUNTS = [/id=["']country-status-list["']/i];

function collectHtmlFiles(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) continue;
      collectHtmlFiles(path.join(dir, entry.name), acc);
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.html')) acc.push(path.join(dir, entry.name));
  }
  return acc;
}

function detectPriceBearingPage(_filePath, html) {
  return PRICE_MARKERS.some((marker) => marker.test(html));
}

function hasFreshnessInfrastructure(html) {
  return (
    FRESHNESS_ATTR_RE.test(html) ||
    FRESHNESS_ID_RE.test(html) ||
    FRESHNESS_KNOWN_MOUNTS.some((marker) => marker.test(html))
  );
}

function scanFreshnessMetadata(rootDir = ROOT) {
  const htmlFiles = collectHtmlFiles(rootDir);
  const violations = [];

  for (const filePath of htmlFiles) {
    const html = fs.readFileSync(filePath, 'utf8');
    if (!detectPriceBearingPage(filePath, html)) continue;
    if (hasFreshnessInfrastructure(html)) continue;

    violations.push(path.relative(rootDir, filePath).split(path.sep).join('/'));
  }

  return violations.sort();
}

function main() {
  const violations = scanFreshnessMetadata(ROOT);
  if (!violations.length) {
    console.log('Freshness metadata check passed.');
    return;
  }

  console.error('Pages with price-bearing content but no freshness metadata or mount point:');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exitCode = 1;
}

if (require.main === module) main();

module.exports = {
  EXCLUDED_DIRS,
  PRICE_MARKERS,
  collectHtmlFiles,
  detectPriceBearingPage,
  hasFreshnessInfrastructure,
  scanFreshnessMetadata,
};
