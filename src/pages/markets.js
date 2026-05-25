/**
 * Markets hub page entry point.
 * Renders a searchable/filterable grid of country gold-price pages.
 */
import { COUNTRIES, TRANSLATIONS } from '../config/index.js';
import { mountSharedShell } from '../components/site-shell.js';
import { injectBreadcrumbs } from '../components/breadcrumbs.js';
import { el, clear } from '../lib/safe-dom.js';
import { track, EVENTS } from '../lib/analytics.js';

// ── State ──
let lang = 'en';
let activeRegion = 'all';
let searchQuery = '';

function tx(key) {
  const fullKey = 'markets.' + key;
  return TRANSLATIONS[lang]?.[fullKey] ?? TRANSLATIONS.en?.[fullKey] ?? key;
}

function getFilteredCountries() {
  let countries = [...COUNTRIES];

  // Region filter
  if (activeRegion !== 'all') {
    countries = countries.filter((c) => c.group === activeRegion);
  }

  // Search filter
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    countries = countries.filter(
      (c) =>
        c.nameEn.toLowerCase().includes(q) ||
        c.nameAr.includes(q) ||
        c.code.toLowerCase().includes(q) ||
        c.currency.toLowerCase().includes(q)
    );
  }

  return countries;
}

function renderGrid() {
  const grid = document.getElementById('markets-grid');
  const empty = document.getElementById('markets-empty');
  if (!grid) return;

  const countries = getFilteredCountries();
  clear(grid);

  if (countries.length === 0) {
    if (empty) {
      empty.textContent = tx('searchEmpty');
      empty.hidden = false;
    }
    return;
  }

  if (empty) empty.hidden = true;

  for (const country of countries) {
    const href = country.slug ? `../../countries/${country.slug}/gold-price/` : null;
    const name = lang === 'ar' ? country.nameAr : country.nameEn;

    const card = el(href ? 'a' : 'div', {
      class: 'markets-card',
      ...(href ? { href } : {}),
    });

    const flag = el('span', { class: 'markets-card__flag' });
    flag.textContent = country.flag || '🏳️';

    const info = el('div', { class: 'markets-card__info' });
    const nameEl = el('span', { class: 'markets-card__name' });
    nameEl.textContent = name;
    const currEl = el('span', { class: 'markets-card__currency' });
    currEl.textContent = country.currency;
    info.appendChild(nameEl);
    info.appendChild(currEl);

    const arrow = el('span', { class: 'markets-card__arrow' });
    arrow.textContent = href ? '→' : '';

    card.appendChild(flag);
    card.appendChild(info);
    card.appendChild(arrow);
    grid.appendChild(card);
  }
}

function applyLang() {
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';

  // Apply translations
  const textMap = {
    'markets-hero-tag': tx('heroTag'),
    'markets-title': tx('title'),
    'markets-sub': tx('sub'),
    'markets-tab-all': tx('tabAll'),
    'markets-tab-gcc': tx('tabGcc'),
    'markets-tab-levant': tx('tabLevant'),
    'markets-tab-africa': tx('tabAfrica'),
    'markets-tab-global': tx('tabGlobal'),
    'markets-explainer-title': tx('explainerTitle'),
    'markets-explainer-body': tx('explainerBody'),
    'markets-disclaimer': tx('disclaimer'),
    'markets-method-link': tx('methodLink'),
    'markets-faq-title': tx('faqTitle'),
    'markets-faq1-q': tx('faq1Q'),
    'markets-faq1-a': tx('faq1A'),
    'markets-faq2-q': tx('faq2Q'),
    'markets-faq2-a': tx('faq2A'),
    'markets-faq3-q': tx('faq3Q'),
    'markets-faq3-a': tx('faq3A'),
  };

  for (const [id, text] of Object.entries(textMap)) {
    const target = document.getElementById(id);
    if (target) target.textContent = text;
  }

  // Update search placeholder
  const searchInput = document.getElementById('markets-search');
  if (searchInput) {
    searchInput.placeholder = tx('searchPlaceholder');
    searchInput.setAttribute('aria-label', tx('searchPlaceholder'));
  }

  renderGrid();
}

function initRegionTabs() {
  const tabs = document.querySelectorAll('.markets-region-tab');
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => {
        t.classList.remove('is-active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('is-active');
      tab.setAttribute('aria-selected', 'true');
      activeRegion = tab.dataset.region || 'all';
      renderGrid();
      track(EVENTS.COUNTRY_PAGE_VIEW, { action: 'market_filter', region: activeRegion });
    });
  });
}

function initSearch() {
  const input = document.getElementById('markets-search');
  if (!input) return;

  let debounceTimer;
  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      searchQuery = input.value.trim();
      renderGrid();
      if (searchQuery) {
        track(EVENTS.COUNTRY_PAGE_VIEW, { action: 'market_search', query: searchQuery });
      }
    }, 200);
  });
}

function init() {
  // Load saved language preference
  try {
    const prefs = JSON.parse(localStorage.getItem('user_prefs') || '{}');
    if (prefs.lang === 'ar' || prefs.lang === 'en') lang = prefs.lang;
  } catch {
    /* ignore */
  }

  const urlLang = new URLSearchParams(location.search).get('lang');
  if (urlLang === 'ar' || urlLang === 'en') lang = urlLang;

  const shell = mountSharedShell({ lang, depth: 2 });
  injectBreadcrumbs('markets');

  shell.navCtrl.getLangToggleButtons().forEach((btn) => {
    btn.addEventListener('click', () => {
      lang = lang === 'en' ? 'ar' : 'en';
      try {
        const prefs = JSON.parse(localStorage.getItem('user_prefs') || '{}');
        prefs.lang = lang;
        localStorage.setItem('user_prefs', JSON.stringify(prefs));
      } catch {
        /* ignore */
      }
      shell.updateLang(lang);
      applyLang();
    });
  });

  initRegionTabs();
  initSearch();
  applyLang();

  track(EVENTS.COUNTRY_PAGE_VIEW, { action: 'markets_hub_view' });
}

init();
