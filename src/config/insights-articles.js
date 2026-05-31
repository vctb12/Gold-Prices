/**
 * Insights articles configuration.
 * Each article defines metadata for the insights grid cards.
 * Categories: price-analysis, market-news, buying-guide, islamic-finance, investment, education
 */

export const INSIGHTS_ARTICLES = [
  {
    id: 'aed-peg',
    category: 'price-analysis',
    title: { en: 'Understanding the AED Gold Peg', ar: 'فهم ربط الدرهم بالذهب' },
    excerpt: {
      en: 'The UAE Central Bank has pegged 1 USD = 3.6725 AED since 1997. This means AED gold prices move exactly with USD prices — with zero FX noise.',
      ar: 'ربط البنك المركزي الإماراتي 1 دولار = 3.6725 درهم منذ 1997. هذا يعني أن أسعار الذهب بالدرهم تتحرك تماماً مع الدولار — بدون تقلبات صرف.',
    },
    href: 'content/guides/aed-peg-explained.html',
    date: '2026-04',
    wordCount: 1200,
    pinned: false,
  },
  {
    id: '24k-vs-22k',
    category: 'education',
    title: {
      en: '24K vs 22K: Which is the Better Buy?',
      ar: '24 قيراط مقابل 22: أيهما أفضل للشراء؟',
    },
    excerpt: {
      en: "24K is 99.9% pure gold — ideal for bars and coins. 22K (91.7%) is Gulf jewelry standard. The price scales with purity, but retail premiums don't always.",
      ar: '24 قيراط هو 99.9% ذهب نقي — مثالي للسبائك والعملات. 22 قيراط (91.7%) هو معيار مجوهرات الخليج. السعر يتبع النقاء ولكن ليس دائماً.',
    },
    href: 'content/guides/24k-vs-22k.html',
    date: '2026-03',
    wordCount: 950,
    pinned: false,
  },
  {
    id: 'gcc-market-hours',
    category: 'market-news',
    title: {
      en: 'When Do Gold Markets Open? A GCC Guide',
      ar: 'متى تفتح أسواق الذهب؟ دليل دول الخليج',
    },
    excerpt: {
      en: 'Gold trades 23.5 hours/day, Sun 22:00 – Fri 21:00 UTC. Best liquidity at London open (07:00 UTC). Most volatile when London and New York overlap.',
      ar: 'يتم تداول الذهب 23.5 ساعة يومياً. أفضل سيولة عند افتتاح لندن (07:00 UTC). الأكثر تقلباً عند تداخل لندن ونيويورك.',
    },
    href: 'content/guides/gcc-market-hours.html',
    date: '2026-03',
    wordCount: 800,
    pinned: false,
  },
  {
    id: 'zakat-gold',
    category: 'islamic-finance',
    title: {
      en: 'Zakat on Gold: Complete Calculation Guide',
      ar: 'زكاة الذهب: دليل الحساب الكامل',
    },
    excerpt: {
      en: 'Zakat is due on gold holdings exceeding 85 grams (the nisab). The rate is 2.5% of total gold value annually. Learn how to calculate with live prices.',
      ar: 'تجب الزكاة على ملكية الذهب التي تتجاوز 85 غراماً (النصاب). المعدل هو 2.5% من إجمالي قيمة الذهب سنوياً.',
    },
    href: 'content/guides/zakat-gold-guide.html',
    date: '2026-04',
    wordCount: 1400,
    pinned: false,
  },
  {
    id: 'best-time-buy',
    category: 'buying-guide',
    title: { en: 'Best Time to Buy Gold in the GCC', ar: 'أفضل وقت لشراء الذهب في دول الخليج' },
    excerpt: {
      en: 'Gold prices fluctuate throughout the day and week. Historically, prices tend to dip during Asian trading hours and rally during London sessions. Seasonal patterns also exist.',
      ar: 'تتقلب أسعار الذهب خلال اليوم والأسبوع. تاريخياً، تميل الأسعار للانخفاض خلال ساعات التداول الآسيوية والارتفاع خلال جلسات لندن.',
    },
    href: 'content/guides/best-time-to-buy-gold/index.html',
    date: '2026-05',
    wordCount: 1100,
    pinned: false,
  },
  {
    id: 'making-charges',
    category: 'buying-guide',
    title: {
      en: "Making Charges Explained: What You're Really Paying",
      ar: 'رسوم الصنعة: ما الذي تدفعه فعلاً',
    },
    excerpt: {
      en: 'Making charges in the GCC range from 3% for simple chains to 25%+ for intricate designs. Understanding these charges is key to comparing jewelry prices across shops.',
      ar: 'تتراوح رسوم الصنعة في دول الخليج من 3% للسلاسل البسيطة إلى 25%+ للتصاميم المعقدة. فهم هذه الرسوم أساسي لمقارنة الأسعار.',
    },
    href: 'content/guides/buying-guide.html',
    date: '2026-04',
    wordCount: 900,
    pinned: false,
  },
  {
    id: 'gold-investment',
    category: 'investment',
    title: {
      en: 'Gold Investment for Beginners: GCC Edition',
      ar: 'الاستثمار في الذهب للمبتدئين: دول الخليج',
    },
    excerpt: {
      en: 'Gold is the oldest store of value. For GCC residents, the zero-tax environment and proximity to gold markets make it uniquely accessible. Bars, coins, ETFs, or jewelry?',
      ar: 'الذهب هو أقدم مخزن للقيمة. لسكان دول الخليج، البيئة المعفاة من الضرائب والقرب من أسواق الذهب يجعلانه متاحاً بشكل فريد.',
    },
    href: 'content/guides/gold-investment-for-beginners/index.html',
    date: '2026-05',
    wordCount: 1600,
    pinned: false,
  },
  {
    id: 'bars-vs-coins',
    category: 'investment',
    title: {
      en: 'Gold Bars vs Coins: Which Has Better Value?',
      ar: 'سبائك الذهب مقابل العملات: أيهما أفضل قيمة؟',
    },
    excerpt: {
      en: 'Bars have lower premiums over spot (1-3%) but coins offer better liquidity and divisibility. For large holdings, bars win. For flexibility, coins are preferred.',
      ar: 'السبائك لها علاوات أقل فوق السعر الفوري (1-3%) لكن العملات توفر سيولة وقابلية تقسيم أفضل.',
    },
    href: 'content/guides/gold-bars-vs-coins/index.html',
    date: '2026-03',
    wordCount: 1050,
    pinned: false,
  },
  {
    id: 'hallmarks',
    category: 'education',
    title: {
      en: 'Gold Hallmarks Explained: Reading Your Jewelry',
      ar: 'علامات الذهب: كيف تقرأ مجوهراتك',
    },
    excerpt: {
      en: 'Every piece of genuine gold jewelry carries a hallmark stamp: 750 (18K), 875 (21K), 916 (22K), or 999 (24K). Learn what each number means and how to verify authenticity.',
      ar: 'كل قطعة مجوهرات ذهبية أصلية تحمل ختم: 750 (18 قيراط)، 875 (21)، 916 (22)، أو 999 (24). تعلم معنى كل رقم.',
    },
    href: 'content/guides/gold-hallmarks-explained/index.html',
    date: '2026-02',
    wordCount: 850,
    pinned: false,
  },
  {
    id: 'inflation-hedge',
    category: 'investment',
    title: {
      en: 'Gold as an Inflation Hedge: Does It Still Work?',
      ar: 'الذهب كملاذ ضد التضخم: هل لا يزال يعمل؟',
    },
    excerpt: {
      en: 'Over 50 years, gold has outpaced global inflation. But short-term, it can underperform. The key is holding period: gold works best over 5+ year horizons.',
      ar: 'على مدى 50 عاماً، تفوق الذهب على التضخم العالمي. لكن على المدى القصير قد يكون أداؤه أقل. المفتاح هو فترة الاحتفاظ.',
    },
    href: 'content/guides/gold-as-inflation-hedge/index.html',
    date: '2026-04',
    wordCount: 1300,
    pinned: false,
  },
  {
    id: 'uae-vs-saudi-kuwait',
    category: 'price-analysis',
    title: {
      en: "UAE vs Saudi vs Kuwait Gold Prices: Where's Cheapest?",
      ar: 'أسعار الذهب: الإمارات مقابل السعودية مقابل الكويت',
    },
    excerpt: {
      en: 'UAE has 5% VAT, Saudi 15%, Kuwait 0%. But making charges vary wildly. We compare actual retail costs across the three biggest GCC gold markets.',
      ar: 'الإمارات بضريبة 5%، السعودية 15%، الكويت 0%. لكن رسوم الصنعة تختلف كثيراً. نقارن التكاليف الفعلية.',
    },
    href: 'content/guides/uae-vs-saudi-vs-kuwait-gold-prices/index.html',
    date: '2026-05',
    wordCount: 1450,
    pinned: false,
  },
  {
    id: 'spot-fake-gold',
    category: 'education',
    title: {
      en: 'How to Spot Fake Gold: 7 Tests You Can Do at Home',
      ar: 'كيف تكتشف الذهب المزيف: 7 اختبارات منزلية',
    },
    excerpt: {
      en: 'Magnet test, density test, ceramic scratch, nitric acid, hallmark inspection, skin reaction, and sound test. Protect yourself from counterfeit gold jewelry.',
      ar: 'اختبار المغناطيس، الكثافة، خدش السيراميك، حمض النيتريك، فحص الختم، تفاعل الجلد، واختبار الصوت. احمِ نفسك من المجوهرات المزيفة.',
    },
    href: 'content/guides/how-to-spot-fake-gold/index.html',
    date: '2026-02',
    wordCount: 1200,
    pinned: false,
  },
  {
    id: 'gold-savings-gcc',
    category: 'islamic-finance',
    title: {
      en: 'Gold Savings Plans in the GCC: Halal Options',
      ar: 'خطط ادخار الذهب في الخليج: خيارات حلال',
    },
    excerpt: {
      en: 'Several GCC banks offer Sharia-compliant gold savings accounts. Monthly purchase programs let you accumulate gold gradually with no making charges.',
      ar: 'تقدم عدة بنوك خليجية حسابات ادخار ذهب متوافقة مع الشريعة. برامج الشراء الشهرية تتيح لك تجميع الذهب تدريجياً.',
    },
    href: 'content/guides/gold-savings-plans-gcc/index.html',
    date: '2026-05',
    wordCount: 1100,
    pinned: false,
  },
  {
    id: 'online-vs-store',
    category: 'buying-guide',
    title: {
      en: 'Buying Gold Online vs In-Store: Pros & Cons',
      ar: 'شراء الذهب عبر الإنترنت مقابل المتجر',
    },
    excerpt: {
      en: 'Online dealers often have lower premiums but you lose the tactile inspection. In-store gives you immediate possession and verification. Which suits your needs?',
      ar: 'التجار عبر الإنترنت غالباً لديهم علاوات أقل لكنك تفقد الفحص المباشر. المتجر يمنحك الحيازة الفورية والتحقق.',
    },
    href: 'content/guides/buying-gold-online-vs-in-store/index.html',
    date: '2026-04',
    wordCount: 1000,
    pinned: false,
  },
  {
    id: 'karat-comparison',
    category: 'education',
    title: {
      en: 'Complete Karat Guide: 18K, 21K, 22K, 24K',
      ar: 'دليل القيراط الكامل: 18، 21، 22، 24',
    },
    excerpt: {
      en: 'Each karat has a specific purity percentage and use case. 18K for durable everyday jewelry, 21K for value balance, 22K for Gulf tradition, 24K for investment.',
      ar: 'كل قيراط له نسبة نقاء واستخدام محدد. 18 للمجوهرات اليومية، 21 لتوازن القيمة، 22 لتقاليد الخليج، 24 للاستثمار.',
    },
    href: 'content/guides/gold-karat-comparison.html',
    date: '2026-03',
    wordCount: 750,
    pinned: false,
  },
];

/**
 * Category definitions with display labels.
 */
export const INSIGHT_CATEGORIES = {
  all: { en: 'All', ar: 'الكل' },
  'price-analysis': { en: 'Price Analysis', ar: 'تحليل الأسعار' },
  'market-news': { en: 'Market News', ar: 'أخبار السوق' },
  'buying-guide': { en: 'Buying Guides', ar: 'أدلة الشراء' },
  'islamic-finance': { en: 'Zakat & Islamic Finance', ar: 'الزكاة والتمويل الإسلامي' },
  investment: { en: 'Investment', ar: 'استثمار' },
  education: { en: 'Education', ar: 'تعليم' },
};

/**
 * Category to CSS modifier class mapping for tag styling.
 */
export const CATEGORY_TAG_CLASS = {
  'price-analysis': 'insight-tag--analysis',
  'market-news': 'insight-tag--regional',
  'buying-guide': 'insight-tag--guide',
  'islamic-finance': 'insight-tag--islamic',
  investment: 'insight-tag--analysis',
  education: 'insight-tag--education',
};

/**
 * Calculate reading time from word count (200 wpm average).
 */
export function getReadTime(wordCount) {
  return Math.max(1, Math.ceil(wordCount / 200));
}
