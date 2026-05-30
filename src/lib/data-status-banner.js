/**
 * Shared offline / error / partial-data banner for pages that fetch prices.
 */

import { el } from './safe-dom.js';

let bannerEl = null;

function ensureBanner() {
  if (bannerEl?.isConnected) return bannerEl;
  bannerEl = el('div', {
    class: 'data-status-banner',
    role: 'status',
    'aria-live': 'polite',
    hidden: '',
  });
  const main = document.querySelector('main') || document.body;
  main.prepend(bannerEl);
  return bannerEl;
}

/**
 * @param {{ message: string, variant?: 'offline'|'error'|'warning', onRetry?: () => void, lang?: 'en'|'ar' }} opts
 */
export function showDataStatusBanner(opts) {
  const node = ensureBanner();
  node.hidden = false;
  node.className = `data-status-banner data-status-banner--${opts.variant || 'warning'}`;
  node.replaceChildren();

  node.appendChild(el('span', { class: 'data-status-banner__text' }, opts.message));

  if (opts.onRetry) {
    const label = opts.lang === 'ar' ? 'إعادة المحاولة' : 'Retry';
    const btn = el('button', { type: 'button', class: 'btn btn-secondary btn-sm' }, label);
    btn.addEventListener('click', opts.onRetry);
    node.appendChild(btn);
  }
}

export function hideDataStatusBanner() {
  if (bannerEl) bannerEl.hidden = true;
}

/**
 * @param {'en'|'ar'} lang
 */
export function showOfflineBanner(lang, cachedAt) {
  const time = cachedAt || '—';
  showDataStatusBanner({
    lang,
    variant: 'offline',
    message:
      lang === 'ar'
        ? `غير متصل — عرض بيانات مخزّنة من ${time}`
        : `Offline — showing cached data from ${time}`,
  });
}
