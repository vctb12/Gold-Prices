/**
 * shops/modal.js - Modal management for shop details
 * Handles opening, closing, and rendering shop detail modals
 */

import { escape as esc, safeHref as safeUrl, safeTel } from '../../lib/safe-dom.js';
import {
  countryByCode,
  countryName,
  regionName,
  isMarketArea,
  calculateConfidenceBadge,
  detailsAvailabilityLabel,
  listingTypeLabel,
} from './helpers.js';

export function openModal(shop, STATE, SHOPS, t, isInShortlist, toggleShortlist, shareShop) {
  const modal = document.getElementById('shops-modal');
  const country = countryByCode(shop.countryCode);
  const specialties = (shop.specialties || [])
    .map((item) => `<span class="shop-tag">${esc(item)}</span>`)
    .join('');
  const inList = isInShortlist(shop.id);

  const actionsHTML = `
    <div class="modal-actions">
      <button class="modal-action-btn modal-action-btn--shortlist ${inList ? 'is-saved' : ''}"
              type="button" data-shop-id="${esc(shop.id)}" aria-label="${inList ? t('removeFromShortlist') : t('saveToShortlist')}">
        <span class="modal-action-icon">${inList ? '✓' : '+'}</span>
        <span class="modal-action-label">${inList ? t('saved') : t('saveToShortlist')}</span>
      </button>
      <button class="modal-action-btn modal-action-btn--share" type="button" data-shop-id="${esc(shop.id)}" aria-label="${t('shareShop')}">
        <span class="modal-action-icon">↗</span>
        <span class="modal-action-label">${t('shareShop')}</span>
      </button>
      ${
        shop.phone
          ? `<a href="tel:${esc(safeTel(shop.phone))}" class="modal-action-btn modal-action-btn--call" aria-label="${t('callShop')}">
        <span class="modal-action-icon">📞</span>
        <span class="modal-action-label">${t('callShop')}</span>
      </a>`
          : ''
      }
      ${
        safeUrl(shop.website)
          ? `<a href="${esc(safeUrl(shop.website))}" target="_blank" rel="noopener" class="modal-action-btn modal-action-btn--website" aria-label="${t('visitWebsite')}">
        <span class="modal-action-icon">🌐</span>
        <span class="modal-action-label">${t('visitWebsite')}</span>
      </a>`
          : ''
      }
    </div>
  `;

  const contactHTML =
    shop.phone || shop.website
      ? `<div class="modal-contact">
      ${shop.phone ? `<p><strong>${t('phone')}:</strong> ${esc(shop.phone)}</p>` : ''}
      ${safeUrl(shop.website) ? `<p><a href="${esc(safeUrl(shop.website))}" target="_blank" rel="noopener" class="shop-site-link">${t('visitWebsite')} →</a></p>` : ''}
    </div>`
      : `<p class="modal-no-contact">${t('noContact')}</p>`;

  const isCluster = isMarketArea(shop);
  const confidenceBadge = calculateConfidenceBadge(shop);
  const clusterBadge = isCluster
    ? `<span class="modal-cluster-badge">${t('marketCluster')}</span>`
    : '';
  const listingTypeBadge = `<span class="modal-listing-type ${isCluster ? 'modal-listing-type--market' : 'modal-listing-type--store'}">${listingTypeLabel(shop, t)}</span>`;
  const confidenceBadgeHTML = `<span class="modal-confidence-badge modal-confidence-${esc(confidenceBadge.level)}" style="--confidence-color: var(--color-${esc(confidenceBadge.color)})">${t('detailsConfidence')}: ${esc(confidenceBadge.label)}</span>`;

  document.getElementById('shops-modal-body').innerHTML = `
    <div class="modal-head">
      <h2 id="shops-modal-title">${esc(shop.name)}</h2>
      <div class="modal-badges">
        ${clusterBadge}
        ${listingTypeBadge}
        ${confidenceBadgeHTML}
        <span class="modal-details-badge modal-details-${esc(shop.detailsAvailability)}">${t('detailsSignal')}: ${detailsAvailabilityLabel(shop.detailsAvailability, t)}</span>
        ${shop.featured ? `<span class="modal-featured-badge">★ ${t('featured')}</span>` : ''}
      </div>
    </div>

    ${actionsHTML}

    <div class="modal-meta">
      <div class="modal-meta-item">
        <span class="modal-meta-label">${t('location')}</span>
        <span class="modal-meta-value">${esc(shop.city)}, ${countryName(country, STATE.lang)} · ${regionName(country.group, STATE.lang)}</span>
      </div>
      <div class="modal-meta-item">
        <span class="modal-meta-label">${t('market')}</span>
        <span class="modal-meta-value">${esc(shop.market)}</span>
      </div>
      <div class="modal-meta-item">
        <span class="modal-meta-label">${t('category')}</span>
        <span class="modal-meta-value">${esc(shop.category)}</span>
      </div>
    </div>

    ${
      specialties
        ? `<div class="modal-tags">
      <span class="modal-tags-label">${t('specialties')}</span>
      <div class="modal-tags-wrap">${specialties}</div>
    </div>`
        : ''
    }

    <div class="modal-notes">
      <p>${esc(shop.notes)}</p>
    </div>
    <div class="modal-next-step" role="note" aria-label="${t('nextStepTitle')}">
      <strong>${t('nextStepTitle')}</strong>
      <p>${t('nextStepBody')}</p>
    </div>

    ${contactHTML}
    <div class="modal-foot">
      <button class="modal-close-cta" type="button">${t('closeDetails')}</button>
    </div>
  `;

  // Bind action button handlers
  const shortlistBtn = modal.querySelector('.modal-action-btn--shortlist');
  if (shortlistBtn) {
    shortlistBtn.addEventListener('click', () => {
      toggleShortlist(shop.id);
      openModal(shop, STATE, SHOPS, t, isInShortlist, toggleShortlist, shareShop);
    });
  }

  const shareBtn = modal.querySelector('.modal-action-btn--share');
  if (shareBtn) {
    shareBtn.addEventListener('click', () => shareShop(shop));
  }

  modal.hidden = false;
  document.body.style.overflow = 'hidden';
}

export function closeModal({ clearShopParam = true } = {}) {
  const modal = document.getElementById('shops-modal');
  if (!modal) return;
  modal.hidden = true;
  document.body.style.overflow = '';

  if (!clearShopParam) return;
  const params = new URLSearchParams(location.search);
  if (!params.has('shop')) return;
  params.delete('shop');
  const qs = params.toString();
  history.replaceState(null, '', qs ? `${location.pathname}?${qs}` : location.pathname);
}
