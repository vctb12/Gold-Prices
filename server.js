/**
 * Express Server for Gold Ticker Live
 * Includes admin API routes and static file serving
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');
const fsp = require('fs').promises;
const rateLimit = require('express-rate-limit');
const { errorHandler } = require('./server/lib/errors');
const { createRequestLogger } = require('./server/lib/request-logger');
const { validateServerEnv } = require('./server/lib/env-validation');
const { successResponse } = require('./server/lib/api-response');

const app = express();
const PORT = process.env.PORT || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

// Trust the first proxy hop when running behind a reverse proxy / load balancer
// (Vercel, Cloudflare, Nginx). Without this, express-rate-limit keys on the
// proxy IP and the whole internet shares one bucket. Only enable in production
// where a known proxy terminates TLS.
if (IS_PROD) app.set('trust proxy', 1);

// Import routes
const adminRoutes = require('./server/routes/admin');
const stripeRoutes = require('./server/routes/stripe');
const newsletterRoutes = require('./server/routes/newsletter');
const submissionsRoutes = require('./server/routes/submissions');
const leadsRoutes = require('./server/routes/leads');
const apiV1Routes = require('./server/routes/api-v1');
const alertsRoutes = require('./server/routes/alerts');

// Validate environment feature wiring at startup without crashing optional integrations.
validateServerEnv(process.env, console);

// ---------------------------------------------------------------------------
// Security headers (Helmet)
// ---------------------------------------------------------------------------
// CSP is intentionally disabled in development for ease of debugging.
// In production (NODE_ENV=production), a strict CSP is enforced.
//
// NOTE: Inline analytics (gtag + Clarity) were externalized to
// `assets/analytics.js` by `scripts/node/externalize-analytics.js`, so
// `'unsafe-inline'` is no longer required in `scriptSrc`. The only inline
// HTML we still serve is structured-data JSON-LD, which lives in
// `<script type="application/ld+json">` blocks — those are ignored by CSP
// because they are not executable scripts.
app.use(
  helmet({
    contentSecurityPolicy: IS_PROD
      ? {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: [
              "'self'",
              'https://cdn.jsdelivr.net',
              'https://www.googletagmanager.com',
              'https://www.clarity.ms',
              'https://pagead2.googlesyndication.com',
              'https://www.google-analytics.com',
            ],
            styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
            fontSrc: ["'self'", 'https://fonts.gstatic.com'],
            imgSrc: ["'self'", 'data:', 'https:'],
            connectSrc: [
              "'self'",
              'https://open.er-api.com',
              'https://www.google-analytics.com',
              'https://*.supabase.co',
              'https://www.clarity.ms',
              'https://nominatim.openstreetmap.org',
            ],
            frameSrc: ["'self'", 'https://pagead2.googlesyndication.com'],
            frameAncestors: ["'none'"],
            objectSrc: ["'none'"],
            baseUri: ["'self'"],
            formAction: ["'self'"],
            workerSrc: ["'self'", 'blob:'],
            manifestSrc: ["'self'"],
            upgradeInsecureRequests: [],
          },
        }
      : {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'https:'],
            styleSrc: ["'self'", "'unsafe-inline'", 'https:'],
            imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
            fontSrc: ["'self'", 'data:', 'https:'],
            connectSrc: ["'self'", 'http://localhost:*', 'ws://localhost:*', 'https:'],
            objectSrc: ["'none'"],
            frameAncestors: ["'none'"],
            baseUri: ["'self'"],
            formAction: ["'self'"],
          },
        },
    crossOriginEmbedderPolicy: false,
    // Explicit cross-origin isolation knobs rather than Helmet defaults, so the
    // intent is visible at the server entry-point.
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    crossOriginResourcePolicy: { policy: 'same-origin' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    hsts: IS_PROD ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false,
  })
);

// Permissions-Policy — explicitly disable browser features we never use, in
// parity with the static-tier `_headers` / `.htaccess` configuration. Helmet
// does not yet expose a first-class option for Permissions-Policy, so this is
// set as a small custom middleware. Plan: docs/plans/2026-04-24_security-
// performance-deps-audit.md Track A #14.
const PERMISSIONS_POLICY =
  'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=(), interest-cohort=()';
app.use((req, res, next) => {
  res.setHeader('Permissions-Policy', PERMISSIONS_POLICY);
  next();
});

// CORS — restrict origins in production.
// In production, always set CORS_ORIGINS (comma-separated) to avoid rejecting all cross-origin requests.
// Example: CORS_ORIGINS=https://goldtickerlive.com,https://www.goldtickerlive.com
const ALLOWED_ORIGINS = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim())
  : null; // null → allow all (development only)

if (IS_PROD && !ALLOWED_ORIGINS) {
  console.warn(
    '[server] WARNING: CORS_ORIGINS is not set in production. ' +
      'Cross-origin requests will be rejected.'
  );
}
app.use(
  cors(
    ALLOWED_ORIGINS
      ? {
          origin(origin, cb) {
            // Allow requests with no origin (server-to-server, curl, etc.)
            if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
            cb(new Error('Not allowed by CORS'));
          },
          optionsSuccessStatus: 204,
        }
      : IS_PROD
        ? {
            // In production without explicit origins, reject all cross-origin requests
            origin(origin, cb) {
              if (!origin) return cb(null, true); // same-origin / server-to-server
              cb(new Error('Not allowed by CORS'));
            },
            optionsSuccessStatus: 204,
          }
        : { optionsSuccessStatus: 204 } // development: allow all, but normalise preflight status
  )
);

// Structured request logs for production observability.
app.use(createRequestLogger());

// Stripe webhooks require the raw request body for signature verification.
// This must be registered before the global JSON body parser.
app.use(
  ['/api/stripe/webhook', '/api/v1/stripe/webhook'],
  express.raw({ type: 'application/json' })
);

// Body parsing with size limits.
// urlencoded is intentionally tighter than json — no current route consumes
// large form-urlencoded payloads (Track A #16).
app.use(express.json({ limit: '256kb' }));
app.use(express.urlencoded({ extended: true, limit: '16kb' }));

// ---------------------------------------------------------------------------
// Global rate limiter
// ---------------------------------------------------------------------------
// Broad per-IP ceiling that sits in front of every route. Route-level limiters
// (login, PIN verify, admin mutations) live alongside their handlers and apply
// tighter limits on top of this. The goal of the global limiter is to blunt
// scraping and brute-force pressure across the site as a whole — not to be the
// sole defence for sensitive endpoints.
//
// The static-asset regex is hoisted to module scope so it is compiled once per
// process rather than once per request.
const STATIC_ASSET_RX = /\.(?:css|js|mjs|map|png|jpe?g|gif|webp|avif|svg|ico|woff2?|ttf)$/i;

const globalRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: IS_PROD ? 300 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
  // Skip long-cache static files; HTML and API still count against the budget.
  skip: (req) => STATIC_ASSET_RX.test(req.path),
  message: { success: false, message: 'Too many requests. Please slow down.' },
});
app.use(globalRateLimiter);

// Slightly tighter limiter for the whole /api surface. Admin routes layer a
// third limiter on top for authenticated mutations.
const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: IS_PROD ? 120 : 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many API requests. Please slow down.' },
});
app.use('/api/', apiRateLimiter);

// ---------------------------------------------------------------------------
// Static file serving
// ---------------------------------------------------------------------------
const DIST_DIR = path.resolve(__dirname, 'dist');
const SRC_DIR = path.resolve(__dirname, 'src');
const NOT_FOUND_PAGE = path.join(DIST_DIR, '404.html');

// phx/21: dev-mode 404 logging. Writes a ring buffer of recent 404 requests to
// data/404-logs.json so we can spot broken-link patterns during development.
// No-op in production (avoids disk writes on hot paths and accidental PII).
//
// Async fs (Track A #11 / Track B #2): a tiny serial queue keeps concurrent
// 404s from racing each other on the same file. We deliberately fire-and-forget
// from the request path so logging cannot block the response.
const NOT_FOUND_LOG_PATH = path.join(__dirname, 'data', '404-logs.json');
const NOT_FOUND_LOG_MAX = 500;
let _notFoundWriteChain = Promise.resolve();
async function appendNotFoundEntry(entry) {
  let entries = [];
  try {
    const raw = await fsp.readFile(NOT_FOUND_LOG_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) entries = parsed;
  } catch (err) {
    if (err && err.code !== 'ENOENT') {
      // Corrupt JSON or unreadable file — start fresh; never throw past here.
      entries = [];
    }
  }
  entries.push(entry);
  if (entries.length > NOT_FOUND_LOG_MAX) {
    entries = entries.slice(-NOT_FOUND_LOG_MAX);
  }
  await fsp.mkdir(path.dirname(NOT_FOUND_LOG_PATH), { recursive: true });
  await fsp.writeFile(NOT_FOUND_LOG_PATH, JSON.stringify(entries, null, 2));
}
function logNotFound(req) {
  if (IS_PROD) return;
  const entry = {
    ts: new Date().toISOString(),
    method: req.method,
    path: req.originalUrl || req.url,
    referer: req.get('referer') || null,
    ua: (req.get('user-agent') || '').slice(0, 200),
  };
  // Chain writes so concurrent 404s do not interleave. Swallow errors — logging
  // must never break the response.
  _notFoundWriteChain = _notFoundWriteChain.then(() => appendNotFoundEntry(entry)).catch(() => {});
}

function send404(res, req) {
  if (req) logNotFound(req);
  if (fs.existsSync(NOT_FOUND_PAGE)) return res.status(404).sendFile(NOT_FOUND_PAGE);
  return res.status(404).type('text/plain').send('Not Found');
}

app.use('/', express.static(DIST_DIR));

// Serve source files for development only — scoped to the src/ subdirectory.
if (!IS_PROD) {
  app.use('/src', express.static(SRC_DIR));
}

// API routes
app.use('/api/admin', adminRoutes);
app.use('/api/stripe', stripeRoutes);
app.use('/api/newsletter', newsletterRoutes);
app.use('/api', submissionsRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/stripe', stripeRoutes);
app.use('/api/v1/newsletter', newsletterRoutes);
app.use('/api/v1', submissionsRoutes);
app.use('/api/v1', leadsRoutes);
app.use('/api/v1', apiV1Routes);
app.use('/api/v1', alertsRoutes);

// Health check endpoint
app.get('/api/health', (_req, res) => {
  const payload = {
    status: 'ok',
    timestamp: new Date().toISOString(),
  };
  // Preserve legacy shape while exposing the new API envelope fields.
  res.json({
    ...payload,
    ...successResponse(payload, { source: 'legacy-health', freshness: 'live' }),
  });
});

// Legacy status endpoint mirrors v1 readiness snapshot entry point.
app.get('/api/status', (_req, res) => {
  res.redirect(307, '/api/v1/status');
});

// Redirect /admin to the Supabase-integrated admin panel
app.get('/admin', (req, res) => {
  res.redirect(301, '/admin/');
});

// ---------------------------------------------------------------------------
// Path-traversal-safe static fallback
// ---------------------------------------------------------------------------
// We use the canonical `path.relative` + `..` / `isAbsolute` check that CodeQL
// (and every mainstream SAST) recognises as a concrete sanitizer for
// `js/path-injection`. `path.normalize` alone is insufficient — see CodeQL
// documentation. Returning a newly-constructed path under the known-safe root
// ensures the downstream `fs` / `res.sendFile` call is not tainted by the raw
// user input at all.
const TRAVERSAL_RX = /(^|[/\\])\.\.(?=[/\\]|$)/;

function safeResolveUnderRoot(root, userPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(userPath || '');
  } catch {
    // Malformed percent-encoding → treat as not found rather than 500.
    return null;
  }
  // Defence in depth: reject null bytes and any literal `..` segment before
  // touching the filesystem, so the intent is obvious to readers and to
  // static analysis, and `path.relative` below does not even run for an
  // obvious attack.
  if (!decoded || decoded.includes('\0')) return null;
  if (TRAVERSAL_RX.test(decoded)) return null;

  const stripped = decoded.replace(/^[/\\]+/, '');
  const candidate = path.resolve(root, stripped);
  const relative = path.relative(root, candidate);

  // Canonical CodeQL-recognised guard: if `path.relative` produces a path that
  // starts with `..` or is absolute, the candidate escapes the root.
  if (relative.startsWith('..') || path.isAbsolute(relative)) return null;

  // Reconstruct the final path from the *known-safe* root plus the
  // resolved-relative component. This is the pattern that breaks the taint
  // chain for `js/path-injection`.
  return relative ? path.join(root, relative) : root;
}

// Handle static file serving with explicit 404 handling.
// Implemented as middleware (not `app.get('*')`) because Express 5's
// path-to-regexp no longer accepts a bare `*` as a path pattern.
//
// Disk I/O here uses `fs.promises.stat` (not `fs.statSync`) so that 404-heavy
// scraping workloads no longer block the event loop per request. See
// docs/plans/2026-04-24_security-performance-deps-audit.md Track B #1.
app.use(async (req, res, _next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return res.status(405).end();

  const resolved = safeResolveUnderRoot(DIST_DIR, req.path);
  if (!resolved) {
    return send404(res, req);
  }

  // If the request targets a static file extension, try to serve it and
  // fall back to the 404 page when missing. Safety of `resolved` is
  // established by `safeResolveUnderRoot`.
  if (path.extname(req.path)) {
    let stat;
    try {
      stat = await fs.promises.stat(resolved);
    } catch {
      return send404(res, req);
    }
    if (stat.isFile()) return res.sendFile(resolved);
    return send404(res, req);
  }

  // Directory-like requests prefer index.html. Re-resolve through the root
  // check so nothing escapes DIST_DIR.
  const indexCandidate = safeResolveUnderRoot(DIST_DIR, path.posix.join(req.path, 'index.html'));
  if (indexCandidate) {
    try {
      const indexStat = await fs.promises.stat(indexCandidate);
      if (indexStat.isFile()) return res.sendFile(indexCandidate);
    } catch {
      // fall through to 404
    }
  }

  // This is a multi-page static site, not a SPA, so unknown URLs must 404
  // rather than silently returning the homepage. Returning index.html here
  // would (a) confuse SEO crawlers with soft-404s and (b) turn every
  // nonexistent URL into a 200, which defeats path-traversal guards.
  return send404(res, req);
});

// Centralized error handling middleware (must be last)
app.use(errorHandler);

// Start server only when this module is run directly (not when required by
// tests). This keeps `require('./server')` a pure side-effect-free export.
if (require.main === module) {
  app.listen(PORT, () => {
    console.log('\n🚀 Gold Ticker Live Server');
    console.log(`   Local:   http://localhost:${PORT}`);
    console.log(`   Admin:   http://localhost:${PORT}/admin`);
    console.log(`   API:     http://localhost:${PORT}/api/admin`);
    console.log(`   Health:  http://localhost:${PORT}/api/health\n`);
  });
}

module.exports = app;
