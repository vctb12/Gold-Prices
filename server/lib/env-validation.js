'use strict';

const MIN_ADMIN_PIN_DIGITS = 6;
const ADMIN_PIN_REGEX = new RegExp(`^\\d{${MIN_ADMIN_PIN_DIGITS},}$`);

function hasValue(v) {
  return typeof v === 'string' ? v.trim().length > 0 : Boolean(v);
}

function getRuntimeEnvSnapshot(env = process.env) {
  const supabaseConfigured = hasValue(env.SUPABASE_URL) && hasValue(env.SUPABASE_SERVICE_ROLE_KEY);
  const resendConfigured = hasValue(env.RESEND_API_KEY) && hasValue(env.RESEND_FROM_EMAIL);
  const stripeConfigured =
    hasValue(env.STRIPE_SECRET_KEY) &&
    hasValue(env.STRIPE_WEBHOOK_SECRET) &&
    hasValue(env.STRIPE_PUBLISHABLE_KEY);

  return {
    mode: env.NODE_ENV || 'development',
    storageBackend: env.STORAGE_BACKEND || 'file',
    corsOriginsConfigured: hasValue(env.CORS_ORIGINS),
    supabaseConfigured,
    newsletterConfigured: resendConfigured,
    resendConfigured,
    stripeConfigured,
    stripeWebhookConfigured: hasValue(env.STRIPE_WEBHOOK_SECRET),
    adminPinConfigured: hasValue(env.ADMIN_ACCESS_PIN),
    alertJobTokenConfigured: hasValue(env.ALERT_JOB_TOKEN),
  };
}

function validateServerEnv(env = process.env, logger = console) {
  const warnings = [];
  const snapshot = getRuntimeEnvSnapshot(env);
  const pushWarning = (message) => warnings.push(message);

  if (snapshot.mode === 'production' && !snapshot.corsOriginsConfigured) {
    pushWarning('CORS_ORIGINS is not set in production; cross-origin requests will be blocked.');
  }

  if (snapshot.storageBackend === 'supabase' && !snapshot.supabaseConfigured) {
    pushWarning(
      'STORAGE_BACKEND=supabase requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. Falling back behavior may occur.'
    );
  }

  const stripeRelatedConfigured =
    hasValue(env.STRIPE_SECRET_KEY) ||
    hasValue(env.STRIPE_WEBHOOK_SECRET) ||
    hasValue(env.STRIPE_PUBLISHABLE_KEY);
  if (stripeRelatedConfigured && !snapshot.stripeConfigured) {
    pushWarning(
      'Stripe env appears partially configured. Set STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, and STRIPE_PUBLISHABLE_KEY.'
    );
  }

  const newsletterRelatedConfigured =
    hasValue(env.RESEND_API_KEY) || hasValue(env.RESEND_FROM_EMAIL);
  if (newsletterRelatedConfigured && !snapshot.newsletterConfigured) {
    pushWarning(
      'Newsletter env appears partially configured. Set RESEND_API_KEY and RESEND_FROM_EMAIL.'
    );
  }

  if (snapshot.adminPinConfigured && !ADMIN_PIN_REGEX.test(String(env.ADMIN_ACCESS_PIN || ''))) {
    pushWarning(`ADMIN_ACCESS_PIN should be ${MIN_ADMIN_PIN_DIGITS}+ digits when configured.`);
  }

  for (const warning of warnings) {
    logger.warn(`[env-validation] ${warning}`);
  }

  return {
    ok: warnings.length === 0,
    warnings,
    snapshot,
  };
}

module.exports = {
  getRuntimeEnvSnapshot,
  validateServerEnv,
};
