'use strict';

const express = require('express');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');
const { authMiddleware } = require('../lib/auth');
const shopsRepo = require('../repositories/shops.repository');
const pendingShopsRepo = require('../repositories/pending-shops.repository');

const router = express.Router();

const ROOT = path.resolve(__dirname, '../..');
const SHOPS_FILE = path.join(ROOT, 'data', 'shops-data.json');
const SHOP_LEADS_FILE = path.join(ROOT, 'data', 'shop_leads.json');
const SHOP_CLAIMS_FILE = path.join(ROOT, 'data', 'shop_claims.json');
const SHOP_CLICKS_FILE = path.join(ROOT, 'data', 'shop_click_events.json');
const SPONSORED_FILE = path.join(ROOT, 'data', 'sponsored_placements.json');
const MARKET_CLUSTER_HINT_RX = /cluster|market|souk|area|district/;
const ALLOWED_CLICK_ACTIONS = new Set([
  'call',
  'whatsapp',
  'website',
  'directions',
  'share',
  'save',
]);
const MAX_SHOP_LEADS_RETENTION = 5000;
const MAX_SHOP_CLAIMS_RETENTION = 5000;
const MAX_SHOP_CLICKS_RETENTION = 10000;

const WRITE_RATE_LIMITER = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please try again shortly.' },
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function ensureArrayFile(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, '[]');
}

function readArrayFile(filePath) {
  ensureArrayFile(filePath);
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeArrayFile(filePath, values) {
  ensureArrayFile(filePath);
  fs.writeFileSync(filePath, JSON.stringify(values, null, 2));
}

function sanitizeString(value, maxLen = 300) {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/\s+/g, ' ').slice(0, maxLen);
}

function slugify(value) {
  return sanitizeString(value, 200)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function calculateContactCompleteness(shop) {
  const fields = ['phone', 'website', 'email', 'address'];
  const present = fields.filter((field) => sanitizeString(shop?.[field]).length > 0).length;
  return Math.round((present / fields.length) * 100);
}

function inferListingType(shop) {
  const explicit = sanitizeString(shop?.listing_type, 50);
  if (
    explicit === 'verified_shop' ||
    explicit === 'market_cluster' ||
    explicit === 'sponsor' ||
    explicit === 'pending_unverified'
  ) {
    return explicit;
  }

  if (shop?.sponsored === true) return 'sponsor';

  const typeValue = sanitizeString(shop?.type, 80).toLowerCase();
  const notes = sanitizeString(shop?.notes, 500).toLowerCase();
  const noDirectContact = !sanitizeString(shop?.phone) && !sanitizeString(shop?.website);

  if (typeValue === 'market_cluster' || (noDirectContact && MARKET_CLUSTER_HINT_RX.test(notes))) {
    return 'market_cluster';
  }

  if (shop?.verified === true) return 'verified_shop';

  return 'pending_unverified';
}

function normalizeShop(raw) {
  const listingType = inferListingType(raw);
  const contactCompletenessScore =
    typeof raw?.contact_completeness_score === 'number'
      ? Math.max(0, Math.min(100, Math.round(raw.contact_completeness_score)))
      : calculateContactCompleteness(raw);
  let verificationStatus = 'listed';
  if (listingType === 'verified_shop') verificationStatus = 'verified';
  else if (listingType === 'pending_unverified') verificationStatus = 'pending';

  return {
    id: raw.id || slugify(raw.name || `${raw.city || 'shop'}-${Date.now()}`),
    slug: raw.slug || slugify(raw.name || raw.id || 'shop'),
    name: sanitizeString(raw.name, 160),
    city: sanitizeString(raw.city, 100),
    country_code: sanitizeString(raw.country_code || raw.country, 3).toUpperCase(),
    market: sanitizeString(raw.market, 160),
    category: sanitizeString(raw.category || raw.type, 120),
    specialties: Array.isArray(raw.specialties)
      ? raw.specialties.map((item) => sanitizeString(item, 80)).filter(Boolean)
      : [],
    phone: sanitizeString(raw.phone, 80),
    website: sanitizeString(raw.website, 200),
    email: sanitizeString(raw.email, 180),
    address: sanitizeString(raw.address, 240),
    notes: sanitizeString(raw.notes, 1200),
    featured: Boolean(raw.featured),
    sponsored: Boolean(raw.sponsored),
    listing_type: listingType,
    verification_status: verificationStatus,
    verified_at: raw.verified_at || null,
    verification_method: sanitizeString(raw.verification_method, 80) || null,
    source: sanitizeString(raw.source || 'directory-fallback', 80),
    confidence:
      typeof raw.confidence === 'number'
        ? Math.max(0, Math.min(100, Math.round(raw.confidence)))
        : Math.max(35, Math.min(95, contactCompletenessScore)),
    contact_completeness_score: contactCompletenessScore,
    updated_at: raw.updated_at || raw.updatedAt || null,
  };
}

async function loadNormalizedListings() {
  const repoShops = await shopsRepo.getAll().catch(() => []);
  const localRows = readArrayFile(SHOPS_FILE);
  const sourceRows = Array.isArray(repoShops) && repoShops.length > 0 ? repoShops : localRows;
  return sourceRows.map(normalizeShop);
}

function loadSponsoredPlacements() {
  return readArrayFile(SPONSORED_FILE);
}

function upsertSponsoredPlacement(input) {
  const items = loadSponsoredPlacements();
  const id = input.id || `sponsor_${crypto.randomBytes(8).toString('hex')}`;
  const now = new Date().toISOString();
  const next = {
    id,
    slot: sanitizeString(input.slot, 80) || 'shops_directory',
    shop_id: sanitizeString(input.shop_id, 120),
    label: sanitizeString(input.label, 160),
    country_code: sanitizeString(input.country_code, 3).toUpperCase() || null,
    city: sanitizeString(input.city, 100) || null,
    starts_at: input.starts_at || now,
    ends_at: input.ends_at || null,
    active: input.active !== false,
    notes: sanitizeString(input.notes, 500) || null,
    updated_at: now,
    created_at: input.created_at || now,
  };

  const idx = items.findIndex((item) => item.id === id);
  if (idx === -1) {
    items.push(next);
  } else {
    items[idx] = { ...items[idx], ...next, created_at: items[idx].created_at || next.created_at };
  }

  writeArrayFile(SPONSORED_FILE, items);
  return next;
}

function removeSponsoredPlacement(id) {
  const items = loadSponsoredPlacements();
  const next = items.filter((item) => item.id !== id);
  const removed = next.length !== items.length;
  if (removed) writeArrayFile(SPONSORED_FILE, next);
  return removed;
}

router.get('/shops', async (req, res) => {
  const listings = await loadNormalizedListings();
  const sponsoredPlacements = loadSponsoredPlacements().filter((item) => item.active !== false);

  const listingType = sanitizeString(req.query.listing_type || req.query.tab, 40);
  const countryCode = sanitizeString(req.query.country_code || req.query.country, 3).toUpperCase();
  const city = sanitizeString(req.query.city, 100);
  const q = sanitizeString(req.query.q || req.query.search, 120).toLowerCase();

  const sponsoredShopIds = new Set(sponsoredPlacements.map((item) => item.shop_id).filter(Boolean));

  const merged = listings.map((row) => {
    if (sponsoredShopIds.has(row.id) || sponsoredShopIds.has(row.slug)) {
      return { ...row, listing_type: 'sponsor', sponsored: true };
    }
    return row;
  });

  const filtered = merged.filter((row) => {
    if (countryCode && row.country_code !== countryCode) return false;
    if (city && row.city.toLowerCase() !== city.toLowerCase()) return false;
    if (listingType && row.listing_type !== listingType) return false;
    if (!q) return true;
    const haystack = [row.name, row.city, row.market, row.category, row.notes, row.country_code]
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });

  const marketClusters = filtered.filter((row) => row.listing_type === 'market_cluster');
  const shopListings = filtered.filter((row) => row.listing_type !== 'market_cluster');

  return res.json({
    success: true,
    data: {
      total: filtered.length,
      listing_types: {
        verified_shop: filtered.filter((row) => row.listing_type === 'verified_shop').length,
        market_cluster: marketClusters.length,
        sponsor: filtered.filter((row) => row.listing_type === 'sponsor').length,
        pending_unverified: filtered.filter((row) => row.listing_type === 'pending_unverified')
          .length,
      },
      shop_listings: shopListings,
      market_clusters: marketClusters,
      sponsored_placements: sponsoredPlacements,
    },
  });
});

router.get('/shops/:slug', async (req, res) => {
  const listings = await loadNormalizedListings();
  const slug = sanitizeString(req.params.slug, 180).toLowerCase();
  const listing = listings.find(
    (row) => row.id.toLowerCase() === slug || row.slug.toLowerCase() === slug
  );

  if (!listing) {
    return res.status(404).json({ success: false, message: 'Shop listing not found.' });
  }

  return res.json({ success: true, data: listing });
});

router.post('/shops/:id/lead', WRITE_RATE_LIMITER, (req, res) => {
  const shopId = sanitizeString(req.params.id, 120);
  const leadType = sanitizeString(req.body?.lead_type, 40).toLowerCase() || 'inquiry';
  const name = sanitizeString(req.body?.name, 120) || null;
  const email = sanitizeString(req.body?.email, 200).toLowerCase() || null;
  const phone = sanitizeString(req.body?.phone, 60) || null;
  const message = sanitizeString(req.body?.message, 1200) || null;

  if (email && !EMAIL_RE.test(email)) {
    return res.status(400).json({ success: false, message: 'A valid email is required.' });
  }

  const lead = {
    id: `slead_${crypto.randomBytes(8).toString('hex')}`,
    shop_id: shopId,
    lead_type: leadType,
    name,
    email,
    phone,
    message,
    source_path: sanitizeString(req.body?.source_path || req.body?.page_path, 200) || '/shops.html',
    created_at: new Date().toISOString(),
    status: 'new',
  };

  const leads = readArrayFile(SHOP_LEADS_FILE);
  leads.push(lead);
  writeArrayFile(SHOP_LEADS_FILE, leads.slice(-MAX_SHOP_LEADS_RETENTION));

  return res.status(201).json({ success: true, id: lead.id });
});

router.post('/shops/:id/claim', WRITE_RATE_LIMITER, (req, res) => {
  const shopId = sanitizeString(req.params.id, 120);
  const claimantName = sanitizeString(req.body?.claimant_name || req.body?.name, 120);
  const claimantEmail = sanitizeString(
    req.body?.claimant_email || req.body?.email,
    200
  ).toLowerCase();
  const claimantPhone = sanitizeString(req.body?.claimant_phone || req.body?.phone, 60) || null;
  const note = sanitizeString(req.body?.note || req.body?.message, 1000) || null;

  if (!claimantName || !EMAIL_RE.test(claimantEmail)) {
    return res
      .status(400)
      .json({ success: false, message: 'Claim name and valid email are required.' });
  }

  const claim = {
    id: `sclaim_${crypto.randomBytes(8).toString('hex')}`,
    shop_id: shopId,
    claimant_name: claimantName,
    claimant_email: claimantEmail,
    claimant_phone: claimantPhone,
    claim_note: note,
    status: 'pending',
    created_at: new Date().toISOString(),
    reviewed_at: null,
    reviewed_by: null,
  };

  const claims = readArrayFile(SHOP_CLAIMS_FILE);
  claims.push(claim);
  writeArrayFile(SHOP_CLAIMS_FILE, claims.slice(-MAX_SHOP_CLAIMS_RETENTION));

  return res.status(201).json({ success: true, id: claim.id, status: claim.status });
});

router.post('/shops/:id/click', WRITE_RATE_LIMITER, (req, res) => {
  const shopId = sanitizeString(req.params.id, 120);
  const action = sanitizeString(req.body?.action || req.body?.event_type, 40).toLowerCase();
  if (!ALLOWED_CLICK_ACTIONS.has(action)) {
    return res.status(400).json({ success: false, message: 'Invalid click action.' });
  }

  const click = {
    id: `sclick_${crypto.randomBytes(8).toString('hex')}`,
    shop_id: shopId,
    action,
    source_path: sanitizeString(req.body?.source_path || req.body?.page_path, 200) || '/shops.html',
    created_at: new Date().toISOString(),
  };

  const clicks = readArrayFile(SHOP_CLICKS_FILE);
  clicks.push(click);
  writeArrayFile(SHOP_CLICKS_FILE, clicks.slice(-MAX_SHOP_CLICKS_RETENTION));

  return res.status(201).json({ success: true, id: click.id });
});

router.get('/admin/shops/moderation-queue', authMiddleware('editor'), (_req, res) => {
  const pending = pendingShopsRepo.getAll();
  return res.json({ success: true, data: pending });
});

router.get('/admin/shops/leads', authMiddleware('editor'), (_req, res) => {
  return res.json({ success: true, data: readArrayFile(SHOP_LEADS_FILE) });
});

router.get('/admin/shops/claims', authMiddleware('editor'), (_req, res) => {
  return res.json({ success: true, data: readArrayFile(SHOP_CLAIMS_FILE) });
});

router.get('/admin/shops/click-events', authMiddleware('editor'), (_req, res) => {
  return res.json({ success: true, data: readArrayFile(SHOP_CLICKS_FILE) });
});

router.post('/admin/shops/:id/verify', authMiddleware('editor'), async (req, res) => {
  const id = sanitizeString(req.params.id, 120);
  const verificationMethod = sanitizeString(req.body?.verification_method, 80) || 'manual_review';
  const source = sanitizeString(req.body?.source, 80) || 'admin';

  const updated = await shopsRepo.update(id, {
    verified: true,
    listing_type: 'verified_shop',
    verified_at: new Date().toISOString(),
    verification_method: verificationMethod,
    source,
  });

  if (!updated) {
    return res.status(404).json({ success: false, message: 'Shop not found.' });
  }

  return res.json({ success: true, data: normalizeShop(updated) });
});

router.post('/admin/shops/:id/reject', authMiddleware('editor'), async (req, res) => {
  const id = sanitizeString(req.params.id, 120);
  const updated = await shopsRepo.update(id, {
    verified: false,
    listing_type: 'pending_unverified',
    verification_method: sanitizeString(req.body?.verification_method, 80) || 'manual_review',
  });

  if (!updated) {
    return res.status(404).json({ success: false, message: 'Shop not found.' });
  }

  return res.json({ success: true, data: normalizeShop(updated) });
});

router.get('/admin/shops/sponsored-placements', authMiddleware('editor'), (_req, res) => {
  return res.json({ success: true, data: loadSponsoredPlacements() });
});

router.post('/admin/shops/sponsored-placements', authMiddleware('editor'), (req, res) => {
  const created = upsertSponsoredPlacement(req.body || {});
  return res.status(201).json({ success: true, data: created });
});

router.put('/admin/shops/sponsored-placements/:id', authMiddleware('editor'), (req, res) => {
  const id = sanitizeString(req.params.id, 120);
  const updated = upsertSponsoredPlacement({ ...(req.body || {}), id });
  return res.json({ success: true, data: updated });
});

router.delete('/admin/shops/sponsored-placements/:id', authMiddleware('admin'), (req, res) => {
  const id = sanitizeString(req.params.id, 120);
  const removed = removeSponsoredPlacement(id);
  if (!removed) {
    return res.status(404).json({ success: false, message: 'Sponsored placement not found.' });
  }
  return res.json({ success: true });
});

module.exports = router;
