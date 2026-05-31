/**
 * Insights feed renderer.
 *
 * DOM-facing companion to the pure `insights-data.js` module. Builds the
 * category filter strip, the searchable masonry feed, and the dynamic
 * "related to the current gold price" contextual card. All nodes are created
 * with the shared safe-DOM `el()` helper (no innerHTML sinks).
 *
 * Exports `initInsightsFeed()` which returns a small controller the page uses to
 * push live price data and language changes into the feed.
 */

import { el, clear, setText } from '../../lib/safe-dom.js';
import { observeReveal } from '../../lib/reveal.js';
import {
  INSIGHTS,
  CATEGORIES,
  filterInsights,
  categoryCounts,
  categoryLabel,
  localized,
  readTimeLabel,
  buildPriceContextCard,
} from './insights-data.js';

const UI = {
  en: {
    searchPlaceholder: 'Search insights…',
    searchLabel: 'Search insights',
    read: 'Read',
    contextCta: 'Open tracker →',
    noResults: (q) => `No insights match “${q}”. Try “karat” or “Dubai”.`,
    emptyCategory: 'No insights in this category yet.',
  },
  ar: {
    searchPlaceholder: 'ابحث في الرؤى…',
    searchLabel: 'ابحث في الرؤى',
    read: 'اقرأ',
    contextCta: 'افتح المتتبّع ←',
    noResults: (q) => `لا توجد رؤى تطابق «${q}». جرّب «عيار» أو «دبي».`,
    emptyCategory: 'لا توجد رؤى في هذه الفئة بعد.',
  },
};

// Position (1-based) in the rendered feed where the dynamic price-context card
// is injected, matching the catalog spec ("always appears in position 3").
const CONTEXT_CARD_POSITION = 3;
const SEARCH_DEBOUNCE_MS = 200;

function formatDate(yyyymm, lang) {
  const [y, m] = String(yyyymm).split('-').map(Number);
  if (!y || !m) return '';
  const d = new Date(Date.UTC(y, m - 1, 1));
  return d.toLocaleDateString(lang === 'ar' ? 'ar' : 'en-GB', {
    month: 'short',
    year: 'numeric',
  });
}

export function initInsightsFeed(initialLang = 'en') {
  const stripEl = document.getElementById('insights-filter-strip');
  const feedEl = document.getElementById('insights-feed');
  const emptyEl = document.getElementById('insights-feed-empty');
  const searchEl = /** @type {HTMLInputElement|null} */ (
    document.getElementById('insights-search-input')
  );
  const searchLabelEl = document.getElementById('insights-search-label');

  if (!feedEl || !stripEl) return null;

  const state = {
    lang: initialLang === 'ar' ? 'ar' : 'en',
    category: 'all',
    query: '',
    weekAgoPrice: 0,
    currentPrice: 0,
  };

  let searchTimer = null;

  function t() {
    return UI[state.lang] ?? UI.en;
  }

  function buildCard(item) {
    const lang = state.lang;
    const card = el(
      'article',
      { class: 'insights-feed-card card-interactive', 'data-reveal': '' },
      [
        el('div', { class: 'insights-feed-card-top' }, [
          el('span', { class: 'insights-feed-icon', 'aria-hidden': 'true' }, item.icon),
          el('span', { class: 'insights-feed-badge' }, categoryLabel(item.category, lang)),
        ]),
        el('h3', { class: 'insights-feed-card-title' }, localized(item, 'title', lang)),
        el('p', { class: 'insights-feed-card-excerpt' }, localized(item, 'excerpt', lang)),
        el('div', { class: 'insights-feed-card-meta' }, [
          el('time', { datetime: item.date }, formatDate(item.date, lang)),
          el('span', { class: 'insights-feed-dot', 'aria-hidden': 'true' }, '·'),
          el('span', { class: 'insights-feed-readtime' }, readTimeLabel(item.words, lang)),
        ]),
        el(
          'a',
          {
            class: 'insights-feed-card-link',
            href: item.href,
            'aria-label': `${t().read}: ${localized(item, 'title', lang)}`,
          },
          `${t().read} →`
        ),
      ]
    );
    return card;
  }

  function buildContextCard() {
    const lang = state.lang;
    const ctx = buildPriceContextCard(state.weekAgoPrice, state.currentPrice, lang);
    const arrow = ctx.direction === 'up' ? '▲' : ctx.direction === 'down' ? '▼' : '◆';
    return el(
      'article',
      {
        class: `insights-feed-card insights-context-card insights-context-card--${ctx.direction}`,
        'aria-live': 'polite',
      },
      [
        el('div', { class: 'insights-feed-card-top' }, [
          el('span', { class: 'insights-context-arrow', 'aria-hidden': 'true' }, arrow),
          el(
            'span',
            { class: 'insights-feed-badge insights-context-badge' },
            lang === 'ar' ? 'مباشر' : 'Live'
          ),
        ]),
        el('h3', { class: 'insights-feed-card-title' }, ctx.title),
        el('p', { class: 'insights-feed-card-excerpt' }, ctx.body),
        el('a', { class: 'insights-feed-card-link', href: ctx.href }, t().contextCta),
      ]
    );
  }

  function renderStrip() {
    const counts = categoryCounts(INSIGHTS);
    clear(stripEl);
    CATEGORIES.forEach((cat) => {
      const count = counts[cat.id] ?? 0;
      if (cat.id !== 'all' && count === 0) return;
      const isActive = cat.id === state.category;
      const chip = el(
        'button',
        {
          type: 'button',
          class: `insights-chip${isActive ? ' insights-chip--active' : ''}`,
          role: 'tab',
          'aria-selected': isActive ? 'true' : 'false',
          'data-category': cat.id,
          onclick: () => {
            if (state.category === cat.id) return;
            state.category = cat.id;
            syncHash();
            renderStrip();
            renderFeed();
          },
        },
        [
          el('span', { class: 'insights-chip-label' }, categoryLabel(cat.id, state.lang)),
          el('span', { class: 'insights-chip-count' }, String(count)),
        ]
      );
      stripEl.appendChild(chip);
    });
  }

  function renderFeed() {
    const results = filterInsights(INSIGHTS, {
      category: state.category,
      query: state.query,
      lang: state.lang,
    });

    clear(feedEl);

    if (results.length === 0) {
      feedEl.hidden = true;
      if (emptyEl) {
        emptyEl.hidden = false;
        setText(emptyEl, state.query ? t().noResults(state.query) : t().emptyCategory);
      }
      return;
    }

    if (emptyEl) emptyEl.hidden = true;
    feedEl.hidden = false;

    results.forEach((item, idx) => {
      // Inject the dynamic price-context card at the configured position, but
      // only when not actively searching (it would dilute search results).
      if (idx === CONTEXT_CARD_POSITION - 1 && !state.query) {
        feedEl.appendChild(buildContextCard());
      }
      feedEl.appendChild(buildCard(item));
    });

    // If the list is shorter than the context position, still show the card.
    if (!state.query && results.length < CONTEXT_CARD_POSITION) {
      feedEl.appendChild(buildContextCard());
    }

    observeReveal(feedEl);
  }

  function syncHash() {
    const parts = [];
    if (state.category && state.category !== 'all') parts.push(`cat=${state.category}`);
    const hash = parts.length ? `#${parts.join('&')}` : '';
    if (hash !== location.hash) {
      history.replaceState(null, '', `${location.pathname}${location.search}${hash}`);
    }
  }

  function readHash() {
    const hash = location.hash.replace(/^#/, '');
    if (!hash) return;
    const params = new URLSearchParams(hash);
    const cat = params.get('cat');
    if (cat && CATEGORIES.some((c) => c.id === cat)) state.category = cat;
  }

  function applyLangStrings() {
    if (searchEl) searchEl.placeholder = t().searchPlaceholder;
    if (searchEl) searchEl.setAttribute('aria-label', t().searchLabel);
    if (searchLabelEl) setText(searchLabelEl, t().searchLabel);
  }

  if (searchEl) {
    searchEl.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        state.query = searchEl.value || '';
        renderFeed();
      }, SEARCH_DEBOUNCE_MS);
    });
  }

  // Initial paint
  readHash();
  applyLangStrings();
  renderStrip();
  renderFeed();

  return {
    /** Update live spot prices feeding the contextual card. */
    setPrices({ current, weekAgo } = {}) {
      if (Number.isFinite(current) && current > 0) state.currentPrice = current;
      if (Number.isFinite(weekAgo) && weekAgo > 0) state.weekAgoPrice = weekAgo;
      // Only the context card depends on price; cheap to re-render the feed.
      renderFeed();
    },
    /** Switch language and re-render all feed surfaces. */
    setLang(lang) {
      state.lang = lang === 'ar' ? 'ar' : 'en';
      applyLangStrings();
      renderStrip();
      renderFeed();
    },
    destroy() {
      clearTimeout(searchTimer);
    },
  };
}
