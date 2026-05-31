'use strict';

/**
 * Tests for the Insights articles configuration and feed logic.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');

test('insights-articles exports a non-empty articles array', async () => {
  const { INSIGHTS_ARTICLES } = await import('../src/config/insights-articles.js');
  assert.ok(Array.isArray(INSIGHTS_ARTICLES));
  assert.ok(
    INSIGHTS_ARTICLES.length >= 12,
    `Expected >=12 articles, got ${INSIGHTS_ARTICLES.length}`
  );
});

test('every article has required fields', async () => {
  const { INSIGHTS_ARTICLES } = await import('../src/config/insights-articles.js');
  for (const article of INSIGHTS_ARTICLES) {
    assert.ok(article.id, 'Missing id');
    assert.ok(article.category, `Missing category for ${article.id}`);
    assert.ok(article.title?.en, `Missing title.en for ${article.id}`);
    assert.ok(article.title?.ar, `Missing title.ar for ${article.id}`);
    assert.ok(article.excerpt?.en, `Missing excerpt.en for ${article.id}`);
    assert.ok(article.excerpt?.ar, `Missing excerpt.ar for ${article.id}`);
    assert.ok(article.href, `Missing href for ${article.id}`);
    assert.ok(article.date, `Missing date for ${article.id}`);
    assert.ok(article.wordCount > 0, `Invalid wordCount for ${article.id}`);
  }
});

test('every article category is defined in INSIGHT_CATEGORIES', async () => {
  const { INSIGHTS_ARTICLES, INSIGHT_CATEGORIES } =
    await import('../src/config/insights-articles.js');
  const validCats = Object.keys(INSIGHT_CATEGORIES).filter((k) => k !== 'all');
  for (const article of INSIGHTS_ARTICLES) {
    assert.ok(
      validCats.includes(article.category),
      `Article "${article.id}" has unknown category "${article.category}"`
    );
  }
});

test('every category has at least one article', async () => {
  const { INSIGHTS_ARTICLES, INSIGHT_CATEGORIES } =
    await import('../src/config/insights-articles.js');
  const validCats = Object.keys(INSIGHT_CATEGORIES).filter((k) => k !== 'all');
  for (const cat of validCats) {
    const count = INSIGHTS_ARTICLES.filter((a) => a.category === cat).length;
    assert.ok(count > 0, `Category "${cat}" has no articles`);
  }
});

test('article IDs are unique', async () => {
  const { INSIGHTS_ARTICLES } = await import('../src/config/insights-articles.js');
  const ids = INSIGHTS_ARTICLES.map((a) => a.id);
  const unique = [...new Set(ids)];
  assert.strictEqual(ids.length, unique.length, 'Duplicate article IDs found');
});

test('CATEGORY_TAG_CLASS has an entry for every non-all category', async () => {
  const { INSIGHT_CATEGORIES, CATEGORY_TAG_CLASS } =
    await import('../src/config/insights-articles.js');
  const validCats = Object.keys(INSIGHT_CATEGORIES).filter((k) => k !== 'all');
  for (const cat of validCats) {
    assert.ok(CATEGORY_TAG_CLASS[cat], `Missing tag class for category "${cat}"`);
  }
});

test('getReadTime returns correct values', async () => {
  const { getReadTime } = await import('../src/config/insights-articles.js');
  assert.strictEqual(getReadTime(50), 1);
  assert.strictEqual(getReadTime(200), 1);
  assert.strictEqual(getReadTime(400), 2);
  assert.strictEqual(getReadTime(600), 3);
  assert.strictEqual(getReadTime(1000), 5);
  assert.strictEqual(getReadTime(1400), 7);
  assert.strictEqual(getReadTime(201), 2); // rounds up
});

test('INSIGHT_CATEGORIES has bilingual labels for every category', async () => {
  const { INSIGHT_CATEGORIES } = await import('../src/config/insights-articles.js');
  for (const [key, labels] of Object.entries(INSIGHT_CATEGORIES)) {
    assert.ok(labels.en, `Missing English label for category "${key}"`);
    assert.ok(labels.ar, `Missing Arabic label for category "${key}"`);
  }
});

test('all article hrefs are relative paths', async () => {
  const { INSIGHTS_ARTICLES } = await import('../src/config/insights-articles.js');
  for (const article of INSIGHTS_ARTICLES) {
    assert.ok(
      !article.href.startsWith('http'),
      `Article "${article.id}" href should be a relative path`
    );
  }
});
