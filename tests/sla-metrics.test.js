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

test('SLA metrics compute p95/p99 refresh intervals and latency', async () => {
  const { createRealtimePricingEngine } = await loadEngine();
  let tick = 0;
  const base = Date.parse('2026-05-19T16:00:00Z');
  const nowFn = () => base + tick;

  const provider = {
    providerId: 'primary-provider',
    async fetchQuote() {
      tick += 150;
      return {
        price: 3200 + tick / 1000,
        providerTimestamp: new Date(base + tick).toISOString(),
        fetchedAt: new Date(base + tick).toISOString(),
        providerId: 'primary-provider',
        source: 'primary-provider',
      };
    },
  };

  const engine = createRealtimePricingEngine({
    primaryProvider: provider,
    nowFn,
    config: { activePollMs: 999999, hiddenPollMs: 999999, jitterMs: 0 },
  });

  engine.start();
  for (let i = 0; i < 5; i += 1) {
    tick += 5000;
    await engine.refreshNow(`s${i}`);
  }
  const snapshot = engine.getSnapshot();
  engine.stop();

  assert.ok(Number.isFinite(snapshot.metrics.p95RefreshIntervalMs));
  assert.ok(Number.isFinite(snapshot.metrics.p99RefreshIntervalMs));
  assert.ok(Number.isFinite(snapshot.metrics.p95ApplyLatencyMs));
  assert.ok(Number.isFinite(snapshot.metrics.p99ApplyLatencyMs));
});
