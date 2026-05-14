/**
 * Shared hydration script for generated country / city / karat pages.
 * - Country gold-price pages get the Phase 6 production-grade country experience.
 * - Other legacy generated pages keep the lightweight existing hydration flow.
 */
import { BASE_PATH, CONSTANTS, TRANSLATIONS } from '../config/index.js';
import { COUNTRIES } from '../config/countries.js';
import { KARATS } from '../config/karats.js';
import * as api from './api.js';
import * as cache from './cache.js';
import { formatPrice } from './formatter.js';
import { getFXFreshness, getLiveFreshness } from './live-status.js';
import { injectNav } from '../components/nav.js';
import { injectFooter } from '../components/footer.js';
import { injectSpotBar, updateSpotBar, updateSpotBarLang } from '../components/spotBar.js';
import { injectBreadcrumbs } from '../components/breadcrumbs.js';
import { el, safeHref, clear, setText } from './safe-dom.js';
import { track, EVENTS } from './analytics.js';

const _modUrl = new URL(import.meta.url);
const _pageUrl = new URL(location.href);
const _rootPath = _modUrl.pathname.replace(/\/src\/lib\/page-hydrator\.js$/, '/');
const _relPath = _pageUrl.pathname.slice(_rootPath.length).replace(/[^/]+$/, '');
const depth = _relPath ? _relPath.split('/').filter(Boolean).length : 0;

const AED_PEG = CONSTANTS.AED_PEG;
const TROY_OZ_GRAMS = CONSTANTS.TROY_OZ_GRAMS;
const DEFAULT_COUNTRY_KARATS = ['24', '22', '21', '18', '14'];
const MARKET_LABELS = {
  gcc: { en: 'GCC reference market', ar: 'مرجع أسواق الخليج' },
  levant: { en: 'Arab market reference', ar: 'مرجع الأسواق العربية' },
  africa: { en: 'North Africa reference market', ar: 'مرجع أسواق شمال أفريقيا' },
  global: { en: 'Global reference market', ar: 'مرجع الأسواق العالمية' },
};
const CURRENCY_SYMBOLS = {
  USD: '$',
  AED: 'د.إ',
  SAR: 'ر.س',
  KWD: 'د.ك',
  QAR: 'ر.ق',
  BHD: '.د.ب',
  OMR: 'ر.ع',
  JOD: 'د.أ',
  LBP: 'ل.ل',
  SYP: 'ل.س',
  ILS: '₪',
  EGP: 'ج.م',
  LYD: 'د.ل',
  TND: 'د.ت',
  DZD: 'دج',
  MAD: 'د.م',
  SDG: 'ج.س',
  INR: '₹',
  IQD: 'ع.د',
  YER: 'ر.ي',
  TRY: '₺',
  PKR: '₨',
};

function withBase(path = '') {
  const trimmed = String(path || '').replace(/^\//, '');
  return `${BASE_PATH}${trimmed}`;
}

function getLang() {
  try {
    const prefs = JSON.parse(localStorage.getItem(CONSTANTS.CACHE_KEYS.userPrefs) || '{}');
    const urlLang = new URLSearchParams(location.search).get('lang');
    return urlLang === 'ar' || urlLang === 'en' ? urlLang : prefs.lang || 'en';
  } catch {
    return 'en';
  }
}

function persistLang(lang) {
  try {
    const key = CONSTANTS.CACHE_KEYS.userPrefs;
    const prefs = JSON.parse(localStorage.getItem(key) || '{}');
    prefs.lang = lang;
    localStorage.setItem(key, JSON.stringify(prefs));
  } catch {
    // ignore storage failures
  }
}

function tx(lang, key, params = {}) {
  const fullKey = `country.${key}`;
  const template = TRANSLATIONS[lang]?.[fullKey] ?? TRANSLATIONS.en?.[fullKey] ?? fullKey;
  return Object.entries(params).reduce(
    (text, [token, value]) => text.replaceAll(`{${token}}`, String(value)),
    template
  );
}

function getCountryName(country, lang) {
  return lang === 'ar' ? country.nameAr || country.nameEn : country.nameEn;
}

function getMarketLabel(country, lang) {
  return MARKET_LABELS[country.group]?.[lang] || MARKET_LABELS.global[lang];
}

function getRouteContext() {
  const clean = location.pathname.replace(/^\/+|\/+$/g, '');
  const parts = clean.split('/').filter(Boolean);
  const baseOffset = parts[0] === 'countries' ? 1 : 0;
  const countrySlug = parts[baseOffset] || null;
  const second = parts[baseOffset + 1] || null;
  const third = parts[baseOffset + 2] || null;
  const fourth = parts[baseOffset + 3] || null;

  if (second === 'gold-price') {
    return { pageKind: 'country-price', countrySlug, citySlug: null, karatSlug: null };
  }
  if (third === 'gold-prices' || third === 'gold-shops') {
    return { pageKind: 'legacy', countrySlug, citySlug: second, karatSlug: null };
  }
  if (third === 'gold-rate') {
    return { pageKind: 'legacy', countrySlug, citySlug: second, karatSlug: fourth };
  }
  return { pageKind: 'legacy', countrySlug, citySlug: second, karatSlug: fourth };
}

function getCountryPageData() {
  const script = document.getElementById('country-page-data');
  if (!script?.textContent) return null;
  try {
    return JSON.parse(script.textContent);
  } catch {
    return null;
  }
}

function calcLocalPrice(spotUsdPerOz, purity, fxRate, unit = 'gram') {
  const usdPerGram = (spotUsdPerOz / TROY_OZ_GRAMS) * purity;
  const localPerGram = usdPerGram * fxRate;
  if (unit === 'oz') return spotUsdPerOz * purity * fxRate;
  return localPerGram;
}

async function fetchPrices() {
  try {
    const [goldRes, fxRes] = await Promise.allSettled([api.fetchGold(), api.fetchFX()]);
    const gold =
      goldRes.status === 'fulfilled'
        ? goldRes.value
        : (() => {
            const fallback = cache.getFallbackGoldPrice();
            return fallback
              ? { price: fallback.price, updatedAt: fallback.updatedAt, source: 'cache-fallback' }
              : null;
          })();

    const fx =
      fxRes.status === 'fulfilled'
        ? fxRes.value
        : cache.getFXRates?.()
          ? { ...cache.getFXRates(), source: 'cache-fallback' }
          : { rates: {}, source: 'unavailable' };

    return { gold, fx };
  } catch {
    const fallback = cache.getFallbackGoldPrice();
    return {
      gold: fallback
        ? { price: fallback.price, updatedAt: fallback.updatedAt, source: 'cache-fallback' }
        : null,
      fx: { rates: {}, source: 'unavailable' },
    };
  }
}

function freshnessTone(key) {
  if (key === 'live') return 'live';
  if (key === 'cached') return 'cached';
  if (key === 'stale') return 'stale';
  return 'unavailable';
}

function freshnessLabel(lang, key) {
  return tx(lang, `freshness.${key}`);
}

function getCountryFxRate(country, fx) {
  if (country.currency === 'AED') return AED_PEG;
  return fx?.rates?.[country.currency] ?? null;
}

function buildTrackerHref({ currency, karat = '24', lang = 'en', range = '30D' }) {
  const params = new URLSearchParams({
    mode: 'live',
    cur: currency,
    k: String(karat),
    u: 'gram',
    r: range,
    lang,
  });
  return withBase(`tracker.html#${params.toString()}`);
}

function buildCalculatorHref({ country, currency, karat = '24', lang = 'en' }) {
  const params = new URLSearchParams({
    country: country.slug,
    currency,
    karat: String(karat),
    lang,
  });
  return withBase(`calculator.html?${params.toString()}`);
}

function buildShopsHref(country) {
  return withBase(`shops.html?country=${encodeURIComponent(country.code)}`);
}

function getFeaturedKarats(countryData) {
  const fromData = Array.isArray(countryData?.defaultKarats) ? countryData.defaultKarats : null;
  return (fromData && fromData.length ? fromData : DEFAULT_COUNTRY_KARATS)
    .map((code) => KARATS.find((karat) => karat.code === code))
    .filter(Boolean);
}

function wireLangToggles(navCtrl, lang) {
  if (!navCtrl?.getLangToggleButtons) return;
  navCtrl.getLangToggleButtons().forEach((button) => {
    button.addEventListener('click', () => {
      const nextLang = lang === 'ar' ? 'en' : 'ar';
      track(EVENTS.LANGUAGE_SWITCH, { from: lang, to: nextLang, surface: 'country_page' });
      persistLang(nextLang);
      const url = new URL(window.location.href);
      if (nextLang === 'en') url.searchParams.delete('lang');
      else url.searchParams.set('lang', nextLang);
      window.location.assign(url.toString());
    });
  });
}

function renderCountryHero({ country, pageData, lang, gold, goldFreshness, fxFreshness, rate }) {
  setText(document.getElementById('country-page-kicker'), tx(lang, 'referenceKicker'));
  setText(
    document.getElementById('country-page-eyebrow'),
    tx(lang, 'referenceEyebrow', {
      currency: `${country.currency} ${CURRENCY_SYMBOLS[country.currency] || ''}`.trim(),
      market: getMarketLabel(country, lang),
    })
  );
  setText(
    document.getElementById('country-page-title'),
    tx(lang, 'heroTitle', { country: getCountryName(country, lang) })
  );
  setText(
    document.getElementById('country-page-copy'),
    tx(lang, 'heroCopy', {
      country: getCountryName(country, lang),
      currency: country.currency,
    })
  );
  setText(document.getElementById('country-page-trust'), tx(lang, 'heroTrust'));

  const statusList = document.getElementById('country-status-list');
  if (statusList) {
    clear(statusList);
    const statusItems = [
      {
        label: tx(lang, 'statusGold'),
        value: freshnessLabel(lang, goldFreshness.key),
        meta:
          goldFreshness.key === 'unavailable'
            ? tx(lang, 'statusUnavailable')
            : `${goldFreshness.ageText} · ${goldFreshness.timeText}`,
        tone: freshnessTone(goldFreshness.key),
      },
      {
        label: tx(lang, 'statusFx'),
        value:
          country.currency === 'AED'
            ? tx(lang, 'freshness.fixed')
            : freshnessLabel(lang, fxFreshness.key),
        meta:
          country.currency === 'AED'
            ? tx(lang, 'trustPeg')
            : fxFreshness.key === 'unavailable'
              ? tx(lang, 'statusUnavailable')
              : `${fxFreshness.ageText} · ${fxFreshness.timeText}`,
        tone: country.currency === 'AED' ? 'fixed' : freshnessTone(fxFreshness.key),
      },
      {
        label: tx(lang, 'statusSource'),
        value: gold ? 'goldpricez.com' : tx(lang, 'statusUnavailable'),
        meta:
          country.currency === 'AED'
            ? 'goldpricez.com · UAE peg'
            : 'goldpricez.com · open.er-api.com',
        tone: gold ? 'info' : 'unavailable',
      },
    ];
    statusItems.forEach((item) => {
      statusList.append(
        el('article', { class: 'country-status-card', dataset: { tone: item.tone } }, [
          el('p', { class: 'country-status-card__label' }, item.label),
          el('p', { class: 'country-status-card__value' }, item.value),
          el('p', { class: 'country-status-card__meta' }, item.meta),
        ])
      );
    });
  }

  const heroMetrics = document.getElementById('country-hero-metrics');
  if (heroMetrics) {
    clear(heroMetrics);
    const featured = getFeaturedKarats(pageData).slice(0, 3);
    featured.forEach((karat) => {
      const localPerGram = rate
        ? calcLocalPrice(gold?.price || 0, karat.purity, rate, 'gram')
        : null;
      heroMetrics.append(
        el(
          'article',
          { class: 'country-price-card', dataset: { tone: freshnessTone(goldFreshness.key) } },
          [
            el(
              'p',
              { class: 'country-price-card__label' },
              `${karat.code}K · ${tx(lang, 'cardPerGram')}`
            ),
            el(
              'p',
              { class: 'country-price-card__value', 'aria-live': 'polite' },
              localPerGram ? formatPrice(localPerGram, country.currency, country.decimals) : '—'
            ),
            el(
              'p',
              { class: 'country-price-card__meta' },
              tx(lang, 'cardPurity', { purity: Math.round(karat.purity * 100) })
            ),
          ]
        )
      );
    });
  }

  const actions = document.getElementById('country-actions');
  setText(document.getElementById('country-actions-title'), tx(lang, 'actionsTitle'));
  if (actions) {
    clear(actions);
    const focusKarat =
      getFeaturedKarats(pageData).find((karat) => karat.code === '22')?.code ||
      getFeaturedKarats(pageData)[0]?.code ||
      '24';
    const compareHref =
      country.group === 'gcc'
        ? withBase('content/gcc-gold-price-comparison/')
        : withBase('content/compare-countries/');
    const actionItems = [
      {
        href: buildTrackerHref({ currency: country.currency, karat: focusKarat, lang }),
        title: tx(lang, 'actionTrackerTitle'),
        desc: tx(lang, 'actionTrackerDesc', { currency: country.currency, karat: focusKarat }),
      },
      {
        href: buildCalculatorHref({ country, currency: country.currency, karat: focusKarat, lang }),
        title: tx(lang, 'actionCalculatorTitle'),
        desc: tx(lang, 'actionCalculatorDesc', { currency: country.currency, karat: focusKarat }),
      },
      {
        href: compareHref,
        title: tx(lang, 'actionCompareTitle'),
        desc: tx(lang, 'actionCompareDesc'),
      },
      {
        href: buildTrackerHref({ currency: country.currency, karat: '24', lang, range: '1Y' }),
        title: tx(lang, 'actionHistoryTitle'),
        desc: tx(lang, 'actionHistoryDesc'),
      },
      {
        href: withBase('methodology.html#country-reference-pages'),
        title: tx(lang, 'actionMethodTitle'),
        desc: tx(lang, 'actionMethodDesc'),
      },
    ];
    actionItems.forEach((item) => {
      actions.append(
        el('a', { class: 'country-action-card', href: safeHref(item.href) }, [
          el('span', { class: 'country-action-card__title' }, item.title),
          el('span', { class: 'country-action-card__desc' }, item.desc),
        ])
      );
    });
  }
}

function renderCountryKaratCards({ country, pageData, lang, gold, rate, goldFreshness }) {
  setText(document.getElementById('country-cards-title'), tx(lang, 'cardsTitle'));
  setText(
    document.getElementById('country-cards-copy'),
    tx(lang, 'cardsSub', { currency: country.currency })
  );
  setText(document.getElementById('country-table-title'), tx(lang, 'tableTitle'));
  setText(document.getElementById('country-table-copy'), tx(lang, 'tableSub'));

  const cardsRoot = document.getElementById('country-karat-cards');
  if (cardsRoot) {
    clear(cardsRoot);
    getFeaturedKarats(pageData).forEach((karat) => {
      const localPerGram =
        rate && gold?.price ? calcLocalPrice(gold.price, karat.purity, rate, 'gram') : null;
      const localPerOz =
        rate && gold?.price ? calcLocalPrice(gold.price, karat.purity, rate, 'oz') : null;
      cardsRoot.append(
        el(
          'article',
          { class: 'country-karat-card', dataset: { tone: freshnessTone(goldFreshness.key) } },
          [
            el('div', { class: 'country-karat-card__head' }, [
              el('h3', { class: 'country-karat-card__title' }, `${karat.code}K`),
              el(
                'span',
                { class: 'country-karat-card__purity' },
                tx(lang, 'cardPurity', { purity: Math.round(karat.purity * 100) })
              ),
            ]),
            el(
              'p',
              { class: 'country-karat-card__value' },
              localPerGram ? formatPrice(localPerGram, country.currency, country.decimals) : '—'
            ),
            el('p', { class: 'country-karat-card__label' }, tx(lang, 'cardPerGram')),
            el('p', { class: 'country-karat-card__secondary' }, [
              `${tx(lang, 'cardPerOz')}: `,
              localPerOz ? formatPrice(localPerOz, country.currency, country.decimals) : '—',
            ]),
            el(
              'p',
              { class: 'country-karat-card__source' },
              tx(lang, 'cardSource', {
                source: freshnessLabel(lang, goldFreshness.key),
                age:
                  goldFreshness.key === 'unavailable'
                    ? tx(lang, 'statusUnavailable')
                    : goldFreshness.ageText,
              })
            ),
          ]
        )
      );
    });
  }

  const tableRoot = document.getElementById('country-price-table');
  if (tableRoot) {
    clear(tableRoot);
    const table = el('table', { class: 'country-price-table' }, [
      el('thead', null, [
        el('tr', null, [
          el('th', { scope: 'col' }, tx(lang, 'tableKarat')),
          el('th', { scope: 'col' }, tx(lang, 'tableGram', { currency: country.currency })),
          el('th', { scope: 'col' }, tx(lang, 'tableOz', { currency: country.currency })),
        ]),
      ]),
      el(
        'tbody',
        null,
        getFeaturedKarats(pageData).map((karat) => {
          const localPerGram =
            rate && gold?.price ? calcLocalPrice(gold.price, karat.purity, rate, 'gram') : null;
          const localPerOz =
            rate && gold?.price ? calcLocalPrice(gold.price, karat.purity, rate, 'oz') : null;
          return el('tr', null, [
            el('td', null, [
              el('strong', null, `${karat.code}K`),
              ' ',
              el(
                'span',
                { class: 'country-price-table__purity' },
                `${Math.round(karat.purity * 100)}%`
              ),
            ]),
            el(
              'td',
              null,
              localPerGram ? formatPrice(localPerGram, country.currency, country.decimals) : '—'
            ),
            el(
              'td',
              null,
              localPerOz ? formatPrice(localPerOz, country.currency, country.decimals) : '—'
            ),
          ]);
        })
      ),
    ]);
    tableRoot.append(table);
  }
}

function renderCountryTrust({ country, lang }) {
  const trustRoot = document.getElementById('country-trust-note');
  if (!trustRoot) return;
  clear(trustRoot);
  trustRoot.append(
    el('h2', { class: 'country-section-title' }, tx(lang, 'trustTitle')),
    el('ul', { class: 'country-trust-list' }, [
      el('li', null, tx(lang, 'trustReference')),
      el('li', null, tx(lang, 'trustRetail')),
      el('li', null, tx(lang, 'trustFx')),
      el('li', null, country.currency === 'AED' ? tx(lang, 'trustPeg') : tx(lang, 'trustLocalFx')),
    ]),
    el(
      'a',
      {
        class: 'country-trust-link',
        href: safeHref(withBase('methodology.html#country-reference-pages')),
      },
      `${tx(lang, 'trustMethod')} →`
    )
  );
}

function renderCountryContext({ country, lang }) {
  const root = document.getElementById('country-context');
  if (!root) return;
  clear(root);

  const cities = Array.isArray(country.cities) ? country.cities.slice(0, 6) : [];
  const cityLinks = cities.length
    ? cities.map((city) =>
        el(
          'a',
          {
            class: 'country-inline-link',
            href: safeHref(withBase(`countries/${country.slug}/${city.slug}/gold-prices/`)),
          },
          getCountryName(city, lang)
        )
      )
    : [el('span', { class: 'country-context-empty' }, tx(lang, 'contextCitiesEmpty'))];

  root.append(
    el('div', { class: 'country-context-card' }, [
      el('h3', { class: 'country-context-card__title' }, tx(lang, 'contextTitle')),
      el('dl', { class: 'country-context-list' }, [
        el('div', { class: 'country-context-list__row' }, [
          el('dt', null, tx(lang, 'contextCurrency')),
          el('dd', null, `${country.currency} ${CURRENCY_SYMBOLS[country.currency] || ''}`.trim()),
        ]),
        el('div', { class: 'country-context-list__row' }, [
          el('dt', null, tx(lang, 'contextRegion')),
          el('dd', null, getMarketLabel(country, lang)),
        ]),
      ]),
    ]),
    el('div', { class: 'country-context-card' }, [
      el('h3', { class: 'country-context-card__title' }, tx(lang, 'contextCities')),
      el('div', { class: 'country-inline-links' }, cityLinks),
    ]),
    el('div', { class: 'country-context-card' }, [
      el('h3', { class: 'country-context-card__title' }, tx(lang, 'contextShops')),
      el('p', { class: 'country-context-card__copy' }, tx(lang, 'contextShopsDesc')),
      el(
        'a',
        {
          class: 'country-inline-link country-inline-link--cta',
          href: safeHref(buildShopsHref(country)),
        },
        `${getCountryName(country, lang)} ${tx(lang, 'contextShops')} →`
      ),
    ])
  );
}

function buildFaqItems(country, lang, pageData) {
  const fromData = lang === 'ar' ? pageData?.faqAr : pageData?.faqEn;
  if (Array.isArray(fromData) && fromData.length) return fromData;
  return [
    {
      q: tx(lang, 'faqShopQ', { country: getCountryName(country, lang) }),
      a: tx(lang, 'faqShopA', { currency: country.currency }),
    },
    { q: tx(lang, 'faqDiffQ'), a: tx(lang, 'faqDiffA') },
    { q: tx(lang, 'faqKaratQ'), a: tx(lang, 'faqKaratA', { currency: country.currency }) },
    { q: tx(lang, 'faqUpdateQ'), a: tx(lang, 'faqUpdateA') },
  ];
}

function renderCountryFaq({ country, lang, pageData }) {
  const root = document.getElementById('country-faq-list');
  if (!root) return;
  clear(root);
  setText(document.getElementById('country-faq-title'), tx(lang, 'faqTitle'));

  buildFaqItems(country, lang, pageData).forEach((item, index) => {
    const detail = el('details', { class: 'country-faq-item' });
    if (index === 0) detail.open = true;
    detail.append(
      el('summary', { class: 'country-faq-item__summary' }, item.q),
      el('div', { class: 'country-faq-item__answer' }, el('p', null, item.a))
    );
    root.append(detail);
  });
}

function renderCountryPage({ country, pageData, lang, gold, fx }) {
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';

  const rate = getCountryFxRate(country, fx);
  const goldFreshness = getLiveFreshness({
    updatedAt: gold?.updatedAt,
    lang,
    hasLiveFailure: gold?.source === 'cache-fallback',
  });
  const fxFreshness = getFXFreshness({
    fxUpdatedAt: fx?.time_last_update_utc || fx?.lastUpdateUtc,
    lang,
    hasCacheFailure: fx?.source === 'cache-fallback',
  });

  renderCountryHero({ country, pageData, lang, gold, fx, goldFreshness, fxFreshness, rate });
  renderCountryKaratCards({ country, pageData, lang, gold, rate, goldFreshness });
  renderCountryTrust({ country, lang });
  renderCountryContext({ country, lang });
  renderCountryFaq({ country, lang, pageData });

  if (gold?.price) {
    const aed24g = (gold.price / CONSTANTS.TROY_OZ_GRAMS) * AED_PEG;
    updateSpotBar({
      xauUsd: gold.price,
      aed24kGram: aed24g,
      updatedAt: gold.updatedAt,
      hasLiveFailure: gold.source === 'cache-fallback',
    });
  } else {
    updateSpotBar({ updatedAt: null });
  }
}

function renderKaratCardsLegacy(spot, fxRate, currency, karatFilter = null) {
  const karatsToShow = karatFilter
    ? KARATS.filter((karat) => karat.code === String(karatFilter).replace('-karat', ''))
    : KARATS.filter((karat) => ['24', '22', '21', '18'].includes(karat.code));

  const fragment = document.createDocumentFragment();
  for (const karat of karatsToShow) {
    const price = calcLocalPrice(spot, karat.purity, fxRate);
    fragment.appendChild(
      el('div', { class: 'ph-karat-card' }, [
        el('div', { class: 'ph-karat-card__label' }, [`${karat.code}K Gold`]),
        el('div', { class: 'ph-karat-card__price' }, [formatPrice(price, currency, 2)]),
        el('div', { class: 'ph-karat-card__unit' }, ['per gram']),
      ])
    );
  }
  return fragment;
}

function renderFreshnessBadgeLegacy(updatedAt) {
  const freshness = getLiveFreshness({ updatedAt, hasLiveFailure: false, lang: 'en' });
  const colorMap = {
    live: 'var(--color-live, #10b981)',
    cached: 'var(--color-warning, #f59e0b)',
    stale: 'var(--color-stale, #f97316)',
    unavailable: 'var(--text-tertiary, #6b7280)',
  };
  const color = colorMap[freshness.key] || 'var(--text-tertiary, #6b7280)';
  const fragment = document.createDocumentFragment();
  if (freshness.key === 'cached' || freshness.key === 'stale' || freshness.key === 'unavailable') {
    fragment.appendChild(
      el('div', { class: 'ph-freshness-banner', role: 'alert' }, [
        '⚠️ Prices may be delayed. Last known data shown. ',
        el(
          'a',
          { href: safeHref(withBase('methodology.html')), class: 'ph-freshness-link' },
          'Learn more'
        ),
      ])
    );
  }
  fragment.appendChild(
    el(
      'span',
      {
        class: 'ph-freshness-badge',
        title: 'Source: goldpricez.com / open.er-api.com',
        style: { color },
      },
      [
        el('span', { class: 'ph-freshness-dot', style: { background: color } }),
        freshness.key === 'unavailable' ? 'Unavailable' : `${freshness.ageText}`,
        el('span', { class: 'ph-freshness-suffix' }, ['· spot-linked estimate']),
      ]
    )
  );
  return fragment;
}

function renderDisclaimerLegacy(country, pageUrl) {
  let safeUrl;
  try {
    const parsed = new URL(pageUrl);
    safeUrl = parsed.origin + parsed.pathname;
  } catch {
    safeUrl = withBase('');
  }
  const waText = encodeURIComponent(
    `Gold prices in ${country.nameEn} — check live rates: ${safeUrl}`
  );
  const waUrl = `https://wa.me/?text=${waText}`;
  return el('div', { class: 'ph-disclaimer' }, [
    el('span', null, [
      '⚠️ ',
      el('strong', null, ['Reference rates only.']),
      ' Actual retail prices vary. ',
      el(
        'a',
        { href: safeHref(withBase('methodology.html')), class: 'ph-disclaimer-link' },
        'Methodology'
      ),
    ]),
    el(
      'a',
      {
        href: safeHref(waUrl),
        target: '_blank',
        rel: 'noopener noreferrer',
        class: 'ph-disclaimer-share',
      },
      '📲 Share on WhatsApp'
    ),
  ]);
}

async function hydrateLegacyPage({ country, karatSlug }) {
  const loadingEl = document.getElementById('price-loading');
  const displayEl = document.getElementById('price-display');
  const karatsEl = document.getElementById('karat-cards');
  const freshEl = document.getElementById('freshness-badge');
  const disclaimerEl = document.getElementById('price-disclaimer');

  const { gold, fx } = await fetchPrices();
  if (!gold) {
    if (loadingEl) loadingEl.textContent = 'Unable to fetch prices. Please try again.';
    updateSpotBar({ updatedAt: null });
    return;
  }

  const rate = getCountryFxRate(country, fx);
  if (!rate) {
    if (loadingEl) loadingEl.textContent = `FX rate for ${country.currency} unavailable.`;
    updateSpotBar({ updatedAt: gold.updatedAt, hasLiveFailure: true });
    return;
  }

  if (karatsEl)
    karatsEl.replaceChildren(
      renderKaratCardsLegacy(gold.price, rate, country.currency, karatSlug || null)
    );
  if (freshEl) freshEl.replaceChildren(renderFreshnessBadgeLegacy(gold.updatedAt));
  if (disclaimerEl) disclaimerEl.replaceChildren(renderDisclaimerLegacy(country, location.href));

  const aed24g = (gold.price / CONSTANTS.TROY_OZ_GRAMS) * AED_PEG;
  updateSpotBar({
    xauUsd: gold.price,
    aed24kGram: aed24g,
    updatedAt: gold.updatedAt,
    hasLiveFailure: gold.source === 'cache-fallback',
  });

  if (displayEl) displayEl.style.display = '';
  if (loadingEl) loadingEl.style.display = 'none';
}

async function hydrate() {
  const lang = getLang();
  injectSpotBar(lang, depth);
  updateSpotBarLang(lang);
  const navCtrl = injectNav(lang, depth);
  injectFooter(lang, depth);
  wireLangToggles(navCtrl, lang);

  const route = getRouteContext();
  const country = COUNTRIES.find((entry) => entry.slug === route.countrySlug);
  if (!country) {
    updateSpotBar({ updatedAt: null });
    return;
  }

  if (
    route.pageKind === 'country-price' &&
    document.querySelector('.country-page[data-country-slug]')
  ) {
    injectBreadcrumbs('country', {
      countryName: getCountryName(country, lang),
      countryUrl: withBase(`countries/${country.slug}/gold-price/`),
    });
    const pageData = getCountryPageData();
    const { gold, fx } = await fetchPrices();
    renderCountryPage({ country, pageData, lang, gold, fx });
    track(EVENTS.COUNTRY_PAGE_VIEW, {
      country_slug: country.slug,
      currency: country.currency,
      locale: lang,
      page_kind: 'country_price',
    });
    return;
  }

  await hydrateLegacyPage({ country, karatSlug: route.karatSlug });
}

document.addEventListener('DOMContentLoaded', () => {
  hydrate().catch((error) => {
    console.error('[page-hydrator] Hydration error:', error);
    const loadingEl = document.getElementById('price-loading');
    if (loadingEl) loadingEl.textContent = 'Unable to load prices. Please refresh the page.';
    updateSpotBar({ updatedAt: null });
  });
});
