'use strict';

/**
 * Tests for src/lib/alert-engine.js
 * Validates alert creation, triggering, persistence, import/export, and limits.
 */

const { test, beforeEach, mock } = require('node:test');
const assert = require('node:assert/strict');

// Mock localStorage for Node.js environment
const storage = {};
const localStorageMock = {
  getItem: (key) => storage[key] ?? null,
  setItem: (key, value) => {
    storage[key] = value;
  },
  removeItem: (key) => {
    delete storage[key];
  },
  clear: () => {
    for (const key of Object.keys(storage)) delete storage[key];
  },
};

// Mock globals
globalThis.localStorage = localStorageMock;
globalThis.window = globalThis.window || {};
globalThis.window.AudioContext = undefined;
globalThis.window.webkitAudioContext = undefined;

// Avoid importing ESM directly — use dynamic import for testing.

let createAlertEngine;

test('alert-engine module loads', async () => {
  const mod = await import('../src/lib/alert-engine.js');
  createAlertEngine = mod.createAlertEngine;
  assert.ok(typeof createAlertEngine === 'function');
});

test('creates engine with empty alerts initially', async () => {
  localStorageMock.clear();
  const mod = await import('../src/lib/alert-engine.js');
  const engine = mod.createAlertEngine({});
  assert.deepEqual(engine.getAlerts(), []);
  assert.equal(engine.getActiveCount(), 0);
});

test('addAlert creates a valid alert', async () => {
  localStorageMock.clear();
  const mod = await import('../src/lib/alert-engine.js');
  const engine = mod.createAlertEngine({});
  const result = engine.addAlert({ scope: 'spot', direction: 'above', target: 2500 });
  assert.ok(result.success);
  assert.equal(result.alert.scope, 'spot');
  assert.equal(result.alert.direction, 'above');
  assert.equal(result.alert.target, 2500);
  assert.equal(result.alert.status, 'active');
  assert.equal(engine.getActiveCount(), 1);
});

test('addAlert rejects invalid target', async () => {
  localStorageMock.clear();
  const mod = await import('../src/lib/alert-engine.js');
  const engine = mod.createAlertEngine({});
  const result = engine.addAlert({ scope: 'spot', direction: 'above', target: 0 });
  assert.equal(result.success, false);
  assert.equal(result.error, 'invalid_target');
});

test('addAlert rejects duplicate', async () => {
  localStorageMock.clear();
  const mod = await import('../src/lib/alert-engine.js');
  const engine = mod.createAlertEngine({});
  engine.addAlert({ scope: 'spot', direction: 'above', target: 2500 });
  const result = engine.addAlert({ scope: 'spot', direction: 'above', target: 2500 });
  assert.equal(result.success, false);
  assert.equal(result.error, 'duplicate');
});

test('addAlert respects max limit of 10', async () => {
  localStorageMock.clear();
  const mod = await import('../src/lib/alert-engine.js');
  const engine = mod.createAlertEngine({});
  for (let i = 1; i <= 10; i++) {
    engine.addAlert({ scope: 'spot', direction: 'above', target: 2000 + i });
  }
  const result = engine.addAlert({ scope: 'spot', direction: 'above', target: 3000 });
  assert.equal(result.success, false);
  assert.equal(result.error, 'max_reached');
  assert.equal(engine.getActiveCount(), 10);
});

test('check triggers alert when price crosses threshold (above)', async () => {
  localStorageMock.clear();
  const mod = await import('../src/lib/alert-engine.js');
  let triggered = null;
  const engine = mod.createAlertEngine({
    onTrigger: (alert, price) => {
      triggered = { alert, price };
    },
  });
  engine.addAlert({ scope: 'spot', direction: 'above', target: 2500 });
  engine.check(2400, 280); // below target — no trigger
  assert.equal(triggered, null);
  engine.check(2501, 290); // above target — trigger
  assert.ok(triggered);
  assert.equal(triggered.alert.status, 'fired');
  assert.equal(triggered.price, 2501);
});

test('check triggers alert when price crosses threshold (below)', async () => {
  localStorageMock.clear();
  const mod = await import('../src/lib/alert-engine.js');
  let triggered = null;
  const engine = mod.createAlertEngine({
    onTrigger: (alert, price) => {
      triggered = { alert, price };
    },
  });
  engine.addAlert({ scope: 'spot', direction: 'below', target: 2400 });
  engine.check(2500, 290); // above target — no trigger
  assert.equal(triggered, null);
  engine.check(2399, 278); // below target — trigger
  assert.ok(triggered);
  assert.equal(triggered.alert.status, 'fired');
});

test('removeAlert removes by id', async () => {
  localStorageMock.clear();
  const mod = await import('../src/lib/alert-engine.js');
  const engine = mod.createAlertEngine({});
  const { alert } = engine.addAlert({ scope: 'spot', direction: 'above', target: 2500 });
  assert.equal(engine.getActiveCount(), 1);
  engine.removeAlert(alert.id);
  assert.equal(engine.getActiveCount(), 0);
});

test('exportAlerts returns valid JSON with version', async () => {
  localStorageMock.clear();
  const mod = await import('../src/lib/alert-engine.js');
  const engine = mod.createAlertEngine({});
  engine.addAlert({ scope: 'spot', direction: 'above', target: 2500 });
  const json = engine.exportAlerts();
  const parsed = JSON.parse(json);
  assert.equal(parsed.version, 2);
  assert.ok(Array.isArray(parsed.alerts));
  assert.equal(parsed.alerts.length, 1);
});

test('importAlerts imports valid JSON', async () => {
  localStorageMock.clear();
  const mod = await import('../src/lib/alert-engine.js');
  const engine = mod.createAlertEngine({});
  const json = JSON.stringify({
    version: 2,
    alerts: [
      { scope: 'spot', direction: 'above', target: 2500 },
      { scope: 'uae24', direction: 'below', target: 280 },
    ],
  });
  const result = engine.importAlerts(json);
  assert.ok(result.success);
  assert.equal(result.imported, 2);
  assert.equal(engine.getActiveCount(), 2);
});

test('importAlerts rejects invalid JSON', async () => {
  localStorageMock.clear();
  const mod = await import('../src/lib/alert-engine.js');
  const engine = mod.createAlertEngine({});
  const result = engine.importAlerts('not json');
  assert.equal(result.success, false);
  assert.equal(result.error, 'invalid_json');
});

test('getWhatsAppLink generates valid URL', async () => {
  localStorageMock.clear();
  const mod = await import('../src/lib/alert-engine.js');
  const engine = mod.createAlertEngine({});
  const { alert } = engine.addAlert({ scope: 'spot', direction: 'above', target: 2500 });
  const link = engine.getWhatsAppLink(alert);
  assert.ok(link.startsWith('https://wa.me/'));
  assert.ok(link.includes('2500'));
  assert.ok(link.includes('goldtickerlive'));
});

test('clearFired removes only fired alerts', async () => {
  localStorageMock.clear();
  const mod = await import('../src/lib/alert-engine.js');
  const engine = mod.createAlertEngine({});
  engine.addAlert({ scope: 'spot', direction: 'above', target: 2500 });
  engine.addAlert({ scope: 'spot', direction: 'below', target: 2300 });
  // Fire one
  engine.check(2600, 300);
  assert.equal(engine.getTriggeredAlerts().length, 1);
  assert.equal(engine.getActiveAlerts().length, 1);
  engine.clearFired();
  assert.equal(engine.getTriggeredAlerts().length, 0);
  assert.equal(engine.getActiveAlerts().length, 1);
});

test('reactivateAlert moves fired alert back to active', async () => {
  localStorageMock.clear();
  const mod = await import('../src/lib/alert-engine.js');
  const engine = mod.createAlertEngine({});
  const { alert } = engine.addAlert({ scope: 'spot', direction: 'above', target: 2500 });
  engine.check(2600, 300); // triggers it
  assert.equal(engine.getActiveCount(), 0);
  engine.reactivateAlert(alert.id, 2700);
  assert.equal(engine.getActiveCount(), 1);
  const reactivated = engine.getActiveAlerts()[0];
  assert.equal(reactivated.target, 2700);
});

test('sound toggle works', async () => {
  localStorageMock.clear();
  const mod = await import('../src/lib/alert-engine.js');
  const engine = mod.createAlertEngine({});
  assert.equal(engine.isSoundEnabled(), false);
  engine.toggleSound(true);
  assert.equal(engine.isSoundEnabled(), true);
  engine.toggleSound(false);
  assert.equal(engine.isSoundEnabled(), false);
});

test('onCountChange callback fires on add/remove', async () => {
  localStorageMock.clear();
  const mod = await import('../src/lib/alert-engine.js');
  const counts = [];
  const engine = mod.createAlertEngine({
    onCountChange: (c) => counts.push(c),
  });
  engine.addAlert({ scope: 'spot', direction: 'above', target: 2500 });
  engine.addAlert({ scope: 'spot', direction: 'below', target: 2300 });
  const { alert } = engine.addAlert({ scope: 'uae24', direction: 'above', target: 290 });
  engine.removeAlert(alert.id);
  // Initial (0) + add (1) + add (2) + add (3) + remove (2)
  assert.deepEqual(counts, [0, 1, 2, 3, 2]);
});

test('v1 migration works', async () => {
  localStorageMock.clear();
  // Set up v1 data
  localStorageMock.setItem(
    'gold_price_alerts',
    JSON.stringify([{ scope: 'spot', direction: 'above', target: 2500 }])
  );
  const mod = await import('../src/lib/alert-engine.js');
  const engine = mod.createAlertEngine({});
  assert.equal(engine.getActiveCount(), 1);
  const alert = engine.getActiveAlerts()[0];
  assert.equal(alert.target, 2500);
  // v2 key should now exist
  assert.ok(localStorageMock.getItem('gtl_alerts_v2'));
});
