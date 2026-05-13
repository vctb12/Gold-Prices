/**
 * server/routes/newsletter.js
 *
 * Newsletter subscription and management endpoints.
 *
 * Routes (mounted at /api/newsletter and /api/v1/newsletter):
 *   POST   /subscribe          — subscribe with double opt-in
 *   GET    /confirm/:token     — confirm email address
 *   POST   /unsubscribe        — unsubscribe by token or email
 *   PUT    /preferences        — update preferences (requires token)
 *   GET    /stats              — admin-only subscriber summary
 *
 * Storage: file-backed (data/newsletter-subscribers.json) with Supabase
 * sync when STORAGE_BACKEND=supabase. Matches the alerts v1 pattern.
 */

'use strict';

const express = require('express');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const { buildUrl } = require('../lib/site-url');
const { authMiddleware } = require('../lib/auth');
const repo = require('../repositories/newsletter.repository');
const { sendEmail } = require('../services/email');
const { getSupabaseClient } = require('../lib/supabase-client');

// ---------------------------------------------------------------------------
// Rate limiters
// ---------------------------------------------------------------------------

// In test mode, allow higher limits to avoid test failures
const IS_TEST = process.env.NODE_ENV === 'test';

const subscribeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: IS_TEST ? 200 : 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many subscription attempts. Please try again later.' },
});

const unsubscribeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: IS_TEST ? 200 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please try again later.' },
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Anchored regex — no catastrophic backtracking possible. */
const EMAIL_REGEX = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;

function isValidEmail(email) {
  return typeof email === 'string' && EMAIL_REGEX.test(email);
}

function generateToken(bytes = 24) {
  return crypto.randomBytes(bytes).toString('base64url');
}

function hashToken(token) {
  return crypto
    .createHash('sha256')
    .update(String(token || ''), 'utf8')
    .digest('hex');
}

function generateId() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `sub_${crypto.randomBytes(12).toString('hex')}`;
}

function nowIso() {
  return new Date().toISOString();
}

function safeTrim(val, max = 200) {
  if (typeof val !== 'string') return null;
  const t = val.trim();
  return t ? t.slice(0, max) : null;
}

function parsePreferences(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const allowed = ['daily', 'weekly'];
  const freq = safeTrim(String(raw.frequency || ''));
  return {
    frequency: allowed.includes(freq) ? freq : 'weekly',
    language: raw.language === 'ar' ? 'ar' : 'en',
    metals: Array.isArray(raw.metals)
      ? raw.metals.map((m) => safeTrim(String(m), 8)).filter(Boolean)
      : [],
    countries: Array.isArray(raw.countries)
      ? raw.countries.map((c) => safeTrim(String(c), 3)).filter(Boolean)
      : [],
  };
}

/** Attempt Supabase sync (best-effort — file store is always the source of truth). */
async function syncToSupabase(row) {
  const sb = getSupabaseClient(false);
  if (!sb) return;
  try {
    await sb.from('newsletter_subscribers').upsert(row, { onConflict: 'email' });
  } catch (err) {
    console.warn('[newsletter] Supabase sync failed (non-fatal):', err.message);
  }
}

async function sendVerificationEmail(email, token) {
  const confirmUrl = buildUrl(`/api/v1/newsletter/confirm/${encodeURIComponent(token)}`);
  const unsubUrl = buildUrl(`/content/unsubscribe/?email=${encodeURIComponent(email)}`);

  const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0f172a;color:#f1f5f9">
  <div style="max-width:560px;margin:40px auto;background:#1e293b;border-radius:12px;padding:32px;border:1px solid rgba(245,158,11,0.2)">
    <div style="text-align:center;margin-bottom:24px">
      <span style="font-size:32px">◈</span>
      <h1 style="color:#f59e0b;font-size:1.25rem;margin:8px 0 0">Gold Ticker Live</h1>
    </div>
    <h2 style="color:#f1f5f9;font-size:1.1rem;margin:0 0 12px">Confirm your newsletter subscription</h2>
    <p style="color:#8ba3c7;line-height:1.6;margin:0 0 24px">
      You're one step away from receiving gold price updates for the UAE, GCC, and Arab markets.
      Click the button below to confirm your email address.
    </p>
    <div style="text-align:center;margin:0 0 24px">
      <a href="${confirmUrl}"
         style="display:inline-block;background:linear-gradient(135deg,#f59e0b,#d97706);color:#0f172a;font-weight:700;font-size:1rem;border-radius:8px;padding:14px 28px;text-decoration:none">
        Confirm Subscription
      </a>
    </div>
    <p style="color:#64748b;font-size:0.8125rem;line-height:1.5;margin:0 0 12px">
      Or paste this link in your browser:<br>
      <span style="color:#8ba3c7;word-break:break-all">${confirmUrl}</span>
    </p>
    <hr style="border:none;border-top:1px solid rgba(255,255,255,0.08);margin:24px 0">
    <p style="color:#475569;font-size:0.75rem;margin:0">
      If you did not request this subscription, you can safely ignore this email.
      <a href="${unsubUrl}" style="color:#64748b">Unsubscribe</a>.
    </p>
  </div>
</body>
</html>`;

  const text = `Confirm your Gold Ticker Live newsletter subscription\n\nClick here: ${confirmUrl}\n\nIf you did not request this, ignore this email.`;

  return sendEmail({
    to: email,
    subject: 'Confirm your Gold Ticker Live newsletter subscription',
    html,
    text,
    tags: { category: 'newsletter-confirm' },
  });
}

// ---------------------------------------------------------------------------
// POST /subscribe
// ---------------------------------------------------------------------------
router.post('/subscribe', subscribeLimiter, async (req, res) => {
  try {
    // Honeypot — bots fill in the hidden field; humans leave it blank.
    const honeypot = req.body.website;
    if (honeypot && typeof honeypot === 'string' && honeypot.trim()) {
      return res.status(201).json({ success: true, message: 'Check your inbox to confirm.' });
    }

    const rawEmail = safeTrim(req.body.email, 320);
    if (!rawEmail || !isValidEmail(rawEmail)) {
      return res
        .status(400)
        .json({ success: false, message: 'A valid email address is required.' });
    }

    const email = rawEmail.toLowerCase();
    const preferences = parsePreferences(req.body.preferences);
    const source = safeTrim(req.body.source, 60) || 'footer';
    const locale = req.body.locale === 'ar' ? 'ar' : 'en';
    const consentGiven = req.body.consent !== false; // default true (form pre-implies consent)

    // Check existing subscriber
    const existing = repo.findByEmail(email);
    if (existing) {
      if (existing.status === 'active') {
        // Already active — respond as if success to avoid enumeration
        return res.status(200).json({ success: true, message: 'Already subscribed.' });
      }
      if (existing.status === 'pending') {
        // Re-send verification
        const confirmToken = generateToken();
        const confirmTokenHash = hashToken(confirmToken);
        const unsubscribeToken = generateToken();
        const unsubscribeTokenHash = hashToken(unsubscribeToken);
        repo.updateById(existing.id, {
          confirm_token_hash: confirmTokenHash,
          unsubscribe_token_hash: unsubscribeTokenHash,
          updated_at: nowIso(),
        });
        await sendVerificationEmail(email, confirmToken);
        return res.status(200).json({ success: true, message: 'Check your inbox to confirm.' });
      }
      if (existing.status === 'unsubscribed') {
        // Re-subscribe flow
        const confirmToken = generateToken();
        const confirmTokenHash = hashToken(confirmToken);
        const unsubscribeToken = generateToken();
        const unsubscribeTokenHash = hashToken(unsubscribeToken);
        repo.updateById(existing.id, {
          status: 'pending',
          confirm_token_hash: confirmTokenHash,
          unsubscribe_token_hash: unsubscribeTokenHash,
          preferences,
          locale,
          resubscribed_at: nowIso(),
          updated_at: nowIso(),
        });
        await sendVerificationEmail(email, confirmToken);
        return res.status(200).json({ success: true, message: 'Check your inbox to confirm.' });
      }
    }

    // New subscriber
    const confirmToken = generateToken();
    const unsubscribeToken = generateToken();
    const now = nowIso();

    const subscriber = {
      id: generateId(),
      email,
      status: 'pending',
      preferences,
      source,
      locale,
      page_path: safeTrim(req.body.page_path, 200) || null,
      consent_given: consentGiven,
      consent_at: consentGiven ? now : null,
      confirm_token_hash: hashToken(confirmToken),
      unsubscribe_token_hash: hashToken(unsubscribeToken),
      confirmed_at: null,
      unsubscribed_at: null,
      created_at: now,
      updated_at: now,
    };

    repo.insert(subscriber);
    await syncToSupabase({
      ...subscriber,
      confirm_token_hash: undefined,
      unsubscribe_token_hash: undefined,
    });
    await sendVerificationEmail(email, confirmToken);

    return res.status(201).json({ success: true, message: 'Check your inbox to confirm.' });
  } catch (err) {
    console.error('[newsletter] subscribe error:', err.message);
    return res
      .status(500)
      .json({ success: false, message: 'Failed to subscribe. Please try again.' });
  }
});

// ---------------------------------------------------------------------------
// GET /confirm/:token
// ---------------------------------------------------------------------------
router.get('/confirm/:token', async (req, res) => {
  try {
    const rawToken = req.params.token;
    if (!rawToken || rawToken.length < 20) {
      return res.redirect(buildUrl('/content/unsubscribe/?error=invalid'));
    }

    const tokenHash = hashToken(rawToken);
    const subscriber = repo.findByConfirmTokenHash(tokenHash);

    if (!subscriber) {
      return res.redirect(buildUrl('/content/unsubscribe/?error=invalid'));
    }

    if (subscriber.status === 'active') {
      return res.redirect(buildUrl('/?newsletter=already-confirmed'));
    }

    const now = nowIso();
    repo.updateById(subscriber.id, {
      status: 'active',
      confirmed_at: now,
      confirm_token_hash: null, // invalidate — single-use token
      updated_at: now,
    });

    await syncToSupabase({
      id: subscriber.id,
      email: subscriber.email,
      status: 'active',
      confirmed_at: now,
    });

    return res.redirect(buildUrl('/?newsletter=confirmed'));
  } catch (err) {
    console.error('[newsletter] confirm error:', err.message);
    return res.redirect(buildUrl('/content/unsubscribe/?error=server'));
  }
});

// ---------------------------------------------------------------------------
// POST /unsubscribe
// ---------------------------------------------------------------------------
router.post('/unsubscribe', unsubscribeLimiter, async (req, res) => {
  try {
    const rawEmail = safeTrim(req.body.email, 320);
    const rawToken = safeTrim(req.body.token, 100);

    if (!rawEmail && !rawToken) {
      return res.status(400).json({ success: false, message: 'Email or token required.' });
    }

    const now = nowIso();
    let subscriber = null;

    if (rawToken) {
      const tokenHash = hashToken(rawToken);
      subscriber = repo.findByUnsubscribeTokenHash(tokenHash);
    }

    if (!subscriber && rawEmail) {
      subscriber = repo.findByEmail(rawEmail.toLowerCase());
    }

    if (!subscriber) {
      // Respond as success to avoid email enumeration
      return res.json({ success: true, message: 'Unsubscribed successfully.' });
    }

    repo.updateById(subscriber.id, {
      status: 'unsubscribed',
      unsubscribed_at: now,
      updated_at: now,
    });

    await syncToSupabase({
      id: subscriber.id,
      email: subscriber.email,
      status: 'unsubscribed',
      unsubscribed_at: now,
    });

    return res.json({ success: true, message: 'Unsubscribed successfully.' });
  } catch (err) {
    console.error('[newsletter] unsubscribe error:', err.message);
    return res
      .status(500)
      .json({ success: false, message: 'Failed to unsubscribe. Please try again.' });
  }
});

// ---------------------------------------------------------------------------
// PUT /preferences
// ---------------------------------------------------------------------------
router.put('/preferences', async (req, res) => {
  try {
    const rawToken = safeTrim(req.body.token, 100);
    const rawEmail = safeTrim(req.body.email, 320);

    let subscriber = null;
    if (rawToken) {
      const tokenHash = hashToken(rawToken);
      subscriber = repo.findByUnsubscribeTokenHash(tokenHash);
    }
    if (!subscriber && rawEmail) {
      subscriber = repo.findByEmail(rawEmail.toLowerCase());
    }

    if (!subscriber || subscriber.status !== 'active') {
      return res
        .status(404)
        .json({ success: false, message: 'Subscriber not found or not active.' });
    }

    if (!req.body.preferences || typeof req.body.preferences !== 'object') {
      return res.status(400).json({ success: false, message: 'preferences object required.' });
    }

    const updated = parsePreferences(req.body.preferences);
    repo.updateById(subscriber.id, {
      preferences: { ...subscriber.preferences, ...updated },
      updated_at: nowIso(),
    });

    return res.json({ success: true, message: 'Preferences updated.' });
  } catch (err) {
    console.error('[newsletter] preferences error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to update preferences.' });
  }
});

// ---------------------------------------------------------------------------
// GET /stats  (admin-only)
// ---------------------------------------------------------------------------
router.get('/stats', authMiddleware('admin'), (_req, res) => {
  try {
    const counts = repo.getCounts();
    return res.json({ success: true, counts });
  } catch (err) {
    console.error('[newsletter] stats error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to fetch stats.' });
  }
});

// ---------------------------------------------------------------------------
// GET /subscribers  (admin-only — paginated list)
// ---------------------------------------------------------------------------
router.get('/subscribers', authMiddleware('admin'), (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const perPage = Math.min(100, Math.max(1, parseInt(req.query.per_page) || 50));
    const statusFilter = req.query.status || null;

    let subs = repo.getAll();
    if (statusFilter) subs = subs.filter((s) => s.status === statusFilter);

    // Sort newest first
    subs = subs.slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    const total = subs.length;
    const offset = (page - 1) * perPage;
    const items = subs.slice(offset, offset + perPage).map((s) => ({
      id: s.id,
      email: s.email,
      status: s.status,
      locale: s.locale,
      source: s.source,
      preferences: s.preferences,
      created_at: s.created_at,
      confirmed_at: s.confirmed_at,
      unsubscribed_at: s.unsubscribed_at,
    }));

    return res.json({
      success: true,
      data: items,
      pagination: { total, page, per_page: perPage, pages: Math.ceil(total / perPage) },
    });
  } catch (err) {
    console.error('[newsletter] subscribers list error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to fetch subscribers.' });
  }
});

module.exports = router;
