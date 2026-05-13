// tracker/ui-shell.js
import { injectNav, updateNavLang } from '../components/nav.js';
import { injectFooter } from '../components/footer.js';
import { injectTicker, updateTicker, updateTickerLang } from '../components/ticker.js';
import { injectSpotBar, updateSpotBar, updateSpotBarLang } from '../components/spotBar.js';
import {
  syncUrlFromState,
  persistState,
  applyUrlState,
  VALID_MODES,
  VALID_PANELS,
} from './state.js';
import { TRACKER_PANELS, getShortcutMap, getTrackerTab } from './modes.js';

let _openPanel = null;

export function mountShell(state, els, onModeChange, onLangChange) {
  // Mount shared shell
  injectSpotBar(state.lang, 0);
  const navCtrl = injectNav(state.lang, 0);
  navCtrl.getLangToggleButtons().forEach((btn) => {
    btn.addEventListener('click', () => {
      state.lang = state.lang === 'en' ? 'ar' : 'en';
      persistState(state);
      document.documentElement.lang = state.lang;
      document.documentElement.dir = state.lang === 'ar' ? 'rtl' : 'ltr';
      updateNavLang(state.lang);
      updateTickerLang(state.lang);
      updateSpotBarLang(state.lang);
      if (els.language) els.language.value = state.lang;
      onLangChange();
    });
  });

  injectFooter(state.lang, 0);
  injectTicker(state.lang, 0);

  // Wire main mode tabs (Live / Compare / Archive / Exports / Method only)
  const tabs = Array.from(document.querySelectorAll('.tracker-mode-tab[data-mode]'));
  const panels = Array.from(document.querySelectorAll('.tracker-mode-panel[data-mode-panel]'));
  const workspaceToggle = els.workspaceToggle || document.getElementById('tp-workspace-toggle');
  const isAdvancedMode = () => state.workspaceLevel === 'advanced';
  document.body.setAttribute('data-tracker-shell-ready', 'false');

  function applyWorkspaceLevel() {
    const advanced = isAdvancedMode();
    document.body.classList.toggle('tracker-workspace-basic', !advanced);
    document.body.classList.toggle('tracker-workspace-advanced', advanced);
    if (workspaceToggle) {
      workspaceToggle.textContent = advanced ? 'Use basic workspace' : 'Open advanced workspace';
      workspaceToggle.setAttribute('aria-pressed', advanced ? 'true' : 'false');
    }
    if (!advanced && getTrackerTab(state.mode)?.workspace === 'advanced') {
      setMode('live');
    }
    if (!advanced && _openPanel) {
      closeOverlay(_openPanel);
    }
  }

  function setWorkspaceLevel(level = 'basic') {
    state.workspaceLevel = level === 'advanced' ? 'advanced' : 'basic';
    persistState(state);
    applyWorkspaceLevel();
    if (typeof onModeChange === 'function') onModeChange(state.mode);
  }

  function ensureAdvancedWorkspace() {
    if (!isAdvancedMode()) {
      setWorkspaceLevel('advanced');
    }
  }

  function setMode(mode) {
    if (getTrackerTab(mode)?.workspace === 'advanced') ensureAdvancedWorkspace();
    state.mode = mode;
    tabs.forEach((tab) => {
      const active = tab.dataset.mode === mode;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    panels.forEach((panel) => {
      const active = panel.dataset.modePanel === mode;
      panel.hidden = !active;
    });
    persistState(state);
    syncUrlFromState(state, _openPanel);
    if (typeof onModeChange === 'function') onModeChange(mode);
  }

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => setMode(tab.dataset.mode));
  });

  // Initial mode selection (never allow alerts/planner as mode)
  applyWorkspaceLevel();
  const safeMode = VALID_MODES.has(state.mode) ? state.mode : 'live';
  setMode(safeMode);

  // Overlay system for Alerts and Planner — built from the registry so adding
  // a panel in modes.js is enough to wire it up.
  const overlays = Object.fromEntries(
    TRACKER_PANELS.map((panel) => [panel.id, document.getElementById(panel.panelId)])
  );

  function openOverlay(name) {
    if (!VALID_PANELS.has(name)) return;
    if (_openPanel && _openPanel !== name) closeOverlay(_openPanel);
    const overlay = overlays[name];
    if (!overlay) return;
    _openPanel = name;
    state.panel = name;
    overlay.hidden = false;
    overlay.removeAttribute('aria-hidden');
    document.body.classList.add('tp-overlay-open');
    // Mark toggle buttons as active
    document.querySelectorAll(`.tracker-overlay-btn[data-overlay="${name}"]`).forEach((btn) => {
      btn.classList.add('is-active');
      btn.setAttribute('aria-expanded', 'true');
    });
    // Sync URL with panel open
    syncUrlFromState(state, _openPanel);
  }

  function closeOverlay(name) {
    const panelName = name || _openPanel;
    const overlay = overlays[panelName];
    if (!overlay) return;
    overlay.hidden = true;
    overlay.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('tp-overlay-open');
    document
      .querySelectorAll(`.tracker-overlay-btn[data-overlay="${panelName}"]`)
      .forEach((btn) => {
        btn.classList.remove('is-active');
        btn.setAttribute('aria-expanded', 'false');
      });
    _openPanel = null;
    state.panel = null;
    syncUrlFromState(state);
  }

  function toggleOverlay(name) {
    if (_openPanel === name) closeOverlay(name);
    else openOverlay(name);
  }

  // Wire overlay toggle buttons (Alerts, Planner in mode bar)
  document.querySelectorAll('.tracker-overlay-btn[data-overlay]').forEach((btn) => {
    btn.addEventListener('click', () => toggleOverlay(btn.dataset.overlay));
  });

  // Wire overlay close buttons
  document.querySelectorAll('.tp-overlay-close[data-close-overlay]').forEach((btn) => {
    btn.addEventListener('click', () => closeOverlay(btn.dataset.closeOverlay));
  });

  // Clicking overlay backdrop closes it
  document.querySelectorAll('.tp-overlay-backdrop').forEach((backdrop) => {
    backdrop.addEventListener('click', () => {
      if (_openPanel) closeOverlay(_openPanel);
    });
  });

  function syncOverlayFromState() {
    const desiredPanel = state.panel && VALID_PANELS.has(state.panel) ? state.panel : null;
    if (!desiredPanel) {
      if (_openPanel) closeOverlay(_openPanel);
      return;
    }
    if (_openPanel !== desiredPanel) openOverlay(desiredPanel);
  }

  syncOverlayFromState();
  document.body.setAttribute('data-tracker-shell-ready', 'true');

  // Sync back/forward navigation
  window.addEventListener('hashchange', () => {
    const parsed = applyUrlState(state);
    const m = VALID_MODES.has(state.mode) ? state.mode : 'live';
    setMode(m);
    syncOverlayFromState();
    if (parsed?.shouldCanonicalize) syncUrlFromState(state);
  });

  // Keyboard shortcuts — driven by the tracker-modes registry so the mapping
  // is a single source of truth shared with tests and docs.
  const shortcutMap = getShortcutMap();
  window.addEventListener('keydown', (evt) => {
    if (evt.altKey || evt.metaKey || evt.ctrlKey) return;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(evt.target.tagName)) return;
    const key = evt.key.toLowerCase();
    if (key === 'escape') {
      if (_openPanel) closeOverlay(_openPanel);
      return;
    }
    if (key === 'r') {
      els.refreshBtn?.click();
      return;
    }
    const tab = shortcutMap.get(key);
    if (!tab) return;
    if (tab.kind === 'mode') setMode(tab.id);
    else if (tab.kind === 'panel') toggleOverlay(tab.id);
  });

  workspaceToggle?.addEventListener('click', () => {
    setWorkspaceLevel(isAdvancedMode() ? 'basic' : 'advanced');
  });

  return { setMode, openOverlay, closeOverlay };
}

export function updateShellTickerFromState(state, spot, priceFor) {
  if (!spot) return;
  const aed24 = priceFor({ currency: 'AED', karat: '24', unit: 'gram', spot });
  updateTicker({
    xauUsd: spot,
    uae24k: aed24,
    uae22k: priceFor({ currency: 'AED', karat: '22', unit: 'gram', spot }),
    uae21k: priceFor({ currency: 'AED', karat: '21', unit: 'gram', spot }),
    uae18k: priceFor({ currency: 'AED', karat: '18', unit: 'gram', spot }),
    updatedAt: state.live?.updatedAt,
    hasLiveFailure: Boolean(state.hasLiveFailure),
  });
  updateSpotBar({
    xauUsd: spot,
    aed24kGram: aed24,
    updatedAt: state.live?.updatedAt,
    hasLiveFailure: Boolean(state.hasLiveFailure),
  });
}
