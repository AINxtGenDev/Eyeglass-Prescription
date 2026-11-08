---
phase: 03-3d-lenses-frame
plan: 03
subsystem: engine/mesh (frame + heat)
tags: [VIZ-02, VIZ-05, D-05, D-06, D-04(e), frame, heatmap]
requires: [bevelApexMm, bevelSplit, frontLeadMm, outlineNormals, frameOutline, extremeIndices, thicknessAt, frontSagAt, backSagAt, meridianProfile, meridianEndLabels]
provides: [FRAME_FACE_MM, RIM_LIP_MM, TEMPLE_DEFAULT_MM, TEMPLE_RANGE_MM, CHART_DISTANCE_MM, boxingCentreX, templeDrawnMm, FRAME_LENGTHS, allocFrameBuffers, RIM_INDEX, BRIDGE_INDEX, TEMPLE_INDEX, HINGE_INDEX, buildFrameMesh, heatScale, ISO_STEPS, isoLevels, THICKEST_MERGE_DEG, heatCallouts, isoLabelPoints]
affects: [03-07 frame in 3D + mesh worker frame slot, 03-09 Seite/Dickenkarte camera fits, 03-12/03-13 heatmap]
tech-stack:
  added: []
  patterns: [fixed-topology frame buffers, rim xy lens-local + z world, common mean-apex rim plane, exact checks on Float64 buffers + Float32 storage bound]
key-files:
  created:
    - src/engine/mesh/frame.js
    - src/engine/mesh/frame.test.js
    - src/engine/mesh/heat.js
    - src/engine/mesh/heat.test.js
  modified: []
decisions:
  - "03-03: the drawn temple is clamped to TEMPLE_RANGE_MM [110, 160] [ASSUMED]; the stamp regex accepts 00…999, so a raw value could pierce the chart plane or be shorter than the 35 mm earpiece. buildFrameMesh returns the drawn templeMm"
  - "03-03: rim buffers hold lens-local x, y and world z (lensZ included); bridge, hinges and temples are world. The view puts each rim in a group at boxingCentreX and shifts the lens group by (boxingCentreX, 0, lensZ)"
  - "03-03: buildFrameMesh writes any typed array of the right length; exact formula checks (1e-9/1e-6) run on Float64 buffers, the Float32 storage error is bounded separately (< 2e-6 mm)"
metrics:
  duration: ~35 min
  completed: 2026-11-08
  tasks: 2
  files: 4
---

# Phase 3 Plan 03: Frame builder and heatmap numbers Summary

The frame builder (`src/engine/mesh/frame.js`) is pure engine code. It places each rim on its lens's bevel curve (`bevelApexMm`) in one common rim plane. The bridge spans exactly DBL, and there are hinges and temples with the earpiece bend. `heat.js` gives the shared heat scale, the iso levels, and callouts that are the engine's own numbers (`toBe` against `meridianProfile` and the metrics).

## Thing most likely to bite

**1. Temple clamp: the drawn temple can differ from the stamp.** This was not in the plan. The stamp regex accepts any 2–3 digit temple (`parse.js` STAMP), so the "min and max the stamp validation accepts" are 0 and 999. Neither can be drawn: 999 goes through the chart plane at −200 mm, and 0 is shorter than the 35 mm earpiece. I clamp the drawing to `TEMPLE_RANGE_MM = [110, 160]`. That range is [ASSUMED], from memory and unverified. `buildFrameMesh` returns the drawn `templeMm`. **03-07 must show the drawn value**, or say that it was clamped, in `tech.view.temple`. Otherwise the Technische Angaben could print "999 mm (vom Bügel)" next to a 160 mm temple.

**2. Some iso lines get no label point.** `isoLabelPoints` searches only the four half-chords from the OC. A value that occurs only in a corner gets `null`. Measured: example OD and OS placed 5 of 6, −10 62×55/14 placed 6 of 8, +4 sph placed 6 of 7. The plan specifies this behaviour, but 03-12/03-13 must handle `null` (draw the line, skip its label).

## Measured values (real output, Node v22.17.0, this machine, 2026-11-08)

| Quantity | Value |
|---|---|
| Pitfall 9: shape × (A, B) combinations checked / rejected by frameOutline | 16 / 0 (no offset clamp needed) |
| D-05 Float32 storage error, worst over example and −10 at D 3 and 10 | < 2e-6 mm (asserted bound) |
| Frame fuzz (seed 30303): frames / computable lenses | 50 / 100 of 100 |
| A3 (seed 30304): lenses checked, worst mesh thickness beyond the scale | 34, 1,10e-6 mm (bound 0,01) |
| Merge cases | OD −4,00 rund 48×44/20 PD 30: etMax at 180,00° about the OC → merge 'temporal'; example OD: 151,92° → null |
| frame.test.js runtime | 1,97 s (24 tests) |
| heat.test.js runtime | about 1,3 s (16 tests) |

## Tasks

| Task | Commit | Notes |
|---|---|---|
| 1 RED | 266141c | failed with "Cannot find module './frame.js'" |
| 1 GREEN | d847126 | 24/24 passed on the first run; a mutation check (apex × 1,01, flipped rim winding) failed 9 tests, then the file was restored |
| 2 RED | b01191e | failed with "Cannot find module './heat.js'" |
| 2 GREEN | fd0723d | 16/16 passed |

## Verification (real output)

- `npx vitest run src/engine/mesh/frame.test.js`: 24 passed.
- `npx vitest run src/engine/mesh/heat.test.js`: 16 passed.
- `npm run lint`: `eslint .` with no messages.
- `npm run test:coverage`: 38 files, 1693 tests passed, EXIT=0. All files: 98,91 % statements, 96,87 % branches, 99,48 % lines. heat.js: 100 % lines, 97,22 % branches (line 143, the exact `f1 === 0` hit). frame.js does not appear in the text table, which hides fully covered files; engine/mesh shows 100 % lines.
- `npm run build`: built in 170 ms.
- Acceptance greps: frame.js `bevelApexMm(` 3, `frameOutline(` 1, `ASSUMED` 8, `lensZ` 12. frame.test.js: D-05, DBL, Pitfall 9, templeMm, frontLeadMm, MINOR 9 and eyeBox each ≥ 1. heat.js: `meridianProfile(` 2, `from '…state/` 0. heat.test.js imports thickest/thinnest from `../../state/compare.js`, and its titles contain D-04(e) and NO_CHORD.
- e2e was not run. `npm run preview` is hard-coded to `--port 4173 --strictPort` and collides with the parallel worktree. This plan is engine-only; the orchestrator runs the full e2e after the merge.

## Deviations from Plan

**1. [Rule 2 - Correctness] Drawn temple clamped to TEMPLE_RANGE_MM, `templeDrawnMm` exported**
- The stamp accepts temples from 00 to 999, so the plan's tests ("min and max the stamp accepts"; "the longest allowed temple stays in front of the chart plane") cannot pass unclamped. The test asserts 0 → 110, 999 → 160, 145 → 145, and that the length equals the drawn value for 140, 110, 160, 0 and 999. Commit d847126.

**2. [Rule 1 - Test precision] Exact checks on Float64 buffers**
- A 1e-9 mean-apex check and a 1e-6 D-05 check cannot hold on Float32 storage (half an ulp is about 9,6e-7 mm at |z| ≈ 16 mm). `buildFrameMesh` accepts any typed array of the right length. The exact tests use Float64Array, and every D-05 case also runs on the production Float32 buffers with a bound of < 2e-6 mm. The fuzz test asserts that `allocFrameBuffers()` returns Float32Array.

**3. Extra exports beyond the plan's list**
- `TEMPLE_RANGE_MM` and `templeDrawnMm` (deviation 1). Also the section and placement constants (`EARPIECE_MM`, `EARPIECE_BEND_DEG`, `TEMPLE_SPLAY_DEG`, `END_PIECE_DEG`, `BRIDGE_ARCH_MM`, the section sizes) and the ring counts (`BRIDGE_RINGS`, `TEMPLE_RINGS`, `TEMPLE_STRAIGHT_SEGS`), which the tests use. `THICKEST_MERGE_DEG` is exported from heat.js. The return value has an extra field, `templeMm` (the drawn value).

**4. Earpiece kink ring**
- The ring at the bend uses the bisector tangent, with its height scaled by 1/cos(15°) (miter), so the tube keeps its section through the 30° kink. The centreline polyline is unchanged (length = templeMm exactly).

## Known Stubs

None.

## Threat Flags

None. There is no new network, storage or DOM surface. T-03-07 is mitigated by the D-05 per-vertex and frontLeadMm geometry tests, T-03-08 by the `toBe` callout and scale equality tests, and T-03-09 by the fixed lengths, the `finite` flag, the Pitfall 9 test at the size limits and the 50-frame fuzz.

## Requirements

VIZ-02 and VIZ-05 stay Pending. The engine side is proven here, but the frame and the heatmap appear on screen only in 03-07 and 03-12/03-13. I did not run requirements mark-complete, and I made no STATE.md or ROADMAP.md edits (the orchestrator owns them).

## Self-Check: PASSED

- Files: src/engine/mesh/frame.js, frame.test.js, heat.js and heat.test.js exist.
- Commits 266141c, d847126, b01191e and fd0723d are in git log.
- TDD gates: test(03-03) 266141c comes before feat(03-03) d847126 (Task 1); test(03-03) b01191e comes before feat(03-03) fd0723d (Task 2).
