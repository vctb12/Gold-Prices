#!/usr/bin/env node
/**
 * Audit all public HTML under /content/ for launch-readiness metadata and UX hooks.
 *
 * Usage:
 *   node scripts/node/audit-content-pages.js
 *   node scripts/node/audit-content-pages.js --fail-on-error
 *
 * Exit 1 when --fail-on-error and any required check fails.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const CONTENT_DIR = path.join(ROOT, 'content');
const FAIL = process.argv.includes('--fail-on-error');
const MIN_WORDS = 150;

const EXEMPT_PREFIXES = ['content/embed/', 'content/subscription/'];
const EXEMPT_FILES = new Set(['content/markets/index.html']);
/** Interactive app shells — word count is in JS, not static HTML */
const THIN_WORD_EXEMPT = new Set(['content/search/index.html', 'content/gold-price-history/index.html']);

const REQUIRED_CHECKS = [
  { id: 'canonical', re: /<link[^>]+rel=["']canonical["']/i },
  { id: 'og:title', re: /property=["']og:title["']/i },
  { id: 'og:description', re: /property=["']og:description["']/i },
  { id: 'og:url', re: /property=["']og:url["']/i },
  { id: 'og:image', re: /property=["']og:image["']/i },
  { id: 'twitter:card', re: /name=["']twitter:card["']/i },
  { id: 'breadcrumb-schema', re: /"@type":\s*"BreadcrumbList"/ },
  {
    id: 'webpage-schema',
    re: /"@type":\s*"(?:WebPage|Article|Product|Dataset|FAQPage)"/,
  },
  { id: 'shell', re: /injectNav|bootContentPage|mountSharedShell/ },
  { id: 'skip-link', re: /class=["']skip-link["']/ },
  { id: 'main-landmark', re: /<main[^>]+id=["']main-content["']/i },
  { id: 'related-guides', re: /related-guides-slot|mountRelatedGuides/ },
  { id: 'page-enter', re: /bootContentPage|initPageEnter|page-enter/ },
  {
    id: 'stylesheet',
    re: /guide-page\.css|content-landing\.css|content-tools\.css|pages\/calculator\.css/,
  },
];

function walkHtml(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkHtml(full, acc);
    else if (entry.name.endsWith('.html')) acc.push(full);
  }
  return acc;
}

function countWords(html) {
  const text = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script[^>]*>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text ? text.split(' ').length : 0;
}

function isExempt(rel) {
  if (EXEMPT_FILES.has(rel)) return true;
  return EXEMPT_PREFIXES.some((p) => rel.startsWith(p));
}

function isNoindex(html) {
  return /name=["']robots["'][^>]*noindex/i.test(html);
}

function main() {
  const files = walkHtml(CONTENT_DIR)
    .map((f) => path.relative(ROOT, f).replace(/\\/g, '/'))
    .filter((rel) => !isExempt(rel))
    .sort();

  const failures = [];
  const thin = [];

  for (const rel of files) {
    const html = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    const words = countWords(html);
    const noindex = isNoindex(html);

    if (!noindex && words < MIN_WORDS && !THIN_WORD_EXEMPT.has(rel)) {
      thin.push({ rel, words });
    }

    if (noindex) continue;

    for (const check of REQUIRED_CHECKS) {
      if (!check.re.test(html)) {
        failures.push({ rel, check: check.id, words });
      }
    }

    const canon = (html.match(/rel=["']canonical["'][^>]*href=["']([^"']+)["']/i) || [])[1];
    const ogUrl = (html.match(/property=["']og:url["'][^>]*content=["']([^"']+)["']/i) || [])[1];
    if (canon && ogUrl && canon !== ogUrl) {
      failures.push({ rel, check: 'canonical-og-url-match', words });
    }
  }

  console.log(`[audit-content-pages] Scanned ${files.length} content HTML files`);

  if (thin.length) {
    console.warn(`\n⚠️  Thin pages (<${MIN_WORDS} words, not noindex): ${thin.length}`);
    for (const t of thin.slice(0, 10)) {
      console.warn(`   ${t.rel} (${t.words} words)`);
    }
    if (thin.length > 10) console.warn(`   … and ${thin.length - 10} more`);
  }

  if (failures.length === 0) {
    console.log('✅ All required content-page checks passed.');
    process.exit(0);
  }

  const byFile = new Map();
  for (const f of failures) {
    if (!byFile.has(f.rel)) byFile.set(f.rel, []);
    byFile.get(f.rel).push(f.check);
  }

  console.error(`\n❌ ${byFile.size} file(s) failed checks:\n`);
  for (const [rel, checks] of [...byFile.entries()].sort()) {
    console.error(`  ${rel}`);
    for (const c of checks) console.error(`    ✗ ${c}`);
  }

  if (FAIL) process.exit(1);
  process.exit(0);
}

main();
