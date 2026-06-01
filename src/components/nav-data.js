// components/nav-data.js — single source of truth for public navigation IA.
// The shared nav, mobile drawer, footer sitemap, active states, and page shell
// accents all derive from this file.

function flattenGroups(locale) {
  // Keep authored dropdowns section-based for mega-menu rendering while
  // preserving the flat `items` array consumed by active-state logic and tests.
  // Compatibility shim: future callers should prefer `sections` for rendering.
  // Remove only after active-state, mobile-bottom, and legacy tests no longer
  // consume `group.items`.
  return {
    ...locale,
    groups: locale.groups.map((group) => ({
      ...group,
      items: group.sections.flatMap((section) => section.items),
    })),
  };
}

const RAW_NAV_DATA = {
  en: {
    home: {
      href: '/index.html',
      label: 'Home',
      description: 'Platform overview and price snapshot',
    },
    shops: {
      href: '/shops.html',
      label: 'Shops',
      description: 'Find gold shops and market areas',
      primary: true,
    },
    primaryLinks: [
      {
        key: 'live-prices',
        href: '/tracker.html',
        label: 'Live Prices',
        description: 'Open the live price workspace',
        primary: true,
      },
      {
        key: 'uae-prices',
        href: '/countries/uae/',
        label: 'UAE Prices',
        description: 'AED prices and Dubai context',
        primary: true,
      },
      {
        key: 'calculator',
        href: '/calculator.html',
        label: 'Calculator',
        description: 'Calculate value by weight and karat',
        primary: true,
      },
      {
        key: 'shops',
        href: '/shops.html',
        label: 'Shops',
        description: 'Browse shops and gold markets',
      },
    ],
    canonicalSurfaces: [
      '/index.html',
      '/tracker.html',
      '/calculator.html',
      '/countries/index.html',
      '/shops.html',
      '/learn.html',
      '/insights.html',
    ],
    groups: [
      {
        key: 'prices',
        label: 'Prices',
        eyebrow: 'Reference rates',
        description: 'Live tools, country pages, history, and comparisons.',
        layout: 'mega',
        featured: {
          href: '/tracker.html',
          label: 'Open live price workspace',
          description: 'Spot-linked XAU/USD references with source and freshness labels.',
          icon: 'LIVE',
        },
        cta: {
          href: '/methodology.html',
          label: 'How prices are calculated',
          description:
            'Transparent formula: XAU/USD spot, troy oz conversion, karat purity, AED fixed peg 3.6725',
        },
        sections: [
          {
            key: 'live-tools',
            label: 'Live price tools',
            description: 'Fast reference surfaces for daily checking.',
            items: [
              {
                href: '/tracker.html#mode=live',
                label: 'Live tracker',
                description: 'Main price workspace',
                icon: 'LIVE',
                primary: true,
              },
              {
                href: '/tracker.html#mode=compare',
                label: 'Compare rates',
                description: 'Cross-market reference board',
                icon: 'CMP',
              },
              {
                href: '/content/gold-price-history/',
                label: 'Price history',
                description: 'Historical context and trends',
                icon: 'HIST',
              },
            ],
          },
          {
            key: 'country-city',
            label: 'Country & city pages',
            description: 'Local market pages with currency context.',
            items: [
              {
                href: '/countries/index.html',
                label: 'All countries',
                description: 'Every market we cover',
                icon: 'GLB',
                primary: true,
              },
              {
                href: '/countries/uae/',
                label: 'UAE gold prices',
                description: 'AED prices and Dubai context',
                icon: 'AE',
                primary: true,
              },
              {
                href: '/countries/uae/cities/dubai.html',
                label: 'Dubai',
                description: 'Dubai rates and souks',
                icon: 'DXB',
              },
              {
                href: '/countries/egypt/cities/cairo.html',
                label: 'Cairo',
                description: 'Egypt market reference',
                icon: 'CAI',
              },
            ],
          },
          {
            key: 'comparison',
            label: 'Compare markets',
            description: 'Understand differences between references.',
            items: [
              {
                href: '/compare.html',
                label: 'Compare countries',
                description: 'Sortable cross-country price tool',
                icon: 'CMP',
              },
              {
                href: '/tracker.html#mode=compare&r=30D',
                label: 'Tracker compare mode',
                description: 'Side-by-side market comparison',
                icon: 'CMP',
              },
              {
                href: '/content/gcc-gold-price-comparison/',
                label: 'GCC comparison',
                description: 'Gulf market overview',
                icon: 'GCC',
              },
              {
                href: '/content/spot-vs-retail-gold-price/',
                label: 'Spot vs retail',
                description: 'Why shop quotes differ',
                icon: 'SPOT',
              },
              {
                href: '/learn.html#karats',
                label: 'Karat guide',
                description: 'Purity, pricing, and usage',
                icon: '22K',
              },
              {
                href: '/learn.html#pricing',
                label: 'Pricing basics',
                description: 'How spot-linked references work',
                icon: '24K',
              },
            ],
          },
        ],
      },
      {
        key: 'tools',
        label: 'Tools',
        eyebrow: 'Calculate & monitor',
        description: 'Calculators, alerts, converters, and methodology.',
        layout: 'mega',
        featured: {
          href: '/calculator.html',
          label: 'Use the gold calculator',
          description: 'Estimate value by weight, karat, currency, and payout assumptions.',
          icon: 'CALC',
        },
        cta: {
          href: '/learn.html',
          label: 'Learn before you calculate',
          description: 'Karats, purity, spot references, and buyer basics.',
        },
        sections: [
          {
            key: 'calculators',
            label: 'Calculators',
            description: 'Estimate value without changing formulas.',
            items: [
              {
                href: '/calculator.html',
                label: 'Gold calculator',
                description: 'Weight, karat, AED and USD',
                icon: 'CALC',
                primary: true,
              },
              {
                href: '/content/tools/zakat-calculator.html',
                label: 'Zakat calculator',
                description: 'Estimate Zakat on gold',
                icon: 'ZKT',
              },
              {
                href: '/content/tools/investment-return.html',
                label: 'Return model',
                description: 'Model gold performance',
                icon: 'ROI',
              },
              {
                href: '/content/tools/investment-calculator.html',
                label: 'Investment calculator',
                description: 'Compound gold return projections',
                icon: 'INV',
              },
              {
                href: '/content/tools/scrap-calculator.html',
                label: 'Scrap calculator',
                description: 'Estimate sell-back value',
                icon: 'SCP',
              },
            ],
          },
          {
            key: 'monitor',
            label: 'Monitor & export',
            description: 'Watch prices and move data out.',
            items: [
              {
                href: '/tracker.html#mode=live&panel=alerts',
                label: 'Price alerts',
                description: 'Local browser alerts',
                icon: 'ALRT',
                primary: true,
              },
              {
                href: '/tracker.html#mode=exports',
                label: 'Exports',
                description: 'CSV and JSON downloads',
                icon: 'CSV',
              },
              {
                href: '/content/embed/gold-ticker.html',
                label: 'Embed widgets',
                description: 'Ticker for your website',
                icon: 'EMBD',
              },
            ],
          },
          {
            key: 'reference',
            label: 'Reference tools',
            description: 'Method and units for clearer decisions.',
            items: [
              {
                href: '/content/tools/weight-converter.html',
                label: 'Weight converter',
                description: 'Grams, tola, ounces',
                icon: 'WGT',
              },
              {
                href: '/methodology.html',
                label: 'Methodology',
                description: 'Sources, formulas and limits',
                icon: 'MTH',
                primary: true,
              },
              {
                href: '/content/search/',
                label: 'Site search',
                description: 'Find countries and guides',
                icon: 'SRCH',
              },
            ],
          },
        ],
      },
      {
        key: 'buy-gold',
        label: 'Buy Gold',
        eyebrow: 'Directory & guides',
        description: 'Shop directory, UAE markets, buyer guides, and premiums.',
        layout: 'mega',
        featured: {
          href: '/shops.html',
          label: 'Browse shop directory',
          description: 'Reference listings and known market areas. Not endorsements.',
          icon: 'SHOP',
        },
        cta: {
          href: '/content/submit-shop/',
          label: 'Submit a shop listing',
          description: 'Help improve the public directory with real business details.',
        },
        sections: [
          {
            key: 'directory',
            label: 'Directory',
            description: 'Find listings and market areas.',
            items: [
              {
                href: '/shops.html',
                label: 'Shop directory',
                description: 'Browse markets and listings',
                icon: 'SHOP',
                primary: true,
              },
              {
                href: '/countries/uae/markets/dubai-gold-souk.html',
                label: 'Dubai Gold Souk',
                description: 'Deira market guide',
                icon: 'SOUK',
                primary: true,
              },
              {
                href: '/countries/egypt/markets/khan-el-khalili-cairo.html',
                label: 'Khan el-Khalili',
                description: 'Cairo market guide',
                icon: 'KHAN',
              },
            ],
          },
          {
            key: 'buyer-guides',
            label: 'Buyer guides',
            description: 'Practical context before visiting shops.',
            items: [
              {
                href: '/content/guides/buying-guide.html',
                label: 'Buying guide',
                description: 'Questions to ask before buying',
                icon: 'BUY',
                primary: true,
              },
              {
                href: '/content/uae-gold-buying-guide/',
                label: 'UAE buying guide',
                description: 'Dubai and UAE buyer context',
                icon: 'UAE',
              },
              {
                href: '/content/dubai-gold-rate-guide/',
                label: 'Dubai rate guide',
                description: 'How to read Dubai prices',
                icon: 'DXB',
              },
            ],
          },
          {
            key: 'premiums',
            label: 'Premiums & charges',
            description: 'Separate spot references from retail quotes.',
            items: [
              {
                href: '/content/guides/gold-karat-comparison.html',
                label: 'Karat premium context',
                description: 'Purity context behind retail gaps',
                icon: 'PRM',
              },
              {
                href: '/content/gold-making-charges-guide/',
                label: 'Making charges',
                description: 'Jewellery fees explained',
                icon: 'FEE',
              },
              {
                href: '/content/order-gold/',
                label: 'Order gold safely',
                description: 'Checklist-style buying resource',
                icon: 'ORD',
              },
            ],
          },
        ],
      },
      {
        key: 'markets',
        label: 'Markets',
        eyebrow: 'Regions & insights',
        description: 'UAE, GCC, Arab markets, global references, and analysis.',
        layout: 'mega',
        featured: {
          href: '/countries/uae/',
          label: 'Start with UAE markets',
          description: 'AED references, Dubai context, and market pages.',
          icon: 'AE',
        },
        cta: {
          href: '/insights.html',
          label: 'Read market insights',
          description: 'Context for spot moves, retail gaps, and regional pricing.',
        },
        sections: [
          {
            key: 'gcc',
            label: 'UAE & GCC',
            description: 'Gulf country references.',
            items: [
              {
                href: '/countries/saudi-arabia/',
                label: 'Saudi Arabia',
                description: 'SAR reference prices',
                icon: 'SA',
              },
              {
                href: '/countries/kuwait/',
                label: 'Kuwait',
                description: 'KWD reference prices',
                icon: 'KW',
              },
              {
                href: '/countries/qatar/',
                label: 'Qatar',
                description: 'QAR reference prices',
                icon: 'QA',
              },
              {
                href: '/countries/bahrain/',
                label: 'Bahrain',
                description: 'BHD reference prices',
                icon: 'BH',
              },
              {
                href: '/countries/oman/',
                label: 'Oman',
                description: 'OMR reference prices',
                icon: 'OM',
              },
            ],
          },
          {
            key: 'arab-markets',
            label: 'Arab markets',
            description: 'Regional pages across MENA.',
            items: [
              {
                href: '/countries/egypt/',
                label: 'Egypt',
                description: 'EGP reference prices',
                icon: 'EG',
              },
              {
                href: '/countries/jordan/',
                label: 'Jordan',
                description: 'JOD reference prices',
                icon: 'JO',
              },
              {
                href: '/countries/morocco/',
                label: 'Morocco',
                description: 'MAD reference prices',
                icon: 'MA',
              },
              {
                href: '/countries/turkey/',
                label: 'Turkey',
                description: 'TRY reference prices',
                icon: 'TR',
              },
            ],
          },
          {
            key: 'global-context',
            label: 'Global context',
            description: 'Reference markets and editorial context.',
            items: [
              {
                href: '/insights.html',
                label: 'Insights',
                description: 'Market context and analysis',
                icon: 'VIEW',
                primary: true,
              },
              {
                href: '/invest.html',
                label: 'Investing guide',
                description: 'Long-term gold context',
                icon: 'INV',
              },
              {
                href: '/insights.html#weekly-brief',
                label: 'Weekly brief',
                description: 'Curated market context',
                icon: 'NEWS',
              },
            ],
          },
        ],
      },
    ],
    langToggle: 'العربية',
    openMenu: 'Open menu',
    closeMenu: 'Close menu',
    mainNav: 'Main navigation',
    brandLabel: 'Gold Ticker Live Home',
    recentSearches: 'Recent searches',
    ctaLabel: 'Live Tracker',
    drawerCtaLabel: 'Live Tracker →',
    drawerSearchPlaceholder: 'Search countries, prices…',
    themeLabels: {
      auto: 'Theme: auto (click to switch to light)',
      light: 'Theme: light (click to switch to dark)',
      dark: 'Theme: dark (click to switch to auto)',
    },
  },

  ar: {
    home: { href: '/index.html', label: 'الرئيسية', description: 'نظرة عامة على المنصة والأسعار' },
    shops: {
      href: '/shops.html',
      label: 'المحلات',
      description: 'ابحث عن محلات ومناطق أسواق الذهب',
      primary: true,
    },
    primaryLinks: [
      {
        key: 'live-prices',
        href: '/tracker.html',
        label: 'الأسعار المباشرة',
        description: 'افتح مساحة الأسعار المباشرة',
        primary: true,
      },
      {
        key: 'uae-prices',
        href: '/countries/uae/',
        label: 'أسعار الإمارات',
        description: 'أسعار الدرهم وسياق دبي',
        primary: true,
      },
      {
        key: 'calculator',
        href: '/calculator.html',
        label: 'الحاسبة',
        description: 'احسب القيمة حسب الوزن والعيار',
        primary: true,
      },
      {
        key: 'shops',
        href: '/shops.html',
        label: 'المحلات',
        description: 'تصفح المحلات وأسواق الذهب',
      },
    ],
    canonicalSurfaces: [
      '/index.html',
      '/tracker.html',
      '/calculator.html',
      '/countries/index.html',
      '/shops.html',
      '/learn.html',
      '/insights.html',
    ],
    groups: [
      {
        key: 'prices',
        label: 'الأسعار',
        eyebrow: 'أسعار مرجعية',
        description: 'أدوات مباشرة وصفحات دول وسجل ومقارنات.',
        layout: 'mega',
        featured: {
          href: '/tracker.html',
          label: 'افتح مساحة الأسعار المباشرة',
          description: 'أسعار مرجعية مبنية على XAU/USD مع المصدر وحالة التحديث.',
          icon: 'LIVE',
        },
        cta: {
          href: '/methodology.html',
          label: 'كيف نحسب الأسعار',
          description: 'السعر الفوري والعيار والصرف وربط الدرهم والتخزين المؤقت والحدود.',
        },
        sections: [
          {
            key: 'live-tools',
            label: 'أدوات السعر المباشر',
            description: 'واجهات سريعة للمتابعة اليومية.',
            items: [
              {
                href: '/tracker.html#mode=live',
                label: 'متتبع الأسعار',
                description: 'مساحة الأسعار الرئيسية',
                icon: 'LIVE',
                primary: true,
              },
              {
                href: '/tracker.html#mode=compare',
                label: 'مقارنة الأسعار',
                description: 'لوحة مرجعية عبر الأسواق',
                icon: 'RATE',
              },
              {
                href: '/content/gold-price-history/',
                label: 'سجل الأسعار',
                description: 'سياق تاريخي واتجاهات',
                icon: 'HIST',
              },
            ],
          },
          {
            key: 'country-city',
            label: 'صفحات الدول والمدن',
            description: 'صفحات محلية مع سياق العملة.',
            items: [
              {
                href: '/countries/index.html',
                label: 'كل الدول',
                description: 'كل الأسواق التي نغطيها',
                icon: 'GLB',
                primary: true,
              },
              {
                href: '/countries/uae/',
                label: 'أسعار الإمارات',
                description: 'أسعار الدرهم وسياق دبي',
                icon: 'AE',
                primary: true,
              },
              {
                href: '/countries/uae/cities/dubai.html',
                label: 'دبي',
                description: 'أسعار دبي والأسواق',
                icon: 'DXB',
              },
              {
                href: '/countries/egypt/cities/cairo.html',
                label: 'القاهرة',
                description: 'مرجع السوق المصري',
                icon: 'CAI',
              },
            ],
          },
          {
            key: 'comparison',
            label: 'مقارنة الأسواق',
            description: 'افهم الفروق بين المراجع.',
            items: [
              {
                href: '/compare.html',
                label: 'قارن الدول',
                description: 'أداة مقارنة الأسعار بين الدول',
                icon: 'CMP',
              },
              {
                href: '/tracker.html#mode=compare&r=30D',
                label: 'وضع المقارنة في المتتبع',
                description: 'مقارنة الأسواق جنباً إلى جنب',
                icon: 'CMP',
              },
              {
                href: '/content/gcc-gold-price-comparison/',
                label: 'مقارنة الخليج',
                description: 'نظرة على أسواق الخليج',
                icon: 'GCC',
              },
              {
                href: '/content/spot-vs-retail-gold-price/',
                label: 'الفوري مقابل التجزئة',
                description: 'لماذا تختلف أسعار المحلات',
                icon: 'SPOT',
              },
              {
                href: '/learn.html#karats',
                label: 'دليل العيارات',
                description: 'النقاء والتسعير والاستخدامات',
                icon: '22K',
              },
              {
                href: '/learn.html#pricing',
                label: 'أساسيات التسعير',
                description: 'كيف تعمل المراجع المرتبطة بالسعر الفوري',
                icon: '24K',
              },
            ],
          },
        ],
      },
      {
        key: 'tools',
        label: 'الأدوات',
        eyebrow: 'احسب وتابع',
        description: 'حاسبات وتنبيهات ومحولات ومنهجية.',
        layout: 'mega',
        featured: {
          href: '/calculator.html',
          label: 'استخدم حاسبة الذهب',
          description: 'قدّر القيمة حسب الوزن والعيار والعملة وافتراضات الدفع.',
          icon: 'CALC',
        },
        cta: {
          href: '/learn.html',
          label: 'تعلّم قبل الحساب',
          description: 'العيارات والنقاء والسعر الفوري وأساسيات الشراء.',
        },
        sections: [
          {
            key: 'calculators',
            label: 'الحاسبات',
            description: 'قدّر القيمة من دون تغيير المعادلات.',
            items: [
              {
                href: '/calculator.html',
                label: 'حاسبة الذهب',
                description: 'الوزن والعيار والدرهم والدولار',
                icon: 'CALC',
                primary: true,
              },
              {
                href: '/content/tools/zakat-calculator.html',
                label: 'حاسبة الزكاة',
                description: 'تقدير زكاة الذهب',
                icon: 'ZKT',
              },
              {
                href: '/content/tools/investment-return.html',
                label: 'نموذج العائد',
                description: 'نمذجة أداء الذهب',
                icon: 'ROI',
              },
              {
                href: '/content/tools/ar/investment-calculator.html',
                label: 'حاسبة الاستثمار',
                description: 'توقعات عائد الذهب المركب',
                icon: 'INV',
              },
              {
                href: '/content/tools/ar/scrap-calculator.html',
                label: 'حاسبة الخردة',
                description: 'تقدير قيمة إعادة البيع',
                icon: 'SCP',
              },
            ],
          },
          {
            key: 'monitor',
            label: 'المتابعة والتصدير',
            description: 'راقب الأسعار وانقل البيانات.',
            items: [
              {
                href: '/tracker.html#mode=live&panel=alerts',
                label: 'تنبيهات السعر',
                description: 'تنبيهات محلية في المتصفح',
                icon: 'ALRT',
                primary: true,
              },
              {
                href: '/tracker.html#mode=exports',
                label: 'التصدير',
                description: 'تنزيل CSV وJSON',
                icon: 'CSV',
              },
              {
                href: '/content/embed/gold-ticker.html',
                label: 'أدوات التضمين',
                description: 'شريط أسعار لموقعك',
                icon: 'EMBD',
              },
            ],
          },
          {
            key: 'reference',
            label: 'أدوات مرجعية',
            description: 'المنهجية والوحدات لقرارات أوضح.',
            items: [
              {
                href: '/content/tools/weight-converter.html',
                label: 'محول الأوزان',
                description: 'جرام وتولة وأونصة',
                icon: 'WGT',
              },
              {
                href: '/methodology.html',
                label: 'المنهجية',
                description: 'المصادر والمعادلات والحدود',
                icon: 'MTH',
                primary: true,
              },
              {
                href: '/content/search/',
                label: 'بحث الموقع',
                description: 'ابحث عن الدول والأدلة',
                icon: 'SRCH',
              },
            ],
          },
        ],
      },
      {
        key: 'buy-gold',
        label: 'شراء الذهب',
        eyebrow: 'دليل ومحلات',
        description: 'دليل المحلات وأسواق الإمارات وأدلة الشراء والعلاوات.',
        layout: 'mega',
        featured: {
          href: '/shops.html',
          label: 'تصفح دليل المحلات',
          description: 'قوائم مرجعية ومناطق أسواق معروفة، وليست توصيات.',
          icon: 'SHOP',
        },
        cta: {
          href: '/content/submit-shop/',
          label: 'أضف بيانات محل',
          description: 'ساعد في تحسين الدليل العام بتفاصيل أعمال حقيقية.',
        },
        sections: [
          {
            key: 'directory',
            label: 'الدليل',
            description: 'ابحث عن قوائم ومناطق أسواق.',
            items: [
              {
                href: '/shops.html',
                label: 'دليل المحلات',
                description: 'تصفح الأسواق والقوائم',
                icon: 'SHOP',
                primary: true,
              },
              {
                href: '/countries/uae/markets/dubai-gold-souk.html',
                label: 'سوق الذهب بدبي',
                description: 'دليل سوق ديرة',
                icon: 'SOUK',
                primary: true,
              },
              {
                href: '/countries/egypt/markets/khan-el-khalili-cairo.html',
                label: 'خان الخليلي',
                description: 'دليل سوق القاهرة',
                icon: 'KHAN',
              },
            ],
          },
          {
            key: 'buyer-guides',
            label: 'أدلة الشراء',
            description: 'سياق عملي قبل زيارة المحلات.',
            items: [
              {
                href: '/content/guides/buying-guide.html',
                label: 'دليل الشراء',
                description: 'أسئلة مهمة قبل الشراء',
                icon: 'BUY',
                primary: true,
              },
              {
                href: '/content/uae-gold-buying-guide/',
                label: 'دليل شراء الإمارات',
                description: 'سياق دبي والإمارات للمشتري',
                icon: 'UAE',
              },
              {
                href: '/content/dubai-gold-rate-guide/',
                label: 'دليل أسعار دبي',
                description: 'كيف تقرأ أسعار دبي',
                icon: 'DXB',
              },
            ],
          },
          {
            key: 'premiums',
            label: 'العلاوات والمصنعية',
            description: 'افصل السعر المرجعي عن عرض المحل.',
            items: [
              {
                href: '/content/guides/gold-karat-comparison.html',
                label: 'سياق علاوة العيارات',
                description: 'سياق النقاء وراء فروق التجزئة',
                icon: 'PRM',
              },
              {
                href: '/content/gold-making-charges-guide/',
                label: 'المصنعية',
                description: 'شرح رسوم المجوهرات',
                icon: 'FEE',
              },
              {
                href: '/content/order-gold/',
                label: 'طلب الذهب بأمان',
                description: 'مورد شراء بنمط قائمة تحقق',
                icon: 'ORD',
              },
            ],
          },
        ],
      },
      {
        key: 'markets',
        label: 'الأسواق',
        eyebrow: 'مناطق وتحليلات',
        description: 'الإمارات والخليج والأسواق العربية والمراجع العالمية والتحليلات.',
        layout: 'mega',
        featured: {
          href: '/countries/uae/',
          label: 'ابدأ بأسواق الإمارات',
          description: 'مراجع الدرهم وسياق دبي وصفحات الأسواق.',
          icon: 'AE',
        },
        cta: {
          href: '/insights.html',
          label: 'اقرأ تحليلات السوق',
          description: 'سياق حركة السعر الفوري وفروق التجزئة والتسعير الإقليمي.',
        },
        sections: [
          {
            key: 'gcc',
            label: 'الإمارات والخليج',
            description: 'مراجع دول الخليج.',
            items: [
              {
                href: '/countries/saudi-arabia/',
                label: 'السعودية',
                description: 'أسعار مرجعية بالريال',
                icon: 'SA',
              },
              {
                href: '/countries/kuwait/',
                label: 'الكويت',
                description: 'أسعار مرجعية بالدينار',
                icon: 'KW',
              },
              {
                href: '/countries/qatar/',
                label: 'قطر',
                description: 'أسعار مرجعية بالريال',
                icon: 'QA',
              },
              {
                href: '/countries/bahrain/',
                label: 'البحرين',
                description: 'أسعار مرجعية بالدينار',
                icon: 'BH',
              },
              {
                href: '/countries/oman/',
                label: 'عُمان',
                description: 'أسعار مرجعية بالريال',
                icon: 'OM',
              },
            ],
          },
          {
            key: 'arab-markets',
            label: 'أسواق عربية',
            description: 'صفحات إقليمية عبر الشرق الأوسط وشمال أفريقيا.',
            items: [
              {
                href: '/countries/egypt/',
                label: 'مصر',
                description: 'أسعار مرجعية بالجنيه',
                icon: 'EG',
              },
              {
                href: '/countries/jordan/',
                label: 'الأردن',
                description: 'أسعار مرجعية بالدينار',
                icon: 'JO',
              },
              {
                href: '/countries/morocco/',
                label: 'المغرب',
                description: 'أسعار مرجعية بالدرهم',
                icon: 'MA',
              },
              {
                href: '/countries/turkey/',
                label: 'تركيا',
                description: 'أسعار مرجعية بالليرة',
                icon: 'TR',
              },
            ],
          },
          {
            key: 'global-context',
            label: 'سياق عالمي',
            description: 'أسواق مرجعية وسياق تحريري.',
            items: [
              {
                href: '/insights.html',
                label: 'التحليلات',
                description: 'سياق وتحليل السوق',
                icon: 'VIEW',
                primary: true,
              },
              {
                href: '/invest.html',
                label: 'دليل الاستثمار',
                description: 'سياق طويل الأجل للذهب',
                icon: 'INV',
              },
              {
                href: '/insights.html#weekly-brief',
                label: 'الملخص الأسبوعي',
                description: 'سياق سوق منتقى',
                icon: 'NEWS',
              },
            ],
          },
        ],
      },
    ],
    langToggle: 'English',
    openMenu: 'فتح القائمة',
    closeMenu: 'إغلاق القائمة',
    mainNav: 'التنقل الرئيسي',
    brandLabel: 'Gold Ticker Live الرئيسية',
    recentSearches: 'عمليات البحث الأخيرة',
    ctaLabel: 'التتبع المباشر',
    drawerCtaLabel: '← التتبع المباشر',
    drawerSearchPlaceholder: 'ابحث عن دول وأسعار…',
    themeLabels: {
      auto: 'المظهر: تلقائي (اضغط للتبديل إلى الفاتح)',
      light: 'المظهر: فاتح (اضغط للتبديل إلى الداكن)',
      dark: 'المظهر: داكن (اضغط للتبديل إلى التلقائي)',
    },
  },
};

export const NAV_DATA = {
  en: flattenGroups(RAW_NAV_DATA.en),
  ar: flattenGroups(RAW_NAV_DATA.ar),
};

export const PAGE_SHELLS = [
  {
    page: 'home',
    section: 'home',
    shell: 'landing',
    accent: 'gold',
    patterns: ['/', '/index.html'],
  },
  {
    page: 'tracker',
    section: 'prices',
    shell: 'workspace',
    accent: 'live',
    patterns: ['/tracker.html'],
  },
  {
    page: 'calculator',
    section: 'tools',
    shell: 'tool',
    accent: 'calculator',
    patterns: ['/calculator.html'],
  },
  {
    page: 'shops',
    section: 'buy-gold',
    shell: 'directory',
    accent: 'market',
    patterns: ['/shops.html', '/content/submit-shop/', '/content/order-gold/'],
  },
  {
    page: 'learn',
    section: 'tools',
    shell: 'editorial',
    accent: 'guide',
    patterns: ['/learn.html', '/methodology.html', '/content/tools/', '/content/guides/'],
  },
  {
    page: 'insights',
    section: 'markets',
    shell: 'editorial',
    accent: 'insight',
    patterns: ['/insights.html', '/invest.html'],
  },
  {
    page: 'country',
    section: 'markets',
    shell: 'market',
    accent: 'local',
    patterns: ['/countries/'],
  },
  {
    page: 'content',
    section: 'tools',
    shell: 'editorial',
    accent: 'guide',
    patterns: ['/content/'],
  },
  { page: 'admin', section: 'admin', shell: 'dashboard', accent: 'ops', patterns: ['/admin/'] },
];
