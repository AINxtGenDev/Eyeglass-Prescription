# Phase 3: 3D Lenses & Frame - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-11-08
**Phase:** 03-3d-lenses-frame
**Areas discussed:** none selected. The user delegated all of them with a priority statement.

---

## Gray area selection

| Option | Description | Selected |
|--------|-------------|----------|
| Phone placement of 3D | Inline above the result cards, a bar mini preview, or both; default visible or tap-to-open | |
| Scene & default camera | Lenses/frame only or a head hint; front or 3/4 default; eye chart; frame colour | |
| Heatmap presentation | On the 3D lens, a flat top-down map, or both; iso-line spacing; callouts | |
| A/B compare in 3D | Side by side, a toggle in one scene, or a ghost overlay | |

**User's choice (free text):** "use best practice and focus is photorealistic 3D and as correct as possible result"
**Notes:** Decided by Claude under the priority order correctness → photorealism, bounded by lay usability and phone performance (memory `best-practice-default`).

## Claude's Discretion

All four areas:

- **Phone:** inline view plus a still thumbnail in the bar from one renderer.
- **Scene:** a PBR studio look with RoomEnvironment IBL, an acetate frame and no head; 3/4 default camera; presets.
- **Heatmap:** painted on the 3D lens, cividis/viridis, iso-lines, HTML callouts, a shared scale.
- **A/B:** scissor viewports with a synced camera on wide screens; the existing toggle on phones.

## Deferred Ideas

- Frame colour picker
- Head model
- Lens tints and coatings
- m6 thick-result note (re-check)
