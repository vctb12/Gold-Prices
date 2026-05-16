'use strict';

/**
 * server/routes/billing.js
 *
 * Stripe billing routes mounted at /api/v1/billing/*.
 *
 * Routes:
 *   POST /api/v1/billing/create-checkout-session
 *   POST /api/v1/billing/create-portal-session
 *   POST /api/v1/billing/webhook
 *   GET  /api/v1/billing/status
 *   GET  /api/v1/me/entitlements   (re-exported via publicAccountsRouter in server.js)
 *
 * Safe behaviour when Stripe is unconfigured:
 *   - Checkout and portal return 503 with { configured: false } — never a 500.
 *   - The webhook endpoint returns 503 so Stripe retries are not generated.
 *   - The /status and /me/entitlements endpoints always respond (no Stripe
 *     dependency at read time).
 *
 * Security:
 *   - Webhook signature is verified with stripe.webhooks.constructEvent().
 *   - Events are stored idempotently before any state change.
 *   - Client-only payment success is NEVER trusted; only webhook-confirmed
 *     events update subscription state.
 *   - Checkout redirect URLs are built via site-url.js (no host-header injection).
 */

const express = require('express');
const router = express.Router();

const { buildUrl } = require('../lib/site-url');
const billingRepo = require('../lib/billing-repository');
const { resolveUserEntitlements, ENTITLEMENTS_BY_TIER } = require('../lib/entitlements');
const { appendAuditLog } = billingRepo;

// ---------------------------------------------------------------------------
// Stripe SDK — lazy, fail-safe initialisation
// ---------------------------------------------------------------------------

let _stripe = null;

/**
 * Returns an initialised Stripe client or null when STRIPE_SECRET_KEY is absent.
 */
function getStripe() {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  // Require at call-time so the module load does not fail when stripe is absent.
  try {
    const Stripe = require('stripe');
    _stripe = Stripe(key, { apiVersion: '2024-06-20', appInfo: { name: 'GoldTickerLive' } });
    return _stripe;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Config helpers
// ---------------------------------------------------------------------------

function getBillingConfigured() {
  return Boolean(
    process.env.STRIPE_SECRET_KEY &&
    process.env.STRIPE_WEBHOOK_SECRET &&
    process.env.STRIPE_PUBLISHABLE_KEY
  );
}

function getPriceId(tier, interval) {
  const map = {
    pro: {
      month: process.env.STRIPE_PRICE_PRO_MONTHLY,
      year: process.env.STRIPE_PRICE_PRO_YEARLY || process.env.STRIPE_PRICE_PRO_ANNUAL,
    },
    api: {
      month: process.env.STRIPE_PRICE_API_MONTHLY,
      year: process.env.STRIPE_PRICE_API_YEARLY || process.env.STRIPE_PRICE_API_ANNUAL,
    },
  };
  return map[tier]?.[interval] || null;
}

/**
 * Return the trial period in days from STRIPE_TRIAL_DAYS env var.
 * Returns 0 when set to '0' (disables trial). Defaults to 7.
 */
function _getTrialDays() {
  const raw = process.env.STRIPE_TRIAL_DAYS;
  if (raw === undefined || raw === null || raw === '') return 7;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 7;
}

// ---------------------------------------------------------------------------
// User resolution helper (mirrors public-accounts pattern)
// ---------------------------------------------------------------------------

const { createClient } = (() => {
  try {
    return require('@supabase/supabase-js');
  } catch {
    return { createClient: null };
  }
})();

async function resolveUserFromToken(token) {
  if (!token) return null;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key || !createClient) return null;
  try {
    const client = createClient(url, key, { auth: { persistSession: false } });
    const { data, error } = await client.auth.getUser(token);
    if (error || !data?.user) return null;
    return data.user;
  } catch {
    return null;
  }
}

function extractBearerToken(req) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return null;
  return auth.slice('Bearer '.length).trim() || null;
}

/**
 * Middleware: resolve the authenticated public user and attach to req.billingUser.
 * Returns 401 when no valid token is provided.
 */
async function requireBillingUser(req, res, next) {
  const token = extractBearerToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Authentication required', code: 'UNAUTHORIZED' });
  }
  const user = await resolveUserFromToken(token);
  if (!user?.id) {
    return res.status(401).json({ error: 'Invalid or expired session', code: 'UNAUTHORIZED' });
  }
  req.billingUser = user;
  next();
}

// ---------------------------------------------------------------------------
// POST /api/v1/billing/create-checkout-session
// ---------------------------------------------------------------------------

async function handleCreateCheckoutSession(req, res) {
  if (!getBillingConfigured()) {
    return res.status(503).json({
      error: 'Billing is not configured',
      code: 'BILLING_NOT_CONFIGURED',
      configured: false,
    });
  }

  const stripe = getStripe();
  if (!stripe) {
    return res.status(503).json({ error: 'Stripe client unavailable', code: 'STRIPE_UNAVAILABLE' });
  }

  const { tier, interval = 'month' } = req.body;
  const userId = req.billingUser.id;
  const userEmail = req.billingUser.email;

  if (!['pro', 'api'].includes(tier)) {
    return res.status(400).json({ error: 'Invalid tier. Must be "pro" or "api".' });
  }
  if (!['month', 'year'].includes(interval)) {
    return res.status(400).json({ error: 'Invalid interval. Must be "month" or "year".' });
  }

  const priceId = getPriceId(tier, interval);
  if (!priceId) {
    return res.status(503).json({
      error: 'Price not configured for this tier/interval',
      code: 'PRICE_NOT_CONFIGURED',
    });
  }

  try {
    // Retrieve or create a Stripe customer linked to this user
    const customerRecord = await billingRepo.findCustomerByUserId(userId);
    let stripeCustomerId = customerRecord?.stripeCustomerId;

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: userEmail || undefined,
        metadata: { userId },
      });
      stripeCustomerId = customer.id;
      await billingRepo.upsertCustomer({ userId, stripeCustomerId, email: userEmail });
    }

    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: buildUrl('/content/subscription/success.html?session_id={CHECKOUT_SESSION_ID}'),
      cancel_url: buildUrl('/pricing.html'),
      subscription_data: {
        trial_period_days: _getTrialDays() || undefined,
        metadata: { userId, tier },
      },
      allow_promotion_codes: true,
    });

    await appendAuditLog({
      userId,
      action: 'checkout_session_created',
      tier,
      metadata: { sessionId: session.id, interval },
    });

    return res.json({ sessionId: session.id, url: session.url });
  } catch (err) {
    console.error('[billing] create-checkout-session error:', err.message);
    return res.status(500).json({ error: 'Failed to create checkout session' });
  }
}

router.post('/create-checkout-session', requireBillingUser, handleCreateCheckoutSession);

// ---------------------------------------------------------------------------
// POST /api/v1/billing/create-portal-session
// ---------------------------------------------------------------------------

async function handleCreatePortalSession(req, res) {
  if (!getBillingConfigured()) {
    return res.status(503).json({
      error: 'Billing is not configured',
      code: 'BILLING_NOT_CONFIGURED',
      configured: false,
    });
  }

  const stripe = getStripe();
  if (!stripe) {
    return res.status(503).json({ error: 'Stripe client unavailable', code: 'STRIPE_UNAVAILABLE' });
  }

  const userId = req.billingUser.id;

  try {
    const customerRecord = await billingRepo.findCustomerByUserId(userId);
    if (!customerRecord?.stripeCustomerId) {
      return res.status(404).json({
        error: 'No billing account found. Please subscribe first.',
        code: 'NO_CUSTOMER',
      });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customerRecord.stripeCustomerId,
      return_url: buildUrl('/account.html'),
    });

    return res.json({ url: session.url });
  } catch (err) {
    console.error('[billing] create-portal-session error:', err.message);
    return res.status(500).json({ error: 'Failed to create portal session' });
  }
}

router.post('/create-portal-session', requireBillingUser, handleCreatePortalSession);

// ---------------------------------------------------------------------------
// POST /api/v1/billing/webhook
// NOTE: raw body parsing is registered in server.js and the test harness
// before the global JSON middleware — do NOT add it inline here.
// ---------------------------------------------------------------------------

async function handleWebhook(req, res) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('[billing/webhook] STRIPE_WEBHOOK_SECRET not configured — rejecting event');
    return res.status(503).json({ error: 'Webhook handler not configured' });
  }

  const stripe = getStripe();
  if (!stripe) {
    return res.status(503).json({ error: 'Stripe client unavailable' });
  }

  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('[billing/webhook] Signature verification failed:', err.message);
    // Return plain text — never interpolate error message into HTML
    return res.status(400).type('text/plain').send('Webhook signature verification failed');
  }

  // Idempotency guard — ignore already-processed events
  const alreadyProcessed = await billingRepo.isEventProcessed(event.id);
  if (alreadyProcessed) {
    return res.json({ received: true, duplicate: true });
  }

  // Handle the event
  try {
    await _handleWebhookEvent(event);
  } catch (err) {
    console.error('[billing/webhook] Handler error for', event.type, ':', err.message);
    // Log the failure for operational visibility but do NOT mark the event
    // as processed — Stripe will retry with backoff so transient errors
    // (DB unavailable, Supabase rate-limit, network blip) self-heal.
    await appendAuditLog({
      userId: null,
      action: 'webhook_handler_error',
      tier: null,
      metadata: { eventId: event.id, type: event.type, error: err.message },
    }).catch(() => {}); // swallow — audit log failure must not mask the retry signal
    return res.status(500).json({ error: 'Handler error — will retry' });
  }

  // Mark event as processed only after successful handling
  await billingRepo.recordEvent({
    stripeEventId: event.id,
    type: event.type,
    livemode: event.livemode,
    handledAt: new Date().toISOString(),
  });

  return res.json({ received: true });
}

router.post('/webhook', handleWebhook);

async function _handleWebhookEvent(event) {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const userId = session.metadata?.userId || session.client_reference_id;
      const tier = session.metadata?.tier || 'pro';
      const stripeCustomerId = session.customer;
      const stripeSubscriptionId = session.subscription;

      if (!userId || !stripeSubscriptionId) {
        console.warn(
          '[billing/webhook] checkout.session.completed missing userId or subscriptionId'
        );
        return;
      }

      // Retrieve full subscription object to get period end and interval
      let periodEnd = null;
      let interval = 'month';
      try {
        const stripe = getStripe();
        const sub = await stripe.subscriptions.retrieve(stripeSubscriptionId);
        periodEnd = new Date(sub.current_period_end * 1000);
        interval = sub.items?.data?.[0]?.plan?.interval || 'month';
      } catch (err) {
        console.warn('[billing/webhook] Could not retrieve subscription details:', err.message);
      }

      // Upsert customer link
      await billingRepo.upsertCustomer({
        userId,
        stripeCustomerId,
        email: session.customer_details?.email,
      });

      // Create subscription record
      await billingRepo.createSubscription({
        userId,
        tier,
        stripeCustomerId,
        stripeSubscriptionId,
        status: session.status === 'complete' ? 'active' : 'trialing',
        currentPeriodEnd: periodEnd,
        interval,
      });

      await appendAuditLog({
        userId,
        action: 'subscription_created',
        tier,
        metadata: { stripeSubscriptionId, interval },
      });
      break;
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object;
      const stripeSubscriptionId = sub.id;
      const periodEnd = new Date(sub.current_period_end * 1000);

      await billingRepo.updateSubscription(stripeSubscriptionId, {
        status: sub.status,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: sub.cancel_at_period_end,
      });

      // Resolve userId from customer record for the audit log
      const customerRecord = await billingRepo.findCustomerByStripeId(sub.customer);
      await appendAuditLog({
        userId: customerRecord?.userId,
        action: 'subscription_updated',
        tier: null,
        metadata: { stripeSubscriptionId, status: sub.status },
      });
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object;
      await billingRepo.updateSubscription(sub.id, {
        status: 'canceled',
        canceledAt: new Date(),
      });
      const customerRecord = await billingRepo.findCustomerByStripeId(sub.customer);
      await appendAuditLog({
        userId: customerRecord?.userId,
        action: 'subscription_canceled',
        tier: null,
        metadata: { stripeSubscriptionId: sub.id },
      });
      break;
    }

    case 'invoice.payment_succeeded': {
      const invoice = event.data.object;
      if (invoice.subscription) {
        await billingRepo.updateSubscription(invoice.subscription, {
          status: 'active',
        });
      }
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object;
      if (invoice.subscription) {
        await billingRepo.updateSubscription(invoice.subscription, {
          status: 'past_due',
        });
      }
      const customerRecord = await billingRepo.findCustomerByStripeId(invoice.customer);
      await appendAuditLog({
        userId: customerRecord?.userId,
        action: 'payment_failed',
        tier: null,
        metadata: { invoiceId: invoice.id },
      });
      break;
    }

    default:
      // Unhandled events are silently acknowledged
      break;
  }
}

// ---------------------------------------------------------------------------
// GET /api/v1/billing/status
// ---------------------------------------------------------------------------

async function handleBillingStatus(req, res) {
  const configured = getBillingConfigured();
  const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY || null;

  // User-specific subscription info (optional — requires auth token)
  let userSubscription = null;
  const token = extractBearerToken(req);
  if (token) {
    try {
      const user = await resolveUserFromToken(token);
      if (user?.id) {
        const { tier, subscription, entitlements } = await resolveUserEntitlements(user.id);
        userSubscription = {
          userId: user.id,
          tier,
          status: subscription?.status || 'active',
          currentPeriodEnd: subscription?.currentPeriodEnd || null,
          cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd || false,
          entitlements,
        };
      }
    } catch {
      // Swallow — auth is optional for /status
    }
  }

  return res.json({
    configured,
    publishableKey: configured ? publishableKey : null,
    plans: {
      pro: {
        priceMonthly: 4.99,
        priceYearly: 49.99,
        entitlements: ENTITLEMENTS_BY_TIER.pro,
      },
      api: {
        priceMonthly: 19.99,
        priceYearly: 199.99,
        entitlements: ENTITLEMENTS_BY_TIER.api,
      },
    },
    subscription: userSubscription,
  });
}

router.get('/status', handleBillingStatus);

// ---------------------------------------------------------------------------
// GET /api/v1/billing/config (publishable key for Stripe.js)
// ---------------------------------------------------------------------------

function handleBillingConfig(_req, res) {
  const configured = getBillingConfigured();
  return res.json({
    configured,
    publishableKey: configured ? process.env.STRIPE_PUBLISHABLE_KEY || null : null,
  });
}

router.get('/config', handleBillingConfig);

// ---------------------------------------------------------------------------
// meRouter — mounted at /api/v1/me in server.js
// Exposes GET /entitlements at /api/v1/me/entitlements
// ---------------------------------------------------------------------------

const meRouter = express.Router();

async function handleMeEntitlements(req, res) {
  try {
    const { tier, subscription, entitlements } = await resolveUserEntitlements(req.billingUser.id);
    return res.json({
      userId: req.billingUser.id,
      tier,
      status: subscription?.status || 'active',
      currentPeriodEnd: subscription?.currentPeriodEnd || null,
      entitlements,
    });
  } catch (err) {
    console.error('[billing] /me/entitlements error:', err.message);
    return res.status(500).json({ error: 'Failed to resolve entitlements' });
  }
}

meRouter.get('/entitlements', requireBillingUser, handleMeEntitlements);

module.exports = router;
module.exports.meRouter = meRouter;
module.exports.handlers = {
  requireBillingUser,
  handleCreateCheckoutSession,
  handleCreatePortalSession,
  handleWebhook,
  handleBillingStatus,
  handleBillingConfig,
  handleMeEntitlements,
};
