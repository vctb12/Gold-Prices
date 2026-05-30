/**
 * Defer a callback until a section enters the viewport (IntersectionObserver).
 * @param {Element|string} target
 * @param {() => void | Promise<void>} onVisible
 * @param {{ rootMargin?: string }} [options]
 */
export function lazySection(target, onVisible, options = {}) {
  const el = typeof target === 'string' ? document.querySelector(target) : target;
  if (!el || typeof onVisible !== 'function') return;

  if (!('IntersectionObserver' in window)) {
    onVisible();
    return;
  }

  let done = false;
  const observer = new IntersectionObserver(
    (entries) => {
      if (done) return;
      const hit = entries.some((e) => e.isIntersecting);
      if (!hit) return;
      done = true;
      observer.disconnect();
      onVisible();
    },
    { rootMargin: options.rootMargin ?? '120px 0px' }
  );
  observer.observe(el);
}
