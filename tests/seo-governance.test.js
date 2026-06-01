'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  classifyGroup,
  getWordCount,
  buildDuplicateRisk,
  REQUIRED_NOINDEX_PATTERNS,
  summarize,
} = require('../scripts/node/seo-governance.js');

test('classifyGroup maps core/countries/cities/markets/content paths', () => {
  assert.equal(classifyGroup('index.html'), 'core');
  assert.equal(classifyGroup('countries/uae/gold-price/index.html'), 'countries');
  assert.equal(classifyGroup('countries/uae/dubai/gold-prices/index.html'), 'cities');
  assert.equal(classifyGroup('countries/uae/markets/dubai-gold-souk.html'), 'markets');
  assert.equal(classifyGroup('content/guides/buying-guide.html'), 'content');
});

test('getWordCount strips scripts/styles/tags', () => {
  const html = `
    <html><head><style>.a{color:red}</style><script>const x = 1;</script></head>
    <body><h1>Gold Price Today</h1><p>Reference spot-linked estimate in AED.</p></body></html>
  `;
  assert.equal(getWordCount(html), 8);
});

test('buildDuplicateRisk returns duplicate title+description clusters', () => {
  const records = [
    { path: 'a.html', noindex: false, title: 'A', description: 'Same desc' },
    { path: 'b.html', noindex: false, title: 'A', description: 'Same desc' },
    { path: 'c.html', noindex: false, title: 'C', description: 'Other' },
  ];
  const clusters = buildDuplicateRisk(records);
  assert.equal(clusters.length, 1);
  assert.deepEqual(clusters[0], ['a.html', 'b.html']);
});

test('summarize reports grouped counts and risk totals', () => {
  const records = [
    {
      path: 'index.html',
      group: 'core',
      noindex: false,
      title: 'Home',
      description: 'Desc',
      wordCount: 250,
      thinRisk: false,
      missingCanonical: false,
      missingHreflang: false,
      missingSchema: false,
    },
    {
      path: 'countries/uae/gold-price/index.html',
      group: 'countries',
      noindex: false,
      title: 'UAE',
      description: 'Desc',
      wordCount: 80,
      thinRisk: true,
      missingCanonical: true,
      missingHreflang: false,
      missingSchema: true,
    },
  ];

  const report = summarize(records);
  assert.equal(report.groups.core, 1);
  assert.equal(report.groups.countries, 1);
  assert.equal(report.totals.thinRiskPages, 1);
  assert.equal(report.totals.missingCanonical, 1);
  assert.equal(report.totals.missingSchema, 1);
});

test('required noindex policy flags targeted pages that are still indexable', () => {
  const needsNoindexPath = 'content/tools/investment-return.html';
  assert.equal(REQUIRED_NOINDEX_PATTERNS.some((p) => p.test(needsNoindexPath)), true);

  const report = summarize([
    {
      path: needsNoindexPath,
      group: 'core',
      noindex: false,
      title: 'Invest',
      description: 'desc',
      wordCount: 150,
      thinRisk: false,
      missingCanonical: false,
      missingHreflang: false,
      missingSchema: false,
    },
  ]);

  assert.equal(report.totals.requiredNoindexViolations, 1);
  assert.deepEqual(report.risks.requiredNoindexMissing, [needsNoindexPath]);
});
