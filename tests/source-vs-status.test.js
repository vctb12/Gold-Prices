'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

function installDom() {
  global.document = {
    createElement(tag) {
      return {
        tagName: String(tag).toUpperCase(),
        nodeType: 1,
        ownerDocument: null,
        children: [],
        textContent: '',
        attributes: new Map(),
        style: {},
        dataset: {},
        setAttribute(k, v) {
          this.attributes.set(k, String(v));
        },
        append(...nodes) {
          this.children.push(...nodes);
        },
      };
    },
    createDocumentFragment() {
      return this.createElement('fragment');
    },
  };
}

function collectText(node) {
  if (typeof node === 'string') return node;
  if (!node || typeof node !== 'object') return '';
  const own = typeof node.textContent === 'string' ? node.textContent : '';
  const children = Array.isArray(node.children) ? node.children.map(collectText).join(' ') : '';
  return `${own} ${children}`.trim();
}

async function loadComponent() {
  const url = new URL(
    'file://' + path.resolve(__dirname, '..', 'src', 'components', 'QuoteMetaPanel.js')
  );
  return import(url.href + `?v=${Date.now()}`);
}

test('quote meta panel keeps status and source as separate fields', async () => {
  installDom();
  const { renderQuoteMetaPanel } = await loadComponent();
  const panel = renderQuoteMetaPanel({
    statusLabel: 'Live',
    sourceLabel: 'PrimaryProvider',
    providerId: 'PrimaryProvider',
  });

  const text = collectText(panel);
  assert.equal(text.includes('Source: Live'), false);
  assert.equal(text.includes('Live'), true);
  assert.equal(text.includes('PrimaryProvider'), true);
  delete global.document;
});
