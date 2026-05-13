/**
 * server/repositories/newsletter.repository.js
 *
 * File-backed storage for newsletter subscribers.
 * Supabase-first with local JSON fallback — same pattern as alerts.js.
 *
 * Persistence: `data/newsletter-subscribers.json` via atomicWriteJSON().
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { atomicWriteJSON } = require('../lib/fs-atomic.js');

function getDataFile() {
  return (
    process.env.NEWSLETTER_DATA_FILE ||
    path.join(__dirname, '../../data/newsletter-subscribers.json')
  );
}

// ---------------------------------------------------------------------------
// File helpers
// ---------------------------------------------------------------------------

function _ensureFile(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(filePath))
    fs.writeFileSync(filePath, JSON.stringify({ subscribers: [] }, null, 2));
}

function _readStore() {
  const filePath = getDataFile();
  _ensureFile(filePath);
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return {
      subscribers: Array.isArray(parsed.subscribers) ? parsed.subscribers : [],
    };
  } catch {
    return { subscribers: [] };
  }
}

function _writeStore(store) {
  const filePath = getDataFile();
  _ensureFile(filePath);
  atomicWriteJSON(filePath, store);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Find a subscriber by email (case-insensitive).
 * @param {string} email
 * @returns {object|null}
 */
function findByEmail(email) {
  const normalized = String(email || '')
    .toLowerCase()
    .trim();
  const store = _readStore();
  return store.subscribers.find((s) => s.email === normalized) || null;
}

/**
 * Find a subscriber by confirmation token hash.
 * @param {string} tokenHash
 * @returns {object|null}
 */
function findByConfirmTokenHash(tokenHash) {
  const store = _readStore();
  return store.subscribers.find((s) => s.confirm_token_hash === tokenHash) || null;
}

/**
 * Find a subscriber by unsubscribe token hash.
 * @param {string} tokenHash
 * @returns {object|null}
 */
function findByUnsubscribeTokenHash(tokenHash) {
  const store = _readStore();
  return store.subscribers.find((s) => s.unsubscribe_token_hash === tokenHash) || null;
}

/**
 * Insert a new subscriber.
 * @param {object} subscriber
 * @returns {object}
 */
function insert(subscriber) {
  const store = _readStore();
  store.subscribers.push(subscriber);
  _writeStore(store);
  return subscriber;
}

/**
 * Apply partial updates to a subscriber by ID.
 * @param {string} id
 * @param {object} updates
 * @returns {object|null}
 */
function updateById(id, updates) {
  const store = _readStore();
  const idx = store.subscribers.findIndex((s) => s.id === id);
  if (idx === -1) return null;
  store.subscribers[idx] = { ...store.subscribers[idx], ...updates };
  _writeStore(store);
  return store.subscribers[idx];
}

/**
 * Return all subscribers (all statuses).
 * @returns {object[]}
 */
function getAll() {
  return _readStore().subscribers;
}

/**
 * Return only confirmed/active subscribers.
 * @returns {object[]}
 */
function getActive() {
  return _readStore().subscribers.filter((s) => s.status === 'active');
}

/**
 * Count subscribers grouped by status.
 * @returns {{ pending: number, active: number, unsubscribed: number, total: number }}
 */
function getCounts() {
  const subs = _readStore().subscribers;
  return {
    pending: subs.filter((s) => s.status === 'pending').length,
    active: subs.filter((s) => s.status === 'active').length,
    unsubscribed: subs.filter((s) => s.status === 'unsubscribed').length,
    total: subs.length,
  };
}

module.exports = {
  findByEmail,
  findByConfirmTokenHash,
  findByUnsubscribeTokenHash,
  insert,
  updateById,
  getAll,
  getActive,
  getCounts,
};
