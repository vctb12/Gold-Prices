'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

// feed-core + insights-data are ES modules; load dynamically.
let core;
let data;
async function load() {
  if (!core) core = await import('../src/pages/insights/feed-core.js');
  if (!data) data = await import('../src/config/insights-data.js');
  return { core, data };
}

test('readTimeMinutes computes 200 wpm with a 1-minute floor', async () => {
  const { core } = await load();
  assert.equal(core.readTimeMinutes(800), 4);
  assert.equal(core.readTimeMinutes(1665), 8);
  assert.equal(core.readTimeMinutes(50), 1); // floor
  assert.equal(core.readTimeMinutes(0), 1);
  assert.equal(core.readTimeMinutes(-10), 1);
  assert.equal(core.readTimeMinutes('not a number'), 1);
});

test('readTimeLabel is bilingual with Arabic-Indic digits', async () => {
  const { core } = await load();
  assert.equal(core.readTimeLabel(800, 'en'), '4 min read');
  assert.equal(core.readTimeLabel(800, 'ar'), 'قراءة ٤ دقائق');
});

test('formatDate returns a non-empty localized string and empty for bad input', async () => {
  const { core } = await load();
  assert.ok(core.formatDate('2026-05-12', 'en').length > 0);
  assert.ok(core.formatDate('2026-05-12', 'ar').length > 0);
  assert.equal(core.formatDate('not-a-date', 'en'), '');
});

test('categoryCounts includes an "all" total and per-category tallies', async () => {
  const { core, data } = await load();
  const counts = core.categoryCounts(data.INSIGHTS);
  assert.equal(counts.all, data.INSIGHTS.length);
  const sum = data.INSIGHT_CATEGORIES.reduce((s, c) => s + (counts[c.key] || 0), 0);
  assert.equal(sum, data.INSIGHTS.length);
});

test('filterInsights filters by category', async () => {
  const { core, data } = await load();
  const investment = core.filterInsights(data.INSIGHTS, { category: 'investment' });
  assert.ok(investment.length > 0);
  assert.ok(investment.every((i) => i.category === 'investment'));
  const all = core.filterInsights(data.INSIGHTS, { category: 'all' });
  assert.equal(all.length, data.INSIGHTS.length);
});

test('filterInsights matches title and excerpt by query in active language', async () => {
  const { core, data } = await load();
  const peg = core.filterInsights(data.INSIGHTS, { query: 'peg', lang: 'en' });
  assert.ok(peg.some((i) => i.id === 'aed-peg-explained'));

  const karat = core.filterInsights(data.INSIGHTS, { query: 'karat', lang: 'en' });
  assert.ok(karat.length > 0);

  const none = core.filterInsights(data.INSIGHTS, { query: 'zzzznotfound', lang: 'en' });
  assert.equal(none.length, 0);
});

test('getFeatured returns the explicitly flagged entry', async () => {
  const { core, data } = await load();
  const featured = core.getFeatured(data.INSIGHTS);
  assert.ok(featured);
  assert.equal(featured.featured, true);
});

test('getFeatured falls back to the most recent when none flagged', async () => {
  const { core } = await load();
  const items = [
    { id: 'a', date: '2026-01-01' },
    { id: 'b', date: '2026-03-01' },
    { id: 'c', date: '2026-02-01' },
  ];
  assert.equal(core.getFeatured(items).id, 'b');
  assert.equal(core.getFeatured([]), null);
});

test('buildPriceCallout reflects direction and percentage', async () => {
  const { core } = await load();
  const up = core.buildPriceCallout({ changePct: 1.23, lang: 'en' });
  assert.equal(up.direction, 'up');
  assert.equal(up.pctText, '+1.23%');
  assert.match(up.body, /up 1\.23%/);

  const down = core.buildPriceCallout({ changePct: -2.5, lang: 'en' });
  assert.equal(down.direction, 'down');
  assert.equal(down.pctText, '−2.50%');

  const flat = core.buildPriceCallout({ changePct: 0.01, lang: 'en' });
  assert.equal(flat.direction, 'flat');
});

test('buildPriceCallout handles null/invalid change with an evergreen message', async () => {
  const { core } = await load();
  const c = core.buildPriceCallout({ changePct: null, lang: 'en' });
  assert.equal(c.direction, 'flat');
  assert.equal(c.pctText, '—');
  assert.ok(c.body.length > 0);
  assert.ok(c.cta.length > 0);

  const ar = core.buildPriceCallout({ changePct: null, lang: 'ar' });
  assert.ok(ar.body.length > 0);
});

test('noResultsText embeds the query bilingually', async () => {
  const { core } = await load();
  assert.match(core.noResultsText('dubai', 'en'), /dubai/);
  assert.match(core.noResultsText('دبي', 'ar'), /دبي/);
});

test('weeklyChangePct uses a ~7-day-ago snapshot when present', async () => {
  const { core } = await load();
  const now = Date.UTC(2026, 4, 20); // 2026-05-20
  const sevenDaysAgo = new Date(now - 7 * 86400000).toISOString().slice(0, 10);
  const history = [
    { date: sevenDaysAgo, price: 2000 },
    { date: '2026-05-19', price: 2050 },
  ];
  const pct = core.weeklyChangePct(history, 2100, now);
  assert.ok(Math.abs(pct - 5) < 1e-9); // (2100-2000)/2000*100
});

test('weeklyChangePct returns null without a snapshot in window', async () => {
  const { core } = await load();
  const now = Date.UTC(2026, 4, 20);
  assert.equal(core.weeklyChangePct([], 2100, now), null);
  assert.equal(core.weeklyChangePct(null, 2100, now), null);
  // Snapshot is 30 days old → outside 4–10 day window → null
  const old = [{ date: '2026-04-20', price: 2000 }];
  assert.equal(core.weeklyChangePct(old, 2100, now), null);
  // No valid spot
  assert.equal(core.weeklyChangePct([{ date: '2026-05-13', price: 2000 }], 0, now), null);
});

test('every insight has required fields and a known category', async () => {
  const { data } = await load();
  const known = new Set(data.INSIGHT_CATEGORIES.map((c) => c.key));
  for (const item of data.INSIGHTS) {
    assert.ok(item.id, 'id');
    assert.ok(item.url, 'url');
    assert.ok(known.has(item.category), `category ${item.category}`);
    assert.ok(item.title?.en && item.title?.ar, `title for ${item.id}`);
    assert.ok(item.excerpt?.en && item.excerpt?.ar, `excerpt for ${item.id}`);
    assert.ok(Number.isFinite(item.words) && item.words > 0, `words for ${item.id}`);
    assert.match(item.date, /^\d{4}-\d{2}-\d{2}$/, `date for ${item.id}`);
  }
});
