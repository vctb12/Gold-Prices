#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const OUTPUT_REL = path.join('reports', 'seo', 'governance.json');
const OUTPUT_ABS = path.join(ROOT, OUTPUT_REL);

const CHECK_ONLY = process.argv.includes('--check');
const STRICT = process.argv.includes('--strict');
const STDOUT_ONLY = process.argv.includes('--stdout');
const THIN_CONTENT_THRESHOLD = 140;
const REQUIRED_NOINDEX_PATTERNS = [
  /^content\/tools\/investment-return\.html$/,
  /^content\/guides\/invest-in-gold-gcc\.html$/,
  /^content\/social\/.+\.html$/,
];

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'tests',
  'scripts',
  'server',
  'supabase',
  '.github',
  'docs',
  'build',
  'playwright-report',
  'test-results',
  'reports',
]);

function walkHtml(dir, base = '', out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue;
    const rel = base ? `${base}/${entry.name}` : entry.name;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) walkHtml(abs, rel, out);
    else if (entry.isFile() && entry.name.endsWith('.html')) out.push(rel);
  }
  return out;
}

function classifyGroup(relPath) {
  if (
    ['index.html', 'tracker.html', 'calculator.html', 'shops.html', 'pricing.html', 'learn.html']
      .concat(['insights.html', 'methodology.html', 'invest.html'])
      .includes(relPath)
  ) {
    return 'core';
  }
  if (relPath.startsWith('content/')) return 'content';
  if (relPath.startsWith('countries/')) {
    if (relPath.includes('/markets/')) return 'markets';
    if (/^countries\/[^/]+\/gold-price\/index\.html$/.test(relPath)) return 'countries';
    if (
      /^countries\/[^/]+\/[^/]+\/(gold-prices|gold-shops)\/index\.html$/.test(relPath) ||
      /^countries\/[^/]+\/[^/]+\/gold-rate\/[^/]+\/index\.html$/.test(relPath)
    ) {
      return 'cities';
    }
    return 'countries';
  }
  return 'core';
}

function stripTags(html = '') {
  return html
    .replace(/<script\b[\s\S]*?<\/script(?:\s[^>]*)?>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style(?:\s[^>]*)?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getHead(html) {
  return html.match(/<head[\s\S]*?<\/head>/i)?.[0] || '';
}

function getTitle(head) {
  return (
    head
      .match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]
      ?.replace(/\s+/g, ' ')
      .trim() || ''
  );
}

function getDescription(head) {
  return (
    head.match(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i)?.[1] || ''
  ).trim();
}

function getCanonical(head) {
  return head.match(/<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["']/i)?.[1] || '';
}

function getHreflangs(head) {
  return [...head.matchAll(/<link[^>]+rel=["']alternate["'][^>]*hreflang=["']([^"']+)["']/gi)].map(
    (m) => String(m[1]).toLowerCase()
  );
}

function getJsonLdCount(html) {
  return (html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>/gi) || []).length;
}

function getWordCount(html) {
  const text = stripTags(html);
  if (!text) return 0;
  return text.split(/\s+/).filter(Boolean).length;
}

function extractRecord(relPath) {
  const html = fs.readFileSync(path.join(ROOT, relPath), 'utf8');
  const head = getHead(html);
  const noindex = /<meta[^>]+name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(head);
  const hreflangs = getHreflangs(head);
  const hasSchema = getJsonLdCount(html) > 0;
  const title = getTitle(head);
  const description = getDescription(head);
  const canonical = getCanonical(head);
  const wordCount = getWordCount(html);

  return {
    path: relPath,
    group: classifyGroup(relPath),
    noindex,
    title,
    description,
    canonical,
    hreflangs,
    hasSchema,
    wordCount,
    thinRisk: !noindex && wordCount > 0 && wordCount < THIN_CONTENT_THRESHOLD,
    missingCanonical: !noindex && !canonical,
    missingHreflang:
      !noindex && !['x-default', 'en', 'ar'].every((lang) => hreflangs.includes(lang)),
    missingSchema: !noindex && !hasSchema,
  };
}

function buildDuplicateRisk(records) {
  const map = new Map();
  for (const record of records) {
    if (record.noindex) continue;
    const key = `${record.title.toLowerCase()}|${record.description.toLowerCase()}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(record.path);
  }
  return [...map.values()].filter((items) => items.length > 1).slice(0, 100);
}

function summarize(records) {
  const groups = { core: 0, countries: 0, cities: 0, markets: 0, content: 0 };
  for (const r of records) {
    if (groups[r.group] === undefined) groups[r.group] = 0;
    groups[r.group] += 1;
  }

  const missingCanonical = records.filter((r) => r.missingCanonical).map((r) => r.path);
  const missingHreflang = records.filter((r) => r.missingHreflang).map((r) => r.path);
  const missingSchema = records.filter((r) => r.missingSchema).map((r) => r.path);
  const thinRisk = records
    .filter((r) => r.thinRisk)
    .map((r) => ({ path: r.path, words: r.wordCount }));
  const requiredNoindexMissing = records
    .filter(
      (r) =>
        REQUIRED_NOINDEX_PATTERNS.some((pattern) => pattern.test(r.path)) && !r.noindex
    )
    .map((r) => r.path);
  const duplicateRisk = buildDuplicateRisk(records);

  return {
    groups,
    totals: {
      htmlPages: records.length,
      indexablePages: records.filter((r) => !r.noindex).length,
      thinRiskPages: thinRisk.length,
      duplicateRiskClusters: duplicateRisk.length,
      missingCanonical: missingCanonical.length,
      missingHreflang: missingHreflang.length,
      missingSchema: missingSchema.length,
      requiredNoindexViolations: requiredNoindexMissing.length,
    },
    risks: {
      thinRisk: thinRisk.slice(0, 200),
      duplicateRisk,
      missingCanonical: missingCanonical.slice(0, 200),
      missingHreflang: missingHreflang.slice(0, 200),
      missingSchema: missingSchema.slice(0, 200),
      requiredNoindexMissing: requiredNoindexMissing.slice(0, 400),
    },
  };
}

function buildReport() {
  const files = walkHtml(ROOT).sort();
  const records = files.map(extractRecord);
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    summary: summarize(records),
    records,
  };
}

function normalize(text) {
  return text.replace(/"generatedAt":\s*"[^"]+"/, '"generatedAt":"_"');
}

function main() {
  const report = buildReport();
  const text = JSON.stringify(report, null, 2) + '\n';

  if (STDOUT_ONLY) {
    process.stdout.write(text);
    return;
  }

  if (CHECK_ONLY) {
    if (!fs.existsSync(OUTPUT_ABS)) {
      const msg = `[seo-governance] ${OUTPUT_REL} is missing. Run \`node scripts/node/seo-governance.js\`.`;
      if (STRICT) {
        console.error(msg);
        process.exit(1);
      }
      console.warn(msg);
      return;
    }
    const current = fs.readFileSync(OUTPUT_ABS, 'utf8');
    if (normalize(current) !== normalize(text)) {
      const msg = `[seo-governance] ${OUTPUT_REL} is stale. Run \`node scripts/node/seo-governance.js\`.`;
      if (STRICT) {
        console.error(msg);
        process.exit(1);
      }
      console.warn(msg);
      return;
    }
    console.log(
      `[seo-governance] check ok (${report.summary.totals.htmlPages} pages, thinRisk=${report.summary.totals.thinRiskPages}, dupClusters=${report.summary.totals.duplicateRiskClusters})`
    );
    return;
  }

  fs.mkdirSync(path.dirname(OUTPUT_ABS), { recursive: true });
  fs.writeFileSync(OUTPUT_ABS, text, 'utf8');
  console.log(
    `[seo-governance] wrote ${OUTPUT_REL} (${report.summary.totals.htmlPages} pages across groups: core=${report.summary.groups.core}, countries=${report.summary.groups.countries}, cities=${report.summary.groups.cities}, markets=${report.summary.groups.markets}, content=${report.summary.groups.content})`
  );
}

module.exports = {
  classifyGroup,
  getWordCount,
  buildDuplicateRisk,
  REQUIRED_NOINDEX_PATTERNS,
  summarize,
  buildReport,
};

if (require.main === module) main();
