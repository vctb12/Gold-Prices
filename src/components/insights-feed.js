/**
 * Insights feed component.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Renders the rich market-analysis feed on insights.html:
 *   - category filter strip (chips with live counts)
 *   - debounced client-side search
 *   - masonry-style card grid (CSS columns — no JS layout)
 *   - read-time + publish date per card
 *   - a "Related to current gold price" contextual callout pinned to position 3
 *   - graceful no-results state
 *
 * All DOM is built with the safe-dom `el()` helper (no innerHTML). Bilingual:
 * call `setLang(lang)` to re-render in EN/AR. Live price context is fed via
 * `setPriceContext({ currentUsd, weekAgoUsd })`.
 */

import { el, clear } from '../lib/safe-dom.js';
import {
  filterInsights,
  categoryCounts,
  sortByDateDesc,
  estimateReadMinutes,
  formatReadTime,
  buildPriceContext,
} from '../lib/insights-feed-core.js';

const UI = {
  en: {
    searchLabel: 'Search insights',
    searchPlaceholder: 'Search insights…',
    contextTag: 'Live market context',
    readGuide: 'Read',
    openTracker: 'Open tracker →',
    noResultsTitle: (q) => `No insights match “${q}”.`,
    noResultsHint: 'Try “karat”, “zakat” or “Dubai”.',
    clearSearch: 'Clear search',
  },
  ar: {
    searchLabel: 'ابحث في الرؤى',
    searchPlaceholder: 'ابحث في الرؤى…',
    contextTag: 'سياق السوق المباشر',
    readGuide: 'اقرأ',
    openTracker: 'افتح المتتبع ←',
    noResultsTitle: (q) => `لا توجد رؤى تطابق «${q}».`,
    noResultsHint: 'جرّب «عيار» أو «زكاة» أو «دبي».',
    clearSearch: 'مسح البحث',
  },
};

const SEARCH_DEBOUNCE_MS = 200;
const CONTEXT_POSITION = 3; // 1-based slot in the grid

export class InsightsFeed {
  /**
   * @param {object} opts
   * @param {HTMLElement} opts.mount       container element
   * @param {Array<object>} opts.insights  insight records
   * @param {Array<object>} opts.categories category taxonomy
   * @param {'en'|'ar'} [opts.lang]
   */
  constructor({ mount, insights, categories, lang = 'en' }) {
    this.mount = mount;
    this.insights = sortByDateDesc(insights || []);
    this.categories = categories || [];
    this.lang = lang;
    this.activeCategory = 'all';
    this.query = '';
    this.priceContext = null; // { currentUsd, weekAgoUsd }
    this._debounce = null;
    this._nodes = {};
    this._build();
    this._renderGrid();
  }

  /** Build the static chrome (chips strip, search, grid container) once. */
  _build() {
    clear(this.mount);

    const strip = el('div', {
      class: 'insights-filter-strip',
      role: 'tablist',
      'aria-label': 'Insight categories',
    });
    this._nodes.strip = strip;

    const searchWrap = el('div', { class: 'insights-search' });
    const input = el('input', {
      type: 'search',
      class: 'insights-search-input',
      id: 'insights-search-input',
      autocomplete: 'off',
    });
    const label = el('label', { class: 'sr-only', for: 'insights-search-input' }, [
      UI[this.lang].searchLabel,
    ]);
    input.addEventListener('input', (e) => this._onSearchInput(e.target.value));
    this._nodes.search = input;
    this._nodes.searchLabel = label;
    searchWrap.append(label, input);

    const grid = el('div', {
      class: 'insights-feed-grid',
      'aria-live': 'polite',
    });
    this._nodes.grid = grid;

    this.mount.append(strip, searchWrap, grid);
    this._renderChips();
    this._syncSearchStrings();
  }

  _syncSearchStrings() {
    const t = UI[this.lang];
    if (this._nodes.search) this._nodes.search.setAttribute('placeholder', t.searchPlaceholder);
    if (this._nodes.search) this._nodes.search.setAttribute('aria-label', t.searchLabel);
    if (this._nodes.searchLabel) this._nodes.searchLabel.textContent = t.searchLabel;
  }

  _renderChips() {
    const counts = categoryCounts(this.insights, this.categories);
    clear(this._nodes.strip);
    for (const cat of this.categories) {
      const active = cat.id === this.activeCategory;
      const chip = el(
        'button',
        {
          type: 'button',
          class: `insights-chip${active ? ' is-active' : ''}`,
          role: 'tab',
          'aria-selected': active ? 'true' : 'false',
          dataset: { category: cat.id },
          onclick: () => this._onCategory(cat.id),
        },
        [
          el('span', { class: 'insights-chip-label' }, [cat[this.lang] || cat.en]),
          el('span', { class: 'insights-chip-count' }, [String(counts[cat.id] ?? 0)]),
        ]
      );
      this._nodes.strip.append(chip);
    }
  }

  _onCategory(id) {
    if (this.activeCategory === id) return;
    this.activeCategory = id;
    this._renderChips();
    this._renderGrid();
  }

  _onSearchInput(value) {
    if (this._debounce) clearTimeout(this._debounce);
    this._debounce = setTimeout(() => {
      this.query = value;
      this._renderGrid();
    }, SEARCH_DEBOUNCE_MS);
  }

  _formatDate(dateIso) {
    const d = new Date(`${dateIso}T00:00:00Z`);
    if (Number.isNaN(d.getTime())) return dateIso;
    const locale = this.lang === 'ar' ? 'ar' : 'en-US';
    return d.toLocaleDateString(locale, { year: 'numeric', month: 'short', timeZone: 'UTC' });
  }

  _cardNode(insight) {
    const t = UI[this.lang];
    const cat = this.categories.find((c) => c.id === insight.category);
    const catLabel = cat ? cat[this.lang] || cat.en : insight.category;
    const minutes = estimateReadMinutes(insight.words);

    return el('article', { class: 'insights-feed-card', dataset: { id: insight.id } }, [
      el('div', { class: 'insights-feed-card-top', 'aria-hidden': 'true' }, [
        el('span', { class: 'insights-feed-card-icon' }, [insight.icon || '📰']),
      ]),
      el('span', { class: 'insights-feed-card-tag' }, [catLabel]),
      el('h3', { class: 'insights-feed-card-title' }, [
        insight.title[this.lang] || insight.title.en,
      ]),
      el('p', { class: 'insights-feed-card-excerpt' }, [
        insight.excerpt[this.lang] || insight.excerpt.en,
      ]),
      el('div', { class: 'insights-feed-card-meta' }, [
        el('time', { datetime: insight.dateIso }, [this._formatDate(insight.dateIso)]),
        el('span', { 'aria-hidden': 'true' }, ['·']),
        el('span', { class: 'insights-feed-card-read' }, [formatReadTime(minutes, this.lang)]),
      ]),
      el('a', { class: 'insights-feed-card-link', href: insight.href }, [`${t.readGuide} →`]),
    ]);
  }

  _contextNode() {
    if (!this.priceContext) return null;
    const ctx = buildPriceContext({
      currentUsd: this.priceContext.currentUsd,
      weekAgoUsd: this.priceContext.weekAgoUsd,
      lang: this.lang,
    });
    if (!ctx) return null;
    const t = UI[this.lang];
    const arrow = ctx.direction === 'up' ? '▲' : ctx.direction === 'down' ? '▼' : '▬';

    return el(
      'article',
      {
        class: `insights-feed-card insights-context-card insights-context-card--${ctx.direction}`,
        'aria-live': 'polite',
      },
      [
        el('span', { class: 'insights-feed-card-tag insights-context-tag' }, [t.contextTag]),
        el('div', { class: 'insights-context-headline' }, [
          el('span', { class: 'insights-context-arrow', 'aria-hidden': 'true' }, [arrow]),
          el('span', {}, [ctx.headline]),
        ]),
        el('p', { class: 'insights-feed-card-excerpt' }, [ctx.body]),
        el('a', { class: 'insights-feed-card-link', href: 'tracker.html' }, [t.openTracker]),
      ]
    );
  }

  _noResultsNode() {
    const t = UI[this.lang];
    return el('div', { class: 'insights-feed-empty' }, [
      el('p', { class: 'insights-feed-empty-title' }, [t.noResultsTitle(this.query.trim())]),
      el('p', { class: 'insights-feed-empty-hint' }, [t.noResultsHint]),
      el(
        'button',
        {
          type: 'button',
          class: 'insights-feed-empty-clear',
          onclick: () => {
            this.query = '';
            if (this._nodes.search) this._nodes.search.value = '';
            this.activeCategory = 'all';
            this._renderChips();
            this._renderGrid();
          },
        },
        [t.clearSearch]
      ),
    ]);
  }

  _renderGrid() {
    const grid = this._nodes.grid;
    clear(grid);

    const results = filterInsights(this.insights, {
      category: this.activeCategory,
      query: this.query,
      lang: this.lang,
    });

    if (results.length === 0) {
      grid.append(this._noResultsNode());
      return;
    }

    const contextNode =
      this.activeCategory === 'all' && !this.query.trim() ? this._contextNode() : null;

    let placed = 0;
    results.forEach((insight, index) => {
      // Insert the live context card at the configured slot. CONTEXT_POSITION
      // is 1-based, so the 0-based `placed` index reaches it at POSITION - 1.
      if (contextNode && placed === CONTEXT_POSITION - 1) {
        grid.append(contextNode);
        placed += 1;
      }
      const card = this._cardNode(insight);
      // Stagger entrance via inline custom property (CSS reads --i).
      card.style.setProperty('--i', String(index));
      grid.append(card);
      placed += 1;
    });

    // If fewer than CONTEXT_POSITION cards, still show the context at the end.
    if (contextNode && !contextNode.isConnected) grid.append(contextNode);

    // Trigger entrance animation on next frame.
    requestAnimationFrame(() => grid.classList.add('is-revealed'));
  }

  /** Update the live price context and re-render the contextual card. */
  setPriceContext({ currentUsd, weekAgoUsd }) {
    this.priceContext = { currentUsd, weekAgoUsd };
    this._renderGrid();
  }

  /** Switch language and re-render everything. */
  setLang(lang) {
    if (lang !== 'en' && lang !== 'ar') return;
    this.lang = lang;
    this._renderChips();
    this._syncSearchStrings();
    this._renderGrid();
  }
}

/**
 * Convenience factory.
 * @returns {InsightsFeed}
 */
export function mountInsightsFeed(opts) {
  return new InsightsFeed(opts);
}
