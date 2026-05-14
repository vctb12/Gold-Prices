# Analytics, Growth, and SEO Governance

This document defines the operational governance layer for Phase 8:

- event taxonomy + payload validation
- funnel instrumentation coverage
- SEO inventory/risk reporting
- AdSense slot safety guardrails

---

## 1) Event governance

Canonical source of truth:

- `src/lib/analytics.js`
  - `EVENTS`
  - `EVENT_SCHEMA`
  - `validateEvent()`
  - `track()`

Design rules:

1. Use constants (`EVENTS.X`) instead of string literals.
2. Every tracked event must satisfy `EVENT_SCHEMA` required payload fields.
3. Invalid events are skipped safely (never break UX).
4. PII stays blocked (`email`, `phone`, raw `query` text are sanitized).

### Key Phase 8 funnel events

- `price_view`
- `tracker_mode_change`
- `alert_create_start`
- `alert_create_success`
- `calculator_submit`
- `calculator_share`
- `shop_filter_apply`
- `shop_card_open`
- `shop_whatsapp_click`
- `shop_call_click`
- `shop_claim_start`
- `newsletter_subscribe`
- `pricing_plan_click`
- `checkout_start`
- `checkout_success`
- `api_key_create`
- `language_switch`
- `country_page_view`

---

## 2) Analytics debug mode

Debug mode logs validated events in local/dev without impacting production users.

Enable debug:

- `?analytics_debug=1` in URL, or
- `localStorage.setItem('gp_analytics_debug', '1')`, or
- run on `localhost` / `127.0.0.1`.

Disable debug:

- remove query flag and set `localStorage.removeItem('gp_analytics_debug')`.

---

## 3) Local event inventory export

Generate event inventory JSON (for dashboards and QA):

```bash
npm run analytics:inventory
```

Check if inventory is stale:

```bash
npm run analytics:inventory:check
```

Output:

- `reports/analytics/event-inventory.json`

---

## 4) GA4 custom report setup (recommended)

Build funnel explorations using:

1. **Pricing funnel**  
   `pricing_plan_click` → `checkout_start` → `checkout_success`
2. **Alert funnel**  
   `alert_create_start` → `alert_create_success`
3. **Shops lead funnel**  
   `shop_card_open` → (`shop_call_click` or `shop_whatsapp_click` or `shop_claim_start`)
4. **Calculator engagement funnel**  
   `calculator_submit` → `calculator_share`

Suggested dimensions:

- `tier`, `interval`
- `tool`
- `surface`
- `country_slug`, `currency`, `locale`
- `delivery`, `direction`

---

## 5) SEO governance report

Generate governance report:

```bash
npm run seo:governance
```

Check staleness (CI-friendly, non-blocking):

```bash
npm run seo:governance:check
```

Output:

- `reports/seo/governance.json`

The report includes:

- grouped inventory:
  - `core`
  - `countries`
  - `cities`
  - `markets`
  - `content`
- thin-content risk candidates
- duplicate title/description clusters
- missing canonical/hreflang/schema lists

---

## 6) AdSense slot governance

Config source:

- `src/config/constants.js` → `AD_CONFIG.SLOT_GOVERNANCE`

Current rules:

1. max slots per page (`maxSlotsPerPage`)
2. optional mobile leaderboard restriction
3. required slot IDs before render
4. avoid ad-stacking without content between slots

Runtime enforcement:

- `src/components/adSlot.js`

---

## 7) Validation commands

Run before merge:

```bash
npm test
npm run lint
npm run validate
npm run build
```
