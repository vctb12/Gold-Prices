/**
 * components/ticker.js — Premium bottom gold price ticker.
 * Slim fixed bar with smooth scrolling gold prices.
 *
 * Honors AGENTS.md §6.2: the ticker's `data-freshness` attribute reflects
 * `getLiveFreshness()` ('live' | 'cached' | 'stale' | 'unavailable'), a
 * status pill surfaces the label + relative age next to the close button,
 * and the pill's tooltip discloses the source timestamp. Pass `updatedAt`
 * + `hasLiveFailure` in `updateTicker()` so callers that already track
 * those can forward them unchanged.
 *
 * API:
 *   injectTicker(lang, depth)    — create & mount the ticker
 *   updateTicker(data)           — update displayed values + freshness state
 *   updateTickerLang(lang)       — switch language labels live
 */

import { getLiveFreshness } from '../lib/live-status.js';

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────

const TICKER_ITEMS = [
  {
    key: 'xauUsd',
    labelEn: 'XAU/USD',
    labelAr: 'XAU/USD',
    fmt: (v) =>
      `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
  },
  {
    key: 'uae24k',
    labelEn: 'UAE 24K/g (AED)',
    labelAr: 'الإمارات 24K/غ (AED)',
    fmt: (v) => v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  },
  {
    key: 'uae22k',
    labelEn: 'UAE 22K/g (AED)',
    labelAr: 'الإمارات 22K/غ (AED)',
    fmt: (v) => v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  },
  {
    key: 'uae21k',
    labelEn: 'UAE 21K/g (AED)',
    labelAr: 'الإمارات 21K/غ (AED)',
    fmt: (v) => v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  },
  {
    key: 'uae18k',
    labelEn: 'UAE 18K/g (AED)',
    labelAr: 'الإمارات 18K/غ (AED)',
    fmt: (v) => v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  },
];

const DISMISSED_KEY = 'gp-ticker-dismissed';

let _tickerEl = null;
let _currentLang = 'en';

function freshnessLabel(key, lang) {
  const isAr = lang === 'ar';
  switch (key) {
    case 'live':
      return isAr ? 'مباشر' : 'Live';
    case 'delayed':
      return isAr ? 'متأخر قليلاً' : 'Delayed';
    case 'cached':
      return isAr ? 'مخزن مؤقتاً' : 'Cached';
    case 'stale':
      return isAr ? 'قديم' : 'Stale';
    case 'fallback':
      return isAr ? 'بديل احتياطي' : 'Fallback';
    case 'unavailable':
    default:
      return isAr ? 'غير متاح' : 'Unavailable';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function buildCopyNode(lang, trackerHref) {
  const isAr = lang === 'ar';
  const div = document.createElement('div');
  div.className = 'ticker-copy';
  div.setAttribute('aria-hidden', 'true');
  for (const item of TICKER_ITEMS) {
    const label = isAr ? item.labelAr : item.labelEn;
    const a = document.createElement('a');
    a.href = trackerHref;
    a.className = 'ticker-item';
    a.setAttribute('data-key', item.key);
    a.tabIndex = -1;
    const lblSpan = document.createElement('span');
    lblSpan.className = 'ticker-label';
    lblSpan.textContent = label;
    const valSpan = document.createElement('span');
    valSpan.className = 'ticker-value';
    valSpan.textContent = '\u2014';
    a.appendChild(lblSpan);
    a.appendChild(valSpan);
    div.appendChild(a);
    const sep = document.createElement('span');
    sep.className = 'ticker-sep';
    sep.setAttribute('aria-hidden', 'true');
    sep.textContent = '\u25e6';
    div.appendChild(sep);
  }
  return div;
}

// ─────────────────────────────────────────────────────────────────────────────
// injectTicker
// ─────────────────────────────────────────────────────────────────────────────

export function injectTicker(lang = 'en', depth = 0) {
  if (document.getElementById('gold-ticker')) return; // already injected

  _currentLang = lang;
  const isAr = lang === 'ar';
  const trackerHref = depth === 0 ? 'tracker.html' : '../'.repeat(depth) + 'tracker.html';
  const dismissLabel = isAr ? 'إغلاق الشريط' : 'Dismiss ticker';
  const ariaLabel = isAr ? 'شريط أسعار الذهب' : 'Live gold price ticker';
  const unavailableLabel = freshnessLabel('unavailable', lang);

  // Two identical copies so the animation creates a seamless loop — built via
  // DOM to eliminate the innerHTML sink.
  const ticker = document.createElement('div');
  ticker.id = 'gold-ticker';
  ticker.className = 'gold-ticker';
  ticker.setAttribute('role', 'status');
  ticker.setAttribute('aria-live', 'polite');
  ticker.setAttribute('aria-label', ariaLabel);
  ticker.setAttribute('data-freshness', 'unavailable');

  const statusSpan = document.createElement('span');
  statusSpan.className = 'ticker-status';
  statusSpan.setAttribute('data-ticker-status', '');
  statusSpan.title = unavailableLabel;
  statusSpan.setAttribute('aria-label', unavailableLabel);
  const dot = document.createElement('span');
  dot.className = 'ticker-status-dot';
  dot.setAttribute('aria-hidden', 'true');
  const statusLabel = document.createElement('span');
  statusLabel.className = 'ticker-status-label';
  statusLabel.setAttribute('data-ticker-status-label', '');
  statusLabel.textContent = unavailableLabel;
  statusSpan.appendChild(dot);
  statusSpan.appendChild(statusLabel);

  const track = document.createElement('div');
  track.className = 'ticker-track';
  track.appendChild(buildCopyNode(lang, trackerHref));
  track.appendChild(buildCopyNode(lang, trackerHref));

  const closeBtn = document.createElement('button');
  closeBtn.className = 'ticker-close';
  closeBtn.id = 'ticker-close';
  closeBtn.setAttribute('aria-label', dismissLabel);
  closeBtn.title = dismissLabel;
  closeBtn.textContent = '\xd7';

  ticker.appendChild(statusSpan);
  ticker.appendChild(track);
  ticker.appendChild(closeBtn);

  document.body.appendChild(ticker);
  document.body.classList.add('has-ticker');
  _tickerEl = ticker;

  // Restore dismissed state from sessionStorage
  try {
    if (sessionStorage.getItem(DISMISSED_KEY) === '1') {
      ticker.classList.add('ticker-dismissed');
      document.body.classList.remove('has-ticker');
    }
  } catch {
    /* storage blocked */
  }

  // Close button — wire directly to the closeBtn reference (already in DOM tree)
  closeBtn.addEventListener('click', () => {
    ticker.classList.add('ticker-dismissed');
    document.body.classList.remove('has-ticker');
    try {
      sessionStorage.setItem(DISMISSED_KEY, '1');
    } catch {
      /* blocked */
    }
  });

  // Pause on hover (desktop) — reuse the `track` node already in scope
  if (track) {
    track.addEventListener('mouseenter', () => {
      track.querySelectorAll('.ticker-copy').forEach((c) => {
        c.style.animationPlayState = 'paused';
      });
    });
    track.addEventListener('mouseleave', () => {
      track.querySelectorAll('.ticker-copy').forEach((c) => {
        c.style.animationPlayState = '';
      });
    });
  }

  // prefers-reduced-motion: stop animation
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    ticker.querySelectorAll('.ticker-copy').forEach((c) => {
      c.style.animation = 'none';
    });
    if (track) track.style.overflowX = 'auto';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// updateTicker
// ─────────────────────────────────────────────────────────────────────────────

export function updateTicker(data = {}) {
  TICKER_ITEMS.forEach((item) => {
    const val = data[item.key];
    if (val == null) return;
    const formatted = item.fmt(val);
    // Update all copies (both ticker-copy divs)
    document
      .querySelectorAll(`.ticker-item[data-key="${item.key}"] .ticker-value`)
      .forEach((el) => {
        el.textContent = formatted;
      });
  });

  // Freshness pill (§6.2). Three-way contract on `data-updatedAt`:
  //   - truthy ISO string  → recompute freshness from it
  //   - explicit `null`    → reset the pill to "unavailable"
  //   - omitted / undefined → preserve last-rendered state (never silently
  //                          regress to "live" without a fresh timestamp
  //                          to back it)
  const bar = _tickerEl || document.getElementById('gold-ticker');
  if (!bar) return;
  if (data.updatedAt) {
    const fresh = getLiveFreshness({
      updatedAt: data.updatedAt,
      lang: _currentLang,
      hasLiveFailure: Boolean(data.hasLiveFailure),
      isFallback: data.isFallback ?? null,
      isFresh: data.isFresh ?? null,
    });
    bar.setAttribute('data-freshness', fresh.key);
    const label = freshnessLabel(fresh.key, _currentLang);
    const statusEl = bar.querySelector('[data-ticker-status]');
    const labelEl = bar.querySelector('[data-ticker-status-label]');
    if (labelEl) labelEl.textContent = label;
    if (statusEl) {
      const tooltip = `${label} · ${fresh.timeText} (${fresh.ageText})`;
      statusEl.setAttribute('title', tooltip);
      statusEl.setAttribute('aria-label', tooltip);
    }
  } else if (data.updatedAt === null) {
    bar.setAttribute('data-freshness', 'unavailable');
    const label = freshnessLabel('unavailable', _currentLang);
    const statusEl = bar.querySelector('[data-ticker-status]');
    const labelEl = bar.querySelector('[data-ticker-status-label]');
    if (labelEl) labelEl.textContent = label;
    if (statusEl) {
      statusEl.setAttribute('title', label);
      statusEl.setAttribute('aria-label', label);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// updateTickerLang
// ─────────────────────────────────────────────────────────────────────────────

export function updateTickerLang(lang) {
  _currentLang = lang;
  const isAr = lang === 'ar';
  TICKER_ITEMS.forEach((item) => {
    const label = isAr ? item.labelAr : item.labelEn;
    document
      .querySelectorAll(`.ticker-item[data-key="${item.key}"] .ticker-label`)
      .forEach((el) => {
        el.textContent = label;
      });
  });
  // Re-translate the status pill label to the current freshness key.
  // Note: this updates the short label (e.g. "Cached" → "مخزن مؤقتاً")
  // but deliberately does NOT touch the title tooltip, which carries the
  // timestamp + age text set by updateTicker() — a subsequent updateTicker()
  // call rebuilds that in the active language. Updating title here without
  // access to the original {timeText, ageText} would strip that detail.
  const bar = _tickerEl || document.getElementById('gold-ticker');
  if (!bar) return;
  const key = bar.getAttribute('data-freshness') || 'unavailable';
  const label = freshnessLabel(key, lang);
  const statusEl = bar.querySelector('[data-ticker-status]');
  const labelEl = bar.querySelector('[data-ticker-status-label]');
  if (labelEl) labelEl.textContent = label;
  if (statusEl) {
    // Keep title + aria-label in sync; both fall back to the short label
    // until the next updateTicker() call restores the timestamped tooltip.
    statusEl.setAttribute('title', label);
    statusEl.setAttribute('aria-label', label);
  }
}
