/**
 * shops/helpers.js - Extract helper functions from shops.js
 * Reduces complexity by separating utility logic from main module
 */

import { COUNTRIES } from '../../config/countries.js';

const REGIONS = {
  gcc: { en: 'GCC', ar: 'الخليج' },
  levant: { en: 'Levant', ar: 'بلاد الشام' },
  africa: { en: 'Africa', ar: 'أفريقيا' },
  global: { en: 'Global', ar: 'عالمي' },
};

export function countryByCode(code) {
  return COUNTRIES.find((country) => country.code === code);
}

export function countryName(country, lang) {
  return lang === 'ar' ? country.nameAr : country.nameEn;
}

export function regionName(group, lang) {
  return REGIONS[group]?.[lang] || group;
}

export function detailsAvailabilityLabel(value, t) {
  if (value === 'full') return t('detailsFull');
  if (value === 'partial') return t('detailsPartial');
  return t('detailsLimited');
}

export function detailsAvailabilityRank(value) {
  if (value === 'full') return 3;
  if (value === 'partial') return 2;
  return 1;
}

export function contactQualityScore(shop) {
  if (shop.contactQuality === 'high') return 3;
  if (shop.contactQuality === 'medium') return 2;
  return 1;
}

export function contactQualityLabel(shop, t) {
  const score = contactQualityScore(shop);
  if (score === 3) return t('rankFull');
  if (score === 2) return t('rankPartial');
  return t('rankLimited');
}

export function calculateConfidenceBadge(shop) {
  let score = shop.confidence || 50;

  if (shop.verified) score = Math.min(100, score + 10);
  if (shop.contactQuality === 'high') score = Math.min(100, score + 5);
  if (shop.contactQuality === 'low') score = Math.max(0, score - 5);

  if (score >= 90) return { level: 'high', label: `${score}%`, color: 'green' };
  if (score >= 70) return { level: 'medium', label: `${score}%`, color: 'amber' };
  return { level: 'low', label: `${score}%`, color: 'red' };
}

export function isMarketArea(shop) {
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

export function listingTypeLabel(shop, t) {
  if (isMarketArea(shop)) return t('marketAreaListing');
  return t('storeProfile');
}

export function listingSortScore(shop) {
  const detailRank = detailsAvailabilityRank(shop.detailsAvailability);
  const contactBonus = shop.phone && shop.website ? 2 : shop.phone || shop.website ? 1 : 0;
  const typeBonus = isMarketArea(shop) ? 0 : 1;
  return detailRank * 100 + contactBonus * 10 + typeBonus;
}

export function sortedShops(shops, lang) {
  return [...shops].sort((a, b) => {
    const scoreDiff = listingSortScore(b) - listingSortScore(a);
    if (scoreDiff !== 0) return scoreDiff;
    const featuredDiff = Number(Boolean(b.featured)) - Number(Boolean(a.featured));
    if (featuredDiff !== 0) return featuredDiff;
    return a.name.localeCompare(b.name, lang);
  });
}

export function saveShortlistToStorage(shortlist) {
  try {
    localStorage.setItem('shops_shortlist', JSON.stringify(shortlist));
  } catch {}
}
