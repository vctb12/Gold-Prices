/**
 * Tiny numeric count-up primitive for live-price transitions.
 *
 * Used by hero price cells, karat-strip cards, tracker hero, and market cards
 * to smoothly animate from the previous value to the new one using
 * requestAnimationFrame. Duration scales with the magnitude of the change and
 * is capped so large jumps don't feel sluggish.
 *
 * Respects `prefers-reduced-motion: reduce` by writing the final value
 * immediately (no animation).
 *
 * Usage:
 *   import { countUp } from '/src/lib/count-up.js';
 *   countUp(el, 3245.12, { decimals: 2, format: (n) => n.toFixed(2) });
 */

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const activeAnimations = new WeakMap();

/** Directional-flash duration. Must match the `flash-up` / `flash-down`
 *  keyframe duration in `styles/global.css`. */
const FLASH_DURATION_MS = 1000;

function defaultFormat(n, decimals) {
  return Number.isFinite(n) ? n.toFixed(decimals) : String(n);
}

/** Parse the current numeric value out of a formatted price string. Accepts
 *  digits, an optional leading sign, a single decimal separator, and ignores
 *  thousands separators / currency symbols. Returns `NaN` for anything else. */
function parseCurrentValue(text) {
  if (typeof text !== 'string' || !text) return NaN;
  const match = text.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  return match ? parseFloat(match[0]) : NaN;
}

/**
 * Animate `el.textContent` from its current numeric value to `target`.
 * Options:
 *   - decimals: integer, used by the default formatter (default 2)
 *   - format:   function(n) -> string (default `n.toFixed(decimals)`)
 *   - minDurationMs: lower cap on animation length (default 180)
 *   - maxDurationMs: upper cap on animation length (default 800)
 *   - pxPerMs: speed heuristic in "numeric units per ms" (default 1.5)
 *   - flash:  'auto' | 'up' | 'down' | null — toggle `data-flash` attribute
 *             for 1s to tint the element green/red. Defaults to 'auto'.
 */
export function countUp(el, target, options = {}) {
  if (!el || !Number.isFinite(target)) return;
  const decimals = options.decimals ?? 2;
  const format = options.format || ((n) => defaultFormat(n, decimals));
  const minDurationMs = options.minDurationMs ?? 180;
  const maxDurationMs = options.maxDurationMs ?? 800;
  const unitsPerMs = options.unitsPerMs ?? 1.5;

  const prev = parseCurrentValue(String(el.textContent || ''));
  const start = Number.isFinite(prev) ? prev : target;
  const diff = target - start;

  // Directional flash (green up / red down), unless caller opts out.
  const flash = options.flash === undefined ? 'auto' : options.flash;
  if (flash && diff !== 0) {
    const dir = flash === 'auto' ? (diff > 0 ? 'up' : 'down') : flash;
    el.setAttribute('data-flash', dir);
    // Let the animation complete once, then clear.
    window.setTimeout(() => el.removeAttribute('data-flash'), FLASH_DURATION_MS);
  }

  if (prefersReducedMotion() || start === target) {
    el.textContent = format(target);
    return;
  }

  // Cancel any in-flight animation on this element.
  const existing = activeAnimations.get(el);
  if (existing) cancelAnimationFrame(existing.rafId);

  const duration = Math.max(minDurationMs, Math.min(maxDurationMs, Math.abs(diff) / unitsPerMs));
  const t0 = performance.now();

  function tick(now) {
    const t = Math.min(1, (now - t0) / duration);
    // easeOutQuad
    const eased = 1 - (1 - t) * (1 - t);
    const value = start + diff * eased;
    el.textContent = format(value);
    if (t < 1) {
      const rafId = requestAnimationFrame(tick);
      activeAnimations.set(el, { rafId });
    } else {
      el.textContent = format(target);
      activeAnimations.delete(el);
    }
  }

  const rafId = requestAnimationFrame(tick);
  activeAnimations.set(el, { rafId });
}
