#!/usr/bin/env node
/**
 * scripts/notify-discord.js
 *
 * Fetches the live XAU/USD spot price and posts a rich embed to a Discord
 * channel using a webhook (no bot token needed).
 *
 * Required GitHub Secrets:
 *   (reads data/gold_price.json — the gold-price-fetch workflow is the only place the goldpricez key is used)
 *   DISCORD_WEBHOOK_URL   – Discord channel webhook URL
 *
 * Setup:
 *   1. In Discord: Server Settings → Integrations → Webhooks → New Webhook
 *   2. Choose the channel and copy the webhook URL
 *   3. Add as DISCORD_WEBHOOK_URL secret in GitHub Settings → Secrets → Actions
 *
 * See docs/AUTOMATIONS.md for details.
 */

'use strict';

const https = require('https');
const fs = require('fs');
const path = require('path');

const SITE_URL = 'https://goldtickerlive.com/';
const GOLD_PRICE_FILE = path.resolve(__dirname, '..', '..', 'data', 'gold_price.json');
const AED_PEG = 3.6725;
const TROY_OZ = 31.1035;

const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK_URL || '';

function readGoldPrice() {
  const raw = fs.readFileSync(GOLD_PRICE_FILE, 'utf8');
  const data = JSON.parse(raw);
  const price =
    typeof data?.xau_usd_per_oz === 'number' && data.xau_usd_per_oz > 0
      ? data.xau_usd_per_oz
      : data?.gold?.ounce_usd;
  if (typeof price !== 'number' || price <= 0) {
    throw new Error(
      'data/gold_price.json missing or invalid spot price (xau_usd_per_oz / gold.ounce_usd)'
    );
  }
  return {
    price,
    prev_close_price: data?.gold?.day_low_usd || null,
    updatedAt: data.timestamp_utc || data.fetched_at_utc || new Date().toISOString(),
  };
}

function fmt(n, decimals = 2) {
  if (n == null || isNaN(n)) return '—';
  return n.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function calcAedPerGram(spotUsdPerOz, purity) {
  return (spotUsdPerOz / TROY_OZ) * purity * AED_PEG;
}

function httpsPost(url, payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const u = new (require('url').URL)(url);
    const opts = {
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => {
        data += c;
      });
      res.on('end', () => {
        // Discord 204 = success
        if (res.statusCode === 204 || res.statusCode === 200) return resolve({ ok: true });
        return reject(new Error(`HTTP ${res.statusCode}: ${data}`));
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => req.destroy(new Error('Timeout')));
    req.write(body);
    req.end();
  });
}

async function main() {
  const missing = [['DISCORD_WEBHOOK_URL', DISCORD_WEBHOOK]].filter(([, v]) => !v).map(([k]) => k);

  if (missing.length) {
    console.log('⚠️  Missing env vars:', missing.join(', '));
    console.log(
      '   Skipping Discord post — configure secrets in repo Settings → Secrets → Actions.'
    );
    process.exit(0);
  }

  console.log('📡 Reading gold price from data/gold_price.json (goldpricez.com)…');
  let goldData;
  try {
    goldData = readGoldPrice();
  } catch (err) {
    console.error('❌ Gold price data file error:', err.message);
    process.exit(1);
  }

  const spot = goldData.price;
  if (typeof spot !== 'number' || spot <= 0) {
    console.error('❌ Invalid price:', goldData);
    process.exit(1);
  }

  const open = goldData.prev_close_price || goldData.open_price || null;
  const change = open ? spot - open : null;
  const changePct = open ? ((spot - open) / open) * 100 : null;
  const sign = change != null && change >= 0 ? '+' : '';
  const color = changePct == null ? 0xd4a017 : changePct >= 0 ? 0x10b981 : 0xef4444;

  const now = new Date();
  const date = now.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const time = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Dubai',
    hour12: true,
  });

  const k24 = calcAedPerGram(spot, 1.0);
  const k22 = calcAedPerGram(spot, 22 / 24);
  const k21 = calcAedPerGram(spot, 21 / 24);
  const k18 = calcAedPerGram(spot, 18 / 24);

  // Discord rich embed
  const embed = {
    title: `🥇 Gold Ticker Live — Gold Prices ${date}`,
    url: SITE_URL,
    color,
    fields: [
      {
        name: 'Spot Price',
        value: `**$${fmt(spot)}/oz**${change != null ? `\n${sign}$${fmt(change)} (${sign}${fmt(changePct)}%)` : ''}`,
        inline: true,
      },
      { name: '24K AED/g', value: `AED **${fmt(k24)}**`, inline: true },
      { name: '22K AED/g', value: `AED **${fmt(k22)}**`, inline: true },
      { name: '21K AED/g', value: `AED **${fmt(k21)}**`, inline: true },
      { name: '18K AED/g', value: `AED **${fmt(k18)}**`, inline: true },
    ],
    footer: { text: `${time} UAE time  •  Gold Ticker Live` },
    timestamp: now.toISOString(),
  };

  const payload = {
    username: 'Gold Ticker Live Bot',
    avatar_url: 'https://goldtickerlive.com/assets/favicon-192x192.png',
    embeds: [embed],
  };

  console.log('📤 Posting to Discord…');
  try {
    await httpsPost(DISCORD_WEBHOOK, payload);
    console.log('✅ Discord embed posted!');
  } catch (err) {
    console.error('❌ Discord webhook error:', err.message);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('❌ Unhandled error:', err.message);
  process.exit(1);
});
