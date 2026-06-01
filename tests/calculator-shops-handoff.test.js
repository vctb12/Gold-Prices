'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

async function loadModule() {
  const url = pathToFileURL(
    path.resolve(__dirname, '..', 'src', 'pages', 'calculator', 'shops-handoff.js')
  );
  return import(url.href);
}

test('buildShopsHandoffHref returns plain shops.html without country', async () => {
  const { buildShopsHandoffHref } = await loadModule();
  assert.equal(buildShopsHandoffHref(), 'shops.html');
  assert.equal(buildShopsHandoffHref({ lang: 'en' }), 'shops.html');
});

test('buildShopsHandoffHref adds country filter from calculator context', async () => {
  const { buildShopsHandoffHref } = await loadModule();
  assert.equal(buildShopsHandoffHref({ countryCode: 'AE' }), 'shops.html?country=AE');
  assert.equal(
    buildShopsHandoffHref({ countryCode: 'ae', lang: 'ar' }),
    'shops.html?country=AE&lang=ar'
  );
});
