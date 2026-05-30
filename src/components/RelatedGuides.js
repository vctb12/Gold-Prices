import { el } from '../lib/safe-dom.js';

const GUIDES_EN = [
  { href: 'content/guides/buying-guide.html', title: 'GCC gold buying guide', desc: 'Weights, karats, and shop checklist' },
  { href: 'content/spot-vs-retail-gold-price/', title: 'Spot vs retail', desc: 'Why shop quotes differ from reference' },
  { href: 'content/gold-making-charges-guide/index.html', title: 'Making charges', desc: 'Fees shops add on top of spot' },
  { href: 'content/guides/24k-vs-22k-vs-18k-gold/index.html', title: '24K vs 22K vs 18K', desc: 'Purity and resale value' },
];

const GUIDES_AR = [
  { href: 'content/guides/buying-guide.html?lang=ar', title: 'دليل شراء الذهب في الخليج', desc: 'الأوزان والعيارات وقائمة التحقق' },
  { href: 'content/spot-vs-retail-gold-price/?lang=ar', title: 'السعر الفوري مقابل التجزئة', desc: 'لماذا تختلف أسعار المحلات' },
  { href: 'content/gold-making-charges-guide/index.html?lang=ar', title: 'رسوم المصنعية', desc: 'ما تضيفه المحلات فوق السعر المرجعي' },
  { href: 'content/guides/ar/24k-vs-22k-vs-18k-gold/index.html', title: '24 مقابل 22 مقابل 18', desc: 'النقاء وقيمة إعادة البيع' },
];

/**
 * @param {{ lang?: 'en'|'ar', heading?: string }} [options]
 */
export function renderRelatedGuides(options = {}) {
  const lang = options.lang === 'ar' ? 'ar' : 'en';
  const items = lang === 'ar' ? GUIDES_AR : GUIDES_EN;
  const heading =
    options.heading ?? (lang === 'ar' ? 'أدلة ذات صلة' : 'Related guides');

  const list = el(
    'ul',
    { class: 'related-guides-list' },
    items.map((item) =>
      el('li', { class: 'related-guides-item' }, [
        el('a', { href: item.href, class: 'related-guides-link' }, [
          el('strong', null, item.title),
          el('span', { class: 'related-guides-desc' }, item.desc),
        ]),
      ])
    )
  );

  return el('section', { class: 'related-guides card card--bordered', 'aria-labelledby': 'related-guides-heading' }, [
    el('h2', { id: 'related-guides-heading', class: 'related-guides-title' }, heading),
    list,
  ]);
}

/**
 * Mount related guides before footer inside `main` when slot exists or at end of main.
 */
export function mountRelatedGuides(options = {}) {
  const slot = document.getElementById('related-guides-slot');
  const node = renderRelatedGuides(options);
  if (slot) {
    slot.replaceChildren(node);
    return;
  }
  const main = document.querySelector('main');
  if (main) main.appendChild(node);
}
