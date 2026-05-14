/**
 * server/repositories/ai-drafts.repository.js
 *
 * File-backed storage for AI-generated content drafts.
 * All drafts start in "draft" status and require admin review before publish.
 * Never auto-publishes — human approval is mandatory.
 *
 * Persistence: `data/ai-drafts.json` via atomicWriteJSON().
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { atomicWriteJSON } = require('../lib/fs-atomic.js');

function getDataFile() {
  return process.env.AI_DRAFTS_DATA_FILE || path.join(__dirname, '../../data/ai-drafts.json');
}

// ---------------------------------------------------------------------------
// Valid enums
// ---------------------------------------------------------------------------

const DRAFT_TYPES = [
  'daily_summary',
  'weekly_summary',
  'uae_gcc_summary',
  'provider_report',
  'seo_brief',
  'x_post',
  'newsletter_block',
];

const DRAFT_STATUSES = ['draft', 'approved', 'rejected', 'published'];

// ---------------------------------------------------------------------------
// File helpers
// ---------------------------------------------------------------------------

function _ensureFile(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(filePath))
    fs.writeFileSync(filePath, JSON.stringify({ schema_version: 1, drafts: [] }, null, 2));
}

function _readStore() {
  const filePath = getDataFile();
  _ensureFile(filePath);
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return {
      schema_version: parsed.schema_version || 1,
      drafts: Array.isArray(parsed.drafts) ? parsed.drafts : [],
    };
  } catch {
    return { schema_version: 1, drafts: [] };
  }
}

function _writeStore(store) {
  const filePath = getDataFile();
  _ensureFile(filePath);
  atomicWriteJSON(filePath, store);
}

function _newId() {
  return 'draft_' + crypto.randomBytes(8).toString('hex');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Insert a new draft.
 * @param {object} draft – must include type, title_en, title_ar, body_en, body_ar, data_timestamp_utc
 * @returns {object} saved draft with id, status=draft, generated_at_utc
 */
function insertDraft(draft) {
  const store = _readStore();
  const record = {
    id: _newId(),
    type: draft.type,
    status: 'draft', // always starts as draft — never auto-publish
    language_pair: 'en+ar',
    title_en: draft.title_en || '',
    title_ar: draft.title_ar || '',
    body_en: draft.body_en || '',
    body_ar: draft.body_ar || '',
    data_snapshot: draft.data_snapshot || null,
    data_timestamp_utc: draft.data_timestamp_utc || null,
    is_spot_estimate: true, // always true — trust rule
    anomaly_flag: draft.anomaly_flag || false,
    anomaly_detail: draft.anomaly_detail || null,
    generated_at_utc: new Date().toISOString(),
    reviewed_by: null,
    reviewed_at_utc: null,
    review_action: null,
    review_note: null,
    published_at_utc: null,
    export_channel: null,
    audit_trail: [],
  };
  store.drafts.push(record);
  _writeStore(store);
  return record;
}

/**
 * Find a draft by ID.
 * @param {string} id
 * @returns {object|null}
 */
function getDraftById(id) {
  return _readStore().drafts.find((d) => d.id === id) || null;
}

/**
 * Return all drafts, newest first, with optional filters.
 * @param {{ status?: string, type?: string, limit?: number, offset?: number }} [filter]
 * @returns {object[]}
 */
function getDrafts(filter = {}) {
  let drafts = _readStore().drafts.slice().reverse();
  if (filter.status) drafts = drafts.filter((d) => d.status === filter.status);
  if (filter.type) drafts = drafts.filter((d) => d.type === filter.type);
  if (filter.anomaly_flag !== undefined)
    drafts = drafts.filter((d) => d.anomaly_flag === filter.anomaly_flag);
  const offset = Number(filter.offset) || 0;
  const limit = Math.min(Number(filter.limit) || 50, 200);
  return drafts.slice(offset, offset + limit);
}

/**
 * Count drafts matching a filter (without pagination).
 * @param {{ status?: string, type?: string }} [filter]
 * @returns {number}
 */
function getDraftsTotal(filter = {}) {
  let drafts = _readStore().drafts;
  if (filter.status) drafts = drafts.filter((d) => d.status === filter.status);
  if (filter.type) drafts = drafts.filter((d) => d.type === filter.type);
  return drafts.length;
}

/**
 * Update a draft by ID.
 * @param {string} id
 * @param {object} updates – only safe fields are applied
 * @returns {object|null}
 */
function updateDraft(id, updates) {
  const store = _readStore();
  const idx = store.drafts.findIndex((d) => d.id === id);
  if (idx === -1) return null;

  // Merge only allowed edit fields — status transitions use dedicated helpers
  const allowed = ['title_en', 'title_ar', 'body_en', 'body_ar', 'review_note', 'export_channel'];
  const filtered = {};
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(updates, key)) {
      filtered[key] = updates[key];
    }
  }
  store.drafts[idx] = { ...store.drafts[idx], ...filtered };
  _writeStore(store);
  return store.drafts[idx];
}

/**
 * Transition a draft to a new status.
 * Appends an audit trail entry.
 *
 * @param {string} id
 * @param {'approved'|'rejected'|'published'} newStatus
 * @param {{ actor: string, note?: string, export_channel?: string }} meta
 * @returns {object|null}
 */
function transitionDraft(id, newStatus, meta = {}) {
  const store = _readStore();
  const idx = store.drafts.findIndex((d) => d.id === id);
  if (idx === -1) return null;

  const now = new Date().toISOString();
  const draft = { ...store.drafts[idx] };

  draft.status = newStatus;
  draft.reviewed_by = meta.actor || null;
  draft.reviewed_at_utc = now;
  draft.review_action = newStatus;
  if (meta.note !== undefined) draft.review_note = meta.note;
  if (newStatus === 'published') {
    draft.published_at_utc = now;
    if (meta.export_channel) draft.export_channel = meta.export_channel;
  }

  // Append to per-draft audit trail
  if (!Array.isArray(draft.audit_trail)) draft.audit_trail = [];
  draft.audit_trail.push({
    action: newStatus,
    actor: meta.actor || null,
    at_utc: now,
    note: meta.note || null,
  });

  store.drafts[idx] = draft;
  _writeStore(store);
  return store.drafts[idx];
}

/**
 * Count drafts grouped by status.
 * @returns {{ draft: number, approved: number, rejected: number, published: number, total: number }}
 */
function getDraftCounts() {
  const { drafts } = _readStore();
  return {
    draft: drafts.filter((d) => d.status === 'draft').length,
    approved: drafts.filter((d) => d.status === 'approved').length,
    rejected: drafts.filter((d) => d.status === 'rejected').length,
    published: drafts.filter((d) => d.status === 'published').length,
    anomaly_flagged: drafts.filter((d) => d.anomaly_flag).length,
    total: drafts.length,
  };
}

module.exports = {
  DRAFT_TYPES,
  DRAFT_STATUSES,
  insertDraft,
  getDraftById,
  getDrafts,
  getDraftsTotal,
  updateDraft,
  transitionDraft,
  getDraftCounts,
};
