/**
 * Learn hub category grid, filter, and read progress (localStorage).
 */

import { TRANSLATIONS } from '../config/translations.js';
import {
  LEARN_GUIDE_CATEGORIES,
  countTotalGuides,
  getLearnProgress,
  markGuideRead,
} from '../config/learn-hub-catalog.js';
import { el } from '../lib/safe-dom.js';
function t(lang, key, vars = {}) {
  let s = TRANSLATIONS[lang]?.[key] ?? TRANSLATIONS.en[key] ?? key;
  Object.entries(vars).forEach(([k, v]) => {
    s = s.replace(`{${k}}`, String(v));
  });
  return s;
}

function renderGuideCard(guide, lang) {
  const href = guide.href.startsWith('/') ? guide.href : `/${guide.href}`;
  const read = getLearnProgress().includes(guide.href);
  return el('a', { href, class: `card card--bordered learn-guide-card card-interactive${read ? ' learn-guide-card--read' : ''}` }, [
    el('div', { class: 'learn-guide-card__meta' }, [
      el('span', { class: `badge badge--${guide.level === 'beginner' ? 'info' : 'neutral'}` }, t(lang, `learn.level.${guide.level}`)),
      el('span', { class: 'learn-guide-card__time' }, t(lang, 'learn.readMin', { n: guide.readMin })),
    ]),
    el('h3', { class: 'learn-guide-card__title' }, t(lang, guide.titleKey)),
    el('p', { class: 'learn-guide-card__desc' }, t(lang, guide.descKey)),
  ]);
}

/**
 * @param {{ lang: 'en'|'ar', container: string|HTMLElement }} options
 */
export function mountLearnHubCatalog(options) {
  const lang = options.lang === 'ar' ? 'ar' : 'en';
  const root =
    typeof options.container === 'string'
      ? document.querySelector(options.container)
      : options.container;
  if (!root) return;

  const total = countTotalGuides();
  const readCount = getLearnProgress().filter((h) =>
    LEARN_GUIDE_CATEGORIES.some((c) => c.guides.some((g) => g.href === h))
  ).length;

  const progress = el('p', { class: 'learn-hub-progress', 'aria-live': 'polite' }, t(lang, 'learn.progress', { read: readCount, total }));

  const filter = el('input', {
    type: 'search',
    class: 'learn-hub-filter',
    placeholder: t(lang, 'learn.filterPlaceholder'),
    'aria-label': t(lang, 'learn.filterPlaceholder'),
  });

  const sectionsHost = el('div', { class: 'learn-hub-sections' });

  function renderSections(query = '') {
    const q = query.trim().toLowerCase();
    sectionsHost.replaceChildren(
      ...LEARN_GUIDE_CATEGORIES.map((cat) => {
        const guides = cat.guides.filter((g) => {
          if (!q) return true;
          const title = t(lang, g.titleKey).toLowerCase();
          const desc = t(lang, g.descKey).toLowerCase();
          return title.includes(q) || desc.includes(q);
        });
        if (!guides.length) return null;
        return el('section', { class: 'learn-hub-category', 'data-reveal': '' }, [
          el('h2', { class: 'learn-hub-category__title' }, t(lang, cat.titleKey)),
          el('p', { class: 'learn-hub-category__desc' }, t(lang, cat.descKey)),
          el(
            'div',
            { class: 'learn-hub-grid' },
            guides.map((g, index) => {
              const card = renderGuideCard(g, lang);
              card.setAttribute('data-reveal', '');
              card.setAttribute('data-reveal-delay', String(Math.min(index + 1, 6)));
              return card;
            })
          ),
        ]);
      }).filter(Boolean)
    );
  }

  filter.addEventListener('input', () => renderSections(filter.value));
  renderSections();

  root.replaceChildren(
    el('section', { class: 'learn-hub-catalog card card--bordered' }, [
      progress,
      filter,
      sectionsHost,
      el('div', { class: 'learn-hub-related-row' }, [
        el('a', { href: 'methodology.html', class: 'related-tool-link' }, t(lang, 'learn.relatedMethod')),
        el('a', { href: 'calculator.html', class: 'related-tool-link' }, t(lang, 'learn.relatedCalc')),
      ]),
    ])
  );

  root.querySelectorAll('.learn-guide-card').forEach((card) => {
    card.addEventListener('click', () => {
      const href = card.getAttribute('href')?.replace(/^\//, '') ?? '';
      if (href) markGuideRead(href);
    });
  });
}
