'use strict';

/**
 * Tests for the ticker component's freshness-state wiring (§6.2).
 *
 * The ticker is an ES module that imports from `src/lib/live-status.js`
 * and mutates the DOM. We drive it with a minimal DOM stub mirroring
 * `tests/spot-bar-freshness.test.js` and assert that the top-level
 * `#gold-ticker` element carries a `data-freshness` attribute that
 * matches `getLiveFreshness()`'s contract.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

async function loadTicker() {
  const url = new URL('file://' + path.resolve(__dirname, '..', 'src', 'components', 'ticker.js'));
  return import(url.href);
}

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
        toggle: (n, on) => {
          if (on === undefined) {
            if (classes.has(n)) classes.delete(n);
            else classes.add(n);
          } else if (on) classes.add(n);
          else classes.delete(n);
        },
      },
      addEventListener() {},
      appendChild(child) {
        el._children.push(child);
      },
      querySelector(sel) {
        // Only `[data-ticker-status]` / `[data-ticker-status-label]` are
        // queried by the ticker at the ticker-element level.
        const m = sel.match(/\[([a-z0-9-]+)(?:="([^"]+)")?\]/i);
        if (!m) return null;
        const [, attr, val] = m;
        return (
          el._descendants.find((c) =>
            val != null ? c.getAttribute(attr) === val : c.getAttribute(attr) !== null
          ) || null
        );
      },
      querySelectorAll() {
        return [];
      },
      _descendants: [],
    };
    return el;
  }

  function seedDescendants(bar) {
    const status = createElement('span');
    status.setAttribute('data-ticker-status', '');
    const label = createElement('span');
    label.setAttribute('data-ticker-status-label', '');
    bar._descendants = [status, label];
  }

  const body = createElement('body');
  body.appendChild = (node) => {
    body._children.push(node);
  };
  body.classList = {
    add: () => {},
    remove: () => {},
    contains: () => false,
    toggle: () => {},
  };

  global.document = {
    getElementById: (id) => children.get(id) || null,
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: (tag) => {
      const el = createElement(tag);
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
      seedDescendants(el);
      return el;
    },
    body,
  };
  global.sessionStorage = {
    getItem: () => null,
    setItem: () => {},
  };
  global.window = {
    matchMedia: () => ({ matches: false, addEventListener: () => {} }),
  };
  return {
    getTicker: () => children.get('gold-ticker'),
    restore: () => {
      delete global.document;
      delete global.sessionStorage;
      delete global.window;
    },
  };
}

test('ticker starts at data-freshness="unavailable" before first update', async () => {
  const dom = installDom();
  const { injectTicker } = await loadTicker();
  injectTicker('en', 0);
  assert.equal(dom.getTicker().getAttribute('data-freshness'), 'unavailable');
  dom.restore();
});

test('ticker sets data-freshness="live" for a recent timestamp with no failure', async () => {
  const dom = installDom();
  const { injectTicker, updateTicker } = await loadTicker();
  injectTicker('en', 0);
  updateTicker({
    xauUsd: 2300,
    updatedAt: new Date().toISOString(),
    hasLiveFailure: false,
  });
  assert.equal(dom.getTicker().getAttribute('data-freshness'), 'live');
  dom.restore();
});

test('ticker sets data-freshness="cached" when hasLiveFailure is true', async () => {
  const dom = installDom();
  const { injectTicker, updateTicker } = await loadTicker();
  injectTicker('en', 0);
  updateTicker({
    xauUsd: 2300,
    updatedAt: new Date().toISOString(),
    hasLiveFailure: true,
  });
  assert.equal(dom.getTicker().getAttribute('data-freshness'), 'cached');
  dom.restore();
});

test('ticker sets data-freshness="stale" for a timestamp older than the stale threshold', async () => {
  const dom = installDom();
  const { injectTicker, updateTicker } = await loadTicker();
  injectTicker('en', 0);
  // > STALE_AFTER_MS (75 min) — see src/lib/live-status.js.
  const oldIso = new Date(Date.now() - 90 * 60 * 1000).toISOString();
  updateTicker({
    xauUsd: 2300,
    updatedAt: oldIso,
    hasLiveFailure: false,
  });
  assert.equal(dom.getTicker().getAttribute('data-freshness'), 'stale');
  dom.restore();
});

test('ticker sets data-freshness="fallback" when upstream reports isFallback=true', async () => {
  const dom = installDom();
  const { injectTicker, updateTicker } = await loadTicker();
  injectTicker('en', 0);
  updateTicker({
    xauUsd: 2300,
    updatedAt: new Date().toISOString(),
    hasLiveFailure: false,
    isFallback: true,
  });
  assert.equal(dom.getTicker().getAttribute('data-freshness'), 'fallback');
  dom.restore();
});

test('ticker freshness updates language label when updateTickerLang is called', async () => {
  const dom = installDom();
  const { injectTicker, updateTicker, updateTickerLang } = await loadTicker();
  injectTicker('en', 0);
  updateTicker({
    xauUsd: 2300,
    updatedAt: new Date().toISOString(),
    hasLiveFailure: false,
  });
  const bar = dom.getTicker();
  const labelBefore = bar.querySelector('[data-ticker-status-label]');
  assert.equal(labelBefore && labelBefore.textContent, 'Live');
  updateTickerLang('ar');
  const labelAfter = bar.querySelector('[data-ticker-status-label]');
  assert.equal(labelAfter && labelAfter.textContent, 'مباشر');
  dom.restore();
});
