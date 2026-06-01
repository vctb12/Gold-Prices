#!/usr/bin/env node
/**
 * Canonicalize duplicate country URLs:
 *   /countries/{slug}/gold-price/ → /countries/{slug}/ (301 + noindex on duplicate)
 *
 * Run: node scripts/node/canonicalize-country-gold-price.js
 * Dry-run: node scripts/node/canonicalize-country-gold-price.js --dry-run
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const SITE_URL = 'https://goldtickerlive.com';
const dryRun = process.argv.includes('--dry-run');

let updated = 0;
let linksFixed = 0;

function patchGoldPricePage(filePath, countrySlug) {
  const canonical = `${SITE_URL}/countries/${countrySlug}/`;
  let html = fs.readFileSync(filePath, 'utf8');
  const before = html;

  html = html.replace(
    /<meta\s+name=["']robots["']\s+content=["'][^"']*["']\s*\/?>/i,
    '<meta name="robots" content="noindex,follow" />'
  );
  if (!/name=["']robots["']/i.test(html)) {
    html = html.replace(/<meta charset="UTF-8"\s*\/?>/i, (m) => `${m}\n    <meta name="robots" content="noindex,follow" />`);
  }

  html = html.replace(
    /<link\s+rel=["']canonical["'][^>]*>/i,
    `<link rel="canonical" href="${canonical}" />`
  );
  html = html.replace(
    /<meta\s+property=["']og:url["'][^>]*>/i,
    `<meta property="og:url" content="${canonical}" />`
  );

  const goldPricePath = `/countries/${countrySlug}/gold-price/`;
  const re = new RegExp(goldPricePath.replace(/\//g, '\\/'), 'g');
  const replaced = (html.match(re) || []).length;
  html = html.replace(re, `/countries/${countrySlug}/`);
  linksFixed += replaced;

  if (html !== before) {
    if (!dryRun) fs.writeFileSync(filePath, html, 'utf8');
    updated += 1;
    console.log(`${dryRun ? '[dry-run] ' : ''}patched ${path.relative(ROOT, filePath)}`);
  }
}

function walkCountries(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'gold-price') {
        const idx = path.join(full, 'index.html');
        if (fs.existsSync(idx)) {
          const countrySlug = path.basename(path.dirname(full));
          patchGoldPricePage(idx, countrySlug);
        }
      } else {
        walkCountries(full);
      }
    }
  }
}

walkCountries(path.join(ROOT, 'countries'));

// Fix internal links in stub pages and other HTML under countries/
function fixHtmlLinks(filePath) {
  let html = fs.readFileSync(filePath, 'utf8');
  const next = html.replace(/\/countries\/([a-z0-9-]+)\/gold-price\//g, '/countries/$1/');
  if (next !== html) {
    if (!dryRun) fs.writeFileSync(filePath, next, 'utf8');
    linksFixed += 1;
  }
}

function walkHtml(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkHtml(full);
    else if (entry.name.endsWith('.html')) fixHtmlLinks(full);
  }
}

walkHtml(path.join(ROOT, 'countries'));

console.log(
  `\n${dryRun ? '[dry-run] ' : ''}Done: gold-price pages=${updated}, link batches=${linksFixed}`
);
