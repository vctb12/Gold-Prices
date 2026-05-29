'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');

async function loadModule() {
  const url = new URL('file://' + path.resolve(REPO_ROOT, 'src', 'lib', 'sw-update-toast.js'));
  return import(url.href + `?v=${Date.now()}`);
}

/**
 * Minimal DOM + serviceWorker mock sufficient for sw-update-toast.js.
 * Returns helpers to drive an SW_UPDATED message and inspect the toast.
 */
function installEnv({ lang } = {}) {
  const byId = new Map();
  const swListeners = [];

  function createElement(tag) {
    const attrs = new Map();
    const listeners = {};
    const node = {
      nodeType: 1,
      tagName: String(tag).toUpperCase(),
      _id: '',
      _children: [],
      _parent: null,
      textContent: '',
      _classes: new Set(),
      _className: '',
      get className() {
        return node._className;
      },
      set className(v) {
        node._className = String(v);
        node._classes = new Set(String(v).split(/\s+/).filter(Boolean));
      },
      classList: {
        add: (c) => node._classes.add(c),
        remove: (c) => node._classes.delete(c),
        contains: (c) => node._classes.has(c),
      },
      get id() {
        return node._id;
      },
      set id(v) {
        node._id = v;
        byId.set(v, node);
      },
      get isConnected() {
        let n = node;
        while (n) {
          if (n === fakeBody || n === fakeHead) return true;
          n = n._parent;
        }
        return false;
      },
      setAttribute: (k, v) => attrs.set(k, String(v)),
      getAttribute: (k) => (attrs.has(k) ? attrs.get(k) : null),
      addEventListener: (type, fn) => {
        (listeners[type] = listeners[type] || []).push(fn);
      },
      dispatch: (type, evt) => (listeners[type] || []).forEach((fn) => fn(evt || {})),
      appendChild: (child) => {
        child._parent = node;
        node._children.push(child);
        return child;
      },
      remove: () => {
        if (node._parent) {
          node._parent._children = node._parent._children.filter((c) => c !== node);
          node._parent = null;
        }
        if (node._id) byId.delete(node._id);
      },
      click: () => node.dispatch('click', {}),
    };
    return node;
  }

  const fakeHead = createElement('head');
  const fakeBody = createElement('body');

  let reloadCount = 0;

  global.document = {
    head: fakeHead,
    body: fakeBody,
    createElement,
    getElementById: (id) => byId.get(id) || null,
  };
  global.window = { location: { reload: () => (reloadCount += 1) } };
  Object.defineProperty(global, 'navigator', {
    value: {
      serviceWorker: {
        addEventListener: (type, fn) => {
          if (type === 'message') swListeners.push(fn);
        },
      },
    },
    configurable: true,
    writable: true,
  });
  global.localStorage = {
    getItem: () => (lang ? JSON.stringify({ lang }) : '{}'),
  };

  return {
    fakeBody,
    emitUpdate: () => swListeners.forEach((fn) => fn({ data: { type: 'SW_UPDATED' } })),
    emitOther: () => swListeners.forEach((fn) => fn({ data: { type: 'OTHER' } })),
    getToast: () => byId.get('sw-update-toast') || null,
    hasListener: () => swListeners.length > 0,
    reloads: () => reloadCount,
  };
}

function cleanupEnv() {
  delete global.document;
  delete global.window;
  delete global.navigator;
  delete global.localStorage;
}

test('home.js imports initSwUpdateToast so the SW update-toast feature is actually wired', () => {
  const home = fs.readFileSync(path.resolve(REPO_ROOT, 'src', 'pages', 'home.js'), 'utf8');
  assert.match(
    home,
    /import\s*\{[^}]*\binitSwUpdateToast\b[^}]*\}\s*from\s*['"][^'"]*sw-update-toast\.js['"]/,
    'home.js must import initSwUpdateToast (it is called after SW registration)'
  );
  assert.match(home, /initSwUpdateToast\(\)/, 'home.js must call initSwUpdateToast()');
});

test('initSwUpdateToast is a no-op when serviceWorker is unavailable', async () => {
  const env = installEnv();
  delete global.navigator.serviceWorker;
  try {
    const { initSwUpdateToast } = await loadModule();
    assert.doesNotThrow(() => initSwUpdateToast());
    assert.equal(env.getToast(), null);
  } finally {
    cleanupEnv();
  }
});

test('SW_UPDATED message renders an English toast with refresh + dismiss controls', async () => {
  const env = installEnv();
  try {
    const { initSwUpdateToast } = await loadModule();
    initSwUpdateToast();
    assert.ok(env.hasListener(), 'should register a message listener');
    env.emitUpdate();
    const toast = env.getToast();
    assert.ok(toast, 'toast element should be created');
    assert.equal(toast.getAttribute('role'), 'status');
    const text = toast._children.map((c) => c.textContent).join(' ');
    assert.match(text, /Update available/i);
    assert.match(text, /Refresh/i);
  } finally {
    cleanupEnv();
  }
});

test('SW_UPDATED renders Arabic copy when user_prefs.lang === "ar"', async () => {
  const env = installEnv({ lang: 'ar' });
  try {
    const { initSwUpdateToast } = await loadModule();
    initSwUpdateToast();
    env.emitUpdate();
    const toast = env.getToast();
    const text = toast._children.map((c) => c.textContent).join(' ');
    assert.match(text, /تحديث متوفر/);
  } finally {
    cleanupEnv();
  }
});

test('non SW_UPDATED messages do not create a toast', async () => {
  const env = installEnv();
  try {
    const { initSwUpdateToast } = await loadModule();
    initSwUpdateToast();
    env.emitOther();
    assert.equal(env.getToast(), null);
  } finally {
    cleanupEnv();
  }
});

test('refresh button triggers a reload', async () => {
  const env = installEnv();
  try {
    const { initSwUpdateToast } = await loadModule();
    initSwUpdateToast();
    env.emitUpdate();
    const toast = env.getToast();
    const refreshBtn = toast._children.find((c) => c._classes.has('sw-toast-refresh'));
    assert.ok(refreshBtn, 'refresh button should exist');
    refreshBtn.click();
    assert.equal(env.reloads(), 1);
  } finally {
    cleanupEnv();
  }
});
