import { COUNTRIES } from '../config/index.js';
import { persistState } from './state.js';
import { clear, el } from '../lib/safe-dom.js';
import { formatUnitLabel, tx, _currentSpot, _el, _priceFor, _state } from './_ctx.js';
import { buildSourceBadge, getFreshnessModel } from './freshness.js';
import { renderWatchlist } from './watchlist.js';

export function renderMarkets() {
  if (!_el.marketBoard) return;
  const spot = _currentSpot();
  const freshness = getFreshnessModel();
  if (!spot) {
    clear(_el.marketBoard);
    _el.marketBoard.append(
      el(
        'p',
        {
          style: {
            padding: '1rem',
            color: 'var(--tp-text-muted)',
          },
        },
        tx('waitingLive')
      )
    );
    return;
  }

  const activeRegion = _state.activeRegion || 'gcc';
  const regionMap = {
    gcc: ['AE', 'SA', 'KW', 'QA', 'BH', 'OM'],
    arab: [
      'AE',
      'SA',
      'KW',
      'QA',
      'BH',
      'OM',
      'EG',
      'JO',
      'LB',
      'SY',
      'YE',
      'MA',
      'TN',
      'DZ',
      'IQ',
    ],
    global: null,
  };
  const regionCodes = regionMap[activeRegion];

  let filtered = COUNTRIES.filter((c) => {
    if (regionCodes && !regionCodes.includes(c.code)) return false;
    if (_el.marketFilter?.value) {
      const q = _el.marketFilter.value.toLowerCase();
      if (!c.nameEn.toLowerCase().includes(q) && !c.currency.toLowerCase().includes(q))
        return false;
    }
    return true;
  });

  const sortValue = _el.marketSort?.value || 'high';
  if (sortValue === 'high' || sortValue === 'low') {
    const getPrice = (c) =>
      _priceFor({
        currency: c.currency,
        karat: _state.selectedKarat,
        unit: _state.selectedUnit,
        spot,
      }) || 0;
    filtered.sort((a, b) =>
      sortValue === 'high' ? getPrice(b) - getPrice(a) : getPrice(a) - getPrice(b)
    );
  } else if (sortValue === 'alpha') {
    filtered.sort((a, b) => a.nameEn.localeCompare(b.nameEn));
  } else if (sortValue === 'favorites') {
    filtered.sort((a, b) => {
      const aFav = (_state.favorites || []).includes(a.currency) ? 1 : 0;
      const bFav = (_state.favorites || []).includes(b.currency) ? 1 : 0;
      return bFav - aFav;
    });
  }

  filtered = filtered.slice(0, 30);

  const fragment = document.createDocumentFragment();
  filtered.forEach((country) => {
    const cur = country.currency;
    const price = _priceFor({
      currency: cur,
      karat: _state.selectedKarat,
      unit: _state.selectedUnit,
      spot,
    });
    const isFav = (_state.favorites || []).includes(cur);
    const name = _state.lang === 'ar' ? country.nameAr || country.nameEn : country.nameEn;

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
    button.addEventListener('click', (event) => {
      event.preventDefault();
      if ((_state.favorites || []).includes(cur)) {
        _state.favorites = _state.favorites.filter((code) => code !== cur);
      } else {
        _state.favorites = [...(_state.favorites || []), cur];
      }
      persistState(_state);
      renderMarkets();
      renderWatchlist();
    });

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
              karat: _state.selectedKarat,
              unit: formatUnitLabel(_state.selectedUnit),
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
    fragment.append(card);
  });

  clear(_el.marketBoard);
  _el.marketBoard.append(fragment);

  if (_el.marketEmpty) _el.marketEmpty.hidden = filtered.length > 0;
}
