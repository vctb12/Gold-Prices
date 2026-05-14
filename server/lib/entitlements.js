'use strict';

/**
 * server/lib/entitlements.js
 *
 * Resolves feature flags (entitlements) for a user based on their active
 * subscription tier.
 *
 * Feature flags:
 *   alertLimit          — max price alerts (int)
 *   historyDays         — days of historical data accessible (int, 0 = unlimited)
 *   savedCalcLimit      — max saved calculations (int)
 *   apiAccess           — can use the API tier endpoints (bool)
 *   apiCallsPerDay      — daily API call quota (int)
 *   exportFormats       — allowed export format strings (string[])
 *   webPush             — web push notification delivery (bool)
 *   emailAlerts         — email delivery of price alerts (bool)
 *   adsEnabled          — whether ads are shown (bool)
 *   portfolioLimit      — max portfolio positions (int)
 *   webhookSupport      — outbound webhook delivery (bool)
 *   prioritySupport     — priority support flag (bool)
 */

const billingRepo = require('./billing-repository');

// ---------------------------------------------------------------------------
// Tier definitions
// ---------------------------------------------------------------------------

const TIERS = Object.freeze(['free', 'pro', 'api']);

const ENTITLEMENTS_BY_TIER = Object.freeze({
  free: Object.freeze({
    tier: 'free',
    alertLimit: 3,
    historyDays: 30,
    savedCalcLimit: 5,
    apiAccess: false,
    apiCallsPerDay: 0,
    exportFormats: Object.freeze(['csv']),
    webPush: false,
    emailAlerts: false,
    adsEnabled: true,
    portfolioLimit: 1,
    webhookSupport: false,
    prioritySupport: false,
  }),
  pro: Object.freeze({
    tier: 'pro',
    alertLimit: 50,
    historyDays: 365,
    savedCalcLimit: 100,
    apiAccess: false,
    apiCallsPerDay: 0,
    exportFormats: Object.freeze(['csv', 'json', 'excel']),
    webPush: true,
    emailAlerts: true,
    adsEnabled: false,
    portfolioLimit: 10,
    webhookSupport: false,
    prioritySupport: true,
  }),
  api: Object.freeze({
    tier: 'api',
    alertLimit: 100,
    historyDays: 0,
    savedCalcLimit: 500,
    apiAccess: true,
    apiCallsPerDay: 500,
    exportFormats: Object.freeze(['csv', 'json', 'excel']),
    webPush: true,
    emailAlerts: true,
    adsEnabled: false,
    portfolioLimit: 50,
    webhookSupport: true,
    prioritySupport: true,
  }),
});

// ---------------------------------------------------------------------------
// Public helpers
// ---------------------------------------------------------------------------

/**
 * Return the entitlements for a given tier name.
 * Falls back to 'free' for unknown tiers.
 * @param {string} tier
 * @returns {object}
 */
function getEntitlementsForTier(tier) {
  return ENTITLEMENTS_BY_TIER[tier] || ENTITLEMENTS_BY_TIER.free;
}

/**
 * Resolve the full entitlement object for a user.
 * Looks up their active subscription from billing-repository, then maps
 * to tier feature flags.
 *
 * @param {string} userId
 * @returns {Promise<{ tier, subscription, entitlements }>}
 */
async function resolveUserEntitlements(userId) {
  if (!userId) {
    return {
      tier: 'free',
      subscription: null,
      entitlements: getEntitlementsForTier('free'),
    };
  }

  let tier = 'free';
  let subscription = null;

  try {
    subscription = await billingRepo.getActiveSubscription(userId);
    if (subscription && TIERS.includes(subscription.tier)) {
      tier = subscription.tier;
    }
  } catch (err) {
    console.error('[entitlements] resolveUserEntitlements error:', err.message);
  }

  return {
    tier,
    subscription,
    entitlements: getEntitlementsForTier(tier),
  };
}

/**
 * Check whether a user has access to a named boolean feature flag.
 * @param {string} userId
 * @param {string} flag  — e.g. 'apiAccess', 'webPush'
 * @returns {Promise<boolean>}
 */
async function hasFeature(userId, flag) {
  const { entitlements } = await resolveUserEntitlements(userId);
  return Boolean(entitlements[flag]);
}

/**
 * Return a numeric limit for a feature (e.g. alertLimit).
 * Returns 0 when the feature is not found.
 * @param {string} userId
 * @param {string} flag  — e.g. 'alertLimit', 'apiCallsPerDay'
 * @returns {Promise<number>}
 */
async function getLimit(userId, flag) {
  const { entitlements } = await resolveUserEntitlements(userId);
  const val = entitlements[flag];
  return typeof val === 'number' ? val : 0;
}

module.exports = {
  TIERS,
  ENTITLEMENTS_BY_TIER,
  getEntitlementsForTier,
  resolveUserEntitlements,
  hasFeature,
  getLimit,
};
