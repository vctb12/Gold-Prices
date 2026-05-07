/**
 * scripts/node/generate-newsletter.js
 *
 * Generate HTML email content for daily/weekly newsletters.
 * Reads the canonical gold price from data/gold_price.json (committed
 * every 6 min by gold-price-fetch.yml, source: goldpricez.com) and
 * fetches live FX rates from open.er-api.com.
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Configuration
const GOLD_PRICE_FILE = path.resolve(__dirname, '..', '..', 'data', 'gold_price.json');
const FX_API_URL = 'https://open.er-api.com/v6/latest/USD';
const SITE_URL = (process.env.SITE_URL || 'https://goldtickerlive.com').replace(/\/$/, '');

async function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      })
      .on('error', reject);
  });
}

async function fetchGoldPrice() {
  try {
    const raw = fs.readFileSync(GOLD_PRICE_FILE, 'utf8');
    const data = JSON.parse(raw);
    const price =
      typeof data?.xau_usd_per_oz === 'number' && data.xau_usd_per_oz > 0
        ? data.xau_usd_per_oz
        : data?.gold?.ounce_usd;
    if (typeof price !== 'number' || price <= 0) {
      throw new Error(
        'gold_price.json missing or invalid spot price (xau_usd_per_oz / gold.ounce_usd)'
      );
    }
    return {
      price,
      change24h: 0,
      updatedAt: data.timestamp_utc || data.fetched_at_utc || new Date().toISOString(),
    };
  } catch (error) {
    console.error('Error reading gold price from data file:', error);
    throw error;
  }
}

async function fetchFXRates() {
  try {
    const data = await fetchJson(FX_API_URL);
    return data.rates;
  } catch (error) {
    console.error('Error fetching FX rates:', error);
    throw error;
  }
}

function calculateKaratPrices(spotPrice, fxRate) {
  const TROY_OZ_GRAMS = 31.1035;
  const usdPerGram = spotPrice / TROY_OZ_GRAMS;

  const karats = {
    '24K': { purity: 1.0 },
    '22K': { purity: 0.9167 },
    '21K': { purity: 0.875 },
    '18K': { purity: 0.75 },
  };

  const prices = {};
  for (const [karat, { purity }] of Object.entries(karats)) {
    const pricePerGram = usdPerGram * purity * fxRate;
    prices[karat] = {
      perGram: pricePerGram.toFixed(2),
      per10Grams: (pricePerGram * 10).toFixed(2),
      perTola: (pricePerGram * 11.6638).toFixed(2),
    };
  }

  return prices;
}

function formatDate(date) {
  return new Date(date).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

async function generateDailyDigest() {
  const gold = await fetchGoldPrice();
  const fxRates = await fetchFXRates();

  // Calculate prices for UAE (AED)
  const AED_PEG = 3.6725;
  const aedPrices = calculateKaratPrices(gold.price, AED_PEG);

  // Calculate prices for Saudi Arabia (SAR)
  const sarPrices = calculateKaratPrices(gold.price, fxRates.SAR);

  const changeIndicator = gold.change24h >= 0 ? '📈' : '📉';
  const changeColor = gold.change24h >= 0 ? '#10b981' : '#ef4444';

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Daily Gold Price Digest</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 20px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">
                💰 Daily Gold Digest
              </h1>
              <p style="margin: 10px 0 0; color: rgba(255,255,255,0.9); font-size: 16px;">
                ${formatDate(new Date())}
              </p>
            </td>
          </tr>

          <!-- Spot Price Section -->
          <tr>
            <td style="padding: 30px;">
              <div style="text-align: center; padding: 20px; background-color: #f8fafc; border-radius: 8px;">
                <p style="margin: 0 0 10px; color: #64748b; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">
                  XAU/USD Spot Price
                </p>
                <h2 style="margin: 0; color: #1e293b; font-size: 48px; font-weight: bold;">
                  $${gold.price.toFixed(2)}
                </h2>
                <p style="margin: 10px 0 0; color: ${changeColor}; font-size: 18px; font-weight: 600;">
                  ${changeIndicator} ${gold.change24h >= 0 ? '+' : ''}${gold.change24h.toFixed(2)}%
                </p>
              </div>
            </td>
          </tr>

          <!-- UAE Prices -->
          <tr>
            <td style="padding: 0 30px 30px;">
              <h3 style="margin: 0 0 15px; color: #1e293b; font-size: 20px; font-weight: 600;">
                🇦🇪 UAE (AED) Prices
              </h3>
              <table width="100%" cellpadding="10" cellspacing="0" style="border-collapse: collapse;">
                <thead>
                  <tr style="background-color: #f8fafc;">
                    <th style="text-align: left; padding: 12px; border-bottom: 2px solid #e2e8f0; color: #64748b; font-weight: 600; font-size: 14px;">Karat</th>
                    <th style="text-align: right; padding: 12px; border-bottom: 2px solid #e2e8f0; color: #64748b; font-weight: 600; font-size: 14px;">Per Gram</th>
                    <th style="text-align: right; padding: 12px; border-bottom: 2px solid #e2e8f0; color: #64748b; font-weight: 600; font-size: 14px;">Per 10g</th>
                  </tr>
                </thead>
                <tbody>
                  ${Object.entries(aedPrices)
                    .map(
                      ([karat, prices]) => `
                    <tr>
                      <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; color: #1e293b; font-weight: 600;">${karat}</td>
                      <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; text-align: right; color: #1e293b;">AED ${prices.perGram}</td>
                      <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; text-align: right; color: #1e293b;">AED ${prices.per10Grams}</td>
                    </tr>
                  `
                    )
                    .join('')}
                </tbody>
              </table>
            </td>
          </tr>

          <!-- Saudi Arabia Prices -->
          <tr>
            <td style="padding: 0 30px 30px;">
              <h3 style="margin: 0 0 15px; color: #1e293b; font-size: 20px; font-weight: 600;">
                🇸🇦 Saudi Arabia (SAR) Prices
              </h3>
              <table width="100%" cellpadding="10" cellspacing="0" style="border-collapse: collapse;">
                <thead>
                  <tr style="background-color: #f8fafc;">
                    <th style="text-align: left; padding: 12px; border-bottom: 2px solid #e2e8f0; color: #64748b; font-weight: 600; font-size: 14px;">Karat</th>
                    <th style="text-align: right; padding: 12px; border-bottom: 2px solid #e2e8f0; color: #64748b; font-weight: 600; font-size: 14px;">Per Gram</th>
                    <th style="text-align: right; padding: 12px; border-bottom: 2px solid #e2e8f0; color: #64748b; font-weight: 600; font-size: 14px;">Per 10g</th>
                  </tr>
                </thead>
                <tbody>
                  ${Object.entries(sarPrices)
                    .map(
                      ([karat, prices]) => `
                    <tr>
                      <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; color: #1e293b; font-weight: 600;">${karat}</td>
                      <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; text-align: right; color: #1e293b;">SAR ${prices.perGram}</td>
                      <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; text-align: right; color: #1e293b;">SAR ${prices.per10Grams}</td>
                    </tr>
                  `
                    )
                    .join('')}
                </tbody>
              </table>
            </td>
          </tr>

          <!-- CTA Button -->
          <tr>
            <td style="padding: 0 30px 30px; text-align: center;">
              <a href="${SITE_URL}/tracker.html?utm_source=newsletter&utm_medium=email&utm_campaign=daily_digest" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #3b82f6 0%, #1e3a8a 100%); color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
                View Live Tracker
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 30px; background-color: #f8fafc; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0 0 10px; color: #64748b; font-size: 14px;">
                You're receiving this because you subscribed to Gold Ticker Live newsletter.
              </p>
              <p style="margin: 0; font-size: 14px;">
                <a href="${SITE_URL}/api/newsletter/unsubscribe?email={{email}}" style="color: #3b82f6; text-decoration: none;">Unsubscribe</a>
                |
                <a href="${SITE_URL}/newsletter/preferences?email={{email}}" style="color: #3b82f6; text-decoration: none;">Manage Preferences</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  const text = `
Daily Gold Digest - ${formatDate(new Date())}

XAU/USD Spot Price: $${gold.price.toFixed(2)} (${gold.change24h >= 0 ? '+' : ''}${gold.change24h.toFixed(2)}%)

UAE (AED) Prices:
${Object.entries(aedPrices)
  .map(([karat, prices]) => `${karat}: AED ${prices.perGram}/g`)
  .join('\n')}

Saudi Arabia (SAR) Prices:
${Object.entries(sarPrices)
  .map(([karat, prices]) => `${karat}: SAR ${prices.perGram}/g`)
  .join('\n')}

View live tracker: ${SITE_URL}/tracker.html

---
Unsubscribe: ${SITE_URL}/api/newsletter/unsubscribe?email={{email}}
  `.trim();

  return {
    subject: `📊 Daily Gold Digest - $${gold.price.toFixed(2)} (${gold.change24h >= 0 ? '+' : ''}${gold.change24h.toFixed(2)}%)`,
    html,
    text,
  };
}

async function generateWeeklyRecap() {
  // Similar structure to daily but with weekly summary
  // TODO: Fetch 7-day historical data for weekly comparison
  const content = await generateDailyDigest();

  return {
    subject: `📈 Weekly Gold Recap - ${formatDate(new Date())}`,
    html: content.html.replace('Daily Gold Digest', 'Weekly Gold Recap'),
    text: content.text.replace('Daily Gold Digest', 'Weekly Gold Recap'),
  };
}

// CLI usage
if (require.main === module) {
  const type = process.argv[2] || 'daily';

  (async () => {
    try {
      const content = type === 'weekly' ? await generateWeeklyRecap() : await generateDailyDigest();

      console.log(JSON.stringify(content, null, 2));
    } catch (error) {
      console.error('Error generating newsletter:', error);
      process.exit(1);
    }
  })();
}

module.exports = {
  generateDailyDigest,
  generateWeeklyRecap,
};
