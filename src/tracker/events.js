// tracker/events.js — all event bindings for tracker-pro
import { persistState } from './state.js';
import { el, escape } from '../lib/safe-dom.js';
import { track, EVENTS } from '../lib/analytics.js';

let _state, _el, _cb;

export function initEvents({ state, el, ...callbacks }) {
  _state = state;
  _el = el;
  _cb = callbacks;
}

export function bindCoreEvents() {
  const trackCompareAction = (action, extra = {}) => {
    track(EVENTS.COMPARE_ACTION, {
      surface: 'tracker',
      action,
      mode: _state.mode || 'compare',
      ...extra,
    });
  };

  const trackExportClick = (exportType) => {
    track(EVENTS.EXPORT_CLICK, {
      surface: 'tracker',
      export_type: exportType,
      mode: _state.mode || 'live',
    });
  };

  const comparePresets = {
    'gcc-core': { countries: ['AE', 'SA', 'KW'], karats: ['24', '22', '21'] },
    'uae-karats': { countries: ['AE', '', ''], karats: ['24', '22', '21', '18'] },
    'arab-markets': { countries: ['AE', 'EG', 'JO'], karats: ['24', '21', '18'] },
  };

  // Refresh button
  _el.refreshBtn?.addEventListener('click', async () => {
    _el.refreshBtn.disabled = true;
    _el.refreshBtn.textContent = _cb.tx('actions.refreshing');
    try {
      await _cb.refreshData(true);
      _cb.renderAll();
    } finally {
      _el.refreshBtn.disabled = false;
      _el.refreshBtn.textContent = `↻ ${_cb.tx('actions.refresh')}`;
    }
  });

  // Reset view
  _el.resetBtn?.addEventListener('click', () => {
    _state.mode = 'live';
    _state.selectedCurrency = 'AED';
    _state.selectedKarat = '24';
    _state.selectedUnit = 'gram';
    _state.range = '30D';
    persistState(_state);
    _cb.renderAll();
  });

  // Share brief
  _el.shareBtn?.addEventListener('click', () => {
    const spot = _cb.currentSpot();
    const uae24 = spot ? _cb.priceFor({ currency: 'AED', karat: '24', unit: 'gram', spot }) : null;
    const txt = spot
      ? _cb.tx('share.brief', {
          spot: spot.toFixed(2),
          uae24: uae24 ? uae24.toFixed(2) : '—',
          time: new Date().toUTCString(),
        })
      : _cb.tx('share.unavailable');
    navigator.clipboard
      ?.writeText(txt)
      .then(() => {
        _cb.showToast(_cb.tx('toast.briefCopied'));
        track(EVENTS.SHARE_CLICK, { surface: 'tracker', channel: 'clipboard' });
      })
      .catch(() => {
        _cb.showToast(_cb.tx('toast.clipboardFailed'));
      });
  });

  // Toolbar selects
  _el.currency?.addEventListener('change', () => {
    const from = _state.selectedCurrency;
    _state.selectedCurrency = _el.currency.value;
    persistState(_state);
    track(EVENTS.CURRENCY_CHANGE, { from, to: _state.selectedCurrency });
    _cb.renderAll();
  });
  _el.karat?.addEventListener('change', () => {
    const from = _state.selectedKarat;
    _state.selectedKarat = _el.karat.value;
    persistState(_state);
    track(EVENTS.KARAT_CHANGE, { from, to: _state.selectedKarat });
    _cb.renderAll();
  });
  _el.unit?.addEventListener('change', () => {
    const from = _state.selectedUnit;
    _state.selectedUnit = _el.unit.value;
    persistState(_state);
    track(EVENTS.UNIT_CHANGE, { from, to: _state.selectedUnit });
    _cb.renderAll();
  });
  _el.language?.addEventListener('change', () => {
    const from = _state.lang;
    _state.lang = _el.language.value;
    persistState(_state);
    if (from !== _state.lang) {
      track(EVENTS.LANGUAGE_SWITCH, { from, to: _state.lang, surface: 'tracker' });
    }
    _cb.populateSelects();
    _cb.renderAll();
  });

  // Range pills
  _el.rangePills?.forEach((pill) => {
    pill.addEventListener('click', () => {
      _el.rangePills.forEach((p) => {
        p.classList.remove('is-active');
        p.setAttribute('aria-pressed', 'false');
      });
      pill.classList.add('is-active');
      pill.setAttribute('aria-pressed', 'true');
      _state.range = pill.dataset.range;
      _state.historyMonth = '';
      if (_el.historyMonth) _el.historyMonth.value = '';
      persistState(_state);
      _cb.renderAll();
      // Sync the advanced chart if it's loaded
      try {
        if (window.__GOLD_CHART && typeof window.__GOLD_CHART.setRange === 'function') {
          window.__GOLD_CHART.setRange(_state.range);
        }
      } catch (_e) {
        // non-fatal
      }
    });
  });

  _el.historyMonth?.addEventListener('change', () => {
    _state.historyMonth = _el.historyMonth.value || '';
    persistState(_state);
    _cb.renderAll();
  });

  _el.historyMonthClear?.addEventListener('click', () => {
    _state.historyMonth = '';
    if (_el.historyMonth) _el.historyMonth.value = '';
    persistState(_state);
    _cb.renderAll();
  });

  // Auto-refresh toggle
  _el.autoRefresh?.addEventListener('click', () => {
    _state.autoRefresh = !_state.autoRefresh;
    _el.autoRefresh.textContent = `Auto refresh: ${_state.autoRefresh ? 'on' : 'off'}`;
    persistState(_state);
    if (_state.autoRefresh) _cb.startAutoRefresh();
    else _cb.stopAutoRefresh();
  });

  // Wire controls
  _el.wireRefresh?.addEventListener('click', async () => {
    await _cb.refreshWire();
  });
  _el.wireToggle?.addEventListener('click', () => {
    const track = _el.wireTrack;
    if (!track) return;
    const paused = track.style.animationPlayState === 'paused';
    track.style.animationPlayState = paused ? 'running' : 'paused';
    _el.wireToggle.textContent = paused ? 'Pause' : 'Resume';
    _el.wireToggle.setAttribute('aria-pressed', String(!paused));
  });

  // Region tabs for compare board
  const regionTabs = document.querySelectorAll('.tracker-region-pill[data-region]');
  if (!_state.activeRegion) _state.activeRegion = 'gcc';
  regionTabs.forEach((btn) => {
    btn.addEventListener('click', () => {
      _state.activeRegion = btn.dataset.region;
      regionTabs.forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      trackCompareAction('region_switch', {
        region: _state.activeRegion || 'gcc',
      });
      _cb.renderMarkets();
    });
  });

  _el.compareCountrySelects?.forEach((select, index) => {
    select?.addEventListener('change', () => {
      const next = [...(_state.compareCountries || [])];
      const duplicateIndex = select.value
        ? next.findIndex((code, idx) => idx !== index && code === select.value)
        : -1;
      if (duplicateIndex !== -1) {
        _cb.showToast('Pick different countries for each comparison slot.');
        _cb.populateSelects();
        return;
      }
      next[index] = select.value;
      _state.compareCountries = next.filter(Boolean).slice(0, 3);
      persistState(_state);
      trackCompareAction('country_select', {
        selected_count: _state.compareCountries.length,
      });
      _cb.populateSelects();
      _cb.renderAll();
    });
  });

  _el.compareKaratButtons?.forEach((button) => {
    button.addEventListener('click', () => {
      const code = button.dataset.compareKarat;
      const current = new Set(_state.compareKarats || []);
      if (current.has(code)) current.delete(code);
      else if (current.size < 4) current.add(code);
      else {
        _cb.showToast('Comparison supports up to 4 karats at once.');
        return;
      }
      _state.compareKarats = [...current];
      persistState(_state);
      trackCompareAction('karat_toggle', {
        selected_count: _state.compareKarats.length,
      });
      _cb.populateSelects();
      _cb.renderAll();
    });
  });

  _el.comparePresetButtons?.forEach((button) => {
    button.addEventListener('click', () => {
      const preset = comparePresets[button.dataset.comparePreset];
      if (!preset) return;
      _state.comparePreset = button.dataset.comparePreset;
      _state.compareCountries = preset.countries;
      _state.compareKarats = preset.karats;
      persistState(_state);
      trackCompareAction('preset_apply', {
        preset: button.dataset.comparePreset || 'custom',
      });
      _cb.populateSelects();
      _cb.renderAll();
    });
  });

  _el.alertDelivery?.addEventListener('change', () => {
    _cb.updateServerAlertUiState?.();
  });

  // Alert save
  _el.saveAlert?.addEventListener('click', async () => {
    const delivery = _el.alertDelivery?.value || 'local';
    const scope = _el.alertScope?.value || 'selected';
    const condition = _el.alertDirection?.value || 'above';
    const target = parseFloat(_el.alertTarget?.value);
    if (!Number.isFinite(target)) return;

    track(EVENTS.ALERT_CREATE_START, {
      surface: 'tracker',
      delivery,
      scope,
      direction: condition,
      currency: _state.selectedCurrency,
    });

    if (delivery === 'server') {
      try {
        const result = await _cb.createServerAlert({ condition, target });
        const sentMode = result?.verifyDelivery === 'dry_run' ? 'dry-run' : 'email';
        const manageNote = result?.managementUrl
          ? ` ${_cb.tx('alerts.serverManage')}: ${result.managementUrl}`
          : '';
        _cb.showToast(_cb.tx('alerts.serverCreated', { mode: sentMode }));
        if (_el.alertServerStatus) {
          _el.alertServerStatus.textContent = `${_cb.tx('alerts.serverCreated', { mode: sentMode })}${manageNote}`;
        }
        track(EVENTS.ALERT_CREATE_SUCCESS, {
          surface: 'tracker',
          delivery,
          direction: condition,
          currency: _state.selectedCurrency,
          mode: sentMode,
        });
      } catch (error) {
        if (_el.alertServerStatus) {
          _el.alertServerStatus.textContent = error.message || _cb.tx('alerts.serverCreateFailed');
        }
        _cb.showToast(error.message || _cb.tx('alerts.serverCreateFailed'));
      }
      return;
    }

    _state.alerts = [...(_state.alerts || []), { scope, direction: condition, target }];
    persistState(_state);
    _cb.renderAlerts();
    _cb.showToast(`Alert ${condition} $${target} saved`);
    try {
      const maybePromise = _cb.syncAlertToAccount?.({ condition, target });
      if (maybePromise && typeof maybePromise.then === 'function') {
        maybePromise.catch(() => {});
      }
    } catch {
      // non-blocking optional integration
    }
    if (_el.alertTarget) _el.alertTarget.value = '';
    track(EVENTS.ALERT_CREATE_SUCCESS, {
      surface: 'tracker',
      delivery,
      direction: condition,
      currency: _state.selectedCurrency,
      mode: 'local',
    });
  });

  // Notifications enable
  _el.enableNotifications?.addEventListener('click', async () => {
    if (!('Notification' in window)) {
      if (_el.alertPermission)
        _el.alertPermission.textContent = 'Browser notifications not supported.';
      return;
    }
    const perm = await Notification.requestPermission();
    if (_el.alertPermission)
      _el.alertPermission.textContent =
        perm === 'granted' ? 'Notifications enabled.' : 'Notifications blocked.';
  });

  // Preset save
  _el.savePreset?.addEventListener('click', () => {
    const name = _el.presetName?.value?.trim();
    if (!name) return;
    _state.presets = [
      ...(_state.presets || []),
      {
        name,
        currency: _state.selectedCurrency,
        karat: _state.selectedKarat,
        unit: _state.selectedUnit,
        range: _state.range,
      },
    ];
    persistState(_state);
    _cb.renderPresets();
    _cb.showToast(`Preset "${name}" saved`);
    if (_el.presetName) _el.presetName.value = '';
  });

  // Copy URL
  _el.copyUrl?.addEventListener('click', () => {
    navigator.clipboard
      ?.writeText(window.location.href)
      .then(() => {
        _cb.showToast('Preset URL copied to clipboard');
        track(EVENTS.COPY_CLICK, { surface: 'tracker', value_type: 'preset_url' });
      })
      .catch(() => {
        _cb.showToast('Failed to copy to clipboard');
      });
  });

  // Archive search
  _el.archiveSearch?.addEventListener('input', () => _cb.renderArchive(true));
  _el.archiveRange?.addEventListener('change', () => _cb.renderArchive(true));

  // Date lookup
  _el.runLookup?.addEventListener('click', () => {
    const dateStr = _el.lookupDate?.value;
    if (!dateStr || !_el.lookupResults) return;
    const targetDate = new Date(dateStr);
    let closest = null;
    let minDaysDiff = Infinity;
    _state.history.forEach((r) => {
      const d = r.date instanceof Date ? r.date : new Date(r.date);
      const daysDiff = Math.abs((d.getTime() - targetDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysDiff < minDaysDiff) {
        minDaysDiff = daysDiff;
        closest = r;
      }
    });
    if (closest) {
      const aed24 = _cb.priceFor({
        currency: 'AED',
        karat: '24',
        unit: 'gram',
        spot: closest.spot,
      });
      const lookupDateIso =
        closest.date instanceof Date ? closest.date.toISOString().slice(0, 10) : closest.date;
      const daysAway = Math.round(minDaysDiff);
      const daysNote =
        daysAway === 0 ? 'exact match' : `${daysAway} day${daysAway !== 1 ? 's' : ''} away`;
      const sourceBadge = el(
        'span',
        {
          class: `tracker-source-badge tracker-source-badge--${escape(closest.source)}`,
        },
        [escape(closest.source)]
      );
      const grid = el('div', { class: 'tracker-result-grid' }, [
        el('div', { class: 'tracker-result-card' }, [
          el('div', { class: 'tracker-result-k' }, ['Found date']),
          el('div', { class: 'tracker-result-v' }, [lookupDateIso]),
          el('div', { class: 'tracker-result-s' }, [daysNote]),
        ]),
        el('div', { class: 'tracker-result-card' }, [
          el('div', { class: 'tracker-result-k' }, ['XAU/USD']),
          el('div', { class: 'tracker-result-v' }, [`$${closest.spot.toFixed(2)}`]),
          el('div', { class: 'tracker-result-s' }, ['per troy oz']),
        ]),
        el('div', { class: 'tracker-result-card' }, [
          el('div', { class: 'tracker-result-k' }, ['UAE 24K/g']),
          el('div', { class: 'tracker-result-v' }, [aed24 ? `AED ${aed24.toFixed(2)}` : '—']),
          el('div', { class: 'tracker-result-s' }, ['AED peg 3.6725']),
        ]),
        el('div', { class: 'tracker-result-card' }, [
          el('div', { class: 'tracker-result-k' }, ['Source']),
          el('div', { class: 'tracker-result-v' }, [sourceBadge]),
          el('div', { class: 'tracker-result-s' }, [closest.granularity || 'daily']),
        ]),
      ]);
      _el.lookupResults.replaceChildren(grid);
    } else {
      _el.lookupResults.replaceChildren(
        el('p', { style: { color: 'var(--tp-text-muted)' } }, [
          'No data available for that date. Archive covers 2019–present.',
        ])
      );
    }
  });

  // Market filter
  _el.marketFilter?.addEventListener('input', () => _cb.renderMarkets());
  _el.marketSort?.addEventListener('change', () => _cb.renderMarkets());

  // Planner inputs
  [
    _el.budgetAmount,
    _el.budgetFee,
    _el.positionEntry,
    _el.positionQty,
    _el.accumMonthly,
    _el.accumTarget,
    _el.jewelryWeight,
    _el.jewelryKarat,
    _el.jewelryMaking,
    _el.jewelryPremium,
    _el.jewelryVat,
  ].forEach((inp) => {
    inp?.addEventListener('input', () => _cb.renderPlanners());
    inp?.addEventListener('change', () => _cb.renderPlanners());
  });

  // Exports
  _el.exportArchive?.addEventListener('click', () => {
    trackExportClick('archive_csv');
    _cb.exportArchiveData();
  });
  _el.exportArchive2?.addEventListener('click', () => {
    trackExportClick('archive_csv');
    _cb.exportArchiveData();
  });
  _el.exportHistory?.addEventListener('click', () => {
    trackExportClick('history_csv');
    _cb.exportHistoryData();
  });
  _el.exportHistory2?.addEventListener('click', () => {
    trackExportClick('history_csv');
    _cb.exportHistoryData();
  });
  _el.downloadJson?.addEventListener('click', () => {
    trackExportClick('tracker_json');
    _cb.exportJsonData();
  });
  _el.downloadJson2?.addEventListener('click', () => {
    trackExportClick('tracker_json');
    _cb.exportJsonData();
  });
  _el.exportChart?.addEventListener('click', () => {
    trackExportClick('chart_csv');
    _cb.exportChartData();
  });
  _el.exportChart2?.addEventListener('click', () => {
    trackExportClick('chart_csv');
    _cb.exportChartData();
  });
  _el.exportCompare?.addEventListener('click', () => {
    trackExportClick('compare_csv');
    _cb.exportComparisonData();
  });
  _el.exportCompare2?.addEventListener('click', () => {
    trackExportClick('compare_csv');
    _cb.exportComparisonData();
  });
  _el.exportWatchlist?.addEventListener('click', () => {
    trackExportClick('watchlist_csv');
    _cb.exportWatchlistData();
  });
  _el.downloadBrief?.addEventListener('click', () => {
    trackExportClick('brief_txt');
    _cb.exportBriefData();
  });

  // Alert list: delete button delegation
  _el.alertList?.addEventListener('click', (e) => {
    const btn = e.target.closest('.tracker-remove-btn[data-idx]');
    if (!btn) return;
    const idx = parseInt(btn.dataset.idx, 10);
    const removed = (_state.alerts || [])[idx];
    _state.alerts = (_state.alerts || []).filter((_, i) => i !== idx);
    persistState(_state);
    _cb.renderAlerts();
    if (removed) track(EVENTS.ALERT_CLEAR, { karat: _state.selectedKarat });
  });

  // Preset list: delete + load button delegation
  _el.presetList?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-idx]');
    if (!btn) return;
    const idx = parseInt(btn.dataset.idx, 10);
    const preset = (_state.presets || [])[idx];
    if (!preset) return;
    if (btn.classList.contains('tracker-remove-btn')) {
      _state.presets = _state.presets.filter((_, i) => i !== idx);
      persistState(_state);
      _cb.renderPresets();
    } else if (btn.classList.contains('tracker-load-btn')) {
      _state.selectedCurrency = preset.currency;
      _state.selectedKarat = preset.karat;
      _state.selectedUnit = preset.unit;
      _state.range = preset.range;
      persistState(_state);
      _cb.populateSelects();
      _cb.renderAll();
    }
  });

  // Trust banner close
  const trustCloseBtn = document.querySelector('.tracker-trust-close');
  const trustSection = document.querySelector('.tracker-data-trust-section');
  if (trustCloseBtn && trustSection) {
    trustCloseBtn.addEventListener('click', () => {
      trustSection.style.display = 'none';
      localStorage.setItem('tracker_trust_banner_dismissed', 'true');
    });
  }

  // First-visit welcome strip
  const welcomeStrip = document.getElementById('tracker-welcome-strip');
  const welcomeClose = document.getElementById('tracker-welcome-close');
  if (welcomeStrip && welcomeClose) {
    if (!localStorage.getItem('tracker_first_visit')) {
      welcomeStrip.hidden = false;
    }
    welcomeClose.addEventListener('click', () => {
      welcomeStrip.hidden = true;
      localStorage.setItem('tracker_first_visit', 'seen');
    });
  }

  // "View chart" jump link — land keyboard focus on the live mode heading after scroll
  const jumpChart = document.getElementById('tp-jump-chart');
  if (jumpChart) {
    jumpChart.addEventListener('click', () => {
      const heading = document.getElementById('tp-chart-heading');
      if (heading) heading.focus({ preventScroll: true });
    });
  }
}
