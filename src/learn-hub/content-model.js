/**
 * Shared learn-hub article definitions and localized copy.
 *
 * The model keeps article structure stable while all user-visible copy lives behind
 * translation keys so learn, methodology, and insights can converge on one renderer.
 */

const LEGACY_LEARN_COPY = Object.freeze({
  en: {
    'learn-h1': 'Learn About Gold',
    'learn-sub': 'Karats · Pricing · AED Peg · Zakat · Hallmarking',
    'toc-label': 'Contents',
    'toc-karats': 'Gold Karats',
    'toc-pricing': 'Pricing',
    'toc-aed': 'AED Peg',
    'toc-zakat': 'Zakat',
    'toc-hallmark': 'Hallmarking',
    'toc-faq': 'FAQ',
    'karats-h2': 'Gold Karats Explained',
    'karats-intro':
      'A karat (K or kt) is the unit used to measure the purity of gold. Pure gold is 24 karats (24K). Most jewellery uses an alloy — a mixture of gold with other metals — to improve durability and manage cost.',
    'th-karat': 'Karat',
    'th-purity': 'Purity',
    'th-gold-content': 'Gold Content',
    'th-common-use': 'Common Use',
    'use-24': 'Investment bars & coins, electronics',
    'use-22': 'Gulf jewellery, bridal gold (UAE, SA)',
    'use-21': 'Levant & Egyptian jewellery',
    'use-18': 'Fine jewellery, diamond settings',
    'use-14': 'Western jewellery, fashion pieces',
    'use-9': 'UK & Australian budget jewellery',
    'karats-why-h3': 'Why does karat matter?',
    'karats-why':
      'Higher karat gold is softer and more vibrant yellow in color, but scratches more easily. Lower karat alloys are harder, more durable, and can be tinted white, rose, or green depending on the metals added.',
    'callout-formula-title': 'Price Formula',
    'callout-formula-body':
      'Gold price per gram = (XAU/USD spot ÷ 31.1035) × (karat ÷ 24) × FX rate',
    'pricing-h2': 'How Gold Prices Work',
    'pricing-intro':
      'The gold price you see quoted globally is the spot price — the current market price for immediate delivery of one troy ounce of 99.9% pure gold, in US Dollars (XAU/USD).',
    'pricing-markets-h3': 'Where is the price set?',
    'callout-spot-title': 'Our Price Data',
    'callout-spot-body':
      'We fetch XAU/USD from gold-api.com hourly during market hours (committed to the repo as data/gold_price.json). Exchange rates from open.er-api.com. All prices are estimates for reference — not for trade execution.',
    'aed-h2': 'The AED–USD Fixed Peg',
    'aed-intro':
      'The UAE Dirham (AED) has been fixed at exactly 3.6725 AED per US Dollar since November 1997.',
    'aed-our-approach':
      'On this site, we never use a third-party exchange rate for AED. We hardcode the official peg rate of 3.6725.',
    'zakat-h2': 'Zakat on Gold',
    'zakat-intro':
      'Zakat is one of the Five Pillars of Islam — a mandatory annual charitable contribution for Muslims who hold wealth above the nisab threshold.',
    'zakat-nisab-h3': 'The Nisab Threshold',
    'zakat-nisab-text': 'The gold nisab is 85 grams of 24K (pure) gold.',
    'zakat-rate-h3': 'The Zakat Rate',
    'zakat-rate-text': 'The Zakat rate on gold is 2.5% of the total value of your gold holdings.',
    'zakat-what-counts-h3': 'What counts?',
    'callout-zakat-title': 'Use Our Zakat Calculator',
    'hallmark-h2': 'Gold Hallmarking',
    'hallmark-intro':
      'A hallmark is an official stamp applied to a gold article after independent testing (assay) to certify its purity.',
    'hallmark-uae-h3': 'UAE Hallmarking',
    'hallmark-india-h3': 'India — BIS Hallmarking',
    'hallmark-uk-h3': 'UK Hallmarking',
    'th-millesimal': 'Millesimal Fineness',
    'th-karat-equiv': 'Karat',
    'th-purity-pct': 'Purity',
    'faq-h2': 'Frequently Asked Questions',
    'faq-q1': 'What is a karat in gold?',
    'faq-q2': 'Why is the UAE Dirham pegged to the US Dollar?',
    'faq-q3': 'How is the global gold price determined?',
    'faq-q4': 'What is the difference between spot price and retail price?',
    'faq-q5': 'Is our data real-time?',
    'faq-q6': 'What is a troy ounce?',
  },
  ar: {
    'learn-h1': 'تعلّم عن الذهب',
    'learn-sub': 'العيارات · التسعير · ربط الدرهم · الزكاة · الدمغة',
    'toc-label': 'المحتويات',
    'toc-karats': 'عيارات الذهب',
    'toc-pricing': 'التسعير',
    'toc-aed': 'ربط الدرهم',
    'toc-zakat': 'الزكاة',
    'toc-hallmark': 'الدمغة',
    'toc-faq': 'الأسئلة الشائعة',
    'karats-h2': 'شرح عيارات الذهب',
    'karats-intro':
      'القيراط (K أو kt) هو الوحدة المستخدمة لقياس نقاء الذهب. الذهب الخالص هو 24 قيراطاً. معظم المجوهرات تستخدم سبيكة — خليطاً من الذهب مع معادن أخرى — لتحسين المتانة وإدارة التكلفة.',
    'th-karat': 'العيار',
    'th-purity': 'النقاء',
    'th-gold-content': 'محتوى الذهب',
    'th-common-use': 'الاستخدام الشائع',
    'use-24': 'سبائك وعملات استثمارية، إلكترونيات',
    'use-22': 'مجوهرات الخليج، ذهب الأعراس (الإمارات، السعودية)',
    'use-21': 'مجوهرات الشام ومصر',
    'use-18': 'مجوهرات راقية، أطر إعدادات الألماس',
    'use-14': 'مجوهرات غربية، قطع موضة',
    'use-9': 'مجوهرات بريطانية وأسترالية اقتصادية',
    'karats-why-h3': 'لماذا يهم العيار؟',
    'karats-why':
      'الذهب عالي القيراط أكثر ليونة وأكثر حيوية في اللون الأصفر، لكنه يخدش بسهولة. السبائك منخفضة القيراط أصلب وأكثر متانة، ويمكن تلوينها باللون الأبيض أو الوردي أو الأخضر.',
    'callout-formula-title': 'صيغة الحساب',
    'callout-formula-body': 'سعر الغرام = (سعر XAU/USD ÷ 31.1035) × (العيار ÷ 24) × سعر الصرف',
    'pricing-h2': 'كيف تعمل أسعار الذهب',
    'pricing-intro':
      'سعر الذهب العالمي هو السعر الفوري — السعر الحالي لتسليم أوقية تروي واحدة من الذهب الخالص (99.9%) بالدولار الأمريكي (XAU/USD).',
    'pricing-markets-h3': 'أين يُحدَّد السعر؟',
    'callout-spot-title': 'بيانات أسعارنا',
    'callout-spot-body':
      'نجلب سعر XAU/USD من goldpricez.com كل 6 دقائق (يُحفظ في المستودع كـ data/gold_price.json). أسعار الصرف من open.er-api.com. جميع الأسعار تقديرية للمرجعية — وليست للتنفيذ التجاري.',
    'aed-h2': 'الربط الثابت للدرهم الإماراتي بالدولار',
    'aed-intro':
      'يرتبط الدرهم الإماراتي (AED) بسعر ثابت قدره 3.6725 درهم لكل دولار أمريكي منذ نوفمبر 1997.',
    'aed-our-approach':
      'في هذا الموقع، لا نستخدم أبداً سعر صرف طرف ثالث للدرهم. نُبرمج سعر الربط الرسمي 3.6725 مباشرةً.',
    'zakat-h2': 'زكاة الذهب',
    'zakat-intro':
      'الزكاة ركن من أركان الإسلام الخمسة — مساهمة خيرية سنوية إلزامية للمسلمين الذين يمتلكون ثروة تزيد عن النصاب.',
    'zakat-nisab-h3': 'حد النصاب',
    'zakat-nisab-text': 'نصاب الذهب هو 85 غراماً من الذهب الخالص عيار 24.',
    'zakat-rate-h3': 'نسبة الزكاة',
    'zakat-rate-text': 'نسبة الزكاة على الذهب 2.5% من إجمالي قيمة ذهبك.',
    'zakat-what-counts-h3': 'ما الذي يُحتسب؟',
    'callout-zakat-title': 'استخدم حاسبة الزكاة',
    'hallmark-h2': 'دمغة الذهب',
    'hallmark-intro': 'الدمغة هي ختم رسمي يُطبَّق على الذهب بعد اختبار مستقل لتصديق نقائه.',
    'hallmark-uae-h3': 'دمغة الذهب في الإمارات',
    'hallmark-india-h3': 'الهند — دمغة BIS',
    'hallmark-uk-h3': 'دمغة الذهب في المملكة المتحدة',
    'th-millesimal': 'الدرجة العيارية',
    'th-karat-equiv': 'ما يعادله بالقيراط',
    'th-purity-pct': 'النقاء',
    'faq-h2': 'الأسئلة الشائعة',
    'faq-q1': 'ما هو القيراط في الذهب؟',
    'faq-q2': 'لماذا يرتبط الدرهم الإماراتي بالدولار الأمريكي؟',
    'faq-q3': 'كيف يُحدَّد سعر الذهب العالمي؟',
    'faq-q4': 'ما الفرق بين السعر الفوري وسعر التجزئة؟',
    'faq-q5': 'هل بياناتنا فورية؟',
    'faq-q6': 'ما هي الأوقية التروي؟',
  },
});

export const LEARN_HUB_TRANSLATIONS = Object.freeze({
  en: {
    ...LEGACY_LEARN_COPY.en,
    'learnHub.ui.tocToggleOpen': 'Show contents',
    'learnHub.ui.tocToggleClose': 'Hide contents',
    'learnHub.ui.readTime': '{minutes} min read',
    'learnHub.ui.updatedLabel': 'Updated {date}',
    'learnHub.ui.articleMetaSeparator': '•',
    'learnHub.ui.sectionNavLabel': 'Article sections',
    'learnHub.ui.sectionAnalyticsTool': 'learn_hub_section_view',
    'learnHub.categories.learn': 'Learn Hub',
    'learnHub.articles.learn.iconLabel': 'Learn article',
    'learnHub.articles.learn.sections.karats.table.caption': 'Comparison of common gold karats',
    'learnHub.articles.learn.sections.karats.table.visualHeader': 'Purity visual',
    'learnHub.articles.learn.sections.karats.table.24k.content': '24/24 parts gold',
    'learnHub.articles.learn.sections.karats.table.22k.content': '22/24 parts gold',
    'learnHub.articles.learn.sections.karats.table.21k.content': '21/24 parts gold',
    'learnHub.articles.learn.sections.karats.table.18k.content': '18/24 parts gold',
    'learnHub.articles.learn.sections.karats.table.14k.content': '14/24 parts gold',
    'learnHub.articles.learn.sections.karats.table.9k.content': '9/24 parts gold',
    'learnHub.articles.learn.sections.karats.detail':
      'Higher karat gold is softer and more vibrant yellow in color, but scratches more easily. Lower karat alloys are harder, more durable, and can be tinted white, rose, or green depending on the metals added (silver, copper, palladium). The price you pay is directly proportional to the gold content.',
    'learnHub.articles.learn.sections.pricing.marketsIntro':
      'Gold trades 24 hours a day on global markets. The two primary venues are:',
    'learnHub.articles.learn.sections.pricing.markets.comex':
      "COMEX (New York): The world's largest futures exchange for gold. COMEX prices drive global sentiment.",
    'learnHub.articles.learn.sections.pricing.markets.lbma':
      'LBMA (London): The London Bullion Market Association sets a twice-daily benchmark called the London Gold Fix, used as the reference for physical gold contracts worldwide.',
    'learnHub.articles.learn.sections.pricing.markets.otc':
      'OTC Markets: Over-the-counter 24-hour trading between banks, refineries, and dealers accounts for the bulk of daily gold volume.',
    'learnHub.articles.learn.sections.pricing.factorsHeading': 'What moves the price?',
    'learnHub.articles.learn.sections.pricing.factors.usd':
      'US Dollar strength: Gold is priced in USD. A stronger dollar makes gold more expensive for foreign buyers, reducing demand and pushing the price down — and vice versa.',
    'learnHub.articles.learn.sections.pricing.factors.rates':
      'Interest rates: Higher interest rates increase the opportunity cost of holding gold (which pays no yield), pushing prices down. Rate cuts tend to boost gold.',
    'learnHub.articles.learn.sections.pricing.factors.inflation':
      'Inflation: Gold is a traditional inflation hedge. Rising inflation expectations often push gold prices up.',
    'learnHub.articles.learn.sections.pricing.factors.geopolitics':
      'Geopolitical risk: Wars, sanctions, and political instability drive investors to gold as a safe haven.',
    'learnHub.articles.learn.sections.pricing.factors.centralBanks':
      'Central bank buying: Central banks — especially in emerging markets — have been net buyers of gold since 2010, supporting prices.',
    'learnHub.articles.learn.sections.pricing.factors.jewelleryDemand':
      'Jewellery demand: India and China account for over 50% of global gold jewellery demand. Seasonal festivals create demand spikes.',
    'learnHub.articles.learn.sections.pricing.callout.bodyLead':
      'We fetch the XAU/USD spot rate from ',
    'learnHub.articles.learn.sections.pricing.callout.bodyMiddle':
      ' hourly during market hours and commit it to this repository as ',
    'learnHub.articles.learn.sections.pricing.callout.bodyAfterCode': '. Exchange rates come from ',
    'learnHub.articles.learn.sections.pricing.callout.bodyTail':
      '. All prices shown are estimates — retail prices include additional charges.',
    'learnHub.articles.learn.sections.aed.effects.1':
      'AED gold prices move in perfect proportion to USD gold prices.',
    'learnHub.articles.learn.sections.aed.effects.2':
      'There is no exchange-rate risk for UAE residents holding USD-denominated assets.',
    'learnHub.articles.learn.sections.aed.effects.3':
      'There is no currency-conversion uncertainty — the official rate does not change.',
    'learnHub.articles.learn.sections.aed.detail':
      "This peg is maintained by the UAE Central Bank through direct market intervention when needed. The country's large USD reserves help keep the peg credible and predictable for households, investors, and jewellery buyers.",
    'learnHub.articles.learn.sections.zakat.detail':
      'Zakat is one of the Five Pillars of Islam — a mandatory annual charitable contribution for Muslims who hold wealth above the nisab threshold for a full Islamic lunar year (hawl).',
    'learnHub.articles.learn.sections.zakat.whatCounts.1':
      'All gold jewellery intended for investment or storage (not regular personal use — scholars differ on this point).',
    'learnHub.articles.learn.sections.zakat.whatCounts.2': 'Gold bars, coins, and ETFs.',
    'learnHub.articles.learn.sections.zakat.whatCounts.3':
      'Gold held at a bank, depository, or private vault.',
    'learnHub.articles.learn.sections.zakat.callout.bodyLead': 'Our ',
    'learnHub.articles.learn.sections.zakat.callout.link': 'Gold Calculator',
    'learnHub.articles.learn.sections.zakat.callout.bodyTail':
      " includes a Zakat mode that estimates your obligation using today's reference gold price. Always consult a qualified scholar for your specific situation.",
    'learnHub.articles.learn.sections.hallmark.uaeText':
      'The Emirates Authority for Standardization and Metrology (ESMA) oversees gold hallmarking in the UAE. Hallmarked gold in the UAE shows the Emirates Quality Mark alongside the karat stamp (for example, 916 for 22K, meaning 91.6% purity).',
    'learnHub.articles.learn.sections.hallmark.indiaText':
      "The Bureau of Indian Standards (BIS) mandates hallmarking for gold jewellery sold in India. A BIS hallmark includes the BIS logo, purity in parts per thousand (for example, 916 for 22K), and the jeweller's unique identification number (HUID).",
    'learnHub.articles.learn.sections.hallmark.ukText':
      "UK hallmarking is among the world's oldest and strictest. Assay offices stamp articles with the maker's mark, the purity (for example, 750 for 18K), the assay-office mark, and optionally a year letter.",
    'learnHub.articles.learn.sections.hallmark.table.caption': 'Common hallmark fineness codes',
    'learnHub.articles.learn.sections.faq.intro':
      'Quick answers to the questions buyers ask most often.',
    'learnHub.articles.learn.sections.faq.a1':
      'A karat (K or kt) is a unit measuring gold purity. Twenty-four karat gold is effectively pure gold (99.9%). Twenty-two karat is 91.7% gold, 21K is 87.5%, 18K is 75%, and 14K is 58.3%. The rest is other metals such as silver, copper, or palladium.',
    'learnHub.articles.learn.sections.faq.a2':
      "The UAE Central Bank has maintained a fixed exchange rate of 3.6725 AED per US Dollar since 1997. The peg supports monetary stability, reduces currency uncertainty for trade and savings, and aligns the Dirham with the region's dominant invoicing currency.",
    'learnHub.articles.learn.sections.faq.a3':
      'The global gold spot price (XAU/USD) is discovered on commodities markets — primarily COMEX in New York and the London over-the-counter market. The London Bullion Market Association also publishes benchmark fixings used for many physical contracts.',
    'learnHub.articles.learn.sections.faq.a4':
      'The spot price is the raw market value for pure gold. Retail jewellery and coin prices add making charges, dealer margins, logistics costs, and taxes. That is why a shop quote is higher than the reference price shown on a tracker.',
    'learnHub.articles.learn.sections.faq.a5':
      'We refresh gold prices during market hours and label freshness clearly. Surfaces on Gold Ticker Live tell you when data is live, cached, delayed, or fallback so stale reference data is never presented as a fresh shop quote.',
    'learnHub.articles.learn.sections.faq.a6':
      'A troy ounce (ozt) is the standard precious-metals unit. It equals 31.1035 grams, which is heavier than a regular avoirdupois ounce. International gold prices quoted per ounce always refer to troy ounces.',
    'method-h1': 'Data Sources & Methodology',
    'method-sub':
      'How we calculate every price you see — step by step, with full source attribution.',
    'insights-h1': 'Gold Market Insights',
    'insights-sub': 'Analysis, price drivers and context for GCC gold buyers — updated weekly',
  },
  ar: {
    ...LEGACY_LEARN_COPY.ar,
    'learnHub.ui.tocToggleOpen': 'إظهار المحتويات',
    'learnHub.ui.tocToggleClose': 'إخفاء المحتويات',
    'learnHub.ui.readTime': 'قراءة {minutes} دقائق',
    'learnHub.ui.updatedLabel': 'آخر تحديث {date}',
    'learnHub.ui.articleMetaSeparator': '•',
    'learnHub.ui.sectionNavLabel': 'أقسام المقال',
    'learnHub.ui.sectionAnalyticsTool': 'learn_hub_section_view',
    'learnHub.categories.learn': 'مركز التعلّم',
    'learnHub.articles.learn.iconLabel': 'مقال تعليمي',
    'learnHub.articles.learn.sections.karats.table.caption': 'مقارنة بين أشهر عيارات الذهب',
    'learnHub.articles.learn.sections.karats.table.visualHeader': 'مؤشر النقاء',
    'learnHub.articles.learn.sections.karats.table.24k.content': '24 من 24 جزءاً ذهباً',
    'learnHub.articles.learn.sections.karats.table.22k.content': '22 من 24 جزءاً ذهباً',
    'learnHub.articles.learn.sections.karats.table.21k.content': '21 من 24 جزءاً ذهباً',
    'learnHub.articles.learn.sections.karats.table.18k.content': '18 من 24 جزءاً ذهباً',
    'learnHub.articles.learn.sections.karats.table.14k.content': '14 من 24 جزءاً ذهباً',
    'learnHub.articles.learn.sections.karats.table.9k.content': '9 من 24 جزءاً ذهباً',
    'learnHub.articles.learn.sections.karats.detail':
      'الذهب الأعلى عياراً أكثر ليونة وأكثر صفاءً في لونه الأصفر، لكنه يتعرض للخدش بسهولة أكبر. أما السبائك الأقل عياراً فهي أصلب وأكثر تحملاً، ويمكن أن تميل إلى الأبيض أو الوردي أو الأخضر بحسب المعادن المضافة مثل الفضة أو النحاس أو البلاديوم. والسعر يرتبط مباشرة بنسبة الذهب الخالص داخل القطعة.',
    'learnHub.articles.learn.sections.pricing.marketsIntro':
      'يُتداول الذهب على مدار 24 ساعة في الأسواق العالمية، وأهم الساحات التي يتحدد فيها السعر هي:',
    'learnHub.articles.learn.sections.pricing.markets.comex':
      'كوميكس (نيويورك): أكبر بورصة عقود آجلة للذهب في العالم، وأسعارها تؤثر بقوة في اتجاه السوق العالمي.',
    'learnHub.articles.learn.sections.pricing.markets.lbma':
      'جمعية سوق لندن للسبائك (LBMA): تنشر سعراً مرجعياً مرتين يومياً يُعرف بتثبيت الذهب في لندن، ويُستخدم مرجعاً لكثير من عقود الذهب المادي حول العالم.',
    'learnHub.articles.learn.sections.pricing.markets.otc':
      'الأسواق خارج البورصة (OTC): تداولات مستمرة بين البنوك والمصافي والتجار، وتشكل جانباً كبيراً من حجم التعاملات اليومية في الذهب.',
    'learnHub.articles.learn.sections.pricing.factorsHeading': 'ما العوامل التي تحرك السعر؟',
    'learnHub.articles.learn.sections.pricing.factors.usd':
      'قوة الدولار الأمريكي: الذهب مسعّر بالدولار، لذلك يجعل الدولار القوي شراء الذهب أغلى على المشترين خارج الولايات المتحدة، ما قد يضغط على الطلب والسعر.',
    'learnHub.articles.learn.sections.pricing.factors.rates':
      'أسعار الفائدة: ارتفاع الفائدة يزيد تكلفة الاحتفاظ بالذهب الذي لا يدرّ عائداً، بينما تميل التخفيضات في الفائدة إلى دعم الذهب.',
    'learnHub.articles.learn.sections.pricing.factors.inflation':
      'التضخم: يُنظر إلى الذهب تقليدياً كوسيلة للتحوط من التضخم، لذلك قد ترتفع أسعاره مع ارتفاع توقعات التضخم.',
    'learnHub.articles.learn.sections.pricing.factors.geopolitics':
      'المخاطر الجيوسياسية: الحروب والعقوبات والاضطرابات السياسية تدفع كثيراً من المستثمرين إلى الذهب كملاذ آمن.',
    'learnHub.articles.learn.sections.pricing.factors.centralBanks':
      'مشتريات البنوك المركزية: البنوك المركزية، خصوصاً في الأسواق الناشئة، كانت من صافي المشترين للذهب منذ 2010، ما يدعم الأسعار.',
    'learnHub.articles.learn.sections.pricing.factors.jewelleryDemand':
      'طلب المجوهرات: تستحوذ الهند والصين على حصة كبيرة من الطلب العالمي على مجوهرات الذهب، وتؤدي المواسم والأعياد إلى قفزات في الطلب.',
    'learnHub.articles.learn.sections.pricing.callout.bodyLead': 'نجلب السعر الفوري XAU/USD من ',
    'learnHub.articles.learn.sections.pricing.callout.bodyMiddle':
      ' بشكلٍ دوري خلال ساعات السوق ونلتزم به في هذا المستودع ضمن ',
    'learnHub.articles.learn.sections.pricing.callout.bodyAfterCode': '. كما تأتي أسعار الصرف من ',
    'learnHub.articles.learn.sections.pricing.callout.bodyTail':
      '. جميع الأسعار المعروضة تقديرية ومرجعية فقط — أما أسعار المتاجر فتشمل رسوماً وهوامش إضافية.',
    'learnHub.articles.learn.sections.aed.effects.1':
      'تتحرك أسعار الذهب بالدرهم بنفس نسبة تحرك الذهب بالدولار تقريباً وبصورة مباشرة.',
    'learnHub.articles.learn.sections.aed.effects.2':
      'لا توجد مخاطرة فعلية من تغيّر سعر الصرف لمقيمٍ في الإمارات يحتفظ بأصول مقوّمة بالدولار.',
    'learnHub.articles.learn.sections.aed.effects.3':
      'لا يوجد غموض في التحويل بين العملتين لأن السعر الرسمي ثابت ولا يتغير في الظروف المعتادة.',
    'learnHub.articles.learn.sections.aed.detail':
      'يحافظ المصرف المركزي الإماراتي على هذا الربط عبر السياسة النقدية والتدخل عند الحاجة. وتدعم الاحتياطيات الدولارية الكبيرة ثقة السوق في استمرار الربط، وهو ما يجعل تسعير الذهب بالدرهم أكثر قابلية للتوقع للمستهلكين والمستثمرين.',
    'learnHub.articles.learn.sections.zakat.detail':
      'الزكاة ركن من أركان الإسلام الخمسة، وتجب على من يملك مالاً يبلغ النصاب ويمضي عليه حول قمري كامل. وتقدير زكاة الذهب يعتمد على قيمة ما تملكه من ذهب قابل للزكاة في يوم الاستحقاق.',
    'learnHub.articles.learn.sections.zakat.whatCounts.1':
      'الذهب المقتنى بغرض الادخار أو الاستثمار، بما في ذلك بعض الحلي بحسب الرأي الفقهي المتبع.',
    'learnHub.articles.learn.sections.zakat.whatCounts.2':
      'السبائك والعملات الذهبية والصناديق المرتبطة بالذهب.',
    'learnHub.articles.learn.sections.zakat.whatCounts.3':
      'الذهب المحفوظ في بنك أو خزنة أو لدى جهة حفظ متخصصة.',
    'learnHub.articles.learn.sections.zakat.callout.bodyLead': 'تتضمن ',
    'learnHub.articles.learn.sections.zakat.callout.link': 'حاسبة الذهب',
    'learnHub.articles.learn.sections.zakat.callout.bodyTail':
      ' لدينا وضعاً لحساب الزكاة بناءً على السعر المرجعي الحالي للذهب. ومع ذلك يبقى الرجوع إلى عالمٍ موثوق هو الخيار الأفضل في الحالات الخاصة.',
    'learnHub.articles.learn.sections.hallmark.uaeText':
      'تُشرف الجهات التنظيمية في الإمارات على دمغ الذهب للتأكد من نقائه. ويظهر على المشغولات المدموغة ختم الجودة الإماراتي إلى جانب ختم العيار، مثل 916 لعيار 22، أي ما يعادل 91.6% نقاء.',
    'learnHub.articles.learn.sections.hallmark.indiaText':
      'يفرض مكتب المعايير الهندي (BIS) دمغاً إلزامياً على الذهب المباع في الهند. وتتضمن الدمغة شعار BIS ودرجة النقاء بالألف، مثل 916 لعيار 22، بالإضافة إلى رقم تعريف الصائغ (HUID).',
    'learnHub.articles.learn.sections.hallmark.ukText':
      'تُعد الدمغة البريطانية من أقدم الأنظمة وأكثرها صرامة. وتضع مكاتب الفحص ختم الصانع وختم النقاء مثل 750 لعيار 18 وختم مكتب الفحص، وقد يضاف حرف السنة أيضاً.',
    'learnHub.articles.learn.sections.hallmark.table.caption': 'أشهر رموز الدمغ وفق درجة النقاء',
    'learnHub.articles.learn.sections.faq.intro':
      'إجابات سريعة عن أكثر الأسئلة شيوعاً لدى المشترين.',
    'learnHub.articles.learn.sections.faq.a1':
      'القيراط هو وحدة قياس نقاء الذهب. الذهب عيار 24 يُعد ذهباً خالصاً تقريباً بنسبة 99.9%. أما عيار 22 فيحتوي على 91.7% ذهب، و21 على 87.5%، و18 على 75%، و14 على 58.3%. وما تبقى يكون معادن أخرى مثل الفضة أو النحاس أو البلاديوم.',
    'learnHub.articles.learn.sections.faq.a2':
      'يحافظ المصرف المركزي الإماراتي على سعر صرف ثابت يبلغ 3.6725 درهم لكل دولار أمريكي منذ 1997. ويوفر هذا الربط استقراراً نقدياً ويخفف تقلبات التحويل للتجارة والادخار ويربط الدرهم بعملة التسعير الأساسية في المنطقة.',
    'learnHub.articles.learn.sections.faq.a3':
      'يُكتشف السعر الفوري العالمي للذهب في أسواق السلع، وبشكل رئيسي في كوميكس بنيويورك وفي السوق اللندني خارج البورصة. كما تنشر LBMA أسعاراً مرجعية تُستخدم في كثير من عقود الذهب المادي.',
    'learnHub.articles.learn.sections.faq.a4':
      'السعر الفوري هو القيمة السوقية الخام للذهب الخالص. أما السعر الذي يعرضه متجر أو صائغ فيضيف أجور المصنعية وهوامش التاجر وتكاليف التشغيل والضرائب، لذلك يكون أعلى من السعر المرجعي الذي تراه على المتتبع.',
    'learnHub.articles.learn.sections.faq.a5':
      'نقوم بتحديث أسعار الذهب المرجعية خلال ساعات السوق، ونوضح حالة الحداثة بوضوح على كل سطح. لذلك ستعرف إن كانت البيانات مباشرة أو مخزنة مؤقتاً أو متأخرة أو احتياطية، ولن نعرض بيانات قديمة وكأنها تسعير محل حديث.',
    'learnHub.articles.learn.sections.faq.a6':
      'الأوقية التروية هي وحدة القياس القياسية للمعادن الثمينة، وتساوي 31.1035 غراماً، أي أكثر من الأوقية العادية. وكل تسعير عالمي للذهب \"للأوقية\" يقصد به الأوقية التروية.',
    'method-h1': 'مصادر البيانات والمنهجية',
    'method-sub': 'كيف نحسب كل سعر تراه — خطوة بخطوة، مع الإسناد الكامل للمصادر.',
    'insights-h1': 'رؤى سوق الذهب',
    'insights-sub': 'تحليلات ومحركات الأسعار وسياق السوق لمشتري الذهب في دول الخليج — تحديث أسبوعي',
  },
});

export function resolveLearnHubText(key, language = 'en', replacements = {}) {
  const dictionary = LEARN_HUB_TRANSLATIONS[language] ?? LEARN_HUB_TRANSLATIONS.en;
  const fallback = LEARN_HUB_TRANSLATIONS.en[key] ?? key;
  const template = dictionary[key] ?? fallback;
  return String(template).replace(/\{(\w+)\}/g, (_, token) => `${replacements[token] ?? ''}`);
}

export function getLearnHubTranslations(language = 'en') {
  return LEARN_HUB_TRANSLATIONS[language] ?? LEARN_HUB_TRANSLATIONS.en;
}

export const LEARN_ARTICLE = Object.freeze({
  id: 'learn',
  titleKey: 'learn-h1',
  subtitleKey: 'learn-sub',
  icon: '📚',
  iconLabelKey: 'learnHub.articles.learn.iconLabel',
  metadata: {
    readTime: 8,
    lastUpdated: '2026-05-25',
    category: 'learn',
    categoryKey: 'learnHub.categories.learn',
  },
  tocEntries: [
    { id: 'karats', labelKey: 'toc-karats' },
    { id: 'pricing', labelKey: 'toc-pricing' },
    { id: 'aed-peg', labelKey: 'toc-aed' },
    { id: 'zakat', labelKey: 'toc-zakat' },
    { id: 'hallmark', labelKey: 'toc-hallmark' },
    { id: 'faq', labelKey: 'toc-faq' },
  ],
  relatedArticleIds: ['methodology', 'insights'],
  sections: [
    {
      id: 'karats',
      headingKey: 'karats-h2',
      bodyKey: 'karats-intro',
      type: 'table',
      table: {
        captionKey: 'learnHub.articles.learn.sections.karats.table.caption',
        columns: [
          { id: 'karat', labelKey: 'th-karat', scope: 'col' },
          { id: 'purity', labelKey: 'th-purity', scope: 'col' },
          {
            id: 'visual',
            scope: 'col',
            ariaLabelKey: 'learnHub.articles.learn.sections.karats.table.visualHeader',
          },
          { id: 'goldContent', labelKey: 'th-gold-content', scope: 'col' },
          { id: 'commonUse', labelKey: 'th-common-use', scope: 'col' },
        ],
        rows: [
          {
            id: '24k',
            rowHeader: '24K',
            cells: [
              { value: '99.9%' },
              { type: 'meter', value: 99.9, className: 'learn-purity-bar-fill--24k' },
              { textKey: 'learnHub.articles.learn.sections.karats.table.24k.content' },
              { textKey: 'use-24' },
            ],
          },
          {
            id: '22k',
            rowHeader: '22K',
            cells: [
              { value: '91.7%' },
              { type: 'meter', value: 91.7, className: 'learn-purity-bar-fill--22k' },
              { textKey: 'learnHub.articles.learn.sections.karats.table.22k.content' },
              { textKey: 'use-22' },
            ],
          },
          {
            id: '21k',
            rowHeader: '21K',
            cells: [
              { value: '87.5%' },
              { type: 'meter', value: 87.5, className: 'learn-purity-bar-fill--21k' },
              { textKey: 'learnHub.articles.learn.sections.karats.table.21k.content' },
              { textKey: 'use-21' },
            ],
          },
          {
            id: '18k',
            rowHeader: '18K',
            cells: [
              { value: '75.0%' },
              { type: 'meter', value: 75, className: 'learn-purity-bar-fill--18k' },
              { textKey: 'learnHub.articles.learn.sections.karats.table.18k.content' },
              { textKey: 'use-18' },
            ],
          },
          {
            id: '14k',
            rowHeader: '14K',
            cells: [
              { value: '58.3%' },
              { type: 'meter', value: 58.3, className: 'learn-purity-bar-fill--14k' },
              { textKey: 'learnHub.articles.learn.sections.karats.table.14k.content' },
              { textKey: 'use-14' },
            ],
          },
          {
            id: '9k',
            rowHeader: '9K',
            cells: [
              { value: '37.5%' },
              { type: 'meter', value: 37.5, className: 'learn-purity-bar-fill--9k' },
              { textKey: 'learnHub.articles.learn.sections.karats.table.9k.content' },
              { textKey: 'use-9' },
            ],
          },
        ],
      },
      blocks: [
        { kind: 'subheading', key: 'karats-why-h3' },
        { kind: 'paragraph', key: 'learnHub.articles.learn.sections.karats.detail' },
        {
          kind: 'callout',
          tone: 'formula',
          titleKey: 'callout-formula-title',
          bodyKey: 'callout-formula-body',
        },
      ],
    },
    {
      id: 'pricing',
      headingKey: 'pricing-h2',
      bodyKey: 'pricing-intro',
      type: 'prose',
      blocks: [
        { kind: 'subheading', key: 'pricing-markets-h3' },
        { kind: 'paragraph', key: 'learnHub.articles.learn.sections.pricing.marketsIntro' },
        {
          kind: 'list',
          style: 'unordered',
          items: [
            { textKey: 'learnHub.articles.learn.sections.pricing.markets.comex' },
            { textKey: 'learnHub.articles.learn.sections.pricing.markets.lbma' },
            { textKey: 'learnHub.articles.learn.sections.pricing.markets.otc' },
          ],
        },
        { kind: 'subheading', key: 'learnHub.articles.learn.sections.pricing.factorsHeading' },
        {
          kind: 'list',
          style: 'unordered',
          items: [
            { textKey: 'learnHub.articles.learn.sections.pricing.factors.usd' },
            { textKey: 'learnHub.articles.learn.sections.pricing.factors.rates' },
            { textKey: 'learnHub.articles.learn.sections.pricing.factors.inflation' },
            { textKey: 'learnHub.articles.learn.sections.pricing.factors.geopolitics' },
            { textKey: 'learnHub.articles.learn.sections.pricing.factors.centralBanks' },
            { textKey: 'learnHub.articles.learn.sections.pricing.factors.jewelleryDemand' },
          ],
        },
        {
          kind: 'callout',
          tone: 'info',
          titleKey: 'callout-spot-title',
          richText: [
            { key: 'learnHub.articles.learn.sections.pricing.callout.bodyLead' },
            {
              type: 'link',
              href: 'https://gold-api.com',
              text: 'gold-api.com',
              external: true,
            },
            { key: 'learnHub.articles.learn.sections.pricing.callout.bodyMiddle' },
            { type: 'code', text: 'data/gold_price.json' },
            { key: 'learnHub.articles.learn.sections.pricing.callout.bodyAfterCode' },
            {
              type: 'link',
              href: 'https://open.er-api.com',
              text: 'open.er-api.com',
              external: true,
            },
            { key: 'learnHub.articles.learn.sections.pricing.callout.bodyTail' },
          ],
        },
      ],
    },
    {
      id: 'aed-peg',
      headingKey: 'aed-h2',
      bodyKey: 'aed-intro',
      type: 'callout',
      blocks: [
        {
          kind: 'list',
          style: 'unordered',
          items: [
            { textKey: 'learnHub.articles.learn.sections.aed.effects.1' },
            { textKey: 'learnHub.articles.learn.sections.aed.effects.2' },
            { textKey: 'learnHub.articles.learn.sections.aed.effects.3' },
          ],
        },
        { kind: 'paragraph', key: 'learnHub.articles.learn.sections.aed.detail' },
        { kind: 'paragraph', key: 'aed-our-approach' },
      ],
    },
    {
      id: 'zakat',
      headingKey: 'zakat-h2',
      bodyKey: 'learnHub.articles.learn.sections.zakat.detail',
      type: 'callout',
      blocks: [
        { kind: 'subheading', key: 'zakat-nisab-h3' },
        { kind: 'paragraph', key: 'zakat-nisab-text' },
        { kind: 'subheading', key: 'zakat-rate-h3' },
        { kind: 'paragraph', key: 'zakat-rate-text' },
        { kind: 'subheading', key: 'zakat-what-counts-h3' },
        {
          kind: 'list',
          style: 'unordered',
          items: [
            { textKey: 'learnHub.articles.learn.sections.zakat.whatCounts.1' },
            { textKey: 'learnHub.articles.learn.sections.zakat.whatCounts.2' },
            { textKey: 'learnHub.articles.learn.sections.zakat.whatCounts.3' },
          ],
        },
        {
          kind: 'callout',
          tone: 'info',
          titleKey: 'callout-zakat-title',
          richText: [
            { key: 'learnHub.articles.learn.sections.zakat.callout.bodyLead' },
            {
              type: 'link',
              href: './calculator.html',
              key: 'learnHub.articles.learn.sections.zakat.callout.link',
            },
            { key: 'learnHub.articles.learn.sections.zakat.callout.bodyTail' },
          ],
        },
      ],
    },
    {
      id: 'hallmark',
      headingKey: 'hallmark-h2',
      bodyKey: 'hallmark-intro',
      type: 'table',
      table: {
        captionKey: 'learnHub.articles.learn.sections.hallmark.table.caption',
        columns: [
          { id: 'millesimal', labelKey: 'th-millesimal', scope: 'col' },
          { id: 'karatEquiv', labelKey: 'th-karat-equiv', scope: 'col' },
          { id: 'purityPct', labelKey: 'th-purity-pct', scope: 'col' },
        ],
        rows: [
          { id: '999', rowHeader: '999', cells: [{ value: '24K' }, { value: '99.9%' }] },
          { id: '916', rowHeader: '916', cells: [{ value: '22K' }, { value: '91.7%' }] },
          { id: '875', rowHeader: '875', cells: [{ value: '21K' }, { value: '87.5%' }] },
          { id: '750', rowHeader: '750', cells: [{ value: '18K' }, { value: '75.0%' }] },
          { id: '583', rowHeader: '583', cells: [{ value: '14K' }, { value: '58.3%' }] },
          { id: '375', rowHeader: '375', cells: [{ value: '9K' }, { value: '37.5%' }] },
        ],
      },
      blocks: [
        { kind: 'subheading', key: 'hallmark-uae-h3' },
        { kind: 'paragraph', key: 'learnHub.articles.learn.sections.hallmark.uaeText' },
        { kind: 'subheading', key: 'hallmark-india-h3' },
        { kind: 'paragraph', key: 'learnHub.articles.learn.sections.hallmark.indiaText' },
        { kind: 'subheading', key: 'hallmark-uk-h3' },
        { kind: 'paragraph', key: 'learnHub.articles.learn.sections.hallmark.ukText' },
      ],
    },
    {
      id: 'faq',
      headingKey: 'faq-h2',
      bodyKey: 'learnHub.articles.learn.sections.faq.intro',
      type: 'faq',
      faqs: [
        {
          id: 'q1',
          questionKey: 'faq-q1',
          answerKey: 'learnHub.articles.learn.sections.faq.a1',
          open: true,
        },
        { id: 'q2', questionKey: 'faq-q2', answerKey: 'learnHub.articles.learn.sections.faq.a2' },
        { id: 'q3', questionKey: 'faq-q3', answerKey: 'learnHub.articles.learn.sections.faq.a3' },
        { id: 'q4', questionKey: 'faq-q4', answerKey: 'learnHub.articles.learn.sections.faq.a4' },
        { id: 'q5', questionKey: 'faq-q5', answerKey: 'learnHub.articles.learn.sections.faq.a5' },
        { id: 'q6', questionKey: 'faq-q6', answerKey: 'learnHub.articles.learn.sections.faq.a6' },
      ],
    },
  ],
});

export const LEARN_HUB_ARTICLES = Object.freeze([LEARN_ARTICLE]);
