import { COUNTRIES } from '../config/countries.js';
import { SHOPS as FALLBACK_SHOPS } from '../../data/shops.js';
import { fetchShops as fetchSupabaseShops } from '../lib/supabase-data.js';
import { updateTicker } from '../components/ticker.js';
import { mountSharedShell } from '../components/site-shell.js';
import { injectBreadcrumbs } from '../components/breadcrumbs.js';
import * as cache from '../lib/cache.js';
import { renderAdSlot } from '../components/adSlot.js';
import { CONSTANTS } from '../config/index.js';
import { KARATS } from '../config/index.js';
import { escape as esc, safeHref as safeUrl, safeTel } from '../lib/safe-dom.js';
import { track, EVENTS } from '../lib/analytics.js';
import { copyWithToast } from '../lib/copy-toast.js';
import { initPageEnter } from '../lib/page-enter.js';
import { observeReveal } from '../lib/reveal.js';
import {
  createSavedShop,
  isAuthenticated as isAccountAuthenticated,
  redirectToAccount,
} from '../lib/public-account-client.js';
import { initShopsMap, updateMapMarkers, invalidateMapSize } from '../components/shops-map.js';
import {
  initCompare,
  setCompareLang,
  setCompareShops,
  isInCompareList,
  toggleCompare,
  renderCompareBar,
} from '../components/shops-compare.js';

/**
 * Mutable shops array — starts with hardcoded fallback data,
 * replaced by Supabase data once it loads.
 */
let SHOPS = [...FALLBACK_SHOPS];
const DEFAULT_LISTING_TAB = 'verified_shop';

const STATE = {
  lang: 'en',
  listingTab: DEFAULT_LISTING_TAB,
  search: '',
  region: 'all',
  country: 'all',
  city: 'all',
  specialty: 'all',
  verifiedOnly: false,
  groupByCity: false,
  sortBy: 'relevance',
  shortlist: [], // IDs of saved shops for quick comparison
  viewMode: 'list', // 'list' or 'map'
  mapInitialized: false,
};

const SHOPS_LAST_REVIEWED_ISO = '2026-04-05';
const MOBILE_FILTER_BREAKPOINT = 640;
const FILTER_TRACK_DEBOUNCE_MS = 180;
const SEARCH_TRACK_DEBOUNCE_MS = 450;
let _filterTrackTimer = null;

function sanitizeSearchQueryForMessage(value = '') {
  return String(value)
    .replace(/[&<>"']/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}

function formatPhoneForWhatsApp(phone) {
  const digits = String(phone || '').replace(/[^\d]/g, '');
  if (!digits) return '';
  return encodeURIComponent(digits);
}

// Load shortlist from localStorage on module init
(function loadShortlist() {
  try {
    const stored = localStorage.getItem('shops_shortlist');
    if (stored) STATE.shortlist = JSON.parse(stored);
  } catch {}
})();

const REGIONS = {
  gcc: { en: 'GCC', ar: 'الخليج' },
  levant: { en: 'Levant', ar: 'بلاد الشام' },
  africa: { en: 'Africa', ar: 'أفريقيا' },
  global: { en: 'Global', ar: 'عالمي' },
};

const TXT = {
  en: {
    kicker: 'Shops by region',
    title: 'Explore Gold Shops & Known Gold Markets',
    lead: 'Browse directory listings across countries covered on Gold Ticker Live. Use filters to narrow by region, country, city, and specialty. Shop information is for reference, and business details are shown where available.',
    trustLabel: 'Directory reference listings',
    trustDate: 'Last content review {date}',
    directoryReviewed: 'Directory last reviewed {date}',
    featuredNote:
      'Featured: editorially selected markets for this region. Not a paid placement and not an endorsement of any individual shop inside the market.',
    statListings: 'Shops &amp; markets',
    statCountries: 'Countries',
    statRegions: 'Regions',
    popularMarkets: 'Popular markets',
    searchLabel: 'Search by shop, city, country, market, or specialty',
    searchPlaceholder: 'e.g. Dubai Gold Souk, Riyadh, bullion',
    region: 'Region',
    country: 'Country',
    city: 'City',
    specialtyFilter: 'Specialty',
    listed: 'Listings (shops + market areas)',
    allRegions: 'All regions',
    allCountries: 'All countries',
    allCities: 'All cities',
    allSpecialties: 'All specialties',
    verifiedOnly: 'Verified details only',
    verifiedHelp: 'Show listings with phone or website details only',
    count: (n) => `${n} listing${n === 1 ? '' : 's'}`,
    activeFilters: (value) => `Filters: ${value}`,
    noFilters: 'Showing all listings',
    verifiedFilterLabel: 'verified details only',
    emptyTitle: 'No listings match your filters',
    emptyText: 'Try clearing one filter or searching with a broader term.',
    emptyTextQuery: (query) =>
      `No listings match “${query}”. Try clearing one filter or searching with a broader term.`,
    emptySubmitCta: 'Suggest a shop for review',
    clearFilters: 'Clear filters',
    clearAllFilters: 'Clear all filters',
    clearAllFiltersShort: 'Clear all',
    removeFilter: (value) => `Remove ${value} filter`,
    removeSearchFilter: (value) => `Remove "${value}" search filter`,
    notAvailable: 'Not available',
    location: 'Location',
    market: 'Market',
    category: 'Category',
    specialties: 'Specialties',
    status: 'Status',
    phone: 'Phone',
    contactName: 'Name',
    website: 'Website',
    verifiedStatus: 'Verified details',
    listedStatus: 'Listed profile',
    unverifiedStatus: 'Unverified listing',
    marketAreaStatus: 'Market area',
    detailsSignal: 'Business details',
    detailsPartial: 'Partially available',
    detailsLimited: 'Limited',
    detailsFull: 'Available',
    noContact: 'Contact details not yet listed',
    visitWebsite: 'Visit website',
    featured: 'Featured market',
    marketCluster: 'Market area cluster',
    marketAreaListing: 'Market-area listing',
    storeProfile: 'Store profile',
    saveToShortlist: 'Save to shortlist',
    removeFromShortlist: 'Remove from shortlist',
    saveToAccount: 'Save to account',
    savedToAccount: 'Saved to account',
    saveToAccountAuthPrompt: 'Sign in to save this shop to your account?',
    saved: 'Saved',
    shortlistCount: (n) => `${n} saved`,
    shortlistLabel: 'Quick comparison list',
    shortlistClear: 'Clear all',
    shortlistReview: 'Review saved',
    shareShop: 'Share',
    linkCopied: 'Link copied to clipboard',
    copyDetails: 'Copy details',
    detailsCopied: 'Shop details copied',
    sortLabel: 'Sort',
    sortRelevance: 'Best match',
    sortAlpha: 'A–Z',
    sortCity: 'By city',
    sortSpecialty: 'Most specialties',
    groupByCity: 'Group by city',
    viewGoldRate: 'City gold rates',
    directions: 'Directions',
    callShop: 'Call',
    closeDetails: 'Close details',
    viewCountryPage: 'View country page',
    infoTitle: 'How to use this directory',
    info1Title: 'Compare by market area',
    info1Body:
      'Start with a country or city filter, then compare listed markets and specialties side by side.',
    info2Title: 'Check available details',
    info2Body:
      'Cards indicate whether business details are limited or partially available so you know what to expect.',
    info3Title: 'Use as a shortlist',
    info3Body:
      'This page is for reference and discovery. Always confirm current prices, charges, and product details directly with shops.',
    resultsLegend:
      'Legend: Store profile = direct business listing; Market-area listing = cluster/area reference. Details confidence reflects currently available contact details.',
    resultsDisclaimer:
      'Listings may represent market areas or dealer clusters unless direct contact details are shown.',
    listingConfidenceTitle: 'Listing type + details confidence',
    detailsConfidence: 'Details confidence',
    contactQuality: 'Contact quality',
    rankFull: 'High',
    rankPartial: 'Medium',
    rankLimited: 'Basic',
    nextActionsStore: 'Best next steps',
    nextActionsMarket: 'Area discovery',
    areaGuide: 'Area guide',
    nextStepTitle: 'Before you buy',
    nextStepBody: 'Confirm final retail price, making charges, and taxes directly with the seller.',
    quickActionsCalc: 'Calculate Value',
    quickActionsRates: 'Live Rates',
    quickActionsUAE: 'UAE Market',
    nearmeTitle: '📍 Find Gold Souqs Near You',
    nearmeLead:
      'Allow location access to discover which listed gold markets and souqs are closest to your current position. No account required.',
    nearmeButton: 'Find shops near me',
    resourcesTitle: 'Buying Guides & Resources',
    freshnessSemantics:
      'Directory listings were last reviewed editorially. Reference prices are spot-linked estimates and are refreshed periodically — they are not live retail quotes.',
    priceDisclaimer:
      'Listings are for discovery only and have not been independently verified — details may be outdated. Reference prices shown are spot-based estimates, not actual shop prices; retail quotes include making charges, dealer margins, and taxes. Always confirm prices, hours, and availability directly with the shop before visiting or purchasing.',
    spotVsRetailLinkText: 'Why shop prices differ from spot →',
    methodologyLinkText: 'How we calculate prices →',
    tabVerified: 'Verified Shops',
    tabMarkets: 'Gold Markets',
    tabSponsored: 'Sponsored',
    sponsoredDisclosure:
      'Sponsored placements are clearly labeled and do not change reference-price methodology. Listings may appear because of paid placement.',
    badgeVerified: 'Verified',
    badgeMarketArea: 'Market Area',
    badgeContactLimited: 'Contact Limited',
    badgeSponsored: 'Sponsored',
    claimListing: 'Claim listing',
    claimListingPrompt:
      'Submit your name and email to claim this listing. Our moderation team reviews all claims before any update is published.',
    claimEmailPrompt: 'Email',
    claimListingThanks:
      'Claim submitted. We will review and contact you if verification is needed.',
    whatsApp: 'WhatsApp',
    loadingListings: 'Loading listings…',
    loadingListingsBody: 'Fetching verified shops, markets, and sponsored placements.',
    loadErrorTitle: 'Could not refresh live listings',
    loadErrorBody: 'Showing local fallback data for now. Please try again shortly.',
    genericError: 'Something went wrong. Please try again.',
    viewList: 'List',
    viewMap: 'Map',
    mapHint: '← Pinch & drag to explore →',
    compareAdd: 'Compare',
    compareRemove: 'Remove',
    compareMaxReached: 'Maximum 3 shops for comparison',
  },
  ar: {
    kicker: 'محلات حسب المنطقة',
    title: 'استكشف محلات الذهب والأسواق المعروفة',
    lead: 'تصفح إدراجات الدليل ضمن الدول التي يغطيها Gold Ticker Live. استخدم الفلاتر حسب المنطقة والدولة والمدينة والتخصص. معلومات المحلات مرجعية، وتظهر تفاصيل النشاط حيثما كانت متاحة.',
    trustLabel: 'إدراجات مرجعية للدليل',
    trustDate: 'آخر مراجعة للمحتوى {date}',
    directoryReviewed: 'آخر مراجعة للدليل {date}',
    featuredNote:
      'مختارة: أسواق مختارة تحريرياً لهذه المنطقة. ليست إعلاناً مدفوعاً ولا تزكية لأي محل بعينه داخل السوق.',
    statListings: 'محلات وأسواق',
    statCountries: 'الدول',
    statRegions: 'المناطق',
    popularMarkets: 'أسواق شائعة',
    searchLabel: 'ابحث باسم المحل أو المدينة أو الدولة أو السوق أو التخصص',
    searchPlaceholder: 'مثال: سوق الذهب دبي، الرياض، سبائك',
    region: 'المنطقة',
    country: 'الدولة',
    city: 'المدينة',
    specialtyFilter: 'التخصص',
    listed: 'الإدراجات (محلات + مناطق سوق)',
    allRegions: 'كل المناطق',
    allCountries: 'كل الدول',
    allCities: 'كل المدن',
    allSpecialties: 'كل التخصصات',
    verifiedOnly: 'تفاصيل موثقة فقط',
    verifiedHelp: 'اعرض الإدراجات التي تتضمن هاتفاً أو موقعاً فقط',
    count: (n) => `${n} نتيجة`,
    activeFilters: (value) => `الفلاتر: ${value}`,
    noFilters: 'عرض جميع الإدراجات',
    verifiedFilterLabel: 'تفاصيل موثقة فقط',
    emptyTitle: 'لا توجد إدراجات مطابقة',
    emptyText: 'جرّب إلغاء أحد الفلاتر أو استخدام كلمات أوسع في البحث.',
    emptyTextQuery: (query) =>
      `لا توجد إدراجات مطابقة لـ “${query}”. جرّب إلغاء أحد الفلاتر أو توسيع البحث.`,
    emptySubmitCta: 'اقترح محلاً للمراجعة',
    clearFilters: 'مسح الفلاتر',
    clearAllFilters: 'مسح كل الفلاتر',
    clearAllFiltersShort: 'مسح الكل',
    removeFilter: (value) => `إزالة فلتر ${value}`,
    removeSearchFilter: (value) => `إزالة فلتر البحث "${value}"`,
    notAvailable: 'غير متاح',
    location: 'الموقع',
    market: 'السوق',
    category: 'الفئة',
    specialties: 'التخصصات',
    status: 'الحالة',
    phone: 'الهاتف',
    contactName: 'الاسم',
    website: 'الموقع',
    verifiedStatus: 'تفاصيل موثقة',
    listedStatus: 'إدراج منشور',
    unverifiedStatus: 'إدراج غير موثق',
    marketAreaStatus: 'منطقة سوق',
    detailsSignal: 'تفاصيل النشاط',
    detailsPartial: 'متوفرة جزئياً',
    detailsLimited: 'محدودة',
    detailsFull: 'متوفرة',
    noContact: 'بيانات الاتصال غير مدرجة بعد',
    visitWebsite: 'زيارة الموقع',
    featured: 'سوق مميز',
    marketCluster: 'مجموعة متاجر بسوق',
    marketAreaListing: 'إدراج منطقة سوق',
    storeProfile: 'ملف متجر',
    saveToShortlist: 'حفظ في القائمة',
    removeFromShortlist: 'إزالة من القائمة',
    saveToAccount: 'حفظ في الحساب',
    savedToAccount: 'تم الحفظ في الحساب',
    saveToAccountAuthPrompt: 'هل تريد تسجيل الدخول لحفظ هذا المحل في حسابك؟',
    saved: 'محفوظ',
    shortlistCount: (n) => `${n} محفوظة`,
    shortlistLabel: 'قائمة مقارنة سريعة',
    shortlistClear: 'مسح الكل',
    shortlistReview: 'مراجعة المحفوظ',
    shareShop: 'مشاركة',
    linkCopied: 'تم نسخ الرابط',
    copyDetails: 'نسخ التفاصيل',
    detailsCopied: 'تم نسخ تفاصيل المحل',
    sortLabel: 'ترتيب',
    sortRelevance: 'الأنسب',
    sortAlpha: 'أ–ي',
    sortCity: 'حسب المدينة',
    sortSpecialty: 'أكثر تخصصات',
    groupByCity: 'تجميع حسب المدينة',
    viewGoldRate: 'أسعار المدينة',
    directions: 'الاتجاهات',
    callShop: 'اتصال',
    closeDetails: 'إغلاق التفاصيل',
    viewCountryPage: 'عرض صفحة الدولة',
    infoTitle: 'كيفية استخدام هذا الدليل',
    info1Title: 'قارن حسب منطقة السوق',
    info1Body: 'ابدأ بفلتر الدولة أو المدينة، ثم قارن الأسواق المدرجة والتخصصات بسهولة.',
    info2Title: 'راجع مستوى التفاصيل',
    info2Body: 'توضح البطاقات مستوى توفر تفاصيل النشاط حتى تعرف المعلومات المتاحة قبل التواصل.',
    info3Title: 'استخدمه كقائمة مختصرة',
    info3Body:
      'هذه الصفحة للاكتشاف والمرجعية. احرص على تأكيد الأسعار والرسوم والتفاصيل مباشرة مع المحلات.',
    resultsLegend:
      'الدليل: ملف متجر = إدراج مباشر؛ إدراج منطقة سوق = مرجع لمنطقة/تجمع. مستوى الثقة يعكس تفاصيل الاتصال المتاحة حالياً.',
    resultsDisclaimer:
      'قد تمثل بعض الإدراجات مناطق سوق أو تجمعات تجار ما لم تُعرض بيانات اتصال مباشرة.',
    listingConfidenceTitle: 'نوع الإدراج + مستوى الثقة بالتفاصيل',
    detailsConfidence: 'ثقة التفاصيل',
    rankFull: 'مرتفع',
    rankPartial: 'متوسط',
    rankLimited: 'أساسي',
    nextActionsStore: 'أفضل الخطوات التالية',
    nextActionsMarket: 'استكشاف المنطقة',
    areaGuide: 'دليل المنطقة',
    nextStepTitle: 'قبل الشراء',
    nextStepBody: 'أكد السعر النهائي للتجزئة ورسوم المصنعية والضرائب مباشرة مع البائع.',
    quickActionsCalc: 'احسب القيمة',
    quickActionsRates: 'الأسعار المباشرة',
    quickActionsUAE: 'سوق الإمارات',
    nearmeTitle: '📍 ابحث عن أسواق الذهب القريبة',
    nearmeLead:
      'اسمح بالوصول إلى الموقع لمعرفة أقرب أسواق ومحلات الذهب المدرجة إلى موقعك الحالي. لا تحتاج إلى حساب.',
    nearmeButton: 'ابحث عن محلات قريبة',
    resourcesTitle: 'أدلة الشراء والموارد',
    freshnessSemantics:
      'تمت مراجعة إدراجات الدليل تحريرياً. الأسعار المرجعية تقديرات مرتبطة بالسعر الفوري وتُحدَّث دورياً — وليست أسعار تجزئة مباشرة.',
    priceDisclaimer:
      'هذه الإدراجات للاكتشاف فقط ولم يتم التحقق منها بشكل مستقل — قد تكون التفاصيل قديمة. الأسعار المعروضة تقديرية مبنية على السعر الفوري وليست أسعار محلات فعلية؛ تشمل أسعار التجزئة المصنعية وهامش التاجر والضرائب. احرص دائماً على تأكيد الأسعار والأوقات والتوفر مباشرة مع المحل قبل الزيارة أو الشراء.',
    spotVsRetailLinkText: 'لماذا تختلف أسعار المحلات عن السعر الفوري ←',
    methodologyLinkText: 'كيف نحسب الأسعار →',
    tabVerified: 'محلات موثقة',
    tabMarkets: 'أسواق الذهب',
    tabSponsored: 'نتائج ممولة',
    sponsoredDisclosure:
      'النتائج الممولة موضحة بوضوح ولا تغيّر منهجية الأسعار المرجعية. قد يظهر بعض الإدراج بسبب ترتيب إعلاني مدفوع.',
    badgeVerified: 'موثق',
    badgeMarketArea: 'منطقة سوق',
    badgeContactLimited: 'تواصل محدود',
    badgeSponsored: 'ممول',
    claimListing: 'طلب ملكية الإدراج',
    claimListingPrompt:
      'أرسل اسمك وبريدك الإلكتروني لطلب ملكية هذا الإدراج. تتم مراجعة كل الطلبات قبل أي تحديث.',
    claimEmailPrompt: 'البريد الإلكتروني',
    claimListingThanks: 'تم إرسال طلب الملكية وسنتواصل معك عند الحاجة للتحقق.',
    whatsApp: 'واتساب',
    loadingListings: 'جارٍ تحميل الإدراجات…',
    loadingListingsBody: 'يتم جلب المحلات الموثقة والأسواق والنتائج الممولة.',
    loadErrorTitle: 'تعذّر تحديث الإدراجات المباشرة',
    loadErrorBody: 'يتم عرض بيانات احتياطية حالياً. يرجى المحاولة لاحقاً.',
    genericError: 'حدث خطأ ما. يرجى المحاولة مرة أخرى.',
    viewList: 'قائمة',
    viewMap: 'خريطة',
    mapHint: '← اسحب وقرّب لاستكشاف →',
    compareAdd: 'مقارنة',
    compareRemove: 'إزالة',
    compareMaxReached: 'أقصى حد 3 محلات للمقارنة',
  },
};

function t(key) {
  return TXT[STATE.lang]?.[key] ?? TXT.en[key] ?? key;
}

function trackShopFilterApply(reason = 'filter_change', debounceMs = FILTER_TRACK_DEBOUNCE_MS) {
  clearTimeout(_filterTrackTimer);
  _filterTrackTimer = setTimeout(() => {
    track(EVENTS.SHOP_FILTER_APPLY, {
      reason,
      listing_tab: STATE.listingTab,
      region: STATE.region,
      country: STATE.country,
      city: STATE.city,
      specialty: STATE.specialty,
      verified_only: STATE.verifiedOnly ? 1 : 0,
      has_search: STATE.search.trim() ? 1 : 0,
    });
  }, debounceMs);
}

function countryByCode(code) {
  return COUNTRIES.find((country) => country.code === code);
}

function countryName(country) {
  return STATE.lang === 'ar' ? country.nameAr : country.nameEn;
}

function regionName(group) {
  return REGIONS[group]?.[STATE.lang] || group;
}

function detailsAvailabilityLabel(value) {
  if (value === 'full') return t('detailsFull');
  if (value === 'partial') return t('detailsPartial');
  return t('detailsLimited');
}

function detailsAvailabilityRank(value) {
  if (value === 'full') return 3;
  if (value === 'partial') return 2;
  return 1;
}

function contactQualityScore(shop) {
  if (shop.contactQuality === 'high') return 3;
  if (shop.contactQuality === 'medium') return 2;
  return 1;
}

function contactQualityLabel(shop) {
  const score = contactQualityScore(shop);
  if (score === 3) return t('rankFull');
  if (score === 2) return t('rankPartial');
  return t('rankLimited');
}

function calculateConfidenceBadge(shop) {
  let score = shop.confidence || 50;
  if (shop.verified) score = Math.min(100, score + 10);
  if (shop.contactQuality === 'high') score = Math.min(100, score + 5);
  if (shop.contactQuality === 'low') score = Math.max(0, score - 5);
  if (score >= 90) return { level: 'high', label: `${score}%`, color: 'green' };
  if (score >= 70) return { level: 'medium', label: `${score}%`, color: 'amber' };
  return { level: 'low', label: `${score}%`, color: 'red' };
}

function isMarketArea(shop) {
  const listingType = String(shop.listingType || shop.listing_type || '').toLowerCase();
  if (listingType === 'market_cluster') return true;
  if (listingType === 'verified_shop' || listingType === 'sponsor') return false;
  if (shop.type === 'market') return true;
  if (shop.type === 'direct') return false;
  return (
    !shop.phone &&
    !shop.website &&
    (shop.notes?.toLowerCase().includes('cluster') ||
      shop.notes?.toLowerCase().includes('concentration') ||
      shop.notes?.toLowerCase().includes('area'))
  );
}

function listingType(shop) {
  const explicit = String(shop.listingType || shop.listing_type || '').toLowerCase();
  if (
    explicit === 'verified_shop' ||
    explicit === 'market_cluster' ||
    explicit === 'sponsor' ||
    explicit === 'pending_unverified'
  ) {
    return explicit;
  }
  if (shop.sponsored) return 'sponsor';
  if (shop.verified) return 'verified_shop';
  if (isMarketArea(shop)) return 'market_cluster';
  return 'pending_unverified';
}

const LISTING_TAB_LABELS = {
  verified_shop: 'tabVerified',
  market_cluster: 'tabMarkets',
  sponsor: 'tabSponsored',
};

function activeListingTabLabel() {
  const key = LISTING_TAB_LABELS[STATE.listingTab];
  return key ? t(key) : null;
}

async function openClaimDialog() {
  const dialog = document.createElement('dialog');
  dialog.className = 'shops-claim-dialog';

  const form = document.createElement('form');
  form.method = 'dialog';
  form.className = 'shops-claim-dialog-form';

  const title = document.createElement('h3');
  title.textContent = t('claimListing');
  form.appendChild(title);

  const lead = document.createElement('p');
  lead.textContent = t('claimListingPrompt');
  form.appendChild(lead);

  const nameLabel = document.createElement('label');
  nameLabel.textContent = t('contactName');
  const nameInput = document.createElement('input');
  nameInput.name = 'name';
  nameInput.required = true;
  nameInput.maxLength = 120;
  nameLabel.appendChild(nameInput);
  form.appendChild(nameLabel);

  const emailLabel = document.createElement('label');
  emailLabel.textContent = t('claimEmailPrompt');
  const emailInput = document.createElement('input');
  emailInput.name = 'email';
  emailInput.type = 'email';
  emailInput.required = true;
  emailInput.maxLength = 200;
  emailLabel.appendChild(emailInput);
  form.appendChild(emailLabel);

  const menu = document.createElement('menu');
  const cancel = document.createElement('button');
  cancel.value = 'cancel';
  cancel.type = 'button';
  cancel.textContent = t('closeDetails');
  const submit = document.createElement('button');
  submit.value = 'submit';
  submit.type = 'submit';
  submit.textContent = t('claimListing');
  menu.append(cancel, submit);
  form.appendChild(menu);

  dialog.appendChild(form);
  document.body.appendChild(dialog);

  return new Promise((resolve) => {
    cancel.addEventListener('click', () => {
      dialog.close('cancel');
    });
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const fd = new FormData(form);
      const name = String(fd.get('name') || '').trim();
      const email = String(fd.get('email') || '').trim();
      if (!name || !email) return;
      dialog.close('submit');
      resolve({ name, email });
    });
    dialog.addEventListener('close', () => {
      if (dialog.returnValue !== 'submit') resolve(null);
      dialog.remove();
    });
    dialog.showModal();
  });
}

async function postShopEvent(shopId, action, extra = {}) {
  if (!shopId || !action) return;
  try {
    await fetch(`/api/v1/shops/${encodeURIComponent(shopId)}/click`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        source_path: `${location.pathname}${location.search}`,
        ...extra,
      }),
    });
  } catch {
    // non-blocking telemetry
  }
}

async function submitShopClaim(shopId) {
  track(EVENTS.SHOP_CLAIM_START, { shop_id: shopId, surface: 'shops' });
  const claimData = await openClaimDialog();
  if (!claimData) return;
  try {
    const res = await fetch(`/api/v1/shops/${encodeURIComponent(shopId)}/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ claimant_name: claimData.name, claimant_email: claimData.email }),
    });
    if (!res.ok) throw new Error('claim failed');
    announceShopStatus(t('claimListingThanks'));
  } catch {
    announceShopStatus(t('genericError'));
  }
}

function listingTypeLabel(shop) {
  if (listingType(shop) === 'sponsor') return t('badgeSponsored');
  if (isMarketArea(shop)) return t('marketAreaListing');
  return t('storeProfile');
}

function profileStatusLabel(shop) {
  if (listingType(shop) === 'sponsor') return t('badgeSponsored');
  if (isMarketArea(shop)) return t('marketAreaStatus');
  if (shop.verified) return t('verifiedStatus');
  if (shop.phone || shop.website) return t('listedStatus');
  return t('unverifiedStatus');
}

function listingSortScore(shop) {
  const detailRank = detailsAvailabilityRank(shop.detailsAvailability);
  const contactBonus = shop.phone && shop.website ? 2 : shop.phone || shop.website ? 1 : 0;
  const typeBonus = isMarketArea(shop) ? 0 : 1;
  return detailRank * 100 + contactBonus * 10 + typeBonus;
}

function sortedShops(shops) {
  const list = [...shops];
  if (STATE.sortBy === 'alpha') {
    return list.sort((a, b) => a.name.localeCompare(b.name, STATE.lang));
  }
  if (STATE.sortBy === 'city') {
    return list.sort((a, b) => {
      const byCity = a.city.localeCompare(b.city, STATE.lang);
      return byCity || a.name.localeCompare(b.name, STATE.lang);
    });
  }
  if (STATE.sortBy === 'specialty') {
    return list.sort((a, b) => {
      const specDiff = (b.specialties?.length || 0) - (a.specialties?.length || 0);
      if (specDiff !== 0) return specDiff;
      return a.name.localeCompare(b.name, STATE.lang);
    });
  }
  return list.sort((a, b) => {
    const scoreDiff = listingSortScore(b) - listingSortScore(a);
    if (scoreDiff !== 0) return scoreDiff;
    const featuredDiff = Number(Boolean(b.featured)) - Number(Boolean(a.featured));
    if (featuredDiff !== 0) return featuredDiff;
    return a.name.localeCompare(b.name, STATE.lang);
  });
}

function cityGoldRateUrl(shop) {
  const country = countryByCode(shop.countryCode);
  if (!country?.slug) return '';
  const cityMatch = (country.cities || []).find(
    (c) => c.nameEn === shop.city || c.nameAr === shop.city
  );
  if (cityMatch?.slug) {
    return `countries/${country.slug}/${cityMatch.slug}/gold-rate/`;
  }
  return `countries/${country.slug}/gold-price/`;
}

async function copyShopDetails(shop, button = null) {
  const country = countryByCode(shop.countryCode);
  const lines = [
    shop.name,
    `${shop.city}, ${countryName(country)} · ${shop.market}`,
    ...(shop.specialties?.length ? [`${t('specialties')}: ${shop.specialties.join(', ')}`] : []),
    shop.phone ? `${t('phone')}: ${shop.phone}` : null,
    safeUrl(shop.website) ? `${t('website')}: ${shop.website}` : null,
  ].filter(Boolean);
  const iconEl = button?.querySelector('.shop-action-icon');
  const originalIcon = iconEl?.textContent;
  const ok = await copyWithToast(lines.join('\n'), {
    successMessage: t('detailsCopied'),
    errorMessage: t('genericError'),
  });
  if (ok && iconEl) {
    iconEl.textContent = '✓';
    window.setTimeout(() => {
      iconEl.textContent = originalIcon || '⎘';
    }, 1500);
  }
}

function toggleShortlist(shopId) {
  const idx = STATE.shortlist.indexOf(shopId);
  const addingToShortlist = idx === -1;
  if (idx === -1) {
    STATE.shortlist.push(shopId);
  } else {
    STATE.shortlist.splice(idx, 1);
  }
  try {
    localStorage.setItem('shops_shortlist', JSON.stringify(STATE.shortlist));
  } catch {}
  if (addingToShortlist) {
    postShopEvent(shopId, 'save');
  }
  render(); // Re-render to update button states
}

function isInShortlist(shopId) {
  return STATE.shortlist.includes(shopId);
}

async function shareShop(shop) {
  const url = `${location.origin}${location.pathname}?shop=${shop.id}`;
  const text = `${shop.name} — ${shop.market}, ${shop.city}`;

  if (navigator.share) {
    try {
      await navigator.share({ title: shop.name, text, url });
      postShopEvent(shop.id, 'share');
    } catch {
      // User canceled or native share failed; do not track conversion.
    }
  } else {
    // Fallback: copy to clipboard
    try {
      const writeText = navigator.clipboard?.writeText?.bind(navigator.clipboard);
      if (!writeText) return;
      await writeText(url);
      announceShopStatus(t('linkCopied'));
      postShopEvent(shop.id, 'share');
    } catch {
      // Clipboard unavailable/blocked; do not track conversion.
    }
  }
}

function announceShopStatus(message) {
  let status = document.getElementById('shops-live-status');
  if (!status) {
    status = document.createElement('p');
    status.id = 'shops-live-status';
    status.className = 'shops-results-disclaimer';
    status.setAttribute('aria-live', 'polite');
    const head = document.querySelector('.shops-results-head-left');
    head?.appendChild(status);
  }
  status.textContent = message;
}

async function saveShopToAccount(shop) {
  if (!shop?.id) return;
  if (!isAccountAuthenticated()) {
    if (window.confirm(t('saveToAccountAuthPrompt'))) {
      redirectToAccount();
    }
    return;
  }
  await createSavedShop({
    shop_id: shop.id,
    shop_name: shop.name,
    city: shop.city,
    country_code: shop.countryCode,
    source_url: `${location.origin}${location.pathname}?shop=${encodeURIComponent(shop.id)}`,
    notes: shop.notes || null,
  });
  postShopEvent(shop.id, 'save');
  announceShopStatus(t('savedToAccount'));
}

function openModal(shop) {
  const modal = document.getElementById('shops-modal');
  const country = countryByCode(shop.countryCode);
  const whatsappNumber = formatPhoneForWhatsApp(shop.phone);
  const specialties = (shop.specialties || [])
    .map((item) => `<span class="shop-tag">${esc(item)}</span>`)
    .join('');
  const inList = isInShortlist(shop.id);
  track(EVENTS.SHOP_CARD_OPEN, {
    shop_id: shop.id,
    listing_type: listingType(shop),
    surface: 'shops_modal',
  });

  // Build action buttons row
  const actionsHTML = `
    <div class="modal-actions">
      <button class="modal-action-btn modal-action-btn--shortlist ${inList ? 'is-saved' : ''}" 
              type="button" data-shop-id="${esc(shop.id)}" aria-label="${inList ? t('removeFromShortlist') : t('saveToShortlist')}">
        <span class="modal-action-icon">${inList ? '✓' : '+'}</span>
        <span class="modal-action-label">${inList ? t('saved') : t('saveToShortlist')}</span>
      </button>
      <button class="modal-action-btn modal-action-btn--share" type="button" data-shop-id="${esc(shop.id)}" aria-label="${t('shareShop')}">
        <span class="modal-action-icon">↗</span>
        <span class="modal-action-label">${t('shareShop')}</span>
      </button>
      <button class="modal-action-btn modal-action-btn--account" type="button" data-shop-id="${esc(shop.id)}" aria-label="${t('saveToAccount')}">
        <span class="modal-action-icon">☁</span>
        <span class="modal-action-label">${t('saveToAccount')}</span>
      </button>
      ${
        shop.phone
          ? `<a href="tel:${esc(safeTel(shop.phone))}" class="modal-action-btn modal-action-btn--call" aria-label="${t('callShop')}">
        <span class="modal-action-icon">📞</span>
        <span class="modal-action-label">${t('callShop')}</span>
      </a>`
          : ''
      }
      ${
        whatsappNumber
          ? `<a href="https://wa.me/${esc(whatsappNumber)}" target="_blank" rel="noopener" class="modal-action-btn modal-action-btn--whatsapp" aria-label="${t('whatsApp')}">
        <span class="modal-action-icon">💬</span>
        <span class="modal-action-label">${t('whatsApp')}</span>
      </a>`
          : ''
      }
      ${
        safeUrl(shop.website)
          ? `<a href="${esc(safeUrl(shop.website))}" target="_blank" rel="noopener" class="modal-action-btn modal-action-btn--website" aria-label="${t('visitWebsite')}">
        <span class="modal-action-icon">🌐</span>
        <span class="modal-action-label">${t('visitWebsite')}</span>
      </a>`
          : ''
      }
      <button class="modal-action-btn modal-action-btn--share" type="button" data-claim-shop-id="${esc(shop.id)}" aria-label="${t('claimListing')}">
        <span class="modal-action-icon">🛡️</span>
        <span class="modal-action-label">${t('claimListing')}</span>
      </button>
    </div>
  `;

  const contactHTML =
    shop.phone || shop.website
      ? `<div class="modal-contact">
      ${shop.phone ? `<p><strong>${t('phone')}:</strong> ${esc(shop.phone)}</p>` : ''}
      ${safeUrl(shop.website) ? `<p><a href="${esc(safeUrl(shop.website))}" target="_blank" rel="noopener" class="shop-site-link">${t('visitWebsite')} →</a></p>` : ''}
    </div>`
      : `<p class="modal-no-contact">${t('noContact')}</p>`;

  const isCluster = isMarketArea(shop);
  const confidenceBadge = calculateConfidenceBadge(shop);
  const clusterBadge = isCluster
    ? `<span class="modal-cluster-badge">${t('marketCluster')}</span>`
    : '';
  const listingTypeBadge = `<span class="modal-listing-type ${isCluster ? 'modal-listing-type--market' : 'modal-listing-type--store'}">${listingTypeLabel(shop)}</span>`;
  const confidenceBadgeHTML = `<span class="modal-confidence-badge modal-confidence-${esc(confidenceBadge.level)}" style="--confidence-color: var(--color-${esc(confidenceBadge.color)})">${t('detailsConfidence')}: ${esc(confidenceBadge.label)}</span>`;

  document.getElementById('shops-modal-body').innerHTML = `
    <div class="modal-head">
      <h2 id="shops-modal-title">${esc(shop.name)}</h2>
      <div class="modal-badges">
        ${clusterBadge}
        ${listingTypeBadge}
        ${confidenceBadgeHTML}
        <span class="modal-details-badge modal-details-${esc(shop.detailsAvailability)}">${t('detailsSignal')}: ${detailsAvailabilityLabel(shop.detailsAvailability)}</span>
        ${shop.featured ? `<span class="modal-featured-badge">★ ${t('featured')}</span>` : ''}
      </div>
    </div>

    ${actionsHTML}

    <div class="modal-meta">
      <div class="modal-meta-item">
        <span class="modal-meta-label">${t('location')}</span>
        <span class="modal-meta-value">${esc(shop.city)}, ${countryName(country)} · ${regionName(country.group)}</span>
      </div>
      <div class="modal-meta-item">
        <span class="modal-meta-label">${t('market')}</span>
        <span class="modal-meta-value">${esc(shop.market)}</span>
      </div>
      <div class="modal-meta-item">
        <span class="modal-meta-label">${t('category')}</span>
        <span class="modal-meta-value">${esc(shop.category)}</span>
      </div>
    </div>

    ${
      specialties
        ? `<div class="modal-tags">
      <span class="modal-tags-label">${t('specialties')}</span>
      <div class="modal-tags-wrap">${specialties}</div>
    </div>`
        : ''
    }

    <div class="modal-notes">
      <p>${esc(shop.notes)}</p>
    </div>
    <div class="modal-next-step" role="note" aria-label="${t('nextStepTitle')}">
      <strong>${t('nextStepTitle')}</strong>
      <p>${t('nextStepBody')}</p>
    </div>

    ${contactHTML}
    <div class="modal-foot">
      <button class="modal-close-cta" type="button">${t('closeDetails')}</button>
    </div>
  `;

  // Bind action button handlers
  const shortlistBtn = modal.querySelector('.modal-action-btn--shortlist');
  if (shortlistBtn) {
    shortlistBtn.addEventListener('click', () => {
      toggleShortlist(shop.id);
      openModal(shop); // Re-open to refresh button state
    });
  }

  const shareBtn = modal.querySelector('.modal-action-btn--share');
  if (shareBtn) {
    shareBtn.addEventListener('click', () => shareShop(shop));
  }
  const saveAccountBtn = modal.querySelector('.modal-action-btn--account');
  if (saveAccountBtn) {
    saveAccountBtn.addEventListener('click', () => {
      saveShopToAccount(shop).catch(() => {});
    });
  }
  modal.querySelectorAll('[data-claim-shop-id]').forEach((button) => {
    button.addEventListener('click', () => {
      submitShopClaim(shop.id).catch(() => {});
    });
  });
  modal.querySelectorAll('.modal-action-btn--call').forEach((button) => {
    button.addEventListener('click', () => {
      postShopEvent(shop.id, 'call');
      track(EVENTS.SHOP_CALL_CLICK, { shop_id: shop.id, surface: 'shops_modal' });
    });
  });
  modal.querySelectorAll('.modal-action-btn--website').forEach((button) => {
    button.addEventListener('click', () => postShopEvent(shop.id, 'website'));
  });
  modal.querySelectorAll('.modal-action-btn--whatsapp').forEach((button) => {
    button.addEventListener('click', () => {
      postShopEvent(shop.id, 'whatsapp');
      track(EVENTS.SHOP_WHATSAPP_CLICK, { shop_id: shop.id, surface: 'shops_modal' });
    });
  });

  modal.hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeModal({ clearShopParam = true } = {}) {
  const modal = document.getElementById('shops-modal');
  if (!modal) return;
  modal.hidden = true;
  document.body.style.overflow = '';

  if (!clearShopParam) return;
  const params = new URLSearchParams(location.search);
  if (!params.has('shop')) return;
  params.delete('shop');
  const qs = params.toString();
  history.replaceState(null, '', qs ? `${location.pathname}?${qs}` : location.pathname);
}

function applyStaticText() {
  document.documentElement.lang = STATE.lang;
  document.documentElement.dir = STATE.lang === 'ar' ? 'rtl' : 'ltr';

  document.getElementById('shops-kicker').textContent = t('kicker');
  document.getElementById('shops-title').textContent = t('title');
  document.getElementById('shops-lead').textContent = t('lead');

  // Trust banner with formatted date
  const reviewedDate = new Date(`${SHOPS_LAST_REVIEWED_ISO}T00:00:00Z`);
  const dateStr =
    STATE.lang === 'ar'
      ? reviewedDate.toLocaleDateString('ar-EG', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })
      : reviewedDate.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        });
  const trustEl = document.getElementById('shops-last-updated');
  const trustLabelEl = document.getElementById('shops-trust-label');
  if (trustLabelEl) trustLabelEl.textContent = t('trustLabel');
  if (trustEl) {
    trustEl.textContent = t('trustDate').replace('{date}', dateStr);
  }

  // Directory-reviewed label in filter bar (separate from hero trust banner)
  const directoryReviewedEl = document.getElementById('shops-directory-reviewed');
  if (directoryReviewedEl) {
    directoryReviewedEl.textContent = t('directoryReviewed').replace('{date}', dateStr);
    directoryReviewedEl.hidden = false;
  }

  // Featured section footnote (bilingual)
  const featuredNoteEl = document.getElementById('shops-featured-note');
  if (featuredNoteEl) featuredNoteEl.textContent = t('featuredNote');

  document.getElementById('shops-popular-label').textContent = t('popularMarkets');
  document.getElementById('shops-search-label').textContent = t('searchLabel');
  document.getElementById('shops-search').placeholder = t('searchPlaceholder');
  document.getElementById('shops-region-label').textContent = t('region');
  document.getElementById('shops-country-label').textContent = t('country');
  document.getElementById('shops-city-label').textContent = t('city');
  document.getElementById('shops-specialty-label').textContent = t('specialtyFilter');
  const sortLabel = document.getElementById('shops-sort-label');
  if (sortLabel) sortLabel.textContent = t('sortLabel');
  const sortSelect = document.getElementById('shops-sort');
  if (sortSelect) {
    const opts = sortSelect.querySelectorAll('option');
    const keys = ['sortRelevance', 'sortAlpha', 'sortCity', 'sortSpecialty'];
    opts.forEach((opt, i) => {
      if (keys[i]) opt.textContent = t(keys[i]);
    });
  }
  const groupLabel = document.getElementById('shops-group-label');
  if (groupLabel) groupLabel.textContent = t('groupByCity');
  document.getElementById('shops-verified-label').textContent = t('verifiedOnly');
  document.getElementById('shops-verified-help').textContent = t('verifiedHelp');
  document.getElementById('shops-results-title').textContent = t('listed');
  document.getElementById('shops-empty-title').textContent = t('emptyTitle');
  const emptyTextEl = document.getElementById('shops-empty-text');
  if (emptyTextEl) {
    emptyTextEl.textContent = t('emptyText');
  }
  document.getElementById('shops-clear-filters').textContent = t('clearAllFilters');
  document.getElementById('shops-controls-clear').textContent = t('clearAllFiltersShort');
  document.getElementById('shops-controls-active').textContent = t('noFilters');
  document.getElementById('shops-stat-listings-label').textContent = t('statListings');
  document.getElementById('shops-stat-countries-label').textContent = t('statCountries');
  document.getElementById('shops-stat-regions-label').textContent = t('statRegions');
  document.getElementById('shops-info-title').textContent = t('infoTitle');
  document.getElementById('shops-info-1-title').textContent = t('info1Title');
  document.getElementById('shops-info-1-body').textContent = t('info1Body');
  document.getElementById('shops-info-2-title').textContent = t('info2Title');
  document.getElementById('shops-info-2-body').textContent = t('info2Body');
  document.getElementById('shops-info-3-title').textContent = t('info3Title');
  document.getElementById('shops-info-3-body').textContent = t('info3Body');
  document.getElementById('shops-results-legend').textContent = t('resultsLegend');
  document.getElementById('shops-results-disclaimer').textContent = t('resultsDisclaimer');
  document.getElementById('shops-freshness-semantics').textContent = t('freshnessSemantics');
  const priceDisclEl = document.getElementById('shops-price-disclaimer');
  if (priceDisclEl) {
    const textNode = document.createTextNode(t('priceDisclaimer') + ' ');
    const spotLink = document.createElement('a');
    spotLink.href = 'content/spot-vs-retail-gold-price/';
    spotLink.textContent = t('spotVsRetailLinkText');
    const sep = document.createTextNode(' · ');
    const methodLink = document.createElement('a');
    methodLink.href = 'methodology.html';
    methodLink.textContent = t('methodologyLinkText');
    priceDisclEl.replaceChildren(textNode, spotLink, sep, methodLink);
  }
  document.getElementById('shops-shortlist-label').textContent = t('shortlistLabel');
  document.getElementById('shops-shortlist-clear').textContent = t('shortlistClear');
  document.getElementById('shops-shortlist-compare').textContent = t('shortlistReview');
  document.getElementById('shops-nearme-title').textContent = t('nearmeTitle');
  document.querySelector('.shops-nearme-lead').textContent = t('nearmeLead');
  document.getElementById('shops-nearme-btn').lastChild.textContent = t('nearmeButton');
  document.getElementById('shops-guides-heading').textContent = t('resourcesTitle');
  document.getElementById('shops-controls-count').textContent = t('count')(SHOPS.length);
  const tabVerified = document.getElementById('shops-tab-verified');
  const tabMarkets = document.getElementById('shops-tab-markets');
  const tabSponsored = document.getElementById('shops-tab-sponsored');
  if (tabVerified) tabVerified.textContent = t('tabVerified');
  if (tabMarkets) tabMarkets.textContent = t('tabMarkets');
  if (tabSponsored) tabSponsored.textContent = t('tabSponsored');
  const sponsoredDisclosure = document.getElementById('shops-sponsored-disclosure');
  if (sponsoredDisclosure) sponsoredDisclosure.textContent = t('sponsoredDisclosure');
  const loading = document.getElementById('shops-loading');
  if (loading) {
    const title = loading.querySelector('h3');
    const body = loading.querySelector('p');
    if (title) title.textContent = t('loadingListings');
    if (body) body.textContent = t('loadingListingsBody');
  }
  const error = document.getElementById('shops-error');
  if (error) {
    const title = error.querySelector('h3');
    const body = error.querySelector('p');
    if (title) title.textContent = t('loadErrorTitle');
    if (body) body.textContent = t('loadErrorBody');
  }

  const modalCloseBtn = document.querySelector('.shops-modal-close');
  if (modalCloseBtn) {
    modalCloseBtn.setAttribute('aria-label', t('closeDetails'));
    modalCloseBtn.setAttribute('title', t('closeDetails'));
  }
}

function shopsMatchingPrimaryFilters() {
  return SHOPS.filter((shop) => {
    const country = countryByCode(shop.countryCode);
    if (!country) return false;
    if (STATE.region !== 'all' && country.group !== STATE.region) return false;
    if (STATE.country !== 'all' && shop.countryCode !== STATE.country) return false;
    if (STATE.city !== 'all' && shop.city !== STATE.city) return false;
    return true;
  });
}

function buildFilters() {
  const regionSelect = document.getElementById('shops-region-filter');
  const countrySelect = document.getElementById('shops-country-filter');
  const citySelect = document.getElementById('shops-city-filter');
  const specialtySelect = document.getElementById('shops-specialty-filter');

  // Guard against missing DOM elements - FAIL LOUDLY
  if (!regionSelect || !countrySelect || !citySelect || !specialtySelect) {
    const missing = [];
    if (!regionSelect) missing.push('shops-region-filter');
    if (!countrySelect) missing.push('shops-country-filter');
    if (!citySelect) missing.push('shops-city-filter');
    if (!specialtySelect) missing.push('shops-specialty-filter');

    const errorMsg = `[shops] CRITICAL: Filter select elements not found: ${missing.join(', ')}. Check shops.html.`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  const countByRegion = (code) =>
    code === 'all'
      ? SHOPS.length
      : SHOPS.filter((s) => countryByCode(s.countryCode)?.group === code).length;

  regionSelect.innerHTML = `<option value="all">${t('allRegions')} (${countByRegion('all')})</option>${Object.entries(
    REGIONS
  )
    .map(
      ([code, labels]) =>
        `<option value="${code}">${labels[STATE.lang]} (${countByRegion(code)})</option>`
    )
    .join('')}`;

  const countryCodes = [...new Set(shopsMatchingPrimaryFilters().map((shop) => shop.countryCode))];

  const allCountries = COUNTRIES.filter((country) =>
    SHOPS.some((shop) => shop.countryCode === country.code)
  )
    .filter((country) => STATE.region === 'all' || country.group === STATE.region)
    .sort((a, b) => countryName(a).localeCompare(countryName(b), STATE.lang));

  const cityPool = SHOPS.filter((shop) => {
    const country = countryByCode(shop.countryCode);
    if (!country) return false;
    if (STATE.region !== 'all' && country.group !== STATE.region) return false;
    if (STATE.country !== 'all' && shop.countryCode !== STATE.country) return false;
    return true;
  });

  const countByCountry = (code) =>
    code === 'all' ? cityPool.length : cityPool.filter((s) => s.countryCode === code).length;

  countrySelect.innerHTML = `<option value="all">${t('allCountries')} (${countByCountry('all')})</option>${allCountries
    .filter((country) => countryCodes.includes(country.code) || STATE.country === 'all')
    .map(
      (country) =>
        `<option value="${country.code}">${countryName(country)} (${countByCountry(country.code)})</option>`
    )
    .join('')}`;

  const cities = [...new Set(cityPool.map((shop) => shop.city))].sort((a, b) => a.localeCompare(b));
  const countByCity = (city) =>
    city === 'all' ? cityPool.length : cityPool.filter((s) => s.city === city).length;

  citySelect.innerHTML = `<option value="all">${t('allCities')} (${countByCity('all')})</option>${cities
    .map((city) => `<option value="${esc(city)}">${esc(city)} (${countByCity(city)})</option>`)
    .join('')}`;

  const specialties = [
    ...new Set(shopsMatchingPrimaryFilters().flatMap((shop) => shop.specialties || [])),
  ].sort((a, b) => a.localeCompare(b));

  const matching = shopsMatchingPrimaryFilters();
  const countBySpecialty = (item) =>
    item === 'all'
      ? matching.length
      : matching.filter((s) => (s.specialties || []).includes(item)).length;

  specialtySelect.innerHTML = `<option value="all">${t('allSpecialties')} (${countBySpecialty('all')})</option>${specialties
    .map((item) => `<option value="${esc(item)}">${esc(item)} (${countBySpecialty(item)})</option>`)
    .join('')}`;

  regionSelect.value = STATE.region;
  if (![...countrySelect.options].some((option) => option.value === STATE.country)) {
    console.warn('[shops] buildFilters(): Invalid country', STATE.country, 'resetting to all');
    STATE.country = 'all';
  }
  countrySelect.value = STATE.country;
  if (![...citySelect.options].some((option) => option.value === STATE.city)) {
    console.warn('[shops] buildFilters(): Invalid city', STATE.city, 'resetting to all');
    STATE.city = 'all';
  }
  citySelect.value = STATE.city;
  if (![...specialtySelect.options].some((option) => option.value === STATE.specialty)) {
    console.warn('[shops] buildFilters(): Invalid specialty', STATE.specialty, 'resetting to all');
    STATE.specialty = 'all';
  }
  specialtySelect.value = STATE.specialty;
}

function populatePopularChips() {
  const box = document.getElementById('shops-popular-chips');
  const featured = SHOPS.filter((shop) => shop.featured).slice(0, 6);
  box.innerHTML = featured
    .map((shop) => {
      const label = `${esc(shop.market)} · ${esc(shop.city)}`;
      return `<button class="shops-chip" type="button" data-country="${esc(shop.countryCode)}" data-city="${esc(shop.city)}">${label}</button>`;
    })
    .join('');

  box.querySelectorAll('.shops-chip').forEach((button) => {
    button.addEventListener('click', () => {
      STATE.country = button.dataset.country || 'all';
      STATE.city = button.dataset.city || 'all';
      STATE.region = 'all';
      STATE.specialty = 'all';
      buildFilters();
      render();
    });
  });
}

function filterShops() {
  const q = STATE.search.trim().toLowerCase();
  const filtered = SHOPS.filter((shop) => {
    const country = countryByCode(shop.countryCode);
    if (!country) {
      console.warn('[shops] Shop missing country:', shop.id, shop.countryCode);
      return false;
    }

    if (STATE.region !== 'all' && country.group !== STATE.region) return false;
    if (STATE.country !== 'all' && shop.countryCode !== STATE.country) return false;
    if (STATE.city !== 'all' && shop.city !== STATE.city) return false;
    if (STATE.specialty !== 'all' && !(shop.specialties || []).includes(STATE.specialty))
      return false;
    if (STATE.verifiedOnly && !(shop.phone || shop.website)) return false;
    if (STATE.listingTab && listingType(shop) !== STATE.listingTab) return false;

    if (!q) return true;

    const haystack = [
      shop.name,
      shop.city,
      shop.market,
      shop.category,
      ...(shop.specialties || []),
      shop.notes,
      country.nameEn,
      country.nameAr,
      regionName(country.group),
    ]
      .join(' ')
      .toLowerCase();

    return haystack.includes(q);
  });

  return filtered;
}

function updateHeaderStats() {
  const uniqueCountries = new Set(SHOPS.map((shop) => shop.countryCode));
  const uniqueRegions = new Set(
    SHOPS.map((shop) => countryByCode(shop.countryCode)?.group).filter(Boolean)
  );

  document.getElementById('shops-stat-listings').textContent = String(SHOPS.length);
  document.getElementById('shops-stat-countries').textContent = String(uniqueCountries.size);
  document.getElementById('shops-stat-regions').textContent = String(uniqueRegions.size);
}

function activeFilterSummary() {
  const labels = [];

  const listingTabLabel = activeListingTabLabel();
  if (listingTabLabel) labels.push(listingTabLabel);
  if (STATE.region !== 'all') labels.push(regionName(STATE.region));
  if (STATE.country !== 'all') {
    const country = countryByCode(STATE.country);
    if (country) labels.push(countryName(country));
  }
  if (STATE.city !== 'all') labels.push(STATE.city);
  if (STATE.specialty !== 'all') labels.push(STATE.specialty);
  if (STATE.verifiedOnly) labels.push(t('verifiedFilterLabel'));
  if (STATE.search.trim()) labels.push(`"${STATE.search.trim()}"`);

  document.getElementById('shops-active-filters').textContent = labels.length
    ? t('activeFilters')(labels.join(' · '))
    : t('noFilters');
  const controlsActive = document.getElementById('shops-controls-active');
  if (controlsActive) {
    controlsActive.textContent = labels.length
      ? t('activeFilters')(labels.join(' · '))
      : t('noFilters');
  }

  // Update mobile filter badge count
  const badge = document.getElementById('shops-filter-badge');
  if (badge) {
    const count = labels.length;
    badge.textContent = String(count);
    badge.hidden = count === 0;
  }
}

function buildShopCardMarkup(shop) {
  const country = countryByCode(shop.countryCode);
  const specialties = (shop.specialties || [])
    .map((item) => `<span class="shop-tag">${esc(item)}</span>`)
    .join('');
  const isCluster = isMarketArea(shop);
  const confidenceBadge = calculateConfidenceBadge(shop);
  const clusterBadge = isCluster
    ? `<span class="shop-cluster-badge">${t('marketCluster')}</span>`
    : '';
  const listingTypeBadge = `<span class="shop-listing-type ${isCluster ? 'shop-listing-type--market' : 'shop-listing-type--store'}">${listingTypeLabel(shop)}</span>`;
  const inShortlist = isInShortlist(shop.id);
  const countryUrl = country?.slug ? `countries/${country.slug}/gold-price/` : '';
  const goldRateUrl = cityGoldRateUrl(shop);
  const areaGuideUrl = `${location.pathname}?country=${encodeURIComponent(shop.countryCode)}&search=${encodeURIComponent(shop.market)}`;
  const directionsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${shop.name}, ${shop.market}, ${shop.city}`)}`;
  const nextActionLabel = isCluster ? t('nextActionsMarket') : t('nextActionsStore');
  const qualityLabel = contactQualityLabel(shop);
  const statusLabel = profileStatusLabel(shop);
  const shopListingType = listingType(shop);
  const whatsappNumber = formatPhoneForWhatsApp(shop.phone);
  const phoneAction = shop.phone
    ? `<a href="tel:${esc(safeTel(shop.phone))}" class="shop-action-btn shop-action-btn--call" aria-label="${t('callShop')}">
            <span class="shop-action-icon">📞</span>
            <span class="shop-action-label">${t('callShop')}</span>
          </a>`
    : `<button class="shop-action-btn shop-action-btn--disabled" type="button" disabled aria-label="${t('phone')}: ${t('notAvailable')}">
            <span class="shop-action-icon">📞</span>
            <span class="shop-action-label">${t('notAvailable')}</span>
          </button>`;
  const websiteAction = safeUrl(shop.website)
    ? `<a href="${esc(safeUrl(shop.website))}" target="_blank" rel="noopener" class="shop-action-btn shop-action-btn--website" aria-label="${t('visitWebsite')}">
            <span class="shop-action-icon">🌐</span>
            <span class="shop-action-label">${t('visitWebsite')}</span>
          </a>`
    : `<button class="shop-action-btn shop-action-btn--disabled" type="button" disabled aria-label="${t('website')}: ${t('notAvailable')}">
            <span class="shop-action-icon">🌐</span>
            <span class="shop-action-label">${t('notAvailable')}</span>
          </button>`;
  const whatsappAction = whatsappNumber
    ? `<a href="https://wa.me/${whatsappNumber}" target="_blank" rel="noopener" class="shop-action-btn shop-action-btn--whatsapp" aria-label="${t('whatsApp')}">
            <span class="shop-action-icon">💬</span>
            <span class="shop-action-label">${t('whatsApp')}</span>
          </a>`
    : '';

  const contactParts = [];
  contactParts.push(
    shop.phone ? `${t('phone')}: ${esc(shop.phone)}` : `${t('phone')}: ${t('notAvailable')}`
  );
  if (safeUrl(shop.website)) {
    contactParts.push(
      `<a href="${esc(safeUrl(shop.website))}" target="_blank" rel="noopener" class="shop-site-link">${t('visitWebsite')}</a>`
    );
  } else {
    contactParts.push(`${t('website')}: ${t('notAvailable')}`);
  }

  return `
      <article class="shop-card card-interactive${shop.featured ? ' shop-card--featured' : ''}${isCluster ? ' shop-card--cluster' : ''}" data-shop-id="${esc(shop.id)}">
        <header class="shop-card-head">
          <div>
            <h3>${esc(shop.name)}</h3>
            <div class="shop-card-badges">
              ${clusterBadge}
              ${listingTypeBadge}
              ${shop.featured ? `<span class="shop-featured">${t('featured')}</span>` : ''}
            </div>
          </div>
        </header>

        <div class="shop-status-row" aria-label="${t('status')}">
          <span class="shop-status-chip shop-status-chip--type">${listingTypeLabel(shop)}</span>
          <span class="shop-status-chip ${shop.verified ? 'shop-status-chip--verified' : isCluster ? 'shop-status-chip--market' : 'shop-status-chip--listed'}">${statusLabel}</span>
          <span class="shop-status-chip shop-status-chip--details">${detailsAvailabilityLabel(shop.detailsAvailability)}</span>
          ${shopListingType === 'sponsor' ? `<span class="shop-status-chip shop-status-chip--listed">${t('badgeSponsored')}</span>` : ''}
          ${shopListingType === 'market_cluster' ? `<span class="shop-status-chip shop-status-chip--market">${t('badgeMarketArea')}</span>` : ''}
          ${shopListingType === 'verified_shop' ? `<span class="shop-status-chip shop-status-chip--verified">${t('badgeVerified')}</span>` : ''}
          ${shop.detailsAvailability === 'limited' ? `<span class="shop-status-chip shop-status-chip--listed">${t('badgeContactLimited')}</span>` : ''}
        </div>

        <section class="shop-confidence-block" aria-label="${t('listingConfidenceTitle')}">
          <p class="shop-confidence-title">${t('listingConfidenceTitle')}</p>
          <div class="shop-confidence-grid">
            <p class="shop-confidence-item">
              <span>${t('category')}</span>
              <strong>${listingTypeLabel(shop)}</strong>
            </p>
            <p class="shop-confidence-item">
              <span>${t('detailsConfidence')}</span>
              <strong class="shop-signal shop-signal--${esc(confidenceBadge.level)}" style="--confidence-color: var(--color-${esc(confidenceBadge.color)})">${esc(confidenceBadge.label)}</strong>
            </p>
            <p class="shop-confidence-item">
              <span>${t('contactQuality')}</span>
              <strong>${qualityLabel}</strong>
            </p>
          </div>
        </section>

        <div class="shop-meta-grid">
          <p class="shop-meta"><span>${t('location')}</span><strong>${esc(shop.city)}, ${countryName(country)} · ${regionName(country.group)}</strong></p>
          <p class="shop-meta"><span>${t('market')}</span><strong>${esc(shop.market)}</strong></p>
          <p class="shop-meta"><span>${t('category')}</span><strong>${esc(shop.category)}</strong></p>
        </div>

        <div class="shop-tags-wrap">
          <span class="shop-tag shop-tag--muted">${t('specialties')}</span>
          ${specialties || '<span class="shop-tag">—</span>'}
        </div>

        <p class="shop-notes">${esc(shop.notes)}</p>
        
        <div class="shop-next-action-label">${nextActionLabel}</div>
        <div class="shop-actions-row shop-actions-row--primary">
          ${
            isCluster
              ? `<a href="${esc(areaGuideUrl)}" class="shop-action-btn shop-action-btn--guide" aria-label="${t('areaGuide')}: ${esc(shop.market)}">
            <span class="shop-action-icon">🧭</span>
            <span class="shop-action-label">${t('areaGuide')}</span>
          </a>`
              : ''
          }
          ${!isCluster ? phoneAction : ''}
          ${!isCluster ? whatsappAction : ''}
          ${!isCluster ? websiteAction : ''}
          ${
            !isCluster
              ? `<a href="${esc(directionsUrl)}" target="_blank" rel="noopener" class="shop-action-btn shop-action-btn--directions" aria-label="${t('directions')}">
            <span class="shop-action-icon">🧭</span>
            <span class="shop-action-label">${t('directions')}</span>
          </a>`
              : ''
          }
          ${
            countryUrl
              ? `<a href="${countryUrl}" class="shop-action-btn shop-action-btn--country" aria-label="${t('viewCountryPage')}: ${countryName(country)}">
            <span class="shop-action-icon">📄</span>
            <span class="shop-action-label">${countryName(country)}</span>
          </a>`
              : ''
          }
          ${
            goldRateUrl
              ? `<a href="${esc(goldRateUrl)}" class="shop-action-btn shop-action-btn--rates" aria-label="${t('viewGoldRate')}: ${esc(shop.city)}">
            <span class="shop-action-icon">📈</span>
            <span class="shop-action-label">${t('viewGoldRate')}</span>
          </a>`
              : ''
          }
        </div>

        <div class="shop-actions-row shop-actions-row--secondary">
          <button class="shop-action-btn shop-action-btn--save ${inShortlist ? 'is-saved' : ''}" 
                  type="button" data-shop-id="${esc(shop.id)}" aria-label="${inShortlist ? t('removeFromShortlist') : t('saveToShortlist')}">
            <span class="shop-action-icon">${inShortlist ? '✓' : '+'}</span>
            <span class="shop-action-label">${inShortlist ? t('saved') : t('saveToShortlist')}</span>
          </button>
          <button class="shop-compare-toggle ${isInCompareList(shop.id) ? 'is-compared' : ''}" 
                  type="button" data-compare-shop-id="${esc(shop.id)}" aria-label="${isInCompareList(shop.id) ? t('compareRemove') : t('compareAdd')}: ${esc(shop.name)}" aria-pressed="${isInCompareList(shop.id) ? 'true' : 'false'}">
            <span class="shop-action-icon">${isInCompareList(shop.id) ? '✓' : '⇌'}</span>
            <span class="shop-action-label">${isInCompareList(shop.id) ? t('compareRemove') : t('compareAdd')}</span>
          </button>
          <button class="shop-action-btn shop-action-btn--copy" type="button" data-copy-shop-id="${esc(shop.id)}" aria-label="${t('copyDetails')}">
            <span class="shop-action-icon">⎘</span>
            <span class="shop-action-label">${t('copyDetails')}</span>
          </button>
          <button class="shop-action-btn shop-action-btn--share" type="button" data-shop-id="${esc(shop.id)}" aria-label="${t('shareShop')}">
            <span class="shop-action-icon">↗</span>
            <span class="shop-action-label">${t('shareShop')}</span>
          </button>
          <button class="shop-action-btn shop-action-btn--account" type="button" data-shop-id="${esc(shop.id)}" aria-label="${t('saveToAccount')}">
            <span class="shop-action-icon">☁</span>
            <span class="shop-action-label">${t('saveToAccount')}</span>
          </button>
          <button class="shop-action-btn shop-action-btn--share shop-action-btn--claim" type="button" data-claim-shop-id="${esc(shop.id)}" aria-label="${t('claimListing')}">
            <span class="shop-action-icon">🛡️</span>
            <span class="shop-action-label">${t('claimListing')}</span>
          </button>
        </div>
        
        <p class="shop-contact">${contactParts.join(' · ') || t('noContact')}</p>
      </article>
    `;
}

function renderCards(shops) {
  const grid = document.getElementById('shops-grid');
  if (!grid) {
    console.warn('[shops] Element #shops-grid not found');
    return;
  }

  if (STATE.groupByCity) {
    const groups = new Map();
    shops.forEach((shop) => {
      const key = shop.city || '—';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(shop);
    });
    const cities = [...groups.keys()].sort((a, b) => a.localeCompare(b, STATE.lang));
    grid.innerHTML = cities
      .map(
        (city) => `
      <section class="shops-city-group" aria-labelledby="shops-city-${esc(city).replace(/\s+/g, '-')}">
        <h2 class="shops-city-group__title" id="shops-city-${esc(city).replace(/\s+/g, '-')}" data-reveal>
          ${esc(city)}
          <span class="badge badge--karat">${groups.get(city).length}</span>
        </h2>
        <div class="shops-city-group__grid">
          ${groups
            .get(city)
            .map((shop) => buildShopCardMarkup(shop))
            .join('')}
        </div>
      </section>`
      )
      .join('');
  } else {
    grid.innerHTML = shops.map((shop) => buildShopCardMarkup(shop)).join('');
  }

  bindShopCardHandlers();
}

// Separate binding function to prevent handler orphaning
function bindShopCardHandlers() {
  const grid = document.getElementById('shops-grid');
  if (!grid) return;

  // Bind card click -> open modal
  grid.querySelectorAll('.shop-card').forEach((card) => {
    const newCard = card.cloneNode(true);
    card.parentNode.replaceChild(newCard, card);

    newCard.addEventListener('click', (e) => {
      // Ignore clicks on action buttons
      if (e.target.closest('.shop-action-btn')) return;

      const shopId = newCard.dataset.shopId;
      const shop = SHOPS.find((s) => s.id === shopId);
      if (shop) openModal(shop);
    });
  });

  // Bind action buttons
  grid.querySelectorAll('.shop-action-btn--save').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const shopId = btn.dataset.shopId;
      toggleShortlist(shopId);
    });
  });

  grid.querySelectorAll('[data-copy-shop-id]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const shop = SHOPS.find((s) => s.id === btn.dataset.copyShopId);
      if (shop) copyShopDetails(shop, btn);
    });
  });

  grid.querySelectorAll('.shop-action-btn--share').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const shopId = btn.dataset.shopId;
      const shop = SHOPS.find((s) => s.id === shopId);
      if (shop) shareShop(shop);
    });
  });

  grid.querySelectorAll('.shop-action-btn--account').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const shopId = btn.dataset.shopId;
      const shop = SHOPS.find((s) => s.id === shopId);
      if (shop) {
        saveShopToAccount(shop).catch(() => {});
      }
    });
  });

  grid.querySelectorAll('[data-claim-shop-id]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const shopId = btn.dataset.claimShopId;
      submitShopClaim(shopId).catch(() => {});
    });
  });

  grid.querySelectorAll('.shop-action-btn--call').forEach((btn) => {
    btn.addEventListener('click', () => {
      const shopId = btn.closest('.shop-card')?.dataset.shopId;
      postShopEvent(shopId, 'call');
      track(EVENTS.SHOP_CALL_CLICK, { shop_id: shopId, surface: 'shops_card' });
    });
  });
  grid.querySelectorAll('.shop-action-btn--website').forEach((btn) => {
    btn.addEventListener('click', () => {
      const shopId = btn.closest('.shop-card')?.dataset.shopId;
      postShopEvent(shopId, 'website');
    });
  });
  grid.querySelectorAll('.shop-action-btn--whatsapp').forEach((btn) => {
    btn.addEventListener('click', () => {
      const shopId = btn.closest('.shop-card')?.dataset.shopId;
      postShopEvent(shopId, 'whatsapp');
      track(EVENTS.SHOP_WHATSAPP_CLICK, { shop_id: shopId, surface: 'shops_card' });
    });
  });
  grid.querySelectorAll('.shop-action-btn--directions').forEach((btn) => {
    btn.addEventListener('click', () => {
      const shopId = btn.closest('.shop-card')?.dataset.shopId;
      postShopEvent(shopId, 'directions');
    });
  });

  // Compare toggle buttons
  grid.querySelectorAll('[data-compare-shop-id]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const shopId = btn.dataset.compareShopId;
      const result = toggleCompare(shopId);
      if (result.maxReached && !result.added) {
        announceShopStatus(t('compareMaxReached'));
      }
      renderCompareBar(document.getElementById('shops-compare-bar'));
      // Update just this button's state
      btn.classList.toggle('is-compared', isInCompareList(shopId));
      const icon = btn.querySelector('.shop-action-icon');
      const label = btn.querySelector('.shop-action-label');
      if (icon) icon.textContent = isInCompareList(shopId) ? '✓' : '⇌';
      if (label) label.textContent = isInCompareList(shopId) ? t('compareRemove') : t('compareAdd');
      btn.setAttribute('aria-pressed', String(isInCompareList(shopId)));
    });
  });

  observeReveal(grid);
}

function renderFeaturedSection() {
  const featuredSection = document.getElementById('shops-featured');
  const featuredGrid = document.getElementById('shops-featured-grid');

  if (!featuredSection || !featuredGrid) {
    console.warn('[shops] Featured section elements not found');
    return;
  }

  const featured = shopsMatchingPrimaryFilters().filter((shop) => shop.featured);

  if (!featured.length) {
    featuredSection.hidden = true;
    return;
  }

  featuredSection.hidden = false;
  featuredGrid.innerHTML = featured
    .map((shop) => {
      const country = countryByCode(shop.countryCode);
      const specialties = (shop.specialties || [])
        .slice(0, 2)
        .map((item) => `<span class="featured-tag">${esc(item)}</span>`)
        .join('');
      return `
      <article class="featured-card" data-shop-id="${esc(shop.id)}">
        <div class="featured-header">
          <h3>${esc(shop.name)}</h3>
          <span class="featured-location">${esc(shop.city)} · ${countryName(country)}</span>
        </div>
        <p class="featured-market">${esc(shop.market)}</p>
        <div class="featured-tags">${specialties}</div>
      </article>
    `;
    })
    .join('');

  // Bind click handlers after rendering
  bindFeaturedCardHandlers();
}

// Separate binding function for featured cards
function bindFeaturedCardHandlers() {
  const featuredGrid = document.getElementById('shops-featured-grid');
  if (!featuredGrid) return;

  featuredGrid.querySelectorAll('.featured-card').forEach((card) => {
    const newCard = card.cloneNode(true);
    card.parentNode.replaceChild(newCard, card);

    newCard.addEventListener('click', () => {
      const shopId = newCard.dataset.shopId;
      const shop = SHOPS.find((s) => s.id === shopId);
      if (shop) openModal(shop);
    });
  });
}

function renderMobileQuickFilters() {
  const container = document.getElementById('shops-mobile-quick-filters');
  if (!container) return;

  const isAtDefaults =
    STATE.listingTab === DEFAULT_LISTING_TAB &&
    STATE.region === 'all' &&
    STATE.country === 'all' &&
    STATE.city === 'all' &&
    STATE.specialty === 'all' &&
    !STATE.verifiedOnly &&
    !STATE.search.trim();

  const quickFilters = [
    {
      key: 'reset',
      label: t('clearAllFiltersShort'),
      type: 'command',
      disabled: isAtDefaults,
    },
    {
      key: 'listing:verified_shop',
      label: t('tabVerified'),
      type: 'tab',
      active: STATE.listingTab === 'verified_shop',
    },
    {
      key: 'listing:market_cluster',
      label: t('tabMarkets'),
      type: 'tab',
      active: STATE.listingTab === 'market_cluster',
    },
    {
      key: 'verified-only',
      label: t('verifiedOnly'),
      type: 'toggle',
      active: STATE.verifiedOnly,
    },
  ];

  const buttons = quickFilters.map((item) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `shops-quick-filter-chip${item.active ? ' is-active' : ''}`;
    button.setAttribute('data-quick-filter', item.key);
    if (item.type === 'toggle') {
      button.setAttribute('aria-pressed', item.active ? 'true' : 'false');
    } else if (item.type === 'tab') {
      button.setAttribute('aria-selected', item.active ? 'true' : 'false');
    } else if (item.type === 'command') {
      button.disabled = Boolean(item.disabled);
      button.setAttribute('aria-disabled', item.disabled ? 'true' : 'false');
    }
    button.textContent = item.label;
    return button;
  });
  container.replaceChildren(...buttons);

  container.querySelectorAll('[data-quick-filter]').forEach((button) => {
    button.addEventListener('click', () => {
      const key = button.getAttribute('data-quick-filter');
      if (key === 'reset') {
        trackShopFilterApply('mobile_quick_reset');
        resetFilters();
        collapseMobileFilters();
        return;
      }
      if (key === 'verified-only') {
        STATE.verifiedOnly = !STATE.verifiedOnly;
        const verifiedBox = document.getElementById('shops-verified-only');
        if (verifiedBox) verifiedBox.checked = STATE.verifiedOnly;
        trackShopFilterApply('mobile_quick_verified');
        render();
        collapseMobileFilters();
        return;
      }
      if (key?.startsWith('listing:')) {
        const listing = key.split(':')[1] || DEFAULT_LISTING_TAB;
        STATE.listingTab = listing;
        trackShopFilterApply('mobile_quick_listing_tab');
        render();
        collapseMobileFilters();
      }
    });
  });
}

function renderFilterPills() {
  const pillsContainer = document.getElementById('shops-filter-pills');
  const pills = [];

  if (STATE.region !== 'all')
    pills.push({ type: 'region', value: STATE.region, label: regionName(STATE.region) });
  if (STATE.country !== 'all') {
    const country = countryByCode(STATE.country);
    if (country) pills.push({ type: 'country', value: STATE.country, label: countryName(country) });
  }
  if (STATE.city !== 'all') pills.push({ type: 'city', value: STATE.city, label: STATE.city });
  if (STATE.specialty !== 'all')
    pills.push({ type: 'specialty', value: STATE.specialty, label: STATE.specialty });
  if (STATE.verifiedOnly)
    pills.push({ type: 'verified', value: '1', label: t('verifiedFilterLabel') });
  if (STATE.search.trim()) {
    const q = STATE.search.trim();
    pills.push({
      type: 'search',
      value: '',
      label: `"${q}"`,
      ariaLabel: t('removeSearchFilter')(q),
    });
  }

  if (!pills.length) {
    pillsContainer.replaceChildren();
    return;
  }

  const clearAllHtml =
    pills.length > 1
      ? `<button class="shops-filter-pill shops-filter-pill--clear-all" data-type="clear-all" type="button" aria-label="${esc(t('clearAllFilters'))}">${esc(t('clearAllFiltersShort'))} ×</button>`
      : '';

  pillsContainer.innerHTML =
    pills
      .map((pill) => {
        const ariaLabel = pill.ariaLabel || t('removeFilter')(pill.label);
        return `
      <button class="shops-filter-pill" data-type="${esc(pill.type)}" data-value="${esc(pill.value)}" type="button" aria-label="${esc(ariaLabel)}">
        ${esc(pill.label)}
        <span class="shops-filter-pill-remove" aria-hidden="true">×</span>
      </button>
    `;
      })
      .join('') + clearAllHtml;

  pillsContainer.querySelectorAll('.shops-filter-pill').forEach((pill) => {
    pill.addEventListener('click', () => {
      const type = pill.dataset.type;
      if (type === 'region') STATE.region = 'all';
      if (type === 'country') STATE.country = 'all';
      if (type === 'city') STATE.city = 'all';
      if (type === 'specialty') STATE.specialty = 'all';
      if (type === 'verified') {
        STATE.verifiedOnly = false;
        const verifiedBox = document.getElementById('shops-verified-only');
        if (verifiedBox) verifiedBox.checked = false;
      }
      if (type === 'search') {
        STATE.search = '';
        document.getElementById('shops-search').value = '';
      }
      if (type === 'clear-all') {
        resetFilters();
        return;
      }
      buildFilters();
      render();
    });
  });
}

function syncUrlToState() {
  const p = new URLSearchParams(location.search);

  if (STATE.region !== 'all') p.set('region', STATE.region);
  else p.delete('region');
  if (STATE.country !== 'all') p.set('country', STATE.country);
  else p.delete('country');
  if (STATE.city !== 'all') p.set('city', STATE.city);
  else p.delete('city');
  if (STATE.specialty !== 'all') p.set('specialty', STATE.specialty);
  else p.delete('specialty');
  if (STATE.verifiedOnly) p.set('verified', '1');
  else p.delete('verified');
  if (STATE.listingTab !== DEFAULT_LISTING_TAB) p.set('listing', STATE.listingTab);
  else p.delete('listing');
  if (STATE.lang === 'ar') p.set('lang', 'ar');
  else p.delete('lang');

  const q = STATE.search.trim();
  if (q) {
    p.set('search', q);
    p.delete('q');
  } else {
    p.delete('search');
    p.delete('q');
  }

  const qs = p.toString();
  history.replaceState(null, '', qs ? `${location.pathname}?${qs}` : location.pathname);
}

function collapseMobileFilters() {
  if (window.innerWidth > MOBILE_FILTER_BREAKPOINT) return;
  const filterToggle = document.getElementById('shops-filter-toggle');
  const filterPanel = document.getElementById('shops-filter-panel');
  if (!filterToggle || !filterPanel) return;
  filterPanel.classList.remove('is-open');
  filterToggle.setAttribute('aria-expanded', 'false');
}

function renderShortlistBar() {
  const bar = document.getElementById('shops-shortlist-bar');
  const countEl = document.getElementById('shops-shortlist-count');
  if (!bar || !countEl) return;

  const count = STATE.shortlist.length;
  if (count === 0) {
    bar.hidden = true;
  } else {
    bar.hidden = false;
    countEl.textContent = t('shortlistCount')(count);
  }
}

function render() {
  syncUrlToState();
  const shops = sortedShops(filterShops());
  const grid = document.getElementById('shops-grid');

  const empty = document.getElementById('shops-empty');
  const count = document.getElementById('shops-count');
  if (count) count.textContent = t('count')(shops.length);
  const controlsCount = document.getElementById('shops-controls-count');
  if (controlsCount) controlsCount.textContent = t('count')(shops.length);
  activeFilterSummary();
  renderMobileQuickFilters();
  renderFilterPills();
  renderFeaturedSection();
  renderShortlistBar();
  document.querySelectorAll('[data-listing-tab]').forEach((button) => {
    const isActive = button.dataset.listingTab === STATE.listingTab;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-selected', String(isActive));
  });
  const sponsoredDisclosure = document.getElementById('shops-sponsored-disclosure');
  if (sponsoredDisclosure) sponsoredDisclosure.hidden = STATE.listingTab !== 'sponsor';

  // Update map markers if map is active
  if (STATE.viewMode === 'map' && STATE.mapInitialized) {
    updateMapMarkers(shops);
  }

  // Update view toggle button states
  const listBtn = document.getElementById('shops-view-list-btn');
  const mapBtn = document.getElementById('shops-view-map-btn');
  if (listBtn) {
    listBtn.classList.toggle('is-active', STATE.viewMode === 'list');
    listBtn.setAttribute('aria-pressed', String(STATE.viewMode === 'list'));
  }
  if (mapBtn) {
    mapBtn.classList.toggle('is-active', STATE.viewMode === 'map');
    mapBtn.setAttribute('aria-pressed', String(STATE.viewMode === 'map'));
  }

  // Show/hide map vs grid
  const mapContainer = document.getElementById('shops-map');
  const mapHint = document.getElementById('shops-map-hint');
  if (mapContainer) mapContainer.hidden = STATE.viewMode !== 'map';
  if (mapHint) mapHint.hidden = STATE.viewMode !== 'map';
  if (grid) grid.hidden = STATE.viewMode === 'map';

  if (!shops.length) {
    if (grid) grid.replaceChildren();
    const emptyTextEl = document.getElementById('shops-empty-text');
    if (emptyTextEl) {
      const query = sanitizeSearchQueryForMessage(STATE.search);
      emptyTextEl.textContent = query ? t('emptyTextQuery')(query) : t('emptyText');
    }
    if (empty) {
      empty.hidden = false;
      empty.classList.add('shops-empty--visible', 'reveal-on-scroll', 'is-in-view');
    }
    return;
  }

  if (empty) empty.hidden = true;
  if (STATE.viewMode === 'list') {
    if (grid) {
      grid.classList.add('shops-grid--updating');
      renderCards(shops);
      window.requestAnimationFrame(() => {
        grid.classList.remove('shops-grid--updating');
      });
    } else {
      renderCards(shops);
    }
  }

  const groupToggle = document.getElementById('shops-group-by-city');
  if (groupToggle) groupToggle.checked = STATE.groupByCity;
  const sortSelect = document.getElementById('shops-sort');
  if (sortSelect) sortSelect.value = STATE.sortBy;
}

function resetFilters() {
  STATE.search = '';
  STATE.listingTab = DEFAULT_LISTING_TAB;
  STATE.region = 'all';
  STATE.country = 'all';
  STATE.city = 'all';
  STATE.specialty = 'all';
  STATE.verifiedOnly = false;
  document.getElementById('shops-search').value = '';
  const verifiedBox = document.getElementById('shops-verified-only');
  if (verifiedBox) verifiedBox.checked = false;
  buildFilters();
  render();
}

function bindEvents() {
  window.addEventListener('beforeunload', () => {
    clearTimeout(_filterTrackTimer);
  });

  document.querySelectorAll('[data-listing-tab]').forEach((button) => {
    button.addEventListener('click', () => {
      STATE.listingTab = button.dataset.listingTab || DEFAULT_LISTING_TAB;
      trackShopFilterApply('listing_tab');
      render();
    });
  });

  document.getElementById('shops-search').addEventListener('input', (event) => {
    STATE.search = event.target.value;
    trackShopFilterApply('search', SEARCH_TRACK_DEBOUNCE_MS);
    render();
  });

  document.getElementById('shops-region-filter').addEventListener('change', (event) => {
    STATE.region = event.target.value;
    STATE.country = 'all';
    STATE.city = 'all';
    STATE.specialty = 'all';
    buildFilters();
    trackShopFilterApply('region');
    render();
    collapseMobileFilters();
  });

  document.getElementById('shops-country-filter').addEventListener('change', (event) => {
    STATE.country = event.target.value;
    STATE.city = 'all';
    STATE.specialty = 'all';
    buildFilters();
    trackShopFilterApply('country');
    render();
    collapseMobileFilters();
  });

  document.getElementById('shops-city-filter').addEventListener('change', (event) => {
    STATE.city = event.target.value;
    STATE.specialty = 'all';
    buildFilters();
    trackShopFilterApply('city');
    render();
    collapseMobileFilters();
  });

  document.getElementById('shops-specialty-filter').addEventListener('change', (event) => {
    STATE.specialty = event.target.value;
    trackShopFilterApply('specialty');
    render();
    collapseMobileFilters();
  });

  document.getElementById('shops-verified-only').addEventListener('change', (event) => {
    STATE.verifiedOnly = event.target.checked;
    trackShopFilterApply('verified_only');
    render();
    collapseMobileFilters();
  });

  document.getElementById('shops-sort')?.addEventListener('change', (event) => {
    STATE.sortBy = event.target.value || 'relevance';
    trackShopFilterApply('sort');
    render();
  });

  document.getElementById('shops-group-by-city')?.addEventListener('change', (event) => {
    STATE.groupByCity = event.target.checked;
    trackShopFilterApply('group_city');
    render();
  });

  document.getElementById('shops-clear-filters').addEventListener('click', () => {
    trackShopFilterApply('clear_filters');
    resetFilters();
  });
  document.getElementById('shops-controls-clear').addEventListener('click', () => {
    trackShopFilterApply('clear_filters');
    resetFilters();
  });

  // Modal events
  const modal = document.getElementById('shops-modal');
  if (!modal) return;
  modal.addEventListener('click', (e) => {
    if (
      e.target.closest('.modal-close-cta') ||
      e.target.closest('.shops-modal-close') ||
      e.target.classList.contains('shops-modal-overlay')
    ) {
      closeModal();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.hidden) closeModal();
  });
}

function updateLanguage() {
  applyStaticText();
  buildFilters();
  updateHeaderStats();
  populatePopularChips();
  setCompareLang(STATE.lang);
  // Update view toggle labels
  const listLabel = document.getElementById('shops-view-list-label');
  const mapLabel = document.getElementById('shops-view-map-label');
  if (listLabel) listLabel.textContent = t('viewList');
  if (mapLabel) mapLabel.textContent = t('viewMap');
  render();
}

function init() {
  // Validate data and DOM prerequisites - FAIL LOUDLY
  if (!SHOPS || !Array.isArray(SHOPS) || SHOPS.length === 0) {
    const errorMsg =
      '[shops] CRITICAL: SHOPS data is empty, not an array, or not loaded. Check data/shops.js module export.';
    console.error(errorMsg);
    console.error('[shops] SHOPS value:', SHOPS);
    document.body.innerHTML = `
      <div style="padding:2rem;background:#fee;color:#900;font-family:system-ui;">
        <h1 style="color:#c00;">Shops Page Data Error</h1>
        <p><strong>Error:</strong> Shop data failed to load.</p>
        <p><code>SHOPS = ${JSON.stringify(SHOPS)?.slice(0, 200)}${JSON.stringify(SHOPS)?.length > 200 ? '...' : ''}</code></p>
        <p>Check browser console for details. Verify data/shops.js exports SHOPS array correctly.</p>
      </div>
    `;
    throw new Error(errorMsg);
  }

  // Validate critical DOM elements exist - FAIL LOUDLY if missing
  const requiredElements = [
    'shops-grid',
    'shops-empty',
    'shops-featured',
    'shops-featured-grid',
    'shops-filter-pills',
    'shops-region-filter',
    'shops-country-filter',
    'shops-city-filter',
    'shops-specialty-filter',
    'shops-search',
    'shops-count',
  ];
  const missingElements = [];
  for (const id of requiredElements) {
    if (!document.getElementById(id)) {
      missingElements.push(id);
      console.error(`[shops] Required element #${id} not found in DOM`);
    }
  }
  if (missingElements.length > 0) {
    const errorMsg = `[shops] CRITICAL: Missing required DOM elements: ${missingElements.join(', ')}. Check shops.html structure.`;
    console.error(errorMsg);
    document.body.innerHTML = `
      <div style="padding:2rem;background:#fee;color:#900;font-family:system-ui;">
        <h1 style="color:#c00;">Shops Page DOM Error</h1>
        <p><strong>Error:</strong> Required HTML elements are missing.</p>
        <p><strong>Missing IDs:</strong> ${missingElements.join(', ')}</p>
        <p>Check shops.html for correct element IDs.</p>
      </div>
    `;
    throw new Error(errorMsg);
  }

  try {
    const prefs = JSON.parse(localStorage.getItem('user_prefs') || '{}');
    if (prefs.lang === 'ar' || prefs.lang === 'en') STATE.lang = prefs.lang;
  } catch {}

  // Apply URL query params to initial state (e.g. ?country=AE&region=gcc)
  const _p = new URLSearchParams(location.search);
  const _pRegion = (_p.get('region') || '').toLowerCase();
  const _pCountry = (_p.get('country') || '').toUpperCase();
  const _pCity = _p.get('city') || '';
  const _pSpec = _p.get('specialty') || '';
  const _pSearch = _p.get('search') || _p.get('q') || '';
  const _pVerified = (_p.get('verified') || '') === '1';
  const _pListing = (_p.get('listing') || '').toLowerCase();
  const _pLang = (_p.get('lang') || '').toLowerCase();

  if (_pRegion && Object.prototype.hasOwnProperty.call(REGIONS, _pRegion)) STATE.region = _pRegion;
  if (_pCountry) STATE.country = _pCountry; // buildFilters() resets to 'all' if invalid
  if (_pCity) STATE.city = _pCity;
  if (_pSpec) STATE.specialty = _pSpec;
  if (_pSearch) STATE.search = _pSearch;
  if (_pVerified) STATE.verifiedOnly = true;
  if (['verified_shop', 'market_cluster', 'sponsor'].includes(_pListing)) {
    STATE.listingTab = _pListing;
  }
  if (_pLang === 'ar' || _pLang === 'en') STATE.lang = _pLang;

  const shell = mountSharedShell({ lang: STATE.lang, depth: 0, withSpotBar: true });
  initPageEnter('#main-content');
  const navResult = shell.navCtrl;
  injectBreadcrumbs('shops');
  renderAdSlot('ad-top', 'leaderboard');

  // Populate ticker from cache so it never shows all-dashes
  const cachedGold = cache.getFallbackGoldPrice();
  const _cachedFX = cache.getFallbackFXRates();
  if (cachedGold?.price) {
    const spot = cachedGold.price;
    const aedRate = CONSTANTS.AED_PEG;
    const purity = (k) => KARATS.find((x) => x.code === k)?.purity ?? 1;
    const aedGram = (k) => (spot / CONSTANTS.TROY_OZ_GRAMS) * purity(k) * aedRate;
    updateTicker({
      xauUsd: spot,
      uae24k: aedGram('24'),
      uae22k: aedGram('22'),
      uae21k: aedGram('21'),
      uae18k: aedGram('18'),
      updatedAt: cachedGold.updatedAt || null,
      // Cached fallback data is, by definition, not a live response.
      hasLiveFailure: true,
    });
  }

  navResult.getLangToggleButtons().forEach((button) => {
    button.addEventListener('click', () => {
      STATE.lang = STATE.lang === 'en' ? 'ar' : 'en';
      cache.savePreference('lang', STATE.lang);
      shell.updateLang(STATE.lang);
      updateLanguage();
    });
  });

  bindEvents();
  // Sync search input DOM value if set from URL param
  if (STATE.search) {
    const el = document.getElementById('shops-search');
    if (el) el.value = STATE.search;
  }
  const verifiedBox = document.getElementById('shops-verified-only');
  if (verifiedBox) verifiedBox.checked = STATE.verifiedOnly;

  updateLanguage();
  track(EVENTS.PRICE_VIEW, {
    path: location.pathname,
    locale: STATE.lang,
    surface: 'shops',
  });

  // Handle initial shop modal from URL param
  const initialShopId = _p.get('shop');
  if (initialShopId) {
    const initialShop = SHOPS.find((s) => s.id === initialShopId);
    if (initialShop) {
      openModal(initialShop);
    } else {
      console.warn('[shops] Shop ID from URL not found:', initialShopId);
      closeModal({ clearShopParam: true });
    }
  } else {
    closeModal({ clearShopParam: false });
  }

  // Mobile filter toggle — auto-open on desktop
  const filterToggle = document.getElementById('shops-filter-toggle');
  const filterPanel = document.getElementById('shops-filter-panel');
  if (filterToggle && filterPanel) {
    // On desktop (>640px) start expanded; on mobile keep collapsed
    if (window.innerWidth > MOBILE_FILTER_BREAKPOINT) {
      filterPanel.classList.add('is-open');
      filterToggle.setAttribute('aria-expanded', 'true');
    }
    filterToggle.addEventListener('click', () => {
      const open = filterPanel.classList.toggle('is-open');
      filterToggle.setAttribute('aria-expanded', String(open));
    });
  }

  // Shortlist bar clear button
  const shortlistClear = document.getElementById('shops-shortlist-clear');
  if (shortlistClear) {
    shortlistClear.addEventListener('click', () => {
      STATE.shortlist = [];
      try {
        localStorage.setItem('shops_shortlist', '[]');
      } catch {}
      render();
    });
  }

  // ── Map/List view toggle ──────────────────────────────────────────────────
  const listBtn = document.getElementById('shops-view-list-btn');
  const mapBtn = document.getElementById('shops-view-map-btn');
  if (listBtn && mapBtn) {
    listBtn.addEventListener('click', () => {
      STATE.viewMode = 'list';
      render();
    });
    mapBtn.addEventListener('click', async () => {
      STATE.viewMode = 'map';
      if (!STATE.mapInitialized) {
        const ok = await initShopsMap('shops-map', {
          onMarkerClick: (shop) => openModal(shop),
        });
        STATE.mapInitialized = ok;
      }
      render();
      // Leaflet needs a size invalidation after container becomes visible
      window.requestAnimationFrame(() => invalidateMapSize());
    });
  }

  // ── Compare module initialization ─────────────────────────────────────────
  initCompare({
    lang: STATE.lang,
    shops: SHOPS,
    countryNameFn: (code) => {
      const country = countryByCode(code);
      return country ? countryName(country) : code;
    },
    onCompareChange: () => {
      renderCompareBar(document.getElementById('shops-compare-bar'));
    },
  });
}

init();

// ── Supabase live data upgrade ──────────────────────────────────────────────
// After the page renders with hardcoded data, try to fetch live data from
// Supabase. If successful, replace SHOPS and re-render so users see the
// most up-to-date directory without any visible delay.
(async function upgradeToLiveData() {
  const grid = document.getElementById('shops-grid');
  const loading = document.getElementById('shops-loading');
  const error = document.getElementById('shops-error');
  if (loading) loading.hidden = false;
  if (error) error.hidden = true;
  if (grid) grid.classList.add('shops-grid--upgrading');
  try {
    const remote = await fetchSupabaseShops();
    if (remote && Array.isArray(remote) && remote.length > 0) {
      SHOPS = remote;
      setCompareShops(SHOPS);
      buildFilters();
      updateHeaderStats();
      populatePopularChips();
      render();
    }
  } catch (err) {
    console.warn('[shops] Could not fetch Supabase data; using fallback:', err.message);
    if (error) error.hidden = false;
  } finally {
    if (loading) loading.hidden = true;
    if (grid) grid.classList.remove('shops-grid--upgrading');
  }
})();

// ---------------------------------------------------------------------------
// Near Me — Geolocation + OpenStreetMap Nominatim reverse geocode
// ---------------------------------------------------------------------------
/**
 * Uses the browser Geolocation API to find the user's position, then builds
 * a link to the nearest matching market pages using OpenStreetMap.
 * No backend or API key required — all client-side.
 *
 * Known gold market locations are matched against the user's country/city.
 * Falls back to an OpenStreetMap link showing gold shops near the coordinates.
 */
(function initNearMe() {
  const btn = document.getElementById('shops-nearme-btn');
  const status = document.getElementById('shops-nearme-status');
  const results = document.getElementById('shops-nearme-results');

  if (!btn) return;

  // Known gold market areas keyed by ISO country code
  const KNOWN_MARKETS = {
    AE: [
      {
        city: 'Dubai',
        name: 'Dubai Gold Souk',
        page: '/countries/uae/markets/dubai-gold-souk.html',
        lat: 25.2881,
        lng: 55.3021,
      },
      {
        city: 'Dubai',
        name: 'Deira Gold Market',
        page: '/shops.html?country=AE&city=Dubai',
        lat: 25.2721,
        lng: 55.311,
      },
    ],
    EG: [
      {
        city: 'Cairo',
        name: 'Khan el-Khalili Gold Market',
        page: '/countries/egypt/markets/khan-el-khalili-cairo.html',
        lat: 30.0478,
        lng: 31.2625,
      },
    ],
    SA: [
      {
        city: 'Riyadh',
        name: 'Riyadh Gold Market',
        page: '/shops.html?country=SA&city=Riyadh',
        lat: 24.697,
        lng: 46.7206,
      },
      {
        city: 'Jeddah',
        name: 'Jeddah Gold Souk',
        page: '/shops.html?country=SA&city=Jeddah',
        lat: 21.4858,
        lng: 39.1925,
      },
    ],
    KW: [
      {
        city: 'Kuwait City',
        name: 'Kuwait Gold Souk',
        page: '/shops.html?country=KW',
        lat: 29.3697,
        lng: 47.9783,
      },
    ],
    QA: [
      {
        city: 'Doha',
        name: 'Doha Gold Souk',
        page: '/shops.html?country=QA',
        lat: 25.2854,
        lng: 51.531,
      },
    ],
    BH: [
      {
        city: 'Manama',
        name: 'Manama Gold Souk',
        page: '/shops.html?country=BH',
        lat: 26.2175,
        lng: 50.5905,
      },
    ],
    OM: [
      {
        city: 'Muscat',
        name: 'Muscat Gold Souk (Muttrah)',
        page: '/shops.html?country=OM',
        lat: 23.6166,
        lng: 58.5922,
      },
    ],
    JO: [
      {
        city: 'Amman',
        name: 'Amman Gold Market',
        page: '/shops.html?country=JO',
        lat: 31.9519,
        lng: 35.93,
      },
    ],
  };

  // Haversine distance in km
  function haversine(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dL = ((lat2 - lat1) * Math.PI) / 180;
    const dN = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dL / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dN / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function setStatus(msg, type = 'info') {
    status.hidden = false;
    status.className = `shops-nearme-status shops-nearme-status--${type}`;
    status.textContent = msg;
  }

  function showFallback(lat, lng) {
    const osmUrl = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=14/${lat}/${lng}`;
    const googleUrl = `https://www.google.com/maps/search/gold+shop/@${lat},${lng},14z`;
    results.hidden = false;
    results.innerHTML = `
      <div class="nearme-fallback">
        <p>We couldn't identify a specific market in our directory for your location, but you can search for nearby gold shops on the map.</p>
        <div class="nearme-map-links">
          <a href="${osmUrl}" target="_blank" rel="noopener noreferrer" class="nearme-map-btn">
            🗺️ View on OpenStreetMap
          </a>
          <a href="${googleUrl}" target="_blank" rel="noopener noreferrer" class="nearme-map-btn">
            📍 Search on Google Maps
          </a>
        </div>
      </div>
    `;
  }

  async function findNearestMarkets(lat, lng) {
    // Reverse geocode via Nominatim to get country code
    let _countryCode = null;
    try {
      const r = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
        { headers: { 'Accept-Language': 'en' } }
      );
      if (r.ok) {
        const data = await r.json();
        _countryCode = (data.address?.country_code || '').toUpperCase();
      }
    } catch {
      // silently continue without country match
    }

    // Compute distance to all known markets
    const allMarkets = Object.values(KNOWN_MARKETS).flat();
    const withDist = allMarkets
      .map((m) => ({
        ...m,
        distKm: haversine(lat, lng, m.lat, m.lng),
      }))
      .sort((a, b) => a.distKm - b.distKm);

    // Show top 3 closest markets within 1000 km, or just top 3 globally
    const nearby = withDist.slice(0, 3);

    if (!nearby.length) {
      showFallback(lat, lng);
      return;
    }

    results.hidden = false;
    results.innerHTML = `
      <p class="nearme-intro">Closest gold markets in our directory:</p>
      <ul class="nearme-list">
        ${nearby
          .map(
            (m) => `
          <li class="nearme-item">
            <a href="${m.page}" class="nearme-link">
              <span class="nearme-name">${m.name}</span>
              <span class="nearme-dist">${m.distKm < 1 ? '<1 km' : Math.round(m.distKm).toLocaleString() + ' km'} away</span>
            </a>
          </li>
        `
          )
          .join('')}
      </ul>
      <div class="nearme-map-links" style="margin-top:0.75rem">
        <a href="https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=13/${lat}/${lng}" target="_blank" rel="noopener noreferrer" class="nearme-map-btn">
          🗺️ Open my location on map
        </a>
      </div>
    `;
  }

  btn.addEventListener('click', () => {
    if (!navigator.geolocation) {
      setStatus('Your browser does not support Geolocation. Try a modern browser.', 'error');
      return;
    }

    btn.disabled = true;
    setStatus('Getting your location…', 'info');

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setStatus(
          `Location found (${lat.toFixed(4)}, ${lng.toFixed(4)}). Finding nearby markets…`,
          'info'
        );
        try {
          await findNearestMarkets(lat, lng);
          status.hidden = true;
        } catch (_e) {
          setStatus('Could not load nearby markets. Please try again.', 'error');
          showFallback(lat, lng);
        }
        btn.disabled = false;
      },
      (err) => {
        const msgs = {
          1: 'Location access was denied. Please allow location in your browser settings.',
          2: 'Could not determine your position. Check your device GPS or network.',
          3: 'Location request timed out. Please try again.',
        };
        setStatus(msgs[err.code] || 'Location error. Please try again.', 'error');
        btn.disabled = false;
      },
      { timeout: 10000, maximumAge: 60000 }
    );
  });
})();
