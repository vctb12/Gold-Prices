'use strict';

/**
 * Tests for the spotBar component's freshness-state wiring (§6.2).
 *
 * spotBar is an ES module that imports from `src/lib/live-status.js` and
 * mutates the DOM. We drive it with a minimal DOM stub and assert that
 * `data-freshness` ends up matching `getLiveFreshness()`'s contract.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

async function loadSpotBar() {
  const url = new URL('file://' + path.resolve(__dirname, '..', 'src', 'components', 'spotBar.js'));
  return import(url.href);
}

// Minimal DOM stub — covers exactly the surface spotBar.js touches.
function installDom() {
  const children = new Map(); // id -> element

  function createElement(_tag) {
    const attrs = new Map();
    const classes = new Set();
    let innerHtml = '';
    const el = {
      _children: [],
      className: '',
      style: {},
      set innerHTML(v) {
        innerHtml = v;
      },
      get innerHTML() {
        return innerHtml;
      },
      setAttribute(k, v) {
        attrs.set(k, String(v));
      },
      getAttribute(k) {
        return attrs.has(k) ? attrs.get(k) : null;
      },
      removeAttribute(k) {
        attrs.delete(k);
      },
      classList: {
        add: (...names) => names.forEach((n) => classes.add(n)),
        remove: (...names) => names.forEach((n) => classes.delete(n)),
        contains: (n) => classes.has(n),
      },
      querySelector(sel) {
        // Only the `[data-spot-...]` selectors spotBar uses are supported.
        const m = sel.match(/\[([a-z0-9-]+)="([^"]+)"\]/i);
        if (m) {
          const [, attr, val] = m;
          return el._descendants.find((c) => c.getAttribute(attr) === val) || null;
        }
        // Bare attribute with no value: `[data-spot-ts]`
        const m2 = sel.match(/\[([a-z0-9-]+)\]/i);
        if (m2) {
          const attr = m2[1];
          return el._descendants.find((c) => c.getAttribute(attr) !== null) || null;
        }
        return null;
      },
      appendChild(child) {
        el._children.push(child);
      },
      _descendants: [],
    };
    return el;
  }

  // Build the bar's inner structure eagerly so querySelector works after
  // spotBar assigns `_barEl.innerHTML = ...`. We mimic the post-parse DOM
  // by seeding descendants keyed by the attribute selectors spotBar uses.
  function seedDescendants(bar) {
    const xauVal = createElement('span');
    xauVal.setAttribute('data-spot-value', 'xau');
    const aedVal = createElement('span');
    aedVal.setAttribute('data-spot-value', 'aed');
    const aedLabel = createElement('span');
    aedLabel.setAttribute('data-spot-label', 'aed');
    const ts = createElement('span');
    ts.setAttribute('data-spot-ts', '');
    bar._descendants = [xauVal, aedVal, aedLabel, ts];
    return { xauVal, aedVal, ts };
  }

  const body = createElement('body');
  body.firstChild = null;
  body.insertBefore = (node, _ref) => {
    body._children.unshift(node);
  };
  body.classList = {
    add: () => {},
    remove: () => {},
    contains: () => false,
  };

  global.document = {
    getElementById: (id) => children.get(id) || null,
    querySelector: () => null,
    createElement: (tag) => {
      const el = createElement(tag);
      // Track `el.id = "..."` assignments (used by spotBar) via a setter.
      let _id = '';
      Object.defineProperty(el, 'id', {
        get() {
          return _id;
        },
        set(v) {
          _id = v;
          children.set(v, el);
        },
      });
      // Seed descendants that spotBar.innerHTML would normally create, so
      // querySelector can find them after the module's template string is
      // assigned. The real DOM parses innerHTML into children; our stub
      // pre-populates the same selector surface.
      seedDescendants(el);
      return el;
    },
    body,
  };
  return {
    getBar: () => children.get('spot-price-bar'),
    restore: () => {
      delete global.document;
    },
  };
}

test('spotBar sets data-freshness="live" for a recent timestamp', async () => {
  const dom = installDom();
  const { injectSpotBar, updateSpotBar } = await loadSpotBar();

  injectSpotBar('en', 0);
  updateSpotBar({
    xauUsd: 2300,
    aed24kGram: 280,
    updatedAt: new Date().toISOString(),
    hasLiveFailure: false,
  });
  const bar = dom.getBar();
  assert.equal(bar.getAttribute('data-freshness'), 'live');
  dom.restore();
});

test('spotBar sets data-freshness="cached" when hasLiveFailure is true', async () => {
  const dom = installDom();
  const { injectSpotBar, updateSpotBar } = await loadSpotBar();

  injectSpotBar('en', 0);
  updateSpotBar({
    xauUsd: 2300,
    aed24kGram: 280,
    updatedAt: new Date().toISOString(),
    hasLiveFailure: true,
  });
  assert.equal(dom.getBar().getAttribute('data-freshness'), 'cached');
  dom.restore();
});

test('spotBar sets data-freshness="stale" for an old timestamp regardless of failure flag', async () => {
  const dom = installDom();
  const { injectSpotBar, updateSpotBar } = await loadSpotBar();

  injectSpotBar('en', 0);
  // > STALE_AFTER_MS (75 min) — see src/lib/live-status.js. Anything older
  // than the upstream hourly refresh window must classify as stale.
  const oldIso = new Date(Date.now() - 90 * 60 * 1000).toISOString(); // 90 min ago
  updateSpotBar({
    xauUsd: 2300,
    aed24kGram: 280,
    updatedAt: oldIso,
    hasLiveFailure: false,
  });
  assert.equal(dom.getBar().getAttribute('data-freshness'), 'stale');
  dom.restore();
});

test('spotBar sets data-freshness="delayed" between DELAYED_AFTER_MS and STALE_AFTER_MS', async () => {
  const dom = installDom();
  const { injectSpotBar, updateSpotBar } = await loadSpotBar();

  injectSpotBar('en', 0);
  const oldIso = new Date(Date.now() - 45 * 60 * 1000).toISOString(); // 45 min ago
  updateSpotBar({
    xauUsd: 2300,
    aed24kGram: 280,
    updatedAt: oldIso,
    hasLiveFailure: false,
  });
  assert.equal(dom.getBar().getAttribute('data-freshness'), 'delayed');
  dom.restore();
});

test('spotBar sets data-freshness="fallback" when isFallback=true even with a fresh timestamp', async () => {
  const dom = installDom();
  const { injectSpotBar, updateSpotBar } = await loadSpotBar();

  injectSpotBar('en', 0);
  updateSpotBar({
    xauUsd: 2300,
    aed24kGram: 280,
    updatedAt: new Date().toISOString(),
    hasLiveFailure: false,
    isFallback: true,
  });
  assert.equal(dom.getBar().getAttribute('data-freshness'), 'fallback');
  dom.restore();
});

test('spotBar starts at data-freshness="unavailable" before first update', async () => {
  const dom = installDom();
  const { injectSpotBar } = await loadSpotBar();
  injectSpotBar('en', 0);
  assert.equal(dom.getBar().getAttribute('data-freshness'), 'unavailable');
  dom.restore();
});
