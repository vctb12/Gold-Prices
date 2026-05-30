/**
 * Shared bootstrap for static /content/ HTML pages.
 * Injects nav, footer, ticker, breadcrumbs, related guides, and page-enter fade.
 */

import { injectNav } from '../components/nav.js';
import { injectFooter } from '../components/footer.js';
import { injectTicker } from '../components/ticker.js';
import { renderBreadcrumbs } from '../components/breadcrumbs.js';
import { mountRelatedGuides } from '../components/RelatedGuides.js';
import { initPageEnter } from './page-enter.js';
import { renderAdSlot } from '../components/adSlot.js';

/**
 * @param {object} [options]
 * @param {'en'|'ar'} [options.lang]
 * @param {number} [options.depth] Path depth for asset imports (auto if omitted)
 * @param {Array<{label: string, url: string}>} [options.crumbs]
 * @param {string[]} [options.adSlots] Element ids for mid-content ad slots
 * @param {boolean} [options.ticker] Mount spot ticker (default true)
 * @param {boolean} [options.relatedGuides] Mount related guides block (default true)
 */
export function bootContentPage(options = {}) {
  const urlLang = new URLSearchParams(location.search).get('lang');
  const lang = options.lang ?? (urlLang === 'ar' ? 'ar' : 'en');
  const depth = options.depth ?? inferDepth();
  const crumbs = options.crumbs ?? [];
  const ticker = options.ticker !== false;
  const relatedGuides = options.relatedGuides !== false;

  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';

  const navCtrl = injectNav(lang, depth);

  if (crumbs.length) {
    let bcHost = document.querySelector('.page-breadcrumbs');
    if (!bcHost) {
      bcHost = document.createElement('div');
      bcHost.className = 'page-breadcrumbs';
      const main = document.querySelector('main');
      if (main) document.body.insertBefore(bcHost, main);
      else document.body.prepend(bcHost);
    }
    renderBreadcrumbs(bcHost, crumbs);
  }

  injectFooter(lang, depth);
  if (ticker) injectTicker(lang, depth);

  if (relatedGuides) mountRelatedGuides({ lang });

  for (const slotId of options.adSlots ?? []) {
    renderAdSlot(slotId, 'rectangle', '', 'guideMidContent');
  }

  initPageEnter('#main-content');

  return { navCtrl, lang, depth };
}

/** @returns {number} Asset depth for injectNav (../../ segments to site root) */
export function inferDepth() {
  const segments = location.pathname.split('/').filter(Boolean);
  return Math.max(1, segments.length - 1);
}
