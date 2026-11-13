# Phase 4: Refraction View & Offline - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-11-13
**Phase:** 4-Refraction View & Offline
**Areas discussed:** Durchblick viewpoint, Durchblick placement and both eyes, phone degradation, offline update behaviour, phase-3 carry-overs

No AskUserQuestion was used. The user's standing instruction (memory `best-practice-default`, 2026-11-08) is to take the recommendation and report it. In phases 2 and 3 the user was offered gray areas and selected none. All choices below are Claude's, reported to the user at the end of the session for veto.

---

## Durchblick viewpoint

| Option | Description | Selected |
|--------|-------------|----------|
| Wearer's view | Fixed eye point behind the lens, distant chart; shows true spectacle magnification, small for weak prescriptions | ✓ |
| Observer's view | Camera in front, chart behind a lens held away from it; dramatic, but depends on two arbitrary distances | |
| Both, switchable | Two modes | |

**User's choice:** not asked; Claude chose the wearer's view.
**Notes:** Correctness was the user's first priority in phase 3. Small effects are made readable by the undistorted surround, a "Mit Glas | Ohne Glas" control and percentages as text, not by exaggeration.

---

## Placement and both eyes

| Option | Description | Selected |
|--------|-------------|----------|
| Third mode in the existing switch, both lenses | "Glas | Durchblick" in Simple view, plus Dickenkarte in Expert; both lenses, wearer's orientation | ✓ |
| Separate page section with its own canvas | Second WebGL context or 2D canvas below the results | |
| One eye with a picker | Simpler, but the user asked for both lenses in the Dickenkarte (dev-1.7) | |

**User's choice:** not asked; Claude chose the third mode with both lenses.
**Notes:** The wearer's view mirrors left and right against the other two modes; labelled, and covered by a golden test for the cylinder axis.

---

## Phone degradation (REF-02)

| Option | Description | Selected |
|--------|-------------|----------|
| Automatic step-down with a visible note | Budget 200 ms, two misses in a row → coarser grid plus note | ✓ |
| Fixed low resolution on phones | Simple, but degrades phones that do not need it | |
| Manual quality setting | A control lay users should not need | |

**User's choice:** not asked; Claude chose the automatic step-down.

---

## Offline update behaviour (OFF-01)

| Option | Description | Selected |
|--------|-------------|----------|
| Prompt, keep typed inputs across the reload | Banner "Aktualisieren / Später"; one-shot sessionStorage hand-off on click | ✓ |
| Prompt, inputs reset, stated in the prompt | Simplest; loses a typed prescription | fallback |
| autoUpdate | Swaps the engine mid-session; ruled out by OFF-01 | |

**User's choice:** not asked; Claude chose the prompt with the hand-off, with the reset variant as the documented fallback.

---

## Phase-3 carry-overs

| Option | Description | Selected |
|--------|-------------|----------|
| Fold into phase 4 as one housekeeping plan | Items listed in session.md and deferred-items.md | ✓ |
| Leave in the backlog | | |

**User's choice:** not asked; session.md already says "Carry into phase 4".

---

## Claude's Discretion

Grid resolution and drawing technique, chart field of view, worker placement, German wording, banner design, icon, test tolerances, A/B reduction, narrow-stage fallback.

## Deferred Ideas

Observer view with a face model; blur and colour fringes; HSA input; off-centre gaze; install promotion; cross-session persistence; the 320 px / 150 % font overflow from 03-CI.
