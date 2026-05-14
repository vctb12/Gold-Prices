/**
 * components/adSlot.js
 * Lazy-loading Google AdSense ad slot component.
 * - Reads publisher ID and slot IDs from src/config/constants.js (AD_CONFIG)
 * - Renders nothing silently if publisher ID is empty (no broken ad frames)
 * - Reserves fixed space before ad loads (prevents CLS)
 * - Uses IntersectionObserver for lazy load
 * - Skips on admin pages
 */

import { AD_CONFIG } from '../config/index.js';

const AD_DIMENSIONS = {
  leaderboard: { width: 728, height: 90, mobileWidth: 320, mobileHeight: 50 },
  rectangle: { width: 300, height: 250, mobileWidth: 300, mobileHeight: 250 },
  banner: { width: 728, height: 90, mobileWidth: 320, mobileHeight: 50 },
  skyscraper: { width: 160, height: 600, mobileWidth: 0, mobileHeight: 0 },
};

const isMobile = () => window.innerWidth < 768;
const isAdminPage = () => window.location.pathname.includes('/admin');
const renderedAdContainers = new Set();

function resolveSlotFromConfig(adFormat, slotKey = '') {
  if (slotKey && AD_CONFIG.AD_SLOTS?.[slotKey]) return AD_CONFIG.AD_SLOTS[slotKey];
  const byFormat = {
    leaderboard: ['homeLeaderboard', 'countryBanner', 'toolBanner'],
    rectangle: [
      'trackerSidebar',
      'calculatorResult',
      'homeRectangle',
      'learnRectangle',
      'guideMidContent',
    ],
    banner: ['toolBanner', 'countryBanner', 'homeLeaderboard'],
    skyscraper: [],
  };
  const candidates = byFormat[adFormat] || [];
  for (const key of candidates) {
    const value = AD_CONFIG.AD_SLOTS?.[key];
    if (value) return value;
  }
  return '';
}

/**
 * Render an AdSense slot in the given container.
 * @param {string} containerId  ID of the container element
 * @param {'leaderboard'|'rectangle'|'banner'|'skyscraper'} adFormat
 * @param {string} [adSlotId]   AdSense slot ID — if omitted, reads from AD_CONFIG.AD_SLOTS
 * @param {string} [slotKey]    Key in AD_CONFIG.AD_SLOTS to look up the slot ID
 */
export function renderAdSlot(containerId, adFormat = 'rectangle', adSlotId = '', slotKey = '') {
  // Silently skip if no publisher ID configured
  if (!AD_CONFIG.ADSENSE_PUBLISHER_ID) return;
  if (isAdminPage()) return;
  if (typeof IntersectionObserver === 'undefined') return;
  const hasRenderedContainer = renderedAdContainers.has(containerId);
  const existingContainer = document.getElementById(containerId);
  if (hasRenderedContainer && existingContainer) return;
  if (hasRenderedContainer && !existingContainer) {
    renderedAdContainers.delete(containerId);
  }

  const container = document.getElementById(containerId);
  if (!container) return;

  const governance = AD_CONFIG.SLOT_GOVERNANCE || {};
  const mobile = isMobile();
  const effectiveFormat =
    mobile && adFormat === 'leaderboard' && governance.allowLeaderboardOnMobile === false
      ? 'banner'
      : adFormat;
  // Resolve slot ID from config if not passed directly
  const resolvedSlotId = adSlotId || resolveSlotFromConfig(effectiveFormat, slotKey);
  const maxSlotsPerPage = Number.isFinite(governance.maxSlotsPerPage)
    ? governance.maxSlotsPerPage
    : 3;
  if (renderedAdContainers.size >= maxSlotsPerPage) return;
  if (governance.requiredSlotId !== false && !resolvedSlotId) return;
  const dims = AD_DIMENSIONS[effectiveFormat];
  if (!dims) return;
  const w = mobile && dims.mobileWidth ? dims.mobileWidth : dims.width;
  const h = mobile && dims.mobileHeight ? dims.mobileHeight : dims.height;

  if (w === 0) return; // skyscraper hidden on mobile

  // Reserve space before ad loads to prevent CLS
  container.style.minHeight = h + 'px';
  container.style.width = '100%';
  container.style.maxWidth = w + 'px';
  container.style.margin = '0 auto';
  container.style.display = 'flex';
  container.style.alignItems = 'center';
  container.style.justifyContent = 'center';
  container.style.background = 'var(--color-surface-2, #f8fafc)';
  container.style.border = '1px solid var(--color-border-subtle, #f1f5f9)';
  container.style.borderRadius = 'var(--radius-xs, 4px)';
  container.style.overflow = 'hidden';
  container.setAttribute('aria-label', 'Advertisement');
  container.dataset.adFormat = effectiveFormat;

  let loaded = false;

  const observer = new IntersectionObserver(
    (entries) => {
      if (entries[0].isIntersecting && !loaded) {
        loaded = true;
        observer.disconnect();
        renderedAdContainers.add(containerId);
        _loadAd(container, resolvedSlotId, effectiveFormat);
      }
    },
    { rootMargin: '200px' }
  );

  observer.observe(container);
}

function _loadAd(container, slotId, _adFormat) {
  const publisherId = AD_CONFIG.ADSENSE_PUBLISHER_ID;
  if (!publisherId) return;

  // Ensure AdSense script is loaded
  if (!document.querySelector('script[data-adsense]')) {
    const script = document.createElement('script');
    script.async = true;
    script.defer = true;
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${publisherId}`;
    script.crossOrigin = 'anonymous';
    script.dataset.adsense = 'true';
    document.head.appendChild(script);
  }

  container.style.background = '';
  container.style.border = '';

  const ins = document.createElement('ins');
  ins.className = 'adsbygoogle';
  ins.style.display = 'block';
  ins.dataset.adClient = publisherId;
  ins.dataset.adSlot = slotId || '';
  ins.dataset.adFormat = 'auto';
  ins.dataset.fullWidthResponsive = 'true';

  container.replaceChildren(ins);

  try {
    (window.adsbygoogle = window.adsbygoogle || []).push({});
  } catch (_) {
    /* ignore ad push errors */
  }
}
