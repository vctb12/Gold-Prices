# Plan — Read-only SEO-surface inventory

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
[`docs/REPO_AUDIT.md` §J-P0-2](../REPO_AUDIT.md) **Campaign ref:** PR #3 of the charter-respecting
multi-PR campaign (plan-first per [`AGENTS.md` §4.3](../../AGENTS.md)) **Depends on:** nothing.
Independent of the P0 #1 `CNAME` / canonical-origin decision — this inventory script is
origin-agnostic and will simply record whichever origin is canonical at the moment it runs.

> This is a **plan file**. It proposes no code changes. Approval unblocks a separate implementation
> PR that adds one script, one generated artefact, and one optional `validate` hook.

---

## 1. Problem statement

SEO-surface edits are charter-sensitive (§6.4 — "Don't silently change canonical URLs, `robots.txt`,
sitemap structure, `og:*` / `twitter:*` tags, or `CNAME`. Schema changes need a migration note.").
Today there is no single artefact that captures the current state of those surfaces across ~689 HTML
files, which means:

- Any drift is only detectable by running ad-hoc greps against the tree.
- Future SEO change PRs have no easy before/after diff to review.
- The audit in [`docs/REPO_AUDIT.md` §D](../REPO_AUDIT.md) had to enumerate findings by hand.

The existing `scripts/node/check-seo-meta.js` is a **gate** (pass/fail for canonical + hreflang
presence + noindex on internal). It is not an inventory — it does not emit the values, only whether
they exist.

A read-only inventory closes that gap without changing any SEO surface: it reads what's already
there and writes it to a committed JSON artefact so future SEO PRs carry a visible diff of what
changed.

---

## 2. Goal

Ship one new Node script, `scripts/node/inventory-seo.js`, that walks every non-internal HTML file
and emits a deterministic JSON report at `reports/seo/inventory.json`. The generated file is
committed so that every SEO-affecting PR shows a reviewable diff automatically.

The script is **read-only** with respect to HTML: it parses and records, never rewrites.

---

## 3. Scope — what the inventory records

One record per HTML file, keyed by the file's repo-relative path, sorted for deterministic output.
Each record captures:

| Field               | Source                                                                                   |
| ------------------- | ---------------------------------------------------------------------------------------- |
| `path`              | repo-relative path of the HTML file                                                      |
| `lang`              | `<html lang="…">` attribute                                                              |
| `dir`               | `<html dir="…">` attribute                                                               |
| `title`             | `<title>` text (whitespace-normalized)                                                   |
| `metaDescription`   | `<meta name="description" content="…">`                                                  |
| `canonical`         | `<link rel="canonical" href="…">`                                                        |
| `robots`            | `<meta name="robots" content="…">`                                                       |
| `ogTitle`           | `<meta property="og:title" …>`                                                           |
| `ogDescription`     | `<meta property="og:description" …>`                                                     |
| `ogImage`           | `<meta property="og:image" …>`                                                           |
| `ogUrl`             | `<meta property="og:url" …>`                                                             |
| `ogType`            | `<meta property="og:type" …>`                                                            |
| `twitterCard`       | `<meta name="twitter:card" …>`                                                           |
| `twitterImage`      | `<meta name="twitter:image" …>`                                                          |
| `hreflang`          | array of `{ lang, href }` from every `<link rel="alternate" hreflang="…">`               |
| `jsonLdTypes`       | array of `@type` values extracted from every `<script type="application/ld+json">` block |
| `hasStructuredData` | boolean (convenience)                                                                    |

Values are stored as-is (no URL normalization, no case-folding); the inventory records truth, not an
interpretation of it. Missing values are `null` (never `""`), so diffs of missing→present are clear.

**Top-level summary block** also written, with counts only — not derived judgements:

- `totalHtmlFiles`
- `withCanonical`, `withoutCanonical`
- `withOgImage`, `withoutOgImage`
- `withJsonLd`, `withoutJsonLd`
- `hreflangPairs` (count of `{en↔ar}` pair completeness)
- `generatedAt` (UTC ISO string, committed as-is — diffs show a single changed line per run)

---

## 4. Non-scope

- No opinions, no scoring, no "this is bad" flags — that's the job of a future plan PR if gaps are
  found.
- No JSON-LD validation beyond extracting `@type` (schema.org correctness is a separate concern;
  this is inventory, not lint).
- No crawling, no network calls, no third-party API checks. Purely local AST-level parsing.
- No rewrites of HTML. The script opens files with `fs.readFile` only.
- No changes to existing `scripts/node/check-seo-meta.js` (the gate). The inventory runs alongside
  it, not instead.

---

## 5. Proposed implementation (for the follow-up PR)

- **Parser:** reuse `cheerio` if already available, otherwise a small hand-rolled regex pass. Before
  adding `cheerio` as a new dep, check the existing `package.json` — multiple `scripts/ node/*`
  already parse HTML, so the house style for HTML parsing is what the implementation PR must follow
  (not a drive-by new dep). `gh-advisory-database` is consulted if any new dep is introduced.
- **Inputs:** same walk filter as `scripts/node/check-seo-meta.js` — skip `INTERNAL_PREFIXES`, skip
  `node_modules/`, `dist/`, `playwright-report/`, `test-results/`, `content/embed/`, and the
  `EXEMPT_FILES` (404.html, offline.html).
- **Output:** `reports/seo/inventory.json` (committed). Pretty-printed with 2-space indent and
  trailing newline for diff stability.
- **Determinism:** sort records by `path`, sort `hreflang` by `lang`, sort `jsonLdTypes`
  alphabetically. Freeze the summary block key order.
- **Execution surfaces:**
  1. Standalone: `node scripts/node/inventory-seo.js` — writes the file.
  2. Check mode: `node scripts/node/inventory-seo.js --check` — exits non-zero if the committed file
     differs from fresh output. Mirrors the pattern of `enrich-placeholder-pages.js --check` and
     `externalize-analytics.js --check`.
  3. Optional: wire `--check` into `npm run validate` (appended, matching existing order). The owner
     can defer this if they'd rather keep the artefact regenerated manually for the first release
     cycle.

---

## 6. Risks and mitigations

| Risk                                          | Mitigation                                                                                                                           |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Generated file size bloats the repo           | One JSON file, ~689 records × ~15 fields. Estimate < 500 KB; pretty-printed so `git` delta-compresses well.                          |
| `validate` gets slow                          | Walking 689 files with cheerio is <1s in practice; wiring into `validate` is optional in the follow-up PR.                           |
| Timestamp in output causes churn on every run | Only one line (`generatedAt`). If this turns out to be annoying, a v1.1 follow-up can drop it or floor it to the nearest day.        |
| Script becomes a de-facto SEO gate            | Explicit README in `reports/seo/` stating: this file is descriptive, not prescriptive. Gates live in `check-seo-meta.js`.            |
| Hand-rolled regex parsing misses edge cases   | Implementation PR must include unit tests covering: multi-line tags, attribute-order variance, JSON-LD arrays-of-@type, `dir="rtl"`. |

---

## 7. Charter-compliance checklist

| Clause                                | How honored                                                                                                                                            |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| §6.1–§6.3 price-data invariants       | N/A. Script does not touch price rendering.                                                                                                            |
| §6.4 SEO surface integrity            | The whole point: inventory makes SEO surfaces reviewable. No values are rewritten; nothing is silently changed.                                        |
| §6.5 static architecture stays static | New file added under `scripts/node/` and `reports/seo/`. No framework, no runtime dependency injection, no SPA shift.                                  |
| §6.6 EN/AR parity                     | Inventory records both languages' files side-by-side; makes parity regressions visible in the hreflang pair count. Neutral on any specific EN/AR edit. |
| §6.7 DOM-safety baseline              | No browser code touched; Node-only. `check-unsafe-dom.js` baseline unaffected.                                                                         |
| §6.8 no secrets in git                | JSON output contains canonicals / titles / meta — all public. No secrets.                                                                              |
| §6.9 PR-only, no force-push           | Single focused implementation PR after approval.                                                                                                       |
| §6.10 `post_gold.yml` untouched       | N/A.                                                                                                                                                   |
| §6.11 honest verification             | Script output is the verification. `--check` mode keeps the committed artefact honest.                                                                 |

---

## 8. Success criteria (for the implementation PR)

- `scripts/node/inventory-seo.js` exists, runs in <2 s wall-clock on the full repo, exits 0.
- `reports/seo/inventory.json` is committed with a record for every non-internal HTML file and
  `null` (never undefined / missing keys) for every absent field.
- `reports/seo/README.md` exists and states the artefact is read-only and descriptive.
- `node scripts/node/inventory-seo.js --check` exits 0 immediately after regeneration, exits 1 if
  the file is tampered with.
- New unit tests under `tests/` cover at least: multi-line meta tags, JSON-LD array `@type`,
  `dir="rtl"` preservation, missing-field → `null` behavior.
- `npm run lint`, `npm run quality`, and `npm test` pass.
- `npm run validate` passes with or without the optional `--check` hook.

---

## 9. Rollback

Single-commit revert. The artefact is additive; no production code depends on it.

---

## 10. Open questions for the owner

1. **Wire `--check` into `npm run validate` in the first PR**, or defer until the artefact has been
   observed through at least one real-world SEO PR diff?
2. **JSON pretty-print vs minified**: recommendation is pretty-print for reviewability, at the cost
   of larger disk. Confirm.
3. **Timestamp behavior**: keep `generatedAt` as UTC ISO string, or floor to `YYYY-MM-DD` to reduce
   diff churn?
4. **Dependency**: if `cheerio` is not already a devDependency, is the owner OK adding it (and
   passing `gh-advisory-database`)? Alternative is a regex-only parser, which is more brittle but
   dep-free.
