# `docs/archive/` — historical plan captures

Frozen copies of **landed** proposal files from `docs/plans/`. Active routing stays in:

- [`docs/plans/ARCHIVE_AND_SUPERSESSION_INDEX.md`](../plans/ARCHIVE_AND_SUPERSESSION_INDEX.md)
- [`docs/plans/README.md`](../plans/README.md)

## Policy

| Session | What moves here |
| ------- | ----------------- |
| **C1a** | Nothing — index + README status updates only |
| **C3b** | Completed plans listed as archive candidates in the supersession index |

After a C3b move:

1. Copy file to `docs/archive/YYYY-MM/<original-name>.md`.
2. Replace `docs/plans/<file>` with a one-line stub pointing to the archive path **or** remove and fix all inbound links (prefer stub if links are widespread).
3. Update the status row in `docs/plans/README.md`.

## Folders

| Folder | Contents |
| ------ | -------- |
| `2026-05/` | Reserved for landed 2026-05-29 / 05-30 cleanup and visual session plans (C3b) |
| `2026-06/` | Reserved for landed UI/UX audit session prompts (C3b) |

Do not archive Tier 2 reference docs (`docs/ARCHITECTURE.md`, etc.) without owner approval.
