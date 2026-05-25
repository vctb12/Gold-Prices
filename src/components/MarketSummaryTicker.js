/**
 * components/MarketSummaryTicker.js — Premium scrolling market summary strip.
 *
 * Above-the-fold hero element showing key market indicators:
 *   [Gold Spot: $X,XXX.XX ▲+X.XX%] [24K AED: XXX.XX/g] [Market: OPEN/CLOSED] [Updated: X min ago]
 *
 * Features:
 *   - CSS-only infinite scroll animation (no JS scroll libraries)
 *   - Pauses on hover/focus for accessibility
 *   - RTL-aware (scrolls right-to-left in Arabic)
 *   - Accessible: role="marquee", aria-label
 *   - Respects prefers-reduced-motion
 *   - Dark mode compatible (uses design tokens)
 *
 * API:
 *   renderMarketSummaryTicker(container, lang)  — inject the ticker into a container
 *   updateMarketSummaryTicker(data)             — update displayed values
 */

import { el, clear } from '../lib/safe-dom.js';

let _tickerEl = null;
let _lang = 'en';

const LABELS = {
  en: {
    spotLabel: 'Gold Spot',
    aed24kLabel: '24K AED/g',
    marketLabel: 'Market',
    updatedLabel: 'Updated',
    open: 'OPEN',
    closed: 'CLOSED',
    minAgo: 'min ago',
    live: 'Live',
  },
  ar: {
    spotLabel: 'سعر الذهب الفوري',
    aed24kLabel: '24K درهم/غ',
    marketLabel: 'السوق',
    updatedLabel: 'آخر تحديث',
    open: 'مفتوح',
    closed: 'مغلق',
    minAgo: 'دقيقة مضت',
    live: 'مباشر',
  },
};

/**
 * Create a single ticker item element.
 */
function createTickerItem(label, value, changeHtml, extraClass = '') {
  const item = el('div', { class: `mst-item${extraClass ? ' ' + extraClass : ''}` });
  const labelSpan = el('span', { class: 'mst-item__label' });
  labelSpan.textContent = label;
  const valueSpan = el('span', { class: 'mst-item__value' });
  valueSpan.textContent = value;
  item.appendChild(labelSpan);
  item.appendChild(valueSpan);
  if (changeHtml) {
    const changeSpan = el('span', { class: 'mst-item__change' });
    changeSpan.textContent = changeHtml;
    item.appendChild(changeSpan);
  }
  return item;
}

/**
 * Render the market summary ticker into a container.
 *
 * @param {HTMLElement} container — target element to inject into
 * @param {'en'|'ar'} lang — current language
 */
export function renderMarketSummaryTicker(container, lang = 'en') {
  if (!container) return;
  _lang = lang;
  const t = LABELS[lang] || LABELS.en;

  const ticker = el('div', {
    class: 'market-summary-ticker',
    role: 'marquee',
    'aria-label': lang === 'ar' ? 'ملخص السوق المباشر' : 'Live market summary',
    'aria-live': 'off',
  });

  // Create the scrolling track (duplicated for seamless loop)
  const track = el('div', { class: 'mst-track' });

  // First set of items
  const items1 = createTickerItems(t);
  // Duplicate for infinite scroll
  const items2 = createTickerItems(t);

  items1.forEach((item) => track.appendChild(item));
  items2.forEach((item) => {
    const clone = item.cloneNode(true);
    clone.setAttribute('aria-hidden', 'true');
    track.appendChild(clone);
  });

  ticker.appendChild(track);
  clear(container);
  container.appendChild(ticker);
  _tickerEl = ticker;
}

function createTickerItems(t) {
  return [
    createTickerItem(t.spotLabel, '—', null, 'mst-item--spot'),
    createTickerItem(t.aed24kLabel, '—', null, 'mst-item--aed'),
    createTickerItem(t.marketLabel, t.open, null, 'mst-item--market'),
    createTickerItem(t.updatedLabel, t.live, null, 'mst-item--updated'),
  ];
}

/**
 * Update the ticker with fresh data.
 *
 * @param {Object} data
 * @param {number} data.xauUsd       — spot price USD/oz
 * @param {number} data.aed24kGram   — 24K price AED/g
 * @param {number} data.changePct    — 24h change percentage
 * @param {boolean} data.marketOpen  — is the market open
 * @param {string} data.updatedAt    — ISO timestamp
 */
export function updateMarketSummaryTicker(data = {}) {
  if (!_tickerEl) return;
  const t = LABELS[_lang] || LABELS.en;

  // Update spot price
  const spotValues = _tickerEl.querySelectorAll('.mst-item--spot .mst-item__value');
  if (data.xauUsd != null) {
    const formatted =
      '$' +
      data.xauUsd.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    spotValues.forEach((el) => {
      el.textContent = formatted;
    });
  }

  // Update spot change
  if (data.changePct != null) {
    const changeItems = _tickerEl.querySelectorAll('.mst-item--spot .mst-item__change');
    const sign = data.changePct >= 0 ? '▲' : '▼';
    const changeText = `${sign}${Math.abs(data.changePct).toFixed(2)}%`;
    changeItems.forEach((el) => {
      el.textContent = changeText;
    });

    // Add change class
    const spotItems = _tickerEl.querySelectorAll('.mst-item--spot');
    spotItems.forEach((item) => {
      item.classList.remove('mst-item--up', 'mst-item--down');
      item.classList.add(data.changePct >= 0 ? 'mst-item--up' : 'mst-item--down');
    });
  }

  // Update 24K AED
  const aedValues = _tickerEl.querySelectorAll('.mst-item--aed .mst-item__value');
  if (data.aed24kGram != null) {
    const formatted = data.aed24kGram.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    aedValues.forEach((el) => {
      el.textContent = formatted;
    });
  }

  // Update market status
  const marketValues = _tickerEl.querySelectorAll('.mst-item--market .mst-item__value');
  if (data.marketOpen != null) {
    const statusText = data.marketOpen ? t.open : t.closed;
    marketValues.forEach((el) => {
      el.textContent = statusText;
    });
    const marketItems = _tickerEl.querySelectorAll('.mst-item--market');
    marketItems.forEach((item) => {
      item.classList.remove('mst-item--open', 'mst-item--closed');
      item.classList.add(data.marketOpen ? 'mst-item--open' : 'mst-item--closed');
    });
  }

  // Update timestamp
  const updatedValues = _tickerEl.querySelectorAll('.mst-item--updated .mst-item__value');
  if (data.updatedAt) {
    const age = Math.floor((Date.now() - new Date(data.updatedAt).getTime()) / 60000);
    const text = age <= 0 ? t.live : `${age} ${t.minAgo}`;
    updatedValues.forEach((el) => {
      el.textContent = text;
    });
  }
}

/**
 * Update the ticker language live (without re-render).
 * @param {'en'|'ar'} lang
 */
export function updateMarketSummaryTickerLang(lang) {
  _lang = lang;
  if (!_tickerEl) return;
  const t = LABELS[lang] || LABELS.en;
  _tickerEl.setAttribute(
    'aria-label',
    lang === 'ar' ? 'ملخص السوق المباشر' : 'Live market summary'
  );

  const labels = _tickerEl.querySelectorAll('.mst-item__label');
  const allLabels = [t.spotLabel, t.aed24kLabel, t.marketLabel, t.updatedLabel];
  labels.forEach((el, i) => {
    el.textContent = allLabels[i % allLabels.length];
  });
}
