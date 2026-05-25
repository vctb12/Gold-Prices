'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

async function loadTranslations() {
  const url = new URL(
    'file://' + path.resolve(__dirname, '..', 'src', 'config', 'translations.js')
  );
  return import(url.href + `?v=${Date.now()}`);
}

test('freshness translation keys exist in EN and AR', async () => {
  const { TRANSLATIONS } = await loadTranslations();
  const required = [
    'freshness.statusLabel',
    'freshness.strip.live',
    'freshness.strip.delayed',
    'freshness.strip.cached',
    'freshness.strip.stale',
    'freshness.strip.fallback',
    'freshness.strip.closed',
    'freshness.strip.unavailable',
    'freshness.strip.source',
    'freshness.strip.methodology',
    'freshness.strip.agoMinutes',
    'freshness.strip.agoHours',
    'freshness.strip.agoJustNow',
    'freshness.meta.title',
    'freshness.meta.status',
    'freshness.meta.source',
    'freshness.meta.providerId',
    'freshness.meta.providerTimestamp',
    'freshness.meta.fetchedAt',
    'freshness.meta.age',
    'freshness.meta.pollInterval',
    'freshness.meta.lastFetchLatency',
    'freshness.sla.title',
    'freshness.sla.empty',
    'freshness.sla.warning',
    'freshness.sla.critical',
  ];

  for (const key of required) {
    assert.ok(TRANSLATIONS.en[key], `Missing EN key: ${key}`);
    assert.ok(TRANSLATIONS.ar[key], `Missing AR key: ${key}`);
  }
});
