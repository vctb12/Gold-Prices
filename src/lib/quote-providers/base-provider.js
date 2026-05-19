export class BaseQuoteProvider {
  constructor({ providerId, timeoutMs = 5000 } = {}) {
    if (!providerId) throw new Error('providerId is required');
    this.providerId = providerId;
    this.timeoutMs = timeoutMs;
  }

  async fetchQuote(_context = {}) {
    throw new Error(`fetchQuote not implemented for ${this.providerId}`);
  }

  normalizeQuote(raw = {}) {
    const fetchedAtIso = new Date(raw.fetchedAt || Date.now()).toISOString();
    const providerTimestamp = raw.providerTimestamp || raw.updatedAt || fetchedAtIso;

    return {
      price: Number(raw.price),
      providerTimestamp,
      fetchedAt: fetchedAtIso,
      providerId: raw.providerId || this.providerId,
      providerRaw: raw.providerRaw || null,
      providerPathSuccessful: raw.providerPathSuccessful !== false,
      forcedState: raw.forcedState || null,
      source: raw.source || raw.providerId || this.providerId,
      latencyMs: Number.isFinite(raw.latencyMs) ? raw.latencyMs : null,
      isFresh: raw.isFresh ?? null,
      isFallback: raw.isFallback ?? null,
    };
  }
}
