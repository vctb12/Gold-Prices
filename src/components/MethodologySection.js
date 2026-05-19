import { el } from '../lib/safe-dom.js';
import { KARATS } from '../config/karats.js';

const METHODOLOGY_KARATS = ['24', '22', '21', '18', '14'];

function getPurity(code) {
  const fromConfig = KARATS.find((k) => k.code === code)?.purity;
  return fromConfig ?? 0;
}

export function renderMethodologySection({ t = (key) => key, className = '' } = {}) {
  const rows = METHODOLOGY_KARATS.map((code) =>
    el('tr', null, [
      el('th', { scope: 'row' }, `${code}K`),
      el('td', null, `${(getPurity(code) * 100).toFixed(2)}%`),
      el('td', null, getPurity(code).toFixed(4)),
    ])
  );

  return el(
    'section',
    {
      class: `methodology-section${className ? ` ${className}` : ''}`,
      id: 'methodology-reference',
      'aria-labelledby': 'methodology-reference-title',
    },
    [
      el('div', { class: 'section-intro' }, [
        el(
          'h2',
          { id: 'methodology-reference-title', class: 'home-section-title' },
          t('methodology.title')
        ),
        el('p', { class: 'home-section-sub' }, t('methodology.sub')),
      ]),
      el('ol', { class: 'methodology-section__steps' }, [
        el('li', null, t('methodology.stepSpot')),
        el('li', null, t('methodology.stepGram')),
        el('li', null, t('methodology.stepKarat')),
        el('li', null, t('methodology.stepLocal')),
      ]),
      el('div', { class: 'methodology-section__formula' }, t('methodology.formula')),
      el('div', { class: 'methodology-section__table-wrap' }, [
        el('table', { class: 'methodology-section__table' }, [
          el('caption', { class: 'sr-only' }, t('methodology.karatTableCaption')),
          el('thead', null, [
            el('tr', null, [
              el('th', { scope: 'col' }, t('methodology.karatHeader')),
              el('th', { scope: 'col' }, t('methodology.purityHeader')),
              el('th', { scope: 'col' }, t('methodology.factorHeader')),
            ]),
          ]),
          el('tbody', null, rows),
        ]),
      ]),
      el('div', { class: 'methodology-section__disclaimer' }, [
        el('p', null, t('methodology.referenceDisclaimer')),
        el('p', null, t('methodology.vatDisclaimer')),
      ]),
      el('div', { class: 'methodology-section__checklist' }, [
        el('h3', null, t('methodology.compareChecklistTitle')),
        el('ul', null, [
          el('li', null, t('methodology.compareChecklist1')),
          el('li', null, t('methodology.compareChecklist2')),
          el('li', null, t('methodology.compareChecklist3')),
          el('li', null, t('methodology.compareChecklist4')),
        ]),
      ]),
      el('div', { class: 'methodology-section__links' }, [
        el('a', { href: 'methodology.html' }, t('methodology.fullPageLink')),
        el('a', { href: 'calculator.html' }, t('methodology.calculatorLink')),
        el('a', { href: 'tracker.html' }, t('methodology.trackerLink')),
      ]),
    ]
  );
}
