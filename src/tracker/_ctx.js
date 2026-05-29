// tracker/_ctx.js — shared render context for tracker submodules
import { TRANSLATIONS } from '../config/index.js';

export let _state = null;
export let _el = null;
export let _priceFor = null;
export let _currentSpot = null;
export let _showToast = null;

export function _setCtx({ state, el, priceFor, currentSpot, showToast }) {
  _state = state;
  _el = el;
  _priceFor = priceFor;
  _currentSpot = currentSpot;
  _showToast = showToast;
}

export function tx(key, params = {}) {
  const lang = _state?.lang ?? 'en';
  const dict = TRANSLATIONS[lang] ?? TRANSLATIONS.en ?? {};
  const fullKey = key.startsWith('tracker.') ? key : `tracker.${key}`;
  let str = dict[fullKey];
  if (typeof str !== 'string') {
    str = key.split('.').reduce((o, k) => (o != null ? o[k] : undefined), dict);
  }
  if (typeof str !== 'string') str = TRANSLATIONS.en?.[fullKey] ?? key;
  return str.replace(/\{(\w+)\}/g, (_, k) => (params[k] != null ? String(params[k]) : ''));
}

export function formatUsd(value, decimals = 2) {
  if (!Number.isFinite(value)) return '—';
  return `$${value.toLocaleString('en', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

export function formatUnitLabel(unit) {
  if (_state?.lang !== 'ar') return unit;
  if (unit === 'gram') return 'غرام';
  if (unit === 'oz') return 'أوقية';
  if (unit === 'tola') return 'تولة';
  return unit;
}

export function formatPercent(value) {
  if (!Number.isFinite(value)) return '—';
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}
