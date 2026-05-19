import { BaseQuoteProvider } from './base-provider.js';
import * as cache from '../cache.js';

const LAST_PRICE_PATH = '/data/last_gold_price.json';

async function tryFetchLastSnapshot(signal) {
  try {
    const response = await fetch(`${LAST_PRICE_PATH}?t=${Date.now()}`, {
      cache: 'no-store',
      signal,
    });
    if (!response.ok) return null;
    const payload = await response.json();
    const quote = payload?.gold?.ounce_usd;
    if (!Number.isFinite(Number(quote)) || Number(quote) <= 0) return null;
    return {
      price: Number(quote),
      providerTimestamp: payload?.updatedAt || payload?.timestamp_utc || null,
      providerRaw: payload,
    };
  } catch {
    return null;
  }
}

export class SecondaryQuoteProvider extends BaseQuoteProvider {
  constructor({ providerId = 'secondary-provider-cache', timeoutMs = 5000 } = {}) {
    super({ providerId, timeoutMs });
  }

  async fetchQuote({ signal } = {}) {
    const startedAt = Date.now();
    const fallbackFile = await tryFetchLastSnapshot(signal);

    if (fallbackFile) {
      return this.normalizeQuote({
        ...fallbackFile,
        fetchedAt: new Date().toISOString(),
        providerId: this.providerId,
        source: this.providerId,
        providerPathSuccessful: false,
        forcedState: 'fallback',
        latencyMs: Date.now() - startedAt,
        isFresh: false,
        isFallback: true,
      });
    }

    const cached = cache.getFallbackGoldPrice();
    if (cached?.price) {
      return this.normalizeQuote({
        price: cached.price,
        providerTimestamp: cached.updatedAt || cached.fetchedAt || new Date().toISOString(),
        fetchedAt: cached.fetchedAt || new Date().toISOString(),
        providerId: this.providerId,
        source: this.providerId,
        providerRaw: cached,
        providerPathSuccessful: false,
        forcedState: 'fallback',
        latencyMs: Date.now() - startedAt,
        isFresh: false,
        isFallback: true,
      });
    }

    throw new Error('secondary provider unavailable');
  }
}
