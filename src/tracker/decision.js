import { buildHistorySummary, getBaselineRange } from '../lib/historical-data.js';
import { clear, el } from '../lib/safe-dom.js';
import {
  formatPercent,
  formatUnitLabel,
  formatUsd,
  tx,
  _currentSpot,
  _el,
  _priceFor,
  _state,
} from './_ctx.js';
import { getSelectedRangeLabel, getVisibleHistoryRows } from './chart.js';
import { getFreshnessModel } from './freshness.js';

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
