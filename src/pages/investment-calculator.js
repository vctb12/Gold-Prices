import { injectNav } from '../components/nav.js';
import { injectFooter } from '../components/footer.js';
import { injectTicker } from '../components/ticker.js';
import { renderBreadcrumbs } from '../components/breadcrumbs.js';
import { KARATS } from '../config/karats.js';

const AED_PEG = 3.6725;
const TROY_OZ_G = 31.1034768;
const DEFAULT_SPOT_USD_OZ = 2400;
const INVESTMENT_KARATS = new Set(['24', '22', '21', '18']);
const KARAT_PURITY = Object.fromEntries(
  KARATS.filter((karat) => INVESTMENT_KARATS.has(karat.code)).map((karat) => [
    karat.code,
    karat.purity,
  ])
);

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
    { label: isAr ? 'حاسبة الاستثمار في الذهب' : 'Gold Investment Calculator', url: '#' },
  ]);
}
injectFooter(lang, navDepth);
injectTicker(lang, navDepth);

const text = {
  en: {
    loaded: (price, source, time) =>
      `Reference spot loaded: ${price} AED/g 24K · ${source} · ${time}. You can override assumptions.`,
    fallback: 'Using a fallback reference price. Calculator outputs are estimates, not guarantees.',
    invalid: 'Enter a positive initial investment, monthly contribution, or both.',
    year: 'Year',
    contribution: 'Contribution',
    value: 'Portfolio value',
    gain: 'Gain',
    grams: (grams, karat) =>
      `Estimated equivalent at today’s ${karat}K reference price: ${grams} g. This is not a retail quote.`,
  },
  ar: {
    loaded: (price, source, time) =>
      `تم تحميل السعر المرجعي: ${price} درهم/غرام عيار 24 · ${source} · ${time}. يمكنك تعديل الافتراضات.`,
    fallback: 'يستخدم النموذج سعراً مرجعياً احتياطياً. النتائج تقديرية وليست ضماناً للعائد.',
    invalid: 'أدخل استثماراً أولياً أو مساهمة شهرية بقيمة موجبة.',
    year: 'السنة',
    contribution: 'المساهمات',
    value: 'قيمة المحفظة',
    gain: 'الربح',
    grams: (grams, karat) =>
      `ما يعادله تقريباً بسعر عيار ${karat} اليوم: ${grams} غرام. هذا ليس عرض بيع بالتجزئة.`,
  },
}[lang];

const currency = document.getElementById('ic-currency');
const initial = document.getElementById('ic-initial');
const monthly = document.getElementById('ic-monthly');
const growth = document.getElementById('ic-growth');
const years = document.getElementById('ic-years');
const karat = document.getElementById('ic-karat');
const button = document.getElementById('ic-calculate');
const result = document.getElementById('ic-result');
const priceHint = document.getElementById('ic-price-hint');
const error = document.getElementById('ic-error');
const outValue = document.getElementById('ic-out-value');
const outContrib = document.getElementById('ic-out-contrib');
const outGain = document.getElementById('ic-out-gain');
const outGainPct = document.getElementById('ic-out-gain-pct');
const gramsNote = document.getElementById('ic-grams-note');
const tbody = document.getElementById('ic-yearly-body');

let pricePerGramAed24 = (DEFAULT_SPOT_USD_OZ / TROY_OZ_G) * AED_PEG;

function num(value, fallback = 0) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function money(value, code) {
  return new Intl.NumberFormat(isAr ? 'ar-AE' : 'en-US', {
    style: 'currency',
    currency: code,
    maximumFractionDigits: 0,
  }).format(value);
}

function percent(value) {
  return new Intl.NumberFormat(isAr ? 'ar-AE' : 'en-US', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
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
      pricePerGramAed24 = candidate;
      const source = data?.source || data?.provider || 'spot reference';
      const time = data?.timestamp_utc || data?.fetched_at_utc || 'UTC';
      if (priceHint) priceHint.textContent = text.loaded(number(candidate), source, time);
    }
  } catch {
    if (priceHint) priceHint.textContent = text.fallback;
  }
}

function addCell(row, value, header = false) {
  const cell = document.createElement(header ? 'th' : 'td');
  if (header) cell.scope = 'row';
  cell.textContent = value;
  row.appendChild(cell);
}

function calculate() {
  const code = currency?.value === 'USD' ? 'USD' : 'AED';
  const fx = code === 'USD' ? 1 / AED_PEG : 1;
  const pv = Math.max(0, num(initial?.value));
  const pmt = Math.max(0, num(monthly?.value));
  const annualRate = Math.max(-0.5, num(growth?.value, 7) / 100);
  const totalYears = Math.min(30, Math.max(1, Math.round(num(years?.value, 10))));
  const selectedKarat = karat?.value || '24';

  if (pv <= 0 && pmt <= 0) {
    if (error) error.textContent = text.invalid;
    result?.classList.remove('visible');
    return;
  }
  if (error) error.textContent = '';

  const monthlyRate = annualRate / 12;
  const rows = [];
  for (let year = 1; year <= totalYears; year += 1) {
    const months = year * 12;
    const value =
      monthlyRate === 0
        ? pv + pmt * months
        : pv * (1 + monthlyRate) ** months +
          pmt * (((1 + monthlyRate) ** months - 1) / monthlyRate);
    const contributed = pv + pmt * months;
    rows.push({ year, contributed, value, gain: value - contributed });
  }
  const finalRow = rows[rows.length - 1];
  const gainPct = finalRow.contributed > 0 ? finalRow.gain / finalRow.contributed : 0;
  outValue.textContent = money(finalRow.value, code);
  outContrib.textContent = money(finalRow.contributed, code);
  outGain.textContent = money(finalRow.gain, code);
  outGainPct.textContent = percent(gainPct);

  const purity = KARAT_PURITY[selectedKarat] || 1;
  const gramPriceInCurrency = pricePerGramAed24 * purity * fx;
  const equivalentGrams = gramPriceInCurrency > 0 ? finalRow.value / gramPriceInCurrency : 0;
  gramsNote.textContent = text.grams(number(equivalentGrams), selectedKarat);

  tbody.replaceChildren();
  rows.forEach((item) => {
    const row = document.createElement('tr');
    addCell(row, String(item.year), true);
    addCell(row, money(item.contributed, code));
    addCell(row, money(item.value, code));
    addCell(row, money(item.gain, code));
    tbody.appendChild(row);
  });
  result.classList.add('visible');
}

button?.addEventListener('click', calculate);
[initial, monthly, growth, years, karat, currency].forEach((input) => {
  input?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') calculate();
  });
});
fetchReferencePrice();
