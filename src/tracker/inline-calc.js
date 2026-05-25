import { CONSTANTS, KARATS } from '../config/index.js';
import { track, EVENTS } from '../lib/analytics.js';
import { formatPrice } from '../lib/formatter.js';
import { el, setText } from '../lib/safe-dom.js';

const INLINE_CALC_KARATS = KARATS.map(({ code, labelEn }) => ({ code, label: labelEn }));

const MIN_WEIGHT_GRAMS = 0.01;

function getFxRate(currency, rates = {}) {
  if (currency === 'USD') return 1;
  if (currency === 'AED') return CONSTANTS.AED_PEG;
  return Number(rates?.[currency]);
}

function buildCurrencyList(rates = {}) {
  const rank = { USD: 0, AED: 1 };
  return ['USD', 'AED', ...Object.keys(rates)]
    .filter((code, index, list) => code && list.indexOf(code) === index)
    .filter((code) => (rank[code] !== undefined ? true : Number.isFinite(Number(rates[code]))))
    .sort((left, right) => {
      const leftRank = rank[left] ?? 9;
      const rightRank = rank[right] ?? 9;
      if (leftRank !== rightRank) return leftRank - rightRank;
      return left.localeCompare(right);
    });
}

function syncSelectOptions(select, options, selectedValue) {
  if (!select) return;
  const values = options.map((option) => option.value);
  const preferredValue = values.includes(selectedValue) ? selectedValue : values[0];
  const fragment = document.createDocumentFragment();
  options.forEach(({ value, label }) => {
    const option = el('option', { value }, [label]);
    if (value === preferredValue) option.selected = true;
    fragment.appendChild(option);
  });
  select.replaceChildren(fragment);
}

export function calculateInlineCalcReference({ goldPriceUsd, weight, karat, currency, rates }) {
  const parsedSpot = Number(goldPriceUsd);
  const parsedWeight = Number(weight);
  const fxRate = getFxRate(currency, rates);
  const karatEntry = KARATS.find((k) => k.code === String(karat));
  const purity = karatEntry ? karatEntry.purity : null;

  if (
    !Number.isFinite(parsedSpot) ||
    !Number.isFinite(parsedWeight) ||
    parsedWeight < MIN_WEIGHT_GRAMS ||
    purity === null ||
    !Number.isFinite(fxRate)
  ) {
    return null;
  }

  return (parsedSpot / CONSTANTS.TROY_OZ_GRAMS) * purity * parsedWeight * fxRate;
}

export function initInlineCalc(opts = {}) {
  const weightInput = document.getElementById('tracker-inline-calc-weight');
  const karatSelect = document.getElementById('tracker-inline-calc-karat');
  const currencySelect = document.getElementById('tracker-inline-calc-currency');
  const resultNode = document.getElementById('tracker-inline-calc-result');

  if (!weightInput || !karatSelect || !currencySelect || !resultNode) {
    return {
      update() {},
      destroy() {},
    };
  }

  let state = {
    goldPriceUsd: null,
    rates: {},
    lang: 'en',
    ...opts,
  };
  let lastTrackedSignature = '';

  function render(trackEvent = false) {
    const weight = Number.parseFloat(weightInput.value || '');
    const karat = karatSelect.value || '24';
    const currency = currencySelect.value || 'USD';
    const value = calculateInlineCalcReference({
      goldPriceUsd: state.goldPriceUsd,
      weight,
      karat,
      currency,
      rates: state.rates,
    });

    if (!Number.isFinite(value)) {
      setText(resultNode, '—');
      return;
    }

    setText(resultNode, formatPrice(value, currency));

    if (!trackEvent) return;
    const signature = `${karat}:${currency}:${weight.toFixed(2)}:${Number(state.goldPriceUsd).toFixed(4)}`;
    if (signature === lastTrackedSignature) return;
    lastTrackedSignature = signature;
    track(EVENTS.CALCULATOR_USE, {
      karat,
      currency,
      tool: 'tracker_inline',
    });
  }

  function update(next = {}) {
    state = {
      ...state,
      ...next,
      rates: next.rates ?? state.rates ?? {},
    };

    const selectedKarat = karatSelect.value || '24';
    const selectedCurrency = currencySelect.value || 'AED';

    syncSelectOptions(karatSelect, INLINE_CALC_KARATS, selectedKarat);

    const currencyOptions = buildCurrencyList(state.rates).map((value) => ({
      value,
      label: value,
    }));
    syncSelectOptions(currencySelect, currencyOptions, selectedCurrency);
    render(false);
  }

  const handleInput = () => render(true);
  weightInput.addEventListener('input', handleInput);
  karatSelect.addEventListener('change', handleInput);
  currencySelect.addEventListener('change', handleInput);
  update(opts);

  return {
    update,
    destroy() {
      weightInput.removeEventListener('input', handleInput);
      karatSelect.removeEventListener('change', handleInput);
      currencySelect.removeEventListener('change', handleInput);
    },
  };
}
