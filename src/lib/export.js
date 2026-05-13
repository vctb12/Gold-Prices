/**
 * Export utilities — CSV, JSON, Archive, Historical
 * ═══════════════════════════════════════════════════════════════════════════
 * Supports:
 *   exportCSV(countries, karatCode, prices, lang)   — current price snapshot
 *   exportJSON(STATE, prices)                        — full structured snapshot
 *   exportArchiveCSV(history, karatCode, aedPeg)     — cached daily archive
 *   exportHistoricalCSV(records, karatCode)          — monthly baseline + cached
 */

import { CONSTANTS } from '../config/index.js';
import { KARATS } from '../config/index.js';

// ─── helpers ──────────────────────────────────────────────────────────────────

/**
 * Derive a consistent per-row freshness state string for CSV/JSON exports.
 * Uses both `source` and `granularity` to cover all record shapes.
 *
 * @param {{ source?: string, granularity?: string, freshnessState?: string }} record
 * @returns {'live'|'historical'|'cached'}
 */
function rowFreshnessState(record) {
  if (record.freshnessState) return record.freshnessState;
  if (record.source === 'live' || record.granularity === 'live') return 'live';
  if (record.granularity === 'monthly') return 'historical';
  return 'cached';
}

function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function csvRow(cells) {
  return cells.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',');
}

function dateStamp(value = new Date()) {
  return new Date(value).toISOString().slice(0, 10);
}

function historyDateLabel(value) {
  if (value instanceof Date) return dateStamp(value);
  if (typeof value === 'string' && /^\d{4}-\d{2}$/.test(value)) return `${value}-01`;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  return dateStamp();
}

// ─────────────────────────────────────────────────────────────────────────────
// CURRENT PRICE SNAPSHOT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Export the current gold price snapshot for all countries as a CSV file and
 * trigger a browser download.
 *
 * @param {Array<{ nameEn: string, nameAr: string, currency: string, decimals: number }>} countries
 * @param {string}  karatCode  Karat code to export (e.g. `'24'`).
 * @param {Record<string, Record<string, { gram: number, oz: number }|null>>} prices  Output from `calculateAllPrices`.
 * @param {'en'|'ar'} [lang='en']
 */
export function exportCSV(countries, karatCode, prices, lang = 'en') {
  if (!prices || !prices[karatCode]) return;
  const karat = KARATS.find((k) => k.code === karatCode);
  const karatLabel = lang === 'ar' ? karat?.labelAr : karat?.labelEn;
  const ts = new Date().toISOString();
  const purity = ((parseInt(karatCode, 10) / 24) * 100).toFixed(1);

  const header = [
    `# Gold Ticker Live — ${karatLabel} Snapshot`,
    `# Exported: ${ts}`,
    '# Source: goldpricez.com / open.er-api.com',
    `# AED peg: ${CONSTANTS.AED_PEG} fixed (UAE Central Bank)`,
    '# Note: Estimated bullion-equivalent values. Not financial advice.',
    '',
    csvRow(['Country', 'Currency', 'Price per Gram', 'Price per Ounce', 'Karat', 'Purity %']),
  ];

  const dataRows = [];
  for (const country of countries) {
    const priceData = prices[karatCode]?.[country.currency];
    if (priceData) {
      dataRows.push(
        csvRow([
          lang === 'ar' ? country.nameAr : country.nameEn,
          country.currency,
          priceData.gram?.toFixed(country.decimals) ?? '—',
          priceData.oz?.toFixed(country.decimals) ?? '—',
          `${karatCode}K`,
          `${purity}%`,
        ])
      );
    }
  }

  downloadFile(
    [...header, ...dataRows].join('\n'),
    `goldtickerlive-current-snapshot-${dateStamp()}.csv`,
    'text/csv;charset=utf-8;'
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// JSON SNAPSHOT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Export a full structured JSON snapshot (spot price, FX rates, all karat×country
 * prices, freshness metadata, disclaimer) and trigger a browser download.
 *
 * @param {object} STATE  The shared page-level state object.
 * @param {Record<string, Record<string, { gram: number, oz: number }|null>>} prices
 */
export function exportJSON(STATE, prices) {
  const hasLiveFailure = Boolean(STATE.freshness?.hasLiveFailure);
  const freshnessState = hasLiveFailure
    ? 'cached'
    : STATE.goldPriceUsdPerOz
      ? 'live'
      : 'unavailable';
  const payload = {
    exportedAt: new Date().toISOString(),
    goldPriceUsdPerOz: STATE.goldPriceUsdPerOz,
    goldUpdatedAt: STATE.freshness?.goldUpdatedAt,
    fxUpdatedAt: STATE.freshness?.fxUpdatedAt,
    freshnessState,
    dataSource: 'gold-api.com / open.er-api.com',
    dataResolution: 'live snapshot — spot-linked reference estimate',
    selectedRange: STATE.range || null,
    selectedCurrency: STATE.selectedCurrency || null,
    selectedKarat: STATE.selectedKarat || null,
    selectedUnit: STATE.selectedUnit || null,
    aedPeg: CONSTANTS.AED_PEG,
    aedPegNote: 'Fixed UAE Central Bank rate since 1997',
    troyOzGrams: CONSTANTS.TROY_OZ_GRAMS,
    prices,
    rates: STATE.rates,
    disclaimer:
      'Reference / spot-linked estimates only. Retail prices may differ because of making charges, VAT, and dealer premiums. AED uses the fixed central-bank peg 3.6725.',
    limitations:
      'Historical ranges beyond 90 days use monthly LBMA baseline data and are not intraday prices. Short ranges use cached browser snapshots.',
  };
  downloadFile(
    JSON.stringify(payload, null, 2),
    `goldtickerlive-snapshot-${dateStamp()}.json`,
    'application/json'
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ARCHIVE CSV — daily cached snapshots (up to 90 days)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Export the user's locally-cached daily price history (up to 90 days) as a
 * CSV file. Calls `alert()` and returns early if no history exists.
 *
 * @param {Array<{ date: string, price: number }>} history  Daily snapshot array from `STATE.history`.
 * @param {string} [karatCode='24']            Karat to compute prices for.
 * @param {number} [aedPeg=CONSTANTS.AED_PEG]  AED/USD peg rate.
 */
export function exportArchiveCSV(history, karatCode = '24', aedPeg = CONSTANTS.AED_PEG) {
  if (!history?.length) {
    alert(
      'No cached history available yet. Visit the tracker daily to build a price archive, or export the full historical baseline instead.'
    );
    return;
  }

  const TROY = CONSTANTS.TROY_OZ_GRAMS;
  const purity = parseInt(karatCode, 10) / 24;

  const lines = [
    `# Gold Ticker Live — Daily Archive (${karatCode}K)`,
    `# Exported: ${new Date().toISOString()}`,
    '# Source: locally cached snapshots (up to 90 days)',
    `# AED peg: ${aedPeg} fixed (UAE Central Bank)`,
    '# Note: Derived from XAU/USD spot. Not financial advice.',
    '',
    csvRow([
      'Date',
      'XAU/USD (spot)',
      `${karatCode}K USD/gram`,
      `${karatCode}K AED/gram`,
      `${karatCode}K USD/oz`,
      `${karatCode}K AED/oz`,
      'Data Source',
    ]),
  ];

  const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));
  for (const entry of sorted) {
    if (!entry.price) continue;
    const usdGram = (entry.price * purity) / TROY;
    const aedGram = usdGram * aedPeg;
    const usdOz = entry.price * purity;
    const aedOz = usdOz * aedPeg;
    lines.push(
      csvRow([
        entry.date,
        entry.price.toFixed(2),
        usdGram.toFixed(3),
        aedGram.toFixed(3),
        usdOz.toFixed(2),
        aedOz.toFixed(2),
        'local-snapshot',
      ])
    );
  }

  downloadFile(
    lines.join('\n'),
    `goldtickerlive-archive-${karatCode}k-${dateStamp()}.csv`,
    'text/csv;charset=utf-8;'
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HISTORICAL BASELINE CSV — monthly 2019-present + daily cache merged
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Export the unified historical price dataset (LBMA monthly baseline merged
 * with locally-cached daily snapshots) as a CSV file.
 *
 * @param {Array<{ date: string, price: number, granularity: string, source: string }>} records
 *   Normalised history records from `getUnifiedHistory()`.
 * @param {string} [karatCode='24']  Karat to compute prices for.
 */
export function exportHistoricalCSV(records, karatCode = '24') {
  if (!records?.length) return;

  const TROY = CONSTANTS.TROY_OZ_GRAMS;
  const AED = CONSTANTS.AED_PEG;
  const purity = parseInt(karatCode, 10) / 24;

  // Identify the actual date range covered by these records
  const dates = records.map((r) => String(r.date)).sort();
  const firstDate = dates[0] ?? '—';
  const lastDate = dates[dates.length - 1] ?? '—';
  const hasBaseline = records.some((r) => r.source === 'LBMA-baseline');
  const hasDaily = records.some((r) => r.granularity === 'daily');
  const dataResolution =
    hasBaseline && hasDaily
      ? 'mixed: monthly LBMA baseline + daily cached snapshots'
      : hasBaseline
        ? 'monthly LBMA baseline only'
        : 'daily cached snapshots only';

  const lines = [
    `# Gold Ticker Live — Historical Gold Prices (${karatCode}K)`,
    `# Exported: ${new Date().toISOString()}`,
    `# Coverage: ${firstDate} → ${lastDate} (${records.length} records)`,
    `# Data resolution: ${dataResolution}`,
    '# Monthly baseline: LBMA PM fix averages (public domain records)',
    '# Daily entries: locally cached browser snapshots (up to 90 days)',
    `# AED peg: ${AED} fixed (UAE Central Bank since 1997)`,
    '# Freshness: baseline=historical · daily=cached · see Source column',
    '# Disclaimer: Bullion-equivalent spot-linked estimates only. Not retail/shop pricing.',
    '# Note: Actual retail prices include making charges, VAT, and dealer premiums.',
    '',
    csvRow([
      'Date',
      'Granularity',
      'XAU/USD',
      `${karatCode}K USD/gram`,
      `${karatCode}K AED/gram`,
      'Source',
      'Freshness state',
    ]),
  ];

  for (const r of records) {
    const usdGram = (r.price * purity) / TROY;
    const aedGram = usdGram * AED;
    lines.push(
      csvRow([
        r.date,
        r.granularity,
        r.price.toFixed(2),
        usdGram.toFixed(3),
        aedGram.toFixed(3),
        r.source,
        rowFreshnessState(r),
      ])
    );
  }

  downloadFile(
    lines.join('\n'),
    `goldtickerlive-full-history-${karatCode}k-${dateStamp()}.csv`,
    'text/csv;charset=utf-8;'
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CHART CSV — currently visible chart slice
// ─────────────────────────────────────────────────────────────────────────────

export function exportChartCSV(rows, range, karatCode = '24') {
  if (!rows?.length) return;
  const TROY = CONSTANTS.TROY_OZ_GRAMS;
  const AED = CONSTANTS.AED_PEG;
  const purity = parseInt(karatCode, 10) / 24;

  const startDate = historyDateLabel(rows[0]?.date);
  const endDate = historyDateLabel(rows[rows.length - 1]?.date);
  const hasMonthly = rows.some(
    (row) => row.granularity === 'monthly' || String(row.date).length === 7
  );
  const hasLive = rows.some((row) => row.source === 'live' || row.granularity === 'live');
  const resolution = hasMonthly
    ? 'mixed: monthly LBMA baseline + recent snapshots'
    : 'daily cached snapshots';
  const freshnessState = hasLive ? 'live+cached' : hasMonthly ? 'historical+cached' : 'cached';
  const lines = [
    `# Gold Ticker Live — Visible Chart Range (${karatCode}K, ${range || 'ALL'})`,
    `# Exported: ${new Date().toISOString()}`,
    `# Range filter: ${range || 'ALL'} · ${startDate} → ${endDate} · points: ${rows.length}`,
    `# Data resolution: ${resolution}`,
    `# Freshness state: ${freshnessState}`,
    `# AED peg: ${AED} fixed (UAE Central Bank)`,
    '# Disclaimer: Reference / spot-linked estimates only. Not retail or shop pricing.',
    '# Note: Actual retail prices include making charges, VAT, and dealer premiums.',
    '',
    csvRow([
      'Date',
      'XAU/USD (spot)',
      `${karatCode}K USD/gram`,
      `${karatCode}K AED/gram`,
      'Source',
      'Freshness state',
    ]),
  ];

  const sorted = [...rows].sort((a, b) => {
    const da = a.date instanceof Date ? a.date : new Date(a.date);
    const db = b.date instanceof Date ? b.date : new Date(b.date);
    return da - db;
  });

  for (const r of sorted) {
    const spot = r.spot ?? r.price;
    if (!spot) continue;
    const dateStr = r.date instanceof Date ? r.date.toISOString().slice(0, 10) : String(r.date);
    const usdGram = (spot * purity) / TROY;
    const aedGram = usdGram * AED;
    const rowState = rowFreshnessState(r);
    lines.push(
      csvRow([
        dateStr,
        spot.toFixed(2),
        usdGram.toFixed(3),
        aedGram.toFixed(3),
        r.source || 'baseline',
        rowState,
      ])
    );
  }

  downloadFile(
    lines.join('\n'),
    `goldtickerlive-range-${startDate}-to-${endDate}.csv`,
    'text/csv;charset=utf-8;'
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// WATCHLIST CSV — favorite currencies at current prices
// ─────────────────────────────────────────────────────────────────────────────

export function exportWatchlistCSV({
  favorites,
  countries,
  karatCode,
  priceFor,
  spot,
  selectedUnit,
  selectedCurrency,
  lang = 'en',
}) {
  if (!favorites?.length || !spot) return;

  const karat = KARATS.find((k) => k.code === String(karatCode));
  const karatLabel = lang === 'ar' ? karat?.labelAr : karat?.labelEn;
  const _purity = parseInt(karatCode, 10) / 24;

  const lines = [
    `# Gold Ticker Live — Market Watchlist (${karatCode}K, ${selectedUnit})`,
    `# Exported: ${new Date().toISOString()}`,
    `# XAU/USD at export time: ${spot.toFixed(2)}`,
    `# Karat: ${karatLabel || karatCode + 'K'} · Unit: ${selectedUnit}`,
    '# Note: Spot-linked estimates. Not financial advice.',
    '',
    csvRow(['Currency', 'Country', 'Price', 'Unit', 'Karat', 'Is selected view']),
  ];

  for (const cur of favorites) {
    const country = countries.find((c) => c.currency === cur);
    const p = priceFor({ currency: cur, karat: karatCode, unit: selectedUnit, spot });
    const name = lang === 'ar' ? country?.nameAr || country?.nameEn : country?.nameEn;
    lines.push(
      csvRow([
        cur,
        name || '—',
        p ? p.toFixed(country?.decimals ?? 2) : '—',
        selectedUnit,
        `${karatCode}K`,
        cur === selectedCurrency ? 'yes' : 'no',
      ])
    );
  }

  downloadFile(
    lines.join('\n'),
    `goldtickerlive-watchlist-${karatCode}k-${selectedCurrency}-${dateStamp()}.csv`,
    'text/csv;charset=utf-8;'
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CURRENT VIEW CSV — all markets at current prices (compare-board snapshot)
// ─────────────────────────────────────────────────────────────────────────────

export function exportCurrentViewCSV({
  countries,
  karatCode,
  priceFor,
  spot,
  selectedUnit,
  selectedCurrency,
  lang = 'en',
}) {
  if (!spot) return;

  const karat = KARATS.find((k) => k.code === String(karatCode));
  const karatLabel = lang === 'ar' ? karat?.labelAr : karat?.labelEn;

  const lines = [
    `# Gold Ticker Live — Current View Snapshot (${karatCode}K, ${selectedUnit})`,
    `# Exported: ${new Date().toISOString()}`,
    `# XAU/USD at export time: ${spot.toFixed(2)}`,
    `# Karat: ${karatLabel || karatCode + 'K'} · Unit: ${selectedUnit}`,
    '# Note: Spot-linked estimates only. Not financial advice.',
    '',
    csvRow(['Country', 'Currency', 'Price', 'Unit', 'Is selected currency']),
  ];

  for (const c of countries) {
    const p = priceFor({ currency: c.currency, karat: karatCode, unit: selectedUnit, spot });
    const name = lang === 'ar' ? c.nameAr || c.nameEn : c.nameEn;
    lines.push(
      csvRow([
        name,
        c.currency,
        p ? p.toFixed(c.decimals ?? 2) : '—',
        selectedUnit,
        c.currency === selectedCurrency ? 'yes' : 'no',
      ])
    );
  }

  downloadFile(
    lines.join('\n'),
    `goldtickerlive-current-snapshot-${dateStamp()}.csv`,
    'text/csv;charset=utf-8;'
  );
}

export function exportComparisonCSV({
  countries,
  karatCodes,
  priceFor,
  spot,
  freshness,
  lang = 'en',
}) {
  if (!spot || !countries?.length || !karatCodes?.length) return;

  const lines = [
    '# Gold Ticker Live — Comparison Snapshot',
    `# Exported: ${new Date().toISOString()}`,
    `# Gold source timestamp: ${freshness?.goldUpdatedAt || 'unavailable'}`,
    `# FX source timestamp: ${freshness?.fxUpdatedAt || 'unavailable'}`,
    `# Live status: ${freshness?.hasLiveFailure ? 'cached/stale reference' : 'live snapshot'}`,
    `# AED peg: ${CONSTANTS.AED_PEG} fixed (UAE Central Bank)`,
    '# Note: Reference / spot-linked prices only. Retail quotes may differ due to making charges, VAT, and dealer premiums.',
    '',
    csvRow([
      'Country',
      'Currency',
      'Karat',
      'Price per gram',
      'FX source',
      'Freshness',
      'AED peg note',
    ]),
  ];

  countries.forEach((country) => {
    karatCodes.forEach((karatCode) => {
      const price = priceFor({
        currency: country.currency,
        karat: karatCode,
        unit: 'gram',
        spot,
      });
      lines.push(
        csvRow([
          lang === 'ar' ? country.nameAr || country.nameEn : country.nameEn,
          country.currency,
          `${karatCode}K`,
          price ? price.toFixed(country.decimals ?? 2) : 'Unavailable',
          country.currency === 'AED' ? 'AED fixed peg 3.6725' : 'open.er-api.com',
          freshness?.hasLiveFailure ? 'cached / delayed reference' : 'live / current reference',
          country.currency === 'AED' ? 'AED uses fixed peg 3.6725' : '',
        ])
      );
    });
  });

  downloadFile(
    lines.join('\n'),
    `goldtickerlive-comparison-${dateStamp()}.csv`,
    'text/csv;charset=utf-8;'
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BRIEF TEXT — market brief as plain text file
// ─────────────────────────────────────────────────────────────────────────────

export function exportBriefText(headline, body) {
  if (!headline) return;
  const content = [
    'Gold Ticker Live — Market Brief',
    `Exported: ${new Date().toISOString()}`,
    '',
    headline,
    '',
    body || '',
    '',
    'Source: goldpricez.com / open.er-api.com · Reference prices only · Not financial advice.',
  ].join('\n');
  downloadFile(content, `goldtickerlive-brief-${dateStamp()}.txt`, 'text/plain;charset=utf-8;');
}
