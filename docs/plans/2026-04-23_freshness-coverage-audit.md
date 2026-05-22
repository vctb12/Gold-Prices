# Plan — Site-wide stale/freshness coverage audit

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

**Date:** 2026-04-23 **Status:** 📥 Proposal (plan-only, awaiting owner approval) **Audit ref:**
[`docs/REPO_AUDIT.md` §J-P0-3](../REPO_AUDIT.md) **Campaign ref:** PR #4 of the charter-respecting
multi-PR campaign (plan-first per [`AGENTS.md` §4.3](../../AGENTS.md)) **Depends on:** nothing.
Independent of P0 #1 and P0 #2.

> This is a **plan file**. It proposes no code changes. Approval unblocks a separate implementation
> PR that adds **one read-only analysis script** and commits **one report-only artefact**. No page
> rendering is modified; no user-visible freshness label changes.

---

## 1. Problem statement

Charter §6.1–§6.3 is the trust perimeter of the site:

- §6.1 — spot/reference prices must never be blurred with retail or jewelry prices.
- §6.2 — cached / fallback / estimated / delayed / derived values must be **visibly labelled** with
  source and timestamp.
- §6.3 — freshness labels, disclaimers, methodology notes are product elements, not decoration.

The repo already ships the machinery for this:

- `src/lib/live-status.js` exports `getMarketStatus()`, `getAgeMs()`, `formatRelativeAge()`, and
  `getLiveFreshness({ lastUpdatedAt, hasLiveFailure, staleAfterMs, lang })` with a 10-min stale
  threshold (`GOLD_MARKET.STALE_AFTER_MS`). The freshness return value resolves to one of three
  keys: **`live` / `cached` / `stale`**.
- `src/lib/api.js` already implements primary → secondary → cached fallback with `source` and
  `updatedAt` metadata (confirmed in audit §B).

What is **not** verified anywhere is **coverage**: which price-rendering pages actually consume
`getLiveFreshness()` and render all three states correctly. The `stale` branch in particular is the
one that matters most for §6.2 trust, and it is the one most likely to be accidentally dropped in a
refactor because it rarely fires in development.

Today there is no test, no validate hook, and no committed artefact that answers the question:
"Which pages render prices, and for each page, does it emit the stale state?"

---

## 2. Goal

Ship one new analysis script, `scripts/node/audit-freshness-coverage.js`, that:

1. Identifies every repo surface that renders a gold price (by static pattern match).
2. For each such surface, records whether it imports/calls `getLiveFreshness`, `getMarketStatus`,
   `formatRelativeAge`, or touches the live-status module at all.
3. For the ones that do, records whether the `stale` / `cached` / `live` branches are each textually
   present.
4. Emits a deterministic report at `reports/freshness-coverage.md` (and a JSON sibling) that
   enumerates gaps as a checklist, not fixes.

The output is **advisory only**: no page is modified, no test becomes a merge gate. The gaps it
surfaces seed a **future plan PR** if any are real.

---

## 3. Scope — what counts as a "price-rendering surface"

The script's detection rules (documented in the implementation PR):

- **JS/TS modules under `src/`** that match any of:
  - import from `src/lib/live-status.js` or `src/lib/api.js`
  - reference `GOLD_MARKET`, `getLiveFreshness`, `getMarketStatus`, `formatRelativeAge`, `getAgeMs`
  - string-interpolate a price unit (e.g. `/g`, `/gram`, `USD`, `SAR`, `AED`, `EGP`, `per ounce`)
    next to a variable that looks numeric
- **HTML entry pages under `/`, `/content/`, `/countries/`, `/shops/`** whose inline
  `<script type="module">` blocks match the same heuristics, OR which contain price-shaped strings
  (`data-price`, `class="price"`, `id="gold-price*"`, etc.)
- **Page-hydrator modules** (`src/pages/*.js`) — these are the most likely sites where the stale
  branch would be accidentally omitted.

Heuristics are intentionally permissive: false positives (pages flagged that don't actually render
prices) are cheap to review; false negatives (missed rendering surfaces) are the risk. The
implementation PR's unit tests lock down the detection rules on a fixture set.

---

## 4. Scope — what the report records per surface

| Field                   | Source                                                                                          |
| ----------------------- | ----------------------------------------------------------------------------------------------- |
| `path`                  | repo-relative path                                                                              |
| `kind`                  | `html-entry` \| `page-module` \| `component` \| `lib-consumer`                                  |
| `importsLiveStatus`     | boolean — imports anything from `src/lib/live-status.js`                                        |
| `importsApi`            | boolean — imports from `src/lib/api.js`                                                         |
| `usesGetLiveFreshness`  | boolean                                                                                         |
| `usesFormatRelativeAge` | boolean                                                                                         |
| `freshnessKeysMatched`  | array of `'live' \| 'cached' \| 'stale'` found as string literals                               |
| `hasSourceLabel`        | boolean — heuristic: text near the price mentions "source" or a data-source attribute           |
| `hasTimestampLabel`     | boolean — heuristic: text near the price mentions "updated", "ago", or uses `formatRelativeAge` |
| `notes`                 | free-text — auto-generated flags like "stale branch missing" or "no freshness import"           |

### Top-level summary

- total surfaces detected
- count with full freshness coverage (all three keys present)
- count with missing `stale` branch only
- count with no live-status usage at all (these are §6.2 suspects if they actually render prices)
- count flagged as false-positive-likely (present in a doc or test fixture)

---

## 5. Non-scope

- No modifications to any price-rendering page.
- No runtime / DOM / Playwright crawling. Static analysis only.
- No attempt to detect §6.1 violations (spot-vs-retail mixing) — that is a meaningfully harder
  problem and belongs to its own audit plan if the owner wants one.
- No lint rule. This script emits a report; it does not fail `npm run lint` or `npm run validate`.
- No change to `src/lib/live-status.js` or `src/lib/api.js`.

---

## 6. Proposed implementation (for the follow-up PR)

- **AST parsing** for JS/TS under `src/` using `@babel/parser` or `acorn` — whichever is already a
  transitive dep of the repo. If neither is present, the implementation PR falls back to scoped grep
  patterns and makes that trade-off explicit. `gh-advisory-database` is consulted before any new
  dependency is added.
- **HTML parsing** reuses whatever the P0 #2 inventory script chose (cheerio vs regex) — for
  consistency.
- **Output file:**
  - `reports/freshness-coverage.md` — human-readable, checklist-ordered.
  - `reports/freshness-coverage.json` — machine-readable sibling, sorted.
  - Both committed. Both deterministic (sorted, pinned key order, UTC ISO timestamp).
- **Execution surfaces:**
  1. `node scripts/node/audit-freshness-coverage.js` — regenerates both files.
  2. `node scripts/node/audit-freshness-coverage.js --check` — exits non-zero if committed files
     diverge from fresh output. Mirrors the `enrich-placeholder-pages.js --check` pattern.
  3. **Not** wired into `npm run validate` initially. The script is advisory; auto-running it on
     every PR would add noise (timestamp churn). A follow-up plan can add the `--check` hook once
     the artefact has stabilized.
- **Unit tests under `tests/`:**
  - Fixture directory with ~6 small HTML/JS stubs exercising every detection branch.
  - Tests assert: known-bad fixture is flagged; known-good fixture is clean; summary counts match
    expectation.

---

## 7. Risks and mitigations

| Risk                                           | Mitigation                                                                                                                 |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| False positives overwhelm the signal           | Explicit "false-positive-likely" bucket in the summary. Fixture tests keep the heuristics honest.                          |
| Script becomes a de-facto gate that blocks PRs | Explicit README in `reports/` stating: this file is descriptive, not prescriptive. No `validate` wire-up in v1.            |
| Gaps found turn into a huge follow-up          | That's the point of surfacing them. Each gap becomes an individual plan PR, not a drive-by fix. §6.4-analogous discipline. |
| Timestamp in output churns every run           | Same mitigation as P0 #2: either floor to `YYYY-MM-DD` or accept single-line churn.                                        |
| Static analysis misses runtime-composed DOM    | Acknowledge explicitly in the report header. Playwright-level coverage is a separate, larger plan (deferred).              |

---

## 8. Charter-compliance checklist

| Clause                                    | How honored                                                                                                                             |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| §6.1 spot/retail blur                     | Not directly addressed (see §5 non-scope). Explicitly called out as a separate future plan.                                             |
| §6.2 labelled stale / cached / derived    | The whole point. Coverage gaps surface silently-unlabelled branches.                                                                    |
| §6.3 freshness labels as product elements | Report's `hasSourceLabel` / `hasTimestampLabel` fields flag surfaces where the labels might be missing.                                 |
| §6.4 SEO surface integrity                | No SEO surface touched.                                                                                                                 |
| §6.5 static architecture stays static     | Node-only script, no framework.                                                                                                         |
| §6.6 EN/AR parity                         | Script runs on EN and AR surfaces alike; report rows are language-agnostic.                                                             |
| §6.7 DOM-safety baseline                  | No browser code; baseline unaffected.                                                                                                   |
| §6.8 no secrets in git                    | JSON/markdown output is paths + booleans. No secrets.                                                                                   |
| §6.9 PR-only, no force-push               | Single focused implementation PR after approval.                                                                                        |
| §6.10 `post_gold.yml` untouched           | N/A.                                                                                                                                    |
| §6.11 honest verification                 | Report explicitly states it is static-analysis-only; no claim of runtime / DOM coverage. Each row is auditable from the committed JSON. |

---

## 9. Success criteria (for the implementation PR)

- `scripts/node/audit-freshness-coverage.js` exists, runs in <3 s on the full repo, exits 0.
- `reports/freshness-coverage.md` and `reports/freshness-coverage.json` are committed and enumerate
  every detected surface with the fields in §4.
- The report header explicitly states: (a) static analysis only, (b) heuristic detection, (c)
  advisory not prescriptive, (d) §6.1 (spot/retail mixing) is **not** audited here.
- Unit tests cover detection of: import patterns, three freshness keys, false-positive filtering,
  EN/AR parity.
- `node scripts/node/audit-freshness-coverage.js --check` succeeds after regeneration.
- `npm run lint`, `npm run quality`, `npm test` pass. `npm run validate` unchanged (no new wire-up
  in v1).

---

## 10. Rollback

Single-commit revert. The report and script are additive; no production code depends on them.

---

## 11. Open questions for the owner

1. **Wire `--check` into `npm run validate` in v1**, or defer until the artefact has stabilized over
   at least one release? Default recommendation: defer.
2. **Report format**: markdown + JSON (recommended), JSON-only, or markdown-only?
3. **Should the same plan also cover §6.1 (spot-vs-retail)?** Default recommendation: **no**, keep
   this one tight; handle §6.1 in a separate proposal because detecting retail-markup blur requires
   semantic analysis of currency + context, not static grep.
4. **Acceptance threshold**: do gaps found here auto-qualify for a P0 follow-up plan, or does the
   owner review and prioritize case-by-case? Default recommendation: case-by-case, because §5
   non-scope means some "gaps" may be intentional (e.g. marketing pages that show a headline price
   pulled from a static poster, explicitly labelled as such).
