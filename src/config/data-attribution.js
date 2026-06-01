/**
 * Single source of truth for brand data attribution and refresh cadence copy.
 * Aligns with PLAN.md / README: GoldPriceZ (XAU/USD) + open.er-api.com (FX).
 */

import { CONSTANTS } from './constants.js';
import { KARATS } from './karats.js';

export const DATA_ATTRIBUTION = {
  gold: {
    label: 'GoldPriceZ',
    domain: 'goldpricez.com',
    url: 'https://goldpricez.com',
    roleEn: 'Gold spot price (XAU/USD)',
    roleAr: 'سعر الذهب الفوري (XAU/USD)',
  },
  fx: {
    label: 'open.er-api.com',
    url: 'https://open.er-api.com',
    roleEn: 'Foreign exchange rates (USD base)',
    roleAr: 'أسعار صرف العملات (أساس USD)',
  },
  clientPollSeconds: Math.round(CONSTANTS.GOLD_REFRESH_MS / 1000),
};

/** @returns {number} */
export function getKaratCount() {
  return KARATS.length;
}

/**
 * Marketing range label from configured karats (e.g. "14K–24K").
 * @param {'en'|'ar'} lang
 */
export function getKaratRangeLabel(lang = 'en') {
  const codes = KARATS.map((k) => k.code).sort((a, b) => Number(a) - Number(b));
  const low = codes[0];
  const high = codes[codes.length - 1];
  if (lang === 'ar') return `عيار ${low}–${high}`;
  return `${low}K–${high}K`;
}

/**
 * @param {'en'|'ar'} lang
 */
export function getKaratCountLabel(lang = 'en') {
  const n = getKaratCount();
  if (lang === 'ar') return `${n} عيارات`;
  return `${n} karats`;
}

/**
 * Server hourly + client ~90s refresh statement.
 * @param {'en'|'ar'} lang
 */
export function getRefreshStatement(lang = 'en') {
  const secs = DATA_ATTRIBUTION.clientPollSeconds;
  if (lang === 'ar') {
    return `يتم تحديث مصدر السعر كل ساعة خلال ساعات السوق؛ تعيد الصفحة الجلب كل ~${secs} ثانية أثناء التصفح.`;
  }
  return `Spot source updates hourly during market hours; this page re-polls about every ${secs} seconds while open.`;
}

/**
 * Short attribution line for meta / footers.
 * @param {'en'|'ar'} lang
 */
export function getAttributionSummary(lang = 'en') {
  const { gold, fx } = DATA_ATTRIBUTION;
  if (lang === 'ar') {
    return `الذهب: ${gold.label} (${gold.domain}) · الصرف: ${fx.label} · ${getRefreshStatement('ar')}`;
  }
  return `Gold: ${gold.label} (${gold.domain}) · FX: ${fx.label} · ${getRefreshStatement('en')}`;
}

/**
 * Millesimal fineness from purity (e.g. 0.9167 → 917).
 * @param {number} purity
 */
export function getMillesimalFineness(purity) {
  return Math.round(purity * 1000);
}

/**
 * Purity percent string for methodology table.
 * @param {number} purity
 */
export function formatPurityPercent(purity) {
  if (purity >= 1) return '99.9%';
  return `${(purity * 100).toFixed(1)}%`;
}
