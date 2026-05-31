/**
 * Insights feed content model.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Pure data — no DOM, no imports. Consumed by:
 *   - src/lib/insights-feed-core.js  (filter / search / read-time logic)
 *   - src/components/insights-feed.js (rendering)
 *
 * Each insight links to an existing evergreen guide already shipped under
 * `content/guides/` so there are no dead links or placeholder content.
 *
 * Schema (per insight):
 *   id        unique slug-style id (also used as the DOM key)
 *   category  one of INSIGHT_CATEGORIES[].id (never 'all')
 *   href      relative URL to the full guide
 *   dateIso   publish date 'YYYY-MM-DD' (used for sort + display)
 *   words     approximate word count of the linked article (drives read time)
 *   icon      short emoji used as the card's inline illustration
 *   featured  optional boolean — the single hero card at the top of the feed
 *   title     { en, ar }
 *   excerpt   { en, ar }  — two-line summary, plain text
 */

/**
 * Category taxonomy. `all` is a synthetic bucket handled by the filter UI and
 * must stay first. Every other id must be referenced by at least one insight.
 * @type {{ id: string, en: string, ar: string }[]}
 */
export const INSIGHT_CATEGORIES = [
  { id: 'all', en: 'All', ar: 'الكل' },
  { id: 'price-analysis', en: 'Price Analysis', ar: 'تحليل الأسعار' },
  { id: 'market-news', en: 'Market News', ar: 'أخبار السوق' },
  { id: 'buying-guides', en: 'Buying Guides', ar: 'أدلة الشراء' },
  { id: 'zakat', en: 'Zakat & Islamic Finance', ar: 'الزكاة والتمويل الإسلامي' },
  { id: 'investment', en: 'Investment', ar: 'الاستثمار' },
];

/**
 * The insight library. Newest first is not required — the feed sorts by date.
 * @type {Array<object>}
 */
export const INSIGHTS = [
  {
    id: 'spot-vs-retail',
    category: 'price-analysis',
    href: 'content/spot-vs-retail-gold-price/',
    dateIso: '2026-04-18',
    words: 760,
    icon: '⚖️',
    featured: true,
    title: {
      en: 'Why UAE Gold Prices Differ from Global Spot',
      ar: 'لماذا تختلف أسعار الذهب في الإمارات عن السعر العالمي الفوري',
    },
    excerpt: {
      en: 'The spot price is the global benchmark for pure gold. Retail rates add making charges, store margin and logistics — here is how to read the gap.',
      ar: 'السعر الفوري هو المرجع العالمي للذهب الخالص، بينما تضيف أسعار التجزئة رسوم الصنعة وهامش المتجر والشحن — إليك كيفية قراءة الفارق.',
    },
  },
  {
    id: 'aed-peg',
    category: 'price-analysis',
    href: 'content/guides/aed-peg-explained.html',
    dateIso: '2026-04-12',
    words: 540,
    icon: '🇦🇪',
    title: {
      en: 'Understanding the AED Gold Peg',
      ar: 'فهم ربط الدرهم بالذهب',
    },
    excerpt: {
      en: 'The UAE has pegged 1 USD = 3.6725 AED since 1997, so dirham gold prices track the dollar with zero FX noise — one of the most stable gold markets globally.',
      ar: 'ثبّتت الإمارات سعر الصرف عند 1 دولار = 3.6725 درهم منذ عام 1997، لذا تتبع أسعار الذهب بالدرهم الدولار دون تقلبات صرف — أحد أكثر أسواق الذهب استقراراً عالمياً.',
    },
  },
  {
    id: 'gcc-price-compare',
    category: 'price-analysis',
    href: 'content/guides/uae-vs-saudi-vs-kuwait-gold-prices/',
    dateIso: '2026-03-29',
    words: 690,
    icon: '🌍',
    title: {
      en: 'UAE vs Saudi vs Kuwait: Where Is Gold Cheapest?',
      ar: 'الإمارات مقابل السعودية مقابل الكويت: أين الذهب الأرخص؟',
    },
    excerpt: {
      en: 'Spot gold is identical across the GCC in USD. The real difference comes from VAT and making charges — we break down the all-in cost country by country.',
      ar: 'السعر الفوري للذهب متطابق في دول الخليج بالدولار، والفارق الحقيقي يأتي من ضريبة القيمة المضافة ورسوم الصنعة — نوضح التكلفة الإجمالية لكل دولة.',
    },
  },
  {
    id: 'market-hours',
    category: 'market-news',
    href: 'content/guides/gcc-market-hours.html',
    dateIso: '2026-03-22',
    words: 480,
    icon: '🕑',
    title: {
      en: 'When Do Gold Markets Open? A GCC Guide',
      ar: 'متى تفتح أسواق الذهب؟ دليل الخليج',
    },
    excerpt: {
      en: 'Gold trades almost 24 hours a day, Sunday 22:00 to Friday 21:00 UTC. Liquidity peaks at the London open and during the London–New York overlap.',
      ar: 'يُتداول الذهب نحو 24 ساعة يومياً من الأحد 22:00 حتى الجمعة 21:00 بالتوقيت العالمي، وتبلغ السيولة ذروتها عند افتتاح لندن وتداخل لندن ونيويورك.',
    },
  },
  {
    id: 'best-time-to-buy',
    category: 'buying-guides',
    href: 'content/guides/best-time-to-buy-gold/',
    dateIso: '2026-03-15',
    words: 720,
    icon: '📅',
    title: {
      en: 'Is There a Best Time to Buy Gold?',
      ar: 'هل هناك أفضل وقت لشراء الذهب؟',
    },
    excerpt: {
      en: 'Seasonality, wedding demand and the USD cycle all nudge prices. Use the tracker’s 7-day average to judge whether today sits above or below the recent range.',
      ar: 'تؤثر المواسم وطلب الأعراس ودورة الدولار على الأسعار. استخدم متوسط 7 أيام في المتتبع لمعرفة ما إذا كان سعر اليوم أعلى أم أقل من النطاق الأخير.',
    },
  },
  {
    id: '24k-vs-22k',
    category: 'buying-guides',
    href: 'content/guides/24k-vs-22k-vs-18k-gold/',
    dateIso: '2026-03-08',
    words: 650,
    icon: '🔶',
    title: {
      en: '24K vs 22K vs 18K: Which Karat to Buy?',
      ar: '24 مقابل 22 مقابل 18 قيراطاً: أي عيار تشتري؟',
    },
    excerpt: {
      en: '24K is 99.9% pure and best for bars and coins; 22K (91.7%) is the Gulf jewellery standard; 18K is more durable for everyday wear. Price scales with purity.',
      ar: 'عيار 24 نقي بنسبة 99.9% وهو الأفضل للسبائك والعملات، وعيار 22 (91.7%) هو معيار مجوهرات الخليج، وعيار 18 أكثر متانة للاستخدام اليومي. يتناسب السعر مع النقاء.',
    },
  },
  {
    id: 'spot-fake-gold',
    category: 'buying-guides',
    href: 'content/guides/how-to-spot-fake-gold/',
    dateIso: '2026-02-26',
    words: 610,
    icon: '🔍',
    title: {
      en: 'How to Spot Fake Gold Before You Buy',
      ar: 'كيف تكتشف الذهب المزيّف قبل الشراء',
    },
    excerpt: {
      en: 'Hallmarks, the magnet test, density checks and trusted retailers. Simple ways to verify purity and avoid overpaying for plated or under-karat pieces.',
      ar: 'الدمغات واختبار المغناطيس وفحص الكثافة والمتاجر الموثوقة — طرق بسيطة للتحقق من النقاء وتجنب دفع أكثر من اللازم للقطع المطلية أو منخفضة العيار.',
    },
  },
  {
    id: 'hallmarks',
    category: 'buying-guides',
    href: 'content/guides/gold-hallmarks-explained/',
    dateIso: '2026-02-19',
    words: 520,
    icon: '🏷️',
    title: {
      en: 'Gold Hallmarks Explained',
      ar: 'شرح دمغات الذهب',
    },
    excerpt: {
      en: 'What 916, 750 and 999 stamps really mean, how Dubai’s assaying works, and why a clear hallmark protects your resale value.',
      ar: 'ماذا تعني دمغات 916 و750 و999 حقاً، وكيف يعمل دمغ دبي، ولماذا تحمي الدمغة الواضحة قيمة إعادة البيع.',
    },
  },
  {
    id: 'zakat-gold',
    category: 'zakat',
    href: 'content/guides/zakat-gold-guide.html',
    dateIso: '2026-02-10',
    words: 700,
    icon: '🌙',
    title: {
      en: 'Zakat on Gold: A Practical Guide',
      ar: 'زكاة الذهب: دليل عملي',
    },
    excerpt: {
      en: 'Once your gold passes the nisab threshold (about 85g) and a lunar year passes, 2.5% is due. Use live prices to value holdings accurately at the moment of calculation.',
      ar: 'عندما يبلغ ذهبك النصاب (نحو 85 جراماً) ويمر عليه عام هجري، تجب فيه الزكاة بنسبة 2.5%. استخدم الأسعار المباشرة لتقييم ممتلكاتك بدقة عند الحساب.',
    },
  },
  {
    id: 'bars-vs-coins',
    category: 'investment',
    href: 'content/guides/gold-bars-vs-coins/',
    dateIso: '2026-02-02',
    words: 640,
    icon: '🪙',
    title: {
      en: 'Gold Bars vs Coins for Investors',
      ar: 'سبائك الذهب مقابل العملات للمستثمرين',
    },
    excerpt: {
      en: 'Bars carry lower premiums per gram and suit larger sums; coins are more liquid and divisible. Both beat jewellery for pure investment exposure.',
      ar: 'تحمل السبائك علاوة أقل لكل جرام وتناسب المبالغ الكبيرة، بينما العملات أكثر سيولة وقابلية للتجزئة. كلاهما أفضل من المجوهرات للاستثمار الخالص.',
    },
  },
  {
    id: 'inflation-hedge',
    category: 'investment',
    href: 'content/guides/gold-as-inflation-hedge/',
    dateIso: '2026-01-24',
    words: 680,
    icon: '📈',
    title: {
      en: 'Is Gold Really an Inflation Hedge?',
      ar: 'هل الذهب حقاً وقاية من التضخم؟',
    },
    excerpt: {
      en: 'Over long horizons gold has preserved purchasing power, but it is volatile year to year. We look at the evidence and how to size an allocation.',
      ar: 'على المدى الطويل حافظ الذهب على القوة الشرائية، لكنه متقلب من عام لآخر. نستعرض الأدلة وكيفية تحديد حجم التخصيص.',
    },
  },
  {
    id: 'savings-plans',
    category: 'investment',
    href: 'content/guides/gold-savings-plans-gcc/',
    dateIso: '2026-01-15',
    words: 560,
    icon: '💳',
    title: {
      en: 'Gold Savings Plans in the GCC',
      ar: 'خطط ادخار الذهب في دول الخليج',
    },
    excerpt: {
      en: 'Jewellers across the Gulf offer instalment schemes to accumulate gold over time. We weigh the convenience against making charges and lock-in terms.',
      ar: 'يقدم تجار المجوهرات في الخليج خطط أقساط لتجميع الذهب بمرور الوقت. نوازن بين الراحة ورسوم الصنعة وشروط الالتزام.',
    },
  },
];
