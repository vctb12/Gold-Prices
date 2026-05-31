/**
 * Insights page entry point.
 * Handles nav injection, language toggle, live mini price bar, bilingual content,
 * category filtering, client-side search, masonry card grid, and contextual callout.
 */

import * as cache from '../lib/cache.js';
import * as api from '../lib/api.js';
import { mountSharedShell } from '../components/site-shell.js';
import { injectBreadcrumbs } from '../components/breadcrumbs.js';
import { CONSTANTS } from '../config/index.js';
import { getBaselineHistory, getHistoryStats } from '../lib/historical-data.js';
import { initPageEnter } from '../lib/page-enter.js';
import { countUp } from '../lib/count-up.js';
import { mountRelatedGuides } from '../components/RelatedGuides.js';
import { escape, safeHref } from '../lib/safe-dom.js';
import {
  INSIGHTS_ARTICLES,
  INSIGHT_CATEGORIES,
  CATEGORY_TAG_CLASS,
  getReadTime,
} from '../config/insights-articles.js';

const AED_PEG = CONSTANTS.AED_PEG; // 3.6725
const TROY_GRAMS = CONSTANTS.TROY_OZ_GRAMS; // 31.1035
const KARAT_22_PURITY = 22 / 24;

const STATE = {
  lang: 'en',
  goldPriceUsdPerOz: 0,
  rates: {},
  fxMeta: { nextUpdateUtc: 0 },
  status: { goldStale: false, fxStale: false },
  freshness: { goldUpdatedAt: null },
  favorites: [],
  history: [],
  activeTab: 'gcc',
  sortOrder: 'default',
  searchQuery: '',
  dayOpenGoldPriceUsdPerOz: 0,
  selectedKaratSpotlight: '22',
  selectedKaratCountries: '22',
  selectedUnitTable: 'gram',
  // Feed state
  activeCategory: 'all',
  feedSearchQuery: '',
};

// ─────────────────────────────────────────────────────────────────────────────
// BILINGUAL CONTENT
// ─────────────────────────────────────────────────────────────────────────────

const CONTENT = {
  en: {
    // Hero
    'hero-tag': 'Market Intelligence',
    'insights-h1': 'Gold Market Insights',
    'insights-sub': 'Analysis, price drivers and context for GCC gold buyers — updated weekly',

    // Price bar
    'price-bar-label': 'Live Gold Price',

    // Featured article
    'featured-tag-label': 'Featured Analysis',
    'featured-date': 'March 2026',
    'featured-read-time': '4 min read',

    // Insight grid heading
    'insights-grid-h2': 'Gold Market Guides',
    'insights-grid-sub': 'Essential reading for GCC gold buyers',

    // Stats
    'stats-title': 'Gold by the Numbers',
    'stats-sub': 'Key facts for MENA gold buyers',

    // Related tools
    'related-tools-title': 'Related Tools',

    'insights.pulseTitle': 'Market pulse',
    'insights.pulseDay': 'Today vs day open',
    'insights.pulseYtd': 'Year to date',
    'insights.pulse52w': 'vs 12-month average',
    'insights.pageUpdated': 'Page data updated',

    // Feed
    'insights.searchLabel': 'Search articles',
    'insights.searchPlaceholder': 'Search articles…',
    'insights.catAll': 'All',
    'insights.catPrice': 'Price Analysis',
    'insights.catNews': 'Market News',
    'insights.catGuide': 'Buying Guides',
    'insights.catIslamic': 'Zakat & Islamic Finance',
    'insights.catInvest': 'Investment',
    'insights.catEducation': 'Education',
    'insights.noResults': "No insights match '{query}'. Try 'karat' or 'Dubai'.",
    'insights.resultCount': 'Showing {count} of {total} articles',
    'insights.readTime': '{n} min read',
    'insights.contextCallout': 'Gold is currently {dir} {pct} from last week.',
    'insights.contextUp': '▲ up',
    'insights.contextDown': '▼ down',
    'insights.contextLink': 'View price analysis →',
  },
  ar: {
    // Hero
    'hero-tag': 'ذكاء السوق',
    'insights-h1': 'رؤى سوق الذهب',
    'insights-sub': 'تحليلات ومحركات الأسعار وسياق السوق لمشتري الذهب في دول الخليج — تحديث أسبوعي',

    // Price bar
    'price-bar-label': 'سعر الذهب المباشر',

    // Featured article
    'featured-tag-label': 'تحليل مميز',
    'featured-date': 'مارس ٢٠٢٦',
    'featured-read-time': 'قراءة ٤ دقائق',

    // Insight grid heading
    'insights-grid-h2': 'أدلة سوق الذهب',
    'insights-grid-sub': 'قراءة أساسية لمشتري الذهب في الخليج',

    // Stats
    'stats-title': 'الذهب بالأرقام',
    'stats-sub': 'حقائق رئيسية لمشتري الذهب في منطقة الشرق الأوسط وشمال أفريقيا',

    // Related tools
    'related-tools-title': 'أدوات ذات صلة',

    'insights.pulseTitle': 'نبض السوق',
    'insights.pulseDay': 'اليوم مقابل افتتاح اليوم',
    'insights.pulseYtd': 'منذ بداية العام',
    'insights.pulse52w': 'مقارنة بمتوسط 12 شهراً',
    'insights.pageUpdated': 'تحديث بيانات الصفحة',

    // Feed
    'insights.searchLabel': 'بحث المقالات',
    'insights.searchPlaceholder': 'بحث في المقالات…',
    'insights.catAll': 'الكل',
    'insights.catPrice': 'تحليل الأسعار',
    'insights.catNews': 'أخبار السوق',
    'insights.catGuide': 'أدلة الشراء',
    'insights.catIslamic': 'الزكاة والتمويل الإسلامي',
    'insights.catInvest': 'استثمار',
    'insights.catEducation': 'تعليم',
    'insights.noResults': "لا توجد رؤى تطابق '{query}'. جرّب 'قيراط' أو 'دبي'.",
    'insights.resultCount': 'عرض {count} من {total} مقالة',
    'insights.readTime': 'قراءة {n} دقائق',
    'insights.contextCallout': 'الذهب حالياً {dir} {pct} عن الأسبوع الماضي.',
    'insights.contextUp': '▲ مرتفع',
    'insights.contextDown': '▼ منخفض',
    'insights.contextLink': 'عرض تحليل الأسعار →',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// LANGUAGE
// ─────────────────────────────────────────────────────────────────────────────

function applyLang(lang) {
  const content = CONTENT[lang] ?? CONTENT.en;
  Object.entries(content).forEach(([id, text]) => {
    const node = document.getElementById(id);
    if (node) node.textContent = text;
  });
  document.querySelectorAll('[data-i18n]').forEach((node) => {
    const key = node.getAttribute('data-i18n');
    if (content[key]) node.textContent = content[key];
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((node) => {
    const key = node.getAttribute('data-i18n-placeholder');
    if (content[key]) node.placeholder = content[key];
  });
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
}

// ─────────────────────────────────────────────────────────────────────────────
// PRICE BAR
// ─────────────────────────────────────────────────────────────────────────────

function formatUsd(price) {
  return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function calcAed22kPerGram(usdPerOz) {
  return (usdPerOz / TROY_GRAMS) * KARAT_22_PURITY * AED_PEG;
}

function updatePriceBar(priceUsd, stale) {
  const valEl = document.getElementById('price-bar-value');
  const aedEl = document.getElementById('price-bar-aed');
  const freshEl = document.getElementById('price-bar-freshness');

  if (!valEl) return;

  if (priceUsd > 0) {
    valEl.textContent = formatUsd(priceUsd);
    valEl.classList.toggle('price-bar-stale', !!stale);

    const aed22 = calcAed22kPerGram(priceUsd);
    if (aedEl)
      aedEl.textContent = aed22.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
  }

  if (freshEl) {
    if (stale) {
      freshEl.textContent = STATE.lang === 'ar' ? 'بيانات قديمة' : 'Stale data';
      freshEl.classList.add('price-bar-stale');
    } else {
      const now = new Date();
      const hhmm = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      freshEl.textContent = (STATE.lang === 'ar' ? 'تحديث ' : 'Updated ') + hhmm;
      freshEl.classList.remove('price-bar-stale');
    }
  }
}

function formatPct(pct) {
  if (pct == null || Number.isNaN(pct)) return '—';
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(2)}%`;
}

function setPulseValue(id, pct) {
  const node = document.getElementById(id);
  if (!node) return;
  node.classList.remove('insights-pulse-value--up', 'insights-pulse-value--down');
  if (pct == null || Number.isNaN(pct)) {
    node.textContent = '—';
    return;
  }
  node.classList.add(pct >= 0 ? 'insights-pulse-value--up' : 'insights-pulse-value--down');
  countUp(node, pct, {
    decimals: 2,
    format: (n) => formatPct(n),
    pulse: true,
    pulseTarget: node.closest('.insights-pulse-card'),
  });
}

function updateMarketPulse(spotUsd) {
  const records = getBaselineHistory();
  const stats = getHistoryStats(records);
  if (stats.ytdChange != null) setPulseValue('pulse-ytd-value', stats.ytdChange);
  if (stats.yoyChange != null) setPulseValue('pulse-52w-value', stats.yoyChange);

  const last12 = records.slice(-12);
  if (last12.length && spotUsd > 0) {
    const avg = last12.reduce((s, r) => s + r.price, 0) / last12.length;
    setPulseValue('pulse-52w-value', ((spotUsd - avg) / avg) * 100);
  }

  const open = STATE.dayOpenGoldPriceUsdPerOz;
  if (open > 0 && spotUsd > 0) {
    setPulseValue('pulse-day-value', ((spotUsd - open) / open) * 100);
  }

  const updated = document.getElementById('insights-page-updated');
  if (updated) {
    const hhmm = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const label = STATE.lang === 'ar' ? 'تحديث بيانات الصفحة' : 'Page data updated';
    updated.textContent = `${label}: ${hhmm}`;
  }
}

async function fetchAndUpdatePriceBar() {
  try {
    const data = await api.fetchGold();
    STATE.goldPriceUsdPerOz = data.price;
    STATE.status.goldStale = false;
    cache.saveGoldPrice(data.price, data.updatedAt);
    updatePriceBar(data.price, false);
    updateMarketPulse(data.price);
    refreshContextCallout();
  } catch {
    STATE.status.goldStale = true;
    if (STATE.goldPriceUsdPerOz > 0) {
      updatePriceBar(STATE.goldPriceUsdPerOz, true);
    } else {
      const freshEl = document.getElementById('price-bar-freshness');
      if (freshEl) freshEl.textContent = STATE.lang === 'ar' ? 'غير متاح' : 'Unavailable';
    }
  }
}

/** Update the contextual callout in the grid (if visible and category is 'all') */
function refreshContextCallout() {
  const grid = document.getElementById('insights-masonry-grid');
  if (!grid) return;
  const existing = grid.querySelector('.insights-context-callout');
  if (!existing) return; // Not shown (category filtered or search active)
  const newCallout = buildContextCallout();
  if (newCallout) {
    const tmp = document.createElement('div');
    tmp.innerHTML = newCallout;
    existing.replaceWith(tmp.firstElementChild);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// INSIGHTS FEED — Category Filter, Search, Card Rendering
// ─────────────────────────────────────────────────────────────────────────────

let _searchDebounce = null;

function getFilteredArticles() {
  let articles = INSIGHTS_ARTICLES;

  // Category filter
  if (STATE.activeCategory !== 'all') {
    articles = articles.filter((a) => a.category === STATE.activeCategory);
  }

  // Search filter
  const q = STATE.feedSearchQuery.trim().toLowerCase();
  if (q) {
    articles = articles.filter((a) => {
      const title = (a.title[STATE.lang] || a.title.en).toLowerCase();
      const excerpt = (a.excerpt[STATE.lang] || a.excerpt.en).toLowerCase();
      return title.includes(q) || excerpt.includes(q);
    });
  }

  return articles;
}

function getCategoryCounts() {
  const counts = { all: INSIGHTS_ARTICLES.length };
  for (const cat of Object.keys(INSIGHT_CATEGORIES)) {
    if (cat === 'all') continue;
    counts[cat] = INSIGHTS_ARTICLES.filter((a) => a.category === cat).length;
  }
  return counts;
}

function renderCategoryChips() {
  const counts = getCategoryCounts();
  const content = CONTENT[STATE.lang] ?? CONTENT.en;

  for (const [cat, labels] of Object.entries(INSIGHT_CATEGORIES)) {
    const btn = document.querySelector(`[data-category="${cat}"]`);
    if (!btn) continue;

    const spanLabel = btn.querySelector('[data-i18n]');
    if (spanLabel) spanLabel.textContent = labels[STATE.lang] || labels.en;

    const countEl = btn.querySelector('.insights-cat-count');
    if (countEl && counts[cat] != null) {
      countEl.textContent = `(${counts[cat]})`;
    }

    btn.classList.toggle('is-active', cat === STATE.activeCategory);
    btn.setAttribute('aria-selected', cat === STATE.activeCategory ? 'true' : 'false');
  }
}

function buildCardHTML(article) {
  const lang = STATE.lang;
  const title = escape(article.title[lang] || article.title.en);
  const excerpt = escape(article.excerpt[lang] || article.excerpt.en);
  const readMin = getReadTime(article.wordCount);
  const content = CONTENT[lang] ?? CONTENT.en;
  const readTimeLabel = escape(content['insights.readTime'].replace('{n}', readMin));
  const catLabel = escape((INSIGHT_CATEGORIES[article.category] || {})[lang] || article.category);
  const tagClass = escape(CATEGORY_TAG_CLASS[article.category] || 'insight-tag--guide');
  const href = safeHref(article.href) || '#';
  const readLink = lang === 'ar' ? 'اقرأ المزيد →' : 'Read →';

  return `<article class="insight-card card-interactive" data-category="${escape(article.category)}" data-id="${escape(article.id)}" data-reveal>
    <div class="insight-card-header">
      <span class="insight-tag-chip ${tagClass}">${catLabel}</span>
      <span class="insight-read-time">${readTimeLabel}</span>
    </div>
    <h3 class="insight-card-title">${title}</h3>
    <p class="insight-card-excerpt">${excerpt}</p>
    <div class="insight-card-footer">
      <span class="insight-card-date">${escape(article.date)}</span>
      <a href="${href}" class="insight-read-more">${escape(readLink)}</a>
    </div>
  </article>`;
}

const MIN_CALLOUT_THRESHOLD_PCT = 0.1;

function buildContextCallout() {
  if (STATE.goldPriceUsdPerOz <= 0) return '';

  const records = getBaselineHistory();
  if (records.length < 2) return '';

  // Get last 7 records for weekly average
  const recent = records.slice(-7);
  const weekAvg = recent.reduce((s, r) => s + r.price, 0) / recent.length;
  const pctChange = ((STATE.goldPriceUsdPerOz - weekAvg) / weekAvg) * 100;

  if (Math.abs(pctChange) < MIN_CALLOUT_THRESHOLD_PCT) return '';

  const content = CONTENT[STATE.lang] ?? CONTENT.en;
  const dir = pctChange >= 0 ? content['insights.contextUp'] : content['insights.contextDown'];
  const pctStr = Math.abs(pctChange).toFixed(2) + '%';
  const msg = escape(
    content['insights.contextCallout'].replace('{dir}', dir).replace('{pct}', pctStr)
  );
  const linkText = escape(content['insights.contextLink']);

  const cls = pctChange >= 0 ? 'context-callout--up' : 'context-callout--down';

  return `<div class="insights-context-callout ${cls}" role="status" aria-live="polite" data-reveal>
    <div class="context-callout-icon" aria-hidden="true">${pctChange >= 0 ? '📈' : '📉'}</div>
    <div class="context-callout-body">
      <p class="context-callout-text">${msg}</p>
      <a href="tracker.html" class="context-callout-link">${linkText}</a>
    </div>
  </div>`;
}

function renderFeed() {
  const grid = document.getElementById('insights-masonry-grid');
  const noResults = document.getElementById('insights-no-results');
  const resultMeta = document.getElementById('insights-results-meta');
  const resultCount = document.getElementById('insights-result-count');
  const noResultsMsg = document.getElementById('insights-no-results-msg');

  if (!grid) return;

  const filtered = getFilteredArticles();
  const content = CONTENT[STATE.lang] ?? CONTENT.en;

  // Update result count
  if (resultCount) {
    if (STATE.feedSearchQuery || STATE.activeCategory !== 'all') {
      resultCount.textContent = content['insights.resultCount']
        .replace('{count}', filtered.length)
        .replace('{total}', INSIGHTS_ARTICLES.length);
      if (resultMeta) resultMeta.hidden = false;
    } else {
      resultCount.textContent = '';
      if (resultMeta) resultMeta.hidden = true;
    }
  }

  // No results state
  if (filtered.length === 0) {
    if (noResults) {
      noResults.hidden = false;
      if (noResultsMsg) {
        noResultsMsg.textContent = content['insights.noResults'].replace(
          '{query}',
          STATE.feedSearchQuery
        );
      }
    }
    grid.innerHTML = '';
    return;
  }

  if (noResults) noResults.hidden = true;

  // Build cards with contextual callout at position 3
  const callout = buildContextCallout();
  let html = '';
  for (let i = 0; i < filtered.length; i++) {
    if (i === 2 && callout && STATE.activeCategory === 'all' && !STATE.feedSearchQuery) {
      html += callout;
    }
    html += buildCardHTML(filtered[i]);
  }

  // SAFETY: html is built from escape()-d config values + safeHref() validated
  // URLs via buildCardHTML() and buildContextCallout(). No user input reaches innerHTML.
  grid.innerHTML = html;

  // Trigger reveal animations on new cards
  const { observeReveal } = getRevealModule();
  if (observeReveal) observeReveal(grid);
}

// Lazy-load reveal to avoid circular deps
let _revealModule = null;
function getRevealModule() {
  if (_revealModule) return _revealModule;
  try {
    // reveal.js is already imported by page-enter; call observeReveal on the grid
    _revealModule = { observeReveal: null };
    import('../lib/reveal.js').then((mod) => {
      _revealModule.observeReveal = mod.observeReveal;
      // Observe any already-rendered cards
      const grid = document.getElementById('insights-masonry-grid');
      if (grid) mod.observeReveal(grid);
    });
  } catch {
    _revealModule = { observeReveal: null };
  }
  return _revealModule;
}

function initFeed() {
  // Render initial grid
  renderFeed();
  renderCategoryChips();

  // Category chip clicks
  const catStrip = document.getElementById('insights-categories');
  if (catStrip) {
    catStrip.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-category]');
      if (!btn) return;
      STATE.activeCategory = btn.dataset.category;
      renderCategoryChips();
      renderFeed();
    });
  }

  // Search input with debounce
  const searchInput = document.getElementById('insights-search');
  if (searchInput) {
    // Set placeholder in current language
    const content = CONTENT[STATE.lang] ?? CONTENT.en;
    searchInput.placeholder = content['insights.searchPlaceholder'];

    searchInput.addEventListener('input', () => {
      clearTimeout(_searchDebounce);
      _searchDebounce = setTimeout(() => {
        STATE.feedSearchQuery = searchInput.value;
        renderFeed();
      }, 200);
    });

    // Clear on Escape
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        searchInput.value = '';
        STATE.feedSearchQuery = '';
        renderFeed();
      }
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────────────────────

async function init() {
  cache.loadState(STATE);

  const urlLang = new URLSearchParams(location.search).get('lang');
  if (urlLang === 'ar' || urlLang === 'en') STATE.lang = urlLang;

  document.documentElement.lang = STATE.lang;
  document.documentElement.dir = STATE.lang === 'ar' ? 'rtl' : 'ltr';

  const shell = mountSharedShell({ lang: STATE.lang, depth: 0 });
  const navResult = shell.navCtrl;
  injectBreadcrumbs('insights');
  initPageEnter('#main-content');
  mountRelatedGuides({ lang: STATE.lang });

  navResult.getLangToggleButtons().forEach((btn) => {
    btn.addEventListener('click', () => {
      STATE.lang = STATE.lang === 'en' ? 'ar' : 'en';
      cache.savePreference('lang', STATE.lang);
      shell.updateLang(STATE.lang);
      applyLang(STATE.lang);
      renderCategoryChips();
      renderFeed();
      // Update search placeholder
      const searchInput = document.getElementById('insights-search');
      if (searchInput) {
        const content = CONTENT[STATE.lang] ?? CONTENT.en;
        searchInput.placeholder = content['insights.searchPlaceholder'];
      }
      // Refresh freshness label in new language
      if (STATE.goldPriceUsdPerOz > 0) {
        updatePriceBar(STATE.goldPriceUsdPerOz, STATE.status.goldStale);
      }
    });
  });

  applyLang(STATE.lang);

  // Initialize the insights feed (category filter, search, cards)
  initFeed();

  // Show cached price immediately, then fetch fresh
  if (STATE.goldPriceUsdPerOz > 0) {
    updatePriceBar(STATE.goldPriceUsdPerOz, STATE.status.goldStale);
    updateMarketPulse(STATE.goldPriceUsdPerOz);
  }

  // Fetch fresh price
  await fetchAndUpdatePriceBar();

  // Refresh every 90 seconds while page is visible
  let _refreshTimer = setInterval(fetchAndUpdatePriceBar, CONSTANTS.GOLD_REFRESH_MS);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      clearInterval(_refreshTimer);
      _refreshTimer = null;
    } else if (!_refreshTimer) {
      fetchAndUpdatePriceBar();
      _refreshTimer = setInterval(fetchAndUpdatePriceBar, CONSTANTS.GOLD_REFRESH_MS);
    }
  });
  window.addEventListener(
    'pagehide',
    () => {
      clearInterval(_refreshTimer);
      _refreshTimer = null;
    },
    { once: true }
  );
}

init();
