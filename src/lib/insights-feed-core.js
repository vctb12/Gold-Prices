/**
 * Insights feed — pure logic core.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * DOM-free, dependency-free helpers so the filter / search / read-time / price
 * context behaviour can be unit tested in isolation (see
 * tests/insights-feed-core.test.js). The rendering layer
 * (src/components/insights-feed.js) imports these.
 */

const WORDS_PER_MINUTE = 200;

// Minimum absolute week-over-week move (in %) before the price context card
// labels the market as up or down rather than flat.
const DIRECTION_THRESHOLD_PCT = 0.05;

/**
 * Count words in a plain-text string. Collapses any whitespace run.
 * @param {string} text
 * @returns {number}
 */
export function wordCount(text) {
  if (typeof text !== 'string') return 0;
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

/**
 * Estimate reading time in whole minutes (minimum 1) from a word count.
 * @param {number} words
 * @param {number} [wpm=200]
 * @returns {number}
 */
export function estimateReadMinutes(words, wpm = WORDS_PER_MINUTE) {
  const safeWords = Number.isFinite(words) && words > 0 ? words : 0;
  const safeWpm = Number.isFinite(wpm) && wpm > 0 ? wpm : WORDS_PER_MINUTE;
  return Math.max(1, Math.round(safeWords / safeWpm));
}

/**
 * Format a read-time label in the requested language.
 * @param {number} minutes
 * @param {'en'|'ar'} [lang='en']
 * @returns {string}
 */
export function formatReadTime(minutes, lang = 'en') {
  const m = Math.max(1, Math.round(minutes));
  return lang === 'ar' ? `قراءة ${m} دقائق` : `${m} min read`;
}

/**
 * Sort a copy of the insights newest-first by `dateIso`. Featured items are
 * kept in date order too; the caller decides how to surface the featured one.
 * @param {Array<object>} insights
 * @returns {Array<object>}
 */
export function sortByDateDesc(insights) {
  return [...(insights || [])].sort((a, b) => {
    const da = a && a.dateIso ? a.dateIso : '';
    const db = b && b.dateIso ? b.dateIso : '';
    if (da === db) return 0;
    return da < db ? 1 : -1;
  });
}

/**
 * Return the single featured insight (the first with `featured: true`), or the
 * newest insight if none is explicitly flagged. Returns null for empty input.
 * @param {Array<object>} insights
 * @returns {object|null}
 */
export function getFeatured(insights) {
  if (!Array.isArray(insights) || insights.length === 0) return null;
  const flagged = insights.find((i) => i && i.featured);
  if (flagged) return flagged;
  return sortByDateDesc(insights)[0];
}

/**
 * Normalise a search query: lowercase + collapsed whitespace.
 * @param {string} query
 * @returns {string}
 */
function normaliseQuery(query) {
  return typeof query === 'string' ? query.trim().toLowerCase() : '';
}

/**
 * Does an insight match a (already-normalised) query in the given language?
 * Matches against title + excerpt text for that language.
 */
function matchesQuery(insight, query, lang) {
  if (!query) return true;
  const title = (insight.title && insight.title[lang]) || (insight.title && insight.title.en) || '';
  const excerpt =
    (insight.excerpt && insight.excerpt[lang]) || (insight.excerpt && insight.excerpt.en) || '';
  return `${title} ${excerpt}`.toLowerCase().includes(query);
}

/**
 * Filter insights by category and/or free-text search.
 * @param {Array<object>} insights
 * @param {{ category?: string, query?: string, lang?: 'en'|'ar' }} [opts]
 * @returns {Array<object>}
 */
export function filterInsights(insights, opts = {}) {
  const { category = 'all', query = '', lang = 'en' } = opts;
  const q = normaliseQuery(query);
  return (insights || []).filter((insight) => {
    if (!insight) return false;
    if (category && category !== 'all' && insight.category !== category) return false;
    return matchesQuery(insight, q, lang);
  });
}

/**
 * Count how many insights fall into each category. The synthetic `all`
 * category always equals the total number of insights.
 * @param {Array<object>} insights
 * @param {Array<{id: string}>} categories
 * @returns {Record<string, number>}
 */
export function categoryCounts(insights, categories) {
  const counts = {};
  for (const cat of categories || []) counts[cat.id] = 0;
  for (const insight of insights || []) {
    if (!insight) continue;
    if ('all' in counts) counts.all += 1;
    if (insight.category in counts) counts[insight.category] += 1;
  }
  return counts;
}

/**
 * Compute the AED 22K-per-gram price from XAU/USD spot.
 * @param {number} usdPerOz
 * @param {{ aedPeg: number, troyGrams: number, karat22Purity: number }} consts
 * @returns {number}
 */
export function aed22kPerGram(usdPerOz, consts) {
  if (!usdPerOz || usdPerOz <= 0) return 0;
  return (usdPerOz / consts.troyGrams) * consts.karat22Purity * consts.aedPeg;
}

/**
 * Build the "Related to current gold price" contextual callout payload from
 * the current spot price and a reference price one week ago.
 *
 * Pure: returns a descriptor object; the renderer turns it into DOM. Returns
 * null when there is not enough data to make an honest statement.
 *
 * @param {{ currentUsd: number, weekAgoUsd: number, lang?: 'en'|'ar' }} input
 * @returns {{ direction: 'up'|'down'|'flat', pct: number, headline: string, body: string }|null}
 */
export function buildPriceContext(input = {}) {
  const { currentUsd, weekAgoUsd, lang = 'en' } = input;
  if (!currentUsd || currentUsd <= 0 || !weekAgoUsd || weekAgoUsd <= 0) return null;

  const pct = ((currentUsd - weekAgoUsd) / weekAgoUsd) * 100;
  const rounded = Math.round(pct * 100) / 100;
  const abs = Math.abs(rounded).toFixed(2);

  let direction = 'flat';
  if (rounded >= DIRECTION_THRESHOLD_PCT) direction = 'up';
  else if (rounded <= -DIRECTION_THRESHOLD_PCT) direction = 'down';

  const en = {
    up: {
      headline: `Gold is up ${abs}% from last week`,
      body: 'Spot prices have risen over the past 7 days. Compare against the tracker’s rolling average before timing a purchase.',
    },
    down: {
      headline: `Gold is down ${abs}% from last week`,
      body: 'Spot prices have eased over the past 7 days. A softer market can be a window for buyers — check the live tracker for the latest.',
    },
    flat: {
      headline: 'Gold is roughly flat from last week',
      body: 'Spot prices have held steady over the past 7 days. Stable phases are useful for budgeting a purchase.',
    },
  };

  const ar = {
    up: {
      headline: `ارتفع الذهب بنسبة ${abs}% عن الأسبوع الماضي`,
      body: 'ارتفعت الأسعار الفورية خلال 7 أيام. قارنها بالمتوسط المتحرك في المتتبع قبل تحديد توقيت الشراء.',
    },
    down: {
      headline: `انخفض الذهب بنسبة ${abs}% عن الأسبوع الماضي`,
      body: 'تراجعت الأسعار الفورية خلال 7 أيام. قد يكون السوق الأكثر ليونة فرصة للمشترين — راجع المتتبع المباشر لأحدث الأسعار.',
    },
    flat: {
      headline: 'استقر الذهب تقريباً مقارنة بالأسبوع الماضي',
      body: 'ظلت الأسعار الفورية مستقرة خلال 7 أيام. المراحل المستقرة مفيدة لوضع ميزانية الشراء.',
    },
  };

  const copy = (lang === 'ar' ? ar : en)[direction];
  return { direction, pct: rounded, headline: copy.headline, body: copy.body };
}
