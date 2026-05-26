'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

let importCounter = 0;

async function loadMarketSummaryTicker() {
  const url = new URL(
    'file://' + path.resolve(__dirname, '..', 'src', 'components', 'MarketSummaryTicker.js')
  );
  return import(url.href + `?v=${++importCounter}`);
}

function installDom() {
  function hasClass(node, className) {
    return String(node.className || '')
      .split(/\s+/)
      .filter(Boolean)
      .includes(className);
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
      _children: [],
      _text: '',
      setAttribute(name, value) {
        attrs.set(name, String(value));
      },
      getAttribute(name) {
        return attrs.has(name) ? attrs.get(name) : null;
      },
      append(...children) {
        for (const child of children) {
          if (typeof child === 'string') {
            this._children.push({
              nodeType: 3,
              textContent: child,
              ownerDocument: this.ownerDocument,
            });
          } else if (child) {
            this._children.push(child);
          }
        }
      },
      appendChild(child) {
        this._children.push(child);
        return child;
      },
      removeChild(child) {
        const index = this._children.indexOf(child);
        if (index >= 0) this._children.splice(index, 1);
        return child;
      },
      cloneNode(deep = false) {
        const clone = createElement(tag);
        clone.ownerDocument = this.ownerDocument;
        clone.className = this.className;
        clone.dataset = { ...this.dataset };
        clone._text = this._text;
        for (const [name, value] of attrs.entries()) clone.setAttribute(name, value);
        if (deep) {
          clone._children = this._children.map((child) =>
            child.nodeType === 1
              ? child.cloneNode(true)
              : { nodeType: 3, textContent: child.textContent, ownerDocument: this.ownerDocument }
          );
        }
        return clone;
      },
      querySelector(selector) {
        return this.querySelectorAll(selector)[0] || null;
      },
      querySelectorAll(selector) {
        const classes = selector
          .trim()
          .split(/\s+/)
          .map((part) => part.replace(/^\./, ''));
        if (classes.length === 1) return findDescendants(this, classes[0]);
        if (classes.length === 2) {
          return findDescendants(this, classes[0]).flatMap((match) =>
            findDescendants(match, classes[1])
          );
        }
        return [];
      },
      classList: {
        add: (...names) => {
          const classes = new Set(String(node.className || '').split(/\s+/).filter(Boolean));
          names.forEach((name) => classes.add(name));
          node.className = Array.from(classes).join(' ');
        },
        remove: (...names) => {
          const classes = new Set(String(node.className || '').split(/\s+/).filter(Boolean));
          names.forEach((name) => classes.delete(name));
          node.className = Array.from(classes).join(' ');
        },
        contains: (name) => hasClass(node, name),
      },
      get firstChild() {
        return this._children[0] || null;
      },
      get children() {
        return this._children.filter((child) => child.nodeType === 1);
      },
      set textContent(value) {
        this._children = [];
        this._text = String(value ?? '');
      },
      get textContent() {
        if (!this._children.length) return this._text;
        return this._children.map((child) => child.textContent || '').join('');
      },
    };
    return node;
  }

  function findDescendants(root, className) {
    const matches = [];
    for (const child of root.children || []) {
      if (hasClass(child, className)) matches.push(child);
      matches.push(...findDescendants(child, className));
    }
    return matches;
  }

  const document = {
    createElement(tag) {
      const node = createElement(tag);
      node.ownerDocument = document;
      return node;
    },
  };

  global.document = document;
  const container = document.createElement('div');

  return {
    container,
    restore() {
      delete global.document;
    },
  };
}

test('renderMarketSummaryTicker creates an accessible duplicated ticker track', async () => {
  const dom = installDom();
  const { renderMarketSummaryTicker } = await loadMarketSummaryTicker();

  renderMarketSummaryTicker(dom.container, 'en');

  const ticker = dom.container.children[0];
  assert.equal(ticker.getAttribute('role'), 'marquee');
  assert.equal(ticker.getAttribute('aria-label'), 'Live market summary');
  assert.equal(ticker.getAttribute('aria-live'), 'off');
  assert.equal(ticker.querySelectorAll('.mst-item').length, 8);
  assert.equal(ticker.querySelectorAll('.mst-item__change').length, 2);
  assert.equal(ticker.querySelectorAll('.mst-track')[0].children[4].getAttribute('aria-hidden'), 'true');

  dom.restore();
});

test('updateMarketSummaryTicker formats prices, change direction, market state, and age', async () => {
  const dom = installDom();
  const { renderMarketSummaryTicker, updateMarketSummaryTicker } = await loadMarketSummaryTicker();
  const originalDateNow = Date.now;
  Date.now = () => Date.UTC(2026, 4, 26, 10, 0, 0);

  try {
    renderMarketSummaryTicker(dom.container, 'en');
    updateMarketSummaryTicker({
      xauUsd: 2350.423,
      aed24kGram: 277.576,
      changePct: -1.246,
      marketOpen: false,
      updatedAt: new Date(Date.now() - 7 * 60 * 1000).toISOString(),
    });

    const ticker = dom.container.children[0];
    assert.deepEqual(
      ticker.querySelectorAll('.mst-item--spot .mst-item__value').map((node) => node.textContent),
      ['$2,350.42', '$2,350.42']
    );
    assert.deepEqual(
      ticker.querySelectorAll('.mst-item--spot .mst-item__change').map((node) => node.textContent),
      ['▼1.25%', '▼1.25%']
    );
    assert.ok(
      ticker.querySelectorAll('.mst-item--spot').every((node) => node.classList.contains('mst-item--down'))
    );
    assert.deepEqual(
      ticker.querySelectorAll('.mst-item--aed .mst-item__value').map((node) => node.textContent),
      ['277.58', '277.58']
    );
    assert.deepEqual(
      ticker.querySelectorAll('.mst-item--market .mst-item__value').map((node) => node.textContent),
      ['CLOSED', 'CLOSED']
    );
    assert.ok(
      ticker
        .querySelectorAll('.mst-item--market')
        .every((node) => node.classList.contains('mst-item--closed'))
    );
    assert.deepEqual(
      ticker.querySelectorAll('.mst-item--updated .mst-item__value').map((node) => node.textContent),
      ['7 min ago', '7 min ago']
    );
  } finally {
    Date.now = originalDateNow;
    dom.restore();
  }
});

test('updateMarketSummaryTickerLang switches labels and future status updates to Arabic', async () => {
  const dom = installDom();
  const {
    renderMarketSummaryTicker,
    updateMarketSummaryTicker,
    updateMarketSummaryTickerLang,
  } = await loadMarketSummaryTicker();
  const originalDateNow = Date.now;
  Date.now = () => Date.UTC(2026, 4, 26, 10, 0, 0);

  try {
    renderMarketSummaryTicker(dom.container, 'en');
    updateMarketSummaryTickerLang('ar');
    updateMarketSummaryTicker({
      marketOpen: false,
      updatedAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
    });

    const ticker = dom.container.children[0];
    assert.equal(ticker.getAttribute('aria-label'), 'ملخص السوق المباشر');
    assert.deepEqual(
      ticker.querySelectorAll('.mst-item__label').map((node) => node.textContent),
      [
        'سعر الذهب الفوري',
        '24K درهم/غ',
        'السوق',
        'آخر تحديث',
        'سعر الذهب الفوري',
        '24K درهم/غ',
        'السوق',
        'آخر تحديث',
      ]
    );
    assert.deepEqual(
      ticker.querySelectorAll('.mst-item--market .mst-item__value').map((node) => node.textContent),
      ['مغلق', 'مغلق']
    );
    assert.deepEqual(
      ticker.querySelectorAll('.mst-item--updated .mst-item__value').map((node) => node.textContent),
      ['3 دقيقة مضت', '3 دقيقة مضت']
    );
  } finally {
    Date.now = originalDateNow;
    dom.restore();
  }
});
