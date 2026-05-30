#!/usr/bin/env node
/**
 * Batch-upgrade /content/ HTML pages: WebPage schema, related guides slot,
 * skip-link, main#main-content, standardized bootContentPage script.
 *
 * Usage: node scripts/node/patch-content-pages.js [--dry-run]
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const DRY = process.argv.includes('--dry-run');

const SKIP_PREFIXES = ['content/embed/', 'content/subscription/'];
const SKIP_FILES = new Set(['content/markets/index.html', 'content/guides/index.html']);

function walkHtml(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkHtml(full, acc);
    else if (entry.name.endsWith('.html')) acc.push(full);
  }
  return acc;
}

function relPath(fromFile, toPath) {
  const fromDir = path.dirname(fromFile);
  let rel = path.relative(fromDir, path.join(ROOT, toPath)).replace(/\\/g, '/');
  if (!rel.startsWith('.')) rel = `./${rel}`;
  return rel;
}

function inferDepth(rel) {
  const segments = rel.split('/').filter(Boolean);
  return Math.max(1, segments.length - 1);
}

function buildCrumbs(rel) {
  const depth = inferDepth(rel);
  const up = '../'.repeat(depth);
  const crumbs = [{ label: 'Home', url: up || './' }];

  if (rel.startsWith('content/guides/ar/')) {
    crumbs[0] = { label: 'الرئيسية', url: up || './' };
    crumbs.push({ label: 'الأدلة', url: `${up}content/guides/ar/` });
    const slug = rel.replace(/^content\/guides\/ar\//, '').replace(/\/index\.html$/, '');
    if (slug && slug !== 'index.html') {
      const title = slug
        .split('/')[0]
        .replace(/-/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
      crumbs.push({ label: title, url: '#' });
    }
    return crumbs;
  }

  if (rel.startsWith('content/guides/')) {
    crumbs.push({ label: 'Guides', url: `${up}content/guides/` });
    const slug = rel.replace(/^content\/guides\//, '').replace(/\.html$/, '').replace(/\/index$/, '');
    if (slug && slug !== 'index') {
      const title = slug
        .split('/').pop()
        .replace(/-/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
      crumbs.push({ label: title, url: '#' });
    }
    return crumbs;
  }

  if (rel.startsWith('content/tools/')) {
    crumbs.push({ label: 'Tools', url: `${up}content/tools/` });
    crumbs.push({ label: path.basename(rel, '.html').replace(/-/g, ' '), url: '#' });
    return crumbs;
  }

  const section = rel.split('/')[1];
  if (section) {
    crumbs.push({
      label: section.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      url: '#',
    });
  }
  return crumbs;
}

function webPageSchema(rel, html) {
  const canon =
    (html.match(/rel=["']canonical["'][^>]*href=["']([^"']+)["']/i) || [])[1] ||
    `https://goldtickerlive.com/${rel.replace(/index\.html$/, '').replace(/\.html$/, '')}`;
  const title = (html.match(/<title>([^<]+)<\/title>/i) || [])[1] || 'Gold Ticker Live';
  const desc =
    (html.match(/name=["']description["'][^>]*content=["']([^"']+)["']/i) || [])[1] || '';
  return `  <script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "WebPage",
  "name": ${JSON.stringify(title)},
  "description": ${JSON.stringify(desc)},
  "url": ${JSON.stringify(canon)},
  "inLanguage": "en",
  "isPartOf": {
    "@type": "WebSite",
    "name": "Gold Ticker Live",
    "url": "https://goldtickerlive.com/"
  }
}
  </script>`;
}

function patchHtml(rel, html) {
  let out = html;
  let changed = false;

  if (!/"@type":\s*"WebPage"/.test(out)) {
    const insertAfter = out.match(/<\/script>\s*<\/head>/i);
    if (insertAfter) {
      const schema = webPageSchema(rel, out);
      out = out.replace(/<\/head>/i, `${schema}\n  </head>`);
      changed = true;
    }
  }

  if (!/class=["']skip-link["']/.test(out)) {
    out = out.replace(/<body([^>]*)>/i, (m, attrs) => {
      changed = true;
      return `<body${attrs}>\n    <a class="skip-link" href="#main-content">Skip to main content</a>`;
    });
  }

  if (/<main(?![^>]*id=)/i.test(out)) {
    out = out.replace(/<main(\s[^>]*)?>/i, (m, attrs = '') => {
      changed = true;
      if (/id=/.test(attrs)) return m;
      return `<main id="main-content"${attrs}>`;
    });
  } else if (!/<main[^>]+id=["']main-content["']/i.test(out)) {
    out = out.replace(/<main([^>]*)>/i, (m, attrs) => {
      changed = true;
      return `<main id="main-content"${attrs}>`;
    });
  }

  if (!/related-guides-slot/.test(out)) {
    out = out.replace(/<\/main>/i, (m) => {
      changed = true;
      return '      <div id="related-guides-slot"></div>\n    </main>';
    });
  }

  if (!/rel=["']preconnect["'][^>]*gold-api/i.test(out)) {
    const preconnect =
      '    <link rel="preconnect" href="https://www.gold-api.com" crossorigin />\n' +
      '    <link rel="preconnect" href="https://open.er-api.com" crossorigin />\n';
    out = out.replace(/<meta charset="UTF-8"\s*\/?>/i, (m) => {
      changed = true;
      return `${m}\n${preconnect}`;
    });
  }

  const bootImport = relPath(rel, 'src/lib/content-page-boot.js');
  const depth = inferDepth(rel);
  const crumbs = buildCrumbs(rel);
  const crumbsJson = JSON.stringify(crumbs);
  const adMatch = out.match(/renderAdSlot\(['"]([^'"]+)['"]/);
  const adSlots = adMatch ? [adMatch[1]] : [];

  const newBoot = `<script type="module">
      import { bootContentPage } from '${bootImport}';
      bootContentPage({
        depth: ${depth},
        crumbs: ${crumbsJson},
        ${adSlots.length ? `adSlots: ${JSON.stringify(adSlots)},` : ''}
      });
    </script>`;

  if (/bootContentPage/.test(out)) {
    // already patched
  } else if (
    /fetchGold|runSearch|history-chart|searchEngine|Chart\.register/i.test(out)
  ) {
    // Pages with heavy inline app logic — shell-only patch below
    if (!/"@type":\s*"WebPage"/.test(out)) {
      /* WebPage already added above */
    }
  } else if (/<script type="module">[\s\S]*?<\/script>\s*<\/body>/i.test(out)) {
    out = out.replace(/<script type="module">[\s\S]*?<\/script>\s*(?=<\/body>)/i, newBoot);
    changed = true;
  } else if (/<\/main>/i.test(out)) {
    out = out.replace(/<\/body>/i, `${newBoot}\n  </body>`);
    changed = true;
  }

  return { out, changed };
}

function main() {
  const files = walkHtml(path.join(ROOT, 'content'))
    .map((f) => path.relative(ROOT, f).replace(/\\/g, '/'))
    .filter((rel) => !SKIP_PREFIXES.some((p) => rel.startsWith(p)) && !SKIP_FILES.has(rel));

  let patched = 0;
  for (const rel of files) {
    const full = path.join(ROOT, rel);
    const html = fs.readFileSync(full, 'utf8');
    const { out, changed } = patchHtml(rel, html);
    if (changed) {
      patched += 1;
      if (!DRY) fs.writeFileSync(full, out, 'utf8');
      console.log(`${DRY ? '[dry-run] ' : ''}patched ${rel}`);
    }
  }
  console.log(`\n${DRY ? 'Would patch' : 'Patched'} ${patched} / ${files.length} content pages.`);
}

main();
