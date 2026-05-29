// tracker/compare.js — comparison workspace rendering
import { COUNTRIES } from '../config/index.js';
import { _state, _el, _priceFor, _currentSpot, tx } from './_ctx.js';
import { clear, el } from '../lib/safe-dom.js';
import { buildSourceBadge, getFreshnessModel } from './freshness.js';

export function renderComparisonWorkspace() {
  if (!_el.comparisonCards) return;
  const spot = _currentSpot();
  const freshness = getFreshnessModel();
  const countries = (_state.compareCountries || [])
    .map((code) => COUNTRIES.find((country) => country.code === code))
    .filter(Boolean);
  const karats = (_state.compareKarats || []).filter(Boolean);

  clear(_el.comparisonCards);
  const canExport = Boolean(spot && countries.length && karats.length);
  [_el.exportCompare, _el.exportCompare2].forEach((button) => {
    if (!button) return;
    button.disabled = !canExport;
  });

  if (!countries.length || !karats.length) {
    if (_el.comparisonEmpty) _el.comparisonEmpty.hidden = false;
    return;
  }
  if (_el.comparisonEmpty) _el.comparisonEmpty.hidden = true;

  const fragment = document.createDocumentFragment();
  countries.forEach((country) => {
    const name = _state.lang === 'ar' ? country.nameAr || country.nameEn : country.nameEn;
    const rows = karats.map((karatCode) => {
      const price = spot
        ? _priceFor({ currency: country.currency, karat: karatCode, unit: 'gram', spot })
        : null;
      return el('div', { class: 'comparison-card__row' }, [
        el('span', { class: 'comparison-card__karat' }, `${karatCode}K`),
        el(
          'strong',
          { class: 'comparison-card__price' },
          price
            ? `${country.currency} ${price.toLocaleString('en', {
                minimumFractionDigits: country.decimals ?? 2,
                maximumFractionDigits: country.decimals ?? 2,
              })}`
            : tx('source.unavailable')
        ),
      ]);
    });

    const notes = [
      el(
        'span',
        { class: 'data-resolution-chip' },
        country.currency === 'AED' ? tx('compare.fxPeg') : tx('compare.fxLive')
      ),
      buildSourceBadge(freshness),
    ];
    if (country.currency === 'AED') {
      notes.push(el('span', { class: 'freshness-chip' }, tx('compare.aedPeg')));
    }

    fragment.append(
      el('article', { class: 'comparison-card' }, [
        el('div', { class: 'comparison-card__header' }, [
          el('div', null, [
            el('h3', { class: 'comparison-card__title' }, `${country.flag ?? ''} ${name}`.trim()),
            el(
              'p',
              { class: 'comparison-card__meta' },
              `${country.currency} · ${tx('compare.perGramLabel')}`
            ),
          ]),
          el('div', { class: 'comparison-card__chips' }, notes),
        ]),
        el('div', { class: 'comparison-card__body' }, rows),
        el(
          'p',
          { class: 'source-note comparison-card__note' },
          tx('compare.cardNote', {
            freshness: freshness.sourceLabel,
            fxSource: country.currency === 'AED' ? tx('compare.fxPeg') : 'open.er-api.com',
          })
        ),
      ])
    );
  });
  _el.comparisonCards.append(fragment);
}
