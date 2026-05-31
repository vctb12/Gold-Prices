/**
 * Insights feed — pure, framework-free data + helpers.
 *
 * No DOM access lives here so the data model and filtering/search logic can be
 * unit-tested in isolation (see `tests/insights-data.test.js`). The page
 * orchestrator (`src/pages/insights.js`) wires these helpers to live price data
 * and renders the masonry feed, category strip, search box and the dynamic
 * "related to the current gold price" contextual card.
 *
 * Read-time is derived from a representative article word count at 200 wpm,
 * matching the catalog spec.
 */

export const READ_WPM = 200;

/**
 * Category registry. `id` is used in the URL hash + data attributes; labels are
 * bilingual. Order here drives the order of the filter strip.
 * @type {{ id: string, en: string, ar: string }[]}
 */
export const CATEGORIES = [
  { id: 'all', en: 'All', ar: 'الكل' },
  { id: 'price-analysis', en: 'Price Analysis', ar: 'تحليل الأسعار' },
  { id: 'market-news', en: 'Market News', ar: 'أخبار السوق' },
  { id: 'buying-guides', en: 'Buying Guides', ar: 'أدلة الشراء' },
  { id: 'zakat', en: 'Zakat & Islamic Finance', ar: 'الزكاة والتمويل الإسلامي' },
  { id: 'investment', en: 'Investment', ar: 'الاستثمار' },
];

/**
 * The insight feed. Each entry links to a real, existing content page so the
 * feed never ships broken links. `words` is a representative article length used
 * only to derive the displayed read time.
 * @type {Array<{
 *   id: string, category: string, href: string, icon: string, date: string,
 *   words: number, titleEn: string, titleAr: string, excerptEn: string, excerptAr: string
 * }>}
 */
export const INSIGHTS = [
  {
    id: 'aed-peg',
    category: 'price-analysis',
    href: 'content/guides/aed-peg-explained.html',
    icon: '🔗',
    date: '2026-05',
    words: 1180,
    titleEn: 'Understanding the AED Gold Peg',
    titleAr: 'فهم ربط الذهب بالدرهم الإماراتي',
    excerptEn:
      'The UAE Central Bank has pegged 1 USD = 3.6725 AED since 1997, so AED gold prices move exactly with USD spot — zero FX noise and one of the most price-stable gold markets globally.',
    excerptAr:
      'ثبّت مصرف الإمارات المركزي سعر الصرف عند 1 دولار = 3.6725 درهم منذ 1997، لذا تتحرك أسعار الذهب بالدرهم مع السعر الفوري بالدولار تماماً — دون تشويش في سعر الصرف.',
  },
  {
    id: 'uae-saudi-kuwait',
    category: 'price-analysis',
    href: 'content/guides/uae-vs-saudi-vs-kuwait-gold-prices/',
    icon: '🌍',
    date: '2026-05',
    words: 1460,
    titleEn: 'UAE vs Saudi vs Kuwait: Where Is Gold Cheapest?',
    titleAr: 'الإمارات مقابل السعودية مقابل الكويت: أين الذهب أرخص؟',
    excerptEn:
      'Spot gold is identical worldwide in USD — the real difference between GCC markets is VAT and typical making charges. We break down what actually moves the all-in price across the Gulf.',
    excerptAr:
      'السعر الفوري للذهب متطابق عالمياً بالدولار — والفارق الحقيقي بين أسواق الخليج هو ضريبة القيمة المضافة ورسوم الصنعة المعتادة. نشرح ما يحرّك السعر الإجمالي فعلياً.',
  },
  {
    id: 'inflation-hedge',
    category: 'price-analysis',
    href: 'content/guides/gold-as-inflation-hedge/',
    icon: '📈',
    date: '2026-04',
    words: 1520,
    titleEn: 'Is Gold Still an Inflation Hedge?',
    titleAr: 'هل لا يزال الذهب وقاءً من التضخم؟',
    excerptEn:
      'Gold has historically held purchasing power over long horizons, but the relationship with inflation is noisier than headlines suggest. Here is what the data shows for GCC savers.',
    excerptAr:
      'حافظ الذهب تاريخياً على القوة الشرائية على المدى الطويل، لكن علاقته بالتضخم أكثر تعقيداً مما توحي العناوين. إليك ما تظهره البيانات لمدخري الخليج.',
  },
  {
    id: 'market-hours',
    category: 'market-news',
    href: 'content/guides/gcc-market-hours.html',
    icon: '🕐',
    date: '2026-05',
    words: 940,
    titleEn: 'When Do Gold Markets Open? A GCC Guide',
    titleAr: 'متى تفتح أسواق الذهب؟ دليل الخليج',
    excerptEn:
      'Gold trades roughly 23.5 hours a day, Sunday 22:00 to Friday 21:00 UTC. Best liquidity arrives at the London open; the sharpest moves come when London and New York overlap.',
    excerptAr:
      'يُتداول الذهب نحو 23.5 ساعة يومياً، من الأحد 22:00 إلى الجمعة 21:00 بتوقيت غرينتش. أفضل سيولة عند افتتاح لندن، وأقوى التحركات عند تداخل لندن ونيويورك.',
  },
  {
    id: 'best-time-to-buy',
    category: 'buying-guides',
    href: 'content/guides/best-time-to-buy-gold/',
    icon: '🗓️',
    date: '2026-04',
    words: 1240,
    titleEn: 'The Best Time to Buy Gold in the Gulf',
    titleAr: 'أفضل وقت لشراء الذهب في الخليج',
    excerptEn:
      'There is no magic day, but there are smarter windows. We cover seasonal demand, festival premiums, weekday liquidity and how to use a freshness-checked tracker to time a purchase.',
    excerptAr:
      'لا يوجد يوم سحري، لكن هناك نوافذ أذكى. نغطي الطلب الموسمي وعلاوات المواسم وسيولة أيام الأسبوع وكيفية استخدام متتبّع موثّق لتوقيت الشراء.',
  },
  {
    id: '24k-vs-22k',
    category: 'buying-guides',
    href: 'content/guides/24k-vs-22k.html',
    icon: '⚖️',
    date: '2026-05',
    words: 1080,
    titleEn: '24K vs 22K: Which Is the Better Buy?',
    titleAr: '24 قيراط مقابل 22 قيراط: أيهما الأفضل للشراء؟',
    excerptEn:
      '24K is 99.9% pure — ideal for bars and coins. 22K (91.7%) is the Gulf jewellery standard. Price scales with purity, but retail premiums do not always follow.',
    excerptAr:
      'عيار 24 نقي بنسبة 99.9% — مثالي للسبائك والعملات. وعيار 22 (91.7%) هو معيار مجوهرات الخليج. يتناسب السعر مع النقاء، لكن علاوات التجزئة لا تتبعه دائماً.',
  },
  {
    id: 'spot-fake-gold',
    category: 'buying-guides',
    href: 'content/guides/how-to-spot-fake-gold/',
    icon: '🔍',
    date: '2026-04',
    words: 1320,
    titleEn: 'How to Spot Fake Gold Before You Buy',
    titleAr: 'كيف تكتشف الذهب المزيّف قبل الشراء',
    excerptEn:
      'Hallmarks, magnet tests, density checks and where to verify a dealer. A practical checklist so you never overpay for under-karat or plated pieces in a busy souk.',
    excerptAr:
      'الدمغات واختبار المغناطيس وفحص الكثافة وأين تتحقق من التاجر. قائمة عملية حتى لا تدفع أكثر مقابل قطع أقل عياراً أو مطلية في سوق مزدحم.',
  },
  {
    id: 'zakat',
    category: 'zakat',
    href: 'content/guides/zakat-gold-guide.html',
    icon: '🕌',
    date: '2026-05',
    words: 1150,
    titleEn: 'Zakat on Gold: A Practical Guide',
    titleAr: 'زكاة الذهب: دليل عملي',
    excerptEn:
      'When gold holdings reach the nisab threshold, 2.5% is due each lunar year. We explain the nisab in grams, what counts as zakatable gold, and how to calculate it at today’s price.',
    excerptAr:
      'عندما تبلغ حيازة الذهب نصاب الزكاة، تجب 2.5% كل عام هجري. نشرح النصاب بالجرامات، وما يُحتسب من الذهب الخاضع للزكاة، وكيفية حسابها بسعر اليوم.',
  },
  {
    id: 'bars-vs-coins',
    category: 'investment',
    href: 'content/guides/gold-bars-vs-coins/',
    icon: '🪙',
    date: '2026-05',
    words: 1210,
    titleEn: 'Gold Bars vs Coins: What Should You Hold?',
    titleAr: 'سبائك الذهب مقابل العملات: ماذا تقتني؟',
    excerptEn:
      'Bars carry lower premiums per gram; coins offer divisibility and recognisability. We compare liquidity, storage and resale spreads for GCC investors building a position.',
    excerptAr:
      'تحمل السبائك علاوات أقل لكل جرام، بينما توفّر العملات قابلية التجزئة وسهولة التعرّف. نقارن السيولة والتخزين وفروق إعادة البيع لمستثمري الخليج.',
  },
  {
    id: 'beginners',
    category: 'investment',
    href: 'content/guides/gold-investment-for-beginners/',
    icon: '🌱',
    date: '2026-04',
    words: 1390,
    titleEn: 'Gold Investment for Beginners',
    titleAr: 'الاستثمار في الذهب للمبتدئين',
    excerptEn:
      'A plain-language starting point: how gold is priced, the difference between bullion and jewellery, and how much of a portfolio gold typically represents for cautious savers.',
    excerptAr:
      'نقطة انطلاق بلغة بسيطة: كيف يُسعّر الذهب، والفرق بين السبائك والمجوهرات، وكم تمثّل نسبة الذهب عادةً في محفظة المدخر الحذر.',
  },
  {
    id: 'savings-plans',
    category: 'investment',
    href: 'content/guides/gold-savings-plans-gcc/',
    icon: '💰',
    date: '2026-04',
    words: 1100,
    titleEn: 'Gold Savings Plans in the GCC',
    titleAr: 'خطط ادخار الذهب في الخليج',
    excerptEn:
      'Monthly gold accumulation schemes are popular across the Gulf. We look at how they work, the fees to watch for, and whether dirham-cost averaging actually smooths your entry.',
    excerptAr:
      'تنتشر خطط تجميع الذهب الشهرية في الخليج. نستعرض آلية عملها والرسوم التي يجب الانتباه لها وما إذا كان متوسط التكلفة بالدرهم يلطّف نقطة الدخول فعلاً.',
  },
  {
    id: 'hallmarks',
    category: 'buying-guides',
    href: 'content/guides/gold-hallmarks-explained/',
    icon: '🏷️',
    date: '2026-03',
    words: 990,
    titleEn: 'Gold Hallmarks Explained',
    titleAr: 'شرح دمغات الذهب',
    excerptEn:
      'Those tiny stamps on a piece tell you its purity and origin. Learn to read 999, 916 and 750 marks so you know exactly what karat you are paying for.',
    excerptAr:
      'تخبرك تلك الأختام الصغيرة على القطعة بنقائها ومصدرها. تعلّم قراءة علامات 999 و916 و750 لتعرف بالضبط أي عيار تدفع مقابله.',
  },
];

/**
 * Localised field accessor for an insight.
 * @param {object} insight
 * @param {'title'|'excerpt'} field
 * @param {'en'|'ar'} lang
 * @returns {string}
 */
export function localized(insight, field, lang) {
  if (!insight) return '';
  const key = field + (lang === 'ar' ? 'Ar' : 'En');
  return insight[key] ?? insight[field + 'En'] ?? '';
}

/**
 * Estimate read time in whole minutes from a word count (min 1).
 * @param {number} words
 * @returns {number}
 */
export function estimateReadTime(words) {
  const n = Number(words);
  if (!Number.isFinite(n) || n <= 0) return 1;
  return Math.max(1, Math.round(n / READ_WPM));
}

/**
 * Bilingual read-time label, e.g. "4 min read" / "قراءة 4 دقائق".
 * @param {number} words
 * @param {'en'|'ar'} lang
 * @returns {string}
 */
export function readTimeLabel(words, lang) {
  const mins = estimateReadTime(words);
  return lang === 'ar' ? `قراءة ${mins} دقائق` : `${mins} min read`;
}

/**
 * Count insights per category id. `all` always reflects the full list length.
 * @param {Array} insights
 * @returns {Record<string, number>}
 */
export function categoryCounts(insights = INSIGHTS) {
  const counts = { all: insights.length };
  for (const item of insights) {
    counts[item.category] = (counts[item.category] ?? 0) + 1;
  }
  return counts;
}

/**
 * Filter the feed by category and a free-text query (matches title + excerpt in
 * the active language, case-insensitively).
 * @param {Array} insights
 * @param {{ category?: string, query?: string, lang?: 'en'|'ar' }} [opts]
 * @returns {Array}
 */
export function filterInsights(insights = INSIGHTS, opts = {}) {
  const category = opts.category || 'all';
  const lang = opts.lang === 'ar' ? 'ar' : 'en';
  const query = (opts.query || '').trim().toLowerCase();

  return insights.filter((item) => {
    if (category !== 'all' && item.category !== category) return false;
    if (!query) return true;
    const haystack =
      `${localized(item, 'title', lang)} ${localized(item, 'excerpt', lang)}`.toLowerCase();
    return haystack.includes(query);
  });
}

/**
 * Resolve a category id to its bilingual label.
 * @param {string} id
 * @param {'en'|'ar'} lang
 * @returns {string}
 */
export function categoryLabel(id, lang) {
  const cat = CATEGORIES.find((c) => c.id === id);
  if (!cat) return id;
  return lang === 'ar' ? cat.ar : cat.en;
}

/**
 * Build the dynamic "related to the current gold price" contextual card from a
 * week-over-week price change. Pure: callers pass the two prices; rendering and
 * live data wiring happen in the orchestrator.
 *
 * @param {number} weekAgoPrice  USD/oz roughly 7 days ago (0/NaN if unknown)
 * @param {number} currentPrice  current USD/oz spot (0/NaN if unknown)
 * @param {'en'|'ar'} lang
 * @returns {{ direction: 'up'|'down'|'flat'|'unknown', pct: number|null, title: string, body: string, href: string }}
 */
export function buildPriceContextCard(weekAgoPrice, currentPrice, lang = 'en') {
  const ar = lang === 'ar';
  const href = 'tracker.html';
  const a = Number(weekAgoPrice);
  const b = Number(currentPrice);

  if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0 || b <= 0) {
    return {
      direction: 'unknown',
      pct: null,
      title: ar ? 'سياق سعر الذهب اليوم' : "Today's gold price context",
      body: ar
        ? 'افتح المتتبّع المباشر لمتابعة تحرّك سعر الذهب خلال الأسبوع الماضي.'
        : 'Open the live tracker to see how gold has moved over the past week.',
      href,
    };
  }

  const pct = ((b - a) / a) * 100;
  const abs = Math.abs(pct).toFixed(2);
  let direction = 'flat';
  if (pct >= 0.05) direction = 'up';
  else if (pct <= -0.05) direction = 'down';

  let body;
  if (direction === 'up') {
    body = ar
      ? `ارتفع الذهب بنسبة ${abs}% عن الأسبوع الماضي. تحقّق من الأسعار المباشرة قبل الشراء.`
      : `Gold is up ${abs}% from last week. Check live prices before you buy.`;
  } else if (direction === 'down') {
    body = ar
      ? `انخفض الذهب بنسبة ${abs}% عن الأسبوع الماضي. قد تكون نافذة دخول أفضل.`
      : `Gold is down ${abs}% from last week — potentially a better entry window.`;
  } else {
    body = ar
      ? 'الذهب مستقر تقريباً مقارنةً بالأسبوع الماضي. راقب السعر الفوري المباشر.'
      : 'Gold is broadly flat versus last week. Keep an eye on the live spot.';
  }

  return {
    direction,
    pct,
    title: ar ? 'سياق سعر الذهب اليوم' : "Today's gold price context",
    body,
    href,
  };
}
