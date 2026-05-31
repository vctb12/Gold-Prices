// tracker-pro.js — slim orchestrator
import { CONSTANTS, KARATS, COUNTRIES, TRANSLATIONS } from '../config/index.js';
import * as api from '../lib/api.js';
import * as cache from '../lib/cache.js';
import '../lib/reveal.js';
import { createRealtimePricingEngine } from '../lib/realtime-pricing-engine.js';
import { REALTIME_POLLING_DEFAULTS } from '../lib/realtime-config.js';
import { PrimaryQuoteProvider } from '../lib/quote-providers/primary-provider.js';
import { SecondaryQuoteProvider } from '../lib/quote-providers/secondary-provider.js';
import { formatProviderLabel } from '../lib/provider-labels.js';
import { createInitialState, persistState } from '../tracker/state.js';
import { el as safeEl } from '../lib/safe-dom.js';
import { track, EVENTS } from '../lib/analytics.js';
import { getBaselineRange } from '../lib/historical-data.js';
import { getLiveFreshness, getMarketStatus } from '../lib/live-status.js';
import { renderFreshnessBadge } from '../components/FreshnessBadge.js';
import { renderMarketStatusPanel } from '../components/MarketStatusPanel.js';
import { renderQuoteMetaPanel } from '../components/QuoteMetaPanel.js';
import { renderRealtimeSlaPanel } from '../components/RealtimeSlaPanel.js';
import { renderTrackerQuickPresets } from '../components/TrackerQuickPresets.js';
import { renderTrackerCompareHints } from '../components/TrackerCompareHints.js';
import { renderExportHelpTips } from '../components/ExportHelpTips.js';
import { renderAlertsEducationTips } from '../components/AlertsEducationTips.js';
import { initInlineCalc } from '../tracker/inline-calc.js';
import { serializeCalculatorUrlState } from './calculator/url-state.js';
import { bindControlShortcuts } from '../tracker/control-shortcuts.js';
import { initPageEnter } from '../lib/page-enter.js';
import {
  createWatchlistItem,
  getMe,
  isAuthenticated as isAccountAuthenticated,
  redirectToAccount,
} from '../lib/public-account-client.js';
// Lazy-load heavy UI modules (ui-shell, events, wire, adSlot) inside init()
let mountShell;
let fetchWire, renderWireModule;
let initEvents, bindCoreEvents;
let renderAdSlot;
// Note: load `export` and `historical-data` lazily to reduce initial parse and network cost
// Render helpers are lazy-loaded inside init() to reduce initial module parse
let initRender,
  renderAll,
  renderChart,
  renderMarkets,
  renderComparisonWorkspace,
  renderAlerts,
  renderQuickCalculator,
  renderPresets,
  renderPlanners,
  renderArchive;
// render helpers are assigned during init()

const state = createInitialState();
const el = {};
let serverAlertsAvailable = false;
let accountEmailForAlerts = null;
const ALERT_EMAIL_FOCUS_DELAY_MS = 120;
let didPrefillAccountAlertEmail = false;
let realtimeEngine = null;
let realtimeSnapshot = null;
let inlineCalc = null;

function trackerTx(key, params = {}) {
  const fullKey = `tracker.${key}`;
  const template = TRANSLATIONS[state.lang]?.[fullKey] ?? TRANSLATIONS.en?.[fullKey] ?? fullKey;
  return Object.entries(params).reduce(
    (text, [token, value]) => text.replaceAll(`{${token}}`, String(value)),
    template
  );
}

function txGlobal(key) {
  return TRANSLATIONS[state.lang]?.[key] ?? TRANSLATIONS.en?.[key] ?? key;
}

function setInlineLinkText(node, beforeText, href, linkText) {
  if (!node) return;
  const link = document.createElement('a');
  link.href = href;
  link.className = 'tracker-inline-link';
  link.textContent = linkText;
  node.replaceChildren(beforeText, ' ', link);
}

function setButtonCopy(button, label, icon = null) {
  if (!button) return;
  const children = [];
  if (icon) {
    const iconSpan = document.createElement('span');
    iconSpan.setAttribute('aria-hidden', 'true');
    iconSpan.textContent = icon;
    children.push(iconSpan, ' ');
  }
  children.push(label);
  button.replaceChildren(...children);
}

function setNodeText(id, text) {
  const node = document.getElementById(id);
  if (node) node.textContent = text;
}

function syncCurrentCountryPageLink() {
  const link = document.getElementById('tp-country-page-link');
  if (!link) return;
  const selectedCountry = COUNTRIES.find((country) => country.currency === state.selectedCurrency);
  if (!selectedCountry?.slug) {
    link.href = 'countries/index.html';
    link.textContent = trackerTx('quickToolsCountries');
    return;
  }
  link.href = `countries/${selectedCountry.slug}/gold-price/`;
  link.textContent =
    state.lang === 'ar'
      ? `📄 ${selectedCountry.nameAr || selectedCountry.nameEn}`
      : `📄 ${selectedCountry.nameEn}`;
}

function localizeStaticTrackerCopy() {
  document.documentElement.lang = state.lang;
  document.documentElement.dir = state.lang === 'ar' ? 'rtl' : 'ltr';

  const trustContent = document.querySelector('.tracker-trust-content');
  if (trustContent) {
    const strong = document.createElement('strong');
    strong.textContent = trackerTx('referenceBannerTitle');
    const link = document.createElement('a');
    link.href = 'methodology.html';
    link.textContent = trackerTx('referenceBannerLink');
    trustContent.replaceChildren(strong, ` — ${trackerTx('referenceBannerBody')} `, link);
  }

  const trustClose = document.querySelector('.tracker-trust-close');
  if (trustClose) {
    trustClose.setAttribute('aria-label', trackerTx('referenceBannerClose'));
    trustClose.setAttribute('title', trackerTx('referenceBannerClose'));
  }

  const titleSub = document.querySelector('.tracker-hero-title-sub');
  if (titleSub) titleSub.textContent = trackerTx('heroSub');
  const heroKicker = document.getElementById('tp-hero-kicker');
  if (heroKicker) heroKicker.textContent = trackerTx('heroKicker');
  const heroTitle = document.getElementById('tp-hero-title');
  if (heroTitle && titleSub) {
    if (heroKicker) {
      heroTitle.replaceChildren(heroKicker, ` ${trackerTx('heroTitle')} `, titleSub);
    } else {
      heroTitle.replaceChildren(`${trackerTx('heroTitle')} `, titleSub);
    }
  }

  setInlineLinkText(
    document.getElementById('tp-hero-copy'),
    trackerTx('heroCopy'),
    'methodology.html#spot-vs-retail',
    trackerTx('heroCopyLink')
  );

  setButtonCopy(el.refreshBtn, trackerTx('actions.refresh'), '↻');
  if (el.refreshBtn) el.refreshBtn.setAttribute('aria-label', trackerTx('actions.refreshLabel'));
  setButtonCopy(el.shareBtn, trackerTx('actions.copyBrief'));
  if (el.shareBtn) el.shareBtn.setAttribute('aria-label', trackerTx('actions.copyBriefLabel'));
  setButtonCopy(el.resetBtn, trackerTx('actions.reset'));
  if (el.resetBtn) el.resetBtn.setAttribute('aria-label', trackerTx('actions.resetLabel'));

  const jumpChart = document.getElementById('tp-jump-chart');
  if (jumpChart) {
    const arrow = document.createElement('span');
    arrow.setAttribute('aria-hidden', 'true');
    arrow.textContent = state.lang === 'ar' ? '←' : '↓';
    jumpChart.replaceChildren(trackerTx('actions.viewChart'), ' ', arrow);
    jumpChart.setAttribute('aria-label', trackerTx('actions.jumpChartLabel'));
  }

  const fieldLabels = document.querySelectorAll('.tracker-hero-field .tracker-field-label');
  const fieldKeys = [
    trackerTx('controls.language'),
    trackerTx('controls.currency'),
    trackerTx('controls.karat'),
    trackerTx('controls.unit'),
  ];
  fieldLabels.forEach((label, index) => {
    if (fieldKeys[index]) label.textContent = fieldKeys[index];
  });

  const referenceHint = document.querySelector('.tracker-hero-footer .tracker-hint-text');
  if (referenceHint) {
    const icon = document.createElement('span');
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = '⚠';
    const link = document.createElement('a');
    link.href = 'methodology.html';
    link.className = 'tracker-inline-link';
    link.textContent = trackerTx('hints.referenceLink');
    referenceHint.replaceChildren(icon, ` ${trackerTx('hints.reference')} · `, link);
  }

  const keyboardHint = document.getElementById('tp-hero-hints');
  if (keyboardHint) keyboardHint.textContent = trackerTx('hints.shortcuts');

  const quickToolsHeading = document.querySelector(
    '.tracker-side-card--links .tracker-side-subheading'
  );
  if (quickToolsHeading) quickToolsHeading.textContent = trackerTx('quickToolsTitle');

  const quickToolLinks = document.querySelectorAll(
    '.tracker-side-card--links a, .tracker-side-card--links button'
  );
  const quickToolLabels = [
    trackerTx('quickToolsCalculator'),
    trackerTx('quickToolsCountryPage'),
    trackerTx('quickToolsCountries'),
    trackerTx('quickToolsShops'),
    trackerTx('quickToolsMethodology'),
    trackerTx('quickToolsCreateServerAlert'),
    trackerTx('quickToolsSpotVsRetail'),
  ];
  quickToolLinks.forEach((link, index) => {
    if (quickToolLabels[index]) link.textContent = quickToolLabels[index];
  });
  setNodeText('tp-alert-account-hint', trackerTx('alerts.accountPrefillHint'));
  syncCurrentCountryPageLink();

  const quickReference = document.querySelector('.tracker-hero-aside');
  if (quickReference)
    quickReference.setAttribute('aria-label', trackerTx('quickReferenceAriaLabel'));

  setNodeText('tp-mobile-workspace-kicker', trackerTx('mobileWorkspaceKicker'));
  setNodeText('tp-mobile-workspace-title', trackerTx('mobileWorkspaceTitle'));
  setNodeText('tp-mobile-workspace-copy', trackerTx('mobileWorkspaceCopy'));
  setNodeText('tp-mobile-selected-label', trackerTx('mobileStatusLabel'));
  setNodeText('tp-mobile-selected-note', trackerTx('mobileStatusNote'));
  setNodeText('tp-mobile-price-label', trackerTx('mobilePriceLabel'));
  setNodeText('tp-mobile-price-note', trackerTx('mobilePriceNote'));
  setNodeText('tp-mobile-spot-label', trackerTx('mobileSpotLabel'));
  setNodeText('tp-mobile-spot-note', trackerTx('mobileSpotNote'));
  setNodeText('tp-mobile-updated-label', trackerTx('mobileFreshnessLabel'));
  setNodeText('tp-mobile-updated-note', trackerTx('mobileFreshnessNote'));
  setNodeText('tp-mobile-summary-note', trackerTx('mobileSummaryNote'));
  setNodeText('tp-mobile-action-compare-kicker', trackerTx('mobileActionCompareKicker'));
  setNodeText('tp-mobile-action-compare-label', trackerTx('mobileActionCompareLabel'));
  setNodeText('tp-mobile-action-compare-desc', trackerTx('mobileActionCompareDesc'));
  setNodeText('tp-mobile-action-archive-kicker', trackerTx('mobileActionArchiveKicker'));
  setNodeText('tp-mobile-action-archive-label', trackerTx('mobileActionArchiveLabel'));
  setNodeText('tp-mobile-action-archive-desc', trackerTx('mobileActionArchiveDesc'));
  setNodeText('tp-mobile-action-exports-kicker', trackerTx('mobileActionExportsKicker'));
  setNodeText('tp-mobile-action-exports-label', trackerTx('mobileActionExportsLabel'));
  setNodeText('tp-mobile-action-exports-desc', trackerTx('mobileActionExportsDesc'));
  setNodeText('tp-mobile-action-alerts-kicker', trackerTx('mobileActionAlertsKicker'));
  setNodeText('tp-mobile-action-alerts-label', trackerTx('mobileActionAlertsLabel'));
  setNodeText('tp-mobile-action-alerts-desc', trackerTx('mobileActionAlertsDesc'));
  setNodeText('tp-alert-delivery-label', trackerTx('alerts.deliveryLabel'));
  setNodeText('tp-alert-email-label', trackerTx('alerts.serverEmailLabel'));
  setNodeText('tp-alert-email-hint', trackerTx('alerts.serverEmailHint'));
  if (el.saveWatchlistAccount) {
    el.saveWatchlistAccount.textContent =
      state.lang === 'ar' ? 'حفظ قائمة المراقبة في الحساب' : 'Save watchlist to account';
  }
  if (el.alertDelivery?.options?.[0]) {
    el.alertDelivery.options[0].textContent = trackerTx('alerts.deliveryLocal');
  }
  if (el.alertDelivery?.options?.[1]) {
    el.alertDelivery.options[1].textContent = trackerTx('alerts.deliveryServer');
  }
  setNodeText('tp-mobile-cue-chart-kicker', trackerTx('mobileCueChartKicker'));
  setNodeText('tp-mobile-cue-chart-title', trackerTx('mobileCueChartTitle'));
  setNodeText('tp-mobile-cue-chart-copy', trackerTx('mobileCueChartCopy'));
  setNodeText('tp-mobile-cue-tools-kicker', trackerTx('mobileCueToolsKicker'));
  setNodeText('tp-mobile-cue-tools-title', trackerTx('mobileCueToolsTitle'));
  setNodeText('tp-mobile-cue-tools-copy', trackerTx('mobileCueToolsCopy'));
  setNodeText('tp-chart-source-note', trackerTx('chartSourceNote'));
  setNodeText('tp-chart-history-source', trackerTx('historySource.preparing'));
  setNodeText('tp-karat-heading', trackerTx('karatSectionTitle'));
  setNodeText('tp-karat-source-note', trackerTx('karatSectionNote'));
  setNodeText('tp-alerts-watchlist-title', trackerTx('alertsWatchlistTitle'));
  setNodeText('tp-watchlist-title', trackerTx('watchlistTitle'));
  setNodeText('tp-decision-cues-title', trackerTx('decisionCuesTitle'));
  setButtonCopy(
    document.getElementById('tp-open-alerts-inline'),
    trackerTx('actions.openAlertsPanel')
  );
  setNodeText('tp-quick-calc-title', trackerTx('quickCalc.title'));
  setNodeText('tp-quick-calc-copy', trackerTx('quickCalc.copy'));
  setNodeText('tp-quick-calc-weight-label', trackerTx('quickCalc.weightLabel'));
  setNodeText('tp-quick-calc-karat-label', trackerTx('quickCalc.karatLabel'));
  setNodeText('tp-quick-calc-currency-label', trackerTx('quickCalc.currencyLabel'));
  setNodeText('tp-quick-calc-result-label', trackerTx('quickCalc.resultLabel'));
  setNodeText('tp-quick-calc-meta', trackerTx('quickCalc.meta'));
  setNodeText('tp-quick-calc-open-full', trackerTx('quickCalc.openFull'));
  setNodeText('tp-quick-calc-method-link', trackerTx('quickCalc.methodLink'));
  setNodeText('tp-export-command-title', trackerTx('exportCommand.title'));
  setNodeText('tp-export-command-copy', trackerTx('exportCommand.copy'));
  setNodeText('tp-export-readiness-pill', trackerTx('exportReadiness.checking'));
  setNodeText('tracker-inline-calc-title', trackerTx('inlineCalcTitle'));
  setNodeText('tracker-inline-calc-sub', trackerTx('inlineCalcSub'));
  setNodeText('tracker-inline-calc-weight-label', trackerTx('calcWeightLabel'));
  setNodeText('tracker-inline-calc-karat-label', trackerTx('calcKaratLabel'));
  setNodeText('tracker-inline-calc-currency-label', trackerTx('calcCurrencyLabel'));
  setNodeText('tracker-inline-calc-result-label', trackerTx('calcResultLabel'));
  setNodeText('tracker-inline-calc-disclaimer', trackerTx('calcDisclaimer'));
  setNodeText('tracker-inline-calc-method-link', trackerTx('calcMethodLink'));
  const inlineCalcWeight = document.getElementById('tracker-inline-calc-weight');
  if (inlineCalcWeight) {
    inlineCalcWeight.placeholder = trackerTx('calcWeightPlaceholder');
  }
  setButtonCopy(document.getElementById('tp-share-inline'), trackerTx('actions.copyBrief'));
  setButtonCopy(
    document.getElementById('tp-open-exports-inline'),
    trackerTx('actions.openExportsPanel')
  );
  setInlineLinkText(
    document.getElementById('tp-export-source-note'),
    trackerTx('exportCommand.note'),
    'methodology.html',
    trackerTx('referenceBannerLink')
  );
  setNodeText('tp-history-caption', trackerTx('historyCaptionLoading'));
  setNodeText('tp-market-scroll-hint', trackerTx('marketScrollHint'));
  setNodeText('tp-archive-scroll-hint', trackerTx('archiveScrollHint'));
  setNodeText('tp-compare-builder-title', trackerTx('compare.builderTitle'));
  setNodeText('tp-compare-note', trackerTx('compare.builderNote'));
  const monthLabel = document.querySelector('.tracker-history-month-field > span');
  if (monthLabel) monthLabel.textContent = trackerTx('compare.monthLabel');
  setButtonCopy(document.getElementById('tp-history-month-clear'), trackerTx('compare.clearMonth'));
  el.compareCountrySelects?.forEach((select, index) => {
    const span = select?.closest('label')?.querySelector('span');
    if (span) span.textContent = trackerTx('compare.countryLabel', { index: index + 1 });
  });
  setButtonCopy(document.getElementById('tp-export-compare'), trackerTx('compare.exportLabel'));
  setButtonCopy(document.getElementById('tp-export-compare-2'), trackerTx('compare.exportLabel'));
  const presetLabels = [
    trackerTx('compare.presetGcc'),
    trackerTx('compare.presetUae'),
    trackerTx('compare.presetArab'),
  ];
  el.comparePresetButtons?.forEach((button, index) => {
    if (presetLabels[index]) button.textContent = presetLabels[index];
  });
}

function syncInlineCalcCalculatorLink() {
  const link = document.getElementById('tracker-inline-calc-full-link');
  const weightInput = document.getElementById('tracker-inline-calc-weight');
  const karatSelect = document.getElementById('tracker-inline-calc-karat');
  const currencySelect = document.getElementById('tracker-inline-calc-currency');
  if (!link) return;
  link.textContent = trackerTx('quickCalc.openFull');
  const weight = weightInput?.value || '';
  const karat = karatSelect?.value || state.selectedKarat || '24';
  const currency = currencySelect?.value || state.selectedCurrency || 'AED';
  link.href = `calculator.html${serializeCalculatorUrlState({
    weight,
    karat,
    currency,
    mode: 'value',
    valueMode: 'weight',
  })}&lang=${state.lang}`;
}

function syncInlineCalcSourceNote(freshnessKey, freshnessMeta) {
  inlineCalc?.update({
    goldPriceUsd: currentSpot(),
    rates: state.rates,
    lang: state.lang,
  });
  syncInlineCalcCalculatorLink();
  setNodeText(
    'tracker-inline-calc-source',
    trackerTx('summary.freshnessCopy', {
      source: formatProviderLabel(state.live?.providerId || 'primary-provider'),
      age: freshnessMeta.ageText,
      time: freshnessMeta.timeText,
    })
  );
  const result = document.getElementById('tracker-inline-calc-result');
  if (result) result.dataset.freshnessKey = freshnessKey;
}

function renderTrackerAddonPanels() {
  const freshnessKey = realtimeSnapshot?.freshness?.state || state.live?.status || 'unavailable';
  const freshnessMeta = getLiveFreshness({
    updatedAt: state.live?.updatedAt,
    lang: state.lang,
    hasLiveFailure: state.hasLiveFailure,
    isFallback: state.live?.isFallback ?? null,
    isFresh: state.live?.isFresh ?? null,
  });

  const freshnessSlot = document.getElementById('tp-freshness-badge-slot');
  if (freshnessSlot) {
    freshnessSlot.replaceChildren(
      renderFreshnessBadge({
        lang: state.lang,
        state: freshnessKey,
        source: formatProviderLabel(state.live?.providerId || 'primary-provider'),
        updatedAt: state.live?.updatedAt,
        marketOpen: getMarketStatus().isOpen,
        t: txGlobal,
      })
    );
  }

  const marketSlot = document.getElementById('tp-market-status-slot');
  if (marketSlot) {
    marketSlot.replaceChildren(
      renderMarketStatusPanel({
        lang: state.lang,
        t: txGlobal,
      })
    );
  }

  const quoteMetaSlot = document.getElementById('tp-quote-meta-slot');
  if (quoteMetaSlot) {
    quoteMetaSlot.replaceChildren(
      renderQuoteMetaPanel({
        lang: state.lang,
        statusLabel: trackerTx(`source.${freshnessKey}`),
        sourceLabel: formatProviderLabel(state.live?.providerId || 'primary-provider'),
        providerId: formatProviderLabel(state.live?.providerId || 'primary-provider'),
        providerTimestamp: state.live?.sourceTimestamp,
        fetchedAt: state.live?.fetchedAt,
        ageLabel: freshnessMeta.ageText,
        pollIntervalMs: realtimeSnapshot?.metrics?.nextPollInMs ?? null,
        lastFetchLatencyMs: realtimeSnapshot?.metrics?.latestNetworkLatencyMs ?? null,
        t: txGlobal,
      })
    );
  }

  const slaSlot = document.getElementById('tp-realtime-sla-slot');
  if (slaSlot) {
    const debugFreshness = new URLSearchParams(location.search).get('debugFreshness') === '1';
    if (!debugFreshness) {
      slaSlot.replaceChildren();
    } else {
      slaSlot.replaceChildren(
        renderRealtimeSlaPanel({
          snapshot: realtimeSnapshot,
          t: txGlobal,
        })
      );
    }
  }

  document
    .getElementById('tp-quick-presets-slot')
    ?.replaceChildren(renderTrackerQuickPresets({ t: txGlobal }));
  document
    .getElementById('tp-compare-hints-slot')
    ?.replaceChildren(renderTrackerCompareHints({ t: txGlobal }));
  document
    .getElementById('tp-export-help-slot')
    ?.replaceChildren(renderExportHelpTips({ t: txGlobal }));
  document
    .getElementById('tp-alerts-help-slot')
    ?.replaceChildren(renderAlertsEducationTips({ t: txGlobal }));
  syncInlineCalcSourceNote(freshnessKey, freshnessMeta);
}

function ui() {
  return {
    refreshBtn: document.getElementById('tp-refresh-btn'),
    shareBtn: document.getElementById('tp-share-btn'),
    resetBtn: document.getElementById('tp-reset-btn'),
    workspaceToggle: document.getElementById('tp-workspace-toggle'),
    language: document.getElementById('tp-language'),
    currency: document.getElementById('tp-currency'),
    karat: document.getElementById('tp-karat'),
    unit: document.getElementById('tp-unit'),
    compare: document.getElementById('tp-compare-country'),
    rangePills: document.querySelectorAll('.tracker-pill[data-range]'),
    historyMonth: document.getElementById('tp-history-month'),
    historyMonthClear: document.getElementById('tp-history-month-clear'),
    autoRefresh: document.getElementById('tp-auto-refresh'),
    liveBadgeText: document.getElementById('tp-live-badge-text'),
    xauUsdValue: document.getElementById('tp-xauusd-value'),
    marketBadge: document.getElementById('tp-market-badge'),
    refreshBadge: document.getElementById('tp-refresh-badge'),
    heroStats: document.getElementById('tp-hero-stats'),
    summaryList: document.getElementById('tp-summary-list'),
    wireTrack: document.getElementById('tp-wire-track'),
    wireRefresh: document.getElementById('tp-wire-refresh'),
    wireToggle: document.getElementById('tp-wire-toggle'),
    chart: document.getElementById('tp-chart'),
    chartWrap: document.querySelector('.tracker-chart-wrap'),
    tooltip: document.getElementById('tp-tooltip'),
    legendMain: document.getElementById('tp-legend-main'),
    legendCompare: document.getElementById('tp-legend-compare'),
    miniStrip: document.getElementById('tp-mini-strip'),
    chartStats: document.getElementById('tp-chart-stats'),
    chartHistorySource: document.getElementById('tp-chart-history-source'),
    historyCaption: document.getElementById('tp-history-caption'),
    rangeNotes: document.getElementById('tp-range-notes'),
    playbackStrip: document.getElementById('tp-playback-strip'),
    playbackBtn: document.getElementById('tp-playback-btn'),
    karatTable: document.getElementById('tp-karat-table'),
    marketFilter: document.getElementById('tp-market-filter'),
    marketSort: document.getElementById('tp-market-sort'),
    marketView: document.getElementById('tp-market-view'),
    marketBoard: document.getElementById('tp-market-board'),
    marketEmpty: document.getElementById('tp-market-empty'),
    compareCountrySelects: [
      document.getElementById('tp-compare-country-1'),
      document.getElementById('tp-compare-country-2'),
      document.getElementById('tp-compare-country-3'),
    ],
    compareKaratButtons: document.querySelectorAll('[data-compare-karat]'),
    comparePresetButtons: document.querySelectorAll('[data-compare-preset]'),
    comparisonCards: document.getElementById('tp-comparison-cards'),
    comparisonEmpty: document.getElementById('tp-comparison-empty'),
    watchlistGrid: document.getElementById('tp-watchlist-grid'),
    decisionCues: document.getElementById('tp-decision-cues'),
    alertSummary: document.getElementById('tp-alert-summary'),
    openAlertsInline: document.getElementById('tp-open-alerts-inline'),
    alertScope: document.getElementById('tp-alert-scope'),
    alertScopeWrap: document.getElementById('tp-alert-scope-wrap'),
    alertDelivery: document.getElementById('tp-alert-delivery'),
    alertDirection: document.getElementById('tp-alert-direction'),
    alertTarget: document.getElementById('tp-alert-target'),
    alertEmail: document.getElementById('tp-alert-email'),
    alertEmailWrap: document.getElementById('tp-alert-email-wrap'),
    alertAccountHint: document.getElementById('tp-alert-account-hint'),
    alertList: document.getElementById('tp-alert-list'),
    alertPermission: document.getElementById('tp-alert-permission'),
    alertServerStatus: document.getElementById('tp-alert-server-status'),
    saveAlert: document.getElementById('tp-save-alert'),
    enableNotifications: document.getElementById('tp-enable-notifications'),
    presetName: document.getElementById('tp-preset-name'),
    savePreset: document.getElementById('tp-save-preset'),
    copyUrl: document.getElementById('tp-copy-url'),
    presetList: document.getElementById('tp-preset-list'),
    budgetAmount: document.getElementById('tp-budget-amount'),
    budgetFee: document.getElementById('tp-budget-fee'),
    budgetResults: document.getElementById('tp-budget-results'),
    positionEntry: document.getElementById('tp-position-entry'),
    positionQty: document.getElementById('tp-position-qty'),
    positionResults: document.getElementById('tp-position-results'),
    jewelryWeight: document.getElementById('tp-jewelry-weight'),
    jewelryKarat: document.getElementById('tp-jewelry-karat'),
    jewelryMaking: document.getElementById('tp-jewelry-making'),
    jewelryPremium: document.getElementById('tp-jewelry-premium'),
    jewelryVat: document.getElementById('tp-jewelry-vat'),
    jewelryResults: document.getElementById('tp-jewelry-results'),
    accumMonthly: document.getElementById('tp-accum-monthly'),
    accumTarget: document.getElementById('tp-accum-target'),
    accumResults: document.getElementById('tp-accum-results'),
    archiveRange: document.getElementById('tp-archive-range'),
    archiveSearch: document.getElementById('tp-archive-search'),
    archiveBody: document.getElementById('tp-archive-body'),
    archiveMeta: document.getElementById('tp-archive-meta'),
    exportArchive: document.getElementById('tp-export-archive'),
    exportArchive2: document.getElementById('tp-export-archive-2'),
    exportHistory: document.getElementById('tp-export-history'),
    exportHistory2: document.getElementById('tp-export-history-2'),
    lookupDate: document.getElementById('tp-lookup-date'),
    runLookup: document.getElementById('tp-run-lookup'),
    lookupResults: document.getElementById('tp-lookup-results'),
    seasonalResults: document.getElementById('tp-seasonal-results'),
    exportChart: document.getElementById('tp-export-chart'),
    exportChart2: document.getElementById('tp-export-chart-2'),
    exportCompare: document.getElementById('tp-export-compare'),
    exportCompare2: document.getElementById('tp-export-compare-2'),
    exportWatchlist: document.getElementById('tp-export-watchlist'),
    saveWatchlistAccount: document.getElementById('tp-save-watchlist-account'),
    quickCalcWeight: document.getElementById('tp-quick-calc-weight'),
    quickCalcKarat: document.getElementById('tp-quick-calc-karat'),
    quickCalcCurrency: document.getElementById('tp-quick-calc-currency'),
    quickCalcResult: document.getElementById('tp-quick-calc-result'),
    quickCalcMeta: document.getElementById('tp-quick-calc-meta'),
    openExportsInline: document.getElementById('tp-open-exports-inline'),
    shareInline: document.getElementById('tp-share-inline'),
    downloadJson: document.getElementById('tp-download-json'),
    downloadJson2: document.getElementById('tp-download-json-2'),
    downloadBrief: document.getElementById('tp-download-brief'),
    briefHeadline: document.getElementById('tp-brief-headline'),
    briefCopy: document.getElementById('tp-brief-copy'),
    toastStack: document.getElementById('tp-toast-stack'),
    createServerAlertLink: document.getElementById('tp-create-server-alert-link'),
  };
}

function updateServerAlertUiState() {
  if (!el.alertDelivery) return;
  const wantsServer = el.alertDelivery.value === 'server';
  const canUseServer = serverAlertsAvailable;

  if (el.alertEmailWrap) {
    el.alertEmailWrap.hidden = !(wantsServer && canUseServer);
  }
  if (el.alertAccountHint) {
    el.alertAccountHint.hidden = !(didPrefillAccountAlertEmail && wantsServer && canUseServer);
  }
  if (el.alertScopeWrap) {
    el.alertScopeWrap.hidden = wantsServer && canUseServer;
  }

  if (wantsServer && !canUseServer) {
    el.alertDelivery.value = 'local';
    if (el.alertServerStatus) {
      el.alertServerStatus.textContent = trackerTx('alerts.serverUnavailable');
    }
    return;
  }

  if (el.alertServerStatus) {
    el.alertServerStatus.textContent = canUseServer
      ? trackerTx('alerts.serverAvailable')
      : trackerTx('alerts.serverUnavailable');
  }
}

async function probeServerAlertsAvailability() {
  try {
    const res = await fetch('/api/v1/config/public', {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return false;
    const payload = await res.json();
    return payload?.ok === true && payload?.data?.features?.alerts === true;
  } catch {
    return false;
  }
}

async function createServerAlert({ condition, target }) {
  const typedEmail = el.alertEmail?.value?.trim();
  const email = (typedEmail || accountEmailForAlerts || '').toLowerCase();
  if (!email) {
    throw new Error(trackerTx('alerts.serverEmailRequired'));
  }

  const response = await fetch('/api/v1/alerts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      channel: 'email',
      symbol: 'XAUUSD',
      currency: state.selectedCurrency === 'AED' ? 'AED' : 'USD',
      condition,
      threshold_value: target,
      karat: state.selectedCurrency === 'AED' ? state.selectedKarat : null,
      country_code: state.selectedCurrency === 'AED' ? 'AE' : null,
      cooldown_minutes: 60,
    }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error?.message || trackerTx('alerts.serverCreateFailed'));
  }
  return payload?.data || null;
}

async function prefillServerAlertEmailFromAccount() {
  if (!isAccountAuthenticated()) return;
  try {
    const me = await getMe();
    const email = me?.user?.email?.trim()?.toLowerCase();
    if (!email) return;
    accountEmailForAlerts = email;
    const canPrefill = el.alertEmail && !el.alertEmail.value;
    if (canPrefill) {
      el.alertEmail.value = email;
      didPrefillAccountAlertEmail = true;
    }
    updateServerAlertUiState();
  } catch {
    // non-blocking
  }
}

async function syncAlertToAccount({ condition, target }) {
  if (!isAccountAuthenticated()) return;
  const currency = state.selectedCurrency || 'USD';
  const karat = state.selectedKarat || '24';
  const itemKey = `${condition}:${target}:${currency}:${karat}`;
  await createWatchlistItem({
    item_type: 'alert',
    item_key: itemKey.slice(0, 120),
    item_label:
      state.lang === 'ar'
        ? `تنبيه ${condition === 'above' ? 'أعلى من' : 'أقل من'} ${target}`
        : `Alert ${condition} ${target}`,
    metadata: {
      source: 'tracker',
      condition,
      target,
      currency,
      karat,
    },
  });
}

async function saveWatchlistToAccount() {
  if (!isAccountAuthenticated()) {
    if (
      window.confirm(
        state.lang === 'ar'
          ? 'سجّل الدخول لمزامنة قائمة المراقبة عبر الأجهزة.'
          : 'Sign in to sync watchlist across devices.'
      )
    ) {
      redirectToAccount();
    }
    return;
  }

  const favorites = Array.isArray(state.favorites) ? state.favorites : [];
  for (const currency of favorites) {
    if (!currency) continue;
    await createWatchlistItem({
      item_type: 'currency',
      item_key: String(currency).toUpperCase(),
      item_label: String(currency).toUpperCase(),
      metadata: { source: 'tracker-watchlist' },
    });
  }
  showToast(
    state.lang === 'ar'
      ? `تم حفظ ${favorites.length} عناصر في حسابك.`
      : `Saved ${favorites.length} watchlist items to your account.`
  );
}

function initMobileWorkspaceActions() {
  document.querySelectorAll('[data-mobile-action]').forEach((button) => {
    button.addEventListener('click', () => {
      const action = button.getAttribute('data-mobile-action');
      if (
        ['compare', 'archive', 'exports'].includes(action) &&
        !document.body.classList.contains('tracker-workspace-advanced')
      ) {
        el.workspaceToggle?.click();
      }
      const targetMap = {
        compare: '#tab-compare',
        archive: '#tab-archive',
        exports: '#tab-exports',
        alerts: '#tab-alerts',
      };
      const target = targetMap[action];
      if (!target) return;
      document.querySelector(target)?.click();
    });
  });
}

// ── Price helpers ─────────────────────────────────────────────────────────────

function currentSpot() {
  return state.live?.price ?? null;
}

const TOLA_GRAMS = 11.6638;
const KG_GRAMS = 1000;

function priceFor({ currency, karat, unit, spot }) {
  const s = spot ?? currentSpot();
  if (!s) return null;
  const karatObj = KARATS.find((k) => k.code === String(karat));
  if (!karatObj) return null;
  const usdPerGram = (s / CONSTANTS.TROY_OZ_GRAMS) * karatObj.purity;
  let local;
  if (currency === 'AED') {
    local = usdPerGram * CONSTANTS.AED_PEG;
  } else {
    const rate = state.rates?.[currency];
    if (!rate) return null;
    local = usdPerGram * rate;
  }
  if (unit === 'oz') return local * CONSTANTS.TROY_OZ_GRAMS;
  if (unit === 'tola') return local * TOLA_GRAMS;
  if (unit === 'kg') return local * KG_GRAMS;
  return local;
}

function flagForCurrency(code) {
  const country = COUNTRIES.find((c) => c.currency === code);
  return country?.flag ? `${country.flag} ` : '';
}

function getSelectedComparisonCountries() {
  return (state.compareCountries || [])
    .map((code) => COUNTRIES.find((country) => country.code === code))
    .filter(Boolean)
    .slice(0, 3);
}

function getSelectedComparisonKarats() {
  return (state.compareKarats || []).filter(Boolean).slice(0, 4);
}

// ── UI helpers ────────────────────────────────────────────────────────────────

function showToast(msg, durationMs = 3500) {
  if (!el.toastStack) return;
  const toast = document.createElement('div');
  toast.className = 'tracker-toast';
  toast.textContent = msg;
  el.toastStack.appendChild(toast);
  setTimeout(() => toast.remove(), durationMs);
}

function checkAlerts() {
  const spot = currentSpot();
  if (!spot || !state.alerts?.length) return;
  const triggered = [];
  state.alerts.forEach((a) => {
    const hit = a.direction === 'above' ? spot > a.target : spot < a.target;
    if (hit) {
      triggered.push(`${a.scope} ${a.direction} $${a.target}`);
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Gold Price Alert', {
          body: `XAU/USD ${a.direction} ${a.target}: now $${spot.toFixed(2)}`,
        });
      }
    }
  });
  // Announce triggered alerts to screen readers via the aria-live region
  if (triggered.length) {
    const liveRegion = document.getElementById('tp-alert-live-region');
    if (liveRegion) {
      liveRegion.textContent = `Alert triggered: ${triggered.join(', ')} — current price $${spot.toFixed(2)}`;
    }
  }
}

async function exportArchiveData() {
  if (!state.history.length) {
    showToast('No archive data available.');
    return;
  }
  const records = state.history.map((r) => ({
    date: r.date instanceof Date ? r.date.toISOString().slice(0, 10) : String(r.date),
    price: r.spot,
    source: r.source,
    granularity: r.granularity,
  }));
  try {
    const expMod = await import('../lib/export.js');
    expMod.exportHistoricalCSV(records, state.selectedKarat);
  } catch (_e) {
    showToast('Export failed');
  }
}

function exportHistoryData() {
  // keep synchronous facade; archive export is async but not awaited here
  exportArchiveData();
}

async function exportChartData() {
  if (!state.history.length) {
    showToast('No chart data available yet.');
    return;
  }
  const flat = state.history.map((r) => ({
    date: r.date instanceof Date ? r.date.toISOString().slice(0, 10) : String(r.date),
    spot: r.spot,
    price: r.spot,
    source: r.source,
  }));
  const spot = currentSpot();
  // Filter to the visible range before exporting so the CSV matches what the user sees
  const { filterByRange } = await import('../lib/historical-data.js');
  const rangeFiltered = state.range ? filterByRange(flat, state.range) : flat;
  const rows = rangeFiltered.filter(Boolean);
  if (spot)
    rows.push({ date: new Date().toISOString().slice(0, 10), spot, price: spot, source: 'live' });
  try {
    const expMod = await import('../lib/export.js');
    expMod.exportChartCSV(rows, state.range, state.selectedKarat);
    showToast('Chart CSV downloaded');
  } catch (_e) {
    showToast('Export failed');
  }
}

async function exportWatchlistData() {
  const spot = currentSpot();
  if (!spot) {
    showToast('Waiting for live price data.');
    return;
  }
  if (!state.favorites?.length) {
    showToast('No favorites in watchlist. Add currencies via Compare tab.');
    return;
  }
  try {
    const expMod = await import('../lib/export.js');
    expMod.exportWatchlistCSV({
      favorites: state.favorites,
      countries: COUNTRIES,
      karatCode: state.selectedKarat,
      priceFor,
      spot,
      selectedUnit: state.selectedUnit,
      selectedCurrency: state.selectedCurrency,
      lang: state.lang,
    });
    showToast('Watchlist CSV downloaded');
  } catch (_e) {
    showToast('Export failed');
  }
}

async function exportComparisonData() {
  const spot = currentSpot();
  if (!spot) {
    showToast('Waiting for live price data.');
    return;
  }
  const countries = getSelectedComparisonCountries();
  const karats = getSelectedComparisonKarats();
  if (!countries.length || !karats.length) {
    showToast('Select at least one country and one karat.');
    return;
  }
  try {
    const expMod = await import('../lib/export.js');
    expMod.exportComparisonCSV({
      countries,
      karatCodes: karats,
      priceFor,
      spot,
      freshness: {
        goldUpdatedAt: state.live?.updatedAt || null,
        fxUpdatedAt: state.fxMeta?.lastUpdateUtc || null,
        hasLiveFailure: state.hasLiveFailure,
      },
      lang: state.lang,
    });
    showToast('Comparison CSV downloaded');
  } catch (_e) {
    showToast('Export failed');
  }
}

async function exportBriefData() {
  const headline = el.briefHeadline?.textContent;
  const body = el.briefCopy?.textContent;
  if (!headline || headline.startsWith('Waiting')) {
    showToast('Waiting for live data.');
    return;
  }
  try {
    const expMod = await import('../lib/export.js');
    expMod.exportBriefText(headline, body);
    showToast('Brief downloaded');
  } catch (_e) {
    showToast('Export failed');
  }
}

async function exportJsonData() {
  const spot = currentSpot();
  const prices = {};
  if (spot) {
    KARATS.forEach((k) => {
      prices[k.code] = {};
      [...new Set(COUNTRIES.map((c) => c.currency))].forEach((cur) => {
        const p = priceFor({ currency: cur, karat: k.code, unit: 'gram', spot });
        if (p) prices[k.code][cur] = { gram: p, oz: p * CONSTANTS.TROY_OZ_GRAMS };
      });
    });
  }
  const hasLiveFailure = state.hasLiveFailure;
  const baselineRange = getBaselineRange();
  const exportState = {
    goldPriceUsdPerOz: spot || null,
    freshness: {
      goldUpdatedAt: state.live?.updatedAt || new Date().toISOString(),
      fxUpdatedAt: state.fxMeta?.lastUpdateUtc || new Date().toISOString(),
      hasLiveFailure,
    },
    rates: state.rates,
    lang: state.lang,
    selectedCurrency: state.selectedCurrency,
    selectedKarat: state.selectedKarat,
    selectedUnit: state.selectedUnit,
    compareCountries: getSelectedComparisonCountries().map((country) => ({
      code: country.code,
      currency: country.currency,
      nameEn: country.nameEn,
      nameAr: country.nameAr,
    })),
    compareKarats: getSelectedComparisonKarats(),
    historyMonth: state.historyMonth || null,
    range: state.range,
    baselineCoverage: {
      first: baselineRange.first,
      last: baselineRange.last,
      monthCount: baselineRange.count,
    },
  };
  try {
    const expMod = await import('../lib/export.js');
    expMod.exportJSON(exportState, prices);
  } catch (_e) {
    showToast('Export failed');
  }
}

// ── Auto-refresh ──────────────────────────────────────────────────────────────

let _autoRefreshTimer = null;
let _countdownTimer = null;
let _countdownValue = 0;
let _fetchInFlight = false; // used for non-pricing refresh tasks only

function startCountdown() {
  clearInterval(_countdownTimer);
  const nextPollMs = realtimeSnapshot?.metrics?.nextPollInMs ?? CONSTANTS.GOLD_REFRESH_MS;
  _countdownValue = Math.floor(nextPollMs / 1000);

  // Query once; reused by every tick and the initial paint.
  const el_countdown = document.getElementById('tp-countdown');

  // Display the initial value immediately so the user sees the full countdown.
  if (el_countdown) el_countdown.textContent = trackerTx('countdown', { seconds: _countdownValue });

  function tick() {
    _countdownValue--;
    if (_countdownValue <= 0) {
      clearInterval(_countdownTimer);
      if (el_countdown) el_countdown.textContent = '';
      return;
    }
    if (el_countdown)
      el_countdown.textContent = trackerTx('countdown', { seconds: _countdownValue });
  }
  _countdownTimer = setInterval(tick, 1000);
}

function startAutoRefresh() {
  if (realtimeEngine) realtimeEngine.start();
  if (_autoRefreshTimer) return;
  _autoRefreshTimer = setInterval(
    async () => {
      if (!state.autoRefresh) return;
      if (_fetchInFlight) return;
      _fetchInFlight = true;
      try {
        await ensureUnifiedHistory();
        await refreshWire();
        checkAlerts();
        renderAll();
        renderTrackerAddonPanels();
      } finally {
        _fetchInFlight = false;
      }
    },
    Math.max(CONSTANTS.GOLD_REFRESH_MS, 20000)
  );
}

function stopAutoRefresh() {
  if (realtimeEngine) realtimeEngine.stop();
  clearInterval(_autoRefreshTimer);
  _autoRefreshTimer = null;
}

// ── Populates dropdowns ───────────────────────────────────────────────────────

function populateSelects() {
  if (el.currency) {
    const currencies = [...new Set(COUNTRIES.map((c) => c.currency))].sort();
    const frag = document.createDocumentFragment();
    currencies.forEach((c) => {
      const opt = safeEl('option', { value: c }, [`${flagForCurrency(c)}${c}`]);
      if (c === state.selectedCurrency) opt.selected = true;
      frag.appendChild(opt);
    });
    el.currency.replaceChildren(frag);
  }
  if (el.karat) {
    const frag = document.createDocumentFragment();
    KARATS.forEach((k) => {
      const opt = safeEl('option', { value: k.code }, [
        `${k.code}K — ${(k.purity * 100).toFixed(1)}%`,
      ]);
      if (k.code === state.selectedKarat) opt.selected = true;
      frag.appendChild(opt);
    });
    el.karat.replaceChildren(frag);
  }
  if (el.unit) {
    const frag = document.createDocumentFragment();
    ['gram', 'oz', 'tola', 'kg'].forEach((u) => {
      const unitKey =
        u === 'gram' ? 'Gram' : u === 'oz' ? 'Oz' : u === 'tola' ? 'Tola' : 'Kg';
      const opt = safeEl('option', { value: u }, [trackerTx(`controls.unit${unitKey}`)]);
      if (u === state.selectedUnit) opt.selected = true;
      frag.appendChild(opt);
    });
    el.unit.replaceChildren(frag);
  }
  if (el.language) el.language.value = state.lang;
  if (el.quickCalcKarat) {
    const frag = document.createDocumentFragment();
    KARATS.forEach((k) => {
      const opt = safeEl('option', { value: k.code }, [`${k.code}K`]);
      if (k.code === state.selectedKarat) opt.selected = true;
      frag.appendChild(opt);
    });
    el.quickCalcKarat.replaceChildren(frag);
  }
  if (el.quickCalcCurrency) {
    const currencies = [...new Set(COUNTRIES.map((c) => c.currency))].sort();
    const frag = document.createDocumentFragment();
    currencies.forEach((c) => {
      const opt = safeEl('option', { value: c }, [c]);
      if (c === state.selectedCurrency) opt.selected = true;
      frag.appendChild(opt);
    });
    el.quickCalcCurrency.replaceChildren(frag);
  }
  if (el.historyMonth) el.historyMonth.value = state.historyMonth || '';
  // Sync range pills with persisted state (HTML default is 24H; state default is 30D).
  if (el.rangePills?.length) {
    el.rangePills.forEach((p) => {
      const active = p.dataset.range === state.range;
      p.classList.toggle('is-active', active);
      p.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }
  if (el.jewelryKarat) {
    const frag = document.createDocumentFragment();
    KARATS.forEach((k) => {
      frag.appendChild(safeEl('option', { value: k.code }, [`${k.code}K`]));
    });
    el.jewelryKarat.replaceChildren(frag);
  }
  if (el.compareCountrySelects?.length) {
    const options = COUNTRIES.map((country) => ({
      value: country.code,
      label:
        state.lang === 'ar'
          ? `${country.flag ?? ''} ${country.nameAr || country.nameEn}`.trim()
          : `${country.flag ?? ''} ${country.nameEn}`.trim(),
    }));
    el.compareCountrySelects.forEach((select, index) => {
      if (!select) return;
      const frag = document.createDocumentFragment();
      frag.appendChild(safeEl('option', { value: '' }, ['—']));
      options.forEach((option) => {
        const node = safeEl('option', { value: option.value }, [option.label]);
        if (option.value === state.compareCountries[index]) node.selected = true;
        frag.appendChild(node);
      });
      select.replaceChildren(frag);
    });
  }
  if (el.compareKaratButtons?.length) {
    el.compareKaratButtons.forEach((button) => {
      const active = state.compareKarats.includes(button.dataset.compareKarat);
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }
  if (el.comparePresetButtons?.length) {
    el.comparePresetButtons.forEach((button) => {
      button.classList.toggle('is-active', button.dataset.comparePreset === state.comparePreset);
    });
  }
}

// ── Data fetch ────────────────────────────────────────────────────────────────

function applyRealtimeSnapshot(snapshot) {
  realtimeSnapshot = snapshot;
  const quote = snapshot?.quote;
  if (quote?.price) {
    state.live = {
      price: quote.price,
      updatedAt: quote.providerTimestamp || quote.fetchedAt,
      providerId: quote.providerId,
      source: quote.source || quote.providerId,
      status: snapshot?.freshness?.state || quote.status || 'cached',
      isFresh: quote.isFresh ?? null,
      isFallback: quote.isFallback ?? null,
      freshnessSeconds: quote.freshnessSeconds ?? null,
      sourceTimestamp: quote.providerTimestamp ?? null,
      raw: quote.providerRaw || quote,
      fetchedAt: quote.fetchedAt || null,
    };
    state.hasLiveFailure = quote.providerPathSuccessful === false;
    cache.saveGoldPrice(state.live.price, state.live.updatedAt);
    cache.checkDayOpenReset({ goldPriceUsdPerOz: state.live.price });
    const today = new Date().toISOString().slice(0, 10);
    const alreadySaved = (state.snapshots || []).some((s) => s.date === today);
    if (!alreadySaved) {
      state.snapshots = [
        ...(state.snapshots || []),
        { date: today, price: state.live.price, timestamp: Date.now() },
      ];
    }
  } else if (!state.live) {
    state.hasLiveFailure = true;
  }

  startCountdown();
  renderAll?.();
  renderTrackerAddonPanels();
}

function initRealtimeEngine() {
  if (realtimeEngine) return;

  realtimeEngine = createRealtimePricingEngine({
    primaryProvider: new PrimaryQuoteProvider({ timeoutMs: 5000 }),
    secondaryProvider: new SecondaryQuoteProvider({ timeoutMs: 5000 }),
    config: REALTIME_POLLING_DEFAULTS,
    debug: new URLSearchParams(location.search).get('debugFreshness') === '1',
  });

  const cacheBoot = cache.getFallbackGoldPrice();
  if (cacheBoot) {
    realtimeEngine.seedFromCache({
      price: cacheBoot.price,
      updatedAt: cacheBoot.updatedAt,
      fetchedAt: cacheBoot.fetchedAt,
      providerId: 'cache',
      source: 'cache',
    });
  }

  realtimeEngine.subscribe((snapshot) => {
    applyRealtimeSnapshot(snapshot);
  });

  if (state.autoRefresh) realtimeEngine.start();
  document.addEventListener('visibilitychange', () => {
    realtimeEngine?.setVisibility(!document.hidden);
  });
}

async function refreshData(forceLive = true, includeWire = true) {
  const tasks = [];
  if (forceLive) tasks.push(fetchLive());
  tasks.push(ensureUnifiedHistory());
  if (includeWire) tasks.push(refreshWire());
  await Promise.all(tasks);
  // If advanced chart is loaded, give it the updated unified history
  try {
    if (window.__GOLD_CHART && typeof window.__GOLD_CHART.setDailyHistory === 'function') {
      window.__GOLD_CHART.setDailyHistory(state.history || []);
    }
  } catch (_e) {
    console.warn('[chart-hook] setDailyHistory failed', _e);
  }
  persistState(state);
  renderTrackerAddonPanels();
}

async function fetchLive() {
  if (realtimeEngine) {
    await realtimeEngine.refreshNow('manual-refresh');
  }

  try {
    const data = await api.fetchFX();
    state.rates = data.rates;
    state.fxMeta = {
      lastUpdateUtc: data.time_last_update_utc,
      nextUpdateUtc: new Date(data.time_next_update_utc).getTime(),
    };
    cache.saveFXRates(state.rates, state.fxMeta);
  } catch (_e) {
    console.warn('[tracker] refreshData failed', _e);
    state.hasLiveFailure = true;
  }
  // When live price arrives, update advanced chart if it's loaded
  try {
    if (window.__GOLD_CHART && state.live && typeof window.__GOLD_CHART.addPoint === 'function') {
      window.__GOLD_CHART.addPoint(state.live.price, state.live.updatedAt || Date.now());
    }
  } catch (_e) {
    // non-fatal
  }
}

async function ensureUnifiedHistory() {
  const cachedDaily = Array.isArray(state.snapshots) ? state.snapshots : [];
  const { getUnifiedHistory } = await import('../lib/historical-data.js');
  const unified = await getUnifiedHistory(cachedDaily);
  state.history = unified
    .map((row) => ({
      date: new Date(row.date.length === 7 ? `${row.date}-01` : row.date),
      spot: Number(row.price),
      source: row.source,
      granularity: row.granularity,
    }))
    .filter((r) => r.spot > 0 && Number.isFinite(r.date.getTime()));
}

async function refreshWire() {
  const { items } = await fetchWire(state.wireItems || []);
  state.wireItems = items;
  renderWireModule(el, state);
}

// ── Init ──────────────────────────────────────────────────────────────────────

async function init() {
  // Wait for DOM to be fully ready
  if (document.readyState !== 'complete' && document.readyState !== 'interactive') {
    await new Promise((r) => document.addEventListener('DOMContentLoaded', r, { once: true }));
  }

  Object.assign(el, ui());

  document.documentElement.lang = state.lang;
  document.documentElement.dir = state.lang === 'ar' ? 'rtl' : 'ltr';
  // Lazy-load render helpers and UI modules to reduce initial parse cost
  const [renderMod, uiMod, eventsMod, wireMod, adMod] = await Promise.all([
    import('../tracker/render.js'),
    import('../tracker/ui-shell.js'),
    import('../tracker/events.js'),
    import('../tracker/wire.js'),
    import('../components/adSlot.js'),
  ]);

  ({
    initRender,
    renderAll,
    renderChart,
    renderMarkets,
    renderComparisonWorkspace,
    renderAlerts,
    renderQuickCalculator,
    renderPresets,
    renderPlanners,
    renderArchive,
  } = renderMod);
  ({ mountShell } = uiMod);
  ({ initEvents, bindCoreEvents } = eventsMod);
  ({ fetchWire, renderWire: renderWireModule } = wireMod);
  ({ renderAdSlot } = adMod);

  // Init sub-modules with their dependencies
  initRender({ state, el, priceFor, currentSpot, showToast });
  initEvents({
    state,
    el,
    tx: trackerTx,
    refreshData,
    renderAll,
    renderMarkets,
    renderComparisonWorkspace,
    renderAlerts,
    renderPresets,
    renderPlanners,
    renderArchive,
    showToast,
    currentSpot,
    priceFor,
    startAutoRefresh,
    stopAutoRefresh,
    populateSelects,
    refreshWire,
    exportArchiveData,
    exportHistoryData,
    exportJsonData,
    exportChartData,
    exportWatchlistData,
    exportComparisonData,
    exportBriefData,
    updateServerAlertUiState,
    createServerAlert,
    syncAlertToAccount,
  });

  mountShell(
    state,
    el,
    /* onModeChange */ () => {
      populateSelects();
      renderAll();
      renderTrackerAddonPanels();
    },
    /* onLangChange */ () => {
      localizeStaticTrackerCopy();
      populateSelects();
      updateServerAlertUiState();
      renderAll();
      renderTrackerAddonPanels();
    }
  );

  localizeStaticTrackerCopy();
  populateSelects();
  inlineCalc = initInlineCalc({
    goldPriceUsd: currentSpot(),
    rates: state.rates,
    lang: state.lang,
  });
  ['tracker-inline-calc-weight', 'tracker-inline-calc-karat', 'tracker-inline-calc-currency'].forEach(
    (id) => {
      document.getElementById(id)?.addEventListener('input', syncInlineCalcCalculatorLink);
      document.getElementById(id)?.addEventListener('change', syncInlineCalcCalculatorLink);
    }
  );
  syncInlineCalcCalculatorLink();
  renderTrackerAddonPanels();
  initRealtimeEngine();
  serverAlertsAvailable = await probeServerAlertsAvailability();
  updateServerAlertUiState();
  bindCoreEvents();
  bindControlShortcuts({
    state,
    el,
    currentSpot,
    priceFor,
    persistState: () => persistState(state),
    renderAll,
    tx: trackerTx,
  });
  initPageEnter('#tracker-app');
  await prefillServerAlertEmailFromAccount();
  el.createServerAlertLink?.addEventListener('click', (event) => {
    event.preventDefault();
    const alertsTab = document.getElementById('tab-alerts');
    alertsTab?.click();
    if (serverAlertsAvailable && el.alertDelivery) {
      el.alertDelivery.value = 'server';
      updateServerAlertUiState();
    }
    setTimeout(() => el.alertEmail?.focus(), ALERT_EMAIL_FOCUS_DELAY_MS);
  });
  el.openAlertsInline?.addEventListener('click', (event) => {
    event.preventDefault();
    const alertsTab = document.getElementById('tab-alerts');
    alertsTab?.click();
    if (serverAlertsAvailable && el.alertDelivery) {
      el.alertDelivery.value = 'server';
      updateServerAlertUiState();
    }
    setTimeout(() => el.alertEmail?.focus(), ALERT_EMAIL_FOCUS_DELAY_MS);
  });
  el.openExportsInline?.addEventListener('click', (event) => {
    event.preventDefault();
    if (!document.body.classList.contains('tracker-workspace-advanced')) {
      el.workspaceToggle?.click();
    }
    document.getElementById('tab-exports')?.click();
  });
  el.shareInline?.addEventListener('click', (event) => {
    event.preventDefault();
    el.shareBtn?.click();
  });
  [el.quickCalcWeight, el.quickCalcKarat, el.quickCalcCurrency].forEach((field) => {
    field?.addEventListener('input', () => renderQuickCalculator());
  });
  el.saveWatchlistAccount?.addEventListener('click', () => {
    saveWatchlistToAccount().catch(() => {
      showToast(
        state.lang === 'ar'
          ? 'تعذر حفظ قائمة المراقبة حالياً.'
          : 'Could not save watchlist right now.'
      );
    });
  });
  el.currency?.addEventListener('change', () => syncCurrentCountryPageLink());
  initMobileWorkspaceActions();

  if (localStorage.getItem('tracker_trust_banner_dismissed')) {
    const trustSection = document.querySelector('.tracker-data-trust-section');
    if (trustSection) trustSection.style.display = 'none';
  }

  const regionTabs = document.querySelectorAll('.tracker-region-pill[data-region]');
  regionTabs.forEach((btn) => {
    const isActive = btn.dataset.region === (state.activeRegion || 'gcc');
    btn.classList.toggle('is-active', isActive);
  });

  // Skip fetching the market wire during initial load to reduce critical path
  await refreshData(false, false);
  renderAll();
  renderTrackerAddonPanels();
  syncCurrentCountryPageLink();
  if (state.autoRefresh) startAutoRefresh();
  startCountdown();

  // Analytics: fire page_view + tracker_view after first data load
  const locale = document.documentElement.lang || 'en';
  track(EVENTS.PAGE_VIEW, { path: location.pathname, locale });
  track(EVENTS.PRICE_VIEW, { path: location.pathname, locale, surface: 'tracker' });
  track(EVENTS.TRACKER_VIEW, {
    karat: state.selectedKarat,
    country: state.selectedCountry,
    currency: state.selectedCurrency,
  });

  // Render ads (ad slot renderer was lazy-loaded above)
  try {
    if (renderAdSlot) {
      if ('requestIdleCallback' in window) {
        requestIdleCallback(() => renderAdSlot('ad-bottom', 'rectangle'), { timeout: 5000 });
      } else {
        setTimeout(() => renderAdSlot('ad-bottom', 'rectangle'), 1500);
      }
    }
  } catch (_e) {
    console.warn('[ads] failed to render ad slot', _e);
  }

  // Install the chart loader non-blocking; loader itself will lazy-load the heavy chart
  try {
    import('./tracker-chart-loader.js')
      .then((m) => m.installChartLoader({ state, el }))
      .catch(() => {});
  } catch (_e) {
    // silent
  }

  // Mobile swipe for region tabs
  const marketBoard = document.getElementById('tp-market-board');
  if (marketBoard) {
    let touchStartX = 0;
    const REGIONS_ORDER = ['gcc', 'levant', 'africa', 'global'];

    marketBoard.addEventListener(
      'touchstart',
      (e) => {
        touchStartX = e.touches[0].clientX;
      },
      { passive: true }
    );
    marketBoard.addEventListener(
      'touchend',
      (e) => {
        const dx = e.changedTouches[0].clientX - touchStartX;
        if (Math.abs(dx) < 50) return;
        const currentIdx = REGIONS_ORDER.indexOf(state.activeRegion || 'gcc');
        let nextIdx = dx < 0 ? currentIdx + 1 : currentIdx - 1;
        nextIdx = Math.max(0, Math.min(REGIONS_ORDER.length - 1, nextIdx));
        if (nextIdx !== currentIdx) {
          state.activeRegion = REGIONS_ORDER[nextIdx];
          document.querySelectorAll('.tracker-region-pill[data-region]').forEach((btn) => {
            btn.classList.toggle('is-active', btn.dataset.region === state.activeRegion);
          });
          renderMarkets();
        }
      },
      { passive: true }
    );
  }

  // Redraw chart on resize so viewBox stays in sync with container dimensions
  let _resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(_resizeTimer);
    _resizeTimer = setTimeout(() => {
      if (state.mode === 'live') renderChart();
    }, 150);
  });

  window.addEventListener(
    'pagehide',
    () => {
      realtimeEngine?.stop();
      realtimeEngine = null;
    },
    { once: true }
  );
}

// Offline detection
function handleOnlineStatus() {
  const isOnline = navigator.onLine;
  let offlineBanner = document.getElementById('tp-offline-banner');
  if (!isOnline) {
    if (!offlineBanner) {
      offlineBanner = document.createElement('div');
      offlineBanner.id = 'tp-offline-banner';
      offlineBanner.style.cssText =
        'position:fixed;top:0;left:0;right:0;z-index:9999;background:#dc2626;color:white;text-align:center;padding:0.5rem;font-size:0.875rem;font-weight:500;';
      const cached = state.live?.updatedAt
        ? new Date(state.live.updatedAt).toLocaleTimeString(
            state.lang === 'ar' ? 'ar-AE' : 'en-AE',
            {
              hour: '2-digit',
              minute: '2-digit',
            }
          )
        : trackerTx('offlineUnknown');
      offlineBanner.textContent = trackerTx('offlineBanner', { time: cached });
      document.body.prepend(offlineBanner);
    }
  } else {
    offlineBanner?.remove();
  }
}
window.addEventListener('online', handleOnlineStatus);
window.addEventListener('offline', handleOnlineStatus);

// ── Share / copy-URL buttons ──────────────────────────────────────────────
function initShareButtons() {
  function copyUrlToClipboard(btn) {
    const url = window.location.href;
    navigator.clipboard
      ?.writeText(url)
      .then(() => {
        if (!btn) return;
        const orig = btn.textContent;
        btn.textContent = '✓ Copied!';
        setTimeout(() => {
          btn.textContent = orig;
        }, 2000);
      })
      .catch(() => {});
  }
  document
    .getElementById('tp-copy-url')
    ?.addEventListener('click', (e) => copyUrlToClipboard(e.currentTarget));
  document
    .getElementById('tp-share-btn')
    ?.addEventListener('click', (e) => copyUrlToClipboard(e.currentTarget));
}

// ── First-time onboarding overlay ────────────────────────────────────────
function initOnboarding() {
  const SEEN_KEY = 'tracker_onb_seen';
  const overlay = document.getElementById('tracker-onboarding');
  if (!overlay) return;
  try {
    if (localStorage.getItem(SEEN_KEY) === '1') return;
  } catch {
    return;
  }

  setTimeout(() => {
    overlay.removeAttribute('hidden');
  }, 1800);

  function dismiss() {
    overlay.setAttribute('hidden', '');
    try {
      localStorage.setItem(SEEN_KEY, '1');
    } catch {}
  }
  document.getElementById('onb-dismiss')?.addEventListener('click', dismiss);
  document.getElementById('onb-close')?.addEventListener('click', dismiss);
  overlay.querySelector('.onb-backdrop')?.addEventListener('click', dismiss);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !overlay.hasAttribute('hidden')) dismiss();
  });
}

init();
initShareButtons();
initOnboarding();
