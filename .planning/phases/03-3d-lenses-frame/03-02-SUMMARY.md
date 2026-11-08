---
phase: 03-3d-lenses-frame
plan: 02
subsystem: engine/mesh + lint boundary
tags: [VIZ-01, D-02, D-03, D-04, mesh, eslint]
requires: [evaluateLens surfaces, frameOutline, frontSagAt, backSagAt, frontSagGradAt, backSagGradAt, thicknessAt]
provides: [RINGS, SPOKES, GRADING, RING_FRAC, VERTS, FRONT_INDEX, BACK_INDEX, BAND_INDEX, LENS_LENGTHS, allocLensBuffers, outlineNormals, buildLensMesh]
affects: [03-03 rim offset (outlineNormals), 03-04 worker mesh lane, 03-05 3D view]
tech-stack:
  added: []
  patterns: [fixed topology 64 x 720 (Uint16 indices), analytic normals, own edge-band vertices, finite flag instead of NaN upload, three only in src/ui/view/**]
key-files:
  created:
    - src/engine/mesh/topology.js
    - src/engine/mesh/lens.js
    - src/engine/mesh/lens.test.js
    - src/engine/mesh/tessellation.test.js
  modified:
    - eslint.config.js
    - src/engine/boundary.test.js
decisions:
  - "03-02: lens mesh = 64 rim-graded rings (g 2,5) x 720 spokes about the boxing centre; outer ring is the engine outline (spoke i = outline point i); 46 081 vertices per surface"
  - "03-02: bounding sphere computed from the stored Float32 values, centre (0, 0, mid z)"
  - "03-02: low-index custom lenses (ne < 1,49) reach 0,0231 mm of the documented 0,025 mm bound (scan worst ne 1,43, -6 -3 x 45, rechteckig 62x55/14 PD 25)"
metrics:
  duration: ~20 min
  completed: 2026-11-08
  tasks: 3
  files: 6
---

# Phase 3 Plan 02: Fixed-topology lens mesh builder Summary

A pure-JS builder (`src/engine/mesh/lens.js`) turns `LensResult.surfaces` plus the engine's 720-point outline into position, analytic-normal and thickness Float32Arrays on a fixed 64 × 720 rim-graded polar grid. It calls only the engine's own surface functions. D-04 (a)–(d) are proven in Node, and lint now keeps `three` inside `src/ui/view/**`.

## Thing most likely to bite

The low-index bound has little margin. With custom nₑ 1,43, −6,00 −3,00 × 45, rechteckig 62×55/14, PD 25, the sag error is **0,0231 mm** against the documented 0,025 mm. I found this lens with a scratch scan of 410 computable low-index lenses: nₑ 1,40/1,43, sph −2…−12, cyl 0/−3/−6, axis 45 only, DBL 14 only, 4 shapes, 40×28 and 62×55, PD 25/40. The scan was not exhaustive, so a lens outside it could exceed 0,025 mm. The research table reported 0,0203 mm for this region, so this scan found a worse case. The lens is now a named case in `tessellation.test.js`.

## Measured values (real output, Node v22.17.0, this machine, 2026-11-08)

| Quantity | Value |
|---|---|
| D-04(a) worst \|front z − back z − thicknessAt\| at outline vertices, 160 lenses (seed 30302) | 1,33e-6 mm (Float32 rounding) |
| Build time per lens, −10 CR-39 rechteckig 62×55/14 PD 25, median of 20 (after 10 warm-up) | 12,72 ms (min 12,34, max 13,27) |
| D-04(c) NAMED_STRICT (10 of 10 ok), worst 10-point / 4-point | 0,007444 / 0,007444 mm (−10 CR-39 62×55/14 PD 25) |
| D-04(c) NAMED_CUSTOM_LOW (7 ok, 3 skipped as not computable), worst 10-point / 4-point | 0,023148 / 0,023148 mm |
| D-04(c) FUZZ 1–25 (25 ok), worst 10-point / 4-point | 0,0040679 / 0,0040678 mm |
| D-04(c) FUZZ 26–50 (25 ok), worst 10-point / 4-point | 0,0038714 / 0,0038714 mm |
| tessellation.test.js runtime | 10,7 s (4 tests) |
| lens.test.js runtime | 14,1 s (31 tests after the chunk split) |

The 10-point probe added almost nothing over the 4-point probe on these sets: equal in 3 sets, +3e-8 mm in one. No change to RINGS or GRADING was needed.

## Tasks

| Task | Commit | Notes |
|---|---|---|
| 1 three lint boundary | bb84cae | new block for `src/ui/**` minus `src/ui/view/**`; 11 new probes in boundary.test.js |
| 2 RED | 11736a1 | failed with "Cannot find module './lens.js'" |
| 2 GREEN | a3063de | topology.js, lens.js; test spread fix |
| 3 D-04(c) | 27cb613 | 4 `it` blocks |
| fix | 90f6f8f | lens.test.js property tests split into fc.sample chunks |

## Verification (real output)

- `npx vitest run src/engine/boundary.test.js`: 29 passed.
- `npm run lint`: exit 0, no messages.
- `npx vitest run src/engine/mesh/lens.test.js`: 14 passed.
- `npx vitest run src/engine/mesh/tessellation.test.js`: 4 passed.
- `npm run test:coverage` (final, at 90f6f8f): 36 files, 1653 tests passed, exit 0. All files 98,6 % statements, 96,69 % branches, 99,29 % lines. lens.js and topology.js are 100 % lines, branches and functions (json-summary of the mesh-only run).
- First full coverage run (at 27cb613): exit 1, 2 tests timed out at 30 s (D-04(a) and finiteness under v8 coverage). Fixed in 90f6f8f, see deviation 6.
- `npm run build`: built in 161 ms, exit 0 (run at 27cb613; 90f6f8f changes only a test file).
- After the split: D-04(a) 160 of 160 lenses computable, worst value unchanged at 1,33e-6 mm (same samples); finiteness 198 of 200 computable.
- Acceptance greps: lens.js imports from `../design.js` and `../metrics.js` = 2; `three|document|window` in lens.js and topology.js = 0; `computeVertexNormals` = 0; tessellation.test.js has `0.01` (4), `0.025` (1), `2026-11-08` (4) and `1 / 6` (1).

## Deviations from Plan

**1. [Rule 1 - Test bug] `Math.max(...FRONT_INDEX)` overflowed the call stack**
- Spreading 274 320 values blew the stack. The test now uses `reduce`. Fixed before the GREEN commit.

**2. [Rule 1 - Coverage] bounding-box z tracking made branch-free**
- The first version had `if (back z > zMax)`, a branch no valid lens can take (uncovered, lens.js line 114). It now uses `Math.max/Math.min` over front and back z. Same result.

**3. [Rule 3 - Blocking] Manual base curve 10 at sph −6 uses rechteckig 46×32/18**
- In the default 52×38/18 it is `BACK_SAG_UNDEFINED`. 46×32 is the nearest size I tried that computes.

**4. [Rule 2 - Test strength] NAMED_CUSTOM_LOW extended**
- The plan's 4 cases (nₑ 1,40/1,43 × sph −6/−12 in 52×38) reached only 0,0048 mm, so they did not test the 0,025 mm bound in any useful way. I added the 62×55/14 PD 25 frame at sph −6/−12 and the scan-worst lens with −3 × 45. Of these, nₑ 1,40 at −6 −3 × 45 and both sph −12 large-frame cases are not computable; they are skipped and counted, as the plan says.

**5. Topology comment wording**
- topology.js said "three.js" in a comment, which tripped the acceptance grep (`three|document|window` = 0). It now says "the renderer".

**6. [Rule 1 - Test] Property tests timed out under coverage**
- In the full `npm run test:coverage` run, D-04(a) (160 lenses) and finiteness (200 lenses) each took more than 30 s. They now run as 20-sample `fc.sample` chunks with the same seeds (the 02-19 pattern), and the ≥ 100 floors are asserted in the last chunk. Commit 90f6f8f.

## Requirements

VIZ-01 stays Pending. The geometry is proven here, but the requirement is "both lenses as procedural meshes" on screen, and that is 03-05. requirements mark-complete was not run.

## Known Stubs

None.

## Threat Flags

None. No new network, storage or DOM surface. T-03-04/05/06 are mitigated as planned: engine surfaces are reused under D-04 tolerances, there are length guards plus a `finite` flag, and there are lint probes with positive controls.

## Self-Check: PASSED

- Files: src/engine/mesh/topology.js, lens.js, lens.test.js and tessellation.test.js exist; eslint.config.js and src/engine/boundary.test.js are modified.
- Commits bb84cae, 11736a1, a3063de, 27cb613 and 90f6f8f are in git log.
- TDD gates (Task 2): test(03-02) 11736a1 comes before feat(03-02) a3063de.
