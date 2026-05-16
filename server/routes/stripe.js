'use strict';

/**
 * Legacy Stripe compatibility routes.
 *
 * Canonical billing surface lives at /api/v1/billing/*.
 * This router preserves older /api/stripe/* and /api/v1/stripe/* callers while
 * attaching deprecation metadata and delegating to the canonical handlers.
 */

const express = require('express');
const billingRoutes = require('./billing');

const router = express.Router();
const { handlers } = billingRoutes;

const CANONICAL_ROUTE_MAP = Object.freeze({
  '/config': '/api/v1/billing/config',
  '/status': '/api/v1/billing/status',
  '/webhook': '/api/v1/billing/webhook',
  '/create-checkout': '/api/v1/billing/create-checkout-session',
  '/create-checkout-session': '/api/v1/billing/create-checkout-session',
  '/create-portal': '/api/v1/billing/create-portal-session',
  '/create-portal-session': '/api/v1/billing/create-portal-session',
});

function applyDeprecationHeaders(req, res, canonicalPath) {
  if (!canonicalPath) return;
  const host = req.get('host');
  const absoluteCanonicalPath = host ? `${req.protocol}://${host}${canonicalPath}` : canonicalPath;
  res.setHeader('Deprecation', 'true');
  res.setHeader('Sunset', 'Wed, 31 Dec 2026 23:59:59 GMT');
  res.setHeader('Link', `<${absoluteCanonicalPath}>; rel="successor-version"`);
  res.setHeader('X-Canonical-Route', canonicalPath);
}

function withDeprecation(canonicalPath, ...middlewares) {
  return [
    (req, res, next) => {
      applyDeprecationHeaders(req, res, canonicalPath);
      next();
    },
    ...middlewares,
  ];
}

router.get(
  '/config',
  ...withDeprecation(CANONICAL_ROUTE_MAP['/config'], handlers.handleBillingConfig)
);
router.get(
  '/status',
  ...withDeprecation(CANONICAL_ROUTE_MAP['/status'], handlers.handleBillingStatus)
);

router.post(
  '/create-checkout',
  ...withDeprecation(
    CANONICAL_ROUTE_MAP['/create-checkout'],
    handlers.requireBillingUser,
    handlers.handleCreateCheckoutSession
  )
);
router.post(
  '/create-checkout-session',
  ...withDeprecation(
    CANONICAL_ROUTE_MAP['/create-checkout-session'],
    handlers.requireBillingUser,
    handlers.handleCreateCheckoutSession
  )
);
router.post(
  '/create-portal',
  ...withDeprecation(
    CANONICAL_ROUTE_MAP['/create-portal'],
    handlers.requireBillingUser,
    handlers.handleCreatePortalSession
  )
);
router.post(
  '/create-portal-session',
  ...withDeprecation(
    CANONICAL_ROUTE_MAP['/create-portal-session'],
    handlers.requireBillingUser,
    handlers.handleCreatePortalSession
  )
);
router.post(
  '/webhook',
  ...withDeprecation(CANONICAL_ROUTE_MAP['/webhook'], handlers.handleWebhook)
);

module.exports = router;
