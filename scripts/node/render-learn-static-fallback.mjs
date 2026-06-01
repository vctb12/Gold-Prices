#!/usr/bin/env node
/**
 * Renders English static HTML for learn.html from the shared learn-hub model.
 * Keeps no-JS / first-paint body in sync with src/learn-hub/content-model.js.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LEARN_ARTICLE, resolveLearnHubText } from '../../src/learn-hub/content-model.js';
import { LEARN_GUIDE_CATEGORIES } from '../../src/config/learn-hub-catalog.js';
import { TRANSLATIONS } from '../../src/config/translations.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const LEARN_HTML = path.join(ROOT, 'learn.html');

const MARKER_START = '<!-- LEARN_STATIC_FALLBACK:START -->';
const MARKER_END = '<!-- LEARN_STATIC_FALLBACK:END -->';

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function t(key, replacements = {}) {
  return resolveLearnHubText(key, 'en', replacements);
}

function tx(key, vars = {}) {
  let s = TRANSLATIONS.en[key] ?? key;
  Object.entries(vars).forEach(([k, v]) => {
    s = s.replace(`{${k}}`, String(v));
  });
  return s;
}

function renderRichParts(parts) {
  return (parts ?? [])
    .map((part) => {
      if (!part) return '';
      if (typeof part === 'string') return esc(part);
      if (part.type === 'link') {
        const rel = part.external ? ' rel="noopener noreferrer nofollow"' : '';
        const target = part.external ? ' target="_blank"' : '';
        const text = part.text ?? t(part.key, part.replacements);
        return `<a href="${esc(part.href)}" class="learn-hub-inline-link"${rel}${target}>${esc(text)}</a>`;
      }
      if (part.type === 'code') {
        return `<code class="learn-hub-inline-code">${esc(part.text || '')}</code>`;
      }
      if (part.type === 'strong') {
        const text = part.text ?? t(part.key, part.replacements);
        return `<strong class="learn-hub-inline-strong">${esc(text)}</strong>`;
      }
      if (part.key) return esc(t(part.key, part.replacements));
      return esc(part.text || '');
    })
    .join('');
}

function renderCallout(block) {
  const body = block.richText
    ? renderRichParts(block.richText)
    : esc(t(block.bodyKey, block.replacements));
  const tone = block.tone ? ` learn-callout--${block.tone}` : '';
  return `<div class="learn-hub-callout learn-callout${tone}">
  <strong class="learn-hub-callout-title">${esc(t(block.titleKey))}</strong>
  <p class="learn-hub-callout-body">${body}</p>
</div>`;
}

function renderList(block) {
  const tag = block.style === 'ordered' ? 'ol' : 'ul';
  const items = (block.items ?? [])
    .map((item) => {
      const inner = item.richText
        ? renderRichParts(item.richText)
        : esc(t(item.textKey, item.replacements));
      return `<li class="learn-hub-list-item">${inner}</li>`;
    })
    .join('');
  return `<${tag} class="learn-hub-list learn-hub-list--${block.style || 'unordered'}">${items}</${tag}>`;
}

function renderTable(section) {
  const columns = section.table?.columns ?? [];
  const rows = section.table?.rows ?? [];
  const head = columns
    .map((column) => {
      const label = column.labelKey ? t(column.labelKey) : '';
      const aria = column.ariaLabelKey ? ` aria-label="${esc(t(column.ariaLabelKey))}"` : '';
      return `<th scope="${esc(column.scope || 'col')}"${aria}>${esc(label)}</th>`;
    })
    .join('');
  const body = rows
    .map((row) => {
      const cells = row.cells
        .map((cell) => {
          if (cell.type === 'meter') {
            return `<td><span class="learn-purity-bar"><span class="learn-purity-bar-fill ${esc(cell.className || '')}" style="width:${cell.value}%"></span></span></td>`;
          }
          const text = cell.textKey ? t(cell.textKey) : (cell.value ?? '');
          return `<td>${esc(text)}</td>`;
        })
        .join('');
      return `<tr data-row-id="${esc(row.id)}"><th scope="row"><strong>${esc(row.rowHeader)}</strong></th>${cells}</tr>`;
    })
    .join('');
  return `<div class="learn-hub-table-wrap learn-karat-table-wrap">
  <table class="learn-hub-table learn-karat-table">
    <caption class="visually-hidden">${esc(t(section.table.captionKey))}</caption>
    <thead><tr>${head}</tr></thead>
    <tbody>${body}</tbody>
  </table>
</div>`;
}

function renderFaq(section) {
  const items = (section.faqs ?? [])
    .map(
      (faq) => `<details class="faq-item learn-hub-faq-item"${faq.open ? ' open' : ''} itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
  <summary class="faq-question" itemprop="name">${esc(t(faq.questionKey))}</summary>
  <div class="faq-answer" itemprop="acceptedAnswer" itemscope itemtype="https://schema.org/Answer">
    <p itemprop="text">${esc(t(faq.answerKey))}</p>
  </div>
</details>`
    )
    .join('');
  return `<div class="learn-hub-faq-list" itemscope itemtype="https://schema.org/FAQPage">${items}</div>`;
}

function renderBlocks(section) {
  return (section.blocks ?? [])
    .map((block) => {
      if (block.kind === 'subheading') {
        return `<h3 class="learn-hub-subheading">${esc(t(block.key))}</h3>`;
      }
      if (block.kind === 'paragraph') {
        return `<p class="learn-hub-paragraph">${esc(t(block.key, block.replacements))}</p>`;
      }
      if (block.kind === 'list') return renderList(block);
      if (block.kind === 'callout') return renderCallout(block);
      return '';
    })
    .join('\n');
}

function renderSection(section) {
  const parts = [
    `<article class="learn-hub-section learn-section learn-hub-section--${esc(section.type)}" id="${esc(section.id)}" aria-labelledby="${esc(section.id)}-heading">`,
    `<h2 class="learn-hub-section-title" id="${esc(section.id)}-heading">${esc(t(section.headingKey))}</h2>`,
  ];
  if (section.bodyKey) {
    parts.push(`<p class="learn-hub-section-intro">${esc(t(section.bodyKey))}</p>`);
  }
  if (section.type === 'table' && section.table) parts.push(renderTable(section));
  if (section.type === 'faq') parts.push(renderFaq(section));
  parts.push(renderBlocks(section));
  parts.push('</article>');
  return parts.join('\n');
}

function renderToc(article) {
  const links = (article.tocEntries ?? [])
    .map(
      (entry) =>
        `<li><a class="learn-hub-toc-link" href="#${esc(entry.id)}">${esc(t(entry.labelKey))}</a></li>`
    )
    .join('');
  return `<nav class="learn-hub-toc learn-toc" aria-label="${esc(t('learnHub.ui.sectionNavLabel'))}">
  <p class="learn-hub-toc-label">${esc(t('toc-label'))}</p>
  <ul class="learn-hub-toc-list">${links}</ul>
</nav>`;
}

function renderArticleHeader(article) {
  const meta = [
    `<span class="learn-hub-meta-pill learn-hub-meta-pill--category">${esc(t(article.metadata.categoryKey))}</span>`,
    `<span class="learn-hub-meta-pill learn-hub-meta-pill--read-time">${esc(t('learnHub.ui.readTime', { minutes: article.metadata.readTime }))}</span>`,
    `<span class="learn-hub-meta-pill learn-hub-meta-pill--updated">${esc(t('learnHub.ui.updatedLabel', { date: article.metadata.lastUpdated }))}</span>`,
  ].join('');
  return `<header class="learn-hub-article-header">
  <div class="learn-hub-article-heading">
    <span class="learn-hub-article-icon" aria-label="${esc(t(article.iconLabelKey))}">${article.icon}</span>
    <div class="learn-hub-article-copy">
      <h1 class="learn-hub-article-title">${esc(t(article.titleKey))}</h1>
      <p class="learn-hub-article-subtitle">${esc(t(article.subtitleKey))}</p>
      <div class="learn-hub-article-meta">${meta}</div>
    </div>
  </div>
</header>`;
}

function renderCatalog() {
  const total = LEARN_GUIDE_CATEGORIES.reduce((n, c) => n + c.guides.length, 0);
  const sections = LEARN_GUIDE_CATEGORIES.map((cat) => {
    const cards = cat.guides
      .map(
        (guide) => `<a href="${esc(guide.href)}" class="card card--bordered learn-guide-card card-interactive">
  <div class="learn-guide-card__meta">
    <span class="badge badge--${guide.level === 'beginner' ? 'info' : 'neutral'}">${esc(tx(`learn.level.${guide.level}`))}</span>
    <span class="learn-guide-card__time">${esc(tx('learn.readMin', { n: guide.readMin }))}</span>
  </div>
  <h3 class="learn-guide-card__title">${esc(tx(guide.titleKey))}</h3>
  <p class="learn-guide-card__desc">${esc(tx(guide.descKey))}</p>
</a>`
      )
      .join('');
    return `<section class="learn-hub-category">
  <h2 class="learn-hub-category__title">${esc(tx(cat.titleKey))}</h2>
  <p class="learn-hub-category__desc">${esc(tx(cat.descKey))}</p>
  <div class="learn-hub-grid">${cards}</div>
</section>`;
  }).join('');

  return `<section class="learn-hub-catalog card card--bordered" data-static-fallback="true">
  <p class="learn-hub-progress">${esc(tx('learn.progress', { read: 0, total }))}</p>
  <input type="search" class="learn-hub-filter" placeholder="${esc(tx('learn.filterPlaceholder'))}" aria-label="${esc(tx('learn.filterPlaceholder'))}" disabled aria-disabled="true" />
  <div class="learn-hub-sections">${sections}</div>
  <div class="learn-hub-related-row">
    <a href="methodology.html" class="related-tool-link">${esc(tx('learn.relatedMethod'))}</a>
    <a href="calculator.html" class="related-tool-link">${esc(tx('learn.relatedCalc'))}</a>
  </div>
</section>`;
}

function renderStaticBlock() {
  const article = LEARN_ARTICLE;
  const sections = (article.sections ?? []).map(renderSection).join('\n');
  return `${MARKER_START}
      <div id="learn-catalog-root" class="learn-catalog-wrap" data-static-fallback="true">
        ${renderCatalog()}
      </div>
      <section class="learn-hub-shell" aria-live="polite">
        <div id="learn-toc-root" data-static-fallback="true">${renderToc(article)}</div>
        <div id="learn-article-root" class="learn-body learn-hub-body" data-static-fallback="true">
          <div class="learn-hub-article" data-article-id="${esc(article.id)}" data-locale="en">
            ${renderArticleHeader(article)}
            ${sections}
          </div>
        </div>
      </section>
${MARKER_END}`;
}

function patchLearnHtml() {
  const html = fs.readFileSync(LEARN_HTML, 'utf8');
  const block = renderStaticBlock();
  const re = new RegExp(
    `${MARKER_START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${MARKER_END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`
  );

  let next;
  if (re.test(html)) {
    next = html.replace(re, block.trim());
  } else {
    const shellRe =
      /(<main id="main-content">\s*)(<div id="related-guides-slot">)/;
    if (!shellRe.test(html)) {
      throw new Error('Could not locate learn.html insertion point for static fallback');
    }
    next = html.replace(shellRe, `$1\n      ${block.trim()}\n      $2`);
  }

  fs.writeFileSync(LEARN_HTML, next);
  console.log('Updated learn.html static fallback from learn-hub model.');
}

patchLearnHtml();
