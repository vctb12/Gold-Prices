---
mode: agent
description: Audit and improve mobile UX across Gold Ticker Live's flagship surfaces — homepage, tracker, calculator, shops, methodology, country pages. EN + AR.
related_skills:
  - mobile-ux-review
  - frontend-design-system
related_instructions:
  - .github/instructions/frontend-mobile.instructions.md
  - .github/instructions/accessibility.instructions.md
---

# Prompt: Mobile UX Audit

You are auditing and improving Gold Ticker Live's mobile experience. The product identity is a
**premium dark/gold financial dashboard** — not a generic content site. Mobile-first, EN + AR,
accessible, fast.

## Goal

Make the listed surfaces feel like a serious gold-intelligence workspace at 360/390/430 px. EN
and AR parity. No pricing-truth regressions.

## Scope

Default: homepage (`index.html`), tracker (`tracker.html`), calculator (`calculator.html`),
shops (`shops.html`), methodology (`methodology.html`), country index, and top country pages.
Adjust based on user's specific ask.

## Required inspection

1. Read [`mobile-ux-review/SKILL.md`](../skills/mobile-ux-review/SKILL.md) and its checklists.
2. Read `styles/global.css` for current tokens.
3. Open each page in the scope. Note current issues at 360 / 390 / 430 / 768.
4. Open the AR variant of each. Note RTL issues.
5. Check the `check-unsafe-dom` baseline before editing.

## Permission

This is a Level 4 task (cross-system upgrade). Make substantial coherent improvements. Allowed:

- Consolidate card / button / panel variants into tokens
- Rebuild mobile nav drawer (with `<details>` or equivalent)
- Restructure tracker control bar
- Tighten typography scale via existing `--text-*` tokens
- Replace placeholder copy with real copy (where the user-visible meaning is clear)

Not allowed without owner approval:

- Change pricing formulas or AED peg
- Remove freshness labels or methodology links
- Migrate to a framework (Vue / React / Svelte / Next)
- Add new runtime npm dependency
- Change canonical domain or sitemap structure

## Implementation expectations

- Coherent commits per surface, not mechanical splits
- Tokens before surfaces; surfaces before pages
- EN + AR ship together
- Lighthouse mobile not regressed (capture before / after for changed pages)
- Screenshots at 360 px EN + 360 px AR for every changed surface

## Verification

```bash
rm -rf playwright-report test-results
npm run lint
npm test
npm run validate
npm run build
# Manual: open dist/ in a browser, toggle device emulation, EN + AR, viewports above
```

## Return format

See [`.github/skills/mobile-ux-review/SKILL.md`](../skills/mobile-ux-review/SKILL.md#final-report-template).

Don't stop at cosmetic changes if a deeper issue is the real problem. Flag and (where in scope)
address it.
