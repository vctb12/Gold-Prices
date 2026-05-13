/**
 * Tests for src/lib/safe-dom.js — these are pure functions (no DOM API
 * required for `escape`, `safeHref`, `safeTel`) so they run fine under
 * `node --test`.
 */

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

// The module is authored as ESM; load it via dynamic import.
async function load() {
  const url = new URL('file://' + path.resolve(__dirname, '..', 'src', 'lib', 'safe-dom.js'));
  return import(url.href);
}

test('escape() neutralises XSS payloads in text', async () => {
  const { escape } = await load();
  assert.equal(escape('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;');
  assert.equal(escape('" onerror="x"'), '&quot; onerror=&quot;x&quot;');
  assert.equal(escape("it's"), 'it&#39;s');
  assert.equal(escape('a&b'), 'a&amp;b');
  assert.equal(escape(null), '');
  assert.equal(escape(undefined), '');
  assert.equal(escape(0), '0'); // preserve falsy non-null values
});

test('escape() is idempotent enough to not double-encode predictably', async () => {
  const { escape } = await load();
  const once = escape('<a>');
  const twice = escape(once);
  // Intentionally different — double-escape is the expected safe default when
  // callers pipe pre-escaped strings back through. This guards against the
  // common mistake of assuming idempotence.
  assert.notEqual(once, twice);
  assert.ok(twice.startsWith('&amp;'));
});

test('safeHref() rejects javascript: and data: URLs', async () => {
  const { safeHref } = await load();
  assert.equal(safeHref('javascript:alert(1)'), '');
  assert.equal(safeHref('JAVASCRIPT:alert(1)'), '');
  assert.equal(safeHref('  javascript:alert(1)'), '');
  assert.equal(safeHref('data:text/html,<script>alert(1)</script>'), '');
  assert.equal(safeHref('vbscript:msgbox(1)'), '');
  assert.equal(safeHref('file:///etc/passwd'), '');
});

test('safeHref() allows http/https/relative/fragment', async () => {
  const { safeHref } = await load();
  assert.equal(safeHref('https://example.com/x'), 'https://example.com/x');
  assert.equal(safeHref('http://example.com'), 'http://example.com');
  assert.equal(safeHref('mailto:hello@example.com'), 'mailto:hello@example.com');
  assert.equal(safeHref('tel:+971 50 123 4567'), 'tel:+971501234567');
  assert.equal(safeHref('/internal/path'), '/internal/path');
  assert.equal(safeHref('./rel'), './rel');
  assert.equal(safeHref('#section'), '#section');
});

test('safeHref() returns empty string for null/undefined/non-string', async () => {
  const { safeHref } = await load();
  assert.equal(safeHref(null), '');
  assert.equal(safeHref(undefined), '');
  assert.equal(safeHref(123), '');
  assert.equal(safeHref({}), '');
});

test('safeTel() strips non-phone characters', async () => {
  const { safeTel } = await load();
  assert.equal(safeTel('+971-50-123-4567'), '+971-50-123-4567');
  assert.equal(safeTel('+971 50 <script>'), '+97150');
  assert.equal(safeTel('tel:+97150'), '+97150');
  assert.equal(safeTel(null), '');
});

test('el() applies normal styles and CSS custom properties', async () => {
  const originalDocument = global.document;
  const originalNode = global.Node;
  const customProperties = {};
  const style = {
    setProperty(name, value) {
      customProperties[name] = value;
    },
  };

  global.Node = class Node {};
  global.document = {
    createElement(tag) {
      return {
        tag,
        style,
        setAttribute() {},
        appendChild() {},
      };
    },
    createTextNode(value) {
      return String(value);
    },
  };

  try {
    const { el } = await load();
    const node = el('span', {
      style: {
        color: 'var(--color-text)',
        '--confidence-color': 'var(--color-success)',
      },
    });

    assert.equal(node.style.color, 'var(--color-text)');
    assert.equal(customProperties['--confidence-color'], 'var(--color-success)');
  } finally {
    global.document = originalDocument;
    global.Node = originalNode;
  }
});

function installMockDocument() {
  const originalDocument = global.document;
  const originalNode = global.Node;
  const listeners = [];
  const doc = {
    createElement(tag) {
      return {
        tagName: String(tag).toUpperCase(),
        nodeType: 1,
        ownerDocument: doc,
        attrs: {},
        dataset: {},
        style: {
          setProperty(name, value) {
            this[name] = value;
          },
        },
        children: [],
        appendChild(child) {
          this.children.push(child);
          return child;
        },
        append(value) {
          if (value && typeof value === 'object' && typeof value.nodeType === 'number') {
            this.children.push(value);
            return;
          }
          this.children.push(doc.createTextNode(value));
        },
        setAttribute(name, value) {
          this.attrs[name] = String(value);
        },
        addEventListener(type, fn) {
          listeners.push([type, fn]);
        },
      };
    },
    createTextNode(value) {
      return {
        nodeType: 3,
        ownerDocument: doc,
        textContent: String(value),
      };
    },
  };
  global.Node = class Node {};
  global.document = doc;
  return {
    doc,
    listeners,
    restore() {
      global.document = originalDocument;
      global.Node = originalNode;
    },
  };
}

test('el() renders string payloads as literal text (no HTML reinterpretation)', async () => {
  const mock = installMockDocument();
  try {
    const { el } = await load();
    const payload = '<img src=x onerror=alert(1)>';
    const node = el('div', null, [payload]);
    assert.equal(node.children.length, 1);
    assert.equal(node.children[0].nodeType, 3);
    assert.equal(node.children[0].textContent, payload);
  } finally {
    mock.restore();
  }
});

test('el() skips nullish/false children and supports nested arrays', async () => {
  const mock = installMockDocument();
  try {
    const { el } = await load();
    const node = el('div', null, [null, undefined, false, ['a', ['b']], 1, true]);
    assert.deepEqual(
      node.children.map((child) => child.textContent),
      ['a', 'b', '1', 'true']
    );
  } finally {
    mock.restore();
  }
});

test('el() allows trusted element children created by safe-dom', async () => {
  const mock = installMockDocument();
  try {
    const { el } = await load();
    const child = el('span', null, 'ok');
    const parent = el('div', null, [child]);
    assert.equal(parent.children[0], child);
  } finally {
    mock.restore();
  }
});

test('el() converts untrusted node children to text content', async () => {
  const mock = installMockDocument();
  try {
    const { el } = await load();
    const externalNode = mock.doc.createElement('strong');
    externalNode.textContent = '<b>unsafe html-ish text</b>';
    const parent = el('div', null, [externalNode]);
    assert.equal(parent.children.length, 1);
    assert.equal(parent.children[0].nodeType, 3);
    assert.equal(parent.children[0].textContent, '<b>unsafe html-ish text</b>');
  } finally {
    mock.restore();
  }
});

test('el() blocks dangerous attributes but allows event listeners', async () => {
  const mock = installMockDocument();
  try {
    const { el } = await load();
    const onClick = () => {};
    const node = el('iframe', {
      onclick: onClick,
      onerror: 'alert(1)',
      srcdoc: '<script>alert(1)</script>',
      href: 'javascript:alert(1)',
      class: 'x',
    });
    assert.equal(node.attrs.href, undefined);
    assert.equal(node.attrs.srcdoc, undefined);
    assert.equal(node.attrs.onerror, undefined);
    assert.equal(node.attrs.onclick, undefined);
    assert.equal(node.className, 'x');
    assert.equal(mock.listeners.length, 1);
    assert.equal(mock.listeners[0][0], 'click');
  } finally {
    mock.restore();
  }
});
