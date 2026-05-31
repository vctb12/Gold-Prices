// tracker/hero.js — tracker hero, mini strip, and karat table rendering
import { CONSTANTS, KARATS, COUNTRIES } from '../config/index.js';
import { _state, _el, _priceFor, _currentSpot, tx, formatUsd, formatUnitLabel } from './_ctx.js';
import { clear, el, setText } from '../lib/safe-dom.js';
import { getMarketStatus } from '../lib/live-status.js';
import { pulseFreshness } from '../lib/freshness-pulse.js';
import { countUp } from '../lib/count-up.js';
import { getDayOpenPrice } from '../lib/cache.js';
import {
  TRACKER_BADGE_CLASSES,
  SOURCE_BADGE_CLASS,
  STATUS_BADGE_CLASS,
  applyStatusBadge,
  buildSourceBadge,
  getFreshnessModel,
} from './freshness.js';

function renderPriceChangeStrip(spot, dayOpenSpot) {
  const strip = document.getElementById('tp-price-change-strip');
  if (!strip) return;
  if (!spot || !dayOpenSpot || dayOpenSpot <= 0) {
    strip.hidden = true;
    strip.textContent = '';
    return;
  }
  const delta = spot - dayOpenSpot;
  const pct = (delta / dayOpenSpot) * 100;
  const isUp = delta >= 0;
  strip.hidden = false;
  strip.classList.remove('tracker-price-change-strip--up', 'tracker-price-change-strip--down');
  strip.classList.add(isUp ? 'tracker-price-change-strip--up' : 'tracker-price-change-strip--down');
  strip.setAttribute('role', 'status');
  strip.setAttribute('aria-live', 'polite');
  const sign = isUp ? '+' : '−';
  setText(
    strip,
    tx('heroChangeStrip', {
      sign: isUp ? '▲' : '▼',
      amount: `${sign}$${Math.abs(delta).toFixed(2)}`,
      pct: Math.abs(pct).toFixed(2),
    })
  );
}

function buildStackItem(title, copy, badge = null) {
  const headerChildren = [el('strong', null, title)];
  if (badge) headerChildren.push(badge);
  return el('div', { class: 'tracker-stack-item' }, [
    el('div', { class: 'tracker-stack-top' }, headerChildren),
    el('p', null, copy),
  ]);
}

export function renderHero() {
  const spot = _currentSpot();
  const freshness = getFreshnessModel();
  const liveBadge = document.getElementById('tp-live-badge');
  const sourceStateBadge = document.getElementById('tp-source-state-badge');
  const summaryHeading = document.getElementById('tp-live-summary-heading');
  const isConnecting = !spot && !_state.hasLiveFailure;
  const summaryFreshness = isConnecting
    ? {
        ...freshness,
        key: 'live',
        sourceLabel: tx('source.live'),
        sourceBadgeClass: SOURCE_BADGE_CLASS.live,
        badgeClass: STATUS_BADGE_CLASS.live,
        tooltip: tx('connecting'),
      }
    : freshness;

  if (summaryHeading) setText(summaryHeading, tx('liveDeskTitle'));

  if (liveBadge) {
    liveBadge.classList.remove(...TRACKER_BADGE_CLASSES);
    liveBadge.classList.add(isConnecting ? 'tracker-badge-live' : freshness.badgeClass);
    const liveBadgeLabel = isConnecting ? tx('connecting') : freshness.tooltip;
    liveBadge.title = liveBadgeLabel;
    liveBadge.setAttribute('aria-label', liveBadgeLabel);
  }

  if (_el.liveBadgeText) {
    if (spot) {
      setText(
        _el.liveBadgeText,
        tx('refreshBadge', {
          source: freshness.sourceLabel,
          age: freshness.ageText,
        })
      );
    } else {
      setText(_el.liveBadgeText, _state.hasLiveFailure ? tx('liveUnavailable') : tx('connecting'));
    }
  }

  if (sourceStateBadge) {
    sourceStateBadge.classList.remove(...TRACKER_BADGE_CLASSES);
    sourceStateBadge.classList.add(
      isConnecting
        ? 'tracker-badge-live'
        : STATUS_BADGE_CLASS[freshness.effectiveKey] || 'tracker-badge--cached'
    );
    const label = isConnecting ? tx('connecting') : freshness.providerLabel;
    const tooltip = isConnecting ? tx('connecting') : freshness.tooltip;
    sourceStateBadge.textContent = label;
    sourceStateBadge.title = tooltip;
    sourceStateBadge.setAttribute('aria-label', tooltip);
  }

  if (_el.xauUsdValue) {
    if (spot) {
      countUp(_el.xauUsdValue, spot, {
        decimals: 2,
        format: (n) => formatUsd(n),
        pulse: true,
        pulseTarget: _el.xauUsdValue?.closest('.tracker-hero-price, .tracker-metric'),
      });
      pulseFreshness(_el.xauUsdValue);
    } else {
      setText(_el.xauUsdValue, '—');
    }
  }
  const xauBadge = document.getElementById('tp-xauusd-badge');
  if (xauBadge) {
    xauBadge.title = freshness.tooltip;
    xauBadge.setAttribute('aria-label', `XAU/USD · ${freshness.tooltip}`);
  }

  if (_el.marketBadge) {
    const market = getMarketStatus();
    const marketText = market.isOpen ? tx('marketOpen') : tx('marketClosed');
    setText(_el.marketBadge, marketText);
    // Provide a clean aria-label without decorative bullet/circle for screen readers
    _el.marketBadge.setAttribute(
      'aria-label',
      market.isOpen ? tx('marketOpenAriaLabel') : tx('marketClosedAriaLabel')
    );
  }

  if (_el.refreshBadge) {
    const hasMeaningfulTime =
      typeof freshness.timeText === 'string' &&
      freshness.timeText.trim() &&
      freshness.timeText !== '—';
    let refreshText;
    if (!spot) {
      if (_state.hasLiveFailure) {
        refreshText = hasMeaningfulTime
          ? tx('refreshBadgeUnavailable', { time: freshness.timeText })
          : tx('liveUnavailable');
      } else {
        refreshText = tx('connecting');
      }
    } else if (
      freshness.key === 'stale' ||
      freshness.key === 'cached' ||
      freshness.key === 'delayed' ||
      freshness.key === 'fallback'
    ) {
      refreshText = tx('refreshBadgeStale', { time: freshness.timeText });
    } else {
      refreshText = tx('refreshBadgeDetailed', {
        age: freshness.ageText,
        time: freshness.timeText,
      });
    }
    if (isConnecting) {
      _el.refreshBadge.classList.remove(...TRACKER_BADGE_CLASSES);
      _el.refreshBadge.classList.add('tracker-badge-live');
      _el.refreshBadge.title = tx('connecting');
      _el.refreshBadge.setAttribute('aria-label', tx('connecting'));
      setText(_el.refreshBadge, refreshText);
    } else {
      applyStatusBadge(_el.refreshBadge, freshness, refreshText);
    }
  }

  const dayOpenSpot = getDayOpenPrice();
  renderPriceChangeStrip(spot, dayOpenSpot);

  if (_el.heroStats) {
    _el.heroStats.removeAttribute('aria-busy');
  }

  if (_el.heroStats && spot) {
    const aed24 = _priceFor({ currency: 'AED', karat: '24', unit: 'gram', spot });
    const aed22 = _priceFor({ currency: 'AED', karat: '22', unit: 'gram', spot });
    const usd24g =
      (spot / CONSTANTS.TROY_OZ_GRAMS) * (KARATS.find((k) => k.code === '24')?.purity ?? 1);

    let spotSubText = tx('heroStatSpotSub', { source: freshness.sourceLabel });
    if (dayOpenSpot && dayOpenSpot > 0) {
      const pct = ((spot - dayOpenSpot) / dayOpenSpot) * 100;
      const sign = pct >= 0 ? '▲' : '▼';
      spotSubText = `${tx('heroStatSpotSub', { source: freshness.sourceLabel })} ${tx('heroStatDayChange', { sign, pct: Math.abs(pct).toFixed(2) })}`;
    }

    const statDefs = [
      { key: 'xau', label: 'XAU/USD', value: spot, sub: spotSubText, format: (n) => formatUsd(n) },
      {
        key: 'aed24',
        label: 'UAE 24K',
        value: aed24,
        sub: tx('heroStatGramSub'),
        format: (n) => `AED ${n.toFixed(2)}`,
      },
      {
        key: 'aed22',
        label: 'UAE 22K',
        value: aed22,
        sub: tx('heroStatGramSub'),
        format: (n) => `AED ${n.toFixed(2)}`,
      },
      {
        key: 'usd24g',
        label: 'USD/g 24K',
        value: usd24g,
        sub: tx('heroStatGramSub'),
        format: (n) => formatUsd(n, 3),
      },
    ];

    const isFirst = !_el.heroStats.querySelector('[data-stat-key]');
    if (isFirst) {
      clear(_el.heroStats);
      statDefs.forEach((def) => {
        const card = el('div', { class: 'tracker-hero-stat card-interactive', 'data-stat-key': def.key }, [
          el('div', { class: 'tracker-hero-k' }, def.label),
          el('div', { class: 'tracker-hero-v tracker-tabular-nums', 'data-stat-value': def.key }, '—'),
          el('div', { class: 'tracker-hero-s', 'data-stat-sub': def.key }, def.sub),
        ]);
        _el.heroStats.append(card);
      });
    } else {
      statDefs.forEach((def) => {
        const subEl = _el.heroStats.querySelector(`[data-stat-sub="${def.key}"]`);
        if (subEl) setText(subEl, def.sub);
      });
    }

    statDefs.forEach((def) => {
      const valueEl = _el.heroStats.querySelector(`[data-stat-value="${def.key}"]`);
      if (!valueEl) return;
      if (!Number.isFinite(def.value)) {
        setText(valueEl, '—');
        return;
      }
      countUp(valueEl, def.value, {
        decimals: def.key === 'usd24g' ? 3 : 2,
        format: def.format,
        pulse: true,
        pulseTarget: valueEl.closest('.tracker-hero-stat'),
      });
    });
  } else if (_el.heroStats && !spot) {
    clear(_el.heroStats);
    _el.heroStats.setAttribute('aria-busy', 'true');
  }

  if (_el.summaryList) {
    clear(_el.summaryList);

    const summaryItems = [
      buildStackItem(tx('summary.referenceTitle'), tx('summary.referenceCopy')),
      buildStackItem(
        tx('summary.freshnessTitle'),
        spot
          ? tx('summary.freshnessCopy', {
              source: summaryFreshness.sourceLabel,
              age: summaryFreshness.ageText,
              time: summaryFreshness.timeText,
            })
          : _state.hasLiveFailure
            ? tx('liveUnavailable')
            : tx('connecting'),
        buildSourceBadge(summaryFreshness)
      ),
      buildStackItem(tx('summary.sourceTitle'), tx('summary.sourceCopy')),
      buildStackItem(tx('summary.aedPegTitle'), tx('summary.aedPegCopy')),
      buildStackItem(tx('summary.historyTitle'), tx('summary.historyCopy')),
    ];

    _el.summaryList.append(...summaryItems);
  }

  const selectedCountry = COUNTRIES.find((country) => country.currency === _state.selectedCurrency);
  const selectedLabel = selectedCountry
    ? _state.lang === 'ar'
      ? selectedCountry.nameAr || selectedCountry.nameEn
      : selectedCountry.nameEn
    : _state.selectedCurrency;
  const selectedPrice = spot
    ? _priceFor({
        currency: _state.selectedCurrency,
        karat: _state.selectedKarat,
        unit: _state.selectedUnit,
        spot,
      })
    : null;
  const mobileStatus = document.getElementById('tp-mobile-summary-status');
  if (mobileStatus) {
    mobileStatus.textContent = spot
      ? `${freshness.sourceLabel} · ${freshness.ageText}`
      : _state.hasLiveFailure
        ? tx('liveUnavailable')
        : tx('connecting');
    mobileStatus.dataset.tone =
      freshness.key === 'live' ? 'live' : freshness.key === 'unavailable' ? 'neutral' : 'warning';
  }
  const mobileSource = document.getElementById('tp-mobile-summary-source');
  if (mobileSource) {
    mobileSource.textContent = `${selectedLabel} · ${_state.selectedCurrency}`;
    mobileSource.dataset.tone = 'info';
  }
  setText(document.getElementById('tp-mobile-selected-value'), selectedLabel);
  setText(
    document.getElementById('tp-mobile-selected-note'),
    `${_state.selectedCurrency} · ${_state.selectedKarat}K / ${formatUnitLabel(_state.selectedUnit)}`
  );
  const mobilePriceEl = document.getElementById('tp-mobile-price-value');
  if (mobilePriceEl) {
    if (selectedPrice) {
      countUp(mobilePriceEl, selectedPrice, {
        decimals: 2,
        format: (n) =>
          n.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        pulse: true,
        pulseTarget: mobilePriceEl.closest('.tracker-mobile-dock__price, .tracker-mobile-summary'),
      });
    } else {
      setText(mobilePriceEl, '—');
    }
  }
  setText(document.getElementById('tp-mobile-price-note'), tx('marketTrust'));
  setText(document.getElementById('tp-mobile-spot-value'), spot ? formatUsd(spot) : '—');
  setText(document.getElementById('tp-mobile-spot-note'), tx('mobileSpotNote'));
  setText(
    document.getElementById('tp-mobile-updated-value'),
    spot
      ? freshness.sourceLabel
      : _state.hasLiveFailure
        ? tx('source.unavailable')
        : tx('connecting')
  );
  setText(
    document.getElementById('tp-mobile-updated-note'),
    spot ? freshness.timeText : tx('liveUnavailable')
  );
}

export function renderMiniStrip() {
  if (!_el.miniStrip) return;
  const spot = _currentSpot();
  if (!spot) {
    _el.miniStrip.textContent = tx('waitingLive');
    return;
  }
  const selected = _priceFor({
    currency: _state.selectedCurrency,
    karat: _state.selectedKarat,
    unit: _state.selectedUnit,
    spot,
  });
  _el.miniStrip.textContent = selected
    ? tx('miniStripSummary', {
        currency: _state.selectedCurrency,
        karat: _state.selectedKarat,
        unit: formatUnitLabel(_state.selectedUnit),
        price: selected.toFixed(2),
      })
    : '—';
}

export function renderKaratTable() {
  if (!_el.karatTable) return;
  const spot = _currentSpot();
  if (!spot) {
    clear(_el.karatTable);
    _el.karatTable.append(el('tr', null, [el('td', { colspan: '4' }, tx('karatTableWaiting'))]));
    return;
  }
  const price24 = _priceFor({
    currency: _state.selectedCurrency,
    karat: '24',
    unit: _state.selectedUnit,
    spot,
  });
  const dayOpenSpot = getDayOpenPrice();

  // Helper: build a change indicator element from spot vs day-open
  function buildChangeIndicator(k) {
    if (!dayOpenSpot) return el('td', { 'data-karat-chg': k.code }, '—');
    const now = _priceFor({
      currency: _state.selectedCurrency,
      karat: k.code,
      unit: _state.selectedUnit,
      spot,
    });
    const open = _priceFor({
      currency: _state.selectedCurrency,
      karat: k.code,
      unit: _state.selectedUnit,
      spot: dayOpenSpot,
    });
    if (!now || !open) return el('td', { 'data-karat-chg': k.code }, '—');
    const pct = ((now - open) / open) * 100;
    const isUp = pct >= 0;
    const text = `${isUp ? '▲' : '▼'} ${Math.abs(pct).toFixed(2)}%`;
    return el(
      'td',
      {
        'data-karat-chg': k.code,
        class: isUp ? 'tracker-chg-up' : 'tracker-chg-down',
        'aria-label': tx('karatDayChangeAria', { text }),
      },
      text
    );
  }

  // Build rows on first render; update price cells in-place on subsequent renders
  // so countUp can animate from the previous value.
  const isFirstRender = !_el.karatTable.querySelector('[data-karat-price]');

  // Sync thead columns when day-open becomes available
  const thead = _el.karatTable.closest('table')?.querySelector('thead tr');
  if (thead) {
    const hasChgTh = thead.querySelector('[data-col="chg"]');
    if (dayOpenSpot && !hasChgTh) {
      thead.append(el('th', { 'data-col': 'chg' }, tx('karatColDayChange')));
    } else if (!dayOpenSpot && hasChgTh) {
      hasChgTh.remove();
    }
  }

  if (isFirstRender) {
    const fragment = document.createDocumentFragment();
    for (const k of KARATS) {
      const p = _priceFor({
        currency: _state.selectedCurrency,
        karat: k.code,
        unit: _state.selectedUnit,
        spot,
      });
      const vs = price24 && p ? `${((p / price24) * 100).toFixed(1)}%` : '—';
      const priceCell = el('td', { 'data-karat-price': k.code }, p ? p.toFixed(2) : '—');
      const vsCell = el('td', { 'data-karat-vs': k.code }, vs);
      const cells = [
        el('td', null, `${k.code}K`),
        el('td', null, `${(k.purity * 100).toFixed(1)}%`),
        priceCell,
        vsCell,
      ];
      if (dayOpenSpot) cells.push(buildChangeIndicator(k));
      const rowAttrs =
        k.code === _state.selectedKarat ? { class: 'is-selected' } : {};
      fragment.append(el('tr', rowAttrs, cells));
    }
    clear(_el.karatTable);
    _el.karatTable.append(fragment);
  } else {
    // In-place update: animate price cells with countUp, flash vs-cells
    for (const k of KARATS) {
      const p = _priceFor({
        currency: _state.selectedCurrency,
        karat: k.code,
        unit: _state.selectedUnit,
        spot,
      });
      const vs = price24 && p ? `${((p / price24) * 100).toFixed(1)}%` : '—';
      const row = _el.karatTable.querySelector(`[data-karat-price="${k.code}"]`)?.closest('tr');
      if (row) row.classList.toggle('is-selected', k.code === _state.selectedKarat);
      const priceCell = _el.karatTable.querySelector(`[data-karat-price="${k.code}"]`);
      const vsCell = _el.karatTable.querySelector(`[data-karat-vs="${k.code}"]`);
      if (priceCell && p) {
        countUp(priceCell, p, { decimals: 2, format: (n) => n.toFixed(2) });
        pulseFreshness(priceCell);
      } else if (priceCell) {
        setText(priceCell, '—');
      }
      if (vsCell) setText(vsCell, vs);

      // Sync day-change cell: insert if newly available, update if present, remove if gone
      const chgCell = _el.karatTable.querySelector(`[data-karat-chg="${k.code}"]`);
      if (dayOpenSpot) {
        if (chgCell) {
          // Update existing cell
          const open = _priceFor({
            currency: _state.selectedCurrency,
            karat: k.code,
            unit: _state.selectedUnit,
            spot: dayOpenSpot,
          });
          if (p && open) {
            const pct = ((p - open) / open) * 100;
            const isUp = pct >= 0;
            const text = `${isUp ? '▲' : '▼'} ${Math.abs(pct).toFixed(2)}%`;
            chgCell.textContent = text;
            chgCell.className = isUp ? 'tracker-chg-up' : 'tracker-chg-down';
            chgCell.setAttribute('aria-label', tx('karatDayChangeAria', { text }));
          }
        } else if (row) {
          // Day-open just became available — append the change cell to this row
          row.append(buildChangeIndicator(k));
        }
      } else if (chgCell) {
        // Day-open is no longer available — remove the stale change cell
        chgCell.remove();
      }
    }
  }
}
