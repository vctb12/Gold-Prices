/**
 * Subtle page-enter fade for main content — respects reduced motion.
 */
export function initPageEnter(selector = 'main') {
  if (typeof document === 'undefined') return;
  const reduced =
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) return;

  const run = () => {
    document.body.classList.add('page-enter-ready');
    const main = document.querySelector(selector);
    if (main) main.classList.add('page-enter-active');
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run, { once: true });
  } else {
    run();
  }
}
