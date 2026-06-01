'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const SITE = 'https://goldtickerlive.com';

/** Canonical country hubs (not legacy /gold-price/ duplicates). */
const HUB_PAGES = [
  {
    file: 'countries/uae/index.html',
    canonical: `${SITE}/countries/uae/`,
    title: /United Arab Emirates|UAE/i,
  },
  {
    file: 'countries/saudi-arabia/index.html',
    canonical: `${SITE}/countries/saudi-arabia/`,
    title: /Saudi Arabia/i,
  },
];

const DUPLICATE_PAGES = [
  {
    file: 'countries/uae/gold-price/index.html',
    canonical: `${SITE}/countries/uae/`,
  },
  {
    file: 'countries/saudi-arabia/gold-price/index.html',
    canonical: `${SITE}/countries/saudi-arabia/`,
  },
];

function readHead(file) {
  const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const match = html.match(/<head[\s\S]*?<\/head>/i);
  assert.ok(match, `${file}: missing <head>`);
  return match[0];
}

for (const page of HUB_PAGES) {
  test(`${page.file}: ships canonical, description, and hreflang`, () => {
    const head = readHead(page.file);
    const title = head.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '';
    const description =
      head.match(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']+)["']/i)?.[1] || '';
    const canonical =
      head.match(/<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["']/i)?.[1] || '';
    const hreflangs = [
      ...head.matchAll(/<link[^>]+rel=["']alternate["'][^>]*hreflang=["']([^"']+)["']/gi),
    ].map((match) => match[1].toLowerCase());

    assert.match(title, page.title, `${page.file}: title should mention the country name`);
    assert.ok(description.length >= 40, `${page.file}: meta description too short`);
    assert.equal(canonical, page.canonical, `${page.file}: canonical mismatch`);
    for (const required of ['x-default', 'en', 'ar']) {
      assert.ok(hreflangs.includes(required), `${page.file}: missing hreflang=${required}`);
    }
  });
}

for (const page of DUPLICATE_PAGES) {
  test(`${page.file}: noindex duplicate with canonical to country hub`, () => {
    if (!fs.existsSync(path.join(ROOT, page.file))) return;
    const head = readHead(page.file);
    const canonical =
      head.match(/<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["']/i)?.[1] || '';
    assert.match(head, /noindex/i, `${page.file}: legacy duplicate should be noindex`);
    assert.equal(canonical, page.canonical, `${page.file}: canonical should point at hub`);
  });
}
