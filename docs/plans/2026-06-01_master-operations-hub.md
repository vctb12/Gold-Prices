# Gold Ticker Live — Master Operations Hub

```yaml plan-status
status: active
priority: P0
class: meta
owner: @vctb12
created: "2026-06-01"
last_updated: "2026-06-01"
next_action: "Run Track C Session C1a (docs archive) or NEXT_PR_SEQUENCE PR 1"
```

> **Superseded for depth by the Master Workbook v2** —
> [`docs/GOLD_TICKER_LIVE_MASTER_WORKBOOK.md`](../GOLD_TICKER_LIVE_MASTER_WORKBOOK.md)
> + appendices [`docs/workbook/`](../workbook/)
> (`@.github/prompts/master-workbook-session.prompt.md`).  
> This hub remains a **one-screen routing summary**; playbooks, API map, CI catalog, and step-by-step
> guides live in the workbook appendices.

---

## What happened in the last 3 days (2026-05-30 → 2026-06-01)

| Area | Shipped (merged to `main`) | Notes |
| ---- | -------------------------- | ----- |
| **UI/UX audit program** | Sessions **0–5** complete ([#387](https://github.com/vctb12/GoldTickerLive/pull/387)–[#393](https://github.com/vctb12/GoldTickerLive/pull/393)) | First paint, empty pages, consistency, nav/layout, CSS partials + a11y CI |
| **Product builds** | Insights feed (BUILD 8), compare countries (BUILD 6), market intel on countries, alert system | See `PLAN.md` “Recently Completed” |
| **Cleanup** | Country URL consolidation (~345 pages), learn-hub phases, premium micro-interactions | May–29–31 PRs |
| **Automation** | Hourly gold price + X-post (chore commits only) | Production-critical; do not “fix” in UX sessions |

**Perception gap (still true after Session 0–5):** Gold Ticker Live must feel like a **live gold
reference terminal**, not a marketing site with placeholders. Competitors (e.g. goldprice.org) lead
with numbers; GTL must lead with **labeled reference prices**, fast first paint, and honest
freshness — on every surface, EN + AR, 360px RTL.

---

## Priority order (what to work on next)

Do **not** parallelize tracks that touch the same files. Recommended sequence:

| Order | Track | Session | Why now |
| :---: | ----- | ------- | ------- |
| 1 | **Integration** | D1 — cross-page deep links | Low risk; improves flagship flows without moves |
| 2 | **Backend / trust** | NEXT_PR_SEQUENCE **PR 1** — GDPR export/delete + alerts docs | Closes P0 integration gaps |
| 3 | **Repo hygiene** | C1a — docs archive + supersession index only | No URL moves; reduces agent confusion |
| 4 | **Repo hygiene** | C1b–C1f — micro moves (see reorg program) | One subsystem per PR; owner sign-off on `CANDIDATES.md` |
| 5 | **SEO / product** | NEXT_PR_SEQUENCE **PR 2** — noindex plan for karat stubs | Sitemap shrink; no deletions |
| 6 | **Visual polish** | B1–B4 (nav polish, homepage, tracker terminal, hover rollout) | After integration glue |
| 7 | **Monetization** | E1 — AdSense + GA4 events | No empty ad holes |
| 8 | **AI** | E2 — commentary / assist widgets | Gated: disclaimers + no secrets in git |

**Defer unless owner approves:** full root → `pages/` HTML move (C1 mega), SPA migration, provider
switch in same PR as UX, edits to `post_gold.yml` / `gold-price-fetch.yml` / `data/gold_price.json` /
`sw.js` / `src/config/constants.js`.

---

## Artifact map (canonical files)

| Artifact | Purpose |
| -------- | ------- |
| [`docs/GOLD_TICKER_LIVE_MASTER_WORKBOOK.md`](../GOLD_TICKER_LIVE_MASTER_WORKBOOK.md) | **Canonical one-time workbook** — vision, gaps, WB sessions, scanners |
| [`docs/workbook/WORKBOOK_SESSION_REGISTRY.md`](../workbook/WORKBOOK_SESSION_REGISTRY.md) | WB branch ↔ PR tracker |
| [`PLAN.md`](../../PLAN.md) | Active task checklist (update every session) |
| [`docs/REVAMP_PLAN.md`](../REVAMP_PLAN.md) | Master backlog + production tracks |
| [`docs/plans/README.md`](./README.md) | Proposal intake + impact/effort matrix |
| [`docs/plans/2026-06-01_endless-session-prompts.md`](./2026-06-01_endless-session-prompts.md) | Copy-paste **endless** prompts by category |
| [`docs/plans/2026-06-01_ui-ux-audit-remediation-program.md`](./2026-06-01_ui-ux-audit-remediation-program.md) | UI/UX audit (Sessions 0–5 **done**; Tracks B–E remain) |
| [`docs/plans/2026-06-01_ui-ux-audit-session-prompts.md`](./2026-06-01_ui-ux-audit-session-prompts.md) | One-shot session prompts (historical + splits) |
| [`docs/plans/2026-06-01_repo-reorganization-program.md`](./2026-06-01_repo-reorganization-program.md) | Phased file/folder moves + redirects |
| [`docs/plans/ARCHIVE_AND_SUPERSESSION_INDEX.md`](./ARCHIVE_AND_SUPERSESSION_INDEX.md) | Which `.md` files are authoritative vs archived |
| [`docs/audits/UI_UX_AUDIT_SESSION_REGISTRY.md`](../audits/UI_UX_AUDIT_SESSION_REGISTRY.md) | Branch ↔ PR ↔ status (UI/UX Sessions 0–5) |
| [`docs/audits/NEXT_PR_SEQUENCE.md`](../audits/NEXT_PR_SEQUENCE.md) | Post–12-phase integration sequence |
| [`.github/prompts/`](../../.github/prompts/) | `@` mention targets in Composer / Copilot |
| [`docs/GOLD_TICKER_LIVE_AGENT_PROMPTS.md`](../GOLD_TICKER_LIVE_AGENT_PROMPTS.md) | Deep library (50+ specialized prompts) |
| [`docs/AI_PROMPT_LIBRARY.md`](../AI_PROMPT_LIBRARY.md) | Index of `.github/prompts/*.prompt.md` |

---

## Endless prompts (run any time)

Each run must **discover** at least one new item (no duplicate fixes). Use `@` files in Cursor:

| Category | `.github/prompts` | Doc section |
| -------- | ----------------- | ----------- |
| Pick next work (meta) | `session-pick-next-work.prompt.md` | § Meta |
| Repo / hygiene | `endless-repo-discovery.prompt.md` | § Repo |
| UI / visual | `endless-ui-visual-sweep.prompt.md` | § UI |
| Frontend / pages | `endless-frontend-polish.prompt.md` | § Frontend |
| Backend / admin | `endless-backend-hardening.prompt.md` | § Backend |
| Integrations / links | `endless-integration-wiring.prompt.md` | § Integration |
| Monetization | `endless-monetization-growth.prompt.md` | § Monetization |
| AI (gated) | `endless-ai-integration.prompt.md` | § AI |
| Docs / plans | `endless-docs-governance.prompt.md` | § Docs |
| Gold trust / pricing | `endless-gold-product-trust.prompt.md` | § Trust |

Full copy-paste bodies: [`2026-06-01_endless-session-prompts.md`](./2026-06-01_endless-session-prompts.md).

---

## Session discipline (every PR)

1. Read `AGENTS.md`, `PLAN.md`, this hub.
2. Check open PRs: `gh pr list --state open` — no duplicate scope.
3. Branch: `cursor/<slug>-cb21` (or existing session branch from registry).
4. Smallest correct change; EN+AR for user-visible copy via `translations.js`.
5. Verify: `npm test`, `npm run lint`, `npm run validate`, `npm run build` (as applicable).
6. Update `PLAN.md`, relevant program checklist, and registry row.
7. PR body: **What / Why / How / Proof / Risks**.

---

## Making the site “amazing” for gold (product north star)

| Pillar | User expectation | Repo lever |
| ------ | ---------------- | ---------- |
| **Truth** | Reference ≠ retail; VAT/making charges disclosed | `gold-pricing` rules, methodology, market-intel panels |
| **Speed** | Numbers visible &lt; 1s on repeat visit | cache-first `api.js`, skeletons, SW (careful) |
| **Coverage** | Country/city/karat + GCC tools | `countries/`, compare, calculator, tracker |
| **Locale** | Natural Arabic, RTL at 360px | `translations.js`, mobile-ux prompts |
| **Depth** | Learn, insights, invest planner | static HTML fallbacks + honest empty states |
| **Ops** | Hourly X + fresh `gold_price.json` | workflows (human review only) |

Research benchmark: lead with **spot-linked gram prices**, timestamp + source + state label on every
visible price, and scannable karat tables — then differentiate with GCC context, shops (labeled
directory), and tools (alerts, compare, zakat).

---

## UI/UX audit program status

| Session | Status | PR |
| :-----: | ------ | -- |
| 0 Planning | 🟢 merged | [#387](https://github.com/vctb12/GoldTickerLive/pull/387) |
| 1 First paint | 🟢 merged | [#388](https://github.com/vctb12/GoldTickerLive/pull/388) |
| 2 Empty pages | 🟢 merged | [#389](https://github.com/vctb12/GoldTickerLive/pull/389) |
| 3 Consistency | 🟢 merged | [#390](https://github.com/vctb12/GoldTickerLive/pull/390) |
| 4 Nav & layout | 🟢 merged | [#392](https://github.com/vctb12/GoldTickerLive/pull/392) |
| 5 Performance | 🟢 merged | [#393](https://github.com/vctb12/GoldTickerLive/pull/393) |

**Next from same program:** Tracks **B** (visual), **C** (repo), **D** (integration), **E** (growth/AI)
in [`2026-06-01_ui-ux-audit-remediation-program.md`](./2026-06-01_ui-ux-audit-remediation-program.md).

---

## Decision log

| Date | Decision |
| ---- | -------- |
| 2026-06-01 | UI/UX Sessions 0–5 treated **complete** on `main`; hub + endless prompts are the new intake |
| 2026-06-01 | Full HTML root → `pages/` move **deferred** to micro-phases in repo reorg program |
| 2026-06-01 | `docs/GOLD_TICKER_LIVE_AGENT_PROMPTS.md` remains deep reference; `.github/prompts/endless-*` preferred for repeat runs |
