/**
 * Per-country gold market intelligence reference data.
 *
 * Powers the "Market Intelligence Panel" and "Should I Buy Today?" indicator on
 * each country gold-price page (see `countries/country-page.js`). All values are
 * hardcoded reference data — they are NOT live and are explicitly surfaced in the
 * UI as "reference only, not financial advice".
 *
 * Shape (keyed by ISO country code, matching `src/config/countries.js`):
 * {
 *   vatRate:          number   // consumer tax applied to gold jewellery, 0–1 (e.g. 0.05 = 5%)
 *   vatNoteEn/Ar:     string   // short clarification of how the tax applies locally
 *   makingChargeMin:  number   // typical making/labour charge, low end, as a fraction of gold value
 *   makingChargeMax:  number   // typical making/labour charge, high end, as a fraction of gold value
 *   karatPrefEn/Ar:   string   // most common karats locally
 *   marketNoteEn/Ar:  string   // one-line market context (key souk / city / characteristic)
 * }
 *
 * Making charges are expressed as a fraction of the underlying gold value so the
 * retail estimate works across every currency. Ranges reflect common jewellery
 * (not investment bullion, which usually carries a far smaller premium).
 */

export const MARKET_INTEL = {
  // ── GCC ─────────────────────────────────────────────────────────────────────
  AE: {
    vatRate: 0.05,
    vatNoteEn: 'Investment-grade 24K bars are zero-rated; jewellery carries 5% VAT.',
    vatNoteAr: 'سبائك عيار 24 الاستثمارية معفاة، بينما تخضع المجوهرات لضريبة 5%.',
    makingChargeMin: 0.08,
    makingChargeMax: 0.3,
    karatPrefEn: '22K & 21K for jewellery, 24K for investment',
    karatPrefAr: 'عيار 22 و21 للمجوهرات، وعيار 24 للاستثمار',
    marketNoteEn: 'The Dubai Gold Souk is one of the largest physical gold markets in the world.',
    marketNoteAr: 'سوق الذهب في دبي من أكبر أسواق الذهب الفعلية في العالم.',
  },
  SA: {
    vatRate: 0.15,
    vatNoteEn: 'Investment gold (≥99% purity) is VAT-exempt; jewellery carries 15% VAT.',
    vatNoteAr: 'الذهب الاستثماري (نقاء ≥99%) معفى، بينما تخضع المجوهرات لضريبة 15%.',
    makingChargeMin: 0.1,
    makingChargeMax: 0.35,
    karatPrefEn: '21K & 18K most common, 24K for bars',
    karatPrefAr: 'عيار 21 و18 الأكثر شيوعاً، وعيار 24 للسبائك',
    marketNoteEn: 'Jeddah and Riyadh gold souks are major Gulf trading hubs.',
    marketNoteAr: 'أسواق الذهب في جدة والرياض من أهم مراكز التداول الخليجية.',
  },
  KW: {
    vatRate: 0,
    vatNoteEn: 'Kuwait does not currently apply VAT on gold.',
    vatNoteAr: 'لا تطبق الكويت حالياً ضريبة القيمة المضافة على الذهب.',
    makingChargeMin: 0.08,
    makingChargeMax: 0.28,
    karatPrefEn: '22K & 21K for jewellery',
    karatPrefAr: 'عيار 22 و21 للمجوهرات',
    marketNoteEn: 'The Mubarakiya gold market in Kuwait City is the traditional trading centre.',
    marketNoteAr: 'سوق المباركية في مدينة الكويت هو المركز التقليدي للتداول.',
  },
  QA: {
    vatRate: 0,
    vatNoteEn: 'Qatar does not currently apply VAT on gold.',
    vatNoteAr: 'لا تطبق قطر حالياً ضريبة القيمة المضافة على الذهب.',
    makingChargeMin: 0.08,
    makingChargeMax: 0.28,
    karatPrefEn: '22K & 21K for jewellery, 24K for investment',
    karatPrefAr: 'عيار 22 و21 للمجوهرات، وعيار 24 للاستثمار',
    marketNoteEn: 'Doha Gold Souk in Souq Waqif is the main retail destination.',
    marketNoteAr: 'سوق الذهب في سوق واقف بالدوحة هو الوجهة الرئيسية للتجزئة.',
  },
  BH: {
    vatRate: 0.1,
    vatNoteEn: 'Investment gold is exempt; jewellery carries 10% VAT.',
    vatNoteAr: 'الذهب الاستثماري معفى، بينما تخضع المجوهرات لضريبة 10%.',
    makingChargeMin: 0.08,
    makingChargeMax: 0.28,
    karatPrefEn: '22K & 21K most common',
    karatPrefAr: 'عيار 22 و21 الأكثر شيوعاً',
    marketNoteEn: 'Manama Gold Souk is known for competitive making charges.',
    marketNoteAr: 'سوق الذهب في المنامة معروف برسوم الصنعة التنافسية.',
  },
  OM: {
    vatRate: 0.05,
    vatNoteEn: 'Investment gold is zero-rated; jewellery carries 5% VAT.',
    vatNoteAr: 'الذهب الاستثماري بنسبة صفر، بينما تخضع المجوهرات لضريبة 5%.',
    makingChargeMin: 0.08,
    makingChargeMax: 0.28,
    karatPrefEn: '22K & 21K for jewellery',
    karatPrefAr: 'عيار 22 و21 للمجوهرات',
    marketNoteEn: 'Muttrah Souk in Muscat is a historic gold and silver market.',
    marketNoteAr: 'سوق مطرح في مسقط سوق تاريخي للذهب والفضة.',
  },

  // ── Levant ──────────────────────────────────────────────────────────────────
  JO: {
    vatRate: 0.16,
    vatNoteEn: 'Sales tax applies mainly to the making charge, not the gold value.',
    vatNoteAr: 'تطبق ضريبة المبيعات بشكل أساسي على أجور الصنعة وليس قيمة الذهب.',
    makingChargeMin: 0.07,
    makingChargeMax: 0.25,
    karatPrefEn: '21K & 18K most common',
    karatPrefAr: 'عيار 21 و18 الأكثر شيوعاً',
    marketNoteEn: 'Downtown Amman gold souk concentrates most retail jewellers.',
    marketNoteAr: 'سوق الذهب وسط عمّان يضم معظم تجار التجزئة.',
  },
  LB: {
    vatRate: 0.11,
    vatNoteEn: 'VAT applies to jewellery; raw gold trades close to spot.',
    vatNoteAr: 'تطبق الضريبة على المجوهرات، بينما يتداول الذهب الخام قرب السعر الفوري.',
    makingChargeMin: 0.07,
    makingChargeMax: 0.25,
    karatPrefEn: '21K & 18K most common',
    karatPrefAr: 'عيار 21 و18 الأكثر شيوعاً',
    marketNoteEn: 'Beirut souks remain a regional centre for fine jewellery craftsmanship.',
    marketNoteAr: 'أسواق بيروت تبقى مركزاً إقليمياً لصناعة المجوهرات الدقيقة.',
  },
  IQ: {
    vatRate: 0,
    vatNoteEn: 'No standard VAT on gold; pricing follows local dealer spreads.',
    vatNoteAr: 'لا توجد ضريبة قياسية على الذهب، والتسعير يتبع هوامش التجار المحليين.',
    makingChargeMin: 0.07,
    makingChargeMax: 0.25,
    karatPrefEn: '21K & 18K most common',
    karatPrefAr: 'عيار 21 و18 الأكثر شيوعاً',
    marketNoteEn: 'Baghdad and Erbil gold markets price in both IQD and USD.',
    marketNoteAr: 'أسواق الذهب في بغداد وأربيل تسعّر بالدينار والدولار.',
  },
  SY: {
    vatRate: 0,
    vatNoteEn: 'No standard VAT; local prices track the parallel exchange rate.',
    vatNoteAr: 'لا توجد ضريبة قياسية، والأسعار المحلية تتبع سعر الصرف الموازي.',
    makingChargeMin: 0.07,
    makingChargeMax: 0.25,
    karatPrefEn: '21K & 18K most common',
    karatPrefAr: 'عيار 21 و18 الأكثر شيوعاً',
    marketNoteEn: 'Aleppo and Damascus have long traditions of goldsmithing.',
    marketNoteAr: 'لحلب ودمشق تقاليد عريقة في صياغة الذهب.',
  },
  PS: {
    vatRate: 0.16,
    vatNoteEn: 'VAT applies to jewellery in line with regional rates.',
    vatNoteAr: 'تطبق الضريبة على المجوهرات وفق المعدلات الإقليمية.',
    makingChargeMin: 0.07,
    makingChargeMax: 0.25,
    karatPrefEn: '21K & 18K most common',
    karatPrefAr: 'عيار 21 و18 الأكثر شيوعاً',
    marketNoteEn: 'Gold is widely used in dowries and as a store of value.',
    marketNoteAr: 'يُستخدم الذهب على نطاق واسع في المهور وكمخزن للقيمة.',
  },
  YE: {
    vatRate: 0.05,
    vatNoteEn: 'Local taxes vary; prices reflect regional dealer spreads.',
    vatNoteAr: 'تتفاوت الضرائب المحلية، وتعكس الأسعار هوامش التجار الإقليميين.',
    makingChargeMin: 0.07,
    makingChargeMax: 0.25,
    karatPrefEn: '21K & 18K most common',
    karatPrefAr: 'عيار 21 و18 الأكثر شيوعاً',
    marketNoteEn: 'Sana’a old city silver and gold souks are UNESCO-listed heritage markets.',
    marketNoteAr: 'أسواق الذهب والفضة في صنعاء القديمة مدرجة في التراث العالمي لليونسكو.',
  },

  // ── North Africa ────────────────────────────────────────────────────────────
  EG: {
    vatRate: 0.14,
    vatNoteEn: 'VAT applies to the making charge; the gold value itself is exempt.',
    vatNoteAr: 'تطبق الضريبة على أجور الصنعة، بينما تُعفى قيمة الذهب نفسها.',
    makingChargeMin: 0.05,
    makingChargeMax: 0.2,
    karatPrefEn: '21K & 18K most common',
    karatPrefAr: 'عيار 21 و18 الأكثر شيوعاً',
    marketNoteEn: 'Cairo’s Khan el-Khalili is one of the oldest gold markets in the Arab world.',
    marketNoteAr: 'خان الخليلي في القاهرة من أقدم أسواق الذهب في العالم العربي.',
  },
  LY: {
    vatRate: 0,
    vatNoteEn: 'No standard VAT on gold; prices follow local dealer spreads.',
    vatNoteAr: 'لا توجد ضريبة قياسية على الذهب، والأسعار تتبع هوامش التجار المحليين.',
    makingChargeMin: 0.06,
    makingChargeMax: 0.22,
    karatPrefEn: '21K & 18K most common',
    karatPrefAr: 'عيار 21 و18 الأكثر شيوعاً',
    marketNoteEn: 'Tripoli’s old-city souk is the main gold trading area.',
    marketNoteAr: 'سوق المدينة القديمة في طرابلس هو منطقة تداول الذهب الرئيسية.',
  },
  TN: {
    vatRate: 0.19,
    vatNoteEn: 'VAT applies to jewellery; gold is also subject to a hallmark stamp duty.',
    vatNoteAr: 'تطبق الضريبة على المجوهرات، ويخضع الذهب أيضاً لرسم دمغة.',
    makingChargeMin: 0.06,
    makingChargeMax: 0.22,
    karatPrefEn: '18K most common, 21K also popular',
    karatPrefAr: 'عيار 18 الأكثر شيوعاً، وعيار 21 شائع أيضاً',
    marketNoteEn: 'Tunis Medina souks are known for traditional filigree jewellery.',
    marketNoteAr: 'أسواق مدينة تونس معروفة بمجوهرات الفيليغري التقليدية.',
  },
  DZ: {
    vatRate: 0.19,
    vatNoteEn: 'VAT applies to jewellery in addition to a hallmark stamp duty.',
    vatNoteAr: 'تطبق الضريبة على المجوهرات إضافة إلى رسم الدمغة.',
    makingChargeMin: 0.06,
    makingChargeMax: 0.22,
    karatPrefEn: '18K most common',
    karatPrefAr: 'عيار 18 الأكثر شيوعاً',
    marketNoteEn: 'Algiers and Constantine have established gold jewellery quarters.',
    marketNoteAr: 'للجزائر العاصمة وقسنطينة أحياء راسخة لمجوهرات الذهب.',
  },
  MA: {
    vatRate: 0.2,
    vatNoteEn: 'VAT applies to jewellery; gold also carries a hallmark stamp duty.',
    vatNoteAr: 'تطبق الضريبة على المجوهرات، ويخضع الذهب لرسم دمغة.',
    makingChargeMin: 0.06,
    makingChargeMax: 0.22,
    karatPrefEn: '18K most common',
    karatPrefAr: 'عيار 18 الأكثر شيوعاً',
    marketNoteEn: 'The Fes and Marrakech medinas host historic goldsmith souks.',
    marketNoteAr: 'تضم مدينتا فاس ومراكش أسواق صياغة ذهب تاريخية.',
  },
  SD: {
    vatRate: 0,
    vatNoteEn: 'Local taxes vary; Sudan is a significant African gold producer.',
    vatNoteAr: 'تتفاوت الضرائب المحلية، والسودان منتج إفريقي مهم للذهب.',
    makingChargeMin: 0.06,
    makingChargeMax: 0.22,
    karatPrefEn: '21K & 18K most common',
    karatPrefAr: 'عيار 21 و18 الأكثر شيوعاً',
    marketNoteEn: 'Omdurman souk is the main gold trading centre.',
    marketNoteAr: 'سوق أم درمان هو المركز الرئيسي لتداول الذهب.',
  },

  // ── Horn of Africa & Sahel ──────────────────────────────────────────────────
  SO: {
    vatRate: 0,
    vatNoteEn: 'No standard VAT; gold is valued in USD and local currency.',
    vatNoteAr: 'لا توجد ضريبة قياسية، ويُقيَّم الذهب بالدولار والعملة المحلية.',
    makingChargeMin: 0.06,
    makingChargeMax: 0.22,
    karatPrefEn: '21K most common',
    karatPrefAr: 'عيار 21 الأكثر شيوعاً',
    marketNoteEn: 'Bakara market in Mogadishu is a key trading hub.',
    marketNoteAr: 'سوق بكارة في مقديشو مركز تجاري رئيسي.',
  },
  MR: {
    vatRate: 0.16,
    vatNoteEn: 'VAT applies to jewellery in line with regional rates.',
    vatNoteAr: 'تطبق الضريبة على المجوهرات وفق المعدلات الإقليمية.',
    makingChargeMin: 0.06,
    makingChargeMax: 0.22,
    karatPrefEn: '21K & 18K most common',
    karatPrefAr: 'عيار 21 و18 الأكثر شيوعاً',
    marketNoteEn: 'Nouakchott’s Capitale market hosts most gold retailers.',
    marketNoteAr: 'سوق العاصمة في نواكشوط يضم معظم تجار الذهب.',
  },
  DJ: {
    vatRate: 0.1,
    vatNoteEn: 'VAT applies to jewellery; Djibouti is a regional trade gateway.',
    vatNoteAr: 'تطبق الضريبة على المجوهرات، وجيبوتي بوابة تجارية إقليمية.',
    makingChargeMin: 0.06,
    makingChargeMax: 0.22,
    karatPrefEn: '21K & 22K most common',
    karatPrefAr: 'عيار 21 و22 الأكثر شيوعاً',
    marketNoteEn: 'Djibouti City’s central market serves cross-border buyers.',
    marketNoteAr: 'السوق المركزي في مدينة جيبوتي يخدم المشترين عبر الحدود.',
  },
  KM: {
    vatRate: 0,
    vatNoteEn: 'No standard VAT; gold is largely traded in jewellery form.',
    vatNoteAr: 'لا توجد ضريبة قياسية، ويُتداول الذهب غالباً على شكل مجوهرات.',
    makingChargeMin: 0.06,
    makingChargeMax: 0.22,
    karatPrefEn: '18K & 21K most common',
    karatPrefAr: 'عيار 18 و21 الأكثر شيوعاً',
    marketNoteEn: 'Gold jewellery features prominently in Comorian wedding traditions.',
    marketNoteAr: 'تحضر مجوهرات الذهب بقوة في تقاليد الزفاف القمرية.',
  },

  // ── Wider region & global ───────────────────────────────────────────────────
  TR: {
    vatRate: 0.2,
    vatNoteEn: 'Investment gold is VAT-exempt; jewellery making charges carry VAT.',
    vatNoteAr: 'الذهب الاستثماري معفى، بينما تخضع أجور صنعة المجوهرات للضريبة.',
    makingChargeMin: 0.08,
    makingChargeMax: 0.3,
    karatPrefEn: '22K & 14K, plus Republic gold coins',
    karatPrefAr: 'عيار 22 و14، إضافة إلى ليرات الذهب الجمهورية',
    marketNoteEn: 'Istanbul’s Grand Bazaar is one of the world’s oldest gold markets.',
    marketNoteAr: 'البازار الكبير في إسطنبول من أقدم أسواق الذهب في العالم.',
  },
  PK: {
    vatRate: 0.03,
    vatNoteEn: 'Sales tax applies to gold plus GST on the making charge.',
    vatNoteAr: 'تطبق ضريبة المبيعات على الذهب إضافة إلى ضريبة على أجور الصنعة.',
    makingChargeMin: 0.06,
    makingChargeMax: 0.25,
    karatPrefEn: '22K & 21K most common',
    karatPrefAr: 'عيار 22 و21 الأكثر شيوعاً',
    marketNoteEn: 'Sarafa Bazaar in Karachi is among South Asia’s busiest gold markets.',
    marketNoteAr: 'سوق الصرافة في كراتشي من أكثر أسواق الذهب ازدحاماً في جنوب آسيا.',
  },
  IN: {
    vatRate: 0.03,
    vatNoteEn: '3% GST on gold value plus 5% GST on the making charge.',
    vatNoteAr: 'ضريبة 3% على قيمة الذهب إضافة إلى 5% على أجور الصنعة.',
    makingChargeMin: 0.08,
    makingChargeMax: 0.25,
    karatPrefEn: '22K for jewellery, 24K for coins/bars',
    karatPrefAr: 'عيار 22 للمجوهرات، وعيار 24 للعملات والسبائك',
    marketNoteEn: 'Zaveri Bazaar in Mumbai is India’s largest bullion and jewellery market.',
    marketNoteAr: 'سوق زافيري في مومباي أكبر أسواق السبائك والمجوهرات في الهند.',
  },
  US: {
    vatRate: 0,
    vatNoteEn: 'No federal VAT; sales tax varies by state and exemptions apply.',
    vatNoteAr: 'لا توجد ضريبة اتحادية، وتختلف ضريبة المبيعات حسب الولاية.',
    makingChargeMin: 0.05,
    makingChargeMax: 0.4,
    karatPrefEn: '14K & 18K for jewellery, 24K for bullion',
    karatPrefAr: 'عيار 14 و18 للمجوهرات، وعيار 24 للسبائك',
    marketNoteEn: 'New York’s Diamond District is a major jewellery and bullion hub.',
    marketNoteAr: 'حي الألماس في نيويورك مركز رئيسي للمجوهرات والسبائك.',
  },
  GB: {
    vatRate: 0.2,
    vatNoteEn: 'Investment gold is VAT-exempt; jewellery carries 20% VAT.',
    vatNoteAr: 'الذهب الاستثماري معفى، بينما تخضع المجوهرات لضريبة 20%.',
    makingChargeMin: 0.05,
    makingChargeMax: 0.4,
    karatPrefEn: '9K & 18K for jewellery, 24K for bullion',
    karatPrefAr: 'عيار 9 و18 للمجوهرات، وعيار 24 للسبائك',
    marketNoteEn: 'London is the centre of global gold price benchmarking (LBMA).',
    marketNoteAr: 'لندن مركز تحديد المعيار العالمي لأسعار الذهب (LBMA).',
  },
  EU: {
    vatRate: 0.2,
    vatNoteEn: 'Investment gold is VAT-exempt EU-wide; jewellery VAT varies by country.',
    vatNoteAr: 'الذهب الاستثماري معفى في الاتحاد الأوروبي، وتختلف ضريبة المجوهرات حسب الدولة.',
    makingChargeMin: 0.05,
    makingChargeMax: 0.4,
    karatPrefEn: '14K & 18K for jewellery, 24K for bullion',
    karatPrefAr: 'عيار 14 و18 للمجوهرات، وعيار 24 للسبائك',
    marketNoteEn: 'Frankfurt and Zurich are key European bullion trading centres.',
    marketNoteAr: 'فرانكفورت وزيورخ من أهم مراكز تداول السبائك الأوروبية.',
  },
};

/**
 * Default fallback used when a country has no specific entry. Conservative,
 * clearly-generic reference values so the panel still renders sensibly.
 */
export const MARKET_INTEL_DEFAULT = {
  vatRate: 0,
  vatNoteEn: 'Local taxes vary — confirm with a licensed retailer before purchase.',
  vatNoteAr: 'تتفاوت الضرائب المحلية — تأكّد من تاجر مرخّص قبل الشراء.',
  makingChargeMin: 0.07,
  makingChargeMax: 0.25,
  karatPrefEn: '21K & 18K most common',
  karatPrefAr: 'عيار 21 و18 الأكثر شيوعاً',
  marketNoteEn: 'Retail gold prices include the spot value plus making charges and local taxes.',
  marketNoteAr: 'تشمل أسعار الذهب بالتجزئة السعر الفوري إضافة إلى أجور الصنعة والضرائب المحلية.',
};

/**
 * Resolve the market-intelligence record for a given ISO country code, falling
 * back to a safe generic record when no specific entry exists.
 *
 * @param {string} code  ISO country code (e.g. 'AE').
 * @returns {object} The market-intelligence record (never null).
 */
export function getMarketIntel(code) {
  return MARKET_INTEL[code] || MARKET_INTEL_DEFAULT;
}
