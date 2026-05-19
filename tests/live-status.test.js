'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

async function load() {
  const url = new URL('file://' + path.resolve(__dirname, '..', 'src', 'lib', 'live-status.js'));
  return import(url.href);
}

test('getMarketStatus() reports weekend closures correctly', async () => {
  const { getMarketStatus } = await load();

  assert.equal(getMarketStatus('2026-04-24T20:59:00Z').isOpen, true);
  assert.equal(getMarketStatus('2026-04-24T21:00:00Z').isOpen, false);
  assert.equal(getMarketStatus('2026-04-26T21:59:00Z').isOpen, false);
  assert.equal(getMarketStatus('2026-04-26T22:00:00Z').isOpen, true);
});

test('getAgeMs() returns infinity for invalid timestamps', async () => {
  const { getAgeMs } = await load();

  assert.equal(getAgeMs(null), Infinity);
  assert.equal(getAgeMs('not-a-date'), Infinity);
});

test('formatRelativeAge() returns a readable localized label', async () => {
  const { formatRelativeAge } = await load();

  assert.match(formatRelativeAge(45_000, 'en'), /sec|second|s ago|45/);
  assert.notEqual(formatRelativeAge(120_000, 'ar'), '—');
});

test('getLiveFreshness() classifies live, delayed, cached, stale, fallback, and unavailable states', async () => {
  const { getLiveFreshness, GOLD_MARKET } = await load();
  const now = Date.now();

  // live: fresh, within DELAYED_AFTER_MS, no live failure
  const live = getLiveFreshness({
    updatedAt: new Date(now - 30_000).toISOString(),
    hasLiveFailure: false,
  });
  assert.equal(live.key, 'live');
  assert.equal(live.reason, 'fresh');

  // delayed: between DELAYED_AFTER_MS and STALE_AFTER_MS, no failure → 'delayed'
  // (was previously classified as 'live' — the new bucket exposes the truth)
  const delayed = getLiveFreshness({
    updatedAt: new Date(now - (GOLD_MARKET.DELAYED_AFTER_MS + 60_000)).toISOString(),
    hasLiveFailure: false,
  });
  assert.equal(delayed.key, 'delayed');

  // cached: local fetch failed but data is still within STALE_AFTER_MS
  const cached = getLiveFreshness({
    updatedAt: new Date(now - 30_000).toISOString(),
    hasLiveFailure: true,
  });
  assert.equal(cached.key, 'cached');

  // stale: age exceeds STALE_AFTER_MS regardless of failure flag
  const stale = getLiveFreshness({
    updatedAt: new Date(now - (GOLD_MARKET.STALE_AFTER_MS + 60_000)).toISOString(),
    hasLiveFailure: true,
  });
  assert.equal(stale.key, 'stale');

  const unavailable = getLiveFreshness({ updatedAt: null, hasLiveFailure: true });
  assert.equal(unavailable.key, 'unavailable');
});

// Anti-mislabel guard: `isFallback === true` from upstream provider-adapter
// must force the `'fallback'` key regardless of how recent the file write
// timestamp is. This is the core trust invariant of the realtime pipeline —
// the upstream pipeline already detected that the live provider call failed
// and wrote a fallback snapshot; the UI must not repaint that as "Live".
test('getLiveFreshness() forces fallback when upstream is_fallback=true (anti-mislabel)', async () => {
  const { getLiveFreshness } = await load();
  const now = Date.now();

  const recentFallback = getLiveFreshness({
    updatedAt: new Date(now - 1_000).toISOString(),
    hasLiveFailure: false,
    isFallback: true,
    isFresh: true, // even if upstream claims fresh, fallback overrides
  });
  assert.equal(recentFallback.key, 'fallback');
  assert.equal(recentFallback.reason, 'upstream-fallback');
});

// Anti-mislabel guard: `isFresh === false` from upstream must classify as
// stale even when age is within the local threshold. Upstream knows best.
test('getLiveFreshness() forces stale when upstream is_fresh=false (anti-mislabel)', async () => {
  const { getLiveFreshness } = await load();
  const now = Date.now();

  const recentButNotFresh = getLiveFreshness({
    updatedAt: new Date(now - 1_000).toISOString(),
    hasLiveFailure: false,
    isFresh: false,
  });
  assert.equal(recentButNotFresh.key, 'stale');
  assert.equal(recentButNotFresh.reason, 'upstream-stale');
});

// Invariant: a result with key='live' MUST satisfy all truthfulness
// preconditions. If any precondition is violated, the bucket must not be
// 'live'. This is the single anti-mislabel safety net the rest of the UI
// relies on.
test('getLiveFreshness() never returns "live" when any truth precondition is violated', async () => {
  const { getLiveFreshness, GOLD_MARKET } = await load();
  const now = Date.now();
  const recentTs = new Date(now - 1_000).toISOString();

  // All truth-violating inputs at recent age — none may return 'live'.
  const violations = [
    { updatedAt: null },
    { updatedAt: recentTs, isFallback: true },
    { updatedAt: recentTs, isFresh: false },
    { updatedAt: recentTs, hasLiveFailure: true },
    { updatedAt: new Date(now - (GOLD_MARKET.STALE_AFTER_MS + 1_000)).toISOString() },
    { updatedAt: new Date(now - (GOLD_MARKET.DELAYED_AFTER_MS + 1_000)).toISOString() },
  ];

  for (const opts of violations) {
    const result = getLiveFreshness(opts);
    assert.notEqual(
      result.key,
      'live',
      `getLiveFreshness returned "live" for ${JSON.stringify(opts)} — anti-mislabel invariant violated`
    );
  }
});

// W-2 regression — STALE_AFTER_MS must give the freshness pill at least one
// missed cron-tick of safety margin over the gold-price-fetch workflow's
// actual hourly cadence (cron `'2 * * * 1-4'` in
// `.github/workflows/gold-price-fetch.yml`). If the workflow cadence ever
// changes, this assertion intentionally fails so the threshold is
// reconsidered together. The previous version of this test asserted a
// 6-minute cadence assumption that was never true — see
// `docs/realtime-baseline-audit.md`.
test('GOLD_MARKET thresholds match the gold-price-fetch hourly cadence', async () => {
  const { GOLD_MARKET, getLiveFreshness } = await load();
  const cronCadenceMs = 60 * 60 * 1000; // hourly

  // STALE_AFTER_MS must allow at least one full upstream cron interval of
  // tolerance — never claim live for data older than the refresh window.
  assert.ok(
    GOLD_MARKET.STALE_AFTER_MS >= cronCadenceMs,
    `STALE_AFTER_MS (${GOLD_MARKET.STALE_AFTER_MS}ms) must allow at least one hourly cron interval`
  );

  // DELAYED_AFTER_MS must be strictly between "fresh" and "stale" so users
  // see a visible delay state before the badge flips fully stale.
  assert.ok(
    GOLD_MARKET.DELAYED_AFTER_MS > 0 && GOLD_MARKET.DELAYED_AFTER_MS < GOLD_MARKET.STALE_AFTER_MS,
    `DELAYED_AFTER_MS (${GOLD_MARKET.DELAYED_AFTER_MS}ms) must sit between 0 and STALE_AFTER_MS`
  );

  // Boundary: a price that is just under the delayed threshold must still be "live".
  const now = Date.now();
  const justFresh = getLiveFreshness({
    updatedAt: new Date(now - (GOLD_MARKET.DELAYED_AFTER_MS - 1_000)).toISOString(),
    hasLiveFailure: false,
  });
  assert.equal(justFresh.key, 'live');

  // Boundary: a price just past the stale threshold must classify as "stale", even
  // when the live fetch reportedly succeeded.
  const justStale = getLiveFreshness({
    updatedAt: new Date(now - (GOLD_MARKET.STALE_AFTER_MS + 1_000)).toISOString(),
    hasLiveFailure: false,
  });
  assert.equal(justStale.key, 'stale');
});

// §22b Phase 4 — equivalence guard for the homepage's previously-duplicated
// getMarketStatus() implementation. Ensures the shared primitive stays behavior-
// compatible with the local impl that `src/pages/home.js` used to carry.
test('getMarketStatus() matches the legacy home.js open/closed rules', async () => {
  const { getMarketStatus } = await load();

  // Replicates src/pages/home.js getMarketStatus() prior to Phase 4 dedup.
  function legacy(now) {
    const utcDay = now.getUTCDay();
    const utcTime = now.getUTCHours() * 60 + now.getUTCMinutes();
    const OPEN_SUN = 22 * 60;
    const CLOSE_FRI = 21 * 60;
    let isOpen = false;
    if (utcDay === 6) isOpen = false;
    else if (utcDay === 5) isOpen = utcTime < CLOSE_FRI;
    else if (utcDay === 0) isOpen = utcTime >= OPEN_SUN;
    else isOpen = true;
    return isOpen;
  }

  // Sample every 30 minutes across a full week to catch schedule-edge drift.
  const start = new Date('2026-04-19T00:00:00Z'); // Sunday 00:00 UTC
  for (let minute = 0; minute < 7 * 24 * 60; minute += 30) {
    const sample = new Date(start.getTime() + minute * 60_000);
    const actual = getMarketStatus(sample).isOpen;
    const expected = legacy(sample);
    assert.equal(
      actual,
      expected,
      `getMarketStatus mismatch at ${sample.toISOString()} (day=${sample.getUTCDay()}, min=${sample.getUTCHours() * 60 + sample.getUTCMinutes()})`
    );
  }
});

test('getFXFreshness() classifies live, cached, stale, and unavailable FX states (W-3)', async () => {
  const { getFXFreshness, FX_MARKET } = await load();

  const now = Date.now();

  // Live: within FX_STALE_AFTER_MS, no cache failure
  const live = getFXFreshness({ fxUpdatedAt: new Date(now - 1 * 60 * 60 * 1000).toISOString() });
  assert.equal(live.key, 'live');
  assert.ok(Number.isFinite(live.ageMs));

  // Cached: within FX_STALE_AFTER_MS but hasCacheFailure
  const cached = getFXFreshness({
    fxUpdatedAt: new Date(now - 1 * 60 * 60 * 1000).toISOString(),
    hasCacheFailure: true,
  });
  assert.equal(cached.key, 'cached');

  // Stale: older than FX_STALE_AFTER_MS (26 h)
  const stale = getFXFreshness({
    fxUpdatedAt: new Date(now - FX_MARKET.FX_STALE_AFTER_MS - 60_000).toISOString(),
  });
  assert.equal(stale.key, 'stale');

  // Unavailable: missing timestamp
  const unavailable = getFXFreshness({ fxUpdatedAt: null });
  assert.equal(unavailable.key, 'unavailable');
  assert.equal(unavailable.ageMs, Infinity);
});
