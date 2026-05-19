import * as api from '../api.js';
import { BaseQuoteProvider } from './base-provider.js';

export class PrimaryQuoteProvider extends BaseQuoteProvider {
  constructor({ providerId = 'primary-provider', timeoutMs = 5000 } = {}) {
    super({ providerId, timeoutMs });
  }

  async fetchQuote() {
    const startedAt = Date.now();
    const data = await api.fetchGold();
    const latencyMs = Date.now() - startedAt;

    return this.normalizeQuote({
      price: data.price,
      providerTimestamp: data.sourceTimestamp || data.updatedAt,
      fetchedAt: data.updatedAt || new Date().toISOString(),
      providerId: data.source || this.providerId,
      source: data.source || this.providerId,
      providerRaw: data.raw || null,
      providerPathSuccessful: data.source !== 'cache-fallback',
      forcedState: data.isFallback === true ? 'fallback' : null,
      latencyMs,
      isFresh: data.isFresh ?? null,
      isFallback: data.isFallback ?? null,
    });
  }
}
