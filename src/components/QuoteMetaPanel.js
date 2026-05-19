import { el } from '../lib/safe-dom.js';
import { formatUtcTimestamp } from '../lib/freshness.js';

export function renderQuoteMetaPanel({
  lang = 'en',
  statusLabel = '—',
  sourceLabel = '—',
  providerId = '—',
  providerTimestamp = null,
  fetchedAt = null,
  ageLabel = '—',
  pollIntervalMs = null,
  lastFetchLatencyMs = null,
  t = (key) => key,
  className = '',
} = {}) {
  const rows = [
    ['freshness.meta.status', statusLabel],
    ['freshness.meta.source', sourceLabel],
    ['freshness.meta.providerId', providerId || '—'],
    ['freshness.meta.providerTimestamp', `${formatUtcTimestamp(providerTimestamp, lang)} UTC`],
    ['freshness.meta.fetchedAt', `${formatUtcTimestamp(fetchedAt, lang)} UTC`],
    ['freshness.meta.age', ageLabel],
    [
      'freshness.meta.pollInterval',
      Number.isFinite(pollIntervalMs) ? `${Math.round(pollIntervalMs / 1000)}s` : '—',
    ],
    [
      'freshness.meta.lastFetchLatency',
      Number.isFinite(lastFetchLatencyMs) ? `${Math.round(lastFetchLatencyMs)}ms` : '—',
    ],
  ];

  return el(
    'section',
    {
      class: `tracker-addon-card quote-meta-panel${className ? ` ${className}` : ''}`,
      role: 'status',
      'aria-live': 'polite',
    },
    [
      el('h3', { class: 'tracker-addon-title' }, t('freshness.meta.title')),
      el(
        'dl',
        { class: 'quote-meta-panel__list' },
        rows.flatMap(([labelKey, value]) => [
          el('dt', { class: 'quote-meta-panel__label' }, t(labelKey)),
          el('dd', { class: 'quote-meta-panel__value' }, value),
        ])
      ),
    ]
  );
}
