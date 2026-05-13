// tracker/render.js — all DOM render functions for tracker-pro
import { CONSTANTS, KARATS, COUNTRIES, TRANSLATIONS } from '../config/index.js';
import { persistState } from './state.js';
import { updateShellTickerFromState } from './ui-shell.js';
import {
  buildHistorySummary,
  describeHistoryResolution,
  filterByMonth,
  filterByRange,
  getBaselineRange,
} from '../lib/historical-data.js';
import { clear, el, setText, escape } from '../lib/safe-dom.js';
import { getLiveFreshness, getMarketStatus } from '../lib/live-status.js';
import { pulseFreshness } from '../lib/freshness-pulse.js';
import { countUp } from '../lib/count-up.js';
import { getDayOpenPrice } from '../lib/cache.js';

let _state, _el, _priceFor, _currentSpot, _showToast;
let _chartListenersAttached = false;
// Holds the latest chart rows so the chart mousemove handler (attached once)
// can always read the most-current data without re-registering on every render.
let _latestChartRows = [];
const TRACKER_BADGE_CLASSES = [
  'tracker-badge-live',
  'tracker-badge--cached',
  'tracker-badge--stale',
  'tracker-badge--unavailable',
];
const SOURCE_BADGE_CLASS = {
  live: 'tracker-source-badge--live',
  cached: 'tracker-source-badge--cached',
  stale: 'tracker-source-badge--estimated',
  unavailable: 'tracker-source-badge--unavailable',
};
const STATUS_BADGE_CLASS = {
  live: 'tracker-badge-live',
  cached: 'tracker-badge--cached',
  stale: 'tracker-badge--stale',
  unavailable: 'tracker-badge--unavailable',
};

export function initRender({ state, el, priceFor, currentSpot, showToast }) {
  _state = state;
  _el = el;
  _priceFor = priceFor;
  _currentSpot = currentSpot;
  _showToast = showToast;
}

function tx(key, params = {}) {
  const fullKey = `tracker.${key}`;
  const template = TRANSLATIONS[_state.lang]?.[fullKey] ?? TRANSLATIONS.en?.[fullKey] ?? fullKey;
  return Object.entries(params).reduce(
    (text, [token, value]) => text.replaceAll(`{${token}}`, String(value)),
    template
  );
}

/**
 * Format a concise source/resolution context string for a history record.
 * Used by the chart tooltip and can be reused in archive rows or export previews.
 *
 * @param {{ source?: string, granularity?: string }} row
 * @returns {string}
 */
function formatHistoricalContext(row) {
  const sourceLabel = row.source || '';
  const granLabel = row.granularity === 'monthly' ? 'monthly avg' : row.granularity || '';
  return [sourceLabel, granLabel].filter(Boolean).join(' · ');
}

function formatUsd(value, decimals = 2) {
  if (!Number.isFinite(value)) return '—';
  return `$${value.toLocaleString('en', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

function formatUnitLabel(unit) {
  if (_state.lang !== 'ar') return unit;
  if (unit === 'gram') return 'غرام';
  if (unit === 'oz') return 'أوقية';
  if (unit === 'tola') return 'تولة';
  return unit;
}

function formatPercent(value) {
  if (!Number.isFinite(value)) return '—';
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function getVisibleHistoryRows() {
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

function getSelectedRangeLabel() {
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

function getFreshnessModel() {
  const freshness = getLiveFreshness({
    updatedAt: _state.live?.updatedAt,
    lang: _state.lang,
    hasLiveFailure: _state.hasLiveFailure,
  });
  const sourceLabel = tx(`source.${freshness.key}`);
  const tooltip =
    freshness.key === 'unavailable'
      ? tx('liveUnavailable')
      : tx('summary.freshnessCopy', {
          source: sourceLabel,
          age: freshness.ageText,
          time: freshness.timeText,
        });

  return {
    ...freshness,
    sourceLabel,
    sourceBadgeClass: SOURCE_BADGE_CLASS[freshness.key] || SOURCE_BADGE_CLASS.cached,
    badgeClass: STATUS_BADGE_CLASS[freshness.key] || STATUS_BADGE_CLASS.cached,
    tooltip,
  };
}

function applyStatusBadge(node, freshness, text) {
  if (!node) return;
  node.classList.remove(...TRACKER_BADGE_CLASSES);
  node.classList.add(freshness.badgeClass);
  node.title = freshness.tooltip;
  node.setAttribute('aria-label', freshness.tooltip);
  if (typeof text === 'string') setText(node, text);
}

function buildSourceBadge(freshness) {
  return el(
    'span',
    {
      class: `tracker-source-badge ${freshness.sourceBadgeClass}`,
      title: freshness.tooltip,
      'aria-label': freshness.tooltip,
    },
    freshness.sourceLabel
  );
}

function buildHeroStatCard(label, value, sub) {
  return el('div', { class: 'tracker-hero-stat' }, [
    el('div', { class: 'tracker-hero-k' }, label),
    el('div', { class: 'tracker-hero-v' }, value),
    el('div', { class: 'tracker-hero-s' }, sub),
  ]);
}

function buildStatCard(label, value, sub) {
  return el('div', { class: 'tracker-stat-card' }, [
    el('div', { class: 'tracker-stat-k' }, label),
    el('div', { class: 'tracker-stat-v' }, value),
    el('div', { class: 'tracker-stat-s' }, sub),
  ]);
}

function buildStackItem(title, copy, badge = null) {
  const headerChildren = [el('strong', null, title)];
  if (badge) headerChildren.push(badge);
  return el('div', { class: 'tracker-stack-item' }, [
    el('div', { class: 'tracker-stack-top' }, headerChildren),
    el('p', null, copy),
  ]);
}

export function renderHero() {
  const spot = _currentSpot();
  const freshness = getFreshnessModel();
  const liveBadge = document.getElementById('tp-live-badge');
  const summaryHeading = document.getElementById('tp-live-summary-heading');
  const isConnecting = !spot && !_state.hasLiveFailure;
  const summaryFreshness = isConnecting
    ? {
        ...freshness,
        key: 'live',
        sourceLabel: tx('source.live'),
        sourceBadgeClass: SOURCE_BADGE_CLASS.live,
        badgeClass: STATUS_BADGE_CLASS.live,
        tooltip: tx('connecting'),
      }
    : freshness;

  if (summaryHeading) setText(summaryHeading, tx('liveDeskTitle'));

  if (liveBadge) {
    liveBadge.classList.remove(...TRACKER_BADGE_CLASSES);
    liveBadge.classList.add(isConnecting ? 'tracker-badge-live' : freshness.badgeClass);
    const liveBadgeLabel = isConnecting ? tx('connecting') : freshness.tooltip;
    liveBadge.title = liveBadgeLabel;
    liveBadge.setAttribute('aria-label', liveBadgeLabel);
  }

  if (_el.liveBadgeText) {
    if (spot) {
      setText(
        _el.liveBadgeText,
        tx('refreshBadge', {
          source: freshness.sourceLabel,
          age: freshness.ageText,
        })
      );
    } else {
      setText(_el.liveBadgeText, _state.hasLiveFailure ? tx('liveUnavailable') : tx('connecting'));
    }
  }

  if (_el.xauUsdValue) {
    if (spot) {
      countUp(_el.xauUsdValue, spot, { decimals: 2, format: (n) => formatUsd(n) });
      pulseFreshness(_el.xauUsdValue);
    } else {
      setText(_el.xauUsdValue, '—');
    }
  }
  const xauBadge = document.getElementById('tp-xauusd-badge');
  if (xauBadge) {
    xauBadge.title = freshness.tooltip;
    xauBadge.setAttribute('aria-label', `XAU/USD · ${freshness.tooltip}`);
  }

  if (_el.marketBadge) {
    const market = getMarketStatus();
    const marketText = market.isOpen ? tx('marketOpen') : tx('marketClosed');
    setText(_el.marketBadge, marketText);
    // Provide a clean aria-label without decorative bullet/circle for screen readers
    _el.marketBadge.setAttribute(
      'aria-label',
      market.isOpen ? tx('marketOpenAriaLabel') : tx('marketClosedAriaLabel')
    );
  }

  if (_el.refreshBadge) {
    const hasMeaningfulTime =
      typeof freshness.timeText === 'string' &&
      freshness.timeText.trim() &&
      freshness.timeText !== '—';
    let refreshText;
    if (!spot) {
      if (_state.hasLiveFailure) {
        refreshText = hasMeaningfulTime
          ? tx('refreshBadgeUnavailable', { time: freshness.timeText })
          : tx('liveUnavailable');
      } else {
        refreshText = tx('connecting');
      }
    } else if (freshness.key === 'stale' || freshness.key === 'cached') {
      refreshText = tx('refreshBadgeStale', { time: freshness.timeText });
    } else {
      refreshText = tx('refreshBadgeDetailed', {
        age: freshness.ageText,
        time: freshness.timeText,
      });
    }
    if (isConnecting) {
      _el.refreshBadge.classList.remove(...TRACKER_BADGE_CLASSES);
      _el.refreshBadge.classList.add('tracker-badge-live');
      _el.refreshBadge.title = tx('connecting');
      _el.refreshBadge.setAttribute('aria-label', tx('connecting'));
      setText(_el.refreshBadge, refreshText);
    } else {
      applyStatusBadge(_el.refreshBadge, freshness, refreshText);
    }
  }

  if (_el.heroStats) {
    clear(_el.heroStats);
    _el.heroStats.removeAttribute('aria-busy');
  }

  if (_el.heroStats && spot) {
    const aed24 = _priceFor({ currency: 'AED', karat: '24', unit: 'gram', spot });
    const aed22 = _priceFor({ currency: 'AED', karat: '22', unit: 'gram', spot });
    const usd24g =
      (spot / CONSTANTS.TROY_OZ_GRAMS) * (KARATS.find((k) => k.code === '24')?.purity ?? 1);
    const dayOpenSpot = getDayOpenPrice();

    // Build day-change suffix for the XAU/USD stat card
    let spotSubText = tx('heroStatSpotSub', { source: freshness.sourceLabel });
    if (dayOpenSpot && dayOpenSpot > 0) {
      const pct = ((spot - dayOpenSpot) / dayOpenSpot) * 100;
      const sign = pct >= 0 ? '▲' : '▼';
      spotSubText = `${tx('heroStatSpotSub', { source: freshness.sourceLabel })} ${tx('heroStatDayChange', { sign, pct: Math.abs(pct).toFixed(2) })}`;
    }

    const stats = [
      buildHeroStatCard('XAU/USD', formatUsd(spot), spotSubText),
      buildHeroStatCard('UAE 24K', aed24 ? `AED ${aed24.toFixed(2)}` : '—', tx('heroStatGramSub')),
      buildHeroStatCard('UAE 22K', aed22 ? `AED ${aed22.toFixed(2)}` : '—', tx('heroStatGramSub')),
      buildHeroStatCard('USD/g 24K', usd24g ? formatUsd(usd24g, 3) : '—', tx('heroStatGramSub')),
    ];
    _el.heroStats.append(...stats);
  }

  if (_el.summaryList) {
    clear(_el.summaryList);

    const summaryItems = [
      buildStackItem(tx('summary.referenceTitle'), tx('summary.referenceCopy')),
      buildStackItem(
        tx('summary.freshnessTitle'),
        spot
          ? tx('summary.freshnessCopy', {
              source: summaryFreshness.sourceLabel,
              age: summaryFreshness.ageText,
              time: summaryFreshness.timeText,
            })
          : _state.hasLiveFailure
            ? tx('liveUnavailable')
            : tx('connecting'),
        buildSourceBadge(summaryFreshness)
      ),
      buildStackItem(tx('summary.sourceTitle'), tx('summary.sourceCopy')),
      buildStackItem(tx('summary.aedPegTitle'), tx('summary.aedPegCopy')),
      buildStackItem(tx('summary.historyTitle'), tx('summary.historyCopy')),
    ];

    _el.summaryList.append(...summaryItems);
  }

  const selectedCountry = COUNTRIES.find((country) => country.currency === _state.selectedCurrency);
  const selectedLabel = selectedCountry
    ? _state.lang === 'ar'
      ? selectedCountry.nameAr || selectedCountry.nameEn
      : selectedCountry.nameEn
    : _state.selectedCurrency;
  const selectedPrice = spot
    ? _priceFor({
        currency: _state.selectedCurrency,
        karat: _state.selectedKarat,
        unit: _state.selectedUnit,
        spot,
      })
    : null;
  const mobileStatus = document.getElementById('tp-mobile-summary-status');
  if (mobileStatus) {
    mobileStatus.textContent = spot
      ? `${freshness.sourceLabel} · ${freshness.ageText}`
      : _state.hasLiveFailure
        ? tx('liveUnavailable')
        : tx('connecting');
    mobileStatus.dataset.tone =
      freshness.key === 'live' ? 'live' : freshness.key === 'unavailable' ? 'neutral' : 'warning';
  }
  const mobileSource = document.getElementById('tp-mobile-summary-source');
  if (mobileSource) {
    mobileSource.textContent = `${selectedLabel} · ${_state.selectedCurrency}`;
    mobileSource.dataset.tone = 'info';
  }
  setText(document.getElementById('tp-mobile-selected-value'), selectedLabel);
  setText(
    document.getElementById('tp-mobile-selected-note'),
    `${_state.selectedCurrency} · ${_state.selectedKarat}K / ${formatUnitLabel(_state.selectedUnit)}`
  );
  setText(
    document.getElementById('tp-mobile-price-value'),
    selectedPrice
      ? selectedPrice.toLocaleString('en', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      : '—'
  );
  setText(document.getElementById('tp-mobile-price-note'), tx('marketTrust'));
  setText(document.getElementById('tp-mobile-spot-value'), spot ? formatUsd(spot) : '—');
  setText(document.getElementById('tp-mobile-spot-note'), tx('mobileSpotNote'));
  setText(
    document.getElementById('tp-mobile-updated-value'),
    spot
      ? freshness.sourceLabel
      : _state.hasLiveFailure
        ? tx('source.unavailable')
        : tx('connecting')
  );
  setText(
    document.getElementById('tp-mobile-updated-note'),
    spot ? freshness.timeText : tx('liveUnavailable')
  );
}

export function renderMiniStrip() {
  if (!_el.miniStrip) return;
  const spot = _currentSpot();
  if (!spot) {
    _el.miniStrip.textContent = tx('waitingLive');
    return;
  }
  const selected = _priceFor({
    currency: _state.selectedCurrency,
    karat: _state.selectedKarat,
    unit: _state.selectedUnit,
    spot,
  });
  _el.miniStrip.textContent = selected
    ? `${_state.selectedCurrency} ${_state.selectedKarat}K / ${_state.selectedUnit}: ${selected.toFixed(2)}`
    : '—';
}

export function renderChart() {
  if (!_el.chart) return;
  const rows = getVisibleHistoryRows();
  const historyOnly = rows.filter((row) => row.granularity !== 'live');
  const livePoint = rows.find((row) => row.granularity === 'live') || null;
  const rangeLabel = getSelectedRangeLabel();
  const resolution = describeHistoryResolution(historyOnly, { hasLive: Boolean(livePoint) });
  const summary = buildHistorySummary(historyOnly, {
    range: rangeLabel,
    liveRecord: livePoint,
  });

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

export function renderKaratTable() {
  if (!_el.karatTable) return;
  const spot = _currentSpot();
  if (!spot) {
    clear(_el.karatTable);
    _el.karatTable.append(el('tr', null, [el('td', { colspan: '4' }, tx('karatTableWaiting'))]));
    return;
  }
  const price24 = _priceFor({
    currency: _state.selectedCurrency,
    karat: '24',
    unit: _state.selectedUnit,
    spot,
  });
  const dayOpenSpot = getDayOpenPrice();

  // Helper: build a change indicator element from spot vs day-open
  function buildChangeIndicator(k) {
    if (!dayOpenSpot) return el('td', { 'data-karat-chg': k.code }, '—');
    const now = _priceFor({
      currency: _state.selectedCurrency,
      karat: k.code,
      unit: _state.selectedUnit,
      spot,
    });
    const open = _priceFor({
      currency: _state.selectedCurrency,
      karat: k.code,
      unit: _state.selectedUnit,
      spot: dayOpenSpot,
    });
    if (!now || !open) return el('td', { 'data-karat-chg': k.code }, '—');
    const pct = ((now - open) / open) * 100;
    const isUp = pct >= 0;
    const text = `${isUp ? '▲' : '▼'} ${Math.abs(pct).toFixed(2)}%`;
    return el(
      'td',
      {
        'data-karat-chg': k.code,
        class: isUp ? 'tracker-chg-up' : 'tracker-chg-down',
        'aria-label': tx('karatDayChangeAria', { text }),
      },
      text
    );
  }

  // Build rows on first render; update price cells in-place on subsequent renders
  // so countUp can animate from the previous value.
  const isFirstRender = !_el.karatTable.querySelector('[data-karat-price]');

  // Sync thead columns when day-open becomes available
  const thead = _el.karatTable.closest('table')?.querySelector('thead tr');
  if (thead) {
    const hasChgTh = thead.querySelector('[data-col="chg"]');
    if (dayOpenSpot && !hasChgTh) {
      thead.append(el('th', { 'data-col': 'chg' }, tx('karatColDayChange')));
    } else if (!dayOpenSpot && hasChgTh) {
      hasChgTh.remove();
    }
  }

  if (isFirstRender) {
    const fragment = document.createDocumentFragment();
    for (const k of KARATS) {
      const p = _priceFor({
        currency: _state.selectedCurrency,
        karat: k.code,
        unit: _state.selectedUnit,
        spot,
      });
      const vs = price24 && p ? `${((p / price24) * 100).toFixed(1)}%` : '—';
      const priceCell = el('td', { 'data-karat-price': k.code }, p ? p.toFixed(2) : '—');
      const vsCell = el('td', { 'data-karat-vs': k.code }, vs);
      const cells = [
        el('td', null, `${k.code}K`),
        el('td', null, `${(k.purity * 100).toFixed(1)}%`),
        priceCell,
        vsCell,
      ];
      if (dayOpenSpot) cells.push(buildChangeIndicator(k));
      fragment.append(el('tr', null, cells));
    }
    clear(_el.karatTable);
    _el.karatTable.append(fragment);
  } else {
    // In-place update: animate price cells with countUp, flash vs-cells
    for (const k of KARATS) {
      const p = _priceFor({
        currency: _state.selectedCurrency,
        karat: k.code,
        unit: _state.selectedUnit,
        spot,
      });
      const vs = price24 && p ? `${((p / price24) * 100).toFixed(1)}%` : '—';
      const row = _el.karatTable.querySelector(`[data-karat-price="${k.code}"]`)?.closest('tr');
      const priceCell = _el.karatTable.querySelector(`[data-karat-price="${k.code}"]`);
      const vsCell = _el.karatTable.querySelector(`[data-karat-vs="${k.code}"]`);
      if (priceCell && p) {
        countUp(priceCell, p, { decimals: 2, format: (n) => n.toFixed(2) });
        pulseFreshness(priceCell);
      } else if (priceCell) {
        setText(priceCell, '—');
      }
      if (vsCell) setText(vsCell, vs);

      // Sync day-change cell: insert if newly available, update if present, remove if gone
      const chgCell = _el.karatTable.querySelector(`[data-karat-chg="${k.code}"]`);
      if (dayOpenSpot) {
        if (chgCell) {
          // Update existing cell
          const open = _priceFor({
            currency: _state.selectedCurrency,
            karat: k.code,
            unit: _state.selectedUnit,
            spot: dayOpenSpot,
          });
          if (p && open) {
            const pct = ((p - open) / open) * 100;
            const isUp = pct >= 0;
            const text = `${isUp ? '▲' : '▼'} ${Math.abs(pct).toFixed(2)}%`;
            chgCell.textContent = text;
            chgCell.className = isUp ? 'tracker-chg-up' : 'tracker-chg-down';
            chgCell.setAttribute('aria-label', tx('karatDayChangeAria', { text }));
          }
        } else if (row) {
          // Day-open just became available — append the change cell to this row
          row.append(buildChangeIndicator(k));
        }
      } else if (chgCell) {
        // Day-open is no longer available — remove the stale change cell
        chgCell.remove();
      }
    }
  }
}

export function renderMarkets() {
  if (!_el.marketBoard) return;
  const spot = _currentSpot();
  const freshness = getFreshnessModel();
  if (!spot) {
    clear(_el.marketBoard);
    _el.marketBoard.append(
      el(
        'p',
        {
          style: {
            padding: '1rem',
            color: 'var(--tp-text-muted)',
          },
        },
        tx('waitingLive')
      )
    );
    return;
  }

  const activeRegion = _state.activeRegion || 'gcc';
  const regionMap = {
    gcc: ['AE', 'SA', 'KW', 'QA', 'BH', 'OM'],
    arab: [
      'AE',
      'SA',
      'KW',
      'QA',
      'BH',
      'OM',
      'EG',
      'JO',
      'LB',
      'SY',
      'YE',
      'MA',
      'TN',
      'DZ',
      'IQ',
    ],
    global: null,
  };
  const regionCodes = regionMap[activeRegion];

  let filtered = COUNTRIES.filter((c) => {
    if (regionCodes && !regionCodes.includes(c.code)) return false;
    if (_el.marketFilter?.value) {
      const q = _el.marketFilter.value.toLowerCase();
      if (!c.nameEn.toLowerCase().includes(q) && !c.currency.toLowerCase().includes(q))
        return false;
    }
    return true;
  });

  const sortValue = _el.marketSort?.value || 'high';
  if (sortValue === 'high' || sortValue === 'low') {
    const getPrice = (c) =>
      _priceFor({
        currency: c.currency,
        karat: _state.selectedKarat,
        unit: _state.selectedUnit,
        spot,
      }) || 0;
    filtered.sort((a, b) =>
      sortValue === 'high' ? getPrice(b) - getPrice(a) : getPrice(a) - getPrice(b)
    );
  } else if (sortValue === 'alpha') {
    filtered.sort((a, b) => a.nameEn.localeCompare(b.nameEn));
  } else if (sortValue === 'favorites') {
    filtered.sort((a, b) => {
      const aFav = (_state.favorites || []).includes(a.currency) ? 1 : 0;
      const bFav = (_state.favorites || []).includes(b.currency) ? 1 : 0;
      return bFav - aFav;
    });
  }

  filtered = filtered.slice(0, 30);

  const fragment = document.createDocumentFragment();
  filtered.forEach((country) => {
    const cur = country.currency;
    const price = _priceFor({
      currency: cur,
      karat: _state.selectedKarat,
      unit: _state.selectedUnit,
      spot,
    });
    const isFav = (_state.favorites || []).includes(cur);
    const name = _state.lang === 'ar' ? country.nameAr || country.nameEn : country.nameEn;

    const button = el(
      'button',
      {
        type: 'button',
        class: `tracker-icon-btn${isFav ? ' is-favorite' : ''}`,
        dataset: { currency: cur },
        'aria-label': tx('favoriteToggle', { name }),
        'aria-pressed': isFav ? 'true' : 'false',
      },
      '★'
    );
    button.addEventListener('click', (event) => {
      event.preventDefault();
      if ((_state.favorites || []).includes(cur)) {
        _state.favorites = _state.favorites.filter((code) => code !== cur);
      } else {
        _state.favorites = [...(_state.favorites || []), cur];
      }
      persistState(_state);
      renderMarkets();
      renderWatchlist();
    });

    const card = el('div', { class: `tracker-market-card${isFav ? ' is-highlight' : ''}` }, [
      el('div', { class: 'tracker-market-top' }, [
        el('div', { class: 'tracker-market-title' }, [
          el('strong', null, `${country.flag ?? ''} ${name}`.trim()),
          el('span', null, cur),
        ]),
        el('div', { class: 'tracker-market-value' }, [
          el(
            'strong',
            null,
            price
              ? price.toLocaleString('en', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })
              : '—'
          ),
          el(
            'span',
            null,
            tx('marketMeta', {
              karat: _state.selectedKarat,
              unit: formatUnitLabel(_state.selectedUnit),
            })
          ),
        ]),
      ]),
      el('div', { class: 'tracker-market-bottom' }, [
        el('div', { class: 'tracker-market-meta' }, [
          buildSourceBadge(freshness),
          el(
            'span',
            { class: 'tracker-card-note' },
            `${tx('marketTrust')} · ${tx('marketFreshness', {
              source: freshness.sourceLabel,
              age: freshness.ageText,
            })}`
          ),
        ]),
        button,
      ]),
    ]);

    card.title = freshness.tooltip;
    fragment.append(card);
  });

  clear(_el.marketBoard);
  _el.marketBoard.append(fragment);

  if (_el.marketEmpty) _el.marketEmpty.hidden = filtered.length > 0;
}

export function renderComparisonWorkspace() {
  if (!_el.comparisonCards) return;
  const spot = _currentSpot();
  const freshness = getFreshnessModel();
  const countries = (_state.compareCountries || [])
    .map((code) => COUNTRIES.find((country) => country.code === code))
    .filter(Boolean);
  const karats = (_state.compareKarats || []).filter(Boolean);

  clear(_el.comparisonCards);
  const canExport = Boolean(spot && countries.length && karats.length);
  [_el.exportCompare, _el.exportCompare2].forEach((button) => {
    if (!button) return;
    button.disabled = !canExport;
  });

  if (!countries.length || !karats.length) {
    if (_el.comparisonEmpty) _el.comparisonEmpty.hidden = false;
    return;
  }
  if (_el.comparisonEmpty) _el.comparisonEmpty.hidden = true;

  const fragment = document.createDocumentFragment();
  countries.forEach((country) => {
    const name = _state.lang === 'ar' ? country.nameAr || country.nameEn : country.nameEn;
    const rows = karats.map((karatCode) => {
      const price = spot
        ? _priceFor({ currency: country.currency, karat: karatCode, unit: 'gram', spot })
        : null;
      return el('div', { class: 'comparison-card__row' }, [
        el('span', { class: 'comparison-card__karat' }, `${karatCode}K`),
        el(
          'strong',
          { class: 'comparison-card__price' },
          price
            ? `${country.currency} ${price.toLocaleString('en', {
                minimumFractionDigits: country.decimals ?? 2,
                maximumFractionDigits: country.decimals ?? 2,
              })}`
            : tx('source.unavailable')
        ),
      ]);
    });

    const notes = [
      el(
        'span',
        { class: 'data-resolution-chip' },
        country.currency === 'AED' ? tx('compare.fxPeg') : tx('compare.fxLive')
      ),
      buildSourceBadge(freshness),
    ];
    if (country.currency === 'AED') {
      notes.push(el('span', { class: 'freshness-chip' }, tx('compare.aedPeg')));
    }

    fragment.append(
      el('article', { class: 'comparison-card' }, [
        el('div', { class: 'comparison-card__header' }, [
          el('div', null, [
            el('h3', { class: 'comparison-card__title' }, `${country.flag ?? ''} ${name}`.trim()),
            el(
              'p',
              { class: 'comparison-card__meta' },
              `${country.currency} · ${tx('compare.perGramLabel')}`
            ),
          ]),
          el('div', { class: 'comparison-card__chips' }, notes),
        ]),
        el('div', { class: 'comparison-card__body' }, rows),
        el(
          'p',
          { class: 'source-note comparison-card__note' },
          tx('compare.cardNote', {
            freshness: freshness.sourceLabel,
            fxSource: country.currency === 'AED' ? tx('compare.fxPeg') : 'open.er-api.com',
          })
        ),
      ])
    );
  });
  _el.comparisonCards.append(fragment);
}

export function renderWatchlist() {
  if (!_el.watchlistGrid) return;
  const spot = _currentSpot();
  const favs = _state.favorites || [];
  const freshness = getFreshnessModel();
  if (!favs.length) {
    clear(_el.watchlistGrid);
    _el.watchlistGrid.append(
      el(
        'p',
        {
          style: {
            color: 'var(--tp-text-muted)',
            fontSize: '0.85rem',
          },
        },
        tx('noFavorites')
      )
    );
    return;
  }
  if (!spot) {
    clear(_el.watchlistGrid);
    _el.watchlistGrid.append(
      el(
        'p',
        {
          style: {
            color: 'var(--tp-text-muted)',
            fontSize: '0.85rem',
          },
        },
        tx('waitingLive')
      )
    );
    return;
  }
  const fragment = document.createDocumentFragment();
  favs.forEach((cur) => {
    const country = COUNTRIES.find((item) => item.currency === cur);
    const price = _priceFor({
      currency: cur,
      karat: _state.selectedKarat,
      unit: _state.selectedUnit,
      spot,
    });
    const name = _state.lang === 'ar' ? country?.nameAr || country?.nameEn : country?.nameEn;
    const isCurrent = _state.selectedCurrency === cur;

    const card = el('div', { class: `tracker-watch-card${isCurrent ? ' is-highlight' : ''}` }, [
      el('div', { class: 'tracker-watch-top' }, [
        el('div', { class: 'tracker-watch-title' }, [
          el('strong', null, `${country?.flag ?? ''} ${name ?? cur}`.trim()),
          el('span', null, `${cur}${isCurrent ? ` · ${tx('selected')}` : ''}`),
        ]),
        el('div', { class: 'tracker-watch-value' }, [
          el(
            'strong',
            null,
            price
              ? price.toLocaleString('en', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })
              : '—'
          ),
          el(
            'span',
            null,
            tx('marketMeta', {
              karat: _state.selectedKarat,
              unit: formatUnitLabel(_state.selectedUnit),
            })
          ),
        ]),
      ]),
      el('div', { class: 'tracker-watch-meta' }, [
        buildSourceBadge(freshness),
        el(
          'span',
          { class: 'tracker-card-note' },
          `${tx('marketTrust')} · ${tx('marketFreshness', {
            source: freshness.sourceLabel,
            age: freshness.ageText,
          })}`
        ),
      ]),
    ]);

    card.title = freshness.tooltip;
    fragment.append(card);
  });

  clear(_el.watchlistGrid);
  _el.watchlistGrid.append(fragment);
}

export function renderDecisionCues() {
  if (!_el.decisionCues) return;
  const spot = _currentSpot();
  const freshness = getFreshnessModel();
  const rows = getVisibleHistoryRows();
  const historyOnly = rows.filter((row) => row.granularity !== 'live');
  const summary = buildHistorySummary(historyOnly, {
    range: getSelectedRangeLabel(),
    liveRecord: rows.find((row) => row.granularity === 'live') || null,
  });
  if (!spot) {
    _el.decisionCues.replaceChildren();
    return;
  }
  clear(_el.decisionCues);
  _el.decisionCues.append(
    el('article', { class: 'trust-note-card' }, [
      el('h3', null, tx('decision.directionTitle')),
      el(
        'p',
        null,
        summary && summary.absoluteChange === 0
          ? tx('decision.directionFlat', {
              spot: spot.toFixed(2),
              source: freshness.sourceLabel,
            })
          : tx(summary?.absoluteChange > 0 ? 'decision.directionUp' : 'decision.directionDown', {
              spot: spot.toFixed(2),
              source: freshness.sourceLabel,
            })
      ),
    ]),
    el('article', { class: 'trust-note-card' }, [
      el('h3', null, tx('decision.rangeMovementTitle')),
      el(
        'p',
        null,
        summary
          ? tx('decision.rangeMovementCopy', {
              range: summary.range,
              change: formatPercent(summary.percentageChange),
              move: formatUsd(summary.absoluteChange),
            })
          : tx('waitingLive')
      ),
    ]),
    el('article', { class: 'trust-note-card' }, [
      el('h3', null, tx('decision.shopReminderTitle')),
      el('p', null, tx('decision.shopReminderCopy')),
    ]),
    el('article', { class: 'trust-note-card' }, [
      el('h3', null, tx('decision.methodTitle')),
      el('p', null, [
        tx('decision.methodCopy'),
        ' ',
        el(
          'a',
          { href: 'methodology.html', class: 'tracker-inline-link' },
          tx('referenceBannerLink')
        ),
      ]),
    ])
  );
}

export function renderAlerts() {
  if (!_el.alertList) return;
  const alerts = _state.alerts || [];
  const spot = _currentSpot();
  clear(_el.alertList);
  if (!alerts.length) {
    _el.alertList.append(
      el('p', { style: { color: 'var(--tp-text-muted)', fontSize: '0.85rem' } }, tx('alerts.empty'))
    );
    return;
  }
  const fragment = document.createDocumentFragment();
  alerts.forEach((a, i) => {
    const hit = spot && (a.direction === 'above' ? spot > a.target : spot < a.target);
    let proximityText = '';
    let proximityClass = '';
    if (spot) {
      const pct = (Math.abs(spot - a.target) / a.target) * 100;
      if (pct < 1) {
        proximityText = '⚡ very close';
        proximityClass = 'is-alert-imminent';
      } else if (pct < 3) {
        proximityText = '● nearby';
        proximityClass = 'is-alert-close';
      }
    }
    const classes = ['tracker-stack-item', hit && 'is-triggered', proximityClass]
      .filter(Boolean)
      .join(' ');
    const labelChildren = [
      `${a.scope} ${a.direction} `,
      el('strong', null, `$${a.target}`),
      ...(hit ? [' ✓ triggered'] : []),
    ];
    const bodyChildren = [el('span', null, labelChildren)];
    if (proximityText)
      bodyChildren.push(
        el(
          'div',
          { style: { fontSize: '0.8rem', color: 'var(--tp-text-muted)', marginTop: '0.25rem' } },
          proximityText
        )
      );
    fragment.append(
      el('div', { class: classes }, [
        el('div', { style: { flex: '1' } }, bodyChildren),
        el(
          'button',
          {
            dataset: { idx: String(i) },
            class: 'tracker-remove-btn',
            'aria-label': tx('alerts.deleteAriaLabel'),
          },
          '×'
        ),
      ])
    );
  });
  _el.alertList.append(fragment);
}

export function renderPresets() {
  if (!_el.presetList) return;
  const presets = _state.presets || [];
  clear(_el.presetList);
  if (!presets.length) {
    _el.presetList.append(
      el(
        'p',
        { style: { color: 'var(--tp-text-muted)', fontSize: '0.85rem' } },
        tx('presets.empty')
      )
    );
    return;
  }
  const fragment = document.createDocumentFragment();
  presets.forEach((p, i) => {
    const isCurrent =
      _state.selectedCurrency === p.currency &&
      _state.selectedKarat === p.karat &&
      _state.selectedUnit === p.unit &&
      _state.range === p.range;
    const metaParts = [
      `${escape(p.karat)}K · ${escape(p.currency)}/${escape(p.unit)} · ${escape(p.range)} range`,
      ...(isCurrent
        ? [' · ', el('span', { style: { color: 'var(--tp-accent)' } }, tx('presets.current'))]
        : []),
    ];
    fragment.append(
      el('div', { class: `tracker-stack-item${isCurrent ? ' is-highlight' : ''}` }, [
        el('div', { style: { flex: '1' } }, [
          el('div', null, [el('strong', null, p.name)]),
          el(
            'div',
            { style: { fontSize: '0.8rem', color: 'var(--tp-text-muted)', marginTop: '0.25rem' } },
            metaParts
          ),
        ]),
        el('span', null, [
          el(
            'button',
            { dataset: { idx: String(i) }, class: 'tracker-load-btn tracker-pill' },
            tx('presets.load')
          ),
          el(
            'button',
            {
              dataset: { idx: String(i) },
              class: 'tracker-remove-btn',
              'aria-label': tx('presets.deleteAriaLabel'),
            },
            '×'
          ),
        ]),
      ])
    );
  });
  _el.presetList.append(fragment);
}

export function renderPlanners() {
  const spot = _currentSpot();
  if (!spot) return;

  // Helper: build a .tracker-result-item row from safe DOM
  function _resultItem(label, value, valueStyle) {
    return el('div', { class: 'tracker-result-item' }, [
      el('span', {}, [label]),
      el('strong', valueStyle ? { style: valueStyle } : {}, [value]),
    ]);
  }
  function _emptyMsg(msg) {
    return el('p', { style: { color: 'var(--tp-text-muted)' } }, [msg]);
  }

  if (_el.budgetResults) {
    const budget = parseFloat(_el.budgetAmount?.value) || 0;
    const fee = parseFloat(_el.budgetFee?.value) || 0;
    const net = budget / (1 + fee / 100);
    const p = _priceFor({
      currency: _state.selectedCurrency,
      karat: _state.selectedKarat,
      unit: 'gram',
      spot,
    });
    _el.budgetResults.replaceChildren(
      p && net
        ? (() => {
            const f = document.createDocumentFragment();
            f.append(
              _resultItem(
                tx('planner.netBudget'),
                `${net.toFixed(2)} ${escape(_state.selectedCurrency)}`
              ),
              _resultItem(
                tx('planner.goldCanBuy'),
                `${(net / p).toFixed(3)} g (${escape(_state.selectedKarat)}K)`
              )
            );
            return f;
          })()
        : _emptyMsg(tx('planner.emptyBudget'))
    );
  }

  if (_el.positionResults) {
    const entry = parseFloat(_el.positionEntry?.value) || 0;
    const qty = parseFloat(_el.positionQty?.value) || 0;
    const p = _priceFor({
      currency: _state.selectedCurrency,
      karat: _state.selectedKarat,
      unit: 'gram',
      spot,
    });
    if (entry && qty && p) {
      const entryValue = entry * qty;
      const currentValue = p * qty;
      const gainLoss = currentValue - entryValue;
      const gainLossPercent = (gainLoss / entryValue) * 100;
      const gainColor = gainLoss >= 0 ? 'var(--tp-live)' : 'var(--tp-danger)';
      const gainPrefix = gainLoss >= 0 ? '+' : '';
      const frag = document.createDocumentFragment();
      frag.append(
        _resultItem(
          tx('planner.entryValue'),
          `${entryValue.toFixed(2)} ${escape(_state.selectedCurrency)}`
        ),
        _resultItem(
          tx('planner.currentValue'),
          `${currentValue.toFixed(2)} ${escape(_state.selectedCurrency)}`
        ),
        _resultItem(
          tx('planner.gainLoss'),
          `${gainPrefix}${gainLoss.toFixed(2)} ${escape(_state.selectedCurrency)} (${gainLoss >= 0 ? '+' : ''}${gainLossPercent.toFixed(1)}%)`,
          { color: gainColor }
        )
      );
      _el.positionResults.replaceChildren(frag);
    } else {
      _el.positionResults.replaceChildren(_emptyMsg(tx('planner.emptyPosition')));
    }
  }

  if (_el.jewelryResults) {
    const weight = parseFloat(_el.jewelryWeight?.value) || 0;
    const karatCode = _el.jewelryKarat?.value || _state.selectedKarat;
    const making = parseFloat(_el.jewelryMaking?.value) || 0;
    const premium = parseFloat(_el.jewelryPremium?.value) || 0;
    const vat = _el.jewelryVat?.checked ? 0.05 : 0;
    const karat = KARATS.find((k) => k.code === karatCode);
    const p = _priceFor({
      currency: _state.selectedCurrency,
      karat: karatCode,
      unit: 'gram',
      spot,
    });
    if (weight && p && karat) {
      const goldValue = p * weight;
      const makingTotal = making * weight;
      const premiumTotal = (goldValue * premium) / 100;
      const subtotal = goldValue + makingTotal + premiumTotal;
      const vatAmount = subtotal * vat;
      const total = subtotal + vatAmount;
      const cur = escape(_state.selectedCurrency);
      const frag = document.createDocumentFragment();
      frag.append(
        _resultItem(tx('planner.goldValue'), `${goldValue.toFixed(2)} ${cur}`),
        _resultItem(tx('planner.makingCharge'), `${makingTotal.toFixed(2)} ${cur}`)
      );
      if (premium)
        frag.append(_resultItem(tx('planner.premium'), `${premiumTotal.toFixed(2)} ${cur}`));
      frag.append(_resultItem(tx('planner.subtotal'), `${subtotal.toFixed(2)} ${cur}`));
      if (vat) frag.append(_resultItem(tx('planner.vat'), `${vatAmount.toFixed(2)} ${cur}`));
      frag.append(
        _resultItem(tx('planner.total'), `${total.toFixed(2)} ${cur}`, {
          color: 'var(--tp-accent)',
        })
      );
      _el.jewelryResults.replaceChildren(frag);
    } else {
      _el.jewelryResults.replaceChildren(_emptyMsg(tx('planner.emptyJewelry')));
    }
  }

  if (_el.accumResults) {
    const monthly = parseFloat(_el.accumMonthly?.value) || 0;
    const target = parseFloat(_el.accumTarget?.value) || 0;
    const p = _priceFor({
      currency: _state.selectedCurrency,
      karat: _state.selectedKarat,
      unit: 'gram',
      spot,
    });
    if (p && monthly && target) {
      const gramsPerMonth = monthly / p;
      const months = target / gramsPerMonth;
      const years = months / 12;
      const frag = document.createDocumentFragment();
      frag.append(
        _resultItem(tx('planner.gramsPerMonth'), `${gramsPerMonth.toFixed(3)} g`),
        _resultItem(tx('planner.monthsToTarget'), `${months.toFixed(1)}`),
        _resultItem(tx('planner.yearsToTarget'), `${years.toFixed(2)}`)
      );
      _el.accumResults.replaceChildren(frag);
    } else {
      _el.accumResults.replaceChildren(_emptyMsg(tx('planner.emptyAccumulation')));
    }
  }
}

const ARCHIVE_PAGE_SIZE = 50;
let _archivePage = 0;

export function renderArchive(resetPage = false) {
  if (!_el.archiveBody) return;
  if (resetPage) _archivePage = 0;

  // Update the archive source note dynamically with the actual baseline range
  const archiveSourceNote = document.getElementById('tp-archive-source-note');
  if (archiveSourceNote) {
    const { last: lastMonth, first: firstMonth } = getBaselineRange();
    const noteText = tx('archive.sourceNote', {
      lastMonth: lastMonth || '—',
      firstMonth: firstMonth || '2019',
    });
    const link = el(
      'a',
      { href: 'methodology.html', class: 'tracker-inline-link' },
      tx('archive.sourceNoteLink')
    );
    archiveSourceNote.replaceChildren(noteText, ' ', link);
  }

  let rows = _state.history.slice().reverse();

  const range = _el.archiveRange?.value || 'ALL';
  if (range !== 'ALL') {
    const daysBack = { '30D': 30, '90D': 90, '1Y': 365, '3Y': 1095, '5Y': 1825 }[range] || 0;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysBack);
    rows = rows.filter((r) => {
      const d = r.date instanceof Date ? r.date : new Date(r.date);
      return d >= cutoff;
    });
  }

  const query = _el.archiveSearch?.value?.toLowerCase() || '';
  if (query) {
    rows = rows.filter((r) => {
      const dateStr = r.date instanceof Date ? r.date.toISOString() : String(r.date);
      return dateStr.includes(query) || r.source.toLowerCase().includes(query);
    });
  }

  const totalFiltered = rows.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / ARCHIVE_PAGE_SIZE));
  _archivePage = Math.min(_archivePage, totalPages - 1);
  const pageStart = _archivePage * ARCHIVE_PAGE_SIZE;
  const pageRows = rows.slice(pageStart, pageStart + ARCHIVE_PAGE_SIZE);

  clear(_el.archiveBody);

  if (!pageRows.length) {
    const { last: lastMonth } = getBaselineRange();
    const noDataMsg = tx('archive.noDataDetailed', { lastMonth: lastMonth || '—' });
    _el.archiveBody.append(el('tr', null, [el('td', { colspan: '5' }, noDataMsg)]));
    if (_el.archiveMeta) _el.archiveMeta.textContent = '';
    _renderArchivePagination(0, 1, 0);
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const r of pageRows) {
    const aed24 = _priceFor({ currency: 'AED', karat: '24', unit: 'gram', spot: r.spot });
    const selected = _priceFor({
      currency: _state.selectedCurrency,
      karat: _state.selectedKarat,
      unit: _state.selectedUnit,
      spot: r.spot,
    });
    const dateStr = r.date instanceof Date ? r.date.toISOString().slice(0, 10) : String(r.date);
    const sourceLabel = r.source + (r.granularity ? ' · ' + r.granularity : '');
    fragment.append(
      el('tr', null, [
        el('td', null, dateStr),
        el('td', null, `$${r.spot.toFixed(2)}`),
        el('td', null, selected ? selected.toFixed(2) : '—'),
        el('td', null, aed24 ? aed24.toFixed(2) : '—'),
        el('td', null, [
          el(
            'span',
            { class: `tracker-source-badge tracker-source-badge--${r.source}` },
            sourceLabel
          ),
        ]),
      ])
    );
  }
  _el.archiveBody.append(fragment);

  if (_el.archiveMeta) {
    const { first: firstMonth, last: lastMonth } = getBaselineRange();
    const sourceInfo = _state.history.some(
      (r) => r.source === 'live' || r.source === 'session-cache'
    )
      ? 'session + baseline'
      : 'baseline';
    _el.archiveMeta.textContent = `${pageStart + 1}–${pageStart + pageRows.length} of ${totalFiltered} records · ${sourceInfo} · ${firstMonth || '2019'}–${lastMonth || 'present'}`;
  }

  _renderArchivePagination(_archivePage, totalPages, totalFiltered);
  renderSeasonal();
}

function _renderArchivePagination(page, totalPages, total) {
  let paginationEl = document.getElementById('tp-archive-pagination');
  if (!paginationEl) {
    const tableFooter = _el.archiveMeta?.parentElement;
    if (!tableFooter) return;
    paginationEl = el('div', {
      id: 'tp-archive-pagination',
      class: 'tracker-pagination',
      'aria-label': 'Archive pages',
    });
    tableFooter.after(paginationEl);
  }
  clear(paginationEl);
  if (total <= ARCHIVE_PAGE_SIZE) return;

  const prevBtn = el(
    'button',
    {
      type: 'button',
      class: 'btn btn-sm btn-ghost tracker-pagination-btn',
      'aria-label': tx('pagination.prevLabel'),
      disabled: page === 0 ? true : null,
    },
    tx('pagination.prev')
  );
  prevBtn.addEventListener('click', () => {
    _archivePage--;
    renderArchive();
  });

  const pageLabel = el(
    'span',
    { class: 'tracker-pagination-label' },
    tx('pagination.page', { page: page + 1, total: totalPages })
  );

  const nextBtn = el(
    'button',
    {
      type: 'button',
      class: 'btn btn-sm btn-ghost tracker-pagination-btn',
      'aria-label': tx('pagination.nextLabel'),
      disabled: page >= totalPages - 1 ? true : null,
    },
    tx('pagination.next')
  );
  nextBtn.addEventListener('click', () => {
    _archivePage++;
    renderArchive();
  });

  paginationEl.append(prevBtn, pageLabel, nextBtn);
}

/**
 * Seasonal patterns — average spot USD/oz by calendar month across the full
 * history window. Highlights the monthly min/max months so users can see
 * typical seasonal skew at a glance. Uses baseline + session data.
 */
export function renderSeasonal() {
  if (!_el.seasonalResults) return;
  const history = Array.isArray(_state.history) ? _state.history : [];
  if (!history.length) {
    _el.seasonalResults.replaceChildren();
    return;
  }

  // Aggregate sum + count per month (0-indexed: Jan=0, Dec=11).
  const sums = new Array(12).fill(0);
  const counts = new Array(12).fill(0);
  for (const r of history) {
    const d = r.date instanceof Date ? r.date : new Date(r.date);
    if (!Number.isFinite(d.getTime())) continue;
    const v = Number(r.spot);
    if (!Number.isFinite(v) || v <= 0) continue;
    const m = d.getMonth();
    sums[m] += v;
    counts[m] += 1;
  }

  const monthNames = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];

  const monthly = [];
  for (let m = 0; m < 12; m++) {
    if (counts[m] > 0) monthly.push({ m, label: monthNames[m], avg: sums[m] / counts[m] });
  }

  if (!monthly.length) {
    _el.seasonalResults.replaceChildren();
    return;
  }

  const avgs = monthly.map((x) => x.avg);
  const minAvg = Math.min(...avgs);
  const maxAvg = Math.max(...avgs);
  const minMonth = monthly.find((x) => x.avg === minAvg);
  const maxMonth = monthly.find((x) => x.avg === maxAvg);
  const overall = avgs.reduce((a, b) => a + b, 0) / avgs.length;
  const range = maxAvg - minAvg;
  const pctSpread = (range / overall) * 100;

  const yearsSpan = (() => {
    const times = history
      .map((r) => (r.date instanceof Date ? r.date : new Date(r.date)).getTime())
      .filter(Number.isFinite);
    if (!times.length) return '';
    const years = (Math.max(...times) - Math.min(...times)) / (365.25 * 24 * 3600 * 1000);
    return years >= 1 ? ` over ${years.toFixed(1)} yrs` : '';
  })();

  // Build result cards: overall + each month with rel-to-average delta.
  function _resultCard(label, value, sub) {
    return el('div', { class: 'tracker-result-card' }, [
      el('div', { class: 'tracker-result-k' }, [label]),
      el('div', { class: 'tracker-result-v' }, [value]),
      el('div', { class: 'tracker-result-s' }, [sub]),
    ]);
  }

  const frag = document.createDocumentFragment();
  frag.append(
    _resultCard('Typical high month', maxMonth.label, `$${maxAvg.toFixed(0)} avg spot`),
    _resultCard('Typical low month', minMonth.label, `$${minAvg.toFixed(0)} avg spot`),
    _resultCard('Seasonal spread', `${pctSpread.toFixed(1)}%`, `high vs low month${yearsSpan}`)
  );
  _el.seasonalResults.replaceChildren(frag);
}

export function renderBrief() {
  if (!_el.briefHeadline || !_el.briefCopy) return;
  const spot = _currentSpot();
  const freshness = getFreshnessModel();
  if (!spot) {
    _el.briefHeadline.textContent = tx('briefWaitingHeadline');
    _el.briefCopy.textContent = tx('briefWaitingBody');
    return;
  }
  const aed24 = _priceFor({ currency: 'AED', karat: '24', unit: 'gram', spot });
  const { last: lastMonth } = getBaselineRange();
  _el.briefHeadline.textContent = tx('briefHeadline', {
    spot: spot.toFixed(2),
    source: freshness.sourceLabel,
  });
  _el.briefCopy.textContent = tx('briefBody', {
    aed24: aed24 ? aed24.toFixed(2) : '—',
    karat: _state.selectedKarat,
    currency: _state.selectedCurrency,
    unit: formatUnitLabel(_state.selectedUnit),
    lastMonth: lastMonth || '—',
  });
}

export function renderAll() {
  const spotForTitle = _state.goldPriceUsdPerOz;
  if (spotForTitle) {
    const priceStr = Math.round(spotForTitle).toLocaleString();
    document.title =
      _state.lang === 'ar'
        ? `${priceStr}$ XAU/USD | متتبع الذهب`
        : `$${priceStr} XAU/USD | Gold Ticker Live`;
  } else {
    document.title =
      _state.lang === 'ar'
        ? 'متتبع الذهب — أسعار مباشرة'
        : 'Gold Tracker — Live Prices | Gold Ticker Live';
  }

  renderHero();

  if (_state.mode === 'live') {
    renderMiniStrip();
    renderChart();
    renderKaratTable();
    renderMarkets();
    renderComparisonWorkspace();
    renderWatchlist();
    renderDecisionCues();
  } else if (_state.mode === 'compare') {
    renderComparisonWorkspace();
    renderMarkets();
  } else if (_state.mode === 'archive') {
    renderArchive();
  }

  // Always render overlay content so it's fresh when opened
  renderAlerts();
  renderPresets();
  renderPlanners();

  renderBrief();

  // Localize welcome strip chips (bilingual parity — §6 rule 6).
  _localizeWelcomeStrip();

  const spot = _currentSpot();
  updateShellTickerFromState(_state, spot, _priceFor);
}

/** Localize the first-visit orientation strip chips and dismiss button. */
function _localizeWelcomeStrip() {
  const chipEls = document.querySelectorAll('.tracker-welcome-chip');
  const chipDefs = [
    { bold: tx('welcome.chip1Bold'), rest: tx('welcome.chip1Rest'), icon: '📈' },
    { bold: tx('welcome.chip2Bold'), rest: tx('welcome.chip2Rest'), icon: '⚖️' },
    { bold: tx('welcome.chip3Bold'), rest: tx('welcome.chip3Rest'), icon: '📋' },
  ];
  chipEls.forEach((chip, i) => {
    const def = chipDefs[i];
    if (!def) return;
    chip.replaceChildren(`${def.icon} `, el('strong', {}, def.bold), ` ${def.rest}`);
  });
  const closeBtn = document.getElementById('tracker-welcome-close');
  if (closeBtn) setText(closeBtn, tx('welcome.dismiss'));
}
