/**
 * server/repositories/leads.repository.js
 *
 * File-backed storage for lead submissions (shop leads, pricing leads,
 * contact leads). Admin-reviewed, never auto-published.
 *
 * Persistence: `data/leads.json` via atomicWriteJSON().
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { atomicWriteJSON } = require('../lib/fs-atomic.js');

function getDataFile() {
  return process.env.LEADS_DATA_FILE || path.join(__dirname, '../../data/leads.json');
}

// ---------------------------------------------------------------------------
// File helpers
// ---------------------------------------------------------------------------

function _ensureFile(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(filePath))
    fs.writeFileSync(filePath, JSON.stringify({ leads: [], events: [] }, null, 2));
}

function _readStore() {
  const filePath = getDataFile();
  _ensureFile(filePath);
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return {
      leads: Array.isArray(parsed.leads) ? parsed.leads : [],
      events: Array.isArray(parsed.events) ? parsed.events : [],
    };
  } catch {
    return { leads: [], events: [] };
  }
}

function _writeStore(store) {
  const filePath = getDataFile();
  _ensureFile(filePath);
  atomicWriteJSON(filePath, store);
}

// ---------------------------------------------------------------------------
// Leads public API
// ---------------------------------------------------------------------------

/**
 * Insert a new lead.
 * @param {object} lead
 * @returns {object}
 */
function insertLead(lead) {
  const store = _readStore();
  store.leads.push(lead);
  _writeStore(store);
  return lead;
}

/**
 * Find a lead by ID.
 * @param {string} id
 * @returns {object|null}
 */
function getLeadById(id) {
  return _readStore().leads.find((l) => l.id === id) || null;
}

/**
 * Return all leads, newest first.
 * @param {{ status?: string, type?: string, limit?: number, offset?: number }} [filter]
 * @returns {object[]}
 */
function getLeads(filter = {}) {
  let leads = _readStore().leads.slice().reverse();
  if (filter.status) leads = leads.filter((l) => l.status === filter.status);
  if (filter.type) leads = leads.filter((l) => l.type === filter.type);
  const offset = Number(filter.offset) || 0;
  const limit = Number(filter.limit) || 100;
  return leads.slice(offset, offset + limit);
}

/**
 * Update a lead by ID.
 * @param {string} id
 * @param {object} updates
 * @returns {object|null}
 */
function updateLead(id, updates) {
  const store = _readStore();
  const idx = store.leads.findIndex((l) => l.id === id);
  if (idx === -1) return null;
  store.leads[idx] = { ...store.leads[idx], ...updates };
  _writeStore(store);
  return store.leads[idx];
}

/**
 * Count leads grouped by status.
 * @returns {{ new: number, contacted: number, converted: number, closed: number, total: number }}
 */
function getLeadCounts() {
  const leads = _readStore().leads;
  return {
    new: leads.filter((l) => l.status === 'new').length,
    contacted: leads.filter((l) => l.status === 'contacted').length,
    converted: leads.filter((l) => l.status === 'converted').length,
    closed: leads.filter((l) => l.status === 'closed').length,
    total: leads.length,
  };
}

// ---------------------------------------------------------------------------
// Lead events public API
// ---------------------------------------------------------------------------

/**
 * Insert a lead event.
 * @param {object} event
 * @returns {object}
 */
function insertEvent(event) {
  const store = _readStore();
  store.events.push(event);
  _writeStore(store);
  return event;
}

/**
 * Return events for a given lead ID.
 * @param {string} leadId
 * @returns {object[]}
 */
function getEventsByLeadId(leadId) {
  return _readStore().events.filter((e) => e.lead_id === leadId);
}

module.exports = {
  insertLead,
  getLeadById,
  getLeads,
  updateLead,
  getLeadCounts,
  insertEvent,
  getEventsByLeadId,
};
