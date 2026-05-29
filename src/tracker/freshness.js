// tracker/freshness.js — live freshness models and badges
import { _state, tx } from './_ctx.js';
import { el, setText } from '../lib/safe-dom.js';
import { getLiveFreshness, getMarketStatus } from '../lib/live-status.js';
import { formatProviderLabel } from '../lib/provider-labels.js';

export const TRACKER_BADGE_CLASSES = [
  'tracker-badge-live',
  'tracker-badge--cached',
  'tracker-badge--stale',
  'tracker-badge--closed',
  'tracker-badge--unavailable',
];
export const SOURCE_BADGE_CLASS = {
  live: 'tracker-source-badge--live',
  delayed: 'tracker-source-badge--estimated',
  cached: 'tracker-source-badge--cached',
  stale: 'tracker-source-badge--estimated',
  fallback: 'tracker-source-badge--estimated',
  closed: 'tracker-source-badge--closed',
  unavailable: 'tracker-source-badge--unavailable',
};
export const STATUS_BADGE_CLASS = {
  live: 'tracker-badge-live',
  delayed: 'tracker-badge--cached',
  cached: 'tracker-badge--cached',
  stale: 'tracker-badge--stale',
  fallback: 'tracker-badge--stale',
  closed: 'tracker-badge--closed',
  unavailable: 'tracker-badge--unavailable',
};

export function getFreshnessModel() {
  const freshness = getLiveFreshness({
    updatedAt: _state.live?.updatedAt,
    lang: _state.lang,
    hasLiveFailure: _state.hasLiveFailure,
    isFallback: _state.live?.isFallback ?? null,
    isFresh: _state.live?.isFresh ?? null,
  });
  const market = getMarketStatus();
  const effectiveKey = market.isOpen ? freshness.key : 'closed';
  const statusLabel = tx(`source.${effectiveKey}`);
  const providerLabel = formatProviderLabel(
    _state.live?.providerId || _state.live?.source || 'primary-provider'
  );
  const tooltip =
    effectiveKey === 'closed'
      ? tx('closedStateDetail', { time: freshness.timeText })
      : freshness.key === 'unavailable'
        ? tx('liveUnavailable')
        : `${tx('summary.freshnessCopy', {
            source: statusLabel,
            age: freshness.ageText,
            time: freshness.timeText,
          })} · ${tx('summary.sourceTitle')}: ${providerLabel}`;

  return {
    ...freshness,
    effectiveKey,
    sourceLabel: statusLabel,
    providerLabel,
    sourceBadgeClass: SOURCE_BADGE_CLASS[effectiveKey] || SOURCE_BADGE_CLASS.cached,
    badgeClass: STATUS_BADGE_CLASS[effectiveKey] || STATUS_BADGE_CLASS.cached,
    tooltip,
  };
}

export function applyStatusBadge(node, freshness, text) {
  if (!node) return;
  node.classList.remove(...TRACKER_BADGE_CLASSES);
  node.classList.add(freshness.badgeClass);
  node.title = freshness.tooltip;
  node.setAttribute('aria-label', freshness.tooltip);
  if (typeof text === 'string') setText(node, text);
}

export function buildSourceBadge(freshness) {
  return el(
    'span',
    {
      class: `tracker-source-badge ${freshness.sourceBadgeClass}`,
      title: freshness.tooltip,
      'aria-label': freshness.tooltip,
    },
    freshness.providerLabel
  );
}
