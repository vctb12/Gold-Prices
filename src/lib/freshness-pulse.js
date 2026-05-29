/**
 * Freshness pulse primitive — applies a one-shot `data-freshness-pulse`
 * attribute to a target element for ~600 ms, then clears it. The pulse is
 * throttled to at most one per `minIntervalMs` (default 90 s) per element
 * to match Track E spec: "Freshness pill pulse once per tick, capped
 * 1 per 90 s."
 *
 * Respects `prefers-reduced-motion: reduce` at the CSS layer (the
 * attribute still toggles, but the animation no-ops).
 *
 * Usage:
 *   import { pulseFreshness } from './lib/freshness-pulse.js';
 *   pulseFreshness(pillEl);              // default 90 s throttle
 *   pulseFreshness(pillEl, { minIntervalMs: 60_000 });
 */

const DEFAULT_MIN_INTERVAL_MS = 90 * 1000;
const PULSE_DURATION_MS = 600;

const lastPulseAt = new WeakMap();

export function pulseFreshness(el, { minIntervalMs = DEFAULT_MIN_INTERVAL_MS } = {}) {
  if (!el || typeof el !== 'object' || typeof el.setAttribute !== 'function') return false;

  const now = Date.now();
  const last = lastPulseAt.get(el) ?? 0;
  if (now - last < minIntervalMs) return false;

  lastPulseAt.set(el, now);
  el.setAttribute('data-freshness-pulse', '');

  const timer =
    typeof window !== 'undefined' && typeof window.setTimeout === 'function'
      ? window.setTimeout
      : setTimeout;

  timer(() => {
    try {
      el.removeAttribute('data-freshness-pulse');
    } catch {
      /* element detached — ignore */
    }
  }, PULSE_DURATION_MS);

  return true;
}

export const FRESHNESS_PULSE_DURATION_MS = PULSE_DURATION_MS;
