// tracker/export.js — export readiness rendering
import { _state, _el, _currentSpot, tx } from './_ctx.js';
import { setText } from '../lib/safe-dom.js';
import { getFreshnessModel } from './freshness.js';

export function getExportReadinessState() {
  const rows = Array.isArray(_state.history) ? _state.history : [];
  const sources = new Set(rows.map((row) => String(row?.source || '').toLowerCase()));
  let hasSupabase = false;
  let hasBaseline = false;
  let hasLocal = false;
  for (const source of sources) {
    if (source.includes('supabase')) hasSupabase = true;
    if (source.includes('baseline') || source.includes('estimated')) hasBaseline = true;
    if (source.includes('local') || source.includes('cache')) hasLocal = true;
  }
  const freshness = getFreshnessModel();
  const fallbackLike =
    freshness.effectiveKey === 'fallback' ||
    freshness.effectiveKey === 'unavailable' ||
    _state.live?.isFallback === true;
  const hasLiveSpot = Number.isFinite(_currentSpot?.());
  const hasSourceMix = hasSupabase && (hasBaseline || hasLocal);
  const hasStaleLikeFreshness =
    freshness.effectiveKey === 'cached' ||
    freshness.effectiveKey === 'delayed' ||
    freshness.effectiveKey === 'stale';

  if (!rows.length && !fallbackLike) {
    return {
      state: 'checking',
      disableHistoryExports: true,
      disableLiveExports: !hasLiveSpot,
      label: tx('exportReadiness.checking'),
      reason: tx('exportCommand.note'),
    };
  }

  if (fallbackLike) {
    return {
      state: 'blocked',
      disableHistoryExports: true,
      disableLiveExports: true,
      label: tx('exportReadiness.blocked'),
      reason: tx('exportReadiness.blockedReason'),
    };
  }

  if (!hasSupabase && (hasBaseline || hasLocal)) {
    // Baseline/local-only history remains export-limited because it lacks provider-backed
    // provenance guarantees; live-only exports can still proceed when spot is available.
    return {
      state: 'limited',
      disableHistoryExports: true,
      disableLiveExports: !hasLiveSpot,
      label: tx('exportReadiness.limited'),
      reason: tx('exportCommand.note'),
    };
  }

  if (hasSourceMix || hasStaleLikeFreshness) {
    return {
      state: 'limited',
      disableHistoryExports: false,
      disableLiveExports: !hasLiveSpot,
      label: tx('exportReadiness.limited'),
      reason: tx('exportCommand.note'),
    };
  }

  return {
    state: 'ready',
    disableHistoryExports: false,
    disableLiveExports: !hasLiveSpot,
    label: tx('exportReadiness.ready'),
    reason: tx('exportCommand.note'),
  };
}

export function applyExportReadiness() {
  const readiness = getExportReadinessState();
  const pill = document.getElementById('tp-export-readiness-pill');
  if (pill) {
    setText(pill, readiness.label);
    pill.dataset.state = readiness.state;
    pill.setAttribute('title', readiness.reason);
    pill.setAttribute('aria-label', `${readiness.label} · ${readiness.reason}`);
  }

  const historyExportButtons = [
    _el.exportArchive,
    _el.exportArchive2,
    _el.exportHistory,
    _el.exportHistory2,
    _el.exportChart,
    _el.exportChart2,
  ].filter(Boolean);
  const liveExportButtons = [
    _el.exportCompare,
    _el.exportCompare2,
    _el.exportWatchlist,
    _el.downloadJson,
    _el.downloadJson2,
  ].filter(Boolean);

  historyExportButtons.forEach((button) => {
    button.disabled = readiness.disableHistoryExports;
    button.setAttribute('aria-disabled', readiness.disableHistoryExports ? 'true' : 'false');
    button.setAttribute('title', readiness.reason);
  });

  liveExportButtons.forEach((button) => {
    button.disabled = readiness.disableLiveExports;
    button.setAttribute('aria-disabled', readiness.disableLiveExports ? 'true' : 'false');
    button.setAttribute('title', readiness.reason);
  });
}
