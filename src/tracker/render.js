// tracker/render.js — orchestrates DOM render functions for tracker-pro
import { KARATS, COUNTRIES } from '../config/index.js';
import { persistState } from './state.js';
import { updateShellTickerFromState } from './ui-shell.js';
import { buildHistorySummary, getBaselineRange } from '../lib/historical-data.js';
import { clear, el, setText, escape } from '../lib/safe-dom.js';
import {
  _setCtx,
  _state,
  _el,
  _priceFor,
  _currentSpot,
  tx,
  formatUnitLabel,
  formatUsd,
  formatPercent,
} from './_ctx.js';
import { getFreshnessModel, buildSourceBadge } from './freshness.js';
import { renderChart, getVisibleHistoryRows, getSelectedRangeLabel } from './chart.js';
import { renderHero, renderMiniStrip, renderKaratTable } from './hero.js';
import { renderAlerts, renderAlertsSummary } from './alerts.js';
import { renderWatchlist } from './watchlist.js';
import { renderComparisonWorkspace } from './compare.js';
import { applyExportReadiness, getExportReadinessState } from './export.js';

export { getFreshnessModel, applyStatusBadge, buildSourceBadge } from './freshness.js';
export { renderChart, getVisibleHistoryRows, getSelectedRangeLabel } from './chart.js';
export { renderHero, renderMiniStrip, renderKaratTable } from './hero.js';
export { renderAlerts, renderAlertsSummary } from './alerts.js';
export { renderWatchlist } from './watchlist.js';
export { renderComparisonWorkspace } from './compare.js';
export { applyExportReadiness, getExportReadinessState } from './export.js';

const MIN_QUICK_CALC_WEIGHT_GRAMS = 0.01;
export function initRender({ state, el, priceFor, currentSpot, showToast }) {
  _setCtx({ state, el, priceFor, currentSpot, showToast });
}

export function renderQuickCalculator() {
  if (!_el.quickCalcResult || !_el.quickCalcMeta) return;
  const spot = _currentSpot();
  const weight = Number.parseFloat(_el.quickCalcWeight?.value || '');
  const karat = _el.quickCalcKarat?.value || _state.selectedKarat;
  const currency = _el.quickCalcCurrency?.value || _state.selectedCurrency;
  const perGram = spot
    ? _priceFor({
        currency,
        karat,
        unit: 'gram',
        spot,
      })
    : null;

  if (
    !spot ||
    !Number.isFinite(weight) ||
    weight < MIN_QUICK_CALC_WEIGHT_GRAMS ||
    !Number.isFinite(perGram)
  ) {
    setText(_el.quickCalcResult, '—');
    setText(_el.quickCalcMeta, tx('quickCalc.waiting'));
    return;
  }

  const total = perGram * weight;
  const numberLocale = _state.lang === 'ar' ? 'ar-AE' : 'en-US';
  setText(
    _el.quickCalcResult,
    `${currency} ${total.toLocaleString(numberLocale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`
  );
  setText(
    _el.quickCalcMeta,
    tx('quickCalc.summary', {
      weight: weight.toLocaleString(numberLocale, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
      karat,
      source: getFreshnessModel().sourceLabel,
    })
  );
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
    const sourceLabel = _state.history.some(
      (r) => r.source === 'live' || r.source === 'session-cache'
    )
      ? tx('archiveSourceMixed')
      : tx('archiveSourceBaseline');
    _el.archiveMeta.textContent = tx('archiveMeta', {
      start: pageStart + 1,
      end: pageStart + pageRows.length,
      total: totalFiltered,
      source: sourceLabel,
      from: firstMonth || '2019',
      to: lastMonth || tx('present'),
    });
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
    renderAlertsSummary();
    renderQuickCalculator();
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
  applyExportReadiness();

  // Localize welcome strip chips (bilingual parity — §6 rule 6).
  _localizeWelcomeStrip();
  // Localize trust banner content and close button aria-label.
  _localizeTrustBanner();

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

/** Localize the trust banner content and close-button aria-label (bilingual parity). */
function _localizeTrustBanner() {
  const content = document.querySelector('.tracker-trust-content');
  if (content) {
    content.replaceChildren(
      el('strong', {}, tx('referenceBannerTitle')),
      ` — ${tx('referenceBannerBody')} `,
      el('a', { href: 'methodology.html', class: 'tracker-inline-link' }, tx('referenceBannerLink'))
    );
  }
  const closeBtn = document.querySelector('.tracker-trust-close');
  if (closeBtn) closeBtn.setAttribute('aria-label', tx('referenceBannerClose'));
}
