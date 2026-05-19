# Tracker Rebrand Spec — Gold Command Center (EN/AR)

## Product intent

Reposition `tracker.html` as the flagship **Gold Command Center**: one high-trust workspace for live
references, freshness context, compare mode, alerts, and exports.

## UX goals

1. Make the tracker visually and semantically the primary destination.
2. Strengthen trust-forward status language for live/cached/delayed/fallback states.
3. Keep controls mobile-safe with sticky behavior that does not hide key content.
4. Preserve transparent methodology access and spot-vs-retail clarity.
5. Preserve EN/AR parity and RTL behavior.

## Information hierarchy

1. **Hero identity**
   - Kicker: command-center framing
   - Main title: command-center naming
   - Subtitle: spot-linked live reference scope
2. **Status chips**
   - Primary live stream chip
   - Source-state chip (live/cached/delayed/fallback)
   - XAU/USD chip
   - Market-open chip
3. **Workspace controls**
   - Language/currency/karat/unit selectors
   - Refresh/jump/share/reset actions
   - Sticky mode shell and sticky control strip on mobile

## Component/state model

- **Freshness model source**: `src/lib/live-status.js` (`live`, `cached`, `stale`, `unavailable`)
- **Display intent mapping**:
  - `live` → Live
  - `cached` → Cached
  - `stale` → Delayed
  - `unavailable` → Fallback
- **Rendering touchpoints**:
  - Hero badge row (`#tp-live-badge`, `#tp-refresh-badge`, `#tp-source-state-badge`)
  - Sidebar summary and market cards via shared freshness helper
  - Mobile summary chips in tracker live mode

## EN/AR copy direction

- English positioning: “Gold Command Center”, “Command center desk”, “Delayed”, “Fallback”.
- Arabic positioning: “مركز قيادة الذهب”, “لوحة مركز القيادة”, “متأخر”, “نسخة احتياطية”.
- Maintain methodology-first trust language (reference estimate, not retail quote).

## Design-system and layout constraints

- Use existing `styles/global.css` token system only.
- Preserve dark/gold premium visual identity.
- Keep touch targets ≥44px.
- Keep sticky control offsets aligned to nav + spot bar + safe-area inset.

## Error/loading/empty-state direction

- Connecting: explicit “Connecting…” state.
- Live failure: explicit fallback messaging (“showing last cached price”).
- Data unavailable: keep source state visible rather than hiding chips.

## Safety checks for this rebrand

- Freshness and source labels remain visible.
- Methodology links remain visible in hero/sidebar.
- No hard-coded one-language JS copy additions.
- RTL remains functional for badge row, hero hierarchy, and sticky strips.
