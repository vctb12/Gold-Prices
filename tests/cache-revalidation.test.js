'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

async function loadEngine() {
  const url = new URL(
    'file://' + path.resolve(__dirname, '..', 'src', 'lib', 'realtime-pricing-engine.js')
  );
  return import(url.href + `?v=${Date.now()}`);
}

test('cache boot starts as cached and only becomes live after revalidation', async () => {
  const { createRealtimePricingEngine } = await loadEngine();
  let revalidated = false;
  const primaryProvider = {
    providerId: 'primary-provider',
    async fetchQuote() {
      revalidated = true;
      return {
        price: 3200,
        providerTimestamp: new Date().toISOString(),
        fetchedAt: new Date().toISOString(),
        providerId: 'primary-provider',
        source: 'primary-provider',
        providerPathSuccessful: true,
      };
    },
  };

  const engine = createRealtimePricingEngine({
    primaryProvider,
    config: { activePollMs: 999999, hiddenPollMs: 999999, jitterMs: 0 },
  });

  engine.seedFromCache({
    price: 3199,
    updatedAt: new Date().toISOString(),
    fetchedAt: new Date().toISOString(),
    providerId: 'cache',
    source: 'cache',
  });

  let snapshot = engine.getSnapshot();
  assert.equal(snapshot.freshness.state, 'cached');

  engine.start();
  await engine.refreshNow('revalidate');
  snapshot = engine.getSnapshot();
  engine.stop();

  assert.equal(revalidated, true);
  assert.notEqual(snapshot.freshness.state, 'cached');
});
