// tracker/control-shortcuts.js — hero control cycling + copy spot (keyboard)
import { KARATS } from '../config/index.js';
import { copyWithToast } from '../lib/copy-toast.js';

const UNIT_ORDER = ['gram', 'oz', 'tola', 'kg'];

/**
 * @param {object} ctx
 * @param {object} ctx.state
 * @param {object} ctx.el — tracker element refs (karat, unit, currency)
 * @param {() => number|null} ctx.currentSpot
 * @param {typeof import('../pages/tracker-pro.js').priceFor} ctx.priceFor
 * @param {() => void} ctx.persistState
 * @param {() => void} ctx.renderAll
 * @param {(key: string, params?: object) => string} ctx.tx
 */
export function cycleKarat({ state, el, persistState, renderAll }) {
  const codes = KARATS.map((k) => k.code);
  const idx = codes.indexOf(state.selectedKarat);
  const next = codes[(idx + 1) % codes.length];
  state.selectedKarat = next;
  if (el.karat) el.karat.value = next;
  persistState();
  renderAll();
}

export function cycleUnit({ state, el, persistState, renderAll }) {
  const idx = UNIT_ORDER.indexOf(state.selectedUnit);
  const next = UNIT_ORDER[(idx + 1) % UNIT_ORDER.length];
  state.selectedUnit = next;
  if (el.unit) el.unit.value = next;
  persistState();
  renderAll();
}

export async function copySpotPrice({ state, currentSpot, priceFor, tx }) {
  const spot = currentSpot();
  if (!spot) return false;
  const local = priceFor({
    currency: state.selectedCurrency,
    karat: state.selectedKarat,
    unit: state.selectedUnit,
    spot,
  });
  const lines = [
    `XAU/USD ${spot.toFixed(2)}`,
    local
      ? `${state.selectedKarat}K ${state.selectedUnit} · ${state.selectedCurrency} ${local.toFixed(2)}`
      : null,
    new Date().toUTCString(),
  ].filter(Boolean);
  return copyWithToast(lines.join('\n'), {
    successMessage: tx('toast.priceCopied'),
    errorMessage: tx('toast.clipboardFailed'),
  });
}

/**
 * Wire K / U / Shift+C shortcuts (compare mode keeps plain `c`).
 * @param {object} ctx
 */
export function bindControlShortcuts(ctx) {
  window.addEventListener('keydown', (evt) => {
    if (evt.altKey || evt.metaKey || evt.ctrlKey) return;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(evt.target?.tagName)) return;
    const key = evt.key.toLowerCase();
    if (key === 'k') {
      evt.preventDefault();
      cycleKarat(ctx);
      return;
    }
    if (key === 'u') {
      evt.preventDefault();
      cycleUnit(ctx);
      return;
    }
    if (key === 'c' && evt.shiftKey) {
      evt.preventDefault();
      copySpotPrice(ctx);
    }
  });
}
