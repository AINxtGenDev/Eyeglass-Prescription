---
phase: 03-3d-lenses-frame
plan: 07
subsystem: ui/view (frame) + mesh worker protocol
tags: [VIZ-02, D-06, D-09, lens-critic MINOR 9, lens-critic round 2 MINOR 7, frame]
requires: [buildFrameMesh, allocFrameBuffers, FRAME_LENGTHS, RIM_INDEX, BRIDGE_INDEX, TEMPLE_INDEX, HINGE_INDEX, BRIDGE_RINGS, TEMPLE_RINGS, boxingCentreX, FRAME_FACE_MM, TEMPLE_DEFAULT_MM, TEMPLE_RANGE_MM, createMeshHandler, mountView, refreshView]
provides: [mesh slot 'frame', frameFn dep, createBufferPool, createFrame, displayFrame, initFrameInput onDisplayChange, __eyeglassView.frameInfo, __eyeglassView.meshJobs, ?failframe, tech.view.temple/templeSource.*/rimFace/planar]
affects: [03-09 camera presets (frame cameraData: frontBoundingSphere, sideTarget, eyeBox), 03-12 Dickenkarte fit (eyeBox), 03-14 slot A (per-item keys), 03-15 leak test (allocs sums lens + frame pools)]
tech-stack:
  added: []
  patterns: [per-item mesh keys against the attached key, empty requestMesh to stale an outstanding job, shared bounded buffer pool, lens z from the frame's common rim plane]
key-files:
  created:
    - src/ui/view/frame.js
  modified:
    - src/state/mesh-protocol.js
    - src/state/mesh-protocol.test.js
    - src/ui/view/lenses.js
    - src/ui/view/view.js
    - src/ui/pipeline.js
    - src/ui/frame-input.js
    - src/ui/main.js
    - index.html
    - src/i18n/de-AT.js
    - e2e/view.spec.js
decisions:
  - "03-07: the frame's rim depth is the Expert field value only while the Experten-Ansicht is on (else RIM_DEPTH_DEFAULT_MM), like every other Expert field; the switch toggle calls refreshView"
  - "03-07: displayFrame() returns templeMm null for a stamp without a temple and the lazy view substitutes TEMPLE_DEFAULT_MM; importing engine/mesh/frame.js into frame-input.js put the mesh builder into the entry bundle (+8,2 kB raw)"
  - "03-07: a clamped stamp temple is named in Technische Angaben ('laut Bügel 999,0 mm, für die Darstellung auf 110,0 mm bis 160,0 mm begrenzt – angenommener Bereich'); TEMPLE_RANGE_MM stays [ASSUMED], no source found or claimed"
  - "03-07: an update whose items equal the outstanding job's (same slots and keys) sends nothing; otherwise the changed items are sent, or requestMesh([]) when only an outstanding job differs"
metrics:
  duration: ~75 min
  completed: 2026-11-08
  tasks: 2
  files: 11
---

# Phase 3 Plan 07: Frame in the 3D view Summary

The 3D view now shows glasses, not two loose lenses. The mesh worker builds the parametric acetate frame (rims on each lens's bevel curve, a bridge spanning DBL, hinges, and temples with the earpiece bend) as a `'frame'` mesh item. Both lenses sit on the frame's common rim plane. Rim depth and temple length re-mesh only the frame and never start a compute job.

## Most likely to bite

1. **The lenses are small in the default view.** As the plan and the UI-SPEC Camera table say, the default fit covers the frame bounding sphere (front plus temples, measured as radius about the bridge centre: |centre| + r). With 140 mm temples the lenses shrink a lot. Measured with a temporary probe spec (now deleted), using the distance between the R and L label centres, which sit 70 mm apart (A + DBL) in world space:

   | Viewport | Stage (px) | R↔L label centres |
   |---|---|---|
   | 1280 × 800 | 400 × 250,75 | 37,2 px |
   | 412 × 915 | 382 × 287 | 42,6 px |
   | 320 × 640 | 290 × 218 | 32,3 px |

   So each 52 mm lens is roughly 25–30 px wide on screen. A sphere fit with a 20° vertical FOV is very conservative for a wide, shallow object. A box fit that uses the horizontal FOV, or fitting only the frame front, would make the lenses about 2–3× larger. I did not change it: camera fits belong to 03-09, and the UI-SPEC rule is explicit. **lens-critic and 03-09 should decide this.** The orchestrator's MCP screenshots will show how it looks.
2. **One existing test assumption changed.** In 'VIZ-01 blocked eye', the R/L order check compared left edges. With the lenses closer together, the wide label 'L – nicht berechnet' starts left of 'R'. The test now compares label centres. That is what it meant, but the labels may now overlap visually. 03-13's label pool should check for that.
3. **TEMPLE_RANGE_MM [110, 160] is still unsourced** (carried from 03-03). I found no citable range and claim none. It stays labelled `[ASSUMED]` in the code, and the page shows it as "angenommener Bereich". The page never prints a stamp value as if it were the drawn length: `e2e 'VIZ-02 temple from the stamp'` asserts the exact clamped sentence for "52□18 999".
4. **I ran the formatter by mistake.** I ran `npx prettier` (not a project dependency, default options), which restyled 5630ced to double quotes. cd81653 restores the original style with the same code. Task 2 files were never committed reformatted.

## What was built

- **`src/state/mesh-protocol.js`**: slot `'frame'` in `MESH_SLOTS`, routed to an injected `frameFn = buildFrameMesh` with `BEVEL_RULE`.
  - Validates shape, A, B and DBL (finite, ≥ 0), `rimDepthMm` > 0, `templeMm` > 0, and each non-null eye's surfaces.
  - Normalises buffers to `FRAME_LENGTHS`.
  - The reply adds `frontBoundingSphere`, `sideTarget`, `eyeBox`, `lensZ` and `templeMm` (the drawn, clamped value). All of them are null when ok is false. Lens validation and normalisation are shared and unchanged.
- **`src/ui/view/lenses.js`**: `createBufferPool(alloc, lengths)` → `{ take, giveBack, lose, usable, allocCount, lostCount }` is now used per lens slot, with no behaviour change. It also adds `group(name)`, `visible(name)` and `lose(name)`. `unionRadius` includes the group's z.
- **`src/ui/view/frame.js`**: seven fixed geometries (two rims in groups at `boxingCentreX`, plus the bridge, the temples and the hinges).
  - Materials: acetate `MeshPhysicalMaterial #221e1c` (roughness 0.4, clearcoat 1 / 0.08) and hinge `MeshStandardMaterial #9a9a9a` (metalness 1, roughness 0.3).
  - `attach` swaps the arrays and sets both lens groups' `position.z = lensZ`.
  - A frame that is not drawable hides the frame and keeps `lastLensZ` (the reason is written in the header comment).
  - Also provides `cameraData()` for 03-09/03-12 and `info()` for the tests.
- **`src/ui/view/view.js`**: per-item keys (described in the header).
  - Lens key: eye + surfaces + shape, A, B.
  - Frame key: shape, A, B, DBL, both eyes' surfaces or null, rim depth and temple.
  - Paint attaches lenses first and the frame last, in the same rAF, then places the lenses from the current placement.
  - `?failframe=<mm>` sends rim depth −1.
  - The fit uses the larger of the lens union radius and the frame radius.
  - The tech lines are filled after each frame attach and cleared when the frame is hidden.
- **`src/ui/frame-input.js`**: `displayFrame()` (the rule for rim depth and temple is in its JSDoc). The `onDisplayChange` hook is called from the rim-depth and stamp handlers. **`main.js`** wires it to `refreshView` and also calls `refreshView()` on the Expert toggle. **`pipeline.js`** `viewInputs()` adds `frame` (from `currentConfig`) and `display`.
- **`index.html`**: `#tech-view-temple`, `#tech-view-rimface` and `#tech-view-planar`. **`de-AT.js`**: `tech.view.temple`, `tech.view.templeSource.{stamp,assumed,clamped}`, `tech.view.rimFace` (UI-SPEC wording) and `tech.view.planar`.

## Verification (real output, this machine, 2026-11-08)

- RED (Task 1): `npx vitest run src/state/mesh-protocol.test.js` → `Tests 6 failed | 10 passed (16)`. GREEN → `16 passed (16)`. Re-run after the style restore → `16 passed`.
- `npm run lint` → `eslint .` with no findings (final state).
- `npm test` (before e2e edits) → `Test Files 41 passed (41)`, `Tests 1730 passed (1730)`.
- `npm run test:coverage`, run alone → `EXIT=0`, `Test Files 41 passed (41)`, `Tests 1730 passed (1730)`, `All files | 98.91 | 96.87 | 100 | 99.48`. A first run made at the same time as the full e2e run had `3 failed | 1727 passed` (EXIT=1). My grep filter hid which tests failed. The run alone passed all of them, so I attribute the failures to CPU contention, but I did not identify the tests.
- `npm run build`: entry `index-Bzn0XbRX.js` 135,99 kB (gzip 47,06), before this plan 135,13 kB. View chunk 556,23 kB (gzip 139,78), still with the > 500 kB warning carried from 03-05. `mesh.worker` 14,47 kB (was 7,9 kB; it now contains the frame builder).
- Port check before e2e: `curl … http://localhost:4173/Eyeglass-Prescription/` printed `000`.
- `npm run test:e2e` (final code) → **`429 passed`, `1 skipped` (6.0m), EXIT=0**. That includes the 9 new view tests on desktop and mobile, plus frame.spec and expert.spec unchanged.
- Probe at 1280 (default example): `allocs {page: 6, worker: 0}` (4 lens sets + 2 frame sets), `memory {geometries: 13, textures: 3, programs: 5}`, `lensZ {OD: 1,5351, OS: 1,5076}`.
- Acceptance greps: frame.js `'#221e1c'` 1, `transmission` 0, `lastLensZ` 4. frame-input.js `onDisplayChange` 5. main.js `onDisplayChange: refreshView` 1. frame-input.js imports from `./pipeline.js` 0. view.js `meshJobs` 3. `lensZ` frame.js 6 + view.js 0 (≥ 2). mesh-protocol.js `frameFn` 3. `innerHTML|setAttribute('style'` in frame.js/view.js: 0.
- MCP (D-30 screenshots, console, memory after cycling the shapes): **not done here.** The orchestrator does it after this plan returns.

## Task commits

| Task | Commit | Message |
|------|--------|---------|
| 1 RED | 01850b4 | test(03-07): add failing tests for the frame mesh item |
| 1 GREEN | 5630ced | feat(03-07): frame mesh item in the mesh worker protocol |
| 1 style | cd81653 | style(03-07): restore project formatting in the mesh protocol files |
| 2 | a89e529 | feat(03-07): frame in the 3D view, display-only rim depth and temple, Technische Angaben |

## Deviations from Plan

**1. [Rule 1 - Correctness] A clamped temple is shown as drawn, with the stamp value named** (carried finding from 03-03)
- The plan's `tech.view.temple` has only stamp/assumed sources. With the 03-03 clamp, "999 mm (vom Bügel)" would sit next to a 160 mm temple. The new `tech.view.templeSource.clamped` handles this case, and e2e checks the exact sentence. Commit a89e529.

**2. [Rule 2 - Consistency] The rim depth follows the field only while Expert is on**
- The plan says "the valid field value, else the last valid". With the switch off, every Expert field is ignored (readExpertOverrides is all null), so the frame then uses RIM_DEPTH_DEFAULT_MM. The Expert toggle now calls `refreshView()`. Commit a89e529.

**3. [Rule 3 - Bundle] `templeMm: null` for an assumed temple in `displayFrame()`**
- Importing `TEMPLE_DEFAULT_MM` from `engine/mesh/frame.js` into frame-input.js grew the entry from 135,13 to 143,35 kB. The view chunk now substitutes the engine constant, so there is still one source. Commit a89e529.

**4. Outstanding-job rule**
- If the items to send equal exactly what the outstanding job carries (same slots and keys), nothing is sent. Otherwise a repeated `refreshView()` during an in-flight job would make it stale and resend it on every paint. The −2 → −3 → −2 test holds the mesh worker (holdMeshWorker), so the −3 job really is outstanding. It asserts that the last job is `[]` and that the −2 mesh is attached. This is stricter than the plan's "typed without waiting".

**5. Test changes beyond the plan**
- 'VIZ-01 blocked eye' compares label centres (see "Most likely to bite" 2).
- 'every shape' also checks edgeMax against the cards for each shape.
- 'blocked eye keeps its rim' asserts `lensZ.OS === 0` (flat rim).
- 'temple' covers the clamped case.
- The e2e file's `/* global */` line now also lists `document` and `Worker`.

**6. Process: formatter mishap** (see "Most likely to bite" 4). No functional change.

## Known Stubs

- `frame.cameraData()` is not read yet. 03-09 (presets) and 03-12 (Dickenkarte fit) consume it, as planned.

## Threat Flags

None beyond the register:
- T-03-18: protocol validation and per-item try/catch are unit-tested, including a throwing frameFn and the invalid cases.
- T-03-19: e2e 'rim depth is display only' shows the compute message count and the card values unchanged.
- T-03-20: the tech lines use textContent with fmtMm params.
- `?failframe` is test-only. It can only make the frame fail to draw and never touches a number.

## Self-Check: PASSED

- src/ui/view/frame.js exists.
- Commits 01850b4, 5630ced, cd81653 and a89e529 are in `git log`.
- TDD gate: test(03-07) 01850b4 comes before feat(03-07) 5630ced.
