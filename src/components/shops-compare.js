/**
 * Shops Compare Component — side-by-side comparison of up to 3 shops.
 * Shows a sticky bar when shops are selected for comparison, opens a
 * comparison modal showing shop details side by side.
 *
 * @module src/components/shops-compare
 */

import { escape as esc } from '../lib/safe-dom.js';

const MAX_COMPARE = 3;

const TXT = {
  en: {
    compareTitle: 'Compare Shops',
    compareBtn: 'Compare',
    compareSelected: 'Compare selected',
    selectToCompare: 'Select to compare',
    selected: 'selected',
    addToCompare: 'Add to compare',
    removeFromCompare: 'Remove from compare',
    clearCompare: 'Clear',
    maxReached: 'Maximum 3 shops for comparison',
    location: 'Location',
    market: 'Market',
    category: 'Category',
    specialties: 'Specialties',
    detailsAvailability: 'Details',
    phone: 'Phone',
    website: 'Website',
    notAvailable: 'N/A',
    close: 'Close comparison',
    noShopsSelected: 'Select 2–3 shops to compare them side by side.',
  },
  ar: {
    compareTitle: 'مقارنة المحلات',
    compareBtn: 'مقارنة',
    compareSelected: 'مقارنة المحددة',
    selectToCompare: 'حدد للمقارنة',
    selected: 'محددة',
    addToCompare: 'إضافة للمقارنة',
    removeFromCompare: 'إزالة من المقارنة',
    clearCompare: 'مسح',
    maxReached: 'أقصى حد 3 محلات للمقارنة',
    location: 'الموقع',
    market: 'السوق',
    category: 'الفئة',
    specialties: 'التخصصات',
    detailsAvailability: 'التفاصيل',
    phone: 'الهاتف',
    website: 'الموقع الإلكتروني',
    notAvailable: 'غير متاح',
    close: 'إغلاق المقارنة',
    noShopsSelected: 'حدد 2–3 محلات لمقارنتها جنباً إلى جنب.',
  },
};

let _compareList = [];
let _lang = 'en';
let _allShops = [];
let _countryNameFn = null;
let _onCompareChange = null;

function t(key) {
  return TXT[_lang]?.[key] ?? TXT.en[key] ?? key;
}

/**
 * Initialize the compare module.
 * @param {object} opts
 * @param {string} opts.lang - 'en' or 'ar'
 * @param {Array} opts.shops - all shops array
 * @param {Function} opts.countryNameFn - (countryCode) => displayName
 * @param {Function} opts.onCompareChange - callback when compare list changes
 */
export function initCompare({ lang, shops, countryNameFn, onCompareChange }) {
  _lang = lang || 'en';
  _allShops = shops || [];
  _countryNameFn = countryNameFn || ((code) => code);
  _onCompareChange = onCompareChange || null;
}

/**
 * Update language.
 */
export function setCompareLang(lang) {
  _lang = lang;
}

/**
 * Update the shops reference (e.g. after Supabase upgrade).
 */
export function setCompareShops(shops) {
  _allShops = shops || [];
}

/**
 * Check if a shop is in the compare list.
 */
export function isInCompareList(shopId) {
  return _compareList.includes(shopId);
}

/**
 * Get current compare list.
 */
export function getCompareList() {
  return [..._compareList];
}

/**
 * Toggle a shop in/out of the compare list.
 * @returns {{ added: boolean, maxReached: boolean }}
 */
export function toggleCompare(shopId) {
  const idx = _compareList.indexOf(shopId);
  if (idx !== -1) {
    _compareList.splice(idx, 1);
    _notifyChange();
    return { added: false, maxReached: false };
  }
  if (_compareList.length >= MAX_COMPARE) {
    return { added: false, maxReached: true };
  }
  _compareList.push(shopId);
  _notifyChange();
  return { added: true, maxReached: _compareList.length >= MAX_COMPARE };
}

/**
 * Clear the compare list.
 */
export function clearCompare() {
  _compareList = [];
  _notifyChange();
}

function _notifyChange() {
  if (_onCompareChange) _onCompareChange(_compareList);
}

/**
 * Render the compare sticky bar.
 * @param {HTMLElement} container - where to render the bar
 */
export function renderCompareBar(container) {
  if (!container) return;

  if (_compareList.length === 0) {
    container.hidden = true;
    container.innerHTML = '';
    return;
  }

  container.hidden = false;
  const shops = _compareList.map((id) => _allShops.find((s) => s.id === id)).filter(Boolean);

  container.innerHTML = `
    <div class="shops-compare-bar-inner">
      <div class="shops-compare-bar-chips">
        <span class="shops-compare-bar-label">${t('compareBtn')}: </span>
        ${shops
          .map(
            (shop) => `
          <span class="shops-compare-chip" data-shop-id="${esc(shop.id)}">
            ${esc(shop.name)}
            <button type="button" class="shops-compare-chip-remove" data-remove-id="${esc(shop.id)}" aria-label="${t('removeFromCompare')}: ${esc(shop.name)}">×</button>
          </span>
        `
          )
          .join('')}
      </div>
      <div class="shops-compare-bar-actions">
        <button type="button" class="shops-compare-bar-clear">${t('clearCompare')}</button>
        <button type="button" class="shops-compare-bar-go" ${shops.length < 2 ? 'disabled' : ''}>${t('compareSelected')} (${shops.length})</button>
      </div>
    </div>
  `;

  // Bind events
  container.querySelectorAll('[data-remove-id]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleCompare(btn.dataset.removeId);
      renderCompareBar(container);
    });
  });

  const clearBtn = container.querySelector('.shops-compare-bar-clear');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      clearCompare();
      renderCompareBar(container);
    });
  }

  const goBtn = container.querySelector('.shops-compare-bar-go');
  if (goBtn) {
    goBtn.addEventListener('click', () => {
      openCompareModal();
    });
  }
}

/**
 * Open the compare modal showing shops side by side.
 */
export function openCompareModal() {
  const shops = _compareList.map((id) => _allShops.find((s) => s.id === id)).filter(Boolean);

  if (shops.length < 2) return;

  // Create or reuse modal
  let modal = document.getElementById('shops-compare-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'shops-compare-modal';
    modal.className = 'shops-compare-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'shops-compare-modal-title');
    document.body.appendChild(modal);
  }

  const rows = [
    { key: 'location', fn: (s) => `${esc(s.city)}, ${esc(_countryNameFn(s.countryCode))}` },
    { key: 'market', fn: (s) => esc(s.market) },
    { key: 'category', fn: (s) => esc(s.category) },
    {
      key: 'specialties',
      fn: (s) =>
        (s.specialties || []).map((sp) => `<span class="shop-tag">${esc(sp)}</span>`).join(' '),
    },
    {
      key: 'detailsAvailability',
      fn: (s) =>
        `<span class="shops-compare-detail-badge shops-compare-detail-${esc(s.detailsAvailability || 'limited')}">${esc(s.detailsAvailability || 'limited')}</span>`,
    },
    { key: 'phone', fn: (s) => (s.phone ? esc(s.phone) : `<em>${t('notAvailable')}</em>`) },
    {
      key: 'website',
      fn: (s) =>
        s.website
          ? `<a href="${esc(s.website)}" target="_blank" rel="noopener">${t('website')}</a>`
          : `<em>${t('notAvailable')}</em>`,
    },
  ];

  modal.innerHTML = `
    <div class="shops-compare-modal-overlay"></div>
    <div class="shops-compare-modal-content">
      <div class="shops-compare-modal-head">
        <h2 id="shops-compare-modal-title">${t('compareTitle')}</h2>
        <button type="button" class="shops-compare-modal-close" aria-label="${t('close')}">×</button>
      </div>
      <div class="shops-compare-modal-body">
        <table class="shops-compare-table">
          <thead>
            <tr>
              <th></th>
              ${shops.map((s) => `<th><strong>${esc(s.name)}</strong><br><small>${esc(s.market)}</small></th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${rows
              .map(
                (row) => `
              <tr>
                <td class="shops-compare-row-label">${t(row.key)}</td>
                ${shops.map((s) => `<td>${row.fn(s)}</td>`).join('')}
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  modal.hidden = false;
  document.body.style.overflow = 'hidden';

  // Bind close
  const closeBtn = modal.querySelector('.shops-compare-modal-close');
  const overlay = modal.querySelector('.shops-compare-modal-overlay');
  const closeModal = () => {
    modal.hidden = true;
    document.body.style.overflow = '';
  };
  closeBtn?.addEventListener('click', closeModal);
  overlay?.addEventListener('click', closeModal);
  document.addEventListener('keydown', function _esc(e) {
    if (e.key === 'Escape' && !modal.hidden) {
      closeModal();
      document.removeEventListener('keydown', _esc);
    }
  });
}
