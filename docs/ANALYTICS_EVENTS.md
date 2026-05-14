# Analytics Event Catalog

**Canonical source:** `src/lib/analytics.js`  
**Constants object:** `EVENTS` (exported)  
**Event schema:** `EVENT_SCHEMA` (required payload fields)  
**Non-module mirror:** `window.GP_EVENTS` (set by `assets/analytics.js`)

> Phase 8 governance and funnels are documented in `docs/ANALYTICS_GROWTH_AND_SEO.md`.

---

## How to fire an event

```js
import { track, EVENTS } from '../lib/analytics.js';

track(EVENTS.KARAT_CHANGE, { from: '22', to: '24' });
```

`track()` respects:

- `navigator.doNotTrack === '1'` — skips completely
- `localStorage.gp_no_analytics === '1'` — skips completely
- Per-event sample rate (see table below) — skips Supabase persistence only; GA4 still receives all
  allowed calls

---

## Event catalog

All event names are **snake_case**. Required parameters are listed; all others are optional.

| Constant                      | Event name             | Parameters                                         | Emitted by                            | Notes                                                                                                                      |
| ----------------------------- | ---------------------- | -------------------------------------------------- | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `EVENTS.PAGE_VIEW`            | `page_view`            | `{ path, locale }`                                 | Every page `init()`                   | **50 % sample rate** for Supabase; GA4 receives 100 %                                                                      |
| `EVENTS.TRACKER_VIEW`         | `tracker_view`         | `{ karat, country, currency }`                     | `tracker-pro.js init()`               | Fires once per page load after data is ready                                                                               |
| `EVENTS.KARAT_CHANGE`         | `karat_change`         | `{ from, to }`                                     | `tracker/events.js` karat select      |                                                                                                                            |
| `EVENTS.COUNTRY_CHANGE`       | `country_change`       | `{ from, to }`                                     | tracker                               | Not yet wired — see Backlog                                                                                                |
| `EVENTS.UNIT_CHANGE`          | `unit_change`          | `{ from, to }`                                     | `tracker/events.js` unit select       |                                                                                                                            |
| `EVENTS.CURRENCY_CHANGE`      | `currency_change`      | `{ from, to }`                                     | `tracker/events.js` currency select   |                                                                                                                            |
| `EVENTS.CALCULATOR_USE`       | `calculator_use`       | `{ weight, unit, karat, currency }`                | `calculator.js calcValue()`           | Debounced 1 s to avoid per-keystroke spam                                                                                  |
| `EVENTS.TOOL_USE`             | `tool_use`             | `{ tool: 'weight'\|'zakat'\|'investment-return' }` | `calculator.js setupTabs()`           | `tool` is the calc-tab logical name                                                                                        |
| `EVENTS.SHARE_CLICK`          | `share_click`          | `{ surface, channel }`                             | `tracker/events.js` share button      | `channel`: `'clipboard'`                                                                                                   |
| `EVENTS.COPY_CLICK`           | `copy_click`           | `{ surface, value_type }`                          | home, tracker, calculator             | `surface`: `'gcc_grid'`, `'karat_strip'`, `'tracker'`, `'calculator'`; `value_type`: `'price'`, `'preset_url'`, `'result'` |
| `EVENTS.ALERT_SET`            | `alert_set`            | `{ karat, threshold, direction, currency }`        | `tracker/events.js` save-alert button |                                                                                                                            |
| `EVENTS.ALERT_CLEAR`          | `alert_clear`          | `{ karat }`                                        | `tracker/events.js` alert-list delete |                                                                                                                            |
| `EVENTS.NEWSLETTER_SUBSCRIBE` | `newsletter_subscribe` | `{ source, cadence }`                              | `footer.js` form submit               | `source`: `'footer'`; `cadence`: `'weekly'`                                                                                |
| `EVENTS.SEARCH_QUERY`         | `search_query`         | `{ length, result_count, locale }`                 | `home.js initCountrySearch()`         | `length` is query char count — **no raw text stored** (PII safety)                                                         |
| `EVENTS.SEARCH_OPEN`          | `search_open`          | `{ ... }`                                          | —                                     | Reserved; not yet emitted                                                                                                  |
| `EVENTS.THEME_CHANGE`         | `theme_change`         | `{ to }`                                           | `nav.js _cycleTheme()`                | `to`: `'light'`, `'dark'`, `'auto'`                                                                                        |
| `EVENTS.LANG_CHANGE`          | `lang_change`          | `{ to }`                                           | `nav.js updateNavLang()`              | `to`: `'en'`, `'ar'`                                                                                                       |
| `EVENTS.OUTBOUND_CLICK`       | `outbound_click`       | `{ url_host }`                                     | —                                     | Reserved; not yet emitted                                                                                                  |
| `EVENTS.ERROR`                | `error`                | `{ type, where }`                                  | —                                     | Reserved; use for caught API/render errors                                                                                 |

---

## PII policy

The `sanitize()` helper (exported from `src/lib/analytics.js`) enforces:

1. **`email`** — deleted from params before any transmission.
2. **`phone`** — deleted from params before any transmission.
3. **`query`** string — replaced by its character `length` only. Raw search text is **never** sent
   to GA4 or Supabase.

---

## Sample rates

| Event       | GA4   | Supabase                       |
| ----------- | ----- | ------------------------------ |
| `page_view` | 100 % | 50 % (`PAGE_VIEW_SAMPLE_RATE`) |
| All others  | 100 % | 100 %                          |

To change the `page_view` sample rate, edit the `PAGE_VIEW_SAMPLE_RATE` constant in
`src/lib/analytics.js`.

---

## Supabase table schema

Events are written to the `analytics_events` table using the public anon key (Row Level Security
must permit anonymous inserts).

| Column       | Type          | Notes                                                       |
| ------------ | ------------- | ----------------------------------------------------------- |
| `event`      | `text`        | Event name constant                                         |
| `page`       | `text`        | `location.pathname`                                         |
| `session_id` | `text`        | Random ID, persisted in `sessionStorage` as `gp_session_id` |
| `ts`         | `bigint`      | `Date.now()` epoch ms                                       |
| `properties` | `jsonb`       | Sanitized event parameters                                  |
| `created_at` | `timestamptz` | Set by Supabase automatically                               |

The admin dashboard at `/admin/analytics/` reads this table and falls back to `localStorage`
(`gp_analytics_events`) when Supabase is unreachable.

---

## Opt-out

Users can opt out of all analytics by:

- Setting `navigator.doNotTrack = '1'` in browser settings.
- Setting `localStorage.setItem('gp_no_analytics', '1')`.

When opted out, `track()` returns immediately without calling GA4 or Supabase.

---

## Backlog

- `EVENTS.COUNTRY_CHANGE` — wire into the tracker country dropdown when it is added.
- `EVENTS.OUTBOUND_CLICK` — add delegation listener on `<a target="_blank">` in footer/shops.
- `EVENTS.SEARCH_OPEN` — fire when the nav search overlay opens.
- `EVENTS.ERROR` — wire into `api.js` fetch failures and render errors.
