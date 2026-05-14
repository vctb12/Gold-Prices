# AI Content Automation — Phase 11

Gold Ticker Live uses **template-based, human-reviewed content drafts** to assist editorial
workflows. This document describes the architecture, safety rules, and operational guide.

## Overview

Phase 11 adds an AI-assisted content draft system with mandatory editorial review. The key design
principle is:

> **No content is ever auto-published or auto-posted.** Every draft requires explicit human approval
> and a separate publish action by an admin.

## Architecture

```
data/gold_price.json
       │
       ▼
server/lib/anomaly-detector.js   ← checks for price anomalies
       │
       ▼
server/services/ai-drafts.js     ← builds bilingual templates
       │
       ▼
server/repositories/ai-drafts.repository.js   ← stores drafts
       │
       ▼
data/ai-drafts.json              ← persistent file store
       │
       ▼
Admin API  (server/routes/admin/index.js)
       │
       ▼
Human review → approve → publish
```

## Draft Types

| Type               | Purpose                                              |
| ------------------ | ---------------------------------------------------- |
| `daily_summary`    | Daily gold market reference summary                  |
| `weekly_summary`   | Weekly gold market reference summary                 |
| `uae_gcc_summary`  | UAE/GCC karat price summary                          |
| `provider_report`  | Internal data provider / freshness report            |
| `seo_brief`        | SEO content brief (editor writes the full article)   |
| `x_post`           | X/Twitter post options (editor picks one and edits)  |
| `newsletter_block` | Newsletter price block (editor includes in campaign) |

## Draft Lifecycle

```
[generate] → status: draft
                │
          ┌─────┴─────┐
          ▼           ▼
       [approve]   [reject]
       status:     status:
       approved    rejected
          │
          ▼
       [publish]
       status:
       published
```

- Only `draft` → `approved` transition is allowed via the approve endpoint.
- Only `approved` → `published` transition is allowed via the publish endpoint.
- `draft` or `approved` → `rejected` is allowed at any time (except already published).
- **Editing** (title, body) is allowed while status is `draft` or `approved`.
- Status can **never** be changed via PATCH — only via the dedicated action endpoints.

## Safety Rules

All rules are enforced in code, not just documented:

1. **No auto-publish.** `insertDraft()` always sets `status: "draft"`. There is no code path that
   publishes without explicit admin action.
2. **Spot estimate only.** Every draft sets `is_spot_estimate: true` and includes the standard
   disclaimer in both EN and AR.
3. **Timestamp required.** `data_timestamp_utc` is set from the source price record on every draft.
4. **Bilingual always.** Both `body_en` and `body_ar` are required fields. The service always
   generates both.
5. **No invented causes.** Templates never state a cause for price moves. Factual data only.
6. **Speculation labelled.** If an anomaly is detected, the draft body includes an explicit
   speculation disclaimer.
7. **Anomaly flag.** Before generating content, the anomaly detector checks the current price vs the
   previous snapshot and flags potential data quality issues.
8. **Anomaly review.** Anomaly-flagged drafts can only be published after the operator explicitly
   approves them (not blocked, but logged with a strong warning).
9. **No X/social auto-post.** The `x_post` draft type produces text for human review. It does not
   call the Twitter API.

## Standard Disclaimers

Every draft body (EN and AR) includes these fixed strings:

**English:**

> ⚠ Spot-based reference estimate only. Retail and jewellery prices may differ significantly. Not
> financial advice. Data sourced from global XAU/USD markets, converted at the AED fixed peg.

**Arabic:**

> ⚠ سعر تقديري مبني على سعر الذهب العالمي (XAU/USD). قد يختلف سعر المحلات بسبب المصنعية والضريبة
> والهامش. ليس نصيحة مالية. يُستخدم سعر الدرهم الثابت مقابل الدولار.

## Anomaly Detection

`server/lib/anomaly-detector.js` compares `data/gold_price.json` vs `data/last_gold_price.json`:

| Rule                 | Default threshold   | Environment variable            |
| -------------------- | ------------------- | ------------------------------- |
| Single-step spike    | ±3%                 | `ANOMALY_SPIKE_THRESHOLD_PCT`   |
| Extreme move         | ±15%                | `ANOMALY_EXTREME_THRESHOLD_PCT` |
| Stale data           | `is_fresh: false`   | —                               |
| Provider fallback    | `is_fallback: true` | —                               |
| Circuit-breaker open | Any provider open   | —                               |

When any rule fires, `anomaly_flag: true` is embedded in the draft and the body includes a
speculation disclaimer.

## Admin API Endpoints

All endpoints require `Authorization: Bearer <admin_token>`.

| Method  | Path                                 | Description                                              |
| ------- | ------------------------------------ | -------------------------------------------------------- |
| `POST`  | `/api/admin/ai-drafts/generate`      | Generate drafts (body: `{ types: [] }`)                  |
| `GET`   | `/api/admin/ai-drafts`               | List drafts (query: `status`, `type`, `limit`, `offset`) |
| `GET`   | `/api/admin/ai-drafts/:id`           | Get single draft                                         |
| `PATCH` | `/api/admin/ai-drafts/:id`           | Edit title/body/review_note/export_channel               |
| `POST`  | `/api/admin/ai-drafts/:id/approve`   | Approve a draft (body: `{ note }`)                       |
| `POST`  | `/api/admin/ai-drafts/:id/reject`    | Reject a draft (body: `{ reason }`)                      |
| `POST`  | `/api/admin/ai-drafts/:id/publish`   | Mark as published (body: `{ export_channel, note }`)     |
| `GET`   | `/api/admin/ai-drafts/:id/audit-log` | Per-draft audit trail                                    |

### Generate Example

```bash
curl -X POST /api/admin/ai-drafts/generate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"types": ["daily_summary", "x_post"]}'
```

### List Pending Drafts

```bash
curl /api/admin/ai-drafts?status=draft \
  -H "Authorization: Bearer $TOKEN"
```

### Approve + Publish

```bash
# Approve
curl -X POST /api/admin/ai-drafts/<id>/approve \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"note": "Verified prices, ready to use"}'

# Publish (marks as published — does NOT auto-post anywhere)
curl -X POST /api/admin/ai-drafts/<id>/publish \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"export_channel": "newsletter"}'
```

## Persistence

Drafts are stored in `data/ai-drafts.json` using atomic write (`fs-atomic.js`). The schema is also
defined in `supabase/schema.sql` (`public.ai_drafts`) for future Supabase sync.

Override the file path in tests: `AI_DRAFTS_DATA_FILE=/tmp/test-drafts.json`.

## Supabase Schema

The `public.ai_drafts` table mirrors the local JSON schema. Row-level security is enabled with
`service_role`-only access. See `supabase/schema.sql` for the full DDL.

## Testing

```bash
npm test -- --test-name-pattern "ai-drafts"
```

Key test coverage:

- Repository: insert always starts as `draft`, status transitions, edit guards
- Anomaly detector: stale/fallback detection, threshold calculations
- Service: all 7 types produce bilingual drafts, spot disclaimer present, anomaly flag set for bad
  data
- API: auth protection, generate, list, get, edit, approve, reject, publish lifecycle, audit log

## What This Is NOT

- **Not an LLM integration.** Drafts are generated from data templates. No external AI API is
  called.
- **Not an auto-posting system.** The `x_post` type produces text; it does not call the Twitter/X
  API.
- **Not a publishing system.** "Published" status is an editorial marker only. The operator is
  responsible for copying and using the content.
- **Not a news scraper.** Templates contain only factual price data from the existing gold price
  pipeline.

## Related Files

| File                                          | Purpose                                 |
| --------------------------------------------- | --------------------------------------- |
| `server/services/ai-drafts.js`                | Template builders for all 7 draft types |
| `server/repositories/ai-drafts.repository.js` | CRUD storage for drafts                 |
| `server/lib/anomaly-detector.js`              | Price anomaly detection                 |
| `server/routes/admin/index.js`                | Admin API endpoints                     |
| `data/ai-drafts.json`                         | Persistent draft store                  |
| `supabase/schema.sql`                         | `public.ai_drafts` table DDL            |
| `tests/ai-drafts.test.js`                     | Full test suite                         |
