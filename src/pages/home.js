/**
 * Landing page entry point.
 * Fetches live gold + FX data in parallel, renders the hero live card
 * and GCC quick-price grid. Cache-first: shows cached data instantly.
 */
import { CONSTANTS, BASE_PATH, KARATS, COUNTRIES, TRANSLATIONS } from '../config/index.js';
import * as api from '../lib/api.js';
import * as cache from '../lib/cache.js';
import * as calc from '../lib/price-calculator.js';
import * as fmt from '../lib/formatter.js';
import { getMarketStatus, getLiveFreshness } from '../lib/live-status.js';
import { createRealtimePricingEngine } from '../lib/realtime-pricing-engine.js';
import { REALTIME_POLLING_DEFAULTS } from '../lib/realtime-config.js';
import { PrimaryQuoteProvider } from '../lib/quote-providers/primary-provider.js';
import { SecondaryQuoteProvider } from '../lib/quote-providers/secondary-provider.js';
import { formatProviderLabel } from '../lib/provider-labels.js';
import { updateTicker } from '../components/ticker.js';
import { updateSpotBar } from '../components/spotBar.js';
import { mountSharedShell } from '../components/site-shell.js';
import { renderAdSlot } from '../components/adSlot.js';
import { renderFreshnessBadge } from '../components/FreshnessBadge.js';
import { renderMarketStatusPanel } from '../components/MarketStatusPanel.js';
import { renderQuoteMetaPanel } from '../components/QuoteMetaPanel.js';
import { renderRealtimeSlaPanel } from '../components/RealtimeSlaPanel.js';
import { renderMethodologySection } from '../components/MethodologySection.js';
import { renderLocationGuideSection } from '../components/LocationGuideSection.js';
import '../lib/reveal.js';
import { initPageEnter } from '../lib/page-enter.js';
import { countUp } from '../lib/count-up.js';
import { copyWithToast } from '../lib/copy-toast.js';
import { mountQuickConvertWidget } from '../components/QuickConvertWidget.js';
import { initSwUpdateToast } from '../lib/sw-update-toast.js';
import { showDataStatusBanner, hideDataStatusBanner } from '../lib/data-status-banner.js';
import { clear, el, safeHref } from '../lib/safe-dom.js';
import { track, EVENTS } from '../lib/analytics.js';
import { enforceCanonicalOnDocument } from '../seo/canonical.js';
import { enforceHreflangAlternates } from '../seo/hreflang.js';
import { buildMethodologyFaqSchema, injectFaqSchema } from '../seo/faq-schema.js';

// ── Constants ──────────────────────────────────────────────────────────────
const LANG_KEY = 'user_prefs';
const SKELETON_TIMEOUT_MS = 8000;
const TOLA_GRAMS = 11.6638; // 1 tola = 11.6638 grams (international standard)

// Multiply per-gram AED price by this to get the chosen unit price.
const KARAT_STRIP_UNIT_MULT = {
  gram: 1,
  tola: TOLA_GRAMS,
  oz: CONSTANTS.TROY_OZ_GRAMS,
};

// Maps freshness key → home.source* translation key
const SOURCE_TX_KEY = {
  live: 'sourceLive',
  delayed: 'sourceDelayed',
  cached: 'sourceCached',
  stale: 'sourceStale',
  fallback: 'sourceFallback',
  unavailable: 'sourceUnavailable',
};

// ── State ──────────────────────────────────────────────────────────────────
let lang = 'en';
let goldPrice = null;
let dayOpenPrice = null;
let rates = {};
let goldUpdatedAt = null;
let goldIsFresh = null;
let goldIsFallback = null;
let goldProviderId = 'primary-provider';
let _realtimeSnapshot = null;
let _realtimeEngine = null;
let _refreshTimer = null;
let _freshnessTimer = null;
let _quickConvert = null;

// Karat strip unit preference — persisted in user_prefs localStorage
let karatStripUnit = (() => {
  try {
    return JSON.parse(localStorage.getItem(LANG_KEY) || '{}').karatStripUnit || 'gram';
  } catch {
    return 'gram';
  }
})();

function getLang() {
  try {
    const p = JSON.parse(localStorage.getItem(LANG_KEY) || '{}');
    return p.lang || 'en';
  } catch {
    return 'en';
  }
}

function saveLang(l) {
  try {
    const p = JSON.parse(localStorage.getItem(LANG_KEY) || '{}');
    p.lang = l;
    localStorage.setItem(LANG_KEY, JSON.stringify(p));
  } catch {}
}

// ── Market status ──────────────────────────────────────────────────────────
// Canonical gold-market schedule (Sun 22:00 UTC – Fri 21:00 UTC) lives in
// `src/lib/live-status.js`. Phase 4 of §22b removed the duplicate local
// implementation; this page consumes the shared primitive directly.

// ── Translations ────────────────────────────────────────────────────────────
function tx(key) {
  const fullKey = 'home.' + key;
  return TRANSLATIONS[lang]?.[fullKey] ?? TRANSLATIONS.en?.[fullKey] ?? key;
}

function txGlobal(key) {
  return TRANSLATIONS[lang]?.[key] ?? TRANSLATIONS.en?.[key] ?? key;
}

// ── Regional groupings for homepage display ────────────────────────────────
const GCC = COUNTRIES.filter((c) => c.group === 'gcc');
const MENA = COUNTRIES.filter((c) => ['gcc', 'levant', 'africa'].includes(c.group));
const GLOBAL = COUNTRIES;
// Complete map of country-code → countries/ directory slug.
// Only codes listed here have a dedicated page; the rest are rendered without a link.
const COUNTRY_SLUGS = {
  AE: 'uae',
  SA: 'saudi-arabia',
  KW: 'kuwait',
  QA: 'qatar',
  BH: 'bahrain',
  OM: 'oman',
  JO: 'jordan',
  LB: 'lebanon',
  IQ: 'iraq',
  SY: 'syria',
  PS: 'palestine',
  YE: 'yemen',
  EG: 'egypt',
  LY: 'libya',
  TN: 'tunisia',
  DZ: 'algeria',
  MA: 'morocco',
  SD: 'sudan',
  TR: 'turkey',
  PK: 'pakistan',
  IN: 'india',
};
let homeRegion = (() => {
  try {
    return JSON.parse(localStorage.getItem('user_prefs') || '{}').homeRegion || 'gcc';
  } catch {
    return 'gcc';
  }
})();

// ── Render helpers ─────────────────────────────────────────────────────────
function setTextById(id, text) {
  const target = document.getElementById(id);
  if (target) target.textContent = text;
}

function applyRegionTabA11yLabels() {
  const tablist = document.querySelector('.gcc-region-tabs');
  if (tablist) tablist.setAttribute('aria-label', tx('gccTabListAria'));
  const tabLabelMap = {
    gcc: tx('gccTabGccAria'),
    mena: tx('gccTabMenaAria'),
    global: tx('gccTabGlobalAria'),
  };
  document.querySelectorAll('.gcc-region-tab').forEach((tab) => {
    const region = tab.dataset.region;
    const label = tabLabelMap[region];
    if (label) {
      tab.setAttribute('aria-label', label);
      return;
    }
    tab.setAttribute('aria-label', tx('gccTabFallbackAria'));
    console.warn('[home] Unrecognized region tab value for ARIA label:', region);
  });
}

function formatCountrySearchEmpty(query = '') {
  const trimmed = query.trim();
  if (!trimmed) return tx('countrySearchEmpty');
  return tx('countrySearchEmptyQuery').replace('{query}', trimmed);
}

function setTrustChip(id, text, freshnessKey = 'neutral') {
  const target = document.getElementById(id);
  if (!target) return;
  target.textContent = text;
  target.classList.remove('skeleton-inline', 'home-command-chip--loading');
  target.removeAttribute('aria-busy');
  target.dataset.tone =
    freshnessKey === 'live' ? 'live' : freshnessKey === 'unavailable' ? 'neutral' : 'warning';
}

/** Deep-link to tracker with current karat strip unit preference. */
function buildTrackerHref(overrides = {}) {
  const unit = karatStripUnit === 'tola' ? 'tola' : karatStripUnit === 'oz' ? 'oz' : 'gram';
  const params = new URLSearchParams({
    mode: 'live',
    cur: 'AED',
    k: '24',
    u: unit,
    lang,
    ...overrides,
  });
  return `tracker.html#${params.toString()}`;
}

function setCommandMetricValue(id, valueText = '—', numericTarget = null) {
  const target = document.getElementById(id);
  if (!target) return;
  if (Number.isFinite(numericTarget)) {
    countUp(target, numericTarget, {
      decimals: 2,
      format: () => valueText,
      pulse: true,
      pulseTarget: target.closest('.mobile-command-card__metric'),
    });
  } else {
    target.textContent = valueText;
  }
  target.classList.remove('skeleton-inline', 'shell-skeleton-karat', 'home-command-metric-loading');
  target.removeAttribute('aria-busy');
}

function hasRealtimePathFailure() {
  return _realtimeSnapshot?.quote?.providerPathSuccessful === false;
}

function getFreshnessMeta() {
  const freshness = getLiveFreshness({
    updatedAt: goldUpdatedAt,
    lang,
    hasLiveFailure: hasRealtimePathFailure(),
    isFallback: goldIsFallback,
    isFresh: goldIsFresh,
  });
  const statusText = tx(SOURCE_TX_KEY[freshness.key] || 'sourceCached');
  const sourceText = formatProviderLabel(goldProviderId);
  return {
    freshnessTime: freshness.timeText,
    ageText: freshness.ageText,
    isLive: freshness.key === 'live',
    key: freshness.key,
    statusText,
    sourceText,
  };
}

/** Derive the freshness CSS data attribute value based on exact age.
 * More granular than the 4-tier key: adds 'amber' class when 5–30 min old.
 * @param {number} ageMs
 * @returns {'live'|'amber'|'stale'|'unavailable'}
 */
function freshnessAgeClass(ageMs) {
  if (!Number.isFinite(ageMs)) return 'unavailable';
  const MIN5 = 5 * 60 * 1000;
  const MIN30 = 30 * 60 * 1000;
  if (ageMs < MIN5) return 'live';
  if (ageMs < MIN30) return 'amber';
  return 'stale';
}

/** Tick the freshness timestamp display every second.
 * DOM is only mutated when the displayed text or color class would change,
 * keeping CPU/battery impact minimal on mobile devices.
 */
function startFreshnessTimer() {
  if (_freshnessTimer) clearInterval(_freshnessTimer);
  let prevHlcText = '';
  let prevKstripText = '';
  let prevCommandText = '';
  let prevSnapshotText = '';
  _freshnessTimer = setInterval(() => {
    if (!goldPrice || !goldUpdatedAt) return;
    const { ageText, statusText, sourceText, key } = getFreshnessMeta();
    const ageClass = freshnessAgeClass(getLiveFreshness({ updatedAt: goldUpdatedAt, lang }).ageMs);
    const hlcText = `${txGlobal('freshness.statusLabel')}: ${statusText} · ${tx('source')}: ${sourceText} · ${tx('updated')}: ${ageText}`;
    const kstripText = `${txGlobal('freshness.statusLabel')}: ${statusText} · ${tx('source')}: ${sourceText} · ${tx('updated')}: ${ageText}`;
    const commandText = `${statusText} · ${sourceText} · ${ageText}`;
    const snapshotText = `${txGlobal('freshness.statusLabel')}: ${statusText} · ${tx('updated')}: ${ageText}`;
    const hlcEl = document.getElementById('hlc-updated');
    if (hlcEl && hlcText !== prevHlcText) {
      hlcEl.textContent = hlcText;
      hlcEl.dataset.freshnessKey = key;
      hlcEl.dataset.freshnessAge = ageClass;
      prevHlcText = hlcText;
    }
    const kstripEl = document.getElementById('karat-strip-updated');
    if (kstripEl && kstripText !== prevKstripText) {
      kstripEl.textContent = kstripText;
      kstripEl.dataset.freshnessKey = key;
      kstripEl.dataset.freshnessAge = ageClass;
      prevKstripText = kstripText;
    }
    if (commandText !== prevCommandText) {
      setTrustChip('home-command-freshness', commandText, key);
      prevCommandText = commandText;
    }
    const snapshotStatus = document.getElementById('home-snapshot-status-value');
    const snapshotNote = document.getElementById('home-snapshot-status-note');
    if (snapshotStatus) snapshotStatus.textContent = `${statusText} · ${sourceText}`;
    if (snapshotNote && snapshotText !== prevSnapshotText) {
      snapshotNote.textContent = snapshotText;
      prevSnapshotText = snapshotText;
    }
  }, 1_000);
}

// ── Render hero live card ──────────────────────────────────────────────────
function renderHeroCard() {
  if (!goldPrice) return;
  const k24 = KARATS.find((k) => k.code === '24');
  const k22 = KARATS.find((k) => k.code === '22');
  const k21 = KARATS.find((k) => k.code === '21');
  const k18 = KARATS.find((k) => k.code === '18');
  if (!k24 || !k22 || !k21 || !k18) {
    console.warn('[home] Missing required karat config (24/22/21/18); skipping hero card render');
    return;
  }

  const usd24oz = goldPrice;
  const aed24g = calc.usdPerGram(goldPrice, k24.purity) * CONSTANTS.AED_PEG;
  const aed22g = calc.usdPerGram(goldPrice, k22.purity) * CONSTANTS.AED_PEG;
  const aed21g = calc.usdPerGram(goldPrice, k21.purity) * CONSTANTS.AED_PEG;
  const aed18g = calc.usdPerGram(goldPrice, k18.purity) * CONSTANTS.AED_PEG;

  // Update sticky spot bar
  updateSpotBar({
    xauUsd: usd24oz,
    aed24kGram: aed24g,
    updatedAt: goldUpdatedAt,
    hasLiveFailure: hasRealtimePathFailure(),
    isFallback: goldIsFallback,
    isFresh: goldIsFresh,
  });

  const priceEl = document.getElementById('hlc-price');
  if (priceEl) {
    countUp(priceEl, usd24oz, {
      decimals: 2,
      format: (n) => fmt.formatPrice(n, 'USD', 2),
      pulse: true,
      pulseTarget: priceEl,
    });
    priceEl.classList.remove('hlc-price--loading');
  }

  const directionEl = document.getElementById('hlc-direction');
  if (directionEl && dayOpenPrice && goldPrice) {
    const chg = goldPrice - dayOpenPrice;
    directionEl.hidden = false;
    directionEl.textContent = chg >= 0 ? '▲' : '▼';
    directionEl.className =
      'hlc-direction ' + (chg >= 0 ? 'hlc-direction--up' : 'hlc-direction--down');
  } else if (directionEl) {
    directionEl.hidden = true;
  }
  document.getElementById('hero-live-card')?.removeAttribute('aria-busy');
  for (const [id, val] of [
    ['hlc-aed24', aed24g],
    ['hlc-aed22', aed22g],
    ['hlc-aed21', aed21g],
    ['hlc-aed18', aed18g],
  ]) {
    const cell = document.getElementById(id);
    if (cell && val) {
      countUp(cell, val, {
        decimals: 2,
        format: (n) => fmt.formatPrice(n, 'AED', 2),
        pulse: true,
        pulseTarget: cell.closest('.hlc-item'),
      });
    } else if (cell) {
      cell.textContent = '—';
    }
  }
  const { ageText, isLive, statusText, sourceText, key } = getFreshnessMeta();
  const ageClass = freshnessAgeClass(getLiveFreshness({ updatedAt: goldUpdatedAt, lang }).ageMs);
  const hlcUpdatedEl = document.getElementById('hlc-updated');
  if (hlcUpdatedEl) {
    hlcUpdatedEl.textContent = `${txGlobal('freshness.statusLabel')}: ${statusText} · ${tx('source')}: ${sourceText} · ${tx('updated')}: ${ageText}`;
    hlcUpdatedEl.dataset.freshnessKey = key;
    hlcUpdatedEl.dataset.freshnessAge = ageClass;
  } else {
    setTextById(
      'hlc-updated',
      `${txGlobal('freshness.statusLabel')}: ${statusText} · ${tx('source')}: ${sourceText} · ${tx('updated')}: ${ageText}`
    );
  }
  const kstripUpdatedEl = document.getElementById('karat-strip-updated');
  if (kstripUpdatedEl) {
    kstripUpdatedEl.textContent = `${txGlobal('freshness.statusLabel')}: ${statusText} · ${tx('source')}: ${sourceText} · ${tx('updated')}: ${ageText}`;
    kstripUpdatedEl.dataset.freshnessKey = key;
    kstripUpdatedEl.dataset.freshnessAge = ageClass;
  } else {
    setTextById(
      'karat-strip-updated',
      `${txGlobal('freshness.statusLabel')}: ${statusText} · ${tx('source')}: ${sourceText} · ${tx('updated')}: ${ageText}`
    );
  }

  // Change vs day open
  const changeEl = document.getElementById('hlc-change');
  if (changeEl && dayOpenPrice && goldPrice) {
    const chg = ((goldPrice - dayOpenPrice) / dayOpenPrice) * 100;
    const sign = chg >= 0 ? '+' : '';
    changeEl.textContent = `${tx('changeLabel')}: ${sign}${chg.toFixed(2)}%`;
    changeEl.className = 'hlc-change ' + (chg >= 0 ? 'badge-up' : 'badge-down');
    changeEl.hidden = false;
  }

  // Day high/low estimate: derived from current price vs day open price.
  // These two data points give a rough intraday range; true OHLC highs/lows
  // are not available from the current data source. This is labelled
  // "H/L" (not "High/Low") to signal it is an approximation.
  const hlHlEl = document.getElementById('hlc-high-low');
  if (hlHlEl && dayOpenPrice && goldPrice) {
    const high = Math.max(goldPrice, dayOpenPrice);
    const low = Math.min(goldPrice, dayOpenPrice);
    const highFmt = fmt.formatPrice(high, 'USD', 2);
    const lowFmt = fmt.formatPrice(low, 'USD', 2);
    hlHlEl.textContent = `H: ${highFmt} · L: ${lowFmt}`;
    hlHlEl.hidden = false;
  }

  // Market status
  const statusEl = document.getElementById('hlc-market-status');
  if (statusEl) {
    const { isOpen } = getMarketStatus();
    statusEl.textContent = isOpen ? tx('marketOpen') : tx('marketClosed');
    statusEl.className = 'hlc-market ' + (isOpen ? 'hlc-market--open' : 'hlc-market--closed');
  }

  // Update bottom ticker
  updateTicker({
    xauUsd: goldPrice,
    uae24k: aed24g,
    uae22k: aed22g,
    uae21k: aed21g,
    uae18k: aed18g,
    updatedAt: goldUpdatedAt,
    hasLiveFailure: hasRealtimePathFailure(),
    isFallback: goldIsFallback,
    isFresh: goldIsFresh,
  });

  // Update karat strip
  renderKaratStrip(k18);

  // Update mobile command center
  renderCommandCenter({
    aed24g,
    aed22g,
    aed21g,
    aed18g,
    usd24oz,
  });
  _quickConvert?.recalc?.();

  // Update freshness banner
  const bar = document.getElementById('home-freshness-bar');
  const barText = document.getElementById('hfb-text');
  if (bar && barText) {
    const stale = !isLive;
    const timeStr = goldUpdatedAt ? fmt.formatTimestampShort(goldUpdatedAt, lang) : '—';
    bar.classList.toggle('home-freshness-bar--stale', stale);
    barText.textContent = stale
      ? `${txGlobal('freshness.statusLabel')}: ${statusText} · ${tx('source')}: ${sourceText} · ${tx('updated')}: ${timeStr}`
      : `${txGlobal('freshness.statusLabel')}: ${statusText} · ${tx('source')}: ${sourceText} · ${tx('updated')}: ${timeStr}`;
    bar.removeAttribute('hidden');
  }
  renderHomeTrustAddons();
}

function renderHomeTrustAddons() {
  const freshnessSlot = document.getElementById('home-freshness-badge-slot');
  if (freshnessSlot) {
    const freshness = getLiveFreshness({
      updatedAt: goldUpdatedAt,
      lang,
      hasLiveFailure: hasRealtimePathFailure(),
      isFallback: goldIsFallback,
      isFresh: goldIsFresh,
    });
    freshnessSlot.replaceChildren(
      renderFreshnessBadge({
        lang,
        state: freshness.key,
        source: formatProviderLabel(goldProviderId),
        updatedAt: goldUpdatedAt,
        marketOpen: getMarketStatus().isOpen,
        className: 'home-freshness-badge',
        t: txGlobal,
      })
    );
  }

  const marketSlot = document.getElementById('home-market-status-panel');
  if (marketSlot) {
    marketSlot.replaceChildren(
      renderMarketStatusPanel({
        lang,
        className: 'home-market-status',
        t: txGlobal,
      })
    );
  }

  renderHomeRealtimePanels();
}

function renderHomeRealtimePanels() {
  const metaMount = document.getElementById('home-quote-meta-slot');
  if (metaMount) {
    const freshness = getFreshnessMeta();
    metaMount.replaceChildren(
      renderQuoteMetaPanel({
        lang,
        statusLabel: freshness.statusText,
        sourceLabel: freshness.sourceText,
        providerId: formatProviderLabel(goldProviderId),
        providerTimestamp: goldUpdatedAt,
        fetchedAt: _realtimeSnapshot?.quote?.fetchedAt || goldUpdatedAt,
        ageLabel: freshness.ageText,
        pollIntervalMs: _realtimeSnapshot?.metrics?.nextPollInMs ?? null,
        lastFetchLatencyMs: _realtimeSnapshot?.metrics?.latestNetworkLatencyMs ?? null,
        t: txGlobal,
        className: 'home-quote-meta-panel',
      })
    );
  }

  const slaMount = document.getElementById('home-realtime-sla-slot');
  if (slaMount) {
    const debugFreshness = new URLSearchParams(location.search).get('debugFreshness') === '1';
    if (!debugFreshness) {
      slaMount.replaceChildren();
      return;
    }
    slaMount.replaceChildren(
      renderRealtimeSlaPanel({
        snapshot: _realtimeSnapshot,
        t: txGlobal,
        className: 'home-realtime-sla-panel',
      })
    );
  }
}

function mountHomeQuickConvert() {
  const mount = document.getElementById('home-quick-convert-mount');
  if (!mount) return;
  _quickConvert = mountQuickConvertWidget({
    lang,
    spotUsdPerOz: goldPrice,
    t: (key) => tx(key),
    mount,
  });
}

function renderHomeAdditiveSections() {
  const methodologyMount = document.getElementById('home-methodology-mount');
  if (methodologyMount) {
    methodologyMount.replaceChildren(
      renderMethodologySection({
        t: txGlobal,
        className: 'home-methodology-section',
      })
    );
  }

  const locationMount = document.getElementById('home-location-guides-mount');
  if (locationMount) {
    locationMount.replaceChildren(
      renderLocationGuideSection({
        lang,
        t: txGlobal,
        className: 'home-location-guides-section',
      })
    );
  }
}

function renderCommandCenter(values = {}) {
  const {
    aed24g = null,
    aed22g = null,
    aed21g = null,
    aed18g = null,
    usd24oz = goldPrice,
  } = values;
  const { ageText, statusText, sourceText, key } = getFreshnessMeta();

  setTrustChip(
    'home-command-freshness',
    `${txGlobal('freshness.statusLabel')}: ${statusText} · ${tx('source')}: ${sourceText} · ${ageText}`,
    key
  );
  setTrustChip(
    'home-command-spot-chip',
    usd24oz ? `XAU/USD ${fmt.formatPrice(usd24oz, 'USD', 2)}` : 'XAU/USD —',
    key
  );

  setCommandMetricValue(
    'home-command-24-value',
    aed24g ? fmt.formatPrice(aed24g, 'AED', 2) : '—',
    aed24g
  );
  setCommandMetricValue(
    'home-command-22-value',
    aed22g ? fmt.formatPrice(aed22g, 'AED', 2) : '—',
    aed22g
  );
  setCommandMetricValue(
    'home-command-21-value',
    aed21g ? fmt.formatPrice(aed21g, 'AED', 2) : '—',
    aed21g
  );
  setCommandMetricValue(
    'home-command-18-value',
    aed18g ? fmt.formatPrice(aed18g, 'AED', 2) : '—',
    aed18g
  );

  setTextById('home-snapshot-uae-value', aed24g ? fmt.formatPrice(aed24g, 'AED', 2) : '—');
  setTextById('home-snapshot-global-value', usd24oz ? fmt.formatPrice(usd24oz, 'USD', 2) : '—');
  setTextById('home-snapshot-status-value', `${statusText} · ${sourceText}`);
  setTextById('home-snapshot-status-note', `${txGlobal('freshness.updatedUtcLabel')}: ${ageText}`);
}

// ── Render karat price strip ───────────────────────────────────────────────
function renderKaratStrip(k18Ref) {
  if (!goldPrice) return;
  const AED = CONSTANTS.AED_PEG;
  const k18 = k18Ref || KARATS.find((k) => k.code === '18');
  const k21 = KARATS.find((k) => k.code === '21');
  const k22 = KARATS.find((k) => k.code === '22');
  const k24 = KARATS.find((k) => k.code === '24');
  const k14 = KARATS.find((k) => k.code === '14');

  // Skip rendering if required core karat data is not available; 14K is optional.
  if (!k18 || !k21 || !k22 || !k24) return;

  // Apply unit multiplier to base AED/gram price.
  const mult = KARAT_STRIP_UNIT_MULT[karatStripUnit] || 1;

  const prices = {
    24: calc.usdPerGram(goldPrice, k24.purity) * AED * mult,
    22: calc.usdPerGram(goldPrice, k22.purity) * AED * mult,
    21: calc.usdPerGram(goldPrice, k21.purity) * AED * mult,
    18: calc.usdPerGram(goldPrice, k18.purity) * AED * mult,
  };
  if (k14) prices[14] = calc.usdPerGram(goldPrice, k14.purity) * AED * mult;

  for (const [k, v] of Object.entries(prices)) {
    const valueElement = document.getElementById(`kstrip-${k}-val`);
    if (valueElement) {
      valueElement.className = 'karat-strip-v';
      // Smooth count-up with directional flash when price changes.
      countUp(valueElement, v, {
        decimals: 2,
        format: (n) => fmt.formatPrice(n, 'AED', 2),
        pulse: true,
        pulseTarget: valueElement.closest('.karat-strip-item'),
      });
    }
    // Update copy button's data-copy attribute so clipboard gets the current value.
    const copyBtn = document.getElementById(`kstrip-${k}-copy`);
    if (copyBtn) {
      const formatted = fmt.formatPrice(v, 'AED', 2);
      copyBtn.dataset.copy = formatted;
      copyBtn.setAttribute('aria-label', tx('karatCopyAriaLabel').replace('{karat}', k));
    }
  }

  // Update the strip label to reflect the current unit.
  const labelKey =
    karatStripUnit === 'tola'
      ? 'karatStripLabelTola'
      : karatStripUnit === 'oz'
        ? 'karatStripLabelOz'
        : 'karatStripLabelGram';
  setTextById('karat-strip-label', tx(labelKey));

  const tooltip = tx('karatHoverTooltip');
  document.querySelectorAll('.karat-strip-item').forEach((item) => {
    item.dataset.tooltip = tooltip;
  });
}

// ── Render GCC grid ────────────────────────────────────────────────────────
function renderGCCGrid() {
  const grid = document.getElementById('gcc-quick-grid');
  if (!grid || !goldPrice) return;
  const k22 = KARATS.find((k) => k.code === '22');

  // Select countries based on current region filter
  const regionLists = { gcc: GCC, mena: MENA, global: GLOBAL };
  const countries = regionLists[homeRegion] || GCC;
  const { sourceText } = getFreshnessMeta();
  const fragment = document.createDocumentFragment();

  clear(grid);
  countries.forEach((c, index) => {
    let price = '—';
    if (c.currency === 'AED') {
      price = fmt.formatPrice(calc.usdPerGram(goldPrice, k22.purity) * CONSTANTS.AED_PEG, 'AED', 2);
    } else if (rates[c.currency]) {
      price = fmt.formatPrice(
        calc.usdPerGram(goldPrice, k22.purity) * rates[c.currency],
        c.currency,
        c.decimals
      );
    }
    const name = lang === 'ar' ? c.nameAr : c.nameEn;
    const slug = COUNTRY_SLUGS[c.code] ?? null;

    const headerChildren = [
      el('span', { class: 'gcc-flag', 'aria-hidden': 'true' }, c.flag),
      el('div', { class: 'gcc-meta' }, [
        el('span', { class: 'gcc-name' }, name),
        el('span', { class: 'gcc-currency' }, c.currency),
      ]),
    ];
    if (dayOpenPrice && goldPrice) {
      const chg = ((goldPrice - dayOpenPrice) / dayOpenPrice) * 100;
      const sign = chg >= 0 ? '+' : '';
      const cls = chg >= 0 ? 'badge-up' : 'badge-down';
      headerChildren.push(
        el('span', { class: `gcc-change badge ${cls}` }, `${sign}${chg.toFixed(2)}%`)
      );
    }

    const cardChildren = [
      el('div', { class: 'gcc-card-header' }, headerChildren),
      el('div', { class: 'gcc-price' }, price),
      el('div', { class: 'gcc-unit' }, `${tx('perGram')} · 22K`),
      el('div', { class: 'gcc-source' }, sourceText),
    ];
    if (slug) {
      cardChildren.push(el('span', { class: 'gcc-card-cta' }, tx('gccCardCta')));
    }
    const card = slug
      ? el(
          'a',
          { href: safeHref(`./countries/${slug}/gold-price/`), class: 'gcc-card card-interactive' },
          cardChildren
        )
      : el('div', { class: 'gcc-card gcc-card--no-link card-interactive' }, cardChildren);

    fragment.append(
      el(
        'div',
        {
          class: 'gcc-card-wrapper is-entering',
          style: `--stagger-index: ${index}`,
        },
        [
          card,
          el(
            'button',
            {
              class: 'gcc-copy-btn',
              dataset: { copy: price },
              'aria-label': `${tx('copyPrice')} ${name}`,
              type: 'button',
            },
            '⎘'
          ),
        ]
      )
    );
  });
  grid.append(fragment);
}

function syncTrackerLinks() {
  const href = buildTrackerHref();
  for (const id of [
    'hero-cta-tracker',
    'hlc-tracker-link',
    'karat-strip-cta',
    'home-command-cta-tracker',
  ]) {
    const node = document.getElementById(id);
    if (node) node.setAttribute('href', href);
  }
}

// ── Apply full page language ───────────────────────────────────────────────
function applyLangToPage() {
  const isAr = lang === 'ar';
  document.documentElement.lang = lang;
  document.documentElement.dir = isAr ? 'rtl' : 'ltr';

  setTextById('hero-live-label', tx('heroLive'));
  setTextById('hero-title-main', tx('heroTitle'));
  setTextById('hero-title-sub', tx('heroSub'));
  setTextById('hero-lead', tx('heroLead'));
  setTextById('hero-cta-tracker', tx('heroCta1'));
  setTextById('hero-cta-calculator', tx('heroCtaCalculator'));
  setTextById('hero-cta-countries', tx('heroCta2'));
  setTextById('hero-cta-shops', tx('heroCta4'));
  setTextById('hero-cta-alert', tx('heroCta5'));
  setTextById('hero-cta-methodology', tx('heroCtaMethodology'));
  setTextById('hero-trust-line', tx('heroTrustLine'));
  setTextById('hlc-trust-line', tx('heroTrustShort'));
  setTextById('home-command-kicker', tx('commandKicker'));
  setTextById('home-command-center-title', tx('commandTitle'));
  setTextById('home-command-copy', tx('commandCopy'));
  setTextById('home-command-24-label', tx('lbl24aed'));
  setTextById('home-command-22-label', tx('lbl22aed'));
  setTextById('home-command-21-label', tx('lbl21aed'));
  setTextById('home-command-18-label', tx('lbl18aed'));
  setTextById('home-command-24-note', tx('command24Note'));
  setTextById('home-command-22-note', tx('command22Note'));
  setTextById('home-command-21-note', tx('command21Note'));
  setTextById('home-command-18-note', tx('command18Note'));
  setTextById('home-command-note', tx('commandNote'));
  setTextById('home-command-cta-tracker', tx('commandCtaTracker'));
  setTextById('home-command-cta-calculator', tx('commandCtaCalculator'));
  setTextById('home-command-cta-uae', tx('commandCtaUae'));
  setTextById('home-command-cta-method', tx('commandCtaMethod'));
  setTextById('home-action-rail-kicker', tx('actionRailKicker'));
  setTextById('home-action-rail-title', tx('actionRailTitle'));
  setTextById('home-action-track-kicker', tx('actionTrackKicker'));
  setTextById('home-action-track-label', tx('actionTrackLabel'));
  setTextById('home-action-track-desc', tx('actionTrackDesc'));
  setTextById('home-action-calc-kicker', tx('actionCalcKicker'));
  setTextById('home-action-calc-label', tx('actionCalcLabel'));
  setTextById('home-action-calc-desc', tx('actionCalcDesc'));
  setTextById('home-action-compare-kicker', tx('actionCompareKicker'));
  setTextById('home-action-compare-label', tx('actionCompareLabel'));
  setTextById('home-action-compare-desc', tx('actionCompareDesc'));
  setTextById('home-action-shops-kicker', tx('actionShopsKicker'));
  setTextById('home-action-shops-label', tx('actionShopsLabel'));
  setTextById('home-action-shops-desc', tx('actionShopsDesc'));
  setTextById('home-action-learn-kicker', tx('actionLearnKicker'));
  setTextById('home-action-learn-label', tx('actionLearnLabel'));
  setTextById('home-action-learn-desc', tx('actionLearnDesc'));
  setTextById('home-market-snapshot-kicker', tx('snapshotKicker'));
  setTextById('home-market-snapshot-title', tx('snapshotTitle'));
  setTextById('home-snapshot-uae-label', tx('snapshotUaeLabel'));
  setTextById('home-snapshot-uae-note', tx('snapshotUaeNote'));
  setTextById('home-snapshot-global-label', tx('snapshotGlobalLabel'));
  setTextById('home-snapshot-global-note', tx('snapshotGlobalNote'));
  setTextById('home-snapshot-peg-label', tx('snapshotPegLabel'));
  setTextById('home-snapshot-peg-note', tx('snapshotPegNote'));
  setTextById('home-snapshot-status-label', tx('snapshotStatusLabel'));
  setTextById('home-snapshot-status-note', tx('snapshotStatusNote'));
  setTextById('home-market-snapshot-copy', tx('snapshotCopy'));
  setTextById('home-market-snapshot-link', tx('snapshotLink'));
  setTextById('hlc-tracker-link', tx('trackerLink'));
  setTextById('hlc-title', tx('spotTitle'));
  setTextById('hlc-sub', tx('perOz'));
  setTextById('hlc-label-aed24', tx('lbl24aed'));
  setTextById('hlc-label-aed22', tx('lbl22aed'));
  setTextById('hlc-label-aed21', tx('lbl21aed'));
  setTextById('hlc-label-aed18', tx('lbl18aed'));
  setTextById('hlc-updated', tx('fetching'));
  setTextById('gcc-section-title', tx('gccLiveTitle'));
  setTextById('gcc-section-sub', tx('gccLiveSub'));
  setTextById('gcc-see-all', tx('seeAll'));
  setTextById('trust-live', tx('trustLive'));
  setTextById('trust-live-sub', tx('trustLiveSub'));
  setTextById('trust-countries', tx('trustCountries'));
  setTextById('trust-countries-sub', tx('trustCountriesSub'));
  setTextById('trust-karats', tx('trustKarats'));
  setTextById('trust-karats-sub', tx('trustKaratsSub'));
  setTextById('trust-aed', tx('trustAed'));
  setTextById('trust-aed-sub', tx('trustAedSub'));
  setTextById('trust-bilingual', tx('trustBilingual'));
  setTextById('trust-bilingual-sub', tx('trustBilingualSub'));
  setTextById('trust-offline', tx('trustOffline'));
  setTextById('trust-offline-sub', tx('trustOfflineSub'));
  setTextById('karat-strip-label', tx('karatStripLabel'));
  setTextById('karat-strip-title', tx('karatStripTitle'));
  setTextById('karat-strip-sub', tx('karatStripSub'));
  setTextById('karat-strip-cta', tx('karatStripCta'));
  syncTrackerLinks();
  setTextById('tools-title', tx('toolsTitle'));
  setTextById('tools-sub', tx('toolsSub'));
  setTextById('home-stats-title', tx('statsTitle'));
  setTextById('home-stats-sub', tx('statsSub'));
  setTextById('home-stat-1-value', tx('stat1Value'));
  setTextById('home-stat-1-label', tx('stat1Label'));
  setTextById('home-stat-2-value', tx('stat2Value'));
  setTextById('home-stat-2-label', tx('stat2Label'));
  setTextById('home-stat-3-value', tx('stat3Value'));
  setTextById('home-stat-3-label', tx('stat3Label'));
  setTextById('home-stat-4-value', tx('stat4Value'));
  setTextById('home-stat-4-label', tx('stat4Label'));
  setTextById('home-stats-disclaimer', tx('statsDisclaimer'));
  setTextById('tool-tracker-title', tx('toolTrackerTitle'));
  setTextById('tool-tracker-desc', tx('toolTrackerDesc'));
  setTextById('tool-tracker-cta', tx('toolTrackerCta'));
  setTextById('tool-calc-title', tx('toolCalcTitle'));
  setTextById('tool-calc-desc', tx('toolCalcDesc'));
  setTextById('tool-calc-cta', tx('toolCalcCta'));
  setTextById('tool-uae-title', tx('toolUaeTitle'));
  setTextById('tool-uae-desc', tx('toolUaeDesc'));
  setTextById('tool-uae-cta', tx('toolUaeCta'));
  setTextById('tool-shops-title', tx('toolShopsTitle'));
  setTextById('tool-shops-desc', tx('toolShopsDesc'));
  setTextById('tool-shops-cta', tx('toolShopsCta'));
  setTextById('tool-countries-title', tx('toolCountriesTitle'));
  setTextById('tool-countries-desc', tx('toolCountriesDesc'));
  setTextById('tool-countries-cta', tx('toolCountriesCta'));
  setTextById('tool-learn-title', tx('toolLearnTitle'));
  setTextById('tool-learn-desc', tx('toolLearnDesc'));
  setTextById('tool-learn-cta', tx('toolLearnCta'));
  setTextById('tool-insights-title', tx('toolInsightsTitle'));
  setTextById('tool-insights-desc', tx('toolInsightsDesc'));
  setTextById('tool-insights-cta', tx('toolInsightsCta'));
  setTextById('tool-method-title', tx('toolMethodTitle'));
  setTextById('tool-method-desc', tx('toolMethodDesc'));
  setTextById('tool-method-cta', tx('toolMethodCta'));
  setTextById('tool-invest-title', tx('toolInvestTitle'));
  setTextById('tool-invest-desc', tx('toolInvestDesc'));
  setTextById('tool-invest-cta', tx('toolInvestCta'));
  setTextById('tools-alert-text', tx('alertRowText'));
  setTextById('tools-alert-btn', tx('alertBtn'));
  setTextById('trust-banner-title', tx('trustBannerTitle'));
  setTextById('trust-banner-copy', tx('trustBannerCopy'));
  setTextById('trust-banner-source-tail', tx('trustBannerSourceTail'));
  setTextById('trust-banner-methodology', tx('trustBannerMethodology'));
  setTextById('countries-quick-title', tx('countriesTitle'));
  setTextById('countries-quick-sub', tx('countriesSub'));
  setTextById('countries-see-all', tx('seeAllCountries'));
  setTextById('social-follow-text', tx('socialFollowText'));
  setTextById('social-follow-cta', tx('socialFollowCta'));
  setTextById('explainer-spot-title', tx('explainerSpotTitle'));
  setTextById('explainer-spot-desc', tx('explainerSpotDesc'));
  setTextById('explainer-karat-title', tx('explainerKaratTitle'));
  setTextById('explainer-karat-desc', tx('explainerKaratDesc'));
  setTextById('explainer-local-title', tx('explainerLocalTitle'));
  setTextById('explainer-local-desc', tx('explainerLocalDesc'));
  setTextById('faq-title', tx('faqTitle'));
  setTextById('faq-more-link', tx('faqMore'));
  setTextById('home-methodology-title', txGlobal('methodology.sectionTitle'));
  setTextById('home-methodology-sub', txGlobal('methodology.sectionSub'));
  setTextById('home-methodology-page-link', txGlobal('methodology.fullPageLink'));
  setTextById('home-location-guides-title', txGlobal('locationGuides.sectionTitle'));
  setTextById('home-location-guides-sub', txGlobal('locationGuides.sectionSub'));
  setTextById('home-location-guides-link', txGlobal('locationGuides.sectionLink'));
  document.getElementById('hfb-dismiss')?.setAttribute('aria-label', tx('freshnessDismiss'));
  document
    .getElementById('home-command-status')
    ?.setAttribute('aria-label', tx('heroLiveStatusAria'));

  // Next-step guides section
  setTextById('next-step-title', tx('nextStepTitle'));
  setTextById('next-step-sub', tx('nextStepSub'));
  setTextById('next-uae-title', tx('nextUaeTitle'));
  setTextById('next-uae-desc', tx('nextUaeDesc'));
  setTextById('next-uae-cta', tx('nextUaeCta'));
  setTextById('next-dubai-title', tx('nextDubaiTitle'));
  setTextById('next-dubai-desc', tx('nextDubaiDesc'));
  setTextById('next-dubai-cta', tx('nextDubaiCta'));
  setTextById('next-gcc-title', tx('nextGccTitle'));
  setTextById('next-gcc-desc', tx('nextGccDesc'));
  setTextById('next-gcc-cta', tx('nextGccCta'));
  setTextById('next-svr-title', tx('nextSvrTitle'));
  setTextById('next-svr-desc', tx('nextSvrDesc'));
  setTextById('next-svr-cta', tx('nextSvrCta'));

  // Markets highlights section
  setTextById('markets-title', tx('marketsTitle'));
  setTextById('markets-sub', tx('marketsSub'));
  setTextById('markets-see-tracker', tx('marketsSeeAll'));
  setTextById('mkt-dubai-name', tx('mktDubaiName'));
  setTextById('mkt-dubai-loc', tx('mktDubaiLoc'));
  setTextById('mkt-dubai-desc', tx('mktDubaiDesc'));
  setTextById('mkt-dubai-cta', tx('mktDubaiCta'));
  setTextById('mkt-riyadh-name', tx('mktRiyadhName'));
  setTextById('mkt-riyadh-loc', tx('mktRiyadhLoc'));
  setTextById('mkt-riyadh-desc', tx('mktRiyadhDesc'));
  setTextById('mkt-riyadh-cta', tx('mktRiyadhCta'));
  setTextById('mkt-kuwait-name', tx('mktKuwaitName'));
  setTextById('mkt-kuwait-loc', tx('mktKuwaitLoc'));
  setTextById('mkt-kuwait-desc', tx('mktKuwaitDesc'));
  setTextById('mkt-kuwait-cta', tx('mktKuwaitCta'));
  setTextById('mkt-cairo-name', tx('mktCairoName'));
  setTextById('mkt-cairo-loc', tx('mktCairoLoc'));
  setTextById('mkt-cairo-desc', tx('mktCairoDesc'));
  setTextById('mkt-cairo-cta', tx('mktCairoCta'));
  setTextById('markets-note', tx('marketsNote'));

  // Country tiles — use localised names from COUNTRIES data
  const countryMap = {
    'ct-uae': 'AE',
    'ct-sa': 'SA',
    'ct-kw': 'KW',
    'ct-qa': 'QA',
    'ct-bh': 'BH',
    'ct-om': 'OM',
    'ct-eg': 'EG',
    'ct-jo': 'JO',
    'ct-ma': 'MA',
    'ct-in': 'IN',
  };
  for (const [elId, code] of Object.entries(countryMap)) {
    const c = COUNTRIES.find((x) => x.code === code);
    if (c) setTextById(elId, isAr ? c.nameAr : c.nameEn);
  }
  setTextById('ct-more', tx('seeAllCountries'));

  // Country search — update placeholder and empty-state text bilingually
  const countrySearchInput = /** @type {HTMLInputElement|null} */ (
    document.getElementById('country-search')
  );
  if (countrySearchInput) {
    countrySearchInput.placeholder = tx('countrySearchPlaceholder');
    countrySearchInput.setAttribute('aria-label', tx('countrySearchPlaceholder'));
  }
  setTextById('country-search-empty', formatCountrySearchEmpty(countrySearchInput?.value || ''));

  // Karat strip unit toggle group — update aria-label bilingually
  const unitGroupEl = document.getElementById('kstrip-unit-group');
  if (unitGroupEl) unitGroupEl.setAttribute('aria-label', tx('unitToggleLabel'));
  applyRegionTabA11yLabels();
  renderHomeAdditiveSections();
  renderHomeTrustAddons();

  renderHeroCard();
  renderGCCGrid();
}

// ── Fetch live data in parallel ────────────────────────────────────────────
async function fetchLiveData() {
  if (!navigator.onLine) return;
  try {
    const fxData = await api.fetchFX();
    rates = fxData.rates ?? {};
    cache.saveFXRates(rates, {
      lastUpdateUtc: fxData.time_last_update_utc,
      nextUpdateUtc: fxData.time_next_update_utc,
    });
    renderGCCGrid();
  } catch {
    // keep previous FX data
  }
}

function applyRealtimeSnapshot(snapshot) {
  _realtimeSnapshot = snapshot;

  const quote = snapshot?.quote;
  if (quote?.price) {
    goldPrice = quote.price;
    goldUpdatedAt = quote.providerTimestamp || quote.fetchedAt || new Date().toISOString();
    goldProviderId = quote.providerId || goldProviderId;
    goldIsFallback = quote.isFallback ?? quote.forcedState === 'fallback';
    goldIsFresh = quote.isFresh ?? snapshot?.freshness?.state === 'live';
    cache.saveGoldPrice(quote.price, goldUpdatedAt);
    hideDataStatusBanner();
    renderHeroCard();
  } else if (!goldPrice) {
    const priceEl = document.getElementById('hlc-price');
    if (priceEl) {
      priceEl.classList.remove('hlc-price--loading');
      priceEl.textContent = '—';
    }
  }

  renderHomeRealtimePanels();
}

function initRealtimeEngine() {
  if (_realtimeEngine) return;

  const primaryProvider = new PrimaryQuoteProvider({ timeoutMs: 5000 });
  const secondaryProvider = new SecondaryQuoteProvider({ timeoutMs: 5000 });

  _realtimeEngine = createRealtimePricingEngine({
    primaryProvider,
    secondaryProvider,
    config: REALTIME_POLLING_DEFAULTS,
    debug: new URLSearchParams(location.search).get('debugFreshness') === '1',
  });

  const cacheBoot = cache.getFallbackGoldPrice();
  if (cacheBoot) {
    _realtimeEngine.seedFromCache({
      price: cacheBoot.price,
      updatedAt: cacheBoot.updatedAt,
      fetchedAt: cacheBoot.fetchedAt,
      providerId: 'cache',
      source: 'cache',
    });
  }

  _realtimeEngine.subscribe((snapshot) => {
    applyRealtimeSnapshot(snapshot);
  });

  _realtimeEngine.start();
  document.addEventListener('visibilitychange', () => {
    _realtimeEngine?.setVisibility(!document.hidden);
  });
}

function initLazyBelowFoldFeatures() {
  // 220px prefetch margin was chosen to load content before it enters view on
  // common mobile scroll velocity without aggressively preloading deep sections.
  const BELOW_FOLD_PREFETCH_MARGIN_PX = 220;
  let countrySearchInitialized = false;
  let bottomAdLoaded = false;

  const runCountrySearchInit = () => {
    if (countrySearchInitialized) return;
    countrySearchInitialized = true;
    initCountrySearch();
  };
  const runBottomAdLoad = () => {
    if (bottomAdLoaded) return;
    bottomAdLoaded = true;
    renderAdSlot('ad-bottom', 'rectangle');
  };

  if (!('IntersectionObserver' in window)) {
    runCountrySearchInit();
    runBottomAdLoad();
    return;
  }

  const sectionObserver = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const targetId = entry.target.id;
        if (targetId === 'countries-quick') runCountrySearchInit();
        if (targetId === 'ad-bottom') runBottomAdLoad();
        obs.unobserve(entry.target);
      });
    },
    { rootMargin: `${BELOW_FOLD_PREFETCH_MARGIN_PX}px 0px` }
  );

  const countriesSection = document.getElementById('countries-quick');
  const bottomAd = document.getElementById('ad-bottom');
  if (countriesSection) sectionObserver.observe(countriesSection);
  else runCountrySearchInit();
  if (bottomAd) sectionObserver.observe(bottomAd);
  else runBottomAdLoad();
}

// ── Country quick-picker search ────────────────────────────────────────────
/**
 * Wires up the inline search/filter on the country-tiles section (Track C.4).
 * Progressive enhancement: graceful no-op if the elements are absent.
 * Keyboard contract:
 *   - While in the input: ArrowDown focuses the first visible tile; Escape clears.
 *   - While in the tile list: ArrowDown/ArrowUp cycles; ArrowUp from first tile
 *     returns focus to the input.
 */
function initCountrySearch() {
  const input = /** @type {HTMLInputElement|null} */ (document.getElementById('country-search'));
  const tilesWrap = document.querySelector('.country-tiles');
  const emptyState = document.getElementById('country-search-empty');
  if (!input || !tilesWrap) return;

  // All searchable tiles — excludes the "See all" tile
  const links = /** @type {HTMLAnchorElement[]} */ (
    Array.from(tilesWrap.querySelectorAll('a.country-tile:not(.country-tile--more)'))
  );

  function getVisible() {
    return links.filter((l) => !l.classList.contains('country-tile--filtered'));
  }

  function filterTiles(q) {
    const query = q.trim().toLowerCase();
    let visible = 0;
    links.forEach((link) => {
      const name = link.textContent.trim().toLowerCase();
      const hide = Boolean(query && !name.includes(query));
      link.classList.toggle('country-tile--filtered', hide);
      if (!hide) visible++;
    });
    if (emptyState) {
      emptyState.hidden = !query || visible > 0;
      if (query && visible === 0) emptyState.textContent = formatCountrySearchEmpty(q);
    }
    return { query, visible };
  }

  let _searchTimer;
  input.addEventListener('input', (e) => {
    const q = /** @type {HTMLInputElement} */ (e.target).value;
    const { query, visible } = filterTiles(q);
    // Debounce search_query to avoid firing on every keystroke
    clearTimeout(_searchTimer);
    if (query) {
      _searchTimer = setTimeout(() => {
        track(EVENTS.SEARCH_QUERY, {
          length: query.length,
          result_count: visible,
          locale: document.documentElement.lang || 'en',
        });
      }, 600);
    }
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const first = getVisible()[0];
      if (first) first.focus();
    } else if (e.key === 'Escape') {
      input.value = '';
      filterTiles('');
    }
  });

  tilesWrap.addEventListener('keydown', (e) => {
    const visible = getVisible();
    const idx = visible.indexOf(/** @type {HTMLAnchorElement} */ (document.activeElement));
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = visible[idx + 1];
      if (next) next.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (idx <= 0) input.focus();
      else visible[idx - 1].focus();
    }
  });
}

// ── Init ───────────────────────────────────────────────────────────────────
async function init() {
  lang = getLang();

  // Apply language direction immediately
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  enforceCanonicalOnDocument(document, window.location.pathname);
  enforceHreflangAlternates(document, window.location.pathname);
  injectFaqSchema(document, buildMethodologyFaqSchema(lang));

  // Nav + footer + spot bar
  const shell = mountSharedShell({ lang, depth: 0, withSpotBar: true });
  initPageEnter('main');
  const navCtrl = shell.navCtrl;
  navCtrl.getLangToggleButtons().forEach((btn) => {
    btn.addEventListener('click', () => {
      lang = lang === 'en' ? 'ar' : 'en';
      saveLang(lang);
      shell.updateLang(lang);
      applyLangToPage();
      mountHomeQuickConvert();
      injectFaqSchema(document, buildMethodologyFaqSchema(lang));
    });
  });

  // Render ad slots
  renderAdSlot('ad-top', 'leaderboard');
  initLazyBelowFoldFeatures();

  // Bind region tab filters
  document.querySelectorAll('.gcc-region-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      homeRegion = tab.dataset.region;
      try {
        const p = JSON.parse(localStorage.getItem('user_prefs') || '{}');
        p.homeRegion = homeRegion;
        localStorage.setItem('user_prefs', JSON.stringify(p));
      } catch (_) {}
      document.querySelectorAll('.gcc-region-tab').forEach((t) => {
        t.classList.remove('is-active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('is-active');
      tab.setAttribute('aria-selected', 'true');
      renderGCCGrid();
    });
    if (tab.dataset.region === homeRegion) {
      tab.classList.add('is-active');
      tab.setAttribute('aria-selected', 'true');
    }
  });

  // Freshness bar dismiss
  document.getElementById('hfb-dismiss')?.addEventListener('click', () => {
    document.getElementById('home-freshness-bar')?.setAttribute('hidden', '');
  });

  // Copy price button (event delegation — covers both GCC grid and karat strip)
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('.gcc-copy-btn, .kstrip-copy-btn');
    if (!btn) return;
    const text = btn.dataset.copy;
    if (!text || text === '—') return;
    const surface = btn.classList.contains('kstrip-copy-btn') ? 'karat_strip' : 'gcc_grid';
    const ok = await copyWithToast(text, {
      successMessage: tx('copyPriceSuccess'),
      errorMessage: tx('copyPriceFailed'),
    });
    if (ok) {
      const orig = btn.textContent;
      btn.textContent = '✓';
      track(EVENTS.COPY_CLICK, { surface, value_type: 'price' });
      setTimeout(() => {
        btn.textContent = orig;
      }, 1500);
    }
  });

  // Karat strip unit toggle
  document.querySelectorAll('.kstrip-unit-btn').forEach((btn) => {
    const unit = btn.dataset.unit;
    if (unit === karatStripUnit) {
      btn.classList.add('is-active');
      btn.setAttribute('aria-pressed', 'true');
    } else {
      btn.classList.remove('is-active');
      btn.setAttribute('aria-pressed', 'false');
    }
    btn.addEventListener('click', () => {
      karatStripUnit = unit;
      try {
        const p = JSON.parse(localStorage.getItem(LANG_KEY) || '{}');
        p.karatStripUnit = unit;
        localStorage.setItem(LANG_KEY, JSON.stringify(p));
      } catch (_) {}
      document.querySelectorAll('.kstrip-unit-btn').forEach((b) => {
        b.classList.toggle('is-active', b.dataset.unit === unit);
        b.setAttribute('aria-pressed', b.dataset.unit === unit ? 'true' : 'false');
      });
      renderKaratStrip();
      syncTrackerLinks();
    });
  });

  // FAQ: one-open-at-a-time behaviour
  document.querySelectorAll('.faq-item').forEach((item) => {
    item.addEventListener('toggle', () => {
      if (item.open) {
        document.querySelectorAll('.faq-item').forEach((other) => {
          if (other !== item) other.open = false;
        });
      }
    });
  });

  // Load cache first for instant render
  const cacheState = {
    lang,
    goldPriceUsdPerOz: null,
    rates: {},
    fxMeta: { nextUpdateUtc: 0 },
    status: {},
    freshness: {},
    favorites: [],
    history: [],
    prevGoldPriceUsdPerOz: null,
    dayOpenGoldPriceUsdPerOz: null,
    isOnline: navigator.onLine,
  };
  cache.loadState(cacheState);

  if (cacheState.goldPriceUsdPerOz) {
    goldPrice = cacheState.goldPriceUsdPerOz;
    dayOpenPrice = cacheState.dayOpenGoldPriceUsdPerOz;
    rates = cacheState.rates;
    goldUpdatedAt = cacheState.freshness?.goldUpdatedAt || null;
  }

  applyLangToPage();
  mountHomeQuickConvert();

  // Analytics: fire page_view on home load
  track(EVENTS.PAGE_VIEW, { path: location.pathname, locale: lang });
  track(EVENTS.PRICE_VIEW, { path: location.pathname, locale: lang, surface: 'home' });

  // Render cached data immediately for instant content (non-blocking)
  if (goldPrice) {
    renderHeroCard();
    renderGCCGrid();
  }

  // Fetch live data (non-blocking)
  initRealtimeEngine();
  fetchLiveData();

  // FX auto-refresh (gold polling handled by realtime pricing engine)
  if (_refreshTimer) clearInterval(_refreshTimer);
  _refreshTimer = setInterval(fetchLiveData, CONSTANTS.GOLD_REFRESH_MS);

  // Tick the "Updated X sec/min ago" label every second without a full price re-fetch.
  startFreshnessTimer();

  // Gentle hero-backdrop parallax (transform-only, reduced-motion bypass)
  const heroEl = document.querySelector('.hero');
  if (heroEl) {
    const prefersReduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!prefersReduced) {
      let parallaxTicking = false;
      window.addEventListener(
        'scroll',
        () => {
          if (parallaxTicking) return;
          parallaxTicking = true;
          window.requestAnimationFrame(() => {
            // Parallax offset: 30% of scroll position, capped at the hero height
            const offset = Math.min(window.scrollY * 0.3, heroEl.offsetHeight);
            heroEl.style.setProperty('--hero-parallax-y', `${offset}px`);
            parallaxTicking = false;
          });
        },
        { passive: true }
      );
    }
  }

  // Clean up timers on page unload to prevent memory leaks
  window.addEventListener(
    'pagehide',
    () => {
      if (_refreshTimer) {
        clearInterval(_refreshTimer);
        _refreshTimer = null;
      }
      if (_freshnessTimer) {
        clearInterval(_freshnessTimer);
        _freshnessTimer = null;
      }
      if (_realtimeEngine) {
        _realtimeEngine.stop();
        _realtimeEngine = null;
      }
    },
    { once: true }
  );

  // Register service worker for offline support
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker
      .register(BASE_PATH + 'sw.js')
      .then(() => initSwUpdateToast())
      .catch(() => {});
  }

  // PWA install prompt — capture the beforeinstallprompt event and show a
  // subtle banner after 30 seconds if the user hasn't dismissed it before.
  initPwaInstallPrompt();
  // Skeleton timeout: if price still loading after 8s, show unavailable state
  setTimeout(() => {
    const priceEl = document.getElementById('hlc-price');
    if (priceEl && priceEl.classList.contains('hlc-price--loading')) {
      priceEl.classList.remove('hlc-price--loading');
      priceEl.textContent = '—';
      const updEl = document.getElementById('hlc-updated');
      if (updEl) {
        updEl.textContent = tx('priceUnavailableConnection');
        updEl.dataset.freshnessKey = 'unavailable';
        updEl.dataset.freshnessAge = 'unavailable';
      }
      const karatUpdEl = document.getElementById('karat-strip-updated');
      if (karatUpdEl) {
        karatUpdEl.textContent = tx('priceUnavailableConnection');
        karatUpdEl.dataset.freshnessKey = 'unavailable';
        karatUpdEl.dataset.freshnessAge = 'unavailable';
      }
      document.getElementById('hero-live-card')?.removeAttribute('aria-busy');
      setTrustChip('home-command-freshness', tx('sourceUnavailable'), 'unavailable');
      setTrustChip('home-command-spot-chip', 'XAU/USD —', 'unavailable');
      setTextById('home-snapshot-status-value', tx('sourceUnavailable'));
      setTextById('home-snapshot-status-note', tx('priceUnavailableConnection'));
      showDataStatusBanner({
        variant: 'error',
        lang,
        message: tx('liveUnavailableBanner'),
        onRetry: () => {
          hideDataStatusBanner();
          if (_realtimeEngine) {
            _realtimeEngine.stop();
            _realtimeEngine = null;
          }
          initRealtimeEngine();
        },
      });
    }
    // GCC grid skeleton timeout
    document.querySelectorAll('.gcc-card.skeleton-card').forEach((card) => {
      card.classList.remove('skeleton-card');
      card.textContent = '—';
    });
  }, SKELETON_TIMEOUT_MS);
}

document.addEventListener('DOMContentLoaded', () => {
  init().catch((err) => {
    console.error('[home] Initialisation error:', err);
  });
});

// ---------------------------------------------------------------------------
// PWA Install Prompt
// ---------------------------------------------------------------------------
/**
 * Listens for the browser's beforeinstallprompt event and shows a subtle
 * bottom banner after a delay. Respects user dismissal via localStorage.
 * The banner renders itself directly into the DOM — no HTML changes needed.
 */
function initPwaInstallPrompt() {
  // Don't show if user already dismissed or if already installed
  if (localStorage.getItem('pwa_install_dismissed')) return;
  if (window.matchMedia('(display-mode: standalone)').matches) return;

  let deferredPrompt = null;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;

    // Show banner after 30 seconds of engagement
    setTimeout(() => {
      if (!deferredPrompt) return;
      if (localStorage.getItem('pwa_install_dismissed')) return;
      showPwaBanner(deferredPrompt);
    }, 30000);
  });
}

function showPwaBanner(deferredPrompt) {
  const banner = document.createElement('div');
  banner.id = 'pwa-install-banner';
  banner.setAttribute('role', 'region');
  banner.setAttribute('aria-label', tx('pwaInstallLabel'));
  banner.append(
    el('div', { class: 'pwa-banner-inner' }, [
      el('img', {
        src: safeHref(`${BASE_PATH}favicon.svg`),
        width: '32',
        height: '32',
        alt: '',
        'aria-hidden': 'true',
        class: 'pwa-banner-icon',
      }),
      el('div', { class: 'pwa-banner-text' }, [
        el('strong', null, tx('pwaTitle')),
        el('span', null, tx('pwaSubtitle')),
      ]),
      el(
        'button',
        {
          class: 'pwa-banner-install btn btn-primary btn-sm',
          id: 'pwa-install-btn',
          type: 'button',
        },
        tx('pwaInstall')
      ),
      el(
        'button',
        {
          class: 'pwa-banner-dismiss',
          id: 'pwa-dismiss-btn',
          'aria-label': tx('pwaDismiss'),
          type: 'button',
        },
        '✕'
      ),
    ])
  );

  // Inject styles
  if (!document.getElementById('pwa-banner-styles')) {
    const style = document.createElement('style');
    style.id = 'pwa-banner-styles';
    style.textContent = `
      #pwa-install-banner {
        position: fixed; bottom: 0; left: 0; right: 0; z-index: 9999;
        background: #1e293b; color: #f8fafc;
        border-top: 2px solid #d4a017;
        padding: 0.75rem 1rem;
        box-shadow: 0 -4px 24px rgba(0,0,0,0.3);
        animation: pwaSlideUp 0.3s ease;
      }
      @media (max-width: 640px) {
        #pwa-install-banner { bottom: 60px; }
      }
      @keyframes pwaSlideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
      .pwa-banner-inner {
        display: flex; align-items: center; gap: 0.75rem;
        max-width: 960px; margin: 0 auto;
      }
      .pwa-banner-icon { flex-shrink: 0; border-radius: 8px; }
      .pwa-banner-text { flex: 1; min-width: 0; }
      .pwa-banner-text strong { display: block; font-size: 0.875rem; font-weight: 700; }
      .pwa-banner-text span { font-size: 0.78rem; color: #94a3b8; }
      .pwa-banner-install {
        flex-shrink: 0; background: #d4a017; color: #fff; border: none;
        padding: 0.45rem 1rem; border-radius: 6px; font-size: 0.8rem;
        font-weight: 700; cursor: pointer; white-space: nowrap;
      }
      .pwa-banner-install:hover { background: #b8860b; }
      .pwa-banner-dismiss {
        background: none; border: none; color: #94a3b8; cursor: pointer;
        font-size: 1rem; padding: 0.25rem 0.5rem; flex-shrink: 0;
      }
      .pwa-banner-dismiss:hover { color: #f8fafc; }
    `;
    document.head.appendChild(style);
  }

  document.body.appendChild(banner);

  document.getElementById('pwa-install-btn').addEventListener('click', async () => {
    banner.remove();
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      localStorage.setItem('pwa_install_dismissed', '1');
    }
    deferredPrompt = null;
  });

  document.getElementById('pwa-dismiss-btn').addEventListener('click', () => {
    banner.remove();
    localStorage.setItem('pwa_install_dismissed', '1');
    deferredPrompt = null;
  });
}
