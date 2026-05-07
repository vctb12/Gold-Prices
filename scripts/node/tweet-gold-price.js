#!/usr/bin/env node
/**
 * scripts/tweet-gold-price.js
 *
 * Reads the live XAU/USD spot price from data/gold_price.json (written every 6 min
 * by the gold-price-fetch workflow, source: goldpricez.com) and posts a
 * formatted tweet via the X / Twitter API v2.
 *
 * Runs from .github/workflows/gold-price-tweet.yml on a hourly schedule.
 *
 * Required GitHub Secrets (set in Settings → Secrets → Actions):
 *   (no gold API key needed — the fetch workflow is the only place the goldpricez key is used)
 *   TWITTER_API_KEY             – X Developer Portal: API Key (Consumer Key)
 *   TWITTER_API_SECRET          – X Developer Portal: API Key Secret
 *   TWITTER_ACCESS_TOKEN        – X Developer Portal: Access Token (read-write)
 *   TWITTER_ACCESS_TOKEN_SECRET – X Developer Portal: Access Token Secret
 *
 * The script rotates across 7 distinct templates depending on the hour (UTC+4 Dubai):
 *   06:00 → morning     12:00 → midday (hourly)    20:00 → evening
 *   08:00 → arabic      00:00 → daily              Fri/Sat → weekend
 *   Other hours → hourly snapshot
 *
 * See docs/TWITTER_AUTOMATION.md for full setup instructions.
 */

'use strict';

const https = require('https');
const crypto = require('crypto');
const url = require('url');

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const SITE_URL = 'https://goldtickerlive.com/';
const GOLD_PRICE_FILE = require('path').resolve(__dirname, '..', '..', 'data', 'gold_price.json');
const TWEET_URL = 'https://api.twitter.com/2/tweets';
const AED_PEG = 3.6725;
const TROY_OZ = 31.1035;

// Credentials from environment
const TWITTER_API_KEY = process.env.TWITTER_API_KEY || '';
const TWITTER_API_SECRET = process.env.TWITTER_API_SECRET || '';
const TWITTER_ACCESS_TOKEN = process.env.TWITTER_ACCESS_TOKEN || '';
const TWITTER_ACCESS_TOKEN_SECRET = process.env.TWITTER_ACCESS_TOKEN_SECRET || '';

// Read the canonical gold-price payload (written every 6 min by
// .github/workflows/gold-price-fetch.yml from goldpricez.com).
function readGoldPrice() {
  const fs = require('fs');
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

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------
function fmt(n, decimals = 2) {
  if (n == null || isNaN(n)) return '—';
  return n.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function trendEmoji(pct) {
  if (pct == null || isNaN(pct)) return '➡️';
  if (pct > 1) return '🚀';
  if (pct > 0) return '📈';
  if (pct < -1) return '📉';
  if (pct < 0) return '🔻';
  return '➡️';
}

function calcKarat(spotUsdPerOz, purity) {
  const usdPerGram = (spotUsdPerOz / TROY_OZ) * purity;
  const aedPerGram = usdPerGram * AED_PEG;
  return { usdPerGram, aedPerGram };
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------
function httpsPost(targetUrl, payload, headers = {}) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const parsedUrl = new url.URL(targetUrl);
    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        ...headers,
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        let parsed;
        try {
          parsed = JSON.parse(data);
        } catch {
          parsed = data;
        }
        if (res.statusCode >= 400) {
          return reject(new Error(`HTTP ${res.statusCode}: ${JSON.stringify(parsed)}`));
        }
        resolve(parsed);
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => {
      req.destroy(new Error('Request timed out'));
    });
    req.write(body);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// OAuth 1.0a  (X API v2 uses OAuth 1.0a User Context for posting)
// ---------------------------------------------------------------------------
function percentEncode(s) {
  return encodeURIComponent(String(s))
    .replace(/!/g, '%21')
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')
    .replace(/\*/g, '%2A');
}

function buildOAuthHeader(
  method,
  endpointUrl,
  consumerKey,
  consumerSecret,
  accessToken,
  tokenSecret
) {
  const nonce = crypto.randomBytes(16).toString('hex');
  const timestamp = Math.floor(Date.now() / 1000).toString();

  const oauthParams = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: nonce,
    // Upgrade from HMAC-SHA1 (the RFC 5849 default) to HMAC-SHA256. The X / Twitter
    // v2 API accepts `HMAC-SHA256` as an oauth_signature_method value, and SHA-1
    // is considered cryptographically weak by modern code-scanning tooling
    // (CodeQL: insufficient-password-hash / insecure-hash). If X ever drops
    // SHA-256 support this will need to be revisited, but as of 2024 both
    // methods are supported side-by-side.
    oauth_signature_method: 'HMAC-SHA256',
    oauth_timestamp: timestamp,
    oauth_token: accessToken,
    oauth_version: '1.0',
  };

  // Signature base string: method + URL + sorted encoded params
  const sortedParams = Object.keys(oauthParams)
    .sort()
    .map((k) => `${percentEncode(k)}=${percentEncode(oauthParams[k])}`)
    .join('&');

  const signatureBase = [
    method.toUpperCase(),
    percentEncode(endpointUrl),
    percentEncode(sortedParams),
  ].join('&');

  const signingKey = `${percentEncode(consumerSecret)}&${percentEncode(tokenSecret)}`;
  // This is an HMAC (a message-authentication code), not a password hash.
  // OAuth 1.0a requires an HMAC over the request signature-base string to
  // prove integrity of the request. We use SHA-256; the v2 X/Twitter API
  // accepts `HMAC-SHA256` alongside the legacy SHA-1 default. No user
  // password is involved — `signingKey` is derived from OAuth application
  // secrets delivered to us by the upstream API. CodeQL's
  // `js/insufficient-password-hash` fires here because the signing
  // material contains the substring "Secret"; that is a semantic false
  // positive for the OAuth HMAC construction.
  // lgtm[js/insufficient-password-hash]
  const signature = crypto.createHmac('sha256', signingKey).update(signatureBase).digest('base64');

  oauthParams.oauth_signature = signature;

  const headerValue =
    'OAuth ' +
    Object.keys(oauthParams)
      .sort()
      .map((k) => `${percentEncode(k)}="${percentEncode(oauthParams[k])}"`)
      .join(', ');

  return { Authorization: headerValue };
}

// ---------------------------------------------------------------------------
// Tweet templates (self-contained, no ES-module import needed)
// ---------------------------------------------------------------------------

/**
 * Pick a template ID based on the hour in Dubai time (UTC+4) and day of week.
 * @param {Date} now
 * @returns {string}
 */
function pickTemplate(now) {
  const dubaiHour = (now.getUTCHours() + 4) % 24;
  const dayOfWeek = new Date(now.getTime() + 4 * 3600 * 1000).getUTCDay(); // 0=Sun,5=Fri,6=Sat

  // Midnight: full daily breakdown
  if (dubaiHour === 0) return 'daily';
  // Morning market open
  if (dubaiHour === 6) return 'morning';
  // Arabic edition (08:00 Dubai = peak GCC engagement)
  if (dubaiHour === 8) return 'arabic';
  // Country-specific post (10:00 Dubai)
  if (dubaiHour === 10) return 'country';
  // Midday comparison (14:00 Dubai)
  if (dubaiHour === 14) return 'comparison';
  // Educational post (16:00 Dubai)
  if (dubaiHour === 16) return 'educational';
  // Evening wrap-up
  if (dubaiHour === 20) return 'evening';
  // Weekend edition on Fridays at noon
  if ((dayOfWeek === 5 || dayOfWeek === 6) && dubaiHour === 12) return 'weekend';
  // Default: hourly snapshot
  return 'hourly';
}

function buildTweetText(templateId, data) {
  const { spotUsdPerOz, dayOpenUsdPerOz, generatedAt } = data;
  const change = dayOpenUsdPerOz ? spotUsdPerOz - dayOpenUsdPerOz : null;
  const changePct = dayOpenUsdPerOz
    ? ((spotUsdPerOz - dayOpenUsdPerOz) / dayOpenUsdPerOz) * 100
    : null;
  const sign = change != null && change >= 0 ? '+' : '';

  const k24 = calcKarat(spotUsdPerOz, 1.0);
  const k22 = calcKarat(spotUsdPerOz, 22 / 24);
  const k21 = calcKarat(spotUsdPerOz, 21 / 24);
  const k18 = calcKarat(spotUsdPerOz, 18 / 24);

  switch (templateId) {
    case 'hourly': {
      const time = new Date(generatedAt).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Dubai',
        hour12: true,
      });
      return [
        `🥇 Gold Now (${time} UAE) ${trendEmoji(changePct)}`,

        `Spot: $${fmt(spotUsdPerOz)}/oz` + (change != null ? ` ${sign}${fmt(changePct)}%` : ''),

        `24K: AED ${fmt(k24.aedPerGram)}/g`,
        `22K: AED ${fmt(k22.aedPerGram)}/g`,
        `21K: AED ${fmt(k21.aedPerGram)}/g`,

        `📊 ${SITE_URL}`,

        '#GoldPrice #Gold #UAE #Dubai',
      ].join('\n');
    }

    case 'daily': {
      const date = new Date(generatedAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      const changeStr = change != null ? ` (${sign}${fmt(changePct)}%)` : '';
      return [
        `🥇 Gold Ticker Live — Gold Prices Today, ${date}`,

        `24K: $${fmt(spotUsdPerOz)}/oz${changeStr}`,
        '🇦🇪 UAE (AED/g):',
        `24K: ${fmt(k24.aedPerGram)} | 22K: ${fmt(k22.aedPerGram)}`,
        `21K: ${fmt(k21.aedPerGram)} | 18K: ${fmt(k18.aedPerGram)}`,

        `${trendEmoji(changePct)} ${SITE_URL}`,

        '#GoldPrice #Gold #UAE #Dubai',
      ].join('\n');
    }

    case 'morning': {
      const date = new Date(generatedAt).toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
      });
      return [
        `☀️ Good Morning — Gold Opens ${date}`,

        `Spot: $${fmt(spotUsdPerOz)}/oz ${trendEmoji(changePct)}`,

        change != null ? `vs Yesterday: ${sign}$${fmt(change)} (${sign}${fmt(changePct)}%)` : null,

        `🇦🇪 24K UAE: AED ${fmt(k24.aedPerGram)}/g`,
        `🇦🇪 22K UAE: AED ${fmt(k22.aedPerGram)}/g`,

        `Track live → ${SITE_URL}`,

        '#GoldPrice #GoldMarket #Dubai #GCC',
      ]
        .filter(Boolean)
        .join('\n');
    }

    case 'evening': {
      const date = new Date(generatedAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      return [
        `🌙 Gold End of Day — ${date}`,

        `Close: $${fmt(spotUsdPerOz)}/oz ${trendEmoji(changePct)}`,
        dayOpenUsdPerOz ? `Open:  $${fmt(dayOpenUsdPerOz)}/oz` : null,
        change != null ? `Change: ${sign}$${fmt(change)} (${sign}${fmt(changePct)}%)` : null,

        `🇦🇪 24K Dubai: AED ${fmt(k24.aedPerGram)}/g`,

        `Charts → ${SITE_URL}`,

        '#GoldClose #GoldPrice #Dubai',
      ]
        .filter(Boolean)
        .join('\n');
    }

    case 'arabic': {
      const date = new Date(generatedAt).toLocaleDateString('ar-AE', {
        month: 'short',
        day: 'numeric',
      });
      const trend = changePct == null ? '➡️' : changePct > 0 ? '📈' : changePct < 0 ? '📉' : '➡️';
      return [
        `🥇 أسعار الذهب اليوم — ${date} ${trend}`,

        `عيار 24: ${fmt(k24.aedPerGram)} درهم/جرام`,

        `عيار 22: ${fmt(k22.aedPerGram)} درهم/جرام`,

        `عيار 21: ${fmt(k21.aedPerGram)} درهم/جرام`,

        `عيار 18: ${fmt(k18.aedPerGram)} درهم/جرام`,

        change != null ? `التغيير: ${sign}$${fmt(change)} (${sign}${fmt(changePct)}%)` : null,

        `📊 ${SITE_URL}`,

        '#سعر_الذهب #ذهب #الإمارات #دبي',
      ]
        .filter(Boolean)
        .join('\n');
    }

    case 'weekend': {
      return [
        `🌅 Weekend Gold Wrap-Up ${trendEmoji(changePct)}`,

        `Current: $${fmt(spotUsdPerOz)}/oz`,

        change != null ? `Today:   ${sign}$${fmt(change)} (${sign}${fmt(changePct)}%)` : null,

        `🇦🇪 24K: AED ${fmt(k24.aedPerGram)}/g | 22K: AED ${fmt(k22.aedPerGram)}/g`,

        `📊 ${SITE_URL}`,

        '#GoldWeekend #GoldPrice #GCC',
      ]
        .filter(Boolean)
        .join('\n');
    }

    case 'comparison': {
      const usdPerGram24 = spotUsdPerOz / TROY_OZ;
      return [
        '📊 Gold Karat Comparison Right Now',
        '',
        `24K: AED ${fmt(k24.aedPerGram)}/g ($${fmt(usdPerGram24)})`,

        `22K: AED ${fmt(k22.aedPerGram)}/g`,

        `21K: AED ${fmt(k21.aedPerGram)}/g`,

        `18K: AED ${fmt(k18.aedPerGram)}/g`,

        '',
        `Spot: $${fmt(spotUsdPerOz)}/oz ${trendEmoji(changePct)}`,

        `Compare all → ${SITE_URL}tracker.html#mode=compare`,

        '#GoldKarat #24KGold #22KGold #UAE',
      ].join('\n');
    }

    case 'country': {
      // Rotate through GCC countries by day of month
      const countries = [
        { flag: '🇦🇪', name: 'UAE', cur: 'AED', rate: AED_PEG, slug: 'uae' },
        { flag: '🇸🇦', name: 'Saudi Arabia', cur: 'SAR', rate: 3.75, slug: 'saudi-arabia' },
        { flag: '🇰🇼', name: 'Kuwait', cur: 'KWD', rate: 0.308, slug: 'kuwait' },
        { flag: '🇶🇦', name: 'Qatar', cur: 'QAR', rate: 3.64, slug: 'qatar' },
        { flag: '🇧🇭', name: 'Bahrain', cur: 'BHD', rate: 0.376, slug: 'bahrain' },
        { flag: '🇴🇲', name: 'Oman', cur: 'OMR', rate: 0.3845, slug: 'oman' },
        { flag: '🇪🇬', name: 'Egypt', cur: 'EGP', rate: 50.0, slug: 'egypt' },
      ];
      const dayOfMonth = new Date(generatedAt).getUTCDate();
      const c = countries[dayOfMonth % countries.length];
      const localPerGram24 = (spotUsdPerOz / TROY_OZ) * c.rate;
      const localPerGram22 = (spotUsdPerOz / TROY_OZ) * (22 / 24) * c.rate;
      return [
        `${c.flag} Gold in ${c.name} Today ${trendEmoji(changePct)}`,
        '',
        `24K: ${c.cur} ${fmt(localPerGram24)}/g`,
        `22K: ${c.cur} ${fmt(localPerGram22)}/g`,
        `Spot: $${fmt(spotUsdPerOz)}/oz`,
        change != null ? `Change: ${sign}${fmt(changePct)}%` : null,
        '',
        `Full prices → ${SITE_URL}countries/${c.slug}.html`,
        `#GoldPrice #${c.name.replace(/\s/g, '')} #Gold`,
      ]
        .filter(Boolean)
        .join('\n');
    }

    case 'educational': {
      const facts = [
        '💡 Did you know? 24K gold is 99.9% pure, while 22K is 91.7% pure. The difference affects both price and durability.',
        '💡 Gold Fact: 1 troy ounce = 31.1035 grams. This is heavier than a standard ounce (28.35g).',
        '💡 The AED is pegged to USD at 3.6725 — so UAE gold prices move exactly with the global spot.',
        "💡 Gold has been money for 5,000+ years. It's the only metal that doesn't corrode or tarnish.",
        '💡 Zakat on gold: If you own 85g+ of pure gold for one lunar year, 2.5% is due as zakat.',
        '💡 21K gold (87.5% pure) is the most popular for jewellery in the Gulf region.',
        '💡 All the gold ever mined would fit in a cube measuring about 21 meters on each side.',
      ];
      const factIndex = Math.floor(Date.now() / (24 * 60 * 60 * 1000)) % facts.length;
      return [
        facts[factIndex],
        '',
        `Current spot: $${fmt(spotUsdPerOz)}/oz ${trendEmoji(changePct)}`,
        `🇦🇪 24K: AED ${fmt(k24.aedPerGram)}/g`,
        '',
        `Learn more → ${SITE_URL}learn.html`,
        '#GoldFacts #Gold #GoldPrice',
      ].join('\n');
    }

    default:
      return buildTweetText('hourly', data);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  // Validate credentials
  const missing = [
    ['TWITTER_API_KEY', TWITTER_API_KEY],
    ['TWITTER_API_SECRET', TWITTER_API_SECRET],
    ['TWITTER_ACCESS_TOKEN', TWITTER_ACCESS_TOKEN],
    ['TWITTER_ACCESS_TOKEN_SECRET', TWITTER_ACCESS_TOKEN_SECRET],
  ]
    .filter(([, v]) => !v)
    .map(([k]) => k);

  if (missing.length > 0) {
    console.log('⚠️  Missing environment variables:', missing.join(', '));
    console.log('   See docs/TWITTER_AUTOMATION.md for setup instructions.');
    console.log('   Skipping tweet — configure secrets in repo Settings → Secrets → Actions.');
    process.exit(0);
  }

  // 1. Load gold price from the canonical data file
  console.log('📡 Reading gold price from data/gold_price.json (goldpricez.com)…');
  let goldData;
  try {
    goldData = readGoldPrice();
  } catch (err) {
    console.error('❌ Failed to read gold price data file:', err.message);
    process.exit(1);
  }

  const spotUsdPerOz = goldData.price;
  if (typeof spotUsdPerOz !== 'number' || spotUsdPerOz <= 0) {
    console.error('❌ Invalid price in data/gold_price.json:', goldData);
    process.exit(1);
  }

  const generatedAt = new Date().toISOString();
  const dayOpenUsdPerOz = goldData.prev_close_price || null;

  console.log(`✅ Spot price: $${fmt(spotUsdPerOz)}/oz`);

  // 2. Pick template based on current time
  const now = new Date(generatedAt);
  const templateId = pickTemplate(now);
  console.log(`📝 Using template: ${templateId}`);

  // 3. Build tweet text
  const tweetText = buildTweetText(templateId, {
    spotUsdPerOz,
    dayOpenUsdPerOz,
    generatedAt,
  });

  console.log(`\n--- Tweet preview (${[...tweetText].length} chars) ---`);
  console.log(tweetText);
  console.log('---\n');

  if ([...tweetText].length > 280) {
    console.warn('⚠️  Tweet exceeds 280 characters — it will be truncated by X.');
  }

  // 4. Build OAuth header and post to X API v2
  const authHeaders = buildOAuthHeader(
    'POST',
    TWEET_URL,
    TWITTER_API_KEY,
    TWITTER_API_SECRET,
    TWITTER_ACCESS_TOKEN,
    TWITTER_ACCESS_TOKEN_SECRET
  );

  console.log('📤 Posting tweet…');
  let response;
  try {
    response = await httpsPost(TWEET_URL, { text: tweetText }, authHeaders);
  } catch (err) {
    console.error('❌ Failed to post tweet:', err.message);
    process.exit(1);
  }

  if (response && response.data && response.data.id) {
    const tweetId = response.data.id;
    console.log(`✅ Tweet posted! https://twitter.com/i/web/status/${tweetId}`);
  } else {
    console.error('❌ Unexpected response from X API:', JSON.stringify(response));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('❌ Unhandled error:', err.message);
  process.exit(1);
});
