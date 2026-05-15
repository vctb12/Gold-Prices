# Gold Ticker Live — Public API

> **Base URL:** `https://goldtickerlive.com/api/v1` **Version:** v1 **Format:** All responses are
> JSON with a standard envelope: `{ ok, data, meta }`.

Gold Ticker Live provides a lightweight, developer-friendly REST API for gold price data. Prices are
derived from XAU/USD spot rates and are **reference estimates only** — they do not include retail
premiums, making charges, or VAT.

---

## Table of Contents

1. [Authentication](#authentication)
2. [Rate Limits & Quotas](#rate-limits--quotas)
3. [Standard Response Envelope](#standard-response-envelope)
4. [Endpoints](#endpoints)
   - [GET /public/latest](#get-publiclatest)
   - [GET /public/history](#get-publichistory)
   - [GET /public/karats](#get-publickarats)
   - [GET /public/countries](#get-publiccountries)
5. [Key Management](#key-management)
   - [POST /me/api-keys](#post-meapi-keys)
   - [GET /me/api-keys](#get-meapi-keys)
   - [DELETE /me/api-keys/:id](#delete-meapi-keysid)
   - [POST /me/api-keys/:id/regenerate](#post-meapi-keysidregenerate)
   - [GET /me/api-usage](#get-meapi-usage)
6. [Error Codes](#error-codes)
7. [Trust & Freshness Fields](#trust--freshness-fields)
8. [Code Examples](#code-examples)
9. [Pricing Tiers](#pricing-tiers)

---

## Authentication

API keys are issued per user account. They are prefixed with `gtl_`.

Pass the key in **one** of two ways (header preferred):

```
X-API-Key: gtl_<your-key>
Authorization: Bearer gtl_<your-key>
```

> **Security note:** Query parameter (`?api_key=…`) is not supported. Query parameters appear in
> server access logs and browser history — headers are always safer for API keys.

`/public/karats` and `/public/countries` are always open (no key needed).

`/public/latest` allows **10 anonymous requests per day** (per IP) before requiring a key.

`/public/history` always requires a valid API key.

---

## Rate Limits & Quotas

| Tier            | Daily calls | History access |
| --------------- | ----------- | -------------- |
| Free (no key)   | 10 / IP     | Not available  |
| Free (with key) | 100 / day   | 30 days        |
| Pro             | 250 / day   | 365 days       |
| API             | 500 / day   | Unlimited      |

Quota counters reset at **midnight UTC** each day.

When a key's quota is exceeded the API returns HTTP **429** with:

```json
{
  "ok": false,
  "error": {
    "code": "QUOTA_EXCEEDED",
    "message": "Daily quota of 100 calls exceeded. Resets at midnight UTC.",
    "details": { "quota": 100, "used": 101, "resetAt": "2026-05-15T23:59:59Z" }
  }
}
```

Response headers (when authenticated):

```
X-RateLimit-Limit:     500
X-RateLimit-Remaining: 492
X-RateLimit-Reset:     2026-05-15T23:59:59Z
```

Need higher limits? [Contact us](mailto:hello@goldtickerlive.com) for an enterprise plan.

---

## Standard Response Envelope

Every **successful** response uses this structure:

```json
{
  "ok": true,
  "data": { ... },
  "meta": {
    "timestamp": "2026-05-15T10:30:00.000Z",
    "source": "price_snapshots",
    "freshness": "fresh"
  }
}
```

| Field            | Description                                                           |
| ---------------- | --------------------------------------------------------------------- |
| `ok`             | `true` on success, `false` on error                                   |
| `data`           | Endpoint-specific payload                                             |
| `meta.timestamp` | Server-side response time (ISO 8601)                                  |
| `meta.source`    | Where data came from (`price_snapshots`, `historical-baseline`, etc.) |
| `meta.freshness` | `fresh` / `stale` / `historical` / `reference` / `static`             |

**Error responses** do not include `data` or `meta`. They use this shape:

```json
{
  "ok": false,
  "error": {
    "code": "QUOTA_EXCEEDED",
    "message": "Human-readable description.",
    "details": { "quota": 100, "used": 101, "resetAt": "2026-05-15T23:59:59Z" }
  }
}
```

`details` is only present on errors that carry additional context (quota/rate-limit errors).

---

## Endpoints

### GET /public/latest

Returns the most recent gold spot-price reference.

**Authentication:** Optional (10 anonymous req/day without key)

**Response fields:**

| Field              | Type          | Description                                         |
| ------------------ | ------------- | --------------------------------------------------- |
| `timestampUtc`     | string        | Timestamp of the price snapshot                     |
| `fetchedAtUtc`     | string        | When the price was fetched from the provider        |
| `xauUsdPerOz`      | number        | XAU/USD — troy ounces in US dollars                 |
| `xauAedPerGram`    | number        | Gold price per gram in UAE dirhams (AED peg 3.6725) |
| `provider`         | string        | Which data provider supplied this snapshot          |
| `isFresh`          | boolean\|null | `true` if within the freshness threshold            |
| `isFallback`       | boolean\|null | `true` if from a fallback/cached source             |
| `freshnessSeconds` | number\|null  | Age of the data in seconds at fetch time            |
| `disclaimer`       | string        | Required legal notice                               |

**curl:**

```bash
curl -H "X-API-Key: gtl_your_key_here" \
  "https://goldtickerlive.com/api/v1/public/latest"
```

**JavaScript (fetch):**

```js
const res = await fetch('https://goldtickerlive.com/api/v1/public/latest', {
  headers: { 'X-API-Key': 'gtl_your_key_here' },
});
const { ok, data } = await res.json();
if (ok) {
  console.log(`XAU/USD: $${data.xauUsdPerOz.toFixed(2)}/oz`);
  console.log(`AED/g:   ${data.xauAedPerGram.toFixed(2)} AED`);
  console.log(`Fresh:   ${data.isFresh}`);
}
```

**Python (requests):**

```python
import requests

resp = requests.get(
    "https://goldtickerlive.com/api/v1/public/latest",
    headers={"X-API-Key": "gtl_your_key_here"},
    timeout=10,
)
resp.raise_for_status()
payload = resp.json()
if payload["ok"]:
    d = payload["data"]
    print(f"XAU/USD: ${d['xauUsdPerOz']:.2f}/oz")
    print(f"AED/g:   {d['xauAedPerGram']:.2f} AED")
    print(f"Source:  {d['provider']}")
```

**Example response:**

```json
{
  "ok": true,
  "data": {
    "timestampUtc": "2026-05-15T10:00:00Z",
    "fetchedAtUtc": "2026-05-15T10:00:15Z",
    "xauUsdPerOz": 3245.8,
    "xauAedPerGram": 385.42,
    "provider": "metals_api",
    "isFresh": true,
    "isFallback": false,
    "freshnessSeconds": 15,
    "disclaimer": "Spot-based reference price only. Does not include retail premiums, making charges, or VAT."
  },
  "meta": {
    "timestamp": "2026-05-15T10:30:00.000Z",
    "source": "price_snapshots",
    "freshness": "fresh"
  }
}
```

---

### GET /public/history

Returns a time series of historical gold spot prices.

**Authentication:** Required (API key mandatory)

**Query parameters:**

| Parameter | Default | Description                                 |
| --------- | ------- | ------------------------------------------- |
| `range`   | `30d`   | `7d`, `30d`, `90d`, `1y`, `2y`, `5y`, `all` |

**History window by tier:**

| Tier       | Max range |
| ---------- | --------- |
| Free (key) | 30 days   |
| Pro        | 365 days  |
| API        | Unlimited |

**curl:**

```bash
curl -H "X-API-Key: gtl_your_key_here" \
  "https://goldtickerlive.com/api/v1/public/history?range=30d"
```

**JavaScript:**

```js
const res = await fetch('https://goldtickerlive.com/api/v1/public/history?range=30d', {
  headers: { 'X-API-Key': 'gtl_your_key_here' },
});
const { ok, data } = await res.json();
if (ok) {
  for (const point of data.points) {
    console.log(`${point.timestampUtc}: $${point.xauUsdPerOz}/oz`);
  }
}
```

**Python:**

```python
import requests

resp = requests.get(
    "https://goldtickerlive.com/api/v1/public/history",
    headers={"X-API-Key": "gtl_your_key_here"},
    params={"range": "30d"},
    timeout=30,
)
resp.raise_for_status()
data = resp.json()["data"]
print(f"Returned {data['total']} data points")
for point in data["points"][:5]:
    print(f"{point['timestampUtc']}: ${point['xauUsdPerOz']:.2f}")
```

**Example response:**

```json
{
  "ok": true,
  "data": {
    "range": "30d",
    "historyDaysAllowed": 30,
    "total": 720,
    "points": [
      {
        "timestampUtc": "2026-04-15T08:00:00Z",
        "xauUsdPerOz": 3180.0,
        "xauAedPerGram": 377.75,
        "provider": "metals_api",
        "isFresh": true,
        "isFallback": false
      }
    ],
    "disclaimer": "Historical spot prices only. Not suitable for transaction pricing."
  },
  "meta": {
    "timestamp": "2026-05-15T10:30:00.000Z",
    "source": "price_snapshots",
    "freshness": "historical"
  }
}
```

---

### GET /public/karats

Returns the karat purity reference table used for price calculations.

**Authentication:** None required

**curl:**

```bash
curl "https://goldtickerlive.com/api/v1/public/karats"
```

**Example response:**

```json
{
  "ok": true,
  "data": {
    "troyOzGrams": 31.1035,
    "karats": [
      {
        "code": "24",
        "purity": 1.0,
        "labelEn": "24 Karat (Pure Gold)",
        "labelAr": "عيار 24 (ذهب خالص)"
      },
      { "code": "22", "purity": 0.916667, "labelEn": "22 Karat", "labelAr": "عيار 22" },
      { "code": "21", "purity": 0.875, "labelEn": "21 Karat", "labelAr": "عيار 21" },
      { "code": "18", "purity": 0.75, "labelEn": "18 Karat", "labelAr": "عيار 18" }
    ],
    "note": "Purity is the fraction of pure gold. Price per gram = (xauUsdPerOz / troyOzGrams) × purity."
  },
  "meta": { "timestamp": "...", "source": "reference", "freshness": "static" }
}
```

**Karat price calculation example (JavaScript):**

```js
const { data } = await (await fetch('/api/v1/public/karats')).json();
const latestRes = await (
  await fetch('/api/v1/public/latest', {
    headers: { 'X-API-Key': 'gtl_your_key_here' },
  })
).json();

const xauUsdPerOz = latestRes.data.xauUsdPerOz;
for (const karat of data.karats) {
  const pricePerGramUsd = (xauUsdPerOz / data.troyOzGrams) * karat.purity;
  console.log(`${karat.labelEn}: $${pricePerGramUsd.toFixed(2)}/g`);
}
```

---

### GET /public/countries

Returns the list of supported countries and currencies.

**Authentication:** None required

**curl:**

```bash
curl "https://goldtickerlive.com/api/v1/public/countries"
```

**Example response:**

```json
{
  "ok": true,
  "data": {
    "countries": [
      {
        "code": "AE",
        "slug": "uae",
        "nameEn": "United Arab Emirates",
        "currency": "AED",
        "group": "gcc",
        "fixedPeg": true
      },
      {
        "code": "SA",
        "slug": "saudi-arabia",
        "nameEn": "Saudi Arabia",
        "currency": "SAR",
        "group": "gcc",
        "fixedPeg": false
      }
    ],
    "note": "AED, QAR, BHD, OMR are pegged to USD; others float. Currency conversion rates are not provided by this endpoint."
  },
  "meta": { "timestamp": "...", "source": "reference", "freshness": "static" }
}
```

---

## Key Management

All key management routes require a **Supabase user session token** (the user's own auth JWT, not an
API key).

Pass it as: `Authorization: Bearer <supabase-jwt>`

---

### POST /me/api-keys

Create a new API key. The raw key is returned **once only** — store it immediately.

**Request body (JSON):**

```json
{ "label": "my-production-app" }
```

`label` is optional (defaults to `"default"`). Max 60 characters.

**curl:**

```bash
curl -X POST \
  -H "Authorization: Bearer <supabase-jwt>" \
  -H "Content-Type: application/json" \
  -d '{"label":"my-app"}' \
  "https://goldtickerlive.com/api/v1/me/api-keys"
```

**Example response (201):**

```json
{
  "ok": true,
  "data": {
    "id": "uuid-here",
    "key": "gtl_a1b2c3d4e5f6...",
    "keyPrefix": "gtl_a1b2c3d4",
    "label": "my-app",
    "createdAt": "2026-05-15T10:30:00Z",
    "warning": "Store this key securely. It will not be shown again."
  }
}
```

---

### GET /me/api-keys

List the authenticated user's API keys (no raw keys, no hashes).

**curl:**

```bash
curl -H "Authorization: Bearer <supabase-jwt>" \
  "https://goldtickerlive.com/api/v1/me/api-keys"
```

**Example response:**

```json
{
  "ok": true,
  "data": {
    "keys": [
      {
        "id": "uuid-here",
        "keyPrefix": "gtl_a1b2c3d4",
        "label": "my-app",
        "revoked": false,
        "createdAt": "2026-05-15T10:30:00Z"
      }
    ]
  }
}
```

---

### DELETE /me/api-keys/:id

Revoke an API key by its ID. Revoked keys are immediately rejected.

**curl:**

```bash
curl -X DELETE \
  -H "Authorization: Bearer <supabase-jwt>" \
  "https://goldtickerlive.com/api/v1/me/api-keys/uuid-here"
```

**Example response:**

```json
{ "ok": true, "data": { "id": "uuid-here", "revoked": true } }
```

---

### POST /me/api-keys/:id/regenerate

Revoke an existing key and create a replacement (inherits the label). Useful for key rotation.

**curl:**

```bash
curl -X POST \
  -H "Authorization: Bearer <supabase-jwt>" \
  "https://goldtickerlive.com/api/v1/me/api-keys/uuid-here/regenerate"
```

**Example response (201):**

```json
{
  "ok": true,
  "data": {
    "id": "new-uuid",
    "key": "gtl_new_key_shown_once...",
    "keyPrefix": "gtl_new_pref",
    "label": "my-app",
    "createdAt": "2026-05-15T12:00:00Z",
    "revokedId": "old-uuid",
    "warning": "Store this key securely. It will not be shown again."
  }
}
```

---

### GET /me/api-usage

Returns a usage summary for the authenticated user's keys over a rolling window.

**Query parameters:**

| Parameter | Default | Max | Description            |
| --------- | ------- | --- | ---------------------- |
| `days`    | 30      | 90  | Rolling window in days |

**curl:**

```bash
curl -H "Authorization: Bearer <supabase-jwt>" \
  "https://goldtickerlive.com/api/v1/me/api-usage?days=7"
```

**Example response:**

```json
{
  "ok": true,
  "data": {
    "windowDays": 7,
    "totalCalls": 312,
    "todayCalls": 48,
    "quota": { "daily": 500, "tier": "api" },
    "byKey": [{ "keyId": "uuid-here", "keyPrefix": "gtl_a1b2c3d4", "total": 312 }],
    "byDate": [
      { "date": "2026-05-15", "count": 48 },
      { "date": "2026-05-14", "count": 65 }
    ]
  }
}
```

---

## Error Codes

| Code                        | HTTP | Description                                          |
| --------------------------- | ---- | ---------------------------------------------------- |
| `API_KEY_REQUIRED`          | 401  | No API key provided on an endpoint that requires one |
| `INVALID_API_KEY`           | 401  | Key not found or revoked                             |
| `QUOTA_EXCEEDED`            | 429  | Daily call quota exhausted                           |
| `ANON_QUOTA_EXCEEDED`       | 429  | Anonymous IP daily limit reached                     |
| `UNAUTHORIZED`              | 401  | Missing or invalid user session token                |
| `KEY_LIMIT_REACHED`         | 422  | User already has 10 active keys                      |
| `KEY_NOT_FOUND`             | 404  | Key ID not found or belongs to another user          |
| `KEY_CREATE_FAILED`         | 500  | Server-side key generation failure                   |
| `PRICE_DATA_UNAVAILABLE`    | 503  | Price data temporarily unavailable                   |
| `PRICE_HISTORY_UNAVAILABLE` | 503  | Historical data temporarily unavailable              |

---

## Trust & Freshness Fields

Gold Ticker Live prices are **reference estimates** computed from international spot markets
(XAU/USD). They are not retail prices, official prices, or investment advice.

| Field                     | Meaning                                                                |
| ------------------------- | ---------------------------------------------------------------------- |
| `isFresh: true`           | Data was fetched within the freshness threshold (typically <5 min)     |
| `isFresh: false`          | Data may be stale — treat with caution                                 |
| `isFallback: true`        | Price was not obtained from the primary provider — a fallback was used |
| `freshness: "fresh"`      | Meta confirmation of live data                                         |
| `freshness: "stale"`      | Cached or delayed data                                                 |
| `freshness: "historical"` | Aggregated historical series (not live)                                |
| `freshness: "reference"`  | Static reference data (karats, countries)                              |

Always surface the `disclaimer` field to end users.

---

## Code Examples

### Build a karat price table in Python

```python
import requests

API_KEY = "gtl_your_key_here"
BASE = "https://goldtickerlive.com/api/v1"

latest = requests.get(f"{BASE}/public/latest", headers={"X-API-Key": API_KEY}).json()
karats = requests.get(f"{BASE}/public/karats").json()

xau_usd = latest["data"]["xauUsdPerOz"]
troy_grams = karats["data"]["troyOzGrams"]

print(f"Spot: ${xau_usd:.2f}/oz\n")
for k in karats["data"]["karats"]:
    price = (xau_usd / troy_grams) * k["purity"]
    print(f"  {k['labelEn']:25s}: ${price:.2f}/g")
```

### Fetch 30-day history and compute simple moving average (JavaScript)

```js
const API_KEY = 'gtl_your_key_here';

async function getHistory(range = '30d') {
  const res = await fetch(`https://goldtickerlive.com/api/v1/public/history?range=${range}`, {
    headers: { 'X-API-Key': API_KEY },
  });
  const { ok, data } = await res.json();
  if (!ok) throw new Error('API error');
  return data.points;
}

function sma(points, window = 7) {
  return points
    .map((p, i) => {
      if (i < window - 1) return null;
      const slice = points.slice(i - window + 1, i + 1);
      const avg = slice.reduce((s, x) => s + (x.xauUsdPerOz || 0), 0) / window;
      return { date: p.timestampUtc, sma: avg.toFixed(2) };
    })
    .filter(Boolean);
}

const history = await getHistory('30d');
const moving = sma(history, 7);
console.log(`7-day SMA (latest): $${moving.at(-1)?.sma}/oz`);
```

### Rotate an API key (Python)

```python
import requests

SUPABASE_JWT = "your-session-token"
BASE = "https://goldtickerlive.com/api/v1"
headers = {"Authorization": f"Bearer {SUPABASE_JWT}"}

# List keys
keys = requests.get(f"{BASE}/me/api-keys", headers=headers).json()["data"]["keys"]
old_id = keys[0]["id"]

# Regenerate
new_key_resp = requests.post(f"{BASE}/me/api-keys/{old_id}/regenerate", headers=headers).json()
print("New key (save this):", new_key_resp["data"]["key"])
```

---

## Pricing Tiers

| Feature             | Free              | Pro         | API         |
| ------------------- | ----------------- | ----------- | ----------- |
| `/public/latest`    | 100/day (10 anon) | 250/day     | 500/day     |
| `/public/history`   | 30 days           | 365 days    | Unlimited   |
| `/public/karats`    | ✓ unlimited       | ✓ unlimited | ✓ unlimited |
| `/public/countries` | ✓ unlimited       | ✓ unlimited | ✓ unlimited |
| API key management  | ✓                 | ✓           | ✓           |
| Usage dashboard     | ✓                 | ✓           | ✓           |
| Rate-limit headers  | ✓                 | ✓           | ✓           |
| Priority support    | —                 | ✓           | ✓           |

See [pricing.html](https://goldtickerlive.com/pricing.html) to subscribe or upgrade.

For enterprise/custom quotas email [hello@goldtickerlive.com](mailto:hello@goldtickerlive.com).

---

_This API is provided as a reference tool. All prices are spot-derived estimates. Never use them as
the sole basis for financial transactions._
