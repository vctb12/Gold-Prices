import { getMarketStatus } from './live-status.js';

export const FRESHNESS_CONFIG = {
  live: { tone: 'live', translationKey: 'freshness.badge.live' },
  cached: { tone: 'cached', translationKey: 'freshness.badge.cached' },
  delayed: { tone: 'delayed', translationKey: 'freshness.badge.delayed' },
  estimated: { tone: 'estimated', translationKey: 'freshness.badge.estimated' },
  fallback: { tone: 'fallback', translationKey: 'freshness.badge.fallback' },
  closed: { tone: 'closed', translationKey: 'freshness.badge.closed' },
  stale: { tone: 'fallback', translationKey: 'freshness.badge.stale' },
  unavailable: { tone: 'fallback', translationKey: 'freshness.badge.unavailable' },
};

export function normalizeFreshnessState(state, { marketOpen = true } = {}) {
  if (!marketOpen) return 'closed';
  if (FRESHNESS_CONFIG[state]) return state;
  return 'estimated';
}

export function getFreshnessMeta({
  state = 'estimated',
  source = '',
  updatedAt = null,
  marketOpen = true,
} = {}) {
  const normalizedState = normalizeFreshnessState(state, { marketOpen });
  const config = FRESHNESS_CONFIG[normalizedState] || FRESHNESS_CONFIG.estimated;
  return {
    state: normalizedState,
    source: source || 'Gold Ticker Live',
    updatedAt,
    tone: config.tone,
    translationKey: config.translationKey,
  };
}

export function formatUtcTimestamp(value, lang = 'en') {
  if (!value) return '—';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '—';
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-AE' : 'en-GB', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'UTC',
  }).format(date);
}

export function deriveMarketState(now = new Date()) {
  return getMarketStatus(now).isOpen ? 'live' : 'closed';
}
