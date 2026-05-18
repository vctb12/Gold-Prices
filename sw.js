/**
 * Gold Ticker Live Service Worker v16
 *
 * Caching strategy:
 *   Precache    — main HTML shells, offline/404 pages (kept small).
 *   Runtime SWR — country/city/guide HTML, images (added lazily on first visit).
 *   Network-first — /data/gold_price.json (price freshness is critical).
 *   Cache-first   — versioned static assets (CSS, JS, fonts, manifests).
 *   Bypass        — /admin/*, /api/*, external FX APIs, ?nocache requests.
 *
 * Deployment base path: '/' (custom domain goldtickerlive.com).
 */

const CACHE_NAME = 'goldtickerlive-v16';
const RUNTIME_CACHE = 'goldtickerlive-runtime-v16';

// Static assets to pre-cache on install — kept intentionally small.
// Country/city/guide pages are added lazily to RUNTIME_CACHE on first visit.
const PRECACHE_URLS = [
  '/',
  '/tracker.html',
  '/shops.html',
  '/calculator.html',
  '/learn.html',
  '/insights.html',
  '/methodology.html',
  '/invest.html',
  '/offline.html',
  '/404.html',
];

// External origins that bypass the SW entirely (live FX data).
const BYPASS_ORIGINS = ['open.er-api.com'];

// Same-origin paths that must always go to the network — no SW cache.
// Gold price JSON is freshness-sensitive; caching it risks showing stale prices.
const NETWORK_ONLY_PATHS = ['/data/gold_price.json', '/data/last_gold_price.json'];

// ─────────────────────────────────────────────────────────────────────────────
// INSTALL — pre-cache the static shell
// ─────────────────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        cache.addAll(PRECACHE_URLS).catch((err) => {
          // Don't fail install if some assets are missing (e.g. dev environment)
          console.warn('[SW] Pre-cache partial failure:', err.message);
        })
      )
      .then(() => self.skipWaiting())
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// ACTIVATE — purge old caches, claim clients, notify tabs of the update
// ─────────────────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  const currentCaches = new Set([CACHE_NAME, RUNTIME_CACHE]);
  event.waitUntil(
    caches
      .keys()
      .then((keys) => {
        const stale = keys.filter((k) => !currentCaches.has(k));
        const isUpdate = stale.length > 0;
        return Promise.all(stale.map((k) => caches.delete(k))).then(() => isUpdate);
      })
      .then((isUpdate) =>
        self.clients.claim().then(() => {
          // Notify open tabs that a new SW version is active so the page can
          // show a "refresh to apply" toast. Only fire on actual updates —
          // not on the very first install — to avoid a spurious toast.
          if (isUpdate) {
            return self.clients.matchAll({ type: 'window' }).then((clients) => {
              clients.forEach((client) => client.postMessage({ type: 'SW_UPDATED' }));
            });
          }
        })
      )
  );
});

// Allow clients to trigger skipWaiting (e.g. from an "Update" button in the page).
self.addEventListener('message', (event) => {
  if (!event.data) return;
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// FETCH — routing strategy
// ─────────────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle GET requests.
  if (request.method !== 'GET') return;
  // Bypass non-http(s) schemes (chrome-extension, blob, data, …).
  if (!url.protocol.startsWith('http')) return;

  // Legacy GitHub Pages base-path redirect support.
  // Keep this pattern in sync with `_redirects` and `.htaccess`.
  // Ensures /Gold-Prices/* normalizes to /* for old links and bookmarks.
  if (url.origin === self.location.origin && /^\/Gold-Prices(?:\/|$)/.test(url.pathname)) {
    const normalizedPath = url.pathname.replace(/^\/Gold-Prices/, '') || '/';
    event.respondWith(Response.redirect(`${url.origin}${normalizedPath}${url.search}`, 301));
    return;
  }

  // Bypass external FX/price API origins.
  if (BYPASS_ORIGINS.some((o) => url.hostname.includes(o))) return;
  // Bypass explicit ?nocache requests — let the browser go straight to network.
  if (url.searchParams.has('nocache')) return;

  // Never cache admin or API routes — always go straight to the network.
  if (url.pathname.startsWith('/admin/') || url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(request));
    return;
  }

  // Network-only for price JSON — freshness is critical.
  if (NETWORK_ONLY_PATHS.some((p) => url.pathname === p)) {
    event.respondWith(networkOnly(request));
    return;
  }

  // Navigation requests
  if (request.mode === 'navigate') {
    // Country, city, market, and guide pages — stale-while-revalidate so
    // returning visitors load instantly and get a fresh copy in the background.
    if (isRuntimeCacheCandidate(url)) {
      event.respondWith(staleWhileRevalidate(request, RUNTIME_CACHE));
    } else {
      event.respondWith(networkFirstWithFallback(request));
    }
    return;
  }

  // Images — stale-while-revalidate via runtime cache.
  if (request.destination === 'image') {
    event.respondWith(staleWhileRevalidate(request, RUNTIME_CACHE));
    return;
  }

  // Versioned static assets (CSS, JS, fonts, manifests) — cache-first.
  if (shouldCacheRequest(request, url)) {
    event.respondWith(cacheFirstWithUpdate(request));
    return;
  }

  // Everything else: plain network fetch with a graceful 503 fallback.
  event.respondWith(fetch(request).catch(() => new Response('', { status: 503 })));
});

// ─────────────────────────────────────────────────────────────────────────────
// STRATEGIES
// ─────────────────────────────────────────────────────────────────────────────

/** Network-only: no cache read or write (used for price JSON). */
async function networkOnly(request) {
  try {
    return await fetch(request);
  } catch {
    return new Response(JSON.stringify({ error: 'offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Network-first: try network → fall back to cache → offline.html.
 * Used for the main HTML shell pages.
 */
async function networkFirstWithFallback(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;

    // Resilient offline fallback for navigation
    const offlinePage = await caches.match('/offline.html');
    if (offlinePage) return offlinePage;
    const shell = await caches.match('/');
    if (shell) return shell;

    return new Response('Offline — cached version unavailable.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain' },
    });
  }
}

/**
 * Stale-while-revalidate: serve the cached copy immediately while fetching a
 * fresh version in the background. Used for country/guide pages and images.
 */
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  // Kick off a background revalidation regardless of whether we have a cache
  // hit — this is the "revalidate" half of stale-while-revalidate. Intentional:
  // returning visitors load instantly from cache while the page is refreshed
  // silently so the *next* visit is also fast and fresh.
  const networkPromise = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);

  if (cached) return cached;

  // No cached copy yet — wait for the network.
  const networkResponse = await networkPromise;
  if (networkResponse) return networkResponse;

  // Offline and no cache — serve the offline fallback.
  const offlinePage = await caches.match('/offline.html');
  if (offlinePage) return offlinePage;
  return new Response('Offline — cached version unavailable.', {
    status: 503,
    headers: { 'Content-Type': 'text/plain' },
  });
}

/**
 * Cache-first with background update.
 * Used for versioned/fingerprinted static assets (CSS, JS, fonts).
 */
async function cacheFirstWithUpdate(request) {
  const cached = await caches.match(request);
  if (cached) {
    fetchAndCache(request, CACHE_NAME);
    return cached;
  }
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('', { status: 503 });
  }
}

function fetchAndCache(request, cacheName) {
  fetch(request)
    .then((response) => {
      if (response.ok) {
        caches.open(cacheName).then((cache) => cache.put(request, response));
      }
    })
    .catch(() => {});
}

/**
 * Returns true for URL patterns that should use the runtime SWR cache:
 * country, city, market, and content/guide pages.
 */
function isRuntimeCacheCandidate(url) {
  const p = url.pathname;
  return p.startsWith('/countries/') || p.startsWith('/content/');
}

/**
 * Returns true if the request should use the cache-first strategy.
 * Only same-origin, query-free style/script/font/manifest requests qualify.
 */
function shouldCacheRequest(request, url) {
  if (url.origin !== self.location.origin) return false;
  // Query-param requests can explode cache cardinality; skip.
  if (url.search) return false;
  const cacheableDestinations = new Set(['style', 'script', 'font', 'manifest']);
  return cacheableDestinations.has(request.destination);
}
