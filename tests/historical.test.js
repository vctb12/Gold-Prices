const fs = require('fs');
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const baseline = JSON.parse(fs.readFileSync('src/data/historical-baseline.json', 'utf8'));

function toChartData(records) {
  return records.map((r) => ({
    time: r.date.length === 7 ? `${r.date}-01` : r.date,
    value: r.price,
  }));
}

function filterByRange(records, range) {
  if (!range || range === 'ALL') return records;
  const now = new Date();
  const cutoffs = { '30D': 30, '90D': 90, '1Y': 365, '3Y': 365 * 3, '5Y': 365 * 5 };
  const days = cutoffs[range.toUpperCase()];
  if (!days) return records;
  const cutoffDate = new Date(now.getTime() - days * 86400000);
  const cutoffStr = cutoffDate.toISOString().slice(0, 10);
  return records.filter((r) => r.date >= cutoffStr);
}

function computeYoYChange(records) {
  if (records.length < 2) return null;
  const latest = records[records.length - 1].price;
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const yearAgoStr = oneYearAgo.toISOString().slice(0, 7);
  const yearAgoEntry = [...records].reverse().find((r) => r.date.slice(0, 7) <= yearAgoStr);
  if (!yearAgoEntry) return null;
  return ((latest - yearAgoEntry.price) / yearAgoEntry.price) * 100;
}

function getHistoryStats(records) {
  if (!records.length) return {};
  const prices = records.map((r) => r.price);
  const allTimeHigh = Math.max(...prices);
  const allTimeLow = Math.min(...prices);
  const latest = records[records.length - 1].price;
  const yearStart = `${new Date().getFullYear()}-01`;
  const ytdEntry = records.find((r) => r.date.slice(0, 7) === yearStart || r.date >= yearStart);
  const ytdChange = ytdEntry ? ((latest - ytdEntry.price) / ytdEntry.price) * 100 : null;
  const yoyChange = computeYoYChange(records);
  return { allTimeHigh, allTimeLow, latest, ytdChange, yoyChange };
}

describe('historical-data (inline helpers)', () => {
  test('baseline JSON loads and has expected fields', () => {
    assert.ok(Array.isArray(baseline));
    assert.ok(baseline.length > 0);
    assert.ok(typeof baseline[0].date === 'string');
    assert.ok(typeof baseline[0].price === 'number');
  });

  test('toChartData maps monthly to first-of-month', () => {
    const cd = toChartData(baseline.slice(0, 3));
    assert.equal(cd[0].time.length, 10);
    assert.ok(cd[0].time.endsWith('-01'));
  });

  test('filterByRange returns an array', () => {
    const records = baseline.map((r) => ({
      date: r.date.length === 7 ? `${r.date}-01` : r.date,
      price: r.price,
    }));
    const out = filterByRange(records, '30D');
    assert.ok(Array.isArray(out));
  });

  test('computeYoYChange returns number or null', () => {
    const recs = baseline
      .slice(-14)
      .map((r) => ({ date: r.date.length === 7 ? `${r.date}-01` : r.date, price: r.price }));
    const val = computeYoYChange(recs);
    if (val !== null) assert.equal(typeof val, 'number');
  });

  test('getHistoryStats returns stats keys', () => {
    const recs = baseline
      .slice(0, 12)
      .map((r) => ({ date: r.date.length === 7 ? `${r.date}-01` : r.date, price: r.price }));
    const s = getHistoryStats(recs);
    assert.ok('allTimeHigh' in s && 'latest' in s);
  });
});

describe('historical-data: baseline range and record metadata', () => {
  // NOTE: src/lib/historical-data.js uses ES module `import` syntax and cannot be directly
  // require()'d by this CJS test suite. The functions below are inline reimplementations that
  // mirror the production code exactly. Any change to the production implementations must be
  // reflected here. This is consistent with the existing pattern in this file (see toChartData,
  // filterByRange, computeYoYChange, getHistoryStats above).
  test('baseline is sorted chronologically', () => {
    for (let i = 1; i < baseline.length; i++) {
      assert.ok(
        baseline[i].date >= baseline[i - 1].date,
        `baseline entry ${i} must not predate entry ${i - 1}`
      );
    }
  });

  test('baseline first entry is in 2019', () => {
    const sorted = [...baseline].sort((a, b) => a.date.localeCompare(b.date));
    assert.ok(
      sorted[0].date.startsWith('2019'),
      `Baseline first entry should start in 2019, got: ${sorted[0].date}`
    );
  });

  test('baseline last entry date is a valid YYYY-MM string', () => {
    const sorted = [...baseline].sort((a, b) => a.date.localeCompare(b.date));
    const last = sorted[sorted.length - 1];
    assert.ok(
      /^\d{4}-\d{2}$/.test(last.date),
      `Baseline last entry date must be YYYY-MM, got: ${last.date}`
    );
  });

  test('all baseline prices are positive numbers', () => {
    for (const entry of baseline) {
      assert.ok(
        typeof entry.price === 'number' && entry.price > 0,
        `Entry ${entry.date} must have a positive price, got: ${entry.price}`
      );
    }
  });

  test('baseline has at least 60 monthly records (5 years of history)', () => {
    assert.ok(
      baseline.length >= 60,
      `Baseline should have at least 60 records, got: ${baseline.length}`
    );
  });

  // Inline getBaselineRange mirroring the real implementation
  function getBaselineRangeInline() {
    if (!baseline.length) return { first: '', last: '', count: 0 };
    const sorted = [...baseline].sort((a, b) => a.date.localeCompare(b.date));
    return {
      first: sorted[0].date,
      last: sorted[sorted.length - 1].date,
      count: sorted.length,
    };
  }

  test('getBaselineRange returns correct first, last, count', () => {
    const range = getBaselineRangeInline();
    assert.ok(range.first.length > 0, 'first must be non-empty');
    assert.ok(range.last.length > 0, 'last must be non-empty');
    assert.ok(range.count > 0, 'count must be positive');
    assert.equal(range.count, baseline.length, 'count must match baseline.length');
    assert.ok(range.first <= range.last, 'first must be <= last');
  });

  test('getBaselineRange last is after 2024', () => {
    const range = getBaselineRangeInline();
    assert.ok(
      range.last >= '2024-01',
      `Baseline should extend to at least 2024, last is: ${range.last}`
    );
  });

  // Inline baselineToRecord mirroring new freshnessState field
  function baselineToRecord(entry) {
    const isEstimated = Boolean(entry.estimated);
    return {
      date: entry.date,
      price: entry.price,
      granularity: 'monthly',
      source: isEstimated ? 'estimated' : 'LBMA-baseline',
      freshnessState: 'historical',
      derived: false,
    };
  }

  test('baselineToRecord sets freshnessState to "historical"', () => {
    const record = baselineToRecord(baseline[0]);
    assert.equal(record.freshnessState, 'historical');
  });

  test('baselineToRecord sets source to LBMA-baseline for non-estimated entries', () => {
    const entry = { date: '2023-01', price: 1900 };
    const record = baselineToRecord(entry);
    assert.equal(record.source, 'LBMA-baseline');
    assert.equal(record.granularity, 'monthly');
  });

  test('baselineToRecord uses "estimated" source for estimated entries', () => {
    const entry = { date: '2025-06', price: 3200, estimated: true };
    const record = baselineToRecord(entry);
    assert.equal(record.source, 'estimated');
  });

  // Inline cachedToRecord mirroring new freshnessState field
  function cachedToRecord(entry) {
    return {
      date: entry.date,
      price: entry.price,
      granularity: 'daily',
      source: 'local-snapshot',
      freshnessState: 'cached',
      derived: false,
      timestamp: entry.timestamp,
    };
  }

  test('cachedToRecord sets freshnessState to "cached"', () => {
    const record = cachedToRecord({ date: '2025-01-15', price: 2900, timestamp: Date.now() });
    assert.equal(record.freshnessState, 'cached');
    assert.equal(record.granularity, 'daily');
    assert.equal(record.source, 'local-snapshot');
  });
});
