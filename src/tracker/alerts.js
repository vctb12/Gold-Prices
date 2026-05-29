// tracker/alerts.js — alert list and summary rendering
import { _state, _el, _currentSpot, tx } from './_ctx.js';
import { clear, el, setText } from '../lib/safe-dom.js';
import { getFreshnessModel } from './freshness.js';

export function renderAlertsSummary() {
  if (!_el.alertSummary) return;
  const alertsCount = Array.isArray(_state.alerts) ? _state.alerts.length : 0;
  const freshness = getFreshnessModel();
  setText(
    _el.alertSummary,
    tx('alerts.summary', {
      count: alertsCount,
      source: freshness.sourceLabel,
      age: freshness.ageText,
    })
  );
}

export function renderAlerts() {
  if (!_el.alertList) return;
  const alerts = _state.alerts || [];
  const spot = _currentSpot();
  clear(_el.alertList);
  if (!alerts.length) {
    _el.alertList.append(
      el('p', { style: { color: 'var(--tp-text-muted)', fontSize: '0.85rem' } }, tx('alerts.empty'))
    );
    return;
  }
  const fragment = document.createDocumentFragment();
  alerts.forEach((a, i) => {
    const hit = spot && (a.direction === 'above' ? spot > a.target : spot < a.target);
    let proximityText = '';
    let proximityClass = '';
    if (spot) {
      const pct = (Math.abs(spot - a.target) / a.target) * 100;
      if (pct < 1) {
        proximityText = '⚡ very close';
        proximityClass = 'is-alert-imminent';
      } else if (pct < 3) {
        proximityText = '● nearby';
        proximityClass = 'is-alert-close';
      }
    }
    const classes = ['tracker-stack-item', hit && 'is-triggered', proximityClass]
      .filter(Boolean)
      .join(' ');
    const labelChildren = [
      `${a.scope} ${a.direction} `,
      el('strong', null, `$${a.target}`),
      ...(hit ? [' ✓ triggered'] : []),
    ];
    const bodyChildren = [el('span', null, labelChildren)];
    if (proximityText)
      bodyChildren.push(
        el(
          'div',
          { style: { fontSize: '0.8rem', color: 'var(--tp-text-muted)', marginTop: '0.25rem' } },
          proximityText
        )
      );
    fragment.append(
      el('div', { class: classes }, [
        el('div', { style: { flex: '1' } }, bodyChildren),
        el(
          'button',
          {
            dataset: { idx: String(i) },
            class: 'tracker-remove-btn',
            'aria-label': tx('alerts.deleteAriaLabel'),
          },
          '×'
        ),
      ])
    );
  });
  _el.alertList.append(fragment);
}
