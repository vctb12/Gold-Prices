import { injectNav } from '../components/nav.js';
import { injectFooter } from '../components/footer.js';
import { injectTicker } from '../components/ticker.js';
import { renderBreadcrumbs } from '../components/breadcrumbs.js';
import { KARAT_PURITY_MAP } from '../lib/karatPurity.js';

const AED_PEG = 3.6725;
const TROY_OZ_G = 31.1034768;
const DEFAULT_SPOT_USD_OZ = 2400;
const pathParts = window.location.pathname.split('/').filter(Boolean);
const navDepth = Math.max(0, pathParts.length - 1);
const lang = document.documentElement.lang === 'ar' ? 'ar' : 'en';
const isAr = lang === 'ar';

document.documentElement.dir = isAr ? 'rtl' : 'ltr';
injectNav(lang, navDepth);
const main = document.querySelector('main');
if (main) {
  const bc = document.createElement('div');
  bc.className = 'page-breadcrumbs';
  document.body.insertBefore(bc, main);
  renderBreadcrumbs(bc, [
    { label: isAr ? 'الرئيسية' : 'Home', url: navDepth === 3 ? '../../../' : '../../' },
    { label: isAr ? 'الأدوات' : 'Tools', url: isAr ? '../' : './' },
    { label: isAr ? 'حاسبة الذهب الكسر' : 'Scrap Gold Calculator', url: '#' },
  ]);
}
injectFooter(lang, navDepth);
injectTicker(lang, navDepth);

const copy = {
  en: {
    loaded: (price, source, time) =>
      `Reference 24K price loaded: ${price} AED/g · ${source} · ${time}. Edit it if your dealer quotes a different reference.`,
    fallback:
      'Using a fallback 24K reference price. Values are spot-linked estimates, not shop quotes.',
    invalid: 'Enter a positive weight and reference price.',
  },
  ar: {
    loaded: (price, source, time) =>
      `تم تحميل سعر 24 عيار المرجعي: ${price} درهم/غرام · ${source} · ${time}. عدّله إذا استخدم التاجر مرجعاً مختلفاً.`,
    fallback:
      'يستخدم النموذج سعراً مرجعياً احتياطياً لعيار 24. القيم تقديرية مرتبطة بالسعر الفوري وليست عرض شراء من محل.',
    invalid: 'أدخل وزناً وسعراً مرجعياً بقيم موجبة.',
  },
}[lang];

const weight = document.getElementById('sc-weight');
const karat = document.getElementById('sc-karat');
const margin = document.getElementById('sc-margin');
const price = document.getElementById('sc-price');
const hint = document.getElementById('sc-price-hint');
const button = document.getElementById('sc-calculate');
const error = document.getElementById('sc-error');
const result = document.getElementById('sc-result');
const grossAed = document.getElementById('sc-gross-aed');
const grossUsd = document.getElementById('sc-gross-usd');
const marginAed = document.getElementById('sc-margin-aed');
const marginUsd = document.getElementById('sc-margin-usd');
const scrapAed = document.getElementById('sc-scrap-aed');
const scrapUsd = document.getElementById('sc-scrap-usd');
const purityOut = document.getElementById('sc-purity');

function num(value, fallback = 0) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function money(value, code) {
  return new Intl.NumberFormat(isAr ? 'ar-AE' : 'en-US', {
    style: 'currency',
    currency: code,
    maximumFractionDigits: 2,
  }).format(value);
}

function number(value, digits = 2) {
  return new Intl.NumberFormat(isAr ? 'ar-AE' : 'en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

async function fetchReferencePrice() {
  try {
    const response = await fetch('/data/gold_price.json', {
      cache: 'no-store',
      signal: AbortSignal.timeout(6000),
    });
    if (!response.ok) throw new Error('price unavailable');
    const data = await response.json();
    const candidate = Number(data?.aed_per_gram_24k || data?.gold?.gram_aed || 0);
    if (candidate > 0) {
      price.value = candidate.toFixed(2);
      const source = data?.source || data?.provider || 'spot reference';
      const time = data?.timestamp_utc || data?.fetched_at_utc || 'UTC';
      hint.textContent = copy.loaded(number(candidate), source, time);
    }
  } catch {
    const fallback = (DEFAULT_SPOT_USD_OZ / TROY_OZ_G) * AED_PEG;
    if (!price.value) price.value = fallback.toFixed(2);
    hint.textContent = copy.fallback;
  }
}

function calculate() {
  const grams = Math.max(0, num(weight?.value));
  const purity = KARAT_PURITY_MAP[karat?.value || '24'] || 1;
  const dealerMargin = Math.min(30, Math.max(0, num(margin?.value, 10)));
  const referenceAed = Math.max(0, num(price?.value));
  if (grams <= 0 || referenceAed <= 0) {
    error.textContent = copy.invalid;
    result.classList.remove('visible');
    return;
  }
  error.textContent = '';
  const gross = grams * purity * referenceAed;
  const marginValue = gross * (dealerMargin / 100);
  const scrap = gross - marginValue;
  grossAed.textContent = money(gross, 'AED');
  grossUsd.textContent = money(gross / AED_PEG, 'USD');
  marginAed.textContent = money(marginValue, 'AED');
  marginUsd.textContent = money(marginValue / AED_PEG, 'USD');
  scrapAed.textContent = money(scrap, 'AED');
  scrapUsd.textContent = money(scrap / AED_PEG, 'USD');
  purityOut.textContent = `${number(purity * 100, 2)}%`;
  result.classList.add('visible');
}

button?.addEventListener('click', calculate);
[weight, karat, margin, price].forEach((input) => {
  input?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') calculate();
  });
});
fetchReferencePrice();
