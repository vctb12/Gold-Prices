const WINDOW_MS = 30 * 60 * 1000;
const FAILURE_DETECTION_MAX_ATTEMPTS = 2;
const FAILURE_DETECTION_MAX_MS = 15 * 1000;
const FAILOVER_COOLDOWN_MS = 45 * 1000;

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

export class ProviderHealthMonitor {
  constructor(nowFn = () => Date.now()) {
    this.nowFn = nowFn;
    this.providers = new Map();
    this.activeProviderId = null;
    this.lastSwitchAt = 0;
  }

  ensure(providerId) {
    if (!this.providers.has(providerId)) {
      this.providers.set(providerId, {
        providerId,
        attempts: [],
        consecutiveFailures: 0,
        lastSuccessAt: 0,
        lastFailureAt: 0,
      });
    }
    return this.providers.get(providerId);
  }

  recordAttempt(
    providerId,
    { success, latencyMs = null, providerTimestamp = null, errorType = null } = {}
  ) {
    const now = this.nowFn();
    const provider = this.ensure(providerId);

    provider.attempts.push({
      at: now,
      success: Boolean(success),
      latencyMs: Number.isFinite(latencyMs) ? latencyMs : null,
      providerTimestamp,
      errorType,
    });

    provider.attempts = provider.attempts.filter((entry) => now - entry.at <= WINDOW_MS);

    if (success) {
      provider.lastSuccessAt = now;
      provider.consecutiveFailures = 0;
    } else {
      provider.lastFailureAt = now;
      provider.consecutiveFailures += 1;
    }

    return this.getSnapshot(providerId);
  }

  getSnapshot(providerId) {
    const now = this.nowFn();
    const provider = this.ensure(providerId);
    const attempts = provider.attempts;
    const successes = attempts.filter((entry) => entry.success);
    const latencies = successes
      .map((entry) => entry.latencyMs)
      .filter((value) => Number.isFinite(value) && value >= 0);

    const lastFailureAgeMs = provider.lastFailureAt > 0 ? now - provider.lastFailureAt : Infinity;
    const failureDetectionBreached =
      provider.consecutiveFailures >= FAILURE_DETECTION_MAX_ATTEMPTS ||
      (provider.consecutiveFailures > 0 && lastFailureAgeMs <= FAILURE_DETECTION_MAX_MS);

    const successRate = attempts.length ? successes.length / attempts.length : 1;

    return {
      providerId,
      attempts: attempts.length,
      successRate,
      consecutiveFailures: provider.consecutiveFailures,
      medianLatencyMs: median(latencies),
      p95LatencyMs: percentile(latencies, 95),
      lastSuccessAt: provider.lastSuccessAt || null,
      lastFailureAt: provider.lastFailureAt || null,
      healthy: !failureDetectionBreached,
      failureDetectionBreached,
    };
  }

  setActiveProvider(providerId) {
    if (providerId && this.activeProviderId !== providerId) {
      this.activeProviderId = providerId;
      this.lastSwitchAt = this.nowFn();
    }
  }

  canSwitchProvider() {
    return this.nowFn() - this.lastSwitchAt >= FAILOVER_COOLDOWN_MS;
  }
}
