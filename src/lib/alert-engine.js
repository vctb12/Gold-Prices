/**
 * lib/alert-engine.js — Price alert trigger engine.
 *
 * Runs after every price refresh (piggybacks on the existing 90-second cycle).
 * Checks all saved alerts against current price and fires triggered notifications.
 *
 * Features:
 *   - Versioned localStorage persistence (gtl_alerts_v2)
 *   - Migration from v1 format
 *   - Max 10 active alerts
 *   - Web Audio API sound (opt-in)
 *   - Import/export as JSON
 *   - WhatsApp share link generation
 *   - Deduplication: doesn't fire same alert twice until price crosses back
 *
 * API:
 *   createAlertEngine(options)  → engine instance
 *   engine.check(spotUsd, aed24kPerGram)
 *   engine.addAlert(alert)
 *   engine.removeAlert(id)
 *   engine.getAlerts()
 *   engine.getTriggeredAlerts()
 *   engine.exportAlerts() → JSON string
 *   engine.importAlerts(json)
 *   engine.toggleSound(on)
 *   engine.isSoundEnabled()
 *   engine.getWhatsAppLink(alert)
 *   engine.destroy()
 */

import { KARATS } from '../config/karats.js';

const STORAGE_KEY = 'gtl_alerts_v2';
const LEGACY_KEY = 'gold_price_alerts';
const MAX_ALERTS = 10;
const ALERT_WARN_THRESHOLD = 8;

// ─── Persistence ────────────────────────────────────────────────────────────

function loadAlerts() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* corrupted — fall through */
  }
  // Attempt v1 migration
  return migrateFromV1();
}

function migrateFromV1() {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return [];
    const v1Alerts = JSON.parse(raw);
    if (!Array.isArray(v1Alerts)) return [];
    const migrated = v1Alerts.map((a, i) => ({
      id: a.id || `migrated_${i}_${Date.now()}`,
      scope: a.scope || 'spot',
      direction: a.direction || 'above',
      target: Number(a.target) || 0,
      currency: a.currency || 'USD',
      karat: a.karat || '24',
      createdAt: a.createdAt || new Date().toISOString(),
      firedAt: a.firedAt || null,
      status: a.status || 'active',
    }));
    saveAlerts(migrated);
    return migrated;
  } catch {
    return [];
  }
}

function saveAlerts(alerts) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts));
  } catch {
    /* quota exceeded — silently fail */
  }
}

// ─── Sound ──────────────────────────────────────────────────────────────────

let _audioCtx = null;

function getAudioContext() {
  if (!_audioCtx) {
    try {
      _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch {
      return null;
    }
  }
  return _audioCtx;
}

function playAlertChime() {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    // A gentle two-tone chime (C5 → E5)
    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.value = 523.25; // C5
    osc2.type = 'sine';
    osc2.frequency.value = 659.25; // E5

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now + 0.15);
    osc1.stop(now + 0.6);
    osc2.stop(now + 0.8);
  } catch {
    /* audio not available */
  }
}

// ─── Utility ────────────────────────────────────────────────────────────────

function generateId() {
  return `alert_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function getPriceForScope(scope, spotUsd, aed24kPerGram, karat) {
  const karatObj = KARATS.find((k) => k.code === String(karat));
  const purity = karatObj ? karatObj.purity : 1;

  switch (scope) {
    case 'spot':
      return spotUsd;
    case 'uae24':
      return aed24kPerGram;
    case 'selected':
    default:
      // For selected scope, apply karat purity to AED price
      return aed24kPerGram * purity;
  }
}

// ─── Engine ─────────────────────────────────────────────────────────────────

/**
 * @param {Object} options
 * @param {Function} options.onTrigger - Called with (alert, currentPrice) when alert fires
 * @param {Function} [options.onCountChange] - Called with (count) when alert list changes
 * @param {Function} [options.onLimitWarning] - Called when approaching max alerts
 */
export function createAlertEngine(options = {}) {
  const { onTrigger, onCountChange, onLimitWarning } = options;
  let alerts = loadAlerts();
  let soundEnabled = false;
  let destroyed = false;

  function notifyCountChange() {
    if (onCountChange) {
      const activeCount = alerts.filter((a) => a.status === 'active').length;
      onCountChange(activeCount);
    }
  }

  // Initial count notification
  notifyCountChange();

  return {
    /**
     * Check all active alerts against current prices.
     * Called after every price refresh.
     */
    check(spotUsd, aed24kPerGram) {
      if (destroyed) return;
      if (!spotUsd || spotUsd <= 0) return;

      let didFire = false;
      for (const alert of alerts) {
        if (alert.status !== 'active') continue;

        const currentPrice = getPriceForScope(alert.scope, spotUsd, aed24kPerGram, alert.karat);
        if (!currentPrice || currentPrice <= 0) continue;

        const triggered =
          alert.direction === 'above' ? currentPrice >= alert.target : currentPrice <= alert.target;

        if (triggered) {
          alert.status = 'fired';
          alert.firedAt = new Date().toISOString();
          alert.firedPrice = currentPrice;
          didFire = true;

          if (soundEnabled) playAlertChime();
          if (onTrigger) onTrigger(alert, currentPrice);
        }
      }

      if (didFire) {
        saveAlerts(alerts);
        notifyCountChange();
      }
    },

    /**
     * Add a new alert.
     * @returns {{ success: boolean, error?: string, alert?: object }}
     */
    addAlert({ scope = 'spot', direction = 'above', target, currency = 'USD', karat = '24' }) {
      const activeCount = alerts.filter((a) => a.status === 'active').length;

      if (activeCount >= MAX_ALERTS) {
        return { success: false, error: 'max_reached' };
      }

      const numTarget = Number(target);
      if (!numTarget || numTarget <= 0) {
        return { success: false, error: 'invalid_target' };
      }

      // Check for duplicates
      const duplicate = alerts.find(
        (a) =>
          a.status === 'active' &&
          a.scope === scope &&
          a.direction === direction &&
          a.target === numTarget &&
          a.karat === karat
      );
      if (duplicate) {
        return { success: false, error: 'duplicate' };
      }

      const newAlert = {
        id: generateId(),
        scope,
        direction,
        target: numTarget,
        currency,
        karat,
        createdAt: new Date().toISOString(),
        firedAt: null,
        firedPrice: null,
        status: 'active',
      };

      alerts.push(newAlert);
      saveAlerts(alerts);
      notifyCountChange();

      if (activeCount + 1 >= ALERT_WARN_THRESHOLD && onLimitWarning) {
        onLimitWarning(activeCount + 1, MAX_ALERTS);
      }

      return { success: true, alert: newAlert };
    },

    /**
     * Remove an alert by ID.
     */
    removeAlert(id) {
      alerts = alerts.filter((a) => a.id !== id);
      saveAlerts(alerts);
      notifyCountChange();
    },

    /**
     * Clear all fired alerts.
     */
    clearFired() {
      alerts = alerts.filter((a) => a.status !== 'fired');
      saveAlerts(alerts);
      notifyCountChange();
    },

    /**
     * Reactivate a fired alert (set new target).
     */
    reactivateAlert(id, newTarget) {
      const alert = alerts.find((a) => a.id === id);
      if (!alert) return false;
      alert.status = 'active';
      alert.firedAt = null;
      alert.firedPrice = null;
      if (newTarget) alert.target = Number(newTarget);
      saveAlerts(alerts);
      notifyCountChange();
      return true;
    },

    /**
     * Get all alerts.
     */
    getAlerts() {
      return [...alerts];
    },

    /**
     * Get active alerts only.
     */
    getActiveAlerts() {
      return alerts.filter((a) => a.status === 'active');
    },

    /**
     * Get triggered (fired) alerts.
     */
    getTriggeredAlerts() {
      return alerts.filter((a) => a.status === 'fired');
    },

    /**
     * Get count of active alerts.
     */
    getActiveCount() {
      return alerts.filter((a) => a.status === 'active').length;
    },

    /**
     * Export all alerts as JSON string (for download).
     */
    exportAlerts() {
      return JSON.stringify(
        {
          version: 2,
          exportedAt: new Date().toISOString(),
          alerts: alerts,
        },
        null,
        2
      );
    },

    /**
     * Import alerts from JSON string.
     * @returns {{ success: boolean, imported: number, error?: string }}
     */
    importAlerts(jsonString) {
      try {
        const data = JSON.parse(jsonString);
        const imported = Array.isArray(data.alerts) ? data.alerts : Array.isArray(data) ? data : [];
        if (!imported.length) {
          return { success: false, imported: 0, error: 'no_alerts_found' };
        }

        let count = 0;
        for (const a of imported) {
          if (!a.target || !a.direction) continue;
          const activeCount = alerts.filter((x) => x.status === 'active').length;
          if (activeCount >= MAX_ALERTS) break;

          alerts.push({
            id: generateId(),
            scope: a.scope || 'spot',
            direction: a.direction,
            target: Number(a.target),
            currency: a.currency || 'USD',
            karat: a.karat || '24',
            createdAt: new Date().toISOString(),
            firedAt: null,
            firedPrice: null,
            status: 'active',
          });
          count++;
        }

        saveAlerts(alerts);
        notifyCountChange();
        return { success: true, imported: count };
      } catch {
        return { success: false, imported: 0, error: 'invalid_json' };
      }
    },

    /**
     * Toggle sound on/off.
     */
    toggleSound(on) {
      soundEnabled = on;
      // Resume audio context on user gesture
      if (on && _audioCtx && _audioCtx.state === 'suspended') {
        _audioCtx.resume();
      }
    },

    /**
     * Check if sound is enabled.
     */
    isSoundEnabled() {
      return soundEnabled;
    },

    /**
     * Generate a WhatsApp share link for an alert.
     */
    getWhatsAppLink(alert) {
      const directionText = alert.direction === 'above' ? 'goes above' : 'drops below';
      const scopeLabels = {
        spot: 'XAU/USD spot',
        uae24: 'UAE 24K AED/g',
        selected: `${alert.karat}K gold`,
      };
      const scopeLabel = scopeLabels[alert.scope] || alert.scope;
      const msg = `📊 Gold Alert: Notify me when ${scopeLabel} ${directionText} ${alert.target} — goldtickerlive.com/tracker`;
      return `https://wa.me/?text=${encodeURIComponent(msg)}`;
    },

    /**
     * Get max alerts constant.
     */
    getMaxAlerts() {
      return MAX_ALERTS;
    },

    /**
     * Clean up.
     */
    destroy() {
      destroyed = true;
      if (_audioCtx) {
        _audioCtx.close().catch(() => {});
        _audioCtx = null;
      }
    },
  };
}
