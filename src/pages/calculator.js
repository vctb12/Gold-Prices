/**
 * Gold Calculator page entry point.
 * Handles 5 calculators: Value, Scrap, Zakat, Buying Power, Unit Converter.
 */

import { CONSTANTS, KARATS } from '../config/index.js';
import * as api from '../lib/api.js';
import * as cache from '../lib/cache.js';
import { usdPerGram } from '../lib/price-calculator.js';
import { formatPrice } from '../lib/formatter.js';
import { injectNav, updateNavLang } from '../components/nav.js';
import { injectFooter } from '../components/footer.js';
import { injectTicker, updateTicker, updateTickerLang } from '../components/ticker.js';
import { injectSpotBar, updateSpotBar, updateSpotBarLang } from '../components/spotBar.js';
import { injectBreadcrumbs } from '../components/breadcrumbs.js';
import { renderAdSlot } from '../components/adSlot.js';
import { el, clear } from '../lib/safe-dom.js';
import { track, EVENTS } from '../lib/analytics.js';

/**
 * Helper: render a list of {label, value} rows into a container using safe
 * DOM construction. Replaces the previous `innerHTML = \`<div>…</div>\``
 * pattern so that even if a future change slipped an unescaped string into
 * the label/value, no HTML parser is invoked.
 */
function renderBreakdownRows(container, rows) {
  if (!container) return;
  clear(container);
  for (const [label, value] of rows) {
    container.appendChild(
      el('div', { class: 'calc-result-row' }, [
        el('span', null, [label]),
        el('strong', null, [value]),
      ])
    );
  }
}

// ── State ───────────────────────────────────────────────────────────────────
const STATE = {
  lang: 'en',
  spotUsdPerOz: 0,
  spotSource: 'cached/fallback',
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

// ── Translations ────────────────────────────────────────────────────────────
const T = {
  en: {
    pageTitle: 'Gold Calculator',
    pageSub: 'Spot-linked estimates · Multiple karats · AED & USD',
    spotLabel: 'Spot:',
    tab_value: 'Gold Value',
    tab_scrap: 'Scrap Gold',
    tab_zakat: 'Zakat',
    tab_buying: 'Buying Power',
    tab_convert: 'Unit Converter',
    val_title: 'How much is my gold worth?',
    val_desc: 'Enter the weight and karat of your gold to get an instant value estimate.',
    val_weight: 'Weight',
    val_karat: 'Karat',
    val_currency: 'Currency',
    val_result_label: 'Estimated Value',
    val_disclaimer:
      'Spot-linked reference estimate only. Final retail prices can include making charges, dealer margins, and taxes.',
    scrap_title: 'Scrap Gold Calculator',
    scrap_desc:
      'Estimate the refinery value of your scrap gold. Dealers typically pay 80–95% of spot value.',
    scrap_weight: 'Weight',
    scrap_karat: 'Karat',
    scrap_payout: 'Dealer payout %',
    scrap_payout_hint: 'Typical range: 80–95%',
    scrap_currency: 'Currency',
    scrap_label_spot: 'Spot Value',
    scrap_label_dealer: 'Dealer Payout',
    scrap_disclaimer:
      'Actual dealer prices vary with assay, condition, payout policy, and local taxes. Always get multiple quotes.',
    zakat_title: 'Zakat on Gold Calculator',
    zakat_desc:
      'Calculate your Zakat obligation on gold holdings. Zakat is 2.5% of gold above the nisab threshold (85g of 24K gold or equivalent).',
    zakat_nisab_label: 'Current Nisab (85g of 24K):',
    zakat_weight: 'Total Gold You Own',
    zakat_karat: 'Average Karat',
    zakat_currency: 'Currency',
    zakat_label_due: 'Zakat Due (2.5%)',
    zakat_below_msg: 'Your gold is below the Nisab threshold — no Zakat due.',
    zakat_disclaimer:
      'This is an estimate. Consult a qualified Islamic scholar for your specific circumstances.',
    buying_title: 'Buying Power Calculator',
    buying_desc: 'How much gold can you buy with a given amount of money?',
    buy_amount: 'Budget',
    buy_karat: 'Karat',
    buy_result_label: 'You can buy approximately',
    buy_disclaimer:
      'Spot rate estimate only. It does not include making charges, VAT, premiums, or dealer markup.',
    convert_title: 'Gold Weight Unit Converter',
    convert_desc: 'Convert between grams, troy ounces, tolas, mashas, and more.',
    conv_amount: 'Amount',
    conv_from: 'From',
    conv_results_title: 'Equivalent weights',
    freshness_waiting: 'Freshness: waiting for source timestamp…',
    trust_note:
      'Labels used across Gold Ticker Live: Live, Delayed, Cached/Fallback, Estimated, Historical baseline. Calculator outputs are spot-linked reference estimates, not final retail jewelry quotes.',
    trust_spot_link: 'Spot vs retail explained',
    trust_method_link: 'Full methodology',
    copy_result: 'Copy result',
    copied_result: 'Copied!',
  },
  ar: {
    pageTitle: 'حاسبة الذهب',
    pageSub: 'تقديرات مرجعية فورية · عيارات متعددة · درهم ودولار',
    spotLabel: 'السعر الفوري:',
    tab_value: 'قيمة الذهب',
    tab_scrap: 'ذهب مستعمل',
    tab_zakat: 'زكاة الذهب',
    tab_buying: 'قوة الشراء',
    tab_convert: 'تحويل الوحدات',
    val_title: 'كم تساوي ذهبك؟',
    val_desc: 'أدخل وزن وعيار ذهبك للحصول على تقدير فوري للقيمة.',
    val_weight: 'الوزن',
    val_karat: 'العيار',
    val_currency: 'العملة',
    val_result_label: 'القيمة التقديرية',
    val_disclaimer:
      'تقدير مرجعي مرتبط بالسعر الفوري فقط. قد تشمل أسعار التجزئة النهائية المصنعية وهوامش التجار والضرائب.',
    scrap_title: 'حاسبة الذهب المستعمل',
    scrap_desc: 'احسب القيمة المعدنية لذهبك المستعمل. يدفع التجار عادةً 80–95% من قيمة السوق.',
    scrap_weight: 'الوزن',
    scrap_karat: 'العيار',
    scrap_payout: 'نسبة دفع التاجر %',
    scrap_payout_hint: 'النطاق المعتاد: 80–95%',
    scrap_currency: 'العملة',
    scrap_label_spot: 'قيمة السوق',
    scrap_label_dealer: 'مبلغ التاجر',
    scrap_disclaimer:
      'تختلف أسعار التجار حسب الفحص والحالة وسياسة الدفع والضرائب المحلية. احصل دائماً على عروض متعددة.',
    zakat_title: 'حاسبة زكاة الذهب',
    zakat_desc:
      'احسب زكاة ذهبك. الزكاة 2.5% من الذهب الزائد عن النصاب (85 غرام من الذهب عيار 24 أو ما يعادله).',
    zakat_nisab_label: 'النصاب الحالي (85 غرام عيار 24):',
    zakat_weight: 'إجمالي ما تمتلكه من ذهب',
    zakat_karat: 'متوسط العيار',
    zakat_currency: 'العملة',
    zakat_label_due: 'الزكاة المستحقة (2.5%)',
    zakat_below_msg: 'ذهبك أقل من النصاب — لا زكاة عليه.',
    zakat_disclaimer: 'هذا تقدير. استشر عالماً شرعياً مؤهلاً لظروفك الخاصة.',
    buying_title: 'حاسبة قوة الشراء',
    buying_desc: 'كم من الذهب يمكنك شراؤه بمبلغ معين؟',
    buy_amount: 'الميزانية',
    buy_karat: 'العيار',
    buy_result_label: 'يمكنك شراء ما يقارب',
    buy_disclaimer:
      'تقدير بالسعر الفوري فقط. لا يشمل المصنعية أو الضريبة أو الهامش أو علاوات البيع.',
    convert_title: 'محوّل وحدات الذهب',
    convert_desc: 'حوّل بين الغرام والأوقية التروي والتولة والمثقال وغيرها.',
    conv_amount: 'الكمية',
    conv_from: 'من',
    conv_results_title: 'الأوزان المكافئة',
    freshness_waiting: 'حداثة البيانات: بانتظار الطابع الزمني من المصدر…',
    trust_note:
      'التسميات الموحدة عبر Gold Ticker Live: مباشر، متأخر، مخزن/احتياطي، تقديري، وخط أساس تاريخي. نتائج الحاسبة تقديرات مرجعية مرتبطة بالسعر الفوري وليست سعر تجزئة نهائي للمجوهرات.',
    trust_spot_link: 'شرح الفرق بين السعر الفوري وسعر التجزئة',
    trust_method_link: 'المنهجية الكاملة',
    copy_result: 'نسخ النتيجة',
    copied_result: 'تم النسخ!',
  },
};

function t(key) {
  return T[STATE.lang]?.[key] ?? T.en[key] ?? key;
}

// ── Weight unit conversions (to grams) ─────────────────────────────────────
const UNIT_TO_GRAMS = {
  gram: 1,
  oz: CONSTANTS.TROY_OZ_GRAMS,
  kg: 1000,
  tola: 11.6638,
  masha: 0.972,
  baht: 15.244,
  taels: 37.429,
};

const UNIT_LABELS = {
  gram: 'Gram (g)',
  oz: 'Troy Ounce (ozt)',
  kg: 'Kilogram (kg)',
  tola: 'Tola',
  masha: 'Masha',
  baht: 'Baht (Thai)',
  taels: 'Taels (Chinese)',
};

function toGrams(amount, unit) {
  return amount * (UNIT_TO_GRAMS[unit] ?? 1);
}

// ── Get rate ────────────────────────────────────────────────────────────────
function getRate(currency) {
  if (currency === 'AED') return CONSTANTS.AED_PEG;
  return STATE.rates[currency] ?? null;
}

function getPurityForKarat(code) {
  const k = KARATS.find((k) => k.code === String(code));
  // also handle custom codes like 10, 9
  if (k) return k.purity;
  const n = parseInt(code, 10);
  if (n > 0 && n <= 24) return n / 24;
  return 1;
}

// ── Analytics debounce ───────────────────────────────────────────────────────
// Debounce calculator_use events so rapid keystrokes produce only one event.
const _calcUseTimers = {};
function _trackCalcUse(tool, params) {
  clearTimeout(_calcUseTimers[tool]);
  _calcUseTimers[tool] = setTimeout(() => track(EVENTS.CALCULATOR_USE, params), 1000);
}

// ── Calculator 1: Value ─────────────────────────────────────────────────────
function calcValue() {
  const weightRaw = parseFloat(document.getElementById('val-weight')?.value);
  const unit = document.getElementById('val-unit')?.value ?? 'gram';
  const karat = document.getElementById('val-karat')?.value ?? '22';
  const currency = document.getElementById('val-currency')?.value ?? 'AED';

  const result = document.getElementById('val-result');
  if (!result) return;

  if (isNaN(weightRaw) || weightRaw <= 0 || !STATE.spotUsdPerOz) {
    result.hidden = true;
    return;
  }

  const weightGrams = toGrams(weightRaw, unit);
  const purity = getPurityForKarat(karat);
  const rate = getRate(currency);
  if (!rate) {
    result.hidden = true;
    return;
  }

  const gramPriceUsd = usdPerGram(STATE.spotUsdPerOz, purity);
  const totalUsd = gramPriceUsd * weightGrams;
  const totalLocal = totalUsd * rate;

  const decimals = ['KWD', 'BHD', 'OMR', 'JOD'].includes(currency) ? 3 : 2;

  document.getElementById('val-result-value').textContent = formatPrice(
    totalLocal,
    currency,
    decimals
  );

  const breakdown = document.getElementById('val-result-breakdown');
  renderBreakdownRows(breakdown, [
    ['Weight', `${weightGrams.toFixed(3)} g`],
    [`Purity (${karat}K)`, `${(purity * 100).toFixed(1)}%`],
    [`Spot price per gram (${currency})`, formatPrice(gramPriceUsd * rate, currency, decimals)],
    ['USD equivalent', formatPrice(totalUsd, 'USD', 2)],
  ]);

  result.hidden = false;
  _trackCalcUse('value', {
    weight: weightGrams,
    unit: 'gram',
    karat,
    currency,
  });
}

// ── Calculator 2: Scrap ─────────────────────────────────────────────────────
function calcScrap() {
  const weightRaw = parseFloat(document.getElementById('scrap-weight')?.value);
  const unit = document.getElementById('scrap-unit')?.value ?? 'gram';
  const karat = document.getElementById('scrap-karat')?.value ?? '22';
  const payout = parseFloat(document.getElementById('scrap-payout')?.value) / 100;
  const currency = document.getElementById('scrap-currency')?.value ?? 'AED';

  const result = document.getElementById('scrap-result');
  if (!result) return;

  if (isNaN(weightRaw) || weightRaw <= 0 || !STATE.spotUsdPerOz || isNaN(payout)) {
    result.hidden = true;
    return;
  }

  const weightGrams = toGrams(weightRaw, unit);
  const purity = getPurityForKarat(karat);
  const rate = getRate(currency);
  if (!rate) {
    result.hidden = true;
    return;
  }

  const decimals = ['KWD', 'BHD', 'OMR', 'JOD'].includes(currency) ? 3 : 2;
  const gramPriceUsd = usdPerGram(STATE.spotUsdPerOz, purity);
  const totalUsd = gramPriceUsd * weightGrams;
  const totalLocal = totalUsd * rate;
  const dealerLocal = totalLocal * payout;

  document.getElementById('scrap-result-spot').textContent = formatPrice(
    totalLocal,
    currency,
    decimals
  );
  document.getElementById('scrap-result-dealer').textContent = formatPrice(
    dealerLocal,
    currency,
    decimals
  );
  const pctEl = document.getElementById('scrap-pct-display');
  if (pctEl) pctEl.textContent = Math.round(payout * 100);

  result.hidden = false;
}

// ── Calculator 3: Zakat ─────────────────────────────────────────────────────
function calcZakat() {
  const weightRaw = parseFloat(document.getElementById('zakat-weight')?.value);
  const unit = document.getElementById('zakat-unit')?.value ?? 'gram';
  const karat = document.getElementById('zakat-karat')?.value ?? '22';
  const currency = document.getElementById('zakat-currency')?.value ?? 'AED';

  const result = document.getElementById('zakat-result');
  if (!result) return;

  const rate = getRate(currency);
  const decimals = ['KWD', 'BHD', 'OMR', 'JOD'].includes(currency) ? 3 : 2;

  // Nisab = 85g of 24K gold
  const NISAB_GRAMS_24K = 85;
  const nisabUsd = usdPerGram(STATE.spotUsdPerOz, 1.0) * NISAB_GRAMS_24K;
  const nisabLocal = nisabUsd * (rate ?? 1);

  const nisabEl = document.getElementById('zakat-nisab-value');
  if (nisabEl && STATE.spotUsdPerOz && rate) {
    nisabEl.textContent = formatPrice(nisabLocal, currency, decimals);
  }

  if (isNaN(weightRaw) || weightRaw <= 0 || !STATE.spotUsdPerOz || !rate) {
    result.hidden = true;
    return;
  }

  const weightGrams = toGrams(weightRaw, unit);
  const purity = getPurityForKarat(karat);
  // Convert to 24K equivalent
  const grams24kEquiv = weightGrams * purity;

  const totalUsd = usdPerGram(STATE.spotUsdPerOz, purity) * weightGrams;
  const totalLocal = totalUsd * rate;

  const belowNisab = document.getElementById('zakat-below-nisab');
  const breakdown = document.getElementById('zakat-result-breakdown');
  const valueEl = document.getElementById('zakat-result-value');

  if (grams24kEquiv < NISAB_GRAMS_24K) {
    if (valueEl) valueEl.textContent = formatPrice(0, currency, decimals);
    if (belowNisab) belowNisab.hidden = false;
    renderBreakdownRows(breakdown, [
      ['24K equivalent', `${grams24kEquiv.toFixed(2)} g`],
      ['Nisab', `${NISAB_GRAMS_24K} g`],
    ]);
  } else {
    const zakatLocal = totalLocal * 0.025;
    if (valueEl) valueEl.textContent = formatPrice(zakatLocal, currency, decimals);
    if (belowNisab) belowNisab.hidden = true;
    renderBreakdownRows(breakdown, [
      ['Total gold value', formatPrice(totalLocal, currency, decimals)],
      ['24K equivalent', `${grams24kEquiv.toFixed(2)} g`],
      ['Nisab threshold', `${NISAB_GRAMS_24K} g (${formatPrice(nisabLocal, currency, decimals)})`],
    ]);
  }

  result.hidden = false;
}

// ── Calculator 4: Buying power ──────────────────────────────────────────────
function calcBuying() {
  const amount = parseFloat(document.getElementById('buy-amount')?.value);
  const currency = document.getElementById('buy-currency')?.value ?? 'AED';
  const karat = document.getElementById('buy-karat')?.value ?? '22';

  const result = document.getElementById('buy-result');
  if (!result) return;

  if (isNaN(amount) || amount <= 0 || !STATE.spotUsdPerOz) {
    result.hidden = true;
    return;
  }

  const rate = getRate(currency);
  if (!rate) {
    result.hidden = true;
    return;
  }

  const purity = getPurityForKarat(karat);
  const gramPriceLocal = usdPerGram(STATE.spotUsdPerOz, purity) * rate;
  const gramsYouGet = amount / gramPriceLocal;
  const ozYouGet = gramsYouGet / UNIT_TO_GRAMS.oz;
  const tolaYouGet = gramsYouGet / UNIT_TO_GRAMS.tola;

  const valueEl = document.getElementById('buy-result-grams');
  if (valueEl) valueEl.textContent = `${gramsYouGet.toFixed(3)} g`;

  const breakdown = document.getElementById('buy-result-breakdown');
  renderBreakdownRows(breakdown, [
    ['In troy ounces', `${ozYouGet.toFixed(4)} ozt`],
    ['In tolas', `${tolaYouGet.toFixed(3)} tola`],
    [
      `Price per gram (${karat}K)`,
      formatPrice(
        gramPriceLocal,
        currency,
        ['KWD', 'BHD', 'OMR', 'JOD'].includes(currency) ? 3 : 2
      ),
    ],
  ]);

  result.hidden = false;
}

// ── Calculator 5: Unit converter ────────────────────────────────────────────
function calcConvert() {
  const amount = parseFloat(document.getElementById('conv-amount')?.value);
  const from = document.getElementById('conv-from')?.value ?? 'gram';
  const convResults = document.getElementById('conv-results');
  const grid = document.getElementById('conv-grid');
  if (!convResults || !grid) return;

  if (isNaN(amount) || amount <= 0) {
    convResults.hidden = true;
    return;
  }

  const inGrams = toGrams(amount, from);
  const entries = Object.entries(UNIT_TO_GRAMS).filter(([unit]) => unit !== from);

  clear(grid);
  for (const [unit, factor] of entries) {
    grid.appendChild(
      el('div', { class: 'conv-row' }, [
        el('span', { class: 'conv-row-label' }, [UNIT_LABELS[unit] ?? unit]),
        el('span', { class: 'conv-row-value' }, [
          (inGrams / factor).toLocaleString('en-US', { maximumFractionDigits: 6 }),
        ]),
      ])
    );
  }

  convResults.hidden = false;
}

// ── Apply language ───────────────────────────────────────────────────────────
function applyLang() {
  const set = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };
  const setTrustNote = () => {
    const trustNote = document.getElementById('calc-trust-note');
    if (!trustNote) return;
    clear(trustNote);
    trustNote.append(
      `${t('trust_note')} `,
      el('a', { href: 'content/spot-vs-retail-gold-price/' }, [`${t('trust_spot_link')} →`]),
      ' · ',
      el('a', { href: 'methodology.html' }, [`${t('trust_method_link')} →`])
    );
  };

  set('calc-hero-h1', t('pageTitle'));
  set('calc-hero-sub', t('pageSub'));
  set('calc-spot-label', t('spotLabel'));
  set('calc-value-title', t('tab_value'));
  set('calc-scrap-title', t('tab_scrap'));
  set('calc-zakat-title', t('tab_zakat'));
  set('calc-buying-title', t('tab_buying'));
  set('calc-convert-title', t('tab_convert'));
  set('calc-value-h2', t('val_title'));
  set('calc-value-desc', t('val_desc'));
  set('val-weight-label', t('val_weight'));
  set('val-karat-label', t('val_karat'));
  set('val-currency-label', t('val_currency'));
  set('val-result-label', t('val_result_label'));
  set('val-disclaimer', t('val_disclaimer'));
  set('calc-scrap-h2', t('scrap_title'));
  set('calc-scrap-desc', t('scrap_desc'));
  set('scrap-weight-label', t('scrap_weight'));
  set('scrap-karat-label', t('scrap_karat'));
  set('scrap-payout-label', t('scrap_payout'));
  set('scrap-payout-hint', t('scrap_payout_hint'));
  set('scrap-currency-label', t('scrap_currency'));
  set('scrap-label-spot', t('scrap_label_spot'));
  set('scrap-disclaimer', t('scrap_disclaimer'));
  set('calc-zakat-h2', t('zakat_title'));
  set('calc-zakat-desc', t('zakat_desc'));
  set('zakat-nisab-label', t('zakat_nisab_label'));
  set('zakat-weight-label', t('zakat_weight'));
  set('zakat-karat-label', t('zakat_karat'));
  set('zakat-currency-label', t('zakat_currency'));
  set('zakat-label-due', t('zakat_label_due'));
  set('zakat-below-msg', t('zakat_below_msg'));
  set('zakat-disclaimer', t('zakat_disclaimer'));
  set('calc-buying-h2', t('buying_title'));
  set('calc-buying-desc', t('buying_desc'));
  set('buy-amount-label', t('buy_amount'));
  set('buy-karat-label', t('buy_karat'));
  set('buy-result-label', t('buy_result_label'));
  set('buy-disclaimer', t('buy_disclaimer'));
  set('calc-convert-h2', t('convert_title'));
  set('calc-convert-desc', t('convert_desc'));
  set('conv-amount-label', t('conv_amount'));
  set('conv-from-label', t('conv_from'));
  set('conv-results-title', t('conv_results_title'));
  set('calc-freshness-note', t('freshness_waiting'));
  setTrustNote();
  document.querySelectorAll('.calc-copy-btn').forEach((btn) => {
    btn.textContent = t('copy_result');
    btn.setAttribute('aria-label', t('copy_result'));
  });

  document.documentElement.lang = STATE.lang;
  document.documentElement.dir = STATE.lang === 'ar' ? 'rtl' : 'ltr';
}

// ── Spot badge ───────────────────────────────────────────────────────────────
function updateSpotBadge() {
  const el = document.getElementById('calc-spot-price');
  if (el) {
    el.textContent = STATE.spotUsdPerOz
      ? `$${STATE.spotUsdPerOz.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : '—';
  }
  // AED 24K/gram secondary badge
  const aedBadge = document.getElementById('calc-aed-badge');
  const aedPrice = document.getElementById('calc-aed-price');
  if (aedBadge && aedPrice && STATE.spotUsdPerOz) {
    const aed24 = (STATE.spotUsdPerOz / CONSTANTS.TROY_OZ_GRAMS) * CONSTANTS.AED_PEG;
    aedPrice.textContent = `AED ${aed24.toFixed(2)}`;
    aedBadge.hidden = false;
  }

  const freshnessEl = document.getElementById('calc-freshness-note');
  if (freshnessEl) {
    if (!STATE.freshness.goldUpdatedAt) {
      freshnessEl.textContent = t('freshness_waiting');
    } else {
      const locale = STATE.lang === 'ar' ? 'ar-AE' : 'en-US';
      const stamp = new Date(STATE.freshness.goldUpdatedAt).toLocaleString(locale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
      const sourceLabel =
        STATE.spotSource === 'live'
          ? STATE.lang === 'ar'
            ? 'مباشر'
            : 'Live'
          : STATE.lang === 'ar'
            ? 'مخزن/احتياطي'
            : 'Cached/Fallback';
      freshnessEl.textContent =
        STATE.lang === 'ar'
          ? `حداثة البيانات: ${sourceLabel} · ${stamp} · المصدر: goldpricez.com`
          : `Freshness: ${sourceLabel} · ${stamp} · Source: goldpricez.com`;
    }
  }
}

// ── Tab switching ────────────────────────────────────────────────────────────
function setupTabs() {
  // Map calc tab data-calc values to tool names
  const TOOL_MAP = {
    value: 'weight',
    zakat: 'zakat',
    scrap: 'weight',
    buying: 'weight',
    convert: 'weight',
  };
  document.querySelectorAll('.calc-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.calc;
      document.querySelectorAll('.calc-tab').forEach((b) => {
        b.classList.toggle('active', b.dataset.calc === target);
        b.setAttribute('aria-selected', String(b.dataset.calc === target));
      });
      document.querySelectorAll('.calc-panel').forEach((p) => {
        const isTarget = p.id === `panel-${target}`;
        p.classList.toggle('active', isTarget);
        p.hidden = !isTarget;
      });
      track(EVENTS.TOOL_USE, { tool: TOOL_MAP[target] || target });
    });
  });
}

// ── Wire inputs ──────────────────────────────────────────────────────────────
function wireInputs() {
  const on = (id, fn) => document.getElementById(id)?.addEventListener('input', fn);

  ['val-weight', 'val-unit', 'val-karat', 'val-currency'].forEach((id) => on(id, calcValue));
  ['scrap-weight', 'scrap-unit', 'scrap-karat', 'scrap-payout', 'scrap-currency'].forEach((id) =>
    on(id, calcScrap)
  );
  ['zakat-weight', 'zakat-unit', 'zakat-karat', 'zakat-currency'].forEach((id) =>
    on(id, calcZakat)
  );
  ['buy-amount', 'buy-currency', 'buy-karat'].forEach((id) => on(id, calcBuying));
  ['conv-amount', 'conv-from'].forEach((id) => on(id, calcConvert));

  // Quick weight preset chips
  const weightInput = document.getElementById('val-weight');
  const unitSelect = document.getElementById('val-unit');
  document.querySelectorAll('.calc-preset-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const w = chip.dataset.weight;
      const u = chip.dataset.unit;
      if (weightInput && w) {
        weightInput.value = w;
        if (unitSelect && u) unitSelect.value = u;
        // Update active state
        document
          .querySelectorAll('.calc-preset-chip')
          .forEach((c) => c.classList.remove('is-active'));
        chip.classList.add('is-active');
        calcValue();
      }
    });
  });

  // Clear active chip when user manually edits weight
  if (weightInput) {
    weightInput.addEventListener('input', () => {
      document
        .querySelectorAll('.calc-preset-chip')
        .forEach((c) => c.classList.remove('is-active'));
    });
  }
}

// ── Fetch live data ──────────────────────────────────────────────────────────
async function fetchLiveData() {
  try {
    const [goldRes, fxRes] = await Promise.allSettled([api.fetchGold(), api.fetchFX()]);
    if (goldRes.status === 'fulfilled') {
      STATE.spotUsdPerOz = goldRes.value.price;
      STATE.freshness.goldUpdatedAt = goldRes.value.updatedAt || new Date().toISOString();
      STATE.spotSource = 'live';
      cache.saveGoldPrice(goldRes.value.price, goldRes.value.updatedAt);
    } else if (STATE.spotUsdPerOz) {
      STATE.spotSource = 'cached/fallback';
    }
    if (fxRes.status === 'fulfilled') {
      STATE.rates = fxRes.value.rates;
      cache.saveFXRates(fxRes.value.rates, {
        lastUpdateUtc: fxRes.value.time_last_update_utc,
        nextUpdateUtc: fxRes.value.time_next_update_utc,
      });
    }
    updateSpotBadge();
    calcZakat(); // Re-render nisab display
    if (STATE.spotUsdPerOz) {
      const TROY = CONSTANTS.TROY_OZ_GRAMS;
      const AED = CONSTANTS.AED_PEG;
      const aed24 = ((STATE.spotUsdPerOz * 1) / TROY) * AED;
      updateTicker({
        xauUsd: STATE.spotUsdPerOz,
        uae24k: aed24,
        uae22k: ((STATE.spotUsdPerOz * (22 / 24)) / TROY) * AED,
        uae21k: ((STATE.spotUsdPerOz * (21 / 24)) / TROY) * AED,
        uae18k: ((STATE.spotUsdPerOz * (18 / 24)) / TROY) * AED,
        updatedAt: STATE.freshness.goldUpdatedAt,
        hasLiveFailure: STATE.spotSource !== 'live',
      });
      updateSpotBar({
        xauUsd: STATE.spotUsdPerOz,
        aed24kGram: aed24,
        updatedAt: STATE.freshness.goldUpdatedAt,
        hasLiveFailure: STATE.spotSource !== 'live',
      });
    }
  } catch (e) {
    console.warn('Calculator fetch error:', e);
  }
}

function initCopyBtn() {
  const btn = document.getElementById('calc-copy-btn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const resultEl = document.getElementById('val-result-value');
    if (!resultEl) return;
    const text = resultEl.textContent.trim();
    const done = () => {
      btn.textContent = t('copied_result');
      btn.setAttribute('aria-label', t('copied_result'));
      btn.classList.add('copied');
      setTimeout(() => {
        btn.textContent = t('copy_result');
        btn.setAttribute('aria-label', t('copy_result'));
        btn.classList.remove('copied');
      }, 1500);
    };
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(done).catch(done);
    } else {
      try {
        const t = document.createElement('textarea');
        t.value = text;
        t.style.position = 'fixed';
        t.style.opacity = '0';
        document.body.appendChild(t);
        t.select();
        document.execCommand('copy');
        document.body.removeChild(t);
        done();
      } catch (e) {
        console.warn('Copy fallback failed:', e);
      }
    }
  });

  // Event delegation for data-target copy buttons
  document.addEventListener('click', (e) => {
    const b = e.target.closest('.calc-copy-btn[data-target]');
    if (!b) return;
    const targetEl = document.getElementById(b.dataset.target);
    const text = targetEl?.textContent?.trim();
    if (!text || text === '—') return;
    navigator.clipboard
      ?.writeText(text)
      .then(() => {
        const orig = b.textContent;
        b.textContent = '✓ Copied';
        track(EVENTS.COPY_CLICK, { surface: 'calculator', value_type: 'result' });
        setTimeout(() => {
          b.textContent = orig;
        }, 2000);
      })
      .catch(() => {});
  });
}

// ── Init ─────────────────────────────────────────────────────────────────────
async function init() {
  cache.loadState(STATE);

  const urlLang = new URLSearchParams(location.search).get('lang');
  if (urlLang === 'ar' || urlLang === 'en') STATE.lang = urlLang;

  document.documentElement.lang = STATE.lang;
  document.documentElement.dir = STATE.lang === 'ar' ? 'rtl' : 'ltr';

  injectSpotBar(STATE.lang, 0);
  const navResult = injectNav(STATE.lang, 0);
  injectBreadcrumbs('calculator');
  injectFooter(STATE.lang, 0);
  injectTicker(STATE.lang, 0);
  renderAdSlot('ad-bottom', 'rectangle');

  navResult.getLangToggleButtons().forEach((btn) => {
    btn.addEventListener('click', () => {
      STATE.lang = STATE.lang === 'en' ? 'ar' : 'en';
      cache.savePreference('lang', STATE.lang);
      updateNavLang(STATE.lang);
      updateTickerLang(STATE.lang);
      updateSpotBarLang(STATE.lang);
      applyLang();
      updateSpotBadge();
    });
  });

  applyLang();
  setupTabs();
  wireInputs();
  initCopyBtn();
  updateSpotBadge();
  calcZakat(); // show nisab immediately from cache

  await fetchLiveData();
  setInterval(fetchLiveData, CONSTANTS.GOLD_REFRESH_MS);

  track(EVENTS.PAGE_VIEW, { path: location.pathname, locale: STATE.lang });
}

init();
