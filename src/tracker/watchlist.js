// tracker/watchlist.js — favorite currency watchlist rendering
import { COUNTRIES } from '../config/index.js';
import { _state, _el, _priceFor, _currentSpot, tx, formatUnitLabel } from './_ctx.js';
import { clear, el } from '../lib/safe-dom.js';
import { buildSourceBadge, getFreshnessModel } from './freshness.js';

export function renderWatchlist() {
  if (!_el.watchlistGrid) return;
  const spot = _currentSpot();
  const favs = _state.favorites || [];
  const freshness = getFreshnessModel();
  if (!favs.length) {
    clear(_el.watchlistGrid);
    _el.watchlistGrid.append(
      el(
        'p',
        {
          style: {
            color: 'var(--tp-text-muted)',
            fontSize: '0.85rem',
          },
        },
        tx('noFavorites')
      )
    );
    return;
  }
  if (!spot) {
    clear(_el.watchlistGrid);
    _el.watchlistGrid.append(
      el(
        'p',
        {
          style: {
            color: 'var(--tp-text-muted)',
            fontSize: '0.85rem',
          },
        },
        tx('waitingLive')
      )
    );
    return;
  }
  const fragment = document.createDocumentFragment();
  favs.forEach((cur) => {
    const country = COUNTRIES.find((item) => item.currency === cur);
    const price = _priceFor({
      currency: cur,
      karat: _state.selectedKarat,
      unit: _state.selectedUnit,
      spot,
    });
    const name = _state.lang === 'ar' ? country?.nameAr || country?.nameEn : country?.nameEn;
    const isCurrent = _state.selectedCurrency === cur;

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
              karat: _state.selectedKarat,
              unit: formatUnitLabel(_state.selectedUnit),
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
    fragment.append(card);
  });

  clear(_el.watchlistGrid);
  _el.watchlistGrid.append(fragment);
}
