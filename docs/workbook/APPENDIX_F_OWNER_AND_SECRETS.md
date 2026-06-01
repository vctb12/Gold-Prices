# Appendix F — Owner Actions & Secrets Matrix

> Parent: [`GOLD_TICKER_LIVE_MASTER_WORKBOOK.md`](../GOLD_TICKER_LIVE_MASTER_WORKBOOK.md)  
> Full inventory: [`docs/environment-variables.md`](../environment-variables.md)

**Agents never write secret values to git, PRs, or logs.**

## F.1 Blockers only owner can clear

| Blocker | Secret / action | Unblocks |
| ------- | --------------- | -------- |
| Live Stripe checkout | `STRIPE_*` keys + price IDs in GitHub Secrets / server env | G-04, WB-603 |
| Alert email delivery | `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `ALERT_JOB_TOKEN` | G-05, WB-303 |
| Supabase production | `SUPABASE_SERVICE_ROLE_KEY`, RLS policies applied | DB-backed features |
| Gold provider switch | `GOLD_PROVIDER_ORDER` change **separate PR** after bakeoff | provider migrations |
| Vendor program go-live | Product decision + Stripe connect (future) | WB-701+ |

## F.2 GitHub Actions secrets (names only)

| Secret | Workflow |
| ------ | -------- |
| `GOLDPRICEZ_API_KEY` | gold fetch, post |
| `CONSUMER_KEY`, `CONSUMER_SECRET`, `ACCESS_TOKEN`, `ACCESS_TOKEN_SECRET` | X post (mapped to TWITTER_* env internally) |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | sync, python |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHANNEL_ID` | alerts |
| `DISCORD_WEBHOOK_URL` | notifications |

## F.3 Local dev minimum

```bash
export JWT_SECRET="dev-secret-key-for-local-development-32chars"
export ADMIN_PASSWORD="admin-dev-password"
export ADMIN_ACCESS_PIN="123456"
```

Vite dev (`npm run dev`) — no env required.  
`npm test` / `npm start` — **required**.

## F.4 Client vs server keys

| Surface | Keys live in |
| ------- | ------------ |
| GitHub Pages static site | No secrets in browser bundle |
| Hourly gold fetch | GitHub Secrets → workflow |
| Express optional API | Server env / Supabase |
| Admin OAuth | Supabase + `ALLOWED_EMAIL` |

## F.5 When agent hits “needs secret”

1. Implement dry-run / graceful degradation path
2. Document in `docs/environment-variables.md` or feature doc
3. Add `PLAN.md` row under Blocked with owner action
4. **Do not** commit placeholder secrets

## F.6 Provider bakeoff gate

Before changing production provider in `gold-price-fetch.yml`:

1. Run `gold-provider-bakeoff.yml` or local bakeoff scripts
2. Separate PR from UX work
3. `@.github/prompts/provider-bakeoff.prompt.md`
