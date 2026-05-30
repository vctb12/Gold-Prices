/**
 * Shared IntersectionObserver for section reveal-on-scroll.
 *
 * Any element with `data-reveal` attribute is observed once; when it enters the
 * viewport the `.is-in-view` class is added and the element is unobserved.
 * CSS (see `styles/global.css` under "Motion Primitives") fades + slides it in,
 * with a `prefers-reduced-motion: reduce` no-op.
 *
 * Usage:
 *   import { observeReveal } from '/src/lib/reveal.js';
 *   observeReveal();            // scans whole document
 *   observeReveal(rootElement); // scans a subtree only
 *
 * One observer is shared across callers so repeated imports are cheap.
 */

let sharedObserver = null;

function getObserver() {
  if (sharedObserver || typeof IntersectionObserver === 'undefined') return sharedObserver;
  sharedObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in-view');
          sharedObserver.unobserve(entry.target);
        }
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.15 }
  );
  return sharedObserver;
}

/** Start observing every `[data-reveal]` element under `root` (defaults to
 *  `document`). Safe to call multiple times — already-observed nodes are
 *  skipped via `WeakSet`. */
const seen = new WeakSet();

export function observeReveal(root) {
  if (typeof document === 'undefined') return;
  const scope = root || document;
  const nodes = scope.querySelectorAll('[data-reveal]');
  const obs = getObserver();
  if (!obs) {
    // No IntersectionObserver support — reveal immediately.
    for (const node of nodes) node.classList.add('is-in-view');
    return;
  }
  for (const node of nodes) {
    if (seen.has(node)) continue;
    seen.add(node);
    obs.observe(node);
  }
}

/** Auto-run when the document is ready. Safe in ES-module context. */
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => observeReveal());
  } else {
    observeReveal();
  }
}
