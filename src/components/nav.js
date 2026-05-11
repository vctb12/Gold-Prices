/**
 * components/nav.js — Shared navigation component.
 * Premium bilingual (EN/AR) nav with desktop dropdowns and mobile off-canvas drawer.
 *
 * API:
 *   const ctrl = injectNav(lang = 'en', depth = 0)
 *   ctrl.getLangToggleButtons() → HTMLButtonElement[]
 *
 *   updateNavLang(lang)   — live language switch without re-inject
 *
 * @param {'en'|'ar'} lang
 * @param {number}   depth  Number of directory levels from the site root (0 = root pages, 1 = /countries/, 2 = /content/guides/, etc.)
 */

import { NAV_DATA, PAGE_SHELLS } from './nav-data.js';
import { applyFeatureFlags } from '../lib/site-settings.js';
import { track, EVENTS } from '../lib/analytics.js';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Escape a string for safe inclusion in HTML. */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Resolve href depth: strip leading `../` then prepend the correct number
 * of `../` segments for the page's actual depth from the site root.
 *
 * Hardened behaviour:
 *   - Empty / non-string inputs return '#' (safe no-op anchor).
 *   - Absolute paths (`/foo`), full URLs (`https://…`), `mailto:`, `tel:`,
 *     and protocol-relative (`//host/…`) are returned unchanged.
 *   - Hash-only (`#anchor`) and query-only (`?k=v`) inputs return unchanged.
 *
 * @param {string} href  — href from NAV_DATA (`/foo`, `./foo`, `../foo`, `foo`)
 * @param {number} depth — 0 = root, 1 = one dir deep, 2 = two dirs deep, etc.
 */
function resolveHref(href, depth) {
  if (typeof href !== 'string' || href === '') return '#';

  // Full URLs and non-http schemes pass through untouched.
  if (
    href.startsWith('/') ||
    href.startsWith('//') ||
    href.startsWith('#') ||
    href.startsWith('?') ||
    /^[a-z][a-z0-9+.-]*:/i.test(href)
  ) {
    return href;
  }

  const d = Math.max(0, Number.isFinite(depth) ? Math.floor(depth) : 0);

  if (href.startsWith('./')) {
    const stripped = href.replace(/^\.\//, '');
    return d === 0 ? stripped : '../'.repeat(d) + stripped;
  }

  // '../foo' — strip exactly one '../' segment (NAV_DATA convention), then re-prepend for depth.
  const stripped = href.replace(/^\.\.\//, '');
  return d === 0 ? stripped : '../'.repeat(d) + stripped;
}

/**
 * Return true if the given href's base path matches the current page URL.
 * Hash anchors on the same file count as a match for the base file.
 *
 * Hardened behaviour:
 *   - Non-string or empty hrefs never match.
 *   - Hash-only / query-only hrefs never match (they're same-page fragments).
 *   - External (full-URL, protocol-relative, mailto:, tel:) hrefs never match.
 *   - Root `/` only matches the exact homepage, never every page.
 *   - Directory matches (cmp ending in `/`) use startsWith; file matches require equality.
 */
function isPageMatch(href) {
  if (typeof href !== 'string' || href === '') return false;
  if (href.startsWith('#') || href.startsWith('?')) return false;
  if (href.startsWith('//') || /^[a-z][a-z0-9+.-]*:\/\//i.test(href)) return false;
  if (href.startsWith('mailto:') || href.startsWith('tel:')) return false;

  const loc = location.pathname || '/';
  const base = href.split('#')[0].split('?')[0];
  if (!base) return false;

  // Normalize to a root-absolute path.
  let norm = base.replace(/^\.\.\//, '').replace(/^\.\//, '');
  if (!norm.startsWith('/')) norm = '/' + norm;

  // Treat `/index.html` and `/` as equivalent for the homepage case.
  const cmp = norm.replace(/\/index\.html$/, '/');

  // Exact match is the primary case. Root (`/`) only matches the exact homepage.
  if (cmp === '/') return loc === '/' || loc === '/index.html';
  if (loc === cmp) return true;

  // Directory-style hrefs (trailing slash) match any page inside that directory.
  if (cmp.endsWith('/') && loc.startsWith(cmp)) return true;

  return false;
}

/** True if any item in the group matches the current page. */
function groupIsActive(items) {
  return items.some((item) => isPageMatch(item.href));
}

function getPageShell() {
  const path = location.pathname || '/';
  return (
    PAGE_SHELLS.find((shell) =>
      shell.patterns.some((pattern) => {
        if (pattern === '/') return path === '/' || path === '/index.html';
        return pattern.endsWith('/') ? path.startsWith(pattern) : path === pattern;
      })
    ) || PAGE_SHELLS.find((shell) => shell.page === 'content')
  );
}

function applyPageShell(navEl) {
  const shell = getPageShell();
  if (!shell || !document.body) return;

  if (!document.body.dataset.page) document.body.dataset.page = shell.page;
  if (!document.body.dataset.section) document.body.dataset.section = shell.section;
  if (!document.body.dataset.shell) document.body.dataset.shell = shell.shell;
  if (!document.body.dataset.accent) document.body.dataset.accent = shell.accent;

  if (navEl) {
    navEl.dataset.page = document.body.dataset.page;
    navEl.dataset.section = document.body.dataset.section;
    navEl.dataset.shell = document.body.dataset.shell;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HTML builders
// ─────────────────────────────────────────────────────────────────────────────

function buildDropdown(group, depth) {
  const active = groupIsActive(group.items);
  const layout = group.layout || 'mega';

  const buildItem = (item) => {
    const href = resolveHref(item.href, depth);
    const isActive = isPageMatch(href);
    const classes = ['nav-dropdown-item'];
    if (isActive) classes.push('nav-dropdown-item--active');
    if (item.primary) classes.push('nav-dropdown-item--primary');
    const ariaCurrent = isActive ? ' aria-current="page"' : '';
    const iconHtml = item.icon
      ? `<span class="nav-dropdown-item-icon" aria-hidden="true">${escapeHtml(item.icon)}</span>`
      : '';
    const descHtml = item.description
      ? `<span class="nav-dropdown-item-desc">${escapeHtml(item.description)}</span>`
      : '';
    return `<a href="${href}" class="${classes.join(' ')}"${ariaCurrent} role="menuitem">
        ${iconHtml}
        <span class="nav-dropdown-item-body">
          <span class="nav-dropdown-item-label">${escapeHtml(item.label)}</span>
          ${descHtml}
        </span>
      </a>`;
  };

  const featuredHtml = group.featured
    ? `<a href="${resolveHref(group.featured.href, depth)}" class="nav-dropdown-featured" role="menuitem">
        <span class="nav-dropdown-featured-icon" aria-hidden="true">${escapeHtml(group.featured.icon || '')}</span>
        <span class="nav-dropdown-featured-body">
          <span class="nav-dropdown-featured-label">${escapeHtml(group.featured.label)}</span>
          <span class="nav-dropdown-featured-desc">${escapeHtml(group.featured.description)}</span>
        </span>
      </a>`
    : '';

  // Fallback keeps legacy flat groups renderable if a future partial nav-data migration omits sections.
  const sectionsHtml = (
    group.sections || [{ key: 'links', label: group.label, items: group.items }]
  )
    .map((section) => {
      const descHtml = section.description
        ? `<span class="nav-dropdown-section-desc">${escapeHtml(section.description)}</span>`
        : '';
      return `<section class="nav-dropdown-section" aria-labelledby="nav-${escapeHtml(group.key)}-${escapeHtml(section.key)}">
        <div class="nav-dropdown-section-head">
          <span id="nav-${escapeHtml(group.key)}-${escapeHtml(section.key)}" class="nav-dropdown-section-title">${escapeHtml(section.label)}</span>
          ${descHtml}
        </div>
        <div class="nav-dropdown-section-items">
          ${section.items.map(buildItem).join('')}
        </div>
      </section>`;
    })
    .join('');

  const ctaHtml = group.cta
    ? `<a href="${resolveHref(group.cta.href, depth)}" class="nav-dropdown-cta" role="menuitem">
        <span class="nav-dropdown-cta-text">
          <span class="nav-dropdown-cta-label">${escapeHtml(group.cta.label)}</span>
          <span class="nav-dropdown-cta-desc">${escapeHtml(group.cta.description)}</span>
        </span>
        <span class="nav-dropdown-cta-arrow" aria-hidden="true">→</span>
      </a>`
    : '';

  const btnClass = 'nav-dropdown-btn' + (active ? ' nav-dropdown-btn--active' : '');

  return `
    <div class="nav-dropdown" data-group="${group.key}" data-layout="${layout}"${active ? ' data-active="true"' : ''}>
      <button class="${btnClass}"
              type="button"
              aria-haspopup="true"
              aria-expanded="false"
              data-group="${group.key}"
      >${escapeHtml(group.label)}<span class="nav-dropdown-caret" aria-hidden="true"></span></button>
       <div class="nav-dropdown-panel" role="menu" aria-label="${escapeHtml(group.label)}" data-layout="${layout}">
         <div class="nav-dropdown-panel-header">
           ${group.eyebrow ? `<span class="nav-dropdown-panel-kicker">${escapeHtml(group.eyebrow)}</span>` : ''}
           <span class="nav-dropdown-panel-title">${escapeHtml(group.label)}</span>
           ${group.description ? `<span class="nav-dropdown-panel-desc">${escapeHtml(group.description)}</span>` : ''}
         </div>
         <div class="nav-dropdown-panel-body">
           <div class="nav-dropdown-panel-aside">
             ${featuredHtml}
             ${ctaHtml}
           </div>
           <div class="nav-dropdown-panel-sections">
             ${sectionsHtml}
           </div>
         </div>
       </div>
     </div>`;
}

function buildPrimaryLink(item, depth) {
  const href = resolveHref(item.href, depth);
  const isActive = isPageMatch(href);
  const classes = ['nav-link'];
  if (isActive) classes.push('nav-link--active');
  const ariaCurrent = isActive ? ' aria-current="page"' : '';
  return `<a href="${href}"
     class="${classes.join(' ')}"
     role="listitem"
     data-nav-primary="${escapeHtml(item.key)}"
     ${ariaCurrent}
  >${escapeHtml(item.label)}</a>`;
}

function buildDrawerPrimaryLink(item, depth) {
  const href = resolveHref(item.href, depth);
  const isActive = isPageMatch(href);
  const classes = ['nav-drawer-link'];
  if (isActive) classes.push('nav-link--active');
  if (item.primary) classes.push('nav-drawer-link--primary');
  const ariaCurrent = isActive ? ' aria-current="page"' : '';
  const iconHtml = item.icon
    ? `<span class="nav-drawer-link-icon" aria-hidden="true">${escapeHtml(item.icon)}</span>`
    : '';
  return `<a href="${href}"
     class="${classes.join(' ')}"
     data-nav-primary="${escapeHtml(item.key)}"
     ${ariaCurrent}
  >${iconHtml}<span class="nav-drawer-link-label">${escapeHtml(item.label)}</span></a>`;
}

function buildDrawerGroup(group, depth) {
  const buildDrawerItem = (item) => {
    const href = resolveHref(item.href, depth);
    const isActive = isPageMatch(href);
    const classes = ['nav-drawer-link'];
    if (isActive) classes.push('nav-link--active');
    if (item.primary) classes.push('nav-drawer-link--primary');
    const ariaCurrent = isActive ? ' aria-current="page"' : '';
    const iconHtml = item.icon
      ? `<span class="nav-drawer-link-icon" aria-hidden="true">${escapeHtml(item.icon)}</span>`
      : '';
    const descHtml = item.description
      ? `<span class="nav-drawer-link-desc">${escapeHtml(item.description)}</span>`
      : '';
    return `<a href="${href}" class="${classes.join(' ')}"${ariaCurrent}>
        ${iconHtml}<span class="nav-drawer-link-body"><span class="nav-drawer-link-label">${escapeHtml(item.label)}</span>${descHtml}</span>
      </a>`;
  };

  const itemsHtml = (group.sections || [{ key: 'links', items: group.items }])
    .map(
      (section) => `<div class="nav-drawer-section">
        <span class="nav-drawer-section-label">${escapeHtml(section.label)}</span>
        ${section.items.map(buildDrawerItem).join('')}
      </div>`
    )
    .join('');

  const active = groupIsActive(group.items);

  return `
    <details class="nav-drawer-group" ${active || group.key === 'prices' ? 'open' : ''}>
      <summary class="nav-drawer-group-label">
        <span class="nav-drawer-group-copy">
          <span>${escapeHtml(group.label)}</span>
          <small>${escapeHtml(group.description)}</small>
        </span>
        <span class="nav-drawer-group-caret" aria-hidden="true"></span>
      </summary>
      <div class="nav-drawer-group-items">
        ${itemsHtml}
      </div>
    </details>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// injectNav
// ─────────────────────────────────────────────────────────────────────────────

export function injectNav(lang = 'en', depth = 0) {
  // Guard against double-injection
  if (document.querySelector('.site-nav')) {
    _currentLang = lang;
    return _buildReturnValue();
  }

  _currentLang = lang;

  const data = NAV_DATA[lang] || NAV_DATA.en;
  const isRtl = lang === 'ar';
  const homeHref = resolveHref(data.home.href, depth);
  const primaryLinks = Array.isArray(data.primaryLinks)
    ? data.primaryLinks
    : [data.home, data.shops].filter(Boolean);

  const desktopPrimaryLinksHtml = primaryLinks
    .map((item) => buildPrimaryLink(item, depth))
    .join('');
  const desktopDropdownsHtml = data.groups.map((g) => buildDropdown(g, depth)).join('');
  const mobilePrimaryLinksHtml = primaryLinks
    .map((item) => buildDrawerPrimaryLink(item, depth))
    .join('');
  const mobileGroupsHtml = data.groups.map((g) => buildDrawerGroup(g, depth)).join('');

  const html = `
<a class="nav-skip-link" href="#main-content">${lang === 'ar' ? 'تخطي إلى المحتوى' : 'Skip to main content'}</a>
<nav class="site-nav" role="navigation" aria-label="${data.mainNav}" dir="${isRtl ? 'rtl' : 'ltr'}">
  <div class="nav-inner">

    <!-- Brand -->
    <a href="${homeHref}" class="nav-brand" aria-label="${escapeHtml(data.brandLabel || 'Gold Ticker Live Home')}">
      <span class="nav-brand-icon" aria-hidden="true">◈</span>
      <span class="nav-brand-text">Gold Ticker Live</span>
    </a>

    <!-- Desktop links -->
    <div class="nav-links" role="list">
      ${desktopPrimaryLinksHtml}
      ${desktopDropdownsHtml}
    </div>

    <!-- Right-side actions -->
    <div class="nav-actions">
      <button id="nav-search-btn"
              class="nav-icon-btn"
              type="button"
              aria-label="Search"
              aria-expanded="false"
              aria-controls="nav-search-overlay"
      >🔍</button>

      <button id="nav-theme-toggle"
              class="nav-icon-btn nav-icon-btn--theme"
              type="button"
              aria-label="Theme: auto"
              title="Theme: auto"
              data-theme-mode="auto"
      >🌓</button>

      <button id="nav-lang-toggle"
              class="nav-lang-btn"
              type="button"
              aria-label="Toggle language"
      >${data.langToggle}</button>

      <a id="nav-cta-tracker"
         href="${resolveHref('/tracker.html', depth)}"
         class="nav-cta"
         aria-label="${escapeHtml(data.ctaLabel || 'Live Tracker')}"
      >${escapeHtml(data.ctaLabel || 'Live Tracker')}</a>

      <button id="nav-hamburger"
              class="nav-hamburger"
              type="button"
              aria-label="${data.openMenu}"
              aria-expanded="false"
              aria-controls="nav-drawer"
      >
        <span></span><span></span><span></span>
      </button>
    </div>

  </div>

  <!-- Search overlay -->
  <div id="nav-search-overlay" class="nav-search-overlay" hidden>
    <input id="nav-search-input" class="nav-search-input" type="search"
      placeholder="Search countries, cities, karats..." autocomplete="off"
      aria-label="Search" />
    <div id="nav-search-dropdown" class="nav-search-dropdown" role="listbox"></div>
  </div>

  <div id="nav-drawer"
       class="nav-drawer"
       role="dialog"
       aria-modal="true"
       aria-label="${data.mainNav}"
       aria-hidden="true"
  >
    <div class="nav-drawer-inner">
      <button id="nav-drawer-close"
              class="nav-drawer-close"
              type="button"
              aria-label="${escapeHtml(data.closeMenu)}"
      >
        <span aria-hidden="true">✕</span>
        <span>${escapeHtml(data.closeMenu)}</span>
      </button>

      <!-- Drawer search (progressive enhancement) -->
      <div class="nav-drawer-search">
        <input id="nav-drawer-search-input"
               class="nav-drawer-search-input"
               type="search"
               placeholder="${escapeHtml(data.drawerSearchPlaceholder || 'Search…')}"
               autocomplete="off"
               aria-label="${escapeHtml(data.drawerSearchPlaceholder || 'Search')}"
        />
      </div>

      <!-- Primary journeys -->
      ${mobilePrimaryLinksHtml}

      <!-- Grouped sections -->
      ${mobileGroupsHtml}

      <!-- Bottom cluster: theme toggle + language switcher + CTA -->
      <div class="nav-drawer-bottom">
        <button id="nav-theme-toggle-drawer"
                class="nav-icon-btn nav-icon-btn--theme"
                type="button"
                aria-label="Theme: auto"
                title="Theme: auto"
                data-theme-mode="auto"
        >🌓</button>
        <button id="nav-lang-toggle-mobile"
                class="nav-lang-btn nav-lang-btn--drawer"
                type="button"
                aria-label="Toggle language"
        >${data.langToggle}</button>
        <a id="nav-drawer-cta"
           href="${resolveHref('/tracker.html', depth)}"
           class="nav-drawer-cta"
        >${escapeHtml(data.drawerCtaLabel || 'Live Tracker →')}</a>
      </div>
    </div>
  </div>

  <!-- Backdrop -->
  <div id="nav-backdrop" class="nav-backdrop" aria-hidden="true"></div>
</nav>`;

  // Mount nav before the first child of body (or before <main>)
  const wrapper = document.createElement('div');
  wrapper.innerHTML = html.trim();
  // Move every rendered top-level node (skip link + nav) before the anchor, in order.
  const nodes = Array.from(wrapper.children);
  const anchor = document.querySelector('main') || document.body.firstElementChild;
  for (const n of nodes) document.body.insertBefore(n, anchor);
  const navEl =
    nodes.find((n) => n.matches && n.matches('nav.site-nav')) || nodes[nodes.length - 1];
  applyPageShell(navEl);

  // Skip-link fallback: if #main-content is missing, focus <main> directly.
  const skipLink = nodes.find((n) => n.matches && n.matches('.nav-skip-link'));
  if (skipLink) {
    skipLink.addEventListener('click', (e) => {
      const target = document.getElementById('main-content') || document.querySelector('main');
      if (!target) return;
      if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
      e.preventDefault();
      target.focus();
      target.scrollIntoView({ block: 'start' });
    });
  }

  // ── Mobile bottom navigation bar ──────────────────────────────────────────
  _injectMobileBottomNav(lang, depth);

  // ── Scroll state: is-scrolled + hide/reveal on scroll (Track B §5.B.7) ───
  _initNavScrollBehavior(navEl);

  // ── Theme (auto/light/dark) tri-state toggle ─────────────────────────────
  const themeBtn = document.getElementById('nav-theme-toggle');
  if (themeBtn) {
    const THEME_CYCLE = ['auto', 'light', 'dark'];
    const THEME_ICON = { auto: '🌓', light: '☀️', dark: '🌙' };
    const mql =
      typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-color-scheme: dark)')
        : null;

    function _getThemeLabels() {
      const d = NAV_DATA[_currentLang] || NAV_DATA.en;
      return (
        d.themeLabels || {
          auto: 'Theme: auto (click to switch to light)',
          light: 'Theme: light (click to switch to dark)',
          dark: 'Theme: dark (click to switch to auto)',
        }
      );
    }

    function _resolvedTheme(mode) {
      if (mode === 'light' || mode === 'dark') return mode;
      return mql && mql.matches ? 'dark' : 'light';
    }

    function _applyTheme(mode) {
      const resolved = _resolvedTheme(mode);
      const THEME_LABEL = _getThemeLabels();
      document.documentElement.setAttribute('data-theme', resolved);
      document.documentElement.setAttribute('data-theme-mode', mode);
      const icon = THEME_ICON[mode] || THEME_ICON.auto;
      const label = THEME_LABEL[mode] || THEME_LABEL.auto;
      themeBtn.textContent = icon;
      themeBtn.setAttribute('aria-label', label);
      themeBtn.setAttribute('title', label);
      themeBtn.setAttribute('data-theme-mode', mode);
      // Sync the drawer theme button if present
      const drawerBtn = document.getElementById('nav-theme-toggle-drawer');
      if (drawerBtn) {
        drawerBtn.textContent = icon;
        drawerBtn.setAttribute('aria-label', label);
        drawerBtn.setAttribute('title', label);
        drawerBtn.setAttribute('data-theme-mode', mode);
      }
    }

    function _currentMode() {
      const m = themeBtn.getAttribute('data-theme-mode') || 'auto';
      return THEME_CYCLE.includes(m) ? m : 'auto';
    }

    try {
      const prefs = JSON.parse(localStorage.getItem('user_prefs') || '{}');
      const saved = prefs.theme;
      const initial = THEME_CYCLE.includes(saved) ? saved : 'auto';
      _applyTheme(initial);
    } catch (e) {
      console.warn('theme init', e);
      _applyTheme('auto');
    }

    // Live-follow system preference while in "auto" mode.
    if (mql) {
      const _onSystemChange = () => {
        if (_currentMode() === 'auto') _applyTheme('auto');
      };
      if (typeof mql.addEventListener === 'function') {
        mql.addEventListener('change', _onSystemChange);
      } else if (typeof mql.addListener === 'function') {
        // Safari <14 fallback
        mql.addListener(_onSystemChange);
      }
    }

    function _cycleTheme() {
      const current = _currentMode();
      const idx = THEME_CYCLE.indexOf(current);
      const next = THEME_CYCLE[(idx + 1) % THEME_CYCLE.length];
      _applyTheme(next);
      try {
        const prefs = JSON.parse(localStorage.getItem('user_prefs') || '{}');
        prefs.theme = next;
        localStorage.setItem('user_prefs', JSON.stringify(prefs));
      } catch (e) {
        console.warn('theme save', e);
      }
      track(EVENTS.THEME_CHANGE, { to: next });
    }

    themeBtn.addEventListener('click', _cycleTheme);

    // Wire up the drawer theme button once the drawer markup is in the DOM.
    // The drawer is injected synchronously so this is safe to do right away.
    const drawerThemeBtn = document.getElementById('nav-theme-toggle-drawer');
    if (drawerThemeBtn) {
      drawerThemeBtn.addEventListener('click', _cycleTheme);
    }
  }

  // ── DOM references ──────────────────────────────────────────────────────────
  const burger = document.getElementById('nav-hamburger');
  const drawer = document.getElementById('nav-drawer');
  const backdrop = document.getElementById('nav-backdrop');
  const drawerCloseBtn = document.getElementById('nav-drawer-close');
  const drawerFocusableSelector =
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  const mobileDrawerMedia =
    typeof window.matchMedia === 'function' ? window.matchMedia('(max-width: 640px)') : null;

  // ── Drawer search — forward typed text to the main nav search overlay ───────
  const drawerSearchInput = document.getElementById('nav-drawer-search-input');
  if (drawerSearchInput) {
    drawerSearchInput.addEventListener('input', (e) => {
      const val = /** @type {HTMLInputElement} */ (e.target).value;
      const navSearchBtn = document.getElementById('nav-search-btn');
      const navSearchInput = /** @type {HTMLInputElement|null} */ (
        document.getElementById('nav-search-input')
      );
      if (navSearchBtn && navSearchInput) {
        // Close drawer first, then open the main search overlay with the typed value.
        // We must update the input value before dispatching the event so the
        // search handler sees the correct query.
        closeDrawer();
        navSearchInput.value = val;
        navSearchBtn.click();
        navSearchInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    drawerSearchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        /** @type {HTMLInputElement} */ (e.target).value = '';
      }
    });
  }

  // ── Drawer helpers ──────────────────────────────────────────────────────────
  function setDrawerState(isOpen) {
    const d = NAV_DATA[_currentLang] || NAV_DATA.en;
    navEl.classList.toggle('nav--open', isOpen);
    drawer.classList.toggle('is-open', isOpen);
    drawer.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
    backdrop.classList.toggle('is-visible', isOpen);
    backdrop.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
    burger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    burger.setAttribute('aria-label', isOpen ? d.closeMenu : d.openMenu);
    burger.classList.toggle('is-open', isOpen);
    if (drawerCloseBtn) drawerCloseBtn.setAttribute('aria-label', d.closeMenu);
    document.body.style.overflow = isOpen ? 'hidden' : '';
    const moreBtn = document.querySelector('[data-mobile-nav="menu"]');
    if (moreBtn) moreBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  }

  function openDrawer() {
    setDrawerState(true);
    const firstFocusable = drawer.querySelector(drawerFocusableSelector);
    if (firstFocusable) firstFocusable.focus();
  }

  function closeDrawer() {
    setDrawerState(false);
  }

  // ── Dropdown helpers ────────────────────────────────────────────────────────
  /** Close all open dropdowns, optionally skipping one group key. */
  function closeAllDropdowns(exceptKey) {
    navEl.querySelectorAll('.nav-dropdown.is-open').forEach((dd) => {
      if (dd.dataset.group === exceptKey) return;
      dd.classList.remove('is-open');
      const btn = dd.querySelector('.nav-dropdown-btn');
      if (btn) btn.setAttribute('aria-expanded', 'false');
    });
  }

  function openDropdown(groupEl, btnEl) {
    closeAllDropdowns(groupEl.dataset.group);
    groupEl.classList.add('is-open');
    btnEl.setAttribute('aria-expanded', 'true');
  }

  function closeDropdown(groupEl, btnEl) {
    groupEl.classList.remove('is-open');
    btnEl.setAttribute('aria-expanded', 'false');
  }

  // ── Dropdown button events ──────────────────────────────────────────────────
  const canHover =
    typeof window.matchMedia !== 'function' ||
    window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  navEl.querySelectorAll('.nav-dropdown-btn').forEach((btn) => {
    const groupEl = btn.closest('.nav-dropdown');
    let hoverTimer = null;

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (groupEl.classList.contains('is-open')) {
        closeDropdown(groupEl, btn);
      } else {
        openDropdown(groupEl, btn);
      }
    });

    btn.addEventListener('keydown', (e) => {
      const panel = groupEl.querySelector('.nav-dropdown-panel');
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        openDropdown(groupEl, btn);
        const first = panel.querySelector('.nav-dropdown-item');
        if (first) first.focus();
      }
      if (e.key === 'Escape') {
        closeDropdown(groupEl, btn);
        btn.focus();
      }
    });

    if (canHover) {
      groupEl.addEventListener('pointerenter', () => {
        window.clearTimeout(hoverTimer);
        openDropdown(groupEl, btn);
      });

      groupEl.addEventListener('pointerleave', () => {
        hoverTimer = window.setTimeout(() => closeDropdown(groupEl, btn), 120);
      });

      groupEl.addEventListener('focusin', () => {
        window.clearTimeout(hoverTimer);
        openDropdown(groupEl, btn);
      });

      groupEl.addEventListener('focusout', () => {
        hoverTimer = window.setTimeout(() => {
          if (!groupEl.contains(document.activeElement)) closeDropdown(groupEl, btn);
        }, 80);
      });
    }
  });

  // ── Keyboard nav inside dropdown panels ────────────────────────────────────
  navEl.querySelectorAll('.nav-dropdown-panel').forEach((panel) => {
    panel.addEventListener('keydown', (e) => {
      const items = [...panel.querySelectorAll('.nav-dropdown-item')];
      const idx = items.indexOf(document.activeElement);

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        (items[idx + 1] || items[0]).focus();
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        (items[idx - 1] || items[items.length - 1]).focus();
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        const groupEl = panel.closest('.nav-dropdown');
        const btn = groupEl.querySelector('.nav-dropdown-btn');
        closeDropdown(groupEl, btn);
        btn.focus();
      }
      if (e.key === 'Tab') {
        // Let Tab move naturally; just close the dropdown
        const groupEl = panel.closest('.nav-dropdown');
        const btn = groupEl.querySelector('.nav-dropdown-btn');
        closeDropdown(groupEl, btn);
      }
    });
  });

  // ── Click-outside closes dropdowns ─────────────────────────────────────────
  document.addEventListener('click', (e) => {
    if (!navEl.contains(e.target)) {
      closeAllDropdowns(null);
    }
  });

  // ── Hamburger ──────────────────────────────────────────────────────────────
  burger.addEventListener('click', () => {
    closeAllDropdowns(null);
    if (navEl.classList.contains('nav--open')) {
      closeDrawer();
    } else {
      openDrawer();
    }
  });

  // ── Backdrop ───────────────────────────────────────────────────────────────
  backdrop.addEventListener('click', () => {
    closeDrawer();
    burger.focus();
  });

  if (drawerCloseBtn) {
    drawerCloseBtn.addEventListener('click', () => {
      closeDrawer();
      burger.focus();
    });
  }

  // ── Close drawer on any drawer link click ──────────────────────────────────
  drawer.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => closeDrawer());
  });

  // ── Global Escape key ──────────────────────────────────────────────────────
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;

    if (navEl.classList.contains('nav--open')) {
      closeDrawer();
      burger.focus();
      return;
    }

    const openDd = navEl.querySelector('.nav-dropdown.is-open');
    if (openDd) {
      const btn = openDd.querySelector('.nav-dropdown-btn');
      closeDropdown(openDd, btn);
      btn.focus();
    }
  });

  // ── Focus trap inside the open drawer ──────────────────────────────────────
  drawer.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab' || !navEl.classList.contains('nav--open')) return;
    const focusables = drawer.querySelectorAll(drawerFocusableSelector);
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });

  // ── Prevent stuck mobile drawer state when resizing to desktop ─────────────
  window.addEventListener('resize', () => {
    const isMobileDrawerVisible = mobileDrawerMedia
      ? mobileDrawerMedia.matches
      : window.innerWidth <= 640;
    if (!isMobileDrawerVisible && navEl.classList.contains('nav--open')) {
      closeDrawer();
    }
  });

  // ── Apply site-level feature flags (async — runs after current call stack) ─
  applyFeatureFlags().catch((err) => {
    console.warn('[nav] Failed to apply feature flags:', err);
  });

  return _buildReturnValue();
}

// ─────────────────────────────────────────────────────────────────────────────
// Scroll behavior: is-scrolled + hide/reveal (Track B §5.B.7)
// ─────────────────────────────────────────────────────────────────────────────

function _initNavScrollBehavior(navEl) {
  if (!navEl || typeof window === 'undefined') return;
  const HIDE_DELTA = 6;
  const SHOW_NEAR_TOP = 64;

  const reduceMotion =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let lastY = window.scrollY || 0;
  let ticking = false;

  function update() {
    ticking = false;
    const y = window.scrollY || 0;

    // Scrolled state (for shadow/border tint) — always tracked.
    if (y > 4) {
      navEl.setAttribute('data-scrolled', 'true');
    } else {
      navEl.removeAttribute('data-scrolled');
    }

    // Never hide while drawer/dropdown open, or near the top, or when reduced motion.
    if (reduceMotion || y < SHOW_NEAR_TOP || navEl.classList.contains('nav--open')) {
      navEl.removeAttribute('data-nav-hidden');
      lastY = y;
      return;
    }
    if (navEl.querySelector('.nav-dropdown.is-open')) {
      navEl.removeAttribute('data-nav-hidden');
      lastY = y;
      return;
    }

    const delta = y - lastY;
    if (delta > HIDE_DELTA) {
      navEl.setAttribute('data-nav-hidden', 'true');
    } else if (delta < -HIDE_DELTA) {
      navEl.removeAttribute('data-nav-hidden');
    }
    lastY = y;
  }

  window.addEventListener(
    'scroll',
    () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    },
    { passive: true }
  );

  // Initial sync (e.g., if page loaded mid-scroll).
  update();
}

// ─────────────────────────────────────────────────────────────────────────────
// Mobile bottom navigation bar
// ─────────────────────────────────────────────────────────────────────────────

function _injectMobileBottomNav(lang, _depth) {
  // Guard against double-injection
  if (document.querySelector('.mobile-bottom-nav')) return;

  const isAr = lang === 'ar';

  // Bottom nav uses root-safe absolute hrefs (matches phx/06 AR-nav pattern).
  const items = [
    { href: '/', icon: '🏠', label: isAr ? 'الرئيسية' : 'Home', key: 'home' },
    { href: '/tracker.html', icon: '📈', label: isAr ? 'تتبع' : 'Tracker', key: 'tracker' },
    { href: '/calculator.html', icon: '🧮', label: isAr ? 'حاسبة' : 'Calc', key: 'calculator' },
    { href: '/shops.html', icon: '🏪', label: isAr ? 'المحلات' : 'Shops', key: 'shops' },
    { action: 'menu', icon: '☰', label: isAr ? 'القائمة' : 'More', key: 'menu' },
  ];

  const itemsHtml = items
    .map((item) => {
      const isActive = !item.action && typeof item.href === 'string' && isPageMatch(item.href);
      const cls = 'mobile-bottom-nav-item' + (isActive ? ' is-active' : '');

      if (item.action === 'menu') {
        return `<button class="${cls}" data-mobile-nav="menu" type="button" aria-label="${item.label}" aria-expanded="false" aria-controls="nav-drawer">
          <span class="mobile-bottom-nav-icon" aria-hidden="true">${item.icon}</span>
          <span class="mobile-bottom-nav-label">${item.label}</span>
        </button>`;
      }

      return `<a href="${item.href}" class="${cls}" data-mobile-nav="${item.key}" aria-label="${item.label}">
        <span class="mobile-bottom-nav-icon" aria-hidden="true">${item.icon}</span>
        <span class="mobile-bottom-nav-label">${item.label}</span>
      </a>`;
    })
    .join('');

  const bottomNavHtml = `
    <div class="mobile-bottom-nav" role="navigation" aria-label="${isAr ? 'التنقل السريع' : 'Quick navigation'}" dir="${isAr ? 'rtl' : 'ltr'}">
      <div class="mobile-bottom-nav-inner">
        ${itemsHtml}
      </div>
    </div>`;

  const container = document.createElement('div');
  container.innerHTML = bottomNavHtml.trim();
  document.body.appendChild(container.firstElementChild);

  // Wire "More" button to open the mobile drawer
  const menuBtn = document.querySelector('[data-mobile-nav="menu"]');
  if (menuBtn) {
    menuBtn.addEventListener('click', () => {
      const burger = document.getElementById('nav-hamburger');
      if (burger) burger.click();
      // Mirror the hamburger's aria-expanded state onto the bottom-bar button
      const expanded =
        document.getElementById('nav-hamburger')?.getAttribute('aria-expanded') === 'true';
      menuBtn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Module-level state
// ─────────────────────────────────────────────────────────────────────────────

let _currentLang = 'en';

function _buildReturnValue() {
  return {
    getLangToggleButtons: () =>
      [
        document.getElementById('nav-lang-toggle'),
        document.getElementById('nav-lang-toggle-mobile'),
      ].filter(Boolean),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// updateNavLang — live language switch without re-injecting the nav
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Call after a language change to update all nav text in-place.
 * @param {'en'|'ar'} lang
 */
export function updateNavLang(lang) {
  const prev = _currentLang;
  _currentLang = lang;
  if (prev !== lang) track(EVENTS.LANG_CHANGE, { to: lang });
  const data = NAV_DATA[lang] || NAV_DATA.en;
  const isRtl = lang === 'ar';

  const nav = document.querySelector('.site-nav');
  if (!nav) return;

  // Direction
  nav.setAttribute('dir', isRtl ? 'rtl' : 'ltr');
  nav.setAttribute('aria-label', data.mainNav);

  // Language toggle buttons
  document.querySelectorAll('#nav-lang-toggle, #nav-lang-toggle-mobile').forEach((btn) => {
    btn.textContent = data.langToggle;
  });

  // Primary journey links
  if (Array.isArray(data.primaryLinks)) {
    data.primaryLinks.forEach((item) => {
      if (!item.key) return;
      nav.querySelectorAll(`[data-nav-primary="${item.key}"]`).forEach((el) => {
        const labelEl = el.querySelector('.nav-drawer-link-label');
        if (labelEl) labelEl.textContent = item.label;
        else el.textContent = item.label;
      });
    });
  }
  // Dropdown groups
  data.groups.forEach((group, gi) => {
    // Desktop button — preserve the caret <span>
    const btn = nav.querySelector(`.nav-dropdown-btn[data-group="${group.key}"]`);
    if (btn) {
      btn.childNodes.forEach((node) => {
        if (node.nodeType === Node.TEXT_NODE) node.textContent = group.label;
      });
    }

    // Desktop panel items (label + description live inside nav-dropdown-item-body)
    const panel = nav.querySelector(`.nav-dropdown[data-group="${group.key}"] .nav-dropdown-panel`);
    if (panel) {
      const featured = panel.querySelector('.nav-dropdown-featured');
      if (featured && group.featured) {
        featured.setAttribute('href', resolveHref(group.featured.href, 0));
        const featuredIcon = featured.querySelector('.nav-dropdown-featured-icon');
        if (featuredIcon) featuredIcon.textContent = group.featured.icon || '';
        const featuredLabel = featured.querySelector('.nav-dropdown-featured-label');
        if (featuredLabel) featuredLabel.textContent = group.featured.label;
        const featuredDesc = featured.querySelector('.nav-dropdown-featured-desc');
        if (featuredDesc) featuredDesc.textContent = group.featured.description;
      }
      const cta = panel.querySelector('.nav-dropdown-cta');
      if (cta && group.cta) {
        cta.setAttribute('href', resolveHref(group.cta.href, 0));
        const ctaLabel = cta.querySelector('.nav-dropdown-cta-label');
        if (ctaLabel) ctaLabel.textContent = group.cta.label;
        const ctaDesc = cta.querySelector('.nav-dropdown-cta-desc');
        if (ctaDesc) ctaDesc.textContent = group.cta.description;
      }
      panel.querySelectorAll('.nav-dropdown-section').forEach((sectionEl, sectionIndex) => {
        const srcSection = group.sections?.[sectionIndex];
        if (!srcSection) return;
        const title = sectionEl.querySelector('.nav-dropdown-section-title');
        if (title) title.textContent = srcSection.label;
        const desc = sectionEl.querySelector('.nav-dropdown-section-desc');
        if (desc) desc.textContent = srcSection.description || '';
      });
      panel.querySelectorAll('.nav-dropdown-item').forEach((el, i) => {
        const src = group.items[i];
        if (!src) return;
        const labelEl = el.querySelector('.nav-dropdown-item-label');
        if (labelEl) labelEl.textContent = src.label;
        const descEl = el.querySelector('.nav-dropdown-item-desc');
        if (descEl && src.description) descEl.textContent = src.description;
      });
      const panelTitle = panel.querySelector('.nav-dropdown-panel-title');
      if (panelTitle) panelTitle.textContent = group.label;
      const panelDesc = panel.querySelector('.nav-dropdown-panel-desc');
      if (panelDesc && group.description) panelDesc.textContent = group.description;
    }

    // Mobile drawer group (<details><summary><span>LABEL</span><caret/></summary>…)
    const drawerGroups = nav.querySelectorAll('.nav-drawer-group');
    if (drawerGroups[gi]) {
      const summary = drawerGroups[gi].querySelector('.nav-drawer-group-label');
      if (summary) {
        const labelSpan = summary.querySelector('.nav-drawer-group-copy > span');
        if (labelSpan) labelSpan.textContent = group.label;
        else summary.textContent = group.label;
        const descSmall = summary.querySelector('.nav-drawer-group-copy > small');
        if (descSmall) descSmall.textContent = group.description;
      }
      drawerGroups[gi]
        .querySelectorAll('.nav-drawer-section')
        .forEach((sectionEl, sectionIndex) => {
          const srcSection = group.sections?.[sectionIndex];
          const sectionLabel = sectionEl.querySelector('.nav-drawer-section-label');
          if (sectionLabel && srcSection) sectionLabel.textContent = srcSection.label;
        });
      drawerGroups[gi].querySelectorAll('.nav-drawer-link').forEach((el, i) => {
        const src = group.items[i];
        if (!src) return;
        const labelEl = el.querySelector('.nav-drawer-link-label');
        if (labelEl) labelEl.textContent = src.label;
        else el.textContent = src.label;
        const descEl = el.querySelector('.nav-drawer-link-desc');
        if (descEl) descEl.textContent = src.description;
      });
    }
  });

  // Hamburger aria-label
  const burger = document.getElementById('nav-hamburger');
  if (burger) {
    const isExpanded = burger.getAttribute('aria-expanded') === 'true';
    burger.setAttribute('aria-label', isExpanded ? data.closeMenu : data.openMenu);
  }

  // Brand aria-label
  const brand = document.querySelector('.nav-brand');
  if (brand && data.brandLabel) brand.setAttribute('aria-label', data.brandLabel);

  // Theme toggle aria-label (re-apply for current mode)
  const themeBtn = document.getElementById('nav-theme-toggle');
  if (themeBtn && data.themeLabels) {
    const currentMode = themeBtn.getAttribute('data-theme-mode') || 'auto';
    const label = data.themeLabels[currentMode] || data.themeLabels.auto;
    if (label) {
      themeBtn.setAttribute('aria-label', label);
      themeBtn.setAttribute('title', label);
    }
  }

  // Drawer aria-label
  const drawer = document.getElementById('nav-drawer');
  if (drawer) drawer.setAttribute('aria-label', data.mainNav);
  const drawerCloseBtn = document.getElementById('nav-drawer-close');
  if (drawerCloseBtn) {
    drawerCloseBtn.setAttribute('aria-label', data.closeMenu);
    const drawerCloseText = drawerCloseBtn.querySelector('span:not([aria-hidden="true"])');
    if (drawerCloseText) drawerCloseText.textContent = data.closeMenu;
  }

  // Desktop CTA label
  const ctaEl = document.getElementById('nav-cta-tracker');
  if (ctaEl && data.ctaLabel) {
    ctaEl.textContent = data.ctaLabel;
    ctaEl.setAttribute('aria-label', data.ctaLabel);
  }

  // Drawer search placeholder
  const drawerSearch = /** @type {HTMLInputElement|null} */ (
    document.getElementById('nav-drawer-search-input')
  );
  if (drawerSearch && data.drawerSearchPlaceholder) {
    drawerSearch.placeholder = data.drawerSearchPlaceholder;
    drawerSearch.setAttribute('aria-label', data.drawerSearchPlaceholder);
  }

  // Drawer CTA label
  const drawerCta = document.getElementById('nav-drawer-cta');
  if (drawerCta && data.drawerCtaLabel) drawerCta.textContent = data.drawerCtaLabel;

  // Mobile bottom nav language update
  const bottomNav = document.querySelector('.mobile-bottom-nav');
  if (bottomNav) {
    bottomNav.setAttribute('dir', isRtl ? 'rtl' : 'ltr');
    bottomNav.setAttribute('aria-label', isRtl ? 'التنقل السريع' : 'Quick navigation');
    const labels = {
      home: isRtl ? 'الرئيسية' : 'Home',
      tracker: isRtl ? 'تتبع' : 'Tracker',
      calculator: isRtl ? 'حاسبة' : 'Calc',
      shops: isRtl ? 'المحلات' : 'Shops',
      menu: isRtl ? 'القائمة' : 'More',
    };
    bottomNav.querySelectorAll('[data-mobile-nav]').forEach((el) => {
      const key = el.dataset.mobileNav;
      const lbl = el.querySelector('.mobile-bottom-nav-label');
      if (lbl && labels[key]) lbl.textContent = labels[key];
      if (labels[key]) el.setAttribute('aria-label', labels[key]);
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// initNavSearch — wire up the search bar injected by injectNav()
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Initialize the nav search bar.
 * Called once per page, after injectNav().
 *
 * Track B (§5.B.5) enhancements:
 *   - Keyboard shortcuts: `/` and `Ctrl/Cmd+K` open the overlay (ignored inside inputs).
 *   - Recent searches persisted in localStorage under `nav.search.recent` (cap 8).
 *   - All result rows built via safe DOM (createElement + textContent); no innerHTML sinks.
 *   - Progressive enhancement: the `/content/search/` link in Tools stays as the no-JS fallback.
 *
 * @param {string} basePath  Base URL path (e.g. '/')
 */
export function initNavSearch(basePath = '/') {
  // Lazy-load the search engine only when the user first interacts
  let searchModule = null;

  async function getSearch() {
    if (searchModule) return searchModule;
    searchModule = await import('../search/searchEngine.js').catch(() => null);
    return searchModule;
  }

  const btn = document.getElementById('nav-search-btn');
  const overlay = document.getElementById('nav-search-overlay');
  const input = document.getElementById('nav-search-input');
  const dropdown = document.getElementById('nav-search-dropdown');

  if (!btn || !overlay || !input) return;

  const RECENT_KEY = 'nav.search.recent';
  const RECENT_CAP = 8;

  function readRecent() {
    try {
      const raw = localStorage.getItem(RECENT_KEY);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr)
        ? arr.filter((s) => typeof s === 'string').slice(0, RECENT_CAP)
        : [];
    } catch {
      return [];
    }
  }

  function pushRecent(q) {
    if (!q || q.length < 2) return;
    try {
      const list = readRecent().filter((s) => s !== q);
      list.unshift(q);
      localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, RECENT_CAP)));
    } catch {
      /* ignore */
    }
  }

  function clearResults() {
    if (dropdown) dropdown.replaceChildren();
  }

  function showMessage(text) {
    if (!dropdown) return;
    dropdown.replaceChildren();
    const msg = document.createElement('div');
    msg.className = 'nav-search-message';
    msg.textContent = text;
    dropdown.appendChild(msg);
  }

  function isOpen() {
    return !overlay.hasAttribute('hidden');
  }

  let debounceTimer = null;

  function openOverlay() {
    overlay.removeAttribute('hidden');
    btn.setAttribute('aria-expanded', 'true');
    input.focus();
    // If the input is empty, surface recent searches (if any).
    if (!input.value.trim()) renderRecent();
  }

  function closeOverlay() {
    overlay.setAttribute('hidden', '');
    btn.setAttribute('aria-expanded', 'false');
    clearResults();
  }

  const _recentSearchesLabel = () => {
    const d = NAV_DATA[_currentLang] || NAV_DATA.en;
    return d.recentSearches || 'Recent searches';
  };

  function renderRecent() {
    const recents = readRecent();
    if (!recents.length) {
      clearResults();
      return;
    }
    dropdown.replaceChildren();
    const header = document.createElement('div');
    header.className = 'nav-search-message nav-search-section-head';
    header.textContent = _recentSearchesLabel();
    dropdown.appendChild(header);
    for (const q of recents) {
      const btnEl = document.createElement('button');
      btnEl.type = 'button';
      btnEl.className = 'nav-search-recent';
      btnEl.textContent = q;
      btnEl.addEventListener('click', () => {
        input.value = q;
        input.dispatchEvent(new Event('input'));
      });
      dropdown.appendChild(btnEl);
    }
  }

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (isOpen()) closeOverlay();
    else openOverlay();
  });

  // Global keyboard shortcuts: `/` and Ctrl/Cmd+K
  document.addEventListener('keydown', (e) => {
    const ae = document.activeElement;
    const inField =
      ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable);
    const isSlash = e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey && !inField;
    const isCmdK = (e.ctrlKey || e.metaKey) && !e.altKey && (e.key === 'k' || e.key === 'K');
    if (isSlash || isCmdK) {
      e.preventDefault();
      if (!isOpen()) openOverlay();
      else input.focus();
    }
  });

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (!overlay.contains(e.target) && e.target !== btn && isOpen()) {
      closeOverlay();
    }
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeOverlay();
      btn.focus();
    }
    if (e.key === 'Enter') {
      const first = dropdown.querySelector('a');
      if (first) {
        pushRecent(input.value.trim());
        first.click();
      }
    }
    if (e.key === 'ArrowDown') {
      const items = Array.from(dropdown.querySelectorAll('a, button'));
      if (items.length) {
        items[0].focus();
        e.preventDefault();
      }
    }
  });

  dropdown.addEventListener('keydown', (e) => {
    const items = Array.from(dropdown.querySelectorAll('a, button'));
    const idx = items.indexOf(document.activeElement);
    if (e.key === 'ArrowDown' && idx < items.length - 1) {
      items[idx + 1].focus();
      e.preventDefault();
    }
    if (e.key === 'ArrowUp') {
      if (idx > 0) {
        items[idx - 1].focus();
        e.preventDefault();
      } else {
        input.focus();
        e.preventDefault();
      }
    }
    if (e.key === 'Escape') {
      closeOverlay();
      btn.focus();
    }
  });

  function renderResults(results, q) {
    const base = basePath.replace(/\/$/, '');
    dropdown.replaceChildren();

    // Group results by `type` if available.
    const groups = new Map();
    for (const r of results) {
      const key = r.type || 'Pages';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(r);
    }

    for (const [typeLabel, entries] of groups) {
      const head = document.createElement('div');
      head.className = 'nav-search-message nav-search-section-head';
      head.textContent = typeLabel;
      dropdown.appendChild(head);

      for (const r of entries) {
        const href = base + r.url;
        const a = document.createElement('a');
        a.href = href;
        a.className = 'nav-search-result';
        a.setAttribute('tabindex', '0');
        a.setAttribute('role', 'option');

        const icon = document.createElement('span');
        icon.className = 'nav-search-result-icon';
        icon.setAttribute('aria-hidden', 'true');
        icon.textContent = r.icon || '🔍';
        a.appendChild(icon);

        const body = document.createElement('span');
        body.className = 'nav-search-result-body';

        const label = document.createElement('span');
        label.className = 'nav-search-result-label';
        label.textContent = r.label || '';
        body.appendChild(label);

        if (r.type) {
          const type = document.createElement('span');
          type.className = 'nav-search-result-type';
          type.textContent = r.type;
          body.appendChild(type);
        }

        a.appendChild(body);
        a.addEventListener('click', () => pushRecent(q));
        dropdown.appendChild(a);
      }
    }
  }

  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    const q = input.value.trim();
    if (q.length < 2) {
      // Empty/too-short query: show recent searches instead of results.
      renderRecent();
      return;
    }

    debounceTimer = setTimeout(async () => {
      const mod = await getSearch();
      if (!mod) {
        showMessage('Search unavailable');
        return;
      }
      const results = mod.search(q);
      if (!results.length) {
        showMessage('No results found');
        return;
      }
      renderResults(results, q);
    }, 200);
  });
}
