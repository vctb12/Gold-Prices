'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

// insights-data is an ES module; load it dynamically inside an async helper.
let mod;
async function load() {
  if (!mod) mod = await import('../src/pages/insights/insights-data.js');
  return mod;
}

test('estimateReadTime: 200 wpm, minimum 1 minute', async () => {
  const { estimateReadTime } = await load();
  assert.equal(estimateReadTime(200), 1);
  assert.equal(estimateReadTime(800), 4);
  assert.equal(estimateReadTime(1180), 6);
  assert.equal(estimateReadTime(0), 1);
  assert.equal(estimateReadTime(-50), 1);
  assert.equal(estimateReadTime(NaN), 1);
  assert.equal(estimateReadTime('300'), 2);
});

test('readTimeLabel is bilingual', async () => {
  const { readTimeLabel } = await load();
  assert.equal(readTimeLabel(800, 'en'), '4 min read');
  assert.equal(readTimeLabel(800, 'ar'), 'قراءة 4 دقائق');
});

test('categoryCounts: all equals length and sums by category', async () => {
  const { categoryCounts, INSIGHTS } = await load();
  const counts = categoryCounts();
  assert.equal(counts.all, INSIGHTS.length);
  const sum = Object.entries(counts)
    .filter(([k]) => k !== 'all')
    .reduce((acc, [, v]) => acc + v, 0);
  assert.equal(sum, INSIGHTS.length);
  assert.ok(counts['price-analysis'] >= 1);
  assert.ok(counts['investment'] >= 1);
});

test('filterInsights: category filter', async () => {
  const { filterInsights, INSIGHTS } = await load();
  const all = filterInsights(INSIGHTS, { category: 'all' });
  assert.equal(all.length, INSIGHTS.length);

  const inv = filterInsights(INSIGHTS, { category: 'investment' });
  assert.ok(inv.length >= 1);
  assert.ok(inv.every((i) => i.category === 'investment'));
});

test('filterInsights: query matches title + excerpt, case-insensitive, EN/AR', async () => {
  const { filterInsights, INSIGHTS } = await load();
  const peg = filterInsights(INSIGHTS, { query: 'PEG', lang: 'en' });
  assert.ok(peg.some((i) => i.id === 'aed-peg'));

  const zakatAr = filterInsights(INSIGHTS, { query: 'زكاة', lang: 'ar' });
  assert.ok(zakatAr.some((i) => i.id === 'zakat'));

  const none = filterInsights(INSIGHTS, { query: 'zzzznomatch' });
  assert.equal(none.length, 0);
});

test('filterInsights: category + query combine (AND)', async () => {
  const { filterInsights, INSIGHTS } = await load();
  const res = filterInsights(INSIGHTS, { category: 'investment', query: 'coins', lang: 'en' });
  assert.ok(res.every((i) => i.category === 'investment'));
  assert.ok(res.some((i) => i.id === 'bars-vs-coins'));
});

test('categoryLabel resolves bilingual labels with fallback', async () => {
  const { categoryLabel } = await load();
  assert.equal(categoryLabel('investment', 'en'), 'Investment');
  assert.equal(categoryLabel('investment', 'ar'), 'الاستثمار');
  assert.equal(categoryLabel('unknown-id', 'en'), 'unknown-id');
});

test('buildPriceContextCard: up / down / flat / unknown', async () => {
  const { buildPriceContextCard } = await load();

  const up = buildPriceContextCard(2000, 2100, 'en');
  assert.equal(up.direction, 'up');
  assert.ok(up.pct > 0);
  assert.match(up.body, /up 5\.00%/);

  const down = buildPriceContextCard(2100, 2000, 'en');
  assert.equal(down.direction, 'down');
  assert.match(down.body, /down/);

  const flat = buildPriceContextCard(2000, 2000, 'en');
  assert.equal(flat.direction, 'flat');

  const unknown = buildPriceContextCard(0, 2000, 'en');
  assert.equal(unknown.direction, 'unknown');
  assert.equal(unknown.pct, null);

  const ar = buildPriceContextCard(2000, 2100, 'ar');
  assert.match(ar.body, /ارتفع/);
});

test('every insight links to an existing content page (no broken links)', async () => {
  const { INSIGHTS } = await load();
  const root = path.join(__dirname, '..');
  for (const item of INSIGHTS) {
    const rel = item.href.endsWith('/') ? item.href + 'index.html' : item.href;
    const abs = path.join(root, rel);
    assert.ok(fs.existsSync(abs), `missing content page for ${item.id}: ${rel}`);
  }
});

test('every insight has bilingual title + excerpt and a category', async () => {
  const { INSIGHTS, CATEGORIES } = await load();
  const validCats = new Set(CATEGORIES.map((c) => c.id));
  for (const item of INSIGHTS) {
    assert.ok(item.titleEn && item.titleAr, `title missing for ${item.id}`);
    assert.ok(item.excerptEn && item.excerptAr, `excerpt missing for ${item.id}`);
    assert.ok(validCats.has(item.category), `bad category for ${item.id}`);
  }
});
