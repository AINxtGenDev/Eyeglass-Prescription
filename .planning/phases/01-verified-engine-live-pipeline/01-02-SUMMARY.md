---
phase: 01-verified-engine-live-pipeline
plan: 02
subsystem: engine
tags: [engine, optics, thick-lens, base-curve, D-01, vitest, fast-check]
requires:
  - 01-01 toolchain, ESLint engine boundary, coverage gate
provides:
  - src/engine/conventions.js (K, nasalSign, locationLabel; single source of signs)
  - src/engine/sag.js (sphereSag, rationalised, NaN on domain violation)
  - src/engine/power.js (sphericalEquivalent, vogelBaseCurve, baseCurveAuto, BASE_CURVE_LIMITS, FRONT_RADIUS_MARGIN_MM)
  - src/engine/materials.js (cited CR-39 row)
  - src/engine/diagnostics.js (frozen DIAGNOSTICS, diag, STOCK_BLANK_MAX_MM)
  - src/engine/design.js (design, frontSagAt, backSagAt)
  - src/engine/solve.js (solveCT, optimiseBaseCurve)
  - src/engine/quadrature.js (GL24)
  - src/engine/metrics.js (computeMetrics, thicknessAt, maxRadiusFromOC)
  - src/engine/frame/outline.js (circleOutline, mirrorOutlineX)
  - src/engine/evaluate.js (frozen LensSpec/LensResult; evaluateLens, evaluatePair)
affects: [01-03, 01-06, 01-07, 01-08, 01-10, 01-11]
tech-stack:
  added: []
  patterns:
    - codes-not-strings diagnostics
    - CT fixed point on the outline only
    - bitwise OD/OS symmetry via index-mapped outline mirroring
    - bounded deterministic thinnest-lens search (D-01 final)
key-files:
  created:
    - src/engine/conventions.js
    - src/engine/sag.js
    - src/engine/power.js
    - src/engine/materials.js
    - src/engine/diagnostics.js
    - src/engine/design.js
    - src/engine/solve.js
    - src/engine/quadrature.js
    - src/engine/metrics.js
    - src/engine/frame/outline.js
    - src/engine/evaluate.js
    - src/engine/{conventions,sag,power,materials,diagnostics,solve,quadrature,metrics,evaluate}.test.js
  modified: []
decisions:
  - "Ray-outline radii in the volume quadrature march a monotone edge pointer (outline is CCW and star-shaped about the boxing centre), O(n + angles); metrics cost about 0.14 ms per lens on desktop instead of about 0.85 ms"
  - "The ray-outline hit uses a 1e-9 tolerance on the edge parameter u: rays through a polygon vertex otherwise missed both edges (a 2.3 % volume error, caught by the closed-form test)"
  - "optimiseBaseCurve: if every search point fails, the error comes from one full-outline solve at D1 0.50; if that solve computes after all (defensive branch), it is used as the result, never reported as an error"
  - "evaluateLens computes the Vogel reference (vogelD1, vogelClampedD1) for manual base curves too; vogelMaxThickness and baseCurveSearch stay null for manual"
  - "evaluateLens returns surfaces as exactly the contract subset { n, ct, c1, k1, ca, cb, axisRad, oc }"
  - "No requirement marked complete: the full text of ENG-02/04/05/06/07 and MAT-01/02 needs cyl, all materials, German text or Expert view (later plans)"
metrics:
  duration: 14min
  completed: 2026-11-06
  tasks: 3
  files: 20
---

# Phase 1 Plan 02: Verified Engine Core Summary

This plan adds the pure-JS engine core behind the frozen `LensResult` contract. It has the sign conventions, a stable sag, the cited CR-39 material and the diagnostic catalogue. On top of those sit the thick-lens design and the CT fixed point over the outline, plus GL24 volume quadrature and metrics. Every automatic lens gets the D-01-final thinnest-lens base-curve search, with Vogel as the reference and seed. For sphere/round/CR-39 lenses, OD and OS come out as bitwise mirror results.

## Watch first

- **The `BLANK_EXCEEDS_STOCK` and `OC_OUTSIDE_OUTLINE` codes are in the catalogue but nothing emits them yet.** The plan's evaluate steps only push `CT_SET_BY_*`. For example, the +12,00 PD 10 lens has an MBS of 100 mm and gets no warning. 01-10 (or 01-03) needs to add the emitters.
- **The search makes every automatic recompute cost about 30 solves per eye.** Desktop warm timings per lens (node 22, `evaluateLens` incl. metrics): −2,00 50/18/32 auto 0.35 ms (0.14 ms manual), +12,00 PD 10 auto 0.93 ms (0.20 ms manual). Phone numbers are still unmeasured (ENG-09, 01-11).
- **Test runtime under coverage.** `solve.test.js` + `evaluate.test.js` take 4.1 s normally (well under the 20 s limit). Under `npm run test:coverage` the whole run takes 16 s. The two sweep tests have a 30 s per-test timeout; before the metrics speed-up, the optimality test took 44 s under coverage.

## Tasks

| Task | Name | Commits | Key files |
|------|------|---------|-----------|
| 1 | Conventions, sag, Vogel reference and bound, CR-39, diagnostics | d1a6b75 (RED), a7f60d3 (GREEN) | conventions.js, sag.js, power.js, materials.js, diagnostics.js |
| 2 | Thick-lens design, CT fixed point, outlines, quadrature, metrics | b90d70d (RED), 57878a8 (GREEN) | design.js, solve.js, frame/outline.js, quadrature.js, metrics.js |
| 3 | Thinnest base-curve search and evaluate | 54dd60f (tests), 026150c (perf), b21fb3e (feat) | solve.js, evaluate.js, metrics.js |

## Verification evidence

- `npx vitest run src/engine`: 9 files, **84 tests passed**.
- `npm run test:coverage`: 13 files, 154 tests passed. Engine lines 97.77 %, branches 96.77 % (gate: 95 / 90).
  - Uncovered: the `NON_FINITE_RESULT` return (evaluate.js:153) and the golden-section "both infeasible, cb in the middle" branch (solve.js:169–174).
- `npm run lint`: exit 0.
- Trace selectors (each ≥ 1 passing test):
  - `-t 'MAT-02'`: 29 passed.
  - `-t 'ENG-05'`: 11 passed.
  - `-t 'ENG-04'`: 7 passed.
- Grep gates, all as required:
  - `c = −D2/K` in conventions.js: 1.
  - `Math.max(0` outside comments in sag.js: 0.
  - `vogelClampedD1` in power.js: 4; `D-01`: 2; `Z00981`: 1.
  - `frameLimited` and `BASE_CURVE_CLAMPED` outside comments: 0.
  - `fsv2023.pdf` in materials.js: 1.
  - `BLANK_EXCEEDS_STOCK` sits on a `warn` line.
  - `mirrorOutlineX` in evaluate.js: 2; `@typedef {Object} (LensSpec|LensResult)`: 2; `'thinnest'`: 3.
  - Old rule names outside comments: 0. `optimiseBaseCurve(` and `baseCurveAuto(` in evaluate.js: 1 each.
  - `export function optimiseBaseCurve`: 1.
  - `three|document.|window.` under src/engine: 0 files.

### Engine values (recorded from the test logs)

| Case | D1 | J = max(CT, etMax) | Vogel-clamped J | coarse D1 / full J | evaluations | searchIterations |
|---|---|---|---|---|---|---|
| −2,00 OD rund 50/18/32 | 0.50 (exact floor) | 3.2665 mm | 3.4103 mm (D1 5) | — | 29 | 0 |
| +12,00 rund 50/18/32 | 7.5967 | 9.7503 mm (CT) | 9.8628 mm (D1 10) | — | 31 | 52 |
| +12,00 rund 50/18/PD 10 (ρmax 49, maxD1 9.8039) | 6.7837 | 30.0579 mm (CT) | 37.7599 mm (D1 10) | 7.00 / 30.0749 mm | 31 | 118 |
| +12,00 rund 50/18/PD 5, auto | 6.5967 | 36.3764 mm (CT) | null (D1 10 does not compute) | — | 29 | 96 |
| +12,00 rund 50/18/PD 5, manual 10 | — | FRONT_SAG_UNDEFINED, R1 50, ρmax 54 | — | — | — | — |

These match the planner prototype (orientation values 3.27/3.41, 7.6/9.75/9.86, 6.78/30.06, 6.60/36.4). The refinement result 30.0579 mm is strictly below the coarse 30.0749 mm, at a D1 that is off the 0.50 grid.

- **Optimality (42-spec grid, 40 computable):** the worst gap J_auto − min(manual 0.05 dpt sweep) is **2.5e-6 mm** (sph +12, A 40, PD 10). The bound is 0.01 mm.
- **Rescue property (168 specs):** 43 automatic lenses fail, and **0 are rescuable** by any manual D1 on the 0.05 dpt grid. No failure has the code FRONT_SAG_UNDEFINED, and every failure carries `data.searched = true`.
- **Eye symmetry:** for sph −2/PD 32, +6/PD 10 and +12/PD 10, D1 and CT are identical with `toBe`. Nasal ET, temporal ET and etMax agree within 1e-9.

### Example LensResult: −2,00 OD, rund 50/18/32, CR-39 (rounded to 1e-4)

```json
{ "ok": true, "eye": "OD",
  "diagnostics": [{ "code": "CT_SET_BY_MIN_CT", "severity": "info", "data": {} }],
  "metrics": { "ct": 1.8,
    "etMax": { "value": 3.2665, "index": 360, "location": "temporal", "x": -25, "y": 0 },
    "etMin": { "value": 2.8625, "index": 0, "location": "nasal", "x": 25, "y": 0 },
    "etAt": { "nasal": 2.8625, "temporal": 3.2665, "superior": 3.0644, "inferior": 3.0644 },
    "volumeMm3": 4781.4381, "weightG": 6.3115,
    "frontProtrusion": { "max": 0.3646, "min": 0.2645 }, "mbsMm": 56,
    "decentration": { "x": 2, "y": 0 } },
  "intermediates": { "n": 1.5, "D1": 0.5, "D1v": 0.5003, "D2a": -2.5003, "D2b": -2.5003,
    "R1": 1000, "Ra": 199.976, "Rb": 199.976, "rhoMax": 27,
    "vogelD1": 5, "vogelClampedD1": 5, "vogelMaxThickness": 3.4103,
    "baseCurveRule": "thinnest",
    "baseCurveSearch": { "evaluations": 29, "iterations": 0, "maxThickness": 3.2665 },
    "bindingConstraint": "minCT", "iterations": 0 },
  "surfaces": { "n": 1.5, "ct": 1.8, "c1": 0.001, "k1": 0, "ca": 0.005, "cb": 0.005,
    "axisRad": 0, "oc": { "x": 2, "y": 0 } } }
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Ray through a polygon vertex missed the outline**
- **Found during:** Task 2 (GREEN). The volume test failed at 2.3 % against the closed form.
- **Issue:** Every 8th ray angle (multiples of 22.5°) passes exactly through an outline vertex. Rounding put the edge parameter u just outside [0, 1] for both adjacent edges, so R_j came out as 0.
- **Fix:** Added a 1e-9 tolerance on u. The volume now agrees with the closed form within 1e-4 relative.
- **Commit:** 57878a8

**2. [Rule 3 - Blocking] Optimality test timed out under coverage**
- **Found during:** Task 3 (`npm run test:coverage`). The test took 44.7 s, which is over its 30 s timeout.
- **Issue:** The metrics volume step tested all 720 edges for each of the 128 rays, about 0.85 ms per lens. The sweep tests call `evaluateLens` about 8,000 times.
- **Fix:** The edge pointer now marches monotonically, which is valid because the outline is CCW and star-shaped about the boxing centre (the polar quadrature already requires that). The results are the same and all tests still pass. This also cuts the ENG-09 per-lens cost.
- **Files modified:** src/engine/metrics.js (a Task 2 file). It has its own `perf` commit, 026150c.

**3. [Rule 2 - Robustness] optimiseBaseCurve edge cases**
- **What was added:**
  - If the seed computes but no scan point does, the seed is still returned, never an error.
  - If the final D1 0.50 error-code solve computes after all, it is used as the result.
- **Coverage:** `solve.test.js` reaches the rescan and full-outline-repeat paths with solveCT-level inputs: a coarse grid forced below the floor, and a "spiky" outline whose decimated points hide real violations.

**4. [Process] Task 3 RED gate not observed before implementation**
- For Task 3, I drafted `optimiseBaseCurve` and `evaluate.js` first and used them to probe the prototype values. Only then did I write the tests. The tests went in as their own commit (54dd60f) before the feat commit, but no failing run happened before implementation. Tasks 1 and 2 followed RED → GREEN with observed failures.

**5. [Test infrastructure] Sweep test timeouts**
- The optimality and rescue sweep tests have a 30 s per-test timeout. The default 5 s is too short: the optimality test takes 8 s with the pre-fix metrics and about 3 s now.

## TDD Gate Compliance

- Task 1: `test(...)` d1a6b75, then `feat(...)` a7f60d3. RED observed: 5 files failed on missing modules.
- Task 2: `test(...)` b90d70d, then `feat(...)` 57878a8. RED observed: 3 files failed.
- Task 3: `test(...)` 54dd60f, then `feat(...)` b21fb3e. Warning: RED was not observed before implementation (see deviation 4).

## Requirements

None marked complete. Each one still has a part that later plans deliver:

| Requirement | Done in this plan | Still open, and where |
|---|---|---|
| ENG-02 | Thick-lens back-vertex design | Round-trip test across the full input range including cyl (01-08) |
| ENG-04 | CT solve over the outline | Mixed-sign meridians, which need cyl (01-08) |
| ENG-05 | Decentration, fitting height, per-eye computation | Only round frames so far (01-07) |
| ENG-06 | Metrics | Sags at the extremes are not in the intermediates yet |
| ENG-07 | Coded diagnostics | German explanation and suggestion (01-03/01-10) |
| MAT-01 | CR-39 | Five more materials (01-06) |
| MAT-02 | Automatic thinnest base curve | Display in the Expert view (phase 2) |

## Known Stubs

- `backSagAt` throws for `ca !== cb`, and `evaluateLens` rejects `cyl ≠ 0` and any non-round or A ≠ B frame with `INVALID_SPEC`. These are intentional skeleton limits; 01-07 and 01-08 lift them.
- `MATERIALS` has only `cr39` (01-06 adds the rest).
- See "Watch first" for the diagnostic codes that nothing emits yet.

## Threat Flags

None. There is no network, storage or DOM surface. T-01-09/10/15/26/29 are mitigated as planned:
- maxIter cap
- coded NaN failures
- bounded search
- ESLint boundary plus the grep gate
- INVALID_SPEC and NON_FINITE_RESULT guards
- null plano radii

## Self-Check: PASSED

- All 20 plan files exist on disk under src/engine/ (11 modules and 9 test files).
- Commits d1a6b75, a7f60d3, b90d70d, 57878a8, 54dd60f, 026150c and b21fb3e are present in `git log`.
