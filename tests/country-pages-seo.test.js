'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const SITE = 'https://goldtickerlive.com';

const PAGES = [
  {
    file: 'countries/uae/gold-price/index.html',
    canonical: `${SITE}/countries/uae/gold-price/`,
    title: /United Arab Emirates/i,
  },
  {
    file: 'countries/saudi-arabia/gold-price/index.html',
    canonical: `${SITE}/countries/saudi-arabia/gold-price/`,
    title: /Saudi Arabia/i,
  },
];

function readHead(file) {
  const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const match = html.match(/<head[\s\S]*?<\/head>/i);
  assert.ok(match, `${file}: missing <head>`);
  return match[0];
}

for (const page of PAGES) {
  test(`${page.file}: ships canonical, description, and FAQ schema`, () => {
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
    assert.ok(description.length >= 80, `${page.file}: meta description too short`);
    assert.equal(canonical, page.canonical, `${page.file}: canonical mismatch`);
    for (const required of ['x-default', 'en', 'ar']) {
      assert.ok(hreflangs.includes(required), `${page.file}: missing hreflang=${required}`);
    }
    assert.ok(head.includes('"@type": "FAQPage"'), `${page.file}: missing FAQPage JSON-LD`);
    assert.ok(head.includes('"@type": "Dataset"'), `${page.file}: missing Dataset JSON-LD`);
  });
}
