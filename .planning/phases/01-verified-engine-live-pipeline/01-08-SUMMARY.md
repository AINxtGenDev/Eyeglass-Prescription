---
phase: 01-verified-engine-live-pipeline
plan: 08
subsystem: engine-optics
tags: [torus, cylinder, ray-trace, power-matrix, eng-01, eng-02, eng-03, eng-04, eng-05, eng-08]
requires:
  - 01-02 engine (design, solveCT, optimiseBaseCurve, evaluateLens)
  - 01-07 frame outlines and per-eye decentration
provides:
  - "torusSag (tyre, D-03), sphereSagGrad, torusSagGrad in sag.js"
  - "backSagAt = torus in axis coordinates about the OC; frontSagGradAt, backSagGradAt in design.js"
  - "trace.js: traceRay, traceBVP (Snell oracle, reused by the phase-4 warp grid)"
  - "power.js: meridianPower, rxToMatrix, matrixToRx"
  - "evaluateLens accepts minus-cylinder Rx; cyl > 0 is INVALID_SPEC plus-cyl-must-be-transposed"
  - "BACK_SAG_UNDEFINED data { meridian: 'cross'|'base', axisDeg }"
affects: [01-09, 01-10, 01-11, phase-3 mesh normals, phase-4 Durchblick]
tech-stack:
  added: []
  patterns:
    - "Oracle and engine share sag/gradient code; orientation and TABO errors are covered by independent analytic tests (implicit-torus equation, tyre golden, TABO golden)"
    - "solveCT earlyExit only on decimated search outlines; reported errors come from a full-outline scan"
key-files:
  created:
    - src/engine/trace.js
    - src/engine/trace.test.js
  modified:
    - src/engine/sag.js
    - src/engine/sag.test.js
    - src/engine/design.js
    - src/engine/solve.js
    - src/engine/solve.test.js
    - src/engine/evaluate.js
    - src/engine/evaluate.test.js
    - src/engine/power.js
    - src/engine/power.test.js
    - .planning/research/PITFALLS.md
decisions:
  - "[01-08]: The PITFALLS Pitfall-5 table (0.03/0.16/0.10/0.39 mm) matches barrel minus meridional (0.027/0.152/0.094/0.378 mm), not tyre minus meridional (0.014/0.013/0.021/0.086 mm max). The table was computed with the barrel form. The table is unchanged, as the plan requires. The real values are recorded in the summary."
  - "[01-08]: ENG-01, ENG-02, ENG-03 and ENG-04 are marked complete. ENG-08 stays pending until tier 4 (01-10). ENG-05 was already complete; it is now also proven for oblique cylinders on both eyes."
  - "[01-08]: solveCT got an earlyExit option for the decimated search outlines. The full-outline solve scans every failing point so it can set the 'cross'/'base' label."
metrics:
  duration: 8min
  completed: 2026-11-06
  tasks: 2
  files: 12
---

# Phase 01 Plan 08: Toric Back Surface and Ray-Trace Oracle Summary

A cylinder prescription now gets a true tyre-torus back surface. The surface is rotated to the TABO axis about the OC. An independent Snell ray trace through the generated surfaces reproduces the entered Sph/Zyl/Achse to within 0.001 dpt. This holds for `design()` across the full input range, and it holds for the full `evaluateLens` pipeline.

## Oracle results (ENG-02, ENG-08 tier 3)

| Run | Cases | Worst element error | Axis |
|-----|-------|---------------------|------|
| `design()` property (fast-check, numRuns 300, seed 42) | Sph −12…+12, Zyl −6…0 in 0.25 steps, axis 0…179, 6 indices, CT 1–12 mm | **1.045e-3 dpt** (research: 0.0015) | worst 3.8e-13° for \|Zyl\| ≥ 0.25 |
| `evaluateLens` pipeline property (numRuns 100, seed 43) | all 6 materials, 4 shapes, A 40–62, B 28–55, DBL 14–24, PD 25–40, OD/OS, automatic base curve | **8.633e-4 dpt** | — |
| Thin-lens design (+8.00, CT 8, D2 = S − D1) | discriminator | **0.5634 dpt**, rejected (limit > 0.3) | — |

- **Pipeline property coverage:** all 100 random specs computed (100/100). The property therefore exercised the D-01 search, the CT solve and the decentred OC on every run.
- **Newton iterations:** at most 2 in all property cases. The cap is 20; past it the trace throws.
- **Axis sign check:** ×30 traces back to 30 and ×150 traces back to 150.

## Pitfall-5 model difference, regenerated (n 1.50, Vogel base, CT 2, r = 30 mm)

| Rx | D1 | tyre − meridional at 45° | max \|tyre − meridional\| over φ | barrel − meridional at 45° | PITFALLS table |
|----|----|------|------|------|------|
| pl / −2.00 | 5.50 | −0.0143 mm | 0.0143 mm | 0.0274 mm | 0.03 mm |
| pl / −6.00 | 4.50 | −0.0040 mm | 0.0125 mm | 0.1515 mm | 0.16 mm |
| +4.00 / −6.00 | 7.00 | +0.0126 mm | 0.0213 mm | 0.0941 mm | 0.10 mm |
| −6.00 / −6.00 | 1.50 | −0.0858 mm | 0.0858 mm | 0.3783 mm | 0.39 mm |

- **Reading:** the existing PITFALLS table reproduces the **barrel** form minus the meridional model. The tyre form we implemented sits much closer to the meridional model.
- **Tyre vs barrel:** at −6/−6, r 30 the two forms differ by 0.464 mm at 45°. At r 35 they differ by 1.21 mm (from a scratch script, not in a test).
- **Scope:** per the plan, values are recorded here and not tuned. The PITFALLS table was left unchanged.

## Golden and convention checks (ENG-03)

- **Tyre golden:** `torusSag(0.01, 0.02, 20, 20)` = 6.2846026794. The barrel form (roles swapped) gives 6.3876046419. Both are asserted to ±1e-9.
- **Implicit-torus equation:** the residual is ≤ 1e-9·r_v² at 50 off-axis points for each of 4 cases: concave, convex, mixed (ca < 0 < cb) and −8/−6. The OC is decentred.
- **TABO golden:**
  - −2 −2 × 90: nasal and temporal are thicker than superior and inferior.
  - −2 −1 × 180: superior and inferior are thicker than nasal and temporal.
- **Mixed meridians (ENG-04):** +2,00 −4,00 × 90, rechteckig 52×38/18, PD 32, CR-39.
  - ok, binding constraint minCT, CT 1.8 mm.
  - Minimum outline ET is 1.078 mm, above minET 1.0. D1 is 0.50.
- **SC-4 cylinder case:** −12 −6 × 10 in 62×55/18, PD 32 returns BACK_SAG_UNDEFINED with `meridian: 'cross'` and `searched: true`.

## ENG-05 result for oblique cylinders on both eyes (explicit)

**PASS.** The `describe('ENG-05 OD/OS point reflection')` block has 7 tests; `-t 'ENG-05'` selects 25.

- **Point reflection:** for −2 −2 × 45, +4 −2 × 30 and −6 −1 × 120 on rund 50×50/18/PD 30 and rechteckig 52×38/18/PD 30:
  - D1(OS) `toBe` D1(OD).
  - |CT difference| ≤ 1e-9.
  - thicknessAt(OS, x, y) = thicknessAt(OD, −x, −y) within 1e-9 on the 41×41 bounding-box grid.
  - No tolerance was loosened.
- **Not a mirror image:** the mirror comparison differs by more than 0.05 mm (−2 −2 × 45, rechteckig).
- **Oblique pair check:** ×45, ×135 and −6 −1 × 45, OD and OS. On the 20 mm circle, the meridian at axis + 90° is thicker at every 5° point. No counterexample was found.

With these results, ENG-05's "computed per eye, not mirrored" now holds for cylinders, not only spheres.

## PITFALLS.md diff

```diff
-- Implement the **true torus** as the reference model: the profile circle in the cylinder-axis meridian, rotated about an axis parallel to it at the cross-curve radius. This is the "Zemax toroidal" form.
+- Implement the **true torus** as the reference model: the generating circle is always the meridian perpendicular to the cylinder axis (the cross curve; the steeper one only for a concave minus-cylinder back), swept along the axis direction at the base-curve radius — the tyre form used for mass-produced toric lenses; the barrel form swaps the roles.
+- Corrected 2026-11-06 per lens-critic m2 and D-03; the previous text described the barrel form.
```

The diff is one hunk in Pitfall 5. The difference table and the other pitfalls are unchanged.

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 RED | 103bf31 | test(01-08): add failing tests for the toric back surface |
| 1 GREEN | 01962a4 | feat(01-08): true tyre-torus back surface oriented to the TABO axis |
| 2 RED | 89f67fe | test(01-08): add failing tests for the ray-trace oracle and power matrix |
| 2 GREEN | f1e88db | feat(01-08): Snell ray-trace oracle and dioptric power matrix helpers |

## Verification

- `npm run lint`: exit 0.
- `npm run test:coverage`: exit 0.
  - 751 tests pass.
  - All files: 97.38 % lines, 95.94 % branches.
  - trace.js: 92.75 % lines; the uncovered lines are the normal-flip branch, which is unreachable for rays travelling −z.
- `npx vitest run src/engine/evaluate.test.js -t 'ENG-04'`: 3 tests pass.
- `npm run build && npm run test:e2e`: 18/18 pass on desktop and mobile. The page still sends cyl 0; the Zyl/Achse input arrives in 01-09.
- Acceptance greps:
  - D-03 = 1, MEDIUM = 1, "perpendicular to the cylinder axis" = 1, banned wording = 0.
  - Golden values present in sag.test.js.
  - "Corrected 2026-11-06" = 1.
  - `torusSag(` appears in non-comment code of design.js.
  - "thin-lens", "Oracle scope", "evaluateLens" and "seed: 43" are present.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The principal-meridian test compared bitwise against the meridional model**
- **Found during:** Task 1 GREEN.
- **Issue:** the meridional model computes c(φ) as (ca·u² + cb·v²)/r², which is 1 ulp off ca. Bitwise `toBe` failed for 2 of the 4 rows.
- **Fix:** the test now uses the plan's 1e-15 relative tolerance. That tolerance already applied to the sphereSag comparison.
- **Commit:** 01962a4.

**2. [Rule 3 - Blocking] The old tests assumed the 01-02 sphere-only behaviour**
- **Issue:** two tests depended on behaviour this plan removes:
  - "backSagAt rejects a toric back until 01-08" expected the removed throw.
  - The BACK_SAG_UNDEFINED data test expected `{ meridian: 'cross' }` without `axisDeg`.
- **Fix:**
  - The first test is replaced by a check that backSagAt is the torus rotated to the axis about a decentred OC.
  - The expected data now includes `axisDeg: 0`.
  - The `cyl-not-supported` invalid-spec case became `plus-cyl-must-be-transposed`.
- **Commits:** 103bf31, 01962a4.

**3. Process slip (no effect on the commits):** running `npx prettier --write` fetched a Prettier that the project does not install, and it reformatted 14 files with its defaults. Before committing, I restored those files with `git checkout -- <file>` one by one and reapplied my edits from a script. No commit contains the formatting.

**4. Minor:**
- The sag.js comment states the barrel difference as measured (0.46 mm at −6/−6, r 30), not the plan's "~0.4 mm".
- traceRay additionally returns `iterations: [front, back]` so the Newton bound can be tested.
- solveCT got an `earlyExit` parameter, which the plan described as allowed for the decimated outlines.

## Known Stubs

None. The page wiring for Zyl/Achse and transposition is plan 01-09.

## Notes for later plans

- 01-09 must transpose plus-cylinder input before calling the engine. `cyl > 0` returns INVALID_SPEC `plus-cyl-must-be-transposed`.
- The lens-critic in 01-11 should note that the PITFALLS table numbers describe the barrel form. The tyre form we implemented differs from the meridional model by at most 0.09 mm at −6/−6, r 30.
- The trace is not called by the page in phase 1 (T-01-09).

## Self-Check: PASSED
