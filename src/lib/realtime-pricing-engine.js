import { getMarketStatus } from './live-status.js';
import { evaluateFreshnessState, isLiveEligible } from './freshness-policy.js';
import { ProviderHealthMonitor } from './provider-health.js';

const DEFAULT_BACKOFF_MS = [5000, 10000, 20000, 40000, 60000];
const WARNING_WINDOW_MS = 15 * 60 * 1000;
const ROLLING_WINDOW_MS = 30 * 60 * 1000;

function percentile(values, percentileValue) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((percentileValue / 100) * sorted.length) - 1)
  );
  return sorted[index];
}

function sanitizeMs(value, fallback) {
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function withJitter(baseMs, jitterMs) {
  if (!jitterMs) return baseMs;
  const jitter = Math.round((Math.random() * 2 - 1) * jitterMs);
  return Math.max(100, baseMs + jitter);
}

function providerTimestampMs(quote) {
  const parsed = new Date(quote?.providerTimestamp || quote?.fetchedAt || 0).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

export function createRealtimePricingEngine({
  primaryProvider,
  secondaryProvider,
  debug = false,
  config = {},
  nowFn = () => Date.now(),
  setTimeoutFn = setTimeout,
  clearTimeoutFn = clearTimeout,
  logger = console,
} = {}) {
  if (!primaryProvider) throw new Error('primaryProvider is required');

  const cfg = {
    activePollMs: sanitizeMs(config.activePollMs, 5000),
    hiddenPollMs: sanitizeMs(config.hiddenPollMs, 20000),
    fetchTimeoutMs: sanitizeMs(config.fetchTimeoutMs, 5000),
    jitterMs: sanitizeMs(config.jitterMs, 250),
    backoffMs:
      Array.isArray(config.backoffMs) && config.backoffMs.length
        ? config.backoffMs
        : DEFAULT_BACKOFF_MS,
  };

  const health = new ProviderHealthMonitor(nowFn);
  const subscribers = new Set();

  const state = {
    running: false,
    visible: typeof document === 'undefined' ? true : !document.hidden,
    timerId: null,
    inFlight: null,
    activeProviderId: primaryProvider.providerId,
    quote: null,
    freshness: { state: 'unavailable', ageMs: Number.POSITIVE_INFINITY, reason: 'boot' },
    lastPollStartedAt: 0,
    lastAppliedAt: 0,
    failureCount: 0,
    consecutiveFailures: 0,
    rolling: {
      pollAttempts: [],
      pollSuccesses: [],
      refreshIntervals: [],
      applyLatencies: [],
      failoverDurations: [],
      staleContradictions: [],
      liveEligibilityChecks: [],
    },
    events: [],
    failover: {
      active: false,
      startedAt: 0,
      fromProviderId: null,
      toProviderId: null,
    },
    metrics: {
      liveEligibilityRate: 1,
      successfulPollRate: 1,
      staleIncidentRate: 0,
      warningFlags: [],
      criticalFlags: [],
      consecutiveFailures: 0,
      monotonicGuardBlocks: 0,
      staleLivePrevented: 0,
      latestApplyLatencyMs: null,
      latestRefreshIntervalMs: null,
      nextPollInMs: cfg.activePollMs,
      visibilityRecoveryLatencyMs: null,
    },
  };

  function emit(type, payload = {}, level = 'info') {
    const event = { type, level, at: nowFn(), ...payload };
    state.events.push(event);
    if (state.events.length > 500) state.events.shift();
    if (debug) {
      const fn =
        level === 'critical' ? logger.error : level === 'warning' ? logger.warn : logger.info;
      fn?.('[realtime-pricing-engine]', event);
    }
    return event;
  }

  function pruneRolling() {
    const cutoff = nowFn() - ROLLING_WINDOW_MS;
    const warningCutoff = nowFn() - WARNING_WINDOW_MS;

    state.rolling.pollAttempts = state.rolling.pollAttempts.filter((entry) => entry.at >= cutoff);
    state.rolling.pollSuccesses = state.rolling.pollSuccesses.filter((entry) => entry.at >= cutoff);
    state.rolling.refreshIntervals = state.rolling.refreshIntervals.filter(
      (entry) => entry.at >= cutoff
    );
    state.rolling.applyLatencies = state.rolling.applyLatencies.filter(
      (entry) => entry.at >= cutoff
    );
    state.rolling.failoverDurations = state.rolling.failoverDurations.filter(
      (entry) => entry.at >= cutoff
    );
    state.rolling.staleContradictions = state.rolling.staleContradictions.filter(
      (entry) => entry.at >= cutoff
    );
    state.rolling.liveEligibilityChecks = state.rolling.liveEligibilityChecks.filter(
      (entry) => entry.at >= warningCutoff
    );
  }

  function computeMetrics() {
    pruneRolling();

    const refreshValues = state.rolling.refreshIntervals.map((entry) => entry.ms);
    const latencyValues = state.rolling.applyLatencies.map((entry) => entry.ms);

    const pollAttempts = state.rolling.pollAttempts.length;
    const pollSuccesses = state.rolling.pollSuccesses.length;
    const liveChecks = state.rolling.liveEligibilityChecks;
    const liveEligible = liveChecks.filter((entry) => entry.ok).length;

    const staleIncidents = state.rolling.staleContradictions.length;

    state.metrics.liveEligibilityRate = liveChecks.length ? liveEligible / liveChecks.length : 1;
    state.metrics.successfulPollRate = pollAttempts ? pollSuccesses / pollAttempts : 1;
    state.metrics.staleIncidentRate = pollSuccesses ? staleIncidents / pollSuccesses : 0;
    state.metrics.p50RefreshIntervalMs = percentile(refreshValues, 50);
    state.metrics.p95RefreshIntervalMs = percentile(refreshValues, 95);
    state.metrics.p99RefreshIntervalMs = percentile(refreshValues, 99);
    state.metrics.p95ApplyLatencyMs = percentile(latencyValues, 95);
    state.metrics.p99ApplyLatencyMs = percentile(latencyValues, 99);

    const warningFlags = [];
    const criticalFlags = [];

    if ((state.metrics.p95RefreshIntervalMs ?? 0) > 12000) {
      warningFlags.push('refresh_interval_p95_over_12s');
    }
    if (state.metrics.successfulPollRate < 0.97) {
      warningFlags.push('successful_poll_rate_below_97pct');
    }
    if ((state.metrics.failoverP95Ms ?? 0) > 10000) {
      warningFlags.push('failover_p95_over_10s');
    }

    if (staleIncidents > 0) {
      criticalFlags.push('stale_live_contradiction_detected');
    }
    if (state.lastAppliedAt && nowFn() - state.lastAppliedAt > 120000 && getMarketStatus().isOpen) {
      criticalFlags.push('no_successful_quote_over_120s_market_open');
    }
    if ((state.metrics.p95ApplyLatencyMs ?? 0) > 4000) {
      criticalFlags.push('apply_latency_p95_over_4s');
    }
    const primaryHealth = health.getSnapshot(primaryProvider.providerId);
    const secondaryHealth = secondaryProvider
      ? health.getSnapshot(secondaryProvider.providerId)
      : { healthy: false };
    if (!primaryHealth.healthy && !secondaryHealth.healthy) {
      criticalFlags.push('both_providers_unhealthy');
    }

    state.metrics.warningFlags = warningFlags;
    state.metrics.criticalFlags = criticalFlags;

    if (warningFlags.length) emit('SLO_BREACH_WARNING', { warningFlags }, 'warning');
    if (criticalFlags.length) emit('SLO_BREACH_CRITICAL', { criticalFlags }, 'critical');
  }

  function snapshot() {
    computeMetrics();
    const now = nowFn();
    const ageMs = state.quote
      ? Math.max(0, now - providerTimestampMs(state.quote))
      : Number.POSITIVE_INFINITY;

    const fresh = state.quote
      ? evaluateFreshnessState({
          ageMs,
          providerHealthy: health.getSnapshot(state.activeProviderId).healthy,
          providerPathSuccessful: state.quote.providerPathSuccessful !== false,
          forcedState: state.quote.forcedState || (state.quote.isFallback ? 'fallback' : null),
          marketOpen: getMarketStatus().isOpen,
        })
      : { state: 'unavailable', ageMs: Number.POSITIVE_INFINITY, reason: 'no-quote' };

    if (fresh.state === 'live' && ageMs > 10000) {
      state.metrics.staleLivePrevented += 1;
      emit('STALE_LIVE_PREVENTED', { ageMs, providerId: state.activeProviderId }, 'warning');
      state.rolling.staleContradictions.push({ at: now, ageMs, prevented: true });
    }

    state.freshness = fresh;

    const failoverValues = state.rolling.failoverDurations.map((entry) => entry.ms);
    state.metrics.failoverP95Ms = percentile(failoverValues, 95);

    return {
      running: state.running,
      visible: state.visible,
      quote: state.quote,
      freshness: state.freshness,
      activeProviderId: state.activeProviderId,
      providerHealth: {
        [primaryProvider.providerId]: health.getSnapshot(primaryProvider.providerId),
        ...(secondaryProvider
          ? { [secondaryProvider.providerId]: health.getSnapshot(secondaryProvider.providerId) }
          : {}),
      },
      metrics: {
        ...state.metrics,
        consecutiveFailures: state.consecutiveFailures,
        nextPollInMs: state.metrics.nextPollInMs,
      },
      config: cfg,
      events: state.events.slice(-80),
    };
  }

  function notify() {
    const payload = snapshot();
    subscribers.forEach((subscriber) => {
      try {
        subscriber(payload);
      } catch (error) {
        logger.error?.('[realtime-pricing-engine] subscriber error', error);
      }
    });
  }

  function scheduleNextPoll({ immediate = false } = {}) {
    if (!state.running) return;
    if (state.timerId) clearTimeoutFn(state.timerId);

    const basePoll = state.visible ? cfg.activePollMs : cfg.hiddenPollMs;
    const backoffIndex = Math.min(state.failureCount, cfg.backoffMs.length - 1);
    const failureBackoff = state.failureCount ? cfg.backoffMs[backoffIndex] : basePoll;
    const pollMs = withJitter(immediate ? 0 : failureBackoff, cfg.jitterMs);

    state.metrics.nextPollInMs = pollMs;
    state.timerId = setTimeoutFn(() => {
      state.timerId = null;
      pollOnce('scheduled').catch((error) => {
        logger.warn?.('[realtime-pricing-engine] poll loop error', error);
      });
    }, pollMs);
  }

  function beginFailover(toProviderId) {
    if (state.failover.active) return;
    state.failover = {
      active: true,
      startedAt: nowFn(),
      fromProviderId: state.activeProviderId,
      toProviderId,
    };
    emit(
      'FAILOVER_INITIATED',
      {
        fromProviderId: state.activeProviderId,
        toProviderId,
      },
      'warning'
    );
  }

  function completeFailover() {
    if (!state.failover.active) return;
    const durationMs = nowFn() - state.failover.startedAt;
    state.rolling.failoverDurations.push({ at: nowFn(), ms: durationMs });
    emit(
      'FAILOVER_COMPLETED',
      {
        fromProviderId: state.failover.fromProviderId,
        toProviderId: state.failover.toProviderId,
        durationMs,
      },
      'warning'
    );
    state.failover = {
      active: false,
      startedAt: 0,
      fromProviderId: null,
      toProviderId: null,
    };
  }

  async function fetchFromProvider(provider) {
    const controller = new AbortController();

    if (state.inFlight?.controller) {
      state.inFlight.controller.abort();
    }

    const startedAt = nowFn();
    state.inFlight = { controller, startedAt };

    try {
      const quote = await provider.fetchQuote({
        signal: controller.signal,
        timeoutMs: cfg.fetchTimeoutMs,
      });
      const latencyMs = nowFn() - startedAt;
      health.recordAttempt(provider.providerId, {
        success: true,
        latencyMs,
        providerTimestamp: quote.providerTimestamp,
      });
      return { quote, latencyMs };
    } catch (error) {
      const latencyMs = nowFn() - startedAt;
      health.recordAttempt(provider.providerId, {
        success: false,
        latencyMs,
        errorType: error?.name || 'provider_error',
      });
      throw error;
    } finally {
      state.inFlight = null;
    }
  }

  async function fetchQuoteWithFailover() {
    const primary = primaryProvider;
    const secondary = secondaryProvider;
    const primaryHealth = health.getSnapshot(primary.providerId);

    const preferSecondary =
      secondary &&
      !primaryHealth.healthy &&
      health.canSwitchProvider() &&
      state.activeProviderId !== secondary.providerId;

    const orderedProviders = preferSecondary
      ? [secondary, primary].filter(Boolean)
      : [primary, secondary].filter(Boolean);

    let lastError = null;

    for (const provider of orderedProviders) {
      try {
        if (provider.providerId !== state.activeProviderId) {
          beginFailover(provider.providerId);
        }

        const result = await fetchFromProvider(provider);

        if (provider.providerId !== state.activeProviderId) {
          state.activeProviderId = provider.providerId;
          health.setActiveProvider(provider.providerId);
          completeFailover();
        }

        return result;
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError || new Error('no provider available');
  }

  function applyQuote(quote, { pollStartedAt, applyLatencyMs }) {
    const incomingTs = providerTimestampMs(quote);
    const existingTs = providerTimestampMs(state.quote);

    if (state.quote && incomingTs > 0 && existingTs > 0 && incomingTs < existingTs) {
      state.metrics.monotonicGuardBlocks += 1;
      emit(
        'MONOTONIC_GUARD_BLOCKED_OLD_QUOTE',
        {
          incomingTs,
          existingTs,
          providerId: quote.providerId,
        },
        'warning'
      );
      return false;
    }

    state.quote = {
      ...quote,
      fetchedAt: quote.fetchedAt || new Date(nowFn()).toISOString(),
      providerId: quote.providerId || state.activeProviderId,
      status: null,
    };

    state.lastAppliedAt = nowFn();

    if (state.lastPollStartedAt) {
      const refreshIntervalMs = Math.max(0, pollStartedAt - state.lastPollStartedAt);
      state.rolling.refreshIntervals.push({ at: nowFn(), ms: refreshIntervalMs });
      state.metrics.latestRefreshIntervalMs = refreshIntervalMs;
    }

    state.lastPollStartedAt = pollStartedAt;
    state.rolling.applyLatencies.push({ at: nowFn(), ms: applyLatencyMs });
    state.metrics.latestApplyLatencyMs = applyLatencyMs;

    const ageMs = Math.max(0, nowFn() - incomingTs);
    const providerStatus = health.getSnapshot(state.activeProviderId);
    const freshness = evaluateFreshnessState({
      ageMs,
      providerHealthy: providerStatus.healthy,
      providerPathSuccessful: quote.providerPathSuccessful !== false,
      forcedState: quote.forcedState || (quote.isFallback ? 'fallback' : null),
      marketOpen: getMarketStatus().isOpen,
    });

    state.quote.status = freshness.state;
    state.freshness = freshness;

    state.rolling.liveEligibilityChecks.push({
      at: nowFn(),
      ok: isLiveEligible({
        state: freshness.state,
        ageMs: freshness.ageMs,
        providerHealthy: providerStatus.healthy,
        providerPathSuccessful: quote.providerPathSuccessful !== false,
      }),
    });

    return true;
  }

  async function pollOnce(reason = 'manual') {
    if (!state.running) return;

    const pollStartedAt = nowFn();
    state.rolling.pollAttempts.push({ at: pollStartedAt, reason });

    try {
      const { quote, latencyMs } = await fetchQuoteWithFailover();
      const applyLatencyMs = Math.max(0, nowFn() - pollStartedAt);
      const applied = applyQuote(quote, { pollStartedAt, applyLatencyMs });

      if (applied) {
        state.failureCount = 0;
        state.consecutiveFailures = 0;
        state.rolling.pollSuccesses.push({ at: nowFn(), reason });
      }

      if (Number.isFinite(latencyMs)) {
        state.metrics.latestNetworkLatencyMs = latencyMs;
      }
    } catch (error) {
      state.failureCount += 1;
      state.consecutiveFailures += 1;
      emit(
        'POLL_FAILED',
        {
          reason,
          activeProviderId: state.activeProviderId,
          consecutiveFailures: state.consecutiveFailures,
          error: error?.message || String(error),
        },
        'warning'
      );
    }

    notify();
    scheduleNextPoll();
  }

  function start() {
    if (state.running) return;
    state.running = true;
    health.setActiveProvider(state.activeProviderId);
    scheduleNextPoll({ immediate: true });
    notify();
  }

  function stop() {
    state.running = false;
    if (state.timerId) clearTimeoutFn(state.timerId);
    state.timerId = null;
    if (state.inFlight?.controller) {
      state.inFlight.controller.abort();
      state.inFlight = null;
    }
    notify();
  }

  function refreshNow(reason = 'manual') {
    if (!state.running) return Promise.resolve();
    if (state.timerId) {
      clearTimeoutFn(state.timerId);
      state.timerId = null;
    }
    return pollOnce(reason);
  }

  function setVisibility(isVisible) {
    const becameVisible = isVisible && !state.visible;
    state.visible = Boolean(isVisible);

    if (becameVisible) {
      const startedAt = nowFn();
      setTimeoutFn(() => {
        refreshNow('visibility-recovery').finally(() => {
          state.metrics.visibilityRecoveryLatencyMs = nowFn() - startedAt;
          notify();
        });
      }, 0);
    }

    if (state.running) {
      scheduleNextPoll({ immediate: becameVisible });
    }

    notify();
  }

  function subscribe(listener) {
    if (typeof listener !== 'function') return () => {};
    subscribers.add(listener);
    listener(snapshot());
    return () => subscribers.delete(listener);
  }

  function seedFromCache(cachedQuote) {
    if (!cachedQuote?.price) return;
    state.quote = {
      price: Number(cachedQuote.price),
      providerTimestamp:
        cachedQuote.updatedAt || cachedQuote.providerTimestamp || new Date().toISOString(),
      fetchedAt: cachedQuote.fetchedAt || new Date().toISOString(),
      providerId: cachedQuote.providerId || 'cache',
      source: cachedQuote.source || 'cache',
      providerPathSuccessful: false,
      forcedState: 'cached',
      status: 'cached',
      isFallback: true,
      isFresh: false,
    };
    state.freshness = {
      state: 'cached',
      ageMs: Math.max(0, nowFn() - providerTimestampMs(state.quote)),
      reason: 'cache-boot',
    };
    notify();
  }

  return {
    start,
    stop,
    refreshNow,
    subscribe,
    setVisibility,
    seedFromCache,
    getSnapshot: snapshot,
  };
}
