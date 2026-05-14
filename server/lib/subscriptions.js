/**
 * server/lib/subscriptions.js
 *
 * Subscription management logic for premium tiers.
 * Delegates persistence to billing-repository.js; callers that only need
 * tier/feature data should prefer entitlements.js.
 *
 * Tiers:
 * - free: AdSense ads, basic features, 3 alerts
 * - pro: Ad-free, advanced alerts, push/email, priority support ($4.99/month)
 * - api: Pro features + API access (500 calls/day), webhooks ($19.99/month)
 */

const billingRepo = require('./billing-repository');
const { resolveUserEntitlements, getEntitlementsForTier } = require('./entitlements');

const SUBSCRIPTION_TIERS = {
  FREE: 'free',
  PRO: 'pro',
  API: 'api',
};

const TIER_FEATURES = {
  free: {
    name: 'Free',
    price: 0,
    features: getEntitlementsForTier('free'),
  },
  pro: {
    name: 'Pro',
    priceMonthly: 4.99,
    priceAnnual: 49.99,
    features: getEntitlementsForTier('pro'),
  },
  api: {
    name: 'API',
    priceMonthly: 19.99,
    priceAnnual: 199.99,
    features: getEntitlementsForTier('api'),
  },
};

/**
 * Get subscription tier for a user
 * @param {string} userId - User ID from Supabase auth
 * @returns {Promise<{tier: string, features: object, status: string, expiresAt: Date|null}>}
 */
async function getUserSubscription(userId) {
  if (!userId) {
    return {
      tier: SUBSCRIPTION_TIERS.FREE,
      features: TIER_FEATURES.free.features,
      status: 'active',
      expiresAt: null,
    };
  }

  const { tier, subscription } = await resolveUserEntitlements(userId);
  return {
    tier,
    features: getEntitlementsForTier(tier),
    status: subscription?.status || 'active',
    expiresAt: subscription?.currentPeriodEnd || null,
  };
}

/**
 * Check if user has access to a specific feature
 * @param {string} userId - User ID
 * @param {string} feature - Feature name (e.g., 'webPush', 'apiAccess')
 * @returns {Promise<boolean>}
 */
async function hasFeatureAccess(userId, feature) {
  const subscription = await getUserSubscription(userId);
  return subscription.features[feature] === true;
}

/**
 * Get feature limit for a user
 * @param {string} userId - User ID
 * @param {string} feature - Feature name (e.g., 'alertLimit', 'apiCallsPerDay')
 * @returns {Promise<number>}
 */
async function getFeatureLimit(userId, feature) {
  const subscription = await getUserSubscription(userId);
  return subscription.features[feature] || 0;
}

/**
 * Check if user can perform action based on usage limits
 * @param {string} userId - User ID
 * @param {string} action - Action type (e.g., 'create_alert', 'api_call')
 * @returns {Promise<{allowed: boolean, limit: number, current: number}>}
 */
async function checkUsageLimit(userId, action) {
  const subscription = await getUserSubscription(userId);

  // Map actions to feature limits
  const limitMap = {
    create_alert: 'alertLimit',
    create_portfolio: 'portfolioLimit',
    api_call: 'apiCallsPerDay',
    save_calculation: 'savedCalcLimit',
  };

  const limitKey = limitMap[action];
  if (!limitKey) {
    return { allowed: true, limit: Infinity, current: 0 };
  }

  const limit = subscription.features[limitKey] || 0;

  // TODO: Query actual usage from database
  const currentUsage = 0;

  return {
    allowed: currentUsage < limit,
    limit,
    current: currentUsage,
  };
}

/**
 * Create or update subscription record
 * @param {object} params - Subscription parameters
 * @returns {Promise<object>}
 */
async function createSubscription(params) {
  return billingRepo.createSubscription(params);
}

/**
 * Update subscription status (for webhook handling)
 * @param {string} stripeSubscriptionId - Stripe subscription ID
 * @param {object} updates - Fields to update
 * @returns {Promise<object>}
 */
async function updateSubscription(stripeSubscriptionId, updates) {
  return billingRepo.updateSubscription(stripeSubscriptionId, updates);
}

/**
 * Cancel subscription
 * @param {string} userId - User ID
 * @returns {Promise<object>}
 */
async function cancelSubscription(userId) {
  const sub = await billingRepo.getActiveSubscription(userId);
  if (!sub) return { userId, status: 'not_found' };
  await billingRepo.updateSubscription(sub.stripeSubscriptionId, {
    status: 'canceled',
    canceledAt: new Date(),
  });
  return { userId, status: 'canceled', canceledAt: new Date() };
}

module.exports = {
  SUBSCRIPTION_TIERS,
  TIER_FEATURES,
  getUserSubscription,
  hasFeatureAccess,
  getFeatureLimit,
  checkUsageLimit,
  createSubscription,
  updateSubscription,
  cancelSubscription,
};
