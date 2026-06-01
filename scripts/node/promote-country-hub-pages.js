#!/usr/bin/env node
/**
 * Promote hydrator country pages from /gold-price/ to canonical /countries/{slug}/ hub.
 * Fixes noindex meta-refresh stubs (iraq, pakistan, …).
 *
 * Run: node scripts/node/promote-country-hub-pages.js
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const SITE_URL = 'https://goldtickerlive.com';

const REDIRECT_STUBS = ['iraq', 'pakistan', 'palestine', 'syria', 'turkey', 'yemen'];

function promote(slug) {
  const src = path.join(ROOT, 'countries', slug, 'gold-price', 'index.html');
  const dest = path.join(ROOT, 'countries', slug, 'index.html');
  if (!fs.existsSync(src)) {
    console.warn(`skip ${slug}: no gold-price/index.html`);
    return;
  }

  let html = fs.readFileSync(src, 'utf8');
  const canonical = `${SITE_URL}/countries/${slug}/`;

  // One fewer directory level for assets and modules.
  html = html.replace(/\.\.\/\.\.\/\.\.\//g, '../../');
  html = html.replace(/\.\.\/\.\.\/src\//g, '../../src/');
  html = html.replace(/\.\.\/\.\.\/styles\//g, '../../styles/');
  html = html.replace(/\.\.\/\.\.\/assets\//g, '../../assets/');

  html = html.replace(/<meta\s+name=["']robots["'][^>]*>\s*/i, '');
  html = html.replace(
    /<link\s+rel=["']canonical["'][^>]*>/i,
    `<link rel="canonical" href="${canonical}" />`
  );
  html = html.replace(
    /<meta\s+property=["']og:url["'][^>]*>/i,
    `<meta property="og:url" content="${canonical}" />`
  );

  fs.writeFileSync(dest, html, 'utf8');
  console.log(`promoted ${slug} hub ← gold-price`);
}

for (const slug of REDIRECT_STUBS) promote(slug);
