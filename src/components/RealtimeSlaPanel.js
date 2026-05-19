import { el } from '../lib/safe-dom.js';

function metricRow(label, value, pass = true) {
  return el('li', { class: `realtime-sla-panel__metric${pass ? '' : ' is-breach'}` }, [
    el('span', { class: 'realtime-sla-panel__metric-label' }, label),
    el('strong', { class: 'realtime-sla-panel__metric-value' }, value),
  ]);
}

export function renderRealtimeSlaPanel({ snapshot, t = (key) => key, className = '' } = {}) {
  if (!snapshot) {
    return el(
      'section',
      { class: `tracker-addon-card realtime-sla-panel${className ? ` ${className}` : ''}` },
      [
        el('h3', { class: 'tracker-addon-title' }, t('freshness.sla.title')),
        el('p', { class: 'realtime-sla-panel__empty' }, t('freshness.sla.empty')),
      ]
    );
  }

  const metrics = snapshot.metrics || {};
  const warningFlags = metrics.warningFlags || [];
  const criticalFlags = metrics.criticalFlags || [];

  const items = [
    metricRow(
      'p50 refresh',
      metrics.p50RefreshIntervalMs ? `${Math.round(metrics.p50RefreshIntervalMs)}ms` : '—',
      (metrics.p50RefreshIntervalMs ?? 0) <= 5000
    ),
    metricRow(
      'p95 refresh',
      metrics.p95RefreshIntervalMs ? `${Math.round(metrics.p95RefreshIntervalMs)}ms` : '—',
      (metrics.p95RefreshIntervalMs ?? 0) <= 12000
    ),
    metricRow(
      'p99 refresh',
      metrics.p99RefreshIntervalMs ? `${Math.round(metrics.p99RefreshIntervalMs)}ms` : '—',
      (metrics.p99RefreshIntervalMs ?? 0) <= 20000
    ),
    metricRow(
      'p95 apply latency',
      metrics.p95ApplyLatencyMs ? `${Math.round(metrics.p95ApplyLatencyMs)}ms` : '—',
      (metrics.p95ApplyLatencyMs ?? 0) <= 2500
    ),
    metricRow(
      'p99 apply latency',
      metrics.p99ApplyLatencyMs ? `${Math.round(metrics.p99ApplyLatencyMs)}ms` : '—',
      (metrics.p99ApplyLatencyMs ?? 0) <= 4000
    ),
    metricRow(
      'live eligibility',
      metrics.liveEligibilityRate != null
        ? `${(metrics.liveEligibilityRate * 100).toFixed(2)}%`
        : '—',
      (metrics.liveEligibilityRate ?? 0) >= 0.99
    ),
    metricRow(
      'successful poll rate',
      metrics.successfulPollRate != null
        ? `${(metrics.successfulPollRate * 100).toFixed(2)}%`
        : '—',
      (metrics.successfulPollRate ?? 0) >= 0.97
    ),
    metricRow(
      'stale contradiction rate',
      metrics.staleIncidentRate != null ? `${(metrics.staleIncidentRate * 100).toFixed(4)}%` : '—',
      (metrics.staleIncidentRate ?? 0) === 0
    ),
    metricRow(
      'failover p95',
      metrics.failoverP95Ms ? `${Math.round(metrics.failoverP95Ms)}ms` : '—',
      (metrics.failoverP95Ms ?? 0) <= 10000
    ),
    metricRow(
      'consecutive failures',
      Number.isFinite(metrics.consecutiveFailures) ? String(metrics.consecutiveFailures) : '—',
      (metrics.consecutiveFailures ?? 0) <= 2
    ),
  ];

  return el(
    'section',
    { class: `tracker-addon-card realtime-sla-panel${className ? ` ${className}` : ''}` },
    [
      el('h3', { class: 'tracker-addon-title' }, t('freshness.sla.title')),
      el('ul', { class: 'realtime-sla-panel__metrics' }, items),
      warningFlags.length
        ? el(
            'p',
            { class: 'realtime-sla-panel__flags realtime-sla-panel__flags--warning' },
            `${t('freshness.sla.warning')}: ${warningFlags.join(', ')}`
          )
        : null,
      criticalFlags.length
        ? el(
            'p',
            { class: 'realtime-sla-panel__flags realtime-sla-panel__flags--critical' },
            `${t('freshness.sla.critical')}: ${criticalFlags.join(', ')}`
          )
        : null,
    ]
  );
}
