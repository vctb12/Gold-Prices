import { CONSTANTS, KARATS, TRANSLATIONS } from '../config/index.js';
import * as api from '../lib/api.js';
import * as cache from '../lib/cache.js';
import { mountSkeleton } from '../components/skeleton.js';
import { showDataStatusBanner, hideDataStatusBanner } from '../lib/data-status-banner.js';
import * as calc from '../lib/price-calculator.js';
import * as fmt from '../lib/formatter.js';
import { updateTicker } from '../components/ticker.js';
import { mountSharedShell } from '../components/site-shell.js';
import { injectBreadcrumbs } from '../components/breadcrumbs.js';
import { initSwUpdateToast } from '../lib/sw-update-toast.js';
import { el, clear } from '../lib/safe-dom.js';

const LANG_KEY = 'user_prefs';
let shellCtrl = null;

const MARKET_META = {
  AE: { currency: 'AED', name: { en: 'UAE', ar: 'الإمارات' }, decimals: 2 },
  SA: { currency: 'SAR', name: { en: 'Saudi Arabia', ar: 'السعودية' }, decimals: 2 },
  EG: { currency: 'EGP', name: { en: 'Egypt', ar: 'مصر' }, decimals: 2 },
};

const I18N = {
  en: {
    badge: 'Practical guide · March 2026',
    heroTitle: 'How to Invest in Gold Rationally',
    heroLead:
      'No hype. No emotion. Build a cleaner gold plan with live prices, a budget calculator, and market-specific buying notes for UAE, Saudi Arabia, and Egypt.',
    ctaTracker: 'See Live Prices Now →',
    ctaPlanner: 'Build My Plan',
    ctaCompare: 'Compare Options',
    point1Title: 'Use gold for a job',
    point1Copy:
      'Protection, liquidity, gifting, or tactical exposure — decide the job first.',
    point2Title: 'Buy with live numbers',
    point2Copy: 'Use spot-linked pricing before walking into a store or placing an order.',
    point3Title: 'Respect premiums',
    point3Copy: 'The wrong premium can ruin a good gold decision.',
    liveLabel: 'Live gold snapshot',
    liveTitle: 'Investment snapshot',
    statSpot: 'Spot (XAU/USD)',
    statSpotNote: 'per troy ounce',
    stat24: '24K • AED / gram',
    stat24Note: 'bullion reference',
    stat22: '22K • AED / gram',
    stat22Note: 'jewelry benchmark',
    stat21: '21K • AED / gram',
    stat21Note: 'popular GCC grade',
    fetching: 'Fetching live data…',
    updated: 'Updated',
    marketOpen: 'Market open',
    marketClosed: 'Market closed',
    openTracker: 'Open full tracker →',
    jumpGoals: 'Goal',
    jumpPlanner: 'Planner',
    jumpCompare: 'Compare',
    jumpMarkets: 'Markets',
    jumpFaq: 'FAQ',
    goalsKicker: 'Start with intent',
    goalsTitle: 'Choose the job gold should do',
    goalsSub:
      'The best product changes depending on whether you want defense, cultural use, or short-term positioning.',
    plannerKicker: 'Live planner',
    plannerTitle: 'What can your budget really buy?',
    plannerSub:
      'Use live spot-linked estimates to size a one-time purchase or a monthly accumulation plan.',
    marketLabel: 'Primary market',
    typeLabel: 'Product type',
    frequencyLabel: 'Contribution style',
    type24: '24K bullion',
    type22: '22K jewelry',
    typeETF: 'Gold ETF',
    oneTime: 'One-time purchase',
    monthly: 'Monthly stacking',
    planSnapshot: 'Plan snapshot',
    planSub: 'A quick rational estimate based on the current market.',
    resultBudget: 'Budget',
    resultGrams: 'Approx. grams',
    resultOunces: 'Approx. ounces',
    resultAnnual: '12-month accumulation',
    resultPremium: 'Typical premium',
    compareKicker: 'Product choice',
    compareTitle: 'What actually makes sense?',
    compareSub:
      'Do not buy the same way for every goal. Gold bars, jewelry, and ETFs solve different problems.',
    marketsKicker: 'Where to buy',
    marketsTitle: 'How to buy in your market',
    marketsSub:
      'Use the right channel, ask the right questions, and avoid the obvious mistakes before paying.',
    mistakesKicker: 'Discipline first',
    mistakesTitle: 'Common mistakes that damage returns',
    mistakesSub:
      'The biggest problems usually come from premium, storage, and emotional timing.',
    faqKicker: 'Before you buy',
    faqTitle: 'Questions worth asking first',
    faqSub:
      'A good gold purchase usually starts with the right question, not the right Instagram reel.',
    finalTitle: 'Ready to make a cleaner gold decision?',
    finalSub:
      'Use the live tracker before you buy, then come back here to size and compare your next move.',
    finalBtn: 'Open Live Tracker →',
    planBudgetNote: 'using current local pricing',
    planGramsNote: 'spot-linked estimate',
    planOuncesNote: '31.1035g per troy ounce',
    planEtfNote: 'spot-equivalent exposure',
    metaLive: 'Live price based',
    metaSpot: 'Spot-linked estimate',
    metaAed: 'AED peg fixed at 3.6725',
    metaVerify: 'Verify local premiums before purchase',
  },
  ar: {
    badge: 'دليل عملي · مارس 2026',
    heroTitle: 'كيف تستثمر في الذهب بعقلانية',
    heroLead:
      'بدون مبالغة وبدون عاطفة. ابنِ خطة ذهب أوضح باستخدام الأسعار الحية، وحاسبة الميزانية، وملاحظات شراء مخصصة للإمارات والسعودية ومصر.',
    ctaTracker: 'اعرض الأسعار المباشرة الآن ←',
    ctaPlanner: 'ابنِ خطتي',
    ctaCompare: 'قارن الخيارات',
    point1Title: 'حدّد وظيفة الذهب',
    point1Copy: 'حماية، سيولة، هدية، أو تعرض تكتيكي — حدّد الهدف أولاً.',
    point2Title: 'اشترِ بأرقام حية',
    point2Copy: 'استخدم السعر الفوري المرتبط بالسوق قبل الذهاب إلى المتجر أو تنفيذ الشراء.',
    point3Title: 'احترم العلاوة',
    point3Copy: 'العلاوة الخاطئة قد تفسد قراراً جيداً في الذهب.',
    liveLabel: 'لقطة حية للذهب',
    liveTitle: 'ملخص الاستثمار',
    statSpot: 'السعر الفوري (XAU/USD)',
    statSpotNote: 'لكل أوقية تروي',
    stat24: '24K • درهم / غرام',
    stat24Note: 'مرجع السبائك',
    stat22: '22K • درهم / غرام',
    stat22Note: 'مرجع المشغولات',
    stat21: '21K • درهم / غرام',
    stat21Note: 'عيار شائع في الخليج',
    fetching: 'جارٍ جلب البيانات الحية…',
    updated: 'آخر تحديث',
    marketOpen: 'السوق مفتوح',
    marketClosed: 'السوق مغلق',
    openTracker: 'افتح المتتبع الكامل ←',
    jumpGoals: 'الهدف',
    jumpPlanner: 'الخطة',
    jumpCompare: 'المقارنة',
    jumpMarkets: 'الأسواق',
    jumpFaq: 'الأسئلة',
    goalsKicker: 'ابدأ بالنية',
    goalsTitle: 'اختر الوظيفة التي تريدها من الذهب',
    goalsSub:
      'أفضل منتج يتغير حسب ما إذا كنت تريد الحماية أو الاستخدام الثقافي أو تمركزاً قصير الأجل.',
    plannerKicker: 'مخطط مباشر',
    plannerTitle: 'ماذا تستطيع ميزانيتك أن تشتري فعلاً؟',
    plannerSub: 'استخدم تقديرات السوق الحية لتحديد حجم شراء لمرة واحدة أو خطة تجميع شهرية.',
    marketLabel: 'السوق الأساسي',
    typeLabel: 'نوع المنتج',
    frequencyLabel: 'أسلوب الشراء',
    type24: 'سبائك 24K',
    type22: 'مجوهرات 22K',
    typeETF: 'صندوق ذهب ETF',
    oneTime: 'شراء مرة واحدة',
    monthly: 'تجميع شهري',
    planSnapshot: 'ملخص الخطة',
    planSub: 'تقدير عقلاني سريع بناءً على السوق الحالي.',
    resultBudget: 'الميزانية',
    resultGrams: 'الجرامات التقريبية',
    resultOunces: 'الأوقيات التقريبية',
    resultAnnual: 'تجميع 12 شهراً',
    resultPremium: 'العلاوة المعتادة',
    compareKicker: 'اختيار المنتج',
    compareTitle: 'ما الذي يبدو منطقياً فعلاً؟',
    compareSub:
      'لا تشترِ بالطريقة نفسها لكل هدف. السبائك والمجوهرات والصناديق تحل مشكلات مختلفة.',
    marketsKicker: 'أين تشتري',
    marketsTitle: 'كيف تشتري في سوقك',
    marketsSub:
      'اختر القناة الصحيحة، واسأل الأسئلة الصحيحة، وتجنب الأخطاء الواضحة قبل الدفع.',
    mistakesKicker: 'الانضباط أولاً',
    mistakesTitle: 'أخطاء شائعة تضر بالعائد',
    mistakesSub: 'أكبر المشكلات غالباً تأتي من العلاوة والتخزين والتوقيت العاطفي.',
    faqKicker: 'قبل أن تشتري',
    faqTitle: 'أسئلة تستحق أن تُسأل أولاً',
    faqSub: 'غالباً ما تبدأ صفقة الذهب الجيدة بالسؤال الصحيح، لا بالمقطع المنتشر.',
    finalTitle: 'جاهز لاتخاذ قرار ذهب أنظف؟',
    finalSub:
      'استخدم المتتبع المباشر قبل الشراء، ثم ارجع هنا لتحديد الحجم والمقارنة في حركتك التالية.',
    finalBtn: 'افتح المتتبع المباشر ←',
    planBudgetNote: 'باستخدام التسعير المحلي الحالي',
    planGramsNote: 'تقدير مرتبط بالسعر الفوري',
    planOuncesNote: '31.1035 غرام لكل أوقية تروي',
    planEtfNote: 'تعرض مكافئ للسعر الفوري',
    metaLive: 'مبني على سعر حي',
    metaSpot: 'تقدير مرتبط بالسعر الفوري',
    metaAed: 'ربط الدرهم ثابت عند 3.6725',
    metaVerify: 'تحقق من العلاوة المحلية قبل الشراء',
  },
};

const PURPOSES = {
  en: {
    hedge: {
      icon: '🛡️',
      title: 'Hedge & safety',
      sub: 'Preserve purchasing power and diversify savings',
      adviceTitle: 'Use gold like insurance, not like excitement',
      body: 'If the goal is defense, keep it simple: focus on 24K bars or a low-cost gold ETF, keep premiums low, and store it properly.',
      bullets: [
        'Prioritize 24K bullion or low-cost ETF exposure',
        'Avoid paying jewelry-like premiums for an investment purchase',
        'Think in years, not in weekends',
      ],
    },
    culture: {
      icon: '💍',
      title: 'Jewelry & culture',
      sub: 'Wear it, gift it, and still keep value',
      adviceTitle: 'Buy 22K for use, not because it is the “best investment” on paper',
      body: 'If the point is gifting, family transfer, or cultural value, 22K can make sense — but you must respect making charges and resale reality.',
      bullets: [
        'Compare weight, purity, and making charges before emotion takes over',
        'Use 22K when wearability and tradition matter',
        'Treat part of the premium as a lifestyle cost, not a pure investment return',
      ],
    },
    profit: {
      icon: '📈',
      title: 'Tactical trade',
      sub: 'Short-term positioning with strict discipline',
      adviceTitle: 'Short-term gold needs rules, not feelings',
      body: 'If the goal is tactical profit, gold can work — but only with clear entries, exits, and risk limits. Do not confuse trading with “safe” buying.',
      bullets: [
        'Use live spot and alerts before entering',
        'Avoid physical gold with large premiums for short-term flipping',
        'Have a clear sell condition before you buy',
      ],
    },
  },
  ar: {
    hedge: {
      icon: '🛡️',
      title: 'تحوط وأمان',
      sub: 'حماية القوة الشرائية وتنويع المدخرات',
      adviceTitle: 'استخدم الذهب كنوع من التأمين، لا كإثارة',
      body: 'إذا كان الهدف دفاعياً، فالأفضل أن تبقيه بسيطاً: ركّز على سبائك 24K أو صندوق ذهب منخفض التكلفة، وقلّل العلاوة وخزّنه بشكل صحيح.',
      bullets: [
        'أعطِ الأولوية لسبائك 24K أو صناديق الذهب منخفضة التكلفة',
        'لا تدفع علاوات تشبه المجوهرات في شراء استثماري',
        'فكّر بالسنوات لا بعطلة نهاية الأسبوع',
      ],
    },
    culture: {
      icon: '💍',
      title: 'مجوهرات وثقافة',
      sub: 'تلبسه، تهديه، وتحتفظ بقيمته',
      adviceTitle: 'اشترِ 22K للاستخدام، لا لأنه “أفضل استثمار” نظرياً',
      body: 'إذا كانت الفكرة هدية أو إرثاً عائلياً أو قيمة ثقافية، فقد يكون 22K منطقياً — لكن يجب أن تحترم أجور الصنعة وواقع إعادة البيع.',
      bullets: [
        'قارن الوزن والعيار وأجور الصنعة قبل أن تتغلب العاطفة',
        'استخدم 22K عندما تكون القابلية للبس والتقاليد مهمة',
        'اعتبر جزءاً من العلاوة تكلفة استخدام لا عائداً استثمارياً خالصاً',
      ],
    },
    profit: {
      icon: '📈',
      title: 'مضاربة تكتيكية',
      sub: 'تمركز قصير الأجل بانضباط صارم',
      adviceTitle: 'الربح القصير في الذهب يحتاج قواعد لا مشاعر',
      body: 'إذا كان الهدف ربحاً تكتيكياً، فقد ينجح الذهب — لكن فقط مع نقاط دخول وخروج وحدود مخاطرة واضحة. لا تخلط التداول بالشراء “الآمن”.',
      bullets: [
        'استخدم السعر الفوري والتنبيهات قبل الدخول',
        'تجنب الذهب المادي ذو العلاوات الكبيرة للمضاربة السريعة',
        'ضع شرط بيع واضحاً قبل أن تشتري',
      ],
    },
  },
};

const COMPARE = {
  en: [
    {
      title: '24K bullion',
      tag: 'Cleanest exposure',
      copy: 'Best when you want gold itself with the least distortion between spot price and what you own.',
      bullets: [
        'Usually the lowest premium path into physical gold',
        'Best for long holding periods and clean resale logic',
        'Needs secure storage and disciplined buying',
      ],
    },
    {
      title: '22K jewelry',
      tag: 'Use + value',
      copy: 'Makes sense when cultural use and wearability matter alongside metal value — but pricing discipline matters.',
      bullets: [
        'You are paying for design, labor, and sometimes brand value',
        'Good for gifting and family transfer in GCC contexts',
        'Not the cleanest pure-investment vehicle',
      ],
    },
    {
      title: 'Gold ETF',
      tag: 'Convenience first',
      copy: 'Useful when you want portfolio exposure, liquidity, and easy execution without storing physical metal.',
      bullets: [
        'Fast to buy and sell through a brokerage account',
        'No physical storage problem',
        'You own market exposure, not bars in your hand',
      ],
    },
  ],
  ar: [
    {
      title: 'سبائك 24K',
      tag: 'أنظف تعرض',
      copy: 'الأفضل عندما تريد الذهب نفسه بأقل تشويه ممكن بين السعر الفوري وما تملكه فعلياً.',
      bullets: [
        'غالباً أقل طريق من حيث العلاوة إلى الذهب المادي',
        'أفضل للاحتفاظ الطويل ومنطق إعادة البيع الواضح',
        'يحتاج تخزيناً آمناً وانضباطاً في الشراء',
      ],
    },
    {
      title: 'مجوهرات 22K',
      tag: 'استخدام + قيمة',
      copy: 'تكون منطقية عندما تكون القابلية للبس والقيمة الثقافية مهمة إلى جانب قيمة المعدن — لكن الانضباط السعري ضروري.',
      bullets: [
        'أنت تدفع مقابل التصميم والعمل وأحياناً قيمة العلامة',
        'مناسبة للهدايا والنقل العائلي في سياق الخليج',
        'ليست أنظف وسيلة استثمارية بحتة',
      ],
    },
    {
      title: 'صندوق ذهب ETF',
      tag: 'السهولة أولاً',
      copy: 'مفيد عندما تريد تعرضاً للمحفظة وسيولة وسهولة تنفيذ من دون تخزين الذهب مادياً.',
      bullets: [
        'سريع في الشراء والبيع عبر حساب وساطة',
        'لا توجد مشكلة تخزين مادي',
        'أنت تملك تعرضاً للسوق لا سبائك في يدك',
      ],
    },
  ],
};

const MARKET_GUIDES = {
  en: {
    AE: {
      title: 'UAE buying guide',
      pill: 'Dubai / Abu Dhabi',
      blocks: [
        {
          title: 'Best use case',
          body: 'Strong market for both bullion and jewelry. Best if you want deep product choice, visible pricing, and generally strong liquidity.',
        },
        {
          title: 'What to check',
          list: [
            'Ask for purity, weight, and making charge separately',
            'For investment, favor 24K bars and compare premiums closely',
            'Confirm resale policy and invoice clarity',
          ],
        },
        {
          title: 'Where people usually buy',
          body: 'Banks, major bullion dealers, and well-known jewelry chains or souk merchants with clear pricing.',
        },
        {
          title: 'Main mistake',
          body: 'Paying a jewelry-style making charge when the real goal is an investment purchase.',
        },
      ],
    },
    SA: {
      title: 'Saudi Arabia buying guide',
      pill: 'Riyadh / Jeddah / Dammam',
      blocks: [
        {
          title: 'Best use case',
          body: 'Useful if you want local access through established dealers and a familiar market for both gifting and investment-oriented buying.',
        },
        {
          title: 'What to check',
          list: [
            'Verify purity stamps and documentation',
            'Separate metal value from labor and design charges',
            'Confirm whether you are buying for holding, gifting, or resale',
          ],
        },
        {
          title: 'Where people usually buy',
          body: 'Established jewelry markets, recognized dealers, and institutional channels where documentation is clear.',
        },
        {
          title: 'Main mistake',
          body: 'Buying based on presentation and store feel without breaking down premium and resale reality.',
        },
      ],
    },
    EG: {
      title: 'Egypt buying guide',
      pill: 'Cairo / Alexandria',
      blocks: [
        {
          title: 'Best use case',
          body: 'Often attractive for savers who think in metal weight and family wealth preservation, especially when inflation risk is top of mind.',
        },
        {
          title: 'What to check',
          list: [
            'Weigh the item in front of you',
            'Make sure purity and pricing method are clear',
            'Ask about resale deduction before buying',
          ],
        },
        {
          title: 'Where people usually buy',
          body: 'Established gold districts, trusted dealers, and banks or formal channels when available.',
        },
        {
          title: 'Main mistake',
          body: 'Not confirming exact pricing method and resale deduction before committing cash.',
        },
      ],
    },
  },
  ar: {
    AE: {
      title: 'دليل الشراء في الإمارات',
      pill: 'دبي / أبوظبي',
      blocks: [
        {
          title: 'أفضل استخدام',
          body: 'سوق قوي للسبائك والمجوهرات مع خيارات واسعة وتسعير ظاهر وسيولة جيدة غالباً.',
        },
        {
          title: 'ما الذي تفحصه',
          list: [
            'اطلب العيار والوزن وأجر الصنعة كلٌّ على حدة',
            'للاستثمار فضّل سبائك 24K وقارن العلاوات بدقة',
            'تأكد من سياسة إعادة البيع ووضوح الفاتورة',
          ],
        },
        {
          title: 'أين يشتري الناس عادة',
          body: 'البنوك، وتجار السبائك المعروفون، وسلاسل المجوهرات المعروفة أو تجار السوق مع تسعير واضح.',
        },
        {
          title: 'الخطأ الرئيسي',
          body: 'دفع أجر صنعة يشبه المجوهرات بينما الهدف الحقيقي شراء استثماري.',
        },
      ],
    },
    SA: {
      title: 'دليل الشراء في السعودية',
      pill: 'الرياض / جدة / الدمام',
      blocks: [
        {
          title: 'أفضل استخدام',
          body: 'مناسب إذا كنت تريد وصولاً محلياً عبر تجار معروفين وسوقاً مألوفة للهدايا والشراء الاستثماري معاً.',
        },
        {
          title: 'ما الذي تفحصه',
          list: [
            'تحقق من أختام العيار والوثائق',
            'افصل بين قيمة المعدن وتكلفة العمل والتصميم',
            'حدد هل تشتري للاحتفاظ أم الهدية أم إعادة البيع',
          ],
        },
        {
          title: 'أين يشتري الناس عادة',
          body: 'أسواق المجوهرات المعروفة، والتجار الموثوقون، والقنوات المؤسسية ذات الوثائق الواضحة.',
        },
        {
          title: 'الخطأ الرئيسي',
          body: 'الشراء بناءً على العرض والشكل العام للمتجر من دون تفكيك العلاوة وواقع إعادة البيع.',
        },
      ],
    },
    EG: {
      title: 'دليل الشراء في مصر',
      pill: 'القاهرة / الإسكندرية',
      blocks: [
        {
          title: 'أفضل استخدام',
          body: 'غالباً مناسب للمدخرين الذين يفكرون بوزن المعدن وحفظ الثروة العائلية خاصة مع القلق من التضخم.',
        },
        {
          title: 'ما الذي تفحصه',
          list: [
            'زِن القطعة أمامك',
            'تأكد من وضوح العيار وطريقة التسعير',
            'اسأل عن خصم إعادة البيع قبل الشراء',
          ],
        },
        {
          title: 'أين يشتري الناس عادة',
          body: 'مناطق الذهب المعروفة، والتجار الموثوقون، والبنوك أو القنوات الرسمية عند توفرها.',
        },
        {
          title: 'الخطأ الرئيسي',
          body: 'عدم تأكيد طريقة التسعير وخصم إعادة البيع بدقة قبل إخراج النقد.',
        },
      ],
    },
  },
};

const MISTAKES = {
  en: [
    {
      title: 'Buying for ego',
      copy: 'If the reason is image or panic, the premium usually wins and your discipline loses.',
    },
    {
      title: 'Ignoring premium',
      copy: 'Spot is only one part of the bill. Making charge and spread matter a lot.',
    },
    {
      title: 'No resale plan',
      copy: 'Know where and how you would sell before buying anything physical.',
    },
    {
      title: 'All-in concentration',
      copy: 'Gold is useful, but it is not a full financial plan by itself.',
    },
    {
      title: 'Confusing jewelry with bullion',
      copy: 'Jewelry can hold value, but it is not the same thing as clean metal exposure.',
    },
    {
      title: 'Following noise',
      copy: 'A trending reel is not a buy signal. Use live prices and real thresholds.',
    },
  ],
  ar: [
    {
      title: 'الشراء بدافع الصورة',
      copy: 'إذا كان السبب هو المظهر أو الذعر فغالباً ستربح العلاوة ويخسر انضباطك.',
    },
    {
      title: 'تجاهل العلاوة',
      copy: 'السعر الفوري جزء واحد فقط من الفاتورة. أجر الصنعة والهامش مهمان جداً.',
    },
    { title: 'لا توجد خطة بيع', copy: 'اعرف أين وكيف ستبيع قبل شراء أي ذهب مادي.' },
    { title: 'التركيز الكامل', copy: 'الذهب مفيد لكنه ليس خطة مالية كاملة وحده.' },
    {
      title: 'خلط المجوهرات بالسبائك',
      copy: 'المجوهرات قد تحفظ قيمة، لكنها ليست التعرض الأنظف للمعدن.',
    },
    {
      title: 'اتباع الضجيج',
      copy: 'المقطع المنتشر ليس إشارة شراء. استخدم الأسعار الحية والحدود الواضحة.',
    },
  ],
};

const FAQ = {
  en: [
    {
      q: 'Is 24K always the best investment choice?',
      a: 'Usually for pure metal exposure, yes — but “best” still depends on premium, storage, liquidity, and your actual purpose.',
    },
    {
      q: 'When does 22K make more sense?',
      a: 'When cultural use, gifting, or family transfer matters. It can still preserve value, but you must respect making charges.',
    },
    {
      q: 'Should I buy all at once or monthly?',
      a: 'Monthly stacking reduces timing stress. A one-time purchase can work if you already have a clear allocation plan and strong pricing discipline.',
    },
    {
      q: 'Is a gold ETF better than physical gold?',
      a: 'Better for convenience and portfolio access. Physical gold is better when direct metal ownership matters to you.',
    },
    {
      q: 'What should I check before buying from a store?',
      a: 'Purity, weight, premium or making charge, invoice clarity, and how resale is handled.',
    },
  ],
  ar: [
    {
      q: 'هل 24K هو دائماً أفضل خيار استثماري؟',
      a: 'غالباً نعم للتعرض الأنظف للمعدن، لكن “الأفضل” يعتمد أيضاً على العلاوة والتخزين والسيولة وهدفك الحقيقي.',
    },
    {
      q: 'متى يكون 22K أكثر منطقية؟',
      a: 'عندما تكون الهدية أو الاستخدام الثقافي أو النقل العائلي مهماً. يمكنه حفظ القيمة، لكن يجب احترام أجر الصنعة.',
    },
    {
      q: 'هل أشتري دفعة واحدة أم شهرياً؟',
      a: 'التجميع الشهري يقلل ضغط التوقيت. والشراء مرة واحدة قد ينجح إذا كانت لديك نسبة واضحة وانضباط قوي في التسعير.',
    },
    {
      q: 'هل صندوق الذهب ETF أفضل من الذهب المادي؟',
      a: 'هو أفضل من حيث السهولة والوصول للمحفظة. الذهب المادي أفضل عندما تكون الملكية المباشرة للمعدن مهمة لك.',
    },
    {
      q: 'ما الذي أفحصه قبل الشراء من متجر؟',
      a: 'العيار، والوزن، والعلاوة أو أجر الصنعة، ووضوح الفاتورة، وكيفية إعادة البيع.',
    },
  ],
};

const state = {
  lang: 'en',
  goldPriceUsdPerOz: null,
  dayOpenUsdPerOz: null,
  rates: {},
  purpose: 'hedge',
  market: 'AE',
  type: '24',
  frequency: 'one-time',
  budget: 10000,
  timer: null,
};

function getLang() {
  try {
    const p = JSON.parse(localStorage.getItem(LANG_KEY) || '{}');
    return p.lang || 'en';
  } catch {
    return 'en';
  }
}

function saveLang(nextLang) {
  try {
    const p = JSON.parse(localStorage.getItem(LANG_KEY) || '{}');
    p.lang = nextLang;
    localStorage.setItem(LANG_KEY, JSON.stringify(p));
  } catch {}
}

function getMarketStatus() {
  const now = new Date();
  const utcDay = now.getUTCDay();
  const utcTime = now.getUTCHours() * 60 + now.getUTCMinutes();
  const OPEN_SUN = 22 * 60;
  const CLOSE_FRI = 21 * 60;

  let isOpen = false;
  if (utcDay === 6) isOpen = false;
  else if (utcDay === 5) isOpen = utcTime < CLOSE_FRI;
  else if (utcDay === 0) isOpen = utcTime >= OPEN_SUN;
  else isOpen = true;

  return isOpen ? 'open' : 'closed';
}

function tx(key) {
  return I18N[state.lang]?.[key] ?? I18N.en[key] ?? key;
}

function karat(code) {
  return KARATS.find((k) => k.code === code);
}

function getLocalRate(marketCode) {
  if (marketCode === 'AE') return CONSTANTS.AED_PEG;
  return state.rates[MARKET_META[marketCode].currency] ?? null;
}

function getLocalPricePerGram(type, marketCode) {
  if (!state.goldPriceUsdPerOz) return null;
  const rate = getLocalRate(marketCode);
  if (!rate) return null;
  if (type === 'ETF')
    return calc.usdPerGram(state.goldPriceUsdPerOz, karat('24').purity) * rate;

  const purity = karat(type).purity;
  return calc.usdPerGram(state.goldPriceUsdPerOz, purity) * rate;
}

function formatCurrency(value, currency, decimals = 2) {
  if (value == null || Number.isNaN(value)) return '—';
  return fmt.formatPrice(value, currency, decimals);
}

function formatWeightGrams(value) {
  if (value == null || Number.isNaN(value)) return '—';
  return `${value.toFixed(2)} g`;
}

function formatWeightOz(value) {
  if (value == null || Number.isNaN(value)) return '—';
  return `${value.toFixed(3)} oz`;
}

function renderStaticText() {
  document.documentElement.lang = state.lang;
  document.documentElement.dir = state.lang === 'ar' ? 'rtl' : 'ltr';

  document.querySelectorAll('[data-i18n]').forEach((node) => {
    const key = node.getAttribute('data-i18n');
    node.textContent = tx(key);
  });

  document.getElementById('budget-label').textContent =
    `${state.lang === 'ar' ? 'الميزانية' : 'Budget'} (${MARKET_META[state.market].currency})`;

  document.title =
    state.lang === 'ar'
      ? 'الاستثمار في الذهب | خطة عقلانية للإمارات والسعودية ومصر'
      : 'Gold Investing Guide | Rational Gold Plan for UAE, Saudi & Egypt';
}

function renderChipButtons(root, entries, { active, dataKey, baseClass, onSelect }) {
  clear(root);
  for (const [code, label] of entries) {
    const btn = el(
      'button',
      {
        type: 'button',
        class: `${baseClass}${active === code ? ' is-active' : ''}`,
        dataset: { [dataKey]: code },
      },
      [label]
    );
    btn.addEventListener('click', () => onSelect(code));
    root.append(btn);
  }
}

function renderPurposeCards() {
  const root = document.getElementById('purpose-cards');
  const items = PURPOSES[state.lang];

  clear(root);
  for (const [key, item] of Object.entries(items)) {
    const btn = el(
      'button',
      {
        type: 'button',
        class: `invest-goal-card${state.purpose === key ? ' is-active' : ''}`,
        dataset: { purpose: key },
      },
      [
        el('span', { class: 'invest-goal-icon', 'aria-hidden': 'true' }, [item.icon]),
        el('div', { class: 'invest-goal-title' }, [item.title]),
        el('div', { class: 'invest-goal-sub' }, [item.sub]),
      ]
    );
    btn.addEventListener('click', () => {
      state.purpose = key;
      renderPurposeCards();
      renderPlanner();
    });
    root.append(btn);
  }

  const active = items[state.purpose];
  const output = document.getElementById('purpose-output');
  clear(output);
  output.append(
    el('h3', { class: 'invest-advice-title' }, [active.adviceTitle]),
    el('p', { class: 'invest-advice-body' }, [active.body]),
    el(
      'ul',
      { class: 'invest-bullets' },
      active.bullets.map((text) => el('li', null, [text]))
    )
  );
}

function renderMarketChips() {
  const root = document.getElementById('market-chips');
  renderChipButtons(
    root,
    Object.entries(MARKET_META).map(([code, meta]) => [code, meta.name[state.lang]]),
    {
      active: state.market,
      dataKey: 'market',
      baseClass: 'invest-chip',
      onSelect: (code) => {
        state.market = code;
        renderMarketChips();
        renderMarketGuide();
        renderPlanner();
        renderStaticText();
      },
    }
  );
}

function renderTypeChips() {
  const map = {
    24: tx('type24'),
    22: tx('type22'),
    ETF: tx('typeETF'),
  };

  const root = document.getElementById('type-chips');
  renderChipButtons(root, Object.entries(map), {
    active: state.type,
    dataKey: 'type',
    baseClass: 'invest-chip',
    onSelect: (code) => {
      state.type = code;
      renderTypeChips();
      renderPlanner();
    },
  });
}

function renderFrequencyChips() {
  const map = {
    'one-time': tx('oneTime'),
    monthly: tx('monthly'),
  };

  const root = document.getElementById('frequency-chips');
  renderChipButtons(root, Object.entries(map), {
    active: state.frequency,
    dataKey: 'frequency',
    baseClass: 'invest-chip',
    onSelect: (code) => {
      state.frequency = code;
      renderFrequencyChips();
      renderPlanner();
    },
  });
}

function getPlannerSummary(_pricePerGram) {
  const marketName = MARKET_META[state.market].name[state.lang];
  const currency = MARKET_META[state.market].currency;
  const purposeMap = PURPOSES[state.lang][state.purpose];

  const adviceByType = {
    24:
      state.lang === 'ar'
        ? `إذا كنت تريد تعرضاً أنظف للمعدن في ${marketName}، فابدأ بسبائك 24K فقط عندما تكون العلاوة واضحة ومنخفضة.`
        : `If you want the cleanest metal exposure in ${marketName}, start with 24K bars only when the premium is clear and reasonably low.`,
    22:
      state.lang === 'ar'
        ? `إذا كان الهدف استخداماً ثقافياً أو هدية في ${marketName}، فاستخدم 22K ولكن عامل أجر الصنعة كتكلفة استخدام لا كعائد.`
        : `If the goal is gifting or cultural use in ${marketName}, 22K can work — just treat making charges as a use-cost, not as investment return.`,
    ETF:
      state.lang === 'ar'
        ? 'إذا كان الهدف سهولة التنفيذ دون تخزين، فصندوق الذهب قد يكون أنظف من شراء مشغولات بعلاوة مرتفعة.'
        : 'If ease and no-storage matter most, a gold ETF can be cleaner than overpaying for physical products with high premiums.',
  };

  const premiumMap = {
    24: state.lang === 'ar' ? 'تقريباً 0%–2% فوق الفوري' : 'roughly 0%–2% over spot',
    22:
      state.lang === 'ar'
        ? 'تقريباً 8%–20% حسب الصنعة'
        : 'roughly 8%–20% depending on making charge',
    ETF:
      state.lang === 'ar'
        ? 'رسوم إدارة/تنفيذ منخفضة عادة'
        : 'usually low management / execution cost',
  };

  return {
    summary:
      state.lang === 'ar'
        ? `${purposeMap.title}: بميزانية ${formatCurrency(state.budget, currency, MARKET_META[state.market].decimals)} في ${marketName}، هذا تقدير فوري لما يمكن أن تبنيه الآن. ${adviceByType[state.type]}`
        : `${purposeMap.title}: with ${formatCurrency(state.budget, currency, MARKET_META[state.market].decimals)} in ${marketName}, this is a live estimate of what you could build right now. ${adviceByType[state.type]}`,
    meta: [
      tx('metaLive'),
      tx('metaSpot'),
      state.market === 'AE' ? tx('metaAed') : premiumMap[state.type],
      tx('metaVerify'),
    ],
  };
}

function renderPlanner() {
  const pricePerGram = getLocalPricePerGram(state.type, state.market);
  const currency = MARKET_META[state.market].currency;
  const decimals = MARKET_META[state.market].decimals;
  const grams = pricePerGram ? state.budget / pricePerGram : null;
  const ounces = grams ? grams / CONSTANTS.GRAMS_PER_TROY_OUNCE : null;
  const annual = grams ? (state.frequency === 'monthly' ? grams * 12 : grams) : null;

  document.getElementById('result-budget').textContent = formatCurrency(
    state.budget,
    currency,
    decimals
  );
  const budgetEl = document.getElementById('result-budget');
  budgetEl.classList.remove('skeleton-inline', 'shell-skeleton-price-md');
  budgetEl.removeAttribute('aria-busy');
  document.getElementById('result-budget-note').textContent = tx('planBudgetNote');

  const gramsEl = document.getElementById('result-grams');
  const ouncesEl = document.getElementById('result-ounces');
  if (grams != null) {
    gramsEl.textContent = formatWeightGrams(grams);
    gramsEl.classList.remove('skeleton-inline', 'shell-skeleton-karat');
    gramsEl.removeAttribute('aria-busy');
  } else if (!state.goldPriceUsdPerOz) {
    mountSkeleton(gramsEl, 'karat');
  } else {
    gramsEl.textContent = formatWeightGrams(grams);
  }
  document.getElementById('result-grams-note').textContent = pricePerGram
    ? `${formatCurrency(pricePerGram, currency, decimals)} / g`
    : '';

  if (ounces != null) {
    ouncesEl.textContent = formatWeightOz(ounces);
    ouncesEl.classList.remove('skeleton-inline', 'shell-skeleton-karat');
    ouncesEl.removeAttribute('aria-busy');
  } else if (!state.goldPriceUsdPerOz) {
    mountSkeleton(ouncesEl, 'karat');
  } else {
    ouncesEl.textContent = formatWeightOz(ounces);
  }
  document.getElementById('result-ounces-note').textContent = tx('planOuncesNote');

  const fourthLabel = document.getElementById('result-fourth-label');
  const fourthValue = document.getElementById('result-fourth');
  const fourthNote = document.getElementById('result-fourth-note');

  if (state.frequency === 'monthly') {
    fourthLabel.textContent = tx('resultAnnual');
    fourthValue.textContent = formatWeightGrams(annual);
    fourthValue.classList.remove('skeleton-inline', 'shell-skeleton-karat');
    fourthValue.removeAttribute('aria-busy');
    fourthNote.textContent =
      state.lang === 'ar'
        ? 'إذا حافظت على الوتيرة نفسها 12 شهراً'
        : 'if you keep the same pace for 12 months';
  } else {
    fourthLabel.textContent = tx('resultPremium');
    fourthValue.textContent =
      state.type === '24'
        ? state.lang === 'ar'
          ? '0%–2%'
          : '0%–2%'
        : state.type === '22'
          ? state.lang === 'ar'
            ? '8%–20%'
            : '8%–20%'
          : state.lang === 'ar'
            ? 'منخفض'
            : 'Low';
    fourthValue.classList.remove('skeleton-inline', 'shell-skeleton-karat');
    fourthValue.removeAttribute('aria-busy');
    fourthNote.textContent =
      state.type === 'ETF'
        ? tx('planEtfNote')
        : state.lang === 'ar'
          ? 'يختلف حسب التاجر والمنتج'
          : 'varies by dealer and product';
  }

  const planner = getPlannerSummary(pricePerGram);
  document.getElementById('planner-summary').textContent = planner.summary;
  const metaRoot = document.getElementById('planner-meta');
  clear(metaRoot);
  for (const item of planner.meta) {
    metaRoot.append(el('span', { class: 'invest-mini-chip' }, [item]));
  }
}

function renderCompare() {
  const root = document.getElementById('compare-grid');
  clear(root);
  for (const item of COMPARE[state.lang]) {
    root.append(
      el('article', { class: 'invest-compare-card' }, [
        el('div', { class: 'invest-compare-top' }, [
          el('h3', { class: 'invest-compare-title' }, [item.title]),
          el('span', { class: 'invest-compare-tag' }, [item.tag]),
        ]),
        el('p', { class: 'invest-compare-copy' }, [item.copy]),
        el(
          'ul',
          { class: 'invest-compare-list' },
          item.bullets.map((b) => el('li', null, [b]))
        ),
      ])
    );
  }
}

function renderMarketTabs() {
  const root = document.getElementById('market-tabs');
  renderChipButtons(
    root,
    Object.entries(MARKET_META).map(([code, meta]) => [code, meta.name[state.lang]]),
    {
      active: state.market,
      dataKey: 'marketTab',
      baseClass: 'invest-tab',
      onSelect: (code) => {
        state.market = code;
        renderMarketTabs();
        renderMarketChips();
        renderMarketGuide();
        renderPlanner();
        renderStaticText();
      },
    }
  );
}

function renderMarketGuide() {
  const guide = MARKET_GUIDES[state.lang][state.market];
  const root = document.getElementById('market-guide');
  clear(root);
  root.append(
    el('div', { class: 'invest-guide-head' }, [
      el('h3', { class: 'invest-guide-title' }, [guide.title]),
      el('span', { class: 'invest-guide-pill' }, [guide.pill]),
    ]),
    el(
      'div',
      { class: 'invest-guide-grid' },
      guide.blocks.map((block) =>
        el('div', { class: 'invest-guide-block' }, [
          el('h4', null, [block.title]),
          block.list
            ? el('ul', null, block.list.map((item) => el('li', null, [item])))
            : el('p', null, [block.body]),
        ])
      )
    )
  );
}

function renderMistakes() {
  const root = document.getElementById('mistakes-grid');
  clear(root);
  MISTAKES[state.lang].forEach((item, index) => {
    root.append(
      el('article', { class: 'invest-mistake-card' }, [
        el('span', { class: 'invest-mistake-index' }, [String(index + 1)]),
        el('h3', { class: 'invest-mistake-title' }, [item.title]),
        el('p', { class: 'invest-mistake-copy' }, [item.copy]),
      ])
    );
  });
}

function renderFaq() {
  const root = document.getElementById('faq-list');
  clear(root);
  for (const item of FAQ[state.lang]) {
    root.append(
      el('details', { class: 'invest-faq-item' }, [
        el('summary', null, [item.q]),
        el('div', { class: 'invest-faq-answer' }, [item.a]),
      ])
    );
  }
}

function renderLiveCard() {
  const panel = document.getElementById('invest-live-panel');
  const status = getMarketStatus();
  const spot = state.goldPriceUsdPerOz;
  const p24 = spot ? getLocalPricePerGram('24', 'AE') : null;
  const p22 = spot ? getLocalPricePerGram('22', 'AE') : null;
  const p21 = spot ? getLocalPricePerGram('21', 'AE') : null;

  const statusEl = document.getElementById('invest-market-status');
  if (spot) {
    statusEl.textContent = status === 'open' ? tx('marketOpen') : tx('marketClosed');
    statusEl.className = `invest-market-chip ${status === 'open' ? 'is-open' : 'is-closed'}`;
  } else {
    mountSkeleton(statusEl, 'freshnessChip');
  }

  const setStat = (id, value, currency, decimals) => {
    const elNode = document.getElementById(id);
    if (!elNode) return;
    if (spot && value != null) {
      elNode.textContent = formatCurrency(value, currency, decimals);
    } else {
      mountSkeleton(elNode, 'priceMd');
    }
  };
  setStat('stat-spot', spot, 'USD', 2);
  setStat('stat-24', p24, 'AED', 2);
  setStat('stat-22', p22, 'AED', 2);
  setStat('stat-21', p21, 'AED', 2);

  const updatedEl = document.getElementById('invest-updated');
  if (updatedEl) {
    if (state.goldPriceUsdPerOz) {
      updatedEl.textContent = `${tx('updated')}: ${fmt.formatTimestampShort(new Date().toISOString(), state.lang)}`;
    } else {
      mountSkeleton(updatedEl, 'freshnessStrip');
    }
  }

  if (spot) panel.removeAttribute('aria-busy');

  if (spot) {
    const p18 = getLocalPricePerGram('18', 'AE');
    updateTicker({
      xauUsd: spot,
      uae24k: p24,
      uae22k: p22,
      uae21k: p21,
      uae18k: p18,
    });
  }
}

function applyLang() {
  renderStaticText();
  renderPurposeCards();
  renderMarketChips();
  renderTypeChips();
  renderFrequencyChips();
  renderCompare();
  renderMarketTabs();
  renderMarketGuide();
  renderMistakes();
  renderFaq();
  renderPlanner();
  renderLiveCard();
  shellCtrl?.updateLang(state.lang);
}

async function fetchLiveData() {
  if (!navigator.onLine) return;

  const { gold, fx, errors } = await api.fetchGoldAndFX();

  if (gold?.price) {
    state.goldPriceUsdPerOz = gold.price;
    cache.saveGoldPrice(gold.price, gold.updatedAt);
    hideDataStatusBanner();
  }

  if (fx?.rates) {
    state.rates = fx.rates ?? {};
    cache.saveFXRates(state.rates, {
      lastUpdateUtc: fx.time_last_update_utc,
      nextUpdateUtc: fx.time_next_update_utc,
    });
  }

  if (!state.goldPriceUsdPerOz && (errors.gold || errors.fx)) {
    showDataStatusBanner({
      lang: state.lang,
      variant: 'error',
      message:
        TRANSLATIONS[state.lang]?.['status.noData'] ??
        TRANSLATIONS.en['status.noData'],
      onRetry: fetchLiveData,
    });
  }

  renderLiveCard();
  renderPlanner();
}

function bindBudgetInputs() {
  const input = document.getElementById('budget-input');
  const range = document.getElementById('budget-range');

  const sync = (nextValue) => {
    const value = Math.max(250, Number(nextValue) || 250);
    state.budget = value;
    input.value = value;
    range.value = Math.min(Number(range.max), value);
    renderPlanner();
  };

  input.addEventListener('input', (e) => sync(e.target.value));
  range.addEventListener('input', (e) => sync(e.target.value));
}

async function init() {
  state.lang = getLang();

  shellCtrl = mountSharedShell({ lang: state.lang, depth: 0 });
  const navCtrl = shellCtrl.navCtrl;
  injectBreadcrumbs('invest');
  navCtrl.getLangToggleButtons().forEach((btn) => {
    btn.addEventListener('click', () => {
      state.lang = state.lang === 'en' ? 'ar' : 'en';
      saveLang(state.lang);
      applyLang();
    });
  });

  const stub = {
    lang: state.lang,
    goldPriceUsdPerOz: null,
    rates: {},
    fxMeta: { nextUpdateUtc: 0 },
    status: {},
    freshness: {},
    favorites: [],
    history: [],
    selectedKaratSpotlight: '24',
    selectedKaratCountries: '24',
    selectedUnitTable: 'gram',
    sortOrder: 'high-low',
    searchQuery: '',
    activeTab: 'gcc',
    prevGoldPriceUsdPerOz: null,
    dayOpenGoldPriceUsdPerOz: null,
    isOnline: navigator.onLine,
    volatility7d: null,
    cacheHealthScore: 0,
  };

  cache.loadState(stub);
  if (stub.goldPriceUsdPerOz) {
    state.goldPriceUsdPerOz = stub.goldPriceUsdPerOz;
    state.dayOpenUsdPerOz = stub.dayOpenGoldPriceUsdPerOz;
    state.rates = stub.rates || {};
  }

  bindBudgetInputs();
  applyLang();
  renderLiveCard();
  renderPlanner();
  await fetchLiveData();

  if (state.timer) clearInterval(state.timer);
  state.timer = setInterval(fetchLiveData, CONSTANTS.GOLD_REFRESH_MS);
}

document.addEventListener('DOMContentLoaded', init);

if ('serviceWorker' in navigator) {
  navigator.serviceWorker
    .register('/sw.js')
    .then(() => initSwUpdateToast())
    .catch(() => {});
}
