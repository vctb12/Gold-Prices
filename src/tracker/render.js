// tracker/render.js — orchestrates DOM render functions for tracker-pro
import { setText } from '../lib/safe-dom.js';
import { tx, _currentSpot, _el, _priceFor, _setCtx, _state } from './_ctx.js';
import { updateShellTickerFromState } from './ui-shell.js';
import { getFreshnessModel } from './freshness.js';
import { renderChart } from './chart.js';
import { renderHero, renderKaratTable, renderMiniStrip } from './hero.js';
import { renderAlerts, renderAlertsSummary } from './alerts.js';
import { renderWatchlist } from './watchlist.js';
import { renderComparisonWorkspace } from './compare.js';
import { applyExportReadiness } from './export.js';
import { renderMarkets } from './markets.js';
import { renderBrief, renderDecisionCues } from './decision.js';
import { renderArchive } from './archive.js';
import { renderPlanners, renderPresets } from './planner.js';
import { localizeTrustBanner, localizeWelcomeStrip } from './onboarding.js';

export { applyExportReadiness, getExportReadinessState } from './export.js';
export { getFreshnessModel, applyStatusBadge, buildSourceBadge } from './freshness.js';
export { getSelectedRangeLabel, getVisibleHistoryRows, renderChart } from './chart.js';
export { renderHero, renderKaratTable, renderMiniStrip } from './hero.js';
export { renderAlerts, renderAlertsSummary } from './alerts.js';
export { renderWatchlist } from './watchlist.js';
export { renderComparisonWorkspace } from './compare.js';
export { renderMarkets } from './markets.js';
export { renderBrief, renderDecisionCues } from './decision.js';
export { renderArchive, renderSeasonal } from './archive.js';
export { renderPlanners, renderPresets } from './planner.js';

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

  renderAlerts();
  renderPresets();
  renderPlanners();

  renderBrief();
  applyExportReadiness();

  localizeWelcomeStrip();
  localizeTrustBanner();

  const spot = _currentSpot();
  updateShellTickerFromState(_state, spot, _priceFor);
}
