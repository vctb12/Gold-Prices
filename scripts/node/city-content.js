'use strict';

/**
 * scripts/node/city-content.js
 *
 * Curated metadata for the city gold-price/gold-shops/per-karat pages that
 * `generate-city-pages.js` materialises. Each entry is a real city with a
 * genuine, well-known gold market so the generated FAQ content stays accurate
 * and locally relevant rather than thin boilerplate.
 *
 * `country` / `city` slugs MUST match `src/config/countries.js`. The generator
 * only writes pages for cities that exist in that config, so this file and the
 * country config are kept in sync by `tests/generate-city-pages.test.js`.
 *
 * Fields:
 *   country     country slug (matches countries.js)
 *   city        city slug (matches countries.js)
 *   marketEn    main gold market / souk, English (optional)
 *   marketAr    main gold market / souk, Arabic (optional)
 *   areaEn      district / neighbourhood the market sits in (optional)
 *   noteEn      one accurate, locally relevant sentence about the city's
 *               gold trade (optional, used in the city FAQ)
 */

const NEW_CITIES = [
  // ── UAE ────────────────────────────────────────────────────────────────
  {
    country: 'uae',
    city: 'al-ain',
    nameEn: 'Al Ain',
    nameAr: 'العين',
    marketEn: 'Al Ain Gold Souk',
    marketAr: 'سوق الذهب في العين',
    areaEn: 'the Al Ain Souk district',
    noteEn:
      'Al Ain shoppers buy the same AED-priced gold as Dubai because the Dirham is pegged to the US Dollar; making charges are typically lower than in the bigger tourist souks.',
  },
  // ── Saudi Arabia ─────────────────────────────────────────────────────────
  {
    country: 'saudi-arabia',
    city: 'khobar',
    nameEn: 'Al Khobar',
    nameAr: 'الخبر',
    marketEn: 'Prince Bandar Gold Souk',
    marketAr: 'سوق الذهب بشارع الأمير بندر',
    areaEn: 'the Prince Bandar Street area',
    noteEn:
      'Al Khobar and the wider Eastern Province price 21K and 22K jewellery off the same SAR spot rate shown here, with VAT and a making charge added at the till.',
  },
  {
    country: 'saudi-arabia',
    city: 'taif',
    nameEn: 'Taif',
    nameAr: 'الطائف',
    marketEn: 'Taif Central Gold Market',
    marketAr: 'سوق الذهب المركزي بالطائف',
    noteEn:
      'Taif jewellers follow the national Saudi gold rate; 21K is the most common karat for everyday jewellery in the region.',
  },
  {
    country: 'saudi-arabia',
    city: 'tabuk',
    nameEn: 'Tabuk',
    nameAr: 'تبوك',
    marketEn: 'Tabuk Gold Souk',
    marketAr: 'سوق الذهب بتبوك',
    noteEn:
      'Gold in Tabuk tracks the same SAR-denominated spot price as Riyadh and Jeddah, refreshed continuously on this page.',
  },
  {
    country: 'saudi-arabia',
    city: 'buraidah',
    nameEn: 'Buraidah',
    nameAr: 'بريدة',
    marketEn: 'Buraidah Gold Market',
    marketAr: 'سوق الذهب ببريدة',
    areaEn: 'the Qassim region',
    noteEn:
      'Buraidah, the commercial heart of the Qassim region, prices its 21K and 24K gold off the same Saudi spot rate used across the Kingdom.',
  },
  // ── Kuwait ────────────────────────────────────────────────────────────────
  {
    country: 'kuwait',
    city: 'jahra',
    nameEn: 'Al Jahra',
    nameAr: 'الجهراء',
    marketEn: 'Jahra gold shops',
    marketAr: 'محلات الذهب بالجهراء',
    noteEn:
      'Jahra jewellers quote the same KWD gold rate as the famous Mubarakiya souk in Kuwait City, with the Kuwaiti Dinar shown here to three decimal places.',
  },
  // ── Qatar ─────────────────────────────────────────────────────────────────
  {
    country: 'qatar',
    city: 'al-khor',
    nameEn: 'Al Khor',
    nameAr: 'الخور',
    marketEn: 'Al Khor gold shops',
    marketAr: 'محلات الذهب بالخور',
    noteEn:
      'Al Khor follows the same QAR spot rate as the Gold Souq in Doha; the Qatari Riyal is pegged to the US Dollar at 3.64.',
  },
  // ── Oman ───────────────────────────────────────────────────────────────────
  {
    country: 'oman',
    city: 'nizwa',
    nameEn: 'Nizwa',
    nameAr: 'نزوى',
    marketEn: 'Nizwa Souq',
    marketAr: 'سوق نزوى',
    areaEn: 'the historic Nizwa Souq',
    noteEn:
      'The historic Nizwa Souq is famous for traditional Omani silver and gold; prices follow the national OMR rate quoted to three decimals.',
  },
  {
    country: 'oman',
    city: 'sur',
    nameEn: 'Sur',
    nameAr: 'صور',
    marketEn: 'Sur gold shops',
    marketAr: 'محلات الذهب بصور',
    noteEn:
      'Sur jewellers track the same Omani Rial spot rate shown on this page, with 22K and 21K the most requested karats.',
  },
  // ── Jordan ─────────────────────────────────────────────────────────────────
  {
    country: 'jordan',
    city: 'aqaba',
    nameEn: 'Aqaba',
    nameAr: 'العقبة',
    marketEn: 'Aqaba Gold Souk',
    marketAr: 'سوق الذهب بالعقبة',
    noteEn:
      'As a duty-reduced special economic zone, Aqaba can offer competitive premiums, but the underlying JOD gold rate matches the rest of Jordan.',
  },
  // ── Egypt ──────────────────────────────────────────────────────────────────
  {
    country: 'egypt',
    city: 'luxor',
    nameEn: 'Luxor',
    nameAr: 'الأقصر',
    marketEn: 'Luxor gold shops',
    marketAr: 'محلات الذهب بالأقصر',
    noteEn:
      'Luxor jewellers price gold in Egyptian Pounds off the same spot rate as Cairo; the local rate moves with both global gold and the EGP exchange rate.',
  },
  {
    country: 'egypt',
    city: 'aswan',
    nameEn: 'Aswan',
    nameAr: 'أسوان',
    marketEn: 'Aswan gold shops',
    marketAr: 'محلات الذهب بأسوان',
    noteEn:
      '21K is the dominant jewellery karat in Aswan, as across Egypt, and is priced from the live EGP gold rate shown here.',
  },
  {
    country: 'egypt',
    city: 'port-said',
    nameEn: 'Port Said',
    nameAr: 'بورسعيد',
    marketEn: 'Port Said gold market',
    marketAr: 'سوق الذهب ببورسعيد',
    noteEn:
      'Port Said, long known as a duty-free trading port, follows the national Egyptian gold rate plus the local making charge (مصنعية).',
  },
  {
    country: 'egypt',
    city: 'mansoura',
    nameEn: 'Mansoura',
    nameAr: 'المنصورة',
    marketEn: 'Mansoura gold shops',
    marketAr: 'محلات الذهب بالمنصورة',
    noteEn:
      'Jewellers in Mansoura quote the same EGP gold rate as Cairo and Alexandria, updated continuously on this page.',
  },
  // ── Turkey ────────────────────────────────────────────────────────────────
  {
    country: 'turkey',
    city: 'bursa',
    nameEn: 'Bursa',
    nameAr: 'بورصة',
    marketEn: 'Bursa Grand Bazaar (Kapalı Çarşı)',
    marketAr: 'البازار الكبير ببورصة',
    noteEn:
      'Bursa is one of Turkey\u2019s historic jewellery centres; gram altın is priced from the global spot rate converted into Turkish Lira.',
  },
  {
    country: 'turkey',
    city: 'antalya',
    nameEn: 'Antalya',
    nameAr: 'أنطاليا',
    marketEn: 'Antalya gold shops',
    marketAr: 'محلات الذهب بأنطاليا',
    noteEn:
      'Antalya jewellers quote gram and çeyrek (quarter) gold in Turkish Lira, tracking the same global spot rate shown here.',
  },
  {
    country: 'turkey',
    city: 'gaziantep',
    nameEn: 'Gaziantep',
    nameAr: 'غازي عنتاب',
    marketEn: 'Gaziantep Coppersmiths and Gold Bazaar',
    marketAr: 'سوق الذهب بغازي عنتاب',
    noteEn:
      'Gaziantep\u2019s historic bazaar trades gram gold priced from the international spot rate in Turkish Lira.',
  },
  // ── Pakistan ──────────────────────────────────────────────────────────────
  {
    country: 'pakistan',
    city: 'rawalpindi',
    nameEn: 'Rawalpindi',
    nameAr: 'روالبندي',
    marketEn: 'Sarafa Bazaar, Raja Bazaar',
    marketAr: 'سوق الصاغة براجا بازار',
    noteEn:
      'Rawalpindi\u2019s Sarafa Bazaar prices 24K and 22K gold per tola and per gram in Pakistani Rupees, derived from the global spot rate.',
  },
  {
    country: 'pakistan',
    city: 'faisalabad',
    nameEn: 'Faisalabad',
    nameAr: 'فيصل آباد',
    marketEn: 'Faisalabad Sarafa Bazaar',
    marketAr: 'سوق الصاغة بفيصل آباد',
    noteEn:
      'Faisalabad jewellers quote gold per tola in PKR, following the national rate set off the international spot price.',
  },
  {
    country: 'pakistan',
    city: 'peshawar',
    nameEn: 'Peshawar',
    nameAr: 'بيشاور',
    marketEn: 'Saddar Bazaar gold market',
    marketAr: 'سوق الذهب بصدر',
    noteEn:
      'Peshawar\u2019s Saddar gold market trades 24K and 22K gold per tola in Pakistani Rupees, tracking the same spot rate as Karachi and Lahore.',
  },
  // ── India ─────────────────────────────────────────────────────────────────
  {
    country: 'india',
    city: 'kolkata',
    nameEn: 'Kolkata',
    nameAr: 'كولكاتا',
    marketEn: 'Bowbazar gold market',
    marketAr: 'سوق الذهب ببوبازار',
    noteEn:
      'Kolkata\u2019s Bowbazar is one of India\u2019s oldest jewellery hubs; 22K is the standard for jewellery and is priced per gram in Indian Rupees.',
  },
  {
    country: 'india',
    city: 'hyderabad',
    nameEn: 'Hyderabad',
    nameAr: 'حيدر آباد',
    marketEn: 'Pathergatti, near Charminar',
    marketAr: 'سوق باثرغاتي قرب تشارمينار',
    noteEn:
      'The Pathergatti market near the Charminar is Hyderabad\u2019s traditional gold and pearl quarter, pricing 22K jewellery per gram in INR.',
  },
  {
    country: 'india',
    city: 'jaipur',
    nameEn: 'Jaipur',
    nameAr: 'جايبور',
    marketEn: 'Johari Bazaar',
    marketAr: 'سوق جوهري بازار',
    noteEn:
      'Jaipur\u2019s Johari Bazaar is renowned for jewellery and gemstones; gold is priced per gram in Indian Rupees off the global spot rate.',
  },
  // ── Morocco ───────────────────────────────────────────────────────────────
  {
    country: 'morocco',
    city: 'fes',
    nameEn: 'Fes',
    nameAr: 'فاس',
    marketEn: 'Fes Medina gold souk',
    marketAr: 'سوق الذهب بالمدينة القديمة بفاس',
    noteEn:
      'The gold souk in the Fes Medina prices jewellery in Moroccan Dirhams off the international spot rate, plus the local making charge.',
  },
  {
    country: 'morocco',
    city: 'tangier',
    nameEn: 'Tangier',
    nameAr: 'طنجة',
    marketEn: 'Tangier gold shops',
    marketAr: 'محلات الذهب بطنجة',
    noteEn:
      'Tangier jewellers quote 18K and 21K gold in Moroccan Dirhams, tracking the same spot rate as Casablanca and Rabat.',
  },
  // ── Iraq ──────────────────────────────────────────────────────────────────
  {
    country: 'iraq',
    city: 'najaf',
    nameEn: 'Najaf',
    nameAr: 'النجف',
    marketEn: 'Najaf gold souk',
    marketAr: 'سوق الذهب بالنجف',
    noteEn:
      'Najaf jewellers price gold in Iraqi Dinars off the global spot rate; 21K is the most common karat for jewellery in Iraq.',
  },
  {
    country: 'iraq',
    city: 'karbala',
    nameEn: 'Karbala',
    nameAr: 'كربلاء',
    marketEn: 'Karbala gold souk',
    marketAr: 'سوق الذهب بكربلاء',
    noteEn:
      'Karbala\u2019s gold shops follow the same Iraqi Dinar spot rate as Baghdad and Basra, shown live on this page.',
  },
];

const CONTENT_BY_KEY = new Map(NEW_CITIES.map((c) => [`${c.country}/${c.city}`, c]));

function getCityContent(countrySlug, citySlug) {
  return CONTENT_BY_KEY.get(`${countrySlug}/${citySlug}`) || null;
}

module.exports = { NEW_CITIES, getCityContent };
