/**
 * seo/metadataGenerator.js
 * Generates SEO metadata for every page type.
 * Used at build time (page generator) and runtime (JSON-LD price updates).
 */

const SITE_NAME = 'Gold Ticker Live';
const SITE_URL = 'https://goldtickerlive.com';
const OG_IMAGE = `${SITE_URL}/assets/og-image.png`;

/**
 * @typedef MetadataResult
 * @property {string} title
 * @property {string} description
 * @property {string} canonical
 * @property {Array}  hreflang
 * @property {object} og
 * @property {object} jsonLd
 */

/**
 * Generate metadata for a given page type and parameters.
 * @param {string} routeType  'home' | 'country' | 'city-prices' | 'city-shops' | 'city-karat' | 'calculator' | 'history' | 'order' | 'tracker' | 'shops'
 * @param {object} params     { country, countryObj, city, cityObj, karat, karatObj, currentPrice }
 * @returns {MetadataResult}
 */
export function generateMetadata(routeType, params = {}) {
  const { country, countryObj, city, cityObj, karat, karatObj } = params;

  let title, description, canonical, breadcrumbs;

  switch (routeType) {
    case 'home':
      title = `Live Gold Prices Today — UAE, GCC & Arab World | ${SITE_NAME}`;
      description =
        'Track live gold spot prices in 24 countries across GCC, Levant and Africa. 24K, 22K, 21K, 18K per gram. Auto-refresh with a visible freshness label. Free.';
      canonical = `${SITE_URL}/`;
      breadcrumbs = [{ name: 'Home', url: canonical }];
      break;

    case 'country':
      title = `Gold Price in ${countryObj?.nameEn || country} Today — 24K, 22K, 21K, 18K | ${SITE_NAME}`;
      description = `Live ${countryObj?.nameEn || country} gold prices in ${countryObj?.currency || 'local currency'}. 24K, 22K, 21K and 18K per gram and ounce. Auto-refresh with a visible freshness label.`;
      canonical = `${SITE_URL}/${country}/gold-price/`;
      breadcrumbs = [
        { name: 'Home', url: `${SITE_URL}/` },
        { name: `${countryObj?.nameEn} Gold Price`, url: canonical },
      ];
      break;

    case 'city-prices':
      title = `Gold Rate in ${cityObj?.nameEn || city}, ${countryObj?.nameEn || ''} Today | ${countryObj?.currency} per Gram | ${SITE_NAME}`;
      description = `Live 24K, 22K, 21K and 18K gold rates in ${cityObj?.nameEn || city}, ${countryObj?.nameEn || ''}. Compare ${countryObj?.currency} reference rates per gram. Auto-refresh with a visible freshness label.`;
      canonical = `${SITE_URL}/${country}/${city}/gold-rate/`;
      breadcrumbs = [
        { name: 'Home', url: `${SITE_URL}/` },
        { name: `${countryObj?.nameEn} Gold`, url: `${SITE_URL}/${country}/gold-price/` },
        { name: `${cityObj?.nameEn} Gold rate`, url: canonical },
      ];
      break;

    case 'city-shops':
      title = `Gold Shops in ${cityObj?.nameEn || city} — Dealers & Jewellers | ${SITE_NAME}`;
      description = `Directory of gold shops and dealers in ${cityObj?.nameEn || city}, ${countryObj?.nameEn || ''}. Find verified listings with contact information.`;
      canonical = `${SITE_URL}/${country}/${city}/gold-shops/`;
      breadcrumbs = [
        { name: 'Home', url: `${SITE_URL}/` },
        { name: `${countryObj?.nameEn} Gold`, url: `${SITE_URL}/${country}/gold-price/` },
        { name: `Gold Shops in ${cityObj?.nameEn}`, url: canonical },
      ];
      break;

    case 'city-karat':
      title = `${karatObj?.code || karat}K Gold Price in ${cityObj?.nameEn || city} Today — ${countryObj?.currency} per Gram | ${SITE_NAME}`;
      description = `Live ${karatObj?.code || karat} karat gold price in ${cityObj?.nameEn || city}, ${countryObj?.nameEn || ''}. ${countryObj?.currency} per gram, per ounce, per tola. Auto-refresh with a visible freshness label.`;
      canonical = `${SITE_URL}/${country}/${city}/gold-rate/${karat}/`;
      breadcrumbs = [
        { name: 'Home', url: `${SITE_URL}/` },
        { name: `${countryObj?.nameEn} Gold`, url: `${SITE_URL}/${country}/gold-price/` },
        { name: `${cityObj?.nameEn} Gold rate`, url: `${SITE_URL}/${country}/${city}/gold-rate/` },
        { name: `${karatObj?.code}K Gold`, url: canonical },
      ];
      break;

    case 'calculator':
      title = `Gold Price Calculator — Grams, Ounces, Tolas | ${SITE_NAME}`;
      description =
        'Calculate gold value by weight, karat and currency. Live gold prices. 24K, 22K, 21K, 18K. Converts grams, ounces, tolas for UAE and 20+ countries.';
      canonical = `${SITE_URL}/calculator.html`;
      breadcrumbs = [
        { name: 'Home', url: `${SITE_URL}/` },
        { name: 'Calculator', url: canonical },
      ];
      break;

    case 'history':
      title = `Gold Price History & Charts — 30 Days to 5 Years | ${SITE_NAME}`;
      description =
        'Gold price history charts from 1 month to 5 years. See ATH, ATL, YTD and 1-year returns. Compare karat performance. Download CSV data.';
      canonical = `${SITE_URL}/gold-price-history/`;
      breadcrumbs = [
        { name: 'Home', url: `${SITE_URL}/` },
        { name: 'Gold Price History', url: canonical },
      ];
      break;

    case 'order':
      title = `Order Gold Online — 1g to 100g Bars & Coins | ${SITE_NAME}`;
      description =
        'Buy gold bars and coins online. 1g to 100g, 24K to 18K. Live prices with a visible freshness label. Order via WhatsApp. UAE 5% VAT included.';
      canonical = `${SITE_URL}/order-gold/`;
      breadcrumbs = [
        { name: 'Home', url: `${SITE_URL}/` },
        { name: 'Order Gold', url: canonical },
      ];
      break;

    case 'tracker':
      title = `Gold Command Center — Live Tracker | UAE, GCC | ${SITE_NAME}`;
      description =
        'Live gold price tracker for Gold Ticker Live: 24+ countries, 7 karat grades (14K–24K), chart, alerts, and exports. Spot source updates hourly; page re-polls ~90s.';
      canonical = `${SITE_URL}/tracker.html`;
      breadcrumbs = [
        { name: 'Home', url: `${SITE_URL}/` },
        { name: 'Live Tracker', url: canonical },
      ];
      break;

    case 'shops':
      title = `Gold Shops Directory — GCC & Arab World | ${SITE_NAME}`;
      description =
        'Directory of gold shops, dealers and markets across UAE, Saudi Arabia, Egypt and 15+ countries. Bilingual listings with contact details.';
      canonical = `${SITE_URL}/shops.html`;
      breadcrumbs = [
        { name: 'Home', url: `${SITE_URL}/` },
        { name: 'Gold Shops', url: canonical },
      ];
      break;

    default:
      title = `${SITE_NAME} — Live Gold Prices`;
      description = 'Live gold prices for UAE, GCC and Arab World.';
      canonical = `${SITE_URL}/`;
      breadcrumbs = [{ name: 'Home', url: `${SITE_URL}/` }];
  }

  return {
    title,
    description,
    canonical,
    hreflang: [
      { hreflang: 'x-default', href: canonical },
      { hreflang: 'en', href: canonical },
      { hreflang: 'ar', href: canonical + '?lang=ar' },
    ],
    og: {
      title,
      description,
      url: canonical,
      image: OG_IMAGE,
      type: 'website',
    },
    jsonLd: buildJsonLd(routeType, { title, description, canonical, breadcrumbs, params }),
  };
}

function buildJsonLd(routeType, { title, description, canonical, breadcrumbs }) {
  const crumbList = {
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbs.map((b, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: b.name,
      item: b.url,
    })),
  };

  const baseWebPage = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': canonical,
    name: title,
    description: description,
    url: canonical,
    inLanguage: 'en',
    breadcrumb: crumbList,
  };

  if (routeType === 'calculator') {
    return {
      ...baseWebPage,
      '@type': 'SoftwareApplication',
      applicationCategory: 'FinanceApplication',
      operatingSystem: 'Web',
    };
  }

  if (routeType === 'history') {
    return {
      ...baseWebPage,
      about: {
        '@type': 'Dataset',
        name: 'Historical Gold Price Data',
        description: 'Monthly and daily XAU/USD spot price data 2019–present',
      },
    };
  }

  if (routeType === 'order') {
    return {
      ...baseWebPage,
      mainEntity: {
        '@type': 'Offer',
        name: 'Gold Bars and Coins',
        description: 'Physical gold bars and coins, 1g to 100g, 24K to 18K',
        priceCurrency: 'AED',
        availability: 'https://schema.org/InStock',
        seller: {
          '@type': 'Organization',
          name: 'Gold Ticker Live',
          url: 'https://goldtickerlive.com/',
        },
      },
    };
  }

  return baseWebPage;
}
