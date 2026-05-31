// tracker/chart.js — historical chart rendering
import { _state, _el, _currentSpot, tx, formatUsd, formatPercent } from './_ctx.js';
import { clear, el } from '../lib/safe-dom.js';
import {
  buildHistorySummary,
  describeHistoryResolution,
  filterByMonth,
  filterByRange,
  getHistoryStats,
} from '../lib/historical-data.js';
import { pulseFreshness } from '../lib/freshness-pulse.js';

let _chartListenersAttached = false;
let _latestChartRows = [];

function formatHistoricalContext(row) {
  const sourceLabel = row.source || '';
  const granLabel = row.granularity === 'monthly' ? 'monthly avg' : row.granularity || '';
  return [sourceLabel, granLabel].filter(Boolean).join(' · ');
}

function getHistorySourceLabel(rows = []) {
  if (!rows.length) return tx('historySource.unavailable');
  const sources = new Set(rows.map((row) => String(row.source || '').toLowerCase()));
  let hasSupabase = false;
  let hasBaseline = false;
  let hasLocal = false;
  for (const source of sources) {
    if (source.includes('supabase')) hasSupabase = true;
    if (source.includes('baseline') || source.includes('estimated')) hasBaseline = true;
    if (source.includes('local') || source.includes('cache')) hasLocal = true;
  }

  if (hasSupabase && !hasBaseline && !hasLocal) return tx('historySource.supabase');
  if (hasSupabase && (hasBaseline || hasLocal)) return tx('historySource.mixedSupabase');
  if (hasBaseline && hasLocal) return tx('historySource.mixedBaseline');
  if (hasBaseline) return tx('historySource.baseline');
  if (hasLocal) return tx('historySource.local');
  return tx('historySource.unavailable');
}

export function getVisibleHistoryRows() {
  const flatHistory = (_state.history || []).map((r) => ({
    date: r.date instanceof Date ? r.date.toISOString().slice(0, 10) : String(r.date),
    price: r.spot,
    spot: r.spot,
    source: r.source,
    granularity: r.granularity,
  }));
  const monthFiltered = _state.historyMonth
    ? filterByMonth(flatHistory, _state.historyMonth)
    : flatHistory;
  const filtered = _state.historyMonth ? monthFiltered : filterByRange(flatHistory, _state.range);
  const rows = filtered
    .map((r) => ({ ...r, date: new Date(r.date) }))
    .filter((row) => Number.isFinite(row.date.getTime()) && Number.isFinite(row.spot));
  const liveSpot = _currentSpot();
  const liveRecord =
    liveSpot && !_state.historyMonth
      ? {
          date: new Date(),
          price: liveSpot,
          spot: liveSpot,
          source: _state.hasLiveFailure ? 'cached' : 'live',
          granularity: 'live',
        }
      : null;
  if (liveRecord) rows.push(liveRecord);
  rows.sort((a, b) => a.date - b.date);
  return rows;
}

export function getSelectedRangeLabel() {
  if (_state.historyMonth) {
    const monthDate = new Date(`${_state.historyMonth}-01T00:00:00Z`);
    if (!Number.isFinite(monthDate.getTime())) return _state.historyMonth;
    return monthDate.toLocaleDateString(_state.lang === 'ar' ? 'ar-AE' : 'en-US', {
      month: 'long',
      year: 'numeric',
    });
  }
  return _state.range || 'ALL';
}

function historyDateLabel(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return '—';
  return date.toLocaleDateString(_state.lang === 'ar' ? 'ar-AE' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function buildStatCard(label, value, sub) {
  return el('div', { class: 'tracker-stat-card' }, [
    el('div', { class: 'tracker-stat-k' }, label),
    el('div', { class: 'tracker-stat-v' }, value),
    el('div', { class: 'tracker-stat-s' }, sub),
  ]);
}

export function renderChart() {
  if (!_el.chart) return;
  if (_el.chartWrap) {
    _el.chartWrap.classList.add('is-loading');
    window.setTimeout(() => _el.chartWrap?.classList.remove('is-loading'), 250);
  }
  const rows = getVisibleHistoryRows();
  const historyOnly = rows.filter((row) => row.granularity !== 'live');
  const livePoint = rows.find((row) => row.granularity === 'live') || null;
  const rangeLabel = getSelectedRangeLabel();
  const resolution = describeHistoryResolution(historyOnly, { hasLive: Boolean(livePoint) });
  const summary = buildHistorySummary(historyOnly, {
    range: rangeLabel,
    liveRecord: livePoint,
  });
  if (_el.chartHistorySource) {
    setText(
      _el.chartHistorySource,
      tx('historySource.label', { source: getHistorySourceLabel(historyOnly) })
    );
  }

  if (!rows.length) {
    if (_el.chartEmpty) _el.chartEmpty.hidden = false;
    if (_el.historyCaption)
      setText(
        _el.historyCaption,
        _state.historyMonth
          ? tx('historyCaptionUnavailableMonth', { month: rangeLabel })
          : tx('historyCaptionUnavailable', { range: rangeLabel })
      );
    if (_el.chartStats && !_el.chartStats.children.length) {
      _el.chartStats.append(
        buildStatCard(
          tx('historical.summary.rangeLabel'),
          rangeLabel,
          tx('historical.summary.rangeHint')
        ),
        buildStatCard(
          tx('historical.summary.resolutionLabel'),
          tx('source.unavailable'),
          resolution.detail
        )
      );
    }
    if (_el.rangeNotes) clear(_el.rangeNotes);
    return;
  }
  if (_el.chartEmpty) _el.chartEmpty.hidden = true;
  if (rows.length < 2) {
    const msg = _state.lang === 'ar' ? 'جمع البيانات…' : 'Collecting data…';
    const svgNs = 'http://www.w3.org/2000/svg';
    const t = document.createElementNS(svgNs, 'text');
    t.setAttribute('x', '50%');
    t.setAttribute('y', '50%');
    t.setAttribute('text-anchor', 'middle');
    t.setAttribute('fill', '#9d8c72');
    t.setAttribute('font-size', '14');
    t.textContent = msg;
    _el.chart.replaceChildren(t);
  } else {
    const prices = rows.map((r) => r.spot);
    const min = Math.min(...prices) * 0.998;
    const max = Math.max(...prices) * 1.002;
    const W = _el.chartWrap?.clientWidth || 1200;
    const PAD_TOP = 28;
    const PAD_BOTTOM = 30;
    const H = Math.max(200, (_el.chartWrap?.clientHeight || 430) - PAD_BOTTOM);
    const chartH = H - PAD_TOP;
    _el.chart.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const svgNs = 'http://www.w3.org/2000/svg';
    function svgEl(tag, attrs, textContent) {
      const node = document.createElementNS(svgNs, tag);
      for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
      if (textContent !== undefined) node.textContent = textContent;
      return node;
    }

    // Build polyline points
    const pts = rows
      .map((r, i) => {
        const x = (i / (rows.length - 1)) * W;
        const y = PAD_TOP + chartH - ((r.spot - min) / (max - min)) * chartH;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');

    // Closed path for gradient fill (polyline + bottom border)
    const firstX = 0;
    const lastX = W;
    const bottomY = PAD_TOP + chartH;
    const fillPts = pts + ` ${lastX},${bottomY} ${firstX},${bottomY}`;

    const gradientId = 'tp-chart-gradient';
    const sourceLabel = resolution.label;

    const frag = document.createDocumentFragment();

    // defs: gradient
    const defs = svgEl('defs', {});
    const grad = svgEl('linearGradient', { id: gradientId, x1: '0', y1: '0', x2: '0', y2: '1' });
    const stop1 = svgEl('stop', { offset: '0%', 'stop-color': '#c49a44', 'stop-opacity': '0.18' });
    const stop2 = svgEl('stop', {
      offset: '100%',
      'stop-color': '#c49a44',
      'stop-opacity': '0.01',
    });
    grad.append(stop1, stop2);
    defs.append(grad);
    frag.append(defs);

    // Horizontal grid lines (4 levels)
    for (let i = 0; i <= 3; i++) {
      const yVal = min + ((max - min) * (3 - i)) / 3;
      const yPos = PAD_TOP + (chartH * i) / 3;
      frag.append(
        svgEl('line', {
          x1: '0',
          y1: yPos.toFixed(1),
          x2: String(W),
          y2: yPos.toFixed(1),
          stroke: 'rgba(196,154,68,0.12)',
          'stroke-width': '1',
          'stroke-dasharray': '4 6',
        }),
        svgEl(
          'text',
          {
            x: '6',
            y: (yPos - 4).toFixed(1),
            fill: '#9d8c72',
            'font-size': '10',
            'font-family': 'system-ui, sans-serif',
          },
          `$${yVal.toFixed(0)}`
        )
      );
    }

    // Date labels (3 evenly-spaced)
    const dateLabelCount = Math.min(3, rows.length);
    for (let i = 0; i < dateLabelCount; i++) {
      const rowIdx =
        dateLabelCount === 1 ? 0 : Math.round((i / (dateLabelCount - 1)) * (rows.length - 1));
      const row = rows[rowIdx];
      const x = rows.length > 1 ? (rowIdx / (rows.length - 1)) * W : W / 2;
      const dateStr = row.date instanceof Date ? row.date.toLocaleDateString() : String(row.date);
      frag.append(
        svgEl(
          'text',
          {
            x: x.toFixed(1),
            y: String(H - 4),
            'text-anchor': i === 0 ? 'start' : i === dateLabelCount - 1 ? 'end' : 'middle',
            fill: '#9d8c72',
            'font-size': '10',
            'font-family': 'system-ui, sans-serif',
          },
          dateStr
        )
      );
    }

    // Fill polygon
    frag.append(
      svgEl('polygon', {
        points: fillPts,
        fill: `url(#${gradientId})`,
      })
    );

    // Price line
    frag.append(
      svgEl('polyline', {
        points: pts,
        fill: 'none',
        stroke: '#c49a44',
        'stroke-width': '2.5',
        'stroke-linejoin': 'round',
        'stroke-linecap': 'round',
      })
    );

    // Source label bottom-right
    frag.append(
      svgEl(
        'text',
        {
          x: String(W - 6),
          y: String(H - 4),
          'text-anchor': 'end',
          fill: '#9d8c72',
          'font-size': '10',
          'font-family': 'system-ui, sans-serif',
          opacity: '0.7',
        },
        `${sourceLabel} · ${rows.length} pts`
      )
    );

    _el.chart.replaceChildren(frag);
  }

  // Keep the module-level snapshot up to date so the once-registered
  // mousemove handler always uses the latest rows without re-attaching.
  _latestChartRows = rows;

  if (_el.chartWrap && !_chartListenersAttached) {
    _chartListenersAttached = true;
    _el.chartWrap.addEventListener('mousemove', (e) => {
      if (!_el.tooltip || _latestChartRows.length < 2) return;
      const rect = _el.chart.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const idx = Math.round((x / rect.width) * (_latestChartRows.length - 1));
      const clampedIdx = Math.max(0, Math.min(idx, _latestChartRows.length - 1));
      const row = _latestChartRows[clampedIdx];
      const tooltip = _el.tooltip;
      // Use DOM construction instead of innerHTML to avoid any XSS risk.
      const strong = document.createElement('strong');
      strong.textContent = `$${row.spot.toFixed(2)}`;
      const div = document.createElement('div');
      // Show date, source, and granularity so users can tell live/cached/historical apart
      div.textContent = `${row.date.toLocaleDateString()} · ${formatHistoricalContext(row)}`;
      tooltip.replaceChildren(strong, div);
      tooltip.style.left = x + 'px';
      tooltip.style.top = '0px';
      tooltip.style.display = 'block';
    });
    _el.chartWrap.addEventListener('mouseleave', () => {
      if (_el.tooltip) _el.tooltip.style.display = 'none';
    });
  }

  if (_el.chartStats) {
    const stats = getHistoryStats(historyOnly);
    const rangeMax = Math.max(...rows.map((r) => r.spot));
    const rangeMin = Math.min(...rows.map((r) => r.spot));
    const cards = [
      buildStatCard(
        tx('historical.summary.rangeLabel'),
        rangeLabel,
        tx('historical.summary.rangeHint')
      ),
      buildStatCard(
        tx('historical.summary.startLabel'),
        summary ? formatUsd(summary.start.price) : '—',
        summary ? historyDateLabel(summary.start.date) : '—'
      ),
      buildStatCard(
        tx('historical.summary.endLabel'),
        summary ? formatUsd(summary.end.price) : '—',
        summary ? historyDateLabel(summary.end.date) : '—'
      ),
      buildStatCard(
        tx('historical.summary.changeLabel'),
        summary
          ? `${formatUsd(summary.absoluteChange)} · ${formatPercent(summary.percentageChange)}`
          : '—',
        tx('historical.summary.changeHint')
      ),
      buildStatCard(
        tx('historical.summary.highLabel'),
        `$${rangeMax.toLocaleString('en', { maximumFractionDigits: 0 })}`,
        tx('historical.summary.highHint')
      ),
      buildStatCard(
        tx('historical.summary.lowLabel'),
        `$${rangeMin.toLocaleString('en', { maximumFractionDigits: 0 })}`,
        tx('historical.summary.lowHint')
      ),
      buildStatCard(tx('historical.summary.resolutionLabel'), resolution.label, resolution.detail),
    ];
    if (stats.ytdChange != null)
      cards.push(
        buildStatCard(
          tx('historical.summary.ytdLabel'),
          `${stats.ytdChange >= 0 ? '+' : ''}${stats.ytdChange.toFixed(1)}%`,
          tx('historical.summary.ytdHint')
        )
      );
    if (stats.yoyChange != null)
      cards.push(
        buildStatCard(
          tx('historical.summary.yoyLabel'),
          `${stats.yoyChange >= 0 ? '+' : ''}${stats.yoyChange.toFixed(1)}%`,
          tx('historical.summary.yoyHint')
        )
      );
    clear(_el.chartStats);
    _el.chartStats.append(...cards);
    pulseFreshness(_el.chartStats);
  }

  if (_el.historyCaption) {
    setText(
      _el.historyCaption,
      tx('historyCaption', { range: rangeLabel, resolution: resolution.label })
    );
  }

  if (_el.rangeNotes) {
    clear(_el.rangeNotes);
    _el.rangeNotes.append(
      el(
        'div',
        { class: 'tracker-note-item' },
        tx('historical.note.resolution', { detail: resolution.detail })
      ),
      el(
        'div',
        { class: 'tracker-note-item' },
        tx('historical.note.freshness', {
          mode: livePoint ? tx('source.live') : tx('source.cached'),
        })
      ),
      el('div', { class: 'tracker-note-item' }, tx('historical.note.methodology'))
    );
  }
}
