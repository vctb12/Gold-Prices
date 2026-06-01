/**
 * Shared learn-hub table-of-contents renderer with scroll-spy behavior.
 */

import { clear, el, escape } from '../lib/safe-dom.js';
import { resolveLearnHubText } from './content-model.js';

function resolveContainer(container) {
  if (!container) return null;
  if (typeof container === 'string') return document.querySelector(container);
  return container;
}

function buildEntries(article) {
  if (Array.isArray(article?.tocEntries) && article.tocEntries.length) return article.tocEntries;
  return (article?.sections ?? []).map((section) => ({
    id: section.id,
    labelKey: section.headingKey,
  }));
}

export function createTocRenderer({
  container,
  article,
  language = 'en',
  resolveText = resolveLearnHubText,
  navLabelKey = 'learnHub.ui.sectionNavLabel',
  tocLabelKey = 'toc-label',
  onSectionChange,
  collapseOnMobile = true,
} = {}) {
  const root = resolveContainer(container);
  const sectionIds = (article?.sections ?? []).map((section) => section.id);
  const linkMap = new Map();
  let observer = null;
  let currentLanguage = language;
  let isCollapsed = false;
  let listNode = null;
  let toggleLabelNode = null;
  let toggleButton = null;
  let activeId = '';

  function t(key, replacements) {
    return resolveText(key, currentLanguage, replacements);
  }

  function setActive(nextId, { notify = true } = {}) {
    if (!nextId || nextId === activeId) return;
    activeId = nextId;
    linkMap.forEach((link, id) => {
      const isActive = id === nextId;
      link.classList.toggle('is-active', isActive);
      if (isActive) {
        link.setAttribute('aria-current', 'location');
      } else {
        link.removeAttribute('aria-current');
      }
    });
    if (notify && typeof onSectionChange === 'function') onSectionChange(nextId);
  }

  function updateToggleCopy() {
    if (!toggleLabelNode || !toggleButton) return;
    toggleLabelNode.textContent = isCollapsed
      ? t('learnHub.ui.tocToggleOpen')
      : t('learnHub.ui.tocToggleClose');
    toggleButton.setAttribute('aria-expanded', String(!isCollapsed));
    if (listNode) listNode.hidden = isCollapsed;
  }

  function observeSections() {
    if (observer) observer.disconnect();
    if (typeof IntersectionObserver === 'undefined' || !sectionIds.length) return;

    observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible.length) {
          setActive(visible[0].target.id);
          return;
        }

        const fallback = entries
          .filter((entry) => entry.boundingClientRect.top <= 0)
          .sort((a, b) => b.boundingClientRect.top - a.boundingClientRect.top)[0];
        if (fallback) setActive(fallback.target.id);
      },
      { rootMargin: '-20% 0px -65% 0px', threshold: [0, 0.2, 0.4, 0.6] }
    );

    sectionIds.forEach((id) => {
      const target = document.getElementById(id);
      if (target) observer.observe(target);
    });
  }

  function render() {
    if (!root || !article) return null;
    clear(root);
    linkMap.clear();

    const listId = `learn-hub-toc-${escape(article.id)}`;
    toggleLabelNode = el('span', { class: 'learn-hub-toc-toggle-copy' }, []);
    toggleButton = el(
      'button',
      {
        type: 'button',
        class: 'learn-hub-toc-toggle',
        'aria-controls': listId,
        'aria-expanded': 'true',
        onclick: () => {
          isCollapsed = !isCollapsed;
          updateToggleCopy();
        },
      },
      [toggleLabelNode]
    );

    const listItems = buildEntries(article).map((entry) => {
      const link = el(
        'a',
        {
          href: `#${entry.id}`,
          class: 'learn-hub-toc-link',
          dataset: { tocId: escape(entry.id) },
        },
        [t(entry.labelKey)]
      );
      linkMap.set(entry.id, link);
      return el('li', { class: 'learn-hub-toc-item' }, [link]);
    });

    listNode = el(
      'ul',
      {
        class: 'learn-hub-toc-list learn-toc-list',
        id: listId,
      },
      listItems
    );

    const wrapper = el(
      'nav',
      {
        class: 'learn-hub-toc learn-toc',
        'aria-label': t(navLabelKey),
        dataset: { articleId: escape(article.id) },
      },
      [
        el('div', { class: 'learn-hub-toc-inner learn-toc-inner' }, [
          el('div', { class: 'learn-hub-toc-header' }, [
            el('span', { class: 'learn-hub-toc-label learn-toc-label' }, [t(tocLabelKey)]),
            collapseOnMobile ? toggleButton : null,
          ]),
          listNode,
        ]),
      ]
    );

    root.append(wrapper);
    isCollapsed = false;
    updateToggleCopy();
    observeSections();

    const firstId = buildEntries(article)[0]?.id;
    if (firstId) {
      linkMap.forEach((link, id) => {
        const isActive = id === firstId;
        link.classList.toggle('is-active', isActive);
        if (isActive) {
          link.setAttribute('aria-current', 'location');
        } else {
          link.removeAttribute('aria-current');
        }
      });
    }
    return wrapper;
  }

  function enhanceStatic() {
    if (!root || !article) return null;
    linkMap.clear();
    root.querySelectorAll('a.learn-hub-toc-link[href^="#"]').forEach((link) => {
      const href = link.getAttribute('href') || '';
      const id = decodeURIComponent(href.slice(1));
      if (!id) return;
      linkMap.set(id, link);
    });
    observeSections();
    const firstId = buildEntries(article)[0]?.id;
    if (firstId) setActive(firstId, { notify: false });
    return root;
  }

  return {
    render,
    enhanceStatic,
    setLanguage(nextLanguage) {
      currentLanguage = nextLanguage === 'ar' ? 'ar' : 'en';
      render();
    },
    destroy() {
      if (observer) observer.disconnect();
      observer = null;
      clear(root);
    },
  };
}

export function renderToc(options = {}) {
  const instance = createTocRenderer(options);
  instance.render();
  return instance;
}
