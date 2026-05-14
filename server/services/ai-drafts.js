/**
 * server/services/ai-drafts.js
 *
 * Template-based AI draft generation service for Gold Ticker Live.
 *
 * IMPORTANT DESIGN CONSTRAINTS:
 *  - No LLM calls; no external AI APIs. Drafts are generated from price data
 *    templates and require human editorial review before any use.
 *  - Never auto-publishes or auto-posts to social media.
 *  - Always includes: data timestamp, spot-estimate disclaimer, EN + AR content.
 *  - Always flags anomalies for human review before publishing.
 *  - Generated content must not invent causes for price moves.
 *  - Speculation must be labelled explicitly.
 *
 * Draft types:
 *  - daily_summary      Daily gold market summary
 *  - weekly_summary     Weekly gold market summary
 *  - uae_gcc_summary    UAE/GCC gold price summary
 *  - provider_report    Provider/freshness report summary
 *  - seo_brief          SEO content brief
 *  - x_post             X/Twitter post draft
 *  - newsletter_block   Newsletter content block
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { detectAnomaly } = require('../lib/anomaly-detector');
const { insertDraft } = require('../repositories/ai-drafts.repository');

const DATA_DIR = path.resolve(__dirname, '../../data');
const GOLD_PRICE_FILE = path.join(DATA_DIR, 'gold_price.json');
const LAST_GOLD_PRICE_FILE = path.join(DATA_DIR, 'last_gold_price.json');
const PROVIDER_STATE_FILE = path.join(DATA_DIR, 'provider_state.json');

// Standard disclaimer appended to every draft body.
const DISCLAIMER_EN =
  '⚠ Spot-based reference estimate only. Retail and jewellery prices may differ significantly. Not financial advice. Data sourced from global XAU/USD markets, converted at the AED fixed peg.';
const DISCLAIMER_AR =
  '⚠ سعر تقديري مبني على سعر الذهب العالمي (XAU/USD). قد يختلف سعر المحلات بسبب المصنعية والضريبة والهامش. ليس نصيحة مالية. يُستخدم سعر الدرهم الثابت مقابل الدولار.';

// Speculation disclaimer
const SPECULATION_EN =
  '[Note: The reason for this price move is not confirmed. The above observation is factual data only, not an explanation of cause.]';
const SPECULATION_AR =
  '[ملاحظة: سبب هذه الحركة غير مؤكد. البيانات أعلاه واقعية فقط وليست تفسيراً للسبب.]';

// ---------------------------------------------------------------------------
// File helpers
// ---------------------------------------------------------------------------

function _readJson(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Price formatting helpers
// ---------------------------------------------------------------------------

function _fmtUsd(v) {
  const n = Number(v);
  return Number.isFinite(n)
    ? n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
    : 'N/A';
}

function _fmtAed(v) {
  const n = Number(v);
  return Number.isFinite(n) ? `AED ${n.toFixed(2)}` : 'N/A';
}

function _fmtPct(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 'N/A';
  const sign = n >= 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
}

function _fmtDate(isoStr) {
  if (!isoStr) return 'unknown';
  try {
    return new Date(isoStr).toUTCString();
  } catch {
    return isoStr;
  }
}

// ---------------------------------------------------------------------------
// Content builders
// ---------------------------------------------------------------------------

/**
 * Build a daily gold market summary draft.
 */
function _buildDailySummary(price, anomalyResult) {
  const ts = price.timestamp_utc || price.fetched_at_utc;
  const oz = price.xau_usd_per_oz || price.gold?.ounce_usd;
  const ozAed = price.gold?.ounce_aed;
  const gAed = price.aed_per_gram_24k || price.gold?.gram_aed;
  const k22 = price.karats_aed_per_gram?.['22k'];
  const k21 = price.karats_aed_per_gram?.['21k'];
  const k18 = price.karats_aed_per_gram?.['18k'];
  const provider = price.provider || price.source || 'market data';
  const freshness = price.is_fresh ? 'fresh' : 'cached/stale';

  const titleEn = `Daily Gold Market Summary — ${new Date(ts || Date.now()).toDateString()}`;
  const titleAr = `ملخص سوق الذهب اليومي — ${new Date(ts || Date.now()).toLocaleDateString('ar-AE')}`;

  const bodyEn = [
    '## Daily Gold Market Summary',
    `**Data as of:** ${_fmtDate(ts)} (${freshness})`,
    `**Source:** ${provider} — spot/reference price`,
    '',
    '### Spot Prices (XAU/USD)',
    `- Per ounce (USD): ${_fmtUsd(oz)}`,
    `- Per ounce (AED): ${_fmtAed(ozAed)}`,
    '',
    '### UAE Karat Prices (AED/gram, spot estimate)',
    `- 24K: ${_fmtAed(gAed)}`,
    `- 22K: ${_fmtAed(k22)}`,
    `- 21K: ${_fmtAed(k21)}`,
    `- 18K: ${_fmtAed(k18)}`,
    '',
    anomalyResult.anomaly_flag
      ? `⚠ **Anomaly detected:** ${anomalyResult.anomaly_detail}\n${SPECULATION_EN}`
      : '',
    '',
    DISCLAIMER_EN,
    '',
    '---',
    '*[DRAFT — Requires editorial review before publication. Do not publish without approval.]*',
  ]
    .filter((l) => l !== undefined)
    .join('\n');

  const bodyAr = [
    '## ملخص سوق الذهب اليومي',
    `**البيانات اعتباراً من:** ${_fmtDate(ts)} (${freshness})`,
    `**المصدر:** ${provider} — سعر مرجعي`,
    '',
    '### أسعار الذهب الفوري (XAU/USD)',
    `- سعر الأوقية (USD): ${_fmtUsd(oz)}`,
    `- سعر الأوقية (AED): ${_fmtAed(ozAed)}`,
    '',
    '### أسعار العيارات في الإمارات (درهم/جرام — سعر تقديري)',
    `- عيار 24: ${_fmtAed(gAed)}`,
    `- عيار 22: ${_fmtAed(k22)}`,
    `- عيار 21: ${_fmtAed(k21)}`,
    `- عيار 18: ${_fmtAed(k18)}`,
    '',
    anomalyResult.anomaly_flag
      ? `⚠ **تحذير:** ${anomalyResult.anomaly_detail}\n${SPECULATION_AR}`
      : '',
    '',
    DISCLAIMER_AR,
    '',
    '---',
    '*[مسودة — تتطلب مراجعة تحريرية قبل النشر. لا تنشر دون موافقة.]*',
  ]
    .filter((l) => l !== undefined)
    .join('\n');

  return { titleEn, titleAr, bodyEn, bodyAr };
}

/**
 * Build a weekly gold market summary draft.
 */
function _buildWeeklySummary(price, anomalyResult) {
  const ts = price.timestamp_utc || price.fetched_at_utc;
  const oz = price.xau_usd_per_oz || price.gold?.ounce_usd;
  const gAed = price.aed_per_gram_24k || price.gold?.gram_aed;
  const provider = price.provider || price.source || 'market data';

  const titleEn = `Weekly Gold Market Summary — Week of ${new Date(ts || Date.now()).toDateString()}`;
  const titleAr = `الملخص الأسبوعي لسوق الذهب — أسبوع ${new Date(ts || Date.now()).toLocaleDateString('ar-AE')}`;

  const bodyEn = [
    '## Weekly Gold Market Summary',
    `**Reference data as of:** ${_fmtDate(ts)}`,
    `**Source:** ${provider} — spot/reference price`,
    '',
    '### Current Reference Prices',
    `- XAU/USD spot: ${_fmtUsd(oz)} per ounce`,
    `- UAE 24K spot estimate: ${_fmtAed(gAed)} per gram`,
    '',
    '### Notes for Editor',
    '- Include any notable events from the week (editor to verify and add).',
    '- Do not state reasons for price moves unless confirmed by verifiable news.',
    '- Specify any karat/currency comparison that would add user value.',
    '',
    anomalyResult.anomaly_flag
      ? `⚠ **Anomaly detected this period:** ${anomalyResult.anomaly_detail}\n${SPECULATION_EN}`
      : '',
    '',
    DISCLAIMER_EN,
    '',
    '---',
    '*[DRAFT — Requires editorial review before publication.]*',
  ]
    .filter((l) => l !== undefined)
    .join('\n');

  const bodyAr = [
    '## الملخص الأسبوعي لسوق الذهب',
    `**البيانات المرجعية اعتباراً من:** ${_fmtDate(ts)}`,
    `**المصدر:** ${provider} — سعر مرجعي`,
    '',
    '### الأسعار المرجعية الحالية',
    `- سعر XAU/USD الفوري: ${_fmtUsd(oz)} للأوقية`,
    `- سعر عيار 24 في الإمارات (تقديري): ${_fmtAed(gAed)} للجرام`,
    '',
    '### ملاحظات للمحرر',
    '- أضِف أي أحداث بارزة للأسبوع (يتحقق المحرر منها).',
    '- لا تذكر أسباب حركات الأسعار إلا إذا كانت مؤكدة من أخبار موثوقة.',
    '',
    anomalyResult.anomaly_flag
      ? `⚠ **تحذير:** ${anomalyResult.anomaly_detail}\n${SPECULATION_AR}`
      : '',
    '',
    DISCLAIMER_AR,
    '',
    '---',
    '*[مسودة — تتطلب مراجعة تحريرية قبل النشر.]*',
  ]
    .filter((l) => l !== undefined)
    .join('\n');

  return { titleEn, titleAr, bodyEn, bodyAr };
}

/**
 * Build a UAE/GCC gold price summary draft.
 */
function _buildUaeGccSummary(price, anomalyResult) {
  const ts = price.timestamp_utc || price.fetched_at_utc;
  const k24 = price.aed_per_gram_24k || price.gold?.gram_aed;
  const k22 = price.karats_aed_per_gram?.['22k'];
  const k21 = price.karats_aed_per_gram?.['21k'];
  const k18 = price.karats_aed_per_gram?.['18k'];
  const ozUsd = price.xau_usd_per_oz || price.gold?.ounce_usd;

  const titleEn = `UAE & GCC Gold Price Summary — ${new Date(ts || Date.now()).toDateString()}`;
  const titleAr = `ملخص أسعار الذهب في الإمارات ودول الخليج — ${new Date(ts || Date.now()).toLocaleDateString('ar-AE')}`;

  const bodyEn = [
    '## UAE & GCC Gold Prices',
    `**Reference data as of:** ${_fmtDate(ts)}`,
    '**AED/USD peg:** 3.6725 (UAE Central Bank fixed peg)',
    '',
    '### Dubai / UAE Spot Estimates (AED per gram)',
    '| Karat | AED/gram (spot estimate) |',
    '|-------|--------------------------|',
    `| 24K   | ${_fmtAed(k24)}           |`,
    `| 22K   | ${_fmtAed(k22)}           |`,
    `| 21K   | ${_fmtAed(k21)}           |`,
    `| 18K   | ${_fmtAed(k18)}           |`,
    '',
    `**Global reference (XAU/USD):** ${_fmtUsd(ozUsd)} per ounce`,
    '',
    '### Notes for Editor',
    '- Retail and jewellery prices in souks may differ (making charges, VAT, shop premium).',
    '- Other GCC currencies (SAR, KWD, QAR, BHD, OMR) follow the same USD anchor.',
    '- Editor: verify Saudi/Kuwait/Qatar prices if including them.',
    '',
    anomalyResult.anomaly_flag
      ? `⚠ **Anomaly detected:** ${anomalyResult.anomaly_detail}\n${SPECULATION_EN}`
      : '',
    '',
    DISCLAIMER_EN,
    '',
    '---',
    '*[DRAFT — Requires editorial review before publication.]*',
  ]
    .filter((l) => l !== undefined)
    .join('\n');

  const bodyAr = [
    '## أسعار الذهب في الإمارات ودول الخليج',
    `**البيانات المرجعية اعتباراً من:** ${_fmtDate(ts)}`,
    '**ربط الدرهم بالدولار:** 3.6725 (ربط ثابت من مصرف الإمارات المركزي)',
    '',
    '### الأسعار التقديرية في دبي/الإمارات (درهم/جرام)',
    '| العيار | الدرهم/جرام (سعر تقديري) |',
    '|--------|--------------------------|',
    `| عيار 24 | ${_fmtAed(k24)}          |`,
    `| عيار 22 | ${_fmtAed(k22)}          |`,
    `| عيار 21 | ${_fmtAed(k21)}          |`,
    `| عيار 18 | ${_fmtAed(k18)}          |`,
    '',
    `**المرجع العالمي (XAU/USD):** ${_fmtUsd(ozUsd)} للأوقية`,
    '',
    '### ملاحظات للمحرر',
    '- قد تختلف أسعار محلات المجوهرات (مصنعية، ضريبة، هامش).',
    '- عملات الخليج الأخرى تتبع نفس الربط بالدولار.',
    '',
    anomalyResult.anomaly_flag
      ? `⚠ **تحذير:** ${anomalyResult.anomaly_detail}\n${SPECULATION_AR}`
      : '',
    '',
    DISCLAIMER_AR,
    '',
    '---',
    '*[مسودة — تتطلب مراجعة تحريرية قبل النشر.]*',
  ]
    .filter((l) => l !== undefined)
    .join('\n');

  return { titleEn, titleAr, bodyEn, bodyAr };
}

/**
 * Build a provider/freshness report draft.
 */
function _buildProviderReport(price, providerState, anomalyResult) {
  const ts = price.fetched_at_utc || price.timestamp_utc;
  const provider = price.provider || price.source || 'unknown';
  const isFresh = price.is_fresh !== false;
  const isFallback = price.is_fallback === true;
  const freshnessSeconds = price.freshness_seconds;
  const responseMs = price.provider_response_time_ms;

  const titleEn = `Provider & Data Freshness Report — ${new Date(ts || Date.now()).toDateString()}`;
  const titleAr = `تقرير المزود ونضارة البيانات — ${new Date(ts || Date.now()).toLocaleDateString('ar-AE')}`;

  const providerLines = [];
  if (providerState && typeof providerState === 'object') {
    for (const [name, state] of Object.entries(providerState)) {
      if (state && typeof state === 'object') {
        providerLines.push(
          `- **${name}**: circuit_open=${state.circuit_open ?? 'unknown'}, failures=${state.failure_count ?? 0}`
        );
      }
    }
  }

  const bodyEn = [
    '## Provider & Data Freshness Report',
    `**Report generated:** ${_fmtDate(ts)}`,
    '',
    '### Active Provider',
    `- Provider: **${provider}**`,
    `- Data fresh: **${isFresh ? 'Yes' : 'No — stale/cached'}**`,
    `- Fallback active: **${isFallback ? 'Yes ⚠' : 'No'}**`,
    freshnessSeconds != null ? `- Freshness: ${freshnessSeconds}s` : '',
    responseMs != null ? `- Provider response time: ${responseMs}ms` : '',
    '',
    providerLines.length > 0
      ? `### Provider Circuit-Breaker State\n${providerLines.join('\n')}`
      : '',
    '',
    anomalyResult.anomaly_flag
      ? `### ⚠ Anomaly Flags\n${anomalyResult.anomaly_reasons.map((r) => `- ${r}`).join('\n')}\n\n${SPECULATION_EN}`
      : '### ✅ No anomalies detected',
    '',
    '### Notes for Editor',
    '- This is an internal report. Review before sharing externally.',
    '- If circuit-breakers are open, investigate before using price data in content.',
    '',
    '---',
    '*[DRAFT — Internal use only. Requires admin review.]*',
  ]
    .filter((l) => l !== '')
    .join('\n');

  const bodyAr = [
    '## تقرير المزود ونضارة البيانات',
    `**تاريخ التقرير:** ${_fmtDate(ts)}`,
    '',
    '### المزود النشط',
    `- المزود: **${provider}**`,
    `- البيانات حديثة: **${isFresh ? 'نعم' : 'لا — قديمة/مخزنة مؤقتاً'}**`,
    `- التحويل الاحتياطي نشط: **${isFallback ? 'نعم ⚠' : 'لا'}**`,
    '',
    anomalyResult.anomaly_flag
      ? `### ⚠ تحذيرات\n${anomalyResult.anomaly_reasons.map((r) => `- ${r}`).join('\n')}\n\n${SPECULATION_AR}`
      : '### ✅ لا توجد شذوذات',
    '',
    DISCLAIMER_AR,
    '',
    '---',
    '*[مسودة — للاستخدام الداخلي. تتطلب مراجعة المسؤول.]*',
  ]
    .filter((l) => l !== '')
    .join('\n');

  return { titleEn, titleAr, bodyEn, bodyAr };
}

/**
 * Build an SEO content brief draft.
 */
function _buildSeoBrief(price, anomalyResult) {
  const ts = price.timestamp_utc || price.fetched_at_utc;
  const ozUsd = price.xau_usd_per_oz || price.gold?.ounce_usd;
  const gAed = price.aed_per_gram_24k || price.gold?.gram_aed;
  const k22 = price.karats_aed_per_gram?.['22k'];

  const titleEn = `SEO Content Brief — Gold Prices — ${new Date(ts || Date.now()).toDateString()}`;
  const titleAr = `موجز محتوى SEO — أسعار الذهب — ${new Date(ts || Date.now()).toLocaleDateString('ar-AE')}`;

  const bodyEn = [
    '## SEO Content Brief',
    `**Reference data as of:** ${_fmtDate(ts)}`,
    '',
    '### Target Keywords (Editor to validate)',
    '- gold price today UAE',
    '- gold price Dubai',
    '- 24K gold price per gram AED',
    '- 22K gold price per gram Dubai',
    '- XAU USD today',
    '',
    '### Current Data Points to Include',
    `- XAU/USD: ${_fmtUsd(ozUsd)} per ounce (spot estimate)`,
    `- UAE 24K: ${_fmtAed(gAed)} per gram (spot estimate)`,
    `- UAE 22K: ${_fmtAed(k22)} per gram (spot estimate)`,
    `- Data freshness: spot-linked reference as of ${_fmtDate(ts)}`,
    '',
    '### Content Guidelines',
    '- Frame all prices as spot/reference estimates — not retail or jewellery prices.',
    '- Include freshness label and data source.',
    '- Do not make investment recommendations.',
    '- Include link to /methodology and /calculator.',
    '- Keep UAE/GCC context primary.',
    '',
    anomalyResult.anomaly_flag
      ? `⚠ **Note:** Anomaly detected (${anomalyResult.anomaly_detail}). Verify before publishing price-based SEO content.`
      : '',
    '',
    '---',
    '*[DRAFT BRIEF — Editor fills in full article content. No auto-generation of article body.]*',
  ]
    .filter((l) => l !== undefined)
    .join('\n');

  const bodyAr = [
    '## موجز محتوى SEO',
    `**البيانات المرجعية اعتباراً من:** ${_fmtDate(ts)}`,
    '',
    '### الكلمات المفتاحية المستهدفة (يتحقق المحرر منها)',
    '- سعر الذهب اليوم الإمارات',
    '- سعر الذهب دبي',
    '- سعر الذهب عيار 24 بالدرهم',
    '',
    '### نقاط البيانات الحالية',
    `- XAU/USD: ${_fmtUsd(ozUsd)} للأوقية (سعر تقديري)`,
    `- عيار 24 الإمارات: ${_fmtAed(gAed)} للجرام (سعر تقديري)`,
    `- عيار 22 الإمارات: ${_fmtAed(k22)} للجرام (سعر تقديري)`,
    '',
    '### إرشادات المحتوى',
    '- صِغ جميع الأسعار كتقديرات مرجعية — ليست أسعار تجزئة أو مجوهرات.',
    '- أدرج علامة نضارة البيانات ومصدرها.',
    '',
    anomalyResult.anomaly_flag
      ? `⚠ **ملاحظة:** تم رصد شذوذ (${anomalyResult.anomaly_detail}). تحقق قبل نشر محتوى يعتمد على الأسعار.`
      : '',
    '',
    DISCLAIMER_AR,
    '',
    '---',
    '*[مسودة موجز — يكتب المحرر محتوى المقالة الكاملة.]*',
  ]
    .filter((l) => l !== undefined)
    .join('\n');

  return { titleEn, titleAr, bodyEn, bodyAr };
}

/**
 * Build an X/Twitter post draft.
 */
function _buildXPost(price, anomalyResult) {
  const ts = price.timestamp_utc || price.fetched_at_utc;
  const ozUsd = price.xau_usd_per_oz || price.gold?.ounce_usd;
  const gAed = price.aed_per_gram_24k || price.gold?.gram_aed;
  const k22 = price.karats_aed_per_gram?.['22k'];

  const titleEn = `X Post Draft — Gold Price — ${new Date(ts || Date.now()).toDateString()}`;
  const titleAr = `مسودة تغريدة — سعر الذهب — ${new Date(ts || Date.now()).toLocaleDateString('ar-AE')}`;

  // Keep under 280 chars for each option. Editor picks or edits.
  const ozStr = Number.isFinite(Number(ozUsd)) ? `$${Number(ozUsd).toFixed(0)}/oz` : 'N/A';
  const gAedStr = Number.isFinite(Number(gAed)) ? `AED ${Number(gAed).toFixed(2)}/g` : 'N/A';
  const k22Str = Number.isFinite(Number(k22)) ? `AED ${Number(k22).toFixed(2)}/g` : 'N/A';

  const anomalyNote = anomalyResult.anomaly_flag
    ? '\n⚠ [ANOMALY FLAGGED — do not post until reviewed]'
    : '';

  const bodyEn = [
    '## X/Twitter Post Draft',
    `**Data as of:** ${_fmtDate(ts)}`,
    '',
    '### Option A (short)',
    `Gold today 🏅 XAU/USD ${ozStr} | UAE 24K ${gAedStr} | 22K ${k22Str}`,
    `Spot estimate · Not retail. goldtickerlive.com${anomalyNote}`,
    '',
    '### Option B (with context)',
    `📊 Gold Price Reference — ${new Date(ts || Date.now()).toDateString()}`,
    `XAU/USD: ${ozStr}`,
    `UAE 24K: ${gAedStr}/gram (spot est.)`,
    `UAE 22K: ${k22Str}/gram`,
    'Prices are spot-linked estimates. Retail may differ.',
    `goldtickerlive.com${anomalyNote}`,
    '',
    '### Notes for Editor',
    '- Pick one option and edit as needed.',
    '- Confirm prices are still fresh before posting.',
    '- Add relevant hashtags (#gold #goldprice #UAE #Dubai) only if appropriate.',
    '- Do NOT auto-post from this draft.',
    '',
    '---',
    '*[DRAFT — Human review required before posting to X/Twitter.]*',
  ].join('\n');

  const bodyAr = [
    '## مسودة تغريدة',
    `**البيانات اعتباراً من:** ${_fmtDate(ts)}`,
    '',
    '### الخيار الأول',
    `الذهب اليوم 🏅 XAU/USD ${ozStr} | عيار 24 الإمارات ${gAedStr} | عيار 22 ${k22Str}`,
    `سعر تقديري مرجعي · ليس سعر تجزئة. goldtickerlive.com${anomalyNote}`,
    '',
    '### ملاحظات للمحرر',
    '- اختر خياراً وعدّله حسب الحاجة.',
    '- تأكد من حداثة الأسعار قبل النشر.',
    '- لا تنشر هذه المسودة تلقائياً.',
    '',
    DISCLAIMER_AR,
    '',
    '---',
    '*[مسودة — تتطلب مراجعة بشرية قبل النشر على X/تويتر.]*',
  ].join('\n');

  return { titleEn, titleAr, bodyEn, bodyAr };
}

/**
 * Build a newsletter content block draft.
 */
function _buildNewsletterBlock(price, anomalyResult) {
  const ts = price.timestamp_utc || price.fetched_at_utc;
  const ozUsd = price.xau_usd_per_oz || price.gold?.ounce_usd;
  const gAed = price.aed_per_gram_24k || price.gold?.gram_aed;
  const k22 = price.karats_aed_per_gram?.['22k'];
  const k21 = price.karats_aed_per_gram?.['21k'];
  const k18 = price.karats_aed_per_gram?.['18k'];

  const titleEn = `Newsletter Block — Gold Prices — ${new Date(ts || Date.now()).toDateString()}`;
  const titleAr = `كتلة النشرة البريدية — أسعار الذهب — ${new Date(ts || Date.now()).toLocaleDateString('ar-AE')}`;

  const bodyEn = [
    '## Newsletter Content Block',
    `**Data as of:** ${_fmtDate(ts)}`,
    '',
    '---',
    '### 🏅 Gold Price Reference',
    '',
    `**Global Spot (XAU/USD):** ${_fmtUsd(ozUsd)} per ounce`,
    '',
    '**UAE Prices by Karat (spot estimate, AED/gram)**',
    '| Karat | AED/gram |',
    '|-------|----------|',
    `| 24K   | ${_fmtAed(gAed)} |`,
    `| 22K   | ${_fmtAed(k22)} |`,
    `| 21K   | ${_fmtAed(k21)} |`,
    `| 18K   | ${_fmtAed(k18)} |`,
    '',
    '*Spot-based estimates only. Retail, jewellery, and making charges not included.*',
    '',
    '[View live tracker →](https://goldtickerlive.com/tracker.html)',
    '[Gold calculator →](https://goldtickerlive.com/calculator.html)',
    '',
    anomalyResult.anomaly_flag
      ? `⚠ **Note for editor:** Anomaly detected — ${anomalyResult.anomaly_detail}. Review before including price data in this block.`
      : '',
    '',
    '---',
    '',
    DISCLAIMER_EN,
    '',
    '---',
    '*[DRAFT — Requires editorial review and approval before sending.]*',
  ]
    .filter((l) => l !== undefined)
    .join('\n');

  const bodyAr = [
    '## كتلة النشرة البريدية',
    `**البيانات اعتباراً من:** ${_fmtDate(ts)}`,
    '',
    '---',
    '### 🏅 مرجع أسعار الذهب',
    '',
    `**السعر الفوري العالمي (XAU/USD):** ${_fmtUsd(ozUsd)} للأوقية`,
    '',
    '**الأسعار في الإمارات حسب العيار (سعر تقديري، درهم/جرام)**',
    '| العيار | الدرهم/جرام |',
    '|--------|-------------|',
    `| عيار 24 | ${_fmtAed(gAed)} |`,
    `| عيار 22 | ${_fmtAed(k22)} |`,
    `| عيار 21 | ${_fmtAed(k21)} |`,
    `| عيار 18 | ${_fmtAed(k18)} |`,
    '',
    '*أسعار تقديرية مبنية على السعر الفوري فقط. لا تشمل المصنعية أو الضريبة أو هامش التجزئة.*',
    '',
    anomalyResult.anomaly_flag
      ? `⚠ **ملاحظة للمحرر:** تم رصد شذوذ — ${anomalyResult.anomaly_detail}. راجع قبل إدراج البيانات.`
      : '',
    '',
    DISCLAIMER_AR,
    '',
    '---',
    '*[مسودة — تتطلب مراجعة وموافقة تحريرية قبل الإرسال.]*',
  ]
    .filter((l) => l !== undefined)
    .join('\n');

  return { titleEn, titleAr, bodyEn, bodyAr };
}

// ---------------------------------------------------------------------------
// Builder dispatch map
// ---------------------------------------------------------------------------

const BUILDERS = {
  daily_summary: (price, providerState, anomaly) => _buildDailySummary(price, anomaly),
  weekly_summary: (price, providerState, anomaly) => _buildWeeklySummary(price, anomaly),
  uae_gcc_summary: (price, providerState, anomaly) => _buildUaeGccSummary(price, anomaly),
  provider_report: (price, providerState, anomaly) =>
    _buildProviderReport(price, providerState, anomaly),
  seo_brief: (price, providerState, anomaly) => _buildSeoBrief(price, anomaly),
  x_post: (price, providerState, anomaly) => _buildXPost(price, anomaly),
  newsletter_block: (price, providerState, anomaly) => _buildNewsletterBlock(price, anomaly),
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate and persist a draft for the given type.
 * Runs anomaly detection automatically and embeds the result in the draft.
 *
 * @param {string} type - one of DRAFT_TYPES
 * @param {object} [options]
 * @param {object} [options.currentPrice]    - override gold_price.json
 * @param {object} [options.prevPrice]       - override last_gold_price.json
 * @param {object} [options.providerState]   - override provider_state.json
 * @returns {object} saved draft record
 */
function generateDraft(type, options = {}) {
  const builder = BUILDERS[type];
  if (!builder) {
    throw new Error(`Unknown draft type: ${type}. Valid: ${Object.keys(BUILDERS).join(', ')}`);
  }

  const price = options.currentPrice || _readJson(GOLD_PRICE_FILE) || {};
  const prevPrice = options.prevPrice || _readJson(LAST_GOLD_PRICE_FILE);
  const providerState = options.providerState || _readJson(PROVIDER_STATE_FILE);

  const anomalyResult = detectAnomaly(price, prevPrice);

  const { titleEn, titleAr, bodyEn, bodyAr } = builder(price, providerState, anomalyResult);

  const draft = insertDraft({
    type,
    title_en: titleEn,
    title_ar: titleAr,
    body_en: bodyEn,
    body_ar: bodyAr,
    data_snapshot: {
      xau_usd_per_oz: price.xau_usd_per_oz ?? price.gold?.ounce_usd ?? null,
      aed_per_gram_24k: price.aed_per_gram_24k ?? price.gold?.gram_aed ?? null,
      provider: price.provider ?? price.source ?? null,
      is_fresh: price.is_fresh ?? null,
      is_fallback: price.is_fallback ?? null,
    },
    data_timestamp_utc: price.timestamp_utc || price.fetched_at_utc || null,
    anomaly_flag: anomalyResult.anomaly_flag,
    anomaly_detail: anomalyResult.anomaly_detail,
  });

  return draft;
}

/**
 * Generate multiple draft types in one call.
 * @param {string[]} types
 * @param {object} [options]
 * @returns {object[]} saved draft records
 */
function generateDrafts(types, options = {}) {
  // Load shared price data once
  const price = options.currentPrice || _readJson(GOLD_PRICE_FILE) || {};
  const prevPrice = options.prevPrice || _readJson(LAST_GOLD_PRICE_FILE);
  const providerState = options.providerState || _readJson(PROVIDER_STATE_FILE);
  const sharedOptions = { ...options, currentPrice: price, prevPrice, providerState };

  return types.map((type) => generateDraft(type, sharedOptions));
}

module.exports = {
  generateDraft,
  generateDrafts,
  BUILDERS,
  // Exposed for testing
  DISCLAIMER_EN,
  DISCLAIMER_AR,
  SPECULATION_EN,
  SPECULATION_AR,
};
