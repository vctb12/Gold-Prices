/**
 * Visual karat purity ring + percentage label for calculator / forms.
 */
import { KARATS } from '../config/index.js';
import { el } from '../lib/safe-dom.js';

export function getPurityPercent(karatCode) {
  const k = KARATS.find((item) => item.code === String(karatCode));
  if (!k?.purity) return 0;
  return Math.round(k.purity * 1000) / 10;
}

/**
 * @param {{ karat: string, label?: string, className?: string }} options
 * @returns {HTMLElement}
 */
export function renderKaratPurityIndicator({ karat, label = '', className = '' }) {
  const pct = getPurityPercent(karat);
  const ring = el('div', {
    class: `karat-purity-ring${className ? ` ${className}` : ''}`,
    role: 'img',
    'aria-label': label || `${karat}K · ${pct}% gold`,
  });
  const track = el('div', { class: 'karat-purity-ring__track' });
  const fill = el('div', {
    class: 'karat-purity-ring__fill',
    style: `--purity-fill: ${pct}%`,
  });
  track.appendChild(fill);
  const center = el('span', { class: 'karat-purity-ring__label' }, [`${karat}K`]);
  ring.append(track, center);
  const meta = el('span', { class: 'karat-purity-ring__pct' }, [`${pct}%`]);
  return el('div', { class: 'karat-purity-indicator' }, [ring, meta]);
}

/**
 * Update an existing indicator root (from renderKaratPurityIndicator).
 */
export function updateKaratPurityIndicator(root, karat, label = '') {
  if (!root) return;
  const pct = getPurityPercent(karat);
  const ring = root.querySelector('.karat-purity-ring');
  const fill = root.querySelector('.karat-purity-ring__fill');
  const track = root.querySelector('.karat-purity-ring__track');
  const labelEl = root.querySelector('.karat-purity-ring__label');
  const pctEl = root.querySelector('.karat-purity-ring__pct');
  if (track) track.style.setProperty('--purity-fill', `${pct}%`);
  if (fill) fill.style.setProperty('--purity-fill', `${pct}%`);
  if (labelEl) labelEl.textContent = `${karat}K`;
  if (pctEl) pctEl.textContent = `${pct}%`;
  if (ring) {
    ring.setAttribute('aria-label', label || `${karat}K · ${pct}% gold`);
  }
}
