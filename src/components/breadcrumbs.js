/**
 * Breadcrumbs Component — renders accessible breadcrumb navigation with
 * schema.org microdata markup.
 *
 * Public API:
 *   renderBreadcrumbs(container, items) — mount breadcrumb `<nav>` into a DOM node
 *   getBreadcrumbs(pageName, extra)     — resolve item list for a known page name
 *   injectBreadcrumbs(pageName, extra)  — convenience wrapper: resolve + render
 *   generateBreadcrumbSchema(items)     — generate a JSON-LD BreadcrumbList script tag
 */

import { TRANSLATIONS } from '../config/index.js';

function getLocale() {
  if (typeof document === 'undefined') return 'en';
  return document.documentElement?.lang === 'ar' ? 'ar' : 'en';
}

function tx(key, fallback) {
  const locale = getLocale();
  return TRANSLATIONS[locale]?.[key] ?? TRANSLATIONS.en?.[key] ?? fallback;
}

function getLabels(extra = {}) {
  return {
    home: tx('nav.home', 'Home'),
    shops: tx('nav.shops', 'Shops & Markets'),
    calculator: tx('nav.calculator', 'Calculator'),
    learn: tx('nav.learn', 'Learn'),
    insights: tx('nav.insights', 'Insights'),
    methodology: tx('nav.methodology', 'Methodology'),
    terms: tx('nav.terms', 'Terms of Service'),
    privacy: tx('nav.privacy', 'Privacy Policy'),
    invest: tx('nav.invest', 'Invest'),
    tracker: tx('nav.tracker', 'Tracker'),
    countries: tx('nav.countries', 'Countries'),
    country: extra.countryName || tx('nav.country', 'Country'),
  };
}

/**
 * Render breadcrumb navigation with schema.org `BreadcrumbList` microdata
 * into `container`. The last item is rendered as plain text (current page);
 * all preceding items are rendered as links.
 *
 * @param {Element|null} container  Target DOM element to append the `<nav>` into.
 * @param {Array<{label: string, url?: string}>} items
 *   Ordered breadcrumb items. Each entry needs at minimum a `label`. Items with a
 *   `url` and that are not the last entry are rendered as links.
 */
export function renderBreadcrumbs(container, items) {
  if (!container || !items || items.length === 0) {
    return;
  }

  // Create breadcrumb nav
  const nav = document.createElement('nav');
  nav.className = 'breadcrumbs';
  nav.setAttribute('aria-label', tx('breadcrumbs.ariaLabel', 'Breadcrumb'));
  nav.setAttribute('dir', getLocale() === 'ar' ? 'rtl' : 'ltr');

  // Create ol with schema.org markup
  const ol = document.createElement('ol');
  ol.className = 'breadcrumbs-list';
  ol.setAttribute('itemscope', '');
  ol.setAttribute('itemtype', 'https://schema.org/BreadcrumbList');

  items.forEach((item, index) => {
    const li = document.createElement('li');
    li.className = 'breadcrumbs-item';
    li.setAttribute('itemprop', 'itemListElement');
    li.setAttribute('itemscope', '');
    li.setAttribute('itemtype', 'https://schema.org/ListItem');

    const position = index + 1;
    li.setAttribute('data-position', position);

    if (item.url && index < items.length - 1) {
      // Link for non-current items — built via DOM to avoid innerHTML sinks on caller-supplied strings.
      const nameSpan = document.createElement('span');
      nameSpan.setAttribute('itemprop', 'name');
      nameSpan.textContent = item.label;
      const link = document.createElement('a');
      link.href = item.url;
      link.className = 'breadcrumbs-link';
      link.setAttribute('itemprop', 'item');
      link.appendChild(nameSpan);
      li.appendChild(link);
    } else {
      // Current item (no link)
      const nameSpan = document.createElement('span');
      nameSpan.setAttribute('itemprop', 'name');
      nameSpan.textContent = item.label;
      const currentSpan = document.createElement('span');
      currentSpan.className = 'breadcrumbs-current';
      currentSpan.setAttribute('itemprop', 'item');
      currentSpan.appendChild(nameSpan);
      li.appendChild(currentSpan);
    }

    // Add position meta
    const positionMeta = document.createElement('meta');
    positionMeta.setAttribute('itemprop', 'position');
    positionMeta.content = position.toString();
    li.appendChild(positionMeta);

    ol.appendChild(li);
  });

  nav.appendChild(ol);
  container.replaceChildren(nav);
}

/**
 * Return the breadcrumb item list for a named page.
 * Always starts with a "Home" entry.
 *
 * @param {'shops'|'calculator'|'learn'|'insights'|'methodology'|'terms'|'privacy'|'invest'|'tracker'|'country'|string} pageName
 *   Well-known page identifier. Unknown names produce `[Home]` only.
 * @param {{ countryName?: string, countryUrl?: string }} [extra]
 *   Extra context used by the `'country'` page type.
 * @returns {Array<{label: string, url: string}>}
 */
export function getBreadcrumbs(pageName, extra = {}) {
  const labels = getLabels(extra);
  const breadcrumbs = [{ label: labels.home, url: '/' }];

  const pageMap = {
    shops: [{ label: labels.shops, url: '/shops.html' }],
    calculator: [{ label: labels.calculator, url: '/calculator.html' }],
    learn: [{ label: labels.learn, url: '/learn.html' }],
    insights: [{ label: labels.insights, url: '/insights.html' }],
    methodology: [{ label: labels.methodology, url: '/methodology.html' }],
    terms: [{ label: labels.terms, url: '/terms.html' }],
    privacy: [{ label: labels.privacy, url: '/privacy.html' }],
    invest: [{ label: labels.invest, url: '/invest.html' }],
    tracker: [{ label: labels.tracker, url: '/tracker.html' }],
    country: [
      { label: labels.countries, url: '/countries/index.html' },
      { label: labels.country, url: extra.countryUrl || '#' },
    ],
  };

  if (pageMap[pageName]) {
    breadcrumbs.push(...pageMap[pageName]);
  }

  return breadcrumbs;
}

/**
 * Convenience helper: resolve the breadcrumb list for `pageName` and render
 * it into the `.page-breadcrumbs` container. Call after nav injection.
 *
 * @param {string} pageName  See {@link getBreadcrumbs} for accepted values.
 * @param {object} [extra]   Extra context forwarded to {@link getBreadcrumbs}.
 */
export function injectBreadcrumbs(pageName, extra = {}) {
  // Wait for nav to be injected if needed
  const breadcrumbContainer = document.querySelector('.page-breadcrumbs');
  if (!breadcrumbContainer) {
    return;
  }

  const breadcrumbs = getBreadcrumbs(pageName, extra);
  renderBreadcrumbs(breadcrumbContainer, breadcrumbs);
}

/**
 * Generate a `<script type="application/ld+json">` tag containing a
 * schema.org `BreadcrumbList` for server-side or build-time injection.
 *
 * @param {Array<{label?: string, name?: string, href?: string}>} items
 *   Breadcrumb items. `label` or `name` is used for the display name;
 *   `href` is resolved against `baseUrl` when relative.
 * @param {string} [baseUrl]  Site origin, defaults to `'https://goldtickerlive.com'`.
 * @returns {string}  HTML `<script>` tag string.
 */
export function generateBreadcrumbSchema(items, baseUrl = 'https://goldtickerlive.com') {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.label || item.name,
      item: item.href?.startsWith('http') ? item.href : `${baseUrl}${item.href}`,
    })),
  };
  return `<script type="application/ld+json">${JSON.stringify(schema)}</script>`;
}
