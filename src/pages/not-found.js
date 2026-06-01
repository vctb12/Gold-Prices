/**
 * 404 page entry point.
 *
 * - Injects shared nav and footer.
 * - Applies bilingual (EN / AR) translations from the shared translations file.
 * - Pre-fills the search input with the failing URL slug.
 * - Renders a live reference-price pill from the local price cache.
 * - Logs a redacted analytics error event for the 404 hit.
 * - Registers a global error handler to log SPA render errors.
 */

import { mountSharedShell } from '../components/site-shell.js';
import { TRANSLATIONS } from '../config/translations.js';
import { getLiveFreshness } from '../lib/live-status.js';

// ── Language helpers ───────────────────────────────────────────────────────

function getLang() {
  try {
    const p = JSON.parse(localStorage.getItem('user_prefs') || '{}');
    return p.lang === 'ar' ? 'ar' : 'en';
  } catch {
    return 'en';
  }
}

function tx(lang, key) {
  return TRANSLATIONS[lang]?.[key] ?? TRANSLATIONS.en?.[key] ?? key;
}

// ── Apply translations to DOM ──────────────────────────────────────────────

function applyLang(lang) {
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';

  // Text content
  document.querySelectorAll('[data-tx]').forEach((el) => {
    const text = tx(lang, el.dataset.tx);
    if (text && text !== el.dataset.tx) el.textContent = text;
  });

  // Input placeholder
  document.querySelectorAll('[data-tx-placeholder]').forEach((el) => {
    const text = tx(lang, el.dataset.txPlaceholder);
    if (text && text !== el.dataset.txPlaceholder) el.placeholder = text;
  });

  // aria-label
  document.querySelectorAll('[data-tx-aria-label]').forEach((el) => {
    const text = tx(lang, el.dataset.txAriaLabel);
    if (text && text !== el.dataset.txAriaLabel) el.setAttribute('aria-label', text);
  });
}

// ── Search pre-fill ────────────────────────────────────────────────────────

/**
 * Extract the last meaningful path segment from the current URL and
 * pre-fill the search input so users can immediately refine or re-search.
 * Only populates when a non-trivial slug is found (not just '404' or '/').
 */
function prefillSearch() {
  const input = document.getElementById('nf-search-input');
  if (!input) return;

  const path = window.location.pathname;
  const slug =
    path
      .replace(/\.html?$/, '')
      .replace(/\/$/, '')
      .split('/')
      .filter(Boolean)
      .pop() || '';

  if (slug && slug !== '404' && slug !== 'index') {
    input.value = slug.replace(/[-_]/g, ' ');
  }
}

// ── Freshness pill ─────────────────────────────────────────────────────────

/**
 * Read the cached gold price from localStorage and populate the reference-
 * price pill so users can see a price even on the 404 page.
 * The pill is hidden by default; it is revealed only when valid cache data
 * is found (preventing confusing "—" states on first visit).
 *
 * @param {'en'|'ar'} lang
 */
function renderFreshnessPill(lang) {
  const pillEl = document.getElementById('nf-freshness-pill');
  if (!pillEl) return;

  try {
    const raw =
      localStorage.getItem('gold_price_cache') || localStorage.getItem('gold_price_fallback');
    if (!raw) return;

    const goldCache = JSON.parse(raw);
    if (!goldCache || !goldCache.price) return;

    const price = goldCache.price;
    const updatedAt = goldCache.updatedAt || null;

    const { key, ageText } = getLiveFreshness({ updatedAt, lang });

    // Format price as $X,XXX
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);

    const priceEl = document.getElementById('nf-spot-price');
    const ageEl = document.getElementById('nf-freshness-age');

    if (priceEl) priceEl.textContent = formatted;
    if (ageEl) {
      ageEl.textContent = ageText;
      ageEl.dataset.freshnessKey = key;
    }

    pillEl.hidden = false;
  } catch {
    // Non-fatal — pill stays hidden
  }
}

// ── Analytics error logging ────────────────────────────────────────────────

/**
 * Emit a redacted error event for the 404 hit.
 * Only the last path segment is sent — never query strings or hashes.
 */
function logNotFoundEvent() {
  try {
    const path = window.location.pathname;
    const lastSegment = path.split('/').filter(Boolean).pop() || '';
    const redacted = lastSegment ? `/${lastSegment}` : '/unknown';

    if (typeof window.gtag === 'function') {
      window.gtag('event', 'error', {
        type: '404',
        where: redacted,
      });
    }
  } catch {
    // Non-fatal
  }
}

/**
 * Catch SPA / module-level render errors and forward a redacted event.
 * Registered at module-evaluation time so it is active before any dynamic
 * code runs.
 */
window.addEventListener('error', (event) => {
  try {
    if (typeof window.gtag !== 'function') return;
    let where = 'unknown';
    if (event.filename) {
      // Keep only the last two path segments to avoid leaking full paths
      const segments = new URL(event.filename).pathname.split('/').filter(Boolean);
      where = segments.slice(-2).join('/') || 'unknown';
    }
    window.gtag('event', 'error', {
      type: 'render_error',
      where,
    });
  } catch {
    // Non-fatal
  }
});

// ── Init ───────────────────────────────────────────────────────────────────

const lang = getLang();
const shell = mountSharedShell({ lang, depth: 0 });
document.getElementById('nf-static-header')?.remove();
document.getElementById('nf-static-footer')?.remove();
applyLang(lang);
prefillSearch();
renderFreshnessPill(lang);
logNotFoundEvent();

// Re-apply lang if the user toggles it via the nav language button
document.addEventListener('langchange', (e) => {
  const newLang = e.detail?.lang === 'ar' ? 'ar' : 'en';
  applyLang(newLang);
  renderFreshnessPill(newLang);
  shell.updateLang(newLang);
});
