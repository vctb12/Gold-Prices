/**
 * tracker/dom-builders.js - Extract DOM building helpers from render.js
 * Separates DOM construction from main rendering logic
 */

import { el } from '../lib/safe-dom.js';

export function buildHeroStatCard(label, value, sub) {
  return el('div', { class: 'tracker-hero-stat' }, [
    el('div', { class: 'tracker-hero-k' }, label),
    el('div', { class: 'tracker-hero-v' }, value),
    el('div', { class: 'tracker-hero-s' }, sub),
  ]);
}

export function buildStackItem(title, copy, badge = null) {
  const headerChildren = [el('strong', null, title)];
  if (badge) headerChildren.push(badge);
  return el('div', { class: 'tracker-stack-item' }, [
    el('div', { class: 'tracker-stack-top' }, headerChildren),
    el('p', null, copy),
  ]);
}

export function buildSourceBadge(freshness) {
  return el(
    'span',
    {
      class: `tracker-source-badge ${freshness.sourceBadgeClass}`,
      title: freshness.tooltip,
      'aria-label': freshness.tooltip,
    },
    freshness.sourceLabel
  );
}

export function buildMarketCard(
  country,
  cur,
  price,
  freshness,
  isFav,
  state,
  tx,
  formatUnitLabel,
  onFavClick
) {
  const name = state.lang === 'ar' ? country.nameAr || country.nameEn : country.nameEn;

  const button = el(
    'button',
    {
      type: 'button',
      class: `tracker-icon-btn${isFav ? ' is-favorite' : ''}`,
      dataset: { currency: cur },
      'aria-label': tx('favoriteToggle', { name }),
      'aria-pressed': isFav ? 'true' : 'false',
    },
    '★'
  );
  button.addEventListener('click', onFavClick);

  const card = el('div', { class: `tracker-market-card${isFav ? ' is-highlight' : ''}` }, [
    el('div', { class: 'tracker-market-top' }, [
      el('div', { class: 'tracker-market-title' }, [
        el('strong', null, `${country.flag ?? ''} ${name}`.trim()),
        el('span', null, cur),
      ]),
      el('div', { class: 'tracker-market-value' }, [
        el(
          'strong',
          null,
          price
            ? price.toLocaleString('en', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })
            : '—'
        ),
        el(
          'span',
          null,
          tx('marketMeta', {
            karat: state.selectedKarat,
            unit: formatUnitLabel(state.selectedUnit),
          })
        ),
      ]),
    ]),
    el('div', { class: 'tracker-market-bottom' }, [
      el('div', { class: 'tracker-market-meta' }, [
        buildSourceBadge(freshness),
        el(
          'span',
          { class: 'tracker-card-note' },
          `${tx('marketTrust')} · ${tx('marketFreshness', {
            source: freshness.sourceLabel,
            age: freshness.ageText,
          })}`
        ),
      ]),
      button,
    ]),
  ]);

  card.title = freshness.tooltip;
  return card;
}

export function buildWatchCard(
  country,
  cur,
  price,
  freshness,
  isCurrent,
  state,
  tx,
  formatUnitLabel
) {
  const name = state.lang === 'ar' ? country?.nameAr || country?.nameEn : country?.nameEn;

  const card = el('div', { class: `tracker-watch-card${isCurrent ? ' is-highlight' : ''}` }, [
    el('div', { class: 'tracker-watch-top' }, [
      el('div', { class: 'tracker-watch-title' }, [
        el('strong', null, `${country?.flag ?? ''} ${name ?? cur}`.trim()),
        el('span', null, `${cur}${isCurrent ? ` · ${tx('selected')}` : ''}`),
      ]),
      el('div', { class: 'tracker-watch-value' }, [
        el(
          'strong',
          null,
          price
            ? price.toLocaleString('en', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })
            : '—'
        ),
        el(
          'span',
          null,
          tx('marketMeta', {
            karat: state.selectedKarat,
            unit: formatUnitLabel(state.selectedUnit),
          })
        ),
      ]),
    ]),
    el('div', { class: 'tracker-watch-meta' }, [
      buildSourceBadge(freshness),
      el(
        'span',
        { class: 'tracker-card-note' },
        `${tx('marketTrust')} · ${tx('marketFreshness', {
          source: freshness.sourceLabel,
          age: freshness.ageText,
        })}`
      ),
    ]),
  ]);

  card.title = freshness.tooltip;
  return card;
}
