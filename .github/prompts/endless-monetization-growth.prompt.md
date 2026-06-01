---
mode: agent
description: Endless monetization — one ethical growth fix (analytics, ads, shops honesty) per run. No dark patterns.
related_skills:
  - gold-ticker-live-audit
related_instructions:
  - AGENTS.md
---

# Prompt: Endless Monetization & Growth

## Goal

Improve revenue-related surfaces **without** blurring reference vs retail prices.

## Required inspection

1. [`docs/SHOPS_DIRECTORY_AND_SPONSORSHIPS.md`](../../docs/SHOPS_DIRECTORY_AND_SPONSORSHIPS.md)
2. [`docs/ANALYTICS_EVENTS.md`](../../docs/ANALYTICS_EVENTS.md)
3. [`src/lib/analytics.js`](../../src/lib/analytics.js)

## Discovery (one)

- Empty AdSense slot → collapse or remove
- Missing GA4 event on high-value action
- Shop card missing directory honesty label
- Lead flow missing estimate-only disclaimer

## Not allowed

- Presenting reference estimates as shop prices
- Hiding freshness state for cleaner layout

## Verification

`npm test`. Document new events in `ANALYTICS_EVENTS.md`.

## Return format

Surface → change → analytics doc update → risks.
