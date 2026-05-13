'use strict';

const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { atomicWriteJSON } = require('../lib/fs-atomic');
const { successResponse, errorResponse } = require('../lib/api-response');
const { getSupabaseClient } = require('../lib/supabase-client');
const { buildUrl } = require('../lib/site-url');

const router = express.Router();
const ROOT = path.resolve(__dirname, '../..');
const GOLD_PRICE_FILE = path.join(ROOT, 'data', 'gold_price.json');
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const CHANNEL_EMAIL = 'email';
const SYMBOL_XAU_USD = 'XAUUSD';
const DEFAULT_COOLDOWN_MINUTES = 60;
const MAX_COOLDOWN_MINUTES = 7 * 24 * 60;
const MIN_TOKEN_LENGTH = 20;
const TROY_OZ_GRAMS = 31.1035;
const AED_PEG = 3.6725;

const KARAT_PURITY = Object.freeze({
  24: 1,
  22: 22 / 24,
  21: 21 / 24,
  18: 18 / 24,
  14: 14 / 24,
  10: 10 / 24,
});

function getAlertsDataFile() {
  return process.env.ALERTS_DATA_FILE || path.join(ROOT, 'data', 'alerts-v1.json');
}

function getAlertsPriceFile() {
  return process.env.ALERTS_PRICE_FILE || GOLD_PRICE_FILE;
}

function hasValue(value) {
  return typeof value === 'string' ? value.trim().length > 0 : Boolean(value);
}

function nowIso() {
  return new Date().toISOString();
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

function randomId(prefix) {
  return `${prefix}_${crypto.randomBytes(12).toString('hex')}`;
}

function safeTrimmed(value, maxLength = 240) {
  if (typeof value !== 'string') return null;
  const cleaned = value.trim();
  if (!cleaned) return null;
  return cleaned.slice(0, maxLength);
}

function parseCooldownMinutes(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_COOLDOWN_MINUTES;
  return Math.min(parsed, MAX_COOLDOWN_MINUTES);
}

function parseCurrency(value) {
  const normalized = safeTrimmed(value, 8)?.toUpperCase();
  if (!normalized) return null;
  if (normalized === 'USD' || normalized === 'AED') return normalized;
  return null;
}

function parseKarat(value) {
  if (value === null || value === undefined || value === '') return null;
  const normalized = safeTrimmed(String(value), 4);
  if (!normalized) return null;
  return Object.prototype.hasOwnProperty.call(KARAT_PURITY, normalized) ? normalized : null;
}

function parseCondition(value) {
  const normalized = safeTrimmed(String(value || ''), 12)?.toLowerCase();
  if (normalized === 'above' || normalized === 'below') return normalized;
  return null;
}

function readJsonFile(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function readStore() {
  const filePath = getAlertsDataFile();
  const parsed = readJsonFile(filePath);
  if (!parsed || typeof parsed !== 'object') {
    return {
      alert_rules: [],
      alert_events: [],
      notification_subscriptions: [],
    };
  }
  return {
    alert_rules: Array.isArray(parsed.alert_rules) ? parsed.alert_rules : [],
    alert_events: Array.isArray(parsed.alert_events) ? parsed.alert_events : [],
    notification_subscriptions: Array.isArray(parsed.notification_subscriptions)
      ? parsed.notification_subscriptions
      : [],
  };
}

function writeStore(store) {
  const filePath = getAlertsDataFile();
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  atomicWriteJSON(filePath, store);
}

function getSupabase() {
  return getSupabaseClient(false);
}

function sanitizeAlertInput(payload = {}) {
  const email = safeTrimmed(payload.email, 320)?.toLowerCase();
  if (!email || !EMAIL_REGEX.test(email)) {
    return { ok: false, message: 'A valid email is required.' };
  }

  const channel = safeTrimmed(payload.channel || CHANNEL_EMAIL, 20)?.toLowerCase();
  if (channel !== CHANNEL_EMAIL) {
    return { ok: false, message: 'Only email alerts are supported in alerts v1.' };
  }

  const symbol = safeTrimmed(payload.symbol || SYMBOL_XAU_USD, 32)?.toUpperCase();
  if (symbol !== SYMBOL_XAU_USD) {
    return { ok: false, message: 'Only XAUUSD symbol is supported in alerts v1.' };
  }

  const currency = parseCurrency(payload.currency || 'USD');
  if (!currency) {
    return { ok: false, message: 'Currency must be USD or AED for alerts v1.' };
  }

  const condition = parseCondition(payload.condition);
  if (!condition) {
    return { ok: false, message: "Condition must be 'above' or 'below'." };
  }

  const thresholdValue = Number(payload.threshold_value);
  if (!Number.isFinite(thresholdValue) || thresholdValue <= 0) {
    return { ok: false, message: 'threshold_value must be a positive number.' };
  }

  const karat = parseKarat(payload.karat);
  if (currency === 'AED' && payload.karat && !karat) {
    return { ok: false, message: 'karat must be one of 24, 22, 21, 18, 14, 10.' };
  }

  const countryCode = safeTrimmed(payload.country_code, 3)?.toUpperCase() || null;
  const cooldownMinutes = parseCooldownMinutes(payload.cooldown_minutes);

  return {
    ok: true,
    value: {
      user_id: safeTrimmed(payload.user_id, 128) || null,
      email,
      channel,
      symbol,
      currency,
      condition,
      threshold_value: thresholdValue,
      karat,
      country_code: countryCode,
      is_active: false,
      cooldown_minutes: cooldownMinutes,
      last_triggered_at: null,
    },
  };
}

async function createAlertRule(record) {
  const managementToken = generateToken();
  const verificationToken = generateToken();
  const unsubscribeToken = generateToken();
  const createdAt = nowIso();

  const row = {
    ...record,
    id: randomId('arule'),
    management_token_hash: hashToken(managementToken),
    verification_token_hash: hashToken(verificationToken),
    verified_at: null,
    unsubscribed_at: null,
    created_at: createdAt,
    updated_at: createdAt,
  };

  const subscription = {
    id: randomId('nsub'),
    user_id: row.user_id,
    channel: row.channel,
    destination: row.email,
    destination_hash: hashToken(row.email),
    unsubscribe_token_hash: hashToken(unsubscribeToken),
    verified_at: null,
    unsubscribed_at: null,
    metadata: {
      scope: 'price-alerts-v1',
      symbol: row.symbol,
      currency: row.currency,
      createdAt,
    },
    created_at: createdAt,
    updated_at: createdAt,
  };

  const sb = getSupabase();
  if (sb) {
    try {
      const { data: insertedRules, error: insertRuleError } = await sb
        .from('alert_rules')
        .insert(row)
        .select('*')
        .limit(1);
      if (!insertRuleError && Array.isArray(insertedRules) && insertedRules[0]) {
        await sb.from('notification_subscriptions').insert(subscription);
        return {
          rule: insertedRules[0],
          managementToken,
          verificationToken,
          unsubscribeToken,
        };
      }
    } catch (error) {
      console.warn(
        `[alerts] Supabase insert failed, falling back to file storage: ${error.message}`
      );
    }
  }

  const store = readStore();
  store.alert_rules.push(row);
  store.notification_subscriptions.push(subscription);
  writeStore(store);
  return { rule: row, managementToken, verificationToken, unsubscribeToken };
}

async function findRuleByManagementToken(token) {
  if (!token || token.length < MIN_TOKEN_LENGTH) return null;
  const tokenHash = hashToken(token);
  const sb = getSupabase();
  if (sb) {
    try {
      const { data, error } = await sb
        .from('alert_rules')
        .select('*')
        .eq('management_token_hash', tokenHash)
        .limit(1);
      if (!error && Array.isArray(data) && data[0]) return data[0];
    } catch (error) {
      console.warn(`[alerts] Supabase read failed, falling back to file storage: ${error.message}`);
    }
  }

  const store = readStore();
  return store.alert_rules.find((rule) => rule.management_token_hash === tokenHash) || null;
}

async function updateRuleById(ruleId, patch) {
  const updatedAt = nowIso();
  const sb = getSupabase();
  if (sb) {
    try {
      const { data, error } = await sb
        .from('alert_rules')
        .update({ ...patch, updated_at: updatedAt })
        .eq('id', ruleId)
        .select('*')
        .limit(1);
      if (!error && Array.isArray(data) && data[0]) return data[0];
    } catch (error) {
      console.warn(
        `[alerts] Supabase update failed, falling back to file storage: ${error.message}`
      );
    }
  }

  const store = readStore();
  const index = store.alert_rules.findIndex((rule) => rule.id === ruleId);
  if (index === -1) return null;
  store.alert_rules[index] = {
    ...store.alert_rules[index],
    ...patch,
    updated_at: updatedAt,
  };
  writeStore(store);
  return store.alert_rules[index];
}

async function verifyByToken(token) {
  if (!token || token.length < MIN_TOKEN_LENGTH) return null;
  const tokenHash = hashToken(token);
  const verifiedAt = nowIso();
  const sb = getSupabase();
  if (sb) {
    try {
      const { data: targetRows, error: targetError } = await sb
        .from('alert_rules')
        .select('*')
        .eq('verification_token_hash', tokenHash)
        .is('verified_at', null)
        .is('unsubscribed_at', null)
        .limit(1);
      if (!targetError && Array.isArray(targetRows) && targetRows[0]) {
        const target = targetRows[0];
        const { data: updatedRows } = await sb
          .from('alert_rules')
          .update({
            is_active: true,
            verified_at: verifiedAt,
            verification_token_hash: null,
            updated_at: verifiedAt,
          })
          .eq('id', target.id)
          .select('*')
          .limit(1);
        await sb
          .from('notification_subscriptions')
          .update({ verified_at: verifiedAt, updated_at: verifiedAt })
          .eq('destination', target.email)
          .eq('channel', target.channel);
        if (Array.isArray(updatedRows) && updatedRows[0]) return updatedRows[0];
      }
    } catch (error) {
      console.warn(
        `[alerts] Supabase verify failed, falling back to file storage: ${error.message}`
      );
    }
  }

  const store = readStore();
  const index = store.alert_rules.findIndex(
    (rule) =>
      rule.verification_token_hash === tokenHash && !rule.verified_at && !rule.unsubscribed_at
  );
  if (index === -1) return null;
  const row = store.alert_rules[index];
  store.alert_rules[index] = {
    ...row,
    is_active: true,
    verified_at: verifiedAt,
    verification_token_hash: null,
    updated_at: verifiedAt,
  };
  store.notification_subscriptions = store.notification_subscriptions.map((sub) =>
    sub.destination === row.email && sub.channel === row.channel
      ? { ...sub, verified_at: verifiedAt, updated_at: verifiedAt }
      : sub
  );
  writeStore(store);
  return store.alert_rules[index];
}

async function unsubscribeByToken(token) {
  if (!token || token.length < MIN_TOKEN_LENGTH) return null;
  const tokenHash = hashToken(token);
  const unsubscribedAt = nowIso();
  const sb = getSupabase();
  if (sb) {
    try {
      const { data: subscriptions, error } = await sb
        .from('notification_subscriptions')
        .select('*')
        .eq('unsubscribe_token_hash', tokenHash)
        .is('unsubscribed_at', null)
        .limit(1);
      if (!error && Array.isArray(subscriptions) && subscriptions[0]) {
        const sub = subscriptions[0];
        await sb
          .from('notification_subscriptions')
          .update({ unsubscribed_at: unsubscribedAt, updated_at: unsubscribedAt })
          .eq('id', sub.id);
        await sb
          .from('alert_rules')
          .update({ is_active: false, unsubscribed_at: unsubscribedAt, updated_at: unsubscribedAt })
          .eq('email', sub.destination)
          .eq('channel', sub.channel)
          .is('unsubscribed_at', null);
        return {
          destination: sub.destination,
          channel: sub.channel,
          unsubscribedAt,
        };
      }
    } catch (supabaseError) {
      console.warn(
        `[alerts] Supabase unsubscribe failed, falling back to file storage: ${supabaseError.message}`
      );
    }
  }

  const store = readStore();
  const subIndex = store.notification_subscriptions.findIndex(
    (sub) => sub.unsubscribe_token_hash === tokenHash && !sub.unsubscribed_at
  );
  if (subIndex === -1) return null;

  const target = store.notification_subscriptions[subIndex];
  store.notification_subscriptions[subIndex] = {
    ...target,
    unsubscribed_at: unsubscribedAt,
    updated_at: unsubscribedAt,
  };
  store.alert_rules = store.alert_rules.map((rule) =>
    rule.email === target.destination && rule.channel === target.channel && !rule.unsubscribed_at
      ? { ...rule, is_active: false, unsubscribed_at: unsubscribedAt, updated_at: unsubscribedAt }
      : rule
  );
  writeStore(store);
  return {
    destination: target.destination,
    channel: target.channel,
    unsubscribedAt,
  };
}

async function writeAlertEvent(event) {
  const row = {
    id: randomId('aevt'),
    created_at: nowIso(),
    ...event,
  };
  const sb = getSupabase();
  if (sb) {
    try {
      await sb.from('alert_events').insert(row);
      return row;
    } catch (error) {
      console.warn(
        `[alerts] Supabase event insert failed, falling back to file storage: ${error.message}`
      );
    }
  }

  const store = readStore();
  store.alert_events.push(row);
  if (store.alert_events.length > 5000) {
    store.alert_events = store.alert_events.slice(-5000);
  }
  writeStore(store);
  return row;
}

function sanitizeRuleForResponse(rule) {
  if (!rule) return null;
  return {
    id: rule.id,
    email: rule.email,
    channel: rule.channel,
    symbol: rule.symbol,
    currency: rule.currency,
    condition: rule.condition,
    threshold_value: rule.threshold_value,
    karat: rule.karat || null,
    country_code: rule.country_code || null,
    is_active: rule.is_active === true,
    cooldown_minutes: rule.cooldown_minutes,
    last_triggered_at: rule.last_triggered_at || null,
    verified_at: rule.verified_at || null,
    unsubscribed_at: rule.unsubscribed_at || null,
    created_at: rule.created_at || null,
    updated_at: rule.updated_at || null,
  };
}

function shouldUseDryRunEmail() {
  if (String(process.env.ALERT_EMAIL_DRY_RUN || '').toLowerCase() === 'true') return true;
  return !(hasValue(process.env.RESEND_API_KEY) && hasValue(process.env.RESEND_FROM_EMAIL));
}

async function sendEmail({ to, subject, html, text, tags = [] }) {
  const dryRun = shouldUseDryRunEmail();
  if (dryRun) {
    console.log(`[alerts] [dry-run] email -> ${to} | ${subject}`);
    return { mode: 'dry-run', status: 'dry_run', messageId: null };
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL,
      to: [to],
      subject,
      html,
      text,
      tags,
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.message || `Resend HTTP ${response.status}`;
    throw new Error(message);
  }
  return {
    mode: 'resend',
    status: 'sent',
    messageId: payload?.id || null,
  };
}

async function sendVerificationEmail({
  email,
  verificationToken,
  managementToken,
  unsubscribeToken,
}) {
  const verifyUrl = buildUrl(
    `/api/v1/alerts/verify?token=${encodeURIComponent(verificationToken)}`
  );
  const manageUrl = buildUrl(`/api/v1/alerts/${encodeURIComponent(managementToken)}`);
  const unsubscribeUrl = buildUrl(
    `/api/v1/alerts/unsubscribe?token=${encodeURIComponent(unsubscribeToken)}`
  );
  const subject = 'Confirm your Gold Ticker Live price alert';
  const html = `
    <h2>Confirm your Gold Ticker Live alert</h2>
    <p>This confirms your email for spot-based gold reference alerts.</p>
    <p><a href="${verifyUrl}">Verify alert email</a></p>
    <p>Manage your alert: <a href="${manageUrl}">${manageUrl}</a></p>
    <p>Unsubscribe anytime: <a href="${unsubscribeUrl}">${unsubscribeUrl}</a></p>
    <p><strong>Reference only:</strong> Alerts are spot-linked estimates and may differ from shop quotes.</p>
  `;
  const text = [
    'Confirm your Gold Ticker Live alert',
    `Verify: ${verifyUrl}`,
    `Manage: ${manageUrl}`,
    `Unsubscribe: ${unsubscribeUrl}`,
    'Reference only: alerts are spot-linked estimates and may differ from retail shop prices.',
  ].join('\n');
  return sendEmail({
    to: email,
    subject,
    html,
    text,
    tags: [{ name: 'category', value: 'alerts_verify' }],
  });
}

async function sendTriggeredAlertEmail({
  rule,
  currentPrice,
  snapshotTimestamp,
  sourceLabel,
  unsubscribeToken,
}) {
  const unsubscribeUrl = buildUrl(
    `/api/v1/alerts/unsubscribe?token=${encodeURIComponent(unsubscribeToken)}`
  );
  const directionWord = rule.condition === 'above' ? 'above' : 'below';
  const subject = `Gold alert: ${rule.symbol} is ${directionWord} your target`;
  const html = `
    <h2>Gold price alert triggered</h2>
    <p><strong>${rule.symbol}</strong> is now <strong>${currentPrice.toFixed(2)} ${rule.currency}</strong>.</p>
    <p>Trigger condition: ${rule.condition} ${rule.threshold_value}</p>
    <p>Snapshot time: ${snapshotTimestamp}</p>
    <p>Source: ${sourceLabel}</p>
    <p>Unsubscribe: <a href="${unsubscribeUrl}">${unsubscribeUrl}</a></p>
    <p><strong>Reference only:</strong> spot-linked estimate before retail premiums, making charges, and VAT.</p>
  `;
  const text = [
    'Gold price alert triggered',
    `${rule.symbol} now: ${currentPrice.toFixed(2)} ${rule.currency}`,
    `Condition: ${rule.condition} ${rule.threshold_value}`,
    `Snapshot: ${snapshotTimestamp}`,
    `Source: ${sourceLabel}`,
    `Unsubscribe: ${unsubscribeUrl}`,
  ].join('\n');
  return sendEmail({
    to: rule.email,
    subject,
    html,
    text,
    tags: [{ name: 'category', value: 'alerts_triggered' }],
  });
}

function readLatestPriceFromFile() {
  const payload = readJsonFile(getAlertsPriceFile());
  if (!payload || typeof payload !== 'object') return null;
  const price = Number(payload.xau_usd_per_oz ?? payload?.gold?.ounce_usd);
  if (!Number.isFinite(price) || price <= 0) return null;
  return {
    snapshotId: null,
    xauUsdPerOz: price,
    timestampUtc: payload.timestamp_utc || payload.fetched_at_utc || nowIso(),
    isFresh: payload.is_fresh === true,
    isFallback: payload.is_fallback === true,
    sourceProvider: payload.provider || payload.source || 'gold_price_file',
  };
}

async function readLatestPriceSnapshot() {
  const sb = getSupabase();
  if (sb) {
    try {
      const { data, error } = await sb
        .from('price_snapshots')
        .select('id,xau_usd_per_oz,timestamp_utc,is_fresh,is_fallback,source_provider')
        .order('timestamp_utc', { ascending: false })
        .limit(1);
      if (!error && Array.isArray(data) && data[0]) {
        return {
          snapshotId: data[0].id,
          xauUsdPerOz: Number(data[0].xau_usd_per_oz),
          timestampUtc: data[0].timestamp_utc,
          isFresh: data[0].is_fresh === true,
          isFallback: data[0].is_fallback === true,
          sourceProvider: data[0].source_provider || 'price_snapshots',
        };
      }
    } catch (error) {
      console.warn(`[alerts] Supabase snapshot read failed, using file fallback: ${error.message}`);
    }
  }
  return readLatestPriceFromFile();
}

function computeRulePrice(snapshot, rule) {
  if (!snapshot || !Number.isFinite(snapshot.xauUsdPerOz) || snapshot.xauUsdPerOz <= 0) return null;
  if (rule.currency === 'USD') return snapshot.xauUsdPerOz;

  const baseAedPerGram24 = (snapshot.xauUsdPerOz / TROY_OZ_GRAMS) * AED_PEG;
  if (rule.currency !== 'AED') return null;
  if (!rule.karat) return baseAedPerGram24;
  const purity = KARAT_PURITY[String(rule.karat)] || null;
  if (!purity) return null;
  return baseAedPerGram24 * purity;
}

function shouldTrigger(rule, currentValue) {
  if (!Number.isFinite(currentValue) || currentValue <= 0) return false;
  if (rule.condition === 'above') return currentValue >= Number(rule.threshold_value);
  if (rule.condition === 'below') return currentValue <= Number(rule.threshold_value);
  return false;
}

function isWithinCooldown(rule, nowTs) {
  if (!rule.last_triggered_at) return false;
  const lastTs = Date.parse(rule.last_triggered_at);
  if (!Number.isFinite(lastTs)) return false;
  const cooldownMs = parseCooldownMinutes(rule.cooldown_minutes) * 60 * 1000;
  return nowTs - lastTs < cooldownMs;
}

async function loadActiveRules() {
  const sb = getSupabase();
  if (sb) {
    try {
      const { data, error } = await sb
        .from('alert_rules')
        .select('*')
        .eq('is_active', true)
        .eq('channel', CHANNEL_EMAIL)
        .not('verified_at', 'is', null)
        .is('unsubscribed_at', null)
        .limit(1000);
      if (!error && Array.isArray(data)) return data;
    } catch (error) {
      console.warn(
        `[alerts] Supabase active-rules read failed, using file fallback: ${error.message}`
      );
    }
  }

  const store = readStore();
  return store.alert_rules.filter(
    (rule) =>
      rule.is_active === true &&
      rule.channel === CHANNEL_EMAIL &&
      !!rule.verified_at &&
      !rule.unsubscribed_at
  );
}

async function findSubscriptionForRule(rule) {
  const sb = getSupabase();
  if (sb) {
    try {
      const { data, error } = await sb
        .from('notification_subscriptions')
        .select('*')
        .eq('destination', rule.email)
        .eq('channel', rule.channel)
        .is('unsubscribed_at', null)
        .order('created_at', { ascending: false })
        .limit(1);
      if (!error && Array.isArray(data) && data[0]) return data[0];
    } catch (error) {
      console.warn(
        `[alerts] Supabase subscription lookup failed, using file fallback: ${error.message}`
      );
    }
  }

  const store = readStore();
  return (
    store.notification_subscriptions
      .filter(
        (sub) =>
          sub.destination === rule.email && sub.channel === rule.channel && !sub.unsubscribed_at
      )
      .sort((a, b) => Date.parse(b.created_at || 0) - Date.parse(a.created_at || 0))[0] || null
  );
}

function updateSubscriptionByDestination(destination, patch) {
  const sb = getSupabase();
  if (sb) {
    return sb
      .from('notification_subscriptions')
      .update({ ...patch, updated_at: nowIso() })
      .eq('destination', destination);
  }
  const store = readStore();
  store.notification_subscriptions = store.notification_subscriptions.map((row) =>
    row.destination === destination ? { ...row, ...patch, updated_at: nowIso() } : row
  );
  writeStore(store);
  return Promise.resolve();
}

router.post('/alerts', async (req, res) => {
  const parsed = sanitizeAlertInput(req.body);
  if (!parsed.ok) {
    return res.status(400).json(errorResponse('VALIDATION_ERROR', parsed.message));
  }

  const created = await createAlertRule(parsed.value);
  const emailResult = await sendVerificationEmail({
    email: created.rule.email,
    verificationToken: created.verificationToken,
    managementToken: created.managementToken,
    unsubscribeToken: created.unsubscribeToken,
  }).catch((error) => ({ mode: 'error', status: 'failed', error: error.message }));

  await writeAlertEvent({
    alert_rule_id: created.rule.id,
    price_snapshot_id: null,
    channel: created.rule.channel,
    status: emailResult.status || 'failed',
    payload: {
      type: 'verify',
      email_mode: emailResult.mode || 'unknown',
    },
    error_message: emailResult.error || null,
    sent_at: emailResult.status === 'sent' || emailResult.status === 'dry_run' ? nowIso() : null,
  });

  const isDryMode = shouldUseDryRunEmail();
  return res.status(201).json(
    successResponse(
      {
        alert: sanitizeRuleForResponse(created.rule),
        managementToken: created.managementToken,
        managementUrl: buildUrl(`/api/v1/alerts/${encodeURIComponent(created.managementToken)}`),
        verificationRequired: true,
        verifyDelivery: emailResult.status,
        unsubscribeHint: buildUrl(
          `/api/v1/alerts/unsubscribe?token=${encodeURIComponent(created.unsubscribeToken)}`
        ),
        ...(isDryMode ? { devVerificationToken: created.verificationToken } : {}),
      },
      {
        source: 'alerts-api',
        freshness: 'current',
        extra: { mode: getSupabase() ? 'supabase' : 'file' },
      }
    )
  );
});

router.get('/alerts/:managementToken', async (req, res) => {
  const rule = await findRuleByManagementToken(req.params.managementToken);
  if (!rule) {
    return res.status(404).json(errorResponse('ALERT_NOT_FOUND', 'Alert not found.'));
  }
  return res.json(
    successResponse({ alert: sanitizeRuleForResponse(rule) }, { source: 'alerts-api' })
  );
});

router.patch('/alerts/:managementToken', async (req, res) => {
  const existing = await findRuleByManagementToken(req.params.managementToken);
  if (!existing) {
    return res.status(404).json(errorResponse('ALERT_NOT_FOUND', 'Alert not found.'));
  }

  const patch = {};
  if (req.body.condition !== undefined) {
    const condition = parseCondition(req.body.condition);
    if (!condition) {
      return res
        .status(400)
        .json(errorResponse('VALIDATION_ERROR', "condition must be 'above' or 'below'."));
    }
    patch.condition = condition;
  }
  if (req.body.threshold_value !== undefined) {
    const threshold = Number(req.body.threshold_value);
    if (!Number.isFinite(threshold) || threshold <= 0) {
      return res
        .status(400)
        .json(errorResponse('VALIDATION_ERROR', 'threshold_value must be a positive number.'));
    }
    patch.threshold_value = threshold;
  }
  if (req.body.cooldown_minutes !== undefined) {
    patch.cooldown_minutes = parseCooldownMinutes(req.body.cooldown_minutes);
  }
  if (req.body.is_active !== undefined) {
    patch.is_active = req.body.is_active === true;
  }

  const updated = await updateRuleById(existing.id, patch);
  return res.json(
    successResponse({ alert: sanitizeRuleForResponse(updated) }, { source: 'alerts-api' })
  );
});

router.delete('/alerts/:managementToken', async (req, res) => {
  const existing = await findRuleByManagementToken(req.params.managementToken);
  if (!existing) {
    return res.status(404).json(errorResponse('ALERT_NOT_FOUND', 'Alert not found.'));
  }
  const updated = await updateRuleById(existing.id, {
    is_active: false,
    unsubscribed_at: nowIso(),
  });
  await updateSubscriptionByDestination(existing.email, { unsubscribed_at: nowIso() });
  return res.json(
    successResponse(
      {
        alert: sanitizeRuleForResponse(updated),
        deleted: true,
      },
      { source: 'alerts-api' }
    )
  );
});

router.post('/alerts/verify', async (req, res) => {
  const token = safeTrimmed(req.body?.token || req.query?.token, 256);
  if (!token) {
    return res
      .status(400)
      .json(errorResponse('VALIDATION_ERROR', 'Verification token is required.'));
  }
  const verified = await verifyByToken(token);
  if (!verified) {
    return res
      .status(404)
      .json(errorResponse('VERIFY_TOKEN_INVALID', 'Verification token is invalid or expired.'));
  }
  return res.json(
    successResponse(
      {
        verified: true,
        alert: sanitizeRuleForResponse(verified),
      },
      { source: 'alerts-api' }
    )
  );
});

router.post('/alerts/unsubscribe', async (req, res) => {
  const token = safeTrimmed(req.body?.token || req.query?.token, 256);
  if (!token) {
    return res
      .status(400)
      .json(errorResponse('VALIDATION_ERROR', 'Unsubscribe token is required.'));
  }
  const unsubscribed = await unsubscribeByToken(token);
  if (!unsubscribed) {
    return res
      .status(404)
      .json(errorResponse('UNSUBSCRIBE_TOKEN_INVALID', 'Unsubscribe token is invalid or expired.'));
  }
  return res.json(
    successResponse(
      {
        unsubscribed: true,
        destination: unsubscribed.destination,
        channel: unsubscribed.channel,
        unsubscribedAt: unsubscribed.unsubscribedAt,
      },
      { source: 'alerts-api' }
    )
  );
});

function shouldAllowJobRequest(req) {
  const configuredToken = safeTrimmed(process.env.ALERT_JOB_TOKEN, 256);
  if (!configuredToken) return true;
  const inboundToken = safeTrimmed(req.get('x-alert-job-token') || req.body?.jobToken, 256);
  if (!inboundToken) return false;
  if (inboundToken.length !== configuredToken.length) return false;
  return crypto.timingSafeEqual(Buffer.from(configuredToken), Buffer.from(inboundToken));
}

function isDryRunRequest(req) {
  const queryDry = String(req.query?.dryRun || '').toLowerCase() === 'true';
  const bodyDry = req.body?.dryRun === true;
  const headerDry = String(req.get('x-alerts-dry-run') || '').toLowerCase() === 'true';
  return queryDry || bodyDry || headerDry;
}

router.post('/jobs/check-alerts', async (req, res) => {
  if (!shouldAllowJobRequest(req)) {
    return res
      .status(401)
      .json(errorResponse('UNAUTHORIZED', 'Invalid or missing alert job token.'));
  }

  const dryRun = isDryRunRequest(req);
  const snapshot = await readLatestPriceSnapshot();
  if (!snapshot || !Number.isFinite(snapshot.xauUsdPerOz) || snapshot.xauUsdPerOz <= 0) {
    return res
      .status(503)
      .json(errorResponse('PRICE_UNAVAILABLE', 'Latest price snapshot is unavailable.'));
  }

  if (snapshot.isFresh !== true || snapshot.isFallback === true) {
    return res.status(202).json(
      successResponse(
        {
          checked: 0,
          triggered: 0,
          sent: 0,
          skipped: 0,
          skippedReason: 'stale_or_fallback_snapshot',
          snapshot,
        },
        {
          source: snapshot.sourceProvider || 'alerts-job',
          freshness: snapshot.isFresh === true ? 'fresh' : 'stale',
        }
      )
    );
  }

  const rules = await loadActiveRules();
  const nowTs = Date.now();
  let triggered = 0;
  let sent = 0;
  let skipped = 0;
  const results = [];

  for (const rawRule of rules) {
    const rule = {
      ...rawRule,
    };
    const currentValue = computeRulePrice(snapshot, rule);
    const hit = shouldTrigger(rule, currentValue);
    if (!hit) {
      skipped += 1;
      continue;
    }

    if (isWithinCooldown(rule, nowTs)) {
      skipped += 1;
      await writeAlertEvent({
        alert_rule_id: rule.id,
        price_snapshot_id: snapshot.snapshotId,
        channel: rule.channel,
        status: 'skipped_cooldown',
        payload: {
          symbol: rule.symbol,
          currency: rule.currency,
          currentValue,
          thresholdValue: rule.threshold_value,
        },
        error_message: null,
        sent_at: null,
      });
      continue;
    }

    triggered += 1;
    const _subscription = await findSubscriptionForRule(rule);

    if (dryRun) {
      await writeAlertEvent({
        alert_rule_id: rule.id,
        price_snapshot_id: snapshot.snapshotId,
        channel: rule.channel,
        status: 'dry_run',
        payload: {
          symbol: rule.symbol,
          currency: rule.currency,
          currentValue,
          thresholdValue: rule.threshold_value,
        },
        error_message: null,
        sent_at: nowIso(),
      });
      await updateRuleById(rule.id, { last_triggered_at: nowIso() });
      sent += 1;
      results.push({ alert_rule_id: rule.id, status: 'dry_run' });
      continue;
    }

    try {
      const tokenForEmail = generateToken();
      await updateSubscriptionByDestination(rule.email, {
        unsubscribe_token_hash: hashToken(tokenForEmail),
      });
      const delivery = await sendTriggeredAlertEmail({
        rule,
        currentPrice: currentValue,
        snapshotTimestamp: snapshot.timestampUtc,
        sourceLabel: snapshot.sourceProvider || 'price_snapshot',
        unsubscribeToken: tokenForEmail,
      });
      await writeAlertEvent({
        alert_rule_id: rule.id,
        price_snapshot_id: snapshot.snapshotId,
        channel: rule.channel,
        status: delivery.status,
        payload: {
          symbol: rule.symbol,
          currency: rule.currency,
          currentValue,
          thresholdValue: rule.threshold_value,
          mode: delivery.mode,
          messageId: delivery.messageId,
        },
        error_message: null,
        sent_at: nowIso(),
      });
      await updateRuleById(rule.id, { last_triggered_at: nowIso() });
      sent += 1;
      results.push({ alert_rule_id: rule.id, status: delivery.status });
    } catch (error) {
      await writeAlertEvent({
        alert_rule_id: rule.id,
        price_snapshot_id: snapshot.snapshotId,
        channel: rule.channel,
        status: 'failed',
        payload: {
          symbol: rule.symbol,
          currency: rule.currency,
          currentValue,
          thresholdValue: rule.threshold_value,
        },
        error_message: error.message,
        sent_at: null,
      });
      results.push({ alert_rule_id: rule.id, status: 'failed', error: error.message });
    }
  }

  return res.json(
    successResponse(
      {
        checked: rules.length,
        triggered,
        sent,
        skipped,
        dryRun,
        snapshot,
        results,
      },
      {
        source: snapshot.sourceProvider || 'alerts-job',
        freshness: 'fresh',
      }
    )
  );
});

module.exports = router;
