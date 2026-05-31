/**
 * Insights feed — DOM renderer (BUILD 8).
 *
 * Renders a category filter strip, debounced client-side search, a masonry card
 * grid, an estimated read time per card, and a dynamic "related to the current
 * gold price" callout injected at position 3 of the grid.
 *
 * Public API:
 *   const feed = initInsightsFeed({ root, lang });
 *   feed.setLang('ar');         // re-render in a new language
 *   feed.setPriceChange(1.23);  // update the live-price callout (% vs last week)
 *   feed.destroy();             // remove listeners
 */

import { el, clear } from '../../lib/safe-dom.js';
import { INSIGHTS, INSIGHT_CATEGORIES } from '../../config/insights-data.js';
import {
  readTimeLabel,
  formatDate,
  categoryCounts,
  filterInsights,
  buildPriceCallout,
  noResultsText,
} from './feed-core.js';

const SEARCH_DEBOUNCE_MS = 200;
const CALLOUT_POSITION = 2; // zero-based → 3rd card

function categoryLabel(cat, lang) {
  return lang === 'ar' ? cat.ar : cat.en;
}

function buildCard(item, lang) {
  const cat = INSIGHT_CATEGORIES.find((c) => c.key === item.category);
  const title = item.title?.[lang] || item.title?.en || '';
  const excerpt = item.excerpt?.[lang] || item.excerpt?.en || '';
  const readMore = lang === 'ar' ? 'اقرأ ←' : 'Read →';

  return el(
    'article',
    { class: 'insights-feed-card card-interactive', dataset: { category: item.category } },
    [
      el('a', { href: item.url, class: 'insights-feed-card-link', 'aria-label': title }, [
        el('div', { class: 'insights-feed-cover', dataset: { accent: item.category } }, [
          el(
            'span',
            { class: 'insights-feed-cover-icon', 'aria-hidden': 'true' },
            item.icon || '📄'
          ),
        ]),
        el('div', { class: 'insights-feed-card-body' }, [
          el('span', { class: 'insights-feed-card-tag', dataset: { accent: item.category } }, [
            cat ? `${cat.icon} ${categoryLabel(cat, lang)}` : '',
          ]),
          el('h3', { class: 'insights-feed-card-title' }, title),
          el('p', { class: 'insights-feed-card-excerpt' }, excerpt),
          el('div', { class: 'insights-feed-card-meta' }, [
            el('time', { datetime: item.date }, formatDate(item.date, lang)),
            el('span', { class: 'insights-feed-card-dot', 'aria-hidden': 'true' }, '·'),
            el('span', null, readTimeLabel(item.words, lang)),
          ]),
          el('span', { class: 'insights-feed-card-cta' }, readMore),
        ]),
      ]),
    ]
  );
}

function buildCallout(state) {
  const c = buildPriceCallout({ changePct: state.priceChangePct, lang: state.lang });
  return el(
    'article',
    {
      class: 'insights-feed-card insights-feed-callout',
      dataset: { direction: c.direction },
      'aria-live': 'polite',
    },
    [
      el('div', { class: 'insights-feed-callout-inner' }, [
        el('span', { class: 'insights-feed-callout-eyebrow' }, [
          el(
            'span',
            { class: 'insights-feed-callout-pct', dataset: { direction: c.direction } },
            c.pctText
          ),
          c.headline,
        ]),
        el('p', { class: 'insights-feed-callout-body' }, c.body),
        el('a', { href: c.href, class: 'insights-feed-callout-cta' }, c.cta),
      ]),
    ]
  );
}

function renderGrid(state) {
  const grid = state.refs.grid;
  if (!grid) return;
  clear(grid);

  const items = filterInsights(INSIGHTS, {
    category: state.category,
    query: state.query,
    lang: state.lang,
  });

  if (!items.length) {
    grid.classList.add('is-empty');
    grid.append(
      el(
        'div',
        { class: 'insights-feed-empty', role: 'status' },
        noResultsText(state.query, state.lang)
      )
    );
    return;
  }
  grid.classList.remove('is-empty');

  items.forEach((item, idx) => {
    // Inject the live-price callout at position 3 only when not searching and on
    // the "all" view, so the grid stays coherent while filtering.
    if (idx === CALLOUT_POSITION && state.category === 'all' && !state.query) {
      grid.append(buildCallout(state));
    }
    grid.append(buildCard(item, state.lang));
  });

  // If there are fewer than 3 cards, still surface the callout at the end.
  if (items.length <= CALLOUT_POSITION && state.category === 'all' && !state.query) {
    grid.append(buildCallout(state));
  }
}

function renderChips(state) {
  const strip = state.refs.chips;
  if (!strip) return;
  clear(strip);

  const counts = categoryCounts(INSIGHTS);
  const allLabel = state.lang === 'ar' ? 'الكل' : 'All';
  const cats = [{ key: 'all', icon: '✦', en: allLabel, ar: allLabel }, ...INSIGHT_CATEGORIES];

  cats.forEach((cat) => {
    const count = counts[cat.key] || 0;
    if (cat.key !== 'all' && count === 0) return;
    const active = state.category === cat.key;
    const chip = el(
      'button',
      {
        type: 'button',
        class: `insights-feed-chip${active ? ' is-active' : ''}`,
        'aria-pressed': active ? 'true' : 'false',
        dataset: { category: cat.key },
        onClick: () => setCategory(state, cat.key),
      },
      [
        el('span', { 'aria-hidden': 'true', class: 'insights-feed-chip-icon' }, cat.icon),
        categoryLabel(cat, state.lang),
        el('span', { class: 'insights-feed-chip-count' }, String(count)),
      ]
    );
    strip.append(chip);
  });
}

function swapRender(state) {
  const grid = state.refs.grid;
  if (!grid) return;
  grid.classList.add('is-swapping');
  // Allow the fade-out to paint, then re-render and fade back in.
  window.requestAnimationFrame(() => {
    renderGrid(state);
    window.requestAnimationFrame(() => grid.classList.remove('is-swapping'));
  });
}

function setCategory(state, category) {
  if (state.category === category) return;
  state.category = category;
  if (category === 'all') {
    history.replaceState(null, '', location.pathname + location.search);
  } else {
    history.replaceState(null, '', `#cat=${category}`);
  }
  renderChips(state);
  swapRender(state);
}

function setQuery(state, query) {
  state.query = query;
  swapRender(state);
}

function readHashCategory() {
  const m = /[#&]cat=([a-z-]+)/.exec(location.hash);
  if (!m) return 'all';
  return INSIGHT_CATEGORIES.some((c) => c.key === m[1]) ? m[1] : 'all';
}

function buildShell(state) {
  const { lang } = state;
  const heading = lang === 'ar' ? 'دليل وتحليلات السوق' : 'Market guides & analysis';
  const sub =
    lang === 'ar'
      ? 'صفّ حسب الفئة أو ابحث عبر كل أدلتنا'
      : 'Filter by category or search across every guide';
  const searchPlaceholder = lang === 'ar' ? 'ابحث في الرؤى…' : 'Search insights…';
  const searchLabel = lang === 'ar' ? 'ابحث في الرؤى' : 'Search insights';

  clear(state.root);

  const header = el('div', { class: 'insights-feed-header' }, [
    el('h2', { class: 'insights-feed-title' }, heading),
    el('p', { class: 'insights-feed-sub' }, sub),
  ]);

  const searchInput = el('input', {
    type: 'search',
    id: 'insights-feed-search',
    class: 'insights-feed-search-input',
    placeholder: searchPlaceholder,
    'aria-label': searchLabel,
    autocomplete: 'off',
  });
  searchInput.value = state.query;
  searchInput.addEventListener('input', () => {
    clearTimeout(state.debounceTimer);
    const value = searchInput.value;
    state.debounceTimer = setTimeout(() => setQuery(state, value), SEARCH_DEBOUNCE_MS);
  });

  const searchWrap = el('div', { class: 'insights-feed-search' }, [
    el('label', { class: 'insights-feed-search-label', for: 'insights-feed-search' }, [
      el('span', { 'aria-hidden': 'true', class: 'insights-feed-search-icon' }, '🔎'),
    ]),
    searchInput,
  ]);

  const chips = el('div', {
    class: 'insights-feed-chips',
    role: 'group',
    'aria-label': lang === 'ar' ? 'تصفية حسب الفئة' : 'Filter by category',
  });

  const grid = el('div', { class: 'insights-feed-grid' });

  state.refs = { grid, chips, search: searchInput };

  state.root.append(
    header,
    el('div', { class: 'insights-feed-toolbar' }, [chips, searchWrap]),
    grid
  );

  renderChips(state);
  renderGrid(state);
}

/**
 * Mount the feed.
 * @param {{ root: HTMLElement, lang?: 'en'|'ar' }} opts
 */
export function initInsightsFeed({ root, lang = 'en' }) {
  if (!root) return { setLang() {}, setPriceChange() {}, destroy() {} };

  const state = {
    root,
    lang,
    category: readHashCategory(),
    query: '',
    priceChangePct: null,
    refs: {},
    debounceTimer: null,
  };

  buildShell(state);

  return {
    setLang(nextLang) {
      if (nextLang !== 'en' && nextLang !== 'ar') return;
      state.lang = nextLang;
      buildShell(state);
    },
    setPriceChange(pct) {
      state.priceChangePct = pct;
      // Only re-render the grid if the callout is currently visible.
      if (state.category === 'all' && !state.query) renderGrid(state);
    },
    destroy() {
      clearTimeout(state.debounceTimer);
    },
  };
}
