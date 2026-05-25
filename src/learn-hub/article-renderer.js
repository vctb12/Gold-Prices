/**
 * Shared learn-hub article renderer.
 */

import { track, EVENTS } from '../lib/analytics.js';
import { clear, el, escape } from '../lib/safe-dom.js';
import { resolveLearnHubText } from './content-model.js';
import { createTocRenderer } from './toc-renderer.js';

function resolveContainer(container) {
  if (!container) return null;
  if (typeof container === 'string') return document.querySelector(container);
  return container;
}

function formatUpdatedDate(language, value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(language === 'ar' ? 'ar-AE' : 'en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

function renderInlineParts(parts, resolveText) {
  return (parts ?? []).map((part) => {
    if (!part) return '';
    if (typeof part === 'string') return part;
    if (part.type === 'link') {
      const rel = part.external ? 'noopener noreferrer nofollow' : null;
      const target = part.external ? '_blank' : null;
      return el(
        'a',
        {
          href: part.href,
          rel,
          target,
          class: part.className || 'learn-hub-inline-link',
        },
        [part.text ?? resolveText(part.key, part.replacements)]
      );
    }
    if (part.type === 'code') {
      return el('code', { class: part.className || 'learn-hub-inline-code' }, [part.text || '']);
    }
    if (part.type === 'strong') {
      return el('strong', { class: part.className || 'learn-hub-inline-strong' }, [
        part.text ?? resolveText(part.key, part.replacements),
      ]);
    }
    if (part.key) return resolveText(part.key, part.replacements);
    return part.text || '';
  });
}

function renderCallout(block, resolveText) {
  const body = block.richText
    ? renderInlineParts(block.richText, resolveText)
    : [resolveText(block.bodyKey, block.replacements)];

  return el(
    'div',
    {
      class: `learn-hub-callout learn-callout${block.tone ? ` learn-callout--${block.tone}` : ''}`,
    },
    [
      el('strong', { class: 'learn-hub-callout-title' }, [resolveText(block.titleKey)]),
      el('p', { class: 'learn-hub-callout-body' }, body),
    ]
  );
}

function renderList(block, resolveText) {
  const tag = block.style === 'ordered' ? 'ol' : 'ul';
  return el(
    tag,
    { class: `learn-hub-list learn-hub-list--${block.style || 'unordered'}` },
    (block.items ?? []).map((item) =>
      el('li', { class: 'learn-hub-list-item' }, [
        ...(item.richText
          ? renderInlineParts(item.richText, resolveText)
          : [resolveText(item.textKey, item.replacements)]),
      ])
    )
  );
}

function renderTable(section, resolveText) {
  const columns = section.table?.columns ?? [];
  const rows = section.table?.rows ?? [];

  return el('div', { class: 'learn-hub-table-wrap learn-karat-table-wrap' }, [
    el('table', { class: 'learn-hub-table learn-karat-table' }, [
      el('caption', { class: 'visually-hidden' }, [resolveText(section.table.captionKey)]),
      el(
        'thead',
        null,
        el(
          'tr',
          null,
          columns.map((column) =>
            el(
              'th',
              {
                scope: column.scope || 'col',
                'aria-label': column.ariaLabelKey ? resolveText(column.ariaLabelKey) : null,
              },
              [column.labelKey ? resolveText(column.labelKey) : '']
            )
          )
        )
      ),
      el(
        'tbody',
        null,
        rows.map((row) =>
          el('tr', { dataset: { rowId: escape(row.id) } }, [
            el('th', { scope: 'row' }, [el('strong', null, [row.rowHeader])]),
            ...row.cells.map((cell) => {
              if (cell.type === 'meter') {
                return el('td', null, [
                  el('span', { class: 'learn-purity-bar' }, [
                    el('span', {
                      class: `learn-purity-bar-fill ${cell.className || ''}`.trim(),
                      style: { width: `${cell.value}%` },
                    }),
                  ]),
                ]);
              }
              return el('td', null, [
                cell.textKey ? resolveText(cell.textKey) : (cell.value ?? ''),
              ]);
            }),
          ])
        )
      ),
    ]),
  ]);
}

function renderFaq(section, resolveText) {
  return el(
    'div',
    {
      class: 'learn-hub-faq-list',
      itemscope: true,
      itemtype: 'https://schema.org/FAQPage',
    },
    (section.faqs ?? []).map((faq) =>
      el(
        'details',
        {
          class: 'faq-item learn-hub-faq-item',
          open: faq.open === true,
          itemscope: true,
          itemprop: 'mainEntity',
          itemtype: 'https://schema.org/Question',
        },
        [
          el('summary', { class: 'faq-question', itemprop: 'name' }, [
            resolveText(faq.questionKey),
          ]),
          el(
            'div',
            {
              class: 'faq-answer',
              itemprop: 'acceptedAnswer',
              itemscope: true,
              itemtype: 'https://schema.org/Answer',
            },
            [el('p', { itemprop: 'text' }, [resolveText(faq.answerKey)])]
          ),
        ]
      )
    )
  );
}

function renderBlocks(section, resolveText) {
  return (section.blocks ?? []).map((block) => {
    if (block.kind === 'subheading') {
      return el('h3', { class: 'learn-hub-subheading' }, [resolveText(block.key)]);
    }
    if (block.kind === 'paragraph') {
      return el('p', { class: 'learn-hub-paragraph' }, [
        resolveText(block.key, block.replacements),
      ]);
    }
    if (block.kind === 'list') {
      return renderList(block, resolveText);
    }
    if (block.kind === 'callout') {
      return renderCallout(block, resolveText);
    }
    return null;
  });
}

function renderSection(section, resolveText) {
  const children = [
    el('h2', { class: 'learn-hub-section-title', id: `${section.id}-heading` }, [
      resolveText(section.headingKey),
    ]),
    section.bodyKey
      ? el('p', { class: 'learn-hub-section-intro' }, [resolveText(section.bodyKey)])
      : null,
  ];

  if (section.type === 'table' && section.table) {
    children.push(renderTable(section, resolveText));
  }
  if (section.type === 'faq') {
    children.push(renderFaq(section, resolveText));
  }
  children.push(...renderBlocks(section, resolveText));

  return el(
    'article',
    {
      class: `learn-hub-section learn-section learn-hub-section--${section.type}`,
      id: section.id,
      'aria-labelledby': `${section.id}-heading`,
      dataset: { sectionId: escape(section.id) },
    },
    children
  );
}

export function createArticleRenderer({
  article,
  language = 'en',
  articleContainer,
  tocContainer,
  resolveText = resolveLearnHubText,
  onSectionVisible,
} = {}) {
  const contentRoot = resolveContainer(articleContainer);
  const tocRoot = resolveContainer(tocContainer);
  const seenSections = new Set();
  let currentArticle = article;
  let currentLanguage = language;
  let toc = null;

  function t(key, replacements) {
    return resolveText(key, currentLanguage, replacements);
  }

  function emitSectionVisibility(sectionId) {
    const dedupeKey = `${currentArticle?.id || 'article'}:${currentLanguage}:${sectionId}`;
    if (seenSections.has(dedupeKey)) return;
    seenSections.add(dedupeKey);

    track(EVENTS.TOOL_USE, {
      tool: t('learnHub.ui.sectionAnalyticsTool'),
      article_id: currentArticle?.id || '',
      section_id: sectionId,
      locale: currentLanguage,
    });

    if (typeof onSectionVisible === 'function') {
      onSectionVisible({
        articleId: currentArticle?.id || '',
        sectionId,
        language: currentLanguage,
      });
    }
  }

  function renderHeader() {
    const metaParts = [];
    if (currentArticle?.metadata?.categoryKey) {
      metaParts.push(
        el('span', { class: 'learn-hub-meta-pill learn-hub-meta-pill--category' }, [
          t(currentArticle.metadata.categoryKey),
        ])
      );
    }
    if (typeof currentArticle?.metadata?.readTime === 'number') {
      metaParts.push(
        el('span', { class: 'learn-hub-meta-pill learn-hub-meta-pill--read-time' }, [
          t('learnHub.ui.readTime', { minutes: currentArticle.metadata.readTime }),
        ])
      );
    }
    if (currentArticle?.metadata?.lastUpdated) {
      metaParts.push(
        el('span', { class: 'learn-hub-meta-pill learn-hub-meta-pill--updated' }, [
          t('learnHub.ui.updatedLabel', {
            date: formatUpdatedDate(currentLanguage, currentArticle.metadata.lastUpdated),
          }),
        ])
      );
    }

    return el('header', { class: 'learn-hub-article-header' }, [
      el(
        'div',
        {
          class: 'learn-hub-article-icon',
          'aria-label': t(currentArticle?.iconLabelKey || 'learnHub.articles.learn.iconLabel'),
        },
        [currentArticle?.icon || '📄']
      ),
      el('div', { class: 'learn-hub-article-copy' }, [
        el('h1', { class: 'learn-hub-article-title' }, [t(currentArticle.titleKey)]),
        el('p', { class: 'learn-hub-article-subtitle' }, [t(currentArticle.subtitleKey)]),
        el('div', { class: 'learn-hub-article-meta' }, metaParts),
      ]),
    ]);
  }

  function renderContent() {
    if (!contentRoot || !currentArticle) return null;
    clear(contentRoot);
    const wrapper = el(
      'div',
      {
        class: 'learn-hub-article',
        dataset: { articleId: escape(currentArticle.id), locale: currentLanguage },
      },
      [
        renderHeader(),
        ...(currentArticle.sections ?? []).map((section) => renderSection(section, t)),
      ]
    );
    contentRoot.append(wrapper);
    return wrapper;
  }

  function renderToc() {
    if (!tocRoot || !currentArticle) return null;
    if (toc) toc.destroy();
    toc = createTocRenderer({
      container: tocRoot,
      article: currentArticle,
      language: currentLanguage,
      resolveText,
      onSectionChange: emitSectionVisibility,
    });
    return toc.render();
  }

  return {
    render() {
      renderContent();
      renderToc();
    },
    setLanguage(nextLanguage) {
      currentLanguage = nextLanguage === 'ar' ? 'ar' : 'en';
      this.render();
    },
    setArticle(nextArticle) {
      currentArticle = nextArticle;
      seenSections.clear();
      this.render();
    },
    destroy() {
      if (toc) toc.destroy();
      toc = null;
      clear(contentRoot);
      clear(tocRoot);
    },
  };
}

export function renderArticle(options = {}) {
  const renderer = createArticleRenderer(options);
  renderer.render();
  return renderer;
}
