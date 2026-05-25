'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

async function loadFreshnessStrip() {
  const url = new URL(
    'file://' + path.resolve(__dirname, '..', 'src', 'components', 'FreshnessStrip.js')
  );
  return import(url.href + `?v=${Date.now()}`);
}

function installDom() {
  const elementsById = new Map();

  function createTextNode(text) {
    return { nodeType: 3, textContent: String(text ?? ''), ownerDocument: global.document || null };
  }

  function createElement(tag) {
    const attrs = new Map();
    const node = {
      nodeType: 1,
      tagName: String(tag).toUpperCase(),
      ownerDocument: null,
      dataset: {},
      style: { setProperty() {} },
      className: '',
      hidden: false,
      _children: [],
      setAttribute(name, value) {
        attrs.set(name, String(value));
      },
      getAttribute(name) {
        return attrs.has(name) ? attrs.get(name) : null;
      },
      append(...children) {
        for (const child of children) {
          if (typeof child === 'string') this._children.push(createTextNode(child));
          else this._children.push(child);
        }
      },
      removeChild(child) {
        const index = this._children.indexOf(child);
        if (index >= 0) this._children.splice(index, 1);
      },
      get firstChild() {
        return this._children[0] || null;
      },
      get children() {
        return this._children.filter((child) => child && child.nodeType === 1);
      },
      get textContent() {
        return this._children
          .map((child) => (typeof child.textContent === 'string' ? child.textContent : ''))
          .join('');
      },
    };
    return node;
  }

  const document = {
    createElement(tag) {
      const node = createElement(tag);
      node.ownerDocument = document;
      return node;
    },
    getElementById(id) {
      return elementsById.get(id) || null;
    },
  };

  global.document = document;
  global.location = { pathname: '/countries/uae/gold-price/' };

  const container = document.createElement('div');
  container.id = 'freshness-slot';
  elementsById.set('freshness-slot', container);

  return {
    container,
    restore() {
      delete global.document;
      delete global.location;
    },
  };
}

function findByClass(node, className) {
  if (!node || !node.children) return null;
  for (const child of node.children) {
    if (child.className === className) return child;
    const nested = findByClass(child, className);
    if (nested) return nested;
  }
  return null;
}

test('renderFreshnessStrip mounts a shared status bar with machine-readable metadata', async () => {
  const dom = installDom();
  const { renderFreshnessStrip } = await loadFreshnessStrip();

  const strip = renderFreshnessStrip({
    containerId: 'freshness-slot',
    state: 'live',
    lang: 'en',
    source: 'GoldPriceZ',
    timestamp: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
  });

  assert.ok(strip, 'strip should be rendered');
  assert.equal(dom.container.children.length, 1, 'container should receive the strip');
  assert.equal(strip.getAttribute('role'), 'status');
  assert.equal(strip.getAttribute('aria-live'), 'polite');
  assert.equal(strip.getAttribute('aria-atomic'), 'true');
  assert.equal(strip.dataset.freshnessState, 'live');
  assert.equal(strip.dataset.freshnessSource, 'GoldPriceZ');
  assert.match(strip.dataset.freshnessTimestamp, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(findByClass(strip, 'freshness-strip__label').textContent, 'Live');
  assert.match(findByClass(strip, 'freshness-strip__source').textContent, /GoldPriceZ/);
  assert.equal(
    findByClass(strip, 'freshness-strip__link').getAttribute('href'),
    '../../../methodology.html'
  );

  dom.restore();
});

test('renderFreshnessStrip falls back to unavailable state labels in Arabic', async () => {
  const dom = installDom();
  const { renderFreshnessStrip } = await loadFreshnessStrip();

  const strip = renderFreshnessStrip({
    containerId: 'freshness-slot',
    state: 'unknown-state',
    lang: 'ar',
    source: 'Gold Ticker Live',
    timestamp: new Date().toISOString(),
  });

  assert.equal(strip.dataset.freshnessState, 'unavailable');
  assert.equal(findByClass(strip, 'freshness-strip__label').textContent, 'غير متاح');
  assert.equal(findByClass(strip, 'freshness-strip__link').textContent, 'المنهجية');

  dom.restore();
});
