/**
 * Insights feed data model.
 *
 * A bilingual (EN/AR) catalogue of market-analysis and buyer-guide articles that
 * already exist in the repository. Each entry maps to a real, published page — no
 * placeholders. Word counts are taken from the article bodies so the read-time
 * estimate shown in the feed is genuine.
 *
 * Consumed by:
 *   - src/pages/insights/feed-core.js  (pure logic: filtering, search, counts)
 *   - src/pages/insights/feed.js       (DOM rendering)
 */

/**
 * Category registry. `key` is used in the URL hash + filtering; labels are bilingual.
 * `accent` drives the cover gradient + chip tint via a data attribute.
 */
export const INSIGHT_CATEGORIES = [
  { key: 'price-analysis', en: 'Price Analysis', ar: 'تحليل الأسعار', icon: '📈' },
  { key: 'market-news', en: 'Market News', ar: 'أخبار السوق', icon: '📰' },
  { key: 'buying-guides', en: 'Buying Guides', ar: 'أدلة الشراء', icon: '🛍️' },
  {
    key: 'zakat-islamic',
    en: 'Zakat & Islamic Finance',
    ar: 'الزكاة والتمويل الإسلامي',
    icon: '🕌',
  },
  { key: 'investment', en: 'Investment', ar: 'الاستثمار', icon: '💰' },
];

/**
 * Insight entries. `words` is the approximate article body word count (chrome
 * excluded) used to derive read time at 200 wpm. `featured: true` marks the hero.
 */
export const INSIGHTS = [
  {
    id: 'aed-peg-explained',
    category: 'price-analysis',
    url: 'content/guides/aed-peg-explained.html',
    date: '2026-05-12',
    words: 1665,
    icon: '🔗',
    featured: true,
    title: {
      en: 'Understanding the AED Gold Peg',
      ar: 'فهم ربط الدرهم بالذهب',
    },
    excerpt: {
      en: 'Since 1997 the UAE has pegged 1 USD = 3.6725 AED, so local gold prices track the dollar with zero FX noise. Here is why that makes the Emirates one of the most price-stable gold markets on earth.',
      ar: 'منذ عام 1997 يثبّت الدرهم عند 3.6725 لكل دولار، فتتبع أسعار الذهب المحلية الدولار دون تذبذب صرف. إليك لماذا يجعل ذلك الإمارات من أكثر أسواق الذهب استقراراً في العالم.',
    },
  },
  {
    id: 'uae-vs-saudi-vs-kuwait',
    category: 'price-analysis',
    url: 'content/guides/uae-vs-saudi-vs-kuwait-gold-prices/',
    date: '2026-05-08',
    words: 1616,
    icon: '🌍',
    title: {
      en: 'UAE vs Saudi vs Kuwait Gold Prices',
      ar: 'أسعار الذهب: الإمارات والسعودية والكويت',
    },
    excerpt: {
      en: 'Spot gold is identical across the GCC, yet final prices differ. We break down VAT, making charges and currency pegs to show where the same 22K gram really costs less.',
      ar: 'سعر الذهب الفوري واحد في الخليج، لكن الأسعار النهائية تختلف. نحلّل الضريبة وأجور الصياغة وربط العملة لنبيّن أين يكلّف غرام عيار 22 أقل فعلاً.',
    },
  },
  {
    id: 'gcc-market-hours',
    category: 'market-news',
    url: 'content/guides/gcc-market-hours.html',
    date: '2026-05-05',
    words: 1440,
    icon: '🕐',
    title: {
      en: 'When Do Gold Markets Open? A GCC Guide',
      ar: 'متى تفتح أسواق الذهب؟ دليل خليجي',
    },
    excerpt: {
      en: 'Gold trades almost 24 hours a day from Sunday night to Friday evening UTC. Learn the London and New York sessions that drive the most movement — and when GCC buyers see it land.',
      ar: 'يُتداول الذهب نحو 24 ساعة من مساء الأحد إلى مساء الجمعة بتوقيت غرينتش. تعرّف على جلستي لندن ونيويورك الأكثر تأثيراً ومتى يصل ذلك لمشتري الخليج.',
    },
  },
  {
    id: '24k-vs-22k',
    category: 'buying-guides',
    url: 'content/guides/24k-vs-22k.html',
    date: '2026-05-10',
    words: 1628,
    icon: '⚖️',
    title: {
      en: '24K vs 22K: Which Is the Better Buy?',
      ar: 'عيار 24 مقابل 22: أيهما أفضل للشراء؟',
    },
    excerpt: {
      en: '24K is 99.9% pure and ideal for bars and coins; 22K (91.7%) is the Gulf jewelry standard. Price scales with purity but retail premiums do not — here is how to choose.',
      ar: 'عيار 24 نقي بنسبة 99.9% ومثالي للسبائك والعملات، بينما عيار 22 (91.7%) هو معيار المجوهرات الخليجية. السعر يتبع النقاء لكن هوامش التجزئة لا — إليك كيف تختار.',
    },
  },
  {
    id: 'best-time-to-buy-gold',
    category: 'buying-guides',
    url: 'content/guides/best-time-to-buy-gold/',
    date: '2026-04-28',
    words: 919,
    icon: '🗓️',
    title: {
      en: 'Best Time to Buy Gold: Seasonal Patterns',
      ar: 'أفضل وقت لشراء الذهب: الأنماط الموسمية',
    },
    excerpt: {
      en: 'Wedding season, festival demand and summer lulls all leave fingerprints on the gold price. We look at the recurring patterns and what they mean for timing a GCC purchase.',
      ar: 'موسم الأعراس والطلب في الأعياد وركود الصيف كلها تترك بصمات على سعر الذهب. نستعرض الأنماط المتكررة وما تعنيه لتوقيت الشراء في الخليج.',
    },
  },
  {
    id: 'how-to-spot-fake-gold',
    category: 'buying-guides',
    url: 'content/guides/how-to-spot-fake-gold/',
    date: '2026-04-30',
    words: 1475,
    icon: '🔍',
    title: {
      en: 'How to Spot Fake Gold: 8 Home Tests',
      ar: 'كيف تكتشف الذهب المزيّف: 8 اختبارات منزلية',
    },
    excerpt: {
      en: 'From the magnet test to hallmark checks and density math, here are eight practical ways to verify gold before you buy — and the red flags that should make you walk away.',
      ar: 'من اختبار المغناطيس إلى فحص الدمغات وحساب الكثافة، إليك ثماني طرق عملية للتحقق من الذهب قبل الشراء — والإشارات التي يجب أن تدفعك للانصراف.',
    },
  },
  {
    id: 'gold-hallmarks-explained',
    category: 'buying-guides',
    url: 'content/guides/gold-hallmarks-explained/',
    date: '2026-04-22',
    words: 939,
    icon: '🏷️',
    title: {
      en: 'Gold Hallmarks Explained',
      ar: 'شرح دمغات الذهب',
    },
    excerpt: {
      en: 'The tiny stamps on your gold tell you its purity, origin and assay office. Learn to read 916, 750 and 999 marks so you always know exactly what you are holding.',
      ar: 'الدمغات الصغيرة على ذهبك تخبرك بنقائه ومصدره ومكتب الفحص. تعلّم قراءة علامات 916 و750 و999 لتعرف دائماً ما تمسكه بالضبط.',
    },
  },
  {
    id: '24k-22k-18k',
    category: 'buying-guides',
    url: 'content/guides/24k-vs-22k-vs-18k-gold/',
    date: '2026-04-20',
    words: 1062,
    icon: '🧩',
    title: {
      en: '24K vs 22K vs 18K: Which Karat to Buy',
      ar: 'عيار 24 و22 و18: أي عيار تشتري',
    },
    excerpt: {
      en: 'A side-by-side of the three karats that dominate GCC counters — purity, durability, resale value and the buyer each one suits best.',
      ar: 'مقارنة مباشرة بين العيارات الثلاثة الأكثر شيوعاً في الخليج — النقاء والمتانة وقيمة إعادة البيع والمشتري الأنسب لكل منها.',
    },
  },
  {
    id: 'buying-online-vs-in-store',
    category: 'buying-guides',
    url: 'content/guides/buying-gold-online-vs-in-store/',
    date: '2026-04-18',
    words: 717,
    icon: '🛒',
    title: {
      en: 'Buying Gold Online vs In-Store',
      ar: 'شراء الذهب عبر الإنترنت أم من المتجر',
    },
    excerpt: {
      en: 'Online dealers often beat souk premiums, but in-store buying lets you inspect and haggle. We weigh the pros, cons and safety checks for each route.',
      ar: 'غالباً ما تتفوق المتاجر الإلكترونية على هوامش السوق، لكن الشراء من المتجر يتيح المعاينة والمساومة. نوازن المزايا والعيوب وفحوصات الأمان لكل طريق.',
    },
  },
  {
    id: 'zakat-gold-guide',
    category: 'zakat-islamic',
    url: 'content/guides/zakat-gold-guide.html',
    date: '2026-05-02',
    words: 1880,
    icon: '🕌',
    title: {
      en: 'Zakat on Gold: A Complete Guide',
      ar: 'زكاة الذهب: دليل شامل',
    },
    excerpt: {
      en: 'When does gold reach nisab, how is the 2.5% calculated, and does jewelry you wear count? A clear, practical walk-through for GCC households.',
      ar: 'متى يبلغ الذهب النصاب، وكيف تُحسب نسبة 2.5%، وهل تُحتسب المجوهرات التي تُلبس؟ شرح عملي واضح للأسر في الخليج.',
    },
  },
  {
    id: 'invest-in-gold-gcc',
    category: 'investment',
    url: 'content/guides/invest-in-gold-gcc.html',
    date: '2026-05-14',
    words: 2179,
    icon: '🏦',
    title: {
      en: 'How to Invest in Gold in the GCC',
      ar: 'كيف تستثمر في الذهب في الخليج',
    },
    excerpt: {
      en: 'Bars, coins, savings plans or ETFs? A structured framework for building a gold position in the Gulf — including costs, storage and exit liquidity.',
      ar: 'سبائك أم عملات أم خطط ادخار أم صناديق متداولة؟ إطار منظّم لبناء مركز ذهبي في الخليج — يشمل التكاليف والتخزين وسيولة الخروج.',
    },
  },
  {
    id: 'gold-as-inflation-hedge',
    category: 'investment',
    url: 'content/guides/gold-as-inflation-hedge/',
    date: '2026-05-06',
    words: 860,
    icon: '🛡️',
    title: {
      en: 'Gold as an Inflation Hedge: Does It Work?',
      ar: 'الذهب كتحوّط من التضخم: هل ينجح؟',
    },
    excerpt: {
      en: 'Gold is famous as an inflation shield, but the historical record is more nuanced. We look at when it has protected wealth — and when it has lagged.',
      ar: 'يشتهر الذهب كدرع ضد التضخم، لكن السجل التاريخي أكثر تعقيداً. نستعرض متى حمى الثروة — ومتى تخلّف عن الركب.',
    },
  },
  {
    id: 'gold-bars-vs-coins',
    category: 'investment',
    url: 'content/guides/gold-bars-vs-coins/',
    date: '2026-04-26',
    words: 732,
    icon: '🪙',
    title: {
      en: 'Gold Bars vs Coins for Investment',
      ar: 'سبائك الذهب مقابل العملات للاستثمار',
    },
    excerpt: {
      en: 'Bars carry the lowest premium per gram; coins offer liquidity and collectability. Which one fits your budget and exit plan?',
      ar: 'تحمل السبائك أدنى هامش لكل غرام، بينما توفّر العملات سيولة وقابلية للجمع. أيهما يناسب ميزانيتك وخطة خروجك؟',
    },
  },
  {
    id: 'gold-investment-for-beginners',
    category: 'investment',
    url: 'content/guides/gold-investment-for-beginners/',
    date: '2026-04-24',
    words: 719,
    icon: '🌱',
    title: {
      en: 'Gold Investment for Beginners',
      ar: 'الاستثمار في الذهب للمبتدئين',
    },
    excerpt: {
      en: 'New to gold? Start here. We cover the simplest first steps, how much to allocate and the common mistakes first-time GCC buyers make.',
      ar: 'جديد على الذهب؟ ابدأ من هنا. نغطّي أبسط الخطوات الأولى وكم تخصّص والأخطاء الشائعة لدى مشتري الخليج لأول مرة.',
    },
  },
  {
    id: 'gold-savings-plans-gcc',
    category: 'investment',
    url: 'content/guides/gold-savings-plans-gcc/',
    date: '2026-05-01',
    words: 1612,
    icon: '📊',
    title: {
      en: 'Gold Savings Plans in the GCC',
      ar: 'خطط ادخار الذهب في الخليج',
    },
    excerpt: {
      en: 'Banks and apps now let you buy gold monthly in small amounts. We compare the leading GCC savings schemes on fees, redemption and flexibility.',
      ar: 'تتيح البنوك والتطبيقات الآن شراء الذهب شهرياً بمبالغ صغيرة. نقارن أبرز خطط الادخار الخليجية من حيث الرسوم والاسترداد والمرونة.',
    },
  },
];
