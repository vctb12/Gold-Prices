# Realtime Architecture (Phase 1, design)

> Purpose: describe the **target** realtime architecture, the **path** from today's hourly-cron
> pipeline to it, and — crucially — the reasons each piece is staged carefully on a
> public-production site rather than landed in one giant PR. This document is normative for future
> PRs.

Status: **design**. Phase 2 (freshness truth engine) ships in the PR that introduces this doc;
Phases 1, 3, and 6 are queued but not implemented.

---

## 1. Today (after this PR)

```
┌────────────────────────┐
│ gold-api.com           │  hourly call via GitHub Actions cron
└──────────┬─────────────┘
           ▼
┌────────────────────────┐
│ data/gold_price.json   │  static JSON committed to main with rich
│  + is_fresh            │  truth metadata
│  + is_fallback         │
└──────────┬─────────────┘
           ▼
┌────────────────────────┐
│ /api/v1/prices/latest  │  Express, reads Supabase → file fallback
└──────────┬─────────────┘
           ▼
┌────────────────────────┐
│ src/lib/api.js         │  fetchGold() — now pipes isFresh, isFallback,
│ normalizeGoldResponse  │  freshnessSeconds, sourceTimestamp through
└──────────┬─────────────┘
           ▼
┌────────────────────────┐
│ src/lib/live-status.js │  getLiveFreshness() — single source of
│                        │  truth; six explicit buckets with anti-
│                        │  mislabel guards (live | delayed | cached |
│                        │  stale | fallback | unavailable)
└────────────────────────┘
           │
           ▼  (90 s poll)
   Client UI surfaces
   (hero, tracker, ticker, country, footer)
```

**Truth invariant** (enforced in tests):

> `getLiveFreshness()` returns `'live'` **iff** `updatedAt` is present **and**
> `ageMs ≤ DELAYED_AFTER_MS` **and** `hasLiveFailure === false` **and** `isFallback !== true`
> **and** `isFresh !== false`. Any single violation degrades the bucket. There is no other path to
> "Live" anywhere in the UI.

## 2. Target (push-capable)

```
┌────────────────────────┐
│ gold-api.com  (paid)   │  or alternate provider with higher cadence
└──────────┬─────────────┘
           │  polled by a long-lived server worker (1–5 s)
           ▼
┌────────────────────────┐
│ Backend ingest worker  │  Node persistent process; normalizes events,
│  - sequenceId++        │  attaches sourceTimestamp + ingestTimestamp +
│  - server timestamp    │  publishTimestamp + monotonic sequenceId
│  - source timestamp    │
│  - is_fallback flag    │
└──────────┬─────────────┘
           ▼
┌────────────────────────┐
│ /api/v1/prices/stream  │  Server-Sent Events (text/event-stream).
│   event: price         │  Heartbeat every 15 s. JSON payload mirrors
│   data: { … }          │  the REST /prices/latest envelope so the
│                        │  freshness engine input shape is unchanged.
└──────────┬─────────────┘
           ▼  (push)
┌────────────────────────┐
│ Client EventSource     │  with reconnect (exp backoff + jitter),
│  subscriber            │  liveness watchdog, and short-poll fallback
│                        │  to /prices/latest when EventSource fails.
└──────────┬─────────────┘
           ▼
   getLiveFreshness()        — unchanged, no anti-mislabel rules relaxed
           │
           ▼
   Client UI surfaces        — copy switches from
                              "Updated 2 min ago" → "Streaming live"
```

## 3. Why SSE, not WebSocket

For one-way price push, SSE is materially simpler and equally fast:

- **One-way** is sufficient — clients do not send price events.
- **HTTP/1.1 keep-alive** works through every existing proxy / CDN edge.
- **Native browser reconnect** with `Last-Event-Id` semantics.
- **No new dependency**; Express + `res.write()` is sufficient.
- **Falls back trivially** to short polling on the same `/prices/latest` REST route already in
  production.

WebSocket only wins for bidirectional channels (admin commands, chat, collaborative cursors), none
of which apply here.

## 4. Why this is **not** in the same PR as the freshness engine

Three reasons aligned with `AGENTS.md` §6 (product-trust guardrails):

1. **Production safety.** `server.js` ships with bcrypt + Helmet + rate limiting. Adding a
   long-lived SSE endpoint requires reviewing helmet's `crossOriginEmbedderPolicy`, rate-limiter
   exclusions for streaming connections, and connection-cap exhaustion. None of that is a small
   diff.
2. **No regression of the truth contract.** The freshness engine in this PR is the contract every UI
   surface depends on. Landing it standalone means SSE can be added later without risk of the truth
   engine being shaped around transport convenience.
3. **Provider cost / approval.** A 1–5 s upstream poll requires a paid tier (or a different
   provider). That is a business decision that belongs in a separate proposal in `docs/plans/`.

The freshness engine in this PR is **forward-compatible** with the SSE upgrade: the client function
signature stays the same; events from SSE land in `state.live` exactly the way today's polled
responses do.

## 5. Event schema (target)

Each SSE event MUST carry:

| Field                 | Type     | Purpose                                                                              |
| --------------------- | -------- | ------------------------------------------------------------------------------------ |
| `sequenceId`          | integer  | Monotonic per-stream. Clients drop out-of-order / duplicate events.                  |
| `serverTimestamp`     | ISO-8601 | When the server published the event.                                                 |
| `sourceTimestamp`     | ISO-8601 | Provider's own timestamp for the price.                                              |
| `ingestTimestamp`     | ISO-8601 | When the backend received it from the provider.                                      |
| `xauUsdPerOz`         | number   | Spot price.                                                                          |
| `isFresh`             | boolean  | Upstream `is_fresh` flag.                                                            |
| `isFallback`          | boolean  | Upstream `is_fallback` flag. **Honored by `getLiveFreshness()` as a hard override.** |
| `freshnessSeconds`    | integer  | Age at ingest from provider's own clock.                                             |
| `maxFreshnessSeconds` | integer  | Provider's freshness budget.                                                         |
| `provider`            | string   | Source identifier for logs / observability.                                          |

Heartbeats are SSE comment lines (`: heartbeat\n\n`) every 15 s; they do not appear as events but
reset the client's liveness watchdog.

## 6. Failure modes & fallbacks (target)

| Failure                         | Detection                          | Client behavior                                                                                                      |
| ------------------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Transient network loss          | `EventSource.onerror`              | Exponential backoff reconnect (1 s, 2 s, 4 s, 8 s, max 30 s) with jitter ±25%; switch to short polling at 5 retries. |
| Provider returns fallback       | `isFallback: true` in event        | `getLiveFreshness()` returns `'fallback'`; UI shows "Fallback · last update Xm ago".                                 |
| Server crash / restart          | Missed heartbeats × 3              | Reconnect; on resume, REST `/prices/latest` to bridge any gap.                                                       |
| Out-of-order or duplicate event | `sequenceId` ≤ last seen           | Drop event; keep current state.                                                                                      |
| Clock skew                      | `serverTimestamp` vs. `Date.now()` | Use server timestamp for age; never blend with `Date.now()` arithmetic on the wire.                                  |
| Memory leak in subscription     | Page unload / `pagehide` event     | `eventSource.close()`; clear backoff timer; remove all listeners.                                                    |

## 7. Phased rollout plan

| Phase                 | Deliverable                                                                | Status     |
| --------------------- | -------------------------------------------------------------------------- | ---------- |
| Phase 0               | `docs/realtime-baseline-audit.md`                                          | ✅ this PR |
| Phase 2 (freshness)   | Truth engine, anti-mislabel guards, EN/AR parity, tests                    | ✅ this PR |
| Phase 1.a (transport) | Backend ingest worker behind feature flag `REALTIME_INGEST_WORKER_ENABLED` | future PR  |
| Phase 1.b (SSE)       | `/api/v1/prices/stream` endpoint; helmet review; rate-limit exemption      | future PR  |
| Phase 1.c (client)    | `EventSource` subscriber with short-poll fallback                          | future PR  |
| Phase 3               | Adaptive polling, circuit breaker, time-drift guard                        | future PR  |
| Phase 6               | Metrics endpoint, structured logs, alerts (see ops runbook)                | future PR  |

Each future PR follows `AGENTS.md` §6 product-trust guardrails: freshness labels stay truthful, AED
peg stays at 3.6725, EN/AR parity is preserved, no "Live" without all preconditions met.

## 8. Hard non-goals

- **No SPA migration.** This stays a static multi-page site. SSE is added as a thin transport, not
  as an excuse to introduce a frontend framework.
- **No paid provider switch in this design.** That is a `docs/plans/` topic.
- **No removal of the polling fallback.** Forever supported as the safety net when SSE fails for any
  reason.
- **No "Live" pill without truth preconditions.** Ever.
