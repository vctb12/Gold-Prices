#!/usr/bin/env node
/**
 * scripts/node/inject-schema.js
 * Injects JSON-LD structured data into HTML pages for better SEO.
 *
 * Adds schema.org markup for:
 * - Organization (homepage)
 * - BreadcrumbList (all pages)
 * - WebSite with SearchAction (homepage)
 * - Product/Offer for price pages
 * - Article for content pages
 *
 * Usage:
 *   node scripts/node/inject-schema.js              # inject into all pages
 *   node scripts/node/inject-schema.js --check      # validate existing schema
 *   node scripts/node/inject-schema.js --file path  # inject into specific file
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const SITE_URL = 'https://goldtickerlive.com';
const SITE_NAME = 'Gold Ticker Live';
const SITE_DESCRIPTION = 'Live gold prices for GCC, Arab world and global markets';

// ── Schema Templates ────────────────────────────────────────────────────────

/**
 * Organization schema for homepage
 */
function getOrganizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/assets/logo.png`,
    description: SITE_DESCRIPTION,
    sameAs: ['https://twitter.com/goldtickerlive', 'https://x.com/GoldTickerLive'],
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'Customer Service',
      availableLanguage: ['English', 'Arabic'],
    },
  };
}

/**
 * WebSite schema with search action for homepage
 */
function getWebSiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${SITE_URL}/content/search/?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
    inLanguage: ['en', 'ar'],
  };
}

/**
 * BreadcrumbList schema
 * @param {Array<{name: string, url: string}>} items
 */
function getBreadcrumbSchema(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

/**
 * Product/Offer schema for price pages
 * @param {Object} options
 */
function getProductSchema(options) {
  const {
    name = '24K Gold Price',
    description = 'Current spot gold price',
    price = null,
    currency = 'AED',
    _country = 'UAE',
    _karat = '24K',
  } = options;

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name,
    description,
    category: 'Precious Metals',
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: currency,
      availability: 'https://schema.org/InStock',
      itemCondition: 'https://schema.org/NewCondition',
    },
  };

  if (price) {
    schema.offers.lowPrice = price;
    schema.offers.highPrice = price;
  }

  return schema;
}

/**
 * Article schema for content pages
 * @param {Object} options
 */
function getArticleSchema(options) {
  const { headline, description, datePublished, dateModified, url } = options;

  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline,
    description,
    url,
    datePublished,
    dateModified: dateModified || datePublished,
    author: {
      '@type': 'Organization',
      name: SITE_NAME,
    },
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      logo: {
        '@type': 'ImageObject',
        url: `${SITE_URL}/assets/logo.png`,
      },
    },
    inLanguage: 'en',
  };
}

/**
 * FAQPage schema for pages with FAQ content.
 * @param {Array<{q: string, a: string}>} questions
 */
function getFAQPageSchema(questions) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: questions.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.a,
      },
    })),
  };
}

/**
 * Dataset schema for price data pages.
 * @param {Object} options
 */
function getDatasetSchema(options) {
  const { name, description, url, variableMeasured = 'Gold price per gram' } = options;
  return {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name,
    description,
    url,
    creator: {
      '@type': 'Organization',
      name: SITE_NAME,
      url: SITE_URL,
    },
    license: `${SITE_URL}/terms.html`,
    variableMeasured,
    isAccessibleForFree: true,
    inLanguage: ['en', 'ar'],
  };
}

// ── URL to Breadcrumb Parser ────────────────────────────────────────────────

/**
 * Generate breadcrumb items from URL path.
 *
 * The last item uses `canonicalUrl` when provided so the schema item URL
 * matches the page's `<link rel="canonical">` exactly (preserving `.html`
 * extensions where required by the host).
 *
 * @param {string} urlPath     - e.g. "/tracker" (extension already stripped)
 * @param {string|null} [canonicalUrl] - Canonical URL for the current page,
 *   extracted from `<link rel="canonical">`. Used for the final breadcrumb
 *   item so schema URLs align with canonicals.
 * @returns {Array<{name: string, url: string}>}
 */
function generateBreadcrumbs(urlPath, canonicalUrl = null) {
  const items = [{ name: 'Home', url: SITE_URL }];

  if (urlPath === '/' || urlPath === '/index.html') {
    return items;
  }

  const parts = urlPath
    .replace(/\.html$/, '')
    .split('/')
    .filter(Boolean);
  let currentPath = '';

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    currentPath += `/${part}`;

    // Humanize the part (replace hyphens, capitalize) with locale-aware fixes.
    const prevPart = i > 0 ? parts[i - 1] : '';
    const arabicSectionLabels = {
      tools: 'أدوات',
      guides: 'أدلة',
      content: 'المحتوى',
      countries: 'الدول',
      learn: 'تعلّم',
      insights: 'رؤى',
      markets: 'الأسواق',
      faq: 'الأسئلة الشائعة',
    };
    const name =
      part === 'ar'
        ? arabicSectionLabels[prevPart] || 'العربية'
        : part
            .split('-')
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');

    // For the last crumb, prefer the canonical URL so the item URL matches
    // the page's own canonical (e.g. "…/tracker.html" not "…/tracker").
    const isLast = i === parts.length - 1;
    const url = isLast && canonicalUrl ? canonicalUrl : `${SITE_URL}${currentPath}`;

    items.push({ name, url });
  }

  return items;
}

// ── Page Type Detection ─────────────────────────────────────────────────────

/**
 * Detect page type from file path and content
 * @param {string} filePath
 * @param {string} content
 * @returns {string} - 'homepage' | 'country' | 'city' | 'price' | 'article' | 'generic'
 */
function detectPageType(filePath, _content) {
  const relativePath = path.relative(ROOT, filePath);

  if (relativePath === 'index.html') return 'homepage';
  if (relativePath.includes('/gold-price') || relativePath.includes('/gold-rate')) return 'price';
  if (relativePath.includes('/countries/')) return 'country';
  if (
    relativePath.includes('/guides/') ||
    relativePath.startsWith('content/') ||
    relativePath.includes('/content/')
  ) {
    return 'article';
  }
  if (relativePath.includes('/calculator') || relativePath.includes('/tools')) return 'tool';

  return 'generic';
}

// ── Schema Injection ────────────────────────────────────────────────────────

/**
 * Generate appropriate schemas for a page
 * @param {string} filePath
 * @param {string} content
 * @returns {Array<Object>} array of schema objects
 */
function generateSchemasForPage(filePath, content) {
  const pageType = detectPageType(filePath, content);
  const schemas = [];

  // Get URL path from file path
  const relativePath = path.relative(ROOT, filePath).replace(/\\/g, '/');
  const urlPath = '/' + relativePath.replace(/index\.html$/, '').replace(/\.html$/, '');

  // Extract title from HTML
  const titleMatch = content.match(/<title>([^<]+)<\/title>/);
  const pageTitle = titleMatch ? titleMatch[1].replace(/&amp;/g, '&') : '';

  // Extract description from meta tag
  const descMatch = content.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/);
  const pageDescription = descMatch ? descMatch[1] : '';

  // Extract canonical URL from <link rel="canonical"> — used to align
  // BreadcrumbList item URLs with the page's own canonical declaration.
  const canonicalMatch = content.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i);
  const canonicalUrl = canonicalMatch ? canonicalMatch[1] : null;

  // Homepage gets Organization + WebSite schemas
  if (pageType === 'homepage') {
    schemas.push(getOrganizationSchema());
    schemas.push(getWebSiteSchema());
  }

  // All pages get breadcrumb schema (except homepage)
  if (pageType !== 'homepage') {
    const breadcrumbs = generateBreadcrumbs(urlPath, canonicalUrl);
    if (breadcrumbs.length > 1) {
      schemas.push(getBreadcrumbSchema(breadcrumbs));
    }
  }

  // Price pages get Product + FAQPage + Dataset schemas
  if (pageType === 'price') {
    // Extract country/karat from path
    const countryMatch = relativePath.match(/countries\/([^\/]+)/);
    const karatMatch = relativePath.match(/(\d+k)/i);

    // Extract currency code from page title.
    // Handles multiple formats:
    //   "— SAR reference rates" (country gold-price pages)
    //   "— AED per Gram" (city gold-price and karat pages)
    //   "in AED |" (some city-level pages)
    const currencyMatch =
      pageTitle.match(/—\s*([A-Z]{3})\s+reference rates/) ||
      pageTitle.match(/—\s*([A-Z]{3})\s+per Gram/i) ||
      pageTitle.match(/\bin\s+([A-Z]{3})\s*[|,]/);
    const currency = currencyMatch ? currencyMatch[1] : 'AED';

    schemas.push(
      getProductSchema({
        name: pageTitle,
        description: pageDescription,
        country: countryMatch ? countryMatch[1].toUpperCase() : 'UAE',
        karat: karatMatch ? karatMatch[1].toUpperCase() : '24K',
        currency,
      })
    );

    // Extract FAQ data from embedded country-page-data JSON (body script tag)
    const pageDataMatch = content.match(
      /<script[^>]+id=["']country-page-data["'][^>]*>([\s\S]*?)<\/script>/i
    );
    if (pageDataMatch) {
      try {
        const pageData = JSON.parse(pageDataMatch[1]);
        const faqItems = pageData.faqEn || [];
        if (faqItems.length > 0) {
          schemas.push(getFAQPageSchema(faqItems));
        }
      } catch {
        // Malformed JSON — skip FAQ schema
      }
    }

    // Dataset schema for the price data
    const pageUrl = canonicalUrl || `${SITE_URL}${urlPath}`;
    const karatLabel = karatMatch ? karatMatch[1].toUpperCase() : '24K';
    schemas.push(
      getDatasetSchema({
        name: pageTitle,
        description: pageDescription,
        url: pageUrl,
        variableMeasured: `${karatLabel} gold price per gram in ${currency}`,
      })
    );
  }

  // Article pages get Article schema
  if (pageType === 'article') {
    // Try to get file modification date
    const stats = fs.statSync(filePath);
    const dateModified = stats.mtime.toISOString().split('T')[0];

    schemas.push(
      getArticleSchema({
        headline: pageTitle,
        description: pageDescription,
        url: `${SITE_URL}${urlPath}`,
        datePublished: dateModified,
        dateModified,
      })
    );
  }

  return schemas;
}

/**
 * Inject schemas into HTML content
 * @param {string} content - HTML content
 * @param {Array<Object>} schemas - Array of schema objects
 * @returns {string} modified HTML
 */
function injectSchemas(content, schemas) {
  if (schemas.length === 0) return content;

  // Remove existing JSON-LD schema blocks (including any trailing blank line).
  // We strip trailing whitespace from each removal but avoid consuming the
  // newline that belongs to the NEXT element. Then we collapse multiple blank
  // lines left behind so each run produces the same result (idempotency).
  if (content.includes('application/ld+json')) {
    // Remove each schema block without consuming unrelated trailing content.
    content = content.replace(
      /<script type="application\/ld\+json">[\s\S]*?<\/script>[ \t]*\r?\n?/gi,
      ''
    );
    // Collapse 2+ consecutive blank lines (a blank line is an empty or
    // whitespace-only line between two newlines) down to a single blank line.
    content = content.replace(/(\n[ \t]*){2,}\n/g, '\n\n');
  }

  // Generate schema script tags
  const schemaScripts = schemas
    .map((schema) => {
      const json = JSON.stringify(schema, null, 2);
      return `  <script type="application/ld+json">\n${json}\n  </script>`;
    })
    .join('\n');

  // Inject before </head>, ensuring exactly one blank line separates the last
  // preceding element from the schema block so the result is consistent.
  const headEndIndex = content.indexOf('</head>');
  if (headEndIndex === -1) {
    console.warn('Warning: No </head> tag found');
    return content;
  }

  // Trim any trailing whitespace/newlines from the content before </head>,
  // then add one newline + schemas + newline before </head>.
  const before = content.slice(0, headEndIndex).trimEnd();
  const after = content.slice(headEndIndex);
  return before + '\n' + schemaScripts + '\n  ' + after;
}

/**
 * Process a single HTML file
 * @param {string} filePath
 * @param {boolean} checkOnly
 * @returns {boolean} true if modified
 */
function processFile(filePath, checkOnly = false) {
  const content = fs.readFileSync(filePath, 'utf8');

  // Skip files with noindex
  if (/<meta\s+name=["']robots["']\s+content=["'][^"']*noindex/i.test(content)) {
    return false;
  }

  const schemas = generateSchemasForPage(filePath, content);

  if (checkOnly) {
    const hasSchema = content.includes('application/ld+json');
    const relativePath = path.relative(ROOT, filePath);
    if (!hasSchema && schemas.length > 0) {
      console.log(`Missing schema: ${relativePath}`);
      return true;
    }
    return false;
  }

  if (schemas.length === 0) {
    return false;
  }

  const newContent = injectSchemas(content, schemas);

  if (newContent !== content) {
    fs.writeFileSync(filePath, newContent, 'utf8');
    const relativePath = path.relative(ROOT, filePath);
    console.log(`✓ Injected ${schemas.length} schema(s) into ${relativePath}`);
    return true;
  }

  return false;
}

/**
 * Walk directory and process all HTML files
 * @param {string} dir
 * @param {boolean} checkOnly
 * @returns {Object} stats
 */
function processDirectory(dir, checkOnly = false) {
  const stats = { processed: 0, modified: 0, skipped: 0 };

  const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', 'server', 'tests', 'admin', 'embed']);

  function walk(currentDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) {
          walk(fullPath);
        }
      } else if (entry.isFile() && entry.name.endsWith('.html')) {
        stats.processed++;
        try {
          const modified = processFile(fullPath, checkOnly);
          if (modified) stats.modified++;
          else stats.skipped++;
        } catch (err) {
          console.error(`Error processing ${fullPath}:`, err.message);
          stats.skipped++;
        }
      }
    }
  }

  walk(dir);
  return stats;
}

// ── CLI ─────────────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  const checkOnly = args.includes('--check');
  const fileIndex = args.indexOf('--file');

  console.log('JSON-LD Schema Injection Tool\n');

  if (fileIndex >= 0 && args[fileIndex + 1]) {
    const filePath = path.resolve(ROOT, args[fileIndex + 1]);
    if (!fs.existsSync(filePath)) {
      console.error(`Error: File not found: ${filePath}`);
      process.exit(1);
    }
    processFile(filePath, checkOnly);
    console.log('\nDone.');
    return;
  }

  if (checkOnly) {
    console.log('Checking for missing schemas...\n');
  } else {
    console.log('Injecting schemas into all HTML pages...\n');
  }

  const stats = processDirectory(ROOT, checkOnly);

  console.log('\n' + '─'.repeat(50));
  console.log(`Processed: ${stats.processed} files`);
  console.log(`Modified:  ${stats.modified} files`);
  console.log(`Skipped:   ${stats.skipped} files`);
  console.log('─'.repeat(50));

  if (checkOnly && stats.modified === 0) {
    console.log('\n✓ All pages have appropriate schemas');
    process.exit(0);
  } else if (checkOnly) {
    console.log(`\n⚠ ${stats.modified} pages missing schemas`);
    process.exit(1);
  } else {
    console.log('\n✓ Schema injection complete');
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  generateSchemasForPage,
  injectSchemas,
  processFile,
};
