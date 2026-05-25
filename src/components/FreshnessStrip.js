import { BASE_PATH, TRANSLATIONS } from '../config/index.js';
import { clear, el, safeHref } from '../lib/safe-dom.js';

const VALID_STATES = new Set([
  'live',
  'delayed',
  'cached',
  'stale',
  'fallback',
  'closed',
  'unavailable',
]);

function t(lang, key, params = {}) {
  const template = TRANSLATIONS[lang]?.[key] ?? TRANSLATIONS.en?.[key] ?? key;
  return Object.entries(params).reduce(
    (text, [token, value]) => text.replaceAll(`{${token}}`, String(value)),
    template
  );
}

function normalizeState(state) {
  return VALID_STATES.has(state) ? state : 'unavailable';
}

function normalizeTimestamp(timestamp) {
  if (!timestamp) return '';
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  return Number.isFinite(date.getTime()) ? date.toISOString() : '';
}

function formatRelativeTimestamp(timestamp, lang) {
  const iso = normalizeTimestamp(timestamp);
  if (!iso) return '—';

  const ageMs = Math.max(0, Date.now() - new Date(iso).getTime());
  if (ageMs < 60 * 1000) return t(lang, 'freshness.strip.agoJustNow');

  const locale = lang === 'ar' ? 'ar-AE' : 'en-US';
  const number = new Intl.NumberFormat(locale);

  if (ageMs < 60 * 60 * 1000) {
    const minutes = Math.max(1, Math.floor(ageMs / (60 * 1000)));
    return t(lang, 'freshness.strip.agoMinutes', { count: number.format(minutes) });
  }

  const hours = Math.max(1, Math.floor(ageMs / (60 * 60 * 1000)));
  return t(lang, 'freshness.strip.agoHours', { count: number.format(hours) });
}

function getMethodologyHref() {
  if (typeof location === 'undefined') return 'methodology.html';

  const pathname = String(location.pathname || '/');
  const basePath = String(BASE_PATH || '/');
  let relativePath = pathname;

  if (basePath !== '/' && pathname.startsWith(basePath)) {
    relativePath = pathname.slice(basePath.length - 1) || '/';
  }

  const directoryPath = relativePath.endsWith('/')
    ? relativePath
    : relativePath.replace(/\/[^/]*$/, '/') || '/';
  const depth = directoryPath
    .replace(/^\/+|\/+$/g, '')
    .split('/')
    .filter(Boolean).length;
  const prefix = depth ? `${'../'.repeat(depth)}` : '';

  return `${prefix}methodology.html`;
}

/**
 * Mount a shared freshness strip into the target container.
 *
 * @param {{
 *   containerId: string,
 *   state?: 'live'|'delayed'|'cached'|'stale'|'fallback'|'closed'|'unavailable',
 *   lang?: 'en'|'ar',
 *   source?: string,
 *   timestamp?: string|Date|number|null,
 * }} options
 * @returns {HTMLElement|null}
 */
export function renderFreshnessStrip({
  containerId,
  state = 'unavailable',
  lang = 'en',
  source = 'Gold Ticker Live',
  timestamp = null,
} = {}) {
  const container = document.getElementById(containerId);
  if (!container) return null;

  const normalizedState = normalizeState(state);
  const normalizedTimestamp = normalizeTimestamp(timestamp);
  const sourceText = String(source || 'Gold Ticker Live').trim() || 'Gold Ticker Live';
  const methodologyHref = safeHref(getMethodologyHref());

  const strip = el(
    'div',
    {
      class: 'freshness-strip',
      role: 'status',
      'aria-live': 'polite',
      'aria-atomic': 'true',
      dataset: {
        freshnessState: normalizedState,
        freshnessSource: sourceText,
        freshnessTimestamp: normalizedTimestamp,
      },
    },
    [
      el('span', { class: 'freshness-strip__dot', 'aria-hidden': 'true' }),
      el(
        'span',
        { class: 'freshness-strip__label' },
        t(lang, `freshness.strip.${normalizedState}`)
      ),
      el(
        'span',
        { class: 'freshness-strip__source' },
        `${t(lang, 'freshness.strip.source')}: ${sourceText}`
      ),
      el(
        'span',
        { class: 'freshness-strip__time' },
        formatRelativeTimestamp(normalizedTimestamp, lang)
      ),
      el(
        'a',
        { class: 'freshness-strip__link', href: methodologyHref || 'methodology.html' },
        t(lang, 'freshness.strip.methodology')
      ),
    ]
  );

  clear(container);
  container.append(strip);
  container.hidden = false;
  return strip;
}
