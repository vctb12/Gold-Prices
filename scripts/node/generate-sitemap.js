#!/usr/bin/env node
/**
 * scripts/generate-sitemap.js
 * Auto-generates sitemap.xml from the filesystem.
 *
 * Walks all .html files and index.html dirs, assigns priority/changefreq
 * based on depth, adds <lastmod> from file mtime, and writes sitemap.xml.
 *
 * Usage:  node scripts/generate-sitemap.js [--base <url>]
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const BASE_URL = (() => {
  const i = process.argv.indexOf('--base');
  return i >= 0 ? process.argv[i + 1] : 'https://goldtickerlive.com';
})();

// Directories/pages to exclude from the sitemap
const EXCLUDE = new Set([
  'offline.html',
  'dist',
  'node_modules',
  '.git',
  'server',
  'tests',
  'docs',
  'supabase',
  'build',
  'scripts',
  'src',
  'config',
  'data',
  'assets',
]);

// ── Walk filesystem ──────────────────────────────────────────────────────────
function isNoindex(filePath) {
  try {
    const head = fs.readFileSync(filePath, 'utf8');
    return /<meta\s+name=["']robots["']\s+content=["'][^"']*noindex/i.test(head);
  } catch {
    return false;
  }
}

function walk(dir, base = '', results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${entry.name}` : entry.name;
    if (EXCLUDE.has(entry.name) || entry.name.startsWith('.')) continue;

    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      // Duplicate country hub — canonical is /countries/{slug}/ not /gold-price/
      if (entry.name === 'gold-price' && base.startsWith('countries/')) {
        continue;
      }
      const idx = path.join(full, 'index.html');
      if (fs.existsSync(idx) && !isNoindex(idx)) {
        results.push({ urlPath: rel + '/', file: idx });
      }
      walk(full, rel, results);
    } else if (entry.name.endsWith('.html') && entry.name !== 'index.html') {
      if (!EXCLUDE.has(entry.name) && !isNoindex(full)) {
        results.push({ urlPath: rel, file: full });
      }
    }
  }
  return results;
}

// ── Priority heuristic ───────────────────────────────────────────────────────
function getPriority(urlPath) {
  const depth = urlPath.split('/').filter(Boolean).length;
  if (depth === 0 || urlPath === '') return '1.0';
  if (depth === 1) return '0.9';
  if (depth === 2) return '0.8';
  if (depth === 3) return '0.7';
  return '0.6';
}

function getChangefreq(urlPath) {
  if (urlPath.includes('gold-price') || urlPath.includes('gold-rate') || urlPath === '')
    return 'daily';
  if (urlPath.includes('countries') || urlPath.includes('cities') || urlPath.includes('markets'))
    return 'daily';
  if (urlPath.includes('tracker') || urlPath === 'tracker.html') return 'always';
  if (urlPath.includes('learn') || urlPath.includes('guides') || urlPath.includes('methodology'))
    return 'monthly';
  return 'weekly';
}

function formatDate(ms) {
  return new Date(ms).toISOString().split('T')[0];
}

// ── Build entries ────────────────────────────────────────────────────────────
const pages = walk(ROOT);

// Always add root
const rootEntry = { urlPath: '', file: path.join(ROOT, 'index.html') };

const allEntries = [rootEntry, ...pages].sort((a, b) => {
  const da = a.urlPath.split('/').filter(Boolean).length;
  const db = b.urlPath.split('/').filter(Boolean).length;
  return da - db || a.urlPath.localeCompare(b.urlPath);
});

// ── Generate XML ─────────────────────────────────────────────────────────────
const urls = allEntries
  .map(({ urlPath, file }) => {
    const loc = urlPath ? `${BASE_URL}/${urlPath}` : `${BASE_URL}/`;
    const stat = fs.statSync(file);
    const lastmod = formatDate(stat.mtimeMs);
    const priority = getPriority(urlPath);
    const changefreq = getChangefreq(urlPath);

    // Add hreflang alternates for all pages
    const enUrl = loc;
    const arUrl = loc.includes('?') ? loc + '&lang=ar' : loc + '?lang=ar';

    return `  <url>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
    <xhtml:link rel="alternate" hreflang="x-default" href="${enUrl}"/>
    <xhtml:link rel="alternate" hreflang="en" href="${enUrl}"/>
    <xhtml:link rel="alternate" hreflang="ar" href="${arUrl}"/>
  </url>`;
  })
  .join('\n\n');

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">

${urls}

</urlset>
`;

const outPath = path.join(ROOT, 'sitemap.xml');
fs.writeFileSync(outPath, xml, 'utf8');
console.log(`✅  Generated sitemap.xml with ${allEntries.length} URLs → ${outPath}`);
