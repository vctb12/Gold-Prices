/**
 * server/routes/leads.js
 *
 * Lead capture API.
 *
 * Routes (mounted at /api/v1):
 *   POST   /leads              — capture a public lead
 *   GET    /admin/leads        — list leads (admin-only)
 *   PATCH  /admin/leads/:id    — update lead status (admin-only)
 *
 * Lead types:
 *   - shop_interest   : user wants to list / claim their shop
 *   - pricing_inquiry : user has a pricing question or wants a quote
 *   - contact         : general contact form
 *   - event_track     : shop click/call/website/map interactions
 */

'use strict';

const express = require('express');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const { authMiddleware } = require('../lib/auth');
const repo = require('../repositories/leads.repository');

// ---------------------------------------------------------------------------
// Rate limiter
// ---------------------------------------------------------------------------

const IS_TEST = process.env.NODE_ENV === 'test';

const leadsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: IS_TEST ? 200 : 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please try again later.' },
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const EMAIL_REGEX = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;

const ALLOWED_LEAD_TYPES = new Set(['shop_interest', 'pricing_inquiry', 'contact', 'event_track']);

const ALLOWED_EVENT_TYPES = new Set(['click', 'call', 'website', 'map', 'contact', 'view']);

const ALLOWED_LEAD_STATUSES = new Set(['new', 'contacted', 'converted', 'closed', 'spam']);

function safeTrim(val, max = 200) {
  if (typeof val !== 'string') return null;
  const t = val.trim();
  return t ? t.slice(0, max) : null;
}

function generateId() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `lead_${crypto.randomBytes(12).toString('hex')}`;
}

function nowIso() {
  return new Date().toISOString();
}

// ---------------------------------------------------------------------------
// POST /api/v1/leads
// ---------------------------------------------------------------------------
router.post('/leads', leadsLimiter, (req, res) => {
  try {
    // Honeypot
    const honeypot = req.body.website;
    if (honeypot && typeof honeypot === 'string' && honeypot.trim()) {
      return res.status(201).json({ success: true, id: null });
    }

    const type = safeTrim(req.body.type, 30) || 'contact';
    if (!ALLOWED_LEAD_TYPES.has(type)) {
      return res.status(400).json({ success: false, message: 'Invalid lead type.' });
    }

    // For event_track type, minimal fields required
    if (type === 'event_track') {
      const eventType = safeTrim(req.body.event_type, 30);
      if (!eventType || !ALLOWED_EVENT_TYPES.has(eventType)) {
        return res.status(400).json({ success: false, message: 'Invalid event_type.' });
      }

      const eventRecord = {
        id: generateId(),
        lead_id: safeTrim(req.body.lead_id, 100) || null,
        type: eventType,
        entity_type: safeTrim(req.body.entity_type, 60) || null,
        entity_id: safeTrim(req.body.entity_id, 100) || null,
        page_path: safeTrim(req.body.page_path, 200) || null,
        locale: req.body.locale === 'ar' ? 'ar' : 'en',
        metadata: sanitizeMetadata(req.body.metadata),
        created_at: nowIso(),
      };

      repo.insertEvent(eventRecord);
      return res.status(201).json({ success: true, id: eventRecord.id });
    }

    // For other types: email is required unless anonymous
    const rawEmail = safeTrim(req.body.email, 320);
    if (rawEmail && !EMAIL_REGEX.test(rawEmail)) {
      return res.status(400).json({ success: false, message: 'Invalid email address.' });
    }

    const now = nowIso();
    const lead = {
      id: generateId(),
      type,
      status: 'new',
      email: rawEmail ? rawEmail.toLowerCase() : null,
      name: safeTrim(req.body.name, 120) || null,
      phone: safeTrim(req.body.phone, 60) || null,
      message: safeTrim(req.body.message, 2000) || null,
      source: safeTrim(req.body.source, 60) || 'website',
      page_path: safeTrim(req.body.page_path, 200) || null,
      locale: req.body.locale === 'ar' ? 'ar' : 'en',
      entity_type: safeTrim(req.body.entity_type, 60) || null,
      entity_id: safeTrim(req.body.entity_id, 100) || null,
      metadata: sanitizeMetadata(req.body.metadata),
      reviewed_at: null,
      reviewed_by: null,
      notes: null,
      created_at: now,
      updated_at: now,
    };

    repo.insertLead(lead);

    // Track the submission as an event
    repo.insertEvent({
      id: generateId(),
      lead_id: lead.id,
      type: 'submit',
      entity_type: lead.entity_type,
      entity_id: lead.entity_id,
      page_path: lead.page_path,
      locale: lead.locale,
      metadata: null,
      created_at: now,
    });

    return res.status(201).json({ success: true, id: lead.id });
  } catch (err) {
    console.error('[leads] create error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to submit. Please try again.' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/v1/admin/leads  (admin-only)
// ---------------------------------------------------------------------------
router.get('/admin/leads', authMiddleware('admin'), (req, res) => {
  try {
    const status = safeTrim(req.query.status, 20) || null;
    const type = safeTrim(req.query.type, 30) || null;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const perPage = Math.min(100, Math.max(1, parseInt(req.query.per_page) || 50));

    const leads = repo.getLeads({
      status: ALLOWED_LEAD_STATUSES.has(status) ? status : null,
      type: ALLOWED_LEAD_TYPES.has(type) ? type : null,
      limit: perPage,
      offset: (page - 1) * perPage,
    });

    const counts = repo.getLeadCounts();

    return res.json({
      success: true,
      data: leads,
      counts,
      pagination: {
        page,
        per_page: perPage,
      },
    });
  } catch (err) {
    console.error('[leads] admin list error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to fetch leads.' });
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/v1/admin/leads/:id  (admin-only)
// ---------------------------------------------------------------------------
router.patch('/admin/leads/:id', authMiddleware('admin'), (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ success: false, message: 'Lead ID required.' });

    const existing = repo.getLeadById(id);
    if (!existing) return res.status(404).json({ success: false, message: 'Lead not found.' });

    const updates = {};

    if (req.body.status !== undefined) {
      const newStatus = safeTrim(req.body.status, 20);
      if (!newStatus || !ALLOWED_LEAD_STATUSES.has(newStatus)) {
        return res.status(400).json({ success: false, message: 'Invalid status.' });
      }
      updates.status = newStatus;
    }

    if (req.body.notes !== undefined) {
      updates.notes = safeTrim(req.body.notes, 2000) || null;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: 'No valid fields to update.' });
    }

    updates.reviewed_at = nowIso();
    updates.reviewed_by = req.user?.email || 'admin';
    updates.updated_at = nowIso();

    const updated = repo.updateLead(id, updates);

    // Track status change as event
    if (updates.status) {
      repo.insertEvent({
        id: generateId(),
        lead_id: id,
        type: `status_${updates.status}`,
        entity_type: existing.entity_type,
        entity_id: existing.entity_id,
        page_path: null,
        locale: existing.locale,
        metadata: { changed_by: updates.reviewed_by },
        created_at: nowIso(),
      });
    }

    return res.json({ success: true, data: updated });
  } catch (err) {
    console.error('[leads] admin patch error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to update lead.' });
  }
});

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function sanitizeMetadata(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  // Shallow sanitize — drop non-primitive values, limit keys
  const out = {};
  let count = 0;
  for (const [k, v] of Object.entries(raw)) {
    if (count++ > 20) break;
    const key = safeTrim(String(k), 50);
    if (!key) continue;
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
      out[key] = typeof v === 'string' ? v.slice(0, 500) : v;
    }
  }
  return Object.keys(out).length ? out : null;
}

module.exports = router;
