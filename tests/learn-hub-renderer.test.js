'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

class FakeText {
  constructor(text, ownerDocument) {
    this.nodeType = 3;
    this.ownerDocument = ownerDocument;
    this._text = String(text ?? '');
  }

  get textContent() {
    return this._text;
  }

  set textContent(value) {
    this._text = String(value ?? '');
  }
}

class FakeElement {
  constructor(tag, ownerDocument) {
    this.nodeType = 1;
    this.tagName = String(tag).toUpperCase();
    this.ownerDocument = ownerDocument;
    this.dataset = {};
    this.style = {
      setProperty: (key, value) => {
        this.style[key] = String(value);
      },
    };
    this.className = '';
    this.hidden = false;
    this._attributes = new Map();
    this._children = [];
    this._listeners = new Map();
    this.classList = {
      add: (...tokens) => {
        const classes = new Set(this.className.split(/\s+/).filter(Boolean));
        tokens.forEach((token) => classes.add(token));
        this.className = [...classes].join(' ');
      },
      remove: (...tokens) => {
        const classes = new Set(this.className.split(/\s+/).filter(Boolean));
        tokens.forEach((token) => classes.delete(token));
        this.className = [...classes].join(' ');
      },
      toggle: (token, force) => {
        const classes = new Set(this.className.split(/\s+/).filter(Boolean));
        const shouldAdd = force === undefined ? !classes.has(token) : Boolean(force);
        if (shouldAdd) classes.add(token);
        else classes.delete(token);
        this.className = [...classes].join(' ');
        return shouldAdd;
      },
      contains: (token) => this.className.split(/\s+/).includes(token),
    };
  }

  append(...children) {
    for (const child of children) {
      this._children.push(
        typeof child === 'string' ? new FakeText(child, this.ownerDocument) : child
      );
    }
  }

  appendChild(child) {
    this.append(child);
    return child;
  }

  removeChild(child) {
    const index = this._children.indexOf(child);
    if (index >= 0) this._children.splice(index, 1);
    return child;
  }

  addEventListener(type, handler) {
    this._listeners.set(type, handler);
  }

  dispatchEvent(event) {
    const handler = this._listeners.get(event?.type);
    if (handler) handler(event);
  }

  setAttribute(name, value) {
    this._attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this._attributes.has(name) ? this._attributes.get(name) : null;
  }

  removeAttribute(name) {
    this._attributes.delete(name);
  }

  get firstChild() {
    return this._children[0] || null;
  }

  get children() {
    return this._children.filter((child) => child?.nodeType === 1);
  }

  get textContent() {
    return this._children.map((child) => child?.textContent ?? '').join('');
  }

  set textContent(value) {
    this._children = [new FakeText(value, this.ownerDocument)];
  }
}

function installDom() {
  const document = {
    createElement(tag) {
      return new FakeElement(tag, document);
    },
    createTextNode(text) {
      return new FakeText(text, document);
    },
    querySelector() {
      return null;
    },
    getElementById() {
      return null;
    },
  };

  global.document = document;

  return {
    document,
    restore() {
      delete global.document;
    },
  };
}

function findAll(node, predicate, matches = []) {
  if (!node) return matches;
  if (predicate(node)) matches.push(node);
  for (const child of node.children ?? []) findAll(child, predicate, matches);
  return matches;
}

function findByClass(node, className) {
  return findAll(node, (child) => child.classList?.contains(className))[0] || null;
}

function findByTag(node, tagName) {
  return findAll(node, (child) => child.tagName === tagName.toUpperCase())[0] || null;
}

function makeArticle() {
  return {
    id: 'coverage-article',
    titleKey: 'article.title',
    subtitleKey: 'article.subtitle',
    icon: 'G',
    iconLabelKey: 'article.icon',
    metadata: {
      categoryKey: 'article.category',
      readTime: 3,
      lastUpdated: '2026-05-25',
    },
    tocEntries: [
      { id: 'karats', labelKey: 'toc.karats' },
      { id: 'pricing', labelKey: 'toc.pricing' },
    ],
    sections: [
      {
        id: 'karats',
        headingKey: 'karats.heading',
        type: 'table',
        table: {
          captionKey: 'karats.caption',
          columns: [
            { labelKey: 'table.karat' },
            { labelKey: 'table.purity' },
            { ariaLabelKey: 'table.visual' },
          ],
          rows: [
            {
              id: '24k',
              rowHeader: '24K',
              cells: [
                { value: '99.9%' },
                { type: 'meter', value: 99.9, className: 'meter-24k' },
              ],
            },
          ],
        },
      },
      {
        id: 'pricing',
        headingKey: 'pricing.heading',
        bodyKey: 'pricing.body',
        type: 'prose',
        blocks: [
          {
            kind: 'callout',
            titleKey: 'pricing.callout.title',
            richText: [
              { key: 'pricing.callout.lead' },
              {
                type: 'link',
                href: 'https://gold-api.com',
                text: 'gold-api.com',
                external: true,
              },
              { type: 'code', text: 'data/gold_price.json' },
              { type: 'link', href: 'javascript:alert(1)', text: 'unsafe link' },
            ],
          },
          {
            kind: 'list',
            style: 'ordered',
            items: [{ textKey: 'pricing.item' }],
          },
        ],
      },
    ],
  };
}

function resolveText(key, language, replacements = {}) {
  const copy = {
    en: {
      'article.title': 'Gold learning coverage',
      'article.subtitle': 'How the renderer builds buyer education pages',
      'article.icon': 'Gold article',
      'article.category': 'Learn Hub',
      'learnHub.ui.readTime': '{minutes} min read',
      'learnHub.ui.updatedLabel': 'Updated {date}',
      'learnHub.ui.sectionNavLabel': 'Article sections',
      'learnHub.ui.tocToggleOpen': 'Show contents',
      'learnHub.ui.tocToggleClose': 'Hide contents',
      'toc-label': 'Contents',
      'toc.karats': 'Karats',
      'toc.pricing': 'Pricing',
      'karats.heading': 'Gold karats',
      'karats.caption': 'Karat comparison',
      'table.karat': 'Karat',
      'table.purity': 'Purity',
      'table.visual': 'Purity visual',
      'pricing.heading': 'Pricing',
      'pricing.body': 'Reference prices are not retail quotes.',
      'pricing.callout.title': 'Source integrity',
      'pricing.callout.lead': 'Spot source: ',
      'pricing.item': 'Use direct FX for local currencies.',
    },
    ar: {
      'article.title': 'تغطية تعليم الذهب',
      'article.subtitle': 'كيف يبني العارض صفحات التوعية',
      'article.icon': 'مقال الذهب',
      'article.category': 'مركز التعلم',
      'learnHub.ui.readTime': '{minutes} دقائق قراءة',
      'learnHub.ui.updatedLabel': 'تحديث {date}',
      'learnHub.ui.sectionNavLabel': 'أقسام المقال',
      'learnHub.ui.tocToggleOpen': 'إظهار المحتويات',
      'learnHub.ui.tocToggleClose': 'إخفاء المحتويات',
      'toc-label': 'المحتويات',
      'toc.karats': 'العيارات',
      'toc.pricing': 'التسعير',
      'karats.heading': 'عيارات الذهب',
      'karats.caption': 'مقارنة العيارات',
      'table.karat': 'العيار',
      'table.purity': 'النقاء',
      'table.visual': 'مؤشر النقاء',
      'pricing.heading': 'التسعير',
      'pricing.body': 'الأسعار المرجعية ليست عروض تجزئة.',
      'pricing.callout.title': 'سلامة المصدر',
      'pricing.callout.lead': 'مصدر السعر الفوري: ',
      'pricing.item': 'استخدم سعر الصرف المباشر للعملات المحلية.',
    },
  };
  const template = copy[language]?.[key] ?? copy.en[key] ?? key;
  return template.replace(/\{(\w+)\}/g, (_, token) => String(replacements[token] ?? ''));
}

async function loadRenderer() {
  const url = new URL(
    'file://' + path.resolve(__dirname, '..', 'src', 'learn-hub', 'article-renderer.js')
  );
  return import(url.href + `?v=${Date.now()}`);
}

test('learn hub renderer builds structured sections and safe inline links', async () => {
  const dom = installDom();
  const { renderArticle } = await loadRenderer();
  const articleContainer = dom.document.createElement('main');
  const tocContainer = dom.document.createElement('aside');

  renderArticle({
    article: makeArticle(),
    articleContainer,
    tocContainer,
    resolveText,
  });

  const wrapper = articleContainer.children[0];
  assert.equal(wrapper.dataset.articleId, 'coverage-article');
  assert.equal(wrapper.dataset.locale, 'en');
  assert.equal(findByTag(wrapper, 'h1').textContent, 'Gold learning coverage');

  const row = findAll(wrapper, (node) => node.tagName === 'TR' && node.dataset.rowId)[0];
  assert.equal(row.dataset.rowId, '24k');
  assert.equal(findByClass(wrapper, 'meter-24k').style.width, '99.9%');

  const links = findAll(wrapper, (node) => node.tagName === 'A');
  assert.equal(links[0].getAttribute('href'), 'https://gold-api.com');
  assert.equal(links[0].getAttribute('target'), '_blank');
  assert.equal(links[0].getAttribute('rel'), 'noopener noreferrer nofollow');
  assert.equal(links[1].textContent, 'unsafe link');
  assert.equal(links[1].getAttribute('href'), null);

  const tocLinks = findAll(tocContainer, (node) => node.classList?.contains('learn-hub-toc-link'));
  assert.equal(tocLinks.length, 2);
  assert.equal(tocLinks[0].getAttribute('href'), '#karats');
  assert.equal(tocLinks[0].getAttribute('aria-current'), 'location');

  dom.restore();
});

test('learn hub renderer re-renders language changes without duplicate articles', async () => {
  const dom = installDom();
  const { renderArticle } = await loadRenderer();
  const articleContainer = dom.document.createElement('main');
  const tocContainer = dom.document.createElement('aside');

  const renderer = renderArticle({
    article: makeArticle(),
    articleContainer,
    tocContainer,
    resolveText,
  });

  renderer.setLanguage('ar');

  assert.equal(articleContainer.children.length, 1);
  assert.equal(articleContainer.children[0].dataset.locale, 'ar');
  assert.equal(findByTag(articleContainer, 'h1').textContent, 'تغطية تعليم الذهب');
  assert.equal(findByClass(tocContainer, 'learn-hub-toc-label').textContent, 'المحتويات');

  renderer.destroy();
  assert.equal(articleContainer.children.length, 0);
  assert.equal(tocContainer.children.length, 0);

  dom.restore();
});
