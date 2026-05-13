# AGENTS.md

Canonical cross-agent charter for the Gold Ticker Live repository. Every coding agent — GitHub
Copilot (cloud agent, CLI, chat), OpenAI Codex, Claude Code, Cursor, Gemini CLI, Windsurf, Aider —
should read this file first. Agent-specific files (`CLAUDE.md`, `.github/copilot-instructions.md`)
are thin pointers back here plus tool-specific mechanics.

## 1. What this repo is

Gold Ticker Live — a bilingual (EN / AR) static multi-page website publishing gold-price reference
data, calculators, country / city / market pages, and a shops directory. It ships to
`goldtickerlive.com` from GitHub Pages, with a Node/Express admin backend plus Python + GitHub
Actions automation (including an **hourly X-post workflow** that is live in production).

## 2. Core commands

```bash
# Required env vars — server/lib/auth.js throws at startup if any is missing
export JWT_SECRET=<random 32+ char string>
export ADMIN_PASSWORD=<any string>
export ADMIN_ACCESS_PIN=<6+ digit PIN>

npm install                  # install dependencies (node_modules not committed)
npm run dev                  # Vite dev server (HMR)
npm test                     # node:test suites under tests/*.test.js
npm run lint                 # ESLint (flat config in eslint.config.mjs)
npm run validate             # build integrity + DOM-safety + SEO-meta + sitemap-coverage + placeholder + analytics gates
npm run quality              # lint + prettier --check + stylelint
npm run build                # extract-baseline → normalize-shops → generateSitemap → vite build → dist/
npm run preview              # preview the production bundle
npm start                    # Node/Express admin backend on :3000
```

`npm run validate` includes `scripts/node/check-unsafe-dom.js`, which keeps a per-file baseline of
`innerHTML` / `outerHTML` / `insertAdjacentHTML` / `document.write` sinks. Adding a sink fails CI;
removing one should tighten the baseline in the same PR.

## 3. Repository map

| Path                   | What lives here                                                                                                                                 |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                    | Entry HTML pages (`index.html`, `tracker.html`, `shops.html`, `calculator.html`, `invest.html`, …), `CNAME`, `robots.txt`, service worker.      |
| `src/`                 | ES modules: `src/pages/`, `src/components/`, `src/lib/`, `src/config/`, `src/tracker/`, `src/search/`.                                          |
| `styles/`              | `global.css` (tokens + primitives) and `styles/pages/*.css`.                                                                                    |
| `countries/`           | Pre-generated country / city / karat / market pages.                                                                                            |
| `content/`             | Guides, FAQ, order-gold, submit-shop, search, social, news, premium-watch, compare-countries, todays-best-rates, tools.                         |
| `admin/`               | Admin panel (Supabase GitHub OAuth).                                                                                                            |
| `server/`, `server.js` | Node/Express admin backend (JWT + bcrypt + Helmet + rate limiting + JSON file persistence).                                                     |
| `scripts/node/`        | Build, validation, audit, and enrichment scripts.                                                                                               |
| `scripts/python/`      | Automation: gold poster, spike detector, Supabase client, newsletter builder.                                                                   |
| `.github/workflows/`   | CI, deploy, codeql, semgrep, lighthouse, perf-check, hourly `post_gold.yml`, newsletters, uptime / health / spike alerts, `sync-db-to-git.yml`. |
| `tests/`               | node:test suites.                                                                                                                               |
| `docs/`                | Reference docs + the master plan (`docs/REVAMP_PLAN.md`) + proposal intake (`docs/plans/`).                                                     |

## 4. The Autonomy Contract

When you receive a short or ambiguous prompt (e.g. _"revamp UI and UX"_, _"improve SEO"_, _"fix the
homepage"_), you are expected to:

1. **Explore.** Read the relevant files. Inspect related flows, styles, dependencies, UX surfaces.
   Check reputable sources and direct competitors when useful. Map what exists and what is missing.
2. **Expand.** Translate the vague prompt into a specific, dense, achievable spec with measurable
   outcomes. Don't hide behind narrow literalism.
3. **Plan.** For anything beyond a trivial edit, write `docs/plans/YYYY-MM-DD_<slug>.md` with
   impacted files, sequence, rollback points, and a done checklist. Open it as a draft PR so the
   user can redirect cheaply.
4. **Implement.** Make substantial, coherent improvements when the task justifies them. Don't pad
   diffs; don't produce cosmetic churn; **but also don't ship timid +11/−4 edits when the task
   clearly deserves broader work.** Keep existing working behavior unless the task changes it.
5. **Verify.** Tests, lint, build, preview screenshots, Lighthouse deltas, link audits — whichever
   fit. State explicitly what was verified vs. assumed. No fake completion claims. No fake test
   claims.
6. **Ship.** PR only, never direct to `main`, never force-push. PR body: **What / Why / How / Proof
   / Risks**.

Ambition is encouraged. Big coherent changes are welcome when justified. The guardrails in §6 exist
to prevent the bad kind of bold — not the good kind.

## 5. Worked example — handling _"revamp UI and UX"_

1. **Explore.** Open `index.html`, `tracker.html`, `shops.html`, `styles/global.css`,
   `src/components/nav.js`, `src/pages/home.js`. Run the site locally (`npm run dev`) and the
   preview (`npm run build && npm run preview`) on desktop + a mobile viewport. Pull up two or three
   credible competitor sites (bullion, commodity, fintech UI patterns) for a 30-minute scan. Note
   what looks dated: typography rhythm, card density, freshness-label visibility, mobile nav drawer
   behavior, tracker hero hierarchy, Arabic RTL parity issues.
2. **Expand.** Translate to concrete deliverables: "Tighten heading scale using `--text-*` tokens;
   consolidate `.card` / `.panel` variants; rebuild mobile nav drawer sections with `<details>`; add
   freshness pill to homepage hero; make karat strip scannable on 360 px; verify RTL for every
   changed surface." Measurable outcomes: Lighthouse performance ≥ current baseline; no new
   DOM-safety sink; `tests/nav-data.test.js` stays green; every visible copy change ships in EN +
   AR.
3. **Plan.** Write `docs/plans/2026-04-23_ui-ux-revamp.md` listing impacted files, the proposed
   commit sequence, rollback points (each section is a reversible commit), and a done checklist tied
   to the deliverables. Open a draft PR with just the plan so the owner can redirect before
   implementation cost is sunk.
4. **Implement.** Land the plan as a coherent multi-commit PR. Keep diffs focused per-concern —
   token update, then surface, then nav drawer, then hero — but don't split mechanically into
   trivial bits.
5. **Verify.** `npm run validate`, `npm test`, `npm run quality`, `npm run build`; attach
   before/after screenshots at desktop + 360 px for every touched surface; RTL spot-check;
   DOM-safety baseline delta.
6. **Ship.** PR body: What changed, why, how it's structured, what was verified, what wasn't, and
   the risks.

For a one-line bug fix, collapse steps 2–3 into a sentence in the PR body.

## 6. Product-trust guardrails

Non-negotiables. Each has a one-line _Why:_ so you can make good edge-case decisions.

1. **Spot / reference prices must never be blurred with retail or jewelry prices.** _Why:_ the
   site's entire credibility rests on this distinction; retail quotes include making charges,
   premiums, and tax.
2. **Cached, fallback, estimated, delayed, or derived values must be visibly labelled with source
   and timestamp.** _Why:_ labelled stale data is honest; unlabelled stale data is a trust
   violation.
3. **Freshness labels, disclaimers, methodology notes are product elements, not decoration.** _Why:_
   removing them re-introduces the exact ambiguity guardrails 1–2 are guarding against.
4. **SEO integrity.** Don't silently change canonical URLs, `robots.txt`, sitemap structure, `og:*`
   / `twitter:*` tags, or `CNAME`. Schema changes need a migration note. _Why:_ measurable ranking
   regression risk.
5. **Static multi-page architecture stays static.** Don't migrate to an SPA / framework without an
   explicit request. _Why:_ SPA migration is a separate, owner-approved program.
6. **Bilingual EN / AR parity.** User-visible copy changes ship in both languages; strings live in
   `src/config/translations.js`. _Why:_ tests enforce it and half-landed copy is a visible bug.
7. **DOM-safety baseline doesn't regress.** Use helpers from `src/lib/safe-dom.js` (`escape`,
   `safeHref`, `safeTel`, `el`, `clear`); prefer `node.replaceChildren()` over
   `node.innerHTML = ''`. _Why:_ the baseline is the repo's only XSS regression guard, and CI blocks
   sink growth.
8. **No secrets in git.** Use GitHub Secrets only; never echo them into logs or workflow outputs.
   _Why:_ this is a public repo.
9. **PR-only workflow.** No direct commits to `main`, no force-push. _Why:_ `main` is protected and
   the live site deploys from it.
10. **The hourly `post_gold.yml` Actions workflow is production.** Any change to it needs a plan
    entry and must not break the `scripts/python/utils/*` import layout. _Why:_ it auto-posts to a
    public channel every hour — breakage is public within the hour.
11. **Honesty about verification.** Separate what you ran from what you assumed. Don't claim tests
    pass that you didn't run. _Why:_ the one rule that makes every other claim in a PR body legible.

## 7. Style & conventions

- **JS:** vanilla ES modules; no new frameworks; `camelCase`; prefer narrow, focused modules under
  `src/lib/`.
- **CSS:** use canonical tokens from `styles/global.css` (`--color-*`, `--surface-*`, `--space-*`,
  `--text-*`, `--radius-*`, `--shadow-*`, `--ease-*`, `--duration-*`). Don't hand-pick hex or raw
  rem where a token exists.
- **Strings:** every user-visible string in `src/config/translations.js` — never hard-code UI text.
- **Motion:** every animation respects `prefers-reduced-motion: reduce` (there is a global reset in
  `styles/global.css`).
- **Dependencies:** check the GitHub Advisory DB before adding anything new; don't bump versions as
  drive-by changes.
- **Python imports:** entrypoints in `scripts/python/` add `scripts/python/` to `sys.path`;
  relative-import `utils.*` via that path.
- **Safe DOM:** `src/lib/safe-dom.js` is the only sanctioned home for new `innerHTML`-style writes.

## 8. Done criteria

- **Small fix / copy change:** tests + lint pass locally; PR body lists what you verified; bilingual
  parity if the copy is user-visible.
- **Feature / component change:** add / update tests where there is an existing test pattern;
  `npm run validate` and `npm run build` green; before/after screenshot for visible surfaces; RTL
  spot-check for layouts.
- **Plan-driven revamp:** the plan file's done checklist is ticked with evidence (screenshot, test
  name, Lighthouse number); no guardrail in §6 is weakened without the owner opting in.
- Never claim "done" or "fixed" you didn't verify.

## 9. Where the plan lives

- **Master plan:** `docs/REVAMP_PLAN.md` — tracks in progress, decisions, production tracks, issues,
  backlog. Update the specific section you touched in the same PR.
- **Proposal intake:** `docs/plans/` — raw captures from prompts, plus `docs/plans/README.md`
  (priority matrix). New plans follow `docs/plans/YYYY-MM-DD_<slug>.md`.
- **Reference docs:** `docs/ARCHITECTURE.md`, `docs/DESIGN_TOKENS.md`, `docs/ACCESSIBILITY.md`,
  `docs/PERFORMANCE.md`, `docs/SEO_STRATEGY.md`, `docs/SEO_CHECKLIST.md`, `docs/EDIT_GUIDE.md`,
  `docs/AUTOMATIONS.md`, `docs/environment-variables.md`, `docs/tracker-state.md`. Agent rules don't
  live in `docs/`; this file owns them.

## 10. Agent-specific notes

- **GitHub Copilot** — cloud agent / CLI / chat read `.github/copilot-instructions.md`, which points
  back here. Use `report_progress` to commit + push; use the GitHub MCP tools for CI investigation;
  never use `git push` directly.
- **Claude Code** — prefers `CLAUDE.md`, which points here and adds Claude-only mechanics
  (subagents, skills).
- **Codex / Cursor / Windsurf / Aider / Gemini CLI** — read this file directly per the
  [`AGENTS.md`](https://agents.md) convention (stewarded by the Agentic AI Foundation). No
  vendor-specific branches in this file.
