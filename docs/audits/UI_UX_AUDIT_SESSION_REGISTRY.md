# UI/UX Audit — Session & PR Registry

> Update this file at the **start** and **end** of every session. One row per branch/PR.
> Master program: [`docs/plans/2026-06-01_ui-ux-audit-remediation-program.md`](../plans/2026-06-01_ui-ux-audit-remediation-program.md)

| Session | Phase | Branch | PR | Status | Merged | Notes |
| :-----: | ----- | ------ | -- | ------ | ------ | ----- |
| 0 | Planning | `cursor/ui-ux-audit-session-program-8c0a` | [#387](https://github.com/vctb12/GoldTickerLive/pull/387) | 🟡 open | — | Docs + prompts only |
| 1 | First paint | `cursor/ui-ux-phase1-first-paint-8c0a` | — | ⬜ queued | — | **Start here** after Session 0 merges |
| 2 | Empty pages | `cursor/ui-ux-phase2-empty-pages-8c0a` | — | ⬜ queued | — | Learn static body; invest decision; shops; 404 |
| 3 | Consistency | `cursor/ui-ux-phase3-consistency-8c0a` | — | ⬜ queued | — | May split 3a/3b |
| 4 | Nav & layout | `cursor/ui-ux-phase4-nav-layout-8c0a` | — | ⬜ queued | — | May split 4a/4b/4c |
| 5 | Performance | `cursor/ui-ux-phase5-performance-8c0a` | — | ⬜ queued | — | Defer if SPA migration |

**Status legend:** ⬜ queued · 🟡 open · 🟢 merged · 🔴 blocked · ⏭ skipped

## How to start a session

1. `git checkout main && git pull origin main`
2. `git checkout -b cursor/ui-ux-phase<N>-<slug>-8c0a` (use row above)
3. Paste prompt from [`docs/plans/2026-06-01_ui-ux-audit-session-prompts.md`](../plans/2026-06-01_ui-ux-audit-session-prompts.md) **or** `@.github/prompts/ui-ux-audit-phase<N>-*.prompt.md`
4. On PR open: set Status → 🟡, fill PR URL
5. On merge: Status → 🟢, Merged date, tick checklist in program doc + `PLAN.md`

## Open PR check (before creating a session PR)

```bash
gh pr list --search "ui-ux phase" --state open
```

Do not open a duplicate PR for the same phase/files.
