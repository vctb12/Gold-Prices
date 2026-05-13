/**
 * admin/shared/admin-shell.js
 *
 * Shared admin shell: injects the sidebar, wires mobile toggle / overlay,
 * highlights the active nav link, shows the logged-in user, and provides
 * the logout button.
 *
 * Usage (from any admin page module):
 *
 *   import { initAdminShell } from '../shared/admin-shell.js';  // or './shared/…' from dashboard
 *   await initAdminShell({ logout, getSession });
 *
 * The function expects the page to contain:
 *   <div class="sidebar-overlay" id="sidebar-overlay"></div>
 *   <div class="admin-layout">
 *     <aside class="sidebar" id="sidebar" aria-label="Admin navigation"></aside>
 *     …
 *     <button class="sidebar-toggle" id="sidebar-toggle" …>☰</button>
 *   </div>
 */

import { ICONS } from './icons.js';
import { initCommandPalette } from './admin-utils.js';

// ── Chevron SVGs for collapse button ────────────────────────────────────────
const CHEVRON_LEFT =
  '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg>';
const CHEVRON_RIGHT =
  '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>';

const SIDEBAR_COLLAPSED_KEY = 'gp_admin_sidebar_collapsed';

// ── Nav items (grouped) ──────────────────────────────────────────────────────
const NAV_GROUPS = [
  {
    label: 'Overview',
    items: [
      { iconKey: 'dashboard', label: 'Dashboard', slug: '' },
      { iconKey: 'analytics', label: 'Analytics', slug: 'analytics' },
    ],
  },
  {
    label: 'Commerce',
    items: [
      { iconKey: 'shops', label: 'Shops', slug: 'shops' },
      { iconKey: 'pricing', label: 'Pricing', slug: 'pricing' },
      { iconKey: 'orders', label: 'Orders', slug: 'orders' },
    ],
  },
  {
    label: 'Growth',
    items: [
      { iconKey: 'content', label: 'Newsletter', slug: 'newsletter' },
      { iconKey: 'social', label: 'Leads', slug: 'leads' },
    ],
  },
  {
    label: 'Content',
    items: [
      { iconKey: 'content', label: 'Content', slug: 'content' },
      { iconKey: 'social', label: 'Social', slug: 'social' },
    ],
  },
  {
    label: 'System',
    items: [{ iconKey: 'settings', label: 'Settings', slug: 'settings' }],
  },
];

// Flat list for command palette / breadcrumb
const NAV_ITEMS = NAV_GROUPS.flatMap((g) => g.items);

// Bottom nav shows the four most-used sections + a More button
const BOTTOM_NAV_ITEMS = [
  { iconKey: 'dashboard', label: 'Home', slug: '' },
  { iconKey: 'shops', label: 'Shops', slug: 'shops' },
  { iconKey: 'orders', label: 'Orders', slug: 'orders' },
  { iconKey: 'analytics', label: 'Stats', slug: 'analytics' },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function getAdminBase() {
  const path = window.location.pathname;
  const match = path.match(/^(.*\/admin\/)/);
  return match ? match[1] : '/admin/';
}

function getActiveSlug() {
  const path = window.location.pathname;
  const base = getAdminBase();
  const remainder = path
    .slice(base.length)
    .replace(/index\.html$/, '')
    .replace(/\/+$/, '');
  return remainder;
}

// ── Sidebar HTML builder ─────────────────────────────────────────────────────

function buildSidebarHTML(adminBase, activeSlug) {
  const navSections = NAV_GROUPS.map((group) => {
    const links = group.items
      .map((item) => {
        const href = adminBase + (item.slug ? item.slug + '/' : '');
        const isActive = item.slug === activeSlug;
        const cls = 'nav-link' + (isActive ? ' active' : '');
        const aria = isActive ? ' aria-current="page"' : '';
        const badge =
          item.slug === 'orders'
            ? '<span class="notification-badge orders-badge-hidden" id="orders-badge" aria-label="pending orders count"></span>'
            : '';
        return `<a class="${cls}" href="${href}"${aria}><span class="nav-icon">${ICONS[item.iconKey]}</span><span class="nav-label">${item.label}</span>${badge}</a>`;
      })
      .join('\n          ');

    return `<div class="nav-section-label" aria-hidden="true">${group.label}</div>
          ${links}`;
  }).join('\n          ');

  return `
        <div class="sidebar-header">
          <span class="logo-icon" aria-hidden="true">✦</span>
          <span class="logo-text">GoldAdmin</span>
          <button class="sidebar-collapse-btn" id="sidebar-collapse-btn" title="Collapse sidebar" aria-label="Collapse sidebar">${CHEVRON_LEFT}</button>
        </div>

        <nav class="sidebar-nav" aria-label="Main menu">
          ${navSections}
        </nav>

        <div class="sidebar-footer">
          <div class="sidebar-user-row sidebar-user-row-inner" id="sidebar-user">
            <div class="user-avatar sidebar-user-avatar" id="sidebar-avatar">?</div>
            <div class="sidebar-user-info">
              <div class="sidebar-user-email" id="sidebar-email"></div>
              <div class="role-badge role-badge--admin">admin</div>
            </div>
          </div>
          <div class="sidebar-footer-actions">
            <a href="/" class="btn btn-ghost btn-sm sidebar-footer-link" title="View public website">
              <span class="nav-icon sidebar-footer-icon">${ICONS.externalLink}</span><span class="nav-label">Site</span>
            </a>
            <a href="${adminBase}" class="btn btn-ghost btn-sm sidebar-footer-link" title="Dashboard">
              <span class="nav-icon sidebar-footer-icon">${ICONS.dashboard}</span><span class="nav-label">Home</span>
            </a>
            <button class="btn btn-ghost btn-sm sidebar-footer-btn" id="logout-btn" type="button" title="Sign Out">
              <span class="nav-icon sidebar-footer-icon">${ICONS.logout}</span><span class="nav-label">Sign Out</span>
            </button>
          </div>
        </div>`;
}

// ── Mobile bottom nav ────────────────────────────────────────────────────────

function injectBottomNav(adminBase, activeSlug, openSidebarFn) {
  if (document.querySelector('.admin-bottom-nav')) return;
  const nav = document.createElement('nav');
  nav.className = 'admin-bottom-nav';
  nav.setAttribute('aria-label', 'Mobile navigation');

  const items = BOTTOM_NAV_ITEMS.map((item) => {
    const href = adminBase + (item.slug ? item.slug + '/' : '');
    const isActive = item.slug === activeSlug;
    return `<a class="bottom-nav-item${isActive ? ' active' : ''}" href="${href}"${isActive ? ' aria-current="page"' : ''}>
      <span class="bottom-nav-icon">${ICONS[item.iconKey]}</span>
      <span class="bottom-nav-label">${item.label}</span>
    </a>`;
  });

  // More button opens the sidebar
  items.push(`<button class="bottom-nav-item" id="bottom-nav-more" type="button" aria-label="More navigation options">
    <span class="bottom-nav-icon">${ICONS.menu}</span>
    <span class="bottom-nav-label">More</span>
  </button>`);

  nav.innerHTML = items.join('');
  document.body.appendChild(nav);

  document.getElementById('bottom-nav-more')?.addEventListener('click', openSidebarFn);
}

// ── Breadcrumb ───────────────────────────────────────────────────────────────

export function renderBreadcrumb(pageName) {
  if (!pageName) return;
  const crumbs = Array.isArray(pageName) ? pageName : [{ label: String(pageName) }];
  if (!crumbs.length) return;
  const adminBase = getAdminBase();
  const header = document.querySelector('header.page-header');
  if (!header) return;

  let bc = header.nextElementSibling;
  if (!bc || !bc.classList.contains('breadcrumb')) {
    bc = document.createElement('nav');
    bc.className = 'breadcrumb';
    bc.setAttribute('aria-label', 'Breadcrumb');
    header.insertAdjacentElement('afterend', bc);
  }

  const parts = [`<a href="${adminBase}">GoldAdmin</a>`];
  crumbs.forEach((c, i) => {
    parts.push('<span class="breadcrumb-sep" aria-hidden="true">›</span>');
    if (c.href && i < crumbs.length - 1) {
      parts.push(`<a href="${adminBase}${c.href}">${c.label}</a>`);
    } else {
      parts.push(`<span class="breadcrumb-current">${c.label}</span>`);
    }
  });
  bc.innerHTML = parts.join('');
}

// ── Main init function ───────────────────────────────────────────────────────

export async function initAdminShell({ logout, getSession, loginPath } = {}) {
  const adminBase = getAdminBase();
  const activeSlug = getActiveSlug();
  const login = loginPath || adminBase + 'login/';

  // ── Inject sidebar content ──────────────────────────────
  const sidebarEl = document.getElementById('sidebar');
  if (sidebarEl) {
    sidebarEl.innerHTML = buildSidebarHTML(adminBase, activeSlug);
  }

  // ── Collapse / expand sidebar ──────────────────────────
  const mainArea = document.querySelector('.main-area');
  const collapseBtn = document.getElementById('sidebar-collapse-btn');

  function setCollapsed(collapsed) {
    if (collapsed) {
      sidebarEl?.classList.add('sidebar--collapsed');
      mainArea?.classList.add('main-area--collapsed');
      if (collapseBtn) collapseBtn.innerHTML = CHEVRON_RIGHT;
    } else {
      sidebarEl?.classList.remove('sidebar--collapsed');
      mainArea?.classList.remove('main-area--collapsed');
      if (collapseBtn) collapseBtn.innerHTML = CHEVRON_LEFT;
    }
  }

  try {
    const saved = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    if (saved === '1') setCollapsed(true);
  } catch {
    /* storage unavailable */
  }

  collapseBtn?.addEventListener('click', () => {
    const willCollapse = !sidebarEl?.classList.contains('sidebar--collapsed');
    setCollapsed(willCollapse);
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, willCollapse ? '1' : '0');
    } catch {
      /* ignore */
    }
  });

  // ── Mobile sidebar toggle ───────────────────────────────
  const overlay = document.getElementById('sidebar-overlay');
  const toggleBtn = document.getElementById('sidebar-toggle');

  function syncSidebarExpanded() {
    toggleBtn?.setAttribute(
      'aria-expanded',
      sidebarEl?.classList.contains('sidebar--open') ? 'true' : 'false'
    );
  }

  function openSidebar() {
    sidebarEl?.classList.add('sidebar--open');
    overlay?.classList.add('sidebar-overlay--visible');
    syncSidebarExpanded();
  }
  function closeSidebar() {
    sidebarEl?.classList.remove('sidebar--open');
    overlay?.classList.remove('sidebar-overlay--visible');
    syncSidebarExpanded();
  }

  syncSidebarExpanded();

  toggleBtn?.addEventListener('click', () => {
    if (sidebarEl?.classList.contains('sidebar--open')) {
      closeSidebar();
    } else {
      openSidebar();
    }
  });

  overlay?.addEventListener('click', closeSidebar);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sidebarEl?.classList.contains('sidebar--open')) {
      closeSidebar();
    }
  });

  sidebarEl?.querySelectorAll('.nav-link').forEach((link) => {
    link.addEventListener('click', closeSidebar);
  });

  // ── Mobile bottom nav ───────────────────────────────────
  injectBottomNav(adminBase, activeSlug, openSidebar);

  // ── Logout button ──────────────────────────────────────
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn && logout) {
    logoutBtn.addEventListener('click', async () => {
      logoutBtn.textContent = 'Signing out…';
      logoutBtn.disabled = true;
      await logout();
      window.location.replace(login);
    });
  }

  // ── Show user info in sidebar footer ────────────────────
  if (getSession) {
    try {
      const session = await getSession();
      if (session?.user) {
        const email =
          session.user.email ||
          session.user.user_metadata?.email ||
          session.user.identities?.find((id) => id.provider === 'github')?.identity_data?.email;
        const emailEl = document.getElementById('sidebar-email');
        const avatarEl = document.getElementById('sidebar-avatar');
        if (email) {
          if (emailEl) emailEl.textContent = email;
          if (avatarEl) avatarEl.textContent = email[0].toUpperCase();
        }
      }
    } catch {
      // Non-critical
    }
  }

  // ── Pending orders badge ─────────────────────────────────
  try {
    const { getSupabase } = await import('../supabase-auth.js');
    const sb = getSupabase();
    if (sb) {
      const { count } = await sb
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');
      if (count > 0) {
        const badge = document.getElementById('orders-badge');
        if (badge) {
          badge.textContent = count;
          badge.classList.remove('orders-badge-hidden');
        }
      }
    }
  } catch {
    // Non-critical
  }

  // ── Command palette ──────────────────────────────────────
  const paletteItems = NAV_ITEMS.map((item) => ({
    label: item.label,
    icon: ICONS[item.iconKey] || '',
    href: adminBase + (item.slug ? item.slug + '/' : ''),
  }));
  initCommandPalette(paletteItems);
}
