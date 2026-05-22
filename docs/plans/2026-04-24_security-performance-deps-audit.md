# 2026-04-24 — Security / Performance / Dependencies audit & remediation

```yaml plan-status
status: not-started
priority: P2
class: A
owner: @vctb12
last_run_at: ""
last_run_pr: ""
last_run_agent: copilot
slices_remaining_estimate: 0
next_action: ""
blocked_on: ""
guardrails_reviewed: true
skills_used: []
```

**Status:** 🟢 In progress — PR A-1 (security high-severity) landed as commit 81667b3. PR B-1 (async
stat), PR B-2 partial (admin no-store cache-control), PR C-1 (lowdb removal), and PR A-2
(shops/rendering.js innerHTML burn-down) landing in the follow-up commit. **2026-04-25:** secret
scan, static-tier header parity, and perf baseline shipped — see §7.

**Owner:** audit agent · **Scope:** Express admin backend, static site, CI, deps. **Guardrails:**
[`AGENTS.md §6`](../../AGENTS.md#6-product-trust-guardrails). No SPA migration, no silent
SEO/canonical/`robots.txt`/sitemap/CSP changes, no DOM-safety-baseline regressions, bilingual parity
on user-visible copy, PR-only.

---

## 0 · Sequencing

| #   | PR      | Track    | Goal                                                              |
| --- | ------- | -------- | ----------------------------------------------------------------- |
| 1   | this PR | plan     | Land plan doc + link from `docs/plans/README.md`.                 |
| 2   | A-1     | security | High-severity fixes #1–#6 + CSP regression test.                  |
| 3   | B-1     | perf     | Async stat in static fallback, autocannon before/after.           |
| 4   | B-2     | perf     | Cache-Control headers + image deltas + translations split.        |
| 5   | C-1     | deps     | Depcheck + dedupe, no major bumps.                                |
| 6   | A-2     | security | `innerHTML` burn-down: start with `src/pages/shops/rendering.js`. |

Security before perf because CSP tightening affects the bundle we measure. Deps last so we don't
re-roll lockfiles mid-audit.

Every PR verifies with `npm test` + `npm run lint` + `npm run validate` + `npm run build`. Perf PRs
add Lighthouse; security PRs add the CSP regression test; deps PR adds an `npm ls` diff.

---

## 1 · Current posture (do not regress)

- Helmet CSP enforced in production with a tight allow-list — `server.js:42–99`.
  `frameAncestors 'none'`, `objectSrc 'none'`, HSTS preload, strict referrer policy,
  upgrade-insecure-requests.
- CORS defaults to deny in production when `CORS_ORIGINS` is unset — `server.js:104–134`.
- Three layers of rate limiting: global, `/api/*`, login — `server.js:159–179`,
  `server/routes/admin/index.js:23–73`.
- Body size capped at 256 KB — `server.js:143–144`.
- Stripe webhook raw-body registered **before** JSON parser — `server.js:140`.
- Canonical CodeQL-recognised path-traversal guard (`path.relative` + null-byte + `..` reject) —
  `server.js:263–292`.
- `JWT_SECRET` and `ADMIN_PASSWORD` throw at module load — `server/lib/auth.js:9–28`. bcrypt
  cost 12.
- PIN verify endpoint uses `crypto.timingSafeEqual` — `server/routes/admin/index.js:230–233`.
- `npm audit --production` = 0 advisories (verified 2026-04-24).
- DOM-safety baseline enforced by `scripts/node/check-unsafe-dom.js` in `npm run validate`.

---

## 2 · Track A — Security

### A.1 Fixed in PR A-1 (High severity)

| #   | Finding                                             | Evidence                                                               | Fix shipped                                                                                                                                   |
| --- | --------------------------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Unvalidated `process.env.SITE_URL` in redirect URLs | `server/routes/stripe.js:89–90,141`; `server/routes/newsletter.js:180` | `server/lib/site-url.js` loads once, asserts `https://` + allow-list, falls back to safe default; Stripe/newsletter use `new URL()`.          |
| 2   | Unbounded `loginAttempts` Map                       | `server/routes/admin/index.js:26–60,197`                               | Periodic sweep (60 s) + hard size cap (10 000 entries) with LRU eviction; same pattern applied to `pinAttempts`.                              |
| 3   | No JWT revocation / session invalidation            | `server/lib/auth.js`                                                   | `tokenVersion` field on each user record; embedded in JWT payload; bumped on password change / delete; verified in `authMiddleware`.          |
| 4   | `users.json` written with default perms             | `server/lib/auth.js:63–69`                                             | `fs.writeFileSync(..., { mode: 0o600 })` + `fs.mkdirSync(..., { mode: 0o700 })`; best-effort `chmod` on existing files.                       |
| 5   | No guard on missing Stripe webhook secret           | `server/routes/stripe.js:14–23,167`                                    | Webhook handler now rejects with 503 + logs when `STRIPE_SECRET_KEY` or `STRIPE_WEBHOOK_SECRET` are missing, before calling signature verify. |
| 6   | Service-role Supabase key could ship to browser     | `server/lib/supabase-client.js:38`                                     | Runtime `typeof window !== 'undefined'` throw at module top + ESLint `no-restricted-imports` rule blocking `server/**` imports from `src/**`. |

PR A-1 also ships:

- `tests/csp-regression.test.js` — asserts the literal production CSP header, preventing silent
  directive changes.
- `tests/auth-token-version.test.js` — covers JWT tokenVersion round-trip.
- `tests/site-url.test.js` — unit tests for `site-url.js` (valid / invalid / allow-list).

### A.2 Follow-up checklist (Medium / Low / Info)

These are filed here with remediation notes so any future PR can pick one off without re-auditing.

- [x] **#7 — `req.ip` without `trust proxy` in non-prod.** Document required `trust proxy` value per
      deployment in `docs/environment-variables.md`. Consider `keyGenerator` option on
      `express-rate-limit` that normalises `X-Forwarded-For`. ✅ **2026-04-28:** Reverse-proxy /
      `trust proxy` section added to [`docs/environment-variables.md`](../environment-variables.md)
      covering single-proxy default, multi-proxy hop counts, and direct-exposure rate-limit risk.
- [ ] **#8 — `innerHTML` burn-down** across `src/tracker/render.js`, `src/tracker/wire.js`,
      `src/pages/shops/rendering.js`, `src/components/{footer,breadcrumbs,spotBar,nav}.js`,
      `src/components/ticker.js`. One file per PR; each migration tightens the `check-unsafe-dom.js`
      baseline. Start with `src/pages/shops/rendering.js` (largest externally-sourced data).
- [ ] **#9 — Static-tier header parity.** Diff `_headers` and `.htaccess` against the Helmet header
      set. Add `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`,
      `Cross-Origin-Opener-Policy`, HSTS. Deliver `curl -I` before/after. ✅ **2026-04-25:**
      `_headers` now sets HSTS (preload), broader `Permissions-Policy` (`accelerometer`,
      `gyroscope`, `magnetometer`, `usb`, `interest-cohort` added),
      `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Resource-Policy: same-origin`.
      `.htaccess` HSTS upgraded to include `preload`; matching `Permissions-Policy` and
      `Cross-Origin-Resource-Policy` added. CSP intentionally not added to `_headers` — would
      require a parallel regression test (`tests/csp-regression.test.js`) for the static surface;
      leaving for a follow-up.
- [ ] **#10 — Admin router refactor.** `server/routes/admin/index.js` is 602 lines. Only refactor if
      it buys measurable security wins (per-route validator modules + unit tests).
- [x] **#11 — Async fs in `logNotFound`.** Dev-only ring buffer. ✅ **2026-04-28:** `server.js`
      `logNotFound()` now reads/writes via `fs.promises` and serialises concurrent writes through a
      single chained promise; the request handler fires-and-forgets so logging never blocks the
      response. (Also closes Track B #2.)
- [x] **#12 — ReDoS review of `isValidEmail`.** `server/lib/auth.js:96–102` is already linear (no
      backtracking); `server/routes/newsletter.js:173–175` uses anchored regex with bounded char
      classes — safe, document it. ✅ **2026-04-28:** ReDoS-safety comment added inline at
      `server/routes/newsletter.js` `isValidEmail` (anchored, non-overlapping negated classes); the
      `auth.js` variant is already prose-documented as a linear check.
- [x] **#13 — Schema validation for `users.json` at load.** Validate each record (`email` non-empty,
      `role ∈ {admin, editor, viewer}`, `password` bcrypt-shaped `$2[aby]$..`). Reject file on
      schema mismatch rather than trusting disk. ✅ **2026-04-28:** `loadUsers()` in
      `server/lib/auth.js` now drops malformed records via `isValidUserRecord()` and logs the
      offending id. The seeded admin is preserved if the persisted file lost its admin row.
- [x] **#14 — `Permissions-Policy` header.** ✅ **2026-04-28:** Explicit middleware in `server.js`
      now sets
      `Permissions-Policy: accelerometer=(), camera=(), geolocation=(), gyroscope=(),     magnetometer=(), microphone=(), payment=(), usb=(), interest-cohort=()`,
      in parity with `_headers` and `.htaccess`. Covered by a new assertion in
      `tests/csp-regression.test.js`.
- [x] **#15 — Login log timing parity.** ✅ **2026-04-28:** `authenticate()` returns the same
      `'Invalid credentials'` message for unknown user, bad password, and bad email format; bcrypt
      compare dominates timing for the user-found path. Recorded in `tests/auth.test.js`.
- [x] **#16 — Lower `urlencoded` body limit** to `16kb`. ✅ **2026-04-28:** `server.js` now sets
      `express.urlencoded({ extended: true, limit: '16kb' })`; `json` stays at `256kb` because admin
      JSON payloads occasionally exceed the urlencoded ceiling.
- [x] **#17 — `cors` `optionsSuccessStatus: 204`.** ✅ **2026-04-28:** All three CORS branches
      (allowlist, prod-no-allowlist, dev) now pass `optionsSuccessStatus: 204` so preflights return
      204 No Content uniformly.
- [x] **#18 — Log rotation.** Not our concern (stdout). ✅ **2026-04-28:** Closed — `morgan` writes
      to `process.stdout`; rotation is the deploy-platform's job (Vercel/Render/journald), not ours.
- [x] **#19 — Audit `admin/` static directory** for embedded secrets in HTML.
      `grep -R 'sk_\|service_role' admin/`. ✅ **2026-04-28:** Audit clean — only
      `admin/supabase-config.js` exposes the **public anon JWT** (already documented as
      public-by-design in
      [`reports/secret-scan-2026-04-25.md`](../../reports/secret-scan-2026-04-25.md)). No
      service-role / Stripe / AWS / private-key material in `admin/`.
- [x] **#20 — Confirm 404 fallthrough is SEO-correct** (no soft-404s). ✅ Verified in
      `tests/server.test.js`.

### A.3 Authoritative sweeps — status

| Sweep                    | Status                                                  | Notes                                                                                                                                                                                                     |
| ------------------------ | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CodeQL                   | Runs in CI (`.github/workflows/codeql.yml`)             | `parallel_validation` runs CodeQL on this PR.                                                                                                                                                             |
| Semgrep                  | Runs in CI (`.github/workflows/semgrep.yml`)            | Kept as CI gate, no new rules.                                                                                                                                                                            |
| `gitleaks` / secret scan | ✅ **2026-04-25** — `reports/secret-scan-2026-04-25.md` | Full-history scan after `git fetch --unshallow`. 7 hits, all the Supabase **anon** JWT (public-by-design per `supabase/MASTERY.md`). No service-role / Stripe / AWS / `.env` leaks. No rotation required. |
| `eslint-plugin-security` | Follow-up                                               | Audit-only; not added as CI gate.                                                                                                                                                                         |
| CSP regression test      | ✅ `tests/csp-regression.test.js`                       |                                                                                                                                                                                                           |
| Header parity            | Follow-up (needs prod `curl -I`)                        |                                                                                                                                                                                                           |

---

## 3 · Track B — Performance

### B.0 Baselines to capture before any fix (in PR B-1)

1. Lighthouse (desktop + Moto-G4 throttled) for `index.html`, `tracker.html`, `shops.html`,
   `calculator.html`, `countries/uae/index.html`. Capture LCP, CLS, INP, TBT, bytes.
2. `du -a dist/ | sort -n | tail -50`.
3. `vite build --report` for largest chunks.
4. Top-30 images by bytes.
5. `scripts/node/image-audit.js` output.
6. Express cold-start time.

✅ **2026-04-25 partial baseline shipped — `reports/perf-baseline-2026-04-25.md`.** Captured:
top-level HTML count, `src/` JS-per-directory and top-15 file sizes (un-bundled), CSS file sizes,
full image inventory (#4), caching-layer state, and a ranked next-PR list. **#1 Lighthouse and #3
`vite build --report` were not captured in-sandbox** (Node 20 vs. required Node 24); the report
documents the exact commands to run on the developer host.

### B.1 Fixes scoped to Track B

| #   | Change                                                                               | Measurement                         |
| --- | ------------------------------------------------------------------------------------ | ----------------------------------- |
| 1   | Async `fs.stat` in `server.js` static fallback                                       | autocannon p50/p95/p99 on 100 req/s |
| 3   | Split `translations.js` per-locale if > 40 KB                                        | `dist/` byte delta + LCP delta      |
| 4   | Convert remaining non-WebP/AVIF images + confirm lazy-load on all below-fold `<img>` | Image byte delta + LCP delta        |
| 5   | `Cache-Control: public, max-age=31536000, immutable` for hashed assets in `_headers` | Header diff                         |
| 6   | `Cache-Control: no-store` on authenticated admin GETs                                | Header diff                         |

### B.2 Follow-up checklist

- [x] **#2 — Async fs in `logNotFound`.** ✅ **2026-04-28:** Closed in tandem with Track A #11 — see
      `server.js` `logNotFound()` (async `fs.promises` + chained-promise serialisation).
- [ ] **#7 — `linkinator` runtime** in `npm run linkcheck`. Not runtime perf but CI. Reduce
      concurrency or split into nightly.
- [x] **#8 — Service worker (`sw.js`) audit** — ✅ verified by `tests/sw-exclusions.test.js`:
      `/api/*` and `/admin/*` paths are bypassed before the navigate handler.
- [ ] **#9 — Route-split tracker bundle out of homepage.**
- [ ] **#10 — `morgan` sync stdout writes.** Info only.
- [ ] **#11 — `loadUsers()` sync at module load.** Low impact.
- [ ] **#13 — `STATIC_ASSET_RX` already hoisted.** Keep an eye on regressions.
- [ ] **#14 — HTTP/2 server push / 103 Early Hints.** Out of scope (hosting).

---

## 4 · Track C — Dependencies

### C.0 Current state (2026-04-24)

- `npm audit --production` → **0 vulnerabilities**.
- 9 prod deps, 10 dev deps. All direct deps at latest `wanted` per `npm outdated`.
- `node_modules` not committed. `.nvmrc` = 24.

### C.1 Work for PR C-1

- [ ] Run `npx depcheck` + `npx knip`. Triage false positives (scripts/\* tooling).
- [ ] Specifically verify usage of: `bcryptjs`, `cors`, `express`, `express-rate-limit`, `helmet`,
      `jsonwebtoken`, `lowdb`, `morgan`, `uuid`. `lowdb` is the primary suspect.
- [ ] Remove verified-unused packages. No behaviour change.
- [ ] `npm dedupe` + `npm ls --all --json | jq` for `> 1 resolved version`.
- [ ] Cross-check any pinned transitive with `gh-advisory-database`.
- [ ] Python deps: `pip-audit` + `pip list --outdated` on `pyproject.toml`. Flag majors.
- [ ] GitHub Actions pins: verify all pinned to SHA for anything running on `pull_request_target`
      (none currently).
- [ ] Husky + lint-staged: confirm hooks run end-to-end on a dummy commit.
- [x] `terser` — check if still referenced; Vite ships its own minifier. ✅ **2026-04-28:** Still
      required — `vite.config.js` sets `minify: 'terser'` with `terserOptions` (drop_console etc.),
      and Vite only ships `esbuild` minification by default; Terser is opt-in and must be installed
      explicitly when selected. Keep `terser` as a dev dependency.

Deliverable: `reports/deps-audit-2026-04-24.md` with per-package verdict (keep / remove /
flag-major).

**No major version bumps in PR C-1.** Each major, if proposed, gets its own PR.

---

## 5 · What this plan deliberately does **not** do

- No SPA / framework migration.
- No SEO-visible changes (canonical, sitemap, `robots.txt`, schema).
- No major dep bumps as drive-bys.
- No new lint/CI gates beyond the CSP regression test until Track A is green.
- No refactors unrelated to a measured finding.

---

## 6 · Risks / unknowns

- **`_headers` / `.htaccess` parity** needs a live prod header dump to be precise. Flagged as
  follow-up.
- **Translations split per-locale** may conflict with an in-flight UX revamp; reconcile with
  `docs/REVAMP_PLAN.md` §22b before PR B-2.
- **`innerHTML` migrations** will show up as diffs in the DOM-safety baseline; CI requires that
  baseline update in the same commit.

---

## 7 · 2026-04-25 follow-up landings

This commit closes three deliverables from the open follow-up checklists without re-opening any
shipped finding.

### 7.1 Secret scan — full history (Track A.A.2 #19, A.A.3 row)

- Tool: `gitleaks` v8.21.2 default ruleset, run after `git fetch --unshallow` (1487 commits).
- Findings: 7 hits, **all** Supabase `role: anon` JWT for project `nebdpxjazlnsrfmlpgeq`. The anon
  key is public-by-design per `supabase/MASTERY.md` and the existing `client-server boundary` guard
  (`server/lib/supabase-client.js` + ESLint `no-restricted-imports`) is what protects the
  service-role key.
- Negative checks: `git log -S` for `service_role`, `sk_live_`, `sk_test_`, `AKIA`, and any `.env*`
  file added — no real secrets in history.
- **Verdict: no rotation required.** Recommendations (advisory CI gitleaks, pre-commit hook,
  rotation playbook for the future) recorded in `reports/secret-scan-2026-04-25.md`.

### 7.2 Static-tier header parity (Track A.A.2 #9 / #14)

- `_headers`: added `Strict-Transport-Security` (with `preload`),
  `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Resource-Policy: same-origin`. Broadened
  `Permissions-Policy` to cover `accelerometer`, `gyroscope`, `magnetometer`, `usb`,
  `interest-cohort` in addition to the existing `camera`, `microphone`, `geolocation`, `payment`.
  Comment block notes that CSP is intentionally not added here.
- `.htaccess`: HSTS upgraded to include `preload`. `Permissions-Policy` broadened to match
  `_headers`. Added `Cross-Origin-Resource-Policy: same-origin` (COOP was already present).
- **What deliberately did not change:** CSP. Adding a static-host CSP would either need to duplicate
  the Helmet directive set (and break some third-party scripts that the dynamic host allow-lists
  more loosely) or need a parallel regression test mirroring `tests/csp-regression.test.js`.
  Captured as a residual follow-up.
- **Validation:** static config files; no JS / build behaviour changes. `npm run build` runs the
  same set of files through Vite and was used to confirm no regression in the dist tree on the
  developer host (sandbox Node mismatch documented in §7.3).

### 7.3 Performance baseline (Track B.B.0)

- Delivered: `reports/perf-baseline-2026-04-25.md`. Captures source-tree inventory (HTML count,
  `src/` JS-per-directory, top-15 file sizes), CSS sizes, full image inventory, caching-layer state,
  and a ranked next-PR list (screenshot WebP, `sw.js` `/api/`-`/admin/` exclusion, tracker
  route-split, `shops.js` audit, Lighthouse capture).
- **Sandbox limitation:** `vite.config.js` imports `globSync` from `node:fs` (Node ≥ 22); sandbox
  runs Node 20. `vite build --report` and Lighthouse must be run on the developer host. The baseline
  file documents the exact commands.
- **Headline findings already actionable:**
  - `assets/screenshots/*.png` (~4.4 MB) is **README-only**, not page-load critical. WebP conversion
    is a free clone-weight win.
  - `src/config/translations.js` = 26 KB → **per-locale split (plan B-2 #3) is not yet justified**
    (threshold 40 KB).
  - `src/pages/shops.js` (62 KB un-bundled) is the largest single entry-point payload — first target
    for the "reduce bundle size" track.
  - `sw.js` `networkFirstWithFallback` caches `/admin/` HTML if a user navigates there. Plan B #8
    fix is straightforward and should be its own small PR with a node:test.
