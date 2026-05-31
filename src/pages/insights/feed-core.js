/**
 * Insights feed — pure logic (no DOM).
 *
 * Kept framework-free and side-effect-free so it can be unit tested directly.
 * The DOM renderer in feed.js consumes these helpers.
 */

const WORDS_PER_MINUTE = 200;

/**
 * Estimate read time from a word count at 200 wpm (minimum 1 minute).
 * @param {number} words
 * @returns {number} whole minutes
 */
export function readTimeMinutes(words) {
  const n = Number(words);
  if (!Number.isFinite(n) || n <= 0) return 1;
  return Math.max(1, Math.round(n / WORDS_PER_MINUTE));
}

/**
 * Bilingual read-time label, e.g. "4 min read" / "قراءة ٤ دقائق".
 * @param {number} words
 * @param {'en'|'ar'} lang
 */
export function readTimeLabel(words, lang = 'en') {
  const mins = readTimeMinutes(words);
  if (lang === 'ar') {
    const arDigits = String(mins).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);
    return `قراءة ${arDigits} دقائق`;
  }
  return `${mins} min read`;
}

/**
 * Localised, accessible publish-date label.
 * @param {string} iso  YYYY-MM-DD
 * @param {'en'|'ar'} lang
 */
export function formatDate(iso, lang = 'en') {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-GB', {
    year: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

/**
 * Count entries per category key. Returns a map including a synthetic `all` key.
 * @param {Array} items
 * @returns {Record<string, number>}
 */
export function categoryCounts(items) {
  const counts = { all: items.length };
  for (const item of items) {
    counts[item.category] = (counts[item.category] || 0) + 1;
  }
  return counts;
}

/**
 * Filter insights by category and free-text query (matches title + excerpt in the
 * active language). `category === 'all'` disables category filtering.
 * @param {Array} items
 * @param {{category?: string, query?: string, lang?: 'en'|'ar'}} opts
 */
export function filterInsights(items, { category = 'all', query = '', lang = 'en' } = {}) {
  const q = String(query).trim().toLowerCase();
  return items.filter((item) => {
    if (category && category !== 'all' && item.category !== category) return false;
    if (!q) return true;
    const title = (item.title?.[lang] || item.title?.en || '').toLowerCase();
    const excerpt = (item.excerpt?.[lang] || item.excerpt?.en || '').toLowerCase();
    return title.includes(q) || excerpt.includes(q);
  });
}

/**
 * Pick the featured entry (explicit `featured: true`, else the most recent).
 * @param {Array} items
 */
export function getFeatured(items) {
  if (!items.length) return null;
  const flagged = items.find((i) => i.featured);
  if (flagged) return flagged;
  return [...items].sort((a, b) => (a.date < b.date ? 1 : -1))[0];
}

/**
 * Build the dynamic "related to current gold price" callout.
 *
 * @param {{changePct?: number|null, lang?: 'en'|'ar', href?: string}} opts
 * @returns {{direction:'up'|'down'|'flat', pctText:string, headline:string, body:string, href:string, cta:string}}
 */
export function buildPriceCallout({ changePct = null, lang = 'en', href = 'tracker.html' } = {}) {
  const ar = lang === 'ar';
  const valid = changePct != null && Number.isFinite(changePct);
  const abs = valid ? Math.abs(changePct) : 0;
  const direction = !valid || abs < 0.05 ? 'flat' : changePct > 0 ? 'up' : 'down';

  const pctText = valid ? `${changePct >= 0 ? '+' : '−'}${abs.toFixed(2)}%` : '—';

  const headline = ar ? 'مرتبط بسعر الذهب اليوم' : 'Related to today’s gold price';

  let body;
  if (!valid) {
    body = ar
      ? 'تابع كيف يتغيّر سعر الذهب الفوري عبر دول الخليج وعلى مدار الوقت.'
      : 'Track how the live spot price moves across the GCC and over time.';
  } else if (direction === 'up') {
    body = ar
      ? `الذهب ▲ مرتفع بنسبة ${abs.toFixed(2)}% عن الأسبوع الماضي. اطّلع على ما يحرّك السعر.`
      : `Gold is ▲ up ${abs.toFixed(2)}% from last week. See what is driving the move.`;
  } else if (direction === 'down') {
    body = ar
      ? `الذهب ▼ منخفض بنسبة ${abs.toFixed(2)}% عن الأسبوع الماضي. اطّلع على ما يحرّك السعر.`
      : `Gold is ▼ down ${abs.toFixed(2)}% from last week. See what is driving the move.`;
  } else {
    body = ar
      ? 'الذهب مستقر تقريباً مقارنة بالأسبوع الماضي. تابع الأسعار المباشرة.'
      : 'Gold is roughly flat versus last week. Track the live price.';
  }

  return {
    direction,
    pctText,
    headline,
    body,
    href,
    cta: ar ? 'افتح المتتبع المباشر ←' : 'Open the live tracker →',
  };
}

/**
 * No-results helper text for the search empty state.
 * @param {string} query
 * @param {'en'|'ar'} lang
 */
export function noResultsText(query, lang = 'en') {
  const q = String(query).trim();
  if (lang === 'ar') {
    return `لا توجد رؤى تطابق «${q}». جرّب «عيار» أو «دبي».`;
  }
  return `No insights match “${q}”. Try ‘karat’ or ‘Dubai’.`;
}

/**
 * Weekly (~7-day) percentage change of the spot price using locally cached daily
 * snapshots ({ date:'YYYY-MM-DD', price }). Returns null when there is no snapshot
 * within a sensible window (4–10 days ago), so callers can fall back gracefully.
 *
 * @param {Array<{date:string, price:number}>} history
 * @param {number} spotUsd  current spot USD/oz
 * @param {number} [nowMs]  reference time (defaults to Date.now())
 * @returns {number|null} percentage change, or null
 */
export function weeklyChangePct(history, spotUsd, nowMs = Date.now()) {
  if (!Array.isArray(history) || !history.length) return null;
  if (!Number.isFinite(spotUsd) || spotUsd <= 0) return null;

  const DAY = 86_400_000;
  // Accept a snapshot that is genuinely "about a week" old: within ±3 days of the
  // 7-day target, i.e. 4–10 days ago. Anything outside that window is not "last week".
  const SNAPSHOT_WINDOW_DAYS = 3;
  const target = nowMs - 7 * DAY;
  let best = null;
  let bestDist = Infinity;
  for (const rec of history) {
    if (!rec || !rec.date || !Number.isFinite(rec.price) || rec.price <= 0) continue;
    const t = new Date(`${rec.date}T00:00:00Z`).getTime();
    if (Number.isNaN(t)) continue;
    const dist = Math.abs(t - target);
    if (dist < bestDist) {
      bestDist = dist;
      best = rec;
    }
  }
  if (!best || bestDist > SNAPSHOT_WINDOW_DAYS * DAY) return null;
  return ((spotUsd - best.price) / best.price) * 100;
}
