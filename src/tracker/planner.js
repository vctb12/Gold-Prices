import { KARATS } from '../config/index.js';
import { clear, el, escape } from '../lib/safe-dom.js';
import { tx, _currentSpot, _el, _priceFor, _state } from './_ctx.js';

export function renderPresets() {
  if (!_el.presetList) return;
  const presets = _state.presets || [];
  clear(_el.presetList);
  if (!presets.length) {
    _el.presetList.append(
      el(
        'p',
        { style: { color: 'var(--tp-text-muted)', fontSize: '0.85rem' } },
        tx('presets.empty')
      )
    );
    return;
  }
  const fragment = document.createDocumentFragment();
  presets.forEach((p, i) => {
    const isCurrent =
      _state.selectedCurrency === p.currency &&
      _state.selectedKarat === p.karat &&
      _state.selectedUnit === p.unit &&
      _state.range === p.range;
    const metaParts = [
      `${escape(p.karat)}K · ${escape(p.currency)}/${escape(p.unit)} · ${escape(p.range)} range`,
      ...(isCurrent
        ? [' · ', el('span', { style: { color: 'var(--tp-accent)' } }, tx('presets.current'))]
        : []),
    ];
    fragment.append(
      el('div', { class: `tracker-stack-item${isCurrent ? ' is-highlight' : ''}` }, [
        el('div', { style: { flex: '1' } }, [
          el('div', null, [el('strong', null, p.name)]),
          el(
            'div',
            { style: { fontSize: '0.8rem', color: 'var(--tp-text-muted)', marginTop: '0.25rem' } },
            metaParts
          ),
        ]),
        el('span', null, [
          el(
            'button',
            { dataset: { idx: String(i) }, class: 'tracker-load-btn tracker-pill' },
            tx('presets.load')
          ),
          el(
            'button',
            {
              dataset: { idx: String(i) },
              class: 'tracker-remove-btn',
              'aria-label': tx('presets.deleteAriaLabel'),
            },
            '×'
          ),
        ]),
      ])
    );
  });
  _el.presetList.append(fragment);
}

export function renderPlanners() {
  const spot = _currentSpot();
  if (!spot) return;

  function resultItem(label, value, valueStyle) {
    return el('div', { class: 'tracker-result-item' }, [
      el('span', {}, [label]),
      el('strong', valueStyle ? { style: valueStyle } : {}, [value]),
    ]);
  }
  function emptyMsg(msg) {
    return el('p', { style: { color: 'var(--tp-text-muted)' } }, [msg]);
  }

  if (_el.budgetResults) {
    const budget = parseFloat(_el.budgetAmount?.value) || 0;
    const fee = parseFloat(_el.budgetFee?.value) || 0;
    const net = budget / (1 + fee / 100);
    const p = _priceFor({
      currency: _state.selectedCurrency,
      karat: _state.selectedKarat,
      unit: 'gram',
      spot,
    });
    _el.budgetResults.replaceChildren(
      p && net
        ? (() => {
            const f = document.createDocumentFragment();
            f.append(
              resultItem(
                tx('planner.netBudget'),
                `${net.toFixed(2)} ${escape(_state.selectedCurrency)}`
              ),
              resultItem(
                tx('planner.goldCanBuy'),
                `${(net / p).toFixed(3)} g (${escape(_state.selectedKarat)}K)`
              )
            );
            return f;
          })()
        : emptyMsg(tx('planner.emptyBudget'))
    );
  }

  if (_el.positionResults) {
    const entry = parseFloat(_el.positionEntry?.value) || 0;
    const qty = parseFloat(_el.positionQty?.value) || 0;
    const p = _priceFor({
      currency: _state.selectedCurrency,
      karat: _state.selectedKarat,
      unit: 'gram',
      spot,
    });
    if (entry && qty && p) {
      const entryValue = entry * qty;
      const currentValue = p * qty;
      const gainLoss = currentValue - entryValue;
      const gainLossPercent = (gainLoss / entryValue) * 100;
      const gainColor = gainLoss >= 0 ? 'var(--tp-live)' : 'var(--tp-danger)';
      const gainPrefix = gainLoss >= 0 ? '+' : '';
      const frag = document.createDocumentFragment();
      frag.append(
        resultItem(
          tx('planner.entryValue'),
          `${entryValue.toFixed(2)} ${escape(_state.selectedCurrency)}`
        ),
        resultItem(
          tx('planner.currentValue'),
          `${currentValue.toFixed(2)} ${escape(_state.selectedCurrency)}`
        ),
        resultItem(
          tx('planner.gainLoss'),
          `${gainPrefix}${gainLoss.toFixed(2)} ${escape(_state.selectedCurrency)} (${gainLoss >= 0 ? '+' : ''}${gainLossPercent.toFixed(1)}%)`,
          { color: gainColor }
        )
      );
      _el.positionResults.replaceChildren(frag);
    } else {
      _el.positionResults.replaceChildren(emptyMsg(tx('planner.emptyPosition')));
    }
  }

  if (_el.jewelryResults) {
    const weight = parseFloat(_el.jewelryWeight?.value) || 0;
    const karatCode = _el.jewelryKarat?.value || _state.selectedKarat;
    const making = parseFloat(_el.jewelryMaking?.value) || 0;
    const premium = parseFloat(_el.jewelryPremium?.value) || 0;
    const vat = _el.jewelryVat?.checked ? 0.05 : 0;
    const karat = KARATS.find((k) => k.code === karatCode);
    const p = _priceFor({
      currency: _state.selectedCurrency,
      karat: karatCode,
      unit: 'gram',
      spot,
    });
    if (weight && p && karat) {
      const goldValue = p * weight;
      const makingTotal = making * weight;
      const premiumTotal = (goldValue * premium) / 100;
      const subtotal = goldValue + makingTotal + premiumTotal;
      const vatAmount = subtotal * vat;
      const total = subtotal + vatAmount;
      const cur = escape(_state.selectedCurrency);
      const frag = document.createDocumentFragment();
      frag.append(
        resultItem(tx('planner.goldValue'), `${goldValue.toFixed(2)} ${cur}`),
        resultItem(tx('planner.makingCharge'), `${makingTotal.toFixed(2)} ${cur}`)
      );
      if (premium)
        frag.append(resultItem(tx('planner.premium'), `${premiumTotal.toFixed(2)} ${cur}`));
      frag.append(resultItem(tx('planner.subtotal'), `${subtotal.toFixed(2)} ${cur}`));
      if (vat) frag.append(resultItem(tx('planner.vat'), `${vatAmount.toFixed(2)} ${cur}`));
      frag.append(
        resultItem(tx('planner.total'), `${total.toFixed(2)} ${cur}`, { color: 'var(--tp-accent)' })
      );
      _el.jewelryResults.replaceChildren(frag);
    } else {
      _el.jewelryResults.replaceChildren(emptyMsg(tx('planner.emptyJewelry')));
    }
  }

  if (_el.accumResults) {
    const monthly = parseFloat(_el.accumMonthly?.value) || 0;
    const target = parseFloat(_el.accumTarget?.value) || 0;
    const p = _priceFor({
      currency: _state.selectedCurrency,
      karat: _state.selectedKarat,
      unit: 'gram',
      spot,
    });
    if (p && monthly && target) {
      const gramsPerMonth = monthly / p;
      const months = target / gramsPerMonth;
      const years = months / 12;
      const frag = document.createDocumentFragment();
      frag.append(
        resultItem(tx('planner.gramsPerMonth'), `${gramsPerMonth.toFixed(3)} g`),
        resultItem(tx('planner.monthsToTarget'), `${months.toFixed(1)}`),
        resultItem(tx('planner.yearsToTarget'), `${years.toFixed(2)}`)
      );
      _el.accumResults.replaceChildren(frag);
    } else {
      _el.accumResults.replaceChildren(emptyMsg(tx('planner.emptyAccumulation')));
    }
  }
}
