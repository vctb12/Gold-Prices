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

function providerFrom(sequence, providerId = 'primary-provider') {
  let idx = 0;
  return {
    providerId,
    async fetchQuote() {
      const item = sequence[Math.min(idx, sequence.length - 1)];
      idx += 1;
      if (item.error) throw item.error;
      return {
        price: item.price,
        providerTimestamp: item.providerTimestamp,
        fetchedAt: item.fetchedAt || new Date().toISOString(),
        providerId: item.providerId || providerId,
        source: item.providerId || providerId,
        providerPathSuccessful: item.providerPathSuccessful !== false,
        forcedState: item.forcedState || null,
      };
    },
  };
}

test('realtime engine enforces monotonic quote guard', async () => {
  const { createRealtimePricingEngine } = await loadEngine();
  const primary = providerFrom([
    { price: 3200, providerTimestamp: '2026-05-19T16:00:10Z' },
    { price: 3190, providerTimestamp: '2026-05-19T16:00:05Z' },
  ]);

  const engine = createRealtimePricingEngine({
    primaryProvider: primary,
    config: { activePollMs: 999999, hiddenPollMs: 999999, jitterMs: 0 },
  });

  engine.start();
  await engine.refreshNow('test-1');
  await engine.refreshNow('test-2');
  const snapshot = engine.getSnapshot();
  engine.stop();

  assert.equal(snapshot.quote.price, 3200);
  assert.equal(snapshot.metrics.monotonicGuardBlocks, 1);
});

test('realtime engine triggers immediate visibility recovery refresh path', async () => {
  const { createRealtimePricingEngine } = await loadEngine();
  const primary = providerFrom([{ price: 3300, providerTimestamp: '2026-05-19T16:00:00Z' }]);

  const engine = createRealtimePricingEngine({
    primaryProvider: primary,
    config: { activePollMs: 999999, hiddenPollMs: 999999, jitterMs: 0 },
  });

  engine.start();
  engine.setVisibility(false);
  engine.setVisibility(true);
  await new Promise((resolve) => setTimeout(resolve, 30));
  const snapshot = engine.getSnapshot();
  engine.stop();

  assert.ok(snapshot.metrics.visibilityRecoveryLatencyMs !== null);
});
