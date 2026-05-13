/**
 * scripts/node/send-newsletter.js
 *
 * Send newsletter to active subscribers via Resend API.
 * Handles batching, personalization, and error tracking.
 *
 * Uses the newsletter repository for subscriber management.
 * In dry-run mode (NEWSLETTER_DRY_RUN=true or Resend vars missing),
 * logs emails without sending.
 */

const { generateDailyDigest, generateWeeklyRecap } = require('./generate-newsletter');
const { sendBatch } = require('../../server/services/email');

// Batch size — Resend allows up to 100 per batch
const BATCH_SIZE = 100;

async function getActiveSubscribers(_preferences = {}) {
  // Try Supabase first
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (supabaseUrl && supabaseKey) {
    try {
      const { createClient } = require('@supabase/supabase-js');
      const supabase = createClient(supabaseUrl, supabaseKey);

      let query = supabase
        .from('newsletter_subscribers')
        .select('id, email, preferences, locale')
        .eq('status', 'active');

      if (_preferences.frequency) {
        // Filter by frequency preference
        query = query.contains('preferences', { frequency: _preferences.frequency });
      }

      const { data, error } = await query;

      if (!error && Array.isArray(data)) {
        console.log(`[Newsletter] Fetched ${data.length} active subscribers from Supabase`);
        return data;
      }
      if (error) console.warn('[Newsletter] Supabase query failed:', error.message);
    } catch (err) {
      console.warn('[Newsletter] Supabase unavailable, falling back to file store:', err.message);
    }
  }

  // Fall back to file store
  try {
    const repo = require('../../server/repositories/newsletter.repository');
    const subs = repo.getActive();
    console.log(`[Newsletter] Fetched ${subs.length} active subscribers from file store`);
    return subs;
  } catch (err) {
    console.warn('[Newsletter] File store unavailable:', err.message);
    return [];
  }
}

async function recordCampaign(type, subject, stats) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (supabaseUrl && supabaseKey) {
    try {
      const { createClient } = require('@supabase/supabase-js');
      const supabase = createClient(supabaseUrl, supabaseKey);

      await supabase.from('email_campaigns').insert({
        type,
        subject,
        content_html: stats.html || null,
        status: 'sent',
        sent_at: new Date().toISOString(),
        total_recipients: stats.sent || 0,
        created_by: 'system',
      });
    } catch (err) {
      console.warn('[Newsletter] Could not record campaign in Supabase:', err.message);
    }
  }

  console.log(
    `[Newsletter] Campaign recorded: ${type} — ${stats.sent} sent, ${stats.failed} failed`
  );
}

async function sendNewsletter(type = 'daily') {
  try {
    console.log(`[Newsletter] Starting ${type} newsletter send…`);

    const subscribers = await getActiveSubscribers({ frequency: type });

    if (subscribers.length === 0) {
      console.log('[Newsletter] No active subscribers found.');
      return;
    }

    console.log(`[Newsletter] Found ${subscribers.length} active subscribers`);

    const content = type === 'weekly' ? await generateWeeklyRecap() : await generateDailyDigest();

    console.log(`[Newsletter] Generated content: ${content.subject}`);

    const siteUrl = process.env.SITE_URL || 'https://goldtickerlive.com';

    let totalSent = 0;
    let totalFailed = 0;

    for (let i = 0; i < subscribers.length; i += BATCH_SIZE) {
      const batch = subscribers.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      console.log(`[Newsletter] Sending batch ${batchNum}…`);

      const emails = batch.map((s) => {
        const unsubUrl = `${siteUrl}/content/unsubscribe/?email=${encodeURIComponent(s.email)}`;
        const html = content.html.replace(/\{\{email\}\}/g, s.email).replace(
          '</body>',
          `<div style="text-align:center;padding:16px;font-size:0.75rem;color:#64748b">
            <a href="${unsubUrl}" style="color:#64748b">Unsubscribe</a>
          </div></body>`
        );
        return { to: s.email, subject: content.subject, html, text: content.text || '' };
      });

      const { sent, failed } = await sendBatch(emails);
      totalSent += sent;
      totalFailed += failed;

      // Rate limiting between batches
      if (i + BATCH_SIZE < subscribers.length) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    await recordCampaign(type, content.subject, {
      html: content.html,
      sent: totalSent,
      failed: totalFailed,
    });

    console.log(`[Newsletter] Completed: ${totalSent} sent, ${totalFailed} failed`);
  } catch (err) {
    console.error('[Newsletter] Error sending newsletter:', err.message);
    process.exit(1);
  }
}

// CLI usage
if (require.main === module) {
  const type = process.argv[2] || 'daily';

  if (!['daily', 'weekly'].includes(type)) {
    console.error('Usage: node send-newsletter.js [daily|weekly]');
    process.exit(1);
  }

  sendNewsletter(type);
}

module.exports = { sendNewsletter };
