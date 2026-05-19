/**
 * components/spotBar.js — Sticky top bar showing XAU/USD and 24K AED/gram.
 * Present on every page. Updates on each successful price fetch.
 *
 * Honors AGENTS.md §6.2: cached / stale / unavailable values are visibly
 * labelled. The bar's `data-freshness` attribute reflects
 * `getLiveFreshness()` ('live' | 'cached' | 'stale' | 'unavailable') and
 * the timestamp slot renders both the clock time and a relative age
 * (e.g. "2 min ago") so staleness is legible without hover.
 *
 * API:
 *   injectSpotBar(lang, depth) — create & mount the bar
 *   updateSpotBar(data)        — update {xauUsd, aed24kGram, updatedAt, hasLiveFailure}
 *   updateSpotBarLang(lang)    — switch language
 */

import { getLiveFreshness } from '../lib/live-status.js';

let _barEl = null;
let _prevXauUsd = null;
let _currentLang = 'en';
let _resizeObserver = null;
let _resizeHandler = null;

function syncSpotBarHeight() {
  if (!_barEl) return;
  const measuredHeight =
    typeof _barEl.getBoundingClientRect === 'function'
      ? _barEl.getBoundingClientRect().height
      : _barEl.offsetHeight;
  const heightPx = Math.max(0, Math.round(measuredHeight || 0));
  if (document?.documentElement?.style) {
    document.documentElement.style.setProperty('--spot-bar-height', `${heightPx}px`);
  }
}

export function injectSpotBar(lang = 'en', depth = 0) {
  if (document.getElementById('spot-price-bar')) return;

  _currentLang = lang;
  const isAr = lang === 'ar';
  const trackerHref = depth === 0 ? 'tracker.html' : '../'.repeat(depth) + 'tracker.html';

  const bar = document.createElement('div');
  bar.id = 'spot-price-bar';
  bar.className = 'spot-bar';
  bar.setAttribute('role', 'status');
  bar.setAttribute('aria-live', 'polite');
  bar.setAttribute('aria-label', isAr ? 'أسعار الذهب الفورية' : 'Live gold spot prices');
  bar.setAttribute('data-freshness', 'unavailable');
  // Build the inner structure via DOM to eliminate the innerHTML sink.
  function makeSpotLink(spot, label, valueLabel) {
    const a = document.createElement('a');
    a.href = trackerHref;
    a.className = 'spot-bar-item';
    a.setAttribute('data-spot', spot);
    const lbl = document.createElement('span');
    lbl.className = 'spot-bar-label';
    lbl.setAttribute('data-spot-label', spot);
    lbl.textContent = label;
    const val = document.createElement('span');
    val.className = 'spot-bar-value';
    val.setAttribute('data-spot-value', spot);
    val.textContent = valueLabel;
    a.appendChild(lbl);
    a.appendChild(val);
    return a;
  }
  function makeSep(extraClass) {
    const s = document.createElement('span');
    s.className = 'spot-bar-sep' + (extraClass ? ' ' + extraClass : '');
    s.setAttribute('aria-hidden', 'true');
    s.textContent = '|';
    return s;
  }
  const inner = document.createElement('div');
  inner.className = 'spot-bar-inner';
  inner.appendChild(makeSpotLink('xau', 'XAU/USD', '\u2014'));
  inner.appendChild(makeSep());
  inner.appendChild(makeSpotLink('aed', isAr ? '24K / \u063A AED' : '24K AED/g', '\u2014'));
  inner.appendChild(makeSep('spot-bar-sep--ts'));
  const ts = document.createElement('span');
  ts.className = 'spot-bar-ts';
  ts.setAttribute('data-spot-ts', '');
  inner.appendChild(ts);
  bar.appendChild(inner);

  // Insert before nav or as first child of body
  const nav = document.querySelector('.site-nav');
  if (nav) {
    nav.parentNode.insertBefore(bar, nav);
  } else {
    document.body.insertBefore(bar, document.body.firstChild);
  }

  _barEl = bar;
  document.body.classList.add('has-spot-bar');
  syncSpotBarHeight();
  if (typeof ResizeObserver === 'function') {
    _resizeObserver?.disconnect();
    _resizeObserver = new ResizeObserver(() => syncSpotBarHeight());
    _resizeObserver.observe(_barEl);
  } else if (typeof window !== 'undefined') {
    if (_resizeHandler) window.removeEventListener('resize', _resizeHandler);
    _resizeHandler = () => syncSpotBarHeight();
    window.addEventListener('resize', _resizeHandler, { passive: true });
  }
}

export function updateSpotBar(data = {}) {
  if (!_barEl) return;
  if (data.xauUsd != null) {
    const el = _barEl.querySelector('[data-spot-value="xau"]');
    if (el) {
      el.textContent =
        '$' +
        data.xauUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      el.classList.remove('spot-change-up', 'spot-change-down', 'spot-change-neutral');
      if (_prevXauUsd === null) {
        el.classList.add('spot-change-neutral');
      } else if (data.xauUsd > _prevXauUsd) {
        el.classList.add('spot-change-up');
      } else if (data.xauUsd < _prevXauUsd) {
        el.classList.add('spot-change-down');
      }
      _prevXauUsd = data.xauUsd;
    }
  }
  if (data.aed24kGram != null) {
    const el = _barEl.querySelector('[data-spot-value="aed"]');
    if (el)
      el.textContent = data.aed24kGram.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
  }
  if (data.updatedAt) {
    const el = _barEl.querySelector('[data-spot-ts]');
    if (el) {
      const fresh = getLiveFreshness({
        updatedAt: data.updatedAt,
        lang: _currentLang,
        hasLiveFailure: Boolean(data.hasLiveFailure),
        isFallback: data.isFallback ?? null,
        isFresh: data.isFresh ?? null,
      });
      _barEl.setAttribute('data-freshness', fresh.key);
      el.textContent = `${fresh.timeText} · ${fresh.ageText}`;
      el.setAttribute('title', freshnessLabel(fresh.key, _currentLang));
    }
  } else if (data.updatedAt === null) {
    _barEl.setAttribute('data-freshness', 'unavailable');
    const el = _barEl.querySelector('[data-spot-ts]');
    if (el) el.textContent = '—';
  }
}

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

export function updateSpotBarLang(lang) {
  if (!_barEl) return;
  _currentLang = lang;
  const isAr = lang === 'ar';
  const labelEl = _barEl.querySelector('[data-spot-label="aed"]');
  if (labelEl) labelEl.textContent = isAr ? '24K / غ AED' : '24K AED/g';
  syncSpotBarHeight();
}
