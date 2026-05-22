/**
 * Site-wide SEO / canonical / hreflang invariants across ALL public HTML.
 *
 * The existing `seo-metadata.test.js` locks metadata on 4 top pages. This
 * suite scales that to every HTML file on disk so drift in any generated
 * country/city/market page or any placeholder page is caught before it
 * reaches production.
 *
 * Invariants enforced here:
 *   1. Every indexable HTML page (not noindex, not meta-refresh redirect)
 *      has exactly one canonical, pointing at the single canonical origin
 *      `https://goldtickerlive.com` (no `www.`).
 *   2. Every indexable HTML page has x-default + en + ar hreflang tags.
 *   3. Every indexable HTML page has a non-empty title and meta description.
 *   4. No file still carries the old "auto-generated as a placeholder"
 *      marker — those must all have been enriched by
 *      `scripts/node/enrich-placeholder-pages.js`.
 *   5. Every placeholder-style stub left on disk (robots=noindex written by
 *      the enrichment script, OR a meta-refresh redirect stub) must carry
 *      valid canonical + title metadata; it just does not have to pass the
 *      hreflang/indexability rules.
 *   6. Every country slug listed in `src/config/countries.js` that has
 *      cities must have a `countries/<slug>/` index and a
 *      `countries/<slug>/<city>/` index for each city.
 *   7. No HTML file uses the wrong canonical origin (`www.goldtickerlive.com`
 *      or http://).
 */

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..');
const CANONICAL_ORIGIN = 'https://goldtickerlive.com';
const FORBIDDEN_ORIGINS = [
  'https://www.goldtickerlive.com',
  'http://goldtickerlive.com',
  'http://www.goldtickerlive.com',
];

function isCanonicalOriginUrl(candidate) {
  try {
    const u = new URL(candidate);
    return u.protocol === 'https:' && u.hostname === 'goldtickerlive.com';
  } catch {
    return false;
  }
}

// Directories that are never shipped as public pages.
const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'tests',
  'scripts',
  'server',
  'supabase',
  'repositories',
  '.github',
  'docs',
  'build',
]);

function findHtmlFiles(dir, base = '', out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    if (SKIP_DIRS.has(entry.name)) continue;
    const rel = base ? `${base}/${entry.name}` : entry.name;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) findHtmlFiles(full, rel, out);
    else if (entry.name.endsWith('.html')) out.push(rel);
  }
  return out;
}

function readHead(relFile) {
  const html = fs.readFileSync(path.join(REPO_ROOT, relFile), 'utf8');
  const m = html.match(/<head[\s\S]*?<\/head>/i);
  return { full: html, head: m ? m[0] : html };
}

function isNoindex(head) {
  const m = head.match(/<meta[^>]+name=["']robots["'][^>]*content=["']([^"']+)["']/i);
  return !!m && /noindex/i.test(m[1]);
}
function isMetaRefresh(head) {
  return /<meta[^>]+http-equiv=["']refresh["'][^>]*>/i.test(head);
}
function getCanonical(head) {
  const m = head.match(/<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["']/i);
  return m ? m[1] : null;
}
function getTitle(head) {
  const m = head.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? m[1].trim() : null;
}
function getDescription(head) {
  const m = head.match(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i);
  return m ? m[1] : null;
}
function getHreflangs(head) {
  const out = [];
  const re = /<link[^>]+rel=["']alternate["'][^>]*>/gi;
  let m;
  while ((m = re.exec(head))) {
    const h = m[0].match(/hreflang=["']([^"']+)["']/i);
    if (h) out.push(h[1].toLowerCase());
  }
  return out;
}

const ALL_FILES = findHtmlFiles(REPO_ROOT);
const PARSED = ALL_FILES.map((f) => {
  const { full, head } = readHead(f);
  return {
    file: f,
    full,
    head,
    noindex: isNoindex(head),
    refresh: isMetaRefresh(head),
    canonical: getCanonical(head),
    title: getTitle(head),
    desc: getDescription(head),
    hreflangs: getHreflangs(head),
  };
});

// --- #4: no stray placeholder marker ----------------------------------
test('no HTML file still contains the "auto-generated placeholder" marker', () => {
  const bad = PARSED.filter((p) => p.full.includes('auto-generated as a placeholder')).map(
    (p) => p.file
  );
  assert.deepEqual(
    bad,
    [],
    `These files still contain the placeholder marker; run \`node scripts/node/enrich-placeholder-pages.js\`:\n  ${bad.join('\n  ')}`
  );
});

// --- #7: no wrong-origin absolute URL in head ------------------------
test('no HTML head uses www.goldtickerlive.com or http:// origins', () => {
  const bad = [];
  for (const p of PARSED) {
    for (const origin of FORBIDDEN_ORIGINS) {
      if (p.head.includes(origin)) {
        bad.push(`${p.file} — contains "${origin}" in <head>`);
        break;
      }
    }
  }
  assert.deepEqual(bad, [], `Wrong-origin URLs found in head:\n  ${bad.join('\n  ')}`);
});

// --- #5: every "noindex,follow" stub has a canonical + title --------
// These are public URLs that we choose not to index yet; canonical is
// important for consolidating signals to the destination. Private/error
// pages (noindex,nofollow) don't need a canonical.
test('every "noindex,follow" and meta-refresh stub has a canonical and a title', () => {
  const followableStubs = PARSED.filter((p) => {
    if (p.refresh) return true;
    if (!p.noindex) return false;
    const m = p.head.match(/<meta[^>]+name=["']robots["'][^>]*content=["']([^"']+)["']/i);
    return !!m && /follow/i.test(m[1]) && !/nofollow/i.test(m[1]);
  });
  assert.ok(followableStubs.length > 0, 'expected at least some noindex,follow stub pages');
  const bad = [];
  for (const p of followableStubs) {
    if (!p.canonical) bad.push(`${p.file} — missing canonical`);
    else if (!isCanonicalOriginUrl(p.canonical))
      bad.push(`${p.file} — canonical "${p.canonical}" not on canonical origin`);
    if (!p.title) bad.push(`${p.file} — missing <title>`);
  }
  assert.deepEqual(bad, [], `Stub metadata issues:\n  ${bad.join('\n  ')}`);
});

// --- #1, #2, #3: indexable pages satisfy the canonical graph ---------
test('every indexable HTML page has canonical + hreflang(x-default,en,ar) + title + description', () => {
  const indexable = PARSED.filter((p) => !p.noindex && !p.refresh);
  assert.ok(indexable.length > 100, 'expected a lot of indexable pages');
  const bad = [];
  for (const p of indexable) {
    // Canonical must exist and be on the canonical origin
    if (!p.canonical) {
      bad.push(`${p.file} — missing canonical`);
      continue;
    }
    if (!isCanonicalOriginUrl(p.canonical)) {
      bad.push(`${p.file} — canonical "${p.canonical}" not on canonical origin`);
    }
    // Hreflang triple
    for (const req of ['x-default', 'en', 'ar']) {
      if (!p.hreflangs.includes(req)) {
        bad.push(`${p.file} — missing hreflang="${req}" (has: ${p.hreflangs.join(',') || 'none'})`);
      }
    }
    // Title / description presence
    if (!p.title) bad.push(`${p.file} — missing <title>`);
    if (!p.desc || p.desc.trim().length < 20) {
      bad.push(`${p.file} — missing or too-short meta description`);
    }
  }
  assert.deepEqual(bad, [], `Indexable-page SEO issues:\n  ${bad.join('\n  ')}`);
});

// --- #1b: canonical must be self-consistent with the file path -------
test('indexable canonical URL matches the file path (no cross-page canonicalisation)', () => {
  const indexable = PARSED.filter((p) => !p.noindex && !p.refresh);
  const bad = [];
  for (const p of indexable) {
    if (!p.canonical) continue; // already flagged above
    // Expected canonical from file path
    let expected;
    if (p.file === 'index.html') expected = CANONICAL_ORIGIN + '/';
    else if (p.file.endsWith('/index.html'))
      expected = CANONICAL_ORIGIN + '/' + p.file.slice(0, -'index.html'.length);
    else expected = CANONICAL_ORIGIN + '/' + p.file;
    // Accept either "…/gold-price" or "…/gold-price/" for directory pages.
    const candidates = [expected, expected.replace(/\/$/, '')];
    if (!candidates.includes(p.canonical)) {
      bad.push(`${p.file} — canonical "${p.canonical}" ≠ expected "${expected}"`);
    }
  }
  assert.deepEqual(bad, [], `Canonical/path mismatches:\n  ${bad.join('\n  ')}`);
});

// --- #6: country/city filesystem coverage ----------------------------
test('every country+city declared in countries.js has a directory on disk', () => {
  // Parse countries.js superficially (same tolerant approach as the
  // enrichment script).
  const src = fs.readFileSync(path.join(REPO_ROOT, 'src/config/countries.js'), 'utf8');
  const re = /\{\s*code:[\s\S]*?\n\s*\}(?=\s*,|\s*\])/g;
  const missing = [];
  for (const m of src.matchAll(re)) {
    const block = m[0];
    const slug = (block.match(/slug:\s*'([^']+)'/) || [])[1];
    if (!slug) continue;
    const countryIdx = `countries/${slug}/index.html`;
    if (!fs.existsSync(path.join(REPO_ROOT, countryIdx))) {
      missing.push(countryIdx);
    }
    const cityBlock = (block.match(/cities:\s*\[([\s\S]*?)\]/) || [])[1];
    if (cityBlock) {
      for (const cm of cityBlock.matchAll(/\{\s*slug:\s*'([^']+)'/g)) {
        const cityIdx = `countries/${slug}/${cm[1]}/index.html`;
        if (!fs.existsSync(path.join(REPO_ROOT, cityIdx))) {
          missing.push(cityIdx);
        }
      }
    }
  }
  assert.deepEqual(
    missing,
    [],
    `countries.js declares these paths but the file is missing:\n  ${missing.join('\n  ')}`
  );
});

// --- X / Twitter social link — must have no spaces in the URL ---------
test('index.html: X/Twitter social link URL has no spaces and uses https://x.com/', () => {
  const html = fs.readFileSync(path.join(REPO_ROOT, 'index.html'), 'utf8');
  // Find all href values that reference x.com
  const xLinkRe = /href=["'](https?:\/\/x\.com\/[^"']*?)["']/gi;
  const matches = [...html.matchAll(xLinkRe)];
  assert.ok(matches.length > 0, 'index.html: expected at least one x.com link');
  for (const m of matches) {
    const url = m[1];
    assert.ok(!url.includes(' '), `index.html: x.com URL contains a space (broken): "${url}"`);
    assert.ok(
      url.startsWith('https://x.com/'),
      `index.html: x.com link should use https://x.com/ (got "${url}")`
    );
  }
});

// --- calculator inputmode guard ----------------------------------------
test('calculator.html: numeric inputs keep mobile inputmode hints', () => {
  const html = fs.readFileSync(path.join(REPO_ROOT, 'calculator.html'), 'utf8');
  const numberInputTags = [...html.matchAll(/<input\b[^>]*type=["']number["'][^>]*>/gi)].map(
    (m) => m[0]
  );
  const expectedModesById = new Map([
    ['val-weight', 'decimal'],
    ['scrap-weight', 'decimal'],
    ['scrap-payout', 'numeric'],
    ['zakat-weight', 'decimal'],
    ['buy-amount', 'decimal'],
    ['conv-amount', 'decimal'],
  ]);
  const seenIds = new Set();
  const unexpectedIds = [];
  for (const tag of numberInputTags) {
    const id = (tag.match(/\bid=["']([^"']+)["']/i) || [])[1];
    assert.ok(id, `calculator.html: numeric input missing id attribute in tag: ${tag}`);
    const inputmode = (tag.match(/\binputmode=["']([^"']+)["']/i) || [])[1];
    if (!expectedModesById.has(id)) {
      unexpectedIds.push(id);
      continue;
    }
    seenIds.add(id);
    assert.ok(inputmode, `calculator.html: #${id} missing inputmode attribute`);
    assert.equal(
      inputmode,
      expectedModesById.get(id),
      `calculator.html: #${id} should keep inputmode="${expectedModesById.get(id)}"`
    );
  }
  assert.deepEqual(
    unexpectedIds,
    [],
    `calculator.html: unexpected numeric input ids: ${unexpectedIds.join(', ')}`
  );
  const missingIds = [...expectedModesById.keys()].filter((id) => !seenIds.has(id));
  assert.deepEqual(
    missingIds,
    [],
    `calculator.html: missing expected numeric inputs: ${missingIds.join(', ')}`
  );
});

// --- sitemap generator correctness (runs against current filesystem) --
test('sitemap generator excludes every noindex / meta-refresh stub', () => {
  // Invoke the generator in-process by requiring it after writing to a
  // temp location. Simpler: shell-out via child_process so we get the
  // same behaviour as `npm run generate-sitemap`.
  const { execFileSync } = require('node:child_process');
  const tmp = path.join(REPO_ROOT, '.sitemap-test.xml');
  try {
    execFileSync(
      process.execPath,
      [path.join(REPO_ROOT, 'scripts/node/generate-sitemap.js'), '--base', CANONICAL_ORIGIN],
      { cwd: REPO_ROOT, stdio: ['ignore', 'pipe', 'pipe'] }
    );
    const sitemapPath = path.join(REPO_ROOT, 'sitemap.xml');
    assert.ok(fs.existsSync(sitemapPath), 'sitemap.xml not produced');
    const xml = fs.readFileSync(sitemapPath, 'utf8');
    // Any URL pointing at a noindex/refresh stub indicates the generator
    // has regressed.
    const urls = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);
    const urlSet = new Set(urls);
    const stubsInSitemap = PARSED.filter((p) => p.noindex || p.refresh)
      .map((p) => {
        if (p.file === 'index.html') return CANONICAL_ORIGIN + '/';
        if (p.file.endsWith('/index.html'))
          return CANONICAL_ORIGIN + '/' + p.file.slice(0, -'index.html'.length);
        return CANONICAL_ORIGIN + '/' + p.file;
      })
      .filter((u) => urlSet.has(u));
    assert.deepEqual(
      stubsInSitemap,
      [],
      `Stub URLs should not be in the sitemap:\n  ${stubsInSitemap.join('\n  ')}`
    );
  } finally {
    // Clean up the generated sitemap (it's .gitignore'd anyway, but keep
    // the tree tidy so the next run starts clean).
    try {
      fs.unlinkSync(path.join(REPO_ROOT, 'sitemap.xml'));
    } catch {}
    try {
      fs.unlinkSync(tmp);
    } catch {}
  }
});
