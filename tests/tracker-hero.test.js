'use strict';

const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

function createNode(tag, nodeType = 1) {
  const attrs = new Map();
  const node = {
    nodeType,
    tagName: nodeType === 1 ? String(tag).toUpperCase() : undefined,
    ownerDocument: null,
    dataset: {},
    style: {
      setProperty(name, value) {
        this[name] = String(value);
      },
    },
    className: '',
    hidden: false,
    disabled: false,
    value: '',
    title: '',
    parentElement: null,
    _children: [],
    _text: '',
    classList: {
      add(...names) {
        const set = new Set(
          String(node.className || '')
            .split(/\s+/)
            .filter(Boolean)
        );
        names.forEach((name) => set.add(name));
        node.className = [...set].join(' ');
      },
      remove(...names) {
        const remove = new Set(names);
        node.className = String(node.className || '')
          .split(/\s+/)
          .filter((name) => name && !remove.has(name))
          .join(' ');
      },
      contains(name) {
        return String(node.className || '')
          .split(/\s+/)
          .includes(name);
      },
    },
    setAttribute(name, value) {
      attrs.set(name, String(value));
      if (name === 'class') this.className = String(value);
      if (name === 'id') this.id = String(value);
    },
    getAttribute(name) {
      return attrs.has(name) ? attrs.get(name) : null;
    },
    append(...children) {
      for (const child of children) {
        const next = typeof child === 'string' ? createText(child) : child;
        if (next?.nodeType === 11) {
          for (const fragmentChild of next._children || []) {
            if (fragmentChild) fragmentChild.parentElement = this;
            this._children.push(fragmentChild);
          }
          continue;
        }
        if (next) next.parentElement = this;
        this._children.push(next);
      }
    },
    replaceChildren(...children) {
      this._children = [];
      this._text = '';
      this.append(...children);
    },
    removeChild(child) {
      const index = this._children.indexOf(child);
      if (index >= 0) this._children.splice(index, 1);
    },
    remove() {
      if (this.parentElement) this.parentElement.removeChild(this);
    },
    after() {},
    addEventListener() {},
    closest() {
      return null;
    },
    querySelector(selector) {
      return find(this, (child) => matches(child, selector));
    },
    getBoundingClientRect() {
      return { left: 0, width: 100 };
    },
    get firstChild() {
      return this._children[0] || null;
    },
    get children() {
      return this._children.filter((child) => child && child.nodeType === 1);
    },
    get textContent() {
      return this._text + this._children.map((child) => child.textContent || '').join('');
    },
    set textContent(value) {
      this._children = [];
      this._text = String(value ?? '');
    },
  };
  return node;
}

function createText(text) {
  return {
    nodeType: 3,
    ownerDocument: global.document || null,
    textContent: String(text ?? ''),
    parentElement: null,
  };
}

function matches(node, selector) {
  if (!node || node.nodeType !== 1) return false;
  const data = selector.match(/^\[data-([\w-]+)(?:="([^"]+)")?\]$/);
  if (data) {
    const key = data[1].replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    return data[2] === undefined ? node.dataset[key] !== undefined : node.dataset[key] === data[2];
  }
  if (selector.startsWith('.')) return node.classList.contains(selector.slice(1));
  return node.tagName.toLowerCase() === selector.toLowerCase();
}

function find(node, predicate) {
  for (const child of node.children || []) {
    if (predicate(child)) return child;
    const nested = find(child, predicate);
    if (nested) return nested;
  }
  return null;
}

function installDom(ids = {}) {
  const elements = new Map(Object.entries(ids));
  const document = {
    title: '',
    createElement(tag) {
      const node = createNode(tag);
      node.ownerDocument = document;
      return node;
    },
    createElementNS(_ns, tag) {
      const node = createNode(tag);
      node.ownerDocument = document;
      return node;
    },
    createTextNode(text) {
      return createText(text);
    },
    createDocumentFragment() {
      const node = createNode('#fragment', 11);
      node.ownerDocument = document;
      return node;
    },
    getElementById(id) {
      return elements.get(id) || null;
    },
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    },
  };
  global.document = document;
  return { document, elements };
}

async function loadCtx(state, el = {}, priceFor = () => null, currentSpot = () => null) {
  const ctxUrl = new URL('file://' + path.resolve(__dirname, '..', 'src', 'tracker', '_ctx.js'));
  const ctxMod = await import(ctxUrl.href);
  ctxMod._setCtx({ state, el, priceFor, currentSpot, showToast: () => {} });
  return ctxMod;
}

async function loadTrackerModule(name) {
  const url = new URL('file://' + path.resolve(__dirname, '..', 'src', 'tracker', name));
  return import(url.href + `?v=${Date.now()}-${Math.random()}`);
}

describe('tracker hero module', () => {
  let mod;
  let state;
  let miniStrip;
  let karatTable;

  before(async () => {
    installDom();
    miniStrip = createNode('div');
    karatTable = createNode('tbody');
    state = {
      lang: 'en',
      selectedCurrency: 'AED',
      selectedKarat: '24',
      selectedUnit: 'gram',
      hasLiveFailure: false,
      live: {
        isFallback: false,
        isFresh: true,
        updatedAt: new Date().toISOString(),
        providerId: 'goldpricez',
      },
    };
    await loadCtx(
      state,
      { miniStrip, karatTable },
      () => 250,
      () => 2100
    );
    mod = await loadTrackerModule('hero.js');
  });

  it('renders hero with sparse element references', () => {
    assert.doesNotThrow(() => mod.renderHero());
  });

  it('renders the mini strip with the selected price', () => {
    assert.doesNotThrow(() => mod.renderMiniStrip());
    assert.match(miniStrip.textContent, /AED|24/);
  });

  it('renders the karat table with partial DOM', () => {
    assert.doesNotThrow(() => mod.renderKaratTable());
    assert.ok(karatTable.children.length > 0);
  });
});
