/**
 * shops/rendering.js - Card and grid rendering logic
 * Separates rendering from main module orchestration
 *
 * Rendering is implemented with `el()` / DocumentFragment from
 * `src/lib/safe-dom.js` — no raw `innerHTML` sinks in this file. Every
 * untrusted shop field is inserted via `createTextNode` (for body text) or
 * `setAttribute` (for attributes), both of which treat their input as
 * literal data, not HTML. Migrated from string-template rendering on
 * 2026-04-24 (PR A-2 of the security audit burn-down); behaviour parity
 * checked against the pre-migration implementation.
 */

import { el, clear, safeHref as safeUrl, safeTel } from '../../lib/safe-dom.js';
import {
  countryByCode,
  countryName,
  regionName,
  isMarketArea,
  calculateConfidenceBadge,
  listingTypeLabel,
  contactQualityLabel,
} from './helpers.js';

function renderBadges(shop, isCluster, t) {
  const badges = document.createDocumentFragment();
  if (isCluster) {
    badges.appendChild(el('span', { class: 'shop-cluster-badge' }, [t('marketCluster')]));
  }
  badges.appendChild(
    el(
      'span',
      {
        class:
          'shop-listing-type ' +
          (isCluster ? 'shop-listing-type--market' : 'shop-listing-type--store'),
      },
      [listingTypeLabel(shop, t)]
    )
  );
  if (shop.featured) {
    badges.appendChild(el('span', { class: 'shop-featured' }, [t('featured')]));
  }
  return badges;
}

function renderConfidenceBlock(shop, t) {
  const confidenceBadge = calculateConfidenceBadge(shop);
  const contactQualityLbl = contactQualityLabel(shop, t);
  return el(
    'section',
    { class: 'shop-confidence-block', 'aria-label': t('listingConfidenceTitle') },
    [
      el('p', { class: 'shop-confidence-title' }, [t('listingConfidenceTitle')]),
      el('div', { class: 'shop-confidence-grid' }, [
        el('p', { class: 'shop-confidence-item' }, [
          el('span', null, [t('category')]),
          el('strong', null, [listingTypeLabel(shop, t)]),
        ]),
        el('p', { class: 'shop-confidence-item' }, [
          el('span', null, [t('detailsConfidence')]),
          el(
            'strong',
            {
              class: 'shop-signal shop-signal--' + confidenceBadge.level,
              style: { '--confidence-color': `var(--color-${confidenceBadge.color})` },
            },
            [confidenceBadge.label]
          ),
        ]),
        el('p', { class: 'shop-confidence-item' }, [
          el('span', null, [t('contactQuality')]),
          el('strong', null, [contactQualityLbl]),
        ]),
      ]),
    ]
  );
}

function renderMetaGrid(shop, country, STATE, t) {
  return el('div', { class: 'shop-meta-grid' }, [
    el('p', { class: 'shop-meta' }, [
      el('span', null, [t('location')]),
      el('strong', null, [
        `${shop.city}, ${countryName(country, STATE.lang)} · ${regionName(country.group, STATE.lang)}`,
      ]),
    ]),
    el('p', { class: 'shop-meta' }, [
      el('span', null, [t('market')]),
      el('strong', null, [shop.market]),
    ]),
    el('p', { class: 'shop-meta' }, [
      el('span', null, [t('category')]),
      el('strong', null, [shop.category]),
    ]),
  ]);
}

function renderSpecialtyTags(shop, t) {
  const wrap = el('div', { class: 'shop-tags-wrap' }, [
    el('span', { class: 'shop-tag shop-tag--muted' }, [t('specialties')]),
  ]);
  const specialties = shop.specialties || [];
  if (specialties.length === 0) {
    wrap.appendChild(el('span', { class: 'shop-tag' }, ['—']));
  } else {
    for (const item of specialties) {
      wrap.appendChild(el('span', { class: 'shop-tag' }, [item]));
    }
  }
  return wrap;
}

function renderActionLink({ href, className, icon, label, ariaLabel, external = false }) {
  const attrs = { href, class: className, 'aria-label': ariaLabel || label };
  if (external) {
    attrs.target = '_blank';
    attrs.rel = 'noopener';
  }
  return el('a', attrs, [
    el('span', { class: 'shop-action-icon' }, [icon]),
    el('span', { class: 'shop-action-label' }, [label]),
  ]);
}

function renderPrimaryActions(shop, country, STATE, t) {
  const isCluster = isMarketArea(shop);
  const row = el('div', { class: 'shop-actions-row shop-actions-row--primary' });

  if (isCluster) {
    const areaGuideUrl =
      `${location.pathname}?country=${encodeURIComponent(shop.countryCode)}` +
      `&search=${encodeURIComponent(shop.market)}`;
    row.appendChild(
      renderActionLink({
        href: areaGuideUrl,
        className: 'shop-action-btn shop-action-btn--guide',
        icon: '🧭',
        label: t('areaGuide'),
        ariaLabel: `${t('areaGuide')}: ${shop.market}`,
      })
    );
  }

  if (!isCluster && shop.phone) {
    const tel = safeTel(shop.phone);
    row.appendChild(
      renderActionLink({
        href: `tel:${tel}`,
        className: 'shop-action-btn shop-action-btn--call',
        icon: '📞',
        label: t('callShop'),
      })
    );
  }

  const website = safeUrl(shop.website);
  if (!isCluster && website) {
    row.appendChild(
      renderActionLink({
        href: website,
        className: 'shop-action-btn shop-action-btn--website',
        icon: '🌐',
        label: t('visitWebsite'),
        external: true,
      })
    );
  }

  if (!isCluster) {
    const directionsUrl =
      'https://www.google.com/maps/search/?api=1&query=' +
      encodeURIComponent(`${shop.name}, ${shop.market}, ${shop.city}`);
    row.appendChild(
      renderActionLink({
        href: directionsUrl,
        className: 'shop-action-btn shop-action-btn--directions',
        icon: '🧭',
        label: t('directions'),
        external: true,
      })
    );
  }

  if (country?.slug) {
    const name = countryName(country, STATE.lang);
    row.appendChild(
      renderActionLink({
        href: `countries/${country.slug}/gold-price/`,
        className: 'shop-action-btn shop-action-btn--country',
        icon: '📄',
        label: name,
        ariaLabel: `${t('viewCountryPage')}: ${name}`,
      })
    );
  }

  return row;
}

function renderSecondaryActions(shop, inShortlist, t) {
  return el('div', { class: 'shop-actions-row shop-actions-row--secondary' }, [
    el(
      'button',
      {
        class: 'shop-action-btn shop-action-btn--save' + (inShortlist ? ' is-saved' : ''),
        type: 'button',
        dataset: { shopId: shop.id },
        'aria-label': inShortlist ? t('removeFromShortlist') : t('saveToShortlist'),
      },
      [
        el('span', { class: 'shop-action-icon' }, [inShortlist ? '✓' : '+']),
        el('span', { class: 'shop-action-label' }, [
          inShortlist ? t('saved') : t('saveToShortlist'),
        ]),
      ]
    ),
    el(
      'button',
      {
        class: 'shop-action-btn shop-action-btn--share',
        type: 'button',
        dataset: { shopId: shop.id },
        'aria-label': t('shareShop'),
      },
      [
        el('span', { class: 'shop-action-icon' }, ['↗']),
        el('span', { class: 'shop-action-label' }, [t('shareShop')]),
      ]
    ),
  ]);
}

function renderContactLine(shop, t) {
  const contactParts = [];
  if (shop.phone) {
    contactParts.push(el('span', null, [`${t('phone')}: ${shop.phone}`]));
  }
  const website = safeUrl(shop.website);
  if (website) {
    contactParts.push(
      el('a', { href: website, target: '_blank', rel: 'noopener', class: 'shop-site-link' }, [
        t('visitWebsite'),
      ])
    );
  }
  const p = el('p', { class: 'shop-contact' });
  if (contactParts.length === 0) {
    p.appendChild(document.createTextNode(t('noContact')));
  } else {
    for (let i = 0; i < contactParts.length; i++) {
      if (i > 0) p.appendChild(document.createTextNode(' · '));
      p.appendChild(contactParts[i]);
    }
  }
  return p;
}

function renderShopCard(shop, STATE, t, isInShortlist) {
  const country = countryByCode(shop.countryCode);
  const isCluster = isMarketArea(shop);
  const inShortlist = isInShortlist(shop.id);

  let cls = 'shop-card';
  if (shop.featured) cls += ' shop-card--featured';
  if (isCluster) cls += ' shop-card--cluster';

  return el('article', { class: cls, dataset: { shopId: shop.id } }, [
    el('header', { class: 'shop-card-head' }, [
      el('div', null, [
        el('h3', null, [shop.name]),
        el('div', { class: 'shop-card-badges' }, [renderBadges(shop, isCluster, t)]),
      ]),
    ]),
    renderConfidenceBlock(shop, t),
    renderMetaGrid(shop, country, STATE, t),
    renderSpecialtyTags(shop, t),
    el('p', { class: 'shop-notes' }, [shop.notes]),
    el('div', { class: 'shop-next-action-label' }, [
      isCluster ? t('nextActionsMarket') : t('nextActionsStore'),
    ]),
    renderPrimaryActions(shop, country, STATE, t),
    renderSecondaryActions(shop, inShortlist, t),
    renderContactLine(shop, t),
  ]);
}

export function renderCards(shops, STATE, SHOPS, t, isInShortlist) {
  const grid = document.getElementById('shops-grid');
  if (!grid) {
    console.warn('[shops] Element #shops-grid not found');
    return;
  }
  clear(grid);
  const frag = document.createDocumentFragment();
  for (const shop of shops) {
    frag.appendChild(renderShopCard(shop, STATE, t, isInShortlist));
  }
  grid.appendChild(frag);
}

export function bindShopCardHandlers(SHOPS, toggleShortlist, shareShop, openModal) {
  const grid = document.getElementById('shops-grid');
  if (!grid) return;

  grid.querySelectorAll('.shop-card').forEach((card) => {
    const newCard = card.cloneNode(true);
    card.parentNode.replaceChild(newCard, card);

    newCard.addEventListener('click', (e) => {
      if (e.target.closest('.shop-action-btn')) return;
      const shopId = newCard.dataset.shopId;
      const shop = SHOPS.find((s) => s.id === shopId);
      if (shop) openModal(shop);
    });
  });

  grid.querySelectorAll('.shop-action-btn--save').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleShortlist(btn.dataset.shopId);
    });
  });

  grid.querySelectorAll('.shop-action-btn--share').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const shop = SHOPS.find((s) => s.id === btn.dataset.shopId);
      if (shop) shareShop(shop);
    });
  });
}

function renderFeaturedCard(shop, STATE) {
  const country = countryByCode(shop.countryCode);
  const tagsWrap = el('div', { class: 'featured-tags' });
  for (const item of (shop.specialties || []).slice(0, 2)) {
    tagsWrap.appendChild(el('span', { class: 'featured-tag' }, [item]));
  }
  return el(
    'article',
    {
      class: 'featured-card',
      dataset: { shopId: shop.id },
      style: { cursor: 'pointer' },
    },
    [
      el('div', { class: 'featured-header' }, [
        el('h3', null, [shop.name]),
        el('span', { class: 'featured-location' }, [
          `${shop.city} · ${countryName(country, STATE.lang)}`,
        ]),
      ]),
      el('p', { class: 'featured-market' }, [shop.market]),
      tagsWrap,
    ]
  );
}

export function renderFeaturedSection(shopsMatchingPrimaryFilters, STATE, t, openModal, SHOPS) {
  const featuredSection = document.getElementById('shops-featured');
  const featuredGrid = document.getElementById('shops-featured-grid');

  if (!featuredSection || !featuredGrid) {
    console.warn('[shops] Featured section elements not found');
    return;
  }

  const featured = shopsMatchingPrimaryFilters().filter((shop) => shop.featured);

  if (!featured.length) {
    featuredSection.hidden = true;
    return;
  }

  featuredSection.hidden = false;
  clear(featuredGrid);
  const frag = document.createDocumentFragment();
  for (const shop of featured) {
    frag.appendChild(renderFeaturedCard(shop, STATE));
  }
  featuredGrid.appendChild(frag);

  bindFeaturedCardHandlers(SHOPS, openModal);
}

function bindFeaturedCardHandlers(SHOPS, openModal) {
  const featuredGrid = document.getElementById('shops-featured-grid');
  if (!featuredGrid) return;

  featuredGrid.querySelectorAll('.featured-card').forEach((card) => {
    const newCard = card.cloneNode(true);
    card.parentNode.replaceChild(newCard, card);

    newCard.addEventListener('click', () => {
      const shop = SHOPS.find((s) => s.id === newCard.dataset.shopId);
      if (shop) openModal(shop);
    });
  });
}
