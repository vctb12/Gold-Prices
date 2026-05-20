const SECOND_MS = 1000;

export const FRESHNESS_POLICY = {
  liveMaxAgeMs: 10 * SECOND_MS,
  cachedMaxAgeMs: 60 * SECOND_MS,
  delayedMaxAgeMs: 300 * SECOND_MS,
};

function clampAgeMs(ageMs) {
  return Number.isFinite(ageMs) && ageMs >= 0 ? ageMs : Number.POSITIVE_INFINITY;
}

/**
 * Determines truth-first freshness state. `live` is only allowed when the provider
 * path is successful, provider is healthy, and age is within the live budget.
 */
export function evaluateFreshnessState({
  ageMs,
  providerHealthy = true,
  providerPathSuccessful = true,
  marketOpen = true,
  forcedState = null,
  policy = FRESHNESS_POLICY,
} = {}) {
  const normalizedAgeMs = clampAgeMs(ageMs);

  if (!marketOpen) {
    return { state: 'closed', ageMs: normalizedAgeMs, reason: 'market-closed' };
  }

  if (
    forcedState &&
    ['cached', 'delayed', 'estimated', 'fallback', 'closed'].includes(forcedState)
  ) {
    return { state: forcedState, ageMs: normalizedAgeMs, reason: `forced-${forcedState}` };
  }

  if (!providerPathSuccessful || !providerHealthy) {
    if (normalizedAgeMs <= policy.delayedMaxAgeMs) {
      return { state: 'fallback', ageMs: normalizedAgeMs, reason: 'provider-unhealthy' };
    }
    return { state: 'estimated', ageMs: normalizedAgeMs, reason: 'provider-unavailable' };
  }

  if (normalizedAgeMs <= policy.liveMaxAgeMs) {
    return { state: 'live', ageMs: normalizedAgeMs, reason: 'within-live-budget' };
  }

  if (normalizedAgeMs <= policy.cachedMaxAgeMs) {
    return { state: 'cached', ageMs: normalizedAgeMs, reason: 'within-cached-budget' };
  }

  if (normalizedAgeMs <= policy.delayedMaxAgeMs) {
    return { state: 'delayed', ageMs: normalizedAgeMs, reason: 'within-delayed-budget' };
  }

  return { state: 'estimated', ageMs: normalizedAgeMs, reason: 'beyond-delayed-budget' };
}

export function isLiveEligible({ state, ageMs, providerHealthy, providerPathSuccessful } = {}) {
  return (
    state === 'live' &&
    Number.isFinite(ageMs) &&
    ageMs <= FRESHNESS_POLICY.liveMaxAgeMs &&
    providerHealthy === true &&
    providerPathSuccessful === true
  );
}
