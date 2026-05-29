/**
 * Shared JS for all country gold price pages.
 * Each country page calls: initCountryPage(CONFIG)
 *
 * CONFIG shape:
 * {
 *   countryCode: 'AE',
 *   currency: 'AED',
 *   flag: '🇦🇪',
 *   nameEn: 'United Arab Emirates',
 *   nameAr: 'الإمارات العربية المتحدة',
 *   fixedPeg: true,          // AED only
 *   decimals: 2,
 *   timezone: 'Asia/Dubai',
 *   relatedCountries: [      // links at bottom
 *     // Use page-relative URLs (city pages: '../../uae.html', country pages: 'uae.html')
 *     { file: 'saudi-arabia.html', nameEn: 'Saudi Arabia', nameAr: 'السعودية', flag: '🇸🇦' },
 *     ...
 *   ],
 *   faqEn: [ { q, a }, ... ],
 *   faqAr: [ { q, a }, ... ],
 * }
 */

import { CONSTANTS, KARATS } from '../src/config/index.js';
import * as api from '../src/lib/api.js';
import * as cache from '../src/lib/cache.js';
import { usdPerGram, usdPerOz } from '../src/lib/price-calculator.js';
import { formatPrice } from '../src/lib/formatter.js';
import { injectNav, updateNavLang } from '../src/components/nav.js';
import { injectFooter } from '../src/components/footer.js';
import { injectTicker, updateTicker, updateTickerLang } from '../src/components/ticker.js';
import { renderBreadcrumbs } from '../src/components/breadcrumbs.js';

// Minimal shared STATE for country pages
const STATE = {
  lang: 'en',
  goldPriceUsdPerOz: 0,
  rates: {},
  freshness: { goldUpdatedAt: null },
  status: { goldStale: false, fxStale: false },
  fxMeta: { nextUpdateUtc: 0 },
  dayOpenGoldPriceUsdPerOz: 0,
  selectedKaratSpotlight: '22',
  selectedKaratCountries: '22',
  selectedUnitTable: 'gram',
  favorites: [],
  history: [],
  activeTab: 'gcc',
  sortOrder: 'default',
  searchQuery: '',
};

const T = {
  en: {
    livePrice: 'Live Gold Price',
    perGram: 'per gram',
    perOz: 'per troy oz',
    karat24: '24K (Pure)',
    karat22: '22K',
    karat21: '21K',
    karat18: '18K',
    karatTitle: 'Gold Karat Prices',
    karatSub:
      'All prices are spot-linked reference estimates. Trust labels: Live, Delayed, Cached/Fallback, Estimated, Historical baseline.',
    usdEquiv: 'USD Equivalent',
    change: 'Change',
    from: "from today's open",
    stale: 'Stale data',
    fixedPeg: 'Fixed Peg',
    faq: 'Frequently Asked Questions',
    related: 'Related Countries',
    disclaimer:
      'Spot-linked reference estimates only — not final retail jewelry quotes. Retail prices may include making charges, dealer margins, and local taxes.',
    lastUpdate: 'Freshness',
    gram: 'gram',
    oz: 'troy oz',
    switchLang: 'العربية',
  },
  ar: {
    livePrice: 'سعر الذهب المباشر',
    perGram: 'للغرام',
    perOz: 'للأوقية',
    karat24: 'عيار 24 (خالص)',
    karat22: 'عيار 22',
    karat21: 'عيار 21',
    karat18: 'عيار 18',
    karatTitle: 'أسعار عيارات الذهب',
    karatSub:
      'جميع الأسعار تقديرات مرجعية مرتبطة بالسعر الفوري. تسميات الثقة: مباشر، متأخر، مخزن/احتياطي، تقديري، وخط أساس تاريخي.',
    usdEquiv: 'ما يعادله بالدولار',
    change: 'التغيير',
    from: 'من سعر فتح اليوم',
    stale: 'بيانات قديمة',
    fixedPeg: 'ربط ثابت',
    faq: 'الأسئلة الشائعة',
    related: 'دول أخرى',
    disclaimer:
      'هذه الأسعار تقديرات مرجعية مرتبطة بالسعر الفوري وليست أسعار تجزئة نهائية للمجوهرات. قد تتضمن أسعار التجزئة رسوم مصنعية وهوامش وضرائب محلية.',
    lastUpdate: 'حداثة البيانات',
    gram: 'غرام',
    oz: 'أوقية',
    switchLang: 'English',
  },
};

function t(key) {
  return T[STATE.lang]?.[key] ?? T.en[key] ?? key;
}

function getRate(cfg) {
  if (cfg.currency === 'AED') return CONSTANTS.AED_PEG;
  return STATE.rates[cfg.currency] ?? null;
}

function calcChange(price) {
  if (!STATE.dayOpenGoldPriceUsdPerOz || !price) return null;
  return ((price - STATE.dayOpenGoldPriceUsdPerOz) / STATE.dayOpenGoldPriceUsdPerOz) * 100;
}

// ── Render hero price block ──────────────────────────────────────────────────
function renderHero(cfg) {
  const rate = getRate(cfg);
  const karat22 = KARATS.find((k) => k.code === '22');
  const karat24 = KARATS.find((k) => k.code === '24');

  const gram22 = rate ? usdPerGram(STATE.goldPriceUsdPerOz, karat22.purity) * rate : null;
  const gram24 = rate ? usdPerGram(STATE.goldPriceUsdPerOz, karat24.purity) * rate : null;
  const oz24usd = STATE.goldPriceUsdPerOz
    ? usdPerOz(STATE.goldPriceUsdPerOz, karat24.purity)
    : null;

  const changeVal = calcChange(STATE.goldPriceUsdPerOz);
  const changeSign = changeVal !== null ? (changeVal >= 0 ? '+' : '') : '';
  const changeClass = changeVal !== null ? (changeVal >= 0 ? 'badge-up' : 'badge-down') : '';
  const staleClass = STATE.status.goldStale ? ' stale' : '';
  const staleHtml = STATE.status.goldStale
    ? `<span class="cp-stale-badge">${t('stale')}</span>`
    : '';
  const pegHtml = cfg.fixedPeg ? `<span class="cp-peg-badge">${t('fixedPeg')}</span>` : '';

  const heroEl = document.getElementById('cp-hero-price');
  if (!heroEl) return;

  heroEl.innerHTML = `
    <div class="cp-hero-main${staleClass}">
      <div class="cp-hero-row">
        <span class="cp-hero-flag">${cfg.flag}</span>
        <div class="cp-hero-labels">
          <h1 class="cp-hero-title">${t('livePrice')} — ${STATE.lang === 'ar' ? cfg.nameAr : cfg.nameEn}</h1>
          <div class="cp-hero-badges">${staleHtml}${pegHtml}</div>
        </div>
      </div>
      <div class="cp-prices-row">
        <div class="cp-price-card">
          <div class="cp-price-label">${t('karat22')} · ${t('perGram')}</div>
          <div class="cp-price-value">${gram22 ? formatPrice(gram22, cfg.currency, cfg.decimals) : '—'}</div>
        </div>
        <div class="cp-price-card">
          <div class="cp-price-label">${t('karat24')} · ${t('perGram')}</div>
          <div class="cp-price-value">${gram24 ? formatPrice(gram24, cfg.currency, cfg.decimals) : '—'}</div>
        </div>
        <div class="cp-price-card">
          <div class="cp-price-label">${t('karat24')} · ${t('perOz')}</div>
          <div class="cp-price-value">${oz24usd ? formatPrice(oz24usd, 'USD', 2) : '—'}</div>
        </div>
      </div>
      ${
        changeVal !== null
          ? `
      <div class="cp-change-row">
        <span class="badge ${changeClass}">${changeSign}${changeVal.toFixed(2)}%</span>
        <span class="cp-change-label">${t('from')}</span>
      </div>`
          : ''
      }
      <div class="cp-update-time">${t('lastUpdate')}: ${STATE.status.goldStale ? 'Cached/Fallback' : 'Live'} · ${STATE.freshness.goldUpdatedAt ? new Date(STATE.freshness.goldUpdatedAt).toLocaleString(STATE.lang === 'ar' ? 'ar-AE' : 'en-AE', { timeZone: cfg.timezone, hour12: true, year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'} · Source: goldpricez.com</div>
    </div>`;
}

// ── Render karat table ───────────────────────────────────────────────────────
function renderKaratTable(cfg) {
  const rate = getRate(cfg);
  const el = document.getElementById('cp-karat-table');
  if (!el) return;

  const showKarats = ['24', '22', '21', '18'];
  const rows = showKarats
    .map((code) => {
      const karat = KARATS.find((k) => k.code === code);
      if (!karat) return '';

      const gramLocal = rate ? usdPerGram(STATE.goldPriceUsdPerOz, karat.purity) * rate : null;
      const ozLocal = rate ? usdPerOz(STATE.goldPriceUsdPerOz, karat.purity) * rate : null;
      const gramUsd = STATE.goldPriceUsdPerOz
        ? usdPerGram(STATE.goldPriceUsdPerOz, karat.purity)
        : null;

      const labelKey = `karat${code}`;
      const label = T[STATE.lang]?.[labelKey] ?? `${code}K`;
      const pct = Math.round(karat.purity * 100);

      return `
      <tr>
        <td class="cp-karat-name"><strong>${label}</strong><span class="cp-karat-pct">${pct}%</span></td>
        <td class="cp-price-cell">${gramLocal ? formatPrice(gramLocal, cfg.currency, cfg.decimals) : '—'}</td>
        <td class="cp-price-cell">${ozLocal ? formatPrice(ozLocal, cfg.currency, cfg.decimals) : '—'}</td>
        <td class="cp-price-cell cp-usd-col">${gramUsd ? formatPrice(gramUsd, 'USD', 2) : '—'}</td>
      </tr>`;
    })
    .join('');

  const tsLabel = STATE.freshness?.goldUpdatedAt
    ? ` · ${new Date(STATE.freshness.goldUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    : '';
  const countryName = STATE.lang === 'ar' ? cfg.nameAr || cfg.nameEn : cfg.nameEn;
  const tableAriaLabel =
    STATE.lang === 'ar'
      ? `جدول أسعار الذهب — ${countryName}`
      : `Gold price table — ${countryName}${tsLabel}`;

  el.innerHTML = `
    <div class="cp-table-header">
      <h2>${t('karatTitle')}</h2>
      <p class="cp-table-sub">${t('karatSub')}</p>
    </div>
    <div class="cp-table-scroll">
      <table class="cp-table" aria-label="${tableAriaLabel}" role="table">
        <caption class="cp-table-caption visually-hidden">${tableAriaLabel}</caption>
        <thead>
          <tr>
            <th scope="col">${STATE.lang === 'ar' ? 'العيار' : 'Karat'}</th>
            <th scope="col">${STATE.lang === 'ar' ? 'سعر الغرام' : 'Per Gram'} (${cfg.currency})</th>
            <th scope="col">${STATE.lang === 'ar' ? 'سعر الأوقية' : 'Per Troy Oz'} (${cfg.currency})</th>
            <th scope="col" class="cp-usd-col">${t('usdEquiv')} / gram</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <p class="cp-disclaimer">${t('disclaimer')}</p>`;
}

function normalizeRelatedCountryUrl(file) {
  if (typeof file !== 'string') return '#';
  const trimmed = file.trim();
  if (!trimmed) return '#';
  if (/^(?:https?:|mailto:|tel:|#)/i.test(trimmed)) return trimmed;

  // Guard for legacy configs that used ../countries/... or ../../countries/... from city pages.
  const normalizedRelative = trimmed
    .replace(/^\.\.\/\.\.\/countries\//, '../../')
    .replace(/^\.\.\/countries\//, '../');

  try {
    const resolved = new URL(normalizedRelative, window.location.href);
    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return normalizedRelative;
  }
}

// ── Render related cities ────────────────────────────────────────────────────
function renderRelatedCities(cfg) {
  const cities = cfg.cities;
  if (!cities?.length) return;
  const el = document.getElementById('cp-related-cities');
  if (!el) return;

  const cards = cities
    .map(
      (city) => `
    <a href="../${city.slug}/gold-rate/" class="cp-related-card">
      <span class="cp-related-name">Gold price in ${city.nameEn}</span>
    </a>`
    )
    .join('');

  el.innerHTML = `
    <h2>${STATE.lang === 'ar' ? 'المدن' : 'Related Cities'}</h2>
    <div class="cp-related-grid">${cards}</div>`;
}

// ── Render related countries ─────────────────────────────────────────────────
function renderRelated(cfg) {
  const el = document.getElementById('cp-related');
  if (!el || !cfg.relatedCountries?.length) return;

  const cards = cfg.relatedCountries
    .map(
      (c) => `
    <a href="${normalizeRelatedCountryUrl(c.file)}" class="cp-related-card">
      <span class="cp-related-flag">${c.flag}</span>
      <span class="cp-related-name">${STATE.lang === 'ar' ? c.nameAr : c.nameEn}</span>
    </a>`
    )
    .join('');

  el.innerHTML = `
    <h2>${t('related')}</h2>
    <div class="cp-related-grid">${cards}</div>`;
}

// ── FAQ JSON-LD schema injection ─────────────────────────────────────────────
function injectFaqSchema(faqEn) {
  if (!faqEn?.length) return;
  const existing = document.getElementById('faq-schema-ld');
  if (existing) existing.remove();
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqEn.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  };
  const script = document.createElement('script');
  script.id = 'faq-schema-ld';
  script.type = 'application/ld+json';
  script.textContent = JSON.stringify(schema);
  document.head.appendChild(script);
}

// ── Render FAQ ───────────────────────────────────────────────────────────────
function renderFaq(cfg) {
  const el = document.getElementById('cp-faq');
  if (!el) return;

  const faqList = STATE.lang === 'ar' ? cfg.faqAr : cfg.faqEn;
  if (!faqList?.length) return;

  injectFaqSchema(cfg.faqEn);

  el.innerHTML = `
    <h2>${t('faq')}</h2>
    <div itemscope itemtype="https://schema.org/FAQPage">
      ${faqList
        .map(
          (item, i) => `
        <details class="faq-item" ${i === 0 ? 'open' : ''} itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
          <summary class="faq-question" itemprop="name">${item.q}</summary>
          <div class="faq-answer" itemprop="acceptedAnswer" itemscope itemtype="https://schema.org/Answer">
            <p itemprop="text">${item.a}</p>
          </div>
        </details>`
        )
        .join('')}
    </div>`;
}

// ── Full render ──────────────────────────────────────────────────────────────
function renderAll(cfg) {
  renderHero(cfg);
  renderKaratTable(cfg);
  renderRelated(cfg);
  renderRelatedCities(cfg);
  renderFaq(cfg);
  document.documentElement.lang = STATE.lang;
  document.documentElement.dir = STATE.lang === 'ar' ? 'rtl' : 'ltr';
}

// ── Live data fetch ──────────────────────────────────────────────────────────
async function fetchLiveData(cfg) {
  try {
    const [goldData, fxData] = await Promise.allSettled([api.fetchGold(), api.fetchFX()]);

    if (goldData.status === 'fulfilled') {
      STATE.goldPriceUsdPerOz = goldData.value.price;
      STATE.freshness.goldUpdatedAt = goldData.value.updatedAt;
      cache.saveGoldPrice(goldData.value.price, goldData.value.updatedAt);
    }

    if (fxData.status === 'fulfilled') {
      const rates = fxData.value.rates;
      rates.AED = undefined;
      STATE.rates = rates;
      cache.saveFXRates(rates, {
        lastUpdateUtc: fxData.value.time_last_update_utc,
        nextUpdateUtc: fxData.value.time_next_update_utc,
      });
    }

    renderAll(cfg);
    // Update bottom ticker with latest UAE prices
    if (STATE.goldPriceUsdPerOz) {
      const AED_PEG = 3.6725;
      const TROY = 31.1035;
      const p = STATE.goldPriceUsdPerOz;
      updateTicker({
        xauUsd: p,
        uae24k: ((p * 1) / TROY) * AED_PEG,
        uae22k: ((p * 22) / 24 / TROY) * AED_PEG,
        uae21k: ((p * 21) / 24 / TROY) * AED_PEG,
        uae18k: ((p * 18) / 24 / TROY) * AED_PEG,
        updatedAt: STATE.freshness?.goldUpdatedAt || null,
        hasLiveFailure: Boolean(STATE.status?.goldStale),
      });
    }
  } catch (e) {
    console.warn('Country page fetch error:', e);
  }
}

// ── Init ─────────────────────────────────────────────────────────────────────
export async function initCountryPage(cfg) {
  // Load user prefs + cache
  cache.loadState(STATE);

  // Language from URL param or cached pref
  const urlLang = new URLSearchParams(location.search).get('lang');
  if (urlLang === 'ar' || urlLang === 'en') STATE.lang = urlLang;

  const isAr = STATE.lang === 'ar';
  document.documentElement.lang = STATE.lang;
  document.documentElement.dir = isAr ? 'rtl' : 'ltr';

  // navDepth: 2 for /countries/{code}/ pages, 3 for /countries/{code}/cities/ and /countries/{code}/markets/
  const navDepth = cfg.navDepth ?? 2;
  const homeUrl = '../'.repeat(navDepth);

  const navResult = injectNav(STATE.lang, navDepth);

  // Inject breadcrumbs
  const countryName = STATE.lang === 'ar' ? cfg.nameAr : cfg.nameEn;
  const breadcrumbContainer = document.querySelector('.page-breadcrumbs');
  if (breadcrumbContainer) {
    const crumbs = [{ label: 'Home', url: homeUrl }];
    if (cfg.breadcrumbParent) crumbs.push(cfg.breadcrumbParent);
    crumbs.push({ label: countryName, url: '#' });
    renderBreadcrumbs(breadcrumbContainer, crumbs);
  }
  injectFooter(STATE.lang, navDepth);
  injectTicker(STATE.lang, navDepth);

  // Wire language toggle
  navResult.getLangToggleButtons().forEach((btn) => {
    btn.addEventListener('click', () => {
      STATE.lang = STATE.lang === 'en' ? 'ar' : 'en';
      cache.savePreference('lang', STATE.lang);
      document.documentElement.lang = STATE.lang;
      document.documentElement.dir = STATE.lang === 'ar' ? 'rtl' : 'ltr';
      updateNavLang(STATE.lang);
      updateTickerLang(STATE.lang);
      renderAll(cfg);
    });
  });

  // Render from cache immediately
  renderAll(cfg);

  // Then fetch live data
  await fetchLiveData(cfg);

  // Auto-refresh
  setInterval(() => fetchLiveData(cfg), CONSTANTS.GOLD_REFRESH_MS);
}
