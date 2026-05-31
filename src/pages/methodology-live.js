/**
 * Live methodology widgets: formula pipeline, source freshness, unit table, FAQ schema.
 */

import * as api from '../lib/api.js';
import { CONSTANTS } from '../config/index.js';
import { getBaselineHistory, getHistoryStats } from '../lib/historical-data.js';
import { el } from '../lib/safe-dom.js';

const TROY = CONSTANTS.TROY_OZ_GRAMS;
const AED_PEG = CONSTANTS.AED_PEG;
const K22 = 22 / 24;
const TOLA_GRAMS = 11.6638;

function formatUsd(n) {
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatAed(n) {
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function freshnessBadge(state, lang) {
  const labels = {
    en: { live: 'Live', cached: 'Cached', delayed: 'Delayed', stale: 'Stale', fallback: 'Fallback' },
    ar: { live: 'مباشر', cached: 'مخزّن', delayed: 'متأخر', stale: 'قديم', fallback: 'احتياطي' },
  };
  const t = labels[lang] || labels.en;
  const text = t[state] || state;
  return el('span', { class: `badge badge--${state}`, 'aria-label': text }, text);
}

async function updateSourceFreshness(lang) {
  const goldEl = document.getElementById('method-gold-freshness');
  const fxEl = document.getElementById('method-fx-freshness');
  if (!goldEl && !fxEl) return;

  try {
    const data = await api.fetchGold();
    if (goldEl) {
      goldEl.replaceChildren(
        freshnessBadge(data.stale ? 'stale' : 'live', lang),
        document.createTextNode(
          ` · ${lang === 'ar' ? 'آخر تحديث' : 'Updated'} ${data.updatedAt || '—'}`
        )
      );
    }
  } catch {
    if (goldEl) {
      goldEl.replaceChildren(
        freshnessBadge('fallback', lang),
        document.createTextNode(
          lang === 'ar' ? ' · يُعرض آخر سعر معروف' : ' · Showing last known spot'
        )
      );
    }
  }

  if (fxEl) {
    fxEl.replaceChildren(
      freshnessBadge('delayed', lang),
      document.createTextNode(
        lang === 'ar' ? ' · تحديث يومي تقريباً' : ' · ~daily provider refresh'
      )
    );
  }
}

function renderFormulaPipeline(spotUsd, lang) {
  const root = document.getElementById('method-formula-pipeline');
  if (!root || !(spotUsd > 0)) return;

  const usdPerGram24 = spotUsd / TROY;
  const usdPerGram22 = usdPerGram24 * K22;
  const aedPerGram22 = usdPerGram22 * AED_PEG;
  const tolaAed = aedPerGram22 * TOLA_GRAMS;
  const kgAed = aedPerGram22 * 1000;

  const steps =
    lang === 'ar'
      ? [
          { label: 'XAU/USD (أونصة)', value: `$${formatUsd(spotUsd)}` },
          { label: '÷ 31.1034768 → USD/غ 24K', value: `$${formatUsd(usdPerGram24)}` },
          { label: '× 22/24 → USD/غ 22K', value: `$${formatUsd(usdPerGram22)}` },
          { label: `× ${AED_PEG} (ربط AED)`, value: `${formatAed(aedPerGram22)} AED/غ` },
        ]
      : [
          { label: 'XAU/USD (troy oz)', value: `$${formatUsd(spotUsd)}` },
          { label: '÷ 31.1034768 → USD/gram 24K', value: `$${formatUsd(usdPerGram24)}` },
          { label: '× 22/24 → USD/gram 22K', value: `$${formatUsd(usdPerGram22)}` },
          { label: `× ${AED_PEG} AED peg`, value: `${formatAed(aedPerGram22)} AED/g` },
        ];

  const list = el(
    'ol',
    { class: 'method-formula-pipeline' },
    steps.map((step, i) =>
      el('li', { class: 'method-formula-step', 'data-reveal': '', 'data-reveal-delay': String(i + 1) }, [
        el('span', { class: 'method-formula-step-num' }, String(i + 1)),
        el('span', { class: 'method-formula-step-label' }, step.label),
        el('strong', { class: 'method-formula-step-value' }, step.value),
      ])
    )
  );

  const units = el('div', { class: 'method-unit-snapshot' }, [
    el('p', { class: 'method-unit-snapshot-title' }, lang === 'ar' ? 'وحدات شائعة (22K AED)' : 'Common units (22K AED)'),
    el('ul', { class: 'method-unit-snapshot-list' }, [
      el('li', null, `1 tola ≈ ${formatAed(tolaAed)} AED`),
      el('li', null, `1 kg ≈ ${formatAed(kgAed)} AED`),
    ]),
  ]);

  root.replaceChildren(list, units);
}

function renderUnitTable(spotUsd, lang = 'en') {
  const tbody = document.getElementById('method-unit-tbody');
  if (!tbody || !(spotUsd > 0)) return;

  const g24 = spotUsd / TROY;
  const unitLabels = lang === 'ar'
    ? ['1 أونصة تروي', '1 جرام', '1 جرام', '1 تولة (11.664 جم)', '1 كجم']
    : ['1 troy oz', '1 gram', '1 gram', '1 tola (11.664 g)', '1 kg'];

  const rows = [
    [unitLabels[0], '24K', spotUsd, 'USD', spotUsd],
    [unitLabels[1], '24K', g24, 'USD', g24],
    [unitLabels[2], '22K', g24 * K22, 'USD', g24 * K22],
    [unitLabels[3], '22K', null, 'AED', g24 * K22 * AED_PEG * TOLA_GRAMS],
    [unitLabels[4], '24K', null, 'AED', g24 * AED_PEG * 1000],
  ];

  tbody.replaceChildren(
    ...rows.map(([unit, karat, usd, cur, val]) =>
      el('tr', null, [
        el('td', null, unit),
        el('td', null, karat),
        el('td', null, usd != null ? `$${formatUsd(usd)}` : '—'),
        el('td', null, cur === 'AED' ? `${formatAed(val)} AED` : `$${formatUsd(val)}`),
      ])
    )
  );
}

function injectFaqSchema() {
  if (document.getElementById('method-faq-schema')) return;
  const faq = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'Why does my shop quote differ from Gold Ticker Live?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Shop prices add making charges, VAT, design premiums, and dealer margins on top of spot-linked reference metal value.',
        },
      },
      {
        '@type': 'Question',
        name: 'How fresh is the gold price data?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Spot is refreshed server-side hourly during market hours and polled by the browser about every 90 seconds. Freshness labels show live, cached, delayed, stale, or fallback states.',
        },
      },
      {
        '@type': 'Question',
        name: 'Why is AED different from other currencies?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'AED uses the official fixed peg of 3.6725 per USD, so AED gold prices move with XAU/USD without FX spread noise.',
        },
      },
    ],
  };
  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.id = 'method-faq-schema';
  script.textContent = JSON.stringify(faq);
  document.head.appendChild(script);
}

function renderHistoricalContext(lang) {
  const el52 = document.getElementById('method-52w-context');
  if (!el52) return;
  const records = getBaselineHistory();
  const stats = getHistoryStats(records);
  if (!stats.latest || !records.length) {
    el52.textContent =
      lang === 'ar' ? 'السياق التاريخي غير متاح.' : 'Historical context unavailable.';
    return;
  }
  const last12 = records.slice(-12);
  const avg =
    last12.reduce((s, r) => s + r.price, 0) / (last12.length || 1);
  const pct = ((stats.latest - avg) / avg) * 100;
  const dir = pct >= 0 ? 'above' : 'below';
  el52.textContent =
    lang === 'ar'
      ? `السعر الحالي ${Math.abs(pct).toFixed(1)}% ${pct >= 0 ? 'أعلى' : 'أقل'} من متوسط الـ12 شهراً المرجعي.`
      : `Current spot is ${Math.abs(pct).toFixed(1)}% ${dir} the 12-month reference average.`;
}

/**
 * @param {'en'|'ar'} lang
 */
export async function initMethodologyLive(lang = 'en') {
  injectFaqSchema();
  let spot = 0;
  try {
    const data = await api.fetchGold();
    spot = data.price;
  } catch {
    spot = 0;
  }
  renderFormulaPipeline(spot, lang);
  renderUnitTable(spot, lang);
  renderHistoricalContext(lang);
  await updateSourceFreshness(lang);
}
