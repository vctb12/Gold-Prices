/**
 * Insights page entry point.
 * Handles nav injection, language toggle, live mini price bar, and bilingual content.
 */

import * as cache from '../lib/cache.js';
import * as api from '../lib/api.js';
import { mountSharedShell } from '../components/site-shell.js';
import { injectBreadcrumbs } from '../components/breadcrumbs.js';
import { CONSTANTS } from '../config/index.js';
import { getBaselineHistory, getHistoryStats, getUnifiedHistory } from '../lib/historical-data.js';
import { initPageEnter } from '../lib/page-enter.js';
import { countUp } from '../lib/count-up.js';
import { mountRelatedGuides } from '../components/RelatedGuides.js';
import { initInsightsFeed } from './insights/insights-feed.js';

let feedCtrl = null;

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

function deriveWeekAgoPrice() {
  const target = new Date();
  target.setUTCDate(target.getUTCDate() - 7);
  const targetKey = target.toISOString().slice(0, 10); // YYYY-MM-DD
  const records = getUnifiedHistory(STATE.history || []);
  let best = 0;
  for (const r of records) {
    // Records may be 'YYYY-MM' (monthly) or 'YYYY-MM-DD' (daily); compare lexically.
    if (r.date <= targetKey && Number.isFinite(r.price)) best = r.price;
  }
  return best;
}

function pushFeedPrices() {
  if (!feedCtrl) return;
  feedCtrl.setPrices({
    current: STATE.goldPriceUsdPerOz,
    weekAgo: deriveWeekAgoPrice(),
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

  pushFeedPrices();

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
      if (feedCtrl) feedCtrl.setLang(STATE.lang);
      // Refresh freshness label in new language
      if (STATE.goldPriceUsdPerOz > 0) {
        updatePriceBar(STATE.goldPriceUsdPerOz, STATE.status.goldStale);
      }
    });
  });

  applyLang(STATE.lang);

  // Mount the filterable / searchable insights feed.
  feedCtrl = initInsightsFeed(STATE.lang);
  pushFeedPrices();
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
      if (feedCtrl) feedCtrl.destroy();
    },
    { once: true }
  );
}

init();
