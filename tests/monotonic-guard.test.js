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

test('monotonic guard emits a structured event when older quote is blocked', async () => {
  const { createRealtimePricingEngine } = await loadEngine();
  let call = 0;
  const primaryProvider = {
    providerId: 'primary-provider',
    async fetchQuote() {
      call += 1;
      return {
        price: call === 1 ? 3100 : 3090,
        providerTimestamp: call === 1 ? '2026-05-19T16:00:10Z' : '2026-05-19T16:00:05Z',
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

  engine.start();
  await engine.refreshNow('m1');
  await engine.refreshNow('m2');
  const snapshot = engine.getSnapshot();
  engine.stop();

  const monotonicEvent = snapshot.events.find(
    (entry) => entry.type === 'MONOTONIC_GUARD_BLOCKED_OLD_QUOTE'
  );
  assert.ok(monotonicEvent, 'expected monotonic guard event');
});
