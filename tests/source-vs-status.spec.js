'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

function installDom() {
  global.document = {
    createElement(tag) {
      return {
        tagName: String(tag).toUpperCase(),
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

  const text = JSON.stringify(panel);
  assert.equal(text.includes('Source: Live'), false);
  assert.equal(text.includes('PrimaryProvider'), true);
  delete global.document;
});
