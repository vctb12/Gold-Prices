/**
 * Gold price chart component using Lightweight Charts (TradingView).
 *
 * DATA STRATEGY:
 *   - Short ranges (24H, 7D): uses localStorage session snapshots (90s resolution)
 *   - Longer ranges (30D, 90D, 1Y, 3Y, 5Y, ALL): uses unified historical data
 *     (monthly baseline 2019-present + daily cached snapshots merged together)
 *
 * Usage:
 *   import { GoldChart } from './components/chart.js';
 *   const chart = new GoldChart('chart-container', lang);
 *   chart.addPoint(price, timestamp);  // call on every gold fetch
 *   chart.setRange('24H' | '7D' | '30D' | '90D' | '1Y' | '3Y' | '5Y' | 'ALL');
 */

import { getUnifiedHistory, toChartData, filterByRange } from '../lib/historical-data.js';

const CHART_CACHE_KEY = 'gold_chart_snapshots';
const MAX_SNAPSHOTS = 5000; // ~5 days at 90s intervals

function loadSnapshots() {
  try {
    const raw = localStorage.getItem(CHART_CACHE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveSnapshots(snapshots) {
  try {
    localStorage.setItem(CHART_CACHE_KEY, JSON.stringify(snapshots.slice(-MAX_SNAPSHOTS)));
  } catch {}
}

/**
 * Filter live session snapshots by time range (for short ranges).
 */
function filterSnapshotsByMs(snapshots, ms) {
  const cutoff = Date.now() - ms;
  return snapshots.filter((s) => s.time * 1000 >= cutoff);
}

const SHORT_RANGE_MS = {
  '24H': 86400000,
  '7D': 604800000,
};

const LIGHTWEIGHT_CDN = 'https://cdn.jsdelivr.net/npm/lightweight-charts@4.2.3/+esm';

export class GoldChart {
  constructor(containerId, lang = 'en') {
    this.containerId = containerId;
    this.lang = lang;
    this.range = '1Y'; // default to show meaningful historical data
    this.snapshots = loadSnapshots();
    this._cachedDaily = []; // injected from STATE.history
    this._chart = null;
    this._series = null;
    this._ready = false;
    this._LW = null;
    this._loadLibrary();
  }

  /** Inject the daily history from STATE (called after cache load) */
  setDailyHistory(dailyHistory) {
    this._cachedDaily = Array.isArray(dailyHistory) ? dailyHistory : [];
    if (this._ready) this._render();
  }

  async _loadLibrary() {
    try {
      const mod = await import(LIGHTWEIGHT_CDN);
      this._LW = mod;
      this._init();
    } catch (e) {
      console.warn('[chart] Lightweight Charts failed to load:', e.message);
      this._showFallback('load-error');
    }
  }

  _init() {
    const container = document.getElementById(this.containerId);
    if (!container) return;

    container.replaceChildren();

    // Derive height from the parent chart-wrap so it fills the panel
    const wrap = container.closest('.tracker-chart-wrap');
    const chartHeight = wrap ? Math.max(240, wrap.clientHeight - 4) : 380;

    this._chart = this._LW.createChart(container, {
      width: container.clientWidth,
      height: chartHeight,
      layout: {
        background: { color: 'transparent' },
        textColor: '#6a6050',
        fontFamily: "'Cairo', system-ui, sans-serif",
      },
      grid: {
        vertLines: { color: 'rgba(230,224,208,0.5)' },
        horzLines: { color: 'rgba(230,224,208,0.5)' },
      },
      crosshair: { mode: 1 },
      rightPriceScale: {
        borderColor: 'rgba(230,224,208,0.8)',
        textColor: '#6a6050',
        minimumWidth: 65,
      },
      timeScale: {
        borderColor: 'rgba(230,224,208,0.8)',
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 5,
      },
      handleScroll: true,
      handleScale: true,
    });

    this._series = this._chart.addAreaSeries({
      lineColor: '#c9a84c',
      topColor: 'rgba(201,168,76,0.22)',
      bottomColor: 'rgba(201,168,76,0.02)',
      lineWidth: 2,
      priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
    });

    const ro = new ResizeObserver(() => {
      if (this._chart) {
        const w = container.clientWidth;
        const h = wrap ? Math.max(240, wrap.clientHeight - 4) : chartHeight;
        if (w > 0) this._chart.resize(w, h);
      }
    });
    ro.observe(container);

    this._ready = true;
    this._render();
  }

  _showFallback(reason) {
    const container = document.getElementById(this.containerId);
    if (!container) return;
    const msgs = {
      'load-error':
        this.lang === 'ar'
          ? 'تعذّر تحميل المخطط. تحقق من الاتصال.'
          : 'Chart unavailable. Check your connection.',
      'no-data':
        this.lang === 'ar'
          ? 'لا تتوفر بيانات بعد — ستظهر البيانات عند وصول التحديثات'
          : 'No data for this range yet — data populates as updates arrive',
    };
    const existing = container.querySelector('.chart-no-data');
    if (existing) {
      existing.textContent = msgs[reason] || msgs['no-data'];
      return;
    }
    const msg = document.createElement('div');
    msg.className = 'chart-no-data';
    msg.textContent = msgs[reason] || msgs['no-data'];
    container.appendChild(msg);
  }

  _clearFallback() {
    document.getElementById(this.containerId)?.querySelector('.chart-no-data')?.remove();
  }

  _getChartData() {
    const range = (this.range || '1Y').toUpperCase();

    // Short ranges: use live snapshots for high resolution
    if (range === '24H' || range === '7D') {
      const ms = SHORT_RANGE_MS[range];
      const filtered = filterSnapshotsByMs(this.snapshots, ms);
      if (filtered.length < 2) return null;
      return filtered.map((s) => ({ time: s.time, value: s.price }));
    }

    // Longer ranges: use unified history (baseline + daily cache)
    const unified = getUnifiedHistory(this._cachedDaily);
    const filtered = filterByRange(unified, range);
    if (filtered.length < 2) return null;
    return toChartData(filtered);
  }

  _render() {
    if (!this._ready || !this._series) return;

    const data = this._getChartData();
    if (!data || data.length < 2) {
      this._showFallback('no-data');
      return;
    }
    this._clearFallback();

    // Dedupe by time (Lightweight Charts requires strictly ascending unique times)
    const seen = new Set();
    const deduped = [];
    for (const d of data) {
      const key = typeof d.time === 'string' ? d.time : String(d.time);
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(d);
      }
    }
    deduped.sort((a, b) => {
      const ka = typeof a.time === 'string' ? a.time : String(a.time);
      const kb = typeof b.time === 'string' ? b.time : String(b.time);
      return ka < kb ? -1 : ka > kb ? 1 : 0;
    });

    this._series.setData(deduped);
    this._chart.timeScale().fitContent();
  }

  addPoint(price, timestamp) {
    if (!price || price <= 0) return;
    const time = Math.floor(new Date(timestamp || Date.now()).getTime() / 1000);
    if (this.snapshots.length && this.snapshots[this.snapshots.length - 1].time === time) return;
    this.snapshots.push({ time, price });
    saveSnapshots(this.snapshots);

    // Only do incremental update for short-range views
    const range = (this.range || '1Y').toUpperCase();
    if ((range === '24H' || range === '7D') && this._ready && this._series) {
      const data = this._getChartData();
      if (data && data.length >= 2) {
        this._clearFallback();
        this._series.update({ time, value: price });
      }
    }
  }

  setRange(range) {
    this.range = range;
    this._render();
  }

  setLang(lang) {
    this.lang = lang;
  }
}
