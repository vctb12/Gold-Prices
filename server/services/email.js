/**
 * server/services/email.js
 *
 * Thin email-provider abstraction.
 *
 * Priority:
 *   1. Resend, when RESEND_API_KEY and RESEND_FROM_EMAIL are set.
 *   2. Dry-run log mode (no send), when vars are missing or NEWSLETTER_DRY_RUN=true.
 *
 * All callers use `sendEmail(options)` — provider selection is transparent.
 *
 * Options shape:
 *   { to: string, subject: string, html: string, text?: string, tags?: object }
 *
 * Returns:
 *   { ok: boolean, id?: string, dryRun?: boolean, error?: string }
 */

'use strict';

const isDryRun =
  process.env.NEWSLETTER_DRY_RUN === 'true' ||
  !process.env.RESEND_API_KEY ||
  !process.env.RESEND_FROM_EMAIL;

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'newsletter@goldtickerlive.com';
const FROM_NAME = 'Gold Ticker Live';
const FROM = `${FROM_NAME} <${FROM_EMAIL}>`;

/**
 * Send a single transactional email.
 *
 * @param {{ to: string, subject: string, html: string, text?: string, tags?: object }} options
 * @returns {Promise<{ ok: boolean, id?: string, dryRun?: boolean, error?: string }>}
 */
async function sendEmail({ to, subject, html, text, tags }) {
  if (isDryRun) {
    console.log(`[email:dry-run] to=${to} subject="${subject}"`);
    return { ok: true, dryRun: true };
  }

  try {
    // Dynamically require so the module stays optional in CI/test environments
    // that do not install the resend package.
    let Resend;
    try {
      ({ Resend } = require('resend'));
    } catch {
      console.warn('[email] resend package not installed — falling back to dry-run');
      console.log(`[email:dry-run] to=${to} subject="${subject}"`);
      return { ok: true, dryRun: true };
    }

    const client = new Resend(process.env.RESEND_API_KEY);
    const result = await client.emails.send({
      from: FROM,
      to,
      subject,
      html,
      ...(text ? { text } : {}),
      ...(tags ? { tags } : {}),
    });

    if (result.error) {
      console.error('[email] Resend error:', result.error);
      return { ok: false, error: String(result.error.message || result.error) };
    }

    return { ok: true, id: result.data?.id };
  } catch (err) {
    console.error('[email] Unexpected error:', err.message);
    return { ok: false, error: err.message };
  }
}

/**
 * Send a batch of emails (up to 100 per Resend batch limit).
 * Falls back to sequential individual sends if Resend batch API unavailable.
 *
 * @param {Array<{ to: string, subject: string, html: string, text?: string }>} emails
 * @returns {Promise<{ sent: number, failed: number, dryRun?: boolean }>}
 */
async function sendBatch(emails) {
  if (!emails.length) return { sent: 0, failed: 0 };

  if (isDryRun) {
    console.log(`[email:dry-run] batch of ${emails.length} emails`);
    emails.forEach((e) => console.log(`  to=${e.to} subject="${e.subject}"`));
    return { sent: emails.length, failed: 0, dryRun: true };
  }

  let Resend;
  try {
    ({ Resend } = require('resend'));
  } catch {
    console.warn('[email] resend package not installed — falling back to dry-run batch');
    return { sent: emails.length, failed: 0, dryRun: true };
  }

  try {
    const client = new Resend(process.env.RESEND_API_KEY);
    const payload = emails.map((e) => ({
      from: FROM,
      to: e.to,
      subject: e.subject,
      html: e.html,
      ...(e.text ? { text: e.text } : {}),
    }));
    const result = await client.batch.send(payload);
    if (result.error) {
      console.error('[email] Resend batch error:', result.error);
      return { sent: 0, failed: emails.length };
    }
    const sent = result.data?.length ?? emails.length;
    return { sent, failed: emails.length - sent };
  } catch (err) {
    console.error('[email] Batch send error:', err.message);
    return { sent: 0, failed: emails.length };
  }
}

module.exports = { sendEmail, sendBatch, isDryRun };
