'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

async function loadModule() {
  const url = pathToFileURL(path.resolve(__dirname, '..', 'src', 'lib', 'cross-page-links.js'));
  return import(url.href);
}

test('buildTrackerHashHref encodes mode/cur/k/u/lang', async () => {
  const mod = await loadModule();
  const href = mod.buildTrackerHashHref({
    mode: 'live',
    cur: 'AED',
    k: '22',
    u: 'tola',
    lang: 'ar',
    range: '30D',
  });
  assert.equal(href, 'tracker.html#mode=live&cur=AED&k=22&u=tola&lang=ar&r=30D');
});

test('buildTrackerHashHref falls back for invalid karat/mode', async () => {
  const mod = await loadModule();
  const href = mod.buildTrackerHashHref({ mode: 'bogus', k: '99', u: 'stone' });
  assert.match(href, /mode=live/);
  assert.match(href, /k=24/);
  assert.match(href, /u=gram/);
});

test('buildHomeTrackerHref uses selected karat and unit', async () => {
  const mod = await loadModule();
  const href = mod.buildHomeTrackerHref('21', 'oz', 'en');
  assert.equal(href, 'tracker.html#mode=live&cur=AED&k=21&u=oz&lang=en');
});

test('buildShopsHref adds country query when code present', async () => {
  const mod = await loadModule();
  assert.equal(mod.buildShopsHref(), 'shops.html');
  assert.equal(mod.buildShopsHref({ countryCode: 'AE' }), 'shops.html?country=AE');
});

test('countryForCurrency returns first matching country', async () => {
  const mod = await loadModule();
  const countries = [
    { code: 'AE', currency: 'AED' },
    { code: 'SA', currency: 'SAR' },
  ];
  assert.equal(mod.countryForCurrency('SAR', countries)?.code, 'SA');
  assert.equal(mod.countryForCurrency('USD', countries), null);
});
